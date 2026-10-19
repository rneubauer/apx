// The mock vendor screen (Part 25): opened from a UiLaunch's single-use url,
// it shows what it was launched on, lets the presenter act as the agent would
// in the PARCS vendor's own console, and reports each action back through
// the real API under the vendor's client — POST /v1/ui/launches/{id}/actions
// and …/close — exactly as a vendor implementation must (§25.4).
//
// Opened as /ui/vendor.html?launch=<id>&u=<launch url>  (the nonce is the
// url's last segment; a real screen would receive it as the path or the
// fragment, never the query string). Consuming the url is the simulator's
// own affair (injector uiLaunchOpen), since the url belongs to the vendor,
// not to the standard.

const params = new URLSearchParams(location.search);
const launchId = params.get('launch');
const launchUrl = params.get('u') ?? '';
const nonce = launchUrl ? launchUrl.split('/').pop() : undefined;
const recorder = params.get('as') ?? 'gatewise-ui';

const $ = (id) => document.getElementById(id);
const log = (title, value) => {
  const el = $('log');
  const text = `${new Date().toISOString().slice(11, 19)}  ${title}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n\n`;
  el.textContent = el.textContent === '—' ? text : text + el.textContent;
};

let token = null;
let launch = null;

async function sim(method, path, body) {
  const res = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return res.json();
}

async function api(method, path, body) {
  if (!token) {
    const t = await sim('POST', '/sim/token', { credential: recorder });
    token = t.access_token;
  }
  const res = await fetch(path, { method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  return { status: res.status, body: json };
}

function render() {
  const kv = $('launch-kv');
  kv.innerHTML = '';
  if (!launch) return;
  const rows = [
    ['launch', launch.id],
    ['surface', launch.surface],
    ['subject', launch.subject ? `${launch.subject.className} ${launch.subject.id}` : '(general)'],
    ['place', launch.place?.id],
    ['agent', `${launch.agent} (${launch.agentType})`],
    ['correlationId', launch.correlationId],
    ['returnFields', (launch.returnFields ?? []).join(', ') || '(none asked)'],
    ['expires', launch.expiresAt],
    ['status', launch.status],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v ?? '';
    if (k === 'status') { dd.className = `state ${v}`; }
    kv.append(dt, dd);
  }
  $('who').textContent = `${launch.agent} · signed in by APX launch, no second login`;
  const over = launch.status === 'closed' || launch.status === 'expired';
  for (const b of document.querySelectorAll('.actions button')) b.disabled = over;
  $('intro').textContent = over ? `This launch is ${launch.status}. The host mints a new one for the next call.` : 'The url was consumed on open; a second open is refused by this screen (single use, §25.3).';
}

async function open() {
  if (!launchId) {
    $('intro').textContent = 'No launch named. Open this page from a UiLaunch (Present view: "Open the vendor screen").';
    return;
  }
  const r = await sim('POST', '/sim/inject', { kind: 'uiLaunchOpen', launch: launchId, ...(nonce ? { nonce } : {}) });
  if (r.ok === false) {
    log('open refused', r.error);
    $('intro').textContent = `The screen refused the url: ${r.error}`;
    // Show the record anyway, read through the sim's own state (the vendor side would hold it itself).
    const s = await sim('GET', `/sim/state/uiLaunches/${launchId}`);
    if (s && s.id) { launch = s; render(); }
    return;
  }
  launch = r.result;
  log('url consumed → launch opened', { id: launch.id, status: launch.status, openedAt: launch.openedAt });
  render();
}

async function act(btn) {
  const body = {
    action: btn.dataset.action,
    outcome: btn.dataset.outcome ?? 'completed',
    occurredAt: (await sim('GET', '/sim/clock')).now,
    agent: launch?.agent,
    summary: btn.dataset.summary,
    ...(btn.dataset.fields ? { fields: JSON.parse(btn.dataset.fields) } : {}),
    ...(btn.dataset.unavailable ? { unavailable: JSON.parse(btn.dataset.unavailable) } : {}),
  };
  const r = await api('POST', `/v1/ui/launches/${launchId}/actions`, body);
  log(`POST /v1/ui/launches/{id}/actions → ${r.status}`, r.body);
  if (r.status === 201) {
    const s = await sim('GET', `/sim/state/uiLaunches/${launchId}`);
    if (s && s.id) { launch = { ...launch, status: s.status, version: s.version }; render(); }
  }
}

async function close() {
  const r = await api('POST', `/v1/ui/launches/${launchId}/close`);
  log(`POST /v1/ui/launches/{id}/close → ${r.status}`, r.body);
  if (r.status === 200) { launch = r.body; render(); }
}

for (const b of document.querySelectorAll('.actions button[data-action]')) b.addEventListener('click', () => act(b));
$('close').addEventListener('click', close);
open();
