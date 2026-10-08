/**
 * Authentication and the Part 9 claims model.
 *
 * The simulator accepts four bearer-token forms, so a scenario can be
 * written the way the vetting suite writes it:
 *
 *   Bearer sim.<base64url JSON claims>      minted by POST /oauth/token or /sim/token
 *   Bearer <credential-name>                a credential defined in the world (angle
 *                                           brackets optional): `Bearer lakeside-parcs`
 *   Bearer <apx.data:read only>             a descriptive token, parsed: scopes, `only`,
 *   Bearer <no apx_places claim at all>     `expired`, `apx_org a1…0001`, `apx_places:
 *   Bearer <apx.valet:request, bound to …>  [...]`, `bound to <id>`, `no apx.* scopes`
 *   Bearer …                                the world's `default` credential
 *
 * Claims: { sub, scopes[], apx_org {id, className}, apx_places[] | undefined,
 *           bound {id, className} | undefined, exp }.
 */
import { APX_SCOPES, APDS_ROLES } from './spec.mjs';

/** Expand the suite's `b1…0001` shorthand to a full UUID. */
export function expandId(short) {
  const m = String(short).match(/^([0-9a-f]{2})…([0-9a-f]{4})$/);
  if (!m) return short;
  return `${m[1]}000000-0000-4000-8000-00000000${m[2]}`;
}

export function encodeToken(claims) {
  return 'sim.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
}

export function decodeToken(token) {
  if (!token.startsWith('sim.')) return null;
  try {
    return JSON.parse(Buffer.from(token.slice(4), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export class Principal {
  constructor(claims) {
    this.sub = claims.sub ?? 'anonymous';
    this.scopes = new Set(claims.scopes ?? []);
    this.org = claims.apx_org ?? null;
    this.places = claims.apx_places === undefined || claims.apx_places === null ? undefined : [...claims.apx_places];
    this.bound = claims.bound ?? null;
    this.user = claims.user ?? claims.sub ?? null;
    this.exp = claims.exp ?? null;
    this.raw = claims;
  }
  has(scope) {
    return this.scopes.has(scope);
  }
  hasAny(scopes) {
    return scopes.some((s) => this.scopes.has(s));
  }
  get wildcard() {
    return this.places?.includes('*') === true;
  }
  get hasGrant() {
    return this.places !== undefined;
  }
  /** The APX Reference for recordInfo.creator / requestedBy. */
  get orgRef() {
    return this.org ? { id: this.org.id, className: this.org.className ?? 'Organisation' } : undefined;
  }
  toClaims() {
    return this.raw;
  }
}

/**
 * Parse the descriptive form used by the vetting suite, e.g.
 *   "apx.data:read only" | "expired" | "no apx_places claim at all" |
 *   "apx.validations:redeem; apx_org a2…0077" | "apx.valet:request, bound to d8…0419" |
 *   "apx_places: [\"b1000000-…\"]" | "APDS role ep; no apx.* scopes" | "riverside-lpr-system: apx.data:write"
 * Returns claims derived from `base` (the world's default credential).
 */
export function parseDescriptive(text, base, world) {
  const t = text.trim();
  if (/^(expired|revoked|malformed|invalid)\b/i.test(t)) return { expired: true };
  let claims = structuredClone(base ?? {});
  claims.sub = t;
  // "<ivr-trial; no apx_places claim>" or "<lakeside-parcs: apx.data:write>" starts from that credential.
  const lead = t.split(/[;,:]/)[0].trim();
  if (world?.credentials?.[lead]) claims = { ...structuredClone(world.credentials[lead]), sub: t, credential: lead };
  // Scopes: APX scopes and vendor scopes (`<ns>.<domain>:<verb>`); "no <scope>" / "without <scope>" negates.
  const negated = new Set([...t.matchAll(/\b(?:no|without|minus|lacking|not)\s+`?([a-z0-9-]+\.[a-z-]+:[a-z-]+)/g)].map((m) => m[1]));
  const scopesMentioned = [...t.matchAll(/\b[a-z0-9-]+\.[a-z-]+:[a-z-]+\b/g)]
    .map((m) => m[0])
    .filter((s) => (APX_SCOPES.includes(s) || !s.startsWith('apx.')) && !negated.has(s));
  // APDS roles: "APDS role ep", "scope: po", "scopes po sp"
  const roles = [...t.matchAll(/\b(?:APDS role|roles?|scopes?)\s*:?\s*((?:[a-z]{2}\b[\s,]*)+)/g)]
    .flatMap((m) => m[1].split(/[\s,]+/))
    .filter((r) => APDS_ROLES.includes(r));
  // "label: value" forms ("scope: po", "lakeside-parcs: apx.data:write") name the scopes explicitly.
  const named = t.match(/^([a-z0-9-]+)\s*:\s*/);
  // "<lakeside-parcs: apx_places [...]>" keeps the named credential's scopes when the text names none.
  const namedKnown = named && world?.credentials?.[named[1]];
  // A token written as nothing but scopes ("<apx.resolution:read apx.data:write>") carries exactly those.
  const residue = t.replace(/\b[a-z0-9-]+\.[a-z-]+:[a-z-]+\b/g, '').replace(/\b(and|scopes?)\b/gi, '').replace(/[\s,;+&]/g, '');
  if (!residue && scopesMentioned.length) claims.scopes = [...scopesMentioned, ...roles];
  if (/\bonly\b/.test(t) || /no apx\.\* scopes/.test(t) || (named && !(namedKnown && !scopesMentioned.length && !roles.length))) claims.scopes = [...scopesMentioned, ...roles];
  else if (scopesMentioned.length || roles.length) claims.scopes = [...new Set([...(claims.scopes ?? []), ...scopesMentioned, ...roles])];
  if (negated.size) claims.scopes = (claims.scopes ?? []).filter((s) => !negated.has(s));
  if (/no apx_places claim/i.test(t) || /without an apx_places/i.test(t)) delete claims.apx_places;
  const placesList = t.match(/apx_places\s*:?\s*(\[[^\]]*\])/);
  if (placesList) {
    try {
      claims.apx_places = JSON.parse(placesList[1]).map((id) => expandId(String(id)));
    } catch {
      claims.apx_places = [...placesList[1].matchAll(/[0-9a-f…-]{6,}/g)].map((m) => expandId(m[0]));
    }
  }
  if (/apx_places\s*=?\s*"?\*"?/.test(t) || /wildcard/i.test(t) || /"\*"/.test(t)) claims.apx_places = ['*'];
  const org = t.match(/apx_org\s*:?\s*`?([0-9a-f…-]{6,})/);
  if (org) claims.apx_org = { id: expandId(org[1]), className: 'Organisation' };
  const bound = t.match(/bound to\s*`?([0-9a-f…-]{6,})/);
  if (bound) {
    // A customer-scope token ("apx.valet:request, bound to d8…0419") carries
    // only the scopes it names, never the operator defaults.
    claims.bound = { id: expandId(bound[1]) };
    claims.scopes = [...scopesMentioned, ...roles];
  }
  return claims;
}

/**
 * Resolve the Authorization header to a Principal, or return
 * { error: 'missing' | 'expired' | 'unknown' | 'malformed' }.
 */
export function authenticate(headers, world, clock) {
  const header = headers.authorization;
  const simCred = headers['x-sim-credential'];
  if (!header) {
    if (simCred && world.credentials?.[simCred]) return { principal: new Principal({ sub: simCred, ...world.credentials[simCred] }) };
    if (world.anonymousDefault && world.credentials?.default) return { principal: new Principal({ sub: 'default', ...world.credentials.default }) };
    return { error: 'missing' };
  }
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return { error: 'malformed' };
  let token = m[1].trim();
  const base = world.credentials?.default ?? {};

  if (token.startsWith('sim.')) {
    const claims = decodeToken(token);
    if (!claims) return { error: 'malformed' };
    if (claims.exp && Date.parse(claims.exp) < clock.nowMs()) return { error: 'expired' };
    return { principal: new Principal(claims) };
  }
  const bracketed = token.match(/^<(.*)>$/);
  if (bracketed) token = bracketed[1].trim();
  if (token === '…' || token === '...' || token === 'token' || token === '') {
    const name = simCred && world.credentials?.[simCred] ? simCred : 'default';
    const cred = world.credentials?.[name];
    if (!cred) return { error: 'unknown' };
    return { principal: new Principal({ sub: name, ...cred }) };
  }
  if (world.credentials?.[token]) return { principal: new Principal({ sub: token, ...world.credentials[token] }) };
  // "<expired>", "<expired at 03:00>", "<revoked at 02:00>", "<malformed>"
  if (/^(expired|revoked|malformed|invalid)\b/i.test(token)) return { error: 'expired' };
  // Descriptive token: derive from the default credential.
  const claims = parseDescriptive(token, base, world);
  if (claims.expired) return { error: 'expired' };
  return { principal: new Principal(claims) };
}
