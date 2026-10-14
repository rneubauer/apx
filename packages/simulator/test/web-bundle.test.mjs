/**
 * The static-site build (web/build.mjs): the browser bundle loads with no
 * Node built-ins, answers the UI's requests in-process, and runs every
 * narrated scenario as the server does. Node has the browser globals the
 * bundle needs (fetch, Response, Headers, EventTarget, MessageEvent).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SIM = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = mkdtempSync(join(tmpdir(), 'apx-sim-web-'));
const SCENARIOS = readdirSync(join(SIM, 'scenarios')).filter((f) => f.endsWith('.json'));

const json = async (path, init) => {
  const res = await fetch(path, init);
  return { status: res.status, body: await res.json() };
};
const post = (path, body) => json(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

before(async () => {
  const built = spawnSync(process.execPath, [join(SIM, 'web', 'build.mjs'), OUT], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr || built.stdout);
  await import(pathToFileURL(join(OUT, 'sim.js')).href);
});

test('the bundle carries no Node built-ins and the page starts with the simulator', () => {
  const bundle = readFileSync(join(OUT, 'sim.js'), 'utf8');
  assert.doesNotMatch(bundle, /from\s*["']node:/);
  assert.match(readFileSync(join(OUT, 'index.html'), 'utf8'), /src="boot\.js"/);
  assert.match(readFileSync(join(OUT, 'boot.js'), 'utf8'), /sim\.js[\s\S]*app\.js/);
});

test('root-relative requests are answered in the page', async () => {
  const status = await json('/sim');
  assert.equal(status.status, 200);
  assert.ok(status.body.edition.edition);
  const token = await fetch('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&client_id=default' });
  assert.equal(token.status, 200);
});

test('every narrated scenario passes in the bundle', async () => {
  const listed = (await json('/sim/scenarios')).body.scenarios;
  assert.equal(listed.length, SCENARIOS.length);
  for (const { id } of listed) {
    const scenario = (await json(`/sim/scenarios/${id}`)).body;
    const run = await post('/sim/scenario/run', { scenario });
    assert.equal(run.status, 200, id);
    assert.equal(run.body.failed, 0, `${id}: ${JSON.stringify(run.body.results.find((r) => !r.ok))}`);
    assert.equal(run.body.passed, scenario.steps.length, id);
  }
});

test('the vetting suite runs in the bundle too', async () => {
  const { vetting } = (await json('/sim/scenarios')).body;
  assert.ok(vetting.length > 300, `only ${vetting.length} vetting scenarios`);
  const scenario = (await json(`/sim/scenarios/${encodeURIComponent('vetting~apx-control~CTL-02')}`)).body;
  const run = await post('/sim/scenario/run', { scenario });
  assert.equal(run.body.failed, 0, JSON.stringify(run.body.results.find((r) => !r.ok)));
});

test('the in-page event stream says hello and reports a clock change', async () => {
  const source = new EventSource('/sim/stream');
  const seen = await new Promise((resolve, reject) => {
    const kinds = [];
    const timer = setTimeout(() => reject(new Error(`stream saw only ${kinds.join(', ')}`)), 2000);
    source.addEventListener('hello', () => {
      kinds.push('hello');
      post('/sim/clock', { advance: 'PT5M' });
    });
    source.addEventListener('clock', (e) => {
      kinds.push('clock');
      clearTimeout(timer);
      resolve({ kinds, data: JSON.parse(e.data) });
    });
  });
  source.close();
  assert.deepEqual(seen.kinds, ['hello', 'clock']);
  assert.ok(seen.data.now);
});

test('the Fabric view ships, and traffic and the fabric read answer in the page', async () => {
  assert.match(readFileSync(join(OUT, 'index.html'), 'utf8'), /data-view="fabric"/);
  assert.match(readFileSync(join(OUT, 'js', 'fabric.js'), 'utf8'), /export function mountFabric/);
  await post('/sim/reset', { world: 'apx-events' });
  const on = await post('/sim/traffic', { running: true, ratePerMinute: 60 });
  assert.equal(on.status, 200);
  assert.equal(on.body.running, true);
  await post('/sim/traffic', { running: false });
  const added = await post('/sim/fabric/subscribers', { transport: 'sse' });
  assert.equal(added.status, 201);
  const fabric = await json('/sim/fabric');
  assert.equal(fabric.status, 200);
  assert.ok(fabric.body.subscriptions.some((s) => s.id === added.body.subscription && s.sse.simulated.connected));
});
