#!/usr/bin/env node
/**
 * Validates the JSON payloads embedded in docs/scenarios/*.md against the
 * BUNDLED spec (spec/dist/apx-v1.json) so the scenario walkthroughs can
 * never drift from the specification. Run after `npm run spec:bundle`.
 *
 * A payload opts in with one or more marker comments directly above its
 * fenced ```json block:
 *
 *   <!-- apx:validate LaneStatus -->            whole block is a LaneStatus
 *   <!-- apx:validate Posting at /postings/0 -->  subtree at a JSON pointer
 *
 * Unannotated blocks (create-shape request bodies, abridged native APDS
 * payloads, non-APX JSON) are not validated.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'spec', 'dist', 'apx-v1.json');
const SCENARIOS = join(ROOT, 'docs', 'scenarios');

const doc = JSON.parse(readFileSync(BUNDLE, 'utf8'));

// Upstream defect in the vendored APDS 4.1 spec: `Reference` declares
// `maxProperties: 1` while requiring BOTH `id` and `className`, which no
// object can satisfy. The vendored file is checksum-guarded and must not be
// edited, so the contradiction is relaxed here, for validation only.
delete doc.components.schemas.Reference.minProperties;
delete doc.components.schemas.Reference.maxProperties;

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(ajv);
ajv.addSchema({ ...doc, $id: 'apx://bundle' });

const MARKER = /^<!--\s*apx:validate\s+(\w+)(?:\s+at\s+(\/\S*))?\s*-->$/;

function resolvePointer(value, pointer) {
  if (pointer === '/') return value;
  let node = value;
  for (const raw of pointer.split('/').slice(1)) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    node = Array.isArray(node) ? node[Number(key)] : node?.[key];
    if (node === undefined) return undefined;
  }
  return node;
}

let checked = 0;
let failures = 0;

const files = readdirSync(SCENARIOS)
  .filter((f) => f.endsWith('.md'))
  .sort();

for (const file of files) {
  const lines = readFileSync(join(SCENARIOS, file), 'utf8').split('\n');
  let markers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const marker = lines[i].trim().match(MARKER);
    if (marker) {
      markers.push({ schema: marker[1], pointer: marker[2] ?? '/', line: i + 1 });
      continue;
    }
    if (lines[i].trim() === '' && markers.length > 0) continue;
    if (lines[i].trim() === '```json' && markers.length > 0) {
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== '```') end += 1;
      let payload;
      try {
        payload = JSON.parse(lines.slice(start, end).join('\n'));
      } catch (e) {
        failures += 1;
        console.error(`[scenarios:check] FAIL ${file}:${start} — invalid JSON: ${e.message}`);
        markers = [];
        i = end;
        continue;
      }
      for (const { schema, pointer, line } of markers) {
        checked += 1;
        if (!doc.components.schemas[schema]) {
          failures += 1;
          console.error(`[scenarios:check] FAIL ${file}:${line} — unknown schema "${schema}"`);
          continue;
        }
        const target = resolvePointer(payload, pointer);
        if (target === undefined) {
          failures += 1;
          console.error(`[scenarios:check] FAIL ${file}:${line} — pointer ${pointer} not found in payload`);
          continue;
        }
        const validate = ajv.compile({ $ref: `apx://bundle#/components/schemas/${schema}` });
        if (!validate(target)) {
          failures += 1;
          console.error(`[scenarios:check] FAIL ${file}:${line} — ${schema}${pointer === '/' ? '' : ` at ${pointer}`}`);
          for (const err of validate.errors) console.error(`  ${err.instancePath} ${err.message}`);
        }
      }
      markers = [];
      i = end;
      continue;
    }
    if (markers.length > 0) {
      failures += 1;
      console.error(
        `[scenarios:check] FAIL ${file}:${markers[0].line} — apx:validate marker without a \`\`\`json block`
      );
      markers = [];
    }
  }
}

if (failures > 0) {
  console.error(`[scenarios:check] ${failures} failure(s) across ${checked} validated payload(s)`);
  process.exit(1);
}
console.log(`[scenarios:check] ${checked} scenario payload(s) valid across ${files.length} file(s)`);
