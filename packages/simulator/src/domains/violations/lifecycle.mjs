/**
 * The Violation resource and its §19.1 lifecycle: detection (with the
 * eligibility check recorded), review, issue under the policy in force,
 * payment, the one appeal, void, and the reads.
 */
import { fail } from '../../kernel/problems.mjs';
import { entry, getVisible, paginate, wire, money } from '../common.mjs';
import { evaluateEligibility, relatedOf } from './eligibility.mjs';
import { applyIssuePolicy, frozenTerms, policyTerms, policyInForce } from './policy.mjs';
import { violations, publish, pauseEsc, resumeEsc, armEscalation, armClosure } from './timers.mjs';
import { checkIssuanceEvidence, sourceOf } from './evidence.mjs';
import { config, isKnownType, toMs, iso, fmt, round2, short, actorOf, transitionIllegal, invalid, bodyPlace, queryPlace, TERMINAL, ENTITLEMENT_TYPES, TOPIC, DAY_MS } from './model.mjs';

const READ_ONLY = ['id', 'version', 'violationStatus', 'payments', 'amountPaid', 'eligibilityCheck', 'policy', 'signage', 'amountHistory', 'notice', 'appeal', 'statusHistory', 'unpaidAmount', 'capAmount', 'amount', 'dueTime', 'payment', 'recordInfo', 'relatedSession', 'relatedRight'];

/** §19.9 rule 1: GeoJSON positions are [longitude, latitude]. */
function checkLocation(sim, location) {
  const area = config(sim).serviceArea;
  for (const key of ['observedLocation', 'observerLocation']) {
    const point = location?.[key];
    if (point?.type !== 'Point' || !Array.isArray(point.coordinates)) continue;
    const [lon, lat] = point.coordinates;
    const pointer = `/location/${key}/coordinates`;
    const refuse = (detail) => fail('invalid-request', detail, { errors: [{ pointer, detail }] });
    if (typeof lon !== 'number' || typeof lat !== 'number') refuse(`location.${key}.coordinates must be [longitude, latitude] numbers.`);
    if (lon < -180 || lon > 180) refuse(`location.${key}.coordinates[0] = ${lon} is outside -180..180; GeoJSON positions are [longitude, latitude] (Part 19 §19.9).`);
    if (lat < -90 || lat > 90) refuse(`location.${key}.coordinates[1] = ${lat} is outside -90..90; GeoJSON positions are [longitude, latitude] (Part 19 §19.9).`);
    const inside = (x, y) => area && x >= area.minLon && x <= area.maxLon && y >= area.minLat && y <= area.maxLat;
    if (area && !inside(lon, lat) && inside(lat, lon)) {
      refuse(`location.${key}.coordinates [${lon}, ${lat}] lies outside the operator's service area and inside it when swapped: the position was sent latitude first; GeoJSON positions are [longitude, latitude] (Part 19 §19.9).`);
    }
  }
}

/** Record a detection (POST /v1/violations, or the lprDetection injector). */
export function createViolation(sim, { body, principal, actor, assignedId, recordActor, placeId }) {
  const now = sim.clock.now();
  const detectedMs = toMs(body.detection.detectedTime);
  const vehicle = body.vehicle ?? { credentialType: 'licensePlate', credentialIdentification: '(unknown)' };
  const check = evaluateEligibility(sim, { credential: vehicle, placeId, atMs: detectedMs, principal });
  const fields = Object.fromEntries(Object.entries(body).filter(([k]) => !READ_ONLY.includes(k)));
  const detActor = body.detection.principal ?? actor;
  const detDetail = body.detection.rule && check.graceUntil && toMs(check.graceUntil) < detectedMs ? `rule ${body.detection.rule}; grace to ${check.graceUntil.slice(11, 16)} elapsed` : undefined;
  let rec = violations(sim).insert(
    {
      ...fields,
      violationStatus: 'detected',
      eligibilityCheck: check,
      ...relatedOf(check),
      statusHistory: [entry('detected', now, detActor, detDetail)],
      _place: placeId,
      _org: principal?.org?.id,
    },
    { assignedId, actor: recordActor }
  );
  publish(sim, TOPIC.detected, rec);
  if (check.entitled && ENTITLEMENT_TYPES.has(rec.violationType)) {
    const valid = check.basis.find((b) => b.status === 'valid');
    const what = valid.right ? `AssignedRight ${valid.right.id}` : `Session ${valid.session.id}`;
    rec = violations(sim).update(rec.id, (v) => ({
      ...v,
      violationStatus: 'dismissed',
      statusHistory: [...v.statusHistory, entry('dismissed', now, config(sim).actor, `entitled: ${what} (${valid.rightType ?? 'right'}) valid at detectedTime`)],
    }), { bump: false });
    publish(sim, TOPIC.status, rec);
  }
  return rec;
}

export function registerLifecycle(sim) {
  const load = (ctx) => getVisible(ctx, 'violations', ctx.params.id, { what: 'violation' });

  const move = (ctx, v, state, { detail, patch = {}, topic = TOPIC.status, actor } = {}) => {
    const now = ctx.clock.now();
    const next = violations(sim).update(
      v.id,
      (x) => ({ ...x, ...patch, violationStatus: state, statusHistory: [...x.statusHistory, entry(state, now, actor ?? actorOf(ctx), detail)] }),
      { actor: ctx.actor }
    );
    publish(sim, topic, next);
    return next;
  };

  // ---------- create and read ----------

  sim.on('post-apx-v1-violations', (ctx) => {
    const b = ctx.body;
    if (!isKnownType(sim, b.violationType)) fail('reference-unknown', `violationType ${b.violationType} is not in apx-violation-types or any implementer list this server serves.`);
    const node = bodyPlace(ctx, b.place);
    if (b.space && !ctx.hierarchy.has(b.space.id)) fail('reference-unknown', `No HierarchyElement ${b.space.id} (space).`);
    checkLocation(sim, b.location);
    if (b.detection.mode === 'automated' && !b.observations?.length && !b.evidence?.length) {
      fail('request-unprocessable', 'An automated detection must carry at least one observations[] reference or one evidence[] link (Part 19 §19.4 rule 1).');
    }
    const rec = createViolation(sim, { body: b, principal: ctx.principal, actor: actorOf(ctx), assignedId: ctx.assignId, recordActor: ctx.actor, placeId: node.id });
    return { status: 201, body: wire(violations(sim).get(rec.id)), idem: { collection: 'violations', id: rec.id } };
  });

  sim.on('get-apx-v1-violations-id', (ctx) => wire(load(ctx)));

/**
   * The §19.2 lookup, shared by GET /v1/violations and POST /v1/violations:search.
   * `has`/`get` read the filters from the query string or the body. Every
   * key that names no place (plate, noticeNumber, sourceRecordId) still
   * returns only rows at granted places (Part 9 §9.3a rule 3).
   */
  const lookup = (ctx, { has, get }) => {
    const place = has('place') ? queryPlace(ctx, get('place')) : null;
    const since = toMs(get('since'));
    const until = toMs(get('until'));
    const eq = (key, value) => !has(key) || value === get(key);
    return violations(sim)
      .find((v) => {
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, v._place)) return false;
        if (place && !ctx.hierarchy.within(v._place, place.id)) return false;
        const source = sourceOf(v);
        const checks = [
          eq('plate', v.vehicle?.credentialIdentification),
          eq('noticeNumber', v.notice?.noticeNumber),
          eq('status', v.violationStatus),
          eq('type', v.violationType),
          eq('detectionMode', v.detection?.mode),
          eq('sourceSystem', source?.system),
          eq('sourceRecordId', source?.recordId),
        ];
        if (checks.includes(false)) return false;
        const t = toMs(v.detection?.detectedTime);
        if (since !== undefined && t < since) return false;
        if (until !== undefined && t >= until) return false; // until is exclusive
        return true;
      })
      .sort((a, b) => toMs(b.detection.detectedTime) - toMs(a.detection.detectedTime));
  };

  sim.on('get-apx-v1-violations', (ctx) => paginate(ctx, lookup(ctx, { has: (k) => ctx.query.has(k), get: (k) => ctx.query.get(k) })));

  sim.on('post-apx-v1-violations-search', (ctx) => {
    const b = ctx.body ?? {};
    const has = (k) => b[k] !== undefined && b[k] !== null;
    const rows = lookup(ctx, { has, get: (k) => b[k] });
    const query = { int: (k) => (k === 'page' && Number.isInteger(b.page) ? b.page : undefined) };
    return paginate({ query, clock: ctx.clock }, rows);
  });

  // ---------- review ----------

  sim.on('post-apx-v1-violations-id-review', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    if (v.violationStatus !== 'detected') transitionIllegal(`review is valid only from detected; violation ${v.id} is ${v.violationStatus}.`);
    if (b.decision === 'dismiss' && !b.reason) invalid('/reason', 'reason is required when decision is dismiss.');
    if (b.violationType && !isKnownType(sim, b.violationType)) {
      fail('invalid-request', `violationType ${b.violationType} is not in apx-violation-types or any implementer list this server serves.`, { errors: [{ pointer: '/violationType', detail: 'unknown violation type' }] });
    }
    const actor = v.detection.mode !== 'automated' && v.detection.principal ? v.detection.principal : actorOf(ctx);
    if (b.decision === 'dismiss') {
      return wire(move(ctx, v, 'dismissed', { actor, detail: [b.reason, b.note].filter(Boolean).join(': '), patch: b.reviewer ? { _reviewer: b.reviewer } : {} }));
    }
    const corrected = b.violationType && b.violationType !== v.violationType;
    const detail = corrected ? `violationType ${v.violationType} → ${b.violationType}${b.note ? `: ${b.note}` : ''}` : b.note;
    return wire(move(ctx, v, 'confirmed', { actor, detail, patch: { ...(corrected ? { violationType: b.violationType } : {}), ...(b.reviewer ? { _reviewer: b.reviewer } : {}) } }));
  });

  // ---------- issue ----------

  // §19.4 rule 1: where the policy is silent, this server's documented rule is "review first".
  const unreviewedRule = (v) => {
    const policy = policyInForce(sim, v.place.id, toMs(v.detection.detectedTime));
    return { policy, rule: policy?.unreviewedIssuance ?? { permitted: false } };
  };

  const checkIssuable = (v) => {
    if (v.violationStatus !== 'confirmed' && v.violationStatus !== 'detected') transitionIllegal(`issue is valid only from confirmed (or detected, automated, where policy permits); violation ${v.id} is ${v.violationStatus}.`);
    checkIssuanceEvidence(sim, v); // §19.4 rules 5 and 6, every detection mode
    if (v.violationStatus === 'confirmed') return null;
    const mode = v.detection.mode;
    if (mode !== 'automated') fail('violation-not-issuable', `Detection mode ${mode} requires review before issuance; current status is detected.`);
    const { policy, rule } = unreviewedRule(v);
    const where = sim.hierarchy.get(v.place.id)?.name ?? v.place.id;
    const label = policy ? `Policy ${policy.id} v${policy.version} in force at ${where}` : `Operator rule at ${where} (no policy in force)`;
    if (!rule.permitted) fail('violation-not-issuable', `${label} has unreviewedIssuance.permitted false; review first.`);
    const confidence = v.detection.confidence;
    if (rule.minimumConfidence !== undefined && !(confidence >= rule.minimumConfidence)) {
      fail('violation-not-issuable', `${label} requires confidence ≥ ${rule.minimumConfidence} for unreviewed issuance; detection has ${confidence ?? 'none'}.`);
    }
    if (rule.violationTypes?.length && !rule.violationTypes.includes(v.violationType)) {
      fail('violation-not-issuable', `${label} permits unreviewed issuance only for ${rule.violationTypes.join(', ')}; not ${v.violationType}.`);
    }
    return `unreviewed automated issuance (confidence ${confidence} ≥ ${rule.minimumConfidence ?? 0})`;
  };

  sim.on('post-apx-v1-violations-id-issue', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    if (!b.amount) invalid('/amount', 'amount is required.');
    const unreviewed = checkIssuable(v);
    const nowMs = ctx.clock.nowMs();
    const now = ctx.clock.now();
    const result = applyIssuePolicy(sim, v, b, nowMs);
    const cfg = config(sim);
    const noticeNumber = b.noticeNumber ?? `${cfg.noticePrefix}${String(sim.store.next('violationNotice', cfg.noticeStart)).padStart(6, '0')}`;
    const issuedBy = b.issuedBy ?? (v.detection.mode !== 'automated' ? v._reviewer ?? (v.detection.detector?.className === 'Contact' ? v.detection.detector : null) : null) ?? ctx.principal.orgRef;
    const notice = { noticeKind: b.noticeKind ?? 'notice', noticeNumber, issuedTime: now, ...(issuedBy ? { issuedBy } : {}), ...(b.deliveryMethod ? { deliveryMethod: b.deliveryMethod } : {}) };
    const firstEntry = result.clamped
      ? { amount: result.amount, requestedAmount: result.requested, time: now, reason: 'cap', detail: `clamped to policy ${short(result.policy.id)} v${result.policy.version} maximum ${fmt(result.amount.currencyValue)}` }
      : { amount: result.amount, time: now, reason: 'issued', ...(result.cap?.unpaid ? { detail: `unpaid fee ${fmt(result.cap.unpaid.currencyValue)}; cap ${fmt(result.cap.amount.currencyValue)}` } : {}) };
    const parts = [
      unreviewed,
      `${notice.noticeKind} ${noticeNumber}${b.deliveryMethod ? ` by ${b.deliveryMethod}` : ''}`,
      result.policy ? `policy ${short(result.policy.id)} v${result.policy.version}` : 'no EnforcementPolicy in force; issued without policy checks',
      result.signage.length ? `signage ${result.signage.map((s) => `${short(s.id)} v${s.version}`).join(', ')}` : null,
      result.clamped ? `clamped ${fmt(result.requested.currencyValue)} → ${fmt(result.amount.currencyValue)}` : null,
      b.note,
    ].filter(Boolean);
    const actor = v.detection.principal ?? actorOf(ctx);
    const issued = move(ctx, v, 'issued', {
      topic: TOPIC.issued,
      actor,
      detail: parts.join('; '),
      patch: {
        ...frozenTerms(result),
        notice,
        amount: result.amount,
        ...(b.dueTime ? { dueTime: b.dueTime } : {}),
        amountHistory: [firstEntry],
        _esc: resumeEsc({ _esc: { activeMs: 0, since: null, fired: [] } }, nowMs),
      },
    });
    armEscalation(sim, issued.id);
    return wire(violations(sim).get(issued.id));
  });

  // ---------- payment ----------

  // §19.6a: each attachment contributes its `amount` (absent = the whole
  // outstanding balance), is appended to payments[] and summed in
  // amountPaid; the violation is `paid` only when amountPaid ≥ amount.
  sim.on('post-apx-v1-violations-id-payment', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    if (v.violationStatus !== 'issued') transitionIllegal(`payment is valid only from issued; violation ${v.id} is ${v.violationStatus}.`);
    const currency = v.amount?.currencyType ?? 'USD';
    if (b.amount && b.amount.currencyType !== currency) {
      fail('invalid-request', `amount is in ${b.amount.currencyType}; the violation is payable in ${currency}.`, { errors: [{ pointer: '/amount/currencyType', detail: `must be ${currency}` }] });
    }
    const nowMs = ctx.clock.nowMs();
    const now = iso(nowMs);
    const ref = b.payment;
    const owed = v.amount?.currencyValue ?? 0;
    const before = v.amountPaid?.currencyValue ?? 0;
    const part = b.amount ? b.amount.currencyValue : Math.max(0, round2(owed - before));
    const after = round2(before + part);
    const applied = { amount: money(part, currency), paidTime: now, payment: ref };
    const patch = { payments: [...(v.payments ?? []), applied], amountPaid: money(after, currency) };
    const label = `${short(ref.id)}`;
    if (after < owed) {
      const detail = [`part payment ${label}: ${fmt(part)} of ${fmt(owed)}; ${fmt(owed - after)} outstanding`, b.note].filter(Boolean).join('; ');
      return wire(move(ctx, v, 'issued', { detail, patch })); // the escalation clock keeps running
    }
    const parts = patch.payments.map((x) => fmt(x.amount.currencyValue));
    const settled = parts.length > 1 ? `settled by ${label}; ${parts.join(' + ')}` : `${ref.className ?? 'Payment'} ${label}`;
    const paid = move(ctx, v, 'paid', {
      detail: [settled, b.note].filter(Boolean).join('; '),
      patch: { ...patch, payment: ref, _esc: pauseEsc(v, nowMs), _paidSince: now },
    });
    armClosure(sim, paid.id);
    return wire(violations(sim).get(paid.id));
  });

  /**
   * §19.6a rule 4: a refund reduces amountPaid by the refunded amount — the
   * Part 13 refund record's own amount when this server holds it, else
   * `fallback` (the figure the transition implies).
   */
  const lessRefund = (v, refund, fallback) => {
    if (!refund || !v.amountPaid) return {};
    const held = sim.store.collection('payments').get(refund.id)?.amount?.currencyValue;
    const refunded = held !== undefined ? Math.abs(held) : Math.max(0, fallback);
    return { amountPaid: money(Math.max(0, round2(v.amountPaid.currencyValue - refunded)), v.amountPaid.currencyType) };
  };

  // ---------- appeals ----------

  const appealWindowCheck = (v, nowMs) => {
    const terms = policyTerms(sim, v.policy);
    const days = terms?.appealWindowDays;
    const issuedTime = v.notice?.issuedTime;
    if (days === undefined || !issuedTime) return;
    const closes = toMs(issuedTime) + days * DAY_MS;
    if (nowMs > closes) {
      fail('appeal-closed', `Appeal window of ${days} days (policy ${short(v.policy.id)} v${v.policy.version}) from ${issuedTime} closed ${iso(closes)}.`);
    }
  };

  sim.on('post-apx-v1-violations-id-appeals', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    const st = v.violationStatus;
    if (st === 'closed' || st === 'voided') fail('appeal-closed', `Violation ${v.id} is ${st}.`);
    if (st === 'appealed') fail('appeal-closed', `Violation ${v.id} already has an open appeal (opened ${v.appeal?.openedTime}).`);
    if (v.appeal) fail('appeal-closed', `Violation ${v.id} already had its one appeal (resolved ${v.appeal.resolution} ${v.appeal.resolvedTime}).`);
    if (st !== 'issued' && st !== 'paid') transitionIllegal(`appeals is valid only from issued (or paid, within the appeal window); violation ${v.id} is ${st}.`);
    const nowMs = ctx.clock.nowMs();
    appealWindowCheck(v, nowMs);
    const uploads = b.evidenceLinks?.length ?? 0;
    const appeal = { reason: b.reason, ...(b.detail ? { detail: b.detail } : {}), ...(b.appellant ? { appellant: b.appellant } : {}), openedTime: iso(nowMs), openedFrom: st };
    const detail = [st === 'paid' ? 'pay-then-appeal' : null, uploads ? `${uploads} appellant upload${uploads > 1 ? 's' : ''} quarantined for scanning` : null].filter(Boolean).join('; ') || undefined;
    return wire(move(ctx, v, 'appealed', { detail, patch: { appeal, _appealUploads: b.evidenceLinks ?? [], _esc: pauseEsc(v, nowMs) } }));
  });

  sim.on('post-apx-v1-violations-id-appeals-resolve', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    if (v.violationStatus !== 'appealed') fail('appeal-closed', `Violation ${v.id} is ${v.violationStatus} with no open appeal.`);
    if (!['upheld', 'reduced', 'dismissed'].includes(b.resolution)) {
      fail('invalid-request', `resolution ${b.resolution} is not upheld, reduced or dismissed.`, { errors: [{ pointer: '/resolution', detail: 'upheld | reduced | dismissed' }] });
    }
    if (b.resolution === 'reduced' && !b.adjustedAmount) invalid('/adjustedAmount', 'adjustedAmount is required when resolution is reduced.');
    const nowMs = ctx.clock.nowMs();
    const now = iso(nowMs);
    const appeal = { ...v.appeal, resolvedTime: now, resolution: b.resolution, ...(b.note ? { resolutionNote: b.note } : {}), ...(b.refund ? { refund: b.refund } : {}) };
    const refundNote = b.refund ? `; refund ${short(b.refund.id)}` : '';
    if (b.resolution === 'dismissed') return wire(move(ctx, v, 'closed', { detail: `appeal dismissed${refundNote}`, patch: { appeal, ...lessRefund(v, b.refund, v.amountPaid?.currencyValue ?? 0) } }));
    const back = v.appeal.openedFrom ?? 'issued';
    const patch = { appeal };
    let detail = `appeal upheld${refundNote}`;
    if (b.resolution === 'reduced') {
      const amount = money(b.adjustedAmount.currencyValue, b.adjustedAmount.currencyType);
      patch.amount = amount;
      patch.amountHistory = [...(v.amountHistory ?? []), { amount, time: now, reason: 'appealReduced', ...(b.refund ? { detail: `refund ${short(b.refund.id)} ${fmt(v.amount.currencyValue - amount.currencyValue)}` } : {}) }];
      detail = `appeal reduced: ${fmt(v.amount.currencyValue)} → ${fmt(amount.currencyValue)}${refundNote}`;
      Object.assign(patch, lessRefund(v, b.refund, (v.amountPaid?.currencyValue ?? 0) - amount.currencyValue));
    }
    if (back === 'issued') patch._esc = resumeEsc(v, nowMs);
    else patch._paidSince = now;
    const out = move(ctx, v, back, { detail, patch });
    if (back === 'issued') armEscalation(sim, out.id);
    else armClosure(sim, out.id);
    return wire(violations(sim).get(out.id));
  });

  // ---------- void ----------

  sim.on('post-apx-v1-violations-id-void', (ctx) => {
    const v = load(ctx);
    const b = ctx.body;
    if (v.violationStatus === 'voided') transitionIllegal(`Violation ${v.id} is already voided.`);
    if (TERMINAL.has(v.violationStatus)) transitionIllegal(`Violation ${v.id} is ${v.violationStatus} (terminal); void is refused.`);
    const detail = [b.reason, b.note].filter(Boolean).join(': ') + (b.refund ? `; refund ${short(b.refund.id)}` : '');
    return wire(move(ctx, v, 'voided', { detail, patch: { _esc: pauseEsc(v, ctx.clock.nowMs()), ...(b.refund ? { _refund: b.refund } : {}), ...lessRefund(v, b.refund, v.amountPaid?.currencyValue ?? 0) } }));
  });
}
