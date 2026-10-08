/**
 * The Simulator: one object holding the clock, the store, the place
 * hierarchy, the event fabric, the loaded world, and the handlers the
 * domain modules register. `dispatch()` serves a request in-process;
 * `listen()` puts an HTTP server in front of it.
 */
import { Clock } from './kernel/clock.mjs';
import { Store } from './kernel/store.mjs';
import { Hierarchy } from './kernel/places.mjs';
import { EventFabric } from './kernel/events.mjs';
import { loadWorld } from './kernel/world.mjs';
import { dispatch, createHttpServer } from './kernel/http.mjs';
import { OPS_BY_ID } from './kernel/spec.mjs';
import { DOMAINS } from './domains/index.mjs';

class Hooks {
  constructor() {
    this.map = new Map();
  }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, []);
    this.map.get(name).push(fn);
  }
  emit(name, payload) {
    for (const fn of this.map.get(name) ?? []) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[sim hook ${name}]`, e.stack ?? e);
      }
    }
  }
}

export class Simulator {
  constructor(options = {}) {
    this.options = { strict: false, realtime: false, network: false, quiet: false, ...options };
    this.clock = new Clock({ realtime: this.options.realtime });
    this.store = new Store(this.clock);
    this.hierarchy = new Hierarchy();
    this.events = new EventFabric(this);
    this.events.network = this.options.network;
    this.hooks = new Hooks();
    this.handlers = new Map();
    this.views = new Map(); // collection → fn(record, ctx) → wire representation
    this.injectors = new Map();
    this.seeders = [];
    this.log = [];
    this.contractViolations = [];
    this.world = { name: 'none', credentials: {} };
    for (const domain of this.options.domains ?? DOMAINS) this.use(domain);
    this.loadWorld(this.options.world ?? 'default');
  }

  /** Register a domain module: { name, register(sim) }. */
  use(domain) {
    domain.register(this);
    return this;
  }

  /** Register a handler for an operationId; `opts` may set allowEmptyBody / skipBodyValidation. */
  on(operationId, handler, opts = {}) {
    if (!OPS_BY_ID.has(operationId)) throw new Error(`simulator bug: no operation "${operationId}" in the bundle`);
    if (this.handlers.has(operationId)) throw new Error(`simulator bug: operation "${operationId}" registered twice`);
    Object.assign(handler, opts);
    this.handlers.set(operationId, handler);
  }

  /** The wire view of a stored record (strips simulator-internal `_` members). */
  view(collection, fn) {
    this.views.set(collection, fn);
  }

  injector(kind, fn) {
    this.injectors.set(kind, fn);
  }

  seed(fn) {
    this.seeders.push(fn);
  }

  loadWorld(spec) {
    const world = loadWorld(spec);
    this.world = world;
    this.store.reset(); // before the clock: a reset fires clock listeners, which must not see the old world
    this.clock.reset({ start: world.clock?.start });
    this.hierarchy.load(world);
    this.events.reset(world);
    this.log = [];
    this.contractViolations = [];
    for (const seed of this.seeders) seed(world, this);
    return world;
  }

  dispatch(request) {
    return dispatch(this, request);
  }

  /** Convenience for scripts and tests: request(method, path, { body, headers, token }). */
  async request(method, path, { body, headers = {}, token } = {}) {
    const h = { ...headers };
    if (token !== undefined) h.authorization = token ? `Bearer ${token}` : undefined;
    if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
    return this.dispatch({ method, path, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  }

  listen(port = 4100, host = '127.0.0.1') {
    const server = createHttpServer(this);
    return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
  }
}

/** Strip simulator-internal members (leading underscore) from a record for the wire. */
export function wire(record) {
  if (Array.isArray(record)) return record.map(wire);
  if (!record || typeof record !== 'object') return record;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

export { loadWorld, listWorlds } from './kernel/world.mjs';
export { fail, ProblemError } from './kernel/problems.mjs';
export { encodeToken } from './kernel/auth.mjs';
