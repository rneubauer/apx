/**
 * Signing keys of a webhook subscription (Part 8 §8.1, Part 9 §9.4).
 *
 * `_keys` holds `{ keyId, secret, since, retiredAt?, secretRef? }`; the
 * fabric signs with the newest unretired key and sends `APX-Key-Id`
 * while more than one is active. A PATCH carrying `secret` or `secretRef`
 * starts a rotation; `retireKeyIds` ends it; otherwise a clock timer
 * retires the superseded keys 24 hours after the rotation.
 */
import { createHash } from 'node:crypto';
import { fail } from '../../kernel/problems.mjs';
import { EventFabric } from '../../kernel/events.mjs';

export const ROTATION_OVERLAP_MS = 24 * 3_600_000;

const letters = (n) => {
  let s = '';
  let x = n;
  do {
    s = String.fromCharCode(97 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  } while (x >= 0);
  return s;
};

/** A server-assigned key id: k-<date>-<letter>, e.g. k-2026-09-24-a. */
export function mintKeyId(sim) {
  return `k-${sim.clock.now().slice(0, 10)}-${letters(sim.store.next('events.keyId', 0))}`;
}

/** Key material behind a secretRef: the world's vault entry, else a stable derivation of the reference. */
export function resolveSecretRef(sim, ref) {
  return sim.world.events?.vault?.[ref] ?? createHash('sha256').update(`apx-sim-vault:${ref}`).digest('hex');
}

export const activeKeys = (sub) => (sub._keys ?? []).filter((k) => !k.retiredAt);
export const activeKeyIds = (keys) => keys.filter((k) => !k.retiredAt).map((k) => k.keyId);

/** Refuse a secret under 32 bytes of entropy (400 invalid-request pointing at /secret). */
export function checkSecret(secret) {
  if (secret === undefined) return;
  if (!EventFabric.secretStrongEnough(secret)) {
    const n = typeof secret === 'string' ? Buffer.byteLength(secret, 'utf8') : 0;
    fail('invalid-request', `secret must carry at least 32 bytes of entropy (Part 9 §9.4); ${n} bytes supplied.`, {
      errors: [{ pointer: '/secret', detail: 'at least 32 bytes of entropy required' }],
    });
  }
}

/**
 * The key a create or a rotation introduces, from `secret`, `secretRef`
 * and `keyId` in the body. Returns { key, disclosed } where `disclosed` is
 * the secret value the 201 may show (never for a secretRef), or null when
 * the body names no key material.
 */
export function newKey(sim, body, { mintIfAbsent }) {
  const { secret, secretRef, keyId } = body;
  if (secret !== undefined && secretRef !== undefined) {
    fail('invalid-request', 'Supply secret or secretRef, not both (Part 9 §9.4).', { errors: [{ pointer: '/secretRef', detail: 'mutually exclusive with secret' }] });
  }
  checkSecret(secret);
  const since = sim.clock.now();
  if (secretRef !== undefined) return { key: { keyId: keyId ?? secretRef, secret: resolveSecretRef(sim, secretRef), secretRef, since }, disclosed: undefined };
  if (secret !== undefined) return { key: { keyId: keyId ?? mintKeyId(sim), secret, since }, disclosed: secret };
  if (keyId !== undefined) {
    fail('invalid-request', 'keyId names the key supplied with secret or secretRef; neither is present.', { errors: [{ pointer: '/keyId', detail: 'requires secret or secretRef' }] });
  }
  if (!mintIfAbsent) return null;
  const minted = EventFabric.mintSecret();
  return { key: { keyId: mintKeyId(sim), secret: minted, since }, disclosed: minted };
}

/** Add a rotation key to a key list; a key id already active is refused. */
export function addKey(keys, key) {
  if (keys.some((k) => !k.retiredAt && k.keyId === key.keyId)) {
    fail('invalid-request', `keyId ${key.keyId} is already an active key of this subscription.`, { errors: [{ pointer: '/keyId', detail: 'already active' }] });
  }
  return [...keys, key];
}

/** Retire the named keys now; unknown ids and retiring every active key are 400 invalid-request. */
export function retireKeys(keys, ids, now) {
  const active = new Set(activeKeyIds(keys));
  ids.forEach((id, i) => {
    if (!active.has(id)) fail('invalid-request', `retireKeyIds names ${id}, which is not an active key of this subscription.`, { errors: [{ pointer: `/retireKeyIds/${i}`, detail: 'not an active key' }] });
  });
  if (ids.length && [...active].every((id) => ids.includes(id))) {
    fail('invalid-request', 'Retiring every active key would leave the subscription unable to sign; keep at least one (Part 8 §8.1).', {
      errors: [{ pointer: '/retireKeyIds', detail: 'cannot retire the last active key' }],
    });
  }
  return keys.map((k) => (ids.includes(k.keyId) && !k.retiredAt ? { ...k, retiredAt: now } : k));
}

/** The automatic end of an overlap: every active key added before the rotation key `keyId` is retired. */
export function retireSuperseded(keys, keyId, now) {
  const at = keys.findIndex((k) => k.keyId === keyId && !k.retiredAt);
  if (at < 0) return keys;
  return keys.map((k, i) => (i < at && !k.retiredAt ? { ...k, retiredAt: now } : k));
}
