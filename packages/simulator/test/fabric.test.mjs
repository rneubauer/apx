// The traffic generator (POST /sim/traffic) and the Fabric view's read
// (GET /sim/fabric): traffic flows only while running and Live, a failing
// endpoint leaves retries on the §8.3 schedule in the ledger, and the demo
// subscribers (webhook and SSE) are created through POST /webhooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const OPS_MONITOR = 'https://noc.lakeside-garage.example/apx';
const FAST = 600; // ticks a minute: one every ~100 ms
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function newSim() {
  const sim = new Simulator({ world: 'apx-events' });
  const call = async (method, path, body) => (await sim.request(method, path, { body })).body;
  return { sim, call };
}

test('traffic starts, retunes and stops; bad input is refused', async () => {
  const { sim, call } = newSim();
  const idle = await call('GET', '/sim/traffic');
  assert.equal(idle.running, false);
  assert.deepEqual(idle.available, ['vehicles', 'devices', 'occupancy', 'payments']);
  const on = await call('POST', '/sim/traffic', { running: true, ratePerMinute: 120, mix: { devices: 0 } });
  assert.equal(on.running, true);
  assert.equal(on.ratePerMinute, 120);
  assert.equal(on.mix.devices, 0);
  const off = await call('POST', '/sim/traffic', { running: false });
  assert.equal(off.running, false);
  for (const body of [{ running: 'yes' }, { ratePerMinute: 'fast' }, { mix: { weather: 1 } }, { mix: { vehicles: -1 } }]) {
    const res = await sim.request('POST', '/sim/traffic', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('while Live, traffic publishes a mix of events; stopped, it publishes nothing', async () => {
  const { sim, call } = newSim();
  await call('POST', '/sim/clock', { realtime: true });
  try {
    const before = sim.events.outbox.length;
    await call('POST', '/sim/traffic', { running: true, ratePerMinute: FAST });
    await pause(1200);
    const status = await call('POST', '/sim/traffic', { running: false });
    assert.ok(status.ticks >= 3, `only ${status.ticks} ticks`);
    assert.ok(sim.events.outbox.length > before, 'events were published');
    assert.equal(status.errors, 0, JSON.stringify(status.lastError));
    assert.ok(status.published >= status.ticks, 'each tick published at least one event');
    const after = sim.events.outbox.length;
    await pause(400);
    assert.equal(sim.events.outbox.length, after, 'nothing after stop');
  } finally {
    await call('POST', '/sim/traffic', { running: false });
    await call('POST', '/sim/clock', { realtime: false });
  }
});

test('while Frozen, running traffic waits', async () => {
  const { sim, call } = newSim();
  try {
    const before = sim.events.outbox.length;
    await call('POST', '/sim/traffic', { running: true, ratePerMinute: FAST });
    await pause(500);
    const status = await call('GET', '/sim/traffic');
    assert.equal(status.running, true);
    assert.equal(status.live, false);
    assert.equal(status.ticks, 0);
    assert.equal(sim.events.outbox.length, before);
  } finally {
    await call('POST', '/sim/traffic', { running: false });
  }
});

test('one tick of each kind publishes the topics a subscriber expects', async () => {
  const { sim } = newSim();
  const { trafficOf } = await import('../src/kernel/traffic.mjs');
  const gen = trafficOf(sim);
  const types = new Set();
  sim.events.onEvent((e) => types.add(e.type));
  for (let i = 0; i < 120; i += 1) gen.tick();
  for (const t of ['apx.data.observation.created.v1', 'apx.data.occupancy.v1', 'apx.control.device.state.v1', 'apx.accounts.payment.recorded.v1']) assert.ok(types.has(t), `no ${t}: ${[...types]}`);
  assert.equal(gen.status().errors, 0, JSON.stringify(gen.status().lastError));
});

test('a failing endpoint leaves retries in the ledger on the §8.3 schedule, and catches up on recovery', async () => {
  const { sim, call } = newSim();
  const { trafficOf } = await import('../src/kernel/traffic.mjs');
  await call('PUT', '/sim/receivers', { endpoint: OPS_MONITOR, codes: [], default: 503 });
  const gen = trafficOf(sim);
  for (let i = 0; i < 5; i += 1) gen.tick();

  let fabric = await call('GET', '/sim/fabric');
  let ops = fabric.subscriptions.find((s) => s.endpoint === OPS_MONITOR);
  assert.equal(ops.receiver.failing, true);
  assert.ok(ops.deliveries.retrying > 0);
  const first = ops.recent[0];
  assert.equal(first.status, 'retrying');
  assert.equal(first.lastCode, 503);
  assert.equal(Date.parse(first.nextAttemptAt) - Date.parse(first.time), 30_000, 'second attempt 30 s after the first');

  await call('POST', '/sim/clock', { advance: 'PT30S' });
  fabric = await call('GET', '/sim/fabric');
  ops = fabric.subscriptions.find((s) => s.endpoint === OPS_MONITOR);
  assert.equal(ops.recent.at(-1).attempts, 2);
  assert.equal(Date.parse(ops.recent.at(-1).nextAttemptAt) - Date.parse(ops.recent.at(-1).time), 120_000, 'third attempt 2 min after the second');

  await call('PUT', '/sim/receivers', { endpoint: OPS_MONITOR, codes: [], default: 200 });
  await call('POST', '/sim/clock', { advance: 'PT2M' });
  fabric = await call('GET', '/sim/fabric');
  ops = fabric.subscriptions.find((s) => s.endpoint === OPS_MONITOR);
  assert.equal(ops.deliveries.retrying, 0);
  assert.equal(ops.deliveries.delivered, ops.deliveries.total);
  assert.deepEqual(ops.recent.at(-1).history.map((a) => a.code), [503, 503, 200]);
});

test('demo subscribers: a webhook gets deliveries, an SSE client resumes from Last-Event-ID', async () => {
  const { sim, call } = newSim();
  const { trafficOf } = await import('../src/kernel/traffic.mjs');
  const hook = await call('POST', '/sim/fabric/subscribers', { transport: 'webhook' });
  const sse = await call('POST', '/sim/fabric/subscribers', { transport: 'sse' });
  assert.ok(hook.subscription && hook.endpoint);
  assert.ok(sse.subscription);
  assert.ok(sim.store.collection('subscriptions').has(sse.subscription), 'created through POST /webhooks');

  const gen = trafficOf(sim);
  for (let i = 0; i < 6; i += 1) gen.tick();
  await call('POST', '/sim/fabric/sse', { subscription: sse.subscription, connected: false });
  for (let i = 0; i < 6; i += 1) gen.tick();
  const away = (await call('GET', '/sim/fabric')).subscriptions.find((s) => s.id === sse.subscription).sse;
  assert.equal(away.simulated.connected, false);
  assert.ok(away.seq > away.simulated.lastSeq, 'frames buffered while away');

  const back = (await call('POST', '/sim/fabric/sse', { subscription: sse.subscription, connected: true })).sse;
  assert.equal(back.simulated.lastSeq, back.seq, 'caught up to the head of the stream');
  assert.equal(back.simulated.caughtUp, away.seq - away.simulated.lastSeq);
  assert.equal(back.simulated.received, back.seq);

  const view = (await call('GET', '/sim/fabric')).subscriptions.find((s) => s.id === hook.subscription);
  assert.ok(view.deliveries.delivered > 0);
  const bad = await sim.request('POST', '/sim/fabric/subscribers', { body: { transport: 'pigeon' } });
  assert.equal(bad.status, 400);
});

test('the fabric view lists events with their place and fan-out', async () => {
  const { sim, call } = newSim();
  const { trafficOf } = await import('../src/kernel/traffic.mjs');
  for (let i = 0; i < 4; i += 1) trafficOf(sim).tick();
  const fabric = await call('GET', '/sim/fabric');
  assert.equal(fabric.world, 'apx-events');
  assert.ok(fabric.events.length > 0);
  const e = fabric.events[0];
  assert.ok(e.type && e.time && Array.isArray(e.deliveredTo));
  assert.ok(fabric.events.some((x) => x.placeName && x.deliveredTo.length), 'some events are bound and delivered');
});

test('a world reset stops traffic, so it never mixes into the next story', async () => {
  const { sim, call } = newSim();
  await call('POST', '/sim/clock', { realtime: true });
  try {
    await call('POST', '/sim/traffic', { running: true, ratePerMinute: FAST });
    await call('POST', '/sim/reset', {});
    await pause(400);
    const status = await call('GET', '/sim/traffic');
    assert.equal(status.running, false);
    assert.equal(status.published, 0);
    const res = await sim.request('POST', '/sim/traffic', { body: 'null' });
    assert.equal(res.status, 400, 'a null body is refused, not thrown');
  } finally {
    await call('POST', '/sim/traffic', { running: false });
    await call('POST', '/sim/clock', { realtime: false });
  }
});
