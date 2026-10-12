/**
 * The bundle, indexed: operations by method + path, request/response
 * validators compiled lazily from the OpenAPI document, scopes per
 * operation, and the registries the standard publishes.
 *
 * The validation rules mirror tools/vetting-scenarios.mjs so a payload the
 * suite accepts is a payload the simulator accepts, and vice versa.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APX_DIR = process.env.APX_DIR ? resolve(process.env.APX_DIR) : resolve(HERE, '..', '..', '..', '..');

export const BUNDLE = JSON.parse(readFileSync(join(APX_DIR, 'spec', 'dist', 'apx-v1.json'), 'utf8'));
export const EDITION = JSON.parse(readFileSync(join(APX_DIR, 'spec', 'edition.json'), 'utf8'));

// ---------- registries ----------

export const REGISTRIES = new Map();
for (const file of readdirSync(join(APX_DIR, 'spec', 'registries'))) {
  if (!file.startsWith('apx-') || !file.endsWith('.json')) continue;
  const doc = JSON.parse(readFileSync(join(APX_DIR, 'spec', 'registries', file), 'utf8'));
  REGISTRIES.set(doc.name, {
    name: doc.name,
    version: doc.version,
    locator: doc.locator,
    values: doc.userDefinedCodeListEntries.map((e) => e.definedValue),
  });
}
export const registryValues = (name) => REGISTRIES.get(name)?.values ?? [];

// APDS EventTypeEnum values are the native topics (Part 8 §8.1).
export const APDS_EVENT_TYPES = BUNDLE.components.schemas.EventTypeEnum?.enum ?? [];
export const APX_TOPICS = registryValues('apx-topics');
export const ALL_TOPICS = new Set([...APX_TOPICS, ...APDS_EVENT_TYPES]);
export const APX_SCOPES = Object.keys(BUNDLE.components.securitySchemes.apxOAuth.flows.clientCredentials.scopes);
export const APDS_ROLES = Object.keys(BUNDLE.components.securitySchemes.oAuth.flows.clientCredentials.scopes);

// ---------- schema preparation (identical to the vetting runner) ----------

function relaxReference(doc) {
  delete doc.components.schemas.Reference.minProperties;
  delete doc.components.schemas.Reference.maxProperties;
  return doc;
}

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

export const esc = (s) => s.replaceAll('~', '~0').replaceAll('/', '~1');
export const unesc = (s) => s.replaceAll('~1', '/').replaceAll('~0', '~');

/** Follow local $refs; returns the resolved node and the pointer it lives at. */
export function deref(node) {
  let pointer = null;
  while (node && typeof node === 'object' && node.$ref) {
    pointer = node.$ref.replace(/^#/, '');
    node = pointer.slice(1).split('/').map(unesc).reduce((n, k) => n?.[k], BUNDLE);
  }
  return { node, pointer };
}

export function schema(name) {
  return BUNDLE.components.schemas[name];
}

/** Validate a value against a named component schema (response dialect). */
export function validateSchema(name, value) {
  const v = validator(respAjv, 'apx://resp', `/components/schemas/${name}`);
  return v(value) ? null : v.errors;
}

/** Validate a value against a named component schema with readOnly-required relaxed (request dialect). */
export function validateRequestSchema(name, value) {
  const v = validator(reqAjv, 'apx://req', `/components/schemas/${name}`);
  return v(value) ? null : v.errors;
}

// ---------- operation index ----------

const NATIVE_PREFIXES = ['/places', '/observations', '/contacts', '/rights', '/rates', '/sessions', '/quotes'];

export const OPS = [];
for (const [path, item] of Object.entries(BUNDLE.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    if (!item[method]) continue;
    const op = item[method];
    const params = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p) => deref(p).node);
    const native = NATIVE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
    const webhooks = path.startsWith('/webhooks');
    const apxScopes = (op.security ?? []).flatMap((s) => s.apxOAuth ?? []);
    const apdsRoles = (op.security ?? []).flatMap((s) => s.oAuth ?? []);
    const idem = params.find((p) => p.in === 'header' && p.name === 'Idempotency-Key');
    OPS.push({
      path,
      method: method.toUpperCase(),
      operationId: op.operationId,
      op,
      params,
      native,
      webhooks,
      tags: op.tags ?? [],
      // The scope rule: APX routes carry their own scope; native routes are
      // apx.data:read / apx.data:write (Part 5) and also accept the APDS
      // role the bundle declares; /webhooks is apx.subscriptions:manage.
      scopes: apxScopes.length ? apxScopes : native ? [method === 'get' ? 'apx.data:read' : 'apx.data:write'] : [],
      apdsRoles,
      secured: (op.security ?? []).length > 0 || native,
      idempotency: idem ? { required: idem.required === true } : null,
      regex: new RegExp(
        '^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^/]+\\\}/g, '([^/]+)') + '$'
      ),
      paramNames: [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]),
      literal: path.replace(/\{[^/]+\}/g, '').length,
    });
  }
}

export const OPS_BY_ID = new Map(OPS.map((o) => [o.operationId, o]));

export function findOp(method, rawPath) {
  const path = rawPath.split('?')[0];
  const matches = OPS.filter((o) => o.method === method && o.regex.test(path)).sort((a, b) => b.literal - a.literal);
  const op = matches[0];
  if (!op) return null;
  const m = path.match(op.regex);
  const params = {};
  op.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
  return { op, params };
}

export function pathExists(rawPath) {
  const path = rawPath.split('?')[0];
  return OPS.some((o) => o.regex.test(path));
}

// ---------- request / response validation ----------

export function requestContent(op) {
  const d = op.op.requestBody ? deref(op.op.requestBody) : { node: null, pointer: null };
  const body = d.node;
  if (!body) return null;
  const ct = body.content?.['application/json'] ? 'application/json' : Object.keys(body.content ?? {})[0];
  if (!ct) return null;
  const base = d.pointer ?? `/paths/${esc(op.path)}/${op.method.toLowerCase()}/requestBody`;
  return { contentType: ct, pointer: `${base}/content/${esc(ct)}/schema`, required: body.required === true, schema: body.content[ct].schema };
}

export function validateRequestBody(op, payload) {
  const rc = requestContent(op);
  if (!rc) return { errors: null, declared: false };
  const v = validator(reqAjv, 'apx://req', rc.pointer);
  return { errors: v(payload) ? null : v.errors, declared: true };
}

/** Validate a request body against one branch of a native PUT's anyOf (full vs change, Part 5 §5.1a). */
export function validateRequestBranch(op, payload, branchIndex) {
  const rc = requestContent(op);
  if (!rc) return null;
  const v = validator(reqAjv, 'apx://req', `${rc.pointer}/anyOf/${branchIndex}`);
  return v(payload) ? null : v.errors;
}

export function responseContent(op, status) {
  let resp = (op.op.responses ?? {})[String(status)];
  if (!resp) return null;
  let respPtr = `/paths/${esc(op.path)}/${op.method.toLowerCase()}/responses/${status}`;
  const d = deref(resp);
  if (d.pointer) respPtr = d.pointer;
  resp = d.node;
  return { content: resp.content ?? {}, pointer: respPtr, headers: resp.headers ?? {} };
}

export const PROBLEM_BASE = 'https://apx-standard.org/problems/';

export function validateResponseBody(op, status, payload) {
  const rc = responseContent(op, status);
  if (!rc) return { errors: [{ message: `${op.method} ${op.path} does not declare a ${status} response` }], declared: false };
  const looksLikeProblem = typeof payload?.type === 'string' && payload.type.startsWith(PROBLEM_BASE);
  const ct =
    looksLikeProblem && rc.content['application/problem+json']
      ? 'application/problem+json'
      : rc.content['application/json']
        ? 'application/json'
        : Object.keys(rc.content)[0];
  if (!ct) return { errors: payload === undefined ? null : [{ message: `${status} declares no content` }], declared: true, contentType: null };
  const v = validator(respAjv, 'apx://resp', `${rc.pointer}/content/${esc(ct)}/schema`);
  return { errors: v(payload) ? null : v.errors, declared: true, contentType: ct };
}

/** ajv errors → Part 12 §12.4 `errors[]` members. */
export function ajvToErrors(errors) {
  return (errors ?? []).slice(0, 20).map((e) => ({
    pointer: e.instancePath || '/',
    detail: e.keyword === 'required' ? `missing required member "${e.params.missingProperty}"` : e.message,
  }));
}

export function fmtErrors(errors) {
  return (errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
}
