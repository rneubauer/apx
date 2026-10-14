/**
 * Request dispatch. `dispatch()` is a pure function of simulator state and
 * an abstract request, so the HTTP server, the replay runner, and tests
 * share one path. The pipeline, in order:
 *
 *   sim control (/sim/*) → token endpoint → route match (404 target-not-found)
 *   → authentication (401 unauthenticated) → scope (403 insufficient-scope)
 *   → body parse (400 invalid-request) → required query params
 *   → request-body schema (400 invalid-request with errors[])
 *   → Idempotency-Key ledger (400 / 409 / replay 200)
 *   → the domain handler → response-schema check (X-Sim-Contract header)
 */
import { createServer } from 'node:http';
import { serveUi } from './ui.mjs';
import { findOp, pathExists, validateRequestBody, validateResponseBody, ajvToErrors, fmtErrors, requestContent, PROBLEM_BASE } from './spec.mjs';
import { ProblemError, fail } from './problems.mjs';
import { authenticate, encodeToken, Principal } from './auth.mjs';
import { requireGrant, requireGrantForPlaces } from './places.mjs';
import { hashBody } from './store.mjs';
import { simApi } from './sim-api.mjs';
import { notifyLive } from './live.mjs';

const JSON_CT = 'application/json';
const PROBLEM_CT = 'application/problem+json';

function lowerHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

export class Query {
  constructor(search) {
    this.params = new URLSearchParams(search ?? '');
  }
  get(name) {
    const v = this.params.get(name);
    return v === null ? undefined : v;
  }
  has(name) {
    return this.params.has(name);
  }
  all(name) {
    return this.params.getAll(name);
  }
  keys() {
    return [...new Set(this.params.keys())];
  }
  /** Comma-separated list parameter. */
  list(name) {
    return this.params
      .getAll(name)
      .flatMap((v) => v.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  int(name) {
    const v = this.get(name);
    return v === undefined ? undefined : Number(v);
  }
  toObject() {
    return Object.fromEntries(this.params.entries());
  }
}

/** Render a ProblemError, respecting the native-route error dialect (Part 5 §5.1a). */
function renderProblem(err, op, headers, instance) {
  const wantsProblem = /application\/problem\+json/.test(headers.accept ?? '');
  const alwaysProblem = [401, 403, 429].includes(err.status) || !op || !op.native || err.extra?.alwaysProblem;
  if (!alwaysProblem && !wantsProblem && [400, 404, 409].includes(err.status)) {
    return {
      status: err.status,
      headers: { 'content-type': JSON_CT, ...err.headers },
      body: { status: 'error', code: err.status, message: err.detail ?? err.slug },
    };
  }
  return { status: err.status, headers: { 'content-type': PROBLEM_CT, ...err.headers }, body: err.toProblem(instance) };
}

export async function dispatch(sim, request) {
  const headers = lowerHeaders(request.headers);
  const url = new URL(request.path, 'http://sim.local');
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const query = new Query(url.search);
  const started = sim.clock.now();

  // Sim-control and the token endpoint sit outside the standard's surface.
  if (path === '/sim' || path.startsWith('/sim/')) return simApi(sim, { method, path, query, headers, body: request.body });
  if (path === '/oauth/token' || path === '/oauth2/token') return tokenEndpoint(sim, method, headers, request.body);
  if (method === 'OPTIONS') return { status: 204, headers: {}, body: undefined };

  // Replay/scripting convenience: pin the instant the server believes it is.
  if (headers['x-sim-now']) {
    try {
      sim.clock.set(headers['x-sim-now']);
    } catch {
      /* ignore a bad instant */
    }
  }

  const match = findOp(method, path);
  const op = match?.op ?? null;
  const instance = path;
  const result = await (async () => {
    try {
      if (!op) {
        if (pathExists(path)) fail('target-not-found', `${method} is not defined on ${path}`, { status: 405 });
        fail('target-not-found', `no APX or APDS operation at ${path}`);
      }
      // Part 9 §9.3a: an endpoint of a class the host does not claim is 404,
      // before authentication. The discovery module knows the class of every
      // operation and what the (Host-selected) world claims.
      if (op.secured && sim.discovery?.opClasses && sim.discovery?.claimed) {
        const classes = [...(sim.discovery.opClasses(op) ?? [])];
        const claimedRaw = sim.discovery.claimed(headers);
        const claimed = claimedRaw instanceof Set ? claimedRaw : Array.isArray(claimedRaw) ? new Set(claimedRaw) : null;
        if (classes.length && claimed && !classes.some((c) => claimed.has(c))) {
          fail('target-not-found', `${op.method} ${op.path} belongs to ${classes.join('/')}, which this host does not claim`);
        }
      }

      // A scenario may ask the server to exhibit a condition it cannot
      // otherwise reach (throttling, an outage): X-Sim-Force: <problem slug>.
      if (headers['x-sim-force'] && sim.options.allowForce !== false) {
        const slug = headers['x-sim-force'];
        const retry = slug === 'rate-limited' ? { 'retry-after': '2' } : {};
        fail(slug, slug === 'rate-limited' ? 'requestsPerMinute exceeded for this credential; retry after 2 seconds.' : `forced by X-Sim-Force: ${slug}`, {}, retry);
      }

      // ---- authentication and scope ----
      let principal = null;
      if (op.secured) {
        const auth = authenticate(headers, sim.world, sim.clock);
        if (auth.error) {
          fail('unauthenticated', auth.error === 'missing' ? 'no access token' : `access token ${auth.error}`, {}, { 'www-authenticate': 'Bearer realm="apx"' });
        }
        principal = auth.principal;
        const needed = op.scopes;
        const ok = !needed.length || principal.hasAny(needed) || (op.apdsRoles.length && principal.hasAny(op.apdsRoles));
        if (!ok) fail('insufficient-scope', `operation requires scope ${needed.join(' or ')}`);
      } else {
        const auth = authenticate(headers, sim.world, sim.clock);
        principal = auth.principal ?? new Principal({ sub: 'anonymous', scopes: [] });
      }

      // Scope before "not implemented": a claimed class the simulator has no
      // module for still refuses a token without the scope with 403.
      const handler = sim.handlers.get(op.operationId);
      if (!handler) fail('target-not-found', `operation ${op.operationId} is not implemented by this simulator yet`);

      // ---- body ----
      let body = request.body;
      if (typeof body === 'string') {
        if (body.trim() === '') body = undefined;
        else {
          try {
            body = JSON.parse(body);
          } catch (e) {
            fail('invalid-request', `request body is not valid JSON: ${e.message}`, { errors: [{ pointer: '/', detail: e.message }] });
          }
        }
      }
      const rc = requestContent(op);
      if (rc?.required && body === undefined && !handler.allowEmptyBody) {
        fail('invalid-request', 'a request body is required', { errors: [{ pointer: '/', detail: 'body required' }] });
      }
      for (const p of op.params.filter((q) => q.in === 'query' && q.required)) {
        if (!query.has(p.name)) fail('invalid-request', `required query parameter "${p.name}" missing`, { errors: [{ pointer: `?${p.name}`, detail: 'required' }] });
      }
      if (body !== undefined && !handler.skipBodyValidation) {
        const { errors } = validateRequestBody(op, body);
        if (errors) fail('invalid-request', `request body fails the schema: ${fmtErrors(errors).slice(0, 300)}`, { errors: ajvToErrors(errors) });
      }

      // ---- idempotency ----
      const idemKey = headers['idempotency-key'];
      if (op.idempotency?.required && !idemKey) fail('idempotency-key-required', `${op.method} ${op.path} requires an Idempotency-Key header`);
      if (op.idempotency && idemKey && principal) {
        const idemEntry = sim.store.idemGet(principal.sub, op.operationId, idemKey);
        if (idemEntry) {
          if (idemEntry.bodyHash !== hashBody(body)) fail('idempotency-conflict', `Idempotency-Key ${idemKey} was used with a different body`);
          const coll = sim.store.collection(idemEntry.collection);
          const current = coll.get(idemEntry.id);
          if (current) {
            const view = sim.views.get(idemEntry.collection);
            const bodyOut = view ? view(current, { principal, sim, headers, replay: true }) : current;
            return { status: 200, headers: { 'content-type': JSON_CT, etag: `"${current.version}"`, 'x-sim-idempotent-replay': 'true' }, body: bodyOut };
          }
        }
      }

      // ---- handler ----
      const ctx = {
        sim,
        op,
        method,
        path,
        params: match.params,
        query,
        headers,
        body,
        principal,
        clock: sim.clock,
        store: sim.store,
        hierarchy: sim.hierarchy,
        events: sim.events,
        world: sim.world,
        now: () => sim.clock.now(),
        // 'http' when served by the HTTP server (a handler may stream), 'inprocess' for dispatch()/replay
        transport: request.transport ?? 'inprocess',
        assignId: headers['x-sim-assign-id'],
        idemKey,
        fail,
        grant: (id, what) => requireGrant(sim.hierarchy, principal, id, what),
        grantPlaces: (param) => requireGrantForPlaces(sim.hierarchy, principal, param),
        coll: (name) => sim.store.collection(name),
        publish: (ev) => sim.events.publish(ev),
        actor: { org: principal?.orgRef, user: principal?.user },
        ifMatch: headers['if-match'] ? Number(String(headers['if-match']).replace(/^W\//, '').replace(/"/g, '')) : undefined,
      };
      let out = await handler(ctx);
      // A handler returns either a wire body (served as 200) or an envelope
      // { status: <number>, body, headers?, idem?, stream? }. A resource that
      // happens to carry its own `status` member (a Command, an Alert) is a body.
      const isEnvelope = out && typeof out === 'object' && typeof out.status === 'number' && (Object.hasOwn(out, 'body') || Object.hasOwn(out, 'stream'));
      if (out === undefined) out = { status: 204, body: undefined };
      else if (!isEnvelope) out = { status: 200, body: out };
      if (out.body !== undefined && typeof out.body === 'object' && out.body?.type?.startsWith?.(PROBLEM_BASE)) {
        out.headers = { 'content-type': PROBLEM_CT, ...(out.headers ?? {}) };
      }
      if (op.idempotency && idemKey && principal && out.idem && out.status < 300) {
        sim.store.idemPut(principal.sub, op.operationId, idemKey, { bodyHash: hashBody(body), ...out.idem });
      }
      const resHeaders = { ...(out.body !== undefined && !out.stream ? { 'content-type': JSON_CT } : {}), ...(out.headers ?? {}) };
      if (out.body?.version && !resHeaders.etag && op.method !== 'GET') resHeaders.etag = `"${out.body.version}"`;
      return { status: out.status, headers: resHeaders, body: out.body, stream: out.stream };
    } catch (e) {
      if (e instanceof ProblemError) return renderProblem(e, op, headers, instance);
      if (e?.collision) return renderProblem(new ProblemError('id-collision', e.message), op, headers, instance);
      console.error(`[sim] ${method} ${path} threw:`, e.stack ?? e);
      return {
        status: 500,
        headers: { 'content-type': PROBLEM_CT, 'x-sim-exception': String(e.message ?? e).slice(0, 200) },
        body: { type: 'about:blank', title: 'Simulator error', status: 500, detail: String(e.message ?? e) },
      };
    }
  })();

  // ---- contract check: does the simulator's own response validate? ----
  if (op && !result.stream && result.status !== 500) {
    const { errors, declared } = validateResponseBody(op, result.status, result.body);
    if (errors) {
      const msg = (declared ? '' : 'undeclared status: ') + fmtErrors(errors).slice(0, 400);
      result.headers['x-sim-contract'] = msg;
      if (sim.options.strict) {
        result.status = 500;
        result.body = { type: 'about:blank', title: 'Simulator contract violation', status: 500, detail: msg };
        result.headers['content-type'] = PROBLEM_CT;
      }
      sim.contractViolations.push({ time: started, method, path, status: result.status, detail: msg });
      if (sim.contractViolations.length > 500) sim.contractViolations.shift();
    }
  }
  sim.log.push({ time: started, method, path, status: result.status });
  if (sim.log.length > 2000) sim.log.shift();
  notifyLive(sim, 'request');
  return result;
}

function tokenEndpoint(sim, method, headers, rawBody) {
  if (method !== 'POST') return { status: 405, headers: { 'content-type': JSON_CT }, body: { error: 'method_not_allowed' } };
  let params = {};
  if (typeof rawBody === 'string' && rawBody) {
    if ((headers['content-type'] ?? '').includes('json')) {
      try {
        params = JSON.parse(rawBody);
      } catch {
        return { status: 400, headers: { 'content-type': JSON_CT }, body: { error: 'invalid_request' } };
      }
    } else params = Object.fromEntries(new URLSearchParams(rawBody).entries());
  } else if (rawBody && typeof rawBody === 'object') params = rawBody;
  if (headers.authorization?.startsWith('Basic ')) {
    const [id] = Buffer.from(headers.authorization.slice(6), 'base64').toString('utf8').split(':');
    params.client_id ??= id;
  }
  const name = params.client_id ?? 'default';
  const cred = sim.world.credentials?.[name];
  if (!cred) return { status: 401, headers: { 'content-type': JSON_CT }, body: { error: 'invalid_client', error_description: `no credential "${name}" in world ${sim.world.name}` } };
  const scopes = params.scope ? String(params.scope).split(/\s+/).filter((s) => cred.scopes?.includes(s)) : cred.scopes ?? [];
  const exp = new Date(sim.clock.nowMs() + 3600_000).toISOString();
  const token = encodeToken({ sub: name, ...cred, scopes, exp });
  return { status: 200, headers: { 'content-type': JSON_CT, 'cache-control': 'no-store' }, body: { access_token: token, token_type: 'Bearer', expires_in: 3600, scope: scopes.join(' ') } };
}

// ---------- the HTTP server ----------

export function createHttpServer(sim) {
  return createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (serveUi(req, res)) return;
    const out = await dispatch(sim, { method: req.method, path: req.url, headers: req.headers, body: raw, transport: 'http' });
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': '*',
      ...out.headers,
    };
    if (out.stream) {
      res.writeHead(out.status, { ...headers, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      // The response's 'close' marks the client going away; the request's has already fired once its body was read.
      // A client that left while the request was dispatched has already closed: clean up at once.
      out.stream({ write: (s) => res.write(s), end: () => res.end(), onClose: (fn) => (res.destroyed ? queueMicrotask(fn) : res.once('close', fn)) });
      return;
    }
    const payload = out.body === undefined ? undefined : typeof out.body === 'string' ? out.body : JSON.stringify(out.body, null, 2);
    if (payload === undefined) delete headers['content-type'];
    res.writeHead(out.status, headers);
    res.end(payload);
  });
}
