/**
 * Card-data and contact minimization for apx-accounts (Part 13 §13.1
 * "No card data", Part 9 §9.6): detect a primary account number wherever
 * it hides in a body or query, and mask a link destination.
 */

/** Members that only ever carry card data; never accepted on this API. */
const CARD_MEMBERS = /^(cardNumber|pan|primaryAccountNumber|cardPan|expiry|expiryDate|cardExpiry|expirationDate|cvv|cvc|cvv2|securityCode)$/i;

/** A run of 13–19 digits, optionally grouped by single spaces (4242 4242 …). */
const DIGIT_RUN = /\d(?: ?\d){12,18}/g;

/** Luhn checksum: true for a plausible card number. */
export function luhn(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Whether a string carries something that looks like a full card number. */
export function looksLikePan(value) {
  if (typeof value !== 'string') return false;
  for (const m of value.matchAll(DIGIT_RUN)) {
    if (luhn(m[0].replace(/ /g, ''))) return true;
  }
  return false;
}

/** More than four digits in a truncated-card field. */
export const tooManyCardDigits = (value) => typeof value === 'string' && (value.match(/\d/g)?.length ?? 0) > 4;

/**
 * Scan a request body. Returns null when clean, else
 * { kind: 'cardLast4' | 'members' | 'embedded', members?: string[] }.
 */
export function scanBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (tooManyCardDigits(body.cardLast4)) return { kind: 'cardLast4' };
  const members = Object.keys(body).filter((k) => CARD_MEMBERS.test(k));
  if (members.length) return { kind: 'members', members };
  const walk = (v) => {
    if (typeof v === 'string') return looksLikePan(v);
    if (Array.isArray(v)) return v.some(walk);
    if (v && typeof v === 'object') return Object.values(v).some(walk);
    return false;
  };
  return walk(body) ? { kind: 'embedded' } : null;
}

/** Scan query parameters: cardLast4 with more than four digits, or a PAN anywhere. */
export function scanQuery(query) {
  for (const name of query.keys()) {
    for (const value of query.all(name)) {
      if (name === 'cardLast4' && tooManyCardDigits(value)) return name;
      if (looksLikePan(value)) return name;
    }
  }
  return null;
}

/** A raw (unmasked) phone number or e-mail address in a field that must carry a masked handle. */
export function isRawContact(value) {
  if (typeof value !== 'string' || value.includes('•')) return false;
  return /\d{7,}/.test(value.replace(/[\s().-]/g, '')) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

const BULLETS = '•••••••';

/** "+15550108812" → "+1•••••••8812"; "dispatch@x.example" → "d•••••••@x.example". */
export function maskDestination(channel, destination) {
  if (typeof destination !== 'string' || !destination) return undefined;
  if (channel === 'email' || destination.includes('@')) {
    const [local, domain] = destination.split('@');
    return `${local.slice(0, 1)}${BULLETS}@${domain}`;
  }
  const digits = destination.replace(/\D/g, '');
  const cc = destination.startsWith('+') && digits.length > 10 ? `+${digits.slice(0, digits.length - 10)}` : '';
  return `${cc}${BULLETS}${digits.slice(-4)}`;
}
