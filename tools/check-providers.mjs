#!/usr/bin/env node
/**
 * Validates spec/providers/apx-providers.json, the APX provider registry
 * (Part 11 §11.4):
 *
 *   1. the file against spec/providers/provider.schema.json;
 *   2. providerId unique across every entry, and namespace unique among
 *      company entries (entries with no `parent`), retired ones included
 *      (a retired id or namespace is never reused);
 *   3. product entries: a `parent` names another entry that exists and is
 *      itself a company entry, the product's namespace equals its
 *      parent's, and an active product never sits under a retired company;
 *   4. add-only against the base branch: every base entry is still there,
 *      in the same position, with the same providerId, parent, namespace
 *      and registeredDate; a status may go from active to retired, never
 *      back; and when the file changed, `version` went up.
 *
 * The base is $APX_PROVIDERS_BASE when set, else origin/$GITHUB_BASE_REF
 * (set by GitHub Actions on pull requests), else origin/main. The add-only
 * check needs that ref and git. When either is missing (a shallow clone
 * with no base fetched, a push build, a tarball) the check says so and
 * skips step 4 instead of failing: locally it compares against whatever
 * origin/main your clone last fetched, and CI fetches the PR's base first.
 * A base without the file (the commit that introduces it) also skips.
 * $APX_PROVIDERS_BASE_FILE names a file to compare against instead of a ref,
 * and $APX_PROVIDERS_FILE a file to check instead of the registry itself
 * (tools/check-providers.test.mjs uses both).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'spec', 'providers');
const FILE = 'spec/providers/apx-providers.json';
const TAG = '[providers:check]';

const failures = [];
const fail = (msg) => failures.push(msg);

const schema = JSON.parse(readFileSync(join(DIR, 'provider.schema.json'), 'utf8'));
const doc = JSON.parse(readFileSync(process.env.APX_PROVIDERS_FILE ?? join(ROOT, FILE), 'utf8'));

// 1. schema
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(doc)) {
  for (const err of validate.errors) fail(`schema: ${err.instancePath || '/'} ${err.message}`);
}

// 2. uniqueness
const providers = Array.isArray(doc.providers) ? doc.providers : [];
const isCompany = (p) => p?.parent === undefined;
function checkUnique(field, entries, scope) {
  const seen = new Map();
  entries.forEach(({ p, i }) => {
    const value = p?.[field];
    if (value === undefined) return;
    if (seen.has(value)) fail(`duplicate ${field} "${value}"${scope} (entries ${seen.get(value)} and ${i})`);
    else seen.set(value, i);
  });
}
const indexed = providers.map((p, i) => ({ p, i }));
checkUnique('providerId', indexed, '');
checkUnique('namespace', indexed.filter(({ p }) => isCompany(p)), ' among company entries');

// 3. product entries and their parents
const byId = new Map();
for (const p of providers) if (p?.providerId && !byId.has(p.providerId)) byId.set(p.providerId, p);
providers.forEach((p, i) => {
  if (isCompany(p)) return;
  const label = `entry ${i} (${p.providerId})`;
  if (p.parent === p.providerId) return fail(`parent: ${label} names itself as its parent`);
  const parent = byId.get(p.parent);
  if (!parent) return fail(`parent: ${label} names parent ${p.parent}, which is not in the registry`);
  if (!isCompany(parent)) {
    return fail(`parent: ${label} names parent ${p.parent}, which is a product entry; a parent must be a company entry`);
  }
  if (p.namespace !== parent.namespace) {
    fail(`parent: ${label} has namespace "${p.namespace}" but its parent's is "${parent.namespace}"; a product entry shares its company's namespace`);
  }
  if (parent.status === 'retired' && p.status === 'active') {
    fail(`parent: ${label} is active but its parent ${p.parent} is retired; retire the product with its company`);
  }
});

// 4. add-only against the base branch
function baseRef() {
  if (process.env.APX_PROVIDERS_BASE) return process.env.APX_PROVIDERS_BASE;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return 'origin/main';
}

function readBase(ref) {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    return { skip: `base ${ref} is not available (no git, or not fetched)` };
  }
  try {
    return { doc: JSON.parse(git(['show', `${ref}:${FILE}`])) };
  } catch {
    return { skip: `${FILE} does not exist at ${ref} (this change introduces it)` };
  }
}

const IMMUTABLE = ['providerId', 'parent', 'namespace', 'registeredDate'];

function checkAddOnly(base) {
  const before = Array.isArray(base.providers) ? base.providers : [];
  if (providers.length < before.length) {
    fail(`add-only: ${before.length - providers.length} entr(y/ies) removed; retire an entry instead of deleting it`);
  }
  before.forEach((old, i) => {
    const now = providers[i];
    if (!now) return;
    for (const field of IMMUTABLE) {
      if (now[field] !== old[field]) {
        const show = (v) => (v === undefined ? '(absent)' : `"${v}"`);
        fail(`add-only: entry ${i} (${old.providerId}) changed ${field} from ${show(old[field])} to ${show(now[field])}; entries are never renumbered, reordered or re-keyed`);
      }
    }
    if (old.status === 'retired' && now.status !== 'retired') {
      fail(`add-only: entry ${i} (${old.providerId}) went from retired back to ${now.status}; register a new entry instead`);
    }
  });
  const changed = JSON.stringify(base) !== JSON.stringify(doc);
  if (changed && !(doc.version > base.version)) {
    fail(`version: the file changed but version is ${doc.version} (base ${base.version}); increment it`);
  }
  if (doc.version < base.version) fail(`version: went down from ${base.version} to ${doc.version}`);
}

// APX_PROVIDERS_BASE_FILE compares against a file on disk instead of a git
// ref (a reviewer checking a proposed edit by hand).
const ref = process.env.APX_PROVIDERS_BASE_FILE ?? baseRef();
const base = process.env.APX_PROVIDERS_BASE_FILE
  ? { doc: JSON.parse(readFileSync(process.env.APX_PROVIDERS_BASE_FILE, 'utf8')) }
  : readBase(ref);
if (base.skip) console.log(`${TAG} add-only check skipped: ${base.skip}`);
else checkAddOnly(base.doc);

if (failures.length > 0) {
  for (const msg of failures) console.error(`${TAG} FAIL ${msg}`);
  console.error(`${TAG} ${failures.length} failure(s)`);
  process.exit(1);
}
const active = providers.filter((p) => p.status === 'active').length;
const products = providers.filter((p) => !isCompany(p)).length;
console.log(
  `${TAG} ${process.env.APX_PROVIDERS_FILE ?? FILE} v${doc.version}: ${providers.length} provider(s) (${products} product entr${products === 1 ? 'y' : 'ies'}), ${active} active` +
    (base.skip ? '' : `; add-only against ${ref} ok`)
);
