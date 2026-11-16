/**
 * Cases for tools/check-providers.mjs (Part 11 §11.4): company and product
 * entries, the parent rules, namespace uniqueness among company entries, and
 * add-only behaviour. Each case writes a registry and a base to a temporary
 * directory and runs the checker on them, so no git ref is needed.
 *
 *   node --test tools/check-providers.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CHECKER = join(dirname(fileURLToPath(import.meta.url)), 'check-providers.mjs');

const ACME = '11111111-1111-4111-8111-111111111111';
const ACME_LPR = '22222222-2222-4222-8222-222222222222';
const ACME_PAY = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const UNKNOWN = '55555555-5555-4555-8555-555555555555';

const entry = (providerId, namespace, more = {}) => ({
  providerId,
  name: `Org ${namespace}`,
  namespace,
  roles: ['platform'],
  contact: 'apx@example.com',
  status: 'active',
  registeredDate: '2026-11-13',
  ...more,
});
const registry = (version, providers) => ({
  name: 'apx-providers',
  version,
  locator: 'https://apx-standard.org/providers/apx-providers.json',
  providers,
});
const company = entry(ACME, 'acme');
const product = entry(ACME_LPR, 'acme', { parent: ACME, name: 'Acme LPR', roles: ['lpr'] });

/** Runs the checker on `doc` against `base`; returns { ok, out }. */
function check(doc, base = doc) {
  const dir = mkdtempSync(join(tmpdir(), 'apx-providers-'));
  try {
    const file = join(dir, 'doc.json');
    const baseFile = join(dir, 'base.json');
    writeFileSync(file, JSON.stringify(doc));
    writeFileSync(baseFile, JSON.stringify(base));
    const res = spawnSync(process.execPath, [CHECKER], {
      env: { ...process.env, APX_PROVIDERS_FILE: file, APX_PROVIDERS_BASE_FILE: baseFile },
      encoding: 'utf8',
    });
    return { ok: res.status === 0, out: `${res.stdout}${res.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const passes = (doc, base) => {
  const r = check(doc, base);
  assert.ok(r.ok, r.out);
};
const failsWith = (doc, base, pattern) => {
  const r = check(doc, base);
  assert.equal(r.ok, false, `expected a failure, got:\n${r.out}`);
  assert.match(r.out, pattern);
};

test('the real registry passes', () => {
  const res = spawnSync(process.execPath, [CHECKER], { encoding: 'utf8' });
  assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
});

test('a company entry with a product entry sharing its namespace passes', () => {
  passes(registry(1, [company, product]));
});

test('two product entries under one company pass', () => {
  passes(registry(1, [company, product, entry(ACME_PAY, 'acme', { parent: ACME, roles: ['payments'] })]));
});

test('two company entries with the same namespace fail', () => {
  failsWith(registry(1, [company, entry(OTHER, 'acme')]), undefined, /duplicate namespace "acme" among company entries/);
});

test('a product whose parent is not in the registry fails', () => {
  failsWith(registry(1, [company, entry(ACME_LPR, 'acme', { parent: UNKNOWN })]), undefined, /not in the registry/);
});

test('a product whose parent is itself a product fails', () => {
  const grandchild = entry(ACME_PAY, 'acme', { parent: ACME_LPR });
  failsWith(registry(1, [company, product, grandchild]), undefined, /which is a product entry; a parent must be a company entry/);
});

test('a product that names itself as parent fails', () => {
  failsWith(registry(1, [company, entry(ACME_LPR, 'acme', { parent: ACME_LPR })]), undefined, /names itself as its parent/);
});

test("a product whose namespace differs from its parent's fails", () => {
  failsWith(
    registry(1, [company, entry(ACME_LPR, 'acmelpr', { parent: ACME })]),
    undefined,
    /namespace "acmelpr" but its parent's is "acme"/
  );
});

test('a product cannot claim another company\'s namespace through a parent', () => {
  const other = entry(OTHER, 'other');
  failsWith(
    registry(1, [company, other, entry(ACME_LPR, 'other', { parent: ACME })]),
    undefined,
    /namespace "other" but its parent's is "acme"/
  );
});

test('an active product under a retired company fails', () => {
  failsWith(
    registry(1, [{ ...company, status: 'retired' }, product]),
    undefined,
    /is active but its parent .* is retired/
  );
});

test('a parent that is not a lowercase UUID fails the schema', () => {
  failsWith(registry(1, [company, entry(ACME_LPR, 'acme', { parent: 'acme' })]), undefined, /schema: \/providers\/1\/parent/);
});

test('add-only: appending a product entry with a version bump passes', () => {
  passes(registry(2, [company, product]), registry(1, [company]));
});

test('add-only: appending without a version bump fails', () => {
  failsWith(registry(1, [company, product]), registry(1, [company]), /version: the file changed/);
});

test('add-only: removing a product entry fails', () => {
  failsWith(registry(3, [company]), registry(2, [company, product]), /add-only: 1 entr\(y\/ies\) removed/);
});

test('add-only: giving an existing company entry a parent fails', () => {
  const base = registry(1, [company, entry(OTHER, 'other')]);
  const now = registry(2, [company, entry(OTHER, 'acme', { parent: ACME })]);
  failsWith(now, base, /changed parent from \(absent\) to "11111111/);
});

test('add-only: moving a product to another parent fails', () => {
  const other = entry(OTHER, 'acme2');
  const base = registry(1, [company, other, product]);
  const now = registry(2, [company, other, { ...product, parent: OTHER, namespace: 'acme2' }]);
  failsWith(now, base, /changed parent from "11111111.*" to "44444444/);
});

test('add-only: retiring a product entry passes; making it active again fails', () => {
  const base = registry(1, [company, product]);
  const retired = registry(2, [company, { ...product, status: 'retired' }]);
  passes(retired, base);
  failsWith(registry(3, [company, product]), retired, /went from retired back to active/);
});
