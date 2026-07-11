#!/usr/bin/env node
/**
 * APX conformance CLI — partner self-certification.
 *
 *   npm run conformance -w @apx/conformance -- \
 *     --base-url http://localhost:4100 --client-id apx-operator --client-secret operator-secret
 */
import { runConformance } from './harness.js';

function arg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1]!;
  if (fallback !== undefined) return fallback;
  console.error(`Missing required argument --${name}`);
  process.exit(2);
}

const results = await runConformance({
  baseUrl: arg('base-url'),
  clientId: arg('client-id', 'apx-operator'),
  clientSecret: arg('client-secret', 'operator-secret'),
});

let failures = 0;
let currentClass = '';
for (const result of results) {
  if (result.conformanceClass !== currentClass) {
    currentClass = result.conformanceClass;
    console.log(`\n[${currentClass}]`);
  }
  const mark = result.ok ? 'PASS' : 'FAIL';
  if (!result.ok) failures += 1;
  console.log(`  ${mark}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
}

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures > 0 ? 1 : 0);
