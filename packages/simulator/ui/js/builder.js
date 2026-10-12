// The Build view: a list of scenario files, and an editor for one scenario
// whose steps can be edited with forms (or as raw JSON), reordered, run one
// at a time against the live simulator, run all at once, and saved.
import {
  h, mount, jsonView, toast, field, readJson, pretty, shortIds, compactIds, statusBadge,
  state, on, emit, newScenario, openScenario, markDirty, saveScenario,
  run, rewind, runStepAt, runNext, runAll, stepKind, stepSummary, eventLine,
} from './core.js';

const expanded = new WeakSet(); // step objects whose editor is open

export function mountBuilder(root, { goPresent }) {
  const side = h('aside', { class: 'side panel' });
  const main = h('div', { class: 'main' });
  mount(root, h('div', { class: 'build' }, side, main));
  const renderAll = () => {
    renderSide(side);
    renderMain(main, goPresent);
  };
  on((what) => {
    if (what === 'scenarios') renderSide(side);
    if (what === 'scenario' || what === 'run') renderAll();
    if (what === 'dirty') renderSaveState(main);
  });
  renderAll();
}

function confirmDiscard() {
  return !state.dirty || window.confirm('Discard the unsaved changes to this scenario?');
}

function renderSide(side) {
  mount(
    side,
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'Scenarios'),
      h('button', { class: 'small', onclick: () => confirmDiscard() && newScenario() }, '+ New')),
    state.scenarios.length ? null : h('div', { class: 'panel-body muted' }, 'No scenario files yet.'),
    state.scenarios.map((s) =>
      h('div', {
        class: `item${s.id === state.scenarioId ? ' active' : ''}`,
        onclick: () => confirmDiscard() && openScenario(s.id).catch((e) => toast(e.message, 'bad')),
      }, h('div', { class: 't' }, s.name), h('div', { class: 'm' }, `${s.world} · ${s.steps} steps · ${s.id}.json`))),
  );
}

function renderSaveState(main) {
  const el = main.querySelector('[data-save]');
  if (el) el.textContent = state.dirty ? 'Save *' : 'Save';
}

function renderMain(main, goPresent) {
  const s = state.scenario;
  if (!s) {
    mount(main, h('div', { class: 'panel empty' },
      h('h2', {}, 'Build a scenario'),
      h('p', {}, 'A scenario is a script of steps: requests a client sends, world events (a car arrives, a gate faults), clock jumps, and checks on the events published. Run it step by step, then present it.'),
      h('p', {}, 'Start one here, or use Explore: every request you send and every event you inject there can be added to the scenario with one click.'),
      h('div', { class: 'row', style: 'justify-content:center' }, h('button', { onclick: newScenario }, 'New scenario'))));
    return;
  }
  mount(main, header(s, goPresent), runSummary(), h('div', { class: 'steps' }, s.steps.map((step, i) => stepCard(step, i))), addBar());
}

// ---------- header ----------

function header(s, goPresent) {
  const set = (k) => (e) => {
    s[k] = e.target.value;
    markDirty();
  };
  const worldSel = h('select', { onchange: set('world') }, state.worlds.map((w) => h('option', { value: w.name, selected: w.name === s.world }, w.name)));
  const imp = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onchange: (e) => importFile(e.target.files[0]) });
  return h('div', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('b', { class: 'grow' }, state.scenarioId ? `scenarios/${state.scenarioId}.json` : 'New scenario (not saved yet)'),
      h('button', { 'data-save': '', onclick: () => saveScenario().catch((e) => toast(e.message, 'bad')) }, state.dirty ? 'Save *' : 'Save'),
      h('button', { class: 'ghost', onclick: () => download(s) }, 'Download'),
      h('button', { class: 'ghost', onclick: () => imp.click() }, 'Import…'), imp),
    h('div', { class: 'panel-body' },
      h('div', { class: 'grid2' },
        field('Name', h('input', { value: s.name ?? '', oninput: set('name') })),
        field('World it starts from', worldSel),
        field('Default credential (who sends requests)', h('input', { value: s.token ?? '', list: 'dl-credentials', oninput: set('token') }))),
      h('div', { style: 'margin-top:10px' }, field('Description', h('textarea', { class: 'prose', rows: 2, value: s.description ?? '', oninput: set('description') }))),
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { onclick: runAll, disabled: run.busy || !s.steps.length }, '▶ Run all'),
        h('button', { class: 'ghost', onclick: () => rewind().catch((e) => toast(e.message, 'bad')), disabled: run.busy }, '⟲ Reset world'),
        h('button', { class: 'ghost', onclick: runNext, disabled: run.busy || run.cursor >= s.steps.length }, run.cursor >= s.steps.length ? 'All steps run' : `Run step ${run.cursor + 1} ▸`),
        h('span', { class: 'grow' }),
        h('button', { class: 'ghost', onclick: goPresent, disabled: !s.steps.length }, 'Present ▸'))));
}

function runSummary() {
  const done = run.results.filter(Boolean);
  if (!done.length) return null;
  const failed = done.filter((r) => !r.ok).length;
  return h('div', { class: 'row', style: 'margin-top:10px' },
    h('span', { class: failed ? 'verdict-bad' : 'verdict-ok' }, `${done.length - failed} passed${failed ? `, ${failed} failed` : ''}`),
    h('span', { class: 'muted' }, `of ${state.scenario.steps.length} steps`),
    Object.keys(run.vars).length ? h('span', { class: 'muted mono' }, `saved: ${Object.keys(run.vars).map((k) => `{${k}}`).join(' ')}`) : null);
}

function download(s) {
  const blob = new Blob([JSON.stringify(s, null, 2) + '\n'], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `${state.scenarioId ?? 'scenario'}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importFile(file) {
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!Array.isArray(s.steps)) throw new Error('the file has no steps array');
    state.scenario = s;
    state.scenarioId = null;
    markDirty();
    emit('scenario');
    toast(`Imported ${file.name}; Save to keep it`);
  } catch (e) {
    toast(`Import failed: ${e.message}`, 'bad');
  }
}

// ---------- steps ----------

const TEMPLATES = {
  request: () => ({ name: 'A client asks', request: { method: 'GET', path: '/v1/' }, expect: { status: 200 } }),
  inject: () => ({ name: 'Something happens in the garage', inject: { kind: 'vehicleArrives' } }),
  clock: () => ({ name: 'Time passes', clock: { advance: 'PT5M' } }),
  events: () => ({ name: 'Subscribers are told', events: { type: 'apx.control.command.status.v1', min: 1 } }),
  note: () => ({ name: 'Chapter', narration: 'What the audience should notice next.' }),
};

function changed() {
  markDirty();
  emit('scenario');
}

function addBar() {
  const add = (kind) => () => {
    const step = TEMPLATES[kind]();
    expanded.add(step);
    state.scenario.steps.push(step);
    changed();
  };
  return h('div', { class: 'add-bar' }, h('span', { class: 'muted' }, 'Add step:'),
    h('button', { class: 'ghost small', onclick: add('request') }, '+ Request'),
    h('button', { class: 'ghost small', onclick: add('inject') }, '+ World event'),
    h('button', { class: 'ghost small', onclick: add('clock') }, '+ Clock'),
    h('button', { class: 'ghost small', onclick: add('events') }, '+ Check events'),
    h('button', { class: 'ghost small', onclick: add('note') }, '+ Narration'));
}

function move(i, d) {
  const steps = state.scenario.steps;
  const j = i + d;
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  changed();
}

function stepCard(step, i) {
  const r = run.results[i];
  const kind = stepKind(step);
  const cls = r ? (r.ok ? 'ok' : 'bad') : i === run.cursor ? 'next' : '';
  const open = expanded.has(step);
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  const toggle = () => {
    if (open) expanded.delete(step);
    else expanded.add(step);
    emit('scenario');
  };
  const head = h('div', { class: 'step-head', onclick: toggle },
    h('span', { class: 'idx' }, i + 1),
    h('span', { class: `badge k-${kind}` }, kind),
    h('span', { class: 'name' }, step.name ?? ''),
    h('span', { class: 'sum' }, stepSummary(step)),
    h('span', { class: 'tools' },
      r ? h('span', { class: r.ok ? 'verdict-ok' : 'verdict-bad' }, r.ok ? '✓' : '✗') : null,
      h('button', { class: 'ghost small', title: 'Run this step now, against the world as it is', onclick: stop(() => runStepAt(i)), disabled: run.busy }, '▶'),
      h('button', { class: 'ghost small', title: 'Move up', onclick: stop(() => move(i, -1)) }, '↑'),
      h('button', { class: 'ghost small', title: 'Move down', onclick: stop(() => move(i, 1)) }, '↓'),
      h('button', { class: 'ghost small', title: 'Duplicate', onclick: stop(() => {
        state.scenario.steps.splice(i + 1, 0, structuredClone(step));
        changed();
      }) }, '⧉'),
      h('button', { class: 'danger small', title: 'Delete', onclick: stop(() => {
        state.scenario.steps.splice(i, 1);
        changed();
      }) }, '✕')));
  let body = null;
  if (open) body = h('div', { class: 'step-body' }, editor(step, kind, i), r ? resultView(r) : null);
  else if (r && !r.ok) body = h('div', { class: 'step-body' }, resultView(r));
  return h('div', { class: `panel step ${cls}` }, head, body);
}

// ---------- the step editor ----------

const getPath = (obj, path) => path.split('.').reduce((n, k) => n?.[k], obj);

/** Write a value into the step (deleting it when empty). */
function setter(step, path) {
  return (value) => {
    const keys = path.split('.');
    let node = step;
    for (const k of keys.slice(0, -1)) node = node[k] ??= {};
    const last = keys.at(-1);
    if (value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) delete node[last];
    else node[last] = value;
    markDirty();
  };
}

/** A JSON textarea's value with `b2...0002` ids normalised to the shorthand. */
function readJsonIds(el) {
  const v = readJson(el);
  return v === undefined ? undefined : JSON.parse(shortIds(JSON.stringify(v)));
}

function textInput(step, path, attrs = {}) {
  const { ids, ...rest } = attrs;
  const set = setter(step, path);
  const norm = ids ? shortIds : (x) => x;
  return h('input', { ...rest, value: getPath(step, path) ?? '', oninput: (e) => set(norm(e.target.value)), onchange: () => emit('scenario') });
}

function jsonInput(step, path, rows = 4) {
  const set = setter(step, path);
  return h('textarea', { rows, value: pretty(getPath(step, path)), onchange: (e) => {
    try {
      set(readJsonIds(e.target));
    } catch (err) {
      toast(err.message, 'bad');
    }
  } });
}

function editor(step, kind, i) {
  const common = h('div', { class: 'grid2' },
    field('Step title (shown when presenting)', textInput(step, 'name')),
    field('Narration (what the audience should notice)', h('textarea', { class: 'prose', rows: 2, value: step.narration ?? '', oninput: (e) => setter(step, 'narration')(e.target.value) })));
  const forms = { request: requestForm, inject: injectForm, clock: clockForm, events: eventsForm };
  const specific = forms[kind] ? forms[kind](step) : null;
  return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, common, specific, rawEditor(step, i));
}

function requestForm(step) {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const m = step.request.method ?? 'GET';
  const setStatus = (e) => setter(step, 'expect.status')(e.target.value === '' ? undefined : Number(e.target.value));
  return h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
    h('div', { class: 'row' },
      h('select', { onchange: (e) => {
        setter(step, 'request.method')(e.target.value);
        emit('scenario');
      } }, methods.map((x) => h('option', { selected: x === m }, x))),
      h('div', { class: 'grow', style: 'display:flex' }, textInput(step, 'request.path', { list: 'dl-paths', class: 'grow mono', placeholder: '/v1/…  (ids may be written b2…0002)', ids: true })),
      textInput(step, 'request.token', { list: 'dl-credentials', placeholder: `as ${state.scenario.token ?? 'default'}`, style: 'width:200px' })),
    h('div', { class: 'grid2' },
      field('Body (JSON)', jsonInput(step, 'request.body', 6)),
      field('Headers (JSON, e.g. {"Idempotency-Key": "k1"})', jsonInput(step, 'request.headers', 6))),
    h('div', { class: 'grid2' },
      field('Expect status', h('input', { type: 'number', value: step.expect?.status ?? '', oninput: setStatus, onchange: () => emit('scenario') })),
      field('Expect problem type (Part 12 slug)', textInput(step, 'expect.problem', { placeholder: 'e.g. insufficient-scope' })),
      field('Save values for later steps ({"cmd": "$.id"} → {cmd})', jsonInput(step, 'save', 2))),
    field('Expect the body to contain (partial JSON match)', jsonInput(step, 'expect.body', 4)));
}

const withoutKind = ({ kind, ...rest }) => rest;

function injectForm(step) {
  const kinds = state.injectors;
  const current = kinds.find((k) => k.kind === step.inject.kind);
  const params = h('textarea', { rows: 6, value: pretty(withoutKind(step.inject)), onchange: (e) => {
    try {
      step.inject = { kind: step.inject.kind, ...(readJsonIds(e.target) ?? {}) };
      changed();
    } catch (err) {
      toast(err.message, 'bad');
    }
  } });
  const pickKind = (e) => {
    const k = kinds.find((x) => x.kind === e.target.value);
    step.inject = k?.example ? JSON.parse(compactIds(JSON.stringify(k.example))) : { kind: e.target.value, ...Object.fromEntries((k?.params ?? []).map((p) => [p, null])) };
    changed();
  };
  return h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
    h('div', { class: 'row' }, h('span', { class: 'muted' }, 'World event'),
      h('select', { onchange: pickKind }, kinds.map((k) => h('option', { value: k.kind, selected: k.kind === step.inject.kind }, k.kind)))),
    current?.params?.length ? h('div', { class: 'muted mono' }, `parameters: ${current.params.join(', ')}`) : null,
    field('Parameters (JSON; picking an event fills in a worked example)', params));
}

function clockForm(step) {
  const mode = step.clock.now !== undefined ? 'now' : 'advance';
  const setMode = (e) => {
    step.clock = e.target.value === 'now' ? { now: state.status?.clock?.now ?? '' } : { advance: 'PT5M' };
    changed();
  };
  return h('div', { class: 'row' },
    h('select', { onchange: setMode }, h('option', { value: 'advance', selected: mode === 'advance' }, 'Advance by'), h('option', { value: 'now', selected: mode === 'now' }, 'Set to')),
    textInput(step, `clock.${mode}`, { class: 'mono', placeholder: mode === 'now' ? '2026-09-24T18:14:00Z' : 'PT5M, 30s, PT1H', style: 'width:260px' }),
    h('span', { class: 'muted' }, 'Timers that fall due (retries, no-shows, idle fees) fire as the clock passes them.'));
}

function eventsForm(step) {
  const e = step.events;
  const mode = e.exactly !== undefined ? 'exactly' : e.max !== undefined ? 'max' : 'min';
  const count = e[mode] ?? 1;
  const setCount = (m, n) => {
    delete e.exactly;
    delete e.min;
    delete e.max;
    e[m] = n;
    changed();
  };
  const labels = { min: 'at least', exactly: 'exactly', max: 'at most' };
  return h('div', { class: 'row' },
    h('span', { class: 'muted' }, 'The outbox holds'),
    h('select', { onchange: (ev) => setCount(ev.target.value, count) }, Object.entries(labels).map(([v, l]) => h('option', { value: v, selected: v === mode }, l))),
    h('input', { type: 'number', min: 0, value: count, style: 'width:70px', onchange: (ev) => setCount(mode, Number(ev.target.value)) }),
    textInput(step, 'events.type', { list: 'dl-topics', class: 'grow mono', placeholder: 'any event type' }));
}

function rawEditor(step, i) {
  const ta = h('textarea', { rows: 10, value: pretty(step) });
  const apply = () => {
    try {
      const next = readJsonIds(ta);
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('a step is a JSON object');
      state.scenario.steps[i] = next;
      expanded.add(next);
      changed();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };
  return h('details', {}, h('summary', {}, 'Edit as JSON (any step member: clock, inject, request, expect, save, events, deliveries, state, receiver, reset, continueOnFailure)'),
    h('div', { style: 'margin-top:6px' }, ta, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'small', onclick: apply }, 'Apply JSON'))));
}

// ---------- results ----------

function eventRows(events) {
  return events.map((ev) => h('div', { class: 'event-row' },
    h('span', { class: 'muted mono' }, (ev.time ?? '').slice(11, 19)),
    h('div', {}, h('div', { class: 'event-type' }, ev.type), h('div', { class: 'muted mono' }, eventLine(ev)))));
}

export function resultView(r) {
  const n = r.events?.length ?? 0;
  return h('div', { class: 'result' },
    h('div', { class: 'row' },
      h('span', { class: r.ok ? 'verdict-ok' : 'verdict-bad' }, r.ok ? '✓ passed' : '✗ failed'),
      r.response ? statusBadge(r.response.status) : null,
      r.response?.problem ? h('code', {}, r.response.problem) : null,
      r.now ? h('span', { class: 'muted mono' }, r.now) : null,
      n ? h('span', { class: 'muted' }, `${n} event${n === 1 ? '' : 's'} published`) : null),
    r.error ? h('div', { class: 'verdict-bad' }, r.error) : null,
    r.response ? h('details', {}, h('summary', {}, 'Response body'), jsonView(r.response.body)) : null,
    r.inject?.result ? h('details', {}, h('summary', {}, 'What the world did'), jsonView(r.inject.result)) : null,
    n ? h('details', {}, h('summary', {}, 'Events'), eventRows(r.events)) : null);
}
