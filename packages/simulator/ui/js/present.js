// The Present view: walk an audience through a scenario one step at a
// time. Each step shows its title and narration, who acts and what they
// send, what came back, and the events the step caused. Keys: → or Space
// runs the next step, ← browses back, R rewinds.
import {
  h, mount, jsonView, toast, statusBadge, fmtClock,
  state, on, openScenario, run, rewind, runNext, stepKind, stepSummary, actorOf, eventLine,
} from './core.js';

let viewing = 0; // the step on stage (may lag the cursor when browsing back)
let rootEl = null;
const rerender = () => rootEl && renderPresent(rootEl);

export function mountPresent(root, { isActive }) {
  rootEl = root;
  on((what) => {
    if (what === 'scenario') viewing = 0;
    if (['scenario', 'run', 'scenarios'].includes(what) && isActive()) rerender();
  });
  document.addEventListener('keydown', (e) => {
    if (!isActive() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      advance();
    } else if (e.key === 'ArrowLeft') {
      viewing = Math.max(0, viewing - 1);
      rerender();
    } else if (e.key === 'r' || e.key === 'R') restart();
  });
  return rerender;
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

async function restart() {
  try {
    await rewind();
    viewing = 0;
    rerender();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

function picker() {
  const open = (id) => () => openScenario(id).then(restart).catch((e) => toast(e.message, 'bad'));
  return h('div', { class: 'panel empty' },
    h('h2', {}, 'Present a scenario'),
    h('p', {}, 'Pick a scenario to walk an audience through it. Each step runs live against the simulator: who acts, what they send, what the server answers, and which events go out to subscribers.'),
    state.scenarios.length
      ? h('div', { class: 'picker' }, state.scenarios.map((s) => h('button', { class: 'scenario-card', onclick: open(s.id) },
        h('span', { class: 't' }, s.name),
        s.description ? h('span', { class: 'd' }, s.description) : null,
        h('span', { class: 'm' }, `${s.steps} steps · world ${s.world}`))))
      : h('p', {}, 'No scenarios yet. Build one first, or save one into packages/simulator/scenarios/.'));
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
    mount(root, picker());
    return;
  }
  viewing = Math.min(viewing, s.steps.length - 1);
  mount(root, h('div', { class: 'present' }, timeline(s), stage(s)));
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
    h('button', { class: 'ghost', disabled: viewing === 0, onclick: () => {
      viewing -= 1;
      rerender();
    } }, '◂ Back'),
    h('button', { onclick: advance, disabled: run.busy || (done && !browsing) }, label),
    h('span', { class: 'muted' }, h('span', { class: 'kbd' }, '→'), ' or ', h('span', { class: 'kbd' }, 'Space'), ' next · ',
      h('span', { class: 'kbd' }, '←'), ' back · ', h('span', { class: 'kbd' }, 'R'), ' restart'));
}

function stage(s) {
  const step = s.steps[viewing];
  const r = run.results[viewing];
  const kind = stepKind(step);
  const pending = viewing === run.cursor ? 'Not run yet. Press Run to play this step live.' : 'Not run.';
  return h('div', { class: 'stage' },
    controls(s),
    finishedBanner(s),
    h('div', { class: 'panel' }, h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:10px' },
      h('div', { class: 'stage-head' },
        h('span', { class: 'muted' }, `Step ${viewing + 1} of ${s.steps.length}`),
        h('span', { class: `badge k-${kind}` }, kindLabel(kind)),
        r?.now ? h('span', { class: 'muted mono' }, fmtClock(r.now)) : null),
      h('div', { class: 'stage-title' }, step.name ?? stepSummary(step)),
      step.narration ? h('p', { class: 'narration' }, step.narration) : null)),
    action(step, kind),
    r ? outcome(r) : h('div', { class: 'panel' }, h('div', { class: 'panel-body muted' }, pending)));
}

const KIND_LABELS = { request: 'API call', inject: 'in the garage', clock: 'time passes', events: 'check: events', deliveries: 'check: webhooks', note: 'narration' };
const kindLabel = (k) => KIND_LABELS[k] ?? k;

function action(step, kind) {
  const card = (...kids) => h('div', { class: 'panel' }, h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:8px' }, ...kids));
  if (kind === 'request') {
    const rq = step.request;
    return card(
      h('div', { class: 'row' }, h('span', { class: 'actor' }, '👤 ', actorOf(step)), h('span', { class: 'call' }, `${rq.method ?? 'GET'} ${rq.path}`)),
      step.expect?.status ? h('div', { class: 'muted' }, `The standard says the answer is ${step.expect.status}${step.expect.problem ? ` (${step.expect.problem})` : ''}.`) : null,
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
  if (kind === 'note') return null;
  return card(h('span', { class: 'call' }, stepSummary(step)));
}

function eventCard(ev) {
  const n = ev._deliveredTo?.length ?? 0;
  return h('details', { class: 'ev' },
    h('summary', {}, h('span', { class: 'event-type' }, ev.type), ' ',
      h('span', { class: 'muted mono' }, `${(ev.time ?? '').slice(11, 19)}  ${eventLine(ev)}`),
      n ? h('span', { class: 'muted' }, ` → ${n} subscriber${n === 1 ? '' : 's'}`) : null),
    jsonView(ev.data ?? ev));
}

function outcome(r) {
  const body = r.response?.body;
  const left = h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'What happened'),
      h('span', { class: `big-status ${r.ok ? 'verdict-ok' : 'verdict-bad'}` }, r.ok ? '✓ as the standard says' : '✗ not as expected')),
    h('div', { class: 'panel-body', style: 'display:flex;flex-direction:column;gap:8px' },
      r.error ? h('div', { class: 'verdict-bad' }, r.error) : null,
      r.response ? h('div', { class: 'row' }, statusBadge(r.response.status), r.response.problem ? h('code', {}, r.response.problem) : null, body?.title ? h('span', {}, body.title) : null) : null,
      body?.detail ? h('div', { class: 'muted' }, body.detail) : null,
      r.response ? jsonView(body) : null,
      r.inject?.result ? jsonView(r.inject.result) : null,
      r.eventCount !== undefined ? h('div', {}, `${r.eventCount} matching event${r.eventCount === 1 ? '' : 's'} in the outbox.`) : null,
      r.clock ? h('div', {}, `The clock now reads ${fmtClock(r.clock.now)}.`) : null));
  const evs = r.events ?? [];
  const right = h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('b', { class: 'grow' }, 'Events published'), h('span', { class: 'muted' }, evs.length)),
    h('div', { class: 'panel-body' }, evs.length ? evs.map(eventCard) : h('div', { class: 'muted' }, 'This step published no events.')));
  return h('div', { class: 'cards' }, left, right);
}
