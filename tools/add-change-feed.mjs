#!/usr/bin/env node
/**
 * One-off editor for Part 5 §5.2 rule 8: puts the `mode`/`cursor`
 * parameters and the ChangeFeedPage alternative on the APX list routes
 * of stateful resources, and declares the cursor refusal (404) where the
 * operation lacks one. Edits spec/openapi/apx.yaml in place, as text, so
 * the file's formatting survives. Idempotent: an operation that already
 * references ModeParam is skipped.
 *
 *   node tools/add-change-feed.mjs [operationId ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'spec', 'openapi', 'apx.yaml');

const DEFAULT_OPS = [
  'get-apx-v1-commands',
  'get-apx-v1-alerts',
  'get-apx-v1-violations',
  'get-apx-v1-valet-tickets',
  'get-apx-v1-credentials',
  'get-apx-v1-validations-programs',
  'get-apx-v1-validations-redemptions',
  'get-apx-v1-payments',
  'get-apx-v1-tolling-transactions',
  'get-apx-v1-charging-sessions',
  'get-apx-v1-access-events',
];
const ops = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_OPS;

const lines = readFileSync(FILE, 'utf8').split('\n');
const PARAM_LINES = ['        - $ref: "#/components/parameters/ModeParam"', '        - $ref: "#/components/parameters/CursorParam"'];
const CURSOR_404 = [
  '        "404":',
  '          description: "mode=change only: the cursor is unknown, older than the retention window, or was issued for another (class, credential, filter set) — problem type `target-not-found`; re-sync with mode=full (Part 5 §5.2 rules 2, 5 and 8)."',
  '          content:',
  '            application/problem+json:',
  '              schema: { $ref: "#/components/schemas/Problem" }',
];

let changed = 0;
for (const opId of ops) {
  const start = lines.findIndex((l) => l.trim() === `operationId: ${opId}`);
  if (start === -1) {
    console.error(`[change-feed] no operation ${opId}`);
    continue;
  }
  let end = lines.findIndex((l, i) => i > start && /^\s+operationId: /.test(l));
  if (end === -1) end = lines.length;
  const op = lines.slice(start, end);
  if (op.some((l) => l.includes('ModeParam'))) {
    console.log(`[change-feed] ${opId} already has the feed`);
    continue;
  }
  const pIdx = op.findIndex((l) => l.trim() === 'parameters:');
  if (pIdx === -1) {
    console.error(`[change-feed] ${opId} has no parameters block`);
    continue;
  }
  op.splice(pIdx + 1, 0, ...PARAM_LINES);
  const r200 = op.findIndex((l) => l.trim() === '"200":');
  const sIdx = op.findIndex((l, i) => i > r200 && l.trim() === 'schema:' && l.startsWith('              '));
  if (sIdx === -1) {
    console.error(`[change-feed] ${opId}: 200 schema not found`);
    continue;
  }
  const indent = op[sIdx].match(/^\s*/)[0].length;
  let bEnd = sIdx + 1;
  while (bEnd < op.length && (op[bEnd].trim() === '' || op[bEnd].match(/^\s*/)[0].length > indent)) bEnd += 1;
  const body = op.slice(sIdx + 1, bEnd).map((l) => (l.trim() === '' ? l : '    ' + l));
  const pad = ' '.repeat(indent + 2);
  const first = body.findIndex((l) => l.trim() !== '');
  body[first] = body[first].replace(/^(\s*)/, (m) => m.slice(0, -2) + '- ');
  const replacement = [`${pad}oneOf:`, `${pad}  - $ref: "#/components/schemas/ChangeFeedPage"`, ...body];
  op.splice(sIdx + 1, bEnd - sIdx - 1, ...replacement);
  if (!op.some((l) => l.trim() === '"404":')) {
    const respIdx = op.findIndex((l) => l.trim() === 'responses:');
    let last = respIdx;
    for (let i = respIdx + 1; i < op.length; i += 1) if (/^        "\d{3}"/.test(op[i])) last = i;
    let j = last + 1;
    while (j < op.length && op[j].match(/^\s*/)[0].length > 8) j += 1;
    op.splice(j, 0, ...CURSOR_404);
  }
  lines.splice(start, end - start, ...op);
  changed += 1;
  console.log(`[change-feed] ${opId}: mode/cursor + ChangeFeedPage alternative`);
}
writeFileSync(FILE, lines.join('\n'));
console.log(`[change-feed] ${changed} operation(s) updated`);
