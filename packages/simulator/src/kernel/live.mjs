/**
 * The UI's live stream, GET /sim/stream: a simulator-internal
 * text/event-stream that tells the browser something changed, so it can
 * refresh the affected views at once instead of polling. It is not the
 * APX SSE subscription transport (events.mjs) and carries no envelopes:
 * each message is a small typed notice plus a summary, and the UI fetches
 * what it needs.
 *
 *   hello     on connect: world, clock, counts
 *   clock     {now, realtime, pendingTimers}   the clock moved or timers fired
 *   reset     {world, now}                     a world was (re)loaded
 *   event     {count, added, types[]}          envelopes published to the outbox
 *   delivery  {count, subscriptions[]}         the webhook ledger changed
 *   request   {count, added, latest, contractViolations}   a request was logged
 *   store     {collections[]}                  stored records changed
 *
 * Changes are coalesced for FLUSH_MS, so a step that touches a hundred
 * records sends one `store` message. The monitor observes the kernel only
 * while a client is connected; replay and tests pay nothing.
 */

const FLUSH_MS = 50;
const HEARTBEAT_MS = 15_000;
const REALTIME_TICK_MS = 1000;
const RETRY_MS = 2000; // the EventSource reconnect delay we ask for
const MAX_LIST = 20; // cap on types/collections/subscriptions named per message

const MONITORS = new WeakMap();

class LiveMonitor {
  constructor(sim) {
    this.sim = sim;
    this.clients = new Set();
    this.seq = 0;
    this.dirty = new Map(); // kind → Set of names (or null)
    this.added = { event: 0, request: 0 };
    this.flushTimer = null;
    this.detachers = [];
    this.intervals = [];
  }

  // ---- observing the kernel, only while someone listens ----

  attach() {
    const { sim } = this;
    this.detachers = [
      sim.clock.onTick(() => this.note('clock')),
      sim.events.onEvent((envelope) => this.note('event', envelope.type)),
      sim.store.onChange((collection) => {
        if (collection === null) return this.note('reset');
        if (collection === 'deliveries') this.note('delivery');
        this.note('store', collection);
      }),
    ];
    const heartbeat = setInterval(() => this.broadcast(': heartbeat\n\n'), HEARTBEAT_MS);
    // Under --realtime the clock moves without a tick; follow it once a second.
    const realtime = setInterval(() => sim.clock.realtime && this.note('clock'), REALTIME_TICK_MS);
    this.intervals = [heartbeat, realtime];
    for (const t of this.intervals) t.unref?.();
  }

  detach() {
    for (const off of this.detachers) off();
    for (const t of this.intervals) clearInterval(t);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.detachers = [];
    this.intervals = [];
    this.flushTimer = null;
    this.dirty.clear();
    this.added = { event: 0, request: 0 };
  }

  /** Record a change of `kind` (optionally naming what changed); sent on the next flush. */
  note(kind, name) {
    if (!this.clients.size) return;
    if (!this.dirty.has(kind)) this.dirty.set(kind, new Set());
    if (name !== undefined) this.dirty.get(kind).add(name);
    if (kind in this.added) this.added[kind] += 1;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
      this.flushTimer.unref?.();
    }
  }

  // ---- messages ----

  summary(kind, names) {
    const { sim } = this;
    const list = (set) => [...set].slice(0, MAX_LIST);
    switch (kind) {
      case 'clock':
        return { now: sim.clock.now(), realtime: sim.clock.realtime, pendingTimers: sim.clock.pending().length };
      case 'reset':
        return { world: sim.world.name, now: sim.clock.now() };
      case 'event':
        return { count: sim.events.outbox.length, added: this.added.event, types: list(names) };
      case 'delivery': {
        const rows = sim.events.ledger.all();
        return { count: rows.length, subscriptions: [...new Set(rows.map((r) => r.subscription))].slice(0, MAX_LIST) };
      }
      case 'request': {
        const last = sim.log.at(-1);
        return { count: sim.log.length, added: this.added.request, latest: last ? { method: last.method, path: last.path, status: last.status } : null, contractViolations: sim.contractViolations.length };
      }
      case 'store':
        return { collections: list(names) };
      default:
        return {};
    }
  }

  hello() {
    const { sim } = this;
    return {
      world: sim.world.name,
      clock: this.summary('clock'),
      events: sim.events.outbox.length,
      requests: sim.log.length,
    };
  }

  frame(type, data) {
    this.seq += 1;
    return `id: ${this.seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  flush() {
    this.flushTimer = null;
    // A reset makes every other notice in the batch stale; send it first.
    const order = ['reset', 'clock', 'event', 'delivery', 'request', 'store'];
    const kinds = [...this.dirty.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const text = kinds.map((k) => this.frame(k, this.summary(k, this.dirty.get(k)))).join('');
    this.dirty.clear();
    this.added = { event: 0, request: 0 };
    if (text) this.broadcast(text);
  }

  broadcast(text) {
    for (const client of this.clients) {
      try {
        client.write(text);
      } catch {
        this.remove(client);
      }
    }
  }

  // ---- clients ----

  add(writer) {
    if (!this.clients.size) this.attach();
    this.clients.add(writer);
    writer.write(`retry: ${RETRY_MS}\n\n${this.frame('hello', this.hello())}`);
  }

  remove(writer) {
    if (!this.clients.delete(writer)) return;
    if (!this.clients.size) this.detach();
  }
}

function monitorOf(sim) {
  if (!MONITORS.has(sim)) MONITORS.set(sim, new LiveMonitor(sim));
  return MONITORS.get(sim);
}

/** A kernel hook for changes the monitor cannot observe by itself (a request logged). No-op without clients. */
export function notifyLive(sim, kind, name) {
  MONITORS.get(sim)?.note(kind, name);
}

/** How many browsers are following the stream (for tests and status). */
export function liveClients(sim) {
  return MONITORS.get(sim)?.clients.size ?? 0;
}

/** The GET /sim/stream response: an envelope the HTTP server streams. */
export function liveStream(sim) {
  return {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-accel-buffering': 'no' },
    body: undefined,
    stream: ({ write, end, onClose }) => {
      const monitor = monitorOf(sim);
      const writer = { write, end };
      monitor.add(writer);
      onClose(() => monitor.remove(writer));
    },
  };
}
