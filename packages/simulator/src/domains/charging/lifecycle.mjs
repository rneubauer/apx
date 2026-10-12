/**
 * The ChargingSession lifecycle (Part 23 §23.2), energy (§23.4), cost and
 * idle accrual (§23.5), and the customer-scope minimization (§23.6) — pure
 * functions over a session record; the module does the storing,
 * publishing, and timers.
 */
import { fail } from '../../kernel/problems.mjs';
import { entry, money, wire } from '../common.mjs';

/** §23.2 transition table: event → the states it is legal from, and the state it leads to. */
export const TRANSITIONS = {
  pluggedIn: { from: ['authorized'], to: 'pluggedIn' },
  chargingStarted: { from: ['pluggedIn'], to: 'charging' },
  suspended: { from: ['charging'], to: 'suspended' },
  resumed: { from: ['suspended'], to: 'charging' },
  chargingEnded: { from: ['pluggedIn', 'charging', 'suspended'], to: 'complete' },
  unplugged: { from: ['pluggedIn', 'complete', 'idle', 'faulted'], to: 'unplugged' },
  fault: { from: ['authorized', 'pluggedIn', 'charging', 'suspended', 'complete', 'idle'], to: 'faulted' },
  cancelled: { from: ['authorized', 'faulted'], to: 'cancelled' },
};
export const METER_STATES = new Set(['pluggedIn', 'charging', 'suspended', 'complete', 'idle']);
/** States in which a session holds its connector (a second open is refused, §23.2). */
export const ACTIVE = new Set(['authorized', 'pluggedIn', 'charging', 'suspended', 'complete', 'idle', 'faulted']);
export const TERMINAL = new Set(['closed', 'cancelled']);

const UNIT_MS = { minute: 60_000, hour: 3_600_000 };
const round = (n, places) => Number(Number(n).toFixed(places));
const later = (a, b) => (a === undefined ? b : Math.max(a, b));

/** Refuse an event the table does not allow from the session's state (409 charging-transition-illegal). */
export function checkTransition(s, ev) {
  const from = s.chargingStatus;
  if (ev.eventType === 'meterValue') {
    if (!METER_STATES.has(from)) fail('charging-transition-illegal', `meterValue is not valid in state ${from}; meter values are accepted in ${[...METER_STATES].join(', ')}.`);
    return;
  }
  const rule = TRANSITIONS[ev.eventType];
  if (!rule || !rule.from.includes(from)) {
    fail('charging-transition-illegal', `ChargingSession ${s.id} is ${from}; ${ev.eventType} is legal only from ${rule ? rule.from.join(', ') : '(no state)'} (Part 23 §23.2).`);
  }
  if (ev.eventType === 'cancelled' && from === 'faulted' && s.timeline?.pluggedInTime) {
    fail('charging-transition-illegal', `ChargingSession ${s.id} faulted after a plug-in at ${s.timeline.pluggedInTime}; it exits via unplugged, not cancelled.`);
  }
}

/** §23.4: fold a meter-bearing event into `energy`. deliveredKwh only from two meter readings, never from time × power. */
export function applyEnergy(energy = {}, ev) {
  const e = { ...energy };
  if (ev.eventType === 'chargingStarted' && ev.meterWh !== undefined) e.meterStartWh = ev.meterWh;
  if (ev.eventType === 'chargingEnded' && ev.meterWh !== undefined) e.meterStopWh = ev.meterWh;
  if (ev.meterWh !== undefined && e.meterStartWh !== undefined) e.deliveredKwh = round(Math.max(0, ev.meterWh - e.meterStartWh) / 1000, 3);
  if (ev.meterWh !== undefined || ev.powerKw !== undefined || ev.stateOfChargePercent !== undefined) e.lastMeterTime = ev.time;
  if (ev.powerKw !== undefined) {
    e.currentPowerKw = ev.powerKw;
    e.peakPowerKw = later(e.peakPowerKw, ev.powerKw);
  }
  if (ev.stateOfChargePercent !== undefined) e.stateOfChargePercent = ev.stateOfChargePercent;
  if (['chargingEnded', 'suspended', 'unplugged', 'fault'].includes(ev.eventType)) delete e.currentPowerKw;
  return e;
}

const TIMELINE_OF = {
  pluggedIn: 'pluggedInTime',
  chargingStarted: 'chargingStartedTime',
  chargingEnded: 'chargingEndedTime',
  unplugged: 'unpluggedTime',
};

/** Whole idle units started between idleStartedTime and `endMs` (a 12 min 49 s idle at per-minute is 13). */
export function idleUnits(s, endMs) {
  const p = s.idlePolicy;
  const start = s.timeline?.idleStartedTime;
  if (!p || !start) return 0;
  const ms = Math.max(0, endMs - Date.parse(start));
  return Math.ceil(ms / (UNIT_MS[p.idleRatePer ?? 'minute'] ?? UNIT_MS.minute));
}

/** The instant idle stopped accruing: unplug, fault, or (still idle) `atMs`. */
export function idleEndMs(s, atMs) {
  if (s.chargingStatus === 'idle') return atMs;
  return s._idleEnd ? Date.parse(s._idleEnd) : atMs;
}

/**
 * §23.5 cost: energy at the place tariff, idle per started unit while the
 * operator bills it. Absent components are unknown, not zero; a
 * chargingNetwork session keeps whatever cost the network shared.
 */
export function price(s, tariff, at) {
  if (s.settlement?.mode === 'chargingNetwork') return s.cost;
  const currency = tariff?.currency ?? s.idlePolicy?.idleRate?.currencyType ?? 'USD';
  const parts = {};
  if (tariff?.energyPerKwh !== undefined && s.energy?.deliveredKwh !== undefined) parts.energy = money(s.energy.deliveredKwh * tariff.energyPerKwh, currency);
  const pol = s.idlePolicy;
  if (pol?.idleRate && pol.appliesToSettlement !== false && s.timeline?.idleStartedTime) {
    parts.idle = money(idleUnits(s, idleEndMs(s, Date.parse(at))) * pol.idleRate.currencyValue, pol.idleRate.currencyType);
  }
  if (tariff?.fees) parts.fees = money(tariff.fees, currency);
  if (!Object.keys(parts).length) return s.cost;
  const total = Object.values(parts).reduce((sum, m) => sum + m.currencyValue, 0);
  return { ...parts, total: money(total, currency), ...(tariff?.tariffReference ? { tariffReference: tariff.tariffReference } : {}), pricedAt: at };
}

/**
 * The next record after an event: state, timeline, energy, stop reason,
 * and one statusHistory row for a transition. Assumes checkTransition passed.
 */
export function nextState(s, ev, actor) {
  const rule = TRANSITIONS[ev.eventType];
  const to = rule ? rule.to : s.chargingStatus;
  const timeline = { ...(s.timeline ?? {}) };
  if (TIMELINE_OF[ev.eventType]) timeline[TIMELINE_OF[ev.eventType]] = ev.time;
  const next = {
    ...s,
    chargingStatus: to,
    timeline,
    energy: applyEnergy(s.energy, ev),
    _lastEventTime: ev.time,
  };
  if (!Object.keys(next.energy).length) delete next.energy;
  if (ev.eventType === 'suspended') next.suspendedBy = ev.suspendedBy;
  if (ev.eventType === 'resumed' || to !== 'suspended') delete next.suspendedBy;
  if (ev.eventType === 'chargingEnded' && ev.stopReason) next.stopReason = ev.stopReason;
  if ((ev.eventType === 'unplugged' || ev.eventType === 'fault') && s.chargingStatus === 'idle') next._idleEnd = ev.time;
  if (rule) next.statusHistory = [...(s.statusHistory ?? []), entry(to, ev.time, actor, ev.detail ?? historyDetail(next, ev))];
  return next;
}

function historyDetail(s, ev) {
  if (ev.eventType === 'chargingEnded') {
    const kwh = s.energy?.deliveredKwh;
    return [ev.stopReason, kwh !== undefined ? `${round(kwh, 2)} kWh` : null].filter(Boolean).join('; ') || undefined;
  }
  if (ev.eventType === 'suspended' && ev.suspendedBy) return `suspended by ${ev.suspendedBy}`;
  if (ev.eventType === 'fault' && ev.faultCode) return `fault ${ev.faultCode}`;
  return undefined;
}

/** §23.6: the customer-scope ChargingSession read. */
export function customerSessionView(s) {
  const { network: _n, statusHistory: _h, parkingSession: _p, space: _sp, evseId: _e, ...out } = wire(s);
  if (out.vehicle) {
    const { credentialIdentification: _c, ...vehicle } = out.vehicle;
    out.vehicle = vehicle;
  }
  if (out.authorization) {
    const { credential: _c, contractId: _k, methodDetail: _m, authorizedBy: _b, ...auth } = out.authorization;
    out.authorization = auth;
  }
  return out;
}
