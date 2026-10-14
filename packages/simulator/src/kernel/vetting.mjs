/**
 * The vetting suite (docs/scenarios/by-module/<module>/scenarios.md) as the
 * simulator sees it: the markdown parsed into scenarios and exchanges, the
 * requests each exchange sends (with the replay fixtures), and each
 * scenario as a step-by-step scenario the UI can present.
 *
 * Used by tools/replay.mjs (the whole suite, module by module), by the
 * Present view (one scenario at a time), and by POST /sim/scenario/prepare,
 * which sets the stage for a scenario by replaying the ones before it in
 * its module, as the suite does: later scenarios build on records earlier
 * ones created.
 *
 * Replay fixtures, derived from the scenario text:
 *   X-Sim-Assign-Id  the id the scenario shows for a created resource
 *   X-Sim-Now        the latest instant the expected response shows
 *   X-Sim-Force      only for `rate-limited`
 * Stage directions in tools/directions/<module>.json inject the world
 * events the prose describes but no request performs.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APX_DIR, PROBLEM_BASE } from './spec.mjs';
import { listWorlds } from './world.mjs';

export const SUITE_DIR = join(APX_DIR, 'docs', 'scenarios', 'by-module');
export const DIRECTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tools', 'directions');
export const VETTING_PREFIX = 'vetting~';
const NARRATION_MAX = 600;

// ---------- markdown tokenizer (markers, json and http blocks, headings, prose) ----------

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

/** Skip a fenced block that is neither json nor http; returns the index of its closing fence. */
function skipFence(lines, i) {
  let end = i + 1;
  while (end < lines.length && !lines[end].trim().startsWith('```')) end += 1;
  return end;
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
    } else if (t.startsWith('```')) i = skipFence(lines, i);
    else if (t.startsWith('## ')) items.push({ type: 'heading', text: t.slice(3).trim() });
    else if (t && t !== '---' && !t.startsWith('#') && !t.startsWith('<!--')) items.push({ type: 'text', text: t });
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

/** Markdown prose as plain text for narration: emphasis and code marks dropped, length capped. */
function plain(lines) {
  const text = lines.join(' ').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  return text.length > NARRATION_MAX ? `${text.slice(0, NARRATION_MAX - 1).trimEnd()}…` : text;
}

/** "CTL-01 — Vend the exit gate" → "Vend the exit gate". */
function titleOf(heading, id) {
  if (!heading) return id;
  return heading.startsWith(id) ? heading.slice(id.length).replace(/^\s*[—–-]\s*/, '') || id : heading;
}

/**
 * Group a scenarios.md into scenarios → exchanges
 * { method, path, invalid, gap, headers, noAuth, body, expectedStatus, expected, line, prose }.
 * Each scenario also carries its `title` (the heading) and `summary` (the prose under it).
 */
export function parseScenarioText(text) {
  const items = tokenize(text.split('\n'));
  const scenarios = [];
  let module = null;
  let current = null;
  let pendingHttp = null;
  let exchange = null;
  let expectBody = null; // 'request' | 'response'
  let heading = null;
  let prose = [];
  for (const item of items) {
    if (item.type === 'heading') {
      heading = item.text;
      prose = [];
    } else if (item.type === 'text') prose.push(item.text);
    else if (item.type === 'http') pendingHttp = parseHttpBlock(item.raw);
    else if (item.type === 'json') {
      if (expectBody === 'request' && exchange) exchange.body = item.payload;
      else if (expectBody === 'response' && exchange) {
        exchange.expected = item.payload;
        prose = [];
      }
      expectBody = null;
    } else if (item.kind === 'module') module = { name: item.positional[0], ...item.attrs };
    else if (item.kind === 'scenario') {
      const id = item.positional[0];
      current = { id, kind: item.attrs.kind, title: titleOf(heading, id), line: item.line, exchanges: [] };
      scenarios.push(current);
      prose = [];
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
        prose: plain(prose),
      };
      pendingHttp = null;
      prose = [];
      if (!current) {
        current = { id: 'preamble', title: 'preamble', exchanges: [] };
        scenarios.push(current);
      }
      current.summary ??= exchange.prose;
      current.exchanges.push(exchange);
      expectBody = 'request';
    } else if (item.kind === 'response') {
      if (exchange) {
        exchange.expectedStatus = Number(item.positional[0]);
        exchange.responseGap = item.attrs.gap;
      }
      expectBody = 'response';
    }
  }
  return { module, scenarios };
}

export const parseScenarios = (file) => parseScenarioText(readFileSync(file, 'utf8'));

// ---------- the requests a scenario sends ----------

const TIME_KEY = /(time|Time|At|Instant|lastUpdate|timestamp|dateCollected|recordDateTime|computedAt|publicationTime)$/;
const NOT_CLOCK = /^(expiryTime|expiry|exp|validEnd|validStart|actualEnd|endTime|validityEnd|supplyValidityEnd|expiresAt|notBefore|notAfter|pickupTime|requestedPickupTime|promisedTime|requestedFor|eta|estimatedTime|dueTime|startTime|plannedStart|plannedEnd|deadline|until|since|periodEnd|periodStart)$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function collectInstants(value, out = [], key = '') {
  if (Array.isArray(value)) value.forEach((v) => collectInstants(v, out, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collectInstants(v, out, k);
  else if (typeof value === 'string' && TIME_KEY.test(key) && !NOT_CLOCK.test(key) && INSTANT.test(value)) out.push(value);
  return out;
}

export const problemSlug = (body) => (typeof body?.type === 'string' && body.type.startsWith(PROBLEM_BASE) ? body.type.slice(PROBLEM_BASE.length) : null);

const lowerKeys = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));

/** The token the replay sends when the scenario names none. */
function defaultAuthorization(ex, expectedSlug) {
  if (ex.expectedStatus === 401) return 'Bearer <expired>';
  if (expectedSlug === 'insufficient-scope') return 'Bearer <APDS role ep; no apx.* scopes>';
  return 'Bearer …';
}

/**
 * What replaying `sc` does, in order: stage directions ({ direction }) and
 * requests ({ exchange, request, expectedSlug }). `request.headers` carry
 * the token and the replay fixtures.
 */
export function planScenario(sc, directions = {}) {
  const steps = directions[sc.id] ?? [];
  const at = (i) => steps.filter((s) => (s.at ?? 'start') === i);
  const actions = at('start').map((direction) => ({ direction }));
  let clockFloor = 0;
  sc.exchanges.forEach((ex, i) => {
    let override = {};
    for (const d of at(i)) {
      // `headers` is a per-exchange fixture: the token the prose names for a request with no ```http block.
      if (d.headers) override = { ...override, ...lowerKeys(d.headers) };
      actions.push({ direction: d });
    }
    const headers = { ...ex.headers, ...override };
    const expectedSlug = problemSlug(ex.expected);
    if (ex.noAuth) delete headers.authorization;
    else headers.authorization ??= defaultAuthorization(ex, expectedSlug);
    if (ex.expected && typeof ex.expected === 'object' && typeof ex.expected.id === 'string' && ex.method === 'POST' && ex.expectedStatus >= 200 && ex.expectedStatus < 300) {
      headers['x-sim-assign-id'] = ex.expected.id;
    }
    const latest = collectInstants(ex.expected).sort().at(-1);
    if (latest && Date.parse(latest) >= clockFloor) {
      headers['x-sim-now'] = latest;
      clockFloor = Date.parse(latest);
    }
    if (expectedSlug === 'rate-limited') headers['x-sim-force'] = 'rate-limited';
    if (ex.body !== undefined) headers['content-type'] ??= 'application/json';
    actions.push({ exchange: ex, expectedSlug, request: { method: ex.method, path: ex.path, headers, body: ex.body === undefined ? undefined : JSON.stringify(ex.body) } });
  });
  return actions;
}

/** Carry out one stage direction through `control(method, path, body)`, in the replay's order. */
export async function applyDirection(control, d, worldName) {
  if (d.inject) await control('POST', '/sim/inject', d.inject);
  if (d.clock) await control('POST', '/sim/clock', d.clock);
  if (d.state) await control('PUT', `/sim/state/${d.state.collection}/${d.state.id}`, d.state.record);
  if (d.receiver) await control('PUT', '/sim/receivers', d.receiver);
  if (d.reset) await control('POST', '/sim/reset', { world: d.reset === true ? worldName : d.reset });
}

// ---------- the suite, read once ----------

let cache = null;

export function readDirections(module) {
  const file = join(DIRECTIONS_DIR, `${module}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

/** The world a module's scenarios run in: the module's own, else default (as the replay does). */
export const worldFor = (module) => (listWorlds().includes(module) ? module : 'default');

/** Every module of the suite: [{ name, world, scenarios, directions }]. */
export function suite() {
  if (cache) return cache;
  const dirs = existsSync(SUITE_DIR) ? readdirSync(SUITE_DIR).filter((d) => existsSync(join(SUITE_DIR, d, 'scenarios.md'))) : [];
  cache = dirs.map((dir) => {
    const { module, scenarios } = parseScenarios(join(SUITE_DIR, dir, 'scenarios.md'));
    const name = module?.name ?? dir;
    return { name, world: worldFor(name), scenarios, directions: readDirections(name) }; // a preamble stays: replays run it
  });
  return cache;
}

const idOf = (module, scenarioId) => `${VETTING_PREFIX}${module}~${scenarioId}`;
export const isVettingId = (id) => String(id).startsWith(VETTING_PREFIX);

function locate(id) {
  const [, module, scenarioId] = String(id).split('~');
  const mod = suite().find((m) => m.name === module);
  const index = mod ? mod.scenarios.findIndex((s) => s.id === scenarioId) : -1;
  return index < 0 ? null : { mod, index, sc: mod.scenarios[index] };
}

/** The Present list: one entry per vetting scenario. */
export function listVetting() {
  return suite().flatMap((m) =>
    m.scenarios.filter((sc) => sc.id !== 'preamble').map((sc) => ({
      id: idOf(m.name, sc.id),
      name: `${sc.id} — ${sc.title}`,
      world: m.world,
      module: m.name,
      kind: sc.kind ?? 'other',
      steps: 1 + vettingSteps(m, sc).length,
      description: sc.summary || null,
      source: 'vetting',
    })));
}

/** A stage direction as scenario steps, one per member, in the replay's order. */
function directionSteps(d) {
  const out = [];
  if (d.inject) out.push({ name: `The world: ${d.inject.kind}`, inject: d.inject });
  if (d.clock) out.push({ name: d.clock.now ? `The clock: ${d.clock.now}` : `The clock moves on ${d.clock.advance}`, clock: d.clock });
  if (d.state) out.push({ name: `The world: a ${d.state.collection} record changes`, state: d.state });
  if (d.receiver) out.push({ name: 'A webhook receiver changes how it answers', receiver: d.receiver });
  if (d.reset) out.push({ name: 'The world reloads', reset: d.reset });
  return out;
}

/** One request of the suite as a scenario step: the same request the replay sends, expecting its status and problem type. */
function requestStep({ exchange: ex, request, expectedSlug }) {
  const { authorization, 'content-type': _contentType, ...headers } = request.headers;
  const gap = ex.gap ?? ex.responseGap;
  const narration = [ex.prose, gap ? `Known spec gap ${gap}: the suite expects this exchange to differ until the spec is fixed.` : ''].filter(Boolean).join(' ');
  return {
    name: `${ex.method} ${ex.path}`,
    ...(narration ? { narration } : {}),
    request: { method: ex.method, path: ex.path, ...(authorization ? { token: authorization } : { noAuth: true }), headers, ...(ex.body !== undefined ? { body: ex.body } : {}) },
    expect: { ...(ex.expectedStatus !== undefined ? { status: ex.expectedStatus } : {}), ...(expectedSlug ? { problem: expectedSlug } : {}), allowContract: true },
    ...(gap ? { continueOnFailure: true, knownGap: gap } : {}),
  };
}

const vettingSteps = (mod, sc) => planScenario(sc, mod.directions).flatMap((a) => (a.direction ? directionSteps(a.direction) : [requestStep(a)]));

/** One vetting scenario as a presentable scenario: set the stage, then its directions and requests. */
export function vettingScenario(id) {
  const found = locate(id);
  if (!found) return null;
  const { mod, index, sc } = found;
  const earlier = mod.scenarios.slice(0, index).map((s) => s.id);
  const replayed = earlier.length === 1 ? earlier[0] : `${earlier[0]} to ${earlier.at(-1)}`;
  const stage = earlier.length
    ? `To set the stage, the simulator loads the ${mod.world} world and replays ${replayed} first, as the suite does, so the records this scenario builds on exist.`
    : `The simulator loads the ${mod.world} world.`;
  return {
    id,
    name: `${sc.id} — ${sc.title}`,
    description: sc.summary ?? '',
    world: mod.world,
    module: mod.name,
    kind: sc.kind ?? 'other',
    source: 'vetting',
    stopOnFailure: false,
    steps: [{ name: 'Set the stage', narration: [sc.summary, stage].filter(Boolean).join(' '), prepare: { module: mod.name, before: sc.id } }, ...vettingSteps(mod, sc)],
  };
}

/**
 * POST /sim/scenario/prepare { module, before }: load the module's world and
 * replay its scenarios up to (not including) `before`, results discarded.
 */
export async function prepareStage(sim, { module, before }) {
  const mod = suite().find((m) => m.name === module);
  if (!mod) throw new Error(`no vetting module ${module}`);
  sim.loadWorld(mod.world);
  const control = async (method, path, body) => (await sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).body;
  let replayed = 0;
  for (const sc of mod.scenarios) {
    if (sc.id === before) break;
    for (const action of planScenario(sc, mod.directions)) {
      if (action.direction) await applyDirection(control, action.direction, mod.world);
      else await sim.dispatch(action.request);
    }
    replayed += 1;
  }
  return { world: mod.world, replayed, now: sim.clock.now() };
}
