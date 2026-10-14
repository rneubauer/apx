/**
 * The vetting suite in the Present view (src/kernel/vetting.mjs): every
 * scenario of docs/scenarios/by-module is listed under its world, and each
 * one runs on its own (its first step sets the stage by replaying the
 * scenarios before it in its module) with every step as the suite expects,
 * apart from exchanges the suite marks as known spec gaps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Simulator } from '../src/index.mjs';
import { APX_DIR } from '../src/kernel/spec.mjs';

const SUITE = join(APX_DIR, 'docs', 'scenarios', 'by-module');
const MARKERS = readdirSync(SUITE)
  .map((d) => join(SUITE, d, 'scenarios.md'))
  .filter((f) => existsSync(f))
  .reduce((n, f) => n + (readFileSync(f, 'utf8').match(/<!--\s*apx:scenario\s/g) ?? []).length, 0);

const sim = new Simulator({ world: 'default' });
const call = async (method, path, body) => sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

test('every vetting scenario is listed, under the world its module runs in', async () => {
  const { vetting } = (await call('GET', '/sim/scenarios')).body;
  assert.equal(vetting.length, MARKERS);
  for (const v of vetting) {
    assert.match(v.id, /^vetting~apx-[a-z-]+~[A-Z]+-\d+/);
    assert.equal(v.world, v.module, `${v.id} runs in its module's world`);
    assert.ok(['happy', 'lifecycle', 'edge', 'refusal', 'security'].includes(v.kind), `${v.id} kind ${v.kind}`);
  }
});

test('a vetting scenario opens with a step that sets the stage, then the suite exchanges', async () => {
  const sc = (await call('GET', `/sim/scenarios/${encodeURIComponent('vetting~apx-control~CTL-02')}`)).body;
  assert.equal(sc.world, 'apx-control');
  assert.deepEqual(sc.steps[0].prepare, { module: 'apx-control', before: 'CTL-02' });
  assert.match(sc.steps[0].narration, /replays CTL-01 first/);
  assert.ok(sc.steps.slice(1).some((s) => s.request?.path === '/v1/commands'));
});

test('the suite is read-only from the UI', async () => {
  const res = await call('PUT', `/sim/scenarios/${encodeURIComponent('vetting~apx-control~CTL-01')}`, { name: 'x', steps: [] });
  assert.equal(res.status, 400);
});

test('every vetting scenario passes on its own, apart from known spec gaps', async () => {
  const { vetting } = (await call('GET', '/sim/scenarios')).body;
  const failures = [];
  for (const v of vetting) {
    const scenario = (await call('GET', `/sim/scenarios/${encodeURIComponent(v.id)}`)).body;
    const run = (await call('POST', '/sim/scenario/run', { scenario })).body;
    run.results.forEach((r, i) => {
      if (!r.ok && !scenario.steps[i].knownGap) failures.push(`${v.id} step ${i + 1} (${scenario.steps[i].name}): ${r.error}`);
    });
  }
  assert.deepEqual(failures, []);
});
