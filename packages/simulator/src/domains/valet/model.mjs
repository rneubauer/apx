/**
 * apx-valet (Part 22) helpers: the lifecycle table, the ETA arithmetic of
 * §22.3 rule 1, the customer projection of §22.5, claimant verification
 * (§22.4), the §22.6 personal-data check, and the APDS records a ticket
 * references (the Session for the stay, the claim-ticket AssignedRight).
 */
import { refOf, wire } from '../common.mjs';

export const COLLECTION = 'valetTickets';

/** The states each action may start from (§22.1 rule 1). */
export const FROM = {
  park: ['dropped', 'parked', 'staged'],
  retrieve: ['parked'],
  'cancel-retrieval': ['requested', 'retrieving'],
  pickup: ['requested'],
  stage: ['requested', 'retrieving'],
  handback: ['staged', 'dropped'],
  cancel: ['dropped'],
};

export const ACTIVE = new Set(['requested', 'retrieving', 'staged']);
export const SETTLED = new Set(['closed', 'cancelled']);
const MINUTE = 60_000;

export const DEFAULT_TUNING = {
  baseEtaMinutes: 8,
  perQueuedMinutes: 1,
  horizonMinutes: 60,
  settleAfter: 'PT9M17S',
  stagingLane: null,
};

/** Human list for refusal details: "a, b, or c". */
export function orList(states) {
  if (states.length === 1) return states[0];
  if (states.length === 2) return `${states[0]} or ${states[1]}`;
  return `${states.slice(0, -1).join(', ')}, or ${states.at(-1)}`;
}

/** Whole minutes from now until promisedTime, never negative (§22.3 rule 1). */
export function etaMinutes(promisedTime, nowMs) {
  if (!promisedTime) return undefined;
  return Math.max(0, Math.floor((Date.parse(promisedTime) - nowMs) / MINUTE));
}

/** The ticket with its ETA recomputed for this instant (every read and event). */
export function withEta(ticket, nowMs) {
  const r = ticket.retrieval;
  if (!r?.promisedTime) return ticket;
  const live = ticket.valetStatus === 'requested' || ticket.valetStatus === 'retrieving';
  const eta = ticket.valetStatus === 'staged' || ticket.valetStatus === 'handedBack' || ticket.valetStatus === 'closed' ? 0 : live ? etaMinutes(r.promisedTime, nowMs) : r.etaMinutes;
  return eta === undefined ? ticket : { ...ticket, retrieval: { ...r, etaMinutes: eta } };
}

const pick = (obj, keys) => {
  if (!obj) return undefined;
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return Object.keys(out).length ? out : undefined;
};

/** The §22.5 minimized projection for an apx.valet:request token. */
export function minimize(t) {
  const out = {};
  for (const k of ['id', 'version', 'place', 'ticketNumber', 'vehicle']) if (t[k] !== undefined) out[k] = t[k];
  const customer = pick(t.customer, ['displayName']);
  if (customer) out.customer = customer;
  out.dropOff = { time: t.dropOff.time };
  const retrieval = pick(t.retrieval, ['requestedTime', 'requestedFor', 'channel', 'etaMinutes', 'promisedTime', 'stagingLane', 'stagedTime', 'cancelledTime']);
  if (retrieval) out.retrieval = retrieval;
  const handback = pick(t.handback, ['time']);
  if (handback) out.handback = handback;
  out.valetStatus = t.valetStatus;
  if (t.extensions !== undefined) out.extensions = t.extensions;
  return out;
}

/**
 * A customer-scope principal: bound to a ticket (the claim link / code), or
 * carrying apx.valet:request without :read or :manage. A bound token is a
 * customer token whatever else its descriptive form inherited (§22.5).
 */
export function isCustomer(principal) {
  if (!principal) return false;
  if (principal.bound?.id) return true;
  return principal.has('apx.valet:request') && !principal.has('apx.valet:read') && !principal.has('apx.valet:manage');
}

/** The wire view of a ticket for this principal at this instant. */
export function present(ticket, principal, nowMs) {
  const t = wire(withEta(ticket, nowMs));
  return isCustomer(principal) ? minimize(t) : t;
}

// ---------- §22.6: no raw phone numbers or e-mail addresses ----------

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MIN_PHONE_DIGITS = 7;

/** The member path carrying raw personal data, or null. */
export function rawPersonalData(body) {
  const handle = body?.customer?.contactChannel?.handle;
  if (typeof handle !== 'string') return null;
  if (EMAIL.test(handle)) return { pointer: 'customer.contactChannel.handle', kind: 'an e-mail address' };
  const digits = handle.replace(/\D/g, '');
  if (digits.length >= MIN_PHONE_DIGITS && !/[*•x#]/i.test(handle.replace(/^push:|^app:/i, ''))) {
    return { pointer: 'customer.contactChannel.handle', kind: 'a telephone number' };
  }
  return null;
}

// ---------- §22.4: claimant verification ----------

const lastDigits = (s, n = 4) => String(s ?? '').replace(/\D/g, '').slice(-n);

/** Whether the presented claim matches the ticket. `verificationValue` is checked, never stored. */
export function verifyClaimant(ticket, { verificationMethod: method, verificationValue: value }) {
  switch (method) {
    case 'ticket':
      return typeof value === 'string' && value.trim().toUpperCase() === String(ticket.ticketNumber ?? '').toUpperCase();
    case 'code':
      return typeof value === 'string' && !!ticket._claimCode && value.trim().toUpperCase() === ticket._claimCode.toUpperCase();
    case 'phone': {
      const onFile = lastDigits(ticket.customer?.contactChannel?.handle);
      return onFile.length === 4 && lastDigits(value) === onFile;
    }
    case 'id':
    case 'attendant':
      return true; // the attendant inspected the document or recognised the driver
    default:
      return false;
  }
}

// ---------- the APDS records a ticket references ----------

const CLAIM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A deterministic four-character claim code for the n-th ticket. */
export function claimCode(n) {
  let x = (n * 7919 + 104729) >>> 0;
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += CLAIM_CODE_ALPHABET[x % CLAIM_CODE_ALPHABET.length];
    x = Math.floor(x / CLAIM_CODE_ALPHABET.length) + 31 * (i + 1);
  }
  return out;
}

/** An id that mirrors the ticket's suffix under another prefix (d8…0419 → f1…0419), else null. */
export function mirrorId(ticketId, prefix) {
  return typeof ticketId === 'string' && /^[0-9a-f]{2}[0-9a-f]{6}-/.test(ticketId) ? `${prefix}${ticketId.slice(2)}` : null;
}

/** The APDS credential a valet stay is identified by: the plate when known, else the claim ticket. */
export function credentialOf(ticket) {
  const plate = ticket.vehicle?.credentialType === 'licensePlate' || ticket.vehicle?.credentialType === 'vehicleplate' ? ticket.vehicle.credentialIdentification : undefined;
  return plate
    ? { type: 'licensePlate', credentialAssignedType: 'vehicle', identifier: refOf(ticket.id, 'ValetTicket') }
    : { type: 'ticket', credentialAssignedType: 'other', identifier: refOf(ticket.id, 'ValetTicket') };
}

/** The claim-ticket AssignedRight (APDS): the right a Session segment is exercised under. */
export function claimRight({ id, ticket, rightSpecification, issuer, now }) {
  return {
    id,
    version: 1,
    rightSpecification: { id: rightSpecification, version: 1, className: 'RightSpecification' },
    rightHolder: { credentials: [credentialOf(ticket)] },
    ...(issuer ? { assignedRightIssuer: { id: issuer, version: 1, className: 'Organisation' } } : {}),
    issueMethod: 'ticket',
    issuanceTime: ticket.dropOff?.time ?? now,
    _place: ticket._place,
    _valetTicket: ticket.id,
  };
}

/** The APDS Session for the stay, opened at drop-off (Part 22 intro, §22.1 rule 5). */
export function staySession({ id, ticket, rightRef, operator, now }) {
  const start = ticket.dropOff?.time ?? now;
  return {
    id,
    version: 1,
    actualStart: start,
    initiator: { id: operator, version: 1, className: 'Organisation' },
    hierarchyElement: { id: ticket.place.id, version: 1, className: 'HierarchyElement' },
    identifiedCredentials: [credentialOf(ticket)],
    segments: [
      {
        id: `${id}-seg-1`,
        version: 1,
        actualStart: start,
        assignedRight: { id: rightRef.id, version: rightRef.version ?? 1, className: 'AssignedRight' },
        validationType: [credentialOf(ticket).type],
      },
    ],
    _place: ticket._place,
    _valetTicket: ticket.id,
  };
}
