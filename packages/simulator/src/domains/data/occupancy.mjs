/**
 * Part 5 §5.5: the occupancy snapshot, a read-model derived from the Place
 * hierarchy's APDS `Supply` and latest `DemandType`, and the
 * `apx.data.occupancy.v1` event on material changes (a threshold crossing,
 * a large count delta, or the facility filling or emptying its last space).
 * An upward threshold crossing also raises `occupancyThresholdExceeded`
 * through the alerts module's `occupancy.threshold` hook (§5.5 SHOULD).
 *
 * §5.5a: the occupancy history. The Place keeps its last DEMAND_HISTORY
 * DemandTable entries (the Place document stays small); every demand record
 * the server has seen is also kept per element, bounded at HISTORY_CAP
 * (seven days of five-minute sampling), and the buckets are computed from
 * those records: a bucket with no record carries no counts.
 */
import { CLASSES, classNameOfType, plain } from './model.mjs';
import { parseDuration } from '../../kernel/clock.mjs';
import { fail } from '../../kernel/problems.mjs';

const DEFAULT_THRESHOLDS = [85, 90, 95, 100];
const DEFAULT_DELTA = 25;
const DEMAND_HISTORY = 10;
/** Demand records kept per element for §5.5a: seven days at five-minute sampling. */
export const HISTORY_CAP = 7 * 24 * 12;
/** The shortest bucket served (the simulator samples no finer than a minute); shorter is 400. */
const MIN_INTERVAL_MS = 60_000;
/** The most buckets one history page carries; a wider window is 400. */
const MAX_BUCKETS = 2000;

export function createOccupancy(sim, engine) {
  const settings = () => ({ thresholds: DEFAULT_THRESHOLDS, delta: DEFAULT_DELTA, ...(sim.world.occupancy ?? {}) });

  function latestDemand(record) {
    let best = null;
    for (const table of record?.hierarchyElementReference?.demandTable ?? []) {
      for (const d of table.demandType ?? []) if (!best || (d.recordDateTime ?? '') >= (best.recordDateTime ?? '')) best = d;
    }
    return best;
  }

  const supplyOf = (record) => record?.hierarchyElementReference?.supply?.[0] ?? null;

  /** The OccupancySnapshot of a stored Place record: fields it does not know are absent, never guessed. */
  function snapshot(record) {
    const supply = supplyOf(record);
    const demand = latestDemand(record);
    const known = Number.isInteger(supply?.supplyQuantity) && Number.isInteger(demand?.count);
    return {
      place: { id: record.id, className: classNameOfType(record.type) },
      computedAt: sim.clock.now(),
      ...(supply ? { supply } : {}),
      ...(demand ? { demand } : {}),
      available: known ? Math.max(0, supply.supplyQuantity - demand.count) : null,
    };
  }

  const percentOf = (s) => s.demand?.percentage ?? (s.supply?.supplyQuantity && Number.isInteger(s.demand?.count) ? (100 * s.demand.count) / s.supply.supplyQuantity : null);

  function material(before, after) {
    if (!after.demand) return false;
    if (!before?.demand) return true;
    if (before.demand.recordDateTime === after.demand.recordDateTime && before.demand.count === after.demand.count) return false;
    const { thresholds, delta } = settings();
    const a = percentOf(before);
    const b = percentOf(after);
    if (a !== null && b !== null && thresholds.some((t) => a < t !== b < t)) return true;
    if (Math.abs((after.demand.count ?? 0) - (before.demand.count ?? 0)) >= delta) return true;
    return (before.available === 0) !== (after.available === 0);
  }

  /** The highest configured threshold crossed upward between two snapshots, else null. */
  function crossedUp(before, after) {
    const a = before ? percentOf(before) : null;
    const b = percentOf(after);
    if (a === null || b === null) return null;
    const crossed = settings().thresholds.filter((t) => a < t && b >= t);
    return crossed.length ? Math.max(...crossed) : null;
  }

  /** Called on every Place write: log its demand records, publish apx.data.occupancy.v1 when the change is material. */
  function onPlaceChanged({ record, previous, deleted }) {
    if (deleted) return;
    remember(record);
    const after = snapshot(record);
    const before = previous ? snapshot(previous) : null;
    if (!material(before, after)) return;
    sim.events.publish({ type: 'apx.data.occupancy.v1', data: after, subject: after.place, place: record.id });
    sim.hooks.emit('occupancy.changed', { place: record.id, snapshot: after, previous: before });
    const threshold = crossedUp(before, after);
    if (threshold !== null) sim.hooks.emit('occupancy.threshold', { place: record.id, occupancy: percentOf(after), threshold, direction: 'above' });
  }

  // ---------- §5.5a history ----------

  const logs = new Map(); // element id -> [{ at (ms), count, supply? }], time-ordered, bounded

  const reset = () => logs.clear();

  /** The demand records a Place document carries, as log rows. */
  function rowsOf(record) {
    const supply = supplyOf(record)?.supplyQuantity;
    const rows = [];
    for (const table of record?.hierarchyElementReference?.demandTable ?? []) {
      for (const d of table.demandType ?? []) {
        const at = Date.parse(d.recordDateTime ?? table.timestamp ?? '');
        if (Number.isFinite(at) && Number.isInteger(d.count)) rows.push({ at, count: d.count, ...(Number.isInteger(supply) ? { supply } : {}) });
      }
    }
    return rows;
  }

  /** Merge rows into a time-ordered list, one per instant (the later write wins), keeping the newest HISTORY_CAP. */
  function merged(base, rows) {
    const byAt = new Map(base.map((r) => [r.at, r]));
    for (const r of rows) byAt.set(r.at, r);
    return [...byAt.values()].sort((x, y) => x.at - y.at).slice(-HISTORY_CAP);
  }

  function remember(record) {
    const rows = rowsOf(record);
    if (rows.length) logs.set(record.id, merged(logs.get(record.id) ?? [], rows));
  }

  /** The place's UTC offset at an instant, in ms (0 for an unknown zone). */
  function zoneOffsetMs(timeZone, ms) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
    } catch {
      return 0;
    }
  }

  /** Bucket starts align to interval boundaries in the place's time zone. */
  const alignDown = (ms, step, timeZone) => {
    const off = zoneOffsetMs(timeZone, ms);
    return Math.floor((ms + off) / step) * step - off;
  };

  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

  /** One bucket [start, end): max and time-weighted mean of the records inside it; no counts when it holds none. */
  function bucket(rows, start, end, nowMs, fallbackSupply) {
    const inside = rows.filter((r) => r.at >= start && r.at < end);
    if (!inside.length) return { start: iso(start) };
    const carried = rows.filter((r) => r.at < start).at(-1);
    const begin = carried ? start : inside[0].at;
    const stop = Math.min(end, Math.max(nowMs, inside.at(-1).at));
    let from = begin;
    let level = carried ? carried.count : inside[0].count;
    let area = 0;
    for (const r of inside) {
      area += level * (r.at - from);
      from = r.at;
      level = r.count;
    }
    area += level * Math.max(0, stop - from);
    const span = stop - begin;
    const avg = span > 0 ? area / span : inside.at(-1).count;
    const supply = inside.at(-1).supply ?? fallbackSupply;
    return {
      start: iso(start),
      maxCount: Math.max(...inside.map((r) => r.count)),
      avgCount: Number(avg.toFixed(2)),
      ...(Number.isInteger(supply) ? { supplyQuantity: supply } : {}),
      samples: inside.length,
    };
  }

  /** GET /v1/places/{id}/occupancy/history: an OccupancyHistoryPage, or a problem. */
  function history(record, { from, to, interval = 'PT1H' }) {
    const bad = (pointer, detail) => fail('invalid-request', detail, { errors: [{ pointer, detail }] });
    const fromMs = Date.parse(from ?? '');
    const toMs = Date.parse(to ?? '');
    if (!Number.isFinite(fromMs)) bad('/query/from', 'from is a required RFC 3339 date-time');
    if (!Number.isFinite(toMs)) bad('/query/to', 'to is a required RFC 3339 date-time');
    if (!(toMs > fromMs)) bad('/query/to', 'to must be later than from');
    let step = NaN;
    try {
      if (typeof interval === 'string' && interval.startsWith('P')) step = parseDuration(interval);
    } catch {
      step = NaN;
    }
    if (!(step > 0)) bad('/query/interval', 'interval is an ISO 8601 duration such as PT1H');
    if (step < MIN_INTERVAL_MS) bad('/query/interval', 'interval is shorter than the sampling this server keeps (PT1M)');
    const rows = merged(logs.get(record.id) ?? [], rowsOf(record));
    if (!rows.length) fail('target-not-found', `This server holds no occupancy for element ${record.id}.`);
    const first = alignDown(fromMs, step, record.timeZone ?? 'UTC');
    if (Math.ceil((toMs - first) / step) > MAX_BUCKETS) bad('/query/interval', `the window spans more than ${MAX_BUCKETS} buckets; widen the interval or narrow from/to`);
    const nowMs = sim.clock.nowMs();
    const fallbackSupply = supplyOf(record)?.supplyQuantity;
    const buckets = [];
    for (let s = first; s < toMs; s += step) buckets.push(bucket(rows, s, s + step, nowMs, fallbackSupply));
    return { place: { id: record.id, className: classNameOfType(record.type) }, interval, from: iso(fromMs), to: iso(toMs), buckets };
  }

  /** Record a demand reading on an element (a counting system reporting): a Place write like any other. */
  function recordDemand(placeId, { count, percentage, occupancyCalculation = 'counted', recordDateTime, frequency }) {
    const current = engine.coll('places').get(placeId);
    if (!current) throw new Error(`no place ${placeId}`);
    if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer');
    const time = recordDateTime ?? sim.clock.now();
    const supply = supplyOf(current);
    const pct = percentage ?? (supply?.supplyQuantity ? Math.min(100, Number(((100 * count) / supply.supplyQuantity).toFixed(1))) : undefined);
    const ref = current.hierarchyElementReference ?? { elementId: { id: current.id, version: current.version, className: classNameOfType(current.type) } };
    const table = { timestamp: time, ...(frequency ? { frequency } : {}), demandType: [{ count, ...(pct !== undefined ? { percentage: pct } : {}), occupancyCalculation, recordDateTime: time }] };
    const next = { ...plain(current), hierarchyElementReference: { ...ref, demandTable: [...(ref.demandTable ?? []), table].slice(-DEMAND_HISTORY) } };
    return engine.replace(CLASSES.places, placeId, next, {});
  }

  return { snapshot, onPlaceChanged, recordDemand, history, reset };
}
