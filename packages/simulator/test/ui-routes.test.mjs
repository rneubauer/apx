// The /sim routes behind the browser UI: scenario files, one-step and
// whole-scenario runs, the injector catalog, topics, and static serving.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Simulator } from '../src/index.mjs';
import { SCENARIOS_DIR } from '../src/kernel/scenario.mjs';

const sim = new Simulator({ world: 'apx-control' });
const call = async (method, path, body) => (await sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).body;
const TEMP_ID = 'zz-ui-routes-test';
after(() => {
  const f = join(SCENARIOS_DIR, `${TEMP_ID}.json`);
  if (existsSync(f)) unlinkSync(f);
});

test('lists the scenario files on disk with their world and step count', async () => {
  const { scenarios } = await call('GET', '/sim/scenarios');
  const demo = scenarios.find((s) => s.id === 'exit-lane-help-call');
  assert.equal(demo.world, 'apx-control');
  assert.ok(demo.steps > 5);
});

test('runs one step against the live world and reports the events it caused', async () => {
  await call('POST', '/sim/reset', { world: 'apx-control' });
  const step = {
    request: { method: 'POST', path: '/v1/commands', headers: { 'Idempotency-Key': 'ui-test-1' }, body: { commandType: 'vendGate', target: { id: 'b2…0002', className: 'VehicularAccess' } } },
    expect: { status: 202 },
    save: { cmd: '$.id' },
  };
  const r = await call('POST', '/sim/scenario/step', { step, token: 'default' });
  assert.equal(r.ok, true);
  assert.equal(r.response.status, 202);
  assert.ok(r.vars.cmd);
  assert.ok(r.events.some((e) => e.type === 'apx.control.command.status.v1'));
});

test('a failed expectation is reported on the step, not thrown', async () => {
  const r = await call('POST', '/sim/scenario/step', { step: { request: { method: 'GET', path: '/v1/lanes/b2…0002/current' }, expect: { status: 418 } } });
  assert.equal(r.ok, false);
  assert.match(r.error, /expected status 418, got 200/);
});

test('runs the demo scenario end to end from its own world', async () => {
  const scenario = await call('GET', '/sim/scenarios/exit-lane-help-call');
  const r = await call('POST', '/sim/scenario/run', { scenario });
  assert.equal(r.failed, 0, JSON.stringify(r.results.filter((x) => !x.ok).map((x) => x.error)));
  assert.equal(r.passed, scenario.steps.length);
});

test('saves a scenario under a safe id and refuses unsafe ones', async () => {
  const saved = await call('PUT', `/sim/scenarios/${TEMP_ID}`, { name: 't', world: 'default', steps: [] });
  assert.equal(saved.id, TEMP_ID);
  assert.deepEqual((await call('GET', `/sim/scenarios/${TEMP_ID}`)).steps, []);
  const bad = await sim.dispatch({ method: 'PUT', path: '/sim/scenarios/Bad_Name', headers: {}, body: '{"steps":[]}' });
  assert.equal(bad.status, 400);
  const noSteps = await sim.dispatch({ method: 'PUT', path: `/sim/scenarios/${TEMP_ID}`, headers: {}, body: '{"name":"x"}' });
  assert.equal(noSteps.status, 400);
});

test('the injector catalog names each parameter and carries a worked example', async () => {
  const { injectors } = await call('GET', '/sim/injectors/catalog');
  const arrives = injectors.find((i) => i.kind === 'vehicleArrives');
  assert.ok(arrives.params.includes('lane') && arrives.params.includes('plate'));
  assert.equal(arrives.example.kind, 'vehicleArrives');
  assert.ok(!injectors.some((i) => i.params.includes('kind')));
});

test('topics come from the apx-topics registry', async () => {
  const { topics } = await call('GET', '/sim/topics');
  assert.ok(topics.some((t) => t.type === 'apx.control.command.status.v1'));
});

test('the HTTP server serves the UI and nothing outside it', async () => {
  const server = await sim.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const root = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/ui/');
    const page = await fetch(`${base}/ui/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /APX Simulator/);
    assert.equal((await fetch(`${base}/ui/%2e%2e/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/ui/js/missing.js`)).status, 404);
  } finally {
    server.close();
  }
});
