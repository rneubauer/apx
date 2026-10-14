/**
 * Pricing a period against an APDS 4.1 RateTable, for native `POST /quotes`
 * (Part 14 §14.1 step 1). Which tables price a quote: the referenced
 * RightSpecification's native `rateEligibility[]`, else the rate tables bound
 * to the quoted element. A period no table prices gets no option — never a guess.
 *
 * The arithmetic (the one rule set the simulator applies):
 * - the RateLineCollection in force at the period start (validStart/validEnd),
 *   lowest collectionSequence first;
 * - `incrementingRate`: value per started incrementPeriod over the part of the
 *   period inside the line's durationStart/durationEnd window;
 * - `flatRateTier`: value once when the period reaches the line's window;
 * - `flatRate`: value once — except a line described as a maximum (a cap on the
 *   total) or as a fee (lostTicketFee, unpaidStayFee: surcharges, not time);
 * - line minValue/maxValue clamp that line; collection min/maxValueCollection
 *   clamp the total.
 */
import { parseDuration } from '../../kernel/clock.mjs';

const MINUTE_MS = 60_000;
const round2 = (n) => Number(Number(n).toFixed(2));
const text = (d) => (Array.isArray(d) ? d.map((x) => x?.string ?? '').join(' ') : String(d ?? ''));
const isCap = (line) => /\bmax(imum)?\b/i.test(text(line.description));
const isFee = (line) => /fee\b/i.test(text(line.description));

/** APDS RateLine duration offsets: `hh:mm` or `dd:hh:mm`, in ms from the period start. */
export function offsetMs(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = String(value).split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return undefined;
  const [d, h, m] = parts.length === 3 ? parts : [0, ...parts];
  return ((d * 24 + h) * 60 + m) * MINUTE_MS;
}

function collectionAt(table, startMs) {
  const live = (table?.rateLineCollections ?? []).filter((c) => {
    const from = c.validStart ? Date.parse(c.validStart) : -Infinity;
    const to = c.validEnd ? Date.parse(c.validEnd) : Infinity;
    return from <= startMs && startMs < to && (c.rateLines ?? []).length > 0;
  });
  return live.sort((a, b) => (a.collectionSequence ?? 0) - (b.collectionSequence ?? 0))[0] ?? null;
}

function lineCharge(line, durationMs) {
  const from = offsetMs(line.durationStart) ?? 0;
  const to = Math.min(offsetMs(line.durationEnd) ?? Infinity, durationMs);
  const covered = to - from;
  if (covered <= 0 && !(line.rateLineType === 'flatRate' && from === 0)) return 0;
  let charge;
  if (line.rateLineType === 'incrementingRate') {
    const step = line.incrementPeriod ? parseDuration(line.incrementPeriod) : 0;
    charge = step > 0 ? Math.ceil(covered / step) * line.value : line.value;
  } else {
    charge = line.value;
  }
  if (typeof line.minValue === 'number') charge = Math.max(charge, line.minValue);
  if (typeof line.maxValue === 'number') charge = Math.min(charge, line.maxValue);
  return charge;
}

/**
 * The price of [start, end) under one RateTable:
 * { currencyType, currencyValue, taxIncluded } or null when the table has no
 * collection in force or no line that prices time.
 */
export function priceTable(table, start, end) {
  const startMs = Date.parse(start);
  const durationMs = Date.parse(end) - startMs;
  if (!Number.isFinite(startMs) || !(durationMs > 0)) return null;
  const coll = collectionAt(table, startMs);
  if (!coll) return null;
  const lines = [...coll.rateLines].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)).filter((l) => typeof l.value === 'number' && !isFee(l));
  const charged = lines.filter((l) => !(l.rateLineType === 'flatRate' && isCap(l)));
  if (!charged.length) return null;
  let total = charged.reduce((sum, l) => sum + lineCharge(l, durationMs), 0);
  for (const cap of lines.filter((l) => l.rateLineType === 'flatRate' && isCap(l))) total = Math.min(total, cap.value);
  if (typeof coll.minValueCollection?.currencyValue === 'number') total = Math.max(total, coll.minValueCollection.currencyValue);
  if (typeof coll.maxValueCollection?.currencyValue === 'number') total = Math.min(total, coll.maxValueCollection.currencyValue);
  return { currencyType: coll.applicableCurrency ?? 'USD', currencyValue: round2(total), taxIncluded: coll.taxIncluded === true };
}
