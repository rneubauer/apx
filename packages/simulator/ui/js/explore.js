// The Explore view: poke the live simulator. A request console (any APX or
// APDS route, as any credential), world events, the event outbox, the
// stored state, every operation in the bundle, and the request log.
// Requests and world events can be added to the open scenario in one click.
import {
  h, mount, jsonView, toast, field, readJson, pretty, shortIds, fullIds, compactIds, statusBadge,
  state, on, sim, http, addStep, refreshStatus, credentials, eventLine,
} from './core.js';

const TABS = ['Console', 'World events', 'Events', 'State', 'Operations', 'Log'];
let tab = 'Console';
let rootEl = null;
const consoleState = { method: 'GET', path: '/v1/lanes/b2…0002/current', token: '', headers: '', body: '', last: null };
const injectState = { kind: '', params: '', last: null };
let lastEventCount = -1;

export function mountExplore(root, { isActive }) {
  rootEl = root;
  on((what) => {
    if (!isActive()) return;
    if (what === 'status' && ['Events', 'Log', 'State'].includes(tab) && state.status?.events !== lastEventCount) render();
    if (what === 'world') render();
  });
  return render;
}

function render() {
  if (!rootEl) return;
  const body = h('div', {});
  const pick = (t) => () => {
    tab = t;
    render();
  };
  mount(rootEl, h('div', { class: 'explore' },
    h('div', { class: 'subtabs' }, TABS.map((t) => h('button', { class: t === tab ? 'active' : '', onclick: pick(t) }, t))),
    body));
  const views = { Console: consoleView, 'World events': injectView, Events: eventsView, State: stateView, Operations: opsView, Log: logView };
  Promise.resolve()
    .then(() => views[tab](body))
    .catch((e) => mount(body, h('div', { class: 'verdict-bad' }, e.message)));
}

function openInConsole(method, path) {
  consoleState.method = method;
  consoleState.path = path;
  consoleState.last = null;
  tab = 'Console';
  render();
}

// ---------- console ----------

function consoleView(el) {
  const c = consoleState;
  const methodSel = h('select', { onchange: (e) => (c.method = e.target.value) }, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => h('option', { selected: m === c.method }, m)));
  const path = h('input', { class: 'grow mono', list: 'dl-paths', value: c.path, oninput: (e) => (c.path = e.target.value), onkeydown: (e) => e.key === 'Enter' && send() });
  const token = h('input', { list: 'dl-credentials', value: c.token, placeholder: credentials()[0] ?? 'default', style: 'width:200px', oninput: (e) => (c.token = e.target.value) });
  const headers = h('textarea', { rows: 3, value: c.headers, placeholder: '{"Idempotency-Key": "k1"}', oninput: (e) => (c.headers = e.target.value) });
  const body = h('textarea', { rows: 10, value: c.body, placeholder: '{ … }', oninput: (e) => (c.body = e.target.value) });
  const out = h('div', {});

  async function send() {
    try {
      const hdrs = readJson(headers) ?? {};
      const payload = readJson(body);
      const who = c.token || credentials()[0] || 'default';
      const all = { authorization: who.startsWith('Bearer ') ? who : `Bearer ${who}`, ...hdrs };
      const wireBody = payload === undefined ? undefined : JSON.parse(fullIds(JSON.stringify(payload)));
      const res = await http(c.method, fullIds(c.path), { body: wireBody, headers: all });
      c.last = { res, payload, hdrs };
      showResponse(out);
      refreshStatus().catch(() => {});
    } catch (e) {
      toast(e.message, 'bad');
    }
  }
  mount(el, h('div', { class: 'split' },
    h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('b', {}, 'Request'), h('span', { class: 'muted' }, 'ids may be written b2…0002 or b2...0002')),
      h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:10px' },
        h('div', { class: 'row' }, methodSel, path),
        h('div', { class: 'row' }, h('span', { class: 'muted' }, 'as'), token, h('span', { class: 'muted' }, 'a credential, or a descriptive token like <expired>')),
        field('Headers (JSON)', headers),
        field('Body (JSON)', body),
        h('div', { class: 'row' }, h('button', { onclick: send }, 'Send')))),
    out));
  showResponse(out);
}

function problemOf(body) {
  return typeof body?.type === 'string' && body.type.includes('/problems/') ? body.type.split('/problems/')[1] : null;
}

function consoleStep(l, problem) {
  const c = consoleState;
  const step = { name: `${c.method} ${shortIds(c.path)}`, request: { method: c.method, path: shortIds(c.path) } };
  if (c.token) step.request.token = c.token;
  if (Object.keys(l.hdrs).length) step.request.headers = l.hdrs;
  if (l.payload !== undefined) step.request.body = JSON.parse(shortIds(JSON.stringify(l.payload)));
  step.expect = { status: l.res.status, ...(problem ? { problem } : {}) };
  return step;
}

function showResponse(out) {
  const l = consoleState.last;
  if (!l) {
    mount(out, h('div', { class: 'panel empty' }, 'Send a request to see the answer. Pick a route in Operations to fill in the path.'));
    return;
  }
  const { res } = l;
  const problem = problemOf(res.body);
  mount(out, h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'Response'), statusBadge(res.status), problem ? h('code', {}, problem) : null,
      h('button', { class: 'small', onclick: () => addStep(consoleStep(l, problem)), title: 'Add this request, expecting this status, to the scenario being built' }, '+ Add to scenario')),
    h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:8px' },
      res.headers['x-sim-contract'] ? h('div', { class: 'verdict-bad' }, `The simulator's answer does not match the bundle: ${res.headers['x-sim-contract']}`) : null,
      jsonView(res.body),
      h('details', {}, h('summary', {}, 'Response headers'), jsonView(res.headers)))));
}

// ---------- world events ----------

function readJsonSafe(el) {
  try {
    return readJson(el) ?? {};
  } catch {
    return {};
  }
}

function selectKind(kind) {
  const k = state.injectors.find((x) => x.kind === kind);
  injectState.kind = kind;
  const { kind: _drop, ...example } = k?.example ?? Object.fromEntries((k?.params ?? []).map((p) => [p, null]));
  injectState.params = pretty(JSON.parse(compactIds(JSON.stringify(example))));
  injectState.last = null;
}

function injectView(el) {
  const s = injectState;
  if (!s.kind && state.injectors.length) selectKind(state.injectors.find((k) => k.kind === 'vehicleArrives')?.kind ?? state.injectors[0].kind);
  const cat = state.injectors.find((k) => k.kind === s.kind);
  const params = h('textarea', { rows: 10, value: s.params, oninput: (e) => (s.params = e.target.value) });
  const out = h('div', {});
  async function fire() {
    try {
      const p = readJson(params) ?? {};
      s.last = { params: p, res: await sim.post('/inject', JSON.parse(fullIds(JSON.stringify({ kind: s.kind, ...p })))) };
      refreshStatus().catch(() => {});
    } catch (e) {
      s.last = { params: readJsonSafe(params), res: { ok: false, error: e.message } };
    }
    showInject(out);
  }
  const choose = (e) => {
    selectKind(e.target.value);
    render();
  };
  mount(el, h('div', { class: 'split' },
    h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('b', {}, 'Make something happen in the world')),
      h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:10px' },
        h('p', { class: 'muted', style: 'margin:0' }, 'World events stand in for the physical garage and the systems behind it: a car arriving, a gate faulting, a payment declining, a camera reading a plate.'),
        h('select', { onchange: choose }, state.injectors.map((k) => h('option', { value: k.kind, selected: k.kind === s.kind }, k.kind))),
        cat?.params?.length ? h('div', { class: 'muted mono' }, `parameters: ${cat.params.join(', ')}`) : null,
        field('Parameters (JSON)', params),
        h('div', { class: 'row' }, h('button', { onclick: fire }, 'Fire')))),
    out));
  showInject(out);
}

function showInject(out) {
  const l = injectState.last;
  if (!l) {
    mount(out, h('div', { class: 'panel empty' }, 'Fire a world event to see what the simulator did.'));
    return;
  }
  const add = () => addStep({ name: `World: ${injectState.kind}`, inject: { kind: injectState.kind, ...JSON.parse(shortIds(JSON.stringify(l.params))) } });
  mount(out, h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'Result'),
      h('span', { class: l.res.ok ? 'verdict-ok' : 'verdict-bad' }, l.res.ok ? '✓ done' : '✗ refused'),
      h('button', { class: 'small', onclick: add }, '+ Add to scenario')),
    h('div', { class: 'panel-body' }, l.res.error ? h('div', { class: 'verdict-bad' }, l.res.error) : null, jsonView(l.res.result ?? l.res))));
}

// ---------- events, state, ops, log ----------

async function eventsView(el) {
  const r = await sim.get('/events?limit=300');
  lastEventCount = state.status?.events ?? r.count;
  const rows = [...r.events].reverse();
  const row = (ev) => h('details', { class: 'ev' },
    h('summary', {}, h('span', { class: 'muted mono' }, (ev.time ?? '').replace('T', ' ').slice(0, 19)), '  ',
      h('span', { class: 'event-type' }, ev.type), '  ', h('span', { class: 'muted mono' }, eventLine(ev))),
    jsonView(ev));
  mount(el, h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, `Event outbox (${r.count})`), h('span', { class: 'muted' }, 'newest first; refreshes as events arrive')),
    h('div', { class: 'panel-body' }, rows.length ? rows.map(row) : h('div', { class: 'muted' }, 'No events yet. Fire a world event or send a request that changes something.'))));
}

let stateColl = null;
async function stateView(el) {
  const colls = Object.entries(state.status?.collections ?? {}).filter(([, n]) => n > 0);
  lastEventCount = state.status?.events ?? 0;
  const detail = h('div', {});
  const pick = (name) => () => {
    stateColl = name;
    render();
  };
  mount(el, h('div', { class: 'split', style: 'grid-template-columns: 260px 1fr' },
    h('div', { class: 'panel side' }, h('div', { class: 'panel-head' }, h('b', {}, 'Collections')),
      colls.map(([name, n]) => h('div', { class: `item${name === stateColl ? ' active' : ''}`, onclick: pick(name) },
        h('div', { class: 't' }, name), h('div', { class: 'm' }, `${n} record${n === 1 ? '' : 's'}`)))),
    detail));
  if (!stateColl) {
    mount(detail, h('div', { class: 'panel empty' }, 'Pick a collection to see what the simulator holds.'));
    return;
  }
  const r = await sim.get(`/state/${encodeURIComponent(stateColl)}`);
  mount(detail, h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('b', {}, stateColl), h('span', { class: 'muted' }, `${r.count} records`)), h('div', { class: 'panel-body' }, jsonView(r.rows))));
}

let opsFilter = '';
function opsView(el) {
  const list = h('tbody', {});
  const fill = () => {
    const q = opsFilter.toLowerCase();
    const rows = state.ops.filter((o) => !q || `${o.method} ${o.path} ${o.operationId} ${o.scopes.join(' ')}`.toLowerCase().includes(q));
    mount(list, rows.map((o) => h('tr', { class: o.implemented ? 'click' : '', onclick: () => o.implemented && openInConsole(o.method, o.path) },
      h('td', {}, o.implemented ? '✓' : h('span', { class: 'muted', title: 'not simulated yet' }, '·')),
      h('td', { class: 'mono' }, o.method), h('td', { class: 'mono' }, o.path), h('td', { class: 'muted mono' }, o.scopes.join(' ')))));
  };
  const done = state.ops.filter((o) => o.implemented).length;
  mount(el, h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, `Operations: ${done} of ${state.ops.length} simulated (click one to try it)`),
      h('input', { placeholder: 'filter: lanes, POST, apx.valet…', value: opsFilter, oninput: (e) => {
        opsFilter = e.target.value;
        fill();
      } })),
    h('div', { class: 'panel-body', style: 'overflow-x:auto' },
      h('table', { class: 'ops' }, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Method'), h('th', {}, 'Path'), h('th', {}, 'Scopes'))), list))));
  fill();
}

async function logView(el) {
  const r = await sim.get('/log?limit=200');
  lastEventCount = state.status?.events ?? 0;
  const rows = [...r.requests].reverse();
  mount(el, h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', {}, 'Requests the simulator served'), h('span', { class: 'muted' }, 'newest first')),
    h('div', { class: 'panel-body', style: 'overflow-x:auto' }, h('table', { class: 'ops' }, h('tbody', {}, rows.map((q) => h('tr', {},
      h('td', { class: 'muted mono' }, (q.time ?? '').slice(11, 19)), h('td', {}, statusBadge(q.status)), h('td', { class: 'mono' }, q.method), h('td', { class: 'mono' }, q.path))))))));
}
