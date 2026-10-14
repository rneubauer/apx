// GET /sim/stream: the UI's live change feed (src/kernel/live.mjs), over a
// real HTTP server, since it is a text/event-stream.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { liveClients } from '../src/kernel/live.mjs';

const MESSAGE_WAIT_MS = 3000;
let sim;
let server;
let base;

before(async () => {
  sim = new Simulator({ world: 'apx-control' });
  server = await sim.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

/** Open the stream and collect parsed messages: { type, data }. */
async function openStream() {
  const controller = new AbortController();
  const res = await fetch(`${base}/sim/stream`, { signal: controller.signal });
  const messages = [];
  const waiters = [];
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
          if (!type) continue;
          messages.push({ type, data: JSON.parse(data) });
          for (const w of [...waiters]) w();
        }
      }
    } catch {
      // aborted by close()
    }
  })();
  const waitFor = (type, pred = () => true) => new Promise((resolve, reject) => {
    const check = () => {
      const m = messages.find((x) => x.type === type && pred(x.data));
      if (!m) return false;
      waiters.splice(waiters.indexOf(check), 1);
      clearTimeout(timer);
      resolve(m.data);
      return true;
    };
    const timer = setTimeout(() => reject(new Error(`no "${type}" message; got ${messages.map((m) => m.type).join(', ')}`)), MESSAGE_WAIT_MS);
    waiters.push(check);
    check();
  });
  return { res, messages, waitFor, close: () => controller.abort() };
}

const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('answers text/event-stream and greets the client with the world and clock', async () => {
  const s = await openStream();
  try {
    assert.equal(s.res.status, 200);
    assert.match(s.res.headers.get('content-type'), /^text\/event-stream/);
    const hello = await s.waitFor('hello');
    assert.equal(hello.world, 'apx-control');
    assert.equal(hello.clock.now, sim.clock.now());
  } finally {
    s.close();
  }
});

test('a clock advance sends a clock message with the new instant', async () => {
  const s = await openStream();
  try {
    await s.waitFor('hello');
    const before = Date.parse(sim.clock.now());
    assert.equal((await post('/sim/clock', { advance: 'PT5M' })).status, 200);
    const clock = await s.waitFor('clock');
    assert.equal(Date.parse(clock.now) - before, 5 * 60_000);
    assert.equal(typeof clock.pendingTimers, 'number');
  } finally {
    s.close();
  }
});

test('a command that publishes an event sends event, store and request notices, coalesced', async () => {
  const s = await openStream();
  try {
    await s.waitFor('hello');
    const res = await fetch(`${base}/v1/commands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer default', 'idempotency-key': 'live-1' },
      body: JSON.stringify({ commandType: 'vendGate', target: { id: 'b2000000-0000-4000-8000-000000000002', className: 'VehicularAccess' } }),
    });
    assert.equal(res.status, 202, await res.text());
    const ev = await s.waitFor('event');
    assert.ok(ev.count >= 1 && ev.added >= 1);
    assert.ok(ev.types.includes('apx.control.command.status.v1'));
    await s.waitFor('store', (d) => d.collections.includes('commands'));
    const logged = await s.waitFor('request');
    assert.deepEqual(logged.latest, { method: 'POST', path: '/v1/commands', status: 202 });
    // one flush per burst: the command's events arrive as one notice
    assert.equal(s.messages.filter((m) => m.type === 'event').length, 1);
  } finally {
    s.close();
  }
});

test('a world reset sends a reset message naming the world', async () => {
  const s = await openStream();
  try {
    await s.waitFor('hello');
    await post('/sim/reset', { world: 'default' });
    const reset = await s.waitFor('reset');
    assert.equal(reset.world, 'default');
  } finally {
    s.close();
  }
});

test('a disconnected client is dropped and the monitor stops observing', async () => {
  const s = await openStream();
  await s.waitFor('hello');
  assert.equal(liveClients(sim), 1);
  s.close();
  const deadline = Date.now() + MESSAGE_WAIT_MS;
  while (liveClients(sim) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  assert.equal(liveClients(sim), 0);
  assert.equal(sim.store.listeners.size, 0);
});

test('the stream is GET only', async () => {
  assert.equal((await post('/sim/stream', {})).status, 400);
});
