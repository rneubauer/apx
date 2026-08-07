#!/usr/bin/env node
/**
 * Validates every spec/registries/apx-*.json against registry.schema.json
 * (APDS UserDefinedCodeList shape) and enforces uniqueness of definedValue
 * and entryIndex within each list.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REG_DIR = join(ROOT, 'spec', 'registries');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(readFileSync(join(REG_DIR, 'registry.schema.json'), 'utf8'));
const validate = ajv.compile(schema);

let failures = 0;
const files = readdirSync(REG_DIR).filter((f) => f.startsWith('apx-') && f.endsWith('.json'));

if (files.length === 0) {
  console.error('[registries:check] FAIL no apx-*.json registries found');
  process.exit(1);
}

for (const file of files) {
  const doc = JSON.parse(readFileSync(join(REG_DIR, file), 'utf8'));
  if (!validate(doc)) {
    console.error(`[registries:check] FAIL ${file}`);
    for (const err of validate.errors) console.error(`  ${err.instancePath} ${err.message}`);
    failures += 1;
    continue;
  }
  const values = new Set();
  const indexes = new Set();
  for (const entry of doc.userDefinedCodeListEntries) {
    if (values.has(entry.definedValue)) {
      console.error(`[registries:check] FAIL ${file}: duplicate definedValue "${entry.definedValue}"`);
      failures += 1;
    }
    if (indexes.has(entry.entryIndex)) {
      console.error(`[registries:check] FAIL ${file}: duplicate entryIndex ${entry.entryIndex}`);
      failures += 1;
    }
    values.add(entry.definedValue);
    indexes.add(entry.entryIndex);
  }
  console.log(`[registries:check] checked ${file} (${doc.userDefinedCodeListEntries.length} entries)`);
}

if (failures > 0) {
  console.error(`[registries:check] ${failures} failure(s)`);
  process.exit(1);
}
console.log('[registries:check] all registries valid');
