/**
 * apx-reservations (Part 14 §14.1) — the decoration and its state
 * machine: what a write may do to `reservationState` (the transition
 * table), and the server's rewrite of every write (planned times mirror
 * `plannedUses[0]`, the server-set `noShowAfter`, a check-in that survives
 * amendments, `cancelTime`/`expiryTime` on the planned use).
 *
 * Pure functions over plain records; reservations.mjs applies them.
 */

export const EXT = 'apds-ext:apx:reservation@1.0';
export const PERMIT_EXT = 'apds-ext:apx:permit@1.0';
export const TERMINAL = new Set(['cancelled', 'noShow']);
export const PRE_CHECKIN = new Set(['confirmed', 'amended']);
const PLATE_TYPES = new Set(['licensePlate', 'vehicleplate']);

/** §14.1 transition table: the states a write may move a reservation to. */
const LEGAL = {
  confirmed: ['confirmed', 'amended', 'checkedIn', 'cancelled', 'noShow'],
  amended: ['amended', 'checkedIn', 'cancelled', 'noShow'],
  checkedIn: ['checkedIn', 'amended'], // an amendment after check-in keeps checkedIn
  cancelled: [],
  noShow: [],
};

export const extOf = (r) => r?.extensions?.[EXT];
export const stateOf = (r) => extOf(r)?.reservationState;
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const refOf = (id, className) => ({ id, className });

/** The planned window of a right: `plannedUses[0]` (authoritative), else the extension's mirror, else `expiry`. */
export function windowOf(r) {
  const use = r?.plannedUses?.[0];
  const ext = extOf(r);
  return {
    start: use?.startTime ?? ext?.plannedStart,
    end: use?.endTime ?? ext?.plannedEnd ?? r?.expiry,
  };
}

/** Why a write turning `prev` into `next` is illegal under §14.1, or null when it is allowed. */
export function illegalTransition(prev, next) {
  const from = stateOf(prev);
  const to = stateOf(next);
  if (!from || !to) return null;
  const id = prev.id;
  if (TERMINAL.has(from)) {
    if (to !== from) return `reservationState ${from} is terminal; transition to ${to} is not allowed (Part 14 §14.1).`;
    const a = windowOf(prev);
    const b = windowOf(next);
    if (a.start !== b.start || a.end !== b.end) return `reservationState ${from} is terminal; assigned right ${id} cannot be amended (Part 14 §14.1).`;
    return null;
  }
  if (LEGAL[from]?.includes(to)) return null;
  if (from === 'checkedIn') {
    const session = extOf(prev)?.checkInSession?.id;
    if (to === 'cancelled') return `Assigned right ${id} is checkedIn${session ? ` (session ${session})` : ''}; a reservation cannot be cancelled after check-in (Part 14 §14.1).`;
    return `Assigned right ${id} is checkedIn${session ? ` (session ${session})` : ''}; it returns to its pre-check-in state only through POST /v1/sessions/{id}/assigned-right/unlink (Part 14 §14.1b), not by a write to ${to}.`;
  }
  return `reservationState ${from} cannot move to ${to} by a write (Part 14 §14.1).`;
}

/** Why deleting `prev` (a cancellation, §14.1 rule 4) is illegal, or null. */
export function illegalDelete(prev) {
  const from = stateOf(prev);
  if (!from || PRE_CHECKIN.has(from)) return null;
  if (from === 'checkedIn') {
    const session = extOf(prev)?.checkInSession?.id;
    return `Assigned right ${prev.id} is checkedIn${session ? ` (session ${session} open)` : ''}; a reservation cannot be cancelled after check-in.`;
  }
  return `reservationState ${from} is terminal; assigned right ${prev.id} cannot be cancelled (Part 14 §14.1).`;
}

/**
 * The record the server stores for a reservation write: the extension
 * mirrors `plannedUses[0]` (or seeds it when only the extension carries the
 * times), `noShowAfter` is the server's, an amendment after check-in stays
 * `checkedIn` with its `checkInSession`, and entering `cancelled`/`noShow`
 * stamps the planned use. Returns the input unchanged when no decoration applies.
 */
export function normalize(record, prev, { graceMs, now, seeding = false }) {
  const prevExt = extOf(prev);
  const given = extOf(record) ?? prevExt;
  if (!given) return record;
  const ext = { ...given };
  const uses = Array.isArray(record.plannedUses) ? record.plannedUses.map((u) => ({ ...u })) : [];
  if (uses[0]?.startTime) {
    ext.plannedStart = uses[0].startTime;
    if (uses[0].endTime) ext.plannedEnd = uses[0].endTime;
    else delete ext.plannedEnd;
  } else if (ext.plannedStart) {
    uses[0] = { ...(uses[0] ?? {}), startTime: ext.plannedStart, ...(ext.plannedEnd ? { endTime: ext.plannedEnd } : {}) };
  }
  if (stateOf(prev) === 'checkedIn' && (ext.reservationState === 'amended' || ext.reservationState === 'checkedIn')) {
    ext.reservationState = 'checkedIn';
    ext.checkInSession = ext.checkInSession ?? prevExt.checkInSession;
  }
  const state = ext.reservationState;
  if (state !== 'checkedIn') delete ext.checkInSession;
  delete ext.noShowAfter;
  if (ext.plannedStart && graceMs !== undefined && (PRE_CHECKIN.has(state) || state === 'noShow')) {
    ext.noShowAfter = stateOf(prev) === 'noShow' && prevExt?.noShowAfter ? prevExt.noShowAfter : iso(Date.parse(ext.plannedStart) + graceMs);
  }
  const entering = !seeding && stateOf(prev) !== state;
  if (uses[0] && entering && state === 'cancelled' && !uses[0].cancelTime) uses[0].cancelTime = now;
  if (uses[0] && entering && state === 'noShow' && !uses[0].expiryTime) uses[0].expiryTime = ext.noShowAfter ?? now;
  return {
    ...record,
    ...(uses.length ? { plannedUses: uses } : {}),
    extensions: { ...(record.extensions ?? {}), [EXT]: ext },
  };
}

/** The ReservationSummary of a right (Part 14 §14.1a; the no-show event's `data`). */
export function summaryOf(r) {
  const ext = extOf(r) ?? {};
  return {
    reservation: refOf(r.id, 'AssignedRight'),
    ...(ext.reservationState ? { reservationState: ext.reservationState } : {}),
    ...(ext.plannedStart ? { plannedStart: ext.plannedStart } : {}),
    ...(ext.plannedEnd ? { plannedEnd: ext.plannedEnd } : {}),
    ...(ext.noShowAfter ? { noShowAfter: ext.noShowAfter } : {}),
    // Part 14 §14.1a: the seller that issued the code and what was paid through it.
    ...(ext.issuer ?? r._issuer ? { issuer: ext.issuer ?? r._issuer } : {}),
    ...(ext.amountPaid ?? r._amountPaid ? { amountPaid: ext.amountPaid ?? r._amountPaid } : {}),
  };
}

/**
 * The identifications a right's vehicle credentials stand for: the plate
 * string itself, or the identification of the CredentialRecord its
 * identifier references (§14.2b rule 3), with the credential type.
 */
export function identificationsOf(r, records) {
  const out = [];
  for (const c of r?.rightHolder?.credentials ?? []) {
    if (c?.credentialAssignedType === 'customer') continue;
    const idf = c?.identifier;
    if (!idf?.id) continue;
    if (idf.className === 'CredentialRecord') {
      const rec = records?.get(idf.id);
      if (rec) out.push({ type: rec.credentialType ?? c.type, value: rec.credentialIdentification });
    } else out.push({ type: c.type, value: idf.id });
  }
  return out;
}

export const platesOf = (r, records) => identificationsOf(r, records).filter((c) => PLATE_TYPES.has(c.type)).map((c) => c.value);

/** The local RightHolder of a right: the `_holder` hint, else its CustomerCredential (§14.2b rule 2). */
export const holderOf = (r) => r?._holder ?? (r?.rightHolder?.credentials ?? []).find((c) => c?.credentialAssignedType === 'customer')?.identifier?.id;
