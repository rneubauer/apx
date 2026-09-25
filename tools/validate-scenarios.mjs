#!/usr/bin/env node
/**
 * Validates the JSON payloads embedded in docs/scenarios/*.md against the
 * BUNDLED spec (spec/dist/apx-v1.json) so the scenario walkthroughs can
 * never drift from the specification. Run after `npm run spec:bundle`.
 *
 * A payload opts in with one or more marker comments directly above its
 * fenced ```json block (markers stack; every one applies to that block):
 *
 *   <!-- apx:validate LaneStatus -->              whole block is a LaneStatus
 *   <!-- apx:validate Posting at /postings/0 -->  subtree at a JSON pointer
 *   <!-- apx:request POST /v1/commands -->        block is the request body of
 *                                                 that operation
 *
 * `apx:request METHOD PATH` resolves the operation in the bundle (path
 * parameters and a query string are allowed: `/webhooks/{id}` matches
 * `/webhooks/3c4d…`) and validates the block against its
 * `application/json` requestBody schema, with OpenAPI 3.1 request
 * semantics: a readOnly property listed in `required` is not required in
 * a request. Append `invalid` (`<!-- apx:request POST /x invalid -->`)
 * for a body that is malformed on purpose — the operation is still
 * resolved, the body is not validated.
 *
 * Unannotated blocks (abridged native APDS payloads, non-APX JSON) are not
 * validated.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'spec', 'dist', 'apx-v1.json');
const SCENARIOS = join(ROOT, 'docs', 'scenarios');

const doc = JSON.parse(readFileSync(BUNDLE, 'utf8'));

// Upstream defect in the vendored APDS 4.1 spec: `Reference` declares
// `maxProperties: 1` while requiring BOTH `id` and `className`, which no
// object can satisfy. The vendored file is checksum-guarded and must not be
// edited, so the contradiction is relaxed here, for validation only.
delete doc.components.schemas.Reference.minProperties;
delete doc.components.schemas.Reference.maxProperties;

const unesc = (s) => s.replaceAll('~1', '/').replaceAll('~0', '~');
const esc = (s) => s.replaceAll('~', '~0').replaceAll('/', '~1');

/** Follow a chain of local $refs to the node it names. */
function deref(node, root) {
  let pointer = null;
  while (node && typeof node === 'object' && typeof node.$ref === 'string') {
    pointer = node.$ref.replace(/^#/, '');
    node = pointer.slice(1).split('/').map(unesc).reduce((n, k) => n?.[k], root);
  }
  return { node, pointer };
}

/** True when `name` is a readOnly property of `schema` (following $ref and allOf). */
function isReadOnly(schema, name, root, seen = new Set()) {
  const { node } = deref(schema, root);
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  const prop = node.properties?.[name];
  if (prop && (prop.readOnly === true || deref(prop, root).node?.readOnly === true)) return true;
  return (node.allOf ?? []).some((part) => isReadOnly(part, name, root, seen));
}

/**
 * OpenAPI 3.1: a readOnly property listed in `required` is required only in
 * responses. Strip those from every `required` in a request copy of the
 * bundle — including a `required` on the parent of an `allOf` whose
 * properties live in the parts (the vendored HierarchyElement does this).
 */
function stripReadOnlyRequired(root) {
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.required)) {
      const kept = node.required.filter((k) => !isReadOnly(node, k, root));
      if (kept.length) node.required = kept;
      else delete node.required;
    }
    Object.values(node).forEach(visit);
  };
  visit(root);
  return root;
}

const reqDoc = stripReadOnlyRequired(structuredClone(doc));

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(ajv);
ajv.addSchema({ ...doc, $id: 'apx://bundle' });
ajv.addSchema({ ...reqDoc, $id: 'apx://request' });

// ---------- operation index (for apx:request) ----------

const OPS = [];
for (const [path, item] of Object.entries(doc.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    if (!item[method]) continue;
    OPS.push({
      path,
      method: method.toUpperCase(),
      op: item[method],
      regex: new RegExp(
        '^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^/]+\\\}/g, '[^/]+') + '$'
      ),
      literal: path.replace(/\{[^/]+\}/g, '').length,
    });
  }
}

/** The most specific operation matching METHOD and a concrete path. */
function findOp(method, rawPath) {
  const path = rawPath.split('?')[0];
  return OPS.filter((o) => o.method === method && o.regex.test(path)).sort((a, b) => b.literal - a.literal)[0];
}

/** The ajv $ref for an operation's application/json request schema, or an error. */
function requestSchemaRef(o) {
  if (!o.op.requestBody) return { error: `${o.method} ${o.path} declares no requestBody` };
  const { node: body, pointer } = deref(o.op.requestBody, doc);
  if (!body?.content?.['application/json']) {
    return { error: `${o.method} ${o.path} requestBody declares no application/json content` };
  }
  const base = pointer ?? `/paths/${esc(o.path)}/${o.method.toLowerCase()}/requestBody`;
  return { ref: `apx://request#${base}/content/application~1json/schema` };
}

// ---------- markers ----------

const VALIDATE = /^<!--\s*apx:validate\s+(\w+)(?:\s+at\s+(\/\S*))?\s*-->$/;
const REQUEST = /^<!--\s*apx:request\s+(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)(\s+invalid)?\s*-->$/;

function resolvePointer(value, pointer) {
  if (pointer === '/') return value;
  let node = value;
  for (const raw of pointer.split('/').slice(1)) {
    const key = unesc(raw);
    node = Array.isArray(node) ? node[Number(key)] : node?.[key];
    if (node === undefined) return undefined;
  }
  return node;
}

const compiled = new Map();
function compile(ref) {
  if (!compiled.has(ref)) compiled.set(ref, ajv.compile({ $ref: ref }));
  return compiled.get(ref);
}

let checked = 0;
let requests = 0;
let failures = 0;
const fail = (msg, errors = []) => {
  failures += 1;
  console.error(`[scenarios:check] FAIL ${msg}`);
  for (const err of errors) console.error(`  ${err.instancePath || '/'} ${err.message}`);
};

function checkBlock(file, markers, payload) {
  for (const m of markers) {
    if (m.kind === 'request') {
      const o = findOp(m.method, m.path);
      if (!o) {
        fail(`${file}:${m.line} — no operation matches ${m.method} ${m.path}`);
        continue;
      }
      if (m.invalid) continue;
      const { ref, error } = requestSchemaRef(o);
      if (error) {
        fail(`${file}:${m.line} — ${error}`);
        continue;
      }
      requests += 1;
      const validate = compile(ref);
      if (!validate(payload)) fail(`${file}:${m.line} — request body of ${m.method} ${o.path}`, validate.errors);
      continue;
    }
    checked += 1;
    if (!doc.components.schemas[m.schema]) {
      fail(`${file}:${m.line} — unknown schema "${m.schema}"`);
      continue;
    }
    const target = resolvePointer(payload, m.pointer);
    if (target === undefined) {
      fail(`${file}:${m.line} — pointer ${m.pointer} not found in payload`);
      continue;
    }
    const validate = compile(`apx://bundle#/components/schemas/${m.schema}`);
    if (!validate(target)) {
      fail(`${file}:${m.line} — ${m.schema}${m.pointer === '/' ? '' : ` at ${m.pointer}`}`, validate.errors);
    }
  }
}

const files = readdirSync(SCENARIOS)
  .filter((f) => f.endsWith('.md'))
  .sort();

for (const file of files) {
  const lines = readFileSync(join(SCENARIOS, file), 'utf8').split('\n');
  let markers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    const v = t.match(VALIDATE);
    if (v) {
      markers.push({ kind: 'validate', schema: v[1], pointer: v[2] ?? '/', line: i + 1 });
      continue;
    }
    const r = t.match(REQUEST);
    if (r) {
      markers.push({ kind: 'request', method: r[1], path: r[2], invalid: Boolean(r[3]), line: i + 1 });
      continue;
    }
    if (/^<!--\s*apx:/.test(t)) {
      // an apx: comment that does not parse must never be silently skipped
      fail(`${file}:${i + 1} — malformed apx marker: ${t}`);
      continue;
    }
    if (t === '' && markers.length > 0) continue;
    if (t === '```json' && markers.length > 0) {
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== '```') end += 1;
      let payload;
      try {
        payload = JSON.parse(lines.slice(start, end).join('\n'));
      } catch (e) {
        fail(`${file}:${start} — invalid JSON: ${e.message}`);
        markers = [];
        i = end;
        continue;
      }
      checkBlock(file, markers, payload);
      markers = [];
      i = end;
      continue;
    }
    if (markers.length > 0) {
      fail(`${file}:${markers[0].line} — apx marker without a \`\`\`json block`);
      markers = [];
    }
  }
}

if (failures > 0) {
  console.error(`[scenarios:check] ${failures} failure(s) across ${checked} payload(s) and ${requests} request bod(ies)`);
  process.exit(1);
}
console.log(
  `[scenarios:check] ${checked} scenario payload(s) and ${requests} request bod(ies) valid across ${files.length} file(s)`
);
