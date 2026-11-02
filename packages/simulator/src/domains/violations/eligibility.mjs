/**
 * The §19.3 eligibility check, composed from the APDS entities the server
 * holds in the shared collections: `assignedRights` (permits,
 * reservations), `sessions` (pay-by-plate and gated stays) and
 * `observations` (the last plate read).
 *
 * Seeded rows carry APDS members plus `_` hints the check reads:
 *   assignedRights: rightHolder.credentials[] (APDS), _place, _rightType,
 *                   _validFrom, _validTo (else expiry), _status (suspended|consumed)
 *   sessions:       identifiedCredentials[] (APDS) or _plate, _place
 *                   (else hierarchyElement), _rightType, actualStart/actualEnd
 *   observations:   _plate, _credentialType, _place, _time, _confidence, _imageLink
 */
import { refOf } from '../common.mjs';
import { toMs, iso, sameCredential, fromAssigned, DAY_MS } from './model.mjs';
import { policyInForce } from './policy.mjs';

const STATUS_TO_TYPE = {
  expired: 'expiredRight',
  notYetValid: 'notYetValidRight',
  wrongPlace: 'wrongPlace',
  suspended: 'permitMisuse',
  consumed: 'expiredRight',
};
const PRIORITY = ['expired', 'notYetValid', 'suspended', 'consumed', 'wrongPlace'];

/**
 * Evaluate whether `credential` is entitled at `placeId` at `atMs`.
 * `principal` trims the basis to what the token could read (§19.3 rule 3);
 * null means a server-internal evaluation (an injected detection).
 */
export function evaluateEligibility(sim, { credential, placeId, atMs, principal }) {
  const h = sim.hierarchy;
  const readable = (place) => !principal || !place || (principal.hasGrant && h.covers(principal.places, place));
  const covers = (bound) => Boolean(bound) && h.within(placeId, bound);
  const statusOf = (bound, from, to, flag) => {
    if (flag === 'suspended' || flag === 'consumed') return flag;
    if (!covers(bound)) return 'wrongPlace';
    if (from !== undefined && atMs < from) return 'notYetValid';
    if (to !== undefined && atMs > to) return 'expired';
    return 'valid';
  };

  const basis = [];
  for (const r of sim.store.collection('assignedRights').all()) {
    const creds = r._credentials ?? fromAssigned(r.rightHolder?.credentials);
    if (!creds.some((c) => sameCredential(c, credential))) continue;
    if (!readable(r._place)) continue;
    const from = toMs(r._validFrom);
    const to = toMs(r._validTo ?? r.expiry);
    basis.push({
      right: refOf(r.id, 'AssignedRight'),
      ...(r._rightType ? { rightType: r._rightType } : {}),
      ...(from !== undefined ? { validFrom: iso(from) } : {}),
      ...(to !== undefined ? { validTo: iso(to) } : {}),
      status: statusOf(r._place, from, to, r._status),
    });
  }
  for (const s of sim.store.collection('sessions').all()) {
    const creds = s._credentials ?? (s._plate ? [{ credentialType: 'licensePlate', credentialIdentification: s._plate }] : fromAssigned(s.identifiedCredentials));
    if (!creds.some((c) => sameCredential(c, credential))) continue;
    const place = s._place ?? s.hierarchyElement?.id;
    if (!readable(place)) continue;
    const from = toMs(s._validFrom ?? s.actualStart);
    const to = toMs(s._validTo ?? s.actualEnd);
    // §19.3 rule 4: the sessions as they were at `at` — none that had not begun, none long gone.
    if (from !== undefined && from > atMs) continue;
    if (to !== undefined && to < atMs - DAY_MS) continue;
    basis.push({
      session: refOf(s.id, 'Session'),
      rightType: s._rightType ?? 'session',
      ...(from !== undefined ? { validFrom: iso(from) } : {}),
      ...(to !== undefined ? { validTo: iso(to) } : {}),
      status: statusOf(place, from, to, s._status),
    });
  }

  const entitled = basis.some((b) => b.status === 'valid');
  const out = {
    place: refOf(placeId, 'Place'),
    credential: { credentialType: credential.credentialType, credentialIdentification: credential.credentialIdentification },
    checkedTime: iso(atMs),
    entitled,
    basis,
  };
  if (!entitled) {
    const best = PRIORITY.map((st) => basis.find((b) => b.status === st)).find(Boolean);
    out.suggestedViolationType = best ? STATUS_TO_TYPE[best.status] : 'noValidRight';
  }
  const reads = readsOf(sim, { credential, placeId, atMs, readable });
  const grace = entitled ? null : graceUntil(sim, { placeId, atMs, basis, reads });
  if (grace) out.graceUntil = grace;
  const read = lastRead(reads);
  if (read) out.lastRead = read;
  return out;
}

/**
 * §19.3 rule 5: `graceUntil` from the `stayGrace` of the policy in force
 * at the place at `atMs` (§19.10 rule 7). Called only when no right
 * covers the stay now. Exit side: the stay has outlived its rights (one
 * ended within the last day), so the end of the last of them plus
 * `exitMinutes`. Entry side: nothing has covered the stay, so its start
 * (the earliest read of the credential there within the last day) plus
 * `entryMinutes`. Null when that side has no grace or no policy is in
 * force. How a stay inside or past the grace is scored is not APX's rule.
 */
function graceUntil(sim, { placeId, atMs, basis, reads }) {
  const grace = policyInForce(sim, placeId, atMs)?.stayGrace;
  if (!grace) return null;
  const ended = basis
    .filter((b) => b.status === 'expired' && b.validTo && atMs - toMs(b.validTo) <= DAY_MS)
    .map((b) => toMs(b.validTo));
  if (ended.length) return grace.exitMinutes === undefined ? null : iso(Math.max(...ended) + grace.exitMinutes * 60_000);
  const start = reads.map((o) => toMs(o._time)).filter((t) => atMs - t <= DAY_MS).at(-1);
  if (start === undefined || grace.entryMinutes === undefined) return null;
  return iso(start + grace.entryMinutes * 60_000);
}

/** The plate reads of the credential at the place (its subtree or ancestors) no later than `atMs`, newest first. */
function readsOf(sim, { credential, placeId, atMs, readable }) {
  const h = sim.hierarchy;
  return sim.store
    .collection('observations')
    .find((o) => {
      if (!o._plate || !o._place || !o._time) return false;
      if (!sameCredential({ credentialType: o._credentialType ?? 'licensePlate', credentialIdentification: o._plate }, credential)) return false;
      if (toMs(o._time) > atMs) return false;
      if (!h.within(o._place, placeId) && !h.within(placeId, o._place)) return false;
      return readable(o._place);
    })
    .sort((a, b) => toMs(b._time) - toMs(a._time));
}

/** The latest of those reads, as EligibilityResult.lastRead. */
function lastRead(reads) {
  const o = reads[0];
  if (!o) return null;
  return {
    observation: refOf(o.id, 'Observation'),
    observationDateTime: o._time,
    ...(o._confidence !== undefined ? { confidence: o._confidence } : {}),
    ...(o._imageLink ? { imageLink: o._imageLink } : {}),
  };
}

/** The basis entry a detection most plausibly concerns, for relatedSession / relatedRight. */
export function relatedOf(check) {
  const pick = check.basis.find((b) => b.status === 'valid') ?? PRIORITY.map((st) => check.basis.find((b) => b.status === st)).find(Boolean);
  if (!pick) return {};
  return pick.session ? { relatedSession: pick.session } : { relatedRight: pick.right };
}
