/**
 * The delivery fabric at a glance, for the UI's Fabric view: one read that
 * joins what the Part 8 machinery keeps in separate places (subscriptions,
 * the delivery ledger with its pending retry timers, the simulated
 * receivers, SSE buffers and the outbox), plus two presenter conveniences.
 *
 *   GET  /sim/fabric                              subscribers, recent deliveries, recent events, traffic
 *   POST /sim/fabric/subscribers {transport}      add a demo subscriber through POST /webhooks
 *   POST /sim/fabric/sse {subscription, connected}  connect or drop the simulated SSE client
 *
 * A demo subscriber is created the way a client would create it: a
 * POST /webhooks as the world's broadest subscriptions:manage credential,
 * for the topics the traffic generator produces that the credential may
 * read. An SSE subscriber gets a simulated client, held here, that reads
 * the stream in-process; dropping it lets frames buffer, and reconnecting
 * resumes from its Last-Event-ID, as §8.4 describes.
 */
import { trafficOf } from './traffic.mjs';
import { notifyLive } from './live.mjs';
import { encodeToken } from './auth.mjs';

const RECENT_DELIVERIES = 6; // ledger rows per subscriber
const OWED_SHOWN = 4; // of which at most this many retrying or failed rows
const RECENT_EVENTS = 40; // outbox records
const MANAGE = 'apx.subscriptions:manage';

/** The topics the traffic generator publishes, and the scope that reads each (Part 8 §8.1). */
export const DEMO_TOPICS = [
  ['apx.data.observation.created.v1', 'apx.lpr:read'],
  ['apx.data.occupancy.v1', 'apx.data:read'],
  ['apx.control.device.state.v1', 'apx.control:read'],
  ['apx.alert.raised.v1', 'apx.alerts:read'],
  ['apx.alert.status.v1', 'apx.alerts:read'],
  ['apx.accounts.payment.recorded.v1', 'apx.accounts:read'],
];

const CLIENTS = new WeakMap(); // sim → Map(subscription id → simulated SSE client)

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body });
const bad = (detail) => json(400, { error: 'bad_request', detail });

function clientsOf(sim) {
  if (!CLIENTS.has(sim)) CLIENTS.set(sim, new Map());
  return CLIENTS.get(sim);
}

/** The simulated SSE client of a subscription, if it belongs to the loaded world. */
function clientOf(sim, id) {
  const c = clientsOf(sim).get(id);
  if (c && c.world !== sim.world) {
    clientsOf(sim).delete(id);
    return null;
  }
  return c ?? null;
}

// ---------- the view ----------

function placeName(sim, id) {
  return id ? sim.hierarchy.get(id)?.name ?? id : null;
}

/** Ledger row → what the view shows: attempts with codes, and when the next retry is due. */
function deliveryRow(sim, rec, typeOf, timers) {
  return {
    eventId: rec.eventId,
    type: typeOf.get(rec.eventId) ?? null,
    status: rec.status,
    attempts: rec.attempts,
    lastCode: rec.lastCode ?? null,
    time: rec.time ?? null,
    firstAttemptAt: rec.firstAttemptAt ?? null,
    nextAttemptAt: rec.nextTimer ? timers.get(rec.nextTimer) ?? null : null,
    history: rec.attemptHistory.map((a) => ({ time: a.time, code: a.code })),
  };
}

function ledgerStats(rows) {
  const out = { total: rows.length, delivered: 0, retrying: 0, failed: 0 };
  for (const r of rows) if (r.status in out) out[r.status] += 1;
  return out;
}

function receiverOf(sim, sub) {
  const r = sub.transport === 'webhook' ? sim.events.receivers.get(sub.endpoint) : null;
  return r ? { default: r.default, codes: [...r.codes], inbox: r.inbox.length, failing: r.default >= 300 || r.default === 0 } : null;
}

function sseOf(sim, sub) {
  if (sub.transport !== 'sse') return null;
  const client = clientOf(sim, sub.id);
  return {
    seq: sub._sseSeq ?? 0,
    buffered: sub._sseBuffer?.length ?? 0,
    clients: sim.events.sseClients.get(sub.id)?.size ?? 0,
    simulated: client ? { connected: Boolean(client.detach), received: client.received, lastSeq: client.lastSeq, caughtUp: client.caughtUp } : null,
  };
}

/** Newest first, but the deliveries still owed (retrying, failed) ahead of newer successes, so a retry stays in view. */
function recentOf(rows) {
  const owed = rows.filter((r) => r.status !== 'delivered').slice(-OWED_SHOWN);
  const rest = rows.filter((r) => !owed.includes(r)).slice(-(RECENT_DELIVERIES - owed.length));
  return [...owed.reverse(), ...rest.reverse()];
}

function subscriberView(sim, sub, rows, typeOf, timers) {
  const mine = rows.filter((r) => r.subscription === sub.id);
  return {
    id: sub.id,
    transport: sub.transport,
    endpoint: sub.endpoint ?? null,
    topics: sub.topics ?? [],
    status: sub.status,
    owner: sub.recordInfo?.creationUser ?? null,
    filters: sub.filters ?? null,
    held: sub._held?.length ?? 0,
    failure: sub._failure ?? null,
    receiver: receiverOf(sim, sub),
    sse: sseOf(sim, sub),
    deliveries: ledgerStats(mine),
    recent: recentOf(mine).map((r) => deliveryRow(sim, r, typeOf, timers)),
  };
}

function eventView(sim, record) {
  const e = record.envelope;
  return { id: e.id, type: e.type, time: e.time, subject: e.subject ?? null, place: record.place, placeName: placeName(sim, record.place), deliveredTo: [...record.deliveries] };
}

export function fabricView(sim) {
  const rows = sim.events.ledger.all();
  const typeOf = new Map(sim.events.outbox.map((r) => [r.envelope.id, r.envelope.type]));
  const timers = new Map(sim.clock.pending().map((t) => [t.id, t.at]));
  return {
    world: sim.world.name,
    now: sim.clock.now(),
    realtime: Boolean(sim.clock.realtime),
    traffic: trafficOf(sim).status(),
    subscriptions: sim.events.subs.all().map((s) => subscriberView(sim, s, rows, typeOf, timers)),
    events: sim.events.outbox.slice(-RECENT_EVENTS).reverse().map((r) => eventView(sim, r)),
    outbox: sim.events.outbox.length,
  };
}

// ---------- demo subscribers ----------

/** The world's credential that can manage subscriptions and read the most demo topics. */
function demoCredential(sim) {
  const readable = (cred) => DEMO_TOPICS.filter(([, scope]) => cred.scopes?.includes(scope)).length;
  const managers = Object.entries(sim.world.credentials ?? {}).filter(([, c]) => c.scopes?.includes(MANAGE) && c.apx_places);
  managers.sort((a, b) => readable(b[1]) - readable(a[1]));
  return managers[0] ?? null;
}

async function addSubscriber(sim, { transport = 'webhook' } = {}) {
  if (!['webhook', 'sse'].includes(transport)) return bad("transport must be 'webhook' or 'sse'");
  const found = demoCredential(sim);
  if (!found) return bad(`world ${sim.world.name} has no credential with ${MANAGE} and a place grant`);
  const [name, cred] = found;
  const topics = DEMO_TOPICS.filter(([, scope]) => cred.scopes.includes(scope)).map(([t]) => t);
  if (!topics.length) return bad(`credential ${name} cannot read any of the demo topics`);
  const n = sim.store.next('demoSubscriber', 1);
  const body = { topics, transport, ...(transport === 'webhook' ? { endpoint: `https://subscriber-${n}.demo.example/apx/events` } : {}) };
  const token = encodeToken({ sub: name, ...cred });
  const res = await sim.request('POST', '/webhooks', { token, body, headers: { prefer: 'return=representation' } });
  if (res.status >= 300) return json(res.status, res.body);
  if (transport === 'webhook') sim.events.receiver(body.endpoint, { default: 200 });
  else connectSse(sim, res.body.id);
  return json(201, { subscription: res.body.id, credential: name, transport, topics, endpoint: body.endpoint ?? null });
}

// ---------- the simulated SSE client ----------

function connectSse(sim, id) {
  const client = clientOf(sim, id) ?? { world: sim.world, received: 0, lastSeq: null, caughtUp: 0, detach: null };
  clientsOf(sim).set(id, client);
  if (client.detach) return client;
  const read = (frame) => {
    client.received += 1;
    client.lastSeq = frame.seq;
  };
  // Resume from Last-Event-ID: the frames buffered while away, then the live stream.
  const missed = sim.events.sseFrames(id, client.lastSeq ?? '');
  const backlog = missed.expired ? [] : missed.frames;
  backlog.forEach(read);
  client.caughtUp = client.lastSeq === null ? 0 : backlog.length;
  client.detach = sim.events.attachSse(id, read);
  return client;
}

function disconnectSse(sim, id) {
  const client = clientOf(sim, id);
  client?.detach?.();
  if (client) client.detach = null;
  return client;
}

function sseApi(sim, body) {
  const sub = sim.events.subs.get(body.subscription);
  if (!sub) return bad(`no subscription ${body.subscription}`);
  if (sub.transport !== 'sse') return bad(`subscription ${sub.id} has transport ${sub.transport}`);
  if (typeof body.connected !== 'boolean') return bad('connected must be true or false');
  if (body.connected) connectSse(sim, sub.id);
  else disconnectSse(sim, sub.id);
  notifyLive(sim, 'store', 'subscriptions');
  return json(200, { subscription: sub.id, sse: sseOf(sim, sim.events.subs.get(sub.id)) });
}

/** /sim/fabric[/subscribers|/sse]. */
export async function fabricApi(sim, { method, parts, body }) {
  const [, action] = parts;
  if (!action) return method === 'GET' ? json(200, fabricView(sim)) : bad('GET');
  if (method !== 'POST') return bad('POST');
  if (action === 'subscribers') return addSubscriber(sim, body);
  if (action === 'sse') return sseApi(sim, body);
  return json(404, { error: 'not_found', detail: `no sim route /sim/fabric/${action}` });
}
