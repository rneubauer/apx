/**
 * Worlds: the fixture a simulation starts from. A world is a JSON file in
 * `worlds/` (or an object passed to the sim API) naming the host, the
 * organisations, the place hierarchy with lanes and devices, credentials,
 * simulated receivers, and per-domain seed sections (sessions, rate
 * tables, accounts, programs, ...) that each domain's `seed()` reads.
 *
 * Shorthand ids `b1…0001` expand to `b1000000-0000-4000-8000-000000000001`
 * anywhere in the file, so a world can be written the way the vetting
 * suite's cast paragraphs are.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WORLDS_DIR = resolve(HERE, '..', '..', 'worlds');

const SHORT_ID = /\b([0-9a-f]{2})…([0-9a-f]{4})\b/g;

/** Expand `xx…NNNN` shorthand ids throughout a JSON document. */
export function expandIds(value) {
  if (typeof value === 'string') return value.replace(SHORT_ID, (_, p, s) => `${p}000000-0000-4000-8000-00000000${s}`);
  if (Array.isArray(value)) return value.map(expandIds);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[expandIds(k)] = expandIds(v);
    return out;
  }
  return value;
}

export function listWorlds() {
  if (!existsSync(WORLDS_DIR)) return [];
  return readdirSync(WORLDS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => basename(f, '.json'))
    .sort();
}

/** Load a world by name (worlds/<name>.json), by path, or pass through an object. */
export function loadWorld(spec = 'default') {
  let raw;
  if (spec && typeof spec === 'object') raw = spec;
  else {
    const candidates = [spec, join(WORLDS_DIR, `${spec}.json`), resolve(String(spec))].filter((p) => p && typeof p === 'string' && p.endsWith('.json') && existsSync(p));
    if (!candidates.length) throw new Error(`unknown world "${spec}" (available: ${listWorlds().join(', ')})`);
    raw = JSON.parse(readFileSync(candidates[0], 'utf8'));
  }
  // `extends` composes worlds: the base is loaded first; objects merge shallowly, arrays concatenate.
  let world = structuredClone(raw);
  if (world.extends) {
    const base = loadWorld(world.extends);
    world = mergeWorlds(base, world);
    delete world.extends;
  }
  world = expandIds(world);
  world.name ??= typeof spec === 'string' ? basename(spec, '.json') : 'inline';
  world.host ??= 'https://api.lakeside-garage.example';
  world.eventSource ??= `${world.host}/v1`;
  world.credentials ??= {};
  world.places ??= [];
  world.lanes ??= [];
  world.devices ??= [];
  world.organisations ??= [];
  world.receivers ??= {};
  world.conformanceClasses ??= [
    'apx-data',
    'apx-events',
    'apx-events-sse',
    'apx-control',
    'apx-alerts',
    'apx-discovery',
    'apx-accounts',
    'apx-payment-history',
    'apx-lpr',
    'apx-reservations',
    'apx-permits',
    'apx-tolling',
    'apx-resolution',
    'apx-violations',
    'apx-validations',
    'apx-credentials',
    'apx-valet',
  ];
  world.features ??= ['negotiatedRates', 'negotiatedAmounts', 'ticketMatching'];
  world.clock ??= { start: '2026-09-24T18:00:00Z' };
  return world;
}

// Lists a child world states as a whole, not as additions to the base's.
const REPLACE_KEYS = new Set(['conformanceClasses', 'features', 'clock', 'vendorCommandTypes']);

export function mergeWorlds(base, over) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    if (REPLACE_KEYS.has(k)) out[k] = v;
    else if (Array.isArray(v) && Array.isArray(out[k])) out[k] = [...out[k], ...v];
    else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = { ...out[k], ...v };
    else out[k] = v;
  }
  return out;
}
