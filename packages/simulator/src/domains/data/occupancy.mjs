/**
 * Part 5 §5.5: the occupancy snapshot, a read-model derived from the Place
 * hierarchy's APDS `Supply` and latest `DemandType`, and the
 * `apx.data.occupancy.v1` event on material changes (a threshold crossing,
 * a large count delta, or the facility filling or emptying its last space).
 */
import { CLASSES, classNameOfType, plain } from './model.mjs';

const DEFAULT_THRESHOLDS = [85, 90, 95, 100];
const DEFAULT_DELTA = 25;
const DEMAND_HISTORY = 10;

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

  /** Called on every Place write: publish apx.data.occupancy.v1 when the change is material. */
  function onPlaceChanged({ record, previous, deleted }) {
    if (deleted) return;
    const after = snapshot(record);
    const before = previous ? snapshot(previous) : null;
    if (!material(before, after)) return;
    sim.events.publish({ type: 'apx.data.occupancy.v1', data: after, subject: after.place, place: record.id });
    sim.hooks.emit('occupancy.changed', { place: record.id, snapshot: after, previous: before });
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

  return { snapshot, onPlaceChanged, recordDemand };
}
