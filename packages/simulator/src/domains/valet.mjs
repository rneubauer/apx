/**
 * apx-valet (Part 22): custody of a valeted vehicle — the ValetTicket
 * lifecycle of §22.1, condition evidence (§22.2), the retrieval queue and
 * ETAs (§22.3), claimant verification at handback (§22.4), the customer
 * scope with its minimized projection and 404 confinement (§22.5), and the
 * §22.6 refusal of raw personal data. The stay itself is an APDS Session
 * the ticket references (opened at drop-off, ended at handback, settled by
 * the place's own payment flow); money never appears on the ticket.
 *
 * Collections: valetTickets (`_place` = the valet stand, `_claimCode` = the
 * code issued to the guest at drop-off, checked at handback and never
 * served), sessions (`_valetTicket`, `_settled`), assignedRights (the
 * claim-ticket right a Session segment is exercised under).
 *
 * World sections read: valetTickets[], assignedRights[], valet{}
 * ({ baseEtaMinutes, perQueuedMinutes, horizonMinutes, settleAfter,
 * settledBy, stagingLane, rightSpecification, claimCodes{} }).
 */
import { randomUUID } from 'node:crypto';
import { fail } from '../kernel/problems.mjs';
import { parseDuration } from '../kernel/clock.mjs';
import { expandId } from '../kernel/auth.mjs';
import { paginate, entry, refOf, placeOfTarget, requireNode, checkPrecondition, wire } from './common.mjs';
import {
  COLLECTION,
  FROM,
  ACTIVE,
  SETTLED,
  DEFAULT_TUNING,
  orList,
  etaMinutes,
  withEta,
  present,
  isCustomer,
  rawPersonalData,
  verifyClaimant,
  claimCode,
  mirrorId,
  claimRight,
  staySession,
} from './valet/model.mjs';

const STATUS_TOPIC = 'apx.valet.ticket.status.v1';
const REQUESTED_TOPIC = 'apx.valet.retrieval.requested.v1';
const SERVER_WRITTEN = new Set(['id', 'version', 'valetStatus', 'storage', 'retrieval', 'handback', 'statusHistory', 'recordInfo']);
const MINUTE = 60_000;
const VERIFIED_THING = { ticket: 'ticket number', code: 'code', phone: 'phone number', id: 'ID', attendant: 'attendant recognition' };

const isoAt = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const joinDetail = (...parts) => parts.filter(Boolean).join('; ') || undefined;

export default {
  name: 'valet',
  register(sim) {
    const tickets = () => sim.store.collection(COLLECTION);
    const sessions = () => sim.store.collection('sessions');
    const rights = () => sim.store.collection('assignedRights');
    const tuning = () => ({ ...DEFAULT_TUNING, ...(sim.world.valet ?? {}) });
    const parcs = () => sim.world.actors?.parcs ?? 'lakeside-parcs';
    const label = (t) => t.ticketNumber ?? t.id;
    const freeId = (coll, preferred) => (preferred && !coll.has(preferred) ? preferred : randomUUID());

    // ---------- the APDS records a ticket references ----------

    /** Ensure the claim-ticket right and the stay's Session exist; returns their references. */
    const openRecords = (t) => {
      const now = sim.clock.now();
      const operator = sim.hierarchy.operatorOf(t._place) ?? sim.world.organisation?.id ?? 'operator';
      const rightRef = t.assignedRight ?? refOf(freeId(rights(), mirrorId(t.id, 'e2')), 'AssignedRight');
      if (!rights().has(rightRef.id)) {
        rights().put(claimRight({ id: rightRef.id, ticket: t, rightSpecification: tuning().rightSpecification ?? 'valet-claim-ticket', issuer: operator, now }));
      }
      const sessionRef = t.session ?? refOf(freeId(sessions(), mirrorId(t.id, 'f1')), 'Session');
      let created = null;
      if (!sessions().has(sessionRef.id)) {
        created = sessions().put(staySession({ id: sessionRef.id, ticket: t, rightRef, operator, now }));
      }
      return { session: refOf(sessionRef.id, 'Session'), created };
    };

    const publishSession = (s, type) => sim.events.publish({ type, data: wire(s), subject: refOf(s.id, 'Session'), place: s._place });

    /** The vehicle left custody: the Session's stay ends (pricing and payment stay with the place). */
    const endStay = (t, { free = false } = {}) => {
      const s = t.session && sessions().get(t.session.id);
      if (!s || s.actualEnd) return;
      const next = sessions().update(s.id, (x) => ({ ...x, actualEnd: sim.clock.now(), ...(free ? { _settled: 'no charge' } : {}) }));
      publishSession(next, 'SessionUpdated');
    };

    // ---------- lifecycle ----------

    const publishTicket = (t, type = STATUS_TOPIC) =>
      sim.events.publish({ type, data: wire(withEta(t, sim.clock.nowMs())), subject: refOf(t.id, 'ValetTicket'), place: t._place });

    /** Move a ticket to `state`, append the history entry, publish the status event. */
    const transition = (id, state, actor, detail, mutate = (t) => t, { publish = true } = {}) => {
      const now = sim.clock.now();
      const next = tickets().update(
        id,
        (t) => {
          const m = mutate(t);
          return { ...m, valetStatus: state, statusHistory: [...(m.statusHistory ?? []), entry(state, now, actor, detail)] };
        },
        { actor: { user: actor } }
      );
      if (publish) publishTicket(next);
      sim.hooks.emit('valet.transition', { ticket: next, state });
      return next;
    };

    /** Append a history entry that does not change valetStatus (a failed handback, a condition amendment). */
    const annotate = (id, actor, detail, mutate = (t) => t) => {
      const now = sim.clock.now();
      return tickets().update(id, (t) => {
        const m = mutate(t);
        return { ...m, statusHistory: [...(m.statusHistory ?? []), entry(t.valetStatus, now, actor, detail)] };
      }, { actor: { user: actor } });
    };

    const requireState = (t, action, hint = '') => {
      if (!FROM[action].includes(t.valetStatus)) {
        fail('valet-transition-illegal', `${action} requires ${orList(FROM[action])}; ticket ${label(t)} is ${t.valetStatus}.${hint}`);
      }
    };

    /** The operator's promise: a scheduled pickup's time, else now plus the queue-aware estimate. */
    const promisedFor = (t, requestedFor) => {
      if (requestedFor) return requestedFor;
      const ahead = tickets().find((x) => x.id !== t.id && x._place === t._place && (x.valetStatus === 'requested' || x.valetStatus === 'retrieving') && !x.retrieval?.requestedFor).length;
      const { baseEtaMinutes, perQueuedMinutes } = tuning();
      return isoAt(sim.clock.nowMs() + (baseEtaMinutes + ahead * perQueuedMinutes) * MINUTE);
    };

    /** parked → requested, with the ETA and both events (§22.3 rule 1, §22.1 rule 4). */
    const requestRetrieval = (t, { channel, requestedFor, interaction, note, requestedBy, actor }) => {
      const now = sim.clock.now();
      const promisedTime = promisedFor(t, requestedFor);
      const eta = etaMinutes(promisedTime, sim.clock.nowMs());
      const detail = joinDetail(`channel ${channel}`, requestedFor ? `scheduled ${requestedFor}` : `eta ${eta} min`, note);
      const next = transition(
        t.id,
        'requested',
        actor,
        detail,
        (x) => ({
          ...x,
          retrieval: { requestedTime: now, ...(requestedFor ? { requestedFor } : {}), channel, requestedBy, ...(interaction ? { interaction } : {}), etaMinutes: eta, promisedTime },
        }),
        { publish: false }
      );
      publishTicket(next, REQUESTED_TOPIC);
      publishTicket(next);
      if (requestedFor) {
        // the booked pickup reaches the runner board once inside the horizon
        const due = Date.parse(requestedFor) - tuning().horizonMinutes * MINUTE;
        sim.clock.schedule(Math.max(due, sim.clock.nowMs()), () => {
          const cur = tickets().get(t.id);
          if (cur?.valetStatus === 'requested' && cur.retrieval?.requestedFor === requestedFor) sim.hooks.emit('valet.pickup.due', { ticket: cur });
        }, `valet pickup due ${t.id}`);
      }
      return next;
    };

    /** handedBack → closed once the Session settles (§22.1 rule 3). */
    const settle = (ticketId, how) => {
      const t = tickets().get(ticketId);
      if (!t || t.valetStatus !== 'handedBack') return null;
      const s = t.session && sessions().get(t.session.id);
      if (s) sessions().update(s.id, (x) => ({ ...x, _settled: x._settled ?? how }), { bump: false });
      const sessionText = t.session ? `Session ${t.session.id} settled` : 'stay settled';
      return transition(ticketId, 'closed', parcs(), `${sessionText} (${s?._settled ?? how})`);
    };

    const scheduleSettlement = (t, how) => {
      const after = tuning().settleAfter;
      if (!after) return;
      sim.clock.schedule({ delay: parseDuration(after) }, () => settle(t.id, how), `valet settle ${t.id}`);
    };

    // a payments domain announcing a settled Session closes its ticket at once
    sim.hooks.on('session.settled', ({ session, how }) => {
      const t = tickets().first((x) => x.session?.id === (session?.id ?? session));
      if (t) settle(t.id, how ?? 'paid');
    });

    // ---------- access (§22.5, Part 9 §9.3a) ----------

    const actorOf = (ctx) => (isCustomer(ctx.principal) ? 'customer' : ctx.principal?.user ?? ctx.principal?.sub ?? 'operator');

    const operatorOnly = (ctx, scope) => {
      if (isCustomer(ctx.principal)) {
        fail('insufficient-scope', `${ctx.op.method} ${ctx.op.path} requires scope ${scope}; a customer-scope token (apx.valet:request) may only read, retrieve, and cancel the retrieval of its own ticket.`);
      }
    };

    const noGrant = () => fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');

    /** A path-addressed ticket: 404 for a customer token not bound to it; 404 missing; 403 outside the grant. */
    const visible = (ctx, id) => {
      const p = ctx.principal;
      if (isCustomer(p)) {
        if (p.bound?.id !== id || !tickets().has(id)) fail('target-not-found', `No valet ticket ${id} for this token.`);
        return tickets().get(id);
      }
      const t = tickets().get(id);
      if (!t) fail('target-not-found', `No valet ticket ${id}.`);
      if (!p.hasGrant) noGrant();
      if (!ctx.hierarchy.covers(p.places, t._place)) fail('insufficient-grant', `Valet ticket ${id} belongs to place ${t._place}, which is not in the token's apx_places grant.`);
      return t;
    };

    /** A `place` query parameter: 404 when nothing has that id, 403 outside the grant. */
    const placeParam = (ctx, id) => {
      if (!ctx.hierarchy.has(id)) fail('target-not-found', `No HierarchyElement ${id}.`);
      if (!ctx.principal.hasGrant) noGrant();
      if (!ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
      return id;
    };

    const reply = (ctx, t) => present(t, ctx.principal, sim.clock.nowMs());

    // ---------- seeding ----------

    sim.seed((world) => {
      for (const r of world.assignedRights ?? []) if (!rights().has(r.id)) rights().put({ ...r });
      for (const s of world.valetTickets ?? []) {
        const base = {
          version: 1,
          ...s,
          _place: s._place ?? s.place?.id,
          _claimCode: s._claimCode ?? world.valet?.claimCodes?.[s.id] ?? claimCode(sim.store.next('valetClaim', 1)),
        };
        const statusHistory = s.statusHistory?.length ? s.statusHistory : [entry(base.valetStatus, base.dropOff.time, base.dropOff.attendant ?? 'attendant')];
        const { session } = openRecords(base);
        tickets().put({ ...base, statusHistory, session: s.session ?? session });
      }
    });

    sim.view(COLLECTION, (rec, { principal }) => present(rec, principal, sim.clock.nowMs()));

    // ---------- create (drop-off) ----------

    sim.on('post-apx-v1-valet-tickets', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const b = ctx.body;
      const { node } = placeOfTarget(ctx, b.place, 'place');
      const personal = rawPersonalData(b);
      if (personal) {
        fail('personal-data-not-permitted', `${personal.pointer} must be an opaque or masked handle (Part 22 §22.6); ${personal.kind} was supplied. Reference the Contact instead.`);
      }
      if (b.dropOff.lane) requireNode(ctx, b.dropOff.lane, 'dropOff.lane');
      if (b.session && !sessions().has(b.session.id)) fail('reference-unknown', `session ${b.session.id} names no Session at this operator.`);
      if (b.assignedRight && !rights().has(b.assignedRight.id)) fail('reference-unknown', `assignedRight ${b.assignedRight.id} names no AssignedRight at this operator.`);
      const clean = Object.fromEntries(Object.entries(b).filter(([k]) => !SERVER_WRITTEN.has(k)));
      const now = ctx.now();
      const attendant = b.dropOff.attendant ?? actorOf(ctx);
      const ack = b.dropOff.conditionReport?.customerAcknowledged ? 'condition report acknowledged by customer' : undefined;
      const inserted = tickets().insert(
        { ...clean, valetStatus: 'dropped', statusHistory: [entry('dropped', now, attendant, ack)], _place: node.id },
        { assignedId: ctx.assignId, actor: ctx.actor }
      );
      const code = sim.world.valet?.claimCodes?.[inserted.id] ?? claimCode(sim.store.next('valetClaim', 1));
      const { session, created } = openRecords(inserted);
      const t = tickets().update(inserted.id, (x) => ({ ...x, session: x.session ?? session, _claimCode: code }), { bump: false });
      if (created) publishSession(created, 'SessionCreated');
      publishTicket(t);
      sim.hooks.emit('valet.transition', { ticket: t, state: 'dropped' });
      return { status: 201, body: reply(ctx, t), idem: { collection: COLLECTION, id: t.id } };
    });

    // ---------- reads ----------

    sim.on('get-apx-v1-valet-tickets-id', (ctx) => reply(ctx, visible(ctx, ctx.params.id)));

    sim.on('get-apx-v1-valet-tickets', (ctx) => {
      operatorOnly(ctx, 'apx.valet:read');
      const place = ctx.query.has('place') ? placeParam(ctx, ctx.query.get('place')) : null;
      if (!ctx.principal.hasGrant) return paginate(ctx, []);
      const q = (n) => ctx.query.get(n);
      const rows = tickets()
        .find((t) => {
          if (!ctx.hierarchy.covers(ctx.principal.places, t._place)) return false;
          if (place && !ctx.hierarchy.within(t._place, place)) return false;
          if (q('status') && t.valetStatus !== q('status')) return false;
          if (q('plate') && t.vehicle?.credentialIdentification !== q('plate')) return false;
          if (q('ticketNumber') && t.ticketNumber !== q('ticketNumber')) return false;
          if (q('account') && t.customer?.account?.id !== q('account')) return false;
          if (q('since') && Date.parse(t.dropOff.time) < Date.parse(q('since'))) return false;
          return true;
        })
        .sort((a, b) => b.dropOff.time.localeCompare(a.dropOff.time) || a.id.localeCompare(b.id))
        .map((t) => withEta(t, ctx.clock.nowMs()));
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-valet-queue', (ctx) => {
      operatorOnly(ctx, 'apx.valet:read');
      const place = placeParam(ctx, ctx.query.get('place'));
      const horizon = ctx.query.has('horizonMinutes') ? ctx.query.int('horizonMinutes') : tuning().horizonMinutes;
      if (!Number.isInteger(horizon) || horizon < 0) {
        fail('invalid-request', 'horizonMinutes must be a non-negative integer.', { errors: [{ pointer: '?horizonMinutes', detail: 'non-negative integer expected' }] });
      }
      const limit = ctx.clock.nowMs() + horizon * MINUTE;
      const promised = (t) => t.retrieval?.promisedTime ?? t.retrieval?.requestedTime ?? '';
      const rows = tickets()
        .find((t) => {
          if (!ACTIVE.has(t.valetStatus) || !ctx.hierarchy.within(t._place, place)) return false;
          if (!ctx.hierarchy.covers(ctx.principal.places, t._place)) return false;
          return !t.retrieval?.requestedFor || Date.parse(t.retrieval.promisedTime) <= limit;
        })
        .sort((a, b) => promised(a).localeCompare(promised(b)) || (a.retrieval?.requestedTime ?? '').localeCompare(b.retrieval?.requestedTime ?? ''))
        .map((t) => withEta(t, ctx.clock.nowMs()));
      return paginate(ctx, rows);
    });

    // ---------- transitions ----------

    const spaceName = (id) => sim.hierarchy.get(id)?.name ?? id;
    const describeStorage = (s) => joinDetail(s.space ? `Space ${spaceName(s.space.id)}` : null, s.zone && !s.space ? s.zone : null, s.keyLocation ? `keys ${s.keyLocation}` : null);

    sim.on('post-apx-v1-valet-tickets-id-park', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      checkPrecondition(ctx, t);
      requireState(t, 'park');
      const b = ctx.body;
      if (b.space) requireNode(ctx, b.space, 'space');
      const now = ctx.now();
      const actor = actorOf(ctx);
      const given = Object.fromEntries(['space', 'zone', 'keyLocation'].filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
      const prior = t.valetStatus === 'parked' || !Object.keys(given).length ? t.storage ?? {} : {};
      const storage = { ...prior, ...given, parkedTime: now, parkedBy: actor };
      const from = t.valetStatus;
      const detail =
        from === 'dropped'
          ? joinDetail(describeStorage(storage), b.note)
          : from === 'parked'
            ? joinDetail(`storage updated: ${describeStorage(given) ?? 'position confirmed'}`, b.note)
            : joinDetail('re-parked from staging', b.note);
      const next = transition(t.id, 'parked', actor, detail, (x) => {
        if (from !== 'staged') return { ...x, storage };
        const { stagingLane: _l, stagedTime: _s, ...rest } = x.retrieval ?? {};
        return { ...x, storage, retrieval: { ...rest, cancelledTime: now, cancelReason: 're-parked' } };
      });
      return reply(ctx, next);
    });

    sim.on('post-apx-v1-valet-tickets-id-retrieve', (ctx) => {
      const t = visible(ctx, ctx.params.id);
      if (t.valetStatus === 'requested' || t.valetStatus === 'retrieving') return reply(ctx, t); // §22.3 rule 4
      if (t.valetStatus === 'dropped') fail('valet-vehicle-not-located', `Ticket ${label(t)} is still dropped; no parked position has been recorded.`);
      requireState(t, 'retrieve', ' A repeat while requested or retrieving is answered with the current ticket.');
      const actor = actorOf(ctx);
      return reply(ctx, requestRetrieval(t, { ...ctx.body, requestedBy: actor, actor }));
    });

    sim.on('post-apx-v1-valet-tickets-id-cancel-retrieval', (ctx) => {
      const t = visible(ctx, ctx.params.id);
      requireState(t, 'cancel-retrieval', t.valetStatus === 'staged' ? ' A staged vehicle is re-parked with park.' : '');
      const b = ctx.body;
      const actor = actorOf(ctx);
      const now = ctx.now();
      const wasMoving = t.valetStatus === 'retrieving';
      const back = wasMoving && t.storage ? `returned to ${describeStorage(t.storage)}` : undefined;
      const next = transition(t.id, 'parked', wasMoving ? t.retrieval?.retrievingBy ?? actor : actor, joinDetail(`retrieval cancelled: ${b.reason}`, back, b.note), (x) => ({
        ...x,
        retrieval: { ...x.retrieval, cancelledTime: now, cancelReason: b.reason },
        ...(wasMoving ? { storage: { ...x.storage, parkedTime: now, parkedBy: x.retrieval?.retrievingBy ?? actor } } : {}),
      }));
      return reply(ctx, next);
    });

    sim.on('post-apx-v1-valet-tickets-id-pickup', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      requireState(t, 'pickup');
      const runner = ctx.body?.retrievingBy ?? actorOf(ctx);
      const next = transition(t.id, 'retrieving', runner, ctx.body?.note, (x) => ({ ...x, retrieval: { ...x.retrieval, retrievingBy: runner } }));
      return reply(ctx, next);
    }, { allowEmptyBody: true });

    sim.on('post-apx-v1-valet-tickets-id-stage', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      requireState(t, 'stage');
      const lane = requireNode(ctx, ctx.body.stagingLane, 'stagingLane');
      if (lane.kind !== 'lane') fail('reference-unknown', `stagingLane ${lane.id} is a ${lane.className}, not a VehicularAccess.`);
      return reply(ctx, stageTicket(t, lane.id, t.retrieval?.retrievingBy ?? actorOf(ctx), ctx.body.note));
    });

    const stageTicket = (t, laneId, actor, note) => {
      const now = sim.clock.now();
      const channel = t.customer?.contactChannel?.type;
      const notify = channel && channel !== 'none' ? `customer notified via ${channel}` : undefined;
      const next = transition(t.id, 'staged', actor, joinDetail(note, notify), (x) => ({
        ...x,
        retrieval: { ...x.retrieval, stagingLane: refOf(laneId, 'VehicularAccess'), stagedTime: now, etaMinutes: 0 },
      }));
      if (notify) sim.hooks.emit('valet.customer.notify', { ticket: next, channel: t.customer.contactChannel });
      return next;
    };

    sim.on('post-apx-v1-valet-tickets-id-handback', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      requireState(t, 'handback');
      const b = ctx.body;
      const actor = actorOf(ctx);
      const method = b.verificationMethod;
      if (!verifyClaimant(t, b)) {
        annotate(t.id, actor, `handback attempted; verification by ${method} FAILED; vehicle retained`);
        sim.hooks.emit('valet.verification.failed', { ticket: tickets().get(t.id), method, actor });
        fail('valet-verification-failed', `The ${VERIFIED_THING[method] ?? method} presented does not match ticket ${label(t)}. The attempt has been recorded.`);
      }
      const now = ctx.now();
      const fromDropped = t.valetStatus === 'dropped';
      const odometer = Number.isInteger(b.mileage) && Number.isInteger(t.dropOff.mileage) ? `odometer +${b.mileage - t.dropOff.mileage}` : undefined;
      const handback = {
        time: now,
        ...(b.handedTo ? { handedTo: b.handedTo } : {}),
        verificationMethod: method,
        attendant: actor,
        ...(b.mileage !== undefined ? { mileage: b.mileage } : {}),
        ...(b.conditionReport ? { conditionReport: { recordedTime: now, recordedBy: actor, ...b.conditionReport } } : {}),
        ...(b.notes ? { notes: b.notes } : {}),
      };
      const detail = joinDetail(fromDropped ? `handed back before the vehicle moved; verified by ${method}` : `verified by ${method}`, odometer);
      const next = transition(t.id, 'handedBack', actor, detail, (x) => ({ ...x, handback }));
      endStay(next, { free: fromDropped });
      scheduleSettlement(next, fromDropped ? 'no charge' : tuning().settledBy ?? 'paid through the place payment flow');
      return reply(ctx, next);
    });

    sim.on('post-apx-v1-valet-tickets-id-cancel', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      requireState(t, 'cancel', t.valetStatus === 'dropped' ? '' : ' Custody was taken.');
      const b = ctx.body;
      const next = transition(t.id, 'cancelled', actorOf(ctx), joinDetail(`${b.reason}: ${b.note ?? 'drop-off cancelled'}`, 'custody never taken'));
      endStay(next, { free: true });
      return reply(ctx, next);
    });

    sim.on('post-apx-v1-valet-tickets-id-condition', (ctx) => {
      operatorOnly(ctx, 'apx.valet:manage');
      const t = visible(ctx, ctx.params.id);
      if (SETTLED.has(t.valetStatus)) {
        fail('valet-transition-illegal', `condition requires a ticket that is not closed or cancelled; ticket ${label(t)} is ${t.valetStatus}. Post-closure damage claims are handled outside the custody record.`);
      }
      const b = ctx.body;
      const now = ctx.now();
      const actor = b.recordedBy ?? actorOf(ctx);
      const added = (b.damage ?? []).map((d) => ({ ...d, recordedTime: now, recordedBy: actor }));
      const summary = b.notes ?? `${added.length} damage entr${added.length === 1 ? 'y' : 'ies'}, ${(b.imageLinks ?? []).length} image(s) added`;
      const next = annotate(t.id, actor, `condition amended: ${summary}`, (x) => {
        const cr = x.dropOff.conditionReport ?? {};
        const damage = [...(cr.damage ?? []), ...added];
        const imageLinks = [...(cr.imageLinks ?? []), ...(b.imageLinks ?? [])];
        return { ...x, dropOff: { ...x.dropOff, conditionReport: { ...cr, ...(damage.length ? { damage } : {}), ...(imageLinks.length ? { imageLinks } : {}) } } };
      });
      return { status: 200, body: reply(ctx, next), idem: { collection: COLLECTION, id: t.id } };
    });

    // ---------- injectors: the world acting without an API call ----------

    const ticketFor = (id) => {
      const t = tickets().get(expandId(String(id)));
      if (!t) throw new Error(`no valet ticket ${id}`);
      return t;
    };

    /** The car moved: `position` is { zone?, space?, keyLocation? } (parked) or { stagingLane } / "staged" (at the kerb). */
    sim.injector('valetVehicleMoved', ({ ticket, position, actor = 'runner' }) => {
      const t = ticketFor(ticket);
      const pos = typeof position === 'string' ? (position === 'staged' ? { stagingLane: tuning().stagingLane } : { zone: position }) : position ?? {};
      if (pos.stagingLane) {
        if (!['parked', 'requested', 'retrieving', 'staged'].includes(t.valetStatus)) throw new Error(`ticket ${label(t)} is ${t.valetStatus}; it cannot be at the kerb`);
        let cur = t;
        if (cur.valetStatus === 'parked') cur = requestRetrieval(cur, { channel: 'attendant', requestedBy: actor, actor });
        return wire(stageTicket(cur, expandId(String(pos.stagingLane)), actor, 'moved to the staging lane'));
      }
      if (SETTLED.has(t.valetStatus) || t.valetStatus === 'handedBack') throw new Error(`ticket ${label(t)} is ${t.valetStatus}; the car is not in custody`);
      const given = Object.fromEntries(['zone', 'keyLocation'].filter((k) => pos[k] !== undefined).map((k) => [k, pos[k]]));
      if (pos.space) given.space = refOf(expandId(String(pos.space.id ?? pos.space)), 'Space');
      const now = sim.clock.now();
      const next = transition(t.id, 'parked', actor, joinDetail(describeStorage(given), 'recorded by the runner board'), (x) => ({
        ...x,
        storage: { ...(x.storage ?? {}), ...given, parkedTime: now, parkedBy: actor },
        ...(ACTIVE.has(x.valetStatus) ? { retrieval: { ...x.retrieval, cancelledTime: now, cancelReason: 're-parked' } } : {}),
      }));
      return wire(next);
    });

    /** A runner reached the car: requested → retrieving, inferred from runner assignment (§22.1 rule 2). */
    sim.injector('valetRunnerArrives', ({ ticket, runner = 'runner' }) => {
      const t = ticketFor(ticket);
      if (t.valetStatus !== 'requested') throw new Error(`ticket ${label(t)} is ${t.valetStatus}; a runner picks up only a requested car`);
      return wire(transition(t.id, 'retrieving', runner, undefined, (x) => ({ ...x, retrieval: { ...x.retrieval, retrievingBy: runner } })));
    });

    /** The guest asks for the car (at the stand by default): parked → requested; a repeat is a no-op. */
    sim.injector('valetCustomerArrives', ({ ticket, channel = 'attendant', requestedFor, interaction, actor }) => {
      const t = ticketFor(ticket);
      if (t.valetStatus === 'requested' || t.valetStatus === 'retrieving') return wire(t);
      if (t.valetStatus !== 'parked') throw new Error(`ticket ${label(t)} is ${t.valetStatus}; only a parked car can be asked for`);
      const who = actor ?? (channel === 'attendant' ? 'attendant' : 'customer');
      return wire(requestRetrieval(t, { channel, requestedFor, interaction, requestedBy: who, actor: who }));
    });

    sim.valet = { tickets, settle, transition };
  },
};
