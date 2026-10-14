/**
 * Helpers every domain module shares: the APDS pagination envelope,
 * status-history entries, visibility checks under the Part 9 §9.3a rules,
 * reference resolution, small conveniences, and the Part 5 §5.2 rule 8
 * change feed every APX list route shares (installChangeFeeds).
 */
import { createHash } from 'node:crypto';
import { fail } from '../kernel/problems.mjs';
import { BUNDLE } from '../kernel/spec.mjs';

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

// ---------- Part 5 §5.2 rule 8: the change feed on APX list routes ----------
//
// Every APX list route the bundle decorates with `ModeParam` (the rule-8
// table) answers `mode=change&cursor=` here, so no domain module carries
// its own feed: `installChangeFeeds(sim)` wraps each such handler at world
// load. A change page is computed from the route's own `mode=full` answer,
// so grant scoping, the route's filters and its wire view are exactly the
// list's. A cursor names a snapshot (id → digest of the representation)
// of what the credential saw under that filter set; the next page carries
// every resource whose representation differs from the snapshot, whole
// (difference 2), including those that left the filtered view (difference
// 4). A resource gone from the unfiltered view is a tombstone (difference
// 5). A domain that serves its own feed sets `changeFeed: true` on its
// handler and is left alone.

const FEED_RETENTION_MS = 7 * 86_400_000; // rule 2: honour cursors at least 7 days old
const FEED_PAGE_SIZE = 100;
const FEED_RESERVED = new Set(['mode', 'cursor', 'page']);
const LAST = '￿'; // sorts tombstones (no representation) after dated changes

/** The rule-8 table, read from the bundle: operationId → item schema name (the tombstone `className`). */
export const APX_FEED_ROUTES = (() => {
  const out = new Map();
  for (const [path, item] of Object.entries(BUNDLE.paths)) {
    const op = item.get;
    if (!path.startsWith('/v1/') || !op?.parameters?.some((p) => p.$ref === '#/components/parameters/ModeParam')) continue;
    const ref = op.responses?.['200']?.content?.['application/json']?.schema?.properties?.data?.items?.$ref;
    out.set(op.operationId, ref ? ref.split('/').pop() : 'Resource');
  }
  return out;
})();

const feedStates = new WeakMap(); // sim → { cursors: Map<name, cursor>, byKey: Map<key, name>, n }
const freshFeedState = () => ({ cursors: new Map(), byKey: new Map(), n: 0 });
const feedState = (sim) => feedStates.get(sim) ?? feedStates.set(sim, freshFeedState()).get(sim);

/** True for `mode=change`; `mode=full` or absent is the ordinary list; any other value is 400. */
export function isChangeMode(ctx) {
  const mode = ctx.query.get('mode');
  if (mode === undefined || mode === 'full') return false;
  if (mode === 'change') return true;
  return fail('invalid-request', `mode must be full or change, not ${mode}.`, { errors: [{ pointer: '?mode', detail: 'enum: full, change' }] });
}

const credentialOf = (principal) => principal.raw?.client ?? principal.sub;
const sortedGrant = (places) => (Array.isArray(places) ? [...places].sort() : null);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Every row of the route's ordinary answer under `entries` ([name, values] pairs), walking its pages. */
async function listAllRows(handler, ctx, entries) {
  const rows = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams();
    for (const [k, values] of entries) for (const v of values) params.append(k, v);
    if (page > 1) params.set('page', String(page));
    let out = await handler({ ...ctx, query: new ctx.query.constructor(params.toString()) });
    if (out && typeof out.status === 'number' && Object.hasOwn(out, 'body')) out = out.body;
    const data = Array.isArray(out?.data) ? out.data : [];
    rows.push(...data);
    const meta = out?.meta;
    if (!meta || !data.length || meta.offset + data.length >= meta.total) return rows;
  }
}

const byId = (rows) => new Map(rows.filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r]));
const digestsOf = (rows) => new Map([...rows].map(([id, r]) => [id, digest(r)]));

/** When a representation last changed, for ordering a page (oldest first). */
const changedAt = (r) => r.recordInfo?.lastUpdate ?? r.statusHistory?.at?.(-1)?.time ?? r.dateCollected ?? r.recordInfo?.creationTime ?? '';

function resolveCursor(sim, ctx, opId, name, filterKey) {
  const c = feedState(sim).cursors.get(name);
  if (!c || c.opId !== opId) fail('target-not-found', `Cursor ${name} is not known for this route.`);
  if (c.credential !== credentialOf(ctx.principal)) fail('target-not-found', `Cursor ${name} is not known for this credential.`);
  if (c.filterKey !== filterKey) fail('target-not-found', `Cursor ${name} was issued for another filter set; re-sync that filter set with mode=full.`);
  if (sim.clock.nowMs() - Date.parse(c.issuedAt) > FEED_RETENTION_MS) {
    fail('target-not-found', `Cursor ${name} was issued ${c.issuedAt}; this server retains 7 days of change history. Re-sync with mode=full.`);
  }
  return c;
}

/** The same position (route, credential, filters, grant, snapshot) re-issues the same cursor (rule 1). */
function mintCursor(sim, { opId, className, credential, filterKey, grant, snapshot }) {
  const state = feedState(sim);
  const key = digest([opId, credential, filterKey, grant, [...snapshot]]);
  const known = state.byKey.get(key);
  if (known) return state.cursors.get(known);
  const name = `${className.charAt(0).toLowerCase()}${className.slice(1)}:${String(++state.n).padStart(5, '0')}`;
  const cursor = { name, opId, credential, filterKey, grant, snapshot, issuedAt: sim.clock.now() };
  state.cursors.set(name, cursor);
  state.byKey.set(key, name);
  return cursor;
}

/** What changed since `held`: whole items (entered, updated, or left the filtered view) and tombstones. */
async function changesSince(held, now, handler, ctx, entries) {
  const current = digestsOf(now);
  const updated = [...current].filter(([id, d]) => held.snapshot.get(id) !== d).map(([id]) => ({ id, item: now.get(id) }));
  const leftIds = [...held.snapshot.keys()].filter((id) => !current.has(id));
  const unfiltered = leftIds.length && entries.length ? byId(await listAllRows(handler, ctx, [])) : now;
  const left = leftIds.map((id) => (unfiltered.has(id) ? { id, item: unfiltered.get(id), gone: true } : { id, tombstone: true, gone: true }));
  const when = (ch) => (ch.item ? changedAt(ch.item) : LAST);
  return { current, changes: [...updated, ...left].sort((a, b) => when(a).localeCompare(when(b)) || a.id.localeCompare(b.id)) };
}

/** One rule-8 change page for `opId`, in the route's own list envelope (difference 1: no `meta`). */
export async function changePage(sim, ctx, { opId, className, handler }) {
  const entries = ctx.query.keys().filter((k) => !FEED_RESERVED.has(k)).sort().map((k) => [k, ctx.query.all(k)]);
  const filterKey = JSON.stringify([ctx.params ?? {}, entries]);
  const credential = credentialOf(ctx.principal);
  const grant = sortedGrant(ctx.principal.places);
  const name = ctx.query.get('cursor');
  const held = name !== undefined ? resolveCursor(sim, ctx, opId, name, filterKey) : null;
  const now = byId(await listAllRows(handler, ctx, entries));
  const issue = (snapshot) => mintCursor(sim, { opId, className, credential, filterKey, grant, snapshot });
  const envelope = (data, deleted, cursor, more) => {
    const additions = held ? (grant ?? []).filter((g) => g !== '*' && !sim.hierarchy.covers(held.grant ?? [], g)) : [];
    const qs = entries.flatMap(([k, vs]) => vs.map((v) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`));
    return {
      data,
      updateMode: 'change',
      cursor: cursor.name,
      ...(deleted.length ? { deleted } : {}),
      ...(additions.length ? { grantAdditions: additions } : {}),
      next: more ? `${ctx.path}?${[...qs, 'mode=change', `cursor=${encodeURIComponent(cursor.name)}`].join('&')}` : null,
    };
  };

  // Difference 3: without a cursor, an empty page holding the feed's current head.
  if (!held) return envelope([], [], issue(digestsOf(now)), false);

  const { current, changes } = await changesSince(held, now, handler, ctx, entries);
  const page = changes.slice(0, FEED_PAGE_SIZE);
  const more = changes.length > page.length;
  const snapshot = new Map(held.snapshot);
  for (const ch of page) {
    if (ch.gone) snapshot.delete(ch.id);
    else snapshot.set(ch.id, current.get(ch.id));
  }
  const deleteTimestamp = sim.clock.now();
  return envelope(
    page.filter((ch) => ch.item).map((ch) => ch.item),
    page.filter((ch) => ch.tombstone).map((ch) => ({ id: ch.id, className, deleteTimestamp })),
    issue(more ? snapshot : current),
    more
  );
}

/**
 * Wrap every rule-8 list handler so `mode=change` is served by changePage.
 * `overrides` maps an operationId to `{ handler }`, the feed's own notion
 * of the list where the ordinary answer is a keyed lookup (GET
 * /v1/payments, rule 8 difference 6). The wrap happens once, at the first
 * world load (every domain has registered by then); the cursor ledger
 * resets with each world.
 */
export function installChangeFeeds(sim, overrides = {}) {
  let wrapped = false;
  sim.seed(() => {
    feedStates.set(sim, freshFeedState());
    if (wrapped) return;
    wrapped = true;
    for (const [opId, className] of APX_FEED_ROUTES) {
      const inner = sim.handlers.get(opId);
      if (!inner || inner.changeFeed) continue;
      const handler = overrides[opId]?.handler ?? inner;
      const outer = (ctx) => (isChangeMode(ctx) ? changePage(sim, ctx, { opId, className, handler }) : inner(ctx));
      Object.assign(outer, { allowEmptyBody: inner.allowEmptyBody, skipBodyValidation: inner.skipBodyValidation, changeFeed: true });
      sim.handlers.set(opId, outer);
    }
  });
}
