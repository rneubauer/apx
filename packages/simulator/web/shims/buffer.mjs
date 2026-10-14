/**
 * The slice of Node's Buffer the simulator uses (utf8, hex, base64,
 * base64url; from, byteLength, concat), injected as the global `Buffer`.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBinary = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
};
const fromBase64 = (text) => {
  const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export class Buffer extends Uint8Array {
  static from(value, encoding = 'utf8') {
    if (typeof value !== 'string') return new Buffer(value);
    if (encoding === 'hex') return new Buffer((value.match(/../g) ?? []).map((h) => parseInt(h, 16)));
    if (encoding === 'base64' || encoding === 'base64url') return new Buffer(fromBase64(value));
    return new Buffer(encoder.encode(value));
  }

  static byteLength(value) {
    return typeof value === 'string' ? encoder.encode(value).length : value.length;
  }

  static concat(list) {
    const out = new Buffer(list.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of list) {
      out.set(b, at);
      at += b.length;
    }
    return out;
  }

  static isBuffer(value) {
    return value instanceof Buffer;
  }

  toString(encoding = 'utf8') {
    if (encoding === 'hex') return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
    if (encoding === 'base64') return btoa(toBinary(this));
    if (encoding === 'base64url') return btoa(toBinary(this)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return decoder.decode(this);
  }
}
