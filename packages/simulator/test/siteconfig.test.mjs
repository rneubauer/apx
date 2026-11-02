/**
 * apx-site-config (Part 26): equipment with its decorations and filters
 * (§26.1), comms points and their lookups, writes and feed (§26.4),
 * identifiers (§26.6), camera views and their refusals (§26.3), change
 * notices (§26.7), and the after-hours door through resolution (§26.8).
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GARAGE = id('b1', 1);
const HARBOR = id('b1', 2);
const LANE_2 = id('b2', 2);
const TERMINAL = id('c1', 3);
const LANE_CAMERA = id('c1', 7);
const DOOR = id('c1', 10);
const LOBBY_CAMERA = id('c1', 13);
const RAMP_CAMERA = id('c1', 14);
const HARBOR_CAMERA = id('c1', 97);
const DETAIL = 'apds-ext:apx:equipment-detail@1.0';
const CAMERA = 'apds-ext:apx:camera@1.0';
const ref = (i, className) => ({ id: i, className });

let sim;
const call = (method, path, body, { token = 'default', headers = {} } = {}) => sim.request(method, path, { body, token, headers });
const slug = (res) => (typeof res.body?.type === 'string' ? res.body.type.split('/').pop() : null);
const events = (type) => sim.events.outbox.filter((r) => r.envelope.type === type).map((r) => r.envelope);

beforeEach(() => {
  sim = new Simulator({ world: 'apx-site-config' });
  sim.clock.set('2026-10-18T09:00:00Z');
});

test('the equipment of a lane, with roles, make, model, versions, serial, MAC, and what controls what; never an address or a secret', async () => {
  const r = await call('GET', `/v1/equipment?place=${GARAGE}&lane=${LANE_2}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.map((e) => e.extensions[DETAIL].role), ['gate', 'exitVerifier', 'intercom', 'camera', 'laneDisplay']);
  const verifier = r.body.data[1];
  assert.equal(verifier.equipmentType, 'paymentMachine', 'the APDS type stays APDS');
  assert.deepEqual(verifier.extensions[DETAIL].controls, [ref(id('c1', 2), 'SupplementalEquipment')]);
  assert.equal(r.body.data[2].extensions[DETAIL].builtInto.id, TERMINAL);
  assert.equal(r.body.data[3].extensions[CAMERA].recorder.channel, '4');
  assert.doesNotMatch(JSON.stringify(r.body), /ipAddress|password|username|rtsp:\/\//i);
  assert.equal((await call('GET', `/v1/equipment?place=${GARAGE}&area=pedestrianEntrance`)).body.meta.total, 4);
  assert.equal((await call('GET', `/v1/equipment?place=${GARAGE}&role=payOnFoot`)).body.data[0].extensions[DETAIL].lane, undefined, 'place-level equipment has no lane');
  assert.equal((await call('GET', `/v1/equipment?place=${GARAGE}&role=camera`)).body.meta.total, 3);
  assert.equal(slug(await call('GET', `/v1/equipment?place=${HARBOR}`)), 'insufficient-grant');
  assert.equal((await call('GET', `/v1/equipment/${id('c1', 255)}`)).status, 404);
  assert.equal(slug(await call('GET', `/v1/equipment?place=${GARAGE}`, undefined, { token: '<apx.control:read>' })), 'insufficient-scope');
});

test('comms points resolve a call by caller id, dialed number or device id; a posted number names no lane', async () => {
  const byCaller = await call('GET', '/v1/comms-points?callerId=%2B15550100201');
  assert.equal(byCaller.body.data[0].lane.id, LANE_2);
  assert.equal(byCaller.body.data[0].serves.id, id('c1', 2));
  const posted = await call('GET', '/v1/comms-points?dialedNumber=%2B15550100042');
  assert.equal(posted.body.data[0].type, 'postedNumber');
  assert.equal(posted.body.data[0].lane, undefined);
  const door = await call('GET', '/v1/comms-points?commsDeviceId=dev-a0b1c2d3');
  assert.equal(door.body.data[0].serves.id, DOOR);
  assert.equal((await call('GET', '/v1/comms-points?callerId=%2B15550109999')).body.meta.total, 0);
  assert.doesNotMatch(JSON.stringify((await call('GET', `/v1/comms-points?place=${GARAGE}`)).body), /sip|realm/i);
});

test('the call platform creates, replaces (under If-Match) and removes a comms point; the feed carries the tombstone', async () => {
  const head = await call('GET', '/v1/comms-points?mode=change');
  assert.equal(head.body.updateMode, 'change');
  const cursor = head.body.cursor;
  const body = { id: id('cc', 'c04'), version: 1, type: 'analogDialer', place: ref(GARAGE, 'Place'), phoneNumber: '+15550100900', callerId: '+15550100233' };
  const created = await call('POST', '/v1/comms-points', body, { token: 'callplatform' });
  assert.equal(created.status, 201);
  assert.equal(created.body.recordInfo.creationUser, 'svc:callplatform');
  const stale = await call('PUT', `/v1/comms-points/${body.id}`, { ...body, callerId: '+15550100234' }, { token: 'callplatform', headers: { 'if-match': '"7"' } });
  assert.equal(slug(stale), 'version-conflict');
  const ok = await call('PUT', `/v1/comms-points/${body.id}`, { ...body, callerId: '+15550100234' }, { token: 'callplatform', headers: { 'if-match': '"1"' } });
  assert.equal(ok.body.version, 2);
  const gone = await call('DELETE', `/v1/comms-points/${body.id}`, undefined, { token: 'callplatform' });
  assert.equal(gone.status, 204);
  assert.equal(events('apx.commspoints.changed.v1').length, 3);
  const page = await call('GET', `/v1/comms-points?mode=change&cursor=${encodeURIComponent(cursor)}`);
  assert.equal(page.status, 200);
  assert.deepEqual(page.body.deleted.map((t) => t.id), [body.id]);
  // refusals
  assert.equal((await call('POST', '/v1/comms-points', { id: id('cc', 'c05'), version: 1, type: 'qrCode', place: ref(GARAGE, 'Place') }, { token: 'callplatform' })).status, 400);
  assert.equal(slug(await call('POST', '/v1/comms-points', body, { token: 'wall-lakeside' })), 'insufficient-scope');
  assert.equal(slug(await call('POST', '/v1/comms-points', { ...body, id: id('cc', 'c06'), place: ref(HARBOR, 'Place') }, { token: 'callplatform' })), 'insufficient-grant');
});

test('identifiers:resolve finds a place and a lane by another system\'s id, and 404s one nobody registered', async () => {
  const lot = await call('POST', '/v1/identifiers:resolve', { system: 'https://parcs.gatewise.example', id: 'LOT-0042' });
  assert.deepEqual(lot.body, { target: ref(GARAGE, 'Place'), className: 'Place', place: ref(GARAGE, 'Place') });
  const lane = await call('POST', '/v1/identifiers:resolve', { system: 'https://parcs.gatewise.example', id: '60601b08-3f1f-4b9c-9500-c9889e0d1a2b' });
  assert.equal(lane.body.target.id, LANE_2);
  assert.equal(lane.body.className, 'VehicularAccess');
  const device = await call('POST', '/v1/identifiers:resolve', { system: 'https://parcs.gatewise.example', id: 'DEV-X200-010884' });
  assert.equal(device.body.target.id, TERMINAL);
  assert.equal((await call('POST', '/v1/identifiers:resolve', { system: 'https://parcs.gatewise.example', id: 'LOT-9999' })).status, 404);
});

test('camera views: live, snapshot and playback links that live five minutes; outside retention, offline, no scope, wrong place', async () => {
  const req = (kind, extra = {}) => ({ kind, agent: 'agent:j.okafor', agentType: 'human', correlationId: 'ca000000-0000-4000-8000-000000000011', ...extra });
  const live = await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('live'));
  assert.equal(live.status, 201);
  assert.equal(live.body.protocol, 'webrtc');
  assert.equal(live.body.expiresAt, '2026-10-18T09:05:00Z');
  assert.equal(live.body.issuedTo, 'agent:j.okafor');
  assert.equal((await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('snapshot'))).body.protocol, 'snapshot');
  const play = await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('playback', { from: '2026-10-13T18:13:00Z', to: '2026-10-13T18:15:00Z' }));
  assert.equal(play.body.protocol, 'hls');
  assert.match(play.body.url, /index\.m3u8$/);
  assert.equal(slug(await call('POST', `/v1/cameras/${LOBBY_CAMERA}/views`, req('playback', { from: '2026-09-01T20:00:00Z', to: '2026-09-01T20:05:00Z' }))), 'playback-range-unavailable');
  assert.equal((await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('playback'))).status, 400);
  sim.injectors.get('deviceState')({ device: LANE_CAMERA, state: 'inoperative' }, sim);
  assert.equal(slug(await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('live'))), 'camera-view-unavailable');
  assert.equal(slug(await call('POST', `/v1/cameras/${LANE_CAMERA}/views`, req('snapshot'), { token: 'wall-lakeside' })), 'insufficient-scope');
  assert.equal(slug(await call('POST', `/v1/cameras/${HARBOR_CAMERA}/views`, req('live'))), 'insufficient-grant');
  assert.equal(slug(await call('POST', `/v1/cameras/${DOOR}/views`, req('live'))), 'request-unprocessable');
  assert.equal(sim.store.collection('cameraViews').all().length, 3, 'every view issued is logged');
  const legacy = await call('GET', `/v1/equipment/${RAMP_CAMERA}`);
  assert.equal(legacy.body.extensions[CAMERA].credentialRef, 'site-0042/cam-p2-ramp');
  assert.doesNotMatch(JSON.stringify(legacy.body), /password/i);
});

test('a swapped terminal arrives as apx.equipment.changed.v1 and through the change feed', async () => {
  const head = await call('GET', `/v1/equipment?place=${GARAGE}&mode=change`);
  sim.injectors.get('equipmentChanged')({ equipment: TERMINAL, detail: { firmwareVersion: '7.1.0', serialNumber: 'GWX200-011207' } }, sim);
  const ev = events('apx.equipment.changed.v1');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].data.extensions[DETAIL].firmwareVersion, '7.1.0');
  assert.equal(ev[0].data.version, 6);
  const page = await call('GET', `/v1/equipment?place=${GARAGE}&mode=change&cursor=${encodeURIComponent(head.body.cursor)}`);
  assert.deepEqual(page.body.data.map((e) => e.id), [TERMINAL]);
});

test('after hours at the lobby door: the comms point serves the door, the agent opens it with vendGate, an expired permit is gated', async () => {
  sim.clock.set('2026-10-18T23:31:00Z');
  const paid = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000031', channel: 'intercom', commsDeviceId: 'dev-a0b1c2d3', ticketNumber: 'T-61120' });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.issue.code, 'authorizedVisitor');
  assert.equal(paid.body.lane, undefined);
  const vend = paid.body.allowedActions.find((a) => a.action === 'vendGate');
  assert.deepEqual(vend.target, ref(DOOR, 'SupplementalEquipment'));
  assert.equal(vend.requiresApproval, false);
  const cmd = await call('POST', '/v1/commands', { commandType: 'vendGate', target: ref(DOOR, 'SupplementalEquipment'), resolutionContext: ref(paid.body.id, 'ResolutionContext'), reason: 'paid; after hours' }, { headers: { 'idempotency-key': 'door-1' } });
  assert.equal(cmd.status, 202);
  sim.clock.advance('PT5S');
  const done = await call('GET', `/v1/commands/${cmd.body.id}`);
  assert.equal(done.body.status, 'succeeded');
  assert.match(done.body.statusHistory.at(-1).detail, /door released/);
  sim.clock.set('2026-10-18T23:52:00Z');
  const expired = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000033', channel: 'intercom', commsDeviceId: 'dev-a0b1c2d3', credential: ref(id('c3', 3), 'Credential') });
  assert.equal(expired.body.issue.code, 'credentialDisabled');
  assert.equal(expired.body.accessDecision.reasonCode, 'permitExpired');
  const gated = expired.body.allowedActions.find((a) => a.action === 'vendGate');
  assert.equal(gated.requiresApproval, true);
  assert.equal(gated.approvalRole, 'supervisor');
  assert.equal(slug(await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000034', commsDeviceId: 'dev-00000000' })), 'comms-point-unknown');
});
