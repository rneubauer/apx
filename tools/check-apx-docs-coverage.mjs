#!/usr/bin/env node
/**
 * Coverage guard for 03 Data Dictionary. Reads the bundled OpenAPI
 * document and the code-list registries directly, not through the model
 * the documents are generated from, and fails if any APX class, member
 * (nested members as owner.member), enumeration value or code-list entry
 * is missing from docs/apx-specification/03-data-dictionary.md. Classes
 * vendored from APDS 4.1 are left out: the APDS Data Dictionary defines
 * them (Annex B).
 *
 *   node tools/check-apx-docs-coverage.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
const DD = 'docs/apx-specification/03-data-dictionary.md';

const spec = JSON.parse(read('spec/dist/apx-v1.json'));
const apds = new Set(Object.keys(yaml.load(read('spec/vendor/apds/4.1/apds-api-4.1.yaml')).components.schemas));
const schemas = spec.components.schemas;

// What the spec defines.
const classes = [];
const members = [];
const values = [];
function walk(owner, prefix, schema, seen = new Set()) {
  if (!schema || seen.has(schema)) return;
  seen.add(schema);
  for (const part of schema.allOf ?? []) if (!part.$ref) walk(owner, prefix, part, seen);
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    members.push(`${owner}.${name}`);
    const inner = prop.type === 'array' ? prop.items : prop;
    for (const v of inner?.enum ?? []) values.push([`${owner}.${name}`, String(v)]);
    if (inner && !inner.$ref && (inner.properties || inner.allOf)) walk(owner, name, inner, seen);
  }
}
for (const [name, schema] of Object.entries(schemas)) {
  if (apds.has(name)) continue;
  if (schema.enum) schema.enum.forEach((v) => values.push([name, String(v)]));
  else { classes.push(name); walk(name, '', schema); }
}
const codes = readdirSync(join(ROOT, 'spec/registries')).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const reg = JSON.parse(read(`spec/registries/${f}`));
  return (reg.userDefinedCodeListEntries ?? []).map((e) => `${reg.name}|${e.definedValue}`);
});

// What the Data Dictionary lists. Tables are told apart by their header
// row; in member tables a class name is printed on its first row only.
const found = { classes: new Set(), members: new Set(), values: new Set(), codes: new Set() };
const cells = (line) => line.slice(1, -1).split(' | ').map((c) => c.trim().replace(/`/g, '').replace(/\\\|/g, '|'));
let mode = null;
let codeList = null;
let owner = null;
for (const line of read(DD).split('\n')) {
  const list = line.match(/^### A\.4\.\d+ External code list "(.+)"/);
  if (list) codeList = list[1];
  if (!line.startsWith('|')) continue;
  const [first, second] = cells(line);
  if (/^-+$/.test(first)) continue;
  if (first === 'Class name') { mode = second === 'Designation' ? 'class' : second === 'Parent class name' ? null : 'member'; continue; }
  if (first === 'Enumerated value name') { mode = 'value'; continue; }
  if (first === 'definedValue') { mode = 'code'; continue; }
  if (mode === 'class') found.classes.add(first);
  else if (mode === 'member') { owner = first || owner; found.members.add(`${owner}.${second}`); }
  else if (mode === 'value') found.values.add(first);
  else if (mode === 'code') found.codes.add(`${codeList}|${first}`);
}

const missing = [
  ...classes.filter((c) => !found.classes.has(c)).map((c) => `class ${c}`),
  ...members.filter((m) => !found.members.has(m)).map((m) => `member ${m}`),
  ...values.filter(([, v]) => !found.values.has(v)).map(([o, v]) => `enumeration value ${o} = ${v}`),
  ...codes.filter((c) => !found.codes.has(c)).map((c) => `code-list entry ${c.replace('|', ' = ')}`),
];
if (missing.length) {
  for (const m of missing.slice(0, 50)) console.error(`[apxdocs:coverage] FAIL ${DD} lacks ${m}`);
  if (missing.length > 50) console.error(`[apxdocs:coverage] … and ${missing.length - 50} more`);
  console.error('[apxdocs:coverage] Run `npm run apxdocs:build` after changing the spec.');
  process.exit(1);
}
console.log(`[apxdocs:coverage] ${DD} covers ${classes.length} classes, ${members.length} members, ${values.length} enumeration values and ${codes.length} code-list entries`);
