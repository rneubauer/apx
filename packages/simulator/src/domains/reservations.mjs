/**
 * apx-reservations and apx-permits (Part 14): thin profiles over the APDS
 * native machinery the data module serves (`/quotes`, `/rights/assigned`,
 * `/rights/specs`, `/sessions`). This module makes the Part 14 semantics
 * happen on top of it:
 *
 *  - the §14.1 reservation lifecycle on the `apds-ext:apx:reservation@1.0`
 *    decoration of an AssignedRight: the transition table on native PUT and
 *    DELETE, the server's rewrite of every write (planned times,
 *    `noShowAfter`, cancel/expiry stamps), check-in when a Session segment
 *    references the right, and the no-show timer publishing
 *    `apx.reservation.noshow.v1`;
 *  - `GET /v1/reservations/recent` (§14.1a), the §14.1b link and unlink;
 *  - permits (§14.2): pool availability, issue, pool accounting.
 *
 * The data module's hooks cannot refuse a write (they run after the store
 * and their exceptions are swallowed), so the three native AssignedRight
 * writes are decorated here: the module looks up the data module's handler
 * and puts its own §14.1 check in front of it, answering in the native
 * dialect (`ResponseStatus` 409, or problem `reservation-transition-illegal`
 * under `Accept: application/problem+json`).
 *
 * World sections read: reservations { graceMinutes, graceBySpec{}, driveUpSpec,
 * driveUpRight, plateJurisdictions{} }, permits { defaultTermMonths, spaces{} }, rightHolders[];
 * assignedRights[] rows may carry `_holder`, `_plateCountry`,
 * `_plateStateProvince`, `_pool`.
 * Hooks used: assignedRights.changed, sessions.changed, lane.vehicleArrives.
 * Session hints set: `_reservation`, `_reservationPlate` (control's match
 * candidates), `_linked`. Right hints: `_preCheckIn`, `_pool`, `_released`.
 */
import { fail } from '../kernel/problems.mjs';
import { parseInstant } from './common.mjs';
import { route, refuse, mergeChange, plain } from './data/model.mjs';
import { EXT, PRE_CHECKIN, extOf, stateOf, illegalTransition, illegalDelete, normalize, summaryOf, platesOf, holderOf, refOf } from './reservations/model.mjs';
import { createLinks } from './reservations/links.mjs';
import { createPermits } from './reservations/permits.mjs';

const MAX_RECENT = 10;

export default {
  name: 'reservations',
  register(sim) {
    const rights = () => sim.store.collection('assignedRights');
    const sessions = () => sim.store.collection('sessions');
    const records = () => sim.credentials?.records?.() ?? null;
    const permits = createPermits(sim);
    let timers = new Map();

    const graceMs = (r) => {
      const cfg = sim.world.reservations ?? {};
      const minutes = cfg.graceBySpec?.[r?.rightSpecification?.id] ?? cfg.graceMinutes ?? 60;
      return minutes * 60_000;
    };
    const normalized = (record, prev, opts = {}) => normalize(record, prev, { graceMs: graceMs(record), now: sim.clock.now(), ...opts });

    /** A server-side transition of a stored reservation: the §14.1 rewrite applied before the native change, so the event carries it. */
    function rewrite(id, extPatch, hints = {}) {
      const r = rights().get(id);
      const ext = { ...extOf(r), ...extPatch };
      for (const [k, v] of Object.entries(extPatch)) if (v === undefined) delete ext[k];
      const next = normalized({ ...r, extensions: { ...r.extensions, [EXT]: ext } }, r);
      return sim.data.change('assignedRights', id, { ...(next.plannedUses ? { plannedUses: next.plannedUses } : {}), extensions: next.extensions, ...hints });
    }
    const links = createLinks(sim, { rewrite });

    // ---------- the no-show timer (§14.1 rule 6) ----------

    function lapse(id, due) {
      const r = rights().get(id);
      const ext = extOf(r);
      if (!ext || !PRE_CHECKIN.has(ext.reservationState) || ext.noShowAfter !== due) return null;
      const next = rewrite(id, { reservationState: 'noShow' });
      sim.events.publish({ type: 'apx.reservation.noshow.v1', data: summaryOf(next), subject: refOf(id, 'AssignedRight'), place: next._place ?? null });
      return next;
    }

    function arm(r) {
      if (timers.has(r.id)) sim.clock.cancel(timers.get(r.id));
      timers.delete(r.id);
      const ext = extOf(r);
      if (!ext || !PRE_CHECKIN.has(ext.reservationState) || !ext.noShowAfter) return;
      const due = ext.noShowAfter;
      timers.set(r.id, sim.clock.schedule(due, () => lapse(r.id, due), `reservation ${r.id} no-show`));
    }

    /** Bring a stored reservation in line with §14.1 when a write did not pass through the native route (seed, injector, another module). */
    function settle(id, prev, opts) {
      const r = rights().get(id);
      if (!r || !extOf(r)) return r;
      const want = normalized(r, prev, opts);
      if (JSON.stringify(plain(want)) !== JSON.stringify(plain(r))) rights().update(id, () => want, { bump: false });
      return rights().get(id);
    }

    // ---------- seeding ----------

    sim.seed(() => {
      timers = new Map();
      for (const r of rights().all()) {
        if (!extOf(r)) continue;
        arm(settle(r.id, r, { seeding: true }));
      }
      permits.seed();
    });

    sim.view('assignedRights', (r) => sim.data.wireOf('assignedRights', r));

    // ---------- hooks: what the native writes set in motion ----------

    sim.hooks.on('assignedRights.changed', (change) => {
      const { record, previous, deleted } = change;
      if (deleted) {
        if (timers.has(record.id)) sim.clock.cancel(timers.get(record.id));
        timers.delete(record.id);
      } else if (extOf(record) || extOf(previous)) {
        arm(settle(record.id, previous));
      }
      permits.onRightChanged(change);
    });

    /** §14.1 rule 5: a Session whose segment references a reservation checks it in. */
    sim.hooks.on('sessions.changed', ({ record, deleted }) => {
      if (deleted) return;
      for (const seg of record.segments ?? []) {
        const r = rights().get(seg?.assignedRight?.id);
        const state = stateOf(r);
        if (!state || !PRE_CHECKIN.has(state)) continue;
        rewrite(r.id, { reservationState: 'checkedIn', checkInSession: refOf(record.id, 'Session') }, { _preCheckIn: state });
      }
    });

    /** A plate read at a lane: the checked-in reservation carrying it marks its session for control's match candidates. */
    sim.hooks.on('lane.vehicleArrives', ({ lane, plate }) => {
      if (!plate) return;
      const recs = records();
      for (const r of rights().find((x) => stateOf(x) === 'checkedIn' && platesOf(x, recs).includes(plate))) {
        const sid = extOf(r).checkInSession?.id;
        const s = sid ? sessions().get(sid) : null;
        if (!s || s.actualEnd) continue;
        if (lane?._place && s._place && !sim.hierarchy.within(s._place, lane._place) && !sim.hierarchy.within(lane._place, s._place)) continue;
        sessions().update(s.id, (x) => ({ ...x, _reservationPlate: plate, _reservation: r.id }), { bump: false });
      }
    });

    // ---------- the native AssignedRight writes, with the §14.1 table in front ----------

    const nativeRight = (ctx) => {
      const r = rights().get(ctx.params.id);
      if (!r || !ctx.principal?.hasGrant) return null;
      if (r._place && !sim.hierarchy.covers(ctx.principal.places, r._place)) return null;
      return r;
    };

    const decorate = (operationId, before) => {
      const inner = sim.handlers.get(operationId);
      if (!inner) throw new Error(`reservations: the data module must register ${operationId} first`);
      const wrapped = route(async (ctx) => inner(before(ctx) ?? ctx));
      Object.assign(wrapped, { allowEmptyBody: inner.allowEmptyBody, skipBodyValidation: inner.skipBodyValidation });
      sim.handlers.set(operationId, wrapped);
    };

    // POST /rights/assigned: the server's rewrite (noShowAfter, mirrored times) before the store.
    decorate('create-assigned_right', (ctx) => (ctx.body && extOf(ctx.body) ? { ...ctx, body: normalized(ctx.body, null) } : null));

    // PUT /rights/assigned/{id}: refuse an illegal transition; otherwise store the rewritten record.
    decorate('update-assigned_right', (ctx) => {
      const prev = nativeRight(ctx);
      const body = ctx.body;
      if (!prev || !body || typeof body !== 'object') return null;
      const expected = ctx.ifMatch ?? (typeof body.version === 'number' ? body.version : undefined);
      if (expected !== undefined && expected !== prev.version) return null; // the data module answers version-conflict
      const change = String(ctx.headers['apx-update-mode'] ?? 'full').toLowerCase() === 'change';
      const effective = change ? { ...mergeChange(plain(prev), body), id: prev.id } : { ...body };
      if (!extOf(effective) && !extOf(prev)) return null;
      const next = normalized(extOf(effective) ? effective : { ...effective, extensions: { ...(effective.extensions ?? {}), [EXT]: extOf(prev) } }, prev);
      const why = illegalTransition(prev, next);
      if (why) refuse(ctx, 409, 'reservation-transition-illegal', why, [prev.id]);
      const out = change ? { ...body, ...(next.plannedUses ? { plannedUses: next.plannedUses } : {}), extensions: next.extensions } : next;
      return { ...ctx, body: out };
    });

    // DELETE /rights/assigned/{id}: cancellation is legal only before check-in.
    decorate('delete-assigned_right', (ctx) => {
      const prev = nativeRight(ctx);
      const why = prev ? illegalDelete(prev) : null;
      if (why) refuse(ctx, 409, 'reservation-transition-illegal', why, [prev.id]);
      return null;
    });

    // ---------- GET /v1/reservations/recent (§14.1a) ----------

    const aliasOf = (placeId) => sim.store.collection('places').get(placeId)?.operatorDefinedReference?.id;
    const atPlace = (rPlace, placeId) => {
      if (!rPlace) return false;
      if (sim.hierarchy.within(rPlace, placeId)) return true;
      const alias = aliasOf(placeId); // an aggregator's re-minted id for the same location (Part 18 §18.2)
      return Boolean(alias && sim.hierarchy.within(rPlace, alias));
    };
    /** A plate qualified by jurisdiction matches a right whose plate carries the same one, or none on file (§14.1a(4)). */
    const jurisdictionOk = (r, country, stateProvince) => {
      const j = sim.world.reservations?.plateJurisdictions?.[r.id] ?? { country: r._plateCountry, stateProvince: r._plateStateProvince };
      return (!country || !j.country || j.country === country) && (!stateProvince || !j.stateProvince || j.stateProvince === stateProvince);
    };

    sim.on('get-apx-v1-reservations-recent', (ctx) => {
      const q = ctx.query;
      const plate = q.get('plate');
      const holder = q.get('holder');
      if (!plate && !holder) fail('invalid-request', 'GET /v1/reservations/recent needs plate or holder.', { errors: [{ pointer: '?plate', detail: 'plate or holder required' }] });
      const from = parseInstant(q.get('from'), 'from');
      const to = parseInstant(q.get('to'), 'to');
      if (from !== undefined && to !== undefined && from > to) {
        fail('invalid-request', `from ${q.get('from')} is after to ${q.get('to')}.`, { errors: [{ pointer: '?from', detail: 'after to' }] });
      }
      const place = q.get('place');
      if (place) {
        if (!sim.hierarchy.has(place) && !sim.store.collection('places').has(place)) fail('target-not-found', `No place ${place}.`);
        if (!ctx.principal.hasGrant || !sim.hierarchy.covers(ctx.principal.places, place)) fail('insufficient-grant', `Place ${place} is not in the token's apx_places grant.`);
      }
      if (!ctx.principal.hasGrant) return { data: [] }; // §9.3a: a lookup naming no place under no grant matches nothing
      const state = q.get('state');
      const recs = records();
      const startOf = (r) => extOf(r).plannedStart ?? r.plannedUses?.[0]?.startTime ?? '';
      const rows = rights()
        .find((r) => {
          if (!extOf(r)) return false;
          if (r._place && !sim.hierarchy.covers(ctx.principal.places, r._place)) return false;
          if (place && !atPlace(r._place, place)) return false;
          if (plate && !(platesOf(r, recs).includes(plate) && jurisdictionOk(r, q.get('country'), q.get('stateProvince')))) return false;
          if (holder && holderOf(r) !== holder) return false;
          if (state && stateOf(r) !== state) return false;
          const t = Date.parse(startOf(r));
          if (from !== undefined && !(t >= from)) return false;
          if (to !== undefined && !(t < to)) return false;
          return true;
        })
        .sort((a, b) => (startOf(b) > startOf(a) ? 1 : startOf(b) < startOf(a) ? -1 : 0))
        .slice(0, MAX_RECENT);
      return { data: rows.map(summaryOf) };
    });

    // ---------- the §14.1b link, and permits ----------

    sim.on('put-apx-v1-sessions-id-assigned-right', (ctx) => links.link(ctx));
    sim.on('post-apx-v1-sessions-id-assigned-right-unlink', (ctx) => links.unlink(ctx));
    sim.on('get-apx-v1-permits-pools-rightspecid-availability', (ctx) => permits.getAvailability(ctx));
    sim.on('post-apx-v1-permits-issue', (ctx) => permits.issue(ctx));

    // ---------- injectors: the world acting on its own ----------

    /** A reservation is checked in at the lane: an existing session, or a new native Session for the plate read. */
    sim.injector('reservationCheckIn', ({ reservation, session, plate, time, credential = 'lakeside-parcs' }) => {
      const r = rights().get(reservation);
      if (!extOf(r)) throw new Error(`no reservation ${reservation}`);
      const at = time ?? sim.clock.now();
      const ref = { id: r.id, version: r.version, className: 'AssignedRight' };
      const principal = { org: sim.world.credentials?.[credential]?.apx_org ?? sim.world.organisation };
      if (session) {
        const s = sessions().get(session);
        if (!s) throw new Error(`no session ${session}`);
        const why = links.whyNotLinkable(r, s);
        if (why) throw new Error(why);
        const seg = (s.segments ?? []).at(-1);
        const segments = seg ? [{ id: seg.id, assignedRight: ref }] : [{ id: crypto.randomUUID(), version: 1, actualStart: s.actualStart ?? at, assignedRight: ref, validationType: ['licensePlate'] }];
        sim.data.change('sessions', session, { segments }, principal);
      } else {
        const p = plate ?? platesOf(r, records())[0];
        if (!p) throw new Error(`reservation ${reservation} carries no plate; give session`);
        sim.data.create(
          'sessions',
          {
            actualStart: at,
            hierarchyElement: { id: r._place, version: 1, className: 'Place' },
            identifiedCredentials: [{ type: 'licensePlate', credentialAssignedType: 'vehicle', identifier: { id: p, className: 'LicensePlate' } }],
            segments: [{ id: crypto.randomUUID(), version: 1, actualStart: at, assignedRight: ref, validationType: ['licensePlate'] }],
          },
          principal
        );
      }
      return sim.data.wireOf('assignedRights', rights().get(reservation));
    });

    /** The no-show sweep reaches a reservation now (§14.1 rule 6), whatever the clock says of its grace period. */
    sim.injector('reservationNoShow', ({ reservation }) => {
      const r = rights().get(reservation);
      const ext = extOf(r);
      if (!ext) throw new Error(`no reservation ${reservation}`);
      if (!PRE_CHECKIN.has(ext.reservationState)) throw new Error(`reservation ${reservation} is ${ext.reservationState}; only confirmed or amended reservations lapse`);
      return sim.data.wireOf('assignedRights', lapse(reservation, ext.noShowAfter));
    });

    sim.injector('permitExpire', (args) => permits.expire(args));

    sim.reservations = { summaryOf, linkedRight: (s) => links.linkedRef(s), selectPool: permits.selectPool, poolAvailability: permits.availability };
  },
};
