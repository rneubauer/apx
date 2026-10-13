// Shared pieces of the simulator UI: DOM helpers, the HTTP client, the
// app state with a tiny pub/sub, and the scenario runner (one step at a
// time, against the live simulator, via POST /sim/scenario/step).

// ---------- DOM ----------

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === undefined || kid === null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

export function mount(el, ...kids) {
  el.replaceChildren();
  for (const kid of kids.flat(Infinity)) if (kid) el.append(kid);
  return el;
}

// ---------- JSON viewer ----------

const FOLD_BELOW_DEPTH = 2; // big documents open only this deep at first
const BIG_DOCUMENT_CHARS = 20000;
const TALL_DOCUMENT_LINES = 24; // offer "Expand" when the block scrolls

const span = (cls, text) => h('span', { class: cls }, text);

function scalar(v) {
  if (typeof v === 'string') return span('s', JSON.stringify(v));
  if (typeof v === 'number') return span('n', String(v));
  return span('l', String(v)); // true, false, null
}

/** One member of an object or array, as DOM: scalars on one line, containers as a foldable <details>. */
function jsonNode(value, key, last, depth, foldDeep) {
  const keyEl = key === undefined ? null : [span('k', JSON.stringify(key)), span('p', ': ')];
  const comma = last ? null : span('p', ',');
  const isArr = Array.isArray(value);
  if (value === null || typeof value !== 'object') return h('div', {}, keyEl, scalar(value), comma);
  const entries = isArr ? value.map((v, i) => [undefined, v, i]) : Object.entries(value).map(([k, v], i) => [k, v, i]);
  const [open, close] = isArr ? ['[', ']'] : ['{', '}'];
  if (!entries.length) return h('div', {}, keyEl, span('p', open + close), comma);
  const n = entries.length;
  const hint = isArr ? `${n} item${n === 1 ? '' : 's'}` : `${n} key${n === 1 ? '' : 's'}`;
  return h('details', { open: !foldDeep || depth < FOLD_BELOW_DEPTH },
    h('summary', {}, keyEl, span('p', open), h('span', { class: 'fold' }, ` … ${hint} `), h('span', { class: 'fold p' }, close), h('span', { class: 'fold' }, comma ? ',' : '')),
    h('div', { class: 'jt-kids' }, entries.map(([k, v, i]) => jsonNode(v, k, i === n - 1, depth + 1, foldDeep))),
    h('div', {}, span('p', close), comma));
}

/** Copy text to the clipboard; falls back to a hidden textarea where the async API is unavailable (plain http on a LAN). */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // fall through to the legacy path
  }
  const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0', 'aria-hidden': 'true' });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('The browser refused to copy');
}

/**
 * A formatted, tinted JSON block with foldable objects and arrays, a Copy
 * button and, when it scrolls, an Expand button. Text goes in as text nodes,
 * never as HTML, so a body cannot inject markup.
 */
export function jsonView(value) {
  const text = value === undefined ? '(no body)' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const structured = value !== null && typeof value === 'object';
  const pre = structured
    ? h('pre', { class: 'json tree' }, jsonNode(value, undefined, true, 0, text.length > BIG_DOCUMENT_CHARS))
    : h('pre', { class: 'json' }, value === undefined ? h('span', { class: 'muted' }, text) : text);
  const box = h('div', { class: 'json-box' });
  const copy = h('button', { type: 'button', title: 'Copy this JSON', onclick: () => copyText(text)
    .then(() => {
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1200);
    })
    .catch((e) => toast(e.message, 'bad')) }, 'Copy');
  const tools = h('div', { class: 'json-tools' }, value === undefined ? null : copy);
  if (text.split('\n').length > TALL_DOCUMENT_LINES) {
    const expand = h('button', { type: 'button', 'aria-expanded': 'false', title: 'Show the whole block without scrolling', onclick: () => {
      const tall = box.classList.toggle('tall');
      expand.textContent = tall ? 'Collapse' : 'Expand';
      expand.setAttribute('aria-expanded', String(tall));
    } }, 'Expand');
    tools.prepend(expand);
  }
  box.append(tools, pre);
  return box;
}

/** A "Loading…" placeholder for panels waiting on the simulator. */
export const loading = (what = 'Loading…') => h('div', { class: 'loading', role: 'status' }, what);

export function toast(message, kind = 'info') {
  const el = h('div', { class: `toast ${kind}` }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6000 : 3000);
}

export function statusBadge(code) {
  return h('span', { class: `status s${String(code)[0]}` }, code);
}

export function field(label, input) {
  return h('label', { class: 'field' }, h('span', {}, label), input);
}

/** Parse a JSON textarea; empty means undefined. Marks the element invalid on error. */
export function readJson(el) {
  const text = el.value.trim();
  el.classList.remove('invalid');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    el.classList.add('invalid');
    throw new Error(`Not valid JSON: ${e.message}`);
  }
}

export const pretty = (v) => (v === undefined ? '' : JSON.stringify(v, null, 2));

/** `b2...0002` → `b2…0002` (the simulator's id shorthand), and the full UUID form for direct requests. */
export const shortIds = (s) => s.replace(/\b([0-9a-f]{2})(?:\.\.\.|…)([0-9a-f]{4})\b/g, '$1…$2');
/** Full world ids (`b2000000-0000-4000-8000-000000000002`) back to the shorthand, for display and examples. */
export const compactIds = (s) => s.replace(/\b([0-9a-f]{2})000000-0000-4000-8000-00000000([0-9a-f]{4})\b/g, '$1…$2');
export const fullIds = (s) => s.replace(/\b([0-9a-f]{2})(?:\.\.\.|…)([0-9a-f]{4})\b/g, '$1000000-0000-4000-8000-00000000$2');

/** An event's subject and the state it reports, for one-line lists: "Command d1…0101 · accepted". */
export function eventLine(ev) {
  const s = ev.subject;
  const id = typeof s === 'string' ? s : s?.id ?? '';
  const compact = compactIds(id);
  const short = compact !== id ? compact : /^[0-9a-f]{8}-/.test(id) ? id.slice(0, 8) : id;
  const subject = typeof s === 'object' && s ? `${s.className ?? ''} ${short}`.trim() : short;
  const d = ev.data ?? {};
  const what = d.status ?? d.state ?? d.deviceState ?? d.availability ?? d.alertState ?? null;
  return [subject, typeof what === 'string' ? what : null].filter(Boolean).join(' · ');
}

export function fmtClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `${day} · ${iso.slice(11, 19)} UTC`;
}

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'scenario';

// ---------- HTTP ----------

export async function http(method, path, { body, headers = {} } = {}) {
  const h2 = { ...headers };
  let payload;
  if (body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body);
    if (!Object.keys(h2).some((k) => k.toLowerCase() === 'content-type')) h2['content-type'] = 'application/json';
  }
  const res = await fetch(path, { method, headers: h2, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: data };
}

function unwrap(r) {
  if (r.status >= 400) throw new Error(r.body?.detail ?? r.body?.error ?? `HTTP ${r.status}`);
  return r.body;
}

export const sim = {
  get: (p) => http('GET', `/sim${p}`).then(unwrap),
  post: (p, b = {}) => http('POST', `/sim${p}`, { body: b }).then(unwrap),
  put: (p, b) => http('PUT', `/sim${p}`, { body: b }).then(unwrap),
};

// ---------- state ----------

export const state = {
  status: null,
  worlds: [],
  ops: [],
  injectors: [],
  topics: [],
  scenarios: [],
  scenario: null, // the scenario being built or presented
  scenarioId: null, // its file id, once saved or loaded
  dirty: false,
};

const subscribers = new Set();
export const on = (fn) => subscribers.add(fn);
export const emit = (what) => subscribers.forEach((fn) => fn(what));

export function credentials() {
  const w = state.worlds.find((x) => x.name === state.status?.world);
  return w?.credentials ?? [];
}

export async function refreshStatus() {
  state.status = await sim.get('');
  emit('status');
}

export async function refreshScenarios() {
  state.scenarios = (await sim.get('/scenarios')).scenarios;
  emit('scenarios');
}

// ---------- scenarios ----------

export function stepKind(step) {
  return ['request', 'inject', 'clock', 'events', 'deliveries', 'state', 'receiver', 'reset'].find((k) => step[k] !== undefined) ?? 'note';
}

export function newScenario() {
  state.scenario = { name: 'Untitled scenario', description: '', world: state.status?.world ?? 'default', token: credentials()[0] ?? 'default', steps: [] };
  state.scenarioId = null;
  state.dirty = false;
  resetRun();
  emit('scenario');
}

export async function openScenario(id) {
  state.scenario = await sim.get(`/scenarios/${encodeURIComponent(id)}`);
  state.scenarioId = id;
  state.dirty = false;
  resetRun();
  emit('scenario');
}

export function markDirty() {
  state.dirty = true;
  emit('dirty');
}

export function addStep(step) {
  if (!state.scenario) newScenario();
  state.scenario.steps.push(step);
  markDirty();
  emit('scenario');
  toast(`Added as step ${state.scenario.steps.length} of “${state.scenario.name}”`);
}

export async function saveScenario() {
  const s = state.scenario;
  if (!s) return;
  const id = state.scenarioId ?? slugify(s.name);
  await sim.put(`/scenarios/${encodeURIComponent(id)}`, s);
  state.scenarioId = id;
  state.dirty = false;
  await refreshScenarios();
  emit('scenario');
  toast(`Saved scenarios/${id}.json`);
}

// ---------- the runner ----------

export const run = { cursor: 0, vars: {}, results: [], busy: false, summary: null };

export function resetRun() {
  run.cursor = 0;
  run.vars = { ...(state.scenario?.vars ?? {}) };
  run.results = [];
  run.summary = null;
  emit('run');
}

/** Reload the scenario's world and rewind to step 1. */
export async function rewind() {
  await sim.post('/reset', { world: state.scenario?.world ?? state.status?.world });
  resetRun();
  await refreshStatus();
}

export async function runStepAt(i) {
  const s = state.scenario;
  if (!s || run.busy || i >= s.steps.length) return null;
  run.busy = true;
  emit('run');
  try {
    const r = await sim.post('/scenario/step', { step: s.steps[i], vars: run.vars, token: s.token, world: s.world });
    run.vars = r.vars ?? run.vars;
    run.results[i] = r;
    run.cursor = Math.max(run.cursor, i + 1);
    return r;
  } catch (e) {
    toast(e.message, 'bad');
    return null;
  } finally {
    run.busy = false;
    emit('run');
    refreshStatus().catch(() => {});
  }
}

export const runNext = () => runStepAt(run.cursor);

export async function runAll() {
  const s = state.scenario;
  if (!s || run.busy) return;
  run.busy = true;
  emit('run');
  try {
    const r = await sim.post('/scenario/run', { scenario: s });
    run.results = r.results;
    run.cursor = r.ran;
    run.vars = r.results.at(-1)?.vars ?? {};
    run.summary = r;
    toast(`${r.passed} of ${r.steps} steps passed${r.failed ? `, ${r.failed} failed` : ''}`, r.failed ? 'bad' : 'info');
  } catch (e) {
    toast(e.message, 'bad');
  } finally {
    run.busy = false;
    emit('run');
    refreshStatus().catch(() => {});
  }
}

/** One line saying what a step does, for lists. */
export function stepSummary(step) {
  const kind = stepKind(step);
  if (kind === 'request') {
    const r = step.request;
    const ex = step.expect?.status ? ` → ${step.expect.status}${step.expect.problem ? ' ' + step.expect.problem : ''}` : '';
    return `${r.method ?? 'GET'} ${r.path ?? ''}${ex}${r.token ? `  as ${r.token}` : ''}`;
  }
  if (kind === 'inject') {
    const { kind: k, ...rest } = step.inject;
    return `${k} ${Object.entries(rest).slice(0, 3).map(([a, b]) => `${a}=${typeof b === 'object' ? '…' : b}`).join(' ')}`;
  }
  if (kind === 'clock') return step.clock.now ? `set ${step.clock.now}` : `advance ${step.clock.advance}`;
  if (kind === 'events') {
    const e = step.events;
    const n = e.exactly !== undefined ? `exactly ${e.exactly}` : e.min !== undefined ? `at least ${e.min}` : e.max !== undefined ? `at most ${e.max}` : 'any';
    return `${n} × ${e.type ?? 'any event'}`;
  }
  if (kind === 'note') return (step.narration ?? '').slice(0, 90);
  return JSON.stringify(step[kind]).slice(0, 90);
}

/** Who acts in a request step: its token, or the scenario's. */
export function actorOf(step) {
  return step.request?.noAuth ? 'anonymous' : step.request?.token ?? state.scenario?.token ?? 'default';
}
