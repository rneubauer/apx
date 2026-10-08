/**
 * apx-charging (Part 23): live charging-point status with the bay-presence
 * fusion, the ChargingSession lifecycle driven by the bridge's events,
 * server-side idle after the grace, cost and the three settlement modes,
 * the customer scope, and the Part 6 charger commands (startCharging,
 * stopCharging, unlockConnector) applied when control dispatches them.
 *
 * World sections read: chargingPoints[] ({ id, name, placeId, spaceId,
 * refillPointIndex, evseId, connectors[], bay?, reservedFor? }), and
 * charging { tariffs{placeId: {energyPerKwh, currency, tariffReference,
 * fees?}}, idlePolicies{placeId: idlePolicy}, bayGraceMinutes,
 * actors{bridge, server} }. Both maps inherit down the hierarchy.
 *
 * Collections: chargingPoints (id = the ElectricChargingEquipment id;
 * `_place`, `_bayReport`, `_unlockedTime`), chargingSessions (`_place`,
 * `_lastEventTime`, `_idleEnd`, `_parkingSettled`). Also writes
 * `_chargingLines` onto the APDS `sessions` row it posts to, and
 * `charging.session` onto a referenced `valetTickets` row.
 *
 * Hooks: emits `charging.bayPresence` { point, previous, presence },
 * `charging.posted` { chargingSession, parkingSession, cost },
 * `charging.session` { session, state }; listens to `command.transition`
 * and `payment.recorded`. Injectors: chargerEvent, bayCamera,
 * chargerFault, parkingSessionSettled.
 */
import { fail, ProblemError } from '../kernel/problems.mjs';
import { paginate, refOf, wire, getVisible, visibleRows, placeOfTarget, isRef, shortId, entry } from './common.mjs';
import { createPoints, pointView, customerPointView, AVAILABILITY } from './charging/points.mjs';
import { checkTransition, nextState, price, idleUnits, idleEndMs, customerSessionView, ACTIVE, TERMINAL } from './charging/lifecycle.mjs';

const CHARGING_COMMANDS = new Set(['startCharging', 'stopCharging', 'unlockConnector']);
const UNAVAILABLE = new Set(['inoperative', 'outOfOrder']);
const MINUTE_MS = 60_000;

const isCustomer = (p) => p.has('apx.charging:status') && !p.has('apx.charging:read') && !p.has('apx.charging:manage');
const dollars = (m) => `$${m.currencyValue.toFixed(2)}`;

export default {
  name: 'charging',
  register(sim) {
    const pts = createPoints(sim);
    const points = pts.points;
    const sessions = () => sim.store.collection('chargingSessions');
    const cfg = () => sim.world.charging ?? {};
    const actor = (role) => cfg().actors?.[role] ?? (role === 'server' ? 'server' : 'bridge');

    /** A per-place map from the world, inherited down the hierarchy. */
    const inherited = (map, placeId) => {
      if (!map) return undefined;
      return sim.hierarchy.chain(placeId).map((n) => map[n.id]).find(Boolean);
    };
    const tariffFor = (placeId) => inherited(cfg().tariffs, placeId);

    // ---------- seeding and views ----------

    sim.seed((world) => {
      pts.seed(world);
      for (const s of world.chargingSessions ?? []) if (!sessions().has(s.id)) sessions().put({ ...s, _place: s._place ?? s.place?.id });
    });

    /** The operator read: an idle session's idle cost accrues up to now. */
    const operatorView = (s) => {
      if (s.chargingStatus !== 'idle') return wire(s);
      const cost = price(s, tariffFor(s._place), sim.clock.now());
      return wire(cost ? { ...s, cost } : s);
    };
    const sessionView = (s, principal) => (principal && isCustomer(principal) ? customerSessionView(operatorView(s)) : operatorView(s));
    const statusView = (p, principal) => (principal && isCustomer(principal) ? customerPointView(p) : pointView(p));

    sim.view('chargingSessions', (s, { principal } = {}) => sessionView(s, principal));
    sim.view('chargingPoints', (p, { principal } = {}) => statusView(p, principal));

    // ---------- the session lifecycle ----------

    const publishSession = (s) => {
      sim.events.publish({ type: 'apx.charging.session.status.v1', data: wire(s), subject: refOf(s.id, 'ChargingSession'), place: s._place });
      sim.hooks.emit('charging.session', { session: s, state: s.chargingStatus });
    };

    /** The connector follows its session (§23.1): occupied, charging, or released. */
    const connectorFollows = (s, ev) => {
      const ref = refOf(s.id, 'ChargingSession');
      const at = ev?.time ?? sim.clock.now();
      const idx = s.connectorIndex;
      switch (s.chargingStatus) {
        case 'authorized':
          return pts.setConnector(s.chargingPoint.id, idx, { currentSession: ref }, at);
        case 'pluggedIn':
        case 'suspended':
        case 'complete':
          return pts.setConnector(s.chargingPoint.id, idx, { availability: 'occupied', currentPowerKw: undefined, currentSession: ref }, at);
        case 'charging':
          return pts.setConnector(s.chargingPoint.id, idx, { availability: 'charging', currentPowerKw: s.energy?.currentPowerKw, currentSession: ref }, at);
        case 'faulted':
          return s.timeline?.pluggedInTime ? pts.setConnector(s.chargingPoint.id, idx, { availability: 'occupied', currentPowerKw: undefined }, at) : null;
        case 'unplugged':
        case 'cancelled': {
          const conn = points().get(s.chargingPoint.id)?.connectors.find((c) => c.connectorIndex === idx);
          const keep = conn && UNAVAILABLE.has(conn.availability);
          return pts.setConnector(s.chargingPoint.id, idx, { ...(keep ? {} : { availability: 'available' }), currentPowerKw: undefined, currentSession: undefined }, at);
        }
        default:
          return null;
      }
    };

    /** `closed` (server-side, §23.5): settlement finished. */
    const close = (id, detail, settlementPatch = {}) => {
      const s = sessions().get(id);
      if (!s || s.chargingStatus !== 'unplugged') return s;
      const now = sim.clock.now();
      const next = sessions().update(id, (x) => ({
        ...x,
        chargingStatus: 'closed',
        timeline: { ...x.timeline, closedTime: now },
        settlement: { ...(x.settlement ?? {}), ...settlementPatch, settledTime: now },
        statusHistory: [...(x.statusHistory ?? []), entry('closed', now, actor('server'), detail)],
      }));
      publishSession(next);
      return next;
    };

    /** `complete → idle` once the grace has elapsed with the cable still connected (§23.2 rule 2). */
    const goIdle = (id, endedTime) => {
      const s = sessions().get(id);
      if (!s || s.chargingStatus !== 'complete' || s.timeline?.chargingEndedTime !== endedTime) return;
      const now = sim.clock.now();
      const grace = s.idlePolicy.graceMinutes ?? 0;
      const next = sessions().update(id, (x) => {
        const idle = { ...x, chargingStatus: 'idle', timeline: { ...x.timeline, idleStartedTime: now }, statusHistory: [...(x.statusHistory ?? []), entry('idle', now, actor('server'), `grace ${grace} min elapsed`)] };
        const cost = price(idle, tariffFor(x._place), now);
        return cost ? { ...idle, cost } : idle;
      });
      publishSession(next);
      sim.events.publish({ type: 'apx.charging.idle.started.v1', data: wire(next), subject: refOf(id, 'ChargingSession'), place: next._place });
    };

    const scheduleIdle = (s) => {
      if (!s.idlePolicy) return;
      const ended = s.timeline.chargingEndedTime;
      const due = Date.parse(ended) + (s.idlePolicy.graceMinutes ?? 0) * MINUTE_MS;
      sim.clock.schedule(due, () => goIdle(s.id, ended), `charging idle ${s.id}`);
    };

    /** What happens to the money at unplug (§23.5). */
    const settleOnUnplug = (s) => {
      const mode = s.settlement?.mode;
      if (mode === 'parkingSession' && s.parkingSession) {
        const apds = sim.store.collection('sessions');
        if (apds.has(s.parkingSession.id) && s.cost) {
          apds.update(s.parkingSession.id, (x) => ({ ...x, _chargingLines: [...(x._chargingLines ?? []), { chargingSession: refOf(s.id, 'ChargingSession'), cost: s.cost, postedTime: s.timeline.unpluggedTime }] }), { bump: false });
        }
        sim.hooks.emit('charging.posted', { chargingSession: s, parkingSession: s.parkingSession, cost: s.cost });
        if (s._parkingSettled) close(s.id, `parking session ${s.parkingSession.id} settled`);
      }
      if (mode === 'chargingNetwork' && s.settlement?.externalReference) close(s.id, `charge detail record ${s.settlement.externalReference} final`);
    };

    const unplugDetail = (s) => {
      const parts = [];
      if (s.timeline?.idleStartedTime) parts.push(`idle ${idleUnits({ ...s, idlePolicy: { ...s.idlePolicy, idleRatePer: 'minute' } }, idleEndMs(s, Date.parse(s.timeline.unpluggedTime)))} min`);
      if (s.cost) {
        const lines = ['energy', 'idle', 'fees'].filter((k) => s.cost[k]).map((k) => `${k} ${dollars(s.cost[k])}`).join(' + ');
        if (lines) parts.push(s.settlement?.mode === 'parkingSession' && s.parkingSession ? `${lines} posted to session ${shortId(s.parkingSession.id)}` : lines);
      }
      return parts.join('; ') || undefined;
    };

    /** Apply one ChargingEvent, in time order, exactly as the §23.2 table says. */
    const ingest = (id, ev, by) => {
      const s = sessions().get(id);
      if (s._lastEventTime && Date.parse(ev.time) < Date.parse(s._lastEventTime)) {
        fail('charging-transition-illegal', `${ev.eventType} at ${ev.time} is older than the last event applied (${s._lastEventTime}); events are applied in time order (Part 23 §23.2 rule 1).`);
      }
      checkTransition(s, ev);
      let next = nextState(s, ev, by);
      const cost = price(next, tariffFor(s._place), ev.time);
      if (cost) next = { ...next, cost };
      if (ev.eventType === 'unplugged' && !ev.detail) {
        const detail = unplugDetail(next);
        const h = [...next.statusHistory];
        h[h.length - 1] = { ...h[h.length - 1], ...(detail ? { detail } : {}) };
        next = { ...next, statusHistory: h };
      }
      const stored = sessions().update(id, () => next);
      const moved = stored.chargingStatus !== s.chargingStatus;
      if (moved) publishSession(stored);
      if (moved || ev.eventType === 'meterValue') connectorFollows(stored, ev);
      if (moved && stored.chargingStatus === 'complete') scheduleIdle(stored);
      if (moved && stored.chargingStatus === 'unplugged') settleOnUnplug(stored);
      return sessions().get(id);
    };

    // ---------- opening a session ----------

    const plateOf = (s) => {
      if (s._plate) return [s._plate];
      return (s.identifiedCredentials ?? []).map((c) => c.credentialIdentification ?? c.identifier?.id).filter(Boolean);
    };

    /** §23.3 rule 5: a free-vend charge attributed to the parking Session the bay camera's plate entered on. */
    const attributeByPlate = (placeId, plate) => {
      if (!plate) return null;
      const related = (p) => p && (sim.hierarchy.within(placeId, p) || sim.hierarchy.within(p, placeId));
      return sim.store.collection('sessions').first((s) => !s.actualEnd && related(s._place ?? s.hierarchyElement?.id) && plateOf(s).includes(plate)) ?? null;
    };

    const refuseUnavailable = (point, conn, b) => {
      const name = point.evseId ?? point.id;
      if (UNAVAILABLE.has(conn.availability) || UNAVAILABLE.has(point.availability)) {
        fail('charging-point-unavailable', `Charging point ${name} connector ${conn.connectorIndex} is ${UNAVAILABLE.has(conn.availability) ? conn.availability : point.availability}.`);
      }
      const reservedFor = point.reservedFor;
      if ((reservedFor && b.assignedRight?.id !== reservedFor.id) || (!reservedFor && conn.availability === 'reserved' && !b.assignedRight)) {
        fail('charging-point-unavailable', `Charging point ${name} is reserved${reservedFor ? ` for AssignedRight ${reservedFor.id}` : ''}; the session names ${b.assignedRight ? `AssignedRight ${b.assignedRight.id}` : 'no AssignedRight'}.`);
      }
      const busy = sessions().first((x) => x.chargingPoint.id === point.id && x.connectorIndex === conn.connectorIndex && ACTIVE.has(x.chargingStatus));
      if (busy) fail('charging-point-unavailable', `Charging point ${name} connector ${conn.connectorIndex} is already serving ChargingSession ${busy.id} (${busy.chargingStatus}).`);
    };

    /** Resolve the valet ticket cross-link (§23.8): the ticket must exist; its stay is the parking session. */
    const valetLink = (b) => {
      if (!b.valetTicket) return null;
      if (!isRef(b.valetTicket)) fail('reference-unknown', 'valetTicket must be a Reference.');
      const ticket = sim.store.collection('valetTickets').get(b.valetTicket.id);
      if (!ticket) fail('reference-unknown', `valetTicket ${b.valetTicket.id} names no ValetTicket visible to the caller.`);
      return ticket;
    };

    const openSession = (ctx, b) => {
      const { node } = placeOfTarget(ctx, b.place, 'place');
      const point = points().get(b.chargingPoint?.id);
      if (!point) fail('reference-unknown', `chargingPoint ${b.chargingPoint?.id} names no ElectricChargingEquipment known at this server.`);
      if (!sim.hierarchy.within(point.id, node.id)) fail('request-unprocessable', `Charging point ${point.id} is not inside place ${node.id}.`);
      const connectorIndex = b.connectorIndex ?? 1;
      const conn = point.connectors.find((c) => c.connectorIndex === connectorIndex);
      if (!conn) fail('request-unprocessable', `Charging point ${point.id} has no connector ${connectorIndex} (it has ${point.connectors.map((c) => c.connectorIndex).join(', ')}).`);
      refuseUnavailable(point, conn, b);
      if (b.parkingSession && !sim.store.collection('sessions').has(b.parkingSession.id)) fail('reference-unknown', `parkingSession ${b.parkingSession.id} names no Session known at this place.`);
      const ticket = valetLink(b);

      const {
        id: _id, version: _v, chargingStatus: _cs, timeline: _t, statusHistory: _h, recordInfo: _r, cost: clientCost, ...body
      } = b;
      let parkingSession = b.parkingSession ?? (ticket?.session ? refOf(ticket.session.id, 'Session') : undefined);
      let authorization = { ...(b.authorization ?? {}) };
      let vehicle = b.vehicle;
      let detail;
      if (!parkingSession && authorization.method === 'unlimitedAccess') {
        const seen = point._bayReport?.vehicle?.credentialIdentification;
        const plate = seen ?? b.vehicle?.credentialIdentification;
        const stay = attributeByPlate(point._place, plate);
        if (stay) {
          parkingSession = refOf(stay.id, 'Session');
          const note = `attributed to the parking session by bay LPR (${plate})`;
          authorization = { ...authorization, methodDetail: authorization.methodDetail ? `${authorization.methodDetail}; ${note}` : `free-vend; ${note}` };
          vehicle = vehicle ?? { credentialType: 'licensePlate', credentialIdentification: plate, ...(point._bayReport?.vehicle?.jurisdiction ? { jurisdiction: point._bayReport.vehicle.jurisdiction } : {}) };
          detail = `free-vend; parking session ${shortId(stay.id)} by bay LPR`;
        }
      }
      const settlement = b.settlement ?? (ticket ? { mode: 'parkingSession' } : undefined);
      if (settlement?.mode === 'parkingSession' && !parkingSession) {
        fail('request-unprocessable', 'settlement.mode is parkingSession but no parkingSession Reference was given and none could be attributed (Part 23 §23.5 rule 1).');
      }
      const now = ctx.now();
      const authorizedTime = authorization.authorizedTime ?? now;
      authorization.authorizedTime = authorizedTime;
      const idlePolicy = b.idlePolicy ?? inherited(cfg().idlePolicies, point._place);
      const record = {
        ...body,
        place: refOf(node.id, b.place.className ?? 'Place'),
        connectorIndex,
        ...(point.evseId && !b.evseId ? { evseId: point.evseId } : {}),
        ...(point.space && !b.space ? { space: point.space } : {}),
        ...(parkingSession ? { parkingSession } : {}),
        ...(vehicle ? { vehicle } : {}),
        authorization,
        ...(idlePolicy ? { idlePolicy } : {}),
        ...(settlement ? { settlement } : {}),
        ...(settlement?.mode === 'chargingNetwork' && clientCost ? { cost: clientCost } : {}),
        chargingStatus: 'authorized',
        timeline: { authorizedTime },
        statusHistory: [entry('authorized', authorizedTime, authorization.authorizedBy ?? ctx.principal.sub, detail)],
        _place: point._place,
        _lastEventTime: authorizedTime,
      };
      const s = sessions().insert(record, { assignedId: ctx.assignId, actor: ctx.actor });
      if (ticket) sim.store.collection('valetTickets').update(ticket.id, (t) => ({ ...t, charging: { ...(t.charging ?? {}), session: refOf(s.id, 'ChargingSession') } }), { bump: false });
      publishSession(s);
      connectorFollows(s);
      return s;
    };

    // ---------- handlers: points ----------

    const boundSession = (principal) => (principal.bound?.id ? sessions().get(principal.bound.id) : null);

    sim.on('get-apx-v1-charging-points', (ctx) => {
      const placeId = ctx.query.get('place');
      const avail = ctx.query.get('availability');
      let rows;
      if (isCustomer(ctx.principal)) {
        const own = boundSession(ctx.principal);
        if (!own) return paginate(ctx, []);
        if (!sim.hierarchy.within(placeId, own._place) && !sim.hierarchy.within(own._place, placeId)) {
          fail('insufficient-grant', `A customer token is confined to the place of its own charging session (${own._place}); place ${placeId} is outside it.`);
        }
        rows = points().find((p) => sim.hierarchy.within(p.id, placeId) && sim.hierarchy.within(p.id, own._place)).map(customerPointView);
      } else {
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, placeId)) {
          if (!ctx.hierarchy.has(placeId)) fail('target-not-found', `No place ${placeId} visible to this credential.`);
          fail('insufficient-grant', `Place ${placeId} is not in the token's apx_places grant.`);
        }
        rows = points().find((p) => sim.hierarchy.within(p.id, placeId)).map(pointView);
      }
      rows = rows.filter((p) => !avail || p.availability === avail).sort((a, b) => (a.refillPointIndex ?? 0) - (b.refillPointIndex ?? 0) || a.chargingPoint.id.localeCompare(b.chargingPoint.id));
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-charging-points-id', (ctx) => {
      if (isCustomer(ctx.principal)) {
        const own = boundSession(ctx.principal);
        const p = points().get(ctx.params.id);
        if (!p || !own || !sim.hierarchy.within(p.id, own._place)) fail('target-not-found', `No charging point ${ctx.params.id} visible to this credential.`);
        return customerPointView(p);
      }
      return pointView(getVisible(ctx, 'chargingPoints', ctx.params.id, { what: 'charging point' }));
    });

    sim.on('put-apx-v1-charging-points-id-status', (ctx) => {
      const p = getVisible(ctx, 'chargingPoints', ctx.params.id, { what: 'charging point' });
      const b = ctx.body;
      if (b.chargingPoint.id !== p.id) {
        fail('invalid-request', `Body chargingPoint ${b.chargingPoint.id} does not match the path ${p.id}.`, { errors: [{ pointer: '/chargingPoint/id', detail: 'must equal the path id' }] });
      }
      const given = new Map((b.connectors ?? []).map((c) => [c.connectorIndex, c]));
      const unknown = [...given.keys()].find((i) => !p.connectors.some((c) => c.connectorIndex === i));
      if (unknown !== undefined) fail('invalid-request', `Charging point ${p.id} has no connector ${unknown}.`, { errors: [{ pointer: '/connectors', detail: `unknown connectorIndex ${unknown}` }] });
      const now = ctx.now();
      const after = pts.apply(
        p.id,
        (cur) => {
          const connectors = cur.connectors.map((c) => {
            const g = b.connectors ? given.get(c.connectorIndex) : { availability: b.availability };
            if (!g) return c;
            return {
              connectorIndex: c.connectorIndex,
              ...(g.connectorType ?? c.connectorType ? { connectorType: g.connectorType ?? c.connectorType } : {}),
              availability: g.availability,
              ...(g.currentPowerKw !== undefined ? { currentPowerKw: g.currentPowerKw } : {}),
              ...(g.currentSession ? { currentSession: g.currentSession } : {}),
            };
          });
          const { currentSession: _c, reservedFor: _r, ...rest } = cur;
          return { ...rest, connectors, ...(b.currentSession ? { currentSession: b.currentSession } : {}), ...(b.reservedFor ? { reservedFor: b.reservedFor } : {}), lastCommunication: b.lastCommunication ?? now };
        },
        now
      );
      return pointView(after);
    });

    sim.on('post-apx-v1-charging-points-id-bay', (ctx) => {
      const p = getVisible(ctx, 'chargingPoints', ctx.params.id, { what: 'charging point' });
      const after = pts.report(p.id, ctx.body, ctx.now());
      return { status: 200, body: pointView(after), idem: { collection: 'chargingPoints', id: p.id } };
    });

    // ---------- handlers: sessions ----------

    sim.on('post-apx-v1-charging-sessions', (ctx) => {
      const s = openSession(ctx, ctx.body);
      return { status: 201, body: operatorView(sessions().get(s.id)), idem: { collection: 'chargingSessions', id: s.id } };
    });

    sim.on('get-apx-v1-charging-sessions', (ctx) => {
      const places = ctx.query.list('place');
      for (const id of places) {
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
      }
      const q = (n) => ctx.query.get(n);
      const since = q('since');
      const rows = visibleRows(ctx, 'chargingSessions')
        .filter((s) => {
          if (places.length && !places.some((p) => sim.hierarchy.within(s._place, p))) return false;
          if (q('chargingPoint') && s.chargingPoint.id !== q('chargingPoint')) return false;
          if (q('status') && s.chargingStatus !== q('status')) return false;
          if (q('plate') && s.vehicle?.credentialIdentification !== q('plate')) return false;
          if (q('parkingSession') && s.parkingSession?.id !== q('parkingSession')) return false;
          if (q('account') && s.authorization?.account?.id !== q('account')) return false;
          if (since && Date.parse(s.timeline?.authorizedTime ?? 0) < Date.parse(since)) return false;
          return true;
        })
        .sort((a, b) => Date.parse(b.timeline?.authorizedTime ?? 0) - Date.parse(a.timeline?.authorizedTime ?? 0))
        .map(operatorView);
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-charging-sessions-id', (ctx) => {
      if (isCustomer(ctx.principal)) {
        const s = sessions().get(ctx.params.id);
        if (!s || ctx.principal.bound?.id !== s.id) fail('target-not-found', `No charging session ${ctx.params.id} visible to this credential.`);
        return sessionView(s, ctx.principal);
      }
      return operatorView(getVisible(ctx, 'chargingSessions', ctx.params.id, { what: 'charging session' }));
    });

    sim.on('post-apx-v1-charging-sessions-id-events', (ctx) => {
      const s = getVisible(ctx, 'chargingSessions', ctx.params.id, { what: 'charging session' });
      const ev = ctx.body;
      if (ev.connectorIndex !== undefined && s.connectorIndex !== undefined && ev.connectorIndex !== s.connectorIndex) {
        fail('invalid-request', `Event connectorIndex ${ev.connectorIndex} does not match the session's connector ${s.connectorIndex}.`, { errors: [{ pointer: '/connectorIndex', detail: 'must match the session' }] });
      }
      const next = ingest(s.id, ev, ctx.principal.sub);
      return { status: 200, body: operatorView(next), idem: { collection: 'chargingSessions', id: s.id } };
    });

    sim.on(
      'post-apx-v1-charging-sessions-id-payment',
      (ctx) => {
        const s = getVisible(ctx, 'chargingSessions', ctx.params.id, { what: 'charging session' });
        const b = ctx.body ?? {};
        const mode = s.settlement?.mode;
        const conflict = (why) => fail('charging-settlement-conflict', `ChargingSession ${s.id}: ${why} (Part 23 §23.5).`);
        if (s.chargingStatus === 'closed') conflict('the session is already closed');
        if (!mode) conflict('the session carries no settlement.mode, so there is nothing to settle against');
        if (mode === 'parkingSession') conflict(`settlement.mode is parkingSession; the charge settles with parking Session ${s.parkingSession?.id}, not by a payment attached here`);
        if (mode === 'directPayment') {
          if (s.chargingStatus !== 'unplugged') conflict(`the session is ${s.chargingStatus}; a directPayment attaches only after unplugged, when the final cost is known`);
          if (!isRef(b.payment)) conflict('a directPayment settlement needs a payment Reference');
          return operatorView(close(s.id, `payment ${b.payment.id} attached`, { payment: b.payment }));
        }
        if (!b.externalReference) conflict('a chargingNetwork settlement records the network charge detail record in externalReference');
        const next = sessions().update(s.id, (x) => ({ ...x, settlement: { ...x.settlement, externalReference: b.externalReference } }));
        return operatorView(next.chargingStatus === 'unplugged' ? close(s.id, `charge detail record ${b.externalReference} final`) : next);
      },
      { allowEmptyBody: true }
    );

    // ---------- settlement of the parking stay ----------

    const parkingSettled = (parkingSessionId) => {
      const out = [];
      for (const s of sessions().find((x) => x.parkingSession?.id === parkingSessionId && x.settlement?.mode === 'parkingSession' && !TERMINAL.has(x.chargingStatus))) {
        if (s.chargingStatus === 'unplugged') out.push(close(s.id, `parking session ${shortId(parkingSessionId)} settled`));
        else out.push(sessions().update(s.id, (x) => ({ ...x, _parkingSettled: true }), { bump: false }));
      }
      return out;
    };

    sim.hooks.on('payment.recorded', ({ payment }) => {
      const sid = payment?._session?.id ?? payment?._session;
      if (sid) parkingSettled(sid);
    });

    // ---------- Part 6 commands (§23.9): applied when control dispatches ----------

    const failCommand = (cmd, detail) => sim.control?.transition(cmd.id, 'failed', actor('bridge'), detail, { confirmationLevel: 'deviceAcknowledged' });

    const startByAuthorization = (cmd, point, idx) => {
      const p = cmd.parameters ?? {};
      const fake = { now: () => sim.clock.now(), assignId: undefined, actor: { org: cmd.requestedBy }, principal: { sub: actor('bridge'), hasGrant: true, places: ['*'] }, hierarchy: sim.hierarchy };
      const s = openSession(fake, { place: refOf(point._place, 'Place'), chargingPoint: refOf(point.id, 'ElectricChargingEquipment'), connectorIndex: idx, authorization: { ...p.authorization, authorizedBy: p.authorization?.authorizedBy ?? cmd.agent ?? actor('bridge') } });
      const now = sim.clock.now();
      ingest(s.id, { eventType: 'pluggedIn', time: now }, actor('bridge'));
      ingest(s.id, { eventType: 'chargingStarted', time: now, detail: `remote start by command ${cmd.id}` }, actor('bridge'));
    };

    const applyCommand = (cmd) => {
      const point = points().get(cmd.target.id);
      if (!point) return failCommand(cmd, `${cmd.target.id} is not a charging point this server holds`);
      const p = cmd.parameters ?? {};
      const idx = p.connectorIndex ?? 1;
      if (!point.connectors.some((c) => c.connectorIndex === idx)) return failCommand(cmd, `charging point has no connector ${idx}`);
      const now = sim.clock.now();
      const s = isRef(p.chargingSession) ? sessions().get(p.chargingSession.id) : sessions().first((x) => x.chargingPoint.id === point.id && x.connectorIndex === idx && ACTIVE.has(x.chargingStatus));
      try {
        if (cmd.commandType === 'unlockConnector') {
          pts.apply(point.id, { _unlockedTime: now }, now);
          return sim.hooks.emit('charging.connectorUnlocked', { point: point.id, connectorIndex: idx, session: s ?? null, command: cmd });
        }
        if (cmd.commandType === 'stopCharging') {
          if (!s) return failCommand(cmd, `no charging session on connector ${idx}`);
          return ingest(s.id, { eventType: 'chargingEnded', time: now, stopReason: 'remote', detail: `remote stop by command ${cmd.id}` }, actor('bridge'));
        }
        if (s && s.chargingStatus === 'pluggedIn') return ingest(s.id, { eventType: 'chargingStarted', time: now, detail: `remote start by command ${cmd.id}` }, actor('bridge'));
        if (!s && p.authorization) return startByAuthorization(cmd, point, idx);
        return failCommand(cmd, s ? `charging session ${s.id} is ${s.chargingStatus}; startCharging needs a plugged-in vehicle` : 'startCharging needs a chargingSession or an authorization');
      } catch (e) {
        if (e instanceof ProblemError) return failCommand(cmd, e.detail ?? e.slug);
        throw e;
      }
    };

    sim.hooks.on('command.transition', ({ command, state }) => {
      if (state !== 'dispatched' || !CHARGING_COMMANDS.has(command.commandType)) return;
      applyCommand(command);
    });

    // ---------- injectors ----------

    const requirePoint = (id) => {
      if (!points().has(id)) throw new Error(`no charging point ${id}`);
      return points().get(id);
    };

    /** A bridge event: { session, event: ChargingEvent } or the event members inline. */
    sim.injector('chargerEvent', ({ kind: _k, session, event, actor: by, ...inline }) => {
      if (!sessions().has(session)) throw new Error(`no charging session ${session}`);
      const ev = { time: sim.clock.now(), ...(event ?? inline) };
      if (!ev.eventType) throw new Error('chargerEvent needs event.eventType');
      try {
        return wire(ingest(session, ev, by ?? actor('bridge')));
      } catch (e) {
        if (e instanceof ProblemError) throw new Error(`${e.slug}: ${e.detail}`);
        throw e;
      }
    });

    /** What the bay camera sees: { point, presence, plate?, evCapable?, source?, observation?, confidence?, imageLink?, detail? }. */
    sim.injector('bayCamera', ({ point, presence, plate, evCapable, jurisdiction, source = 'overheadCamera', observation, confidence, imageLink, detail, observedTime }) => {
      requirePoint(point);
      if (!['empty', 'vehiclePluggedIn', 'vehicleNotPluggedIn', 'blocked', 'unknown'].includes(presence)) throw new Error(`presence ${presence} is not in the ChargingBayPresence list`);
      const vehicle = plate || evCapable !== undefined ? { ...(plate ? { credentialType: 'licensePlate', credentialIdentification: plate } : {}), ...(jurisdiction ? { jurisdiction } : {}), ...(evCapable !== undefined ? { evCapable } : {}) } : undefined;
      const body = { presence, source, ...(observation ? { observation: refOf(observation, 'Observation') } : {}), ...(vehicle ? { vehicle } : {}), ...(confidence !== undefined ? { confidence } : {}), ...(imageLink ? { imageLink } : {}), ...(detail ? { detail } : {}), ...(observedTime ? { observedTime } : {}) };
      return pointView(pts.report(point, body));
    });

    /** A charger fault: { point, connectorIndex?, availability? ('outOfOrder'), faultCode? } — the active session faults too. */
    sim.injector('chargerFault', ({ point, connectorIndex, availability = 'outOfOrder', faultCode }) => {
      const p = requirePoint(point);
      if (!AVAILABILITY.includes(availability)) throw new Error(`availability ${availability} is not in the closed list`);
      const now = sim.clock.now();
      const idxs = connectorIndex ? [connectorIndex] : p.connectors.map((c) => c.connectorIndex);
      for (const s of sessions().find((x) => x.chargingPoint.id === point && idxs.includes(x.connectorIndex) && ['authorized', 'pluggedIn', 'charging', 'suspended', 'complete', 'idle'].includes(x.chargingStatus))) {
        ingest(s.id, { eventType: 'fault', time: now, ...(faultCode ? { faultCode } : {}) }, actor('bridge'));
      }
      const after = pts.apply(point, (cur) => ({ ...cur, connectors: cur.connectors.map((c) => (idxs.includes(c.connectorIndex) ? { ...c, availability } : c)), lastCommunication: now }), now);
      return pointView(after);
    });

    /** The APDS Session the charge rode on settled (pay station, Part 13): its unplugged charges close. */
    sim.injector('parkingSessionSettled', ({ session }) => {
      if (!session) throw new Error('parkingSessionSettled needs { session }');
      return { closed: parkingSettled(session).filter((s) => s?.chargingStatus === 'closed').map((s) => s.id) };
    });

    // exposed for other domains (data: OccupancySnapshot.evCharging; resolution; valet)
    sim.charging = { evCharging: pts.evCharging, points, sessions, ingest, report: pts.report, pointView, sessionView };
  },
};
