#!/usr/bin/env node
/**
 * Applies the APX data-profile overlay (OpenAPI Overlay 1.0,
 * spec/openapi/overlays/apx-data-overlay.yaml) to the bundled dist
 * artifacts, producing the EFFECTIVE API description. Runs as the last
 * step of `npm run spec:bundle`.
 *
 * Why: the vendored APDS 4.1 path items are mounted verbatim and must not
 * be edited, so Part 5's additive parameters and change-feed response
 * cannot live in the modular source. The overlay decorates the bundle
 * instead (written standard Part 3 §3.4, Part 5 §5.6).
 *
 * Supported Overlay 1.0 subset (all this overlay needs):
 *  - target: JSONPath of the form $.a['b'].c (child selectors only)
 *  - remove: true            → delete the targeted node
 *  - update: <array>         → target must be an array; items are appended
 *  - update: <object>        → structured merge into the targeted object
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OVERLAY = join(root, 'spec', 'openapi', 'overlays', 'apx-data-overlay.yaml');
const DIST_YAML = join(root, 'spec', 'dist', 'apx-v1.yaml');
const DIST_JSON = join(root, 'spec', 'dist', 'apx-v1.json');

function fail(msg) {
  console.error(`[spec:overlay] ERROR ${msg}`);
  process.exit(1);
}

/** Parse the supported JSONPath subset into a key array. */
function parsePath(target) {
  if (!target.startsWith('$')) fail(`unsupported target (must start with $): ${target}`);
  const keys = [];
  const re = /\.([A-Za-z0-9_$-]+)|\['((?:[^'\\]|\\.)*)'\]/g;
  let consumed = 1;
  let m;
  while ((m = re.exec(target.slice(1))) !== null) {
    if (m.index !== consumed - 1) fail(`cannot parse target: ${target}`);
    keys.push(m[1] !== undefined ? m[1] : m[2]);
    consumed += m[0].length;
  }
  if (consumed !== target.length) fail(`cannot parse target: ${target}`);
  return keys;
}

function resolveParent(doc, keys, target) {
  let node = doc;
  for (const key of keys.slice(0, -1)) {
    if (node == null || typeof node !== 'object' || !(key in node)) {
      fail(`target does not resolve (missing '${key}'): ${target}`);
    }
    node = node[key];
  }
  return node;
}

/** Overlay 1.0 structured merge: objects merge recursively, arrays append, scalars replace. */
function merge(targetNode, update) {
  for (const [key, value] of Object.entries(update)) {
    const existing = targetNode[key];
    if (Array.isArray(existing) && Array.isArray(value)) {
      existing.push(...value);
    } else if (
      existing && typeof existing === 'object' && !Array.isArray(existing) &&
      value && typeof value === 'object' && !Array.isArray(value)
    ) {
      merge(existing, value);
    } else {
      targetNode[key] = value;
    }
  }
}

function applyAction(doc, action, index) {
  const keys = parsePath(action.target);
  const parent = resolveParent(doc, keys, action.target);
  const last = keys[keys.length - 1];
  if (action.remove === true) {
    if (!(last in parent)) fail(`remove target missing '${last}': ${action.target}`);
    delete parent[last];
    return;
  }
  if (!('update' in action)) fail(`action ${index} has neither update nor remove`);
  const node = parent[last];
  if (Array.isArray(node)) {
    if (!Array.isArray(action.update)) fail(`array target needs array update: ${action.target}`);
    node.push(...action.update);
  } else if (node && typeof node === 'object') {
    merge(node, action.update);
  } else if (node === undefined && !Array.isArray(action.update)) {
    parent[last] = action.update;
  } else {
    fail(`cannot update scalar target: ${action.target}`);
  }
}

const overlay = yaml.load(readFileSync(OVERLAY, 'utf8'));
if (overlay.overlay !== '1.0.0') fail(`unsupported overlay version: ${overlay.overlay}`);
if (!Array.isArray(overlay.actions) || overlay.actions.length === 0) fail('overlay has no actions');

const doc = JSON.parse(readFileSync(DIST_JSON, 'utf8'));

// Guard against double application (idempotence): if the first parameters
// target already ends with CursorParam, the overlay has been applied.
const firstKeys = parsePath(overlay.actions[0].target);
const firstParams = resolveParent(doc, firstKeys, overlay.actions[0].target)[firstKeys.at(-1)];
if (Array.isArray(firstParams) && JSON.stringify(firstParams).includes('CursorParam')) {
  console.log('[spec:overlay] already applied — nothing to do');
  process.exit(0);
}

overlay.actions.forEach((action, i) => applyAction(doc, action, i));

writeFileSync(DIST_JSON, JSON.stringify(doc, null, 2) + '\n');
writeFileSync(DIST_YAML, yaml.dump(doc, { lineWidth: -1, noRefs: true }));
console.log(`[spec:overlay] applied ${overlay.actions.length} action(s) to apx-v1.{yaml,json}`);
