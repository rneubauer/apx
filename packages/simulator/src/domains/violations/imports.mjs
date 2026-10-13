/**
 * Violations issued by an external enforcement system (Part 19 §19.13):
 * the import, keyed on the source's `system` + `recordId` and ordered by
 * `sourceRevision` (else `sourceUpdatedTime`), and the Session link set
 * after creation (`POST /v1/violations/{id}/session`).
 *
 * The kernel has already refused, before these handlers run: a missing
 * Idempotency-Key, an Idempotency-Key replayed with another body, and a
 * body that fails ViolationImport (no source decoration, a state at or
 * past issuance without `notice` or `amount`) — all as the bundle says.
 */
import { fail } from '../../kernel/problems.mjs';
import { getVisible, wire, money, refOf } from '../common.mjs';
import { violations, publish, armClosure } from './timers.mjs';
import { SOURCE_KEY, MATCH_KEY, sourceOf, matchEvidenceOf } from './evidence.mjs';
import { isKnownType, bodyPlace, toMs, iso, fmt, round2, deepEqual, TOPIC } from './model.mjs';

const AT_OR_PAST_ISSUE = new Set(['issued', 'paid', 'appealed', 'closed']);

/** -1, 0 or 1: how revision `incoming` orders against `held`; null when they share no ordering member (every import applies). */
export function compareRevision(incoming, held) {
  if (Number.isInteger(incoming.sourceRevision) && Number.isInteger(held.sourceRevision)) {
    return Math.sign(incoming.sourceRevision - held.sourceRevision);
  }
  if (incoming.sourceUpdatedTime && held.sourceUpdatedTime) {
    return Math.sign(toMs(incoming.sourceUpdatedTime) - toMs(held.sourceUpdatedTime));
  }
  return null;
}

const revisionLabel = (src) => (Number.isInteger(src.sourceRevision) ? `sourceRevision ${src.sourceRevision}` : `sourceUpdatedTime ${src.sourceUpdatedTime}`);

/** §19.13 rule 3 and the 422 the bundle lists: the money must add up in one currency. */
function checkAmounts(b) {
  const currency = b.amount?.currencyType;
  const sums = [b.amountPaid, ...(b.payments ?? []).map((p) => p.amount)].filter(Boolean);
  const foreign = currency && sums.find((m) => m.currencyType !== currency);
  if (foreign) fail('request-unprocessable', `A payment is in ${foreign.currencyType}; the violation's amount is in ${currency}.`);
  const paid = b.amountPaid?.currencyValue ?? (b.payments?.length ? round2(b.payments.reduce((n, p) => n + p.amount.currencyValue, 0)) : undefined);
  if (b.violationStatus === 'paid' && !((paid ?? 0) >= b.amount.currencyValue)) {
    fail('request-unprocessable', `violationStatus paid requires amountPaid (${fmt(paid ?? 0)}) to be at least amount (${fmt(b.amount.currencyValue)}); a part-paid citation is issued (Part 19 §19.13 rule 3).`);
  }
  return paid === undefined ? undefined : money(paid, currency ?? b.amountPaid?.currencyType);
}

/**
 * Append-only (Part 4 §4.2): keep what is held, add only the source's
 * entries later than the last one — and, at the last instant itself,
 * those not already held (two source transitions in the same second).
 */
function mergeHistory(held, incoming) {
  if (!held?.length) return [...incoming];
  const last = Math.max(...held.map((e) => toMs(e.time)));
  const atLast = held.filter((e) => toMs(e.time) === last).map((e) => JSON.stringify(e));
  return [...held, ...incoming.filter((e) => toMs(e.time) > last || (toMs(e.time) === last && !atLast.includes(JSON.stringify(e))))];
}

/** amountHistory for an imported amount: the issued figure, then each change the source reports. */
function amountTrail(prev, b, src) {
  if (!b.amount) return prev?.amountHistory;
  const label = `${src.system} ${Number.isInteger(src.sourceRevision) ? `revision ${src.sourceRevision}` : `update ${src.sourceUpdatedTime ?? 'unordered'}`}`;
  const history = prev?.amountHistory ?? [];
  if (!history.length) return [{ amount: b.amount, time: b.notice?.issuedTime ?? b.statusHistory.at(-1).time, reason: 'issued', detail: label }];
  const current = history.at(-1).amount;
  if (deepEqual(current, b.amount)) return history;
  // The source changed what is owed; amountHistory has no "source" reason, so the direction names it.
  const reason = b.amount.currencyValue > current.currencyValue ? 'escalation' : 'appealReduced';
  return [...history, { amount: b.amount, time: src.sourceUpdatedTime ?? b.statusHistory.at(-1).time, reason, detail: label }];
}

export function registerImports(sim) {
  const findBySource = (src) => violations(sim).first((v) => sourceOf(v)?.system === src.system && sourceOf(v)?.recordId === src.recordId);

  /** The record an import writes: the body as the source reported it, plus what this server holds. */
  function compose(ctx, b, node, prev) {
    const src = b.extensions[SOURCE_KEY];
    const amountPaid = checkAmounts(b);
    const { id: _id, statusHistory, extensions, amountPaid: _paid, ...fields } = b;
    const keepLink = prev && !b.relatedSession ? { relatedSession: prev.relatedSession, [MATCH_KEY]: matchEvidenceOf(prev) } : {};
    const mergedExt = { ...(prev?.extensions ?? {}), ...extensions, [SOURCE_KEY]: { ...src, receivedTime: ctx.now() } };
    if (keepLink[MATCH_KEY]) mergedExt[MATCH_KEY] = keepLink[MATCH_KEY];
    // A source that relinks the stay without evidence drops evidence about the Session it replaced.
    const relinked = prev && b.relatedSession && b.relatedSession.id !== prev.relatedSession?.id;
    if (relinked && !extensions[MATCH_KEY]) delete mergedExt[MATCH_KEY];
    const amountHistory = amountTrail(prev, b, src);
    return {
      ...fields,
      ...(keepLink.relatedSession ? { relatedSession: keepLink.relatedSession } : {}),
      ...(amountPaid ? { amountPaid } : {}),
      ...(amountHistory ? { amountHistory } : {}),
      statusHistory: mergeHistory(prev?.statusHistory, statusHistory),
      extensions: mergedExt,
      _place: node.id,
      _org: ctx.principal.org?.id,
      _imported: true,
      _paidSince: b.violationStatus === 'paid' ? ([...statusHistory].reverse().find((e) => e.state === 'paid')?.time ?? ctx.now()) : undefined, // cleared when a revision leaves paid
    };
  }

  sim.on('post-apx-v1-enforcement-violation-imports', (ctx) => {
    const b = ctx.body;
    if (!isKnownType(sim, b.violationType)) fail('reference-unknown', `violationType ${b.violationType} is not in apx-violation-types or any implementer list this server serves.`);
    const node = bodyPlace(ctx, b.place);
    const src = b.extensions[SOURCE_KEY];
    const prev = findBySource(src);
    const idem = (rec) => ({ collection: 'violations', id: rec.id });

    if (!prev) {
      // §19.13 rule 4: no eligibility check, no policy clamp; the source decided.
      const rec = violations(sim).insert(compose(ctx, b, node, null), { assignedId: b.id ?? ctx.assignId, actor: ctx.actor });
      publish(sim, TOPIC.detected, rec);
      if (AT_OR_PAST_ISSUE.has(rec.violationStatus)) publish(sim, TOPIC.issued, rec);
      if (rec.violationStatus === 'paid') armClosure(sim, rec.id);
      return { status: 201, body: wire(rec), idem: idem(rec) };
    }

    const order = compareRevision(src, sourceOf(prev));
    if (order === 0) return { status: 200, body: wire(prev), idem: idem(prev) }; // the same revision: no-op
    if (order === -1) {
      fail('version-conflict', `${src.system} ${src.recordId} is held at ${revisionLabel(sourceOf(prev))}; ${revisionLabel(src)} is older and changes nothing (Part 19 §19.13 rule 2).`);
    }
    const draft = compose(ctx, b, node, prev); // refusals (422) before anything is written
    const kept = (v) => Object.fromEntries(Object.entries(v).filter(([k]) => ['id', 'version', 'recordInfo'].includes(k) || k.startsWith('_')));
    const next = violations(sim).update(prev.id, (v) => ({ ...kept(v), ...draft }), { actor: ctx.actor });
    publish(sim, TOPIC.status, next);
    if (next.violationStatus === 'paid' && prev.violationStatus !== 'paid') armClosure(sim, next.id);
    return { status: 200, body: wire(next), idem: idem(next) };
  });

  // ---------- the Session link (§19.13 rule 6) ----------

  /** The Session a link names: 422 reference-unknown when missing or invisible; 422 request-unprocessable outside the hierarchy. */
  function linkableSession(ctx, v, ref) {
    const s = sim.store.collection('sessions').get(ref.id);
    const place = s?._place ?? s?.hierarchyElement?.id;
    const visible = s && ctx.principal.hasGrant && (!place || ctx.hierarchy.covers(ctx.principal.places, place));
    if (!visible) fail('reference-unknown', `session ${ref.id} names nothing that exists or is visible to the caller.`);
    const vp = v.place.id;
    const related = !place || place === vp || ctx.hierarchy.within(place, vp) || ctx.hierarchy.within(vp, place);
    if (!related) {
      const name = sim.hierarchy.get(place)?.name;
      fail('request-unprocessable', `Session ${s.id} is at ${name ? `${name} (${place})` : place}, outside the hierarchy of the violation's place ${vp} (Part 19 §19.13 rule 6).`);
    }
    return s;
  }

  sim.on('post-apx-v1-violations-id-session', (ctx) => {
    const v = getVisible(ctx, 'violations', ctx.params.id, { what: 'violation' });
    if (ctx.ifMatch !== undefined && ctx.ifMatch !== v.version) {
      fail('version-conflict', `If-Match "${ctx.ifMatch}" is stale; the violation is at version ${v.version}. Nothing was written.`, { currentVersion: v.version });
    }
    const b = ctx.body;
    const ext = { ...(v.extensions ?? {}) };
    let relatedSession;
    if (b.session === null) {
      delete ext[MATCH_KEY];
    } else {
      const s = linkableSession(ctx, v, b.session);
      relatedSession = refOf(s.id, 'Session');
      if (b.evidence) ext[MATCH_KEY] = { ...b.evidence, target: relatedSession };
      else if (ext[MATCH_KEY] && ext[MATCH_KEY].target?.id !== s.id) delete ext[MATCH_KEY]; // evidence about another Session no longer applies
    }
    const sameLink = deepEqual(v.relatedSession?.id ?? null, relatedSession?.id ?? null);
    if (sameLink && deepEqual(v.extensions?.[MATCH_KEY], ext[MATCH_KEY])) return wire(v); // no-op: no version, no event
    const next = violations(sim).update(
      v.id,
      (x) => {
        const { relatedSession: _old, extensions: _ext, ...rest } = x;
        return {
          ...rest,
          ...(relatedSession ? { relatedSession } : {}),
          ...(Object.keys(ext).length ? { extensions: ext } : {}),
          _sessionLinks: [...(x._sessionLinks ?? []), { session: relatedSession?.id ?? null, reason: b.reason ?? null, time: iso(ctx.clock.nowMs()) }],
        };
      },
      { actor: ctx.actor }
    );
    publish(sim, TOPIC.status, next); // not a transition: no statusHistory entry
    return wire(next);
  });
}
