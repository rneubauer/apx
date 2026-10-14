/** node:crypto for the browser build: synchronous SHA-256 and HMAC, random ids and bytes. */
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { Buffer } from './buffer.mjs';

const encoder = new TextEncoder();
const bytesOf = (data) => (typeof data === 'string' ? encoder.encode(data) : data);

function hasher(algorithm, digestOf) {
  if (algorithm !== 'sha256') throw new Error(`the browser build supports sha256 only, not ${algorithm}`);
  const parts = [];
  return {
    update(data) {
      parts.push(bytesOf(data));
      return this;
    },
    digest(encoding) {
      const out = Buffer.from(digestOf(Buffer.concat(parts)));
      return encoding ? out.toString(encoding) : out;
    },
  };
}

export const createHash = (algorithm) => hasher(algorithm, (message) => sha256(message));
export const createHmac = (algorithm, key) => hasher(algorithm, (message) => hmac(sha256, bytesOf(key), message));
export const randomBytes = (size) => Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));

export function randomUUID() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const b = randomBytes(16); // outside a secure context: RFC 9562 version 4 by hand
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default { createHash, createHmac, randomBytes, randomUUID };
