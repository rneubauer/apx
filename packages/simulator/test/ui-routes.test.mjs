// The /sim routes behind the browser UI: scenario files, one-step and
// whole-scenario runs, the injector catalog, topics, and static serving.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Save into a private copy of scenarios/: web-bundle.test.mjs builds from the
// real folder in a parallel process and would pick up the temporary file.
const SCRATCH = mkdtempSync(join(tmpdir(), 'apx-sim-scenarios-'));
cpSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'scenarios'), SCRATCH, { recursive: true });
process.env.APX_SIM_SCENARIOS_DIR = SCRATCH;
const { Simulator } = await import('../src/index.mjs');

const sim = new Simulator({ world: 'apx-control' });
const call = async (method, path, body) => (await sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })).body;
const TEMP_ID = 'zz-ui-routes-test';
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

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

test('the status names the APX edition the simulator serves, for the UI header', async () => {
  const status = await call('GET', '/sim');
  assert.match(status.edition.edition, /^\d+\.\d+\.\d+/);
  assert.equal(typeof status.edition.status, 'string');
  assert.equal(status.edition.apdsVersion, '4.1');
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

test('a request step reports each assertion with expected and actual', async () => {
  await call('POST', '/sim/reset', { world: 'apx-control' });
  await call('POST', '/sim/inject', { kind: 'vehicleArrives', lane: 'b2…0002', ticketNumber: 'T-1001', plate: 'SYN-1234' });
  const step = {
    request: { method: 'GET', path: '/v1/lanes/b2…0002/current' },
    expect: { status: 200, body: { currentTicket: { ticketNumber: 'T-1001', paidInFull: true } } },
  };
  const r = await call('POST', '/sim/scenario/step', { step });
  assert.equal(r.ok, false);
  assert.match(r.error, /body mismatch/);
  assert.deepEqual(r.checks.map((c) => [c.check, c.path ?? null, c.ok]), [
    ['status', null, true],
    ['body', 'currentTicket.ticketNumber', true],
    ['body', 'currentTicket.paidInFull', false],
  ]);
  assert.equal(r.checks[2].actual, false);
  assert.equal(r.checks[2].expected, true);
});

test('a failed status still reports the problem check alongside it', async () => {
  const step = { request: { method: 'POST', path: '/v1/commands', token: '<apx.data:read only>', body: { commandType: 'vendGate', target: { id: 'b2…0002', className: 'VehicularAccess' } } }, expect: { status: 202, problem: 'insufficient-scope' } };
  const r = await call('POST', '/sim/scenario/step', { step });
  assert.equal(r.ok, false);
  const status = r.checks.find((c) => c.check === 'status');
  assert.equal(status.ok, false);
  assert.equal(status.actual, 403);
  assert.deepEqual(r.checks.find((c) => c.check === 'problem'), { check: 'problem', expected: 'insufficient-scope', actual: 'insufficient-scope', ok: true });
});

test('an events step reports its count bound as a check', async () => {
  const r = await call('POST', '/sim/scenario/step', { step: { events: { min: 0, exactly: 100000 } } });
  const [min, exactly] = r.checks;
  assert.equal(min.bound, 'min');
  assert.equal(min.ok, true);
  assert.equal(exactly.bound, 'exactly');
  assert.equal(exactly.ok, false);
  assert.equal(exactly.actual, r.eventCount);
  assert.match(r.error, /expected exactly 100000/);
});
