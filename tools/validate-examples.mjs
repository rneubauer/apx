#!/usr/bin/env node
/**
 * Validates every schema-level `examples` entry in the BUNDLED spec
 * (spec/dist/apx-v1.json) against its own schema using Ajv 2020-12.
 * Run after `npm run spec:bundle`.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'spec', 'dist', 'apx-v1.json');

const doc = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const schemas = doc.components?.schemas ?? {};

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(ajv);

// Register the whole bundle under a resolvable id so intra-document
// $refs ("#/components/schemas/X") resolve.
ajv.addSchema({ ...doc, $id: 'apx://bundle' });

let checked = 0;
let failures = 0;

for (const [name, schema] of Object.entries(schemas)) {
  if (!Array.isArray(schema.examples) || schema.examples.length === 0) continue;
  const validate = ajv.compile({ $ref: `apx://bundle#/components/schemas/${name}` });
  schema.examples.forEach((example, i) => {
    checked += 1;
    if (!validate(example)) {
      failures += 1;
      console.error(`[examples:check] FAIL ${name} example[${i}]`);
      for (const err of validate.errors) console.error(`  ${err.instancePath} ${err.message}`);
    }
  });
}

if (failures > 0) {
  console.error(`[examples:check] ${failures} invalid example(s) of ${checked}`);
  process.exit(1);
}
console.log(`[examples:check] ${checked} schema example(s) valid`);
