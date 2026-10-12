/**
 * Replay the vetting suite (docs/scenarios/by-module/<module>/scenarios.md)
 * against the simulator and report, per exchange, whether the simulator
 * answered with the status the scenario shows, a body that validates
 * against the bundle, and (for refusals) the same problem type.
 *
 * The markdown is read with the same markers tools/vetting-scenarios.mjs
 * uses. The ```http block above a request supplies its headers
 * (Authorization, Idempotency-Key, If-Match, Prefer, Accept,
 * APX-Update-Mode, Last-Event-ID). Three fixtures stand in for what prose
 * alone describes:
 *
 *   X-Sim-Assign-Id  the id the scenario shows for a created resource, so
 *                    later requests in the file address the same record
 *   X-Sim-Now        the latest instant the expected response shows, so
 *                    expiries and windows line up with the scenario clock
 *   X-Sim-Force      only for `rate-limited`: throttling is a server
 *                    condition no request can reach by itself
 *
 * Optional stage directions in tools/directions/<module>.json inject world
 * events (a device fault, a car arriving) before a given exchange.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APX_DIR, findOp, PROBLEM_BASE, validateResponseBody, fmtErrors } from '../src/kernel/spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITE = join(APX_DIR, 'docs', 'scenarios', 'by-module');
const DIRECTIONS = join(HERE, 'directions');

// ---------- markdown tokenizer (markers, json blocks, http blocks) ----------

const MARKER = /^<!--\s*apx:(module|scenario|request|response|validate)\s*(.*?)\s*-->$/;

function parseArgs(text) {
  const attrs = {};
  const positional = [];
  for (const tok of text.split(/\s+/).filter(Boolean)) {
    const eq = tok.indexOf('=');
    if (eq > 0 && !tok.startsWith('/')) attrs[tok.slice(0, eq)] = tok.slice(eq + 1);
    else positional.push(tok);
  }
  return { attrs, positional };
}

function tokenize(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    const m = t.match(MARKER);
    if (m) {
      items.push({ type: 'marker', kind: m[1], ...parseArgs(m[2]), line: i + 1 });
      continue;
    }
    if (t === '```json' || t === '```http') {
      const start = i + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== '```') end += 1;
      const raw = lines.slice(start, end).join('\n');
      if (t === '```json') {
        const item = { type: 'json', line: start };
        try {
          item.payload = JSON.parse(raw);
        } catch (e) {
          item.error = e.message;
        }
        items.push(item);
      } else items.push({ type: 'http', line: start, raw });
      i = end;
    }
  }
  return items;
}

function parseHttpBlock(raw) {
  const headers = {};
  let noAuth = false;
  for (const line of raw.split('\n')) {
    const h = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (h && !/^(GET|POST|PUT|PATCH|DELETE)$/.test(h[1])) headers[h[1].toLowerCase()] = h[2].trim();
    if (/no Authorization header/i.test(line)) noAuth = true;
  }
  return { headers, noAuth };
}

/** Group the file into scenarios → exchanges { method, path, invalid, gap, headers, body, expectedStatus, expected, line }. */
export function parseScenarios(file) {
  const items = tokenize(readFileSync(file, 'utf8').split('\n'));
  const scenarios = [];
  let module = null;
  let current = null;
  let pendingHttp = null;
  let exchange = null;
  let expectBody = null; // 'request' | 'response'
  for (const item of items) {
    if (item.type === 'marker') {
      if (item.kind === 'module') module = { name: item.positional[0], ...item.attrs };
      else if (item.kind === 'scenario') {
        current = { id: item.positional[0], kind: item.attrs.kind, line: item.line, exchanges: [] };
        scenarios.push(current);
      } else if (item.kind === 'request') {
        const [method, path] = item.positional;
        exchange = {
          method,
          path,
          invalid: item.positional.includes('invalid'),
          gap: item.attrs.gap,
          headers: pendingHttp?.headers ?? {},
          noAuth: pendingHttp?.noAuth ?? false,
          body: undefined,
          line: item.line,
        };
        pendingHttp = null;
        if (!current) {
          current = { id: 'preamble', exchanges: [] };
          scenarios.push(current);
        }
        current.exchanges.push(exchange);
        expectBody = 'request';
      } else if (item.kind === 'response') {
        if (exchange) {
          exchange.expectedStatus = Number(item.positional[0]);
          exchange.responseGap = item.attrs.gap;
        }
        expectBody = 'response';
      }
      continue;
    }
    if (item.type === 'http') {
      pendingHttp = parseHttpBlock(item.raw);
      continue;
    }
    if (item.type === 'json') {
      if (expectBody === 'request' && exchange) exchange.body = item.payload;
      else if (expectBody === 'response' && exchange) exchange.expected = item.payload;
      expectBody = null;
    }
  }
  return { module, scenarios };
}

// ---------- fixtures derived from the expected response ----------

const TIME_KEY = /(time|Time|At|Instant|lastUpdate|timestamp|dateCollected|recordDateTime|computedAt|publicationTime)$/;
const NOT_CLOCK = /^(expiryTime|expiry|exp|validEnd|validStart|actualEnd|endTime|validityEnd|supplyValidityEnd|expiresAt|notBefore|notAfter|pickupTime|requestedPickupTime|promisedTime|requestedFor|eta|estimatedTime|dueTime|startTime|plannedStart|plannedEnd|deadline|until|since|periodEnd|periodStart)$/;

function collectInstants(value, out = [], key = '') {
  if (Array.isArray(value)) value.forEach((v) => collectInstants(v, out, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collectInstants(v, out, k);
  else if (typeof value === 'string' && TIME_KEY.test(key) && !NOT_CLOCK.test(key) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value)) out.push(value);
  return out;
}

const problemSlug = (body) => (typeof body?.type === 'string' && body.type.startsWith(PROBLEM_BASE) ? body.type.slice(PROBLEM_BASE.length) : null);

// ---------- transport ----------

function makeTransport({ url, sim }) {
  if (url) {
    const base = url.replace(/\/$/, '');
    return {
      remote: true,
      async send(req) {
        // HTTP header values must be ASCII: expand `xx…NNNN` ids, map the bare `…` token to the default credential.
        const ascii = (v) => String(v).replace(/\b([0-9a-f]{2})…([0-9a-f]{4})\b/g, (_, p, s) => `${p}000000-0000-4000-8000-00000000${s}`).replace(/^Bearer …$/, 'Bearer default').replace(/[^\x20-\x7e]/g, '-');
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, ascii(v)]));
        const res = await fetch(base + req.path, { method: req.method, headers, body: req.body });
        const text = await res.text();
        let body;
        try {
          body = text ? JSON.parse(text) : undefined;
        } catch {
          body = text;
        }
        return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
      },
      async control(method, path, body) {
        const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        return res.json().catch(() => ({}));
      },
    };
  }
  return {
    remote: false,
    send: (req) => sim.dispatch(req),
    control: async (method, path, body) => (await sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).body,
  };
}

// ---------- the run ----------

export async function replay({ modules = [], url, verbose = false, json, summary = false } = {}) {
  const available = readdirSync(SUITE).filter((d) => existsSync(join(SUITE, d, 'scenarios.md')));
  const wanted = modules.length ? modules.map((m) => (m.includes('/') || m.includes('\\') ? m : m.startsWith('apx-') ? m : `apx-${m}`)) : available;
  let sim = null;
  if (!url) {
    const { Simulator } = await import('../src/index.mjs');
    sim = new Simulator({ world: 'default' });
  }
  const transport = makeTransport({ url, sim });
  const report = { modules: [], passed: 0, failed: 0, gaps: 0, contract: 0, exchanges: 0 };

  for (const mod of wanted) {
    const file = mod.endsWith('.md') ? resolve(mod) : join(SUITE, mod, 'scenarios.md');
    if (!existsSync(file)) {
      console.error(`no scenarios at ${file}`);
      continue;
    }
    const { module, scenarios } = parseScenarios(file);
    const name = module?.name ?? mod;
    const worldName = name;
    let reset = await transport.control('POST', '/sim/reset', { world: worldName }).catch(() => null);
    if (!reset || reset.error) reset = await transport.control('POST', '/sim/reset', { world: 'default' });
    const directions = existsSync(join(DIRECTIONS, `${name}.json`)) ? JSON.parse(readFileSync(join(DIRECTIONS, `${name}.json`), 'utf8')) : {};
    const modReport = { module: name, world: reset?.world ?? 'default', scenarios: scenarios.length, exchanges: 0, passed: 0, failed: 0, gaps: 0, contract: 0, failures: [], contractIssues: [] };

    for (const sc of scenarios) {
      let clockFloor = 0;
      const steps = directions[sc.id] ?? [];
      let overrideHeaders = {};
      const runDirections = async (at) => {
        overrideHeaders = {};
        for (const d of steps.filter((s) => (s.at ?? 'start') === at)) {
          // `headers` is a per-exchange fixture: the token the prose names
          // for a request that has no ```http block of its own.
          if (d.headers) overrideHeaders = { ...overrideHeaders, ...Object.fromEntries(Object.entries(d.headers).map(([k, v]) => [k.toLowerCase(), v])) };
          if (d.inject) await transport.control('POST', '/sim/inject', d.inject);
          if (d.clock) await transport.control('POST', '/sim/clock', d.clock);
          if (d.state) await transport.control('PUT', `/sim/state/${d.state.collection}/${d.state.id}`, d.state.record);
          if (d.receiver) await transport.control('PUT', '/sim/receivers', d.receiver);
          if (d.reset) await transport.control('POST', '/sim/reset', { world: d.reset === true ? worldName : d.reset });
        }
      };
      await runDirections('start');
      for (let i = 0; i < sc.exchanges.length; i += 1) {
        const ex = sc.exchanges[i];
        await runDirections(i);
        const op = findOp(ex.method, ex.path)?.op;
        const headers = { ...ex.headers, ...overrideHeaders };
        const expectedSlug = problemSlug(ex.expected);
        // authorization
        if (ex.noAuth) delete headers.authorization;
        else if (!headers.authorization) {
          if (ex.expectedStatus === 401) headers.authorization = 'Bearer <expired>';
          else if (expectedSlug === 'insufficient-scope') headers.authorization = 'Bearer <APDS role ep; no apx.* scopes>';
          else headers.authorization = 'Bearer …';
        }
        // fixtures
        if (ex.expected && typeof ex.expected === 'object' && typeof ex.expected.id === 'string' && ex.method === 'POST' && ex.expectedStatus >= 200 && ex.expectedStatus < 300) {
          headers['x-sim-assign-id'] = ex.expected.id;
        }
        const instants = collectInstants(ex.expected).sort();
        const latest = instants.at(-1);
        if (latest && Date.parse(latest) >= clockFloor) {
          headers['x-sim-now'] = latest;
          clockFloor = Date.parse(latest);
        }
        if (expectedSlug === 'rate-limited') headers['x-sim-force'] = 'rate-limited';
        if (ex.body !== undefined) headers['content-type'] ??= 'application/json';

        const req = { method: ex.method, path: ex.path, headers, body: ex.body === undefined ? undefined : JSON.stringify(ex.body) };
        let res;
        try {
          res = await transport.send(req);
        } catch (e) {
          res = { status: 0, headers: {}, body: { error: e.message } };
        }
        modReport.exchanges += 1;
        const actualSlug = problemSlug(res.body);
        const statusOk = ex.expectedStatus === undefined || res.status === ex.expectedStatus;
        const slugOk = !expectedSlug || expectedSlug === actualSlug;
        let contractNote = res.headers['x-sim-contract'];
        if (transport.remote && op && !contractNote) {
          const found = findOp(ex.method, ex.path);
          const v = validateResponseBody(found.op, res.status, res.body);
          if (v.errors) contractNote = fmtErrors(v.errors).slice(0, 300);
        }
        const entry = {
          scenario: sc.id,
          line: ex.line,
          request: `${ex.method} ${ex.path}`,
          expected: `${ex.expectedStatus ?? '-'}${expectedSlug ? ' ' + expectedSlug : ''}`,
          actual: `${res.status}${actualSlug ? ' ' + actualSlug : ''}`,
          detail: res.body?.detail ?? res.headers['x-sim-exception'] ?? (typeof res.body === 'object' && res.body?.title) ?? '',
        };
        if (statusOk && slugOk) {
          modReport.passed += 1;
          if (verbose) console.log(`  + ${sc.id} ${entry.request} -> ${entry.actual}`);
        } else if (ex.gap || ex.responseGap) {
          modReport.gaps += 1;
          if (verbose) console.log(`  ~ ${sc.id} ${entry.request} expected ${entry.expected} got ${entry.actual} (gap ${ex.gap ?? ex.responseGap})`);
        } else {
          modReport.failed += 1;
          modReport.failures.push(entry);
          if (verbose) console.log(`  x ${sc.id} ${entry.request} expected ${entry.expected} got ${entry.actual} -- ${entry.detail}`);
        }
        if (contractNote) {
          modReport.contract += 1;
          modReport.contractIssues.push({ ...entry, contract: contractNote });
          if (verbose) console.log(`    ! contract: ${contractNote}`);
        }
      }
    }
    report.modules.push(modReport);
    report.passed += modReport.passed;
    report.failed += modReport.failed;
    report.gaps += modReport.gaps;
    report.contract += modReport.contract;
    report.exchanges += modReport.exchanges;
    const pct = modReport.exchanges ? Math.round((modReport.passed / modReport.exchanges) * 100) : 0;
    console.log(`${name.padEnd(18)} world=${String(modReport.world).padEnd(16)} ${String(modReport.passed).padStart(4)}/${String(modReport.exchanges).padEnd(4)} passed (${String(pct).padStart(3)}%)  failed ${String(modReport.failed).padStart(3)}  gaps ${modReport.gaps}  contract ${modReport.contract}`);
    if (!summary && !verbose) {
      for (const fl of modReport.failures.slice(0, 40)) console.log(`   x ${fl.scenario.padEnd(7)} :${String(fl.line).padEnd(5)} ${fl.request.padEnd(70)} expected ${fl.expected.padEnd(32)} got ${fl.actual}  ${String(fl.detail).slice(0, 100)}`);
      if (modReport.failures.length > 40) console.log(`   ... ${modReport.failures.length - 40} more`);
      for (const c of modReport.contractIssues.slice(0, 10)) console.log(`   ! ${c.scenario.padEnd(7)} :${String(c.line).padEnd(5)} ${c.request.padEnd(70)} ${c.contract.slice(0, 120)}`);
      if (modReport.contractIssues.length > 10) console.log(`   ... ${modReport.contractIssues.length - 10} more contract issues`);
    }
  }
  const pct = report.exchanges ? Math.round((report.passed / report.exchanges) * 100) : 0;
  console.log(`\ntotal ${report.passed}/${report.exchanges} exchanges passed (${pct}%), ${report.failed} failed, ${report.gaps} known gaps, ${report.contract} contract issues`);
  if (json) writeFileSync(resolve(json), JSON.stringify(report, null, 2));
  return report;
}
