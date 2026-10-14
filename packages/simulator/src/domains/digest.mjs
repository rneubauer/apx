/**
 * Credential digest keys (Part 9 §9.6 rule 6; Annex A APX-CORE-17):
 * `GET /v1/digest-keys` under `apx.digest:use`, and the one place the
 * simulator computes `apds-ext:apx:credential-digest@1.0` values, so any
 * module that decorates a record (an Observation, a PlateListEntry) uses
 * the same keys this route serves: `sim.digest.compute(orgId, plate,
 * jurisdiction?)`, `sim.digest.keysFor(orgId)`.
 *
 * Keys are per operator organisation (a digest computed by one operator
 * does not match another's). World section, optional:
 *   digest: { keys: [{ org, keyId, key (base64url ≥ 32 bytes), validFrom?, validTo? }] }
 * Without it each organisation gets one deterministic key derived from
 * its id, so digests are stable across runs.
 *
 * The simulator does not decorate records with digests by itself (the
 * decoration is a MAY); it serves the keys and the computation.
 */
import { createHash, createHmac } from 'node:crypto';

export const DIGEST_KEY = 'apds-ext:apx:credential-digest@1.0';
export const NORMALIZATION = 'upper; strip non-alphanumerics; jurisdiction appended as `|<ISO 3166-2>`';
const ALG = 'HS256';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** The identification as hashed: upper case, alphanumerics only, `|<jurisdiction>` when given. */
export const normalize = (identification, jurisdiction) =>
  String(identification ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') + (jurisdiction ? `|${String(jurisdiction).toUpperCase()}` : '');

export default {
  name: 'digest',
  register(sim) {
    const derived = (orgId) => {
      const keyId = `sim-${String(orgId).slice(0, 2)}${String(orgId).slice(-4)}-1`;
      return { keyId, alg: ALG, key: b64url(createHash('sha256').update(`apx-sim-digest:${orgId}:${keyId}`).digest()), normalization: NORMALIZATION };
    };

    /** The keys of `orgId` valid at the simulated now (both keys during a rotation overlap). */
    function keysFor(orgId) {
      if (!orgId) return [];
      const now = sim.clock.nowMs();
      const configured = (sim.world.digest?.keys ?? []).filter((k) => k.org === orgId || k.org?.id === orgId);
      if (!configured.length) return [derived(orgId)];
      return configured
        .filter((k) => !(k.validFrom && Date.parse(k.validFrom) > now) && !(k.validTo && Date.parse(k.validTo) < now))
        .map((k) => ({
          keyId: k.keyId,
          alg: ALG,
          key: k.key,
          ...(k.validFrom ? { validFrom: k.validFrom } : {}),
          ...(k.validTo ? { validTo: k.validTo } : {}),
          normalization: k.normalization ?? NORMALIZATION,
        }));
    }

    /** A CredentialDigest under the organisation's newest valid key, or null when it has none. */
    function compute(orgId, identification, jurisdiction, credentialType = 'licensePlate') {
      const key = keysFor(orgId).at(-1);
      if (!key) return null;
      const value = b64url(createHmac('sha256', Buffer.from(key.key, 'base64url')).update(normalize(identification, jurisdiction)).digest());
      return { alg: ALG, keyId: key.keyId, value, credentialType };
    }

    // Keys go only to the caller's own operator organisation, under apx.digest:use alone (rule 6).
    sim.on('get-apx-v1-digest-keys', (ctx) => ({ keys: keysFor(ctx.principal.org?.id) }));

    sim.digest = { keysFor, compute, normalize, DIGEST_KEY };
  },
};
