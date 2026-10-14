/**
 * apx-plate-lists (Part 24): lists of plates someone other than the
 * keeper maintains — allow, watch, scofflaw, enforcementVehicle — with
 * per-place flags (§24.1), entries with the idempotent upsert (§24.2),
 * the Part 5 §5.2 rule 8 change feed on both list routes and
 * `apx.platelists.changed.v1` (§24.3), and the §24.4 arrival alert when
 * an LPR read matches a list with `alertOnArrival` (screening.mjs).
 *
 * Collections: plateLists (hints `_owner` org id, `_places` place ids),
 * plateListEntries (hints `_list`, `_key` the normalised plate).
 * Visibility (§24.1 rule 3, Part 9 §9.3a): a list is visible to a token
 * whose grant covers any of its places, and to tokens of its owner; a
 * path id not visible is 403 `insufficient-grant` when the list has
 * places, else 404. Every route needs `apx.platelists:read` or `:manage`,
 * so plate values never reach a token without one (§24.2 rule 5).
 *
 * World sections read: plateLists[] (with `entries[]`), plateListFeed{ pageSize }.
 */
import { expandId } from '../kernel/auth.mjs';
import { checkPrecondition, notFound, paginate, parseInstant, placeOfTarget, refOf, wire } from './common.mjs';
import { createApxFeed } from './platelists/feed.mjs';
import { inForce, plateKey, registerScreening } from './platelists/screening.mjs';
import { fail } from '../kernel/problems.mjs';

const TOPIC = 'apx.platelists.changed.v1';
const LISTS = 'plateLists';
const ENTRIES = 'plateListEntries';
const POLICY_MEMBERS = ['name', 'category', 'places', 'status', 'description', 'extensions'];
const ENTRY_MEMBERS = ['credential', 'validity', 'details', 'vehicle', 'extensions'];
const ID = (v) => (typeof v === 'string' ? expandId(v) : v);

export default {
  name: 'platelists',
  register(sim) {
    const lists = () => sim.store.collection(LISTS);
    const entries = () => sim.store.collection(ENTRIES);
    const listFeed = createApxFeed(sim, { collection: LISTS, prefix: 'pl', className: 'PlateList' });
    const entryFeed = createApxFeed(sim, { collection: ENTRIES, prefix: 'pe', className: 'PlateListEntry' });

    // ---------- representation and visibility ----------

    const entryCount = (listId) => entries().find((e) => e._list === listId).length;
    const wireList = (rec) => ({ ...wire(rec), entryCount: entryCount(rec.id) });
    const placesOf = (places) => (places ?? []).map((p) => p?.place?.id).filter(Boolean);

    const visibleTo = (principal, list) =>
      (principal.org?.id && list._owner === principal.org.id) || (principal.hasGrant && list._places.some((p) => sim.hierarchy.covers(principal.places, p)));

    function getList(ctx, id) {
      const list = lists().get(id);
      if (!list) notFound('plate list', id);
      if (visibleTo(ctx.principal, list)) return list;
      if (list._places.length) fail('insufficient-grant', `Plate list ${id} applies at ${list._places.join(', ')}, outside the token's apx_places grant, and the token's organisation does not own it.`);
      return notFound('plate list', id);
    }

    function getEntry(ctx, listId, entryId) {
      const list = getList(ctx, listId);
      const e = entries().get(entryId);
      if (!e || e._list !== list.id) notFound(`entry of plate list ${listId}`, entryId);
      return { list, entry: e };
    }

    // ---------- writes ----------

    /** §24.1 rule 3: every place written lies inside the writer's grant (422 unknown, 403 outside). */
    function checkPlaces(ctx, places = []) {
      places.forEach((p, i) => placeOfTarget(ctx, p.place, `places/${i}/place`));
    }

    function publish(list) {
      const places = list._places;
      sim.events.publish({ type: TOPIC, data: wireList(list), subject: refOf(list.id, 'PlateList'), place: places[0] ?? null, ...(places.length ? {} : { org: list._owner ?? null }) });
    }

    const pick = (body, members) => Object.fromEntries(members.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

    function checkValidity(validity) {
      const start = parseInstant(validity?.start, 'validity/start');
      const end = parseInstant(validity?.end, 'validity/end');
      if (start !== undefined && end !== undefined && end <= start) {
        fail('invalid-request', 'validity.end must be after validity.start.', { errors: [{ pointer: '/validity/end', detail: 'must be after validity.start' }] });
      }
    }

    const span = (e) => [e.validity?.start ? Date.parse(e.validity.start) : -Infinity, e.validity?.end ? Date.parse(e.validity.end) : Infinity];
    const overlaps = (a, b) => {
      const [as, ae] = span(a);
      const [bs, be] = span(b);
      return as < be && bs < ae;
    };
    /** Same credential: type and normalised value equal, jurisdiction equal where both state one. */
    const sameCredential = (a, b) =>
      a.credentialType === b.credentialType &&
      plateKey(a.credentialIdentification) === plateKey(b.credentialIdentification) &&
      (!a.jurisdiction || !b.jurisdiction || a.jurisdiction.toUpperCase() === b.jurisdiction.toUpperCase());

    // ---------- seeding ----------

    sim.seed((world) => {
      listFeed.reset();
      entryFeed.reset();
      for (const row of world.plateLists ?? []) {
        const { entries: rows = [], ...list } = row;
        lists().put({ version: 1, status: 'active', ...list, _owner: list.owner?.id ?? null, _places: placesOf(list.places) });
        for (const e of rows) entries().put({ version: 1, ...e, list: refOf(list.id, 'PlateList'), _list: list.id, _key: plateKey(e.credential?.credentialIdentification) });
      }
    });

    sim.view(LISTS, wireList);
    sim.view(ENTRIES, (r) => wire(r));

    // ---------- lists ----------

    sim.on('get-apx-v1-plate-lists', (ctx) => {
      const place = ctx.query.get('place');
      const category = ctx.query.get('category');
      const status = ctx.query.get('status');
      const applies = (l) => !place || l._places.some((p) => p === place || sim.hierarchy.within(p, place) || sim.hierarchy.within(place, p));
      const matches = (l) => visibleTo(ctx.principal, l) && applies(l) && (!category || l.category === category) && (!status || l.status === status);
      if (ctx.query.get('mode') === 'change') {
        return listFeed.page(ctx, {
          scope: 'lists',
          filter: { place, category, status },
          belongs: matches,
          visible: (l) => visibleTo(ctx.principal, l),
          toWire: wireList,
          route: '/v1/plate-lists',
        });
      }
      return paginate(ctx, lists().find(matches).map(wireList));
    });

    sim.on('post-apx-v1-plate-lists', (ctx) => {
      const b = ctx.body;
      checkPlaces(ctx, b.places);
      const rec = lists().insert(
        {
          ...pick(b, POLICY_MEMBERS),
          ...(ctx.principal.orgRef ? { owner: ctx.principal.orgRef } : {}),
          _owner: ctx.principal.org?.id ?? null,
          _places: placesOf(b.places),
        },
        { assignedId: ctx.assignId, actor: ctx.actor }
      );
      listFeed.track(rec);
      publish(rec);
      return { status: 201, body: wireList(rec), idem: { collection: LISTS, id: rec.id } };
    });

    sim.on('get-apx-v1-plate-lists-id', (ctx) => wireList(getList(ctx, ctx.params.id)));

    sim.on('put-apx-v1-plate-lists-id', (ctx) => {
      const current = getList(ctx, ctx.params.id);
      checkPrecondition(ctx, current);
      checkPlaces(ctx, ctx.body.places);
      const next = lists().update(
        current.id,
        (r) => ({ id: r.id, version: r.version, ...(r.owner ? { owner: r.owner } : {}), recordInfo: r.recordInfo, ...pick(ctx.body, POLICY_MEMBERS), _owner: r._owner, _places: placesOf(ctx.body.places) }),
        { actor: ctx.actor }
      );
      listFeed.track(next, current);
      publish(next);
      return wireList(next);
    });

    // ---------- entries ----------

    sim.on('get-apx-v1-plate-lists-id-entries', (ctx) => {
      const list = getList(ctx, ctx.params.id);
      const credential = ctx.query.get('credential');
      const activeAtRaw = ctx.query.get('activeAt');
      const activeAt = parseInstant(activeAtRaw, 'activeAt');
      const matches = (e) => e._list === list.id && (!credential || e.credential?.credentialIdentification === credential) && (activeAt === undefined || inForce(e, activeAt));
      if (ctx.query.get('mode') === 'change') {
        return entryFeed.page(ctx, {
          scope: list.id,
          filter: { credential, activeAt: activeAtRaw },
          belongs: matches,
          visible: () => true,
          toWire: (e) => wire(e),
          route: `/v1/plate-lists/${list.id}/entries`,
        });
      }
      return paginate(ctx, entries().find(matches));
    });

    sim.on('post-apx-v1-plate-lists-id-entries', (ctx) => {
      const list = getList(ctx, ctx.params.id);
      const b = ctx.body;
      checkValidity(b.validity);
      const existing = entries().first((e) => e._list === list.id && sameCredential(e.credential, b.credential) && overlaps(e, b));
      let rec;
      if (existing) {
        // §24.2 rule 2: the same credential with an overlapping validity is updated in place.
        // The credential keeps a jurisdiction the reload leaves out; the other members are the reload's.
        rec = entries().update(
          existing.id,
          (r) => ({ id: r.id, version: r.version, list: r.list, recordInfo: r.recordInfo, ...pick(b, ENTRY_MEMBERS), credential: { ...r.credential, ...b.credential }, _list: r._list, _key: r._key }),
          { actor: ctx.actor }
        );
      } else {
        rec = entries().insert({ list: refOf(list.id, 'PlateList'), ...pick(b, ENTRY_MEMBERS), _list: list.id, _key: plateKey(b.credential.credentialIdentification) }, { assignedId: ctx.assignId, actor: ctx.actor });
      }
      entryFeed.track(rec, existing);
      publish(lists().get(list.id));
      return { status: existing ? 200 : 201, body: wire(rec), idem: { collection: ENTRIES, id: rec.id } };
    });

    sim.on('get-apx-v1-plate-lists-id-entries-entryid', (ctx) => wire(getEntry(ctx, ctx.params.id, ctx.params.entryId).entry));

    sim.on('delete-apx-v1-plate-lists-id-entries-entryid', (ctx) => {
      const { list, entry } = getEntry(ctx, ctx.params.id, ctx.params.entryId);
      const gone = entries().delete(entry.id);
      entryFeed.bury(gone);
      publish(lists().get(list.id));
      return undefined; // 204
    });

    // ---------- §24.4: arrival alerts from LPR reads ----------

    registerScreening(sim, { lists, entries });

    // ---------- injectors ----------

    /** The list owner's nightly load, done outside the scenario's requests: entries added or removed by plate. */
    sim.injector('plateListLoad', ({ list, add = [], remove = [] }) => {
      const l = lists().get(ID(list));
      if (!l) throw new Error(`no plate list ${list}`);
      for (const plate of remove) {
        const e = entries().first((x) => x._list === l.id && x._key === plateKey(plate));
        if (e) entryFeed.bury(entries().delete(e.id));
      }
      for (const e of add) {
        const rec = entries().insert({ list: refOf(l.id, 'PlateList'), ...pick(e, ENTRY_MEMBERS), _list: l.id, _key: plateKey(e.credential?.credentialIdentification) });
        entryFeed.track(rec);
      }
      publish(l);
      return { list: l.id, entryCount: entryCount(l.id) };
    });
  },
};
