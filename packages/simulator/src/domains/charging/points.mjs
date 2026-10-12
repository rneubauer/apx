/**
 * Charging points (Part 23 §23.1, §23.3): the ChargingPointStatus overlay
 * keyed by the APDS ElectricChargingEquipment, the bay-presence fusion,
 * the point topic, and the bay alerts it causes.
 *
 * Collection `chargingPoints`: one record per point, `id` = the
 * ElectricChargingEquipment id. Internal members: `_place` (the Place the
 * point sits in, the grant check), `_bayReport` (the latest presence
 * report as received), `_unlockedTime` (last unlockConnector).
 */
import { refOf, wire, mls, shortId } from '../common.mjs';

export const AVAILABILITY = ['available', 'occupied', 'charging', 'reserved', 'blocked', 'inoperative', 'outOfOrder', 'unknown'];

// "The busiest connector wins" (§23.1 rule 1): a higher rank is busier.
const BUSY = { charging: 7, occupied: 6, reserved: 5, outOfOrder: 4, inoperative: 3, blocked: 2, unknown: 1, available: 0 };
const CONNECTED = new Set(['occupied', 'charging']);
const BAY_ALERTS = new Set(['evBayNotCharging', 'evBayBlocked', 'iceInEvSpace']);
const OPEN_ALERT = new Set(['raised', 'acknowledged']);
const DEFAULT_BAY_GRACE_MINUTES = 10;
const MINUTE_MS = 60_000;

/** The point-level value of its connectors: the busiest one, `unknown` with none. */
export function busiest(connectors = []) {
  if (!connectors.length) return 'unknown';
  return connectors.map((c) => c.availability).reduce((a, b) => ((BUSY[b] ?? 0) > (BUSY[a] ?? 0) ? b : a));
}

export const cableConnected = (connectors = []) => connectors.some((c) => CONNECTED.has(c.availability));

/**
 * The §23.3 fusion table: the latest presence report and the connector
 * states give `bay.presence`, the source that decided it, and the point's
 * availability. A blocked bay overrides only `available` / `unknown`.
 */
export function fuse(connectors, report) {
  const connected = cableConnected(connectors);
  const base = busiest(connectors);
  const seen = !report || report.presence === 'unknown' ? null : report.presence === 'empty' ? 'nothing' : report.presence === 'blocked' ? 'obstruction' : 'vehicle';
  let presence = 'unknown';
  let source;
  if (seen === 'nothing') {
    presence = connected ? 'unknown' : 'empty';
    source = connected ? 'inferred' : report.source;
  } else if (seen === 'vehicle') {
    presence = connected ? 'vehiclePluggedIn' : 'vehicleNotPluggedIn';
    source = report.source;
  } else if (seen === 'obstruction') {
    presence = 'blocked';
    source = report.source;
  }
  const bayBlocks = presence === 'vehicleNotPluggedIn' || (presence === 'blocked' && !connected);
  const availability = bayBlocks && (base === 'available' || base === 'unknown') ? 'blocked' : base;
  return { presence, source, availability };
}

/** The evidence members of a presence report that ride along in `bay`. */
const evidenceOf = (r) => {
  if (!r) return {};
  const out = {};
  for (const k of ['observation', 'observedTime', 'vehicle', 'confidence', 'imageLink', 'detail']) if (r[k] !== undefined) out[k] = r[k];
  return out;
};

/** Recompute the derived members (availability, bay, stateChangedTime) of a point record. */
export function derive(prev, merged, at) {
  const f = fuse(merged.connectors, merged._bayReport);
  const samePresence = prev?.bay?.presence === f.presence;
  const bay = {
    presence: f.presence,
    ...(f.source ? { source: f.source } : {}),
    ...evidenceOf(merged._bayReport),
    sinceTime: samePresence ? (prev.bay.sinceTime ?? at) : at,
  };
  const changed = prev?.availability !== f.availability;
  return { ...merged, availability: f.availability, bay, stateChangedTime: changed || !merged.stateChangedTime ? at : merged.stateChangedTime };
}

/** The wire ChargingPointStatus of a record (never id/version: the overlay is keyed by chargingPoint). */
export function pointView(p) {
  const { id: _id, version: _v, recordInfo: _r, ...rest } = wire(p);
  return rest;
}

/** §23.6: the customer-scope point read omits the bay evidence and the session references. */
export function customerPointView(p) {
  const v = pointView(p);
  const { currentSession: _cs, ...out } = v;
  if (out.bay) {
    const { vehicle: _veh, imageLink: _img, observation: _obs, ...bay } = out.bay;
    out.bay = bay;
  }
  if (out.connectors) out.connectors = out.connectors.map(({ currentSession: _s, ...c }) => c);
  return out;
}

export function createPoints(sim) {
  const points = () => sim.store.collection('chargingPoints');
  const graceMs = () => (sim.world.charging?.bayGraceMinutes ?? DEFAULT_BAY_GRACE_MINUTES) * MINUTE_MS;

  // ---------- seeding ----------

  const seed = (world) => {
    for (const c of world.chargingPoints ?? []) {
      sim.hierarchy.add({ id: c.id, kind: 'device', className: 'ElectricChargingEquipment', parentId: c.placeId, name: c.name, evseId: c.evseId });
      const start = c.stateChangedTime ?? world.clock?.start;
      const base = {
        id: c.id,
        version: 1,
        _place: c.placeId,
        chargingPoint: refOf(c.id, 'ElectricChargingEquipment'),
        place: refOf(c.placeId, 'Place'),
        ...(c.spaceId ? { space: refOf(c.spaceId, 'Space') } : {}),
        ...(c.refillPointIndex !== undefined ? { refillPointIndex: c.refillPointIndex } : {}),
        ...(c.evseId ? { evseId: c.evseId } : {}),
        connectors: (c.connectors ?? [{ connectorIndex: 1 }]).map((x) => ({ connectorIndex: x.connectorIndex, ...(x.connectorType ? { connectorType: x.connectorType } : {}), availability: x.availability ?? 'available' })),
        ...(c.reservedFor ? { reservedFor: c.reservedFor } : {}),
        _bayReport: c.bay ? { ...c.bay } : null,
        lastCommunication: c.lastCommunication ?? world.clock?.start,
        stateChangedTime: start,
      };
      const derived = derive(null, base, start);
      points().put({ ...derived, bay: { ...derived.bay, sinceTime: c.bay?.sinceTime ?? start } });
    }
  };

  // ---------- alerts (§23.1 rule 4, §23.3 rule 3) ----------

  const openAlerts = (pointId, types) =>
    sim.store.collection('alerts').find((a) => types.has(a.alertType) && a.source?.device?.id === pointId && OPEN_ALERT.has(a.status));

  const bayAlertType = (bay) => {
    if (bay.presence === 'blocked') return 'evBayBlocked';
    if (bay.presence === 'vehicleNotPluggedIn') return bay.vehicle?.evCapable === false ? 'iceInEvSpace' : 'evBayNotCharging';
    return null;
  };

  const raiseFor = (p, alertType, severity, text, occurrenceTime) => {
    if (!sim.alerts?.raise || openAlerts(p.id, new Set([alertType])).length) return;
    sim.alerts.raise(
      {
        alertType,
        severity,
        source: { device: refOf(p.id, 'ElectricChargingEquipment'), place: p._place },
        ...(p.bay?.observation ? { relatedEntity: p.bay.observation } : {}),
        occurrenceTime,
        detectionTime: sim.clock.now(),
        description: mls(text),
      },
      sim.world.charging?.actors?.server ?? 'server',
      `bay presence ${p.bay?.presence} at ${p.evseId ?? shortId(p.id)}`
    );
  };

  const raiseBayAlert = (p) => {
    const type = bayAlertType(p.bay);
    if (!type) return;
    const name = p.evseId ?? shortId(p.id);
    if (type === 'evBayBlocked') {
      raiseFor(p, type, 'warning', `Charging bay at ${name} is obstructed`, p.bay.sinceTime);
      return;
    }
    const since = p.bay.sinceTime;
    const due = Date.parse(since) + graceMs();
    sim.clock.schedule(
      due,
      () => {
        const now = points().get(p.id);
        if (!now || now.bay?.presence !== 'vehicleNotPluggedIn' || now.bay.sinceTime !== since) return;
        const t = bayAlertType(now.bay);
        const text = t === 'iceInEvSpace' ? `Non-EV vehicle in the charging bay at ${name}` : `Vehicle in the charging bay at ${name} is not plugged in`;
        raiseFor(now, t, 'warning', text, since);
      },
      `bay grace ${p.id}`
    );
  };

  const resolveBayAlerts = (p, detail) => {
    if (!sim.alerts?.transition) return;
    for (const a of openAlerts(p.id, BAY_ALERTS)) sim.alerts.transition(a.id, 'resolved', sim.world.charging?.actors?.server ?? 'server', detail);
  };

  // ---------- the one write path ----------

  /**
   * Apply a change to a point, re-fuse, and publish when the point-level
   * availability or bay presence moved (§23.1 rule 3). `change` is a
   * patch, or a function from the current record to the merged one.
   */
  const apply = (id, change, at = sim.clock.now()) => {
    const before = points().get(id);
    if (!before) return null;
    const merge = typeof change === 'function' ? change : (p) => ({ ...p, ...change });
    const after = points().update(id, (p) => derive(p, merge(p), at));
    const presenceMoved = before.bay?.presence !== after.bay?.presence;
    if (before.availability !== after.availability || presenceMoved) {
      sim.events.publish({ type: 'apx.charging.point.status.v1', data: pointView(after), subject: refOf(id, 'ElectricChargingEquipment'), place: after._place });
    }
    if (presenceMoved) {
      sim.hooks.emit('charging.bayPresence', { point: after, previous: before.bay?.presence, presence: after.bay.presence });
      resolveBayAlerts(after, `bay presence now ${after.bay.presence}`);
      raiseBayAlert(after);
    }
    if (after.availability === 'outOfOrder' && before.availability !== 'outOfOrder') {
      raiseFor(after, 'deviceFault', 'major', `Charging point ${after.evseId ?? shortId(id)} reports a fault`, at);
    }
    return after;
  };

  /** A presence report (POST …/bay or the bayCamera injector); an older report than the one held is ignored. */
  const report = (id, body, at = sim.clock.now()) => {
    const p = points().get(id);
    const observedTime = body.observedTime ?? at;
    const held = p._bayReport?.observedTime;
    if (held && Date.parse(observedTime) < Date.parse(held)) return p;
    return apply(id, { _bayReport: { ...body, observedTime } }, observedTime);
  };

  /** Set one connector's state from the session lifecycle. */
  const setConnector = (id, connectorIndex, patch, at) => {
    if (!points().has(id)) return null;
    return apply(
      id,
      (p) => {
        const connectors = p.connectors.map((c) => {
          if (c.connectorIndex !== connectorIndex) return c;
          const next = { ...c, ...patch };
          for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
          return next;
        });
        const currentSession = connectors.find((c) => c.currentSession)?.currentSession;
        const { currentSession: _old, ...rest } = p;
        return { ...rest, connectors, ...(currentSession ? { currentSession } : {}), lastCommunication: at };
      },
      at
    );
  };

  /** §23.7: OccupancySnapshot.evCharging for an element, or undefined when no point lies under it. */
  const evCharging = (placeId) => {
    const rows = points().find((p) => sim.hierarchy.within(p.id, placeId));
    if (!rows.length) return undefined;
    const count = (pred) => rows.filter(pred).length;
    return {
      pointsTotal: rows.length,
      available: count((p) => p.availability === 'available'),
      charging: count((p) => p.availability === 'charging'),
      occupiedNotCharging: count((p) => p.availability === 'occupied'),
      blocked: count((p) => p.availability === 'blocked'),
      inoperative: count((p) => p.availability === 'inoperative' || p.availability === 'outOfOrder'),
    };
  };

  return { points, seed, apply, report, setConnector, evCharging };
}
