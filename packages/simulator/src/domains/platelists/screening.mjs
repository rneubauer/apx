/**
 * Part 24 §24.4 (informative) and Part 7 §7.6: an LPR read at a place
 * where an active `watch` or `scofflaw` list has `alertOnArrival` raises
 * the category's arrival alert, with the PlateListEntry as `relatedEntity`
 * and the read as evidence (`apds-ext:apx:alert-evidence@1.0`).
 *
 * Only the alert is wired. Refusing service at a lane, allow-list
 * eligibility and the matching policy (exact, alias, fold) stay with the
 * implementation and its operator (§24.4); this simulator matches the
 * plate exactly after removing spaces and punctuation, and does not
 * withhold a vend.
 */
import { mls, refOf, shortId } from '../common.mjs';

const ARRIVAL_ALERTS = {
  watch: { alertType: 'watchListArrival', severity: 'warning' },
  scofflaw: { alertType: 'scofflawArrival', severity: 'major' },
};

export const plateKey = (value) => String(value ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

/** Whether an entry's validity contains the instant (absent bounds are open, §24.2 rule 1). */
export function inForce(entry, ms) {
  const start = entry.validity?.start ? Date.parse(entry.validity.start) : -Infinity;
  const end = entry.validity?.end ? Date.parse(entry.validity.end) : Infinity;
  return ms >= start && ms < end;
}

export function registerScreening(sim, { lists, entries }) {
  const appliesAt = (list, place, flag) => list.status === 'active' && (list.places ?? []).some((p) => p[flag] && p.place?.id && (p.place.id === place || sim.hierarchy.within(place, p.place.id)));

  sim.hooks.on('lpr.read', ({ observation, place }) => {
    if (!sim.alerts || !observation?.observedCredentialId || !place) return;
    const key = plateKey(observation.observedCredentialId);
    const at = Date.parse(observation.observationStartTime ?? observation.creationDateTime ?? '') || sim.clock.nowMs();
    for (const list of lists().all()) {
      const raises = ARRIVAL_ALERTS[list.category];
      if (!raises || !appliesAt(list, place, 'alertOnArrival')) continue;
      const hit = entries().first((e) => e._list === list.id && e._key === key && inForce(e, at));
      if (!hit) continue;
      sim.alerts.raise(
        {
          alertType: raises.alertType,
          severity: raises.severity,
          source: { place },
          relatedEntity: refOf(hit.id, 'PlateListEntry'),
          occurrenceTime: new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          detectionTime: sim.clock.now(),
          description: mls(`A plate on "${list.name}" (${list.category}) was read at ${sim.hierarchy.get(place)?.name ?? shortId(place)}.`),
          extensions: { 'apds-ext:apx:alert-evidence@1.0': { observations: [refOf(observation.id, 'Observation')] } },
        },
        sim.world.actors?.parcs ?? 'lpr',
        `plate list ${list.id} entry ${hit.id}`
      );
    }
  });
}
