/**
 * The /sim routes behind the browser UI's scenario builder and presenter:
 *
 *   GET  /sim/scenarios                 the scenario files on disk
 *   GET  /sim/scenarios/:id             one scenario
 *   PUT  /sim/scenarios/:id             save a scenario (scenarios/<id>.json)
 *   POST /sim/scenario/step  {step, vars?, token?, world?}
 *                                        run one step against the live world
 *   POST /sim/scenario/run   {scenario}  reset to its world and run every step
 *   GET  /sim/injectors/catalog          each injector's parameters and an example
 *   GET  /sim/topics                     the event topics in the apx-topics registry
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStep, tokenOf, listScenarios, readScenario, writeScenario } from './scenario.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body });

function localIo(sim) {
  const send = (req) => sim.dispatch(req);
  const control = (method, path, body) =>
    sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.body);
  return { send, control };
}

/** Run one step and report what it caused: the events published and the clock after. */
async function stepWithEffects(sim, step, { vars, token, world }) {
  const before = sim.events.outbox.length;
  const r = await runStep(step, { io: localIo(sim), vars: vars ?? {}, defaultToken: tokenOf(token), defaultWorld: world ?? sim.world.name });
  const events = sim.events.outbox.slice(before).map((rec) => ({ ...rec.envelope, _deliveredTo: rec.deliveries }));
  return { ...r, events, now: sim.clock.now() };
}

async function runWhole(sim, scenario) {
  const world = scenario.world ?? 'default';
  sim.loadWorld(world);
  let vars = { ...(scenario.vars ?? {}) };
  const results = [];
  for (const step of scenario.steps ?? []) {
    const r = await stepWithEffects(sim, step, { vars, token: scenario.token, world });
    vars = r.vars;
    results.push(r);
    if (!r.ok && step.continueOnFailure !== true && scenario.stopOnFailure !== false) break;
  }
  const passed = results.filter((r) => r.ok).length;
  return { world, steps: (scenario.steps ?? []).length, ran: results.length, passed, failed: results.length - passed, results };
}

export async function scenarioApi(sim, { method, parts, body }) {
  const [head, id] = parts;
  try {
    if (head === 'scenarios') {
      if (!id) return json(200, { scenarios: listScenarios() });
      if (method === 'PUT') return json(200, writeScenario(id, body));
      const s = readScenario(id);
      return s ? json(200, s) : json(404, { error: 'not_found', detail: `no scenario ${id}` });
    }
    if (head === 'scenario' && method === 'POST' && id === 'step') {
      if (!body.step || typeof body.step !== 'object') return json(400, { error: 'bad_request', detail: 'give {step}' });
      return json(200, await stepWithEffects(sim, body.step, body));
    }
    if (head === 'scenario' && method === 'POST' && id === 'run') {
      if (!Array.isArray(body.scenario?.steps)) return json(400, { error: 'bad_request', detail: 'give {scenario: {steps: [...]}}' });
      return json(200, await runWhole(sim, body.scenario));
    }
  } catch (e) {
    return json(400, { error: 'bad_request', detail: e.message });
  }
  return json(404, { error: 'not_found' });
}

// ---------- injector catalog ----------

/** The names a destructured first parameter lists: ({ a, b = 1, c: _c }) → [a, b, c]. */
function paramNames(fn) {
  const m = /^\s*(?:async\s*)?(?:function\s*\w*)?\s*\(\s*\{([\s\S]*?)\}\s*(?:=\s*\{\s*\})?\s*(?:,|\))/.exec(fn.toString());
  if (!m) return [];
  const names = [];
  let depth = 0;
  let cur = '';
  for (const ch of m[1]) {
    if ('[{('.includes(ch)) depth += 1;
    if (']})'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) {
      names.push(cur);
      cur = '';
    } else cur += ch;
  }
  names.push(cur);
  return names
    .map((n) => n.trim().replace(/^\.\.\.\w+$/, '').split(/[=:]/)[0].trim())
    .filter((n) => n && n !== 'kind');
}

let exampleCache = null;
function injectorExamples() {
  if (exampleCache) return exampleCache;
  const found = {};
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    if (v.inject?.kind && !found[v.inject.kind]) found[v.inject.kind] = v.inject;
    Object.values(v).forEach(walk);
  };
  for (const dir of [join(ROOT, 'tools', 'directions'), join(ROOT, 'scenarios')]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try {
        walk(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      } catch {
        /* a malformed file contributes no examples */
      }
    }
  }
  exampleCache = found;
  return found;
}

export function injectorCatalog(sim) {
  const examples = injectorExamples();
  return [...sim.injectors.entries()]
    .map(([kind, fn]) => ({ kind, params: paramNames(fn), example: examples[kind] ?? null }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

// ---------- topics ----------

const TOPICS_FILE = join(ROOT, '..', '..', 'spec', 'registries', 'apx-topics.json');
let topicCache = null;
export function topics() {
  if (topicCache) return topicCache;
  try {
    const reg = JSON.parse(readFileSync(TOPICS_FILE, 'utf8'));
    topicCache = (reg.userDefinedCodeListEntries ?? []).map((e) => ({ type: e.definedValue, description: e.entryDescription ?? '' }));
  } catch {
    topicCache = [];
  }
  return topicCache;
}
