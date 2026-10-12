/**
 * apx-data model: the eight native classes, the Part 5 §5.1 change-mode
 * merge and the change-feed diff, and the §5.1a error dialect (APDS
 * `ResponseStatus` by default, the registered Problem on request).
 */
import { ProblemError } from '../../kernel/problems.mjs';

/**
 * One row per native class. `collection` is the canonical store name,
 * `event` the APDS EventTypeEnum stem, `prefix` the cursor prefix of a
 * §5.2 feed (absent: the class has no feed), `assigned` the readOnly
 * members the server assigns (never taken from a body).
 */
export const CLASSES = {
  places: { collection: 'places', route: '/places', label: 'Place', event: 'Place', prefix: 'p', createStatus: 201, assigned: ['childIds', 'rightSpecifications'] },
  sessions: { collection: 'sessions', route: '/sessions', label: 'Session', event: 'Session', prefix: 'c', className: 'Session', createStatus: 201, assigned: ['initiator'], issuerMember: 'initiator' },
  rateTables: { collection: 'rateTables', route: '/rates', label: 'Rate table', event: 'Rate', prefix: 'r', className: 'RateTable', createStatus: 200, assigned: ['rateResponsibleParty'], issuerMember: 'rateResponsibleParty' },
  rightSpecs: { collection: 'rightSpecs', route: '/rights/specs', label: 'RightSpecification', event: 'RightSpecification', className: 'RightSpecification', createStatus: 201, assigned: ['issuer'], issuerMember: 'issuer' },
  assignedRights: { collection: 'assignedRights', route: '/rights/assigned', label: 'Assigned right', event: 'AssignedRight', prefix: 'a', className: 'AssignedRight', createStatus: 201, assigned: ['assignedRightIssuer'], issuerMember: 'assignedRightIssuer', upsert: true },
  contacts: { collection: 'contacts', route: '/contacts', label: 'Contact', className: 'ContactPoint', createStatus: 201, assigned: [] },
  observations: { collection: 'observations', route: '/observations', label: 'Observation', prefix: 'o', className: 'Observation', createStatus: 201, assigned: [] },
};

export const FEED_CLASSES = Object.values(CLASSES).filter((c) => c.prefix);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id) => typeof id === 'string' && UUID.test(id);

/** APDS class name of a HierarchyElement from its `type` (place → Place, identifiedArea → IdentifiedArea). */
export const classNameOfType = (type) => (typeof type === 'string' && type ? type[0].toUpperCase() + type.slice(1) : 'HierarchyElement');

export function classNameOf(cls, record) {
  if (cls.collection === 'places') return classNameOfType(record?.type);
  return cls.className;
}

export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idArray = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && x.id !== undefined);

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

/** Strip simulator-internal `_` members (deep copy, top level only). */
export function plain(record) {
  const out = {};
  for (const [k, v] of Object.entries(record ?? {})) if (!k.startsWith('_') && k !== 'recordInfo') out[k] = structuredClone(v);
  return out;
}

/** The `_` hints of a record, to carry across a replacement. */
export function hints(record) {
  const out = {};
  for (const [k, v] of Object.entries(record ?? {})) if (k.startsWith('_')) out[k] = v;
  return out;
}

// ---------- §5.1 change mode: absent = unchanged, null = clear, id-bearing nested members merge ----------

function mergeNested(current, patch) {
  const merged = mergeChange(current, patch);
  if (!deepEqual(merged, current) && typeof current.version === 'number') merged.version = current.version + 1;
  return merged;
}

function mergeIdArray(current, patch) {
  const out = current.map((el) => {
    const p = patch.find((x) => x.id === el.id);
    return p && isObj(el) ? mergeNested(el, p) : el;
  });
  for (const p of patch) if (!current.some((el) => el?.id === p.id)) out.push(p);
  return out;
}

export function mergeChange(current, patch) {
  const out = structuredClone(current);
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || k === 'version') continue;
    if (v === null) delete out[k];
    else if (idArray(v) && Array.isArray(out[k])) out[k] = mergeIdArray(out[k], v);
    else if (isObj(v) && isObj(out[k]) && v.id !== undefined && v.id === out[k].id) out[k] = mergeNested(out[k], v);
    else out[k] = structuredClone(v);
  }
  return out;
}

// ---------- §5.2 feed items: identity plus only what changed since the base ----------

export function diff(base, current) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(current)])) {
    if (k === 'id' || k === 'version') continue;
    if (!Object.hasOwn(current, k)) out[k] = null;
    else if (!Object.hasOwn(base, k)) out[k] = current[k];
    else if (deepEqual(base[k], current[k])) continue;
    else if (idArray(base[k]) && idArray(current[k])) {
      out[k] = current[k]
        .map((el) => {
          const b = base[k].find((x) => x.id === el.id);
          if (!b) return el;
          const d = diff(b, el);
          return Object.keys(d).length ? { id: el.id, ...(el.version !== undefined ? { version: el.version } : {}), ...d } : null;
        })
        .filter(Boolean);
    } else out[k] = current[k];
  }
  return out;
}

// ---------- the §5.1a error dialect ----------

/** Thrown inside a handler; the route wrapper returns `envelope` as the response. */
export class DataResponse extends Error {
  constructor(envelope) {
    super(`data response ${envelope.status}`);
    this.envelope = envelope;
  }
}

const wantsProblem = (ctx) => /application\/problem\+json/.test(ctx.headers.accept ?? '');

/**
 * A refusal on a native route: the APDS ResponseStatus (with `ids` where the
 * class lists the conflicting/missing ids) unless the client asked for
 * problem+json, in which case the registered Problem.
 */
export function refuse(ctx, status, slug, message, ids, extra = {}) {
  if (wantsProblem(ctx) || ![400, 404, 409].includes(status)) {
    throw new DataResponse({ status, body: new ProblemError(slug, message, { ...extra, status }).toProblem(ctx.path) });
  }
  throw new DataResponse({ status, body: { status: 'error', code: status, message, ...(ids?.length ? { ids } : {}) } });
}

/** A refusal that is always a Problem (cursor refusals, §5.1a). */
export function problem(ctx, slug, detail) {
  const p = new ProblemError(slug, detail);
  throw new DataResponse({ status: p.status, body: p.toProblem(ctx.path) });
}

export const ok = (code, message, ids, headers) => ({ status: code, body: { status: 'ok', code, message, ...(ids?.length ? { ids } : {}) }, ...(headers ? { headers } : {}) });

/** Wrap a handler so a thrown DataResponse becomes its response. */
export const route = (fn) => async (ctx) => {
  try {
    return await fn(ctx);
  } catch (e) {
    if (e instanceof DataResponse) return e.envelope;
    throw e;
  }
};

/** A Unix-epoch integer (APDS) or an RFC 3339 instant (as some clients send) → ms, or undefined. */
export function epochParam(ctx, name) {
  const raw = ctx.query.get(name);
  if (raw === undefined || raw === '') return undefined;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) refuse(ctx, 400, 'invalid-request', `${name} must be a Unix epoch integer (seconds), got "${raw}".`);
  return ms;
}

/** The members of a filter that define a feed's filter set (§5.2 rule 5). */
export function filterSet(ctx) {
  const skip = new Set(['page', 'mode', 'cursor', 'expand']);
  const out = {};
  for (const k of ctx.query.keys().filter((k) => !skip.has(k)).sort()) out[k] = ctx.query.list(k).sort();
  return out;
}
