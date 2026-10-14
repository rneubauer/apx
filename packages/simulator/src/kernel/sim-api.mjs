/**
 * The simulator's own control surface, outside the standard, under /sim:
 *
 *   GET  /sim                          status: edition, world, clock, counts, pending timers
 *   GET  /sim/worlds                   the worlds on disk
 *   POST /sim/reset        {world?}    reload a world (name, path or inline object)
 *   GET  /sim/clock                    the instant the server believes it is
 *   POST /sim/clock        {now} | {advance}   jump or move the clock; due timers fire
 *   GET  /sim/state                    every collection
 *   GET  /sim/state/:coll[/:id]        one collection or record
 *   PUT  /sim/state/:coll/:id          replace a record verbatim (god mode)
 *   POST /sim/inject       {kind,...}  a world event (vehicleArrives, deviceState, commandOutcome, ...)
 *   GET  /sim/injectors                the kinds the loaded domains offer
 *   GET  /sim/events[?since=&type=]    the outbox of envelopes published
 *   GET  /sim/deliveries[?subscription=] the webhook ledger
 *   GET  /sim/receivers[?endpoint=]    simulated endpoints and their inboxes
 *   PUT  /sim/receivers    {endpoint, codes[], default}  programme a receiver
 *   POST /sim/token        {credential} | {claims}      mint a bearer token
 *   GET  /sim/log                      recent requests
 *   GET  /sim/contract                 responses that failed the bundle's own schema
 *   GET  /sim/ops                      every operation and whether it is implemented
 *   GET  /sim/stream                   text/event-stream of change notices for the UI (live.mjs)
 *   /sim/scenarios, /sim/scenario/*, /sim/injectors/catalog   see sim-scenarios.mjs
 */
import { OPS, EDITION } from './spec.mjs';
import { encodeToken } from './auth.mjs';
import { listWorlds, loadWorld } from './world.mjs';
import { scenarioApi, injectorCatalog, topics } from './sim-scenarios.mjs';
import { liveStream } from './live.mjs';

const json = (status, body, headers = {}) => ({ status, headers: { 'content-type': 'application/json', ...headers }, body });
const bad = (detail) => json(400, { error: 'bad_request', detail });

function worldSummary(name) {
  try {
    const w = loadWorld(name);
    return { name, description: w.description ?? null, credentials: Object.keys(w.credentials ?? {}) };
  } catch (e) {
    return { name, error: e.message };
  }
}

function parseBody(raw) {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  return JSON.parse(raw);
}

export async function simApi(sim, { method, path, query, body: raw }) {
  const parts = path.split('/').filter(Boolean).slice(1); // after "sim"
  let body;
  try {
    body = parseBody(raw);
  } catch (e) {
    return bad(`invalid JSON: ${e.message}`);
  }
  const [head, a, b] = parts;

  if (!head) {
    return json(200, {
      simulator: 'apx-simulator',
      edition: { edition: EDITION.edition, status: EDITION.status, apdsVersion: EDITION.extension?.apdsVersion ?? EDITION.apds?.release },
      world: sim.world.name,
      host: sim.world.host,
      clock: { now: sim.clock.now(), realtime: sim.clock.realtime, pendingTimers: sim.clock.pending().length },
      collections: Object.fromEntries([...sim.store.collections].map(([k, c]) => [k, c.size()])),
      events: sim.events.outbox.length,
      implementedOperations: sim.handlers.size,
      totalOperations: OPS.length,
      contractViolations: sim.contractViolations.length,
    });
  }
  switch (head) {
    case 'worlds':
      return json(200, { worlds: listWorlds().map(worldSummary), loaded: sim.world.name });
    case 'topics':
      return json(200, { topics: topics() });
    case 'scenarios':
    case 'scenario':
      return scenarioApi(sim, { method, parts, body });
    case 'reset': {
      if (method !== 'POST') return bad('POST');
      try {
        sim.loadWorld(body.world ?? sim.world.name);
      } catch (e) {
        return bad(e.message);
      }
      return json(200, { world: sim.world.name, now: sim.clock.now() });
    }
    case 'clock': {
      if (method === 'GET') return json(200, { now: sim.clock.now(), realtime: sim.clock.realtime, pending: sim.clock.pending() });
      try {
        if (body.now) sim.clock.set(body.now);
        else if (body.advance !== undefined) sim.clock.advance(body.advance);
        else return bad('give {now} or {advance}');
      } catch (e) {
        return bad(e.message);
      }
      return json(200, { now: sim.clock.now(), pending: sim.clock.pending() });
    }
    case 'state': {
      if (!a) return json(200, sim.store.snapshot());
      const coll = sim.store.collection(a);
      if (!b) return json(200, { collection: a, count: coll.size(), rows: coll.all() });
      if (method === 'PUT') {
        if (!body || typeof body !== 'object') return bad('a record');
        coll.put({ ...body, id: b });
        return json(200, coll.get(b));
      }
      if (method === 'DELETE') {
        coll.delete(b);
        return json(204, undefined);
      }
      const row = coll.get(b);
      return row ? json(200, row) : json(404, { error: 'not_found' });
    }
    case 'injectors':
      if (a === 'catalog') return json(200, { injectors: injectorCatalog(sim) });
      return json(200, { kinds: [...sim.injectors.keys()].sort() });
    case 'inject': {
      if (method !== 'POST') return bad('POST');
      const fn = sim.injectors.get(body.kind);
      if (!fn) return bad(`unknown injector "${body.kind}"; known: ${[...sim.injectors.keys()].sort().join(', ')}`);
      try {
        const out = await fn(body, sim);
        return json(200, { ok: true, kind: body.kind, now: sim.clock.now(), result: out ?? null });
      } catch (e) {
        return json(422, { ok: false, kind: body.kind, error: e.message, problem: e.slug });
      }
    }
    case 'events': {
      const since = query.get('since');
      const type = query.get('type');
      const rows = sim.events.outbox
        .filter((r) => (!since || r.envelope.time >= since) && (!type || r.envelope.type === type))
        .map((r) => ({ ...r.envelope, _place: r.place, _deliveredTo: r.deliveries }));
      return json(200, { count: rows.length, events: rows.slice(-Number(query.get('limit') ?? 500)) });
    }
    case 'deliveries': {
      const subId = query.get('subscription');
      const rows = sim.events.ledger.all().filter((r) => !subId || r.subscription === subId);
      return json(200, { count: rows.length, deliveries: rows.map((r) => ({ subscription: r.subscription, ...sim.events.deliveryRecord(r) })) });
    }
    case 'receivers': {
      if (method === 'PUT' || method === 'POST') {
        if (!body.endpoint) return bad('endpoint');
        const r = sim.events.receiver(body.endpoint, body);
        return json(200, { endpoint: r.url, codes: r.codes, default: r.default, inbox: r.inbox.length });
      }
      const url = query.get('endpoint');
      if (url) {
        const r = sim.events.receivers.get(url);
        return r ? json(200, { endpoint: r.url, codes: r.codes, default: r.default, inbox: r.inbox }) : json(404, { error: 'not_found' });
      }
      return json(200, { receivers: [...sim.events.receivers.values()].map((r) => ({ endpoint: r.url, codes: r.codes, default: r.default, inbox: r.inbox.length })) });
    }
    case 'token': {
      let claims = body.claims;
      if (!claims) {
        const name = body.credential ?? 'default';
        const cred = sim.world.credentials?.[name];
        if (!cred) return bad(`no credential "${name}"; known: ${Object.keys(sim.world.credentials ?? {}).join(', ')}`);
        claims = { sub: name, ...cred };
      }
      return json(200, { access_token: encodeToken(claims), token_type: 'Bearer', claims });
    }
    case 'credentials':
      return json(200, { credentials: sim.world.credentials });
    case 'log':
      return json(200, { requests: sim.log.slice(-Number(query.get('limit') ?? 200)) });
    case 'contract':
      return json(200, { violations: sim.contractViolations });
    case 'ops':
      return json(200, {
        operations: OPS.map((o) => ({ method: o.method, path: o.path, operationId: o.operationId, scopes: o.scopes, implemented: sim.handlers.has(o.operationId) })),
      });
    case 'hierarchy':
      return json(200, { nodes: sim.hierarchy.all() });
    case 'stream':
      if (method !== 'GET') return bad('GET');
      return liveStream(sim);
    default:
      return json(404, { error: 'not_found', detail: `no sim route ${path}` });
  }
}
