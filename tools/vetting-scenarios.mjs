#!/usr/bin/env node
/**
 * Vetting-scenario runner.
 *
 * Validates the wire exchanges in docs/scenarios/by-module/<module>/scenarios.md
 * against the bundle at spec/dist/apx-v1.json and reports per-module coverage: operations,
 * declared response codes, Annex A (ICS) rows, command types, problem types.
 *
 *   npm run vetting                   # every module
 *   npm run vetting -- apx-control    # one module (name or path)
 *
 * Markers are HTML comments placed directly above a ```json block:
 *
 *   <!-- apx:module apx-control tag=Control ics=CTL -->
 *       once per file: which OpenAPI tag(s) and which Annex A prefix(es) to
 *       measure; both comma-separated, `_` in a tag stands for a space
 *       (tag=Data,Rate_Tables ics=EVT,SSE)
 *   <!-- apx:scenario CTL-01 kind=happy ics=APX-CTL-01,APX-CTL-03 -->
 *       starts a scenario; kind = happy | refusal | lifecycle | security | edge
 *   <!-- apx:request POST /v1/commands?x=y -->
 *       the next ```json block (if any) is the request body, validated against
 *       the operation's requestBody schema with readOnly properties not
 *       required (OpenAPI 3.1 semantics). Query keys are checked against the
 *       declared parameters. Append `invalid` when the body is deliberately
 *       malformed and the scenario is about the refusal.
 *   <!-- apx:response 202 -->
 *       the next ```json block is the response: the status MUST be declared on
 *       the operation and the body must validate against its schema. Problem
 *       bodies are cross-checked against the Part 12 registry (slug + status).
 *   <!-- apx:validate Schema at /pointer -->
 *       extra check of a subtree against a named component schema; several
 *       may be stacked above one block, alone or under a response marker.
 *
 *   gap=F-NN on a request or response marker declares a KNOWN spec gap that is
 *   logged in findings.md: a failure there is reported as a gap rather than a
 *   failure, and a gap marker that no longer fails is reported as resolved.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HERE = dirname(fileURLToPath(import.meta.url));
// APX_DIR points the runner at another checkout (a worktree) of the spec.
const APX = process.env.APX_DIR ? resolve(process.env.APX_DIR) : join(HERE, '..');
const SUITE = join(APX, 'docs', 'scenarios', 'by-module');
const BUNDLE = JSON.parse(readFileSync(join(APX, 'spec', 'dist', 'apx-v1.json'), 'utf8'));
const ANNEX = readFileSync(join(APX, 'docs', 'standard', 'annex-a-ics.md'), 'utf8');
const ERRORS = readFileSync(join(APX, 'docs', 'standard', '12-errors.md'), 'utf8');
const COMMAND_TYPES = JSON.parse(
  readFileSync(join(APX, 'spec', 'registries', 'apx-command-types.json'), 'utf8')
).userDefinedCodeListEntries.map((e) => e.definedValue);

const ICS_ROWS = [...ANNEX.matchAll(/^\| (APX-[A-Z]+-\d+)/gm)].map((m) => m[1]);
const PROBLEMS = new Map(
  [...ERRORS.matchAll(/^\| `([a-z0-9-]+)` \| (\d{3}) \|/gm)].map((m) => [m[1], Number(m[2])])
);
const PROBLEM_BASE = 'https://apx-standard.org/problems/';

// ---------- schema preparation ----------

// Upstream APDS 4.1 defect: Reference requires both id and className but caps
// maxProperties at 1. Relaxed for validation only, exactly as the apx
// validators do.
function relaxReference(doc) {
  delete doc.components.schemas.Reference.minProperties;
  delete doc.components.schemas.Reference.maxProperties;
  return doc;
}

// OpenAPI 3.1: a readOnly property listed in `required` is required only in
// responses. Strip those from `required` for request-body validation.
function stripReadOnlyRequired(node) {
  if (Array.isArray(node)) {
    node.forEach(stripReadOnlyRequired);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.required) && node.properties && typeof node.properties === 'object') {
    const kept = node.required.filter((k) => node.properties[k]?.readOnly !== true);
    if (kept.length) node.required = kept;
    else delete node.required;
  }
  Object.values(node).forEach(stripReadOnlyRequired);
}

function makeAjv(doc, id) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
  addFormats(ajv);
  ajv.addSchema({ ...doc, $id: id });
  return ajv;
}

const RESP_DOC = relaxReference(structuredClone(BUNDLE));
const REQ_DOC = relaxReference(structuredClone(BUNDLE));
stripReadOnlyRequired(REQ_DOC);
const respAjv = makeAjv(RESP_DOC, 'apx://resp');
const reqAjv = makeAjv(REQ_DOC, 'apx://req');

const compiled = new Map();
function validator(ajv, id, pointer) {
  const key = `${id}#${pointer}`;
  if (!compiled.has(key)) compiled.set(key, ajv.compile({ $ref: `${id}#${pointer}` }));
  return compiled.get(key);
}

const esc = (s) => s.replaceAll('~', '~0').replaceAll('/', '~1');
const unesc = (s) => s.replaceAll('~1', '/').replaceAll('~0', '~');

/** Follow local $refs; returns the resolved node and the pointer it lives at. */
function deref(node) {
  let pointer = null;
  while (node && typeof node === 'object' && node.$ref) {
    pointer = node.$ref.replace(/^#/, '');
    node = pointer.slice(1).split('/').map(unesc).reduce((n, k) => n?.[k], BUNDLE);
  }
  return { node, pointer };
}

function resolvePointer(value, pointer) {
  if (pointer === '/') return value;
  if (!pointer.startsWith('/')) return undefined; // a JSON pointer starts with `/`; anything else is a typo
  let node = value;
  for (const raw of pointer.split('/').slice(1)) {
    const key = unesc(raw);
    node = Array.isArray(node) ? node[Number(key)] : node?.[key];
    if (node === undefined) return undefined;
  }
  return node;
}

// ---------- operation index ----------

const OPS = [];
for (const [path, item] of Object.entries(BUNDLE.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    if (!item[method]) continue;
    const params = [...(item.parameters ?? []), ...(item[method].parameters ?? [])].map((p) => deref(p).node);
    OPS.push({
      path,
      method: method.toUpperCase(),
      op: item[method],
      params,
      regex: new RegExp(
        '^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^/]+\\\}/g, '[^/]+') + '$'
      ),
      literal: path.replace(/\{[^/]+\}/g, '').length,
    });
  }
}

function findOp(method, rawPath) {
  const path = rawPath.split('?')[0];
  return OPS.filter((o) => o.method === method && o.regex.test(path)).sort((a, b) => b.literal - a.literal)[0];
}

// ---------- result collection ----------

const fails = [];
const gaps = [];
const resolved = [];
const modules = new Map();

function ctxOf(file, line, gap) {
  return { file, line, gap, failed: false };
}
function fail(ctx, msg) {
  ctx.failed = true;
  const entry = `${ctx.file}:${ctx.line} — ${msg}`;
  if (ctx.gap) gaps.push(`${ctx.gap}  ${entry}`);
  else fails.push(entry);
}
function settle(ctx) {
  if (ctx.gap && !ctx.failed) resolved.push(`${ctx.gap}  ${ctx.file}:${ctx.line} no longer fails — remove the gap marker`);
}
function fmtErrors(errors) {
  return (errors ?? []).map((e) => `      ${e.instancePath || '/'} ${e.message}`).join('\n');
}

// ---------- markdown tokenizer ----------

const MARKER = /^<!--\s*apx:(module|scenario|request|response|validate)\s*(.*?)\s*-->$/;
const LOOKS_LIKE_MARKER = /^<!--\s*apx:/;

function parseArgs(text) {
  const attrs = {};
  const positional = [];
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const eq = tok.indexOf('=');
    // `k=v` is an attribute; a path (starts with `/`) is always positional
    // even when its query string contains `=`.
    if (eq > 0 && !tok.startsWith('/')) attrs[tok.slice(0, eq)] = tok.slice(eq + 1);
    else positional.push(tok);
  }
  return { attrs, positional };
}

function tokenize(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    const m = t.match(MARKER);
    if (m) {
      items.push({ type: 'marker', kind: m[1], ...parseArgs(m[2]), line: i + 1 });
      continue;
    }
    if (LOOKS_LIKE_MARKER.test(t)) {
      // an apx: comment that does not parse must never be silently skipped
      items.push({ type: 'json', line: i + 1, error: `malformed apx marker: ${t}` });
      continue;
    }
    if (t === '```json') {
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== '```') end += 1;
      const raw = lines.slice(start, end).join('\n');
      const item = { type: 'json', line: start };
      if (end === lines.length) item.error = 'unterminated ```json fence';
      else {
        try {
          item.payload = JSON.parse(raw);
        } catch (e) {
          item.error = e.message;
        }
      }
      items.push(item);
      i = end;
    }
  }
  return items;
}

// ---------- checks ----------

function checkRequest(cov, ctx, method, rawPath) {
  const op = findOp(method, rawPath);
  if (!op) {
    fail(ctx, `no operation matches ${method} ${rawPath}`);
    settle(ctx);
    return null;
  }
  if (!cov.ops.has(op.op.operationId)) cov.ops.set(op.op.operationId, new Set());
  const query = rawPath.includes('?') ? new URLSearchParams(rawPath.split('?')[1]) : new URLSearchParams();
  const declared = new Set(op.params.filter((p) => p.in === 'query').map((p) => p.name));
  for (const key of query.keys()) {
    if (!declared.has(key)) fail(ctx, `query parameter "${key}" is not declared on ${method} ${op.path}`);
  }
  for (const p of op.params.filter((q) => q.in === 'query' && q.required)) {
    if (!query.has(p.name)) fail(ctx, `required query parameter "${p.name}" missing on ${method} ${op.path}`);
  }
  // not settled here: the same ctx also covers the request body (if one
  // follows), and is settled once by the caller when the request is complete
  return op;
}

function checkRequestBody(cov, ctx, req, payload) {
  const { op, path, method } = req;
  if (req.invalid) return; // deliberately malformed request (the scenario tests the refusal)
  const d = op.requestBody ? deref(op.requestBody) : { node: null, pointer: null };
  const body = d.node;
  if (!body) {
    fail(ctx, `${method} ${path} declares no requestBody but the scenario sends one`);
    return;
  }
  const ct = body.content?.['application/json'] ? 'application/json' : Object.keys(body.content ?? {})[0];
  if (!ct) {
    fail(ctx, `${method} ${path} requestBody declares no content`);
    return;
  }
  const base = d.pointer ?? `/paths/${esc(path)}/${method.toLowerCase()}/requestBody`;
  const ptr = `${base}/content/${esc(ct)}/schema`;
  const v = validator(reqAjv, 'apx://req', ptr);
  if (!v(payload)) fail(ctx, `request body invalid for ${method} ${path}\n${fmtErrors(v.errors)}`);
  const type = payload?.commandType;
  if (typeof type === 'string') {
    cov.commandTypes.add(type);
    if (!COMMAND_TYPES.includes(type)) fail(ctx, `commandType "${type}" is not in registry apx-command-types`);
  }
}

function checkProblem(cov, ctx, body, status) {
  if (body?.status !== status) fail(ctx, `problem.status ${body?.status} differs from HTTP ${status}`);
  const type = String(body?.type ?? '');
  if (!type.startsWith(PROBLEM_BASE)) {
    fail(ctx, `problem.type "${type}" is not under ${PROBLEM_BASE}`);
    return;
  }
  const slug = type.slice(PROBLEM_BASE.length);
  cov.problems.add(slug);
  if (!PROBLEMS.has(slug)) {
    fail(ctx, `problem type "${slug}" is not registered in Part 12`);
    return;
  }
  if (PROBLEMS.get(slug) !== status) {
    fail(ctx, `problem type "${slug}" is registered as ${PROBLEMS.get(slug)}, used with ${status}`);
  }
}

function checkResponse(cov, ctx, req, status, payload) {
  const { op, path, method } = req;
  let resp = (op.responses ?? {})[status];
  if (!resp) {
    fail(ctx, `${method} ${path} does not declare a ${status} response`);
    settle(ctx);
    return;
  }
  cov.ops.get(op.operationId)?.add(status);
  let respPtr = `/paths/${esc(path)}/${method.toLowerCase()}/responses/${status}`;
  const d = deref(resp);
  if (d.pointer) respPtr = d.pointer;
  resp = d.node;
  const content = resp.content ?? {};
  // When a response offers both media types (APDS-native errors with the
  // APX problem alternative), a body that is a problem document is checked
  // as application/problem+json; anything else as application/json.
  const looksLikeProblem = typeof payload?.type === 'string' && payload.type.startsWith(PROBLEM_BASE);
  const ct =
    looksLikeProblem && content['application/problem+json']
      ? 'application/problem+json'
      : content['application/json']
        ? 'application/json'
        : Object.keys(content)[0];
  if (!ct) {
    fail(ctx, `${method} ${path} ${status} declares no content but the scenario shows a body`);
    settle(ctx);
    return;
  }
  const v = validator(respAjv, 'apx://resp', `${respPtr}/content/${esc(ct)}/schema`);
  if (!v(payload)) fail(ctx, `${status} response invalid for ${method} ${path}\n${fmtErrors(v.errors)}`);
  if (ct === 'application/problem+json') checkProblem(cov, ctx, payload, Number(status));
  settle(ctx);
}

function checkValidate(ctx, schema, pointer, payload) {
  if (!BUNDLE.components.schemas[schema]) {
    fail(ctx, `unknown schema "${schema}"`);
    return;
  }
  const node = resolvePointer(payload, pointer);
  if (node === undefined) {
    fail(ctx, `pointer ${pointer} not found in payload`);
    return;
  }
  const v = validator(respAjv, 'apx://resp', `/components/schemas/${schema}`);
  if (!v(node)) fail(ctx, `${schema} at ${pointer} invalid\n${fmtErrors(v.errors)}`);
}

// ---------- per-file processing ----------

function processFile(file) {
  const name = file.startsWith(SUITE) ? file.slice(SUITE.length + 1).split(sep).join('/') : basename(file);
  const items = tokenize(readFileSync(file, 'utf8').split('\n'));
  let mod = null;
  let req = null; // { op, path, method, params, gap, ctx } or { unresolved: true }
  // What the next ```json block is: `kind` is requestBody | response | null,
  // plus any number of stacked apx:validate checks that apply to the same block.
  let expect = null;

  const flushDangling = () => {
    if (!expect) return;
    if (expect.kind === 'response') fail(ctxOf(name, expect.line), 'apx:response marker without a ```json block');
    for (const v of expect.validates) fail(ctxOf(name, v.line), 'apx:validate marker without a ```json block');
    if (expect.kind === 'requestBody' && req?.op) {
      if (!req.invalid) {
        const body = req.op.requestBody && deref(req.op.requestBody).node;
        if (body?.required) fail(req.ctx, `${req.method} ${req.path} requires a request body but none follows the marker`);
      }
      settle(req.ctx); // request complete with no body
    }
    expect = null;
  };

  for (const item of items) {
    if (item.type === 'json') {
      if (item.error) {
        fail(ctxOf(name, item.line), item.error.startsWith('malformed') || item.error.startsWith('unterminated') ? item.error : `invalid JSON: ${item.error}`);
        expect = null;
        continue;
      }
      const ex = expect;
      expect = null;
      if (!ex) continue; // unannotated block: not validated
      if (ex.kind === 'requestBody') {
        checkRequestBody(mod.coverage, req.ctx, req, item.payload);
        settle(req.ctx); // request complete with its body
      } else if (ex.kind === 'response') {
        checkResponse(mod.coverage, ctxOf(name, ex.line, ex.gap), req, ex.status, item.payload);
      }
      for (const v of ex.validates) {
        const vctx = ctxOf(name, v.line, v.gap);
        checkValidate(vctx, v.schema, v.pointer, item.payload);
        settle(vctx);
      }
      continue;
    }

    // a validate marker stacks onto whatever is already pending for the next block
    if (item.kind === 'validate') {
      const [schema, at, pointer] = item.positional;
      const v = { schema, pointer: at === 'at' ? pointer : '/', line: item.line, gap: item.attrs.gap };
      if (expect) expect.validates.push(v);
      else expect = { kind: null, validates: [v] };
      continue;
    }

    // any other marker: whatever was pending must not have needed a body
    flushDangling();

    if (item.kind === 'module') {
      const [id] = item.positional;
      mod = {
        id,
        // `tag=Data,Rate_Tables`: comma-separated, `_` stands for a space
        tags: (item.attrs.tag ?? '').split(',').filter(Boolean).map((t) => t.replaceAll('_', ' ')),
        ics: (item.attrs.ics ?? '').split(',').filter(Boolean),
        coverage: { ops: new Map(), ics: new Set(), commandTypes: new Set(), problems: new Set(), scenarios: [] },
      };
      modules.set(id, mod);
      continue;
    }
    if (!mod) {
      fail(ctxOf(name, item.line), 'apx:module marker must come first');
      continue;
    }
    if (item.kind === 'scenario') {
      const [id] = item.positional;
      mod.coverage.scenarios.push({ id, kind: item.attrs.kind ?? 'unspecified' });
      for (const row of (item.attrs.ics ?? '').split(',').filter(Boolean)) {
        if (!ICS_ROWS.includes(row)) fail(ctxOf(name, item.line), `unknown ICS row ${row}`);
        mod.coverage.ics.add(row);
      }
      continue;
    }
    if (item.kind === 'request') {
      const [method, rawPath = '', flag] = item.positional;
      const ctx = ctxOf(name, item.line, item.attrs.gap);
      const op = checkRequest(mod.coverage, ctx, method, rawPath);
      // an unresolved request keeps a sentinel so the following response is
      // skipped quietly instead of producing a second, misleading failure
      req = op ? { ...op, gap: item.attrs.gap, invalid: flag === 'invalid', ctx } : { unresolved: true };
      expect = op ? { kind: 'requestBody', line: item.line, validates: [] } : null;
      continue;
    }
    if (item.kind === 'response') {
      if (req?.unresolved) continue;
      if (!req) {
        fail(ctxOf(name, item.line), 'apx:response without a preceding apx:request');
        continue;
      }
      expect = { kind: 'response', status: item.positional[0], line: item.line, gap: item.attrs.gap, validates: [] };
      continue;
    }
  }
  flushDangling();
}

// ---------- coverage report ----------

function report(mod) {
  const cov = mod.coverage;
  const ops = OPS.filter((o) => (o.op.tags ?? []).some((t) => mod.tags.includes(t)));
  const prefixes = mod.ics.map((p) => `APX-${p}-`);
  const inModule = (row) => prefixes.some((p) => row.startsWith(p));
  const lines = [];
  lines.push(`\n== ${mod.id}  (tags ${mod.tags.join(', ')}; Annex A ${prefixes.map((p) => p + 'NN').join(', ')})`);
  const kinds = {};
  for (const s of cov.scenarios) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
  lines.push(`scenarios: ${cov.scenarios.length}  ${Object.entries(kinds).map(([k, n]) => `${k}=${n}`).join(' ')}`);

  let declared = 0;
  let covered = 0;
  let opsCovered = 0;
  lines.push('operations:');
  for (const o of ops) {
    const statuses = Object.keys(o.op.responses ?? {});
    const hit = cov.ops.get(o.op.operationId) ?? new Set();
    declared += statuses.length;
    covered += statuses.filter((s) => hit.has(s)).length;
    if (cov.ops.has(o.op.operationId)) opsCovered += 1;
    const cells = statuses.map((s) => (hit.has(s) ? `[${s}]` : ` ${s} `)).join(' ');
    lines.push(`  ${cov.ops.has(o.op.operationId) ? 'x' : ' '} ${o.method.padEnd(4)} ${o.path.padEnd(34)} ${cells}`);
  }
  lines.push(`  operations ${opsCovered}/${ops.length}   declared responses ${covered}/${declared}`);

  const rows = ICS_ROWS.filter(inModule);
  const cited = rows.filter((r) => cov.ics.has(r));
  const missing = rows.filter((r) => !cov.ics.has(r));
  lines.push(`ICS rows: ${cited.length}/${rows.length}${missing.length ? `   missing: ${missing.join(', ')}` : ''}`);
  const foreign = [...cov.ics].filter((r) => !inModule(r));
  if (foreign.length) lines.push(`  also cited: ${foreign.join(', ')}`);

  if (cov.commandTypes.size) {
    const unused = COMMAND_TYPES.filter((t) => !cov.commandTypes.has(t));
    lines.push(`command types: ${cov.commandTypes.size}/${COMMAND_TYPES.length}${unused.length ? `   unused: ${unused.join(', ')}` : ''}`);
  }
  lines.push(`problem types used: ${[...cov.problems].sort().join(', ') || '(none)'}`);
  return lines.join('\n');
}

// ---------- main ----------

const args = process.argv.slice(2);
const moduleFile = (m) => join(SUITE, m, 'scenarios.md');
const files = args.length
  ? args.map((a) => (/^apx-[a-z]+$/.test(a) ? moduleFile(a) : resolve(a)))
  : readdirSync(SUITE, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('apx-'))
      .map((d) => d.name)
      .sort()
      .map(moduleFile);

for (const f of files) processFile(f);

for (const mod of modules.values()) console.log(report(mod));

if (!args.length) {
  const citedAnywhere = new Set([...modules.values()].flatMap((m) => [...m.coverage.ics]));
  const uncited = ICS_ROWS.filter((r) => !citedAnywhere.has(r));
  console.log(`\n== all modules: Annex A rows cited ${ICS_ROWS.length - uncited.length}/${ICS_ROWS.length}`);
  if (uncited.length) console.log(`  never cited: ${uncited.join(', ')}`);
}

if (gaps.length) {
  console.log(`\nknown gaps (${gaps.length}) — see findings.md:`);
  for (const g of gaps) console.log(`  ${g}`);
}
if (resolved.length) {
  console.log(`\nresolved gaps (${resolved.length}):`);
  for (const r of resolved) console.log(`  ${r}`);
}
if (fails.length) {
  console.error(`\nFAILURES (${fails.length}):`);
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nall checks passed');
