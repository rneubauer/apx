/**
 * The Part 5 §5.2 change feed: `mode=change&cursor=` on the five feed
 * routes. Cursors are opaque names (`c:00042`) for a position in the
 * class's change log, scoped to (class, credential, filter set) and to the
 * grant the credential held when the cursor was issued; serving the same
 * position again re-issues the same cursor, so a replayed cursor yields
 * the same page (rule 1). Positions older than the retention window, and
 * cursors presented under another credential or filter set, are 404
 * `target-not-found` — always a Problem (§5.1a).
 */
import { problem, diff, classNameOf, plain, epochParam } from './model.mjs';

export const RETENTION_MS = 7 * 86_400_000;
const DEFAULT_PAGE_SIZE = 100;

export function createFeed(sim, engine) {
  let cursors = new Map(); // name → cursor
  let byKey = new Map(); // (class, credential, filters, position, grant) → name

  function reset() {
    cursors = new Map();
    byKey = new Map();
  }

  /** The credential a cursor belongs to: the world credential's `client` alias, else the token subject. */
  const credentialOf = (principal) => principal.raw?.client ?? principal.sub;
  const grantOf = (places) => (Array.isArray(places) ? [...places].sort() : null);
  const keyOf = (c) => JSON.stringify([c.collection, c.credential, c.filterKey, c.position, JSON.stringify(c.grant)]);

  function register({ name, collection, credential, filterKey = '{}', position, grant, issuedAt }) {
    const c = { name, collection, credential, filterKey, position, grant: grantOf(grant), issuedAt: issuedAt ?? sim.clock.now() };
    cursors.set(name, c);
    if (!byKey.has(keyOf(c))) byKey.set(keyOf(c), name);
    return c;
  }

  function mint(cls, fields) {
    const probe = { ...fields, grant: grantOf(fields.grant) };
    const known = byKey.get(keyOf(probe));
    if (known) return cursors.get(known);
    const numbers = [...cursors.values()].filter((c) => c.name.startsWith(`${cls.prefix}:`)).map((c) => Number(c.name.slice(cls.prefix.length + 1)) || 0);
    const n = Math.max(0, ...numbers) + 1;
    return register({ ...fields, name: `${cls.prefix}:${String(n).padStart(5, '0')}` });
  }

  /** Register a cursor at the collection's current position (world history markers, the feedCursor injector). */
  function issueAt({ name, cls, credential, filter = {}, grant, issuedAt, position = sim.store.changeSeq }) {
    return register({ name, collection: cls.collection, credential, filterKey: JSON.stringify(filter), position, grant, issuedAt });
  }

  function resolve(ctx, cls, name, filterKey) {
    const c = cursors.get(name);
    if (!c || c.collection !== cls.collection) problem(ctx, 'target-not-found', `Cursor ${name} is not known for the ${cls.label} feed.`);
    if (c.credential !== credentialOf(ctx.principal)) problem(ctx, 'target-not-found', `Cursor ${name} is not known for this credential.`);
    if (c.filterKey !== filterKey) {
      problem(ctx, 'target-not-found', `Cursor ${name} was issued for filter set ${c.filterKey}; it cannot be resumed with ${filterKey}. Re-sync that filter set with mode=full.`);
    }
    if (sim.clock.nowMs() - Date.parse(c.issuedAt) > RETENTION_MS) {
      problem(ctx, 'target-not-found', `Cursor ${name} was issued ${c.issuedAt}; this server retains 7 days of change history. Re-sync with mode=full.`);
    }
    return c;
  }

  const visibleTo = (ctx, cls, id, placeFilter, predicate) => {
    const rec = engine.coll(cls.collection).get(id);
    const places = rec ? engine.placesOf(cls.collection, rec) : engine.tombstones(cls.collection).get(id)?._places ?? [];
    if (!engine.covered(ctx.principal, places)) return false;
    if (placeFilter.length && !engine.inFilter(places, placeFilter)) return false;
    return !rec || !predicate || predicate(rec);
  };

  function itemOf(cls, id, first) {
    const rec = engine.coll(cls.collection).get(id);
    const current = plain(rec);
    const base = first.version > 1 ? engine.versionOf(cls.collection, id, first.version - 1) : null;
    const { id: _i, version: _v, ...rest } = current;
    return { id, version: rec.version, className: classNameOf(cls, rec), ...(base ? diff(base, current) : rest) };
  }

  function nextLink(cls, filter, cursorName) {
    const qs = Object.entries(filter).map(([k, v]) => `${encodeURIComponent(k)}=${v.map(encodeURIComponent).join(',')}`);
    return `${cls.route}?${[...qs, 'mode=change', `cursor=${encodeURIComponent(cursorName)}`].join('&')}`;
  }

  /** One ChangeFeedPage for `cls` under the request's filters. */
  function page(ctx, cls, { filter, placeFilter, predicate }) {
    const filterKey = JSON.stringify(filter);
    const name = ctx.query.get('cursor');
    const held = name ? resolve(ctx, cls, name, filterKey) : null;
    const since = held ? undefined : epochParam(ctx, 'modified_since');
    const floor = sim.clock.nowMs() - RETENTION_MS;
    const pageSize = sim.world.dataFeed?.pageSize ?? DEFAULT_PAGE_SIZE;
    const changes = engine
      .coll(cls.collection)
      .changesAfter(held?.position ?? 0)
      .filter((ch) => held || Date.parse(ch.time) >= (since ?? floor));

    const entities = new Map();
    let position = held?.position ?? 0;
    let more = false;
    for (const ch of changes) {
      const visible = visibleTo(ctx, cls, ch.id, placeFilter, predicate);
      if (visible && !entities.has(ch.id) && entities.size >= pageSize) {
        more = true;
        break;
      }
      position = ch.seq;
      if (!visible) continue;
      const e = entities.get(ch.id) ?? { first: ch, last: ch };
      e.last = ch;
      entities.set(ch.id, e);
    }

    const items = [];
    const deleted = [];
    for (const [id, e] of entities) {
      if (e.last.deleted || !engine.coll(cls.collection).has(id)) {
        const g = engine.tombstones(cls.collection).get(id);
        if (g) deleted.push({ id: g.id, className: g.className, deleteTimestamp: g.deleteTimestamp });
      } else items.push(itemOf(cls, id, e.first));
    }

    const grantNow = grantOf(ctx.principal.places) ?? [];
    const additions = held ? grantNow.filter((g) => g !== '*' && !sim.hierarchy.covers(held.grant ?? [], g)) : [];
    const cursor = mint(cls, { collection: cls.collection, credential: credentialOf(ctx.principal), filterKey, position, grant: ctx.principal.places });
    const org = sim.world.organisation;
    return {
      publicationTime: sim.clock.now(),
      ...(org?.id ? { publisher: { id: org.id, className: org.className ?? 'Organisation' } } : {}),
      updateMode: 'change',
      items,
      ...(deleted.length ? { deleted } : {}),
      cursor: cursor.name,
      ...(additions.length ? { grantAdditions: additions } : {}),
      next: more ? nextLink(cls, filter, cursor.name) : null,
    };
  }

  return { reset, register, issueAt, page, credentialOf, cursors: () => [...cursors.values()] };
}
