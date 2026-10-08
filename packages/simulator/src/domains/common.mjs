/**
 * Helpers every domain module shares: the APDS pagination envelope,
 * status-history entries, visibility checks under the Part 9 §9.3a rules,
 * reference resolution, and small conveniences.
 */
import { fail } from '../kernel/problems.mjs';

export const PAGE_SIZE = 100;

/** Strip simulator-internal members (leading underscore) from a record for the wire. */
export function wire(record) {
  if (Array.isArray(record)) return record.map(wire);
  if (!record || typeof record !== 'object') return record;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

/** APDS `{meta, data}` envelope for a list; `page` is 1-based. */
export function paginate(ctx, rows, { pageSize = PAGE_SIZE } = {}) {
  const page = Math.max(1, ctx.query.int('page') ?? 1);
  const offset = (page - 1) * pageSize;
  return {
    meta: { referenceInstant: Math.floor(ctx.clock.nowMs() / 1000), offset, pageSize, total: rows.length },
    data: rows.slice(offset, offset + pageSize).map(wire),
  };
}

export const entry = (state, time, actor, detail) => ({ state, time, actor, ...(detail ? { detail } : {}) });

export const refOf = (id, className) => ({ id, className });

export const isRef = (v) => v && typeof v === 'object' && typeof v.id === 'string';

/** 404 target-not-found for a path-addressed resource. */
export function notFound(what, id) {
  fail('target-not-found', `No ${what} ${id} visible to this credential.`);
}

/**
 * Fetch a record by path id with the §9.3a visibility rules: missing → 404;
 * owning place outside the grant → 403 insufficient-grant (placeOf gives
 * the place id); narrower ownership (ownedBy false) → 404.
 */
export function getVisible(ctx, collection, id, { what = collection, placeOf, ownedBy } = {}) {
  const rec = ctx.coll(collection).get(id);
  if (!rec) notFound(what, id);
  const place = placeOf ? placeOf(rec) : rec._place;
  if (place) {
    if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, place)) {
      fail('insufficient-grant', `${what} ${id} is at place ${place}, outside the token's apx_places grant.`);
    }
  }
  if (ownedBy && !ownedBy(rec)) notFound(what, id);
  return rec;
}

/** Rows of a collection whose place lies inside the grant (empty under no grant, §9.3a rule 3). */
export function visibleRows(ctx, collection, placeOf = (r) => r._place) {
  if (!ctx.principal.hasGrant) return [];
  return ctx.coll(collection).find((r) => {
    const place = placeOf(r);
    return !place || ctx.hierarchy.covers(ctx.principal.places, place);
  });
}

/** Resolve a Reference in a body to a hierarchy node, or 422 reference-unknown. */
export function requireNode(ctx, reference, what = 'target') {
  if (!isRef(reference)) fail('invalid-request', `${what} must be a Reference`, { errors: [{ pointer: `/${what}`, detail: 'Reference required' }] });
  const node = ctx.hierarchy.get(reference.id);
  if (!node) fail('reference-unknown', `${what} ${reference.className ?? ''} ${reference.id} names nothing that exists or is visible to the caller.`.replace(/\s+/g, ' '));
  return node;
}

/** The place a body target resolves to, with the grant check. */
export function placeOfTarget(ctx, reference, what = 'target') {
  const node = requireNode(ctx, reference, what);
  const place = ctx.hierarchy.placeOf(node.id);
  if (!ctx.principal.hasGrant) fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');
  if (!ctx.hierarchy.covers(ctx.principal.places, node.id)) {
    fail('insufficient-grant', `${node.className} ${node.id} belongs to place ${place?.id}, which is not in the token's apx_places grant.`);
  }
  return { node, place };
}

/** Optimistic concurrency (Part 4 §4.2a): If-Match or body.version against the current version. */
export function checkPrecondition(ctx, current) {
  const expected = ctx.ifMatch ?? (typeof ctx.body?.version === 'number' ? ctx.body.version : undefined);
  if (expected !== undefined && expected !== current.version) {
    fail('version-conflict', `Update targets version ${expected}; the current version is ${current.version}.`, { currentVersion: current.version });
  }
}

export const shortId = (id) => (typeof id === 'string' ? `${id.slice(0, 8)}-${id.slice(-4)}` : String(id));

export const mls = (text, language = 'en') => [{ language, string: text }];

export const money = (value, currencyType = 'USD') => ({ currencyType, currencyValue: Number(Number(value).toFixed(2)) });

export function parseInstant(value, name) {
  if (value === undefined) return undefined;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) fail('invalid-request', `${name} is not an RFC 3339 instant`, { errors: [{ pointer: `/${name}`, detail: 'RFC 3339 expected' }] });
  return ms;
}

/** The first `string` of a MultilingualString, or the string itself. */
export const text = (m) => (Array.isArray(m) ? m[0]?.string : typeof m === 'string' ? m : undefined);
