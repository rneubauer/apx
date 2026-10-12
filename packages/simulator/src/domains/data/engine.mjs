/**
 * apx-data write engine: create / replace / change-merge / delete for the
 * native classes, with version history (for `?version=` reads and feed
 * diffs), tombstones (for `deletedReferences` and `deleted[]`), the place
 * binding of every record (the grant check and the `place` filter), the
 * APDS EventTypeEnum events, and the `<collection>.changed` hooks.
 */
import { CLASSES, classNameOf, classNameOfType, plain, hints, mergeChange } from './model.mjs';

export function createEngine(sim) {
  let history = new Map(); // collection → id → version → plain snapshot
  let graves = new Map(); // collection → id → tombstone

  const coll = (name) => sim.store.collection(name);
  const now = () => sim.clock.now();

  function reset() {
    history = new Map();
    graves = new Map();
  }

  // ---------- history and tombstones ----------

  function remember(collection, record) {
    if (!history.has(collection)) history.set(collection, new Map());
    const byId = history.get(collection);
    if (!byId.has(record.id)) byId.set(record.id, new Map());
    byId.get(record.id).set(record.version, plain(record));
  }

  const versionOf = (collection, id, version) => history.get(collection)?.get(id)?.get(version);

  function tombstones(collection) {
    if (!graves.has(collection)) graves.set(collection, new Map());
    return graves.get(collection);
  }

  const exists = (collection, id) => coll(collection).has(id) || tombstones(collection).has(id);

  function bury(cls, previous, time = now()) {
    const t = {
      id: previous.id,
      className: classNameOf(cls, previous),
      deleteTimestamp: time,
      _places: cls.collection === 'places' ? [previous._parent ?? previous.parentId?.id].filter(Boolean) : placesOf(cls.collection, previous),
    };
    tombstones(cls.collection).set(previous.id, t);
    return t;
  }

  // ---------- place binding ----------

  function placesOf(collection, r) {
    if (!r) return [];
    switch (collection) {
      case 'places':
        return [r.id];
      case 'rightSpecs':
        return (r.hierarchyElements ?? []).map((x) => x?.id).filter(Boolean);
      case 'rateTables':
        if (r._places) return r._places;
        if (r._place) return [r._place];
        return coll('rightSpecs')
          .find((s) => (s.rateEligibility ?? []).some((e) => e?.rateTable?.id === r.id))
          .flatMap((s) => placesOf('rightSpecs', s));
      case 'observations':
        return [r._lane ?? r._place].filter(Boolean);
      default:
        return r._place ? [r._place] : [];
    }
  }

  /** Whether a principal's grant covers a record bound to `places` (an unbound record is visible to any grant). */
  const covered = (principal, places) => places.length === 0 || places.some((p) => sim.hierarchy.covers(principal.places, p));

  /** Subtree-inclusive `place` filter (§5.2 rule 7). */
  const inFilter = (places, filter) => places.some((p) => filter.some((f) => p === f || sim.hierarchy.within(p, f)));

  function derive(collection, record, previous) {
    const h = { ...hints(previous), ...hints(record) };
    switch (collection) {
      case 'places':
        h._place = record.id;
        h._parent = record.parentId?.id;
        break;
      case 'sessions':
        if (record.hierarchyElement?.id) h._place = record.hierarchyElement.id;
        break;
      case 'rightSpecs':
        h._place = record.hierarchyElements?.[0]?.id;
        break;
      case 'assignedRights': {
        const spec = coll('rightSpecs').get(record.rightSpecification?.id);
        const p = spec ? placesOf('rightSpecs', spec)[0] : undefined;
        if (p) h._place = p;
        break;
      }
      case 'observations': {
        const node = sim.hierarchy.get(record.elementIds?.id);
        if (node) {
          if (node.kind === 'lane') h._lane = node.id;
          h._place = sim.hierarchy.placeOf(node.id)?.id ?? node.id;
        }
        break;
      }
      default:
        break;
    }
    return h;
  }

  /** The places a body would bind its record to (a new element binds to its parent). */
  function boundPlaces(collection, body) {
    if (collection === 'places') return [body.parentId?.id].filter(Boolean);
    return placesOf(collection, { ...body, ...derive(collection, body, null) });
  }

  // ---------- server-assigned members ----------

  const orgRef = (principal) => {
    const org = principal?.org ?? sim.world.organisation;
    return { id: org?.id, version: 1, className: org?.className ?? 'Organisation' };
  };

  function assign(cls, body, previous, principal) {
    const out = { ...body };
    for (const m of cls.assigned) delete out[m];
    if (cls.issuerMember) out[cls.issuerMember] = previous?.[cls.issuerMember] ?? orgRef(principal);
    if (cls.collection === 'places') {
      out.hierarchyElementRecord = previous?.hierarchyElementRecord ?? body.hierarchyElementRecord ?? { creationTime: now(), creator: orgRef(principal) };
    }
    return out;
  }

  // ---------- the wire view ----------

  function childIds(id) {
    return coll('places')
      .find((p) => p.parentId?.id === id)
      .map((p) => ({ id: p.id, version: p.version, className: classNameOfType(p.type) }));
  }

  function wireOf(cls, record) {
    const out = plain(record);
    if (cls.collection === 'places') {
      const kids = childIds(record.id);
      if (kids.length) out.childIds = kids;
    }
    return out;
  }

  // ---------- the hierarchy stays in step with Place writes ----------

  function syncHierarchy(record) {
    const parent = record.parentId?.id;
    const before = sim.hierarchy.get(record.id) ?? {};
    const name = Array.isArray(record.name) ? record.name[0]?.string : record.name;
    sim.hierarchy.add({
      className: classNameOfType(record.type),
      type: record.type,
      ...before,
      id: record.id,
      kind: 'place',
      name: name ?? before.name,
      parentId: parent ?? before.parentId ?? null,
      version: record.version,
    });
  }

  // ---------- events and hooks ----------

  function announce(cls, verb, record, previous) {
    const subject = { id: record.id, className: classNameOf(cls, record) };
    const places = verb === 'Deleted' ? tombstones(cls.collection).get(record.id)?._places ?? [] : placesOf(cls.collection, record);
    const place = places.find((p) => sim.hierarchy.has(p)) ?? null;
    if (cls.event) {
      sim.events.publish({ type: `${cls.event}${verb}`, data: wireOf(cls, record), subject, place, ...(place ? {} : { org: record[cls.issuerMember]?.id ?? sim.world.organisation?.id }) });
    }
    sim.hooks.emit(`${cls.collection}.changed`, { collection: cls.collection, record, previous: previous ?? null, deleted: verb === 'Deleted' });
  }

  // ---------- writes ----------

  function create(cls, body, { principal, assignedId } = {}) {
    const base = assign(cls, plain(body), null, principal);
    const record = { ...base, ...derive(cls.collection, base, null), version: 1, _modified: now() };
    if (record.id === undefined) delete record.id;
    const stored = coll(cls.collection).insert(record, { assignedId, provenance: false });
    if (cls.collection === 'places') syncHierarchy(stored);
    remember(cls.collection, stored);
    announce(cls, 'Created', stored, null);
    return stored;
  }

  function store(cls, id, next, previous) {
    const stored = coll(cls.collection).update(id, () => ({ ...next, ...derive(cls.collection, next, previous), _modified: now() }));
    if (cls.collection === 'places') syncHierarchy(stored);
    remember(cls.collection, stored);
    announce(cls, 'Updated', stored, previous);
    return stored;
  }

  /** Full mode (§5.1): the body is the complete state; absent members have no value. */
  function replace(cls, id, body, { principal } = {}) {
    const previous = coll(cls.collection).get(id);
    const next = { ...hints(previous), ...assign(cls, plain(body), previous, principal), id };
    return store(cls, id, next, previous);
  }

  /** Change mode (§5.1): absent unchanged, null clears; server-assigned members are never taken from the body. */
  function change(cls, id, changes, { principal } = {}) {
    const previous = coll(cls.collection).get(id);
    const patch = { ...changes };
    for (const m of [...cls.assigned, ...(cls.issuerMember ? [cls.issuerMember] : []), ...(cls.collection === 'places' ? ['hierarchyElementRecord'] : [])]) delete patch[m];
    const merged = mergeChange(plain(previous), patch);
    const next = { ...hints(previous), ...assign(cls, merged, previous, principal), id };
    return store(cls, id, next, previous);
  }

  /** The record a change-mode body would produce, without storing it (for validation). */
  function preview(cls, id, changes) {
    const previous = coll(cls.collection).get(id);
    return { ...mergeChange(plain(previous), changes), id, version: previous.version };
  }

  function remove(cls, id) {
    const previous = coll(cls.collection).get(id);
    if (!previous) return null;
    bury(cls, previous);
    coll(cls.collection).delete(id);
    if (cls.collection === 'places') sim.hierarchy.nodes.delete(id);
    announce(cls, 'Deleted', previous, previous);
    return previous;
  }

  // ---------- seeding ----------

  /** Seed a world row defensively (another module may have seeded it first) and record its version history. */
  function seed(cls, row) {
    const c = coll(cls.collection);
    const { _versions: versions, ...rest } = row;
    const derived = { ...rest, ...derive(cls.collection, rest, c.get(rest.id)), _modified: rest._modified ?? sim.world.clock?.start };
    c.put(c.has(rest.id) ? { ...c.get(rest.id), ...hints(derived) } : derived);
    for (const v of versions ?? []) remember(cls.collection, { id: rest.id, ...v });
    remember(cls.collection, c.get(rest.id));
    if (cls.collection === 'places') syncHierarchy(c.get(rest.id));
  }

  /** Log a historical change into a collection's change log (world `dataFeed.history`). */
  function logHistory(cls, entry) {
    const c = coll(cls.collection);
    const time = entry.time ?? sim.world.clock?.start;
    if (entry.deleted) {
      const t = { id: entry.id, className: entry.className ?? cls.className ?? 'HierarchyElement', deleteTimestamp: time, _places: entry.places ?? [] };
      tombstones(cls.collection).set(entry.id, t);
      c.logChange(entry.id, entry.version ?? 1, time, true);
      return;
    }
    const rec = c.get(entry.id);
    c.logChange(entry.id, entry.version ?? rec?.version ?? 1, time, false);
  }

  return {
    reset,
    remember,
    versionOf,
    tombstones,
    exists,
    placesOf,
    boundPlaces,
    covered,
    inFilter,
    wireOf,
    create,
    replace,
    change,
    preview,
    remove,
    seed,
    logHistory,
    announce,
    coll,
    classes: CLASSES,
  };
}
