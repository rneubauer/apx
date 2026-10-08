/**
 * Server-applied time on a violation: escalation steps (§19.10 rule 3)
 * and the administrative `paid → closed` reconciliation (§19.1 rule 2).
 *
 * The escalation clock runs only while `issued`. `_esc` keeps
 * `{ activeMs, since, fired[] }`: `activeMs` is the time already spent
 * `issued` before the current stretch, `since` the instant the current
 * stretch began (null while paused). A step falls due when
 * `activeMs + (now − since)` reaches max(afterDays, paymentGraceDays).
 * Every timer carries the `since` it was armed under, so a timer from an
 * earlier stretch (before an appeal) is ignored when it fires.
 */
import { entry, money, refOf, wire } from '../common.mjs';
import { policyTerms, escalate } from './policy.mjs';
import { config, toMs, iso, fmt, short, DAY_MS, TOPIC } from './model.mjs';

export const violations = (sim) => sim.store.collection('violations');

export function publish(sim, topic, rec) {
  sim.events.publish({ type: topic, data: wire(rec), subject: refOf(rec.id, 'Violation'), place: rec._place });
}

/** `_esc` after leaving `issued` at `nowMs`. */
export function pauseEsc(rec, nowMs) {
  const esc = rec._esc ?? { activeMs: 0, since: null, fired: [] };
  if (!esc.since) return esc;
  return { ...esc, activeMs: esc.activeMs + Math.max(0, nowMs - toMs(esc.since)), since: null };
}

/** `_esc` after (re-)entering `issued` at `nowMs`. */
export function resumeEsc(rec, nowMs) {
  const esc = rec._esc ?? { activeMs: 0, since: null, fired: [] };
  return { ...esc, since: iso(nowMs) };
}

function nextStep(sim, rec) {
  const terms = policyTerms(sim, rec.policy);
  const fired = new Set(rec._esc?.fired ?? []);
  const steps = [...(terms?.escalation ?? [])].filter((s) => !fired.has(s.step)).sort((a, b) => a.afterDays - b.afterDays);
  if (!steps.length) return null;
  const graceDays = terms.paymentGraceDays ?? 0;
  return { terms, step: steps[0], dueActiveMs: Math.max(steps[0].afterDays, graceDays) * DAY_MS };
}

/** Arm the timer for the next escalation step of an `issued` violation. */
export function armEscalation(sim, id) {
  const rec = violations(sim).get(id);
  if (!rec || rec.violationStatus !== 'issued' || !rec._esc?.since) return;
  const next = nextStep(sim, rec);
  if (!next) return;
  const token = rec._esc.since;
  const at = toMs(token) + next.dueActiveMs - rec._esc.activeMs;
  sim.clock.schedule(at, () => fireStep(sim, id, next.step.step, token), `escalate ${short(id)} ${next.step.step}`);
}

/** Apply one escalation step now (a timer, or the `escalate` injector with force). */
export function fireStep(sim, id, stepName, token, { force = false } = {}) {
  const rec = violations(sim).get(id);
  if (!rec || rec.violationStatus !== 'issued') return null;
  if (!force && rec._esc?.since !== token) return null;
  const next = nextStep(sim, rec);
  if (!next || (stepName && next.step.step !== stepName)) return null;
  const { terms, step } = next;
  const { value, ceiling } = escalate(terms, rec, step);
  const now = sim.clock.now();
  const actor = config(sim).scheduler;
  const how = step.addAmount ? `+${fmt(step.addAmount.currencyValue)}` : `+${step.addPercent}%`;
  const detail = `${how} per policy ${short(rec.policy.id)} v${rec.policy.version}${ceiling !== null ? `; ceiling ${fmt(ceiling)}` : ''}`;
  const amount = money(value, rec.amount.currencyType);
  const updated = violations(sim).update(id, (v) => ({
    ...v,
    amount,
    amountHistory: [...(v.amountHistory ?? []), { amount, time: now, reason: 'escalation', step: step.step, detail }],
    statusHistory: [...v.statusHistory, entry('issued', now, actor, `escalation ${step.step}: ${fmt(rec.amount.currencyValue)} → ${fmt(value)}`)],
    _esc: { ...v._esc, fired: [...(v._esc?.fired ?? []), step.step] },
  }));
  publish(sim, TOPIC.status, updated);
  armEscalation(sim, id);
  return updated;
}

/**
 * Arm the reconciliation that closes a `paid` violation: the scheduler's
 * nightly run (00:00:03 UTC) once refundWindowDays calendar days have
 * passed since the day it was paid.
 */
export function armClosure(sim, id) {
  const rec = violations(sim).get(id);
  if (!rec || rec.violationStatus !== 'paid' || !rec._paidSince) return;
  const token = rec._paidSince;
  const day = Math.floor(toMs(token) / DAY_MS) * DAY_MS;
  const at = day + config(sim).refundWindowDays * DAY_MS + 3000;
  sim.clock.schedule(
    at,
    () => {
      const v = violations(sim).get(id);
      if (!v || v.violationStatus !== 'paid' || v._paidSince !== token) return;
      const now = sim.clock.now();
      const days = config(sim).refundWindowDays;
      const closed = violations(sim).update(id, (x) => ({
        ...x,
        violationStatus: 'closed',
        statusHistory: [...x.statusHistory, entry('closed', now, config(sim).scheduler, `reconciled; ${days}-day refund window elapsed`)],
      }));
      publish(sim, TOPIC.status, closed);
    },
    `close ${short(id)}`
  );
}
