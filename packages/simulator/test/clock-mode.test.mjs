// The Frozen | Live clock switch: Clock.setRealtime, POST /sim/clock {realtime},
// and the live stream following the switch.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Clock } from '../src/kernel/clock.mjs';
import { Simulator } from '../src/index.mjs';

const START = '2026-09-24T18:00:00Z';
const START_MS = Date.parse(START);
const MESSAGE_WAIT_MS = 3000;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves when fn has been called, or rejects after ms. */
function firesWithin(ms) {
  let fire;
  const fired = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timer did not fire within ${ms}ms`)), ms);
    fire = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  return { fire, fired };
}

test('switching to live keeps the instant, then time runs on', async () => {
  const clock = new Clock({ start: START });
  clock.setRealtime(true);
  try {
    assert.equal(clock.realtime, true);
    assert.ok(Math.abs(clock.nowMs() - START_MS) < 50, 'the instant carries over');
    await pause(250);
    assert.ok(clock.nowMs() - START_MS >= 200, 'the live clock moved by itself');
  } finally {
    clock.setRealtime(false);
  }
});

test('a timer fires on its own while live, including one scheduled while frozen', async () => {
  const clock = new Clock({ start: START });
  const early = firesWithin(1000);
  clock.schedule({ delay: '100ms' }, early.fire, 'scheduled frozen');
  await pause(150);
  assert.equal(clock.pending().length, 1, 'frozen: nothing fires without a move');
  clock.setRealtime(true);
  try {
    await early.fired;
    const late = firesWithin(1000);
    clock.schedule({ delay: '50ms' }, late.fire, 'scheduled live');
    await late.fired;
    assert.equal(clock.pending().length, 0);
  } finally {
    clock.setRealtime(false);
  }
});

test('an advance while live re-arms for the next timer', async () => {
  const clock = new Clock({ start: START, realtime: true });
  try {
    const t = firesWithin(1000);
    clock.schedule({ delay: 'PT1H' }, t.fire, 'an hour out');
    clock.advance(3600_000 - 100); // now it is 100ms away
    await t.fired;
  } finally {
    clock.setRealtime(false);
  }
});

test('switching back to frozen pins the instant and disarms', async () => {
  const clock = new Clock({ start: START });
  clock.setRealtime(true);
  await pause(100);
  clock.setRealtime(false);
  const pinned = clock.nowMs();
  assert.ok(pinned > START_MS, 'the live run is kept');
  let fired = false;
  clock.schedule({ delay: '50ms' }, () => { fired = true; }, 'frozen');
  await pause(150);
  assert.equal(clock.nowMs(), pinned);
  assert.equal(fired, false);
  clock.advance('50ms');
  assert.equal(fired, true, 'it fires when the clock is moved past it');
});

test('a reset keeps the mode: a live clock runs on from the start instant', async () => {
  const clock = new Clock({ start: START });
  clock.setRealtime(true);
  try {
    let fired = false;
    clock.schedule({ delay: '50ms' }, () => { fired = true; }, 'dropped by reset');
    clock.reset({ start: '2026-01-01T09:00:00Z' });
    assert.equal(clock.realtime, true);
    assert.ok(Math.abs(clock.nowMs() - Date.parse('2026-01-01T09:00:00Z')) < 50);
    await pause(120);
    assert.equal(fired, false, 'reset drops the old timers');
    assert.ok(clock.nowMs() > Date.parse('2026-01-01T09:00:00Z'));
  } finally {
    clock.setRealtime(false);
  }
});

test('setRealtime notifies clock listeners, and only on a change', () => {
  const clock = new Clock({ start: START });
  let ticks = 0;
  clock.onTick(() => { ticks += 1; });
  clock.setRealtime(false);
  assert.equal(ticks, 0);
  clock.setRealtime(true);
  clock.setRealtime(false);
  assert.equal(ticks, 2);
});

// ---- over HTTP ----

let sim;
let server;
let base;

before(async () => {
  sim = new Simulator({ world: 'apx-control' });
  server = await sim.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  sim.clock.setRealtime(false);
  server.closeAllConnections();
  server.close();
});

const post = async (path, body) => {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const get = async (path) => (await fetch(`${base}${path}`)).json();

test('POST /sim/clock {realtime} round-trips and GET /sim reports it', async () => {
  const at = sim.clock.nowMs();
  const on = await post('/sim/clock', { realtime: true });
  assert.equal(on.status, 200);
  assert.equal(on.body.realtime, true);
  assert.ok(Math.abs(Date.parse(on.body.now) - at) < 2000);
  assert.equal((await get('/sim/clock')).realtime, true);
  assert.equal((await get('/sim')).clock.realtime, true);

  const off = await post('/sim/clock', { realtime: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.realtime, false);
  assert.equal((await get('/sim')).clock.realtime, false);

  assert.equal((await post('/sim/clock', { realtime: 'yes' })).status, 400);
  assert.equal((await post('/sim/clock', {})).status, 400);
});

test('a scenario-style {now} while live sets the instant and time keeps running', async () => {
  await post('/sim/clock', { realtime: true });
  try {
    const set = await post('/sim/clock', { now: START });
    assert.equal(set.body.now, START);
    assert.equal(set.body.realtime, true);
    await pause(1100);
    assert.ok(Date.parse((await get('/sim/clock')).now) > START_MS);
    // A world reset keeps the live mode and starts from the world's instant.
    assert.equal((await post('/sim/reset', {})).status, 200);
    assert.equal((await get('/sim')).clock.realtime, true);
  } finally {
    await post('/sim/clock', { realtime: false });
  }
});

/** Open GET /sim/stream; collect { type, data } messages. */
async function openStream() {
  const controller = new AbortController();
  const res = await fetch(`${base}/sim/stream`, { signal: controller.signal });
  const messages = [];
  const decoder = new TextDecoder();
  let buffer = '';
  (async () => {
    try {
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const type = block.match(/^event: (.+)$/m)?.[1];
          const data = block.match(/^data: (.+)$/m)?.[1];
          if (type) messages.push({ type, data: JSON.parse(data) });
        }
      }
    } catch {
      // aborted by close()
    }
  })();
  /** The first message after index `from` matching type and pred. */
  const waitFor = async (type, pred = () => true, from = 0) => {
    const deadline = Date.now() + MESSAGE_WAIT_MS;
    while (Date.now() < deadline) {
      const i = messages.findIndex((m, k) => k >= from && m.type === type && pred(m.data));
      if (i >= 0) return { index: i, data: messages[i].data };
      await pause(20);
    }
    throw new Error(`no "${type}" message; got ${messages.map((m) => m.type).join(', ')}`);
  };
  return { messages, waitFor, close: () => controller.abort() };
}

test('the stream sends a clock message on each switch and ticks only while live', async () => {
  const s = await openStream();
  try {
    await s.waitFor('hello');
    await post('/sim/clock', { realtime: true });
    const on = await s.waitFor('clock', (d) => d.realtime === true);
    // The per-second tick starts with the switch: another clock notice follows on its own.
    const tick = await s.waitFor('clock', (d) => d.realtime === true, on.index + 1);
    assert.ok(Date.parse(tick.data.now) >= Date.parse(on.data.now));

    await post('/sim/clock', { realtime: false });
    const off = await s.waitFor('clock', (d) => d.realtime === false, tick.index + 1);
    const count = s.messages.length;
    await pause(1300);
    assert.equal(s.messages.slice(count).filter((m) => m.type === 'clock').length, 0, 'frozen: no ticks');
    assert.ok(off.data.now);
  } finally {
    s.close();
    await post('/sim/clock', { realtime: false });
  }
});
