/**
 * apx-ui-launch (Part 25): the handshake launch with its single-use url
 * (§25.2), the lifecycle on the clock (§25.3), the loopback — a native
 * Command carrying the launch's correlationId, else a UiActionRecord with
 * the requested fields (§25.4) — the Part 17 link (§25.5), the refusals,
 * and the scopes (§25.6).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GARAGE = id('b1', 1);
const HARBOR = id('b1', 2);
const LANE_2 = id('b2', 2);
const ref = (i, className) => ({ id: i, className });
const launchBody = (extra = {}) => ({
  surface: 'lane.console',
  subject: ref(LANE_2, 'VehicularAccess'),
  place: ref(GARAGE, 'Place'),
  lane: ref(LANE_2, 'VehicularAccess'),
  agent: 'agent:j.okafor',
  agentType: 'human',
  correlationId: 'ca000000-0000-4000-8000-000000000101',
  displayMode: 'popup',
  returnFields: ['/ticketNumber', '/amountDue'],
  ...extra,
});

let sim;
const call = (method, path, body, { token = 'default', headers = {} } = {}) => sim.request(method, path, { body, token, headers });
const slug = (res) => (typeof res.body?.type === 'string' ? res.body.type.split('/').pop() : null);
const events = (type) => sim.events.outbox.filter((r) => r.envelope.type === type).map((r) => r.envelope);

beforeEach(() => {
  sim = new Simulator({ world: 'apx-ui-launch' });
  sim.clock.set('2026-10-18T14:00:00Z');
});

test('a handshake launch mints a single-use url that lives 60 seconds and is idempotent on retry', async () => {
  const r = await call('POST', '/v1/ui/launches', launchBody(), { headers: { 'idempotency-key': 'k1' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'issued');
  assert.match(r.body.url, /^https:\/\/ui\.gatewise\.example\/launch\//);
  assert.equal(r.body.expiresAt, '2026-10-18T14:01:00Z');
  assert.equal(r.body.recordInfo.creationUser, 'agent:j.okafor');
  const again = await call('POST', '/v1/ui/launches', launchBody(), { headers: { 'idempotency-key': 'k1' } });
  assert.equal(again.status, 200);
  assert.equal(again.body.id, r.body.id);
  // expiresIn may shorten the 60 s but never lengthen it (§25.2): the schema refuses more, the server honours less
  assert.equal((await call('POST', '/v1/ui/launches', launchBody({ expiresIn: 600 }))).status, 400);
  const short = await call('POST', '/v1/ui/launches', launchBody({ expiresIn: 30 }));
  assert.equal(short.body.expiresAt, '2026-10-18T14:00:30Z');
});

test('a launch nobody opens expires on the clock; the url is single-use', async () => {
  const { body: l } = await call('POST', '/v1/ui/launches', launchBody());
  sim.clock.advance('PT61S');
  const r = await call('GET', `/v1/ui/launches/${l.id}`);
  assert.equal(r.body.status, 'expired');
  assert.ok(events('apx.ui.launch.changed.v1').some((e) => e.data.id === l.id && e.data.status === 'expired'));
  const act = await call('POST', `/v1/ui/launches/${l.id}/actions`, { action: 'vendGate', outcome: 'completed', occurredAt: sim.clock.now(), summary: 'late' }, { token: 'gatewise-ui' });
  assert.equal(act.status, 409);
  assert.equal(slug(act), 'ui-launch-expired');
  const { body: l2 } = await call('POST', '/v1/ui/launches', launchBody());
  const opened = await sim.injectors.get('uiLaunchOpen')({ launch: l2.id, nonce: l2.url.split('/').pop() }, sim);
  assert.equal(opened.status, 'opened');
  await assert.rejects(() => sim.injectors.get('uiLaunchOpen')({ launch: l2.id }, sim), /single-use/);
  await assert.rejects(() => sim.injectors.get('uiLaunchOpen')({ launch: l.id }, sim), /expired/);
});

test('a native action recorded in the screen becomes the Command it would have been, with the fields filled from its result', async () => {
  const { body: l } = await call('POST', '/v1/ui/launches', launchBody());
  const act = await call('POST', `/v1/ui/launches/${l.id}/actions`, { action: 'lostTicket', outcome: 'completed', occurredAt: sim.clock.now(), summary: 'Lost ticket fee issued in the lane console.' }, { token: 'gatewise-ui' });
  assert.equal(act.status, 201);
  assert.equal(act.body.result.className, 'Command');
  const cmd = await call('GET', `/v1/commands/${act.body.result.id}`);
  assert.equal(cmd.body.commandType, 'lostTicket');
  assert.equal(cmd.body.correlationId, l.correlationId);
  assert.equal(cmd.body.agent, 'agent:j.okafor');
  sim.clock.advance('PT5S');
  const after = await call('GET', `/v1/ui/launches/${l.id}`);
  assert.equal(after.body.status, 'opened', 'an action on an issued launch opens it');
  assert.equal(after.body.actions.length, 1);
  assert.ok(after.body.actions[0].fields['/ticketNumber'].startsWith('T-LT-'));
  assert.equal(after.body.actions[0].fields['/amountDue'].currencyValue, 32);
  assert.equal(events('apx.ui.action.recorded.v1').length, 1);
  const closed = await call('POST', `/v1/ui/launches/${l.id}/close`, undefined, { token: 'gatewise-ui' });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.status, 'closed');
  assert.equal(closed.body.version, 4, 'issued, opened, action, closed');
  const again = await call('POST', `/v1/ui/launches/${l.id}/close`, undefined, { token: 'gatewise-ui' });
  assert.equal(slug(again), 'ui-launch-closed');
  const late = await call('POST', `/v1/ui/launches/${l.id}/actions`, { action: 'other', outcome: 'noAction', occurredAt: sim.clock.now(), summary: 'x' }, { token: 'gatewise-ui' });
  assert.equal(slug(late), 'ui-launch-closed');
});

test('an action the API cannot express stays a UiActionRecord with the fields it can supply and the ones it cannot (§25.4 rule 2)', async () => {
  const { body: l } = await call('POST', '/v1/ui/launches', launchBody({ surface: 'validation.redeem', subject: ref(id('c4', 99), 'Session'), displayMode: 'embed', returnFields: ['/validation/provider', '/validation/providerCode'] }));
  const act = await call('POST', `/v1/ui/launches/${l.id}/actions`, {
    action: 'applyValidation', outcome: 'completed', occurredAt: sim.clock.now(), summary: 'Cinema validation applied.',
    fields: { '/validation/provider': 'Lakeside Cinema' }, unavailable: [{ field: '/validation/providerCode', reason: 'notSupported' }],
  }, { token: 'gatewise-ui' });
  assert.equal(act.status, 201);
  assert.equal(act.body.result, undefined, 'applyValidation needs a provider the screen did not name: no native Command');
  assert.deepEqual(act.body.unavailable, [{ field: '/validation/providerCode', reason: 'notSupported' }]);
  assert.equal(act.body.correlationId, l.correlationId);
});

test('refusals: unknown surface, unsupported display mode, unknown subject, missing agent', async () => {
  assert.equal(slug(await call('POST', '/v1/ui/launches', launchBody({ surface: 'toll.dispute' }))), 'ui-surface-unknown');
  assert.equal(slug(await call('POST', '/v1/ui/launches', launchBody({ surface: 'session.detail', subject: ref(id('c4', 99), 'Session'), displayMode: 'embed' }))), 'ui-display-mode-unsupported');
  assert.equal(slug(await call('POST', '/v1/ui/launches', launchBody({ surface: 'session.detail', subject: ref(id('c4', 255), 'Session') }))), 'reference-unknown');
  const bad = await call('POST', '/v1/ui/launches', { ...launchBody(), agent: undefined, agentType: undefined });
  assert.equal(bad.status, 400);
});

test('scopes and grants: launch, read and record are three scopes; another operator\'s place is refused', async () => {
  const wall = await call('POST', '/v1/ui/launches', launchBody(), { token: 'wall-lakeside' });
  assert.equal(slug(wall), 'insufficient-scope');
  const harbor = await call('POST', '/v1/ui/launches', launchBody({ place: ref(HARBOR, 'Place'), subject: ref(id('b2', 3), 'VehicularAccess'), lane: ref(id('b2', 3), 'VehicularAccess') }), { token: 'host-console' });
  assert.equal(slug(harbor), 'insufficient-grant');
  const { body: l } = await call('POST', '/v1/ui/launches', launchBody(), { token: 'host-console' });
  const host = await call('POST', `/v1/ui/launches/${l.id}/actions`, { action: 'other', outcome: 'noAction', occurredAt: sim.clock.now(), summary: 'x' }, { token: 'host-console' });
  assert.equal(slug(host), 'insufficient-scope');
  const screen = await call('GET', `/v1/ui/launches/${l.id}`, undefined, { token: 'gatewise-ui' });
  assert.equal(slug(screen), 'insufficient-scope');
  const text = JSON.stringify((await call('GET', `/v1/ui/launches/${l.id}`)).body);
  assert.doesNotMatch(text, /_nonce|secret|password/);
});

test('the list filters by place, agent, status and correlation id; seeded launches are on file', async () => {
  const closed = await call('GET', `/v1/ui/launches?place=${GARAGE}&agent=agent:j.okafor&status=closed`);
  assert.equal(closed.body.meta.total, 1);
  assert.equal(closed.body.data[0].actions[0].outcome, 'failed');
  const signed = await call('GET', '/v1/ui/launches?correlationId=ca000000-0000-4000-8000-000000000003');
  assert.equal(signed.body.data[0].url, undefined, 'a signed-token launch mints no url');
  assert.equal((await call('GET', `/v1/ui/launches/${id('ea', 255)}`)).status, 404);
});

test('Part 17 offers the screen when the API cannot do it (execution.type ui)', async () => {
  sim.injectors.get('vehicleArrives')({ lane: LANE_2, plate: 'KTY-4410', confidence: 0.96, credential: null }, sim);
  const ctx = await call('POST', '/v1/resolution/contexts', { lane: ref(LANE_2, 'VehicularAccess'), correlationId: 'ca000000-0000-4000-8000-000000000102', channel: 'intercom' });
  assert.equal(ctx.status, 201);
  assert.equal(ctx.body.issue.code, 'lostTicket');
  const ui = ctx.body.allowedActions.find((a) => a.action === 'lostTicket');
  assert.deepEqual(ui.execution, { type: 'ui', surface: 'lane.console', subject: ref(LANE_2, 'VehicularAccess') });
  assert.match(ui.display, /vendor console/);
});

test('discovery lists the surfaces for a client that may launch, and per-place capabilities', async () => {
  const d = await call('GET', '/v1/discovery');
  assert.equal(d.status, 200);
  assert.ok(d.body.uiSurfaces.some((s) => s.surface === 'lane.console' && s.launchModes.includes('signedToken')));
  const cap = d.body.placeCapabilities.find((p) => p.place === GARAGE);
  assert.ok(cap.uiSurfaces.includes('lane.console'));
  assert.ok(!cap.commandTypes.includes('lostTicket'), 'the site has no lostTicket through the API');
  const wall = await call('GET', '/v1/discovery', undefined, { token: 'wall-lakeside' });
  assert.deepEqual(wall.body.uiSurfaces, []);
});

test('the mock vendor screen is served under /ui/', async () => {
  const { serveUi } = await import('../src/kernel/ui.mjs');
  let status;
  let body = '';
  const res = { writeHead: (s) => { status = s; }, end: (b) => { body = String(b ?? ''); } };
  assert.equal(serveUi({ method: 'GET', url: '/ui/vendor.html' }, res), true);
  assert.equal(status, 200);
  assert.match(body, /Lane console/);
  assert.equal(serveUi({ method: 'GET', url: '/ui/js/vendor.js' }, res), true);
  assert.equal(status, 200);
});
