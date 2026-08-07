#!/usr/bin/env node
/**
 * Generates slim, profile-scoped OpenAPI subsets from the full bundle so a
 * vendor implementing one profile never has to open the whole spec.
 * Currently: the PARCS Starter Profile (apx-data + apx-events + apx-control).
 * Run after `npm run spec:bundle`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(join(ROOT, 'spec', 'dist', 'apx-v1.json'), 'utf8'));

const PARCS_PATHS = [
  '/.well-known/apx-configuration',
  // apx-data: the native APDS routes
  '/places',
  '/places/{id}',
  '/observations',
  '/contacts',
  '/contacts/{contactId}',
  '/rights/specs',
  '/rights/specs/{id}',
  '/rates',
  '/rates/{id}',
  '/sessions',
  '/sessions/{id}',
  '/rights/assigned',
  '/rights/assigned/{id}',
  '/quotes',
  // apx-events: subscriptions + ledger (SSE is optional and excluded)
  '/webhooks',
  '/webhooks/{id}',
  '/webhooks/{id}/deliveries',
  // apx-control: commands, lane inquiry, validations, device status
  '/v1/commands',
  '/v1/commands/{id}',
  '/v1/commands/{id}/cancel',
  '/v1/lanes/{id}/current',
  '/v1/validations/providers',
  '/v1/devices',
  '/v1/devices/{id}',
];

const output = {
  openapi: bundle.openapi,
  info: {
    ...bundle.info,
    title: 'APX — PARCS Starter Profile',
    description:
      'The MINIMUM APX surface for a PARCS vendor: apx-data + apx-events + apx-control. ' +
      'A subset of the full APX specification (apx-v1) — every path and schema here is ' +
      'identical to the full spec. See docs/parcs-starter-profile.md for the build order.',
  },
  servers: bundle.servers,
  security: bundle.security,
  tags: bundle.tags,
  paths: {},
  webhooks: bundle.webhooks,
  components: { securitySchemes: bundle.components.securitySchemes },
};

let missing = 0;
for (const path of PARCS_PATHS) {
  if (!bundle.paths[path]) {
    console.error(`[spec:profile] FAIL missing path in bundle: ${path}`);
    missing += 1;
    continue;
  }
  output.paths[path] = bundle.paths[path];
}
if (missing > 0) process.exit(1);

// Transitive $ref closure: copy every referenced component (any type).
const REF_PATTERN = /#\/components\/(\w+)\/([^"\\/]+)/g;
let changed = true;
while (changed) {
  changed = false;
  const text = JSON.stringify(output);
  for (const match of text.matchAll(REF_PATTERN)) {
    const [, type, name] = match;
    if (type === 'securitySchemes') continue;
    output.components[type] ??= {};
    if (!(name in output.components[type])) {
      const source = bundle.components?.[type]?.[name];
      if (source === undefined) {
        console.error(`[spec:profile] FAIL dangling $ref: #/components/${type}/${name}`);
        process.exit(1);
      }
      output.components[type][name] = source;
      changed = true;
    }
  }
}

const target = join(ROOT, 'spec', 'dist', 'apx-parcs.json');
writeFileSync(target, JSON.stringify(output, null, 2));
const schemaCount = Object.keys(output.components.schemas ?? {}).length;
console.log(
  `[spec:profile] apx-parcs.json written: ${Object.keys(output.paths).length} paths, ` +
    `${schemaCount} schemas (full bundle: ${Object.keys(bundle.paths).length} paths, ` +
    `${Object.keys(bundle.components.schemas).length} schemas)`
);
