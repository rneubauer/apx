#!/usr/bin/env node
/**
 * Applies the APX overlays (OpenAPI Overlay 1.0) to the bundled dist
 * artifacts, producing the EFFECTIVE API description. Runs as the last
 * step of `npm run spec:bundle`. Overlays are applied in listed order:
 *
 *  1. apx-data-overlay.yaml — the Part 5 data profile. The vendored APDS
 *     4.1 path items are mounted verbatim and must not be edited, so the
 *     mode/cursor parameters and change-feed responses cannot live in the
 *     modular source (Part 3 §3.4, Part 5 §5.6).
 *  2. apx-docs-overlay.yaml — the reading layer: the orientation in
 *     `info.description`, per-domain narrative on each tag, and the
 *     `x-tagGroups` nav grouping. Kept out of the modular source so the
 *     source stays a contract and the prose stays in one reviewable file.
 *
 * Supported Overlay 1.0 subset (all these overlays need):
 *  - target: JSONPath of the form $.a['b'].c (child selectors only)
 *  - remove: true            → delete the targeted node
 *  - update: <array>         → append to an existing array, or create it
 *  - update: <object>        → structured merge, or create when absent
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OVERLAY_DIR = join(root, 'spec', 'openapi', 'overlays');
const OVERLAYS = ['apx-data-overlay.yaml', 'apx-docs-overlay.yaml', 'apx-examples-overlay.yaml'];
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
  } else if (node === undefined) {
    // Absent target: create it. Lets an overlay introduce a node the
    // modular source does not carry at all (e.g. x-tagGroups).
    parent[last] = action.update;
  } else {
    fail(`cannot update scalar target: ${action.target}`);
  }
}

const overlays = OVERLAYS.map((file) => {
  const doc = yaml.load(readFileSync(join(OVERLAY_DIR, file), 'utf8'));
  if (doc.overlay !== '1.0.0') fail(`${file}: unsupported overlay version: ${doc.overlay}`);
  if (!Array.isArray(doc.actions) || doc.actions.length === 0) fail(`${file}: no actions`);
  return { file, doc };
});

const doc = JSON.parse(readFileSync(DIST_JSON, 'utf8'));

// Guard against double application (idempotence). The overlays always run
// together as the last step of spec:bundle, so one probe covers both: if
// the data overlay's first parameters target already carries CursorParam,
// this bundle has been decorated already.
const probe = overlays[0].doc.actions[0].target;
const probeKeys = parsePath(probe);
const probeNode = resolveParent(doc, probeKeys, probe)[probeKeys.at(-1)];
if (Array.isArray(probeNode) && JSON.stringify(probeNode).includes('CursorParam')) {
  console.log('[spec:overlay] already applied — nothing to do');
  process.exit(0);
}

let applied = 0;
for (const { file, doc: overlay } of overlays) {
  overlay.actions.forEach((action, i) => applyAction(doc, action, i));
  applied += overlay.actions.length;
  console.log(`[spec:overlay]   ${file}: ${overlay.actions.length} action(s)`);
}

writeFileSync(DIST_JSON, JSON.stringify(doc, null, 2) + '\n');
writeFileSync(DIST_YAML, yaml.dump(doc, { lineWidth: -1, noRefs: true }));
console.log(`[spec:overlay] applied ${applied} action(s) from ${overlays.length} overlay(s) to apx-v1.{yaml,json}`);
