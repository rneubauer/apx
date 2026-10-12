// The app shell: tabs (kept in the URL hash), the world picker, the clock,
// status pills, the autocomplete lists, and a status poll so the page
// follows changes made elsewhere (another browser, curl, a test run).
import { h, mount, toast, fmtClock, state, on, emit, sim, refreshStatus, refreshScenarios, credentials, rewind, resetRun, run } from './core.js';
import { mountBuilder } from './builder.js';
import { mountPresent } from './present.js';
import { mountExplore } from './explore.js';

const POLL_MS = 2000;
const VIEWS = ['present', 'build', 'explore'];
let current = 'present';
const renderers = {};

function show(view) {
  current = VIEWS.includes(view) ? view : 'present';
  for (const v of VIEWS) document.getElementById(`view-${v}`).classList.toggle('active', v === current);
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.view === current);
  if (location.hash !== `#${current}`) history.replaceState(null, '', `#${current}`);
  renderers[current]?.();
}

function renderHeader() {
  const s = state.status;
  if (!s) return;
  document.getElementById('clock-now').textContent = fmtClock(s.clock?.now);
  const sel = document.getElementById('world-select');
  if (sel.value !== s.world) sel.value = s.world;
  const pill = (label, value, bad) => h('span', { class: `pill${bad ? ' bad' : ''}` }, `${label} `, h('b', {}, value));
  mount(document.getElementById('pills'),
    pill('events', s.events),
    pill('timers', s.clock?.pendingTimers ?? 0),
    pill('ops', `${s.implementedOperations}/${s.totalOperations}`),
    s.contractViolations ? pill('contract issues', s.contractViolations, true) : null);
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

function wireHeader() {
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => show(b.dataset.view));
  const sel = document.getElementById('world-select');
  mount(sel, state.worlds.map((w) => h('option', { value: w.name, title: w.description ?? '' }, w.name)));
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
  show(location.hash.slice(1) || 'present');
  setInterval(() => refreshStatus().catch(() => {}), POLL_MS);
}

boot().catch((e) => {
  document.querySelector('main').replaceChildren(h('div', { class: 'panel empty' },
    h('h2', {}, 'The simulator did not answer'), h('p', {}, e.message), h('p', {}, 'Start it with: node bin/apx-sim.mjs serve')));
});
