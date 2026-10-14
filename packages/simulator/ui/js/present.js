// The Present view: walk an audience through a scenario one step at a
// time. Each step shows its title and narration, who acts and what they
// send, what came back next to what the standard expected, and the events
// the step caused. Keys: → or Space runs the next step, ← browses back,
// R rewinds, F enters presenter mode (full screen, no app chrome), Esc leaves it.
import {
  h, mount, jsonView, toast, statusBadge, fmtClock,
  state, on, openScenario, run, rewind, runNext, stepKind, stepSummary, actorOf, eventLine, sim,
} from './core.js';

let viewing = 0; // the step on stage (may lag the cursor when browsing back)
let rootEl = null;
let presenting = false;
let viaFullscreen = false; // presenter mode took the browser full screen, so leaving full screen leaves it too
let viewIsActive = () => false;
let shownStep = -1; // the step the last presenter render showed, so a new step starts at the top of the screen
let worldFilter = null; // the picker shows this world's demos; null shows them all
const rerender = () => rootEl && renderPresent(rootEl);

export function mountPresent(root, { isActive }) {
  rootEl = root;
  viewIsActive = isActive;
  on((what) => {
    if (what === 'scenario') viewing = 0;
    if (what === 'scenario' && !state.scenario) exitPresenter();
    if (what === 'status' && presenting) updatePresenterClock();
    if (['scenario', 'run', 'scenarios'].includes(what) && isActive()) rerender();
  });
  // Picking a world in the header filters the demo list to that world's demos.
  document.getElementById('world-select')?.addEventListener('change', (e) => {
    worldFilter = e.target.value;
    if (!state.scenario && isActive()) rerender();
  });
  document.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && presenting && viaFullscreen) exitPresenter();
  });
  // Presenter mode belongs to this view; following a link to another view leaves it.
  window.addEventListener('hashchange', () => {
    if (presenting && location.hash !== '#present') exitPresenter();
  });
  return rerender;
}

function onKey(e) {
  if (!viewIsActive() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return; // leave Ctrl+F, Ctrl+R and friends to the browser
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    advance();
  } else if (e.key === 'ArrowLeft') back();
  else if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    if (presenting) exitPresenter();
    else enterPresenter();
  } else if (e.key === 'Escape' && presenting) exitPresenter();
}

async function advance() {
  const s = state.scenario;
  if (!s || run.busy) return;
  if (viewing < run.cursor - 1) {
    viewing += 1;
    rerender();
    return;
  }
  if (run.cursor >= s.steps.length) return;
  viewing = run.cursor;
  await runNext();
}

function back() {
  viewing = Math.max(0, viewing - 1);
  rerender();
}

async function restart() {
  try {
    await rewind();
    viewing = 0;
    rerender();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

// ---------- presenter mode ----------

function enterPresenter() {
  if (presenting || !state.scenario?.steps.length) return;
  presenting = true;
  shownStep = -1;
  document.documentElement.classList.add('presenting');
  rerender();
  const el = document.documentElement;
  if (!el.requestFullscreen || document.fullscreenElement) return;
  // Full screen is a nicety: when the browser refuses (an iframe, a policy), the
  // mode still hides the app chrome and enlarges the stage.
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (viaFullscreen = true))
    .catch(() => (viaFullscreen = false));
}

function exitPresenter() {
  if (!presenting) return;
  presenting = false;
  viaFullscreen = false;
  document.documentElement.classList.remove('presenting');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  rerender();
}

function updatePresenterClock() {
  const el = rootEl?.querySelector('.pbar-clock');
  if (el) el.textContent = fmtClock(state.status?.clock?.now);
}

function presenterBar(s) {
  const n = s.steps.length;
  const atEnd = run.cursor >= n && viewing >= run.cursor - 1;
  return h('div', { class: 'pbar' },
    h('div', { class: 'pbar-row' },
      h('span', { class: 'logo' }, 'APX'),
      h('span', { class: 'pbar-name' }, s.name),
      h('span', { class: 'grow' }),
      h('span', { class: 'pbar-clock', title: 'The simulated clock' }, fmtClock(state.status?.clock?.now)),
      h('span', { class: 'pbar-nav' },
        h('button', { class: 'ghost small', onclick: back, disabled: viewing === 0, 'aria-label': 'Previous step', title: 'Previous step (←)' }, '◂'),
        h('span', { class: 'pbar-count', role: 'status', 'aria-label': `Step ${viewing + 1} of ${n}` }, run.busy ? 'running…' : `${viewing + 1} / ${n}`),
        h('button', { class: 'ghost small', onclick: advance, disabled: run.busy || atEnd, 'aria-label': 'Next step', title: 'Next step (→ or Space)' }, '▸')),
      h('button', { class: 'ghost small', onclick: exitPresenter, title: 'Leave presenter mode (Esc or F)' }, 'Exit ✕')),
    h('div', { class: 'progress pbar-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': viewing + 1 },
      h('div', { style: `width:${(100 * (viewing + 1)) / n}%` })));
}

// ---------- the picker and the timeline ----------

/** Load a world through the header picker, so the header, the simulator and this filter agree. */
function pickWorld(name) {
  const sel = document.getElementById('world-select');
  if (!sel || sel.value === name) {
    worldFilter = name;
    rerender();
    return;
  }
  sel.value = name;
  sel.dispatchEvent(new Event('change'));
}

/** The vetting suite's scenario kinds, in the order a world lists them. */
const KINDS = [['happy', 'Happy path'], ['lifecycle', 'Lifecycle'], ['edge', 'Edge cases'], ['refusal', 'Refusals'], ['security', 'Security'], ['other', 'Other']];
const kindOf = (s) => (KINDS.some(([k]) => k === s.kind) ? s.kind : 'other');
const describe = (world) => state.worlds.find((w) => w.name === world)?.description ?? '';
/** Scenarios assume a frozen clock: opening one while Live switches to Frozen first, so no timer fires between steps. */
async function freezeForWalkthrough() {
  if (!state.status?.clock?.realtime) return;
  await sim.post('/clock', { realtime: false });
  toast('Clock set to Frozen for the walkthrough');
}
const openIt = (id) => () => freezeForWalkthrough().then(() => openScenario(id)).then(restart).catch((e) => toast(e.message, 'bad'));

/** How many narrated demos and vetting scenarios each world has. */
function worldCounts() {
  const counts = new Map();
  const bump = (world, key) => counts.set(world, { demos: 0, vetting: 0, ...counts.get(world), [key]: (counts.get(world)?.[key] ?? 0) + 1 });
  state.scenarios.forEach((s) => bump(s.world, 'demos'));
  state.vetting.forEach((s) => bump(s.world, 'vetting'));
  return counts;
}

/** All worlds, then one chip per world something is written for, plus the picked world when nothing is. */
function worldChips(counts) {
  const names = [...counts.keys()].sort();
  if (worldFilter && !counts.has(worldFilter)) names.push(worldFilter);
  const total = (n) => (counts.get(n)?.demos ?? 0) + (counts.get(n)?.vetting ?? 0);
  const chip = (label, active, onclick, title) => h('button', { class: `world-chip${active ? ' active' : ''}`, 'aria-pressed': String(active), onclick, title }, label);
  return h('div', { class: 'world-chips', role: 'group', 'aria-label': 'Show the scenarios for a world' },
    chip('All worlds', !worldFilter, () => {
      worldFilter = null;
      rerender();
    }),
    names.map((n) => chip(`${n} · ${total(n)}`, worldFilter === n, () => pickWorld(n), describe(n))));
}

/** A world nothing is written for yet: say so, and offer the two ways in. */
function emptyWorld(name) {
  return h('div', { class: 'no-demo' },
    h('p', {}, h('b', {}, `No scenario uses ${name} yet.`), ' It is loaded now, so you can try it by hand.'),
    describe(name) ? h('p', { class: 'world-desc' }, describe(name)) : null,
    h('div', { class: 'row', style: 'justify-content:center' },
      h('button', { onclick: () => (location.hash = 'explore') }, `Explore ${name}`),
      h('button', { class: 'ghost', onclick: () => (location.hash = 'build') }, 'Build a demo for it')));
}

const section = (title, note, ...kids) => h('section', { class: 'picker-section' }, h('h3', {}, title), note ? h('p', { class: 'section-note' }, note) : null, ...kids);

function demoCards(list) {
  return h('div', { class: 'picker' }, list.map((s) => h('button', { class: 'scenario-card', onclick: openIt(s.id) },
    h('span', { class: 't' }, s.name),
    s.description ? h('span', { class: 'd' }, s.description) : null,
    h('span', { class: 'm' }, `${s.steps} steps · world ${s.world}`))));
}

/** All worlds: a tile per world with vetting scenarios, counted by kind. */
function vettingTiles(counts) {
  const worlds = [...new Set(state.vetting.map((s) => s.world))].sort();
  return h('div', { class: 'world-tiles' }, worlds.map((w) => {
    const mine = state.vetting.filter((s) => s.world === w);
    const demos = counts.get(w)?.demos ?? 0;
    const byKind = KINDS.map(([k, label]) => [label, mine.filter((s) => kindOf(s) === k).length]).filter(([, n]) => n);
    return h('button', { class: 'world-tile', onclick: () => pickWorld(w), title: describe(w) },
      h('span', { class: 't' }, w),
      h('span', { class: 'm' }, `${mine.length} scenarios${demos ? ` · ${demos} narrated` : ''}`),
      h('span', { class: 'd' }, byKind.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(' · ')));
  }));
}

/** One world's vetting scenarios as compact rows, grouped by kind. */
function vettingRows(list) {
  return KINDS.map(([k, label]) => {
    const rows = list.filter((s) => kindOf(s) === k);
    if (!rows.length) return null;
    return h('div', { class: 'kind-group' }, h('h4', {}, `${label} (${rows.length})`),
      h('div', { class: 'vet-rows' }, rows.map((s) => {
        const [id, ...title] = s.name.split(' — ');
        return h('button', { class: 'vet-row', onclick: openIt(s.id), title: s.description ?? '' },
          h('span', { class: 'vid' }, id), h('span', { class: 'vt' }, title.join(' — ') || s.name), h('span', { class: 'vm' }, `${s.steps} steps`));
      })));
  });
}

const DEMOS_NOTE = 'Stories written to be told: narration at every step.';
const VETTING_NOTE = 'The cases the standard was tested against, one request at a time. Each sets its stage first by replaying the cases before it in its module, as the suite does.';

function picker() {
  const counts = worldCounts();
  const demos = worldFilter ? state.scenarios.filter((s) => s.world === worldFilter) : state.scenarios;
  const vetting = worldFilter ? state.vetting.filter((s) => s.world === worldFilter) : state.vetting;
  const anything = state.scenarios.length + state.vetting.length > 0;
  const body = worldFilter
    ? demos.length || vetting.length
      ? [demos.length ? section(`Narrated demos (${demos.length})`, DEMOS_NOTE, demoCards(demos)) : null,
        vetting.length ? section(`Vetting suite (${vetting.length})`, VETTING_NOTE, ...vettingRows(vetting)) : null]
      : [emptyWorld(worldFilter)]
    : [demos.length ? section(`Narrated demos (${demos.length})`, DEMOS_NOTE, demoCards(demos)) : null,
      vetting.length ? section(`Vetting suite (${vetting.length})`, `${VETTING_NOTE} Pick a world to walk through its cases.`, vettingTiles(counts)) : null];
  return h('div', { class: 'panel empty' },
    h('h2', {}, 'Present a scenario'),
    h('p', {}, 'Every scenario is written for one world: the garages, lanes, devices and companies it acts on. Pick a world to see what can be walked through in it, or open a scenario and it loads its own world. Each step runs live: who acts, what they send, what the server answers, and which events go out.'),
    anything ? worldChips(counts) : h('p', {}, 'No scenarios yet. Build one first, or save one into packages/simulator/scenarios/.'),
    ...body);
}

/** A round pass / fail / next mark with a name screen readers can read. */
function stepMark(r, isNext) {
  if (r) return h('span', { class: r.ok ? 'mark-ok' : 'mark-bad', role: 'img', 'aria-label': r.ok ? 'passed' : 'failed' }, r.ok ? '✓' : '✗');
  if (isNext) return h('span', { class: 'mark-next', role: 'img', 'aria-label': 'next' }, '▸');
  return h('span', { class: 'mark-none', 'aria-hidden': 'true' });
}

export function renderPresent(root) {
  const s = state.scenario;
  if (!s || !s.steps.length) {
    if (presenting) exitPresenter();
    mount(root, picker());
    return;
  }
  viewing = Math.min(viewing, s.steps.length - 1);
  if (presenting) {
    mount(root, h('div', { class: 'present presenter' }, presenterBar(s), stage(s)));
    if (shownStep !== viewing) window.scrollTo(0, 0);
    shownStep = viewing;
  } else mount(root, h('div', { class: 'present' }, timeline(s), stage(s)));
}

function timeline(s) {
  return h('div', { class: 'panel timeline' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, s.name),
      h('button', { class: 'ghost small', onclick: () => {
        state.scenario = null;
        rerender();
      } }, 'Change')),
    h('div', { class: 'panel-body' }, h('div', { class: 'progress' }, h('div', { style: `width:${(100 * run.cursor) / s.steps.length}%` }))),
    h('ol', { style: 'list-style:none;margin:0;padding:0' }, s.steps.map((step, i) => {
      const r = run.results[i];
      const browse = () => {
        viewing = i;
        rerender();
      };
      return h('li', {}, h('button', {
        class: `tl${i === viewing ? ' current' : ''}`, onclick: browse, disabled: i >= run.cursor && i !== viewing,
        'aria-current': i === viewing ? 'step' : null, title: i < run.cursor ? 'Show this step again' : null,
      },
      h('span', { class: 'n' }, i + 1),
      stepMark(r, i === run.cursor),
      h('span', {}, step.name ?? stepSummary(step))));
    })));
}

function finishedBanner(s) {
  if (run.cursor < s.steps.length || run.busy) return null;
  if (presenting && viewing < s.steps.length - 1) return null; // on stage, the verdict waits for the last step
  const done = run.results.filter(Boolean);
  const failed = done.filter((r) => !r.ok).length;
  return h('div', { class: `finished ${failed ? 'bad' : 'ok'}`, role: 'status' },
    h('span', {}, failed ? `✗ ${failed} of ${s.steps.length} steps did not go as the standard says` : `✓ All ${s.steps.length} steps went as the standard says`),
    h('span', { class: 'grow' }),
    h('button', { class: 'ghost small', onclick: restart }, '⟲ Play it again'));
}

function controls(s) {
  const done = run.cursor >= s.steps.length;
  const browsing = viewing < run.cursor - 1;
  let label = `Run step ${run.cursor + 1} ▸`;
  if (run.busy) label = 'Running…';
  else if (browsing) label = 'Forward ▸';
  else if (done) label = 'Finished';
  return h('div', { class: 'row' },
    h('button', { class: 'ghost', onclick: restart, disabled: run.busy, title: 'Reload the world and start again (R)' }, '⟲ Restart'),
    h('button', { class: 'ghost', disabled: viewing === 0, onclick: back }, '◂ Back'),
    h('button', { onclick: advance, disabled: run.busy || (done && !browsing) }, label),
    h('span', { class: 'muted' }, h('span', { class: 'kbd' }, '→'), ' or ', h('span', { class: 'kbd' }, 'Space'), ' next · ',
      h('span', { class: 'kbd' }, '←'), ' back · ', h('span', { class: 'kbd' }, 'R'), ' restart · ', h('span', { class: 'kbd' }, 'F'), ' presenter'),
    h('span', { class: 'grow' }),
    h('button', { class: 'ghost', onclick: enterPresenter, title: 'Full screen, large type, no app chrome (F; Esc leaves)' }, '⛶ Presenter mode'));
}

function stage(s) {
  const step = s.steps[viewing];
  const r = run.results[viewing];
  const kind = stepKind(step);
  const pending = viewing === run.cursor ? 'Not run yet. Press Run to play this step live.' : 'Not run.';
  const pendingHint = presenting && viewing === run.cursor ? 'Not run yet. Press → or Space to play this step live.' : pending;
  return h('div', { class: 'stage' },
    presenting ? null : controls(s),
    finishedBanner(s),
    h('div', { class: 'panel' }, h('div', { class: 'panel-body stage-intro' },
      h('div', { class: 'stage-head' },
        h('span', { class: 'muted' }, `Step ${viewing + 1} of ${s.steps.length}`),
        h('span', { class: `badge k-${kind}` }, kindLabel(kind)),
        r?.now ? h('span', { class: 'muted mono' }, fmtClock(r.now)) : null),
      h('div', { class: 'stage-title' }, step.name ?? stepSummary(step)),
      step.narration ? h('p', { class: 'narration' }, step.narration) : null)),
    ...exchange(action(step, kind, r), r ? outcome(r) : null, pendingHint));
}

/**
 * What the step sends and what came back. In presenter mode the request and
 * its events sit beside the server's answer, so one screen holds the exchange.
 */
function exchange(act, out, pendingHint) {
  const waiting = h('div', { class: 'panel' }, h('div', { class: 'panel-body muted' }, pendingHint));
  if (!out) return [act, waiting];
  const [answer, events] = out;
  // Presenter: what was sent and what it caused on the left, the answer on the right.
  if (presenting) return [h('div', { class: 'p-exchange' }, h('div', { class: 'p-col' }, act, events), answer)];
  return [act, h('div', { class: 'cards' }, answer, events)];
}

const KIND_LABELS = { request: 'API call', inject: 'in the garage', clock: 'time passes', events: 'check: events', deliveries: 'check: webhooks', note: 'narration' };
const kindLabel = (k) => KIND_LABELS[k] ?? k;

function action(step, kind, r) {
  const card = (...kids) => h('div', { class: 'panel' }, h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:8px' }, ...kids));
  // Before the step runs, say what the standard expects; afterwards the outcome shows it beside the answer.
  const expected = r ? [] : expectedChecks(step);
  const expectations = expected.length ? checklist(expected, 'The standard says') : null;
  if (kind === 'request') {
    const rq = step.request;
    return card(
      h('div', { class: 'row' }, h('span', { class: 'actor' }, '👤 ', actorOf(step)), h('span', { class: 'call' }, `${rq.method ?? 'GET'} ${rq.path}`)),
      expectations,
      rq.body !== undefined ? h('details', { open: true }, h('summary', {}, 'Request body'), jsonView(rq.body)) : null);
  }
  if (kind === 'inject') {
    const { kind: k, ...params } = step.inject;
    return card(h('div', { class: 'row' }, h('span', { class: 'actor' }, '🚗 the world'), h('span', { class: 'call' }, k)),
      h('details', {}, h('summary', {}, 'Details'), jsonView(params)));
  }
  if (kind === 'clock') {
    const what = step.clock.now ? `jumps to ${fmtClock(step.clock.now)}` : `moves on ${step.clock.advance}`;
    return card(h('div', { class: 'row' }, h('span', { class: 'actor' }, '⏱ clock'), h('span', { class: 'call' }, what)));
  }
  if (kind === 'prepare') {
    const p = r?.prepare;
    const n = p?.replayed ?? 0;
    const what = p ? `loaded ${p.world}${n ? `, replayed ${n} earlier ${n === 1 ? 'case' : 'cases'}` : ''}` : `loads ${step.prepare.module} and replays the cases before ${step.prepare.before}`;
    return card(h('div', { class: 'row' }, h('span', { class: 'actor' }, '🎬 the stage'), h('span', { class: 'call' }, what)));
  }
  if (kind === 'note') return null;
  return card(h('span', { class: 'call' }, stepSummary(step)), expectations);
}

// ---------- expected vs actual ----------

const MAX_VALUE_CHARS = 80;
const BOUND_WORDS = { min: 'at least', max: 'at most', exactly: 'exactly' };
const EVENT_BOUNDS = ['min', 'max', 'exactly'];

/** The leaves of a partial body, as [path, value]: the same walk the server makes. */
function bodyLeaves(v, path = '') {
  const entries = v !== null && typeof v === 'object' ? (Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v)) : [];
  if (!entries.length) return [[path, v]];
  return entries.flatMap(([k, x]) => bodyLeaves(x, typeof k === 'number' ? `${path}[${k}]` : path ? `${path}.${k}` : k));
}

/** What a step asserts, before it runs (the same shape as the server's checks, with no verdict). */
function expectedChecks(step) {
  const ex = step.expect ?? {};
  const out = [];
  if (step.request && ex.status !== undefined) out.push({ check: 'status', expected: ex.status });
  if (step.request && ex.problem) out.push({ check: 'problem', expected: ex.problem });
  if (step.request && ex.body !== undefined) out.push(...bodyLeaves(ex.body).map(([path, expected]) => ({ check: 'body', path, expected })));
  for (const bound of EVENT_BOUNDS) {
    if (step.events?.[bound] !== undefined) out.push({ check: 'events', type: step.events.type ?? null, bound, expected: step.events[bound] });
  }
  if (step.deliveries?.status) out.push({ check: 'delivery', expected: step.deliveries.status });
  return out;
}

function fmtValue(v) {
  const t = JSON.stringify(v) ?? String(v);
  return t.length > MAX_VALUE_CHARS ? `${t.slice(0, MAX_VALUE_CHARS - 1)}…` : t;
}

/** [what was expected, what came back] for one check, in words. */
function checkWords(c) {
  switch (c.check) {
    case 'status': return [`status ${c.expected}`, String(c.actual)];
    case 'problem': return [`problem ${c.expected}`, c.actual ?? 'no problem type'];
    case 'body': {
      if (!c.path) return ['body matches', fmtValue(c.actual)];
      const at = c.path.startsWith('[') ? `body${c.path}` : `body.${c.path}`;
      return [`${at} = ${fmtValue(c.expected)}`, c.missing ? 'missing' : fmtValue(c.actual)];
    }
    case 'contract': return ['response valid against the APX bundle', String(c.actual)];
    case 'events': return [`${BOUND_WORDS[c.bound] ?? c.bound} ${c.expected} × ${c.type ?? 'any event'}`, String(c.actual)];
    case 'delivery': return [`a webhook delivery in status ${c.expected}`, c.actual?.length ? c.actual.join(', ') : 'no deliveries'];
    default: return [`${c.check} ${fmtValue(c.expected)}`, fmtValue(c.actual)];
  }
}

function checkRow(c) {
  const [want, got] = checkWords(c);
  const verdict = c.ok === undefined ? 'pending' : c.ok ? 'ok' : 'bad';
  const allowed = c.check === 'contract' && c.allowed;
  const mark = {
    pending: h('span', { class: 'mark-none', role: 'img', 'aria-label': 'expected' }),
    ok: h('span', { class: allowed ? 'mark-warn' : 'mark-ok', role: 'img', 'aria-label': allowed ? 'allowed' : 'passed' }, allowed ? '!' : '✓'),
    bad: h('span', { class: 'mark-bad', role: 'img', 'aria-label': 'failed' }, '✗'),
  }[verdict];
  let note = null;
  if (verdict === 'bad') note = h('span', { class: 'got', title: got }, 'got ', h('b', {}, got));
  else if (allowed) note = h('span', { class: 'got allowed', title: got }, 'violation allowed by this step');
  return h('li', { class: `check ${verdict}` }, mark, h('span', { class: 'want' }, want), note);
}

function checklist(checks, title) {
  const judged = checks.filter((c) => c.ok !== undefined);
  const failed = judged.filter((c) => !c.ok).length;
  let tally = null;
  if (judged.length) tally = h('span', { class: failed ? 'verdict-bad' : 'verdict-ok' }, failed ? `${failed} of ${judged.length} failed` : `${judged.length} of ${judged.length} passed`);
  return h('div', { class: 'checks-box' },
    h('div', { class: 'checks-title' }, h('span', { class: 'grow' }, title), tally),
    h('ul', { class: 'checks' }, checks.map(checkRow)));
}

// ---------- outcome ----------

function eventCard(ev) {
  const n = ev._deliveredTo?.length ?? 0;
  return h('details', { class: 'ev' },
    h('summary', {}, h('span', { class: 'event-type' }, ev.type), ' ',
      h('span', { class: 'muted mono' }, `${(ev.time ?? '').slice(11, 19)}  ${eventLine(ev)}`),
      n ? h('span', { class: 'muted' }, ` → ${n} subscriber${n === 1 ? '' : 's'}`) : null),
    jsonView(ev.data ?? ev));
}

/** The server's answer (with expected vs actual) and the events the step published, as two panels. */
function outcome(r) {
  const body = r.response?.body;
  const checks = r.checks ?? [];
  // A failed assertion is already spelled out in the checklist; repeat the error only when it says something else.
  const errorShown = r.error && !(checks.some((c) => !c.ok) && /^(expected |body mismatch|response violates)/.test(r.error));
  const left = h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'What happened'),
      h('span', { class: `big-status ${r.ok ? 'verdict-ok' : 'verdict-bad'}` }, r.ok ? '✓ as the standard says' : '✗ not as expected')),
    h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:8px' },
      errorShown ? h('div', { class: 'verdict-bad' }, r.error) : null,
      r.response ? h('div', { class: 'row' }, statusBadge(r.response.status), r.response.problem ? h('code', {}, r.response.problem) : null, body?.title ? h('span', {}, body.title) : null) : null,
      body?.detail ? h('div', { class: 'muted' }, body.detail) : null,
      checks.length ? checklist(checks, 'Expected vs actual') : null,
      r.response ? jsonView(body) : null,
      r.inject?.result ? jsonView(r.inject.result) : null,
      r.eventCount !== undefined ? h('div', {}, `${r.eventCount} matching event${r.eventCount === 1 ? '' : 's'} in the outbox.`) : null,
      r.clock ? h('div', {}, `The clock now reads ${fmtClock(r.clock.now)}.`) : null));
  const evs = r.events ?? [];
  const right = h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'Events published'), h('span', { class: 'muted' }, evs.length)),
    h('div', { class: 'panel-body' }, evs.length ? evs.map(eventCard) : h('div', { class: 'muted' }, 'This step published no events.')));
  return [left, right];
}
