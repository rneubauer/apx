/**
 * Seeding the apx-violations cast and the injectors that let a scenario
 * make the world act.
 *
 * World sections read: enforcement{} (config), violations[],
 * enforcementPolicies[], signage[], and — defensively, because other
 * modules seed them too — assignedRights[], sessions[], observations[],
 * contacts[], payments[], rateTables[].
 */
import { entry, wire, refOf } from '../common.mjs';
import { policies, signs, withHistory } from './policy.mjs';
import { violations, publish, armEscalation, armClosure, fireStep } from './timers.mjs';
import { createViolation } from './lifecycle.mjs';
import { TOPIC } from './model.mjs';

const SHARED = ['assignedRights', 'sessions', 'observations', 'contacts', 'payments', 'rateTables'];

export function seedViolations(sim, world) {
  for (const name of SHARED) {
    const coll = sim.store.collection(name);
    for (const row of world[name] ?? []) {
      if (coll.has(row.id)) continue;
      coll.put({ ...row, _place: row._place ?? row.hierarchyElement?.id ?? row.place?.id });
    }
  }
  for (const p of world.enforcementPolicies ?? []) policies(sim).put(withHistory({ ...p, _place: p.place.id, _seeded: true }));
  for (const s of world.signage ?? []) signs(sim).put({ ...s, _place: s.place.id });
  for (const v of world.violations ?? []) violations(sim).put(seedState(v));
  for (const v of violations(sim).all()) {
    if (v.violationStatus === 'issued') armEscalation(sim, v.id);
    if (v.violationStatus === 'paid' && v._reconcile) armClosure(sim, v.id);
  }
}

/**
 * The internal clocks of a seeded violation: an `issued` one has been
 * accruing escalation time since its last `issued` entry; a `paid` one
 * records when it was paid. Seeded `paid` rows are reconciled only when
 * they say so (`_reconcile: true`), so a world can hold paid notices that
 * a later scenario still appeals.
 */
function seedState(v) {
  const last = (state) => [...(v.statusHistory ?? [])].reverse().find((e) => e.state === state)?.time;
  const fired = (v.amountHistory ?? []).filter((a) => a.reason === 'escalation').map((a) => a.step);
  const out = { ...v, _place: v.place.id };
  if (v.violationStatus === 'issued') out._esc = { activeMs: 0, since: v.notice?.issuedTime ?? last('issued'), fired };
  if (v.violationStatus === 'paid') out._paidSince = last('paid');
  return out;
}

export function registerInjectors(sim) {
  /** An LPR read that the pipeline turns into an automated detection, eligibility evaluated. */
  sim.injector('lprDetection', ({ place, plate, time, device, violationType = 'noValidRight', confidence = 0.95, observation, imageLink, rule, credentialType = 'licensePlate', principal = 'lpr-pipeline' }) => {
    if (!sim.hierarchy.has(place)) throw new Error(`no place ${place}`);
    if (!plate) throw new Error('plate is required');
    const detectedTime = time ?? sim.clock.now();
    const obsId = observation ?? null;
    if (obsId && !sim.store.collection('observations').has(obsId)) {
      sim.store.collection('observations').put({ id: obsId, version: 1, _place: place, _plate: plate, _credentialType: credentialType, _time: detectedTime, _confidence: confidence, ...(imageLink ? { _imageLink: imageLink } : {}), ...(device ? { _device: device } : {}) });
    }
    const body = {
      violationType,
      place: refOf(place, 'Place'),
      detection: { mode: 'automated', detectedTime, ...(device ? { detector: refOf(device, 'SupplementalEquipment') } : {}), principal, confidence, ...(rule ? { rule } : {}) },
      vehicle: { credentialType, credentialIdentification: plate },
      ...(obsId ? { observations: [refOf(obsId, 'Observation')] } : {}),
      ...(imageLink || !obsId ? { evidence: [{ imageLink: imageLink ?? `${sim.world.host}/lpr/${encodeURIComponent(plate)}-${Date.parse(detectedTime)}.jpg`, imageType: 'plate', capturedTime: detectedTime }] } : {}),
    };
    const rec = createViolation(sim, { body, principal: null, actor: principal, placeId: place, recordActor: { org: sim.world.organisation } });
    return wire(violations(sim).get(rec.id));
  });

  /** Apply the next escalation step of an `issued` violation now, as the scheduler would when it falls due. */
  sim.injector('escalate', ({ violation, step }) => {
    const v = violations(sim).get(violation);
    if (!v) throw new Error(`no violation ${violation}`);
    if (v.violationStatus !== 'issued') throw new Error(`violation ${violation} is ${v.violationStatus}; escalation applies only while issued`);
    const out = fireStep(sim, violation, step, null, { force: true });
    if (!out) throw new Error(`no ${step ? `step ${step}` : 'further escalation step'} left under policy ${v.policy?.id ?? '(none)'}`);
    return wire(out);
  });

  /** The postal outcome of a mailed notice: delivered, refused, or returned undeliverable. */
  sim.injector('mailNotice', ({ violation, outcome = 'delivered', detail }) => {
    const v = violations(sim).get(violation);
    if (!v) throw new Error(`no violation ${violation}`);
    if (v.notice?.deliveryMethod !== 'mail') throw new Error(`violation ${violation} has no mailed notice`);
    if (!['delivered', 'refused', 'returned'].includes(outcome)) throw new Error('outcome must be delivered, refused or returned');
    const now = sim.clock.now();
    const note = `mail ${outcome}${detail ? `: ${detail}` : ''} (notice ${v.notice.noticeNumber})`;
    const next = violations(sim).update(violation, (x) => ({
      ...x,
      statusHistory: [...x.statusHistory, entry(x.violationStatus, now, 'postal-service', note)],
      _mail: { outcome, time: now },
    }));
    publish(sim, TOPIC.status, next);
    return wire(next);
  });
}
