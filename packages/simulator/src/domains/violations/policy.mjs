/**
 * §19.10 enforcement policy and §19.11 signage: the policy and signs in
 * force at a place, the binding checks `issue` must pass, the penalty cap
 * with the unpaid fee derived from the rate deck, and escalation arithmetic.
 *
 * Policies keep every version they have had in `_history` (version →
 * wire snapshot), so a violation keeps the terms it was issued under
 * (§19.10 rule 5) after a PUT moves the policy on.
 */
import { fail } from '../../kernel/problems.mjs';
import { parseDuration } from '../../kernel/clock.mjs';
import { wire, money } from '../common.mjs';
import { toMs, iso, fmt, round2, short, inWindow, vref } from './model.mjs';

export const policies = (sim) => sim.store.collection('enforcementPolicies');
export const signs = (sim) => sim.store.collection('signage');

/** The nearest ancestor-or-self `active` policy whose window covers `atMs` (§19.10 rule 1). */
export function policyInForce(sim, placeId, atMs) {
  for (const node of sim.hierarchy.chain(placeId)) {
    const hits = policies(sim)
      .find((p) => p.place?.id === node.id && p.policyStatus === 'active' && inWindow(p, atMs))
      .sort((a, b) => toMs(b.effectiveFrom) - toMs(a.effectiveFrom) || a.id.localeCompare(b.id));
    if (hits.length) return hits[0];
  }
  return null;
}

/** The terms of a frozen VersionedReference, as they were at that version. */
export function policyTerms(sim, ref) {
  if (!ref?.id) return null;
  const p = policies(sim).get(ref.id);
  if (!p) return null;
  return p._history?.[ref.version] ?? wire(p);
}

/** Record the current version of a policy in its own history. */
export const withHistory = (p) => ({ ...p, _history: { ...(p._history ?? {}), [p.version]: wire(p) } });

/** Every Signage in force at the place or an ancestor at `atMs` (§19.11 rules 2, 3). */
export function signageInForce(sim, placeId, atMs) {
  const chain = new Set(sim.hierarchy.chain(placeId).map((n) => n.id));
  return signs(sim)
    .find((s) => chain.has(s.place?.id) && inWindow(s, atMs) && !(s.signageStatus === 'removed' && !s.effectiveTo))
    .sort((a, b) => toMs(a.effectiveFrom) - toMs(b.effectiveFrom) || a.id.localeCompare(b.id));
}

/** §19.10 rules 3 and 6: the consistency rules a policy body must satisfy (422 request-unprocessable). */
export function validatePolicyBody(b) {
  if (b.effectiveTo && toMs(b.effectiveTo) < toMs(b.effectiveFrom)) {
    fail('request-unprocessable', `effectiveTo ${b.effectiveTo} precedes effectiveFrom ${b.effectiveFrom}.`);
  }
  const ceiling = b.overallCeiling?.maximumAmount;
  for (const step of b.escalation ?? []) {
    if (ceiling && step.addAmount && step.addAmount.currencyValue > ceiling.currencyValue) {
      fail('request-unprocessable', `escalation step ${step.step} adds ${fmt(step.addAmount.currencyValue)}, which alone exceeds overallCeiling.maximumAmount ${fmt(ceiling.currencyValue)}.`);
    }
  }
  for (const rule of b.deliveryRules ?? []) {
    if (!rule.noticeDeadline) continue;
    try {
      parseDuration(rule.noticeDeadline);
    } catch {
      fail('request-unprocessable', `deliveryRules noticeDeadline ${rule.noticeDeadline} is not a duration this server can apply (PnDTnHnM).`);
    }
  }
}

/** §19.11: signage window consistency. */
export function validateSignageBody(b) {
  if (b.effectiveTo && toMs(b.effectiveTo) < toMs(b.effectiveFrom)) {
    fail('request-unprocessable', `effectiveTo ${b.effectiveTo} precedes effectiveFrom ${b.effectiveFrom}.`);
  }
}

// ---------- the unpaid fee for the stay, from the rate deck in force ----------

function rateTableFor(sim, placeId) {
  const tables = sim.store.collection('rateTables');
  for (const node of sim.hierarchy.chain(placeId)) {
    const ids = sim.world.placeRates?.[node.id];
    if (ids?.length) return ids.map((id) => tables.get(id)).find(Boolean) ?? null;
  }
  return null;
}

const lineText = (line) => (Array.isArray(line.description) ? line.description.map((d) => d.string).join(' ') : String(line.description ?? ''));

/**
 * The unpaid parking fee for the stay: the deck's `unpaidStayFee` line when
 * it has one, else the hourly line over the time since the last valid
 * session ended. Null when no deck applies.
 */
export function unpaidFee(sim, v) {
  const table = rateTableFor(sim, v.place.id);
  const coll = table?.rateLineCollections?.[0];
  if (!coll) return null;
  const currency = coll.applicableCurrency ?? 'USD';
  const flat = coll.rateLines.find((l) => /unpaid/i.test(lineText(l)));
  if (flat) return { amount: money(flat.value, currency), table };
  const hourly = coll.rateLines.find((l) => /incrementing/i.test(l.rateLineType ?? ''));
  if (!hourly) return null;
  const session = v.relatedSession ? sim.store.collection('sessions').get(v.relatedSession.id) : null;
  const since = toMs(session?._validTo ?? session?.actualEnd) ?? toMs(v.detection.detectedTime);
  const hours = Math.max(1, Math.ceil((toMs(v.detection.detectedTime) - since) / 3_600_000));
  return { amount: money(hours * hourly.value, currency), table };
}

// ---------- the issue checks (§19.10 rule 2) ----------

/**
 * Apply the policy in force to an `issue` request. Throws the §19.10
 * refusals; returns what is frozen onto the violation.
 */
export function applyIssuePolicy(sim, v, body, nowMs) {
  const detectedMs = toMs(v.detection.detectedTime);
  const policy = policyInForce(sim, v.place.id, detectedMs);
  const inForceSigns = signageInForce(sim, v.place.id, detectedMs);
  const requested = body.amount;
  if (!policy) return { policy: null, signage: inForceSigns, amount: requested, requested, clamped: false };
  const label = `Policy ${policy.id} v${policy.version}`;
  checkDelivery(v, body, policy, label, nowMs);
  const cap = capFor(sim, v, policy, requested);
  let amount = requested;
  let clamped = false;
  if (cap && requested.currencyValue > cap.amount.currencyValue) {
    if (policy.penaltyCap.onExceed !== 'clamp') {
      fail('penalty-exceeds-cap', `Amount ${fmt(requested.currencyValue)} exceeds ${cap.describe} (onExceed: ${policy.penaltyCap.onExceed ?? 'refuse'}).`);
    }
    amount = money(cap.amount.currencyValue, requested.currencyType);
    clamped = true;
  }
  if (policy.signageRequired && !inForceSigns.length) {
    fail('signage-required', `${label} requires posted signage; no Signage was in force at ${v.place.id} or an ancestor at ${v.detection.detectedTime}.`);
  }
  return { policy, signage: inForceSigns, amount, requested, clamped, cap, label };
}

function checkDelivery(v, body, policy, label, nowMs) {
  const rules = policy.deliveryRules ?? [];
  if (!rules.length) return;
  const mode = v.detection.mode;
  const forMode = rules.filter((r) => r.detectionModes.includes(mode));
  const allowed = [...new Set(forMode.flatMap((r) => r.deliveryMethods))];
  const method = body.deliveryMethod;
  const rule = method ? forMode.find((r) => r.deliveryMethods.includes(method)) : forMode[0];
  if (!rule) {
    fail('delivery-method-not-permitted', `${label}: detection mode ${mode} permits deliveryMethod ${allowed.length ? allowed.join(', ') : '(none)'}; not ${method ?? '(unspecified)'}.`);
  }
  if (rule.noticeDeadline) {
    const deadline = toMs(v.detection.detectedTime) + parseDuration(rule.noticeDeadline);
    if (nowMs > deadline) {
      fail('notice-deadline-passed', `Detected ${v.detection.detectedTime} (${v.violationType}); ${label.replace('Policy', 'policy')} allows ${method ?? 'notice'} within ${rule.noticeDeadline}, which elapsed ${iso(deadline)}.`);
    }
  }
  const min = rule.minimumEvidence;
  if (!min) return;
  const missing = [];
  const obs = v.observations?.length ?? 0;
  const images = v.evidence?.length ?? 0;
  if (min.observations && obs < min.observations) missing.push(`${min.observations} observation(s) (has ${obs})`);
  if (min.images && images < min.images) missing.push(`${min.images} evidence image(s) (has ${images})`);
  if (min.locationRequired && !v.location?.observedLocation) missing.push('location.observedLocation');
  if (missing.length) {
    fail('delivery-method-not-permitted', `${label} requires ${missing.join(', ')} for ${method ?? 'notices'} on ${mode} detections; violation ${v.id} (${v.violationType}) has none.`);
  }
}

/** The lowest penaltyCap bound, with the unpaid fee where a relative bound needs it. */
function capFor(sim, v, policy, requested) {
  const pc = policy.penaltyCap;
  if (!pc) return null;
  const bounds = [];
  if (pc.maximumAmount) bounds.push({ value: pc.maximumAmount.currencyValue, describe: `the ${short(policy.id)} v${policy.version} maximum ${fmt(pc.maximumAmount.currencyValue)}` });
  let unpaid = null;
  if (pc.maximumMultipleOfUnpaid !== undefined || pc.maximumPercentOverUnpaid !== undefined) {
    unpaid = unpaidFee(sim, v);
    if (unpaid) {
      const u = unpaid.amount.currencyValue;
      if (pc.maximumMultipleOfUnpaid !== undefined) bounds.push({ value: round2(u * pc.maximumMultipleOfUnpaid), describe: `the policy cap of ${pc.maximumMultipleOfUnpaid}× the unpaid fee ${fmt(u)} = ${fmt(u * pc.maximumMultipleOfUnpaid)}` });
      if (pc.maximumPercentOverUnpaid !== undefined) bounds.push({ value: round2(u * (1 + pc.maximumPercentOverUnpaid / 100)), describe: `the policy cap of ${pc.maximumPercentOverUnpaid}% over the unpaid fee ${fmt(u)}` });
    }
  }
  if (!bounds.length) return null;
  const lowest = bounds.sort((a, b) => a.value - b.value)[0];
  return { amount: money(lowest.value, requested.currencyType), describe: lowest.describe, unpaid: unpaid?.amount ?? null };
}

/** What `issue` freezes onto the violation from the policy result. */
export function frozenTerms(result) {
  return {
    ...(result.policy ? { policy: vref(result.policy, 'EnforcementPolicy') } : {}),
    signage: result.signage.map((s) => vref(s, 'Signage')),
    ...(result.cap?.unpaid ? { unpaidAmount: result.cap.unpaid } : {}),
    ...(result.cap ? { capAmount: result.cap.amount } : {}),
  };
}

// ---------- escalation arithmetic (§19.10 rule 3) ----------

/** The ceiling of a violation under its frozen terms, or null. */
export function ceilingOf(terms, v) {
  const c = terms?.overallCeiling;
  if (!c) return null;
  const issued = v.amountHistory?.[0]?.amount?.currencyValue ?? v.amount?.currencyValue;
  const values = [];
  if (c.maximumAmount) values.push(c.maximumAmount.currencyValue);
  if (c.maximumMultipleOfIssued !== undefined && issued !== undefined) values.push(round2(issued * c.maximumMultipleOfIssued));
  return values.length ? Math.min(...values) : null;
}

/** The amount after one escalation step, clamped to the ceiling. */
export function escalate(terms, v, step) {
  const current = v.amount.currencyValue;
  let next = current + (step.addAmount?.currencyValue ?? 0) + (step.addPercent ? (current * step.addPercent) / 100 : 0);
  const ceiling = ceilingOf(terms, v);
  if (ceiling !== null) next = Math.min(next, ceiling);
  return { value: round2(Math.max(next, current)), ceiling };
}
