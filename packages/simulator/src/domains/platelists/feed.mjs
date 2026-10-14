/**
 * The Part 5 §5.2 rule 8 change feed for an APX list route, as Part 24
 * §24.3 requires on `GET /v1/plate-lists` and `GET /v1/plate-lists/{id}/entries`.
 *
 * Unlike the native-route feed in `data/feed.mjs` (a ChangeFeedPage of
 * change payloads), an APX route's change page is the route's own list
 * envelope: `data` holds whole current representations, `meta` is absent,
 * `updateMode: change` and `cursor` are present (rule 8.1–8.2). Without a
 * cursor the page is empty and carries the head (8.3). A change belongs to
 * a filtered feed when the resource matched before or after it (8.4).
 * Removals are tombstones in `deleted[]` (8.5).
 *
 * Cursors are opaque names (`pl:00001`), scoped to (route, credential,
 * filter set) and to the grant held at issue; the same position re-issues
 * the same name, so a retried cursor yields the same page (rule 1).
 */
import { fail } from '../../kernel/problems.mjs';

export const RETENTION_MS = 7 * 86_400_000;
const DEFAULT_PAGE_SIZE = 100;

export function createApxFeed(sim, { collection, prefix, className }) {
  let cursors = new Map(); // name → cursor
  let byKey = new Map(); // (scope, credential, filters, position, grant) → name
  let tracked = new Map(); // change seq → { after, before }
  let latest = new Map(); // id → last tracked snapshot
  let graves = new Map(); // id → tombstone

  const coll = () => sim.store.collection(collection);
  const grantOf = (places) => (Array.isArray(places) ? [...places].sort() : null);
  const keyOf = (c) => JSON.stringify([c.scope, c.credential, c.filterKey, c.position, c.grant]);
  /** The credential a cursor belongs to (rule 5): the world credential name, else the token subject. */
  const credentialOf = (principal) => principal.raw?.credential ?? principal.sub;

  function reset() {
    cursors = new Map();
    byKey = new Map();
    tracked = new Map();
    latest = new Map();
    graves = new Map();
  }

  /** Remember the state a write left (call right after insert/update; pass the prior record on an update) so filters can test before and after. */
  function track(record, previous = null) {
    const after = structuredClone(record);
    const before = latest.get(record.id) ?? (previous ? structuredClone(previous) : null);
    tracked.set(sim.store.changeSeq, { after, before });
    latest.set(record.id, after);
  }

  /** Record a removal (call right after delete): the tombstone and the state it had. */
  function bury(previous, time = sim.clock.now()) {
    graves.set(previous.id, { id: previous.id, className, deleteTimestamp: time });
    tracked.set(sim.store.changeSeq, { after: null, before: structuredClone(previous) });
    latest.delete(previous.id);
  }

  function mint(fields) {
    const probe = { ...fields, grant: grantOf(fields.grant) };
    const known = byKey.get(keyOf(probe));
    if (known) return cursors.get(known);
    const name = `${prefix}:${String(cursors.size + 1).padStart(5, '0')}`;
    const c = { ...probe, name, issuedAt: sim.clock.now() };
    cursors.set(name, c);
    byKey.set(keyOf(c), name);
    return c;
  }

  function resolve(ctx, name, scope, filterKey) {
    const c = cursors.get(name);
    if (!c || c.scope !== scope) fail('target-not-found', `Cursor ${name} is not known for this feed. Re-sync with mode=full.`);
    if (c.credential !== credentialOf(ctx.principal)) fail('target-not-found', `Cursor ${name} is not known for this credential.`);
    if (c.filterKey !== filterKey) fail('target-not-found', `Cursor ${name} was issued for filter set ${c.filterKey}; it cannot be resumed with ${filterKey}. Re-sync that filter set with mode=full.`);
    if (sim.clock.nowMs() - Date.parse(c.issuedAt) > RETENTION_MS) {
      fail('target-not-found', `Cursor ${name} was issued ${c.issuedAt}; this server retains 7 days of change history. Re-sync with mode=full.`);
    }
    return c;
  }

  /**
   * One change page. `scope` names the route instance (the list id for
   * entries), `filter` the request's own filters, `belongs(rec)` whether a
   * state matches filter and visibility, `visible(rec)` whether the current
   * state may be shown at all, `toWire(rec)` the representation.
   */
  function page(ctx, { scope, filter, belongs, visible, toWire, route }) {
    const filterKey = JSON.stringify(filter);
    const credential = credentialOf(ctx.principal);
    const name = ctx.query.get('cursor');
    if (!name) {
      const head = mint({ scope, credential, filterKey, position: sim.store.changeSeq, grant: ctx.principal.places });
      return { data: [], updateMode: 'change', cursor: head.name, next: null };
    }
    const held = resolve(ctx, name, scope, filterKey);
    const pageSize = sim.world.plateListFeed?.pageSize ?? DEFAULT_PAGE_SIZE;
    const order = new Map(); // id → last seq, in first-seen order
    let position = held.position;
    let more = false;
    for (const ch of coll().changesAfter(held.position)) {
      const t = tracked.get(ch.seq);
      const states = t ? [t.after, t.before].filter(Boolean) : [coll().get(ch.id)].filter(Boolean);
      const counts = states.some((s) => belongs(s));
      if (counts && !order.has(ch.id) && order.size >= pageSize) {
        more = true;
        break;
      }
      position = ch.seq;
      if (counts) order.set(ch.id, ch.seq);
    }
    const data = [];
    const deleted = [];
    for (const id of order.keys()) {
      const current = coll().get(id);
      if (current) {
        if (visible(current)) data.push(toWire(current));
      } else if (graves.has(id)) deleted.push(graves.get(id));
    }
    const grantNow = grantOf(ctx.principal.places) ?? [];
    const additions = grantNow.filter((g) => g !== '*' && !sim.hierarchy.covers(held.grant ?? [], g));
    const next = mint({ scope, credential, filterKey, position, grant: ctx.principal.places });
    const qs = Object.entries(filter)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    return {
      data,
      updateMode: 'change',
      cursor: next.name,
      ...(deleted.length ? { deleted } : {}),
      ...(additions.length ? { grantAdditions: additions } : {}),
      next: more ? `${route}?${[...qs, 'mode=change', `cursor=${encodeURIComponent(next.name)}`].join('&')}` : null,
    };
  }

  return { reset, track, bury, page, credentialOf };
}
