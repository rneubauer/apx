/**
 * The bootstrap document's `providerId` (Part 16 §16.1, Part 11 §11.4) and
 * `installationId` (Part 16 §16.1, Part 4 §4.1b): the simulator names Umojo's
 * registry entry and a fixed installation by default, a host can name its own
 * or leave either member out, and every answer stays valid against the bundle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Simulator } from '../src/index.mjs';
import { SIMULATOR_PROVIDER_ID, SIMULATOR_INSTALLATION_ID } from '../src/domains/discovery.mjs';

const REGISTRY = JSON.parse(
  readFileSync(new URL('../../../spec/providers/apx-providers.json', import.meta.url), 'utf8')
);
const OTHER_PROVIDER = '0b6f3c1e-2a4d-4f5e-9c8b-7a6d5e4f3c2b';
const OTHER_INSTALLATION = '6c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const bootstrap = (sim, host) =>
  sim.request('GET', '/.well-known/apx-configuration', { headers: host ? { host } : {} });
const inject = (sim, body) => sim.request('POST', '/sim/inject', { body });

test('the default providerId is an active entry in the provider registry', () => {
  const entry = REGISTRY.providers.find((p) => p.providerId === SIMULATOR_PROVIDER_ID);
  assert.ok(entry, 'SIMULATOR_PROVIDER_ID is registered');
  assert.equal(entry.status, 'active');
  assert.equal(entry.namespace, 'umojo');
});

test('the bootstrap document carries the simulator providerId by default', async () => {
  const sim = new Simulator({ world: 'apx-discovery' });
  const res = await bootstrap(sim);
  assert.equal(res.status, 200);
  assert.equal(res.body.providerId, SIMULATOR_PROVIDER_ID);
  const harbor = await bootstrap(sim, 'parcs.harbor-deck.example');
  assert.equal(harbor.body.providerId, SIMULATOR_PROVIDER_ID);
  assert.deepEqual(sim.contractViolations, []);
});

test('a host names its own providerId, or null leaves the member out', async () => {
  const sim = new Simulator({ world: 'apx-discovery' });
  await inject(sim, { kind: 'hostConfig', set: { providerId: OTHER_PROVIDER } });
  assert.equal((await bootstrap(sim)).body.providerId, OTHER_PROVIDER);
  await inject(sim, { kind: 'hostConfig', set: { providerId: null } });
  const without = await bootstrap(sim);
  assert.equal(without.status, 200);
  assert.equal('providerId' in without.body, false);
  assert.deepEqual(sim.contractViolations, []);
});

test('the bootstrap document carries a fixed installationId by default', async () => {
  const sim = new Simulator({ world: 'apx-discovery' });
  const first = await bootstrap(sim);
  assert.equal(first.status, 200);
  assert.equal(first.body.installationId, SIMULATOR_INSTALLATION_ID);
  // Never changes for the life of the installation: a second read, and a fresh
  // simulator on the same world, give the same value.
  assert.equal((await bootstrap(sim)).body.installationId, SIMULATOR_INSTALLATION_ID);
  const again = new Simulator({ world: 'apx-discovery' });
  assert.equal((await bootstrap(again)).body.installationId, SIMULATOR_INSTALLATION_ID);
  assert.notEqual(SIMULATOR_INSTALLATION_ID, SIMULATOR_PROVIDER_ID);
  assert.deepEqual(sim.contractViolations, []);
});

test('a host names its own installationId, or null leaves the member out', async () => {
  const sim = new Simulator({ world: 'apx-discovery' });
  await inject(sim, { kind: 'hostConfig', set: { installationId: OTHER_INSTALLATION } });
  const own = await bootstrap(sim);
  assert.equal(own.body.installationId, OTHER_INSTALLATION);
  assert.equal(own.body.providerId, SIMULATOR_PROVIDER_ID);
  await inject(sim, { kind: 'hostConfig', set: { installationId: null } });
  const without = await bootstrap(sim);
  assert.equal(without.status, 200);
  assert.equal('installationId' in without.body, false);
  assert.deepEqual(sim.contractViolations, []);
});
