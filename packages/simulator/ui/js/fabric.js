// The Fabric view: the Part 8 delivery fabric, live. Events stream in as
// they are published (type, place, time, and which subscribers they fan out
// to); each subscriber shows its transport, topics, status, endpoint health
// and its latest deliveries from the ledger, attempt by attempt, with the
// next retry counting down on the §8.3 schedule.
//
// Controls for a presenter: start/stop the traffic generator (POST
// /sim/traffic) and set its rate and mix, break or mend a webhook endpoint
// (PUT /sim/receivers), drop or reconnect a simulated SSE client, and add a
// webhook or SSE subscriber in one click (POST /sim/fabric/…).
//
// Data comes from GET /sim/fabric, fetched when the live stream (app.js)
// says events, deliveries, stored records or the traffic changed; the
// once-a-second clock notice only re-draws the countdowns.
import { h, mount, toast, state, on, emit, sim, refreshStatus, resetRun, loading } from './core.js';

const DEMO_WORLD = 'apx-events';
const FETCH_ON = ['hello', 'reset', 'event', 'delivery', 'store', 'traffic'];
const RATE_MIN = 6;
const RATE_MAX = 240;
const RATE_STEP = 6;
const SEEN_MAX = 5000; // remembered keys before the oldest are forgotten
const SUBSCRIBER_COLOURS = 8; // .sub-c0 … .sub-c7 in app.css
const SCHEDULE = '0 s · 30 s · 2 min · 10 min · 1 h · then hourly, up to 24 h';
const KIND_LABELS = { vehicles: 'Vehicles', devices: 'Devices', occupancy: 'Occupancy', payments: 'Payments' };
const KIND_WEIGHTS = { vehicles: 4, devices: 1, occupancy: 2, payments: 2 }; // the generator's default mix (src/kernel/traffic.mjs)
const STATUS_LABELS = { delivered: 'delivered', retrying: 'retrying', failed: 'failed' };

let rootEl = null;
let data = null;
let inFlight = false;
let again = false;
let pass = 0; // render count: a row or attempt first seen on this pass gets the arrival animation, once
let dragging = false; // the rate slider is held: keep the bar as it is
const seen = new Map(); // event id, or subscription:event:attempt → the pass it was first shown on
const colours = new Map(); // subscription id → colour index

export function mountFabric(root, { isActive }) {
  rootEl = root;
  window.addEventListener('sim:change', (e) => {
    if (!isActive()) return;
    const kinds = e.detail?.kinds ?? [];
    if (kinds.some((k) => FETCH_ON.includes(k))) refresh();
  });
  on((what) => {
    if (!isActive()) return;
    if (what === 'world') {
      seen.clear();
      colours.clear();
      pass = 0;
      refresh();
    }
    if (what !== 'status') return;
    if (!state.live) refresh(); // no live stream: follow the status poll
    else tickCountdowns();
  });
  return () => refresh();
}

// ---------- data ----------

async function refresh() {
  if (inFlight) {
    again = true;
    return;
  }
  inFlight = true;
  try {
    data = await sim.get('/fabric');
    render();
  } catch (e) {
    mount(rootEl, h('div', { class: 'error-box', role: 'alert' }, `The simulator did not answer: ${e.message}`));
  } finally {
    inFlight = false;
    if (again) {
      again = false;
      refresh();
    }
  }
}

const act = (fn, done) => () =>
  Promise.resolve()
    .then(fn)
    .then((r) => done && toast(typeof done === 'function' ? done(r) : done))
    .then(refresh)
    .catch((e) => toast(e.message, 'bad'));

function goLive() {
  return sim.post('/clock', { realtime: true }).then(refreshStatus);
}

async function loadDemoWorld() {
  await sim.post('/reset', { world: DEMO_WORLD });
  resetRun();
  await refreshStatus();
  emit('world');
}

async function setTraffic(change) {
  if (change.running && !data?.realtime) await goLive();
  return sim.post('/traffic', change);
}

const setReceiver = (endpoint, failing) => sim.put('/receivers', { endpoint, codes: [], default: failing ? 503 : 200 });
const setSse = (subscription, connected) => sim.post('/fabric/sse', { subscription, connected });
const addSubscriber = (transport) => sim.post('/fabric/subscribers', { transport });

// ---------- render ----------

function render() {
  if (!rootEl) return;
  if (!data) return mount(rootEl, loading());
  for (const s of data.subscriptions) if (!colours.has(s.id)) colours.set(s.id, colours.size % SUBSCRIBER_COLOURS);
  pass += 1;
  for (const key of seen.keys()) {
    if (seen.size <= SEEN_MAX) break;
    seen.delete(key);
  }
  const oldBar = rootEl.querySelector('.fabric-bar');
  const scroll = rootEl.querySelector('.stream-rows')?.scrollTop ?? 0;
  mount(rootEl, h('div', { class: 'fabric' },
    dragging && oldBar ? oldBar : controlBar(),
    data.subscriptions.length ? null : emptyNotice(),
    h('div', { class: 'fabric-grid' }, streamPanel(), subscribersPanel())));
  const rows = rootEl.querySelector('.stream-rows');
  if (rows) rows.scrollTop = scroll;
}

/** True the first time `key` is drawn after the first render, so what was already there does not flash. */
function isNew(key) {
  if (!seen.has(key)) seen.set(key, pass === 1 ? 0 : pass);
  return seen.get(key) === pass;
}

function controlBar() {
  const t = data.traffic;
  const totals = data.subscriptions.reduce((acc, s) => {
    for (const k of ['delivered', 'retrying', 'failed']) acc[k] += s.deliveries[k];
    return acc;
  }, { delivered: 0, retrying: 0, failed: 0 });
  return h('section', { class: 'panel fabric-bar', 'aria-label': 'Traffic and totals' },
    h('div', { class: 'fabric-title' }, h('h2', {}, 'Delivery fabric'), h('span', { class: 'muted' }, `Part 8 · world ${data.world}`)),
    trafficControls(t),
    h('div', { class: 'fabric-totals' },
      total('events', data.outbox, 'event'),
      total('delivered', totals.delivered, 'ok'),
      total('retrying', totals.retrying, 'warn'),
      total('failed', totals.failed, 'bad')),
    h('div', { class: 'row fabric-add' },
      h('button', { class: 'ghost', onclick: act(() => addSubscriber('webhook'), (r) => `Webhook subscriber ${short(r.subscription)} added`) }, '+ Webhook subscriber'),
      h('button', { class: 'ghost', onclick: act(() => addSubscriber('sse'), (r) => `SSE subscriber ${short(r.subscription)} added and connected`) }, '+ SSE subscriber')));
}

function total(label, value, tone) {
  return h('div', { class: `fabric-total t-${tone}` }, h('b', {}, String(value)), h('span', {}, label));
}

function trafficControls(t) {
  const running = t.running;
  const paused = running && !data.realtime;
  const rate = h('input', { type: 'range', min: RATE_MIN, max: RATE_MAX, step: RATE_STEP, value: t.ratePerMinute, 'aria-label': 'Traffic rate, events a minute' });
  const rateOut = h('output', { class: 'mono' }, `${t.ratePerMinute}/min`);
  rate.addEventListener('pointerdown', () => (dragging = true));
  rate.addEventListener('input', () => (rateOut.textContent = `${rate.value}/min`));
  const apply = act(() => sim.post('/traffic', { ratePerMinute: Number(rate.value) }));
  rate.addEventListener('change', () => {
    dragging = false;
    apply();
  });
  return h('div', { class: 'fabric-traffic' },
    h('button', { class: running ? 'danger' : '', onclick: act(() => setTraffic({ running: !running }), running ? 'Traffic stopped' : 'Traffic running: the clock is live') },
      running ? '■ Stop traffic' : '▶ Start traffic'),
    h('span', { class: `traffic-state ${paused ? 'paused' : running ? 'on' : ''}`, role: 'status' },
      paused ? 'paused: clock frozen' : running ? `running · ${t.ticks} ticks · ${t.published} events` : 'traffic off'),
    paused ? h('button', { class: 'small', onclick: act(goLive, 'Clock is live') }, 'Go live') : null,
    h('label', { class: 'fabric-rate' }, h('span', { class: 'muted' }, 'Rate'), rate, rateOut),
    h('div', { class: 'fabric-mix', role: 'group', 'aria-label': 'Traffic mix' }, Object.keys(KIND_LABELS).map((k) => mixToggle(t, k))));
}

function mixToggle(t, kind) {
  const on = (t.mix[kind] ?? 0) > 0;
  const can = t.available.includes(kind);
  const weight = on ? 0 : KIND_WEIGHTS[kind];
  return h('button', {
    class: `chip ${on ? 'active' : ''}`,
    'aria-pressed': String(on),
    disabled: !can,
    title: can ? `${on ? 'Leave out' : 'Include'} ${kind}` : `This world has nothing to play for ${kind}`,
    onclick: act(() => sim.post('/traffic', { mix: { [kind]: weight } })),
  }, KIND_LABELS[kind]);
}

function emptyNotice() {
  return h('div', { class: 'panel fabric-empty' },
    h('div', {}, h('b', {}, `World ${data.world} has no subscribers yet.`), ' Add one above, or load the Part 8 cast: city platform, ops monitor and regional auditor.'),
    data.world === DEMO_WORLD ? null : h('button', { onclick: act(loadDemoWorld, `Loaded world ${DEMO_WORLD}`) }, `Load ${DEMO_WORLD}`));
}

// ---------- the event stream ----------

function streamPanel() {
  const rows = data.events.map(eventRow);
  return h('section', { class: 'panel fabric-stream', 'aria-label': 'Events as published' },
    h('div', { class: 'panel-head' }, h('b', {}, 'Events'), h('span', { class: 'muted' }, 'newest first, as published')),
    h('div', { class: 'stream-rows', role: 'log', 'aria-live': 'off' },
      rows.length ? rows : h('div', { class: 'empty' }, data.traffic.running ? 'Waiting for the first event…' : 'No events yet. Start the traffic.')));
}

function eventRow(e) {
  const fresh = isNew(e.id);
  const subs = e.deliveredTo.filter((id) => colours.has(id));
  return h('div', { class: `ev-line ${fresh ? 'fresh' : ''} ${subs.length ? '' : 'unmatched'}` },
    h('time', { class: 'mono ev-time', datetime: e.time }, e.time.slice(11, 19)),
    h('span', { class: `ev-type d-${domainOf(e.type)}`, title: e.type }, shortType(e.type)),
    h('span', { class: 'ev-place', title: e.place ?? 'not bound to a place' }, e.placeName ?? 'unbound'),
    h('span', { class: 'ev-fan', title: subs.length ? `Delivered to ${subs.length} subscriber${subs.length === 1 ? '' : 's'}` : 'No subscription matched (topic, grant or place filter)' },
      subs.length ? subs.map((id) => h('i', { class: `dot sub-c${colours.get(id)}` })) : h('span', { class: 'muted' }, 'no match')));
}

const shortType = (type) => type.replace(/^apx\./, '').replace(/\.v\d+$/, '');
function domainOf(type) {
  if (!type.startsWith('apx.')) return 'apds';
  return type.split('.')[1];
}

// ---------- subscribers ----------

function subscribersPanel() {
  return h('section', { class: 'fabric-subs', 'aria-label': 'Subscribers' },
    h('div', { class: 'fabric-schedule muted' }, h('b', {}, 'Retry schedule (§8.3): '), SCHEDULE),
    h('div', { class: 'sub-cards' }, data.subscriptions.map(subscriberCard)));
}

function subscriberCard(s) {
  return h('article', { class: `panel sub-card sub-c${colours.get(s.id)} ${s.status}` },
    h('div', { class: 'sub-head' },
      h('i', { class: `dot big sub-c${colours.get(s.id)}` }),
      h('div', { class: 'sub-name' }, h('b', {}, s.owner ?? short(s.id)), h('span', { class: 'mono muted', title: s.endpoint ?? 'Server-Sent Events stream' }, s.endpoint ? hostOf(s.endpoint) : 'GET /v1/events/stream')),
      h('span', { class: `badge tr-${s.transport}` }, s.transport === 'sse' ? 'SSE' : 'webhook'),
      h('span', { class: `sub-status st-${s.status}` }, s.status)),
    h('div', { class: 'sub-meta' },
      health(s),
      h('span', { class: 'muted', title: s.topics.join('\n') }, `${s.topics.length} topic${s.topics.length === 1 ? '' : 's'}`),
      s.held ? h('span', { class: 'muted' }, `${s.held} held`) : null,
      h('span', { class: 'grow' }),
      subscriberControl(s)),
    s.transport === 'sse' ? sseBody(s) : webhookBody(s));
}

function health(s) {
  if (s.status === 'failed') return h('span', { class: 'health bad' }, 'retry schedule exhausted');
  if (s.transport === 'sse') {
    const n = s.sse?.clients ?? 0;
    return h('span', { class: `health ${n ? 'ok' : 'warn'}` }, n ? `${n} client${n === 1 ? '' : 's'} connected` : 'no client connected');
  }
  const r = s.receiver;
  if (!r) return h('span', { class: 'health' }, 'endpoint unknown');
  return h('span', { class: `health ${r.failing ? 'bad' : 'ok'}` }, r.failing ? `endpoint down (answers ${r.default})` : `endpoint up (answers ${r.default})`);
}

function subscriberControl(s) {
  if (s.transport === 'sse') {
    const connected = Boolean(s.sse?.simulated?.connected);
    return h('button', { class: connected ? 'small danger' : 'small', onclick: act(() => setSse(s.id, !connected), connected ? 'Client dropped: frames buffer on the server' : 'Client reconnected with Last-Event-ID') },
      connected ? 'Drop client' : 'Reconnect');
  }
  if (!s.endpoint) return null;
  const failing = Boolean(s.receiver?.failing);
  return h('button', { class: failing ? 'small' : 'small danger', onclick: act(() => setReceiver(s.endpoint, !failing), failing ? 'Endpoint recovered: retries will land' : 'Endpoint now answers 503') },
    failing ? 'Recover endpoint' : 'Make endpoint fail');
}

function webhookBody(s) {
  const d = s.deliveries;
  return h('div', { class: 'sub-body' },
    h('div', { class: 'sub-stats' }, stat(d.delivered, 'delivered', 'ok'), stat(d.retrying, 'retrying', 'warn'), stat(d.failed, 'failed', 'bad')),
    s.recent.length ? h('ol', { class: 'deliveries' }, s.recent.map((r) => deliveryLine({ ...r, subscription: s.id }))) : h('div', { class: 'muted sub-none' }, 'No deliveries yet.'));
}

function sseBody(s) {
  const sse = s.sse ?? {};
  const c = sse.simulated;
  return h('div', { class: 'sub-body' },
    h('div', { class: 'sub-stats' },
      stat(sse.seq ?? 0, 'frames sent', 'event'),
      stat(sse.buffered ?? 0, 'buffered', 'muted'),
      c ? stat(c.received, 'client read', 'ok') : null),
    h('div', { class: 'muted sub-none' }, sseNote(sse)));
}

function sseNote(sse) {
  const c = sse.simulated;
  if (!c) return 'No simulated client: frames wait in the 15-minute buffer (§8.4).';
  if (!c.connected) return `Client away since frame ${c.lastSeq ?? 0}; ${Math.max(0, (sse.seq ?? 0) - (c.lastSeq ?? 0))} waiting in the buffer.`;
  const caught = c.caughtUp ? `; caught up ${c.caughtUp} frame${c.caughtUp === 1 ? '' : 's'} on reconnect` : '';
  return `Client at Last-Event-ID ${c.lastSeq ?? '–'}${caught}.`;
}

function stat(value, label, tone) {
  return h('div', { class: `sub-stat t-${tone}` }, h('b', {}, String(value)), h('span', {}, label));
}

function deliveryLine(r) {
  return h('li', { class: `delivery dl-${r.status}` },
    h('span', { class: `ev-type d-${domainOf(r.type ?? '')}`, title: r.type ?? r.eventId }, r.type ? shortType(r.type) : short(r.eventId)),
    h('span', { class: 'attempts', 'aria-label': `${r.attempts} attempt${r.attempts === 1 ? '' : 's'}` }, r.history.map((a, i) => attemptChip(a, i, isNew(`${r.subscription}:${r.eventId}:${i}`)))),
    h('span', { class: `dl-status s-${r.status}` }, STATUS_LABELS[r.status] ?? r.status),
    h('span', { class: 'mono next', 'data-next': r.nextAttemptAt ?? '', 'data-attempt': String(r.attempts + 1) }, countdown(r.nextAttemptAt, r.attempts + 1)));
}

function attemptChip(a, i, fresh) {
  const ok = a.code >= 200 && a.code < 300;
  return h('span', { class: `attempt ${ok ? 'ok' : 'bad'} ${fresh ? 'fresh' : ''}`, title: `Attempt ${i + 1} at ${a.time.slice(11, 19)}: ${a.code || 'no answer'}` }, `#${i + 1} ${a.code || '—'}`);
}

/** "retry #3 in 1:42", from the simulated clock. */
function countdown(at, n) {
  if (!at) return '';
  const now = Date.parse(state.status?.clock?.now ?? data?.now ?? at);
  const left = Math.max(0, Math.round((Date.parse(at) - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return left ? `retry #${n} in ${mm >= 60 ? `${Math.floor(mm / 60)}h ${String(mm % 60).padStart(2, '0')}m` : `${mm}:${ss}`}` : `retry #${n} due`;
}

function tickCountdowns() {
  if (!rootEl) return;
  for (const el of rootEl.querySelectorAll('.next[data-next]')) {
    if (el.dataset.next) el.textContent = countdown(el.dataset.next, el.dataset.attempt);
  }
}

// ---------- small helpers ----------

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function short(id = '') {
  const m = /^([0-9a-f]{2})000000-0000-4000-8000-00000000([0-9a-f]{4})$/.exec(id);
  return m ? `${m[1]}…${m[2]}` : id.slice(0, 8);
}
