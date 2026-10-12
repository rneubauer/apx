/**
 * apx-validations helpers with no handler context: the benefit invariant,
 * what a benefit is worth against an amount due, instrument codes, the
 * billing models, and the statement computation (Part 20 §20.1, §20.3,
 * §20.6).
 */
import { randomBytes } from 'node:crypto';
import { parseDuration } from '../../kernel/clock.mjs';
import { fail } from '../../kernel/problems.mjs';
import { money, refOf } from '../common.mjs';

export const BENEFIT_KINDS = ['amount', 'duration', 'percentage'];
/** Issuance methods whose instruments carry a code (§20.2 rule 1). */
export const CODE_METHODS = new Set(['code', 'qrCode', 'digital']);

const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 symbols, 5 bits each
const CODE_GROUPS = 4;
const GROUP_LEN = 4; // 16 symbols x 5 bits = 80 bits of entropy (>= 64, §20.2 rule 1)
const DEFAULT_HOURLY_RATE = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** §20.1: a benefit carries exactly one of amount, duration, percentage. */
export function checkBenefit(benefit) {
  const present = BENEFIT_KINDS.filter((k) => benefit?.[k] !== undefined);
  if (present.length === 1) return;
  fail('request-unprocessable', present.length ? `benefit carries both ${present.join(' and ')}.` : 'benefit carries none of amount, duration, percentage.');
}

/** A fresh, implementation-unique instrument code: `<prefix>-XXXX-XXXX-XXXX-XXXX`. */
export function newCode(prefix, taken) {
  for (;;) {
    const symbols = [...randomBytes(CODE_GROUPS * GROUP_LEN)].map((b) => CODE_ALPHABET[b & 31]).join('');
    const groups = [];
    for (let i = 0; i < CODE_GROUPS; i += 1) groups.push(symbols.slice(i * GROUP_LEN, (i + 1) * GROUP_LEN));
    const code = `${prefix}-${groups.join('-')}`;
    if (!taken(code)) return code;
  }
}

/** Two-letter code prefix from the program's display name ("Harbor Bistro" gives HB). */
export function codePrefix(name) {
  const initials = (String(name ?? '').match(/\b[A-Za-z]/g) ?? []).slice(0, 2).join('').toUpperCase();
  return initials.padEnd(2, 'V');
}

/** The hourly value of comped time under a rate table (its first incrementing line), else the world's. */
export function hourlyRate(world, table) {
  for (const coll of table?.rateLineCollections ?? []) {
    for (const line of coll.rateLines ?? []) {
      if (line.rateLineType !== 'incrementingRate' || !line.incrementPeriod) continue;
      const hours = parseDuration(line.incrementPeriod) / HOUR_MS;
      if (hours > 0) return line.value / hours;
    }
  }
  return world.validations?.hourlyRate ?? world.control?.hourlyRate ?? DEFAULT_HOURLY_RATE;
}

const round2 = (n) => Number(Number(n).toFixed(2));

/** The ACTUAL reduction a benefit makes against `due` (§20.3); the nominal value when nothing is due. */
export function reductionFor(benefit, due, rate) {
  let nominal = 0;
  if (benefit?.amount) nominal = benefit.amount.currencyValue;
  else if (benefit?.percentage !== undefined) nominal = due === undefined ? 0 : (due * benefit.percentage) / 100;
  else if (benefit?.duration) nominal = (parseDuration(benefit.duration) / HOUR_MS) * rate;
  const reduced = due === undefined ? nominal : Math.max(0, Math.min(due, nominal));
  return round2(reduced);
}

/** The calendar date (YYYY-MM-DD) of an instant in a place's time zone. */
export function localDate(iso, timeZone = 'UTC') {
  const at = new Date(iso);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** What the merchant owes for one redemption under the program's billing model (§20.6). */
export function billableOf(program, amountReduced) {
  const billing = program.billing ?? { model: 'operatorAbsorbs' };
  const currency = amountReduced?.currencyType ?? billing.unitPrice?.currencyType ?? 'USD';
  const base = billing.unitPrice ? billing.unitPrice.currencyValue : (amountReduced?.currencyValue ?? 0);
  if (billing.model === 'merchantPays') return money(base, currency);
  if (billing.model === 'split') return money((base * (billing.merchantShare ?? 0)) / 100, currency);
  return money(0, currency);
}

const byApplied = (a, b) => (a.appliedTime < b.appliedTime ? -1 : a.appliedTime > b.appliedTime ? 1 : a.id.localeCompare(b.id));
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

function creditsFor(store, all, from, to) {
  const statements = store.collection('statements');
  return all
    .filter((r) => {
      const billedOn = r.reversal?.closedStatement && statements.get(r.reversal.closedStatement.id);
      if (!billedOn || r.reversal.creditedOn) return false;
      if (Date.parse(r.reversal.time) >= to) return false;
      return !overlaps(from, to, Date.parse(billedOn.periodStart), Date.parse(billedOn.periodEnd));
    })
    .sort(byApplied);
}

function redemptionLine(program, r, currency) {
  return {
    lineKind: 'redemption',
    redemption: refOf(r.id, 'ValidationRedemption'),
    appliedTime: r.appliedTime,
    ...(r.ticketNumber ? { ticketNumber: r.ticketNumber } : {}),
    amountReduced: r.amountReduced ?? money(0, currency),
    billable: billableOf(program, r.amountReduced),
  };
}

function creditLine(program, r, currency) {
  const billable = billableOf(program, r.amountReduced);
  return {
    lineKind: 'credit',
    redemption: refOf(r.id, 'ValidationRedemption'),
    originalStatement: refOf(r.reversal.closedStatement.id, 'ValidationStatement'),
    appliedTime: r.appliedTime,
    ...(r.ticketNumber ? { ticketNumber: r.ticketNumber } : {}),
    amountReduced: money(-(r.amountReduced?.currencyValue ?? 0), r.amountReduced?.currencyType ?? currency),
    billable: money(-billable.currencyValue, billable.currencyType),
  };
}

/**
 * A program's statement for [periodStart, periodEnd): applied redemptions
 * as lines, reversed ones counted, and `credit` lines for reversals of
 * redemptions billed on an earlier closed statement and not yet credited.
 * Members starting with `_` are hints for the close (which ids it bills).
 */
export function computeStatement(store, program, periodStart, periodEnd) {
  const from = Date.parse(periodStart);
  const to = Date.parse(periodEnd);
  const all = store.collection('redemptions').find((r) => r._program === program.id);
  const inPeriod = (r) => {
    const t = Date.parse(r.appliedTime);
    return t >= from && t < to;
  };
  const applied = all.filter((r) => r.redemptionStatus === 'applied' && inPeriod(r)).sort(byApplied);
  const reversed = all.filter((r) => r.redemptionStatus === 'reversed' && inPeriod(r));
  const credits = creditsFor(store, all, from, to);
  const currency = program.billing?.unitPrice?.currencyType ?? applied[0]?.amountReduced?.currencyType ?? 'USD';
  const lines = [...applied.map((r) => redemptionLine(program, r, currency)), ...credits.map((r) => creditLine(program, r, currency))];
  const sum = (rows, pick) => rows.reduce((n, l) => n + (pick(l)?.currencyValue ?? 0), 0);
  return {
    program: refOf(program.id, 'ValidationProgram'),
    place: refOf(program._place, program.place?.className ?? 'Place'),
    periodStart,
    periodEnd,
    billingModel: program.billing?.model ?? 'operatorAbsorbs',
    redemptionCount: applied.length,
    reversedCount: reversed.length,
    creditCount: credits.length,
    totalReduced: money(sum(applied, (r) => r.amountReduced), currency),
    billableAmount: money(sum(lines, (l) => l.billable), currency),
    lines,
    _redemptionIds: applied.map((r) => r.id),
    _creditIds: credits.map((r) => r.id),
  };
}

/** The billing period the instant `nowMs` falls in, for a cycle (monthly by default; weeks start Monday, UTC). */
export function periodAround(nowMs, cycle = 'monthly') {
  const d = new Date(nowMs);
  if (cycle === 'weekly') {
    const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const start = midnight - ((d.getUTCDay() + 6) % 7) * DAY_MS;
    return { start, end: start + 7 * DAY_MS };
  }
  return { start: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) };
}
