// The app shell: tabs (kept in the URL hash), the world picker, the clock,
// run state, the APX edition, status pills, the theme switch, the
// autocomplete lists, and the live link that makes the page follow changes
// made anywhere (this page, another browser, curl, a test run) and notice
// when the simulator goes away.
//
// The live link is GET /sim/stream (src/kernel/live.mjs), an EventSource of
// small typed notices: hello, clock, reset, event, delivery, request, store.
// Bursts are coalesced for LIVE_COALESCE_MS, the status is refreshed once,
// and then a 'sim:change' CustomEvent is dispatched on window with
// detail { kinds: [...], messages: { kind: data } } so any view can refresh
// only what changed. When the stream keeps failing (or the server predates
// it) the page falls back to polling GET /sim every POLL_MS.
import { h, mount, toast, fmtClock, state, on, emit, sim, refreshStatus, refreshScenarios, credentials, rewind, resetRun, run } from './core.js';
import { mountBuilder } from './builder.js';
import { mountPresent } from './present.js';
import { mountExplore } from './explore.js';

const POLL_MS = 2000;
const LIVE_COALESCE_MS = 100;
const LIVE_MAX_ERRORS = 3; // consecutive stream failures before falling back to the poll
const LIVE_RETRY_MS = 30000; // while polling, how often to try the stream again
const LIVE_KINDS = ['hello', 'clock', 'reset', 'event', 'delivery', 'request', 'store'];
const VIEWS = ['present', 'build', 'explore'];
const THEMES = ['auto', 'light', 'dark'];
const THEME_KEY = 'apx-sim-theme';
let current = 'present';
let offline = false;
const renderers = {};
const live = { source: null, errors: 0, lastTry: 0, pending: new Map(), timer: null, poll: null };

function show(view) {
  current = VIEWS.includes(view) ? view : 'present';
  for (const v of VIEWS) document.getElementById(`view-${v}`).classList.toggle('active', v === current);
  for (const b of document.querySelectorAll('#tabs button')) {
    b.classList.toggle('active', b.dataset.view === current);
    if (b.dataset.view === current) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  if (location.hash !== `#${current}`) history.replaceState(null, '', `#${current}`);
  renderers[current]?.();
}

/** Frozen / realtime / running / offline, next to the clock. */
function renderRunState() {
  const el = document.getElementById('run-state');
  const s = state.status;
  let label = 'frozen';
  let cls = '';
  let title = 'The clock only moves when you advance it or a step does';
  if (offline) [label, cls, title] = ['offline', 'offline', 'The simulator is not answering'];
  else if (run.busy) [label, cls, title] = ['running', 'busy', 'A scenario step is running'];
  else if (s?.clock?.realtime) [label, cls, title] = ['live', 'live', 'The clock follows real time (--realtime)'];
  el.replaceChildren(h('span', { class: 'label' }, label));
  el.className = `run-state ${cls}`;
  el.title = title;
}

function renderHeader() {
  renderRunState();
  const s = state.status;
  if (!s) return;
  const clockEl = document.getElementById('clock-now');
  clockEl.textContent = fmtClock(s.clock?.now);
  if (s.clock?.now) clockEl.setAttribute('datetime', s.clock.now);
  const ed = s.edition;
  const edEl = document.getElementById('edition');
  if (ed?.edition) {
    edEl.textContent = `v${ed.edition}${ed.status && ed.status !== 'final' ? ` ${ed.status}` : ''}`;
    edEl.title = `APX edition ${ed.edition} (${ed.status ?? 'unknown status'}), an extension of APDS ${ed.apdsVersion ?? '4.1'}`;
  }
  const sel = document.getElementById('world-select');
  if (sel.value !== s.world) sel.value = s.world;
  const pill = (label, value, cls = '', title) => h('span', { class: `pill ${cls}`, title }, `${label} `, h('b', {}, value));
  mount(document.getElementById('pills'),
    pill('events', s.events, '', 'Events in the outbox'),
    pill('timers', s.clock?.pendingTimers ?? 0, '', 'Timers waiting on the simulated clock'),
    pill('ops', `${s.implementedOperations}/${s.totalOperations}`, 'secondary', 'Operations simulated, of those in the bundle'),
    s.contractViolations ? pill('contract issues', s.contractViolations, 'bad', 'Responses that failed the bundle schema') : null);
}

function fillDatalists() {
  const opts = (id, values) => mount(document.getElementById(id), values.map((v) => h('option', { value: v })));
  opts('dl-paths', [...new Set(state.ops.filter((o) => o.implemented).map((o) => o.path))]);
  opts('dl-topics', state.topics.map((t) => t.type));
  opts('dl-injectors', state.injectors.map((i) => i.kind));
  opts('dl-credentials', [...credentials(), '<expired>', '<revoked>', '<no apx_places claim at all>']);
}

async function changeWorld(name) {
  try {
    await sim.post('/reset', { world: name });
    resetRun();
    await refreshStatus();
    fillDatalists();
    emit('world');
    toast(`Loaded world ${name}`);
  } catch (e) {
    toast(e.message, 'bad');
  }
}

function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const btn = document.getElementById('theme-toggle');
  btn.textContent = { auto: 'Auto', light: 'Light', dark: 'Dark' }[t];
  btn.setAttribute('aria-label', `Theme: ${t === 'auto' ? 'follow the system' : t}. Click to change.`);
  try {
    if (t === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // storage blocked (private window): the choice lasts for this page only
  }
}

function wireTheme() {
  const now = () => document.documentElement.dataset.theme ?? 'auto';
  applyTheme(now());
  document.getElementById('theme-toggle').addEventListener('click', () => applyTheme(THEMES[(THEMES.indexOf(now()) + 1) % THEMES.length]));
}

function setOffline(value) {
  if (offline === value) return;
  offline = value;
  document.getElementById('offline').hidden = !value;
  renderRunState();
}

async function poll() {
  try {
    await refreshStatus();
    const wasOffline = offline;
    setOffline(false);
    // Back online, or a while since the stream last failed: try it again.
    if (!live.source && (wasOffline || Date.now() - live.lastTry > LIVE_RETRY_MS)) connectLive();
  } catch {
    setOffline(true);
  }
}

function startPoll() {
  if (!live.poll) live.poll = setInterval(poll, POLL_MS);
}

function stopPoll() {
  clearInterval(live.poll);
  live.poll = null;
}

/** Collect a notice; the burst is handled once, LIVE_COALESCE_MS after its first message. */
function queueLive(kind, data) {
  live.pending.set(kind, data);
  if (!live.timer) live.timer = setTimeout(flushLive, LIVE_COALESCE_MS);
}

async function flushLive() {
  live.timer = null;
  const messages = Object.fromEntries(live.pending);
  live.pending.clear();
  const kinds = Object.keys(messages);
  if (!kinds.length) return;
  if (kinds.every((k) => k === 'clock') && state.status) {
    // The clock alone moved (every second under --realtime): no fetch needed.
    state.status = { ...state.status, clock: { ...state.status.clock, ...messages.clock } };
    emit('status');
  } else {
    try {
      await refreshStatus();
    } catch {
      setOffline(true);
      return;
    }
  }
  window.dispatchEvent(new CustomEvent('sim:change', { detail: { kinds, messages } }));
}

function liveFailed() {
  live.errors += 1;
  state.live = false;
  startPoll(); // keeps the offline state honest while the stream reconnects
  poll();
  if (live.source && (live.source.readyState === EventSource.CLOSED || live.errors >= LIVE_MAX_ERRORS)) {
    live.source.close();
    live.source = null;
  }
}

function connectLive() {
  if (typeof EventSource === 'undefined') return startPoll();
  live.lastTry = Date.now();
  const source = new EventSource('/sim/stream');
  live.source = source;
  const read = (e) => {
    try {
      return JSON.parse(e.data);
    } catch {
      return {};
    }
  };
  source.addEventListener('hello', () => {
    live.errors = 0;
    state.live = true;
    stopPoll();
    setOffline(false);
  });
  for (const kind of LIVE_KINDS) source.addEventListener(kind, (e) => queueLive(kind, read(e)));
  source.onerror = () => {
    if (live.source === source) liveFailed();
  };
}

function wireHeader() {
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => show(b.dataset.view));
  const sel = document.getElementById('world-select');
  mount(sel, state.worlds.map((w) => h('option', { value: w.name, title: w.description ?? '' }, w.name)));
  sel.disabled = false;
  sel.addEventListener('change', () => changeWorld(sel.value));
  document.getElementById('world-reset').addEventListener('click', () => {
    if (state.scenario) rewind().then(() => toast('World reloaded')).catch((e) => toast(e.message, 'bad'));
    else changeWorld(sel.value);
  });
  const clock = (body) => sim.post('/clock', body).then(refreshStatus).catch((e) => toast(e.message, 'bad'));
  for (const b of document.querySelectorAll('[data-advance]')) b.addEventListener('click', () => clock({ advance: b.dataset.advance }));
  document.getElementById('clock-set').addEventListener('click', () => {
    const v = window.prompt('Set the clock to (ISO 8601, UTC):', state.status?.clock?.now ?? '');
    if (v) clock({ now: v.trim() });
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
}

async function boot() {
  wireTheme();
  const [worlds, ops, catalog, topics] = await Promise.all([sim.get('/worlds'), sim.get('/ops'), sim.get('/injectors/catalog'), sim.get('/topics')]);
  state.worlds = worlds.worlds;
  state.ops = ops.operations;
  state.injectors = catalog.injectors;
  state.topics = topics.topics;
  await Promise.all([refreshStatus(), refreshScenarios()]);
  wireHeader();
  fillDatalists();
  renderHeader();
  on((what) => {
    if (what === 'status') renderHeader();
    if (what === 'run') renderRunState();
    if (what === 'world') fillDatalists();
  });
  const isActive = (v) => () => current === v;
  const goPresent = async () => {
    // A presentation starts from the scenario's own world, unless steps already ran.
    if (!run.results.some(Boolean)) await rewind().catch((e) => toast(e.message, 'bad'));
    show('present');
  };
  mountBuilder(document.getElementById('view-build'), { goPresent });
  renderers.present = mountPresent(document.getElementById('view-present'), { isActive: isActive('present') });
  renderers.explore = mountExplore(document.getElementById('view-explore'), { isActive: isActive('explore') });
  document.getElementById('boot').remove();
  show(location.hash.slice(1) || 'present');
  connectLive();
}

boot().catch((e) => {
  offline = true;
  renderRunState();
  document.querySelector('main').replaceChildren(h('div', { class: 'panel empty', role: 'alert' },
    h('h2', {}, 'The simulator did not answer'), h('p', {}, e.message),
    h('p', {}, 'Start it with ', h('code', {}, 'node bin/apx-sim.mjs serve'), ' in packages/simulator, then reload.'),
    h('div', { class: 'row', style: 'justify-content:center' }, h('button', { onclick: () => location.reload() }, 'Reload'))));
});
