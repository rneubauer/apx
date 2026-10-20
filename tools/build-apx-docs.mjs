#!/usr/bin/env node
/**
 * Builds the APX Specification document set (docs/apx-specification/),
 * modelled on the APDS 4.1 technical documentation:
 *
 *   01 Overview                 hand-written (01-overview.md)
 *   02 Information Model        src/_im-*.md + src/im/<module>.md + generated diagrams and tables
 *   03 Data Dictionary          generated from spec/dist/apx-v1.yaml
 *   04 Use Case Document        src/uc-part1.md + src/uc-part2.md
 *   05 Interface Specification  generated from spec/dist/apx-v1.yaml
 *   06 Requests to APDS         src/06-apds-requests.md + generated proposal tables
 *
 *   node tools/build-apx-docs.mjs          write
 *   node tools/build-apx-docs.mjs --check  fail if any generated document is stale
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModel, MODULES } from './apx-docs/model.mjs';
import { header, table, code } from './apx-docs/md.mjs';
import { renderDataDictionary, dataDictionaryStats } from './apx-docs/data-dictionary.mjs';
import { renderInformationModel, IM_SECTIONS } from './apx-docs/information-model.mjs';
import { renderInterface } from './apx-docs/interface.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'apx-specification');
const SRC = join(OUT, 'src');
const CHECK = process.argv.includes('--check');
const SELF = 'tools/build-apx-docs.mjs from spec/dist/apx-v1.yaml and docs/apx-specification/src/';
const PROPOSAL_MARKER = '<!-- generate:proposal-summary -->';
const TIER_NAMES = { 1: 'propose now', 2: 'proven in APX, propose next', 3: 'for discussion' };

const errors = [];
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

function src(name) {
  const path = join(SRC, name);
  if (!existsSync(path)) { errors.push(`docs/apx-specification/src/${name} is missing`); return ''; }
  return read(path).trim();
}

function fragments() {
  return Object.fromEntries(MODULES.map((m) => {
    const text = src(`im/${m.dir}.md`);
    const parts = {};
    const marks = [...text.matchAll(/^## (.+?)\s*$/gm)].filter((x) => IM_SECTIONS.includes(x[1]));
    marks.forEach((x, i) => { parts[x[1]] = text.slice(x.index + x[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length).trim(); });
    if (text) IM_SECTIONS.filter((s) => !parts[s]).forEach((s) => errors.push(`src/im/${m.dir}.md: missing "## ${s}"`));
    return [m.dir, parts];
  }));
}

function proposalSummary(model) {
  const all = model.proposals.all;
  const label = (p) => (p.kind === 'enum' ? (p.change === 'new' ? 'New enumeration' : 'New values for an APDS enumeration') : (p.change === 'new' ? 'New class' : 'Additions to an APDS class'));
  const out = [`${all.length} data elements are proposed. The full text of each, in the APDS Data Dictionary format, is in \`docs/apds-submission/03-data-dictionary.md\`.`, ''];
  for (const tier of [1, 2, 3]) {
    const rows = all.filter((p) => p.tier === tier).map((p) => [code(p.name), label(p), p.domain, p.pkg, p.apx]);
    out.push(`### Tier ${tier}: ${TIER_NAMES[tier]} (${rows.length})`, '', rows.length ? table(['Element', 'Change', 'APDS domain', 'Package', 'Comes from in APX'], rows) : 'None.', '');
  }
  return out.join('\n');
}

function edition(model) {
  const pkg = JSON.parse(read(join(ROOT, 'package.json')));
  return `APX Specification · APX ${pkg.version} · OpenAPI ${model.version ?? ''} · built on APDS 4.1 (2026-01-14) · Draft`.replace(' · OpenAPI  ·', ' ·');
}

function stripTitle(text) {
  return text.replace(/^# .+\n+(\*.+\*\n+)?/, '');
}

function build() {
  const model = loadModel(ROOT);
  const ed = edition(model);
  const requests = src('06-apds-requests.md');
  if (requests && !requests.includes(PROPOSAL_MARKER)) errors.push(`src/06-apds-requests.md: marker ${PROPOSAL_MARKER} missing`);
  return {
    model,
    docs: {
      '02-information-model.md': renderInformationModel(model, fragments(), src('_im-intro.md'), src('_im-outro.md'), header('APX Information Model', ed, SELF)),
      '03-data-dictionary.md': renderDataDictionary(model, src('_dd-intro.md'), header('APX Data Dictionary', ed, SELF)),
      '04-use-cases.md': [header('APX Use Case Document', ed, SELF), stripTitle(src('uc-part1.md')), '', stripTitle(src('uc-part2.md'))].join('\n'),
      '05-interface-specification.md': renderInterface(model, src('_if-intro.md'), header('APX Interface Specification', ed, SELF)),
      '06-apds-requests.md': [header('APX Requests to APDS', ed, SELF), stripTitle(requests).replace(PROPOSAL_MARKER, proposalSummary(model))].join('\n'),
    },
  };
}

function writeOrCheck(docs) {
  let stale = 0;
  for (const [name, text] of Object.entries(docs)) {
    const path = join(OUT, name);
    const body = text.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    if ((existsSync(path) ? read(path) : '') === body) continue;
    if (CHECK) { console.error(`[apx-docs] ${name} is stale; run node tools/build-apx-docs.mjs`); stale++; } else writeFileSync(path, body);
  }
  return stale;
}

function main() {
  const { model, docs } = build();
  if (!existsSync(join(OUT, '01-overview.md'))) errors.push('docs/apx-specification/01-overview.md is missing');
  if (errors.length) { console.error(`[apx-docs] ${errors.length} problem(s):\n  ${errors.join('\n  ')}`); process.exit(1); }
  if (writeOrCheck(docs)) process.exit(1);
  const s = dataDictionaryStats(model);
  console.log(`[apx-docs] ${s.classes} classes, ${s.attributes} attributes, ${s.associations} associations, ${s.enumerations} enumerations, `
    + `${s.codeLists} code lists, ${model.operations.length} operations; definitions: ${s.editorial} editorial, `
    + `${s.undefinedInSpec} members and ${s.undefinedValues} enumeration values still undefined`);
}

main();
