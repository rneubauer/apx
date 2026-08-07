#!/usr/bin/env node
/**
 * Vendor integrity guard.
 *
 * The APDS 4.1 OpenAPI spec is vendored VERBATIM and must never be edited.
 * This script recomputes the SHA-256 of every vendored artifact and compares
 * it against the recorded CHECKSUM.sha256. CI fails on any drift.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIRS = [join(ROOT, 'spec', 'vendor', 'apds', '4.1')];

let failures = 0;

for (const dir of VENDOR_DIRS) {
  const checksumFile = join(dir, 'CHECKSUM.sha256');
  let entries;
  try {
    entries = readFileSync(checksumFile, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    console.error(`[vendor:check] FAIL missing checksum file: ${checksumFile}`);
    failures += 1;
    continue;
  }

  const recorded = new Map();
  for (const line of entries) {
    // Format: "<sha256hex> *<filename>" (sha256sum binary-mode output)
    const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/);
    if (!match) {
      console.error(`[vendor:check] FAIL unparseable checksum line: "${line}"`);
      failures += 1;
      continue;
    }
    recorded.set(match[2], match[1]);
  }

  for (const [filename, expected] of recorded) {
    const filePath = join(dir, filename);
    let actual;
    try {
      actual = createHash('sha256').update(readFileSync(filePath)).digest('hex');
    } catch {
      console.error(`[vendor:check] FAIL vendored file missing: ${filePath}`);
      failures += 1;
      continue;
    }
    if (actual !== expected) {
      console.error(
        `[vendor:check] FAIL checksum mismatch for ${filename}\n` +
          `  expected ${expected}\n  actual   ${actual}\n` +
          `  Vendored APDS artifacts must never be edited. Restore the verbatim file.`
      );
      failures += 1;
    } else {
      console.log(`[vendor:check] OK ${filename}`);
    }
  }

  // Any YAML file present in the vendor dir but not covered by a checksum is drift too.
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.yaml') && !recorded.has(file)) {
      console.error(`[vendor:check] FAIL untracked vendored file (no checksum): ${file}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`[vendor:check] ${failures} failure(s)`);
  process.exit(1);
}
console.log('[vendor:check] all vendored artifacts verified');
