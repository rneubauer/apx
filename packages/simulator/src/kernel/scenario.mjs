/**
 * Scenario steps, shared by the CLI runner (tools/script.mjs) and the
 * browser UI (POST /sim/scenario/step and /sim/scenario/run).
 *
 * A step may carry: name, narration, prepare, clock, inject, reset, receiver,
 * state, request (+ expect, save), events, deliveries, continueOnFailure.
 * `prepare` ({module, before}) sets the stage for a vetting-suite scenario.
 * `{var}` in any string substitutes a value saved by an earlier step.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandIds } from './world.mjs';
import { PROBLEM_BASE } from './spec.mjs';

// APX_SIM_SCENARIOS_DIR lets a test save scenarios into its own copy, so
// test files running in parallel never see each other's temporary files.
export const SCENARIOS_DIR = process.env.APX_SIM_SCENARIOS_DIR
  ? resolve(process.env.APX_SIM_SCENARIOS_DIR)
  : join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const SCENARIO_NAME = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function substitute(value, vars) {
  if (typeof value === 'string') return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, vars)]));
  return value;
}

export function pick(obj, path) {
  return String(path)
    .replace(/^\$\.?/, '')
    .split('.')
    .filter(Boolean)
    .reduce((n, k) => (Array.isArray(n) ? n[Number(k)] : n?.[k]), obj);
}

export function partialMatch(expected, actual) {
  if (expected === null || typeof expected !== 'object') return expected === actual;
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((e, i) => partialMatch(e, actual[i]));
  if (!actual || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([k, v]) => partialMatch(v, actual[k]));
}

export const tokenOf = (t) => (!t ? 'Bearer …' : t.startsWith('Bearer ') ? t : `Bearer ${t}`);

const STEP_KINDS = ['request', 'inject', 'clock', 'events', 'deliveries', 'state', 'receiver', 'reset', 'prepare'];

/** The kind of a step, for display: the first action member it carries. */
export function stepKind(step) {
  return STEP_KINDS.find((k) => step[k] !== undefined) ?? 'note';
}

/**
 * Run one step. `io.send(req)` serves a standard request; `io.control(method,
 * path, body)` reaches /sim. Returns { ok, error?, vars, request?, response?, checks? };
 * `checks` lists each assertion the step made (status, problem, body leaf,
 * contract, event count, delivery) with expected, actual and ok.
 * A failed expectation is reported, not thrown; the caller decides whether to stop.
 */
export async function runStep(raw, { io, vars = {}, defaultToken, defaultWorld = 'default' }) {
  const step = expandIds(substitute(raw, vars));
  const nextVars = { ...vars };
  const out = { ok: true, kind: stepKind(step), vars: nextVars };
  try {
    if (step.prepare) {
      out.prepare = await io.control('POST', '/sim/scenario/prepare', step.prepare);
      if (out.prepare?.error) throw new Error(`set the stage: ${out.prepare.detail ?? out.prepare.error}`);
    }
    if (step.reset) await io.control('POST', '/sim/reset', { world: step.reset === true ? defaultWorld : step.reset });
    if (step.clock) out.clock = await io.control('POST', '/sim/clock', step.clock);
    if (step.inject) {
      const r = await io.control('POST', '/sim/inject', step.inject);
      out.inject = r;
      if (r?.ok === false) throw new Error(`inject ${step.inject.kind}: ${r.error ?? r.detail}`);
    }
    if (step.receiver) await io.control('PUT', '/sim/receivers', step.receiver);
    if (step.state) await io.control('PUT', `/sim/state/${step.state.collection}/${step.state.id}`, step.state.record);
    if (step.request) await runRequest(step, out, { io, nextVars, defaultToken });
    if (step.events) await checkEvents(step.events, out, io);
    if (step.deliveries) await checkDeliveries(step.deliveries, out, io);
  } catch (e) {
    out.ok = false;
    out.error = e.message;
  }
  return out;
}

async function runRequest(step, out, { io, nextVars, defaultToken }) {
  const rq = step.request;
  const method = (rq.method ?? 'GET').toUpperCase();
  const headers = { authorization: rq.token ? tokenOf(rq.token) : defaultToken, ...(rq.body !== undefined ? { 'content-type': 'application/json' } : {}) };
  for (const [k, v] of Object.entries(rq.headers ?? {})) headers[k.toLowerCase()] = v;
  if (rq.noAuth) delete headers.authorization;
  const res = await io.send({ method, path: rq.path, headers, body: rq.body === undefined ? undefined : JSON.stringify(rq.body) });
  const slug = typeof res.body?.type === 'string' && res.body.type.startsWith(PROBLEM_BASE) ? res.body.type.slice(PROBLEM_BASE.length) : null;
  out.request = { method, path: rq.path, headers, body: rq.body };
  out.response = { status: res.status, problem: slug, contract: res.headers?.['x-sim-contract'] ?? null, headers: res.headers, body: res.body };
  const ex = step.expect ?? {};
  out.checks = [...(out.checks ?? []), ...requestChecks(ex, out.response)];
  if (ex.status !== undefined && res.status !== ex.status) throw new Error(`expected status ${ex.status}, got ${res.status}${slug ? ' ' + slug : ''}${res.body?.detail ? ': ' + res.body.detail : ''}`);
  if (ex.problem && slug !== ex.problem) throw new Error(`expected problem ${ex.problem}, got ${slug ?? res.status}`);
  if (ex.body !== undefined && !partialMatch(ex.body, res.body)) throw new Error(`body mismatch: expected ${JSON.stringify(ex.body).slice(0, 300)}`);
  if (out.response.contract && ex.allowContract !== true) throw new Error(`response violates the bundle: ${out.response.contract}`);
  for (const [k, path] of Object.entries(step.save ?? {})) nextVars[k] = pick(res.body, path);
}

const MAX_BODY_CHECKS = 40; // a partial body is small; this only guards the result size

/**
 * The leaves of a partial-body expectation, each with the value found at the
 * same place in the actual body: [{ path: 'currentTicket.paidInFull', expected, actual }].
 * An empty object or array is a leaf of its own (it asserts only the shape).
 */
function bodyLeaves(expected, actual, path = '') {
  const container = expected !== null && typeof expected === 'object';
  const entries = container ? (Array.isArray(expected) ? expected.map((v, i) => [i, v]) : Object.entries(expected)) : [];
  if (!entries.length) return [{ path, expected, actual }];
  const shapeOk = Array.isArray(expected) ? Array.isArray(actual) : actual !== null && typeof actual === 'object';
  return entries.flatMap(([k, v]) => {
    const childPath = typeof k === 'number' ? `${path}[${k}]` : path ? `${path}.${k}` : k;
    return bodyLeaves(v, shapeOk ? actual[k] : undefined, childPath);
  });
}

/**
 * One entry per assertion a request step makes, pass or fail, so a UI can
 * show expected next to actual: { check, path?, expected, actual, missing?, ok }.
 * Additive: `ok` and `error` on the step stay the verdict.
 */
export function requestChecks(ex, response) {
  const checks = [];
  if (ex.status !== undefined) checks.push({ check: 'status', expected: ex.status, actual: response.status, ok: response.status === ex.status });
  if (ex.problem) checks.push({ check: 'problem', expected: ex.problem, actual: response.problem ?? null, ok: response.problem === ex.problem });
  if (ex.body !== undefined) {
    const leaves = bodyLeaves(ex.body, response.body);
    const body = leaves.slice(0, MAX_BODY_CHECKS).map((l) => ({
      check: 'body', path: l.path, expected: l.expected, actual: l.actual ?? null, ...(l.actual === undefined ? { missing: true } : {}), ok: partialMatch(l.expected, l.actual),
    }));
    // The leaves and partialMatch agree by construction; keep the verdict honest if they ever do not.
    if (body.every((c) => c.ok) && !partialMatch(ex.body, response.body)) body.push({ check: 'body', path: '', expected: ex.body, actual: response.body ?? null, ok: false });
    checks.push(...body);
  }
  if (response.contract) checks.push({ check: 'contract', expected: 'valid against the APX bundle', actual: response.contract, ok: ex.allowContract === true, allowed: ex.allowContract === true });
  return checks;
}

async function checkEvents(spec, out, io) {
  const q = new URLSearchParams();
  if (spec.type) q.set('type', spec.type);
  if (spec.since) q.set('since', spec.since);
  const r = await io.control('GET', `/sim/events?${q}`);
  const n = r?.count ?? 0;
  out.eventCount = n;
  const what = spec.type ?? 'any type';
  const bounds = [['min', (x) => n >= x], ['max', (x) => n <= x], ['exactly', (x) => n === x]];
  const counted = bounds.filter(([k]) => spec[k] !== undefined)
    .map(([k, test]) => ({ check: 'events', type: spec.type ?? null, bound: k, expected: spec[k], actual: n, ok: test(spec[k]) }));
  out.checks = [...(out.checks ?? []), ...counted];
  if (spec.min !== undefined && n < spec.min) throw new Error(`expected at least ${spec.min} events of ${what}, saw ${n}`);
  if (spec.max !== undefined && n > spec.max) throw new Error(`expected at most ${spec.max} events of ${what}, saw ${n}`);
  if (spec.exactly !== undefined && n !== spec.exactly) throw new Error(`expected exactly ${spec.exactly} events of ${what}, saw ${n}`);
}

async function checkDeliveries(spec, out, io) {
  const q = spec.subscription ? `?subscription=${encodeURIComponent(spec.subscription)}` : '';
  const r = await io.control('GET', `/sim/deliveries${q}`);
  const rows = r?.deliveries ?? [];
  out.deliveryCount = rows.length;
  if (spec.status) {
    const seen = [...new Set(rows.map((d) => d.status))];
    out.checks = [...(out.checks ?? []), { check: 'delivery', expected: spec.status, actual: seen, ok: seen.includes(spec.status) }];
  }
  if (spec.status && !rows.some((d) => d.status === spec.status)) throw new Error(`no delivery in status ${spec.status}`);
}

// ---------- scenario files ----------

export function validScenarioName(name) {
  return typeof name === 'string' && SCENARIO_NAME.test(name);
}

function requireName(id) {
  if (!validScenarioName(id)) throw new Error('scenario ids are lower-case letters, digits and hyphens (at most 81)');
}

export function listScenarios() {
  if (!existsSync(SCENARIOS_DIR)) return [];
  return readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const id = f.slice(0, -5);
      try {
        const s = JSON.parse(readFileSync(join(SCENARIOS_DIR, f), 'utf8'));
        return { id, name: s.name ?? id, world: s.world ?? 'default', steps: (s.steps ?? []).length, description: s.description ?? null };
      } catch (e) {
        return { id, name: id, error: e.message };
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readScenario(id) {
  requireName(id);
  const file = join(SCENARIOS_DIR, `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeScenario(id, scenario) {
  requireName(id);
  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps)) throw new Error('a scenario is an object with a steps array');
  mkdirSync(SCENARIOS_DIR, { recursive: true });
  writeFileSync(join(SCENARIOS_DIR, `${id}.json`), JSON.stringify(scenario, null, 2) + '\n');
  return { id, steps: scenario.steps.length };
}
