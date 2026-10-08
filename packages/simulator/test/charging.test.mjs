/**
 * apx-charging (Part 23): lifecycle refusals, the §23.3 fusion rows, the
 * settlement modes, and the §23.6 customer minimization, against the
 * apx-charging world.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';
import { fuse } from '../src/domains/charging/points.mjs';

const E1 = 'b6000000-0000-4000-8000-000000000001';
const E2 = 'b6000000-0000-4000-8000-000000000002';
const P1 = 'b1000000-0000-4000-8000-000000000005';
const STAY = 'f1000000-0000-4000-8000-000000000777';
const BOUND = 'e2000000-0000-4000-8000-000000000042';

let sim;
let key = 0;
const idem = () => ({ 'idempotency-key': `k-${++key}` });
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);

const bridge = (method, path, body, headers = {}) => sim.request(method, path, { body, headers, token: 'bridge-lsg-01' });
const at = (iso) => sim.clock.set(iso);

const open = async ({ point = E1, connectorIndex = 1, settlement = { mode: 'directPayment' }, extra = {}, assign } = {}) => {
  const res = await bridge(
    'POST',
    '/v1/charging/sessions',
    { place: { id: P1, className: 'Place' }, chargingPoint: { id: point, className: 'ElectricChargingEquipment' }, connectorIndex, authorization: { method: 'rfid' }, settlement, ...extra },
    { ...idem(), ...(assign ? { 'x-sim-assign-id': assign } : {}) }
  );
  return res;
};
const event = (id, body) => bridge('POST', `/v1/charging/sessions/${id}/events`, body, idem());
const bay = (point, body) => sim.request('POST', `/v1/charging/points/${point}/bay`, { body, headers: idem(), token: 'camera-p1' });
const status = (point, connectors) => bridge('PUT', `/v1/charging/points/${point}/status`, { chargingPoint: { id: point, className: 'ElectricChargingEquipment' }, availability: connectors[0].availability, connectors });

beforeEach(() => {
  sim = new Simulator({ world: 'apx-charging' });
  at('2026-09-21T08:00:00Z');
});

describe('lifecycle refusals (§23.2)', () => {
  test('an event the transition table does not allow is 409 charging-transition-illegal', async () => {
    const s = (await open()).body;
    const res = await event(s.id, { eventType: 'chargingStarted', time: '2026-09-21T08:00:10Z' });
    assert.equal(res.status, 409);
    assert.equal(slugOf(res), 'charging-transition-illegal');
  });

  test('a meterValue before plug-in is illegal; after plug-in it updates energy without a transition', async () => {
    const s = (await open()).body;
    assert.equal(slugOf(await event(s.id, { eventType: 'meterValue', time: '2026-09-21T08:00:05Z', meterWh: 10 })), 'charging-transition-illegal');
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:00:10Z' });
    await event(s.id, { eventType: 'chargingStarted', time: '2026-09-21T08:00:20Z', meterWh: 1000 });
    const res = await event(s.id, { eventType: 'meterValue', time: '2026-09-21T08:10:00Z', meterWh: 2500, powerKw: 9 });
    assert.equal(res.status, 200);
    noContractIssue(res);
    assert.equal(res.body.chargingStatus, 'charging');
    assert.equal(res.body.energy.deliveredKwh, 1.5);
    assert.equal(res.body.statusHistory.length, 3);
  });

  test('an event older than the last one applied is refused (time order)', async () => {
    const s = (await open()).body;
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:05:00Z' });
    const res = await event(s.id, { eventType: 'chargingStarted', time: '2026-09-21T08:04:00Z' });
    assert.equal(slugOf(res), 'charging-transition-illegal');
  });

  test('cancelled from faulted is illegal once the vehicle was plugged in', async () => {
    const s = (await open()).body;
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:01:00Z' });
    await event(s.id, { eventType: 'fault', time: '2026-09-21T08:02:00Z', faultCode: 'GroundFailure' });
    assert.equal(slugOf(await event(s.id, { eventType: 'cancelled', time: '2026-09-21T08:03:00Z' })), 'charging-transition-illegal');
    const res = await event(s.id, { eventType: 'unplugged', time: '2026-09-21T08:04:00Z' });
    assert.equal(res.body.chargingStatus, 'unplugged');
  });

  test('opening on an out-of-order point is 409 charging-point-unavailable', async () => {
    await status(E2, [{ connectorIndex: 1, availability: 'outOfOrder' }]);
    const res = await open({ point: E2 });
    assert.equal(res.status, 409);
    assert.equal(slugOf(res), 'charging-point-unavailable');
  });

  test('opening on a connector already serving an active session is 409', async () => {
    assert.equal((await open()).status, 201);
    const res = await open();
    assert.equal(slugOf(res), 'charging-point-unavailable');
  });

  test('opening on a point reserved for another right is 409', async () => {
    await bridge('PUT', `/v1/charging/points/${E2}/status`, { chargingPoint: { id: E2, className: 'ElectricChargingEquipment' }, availability: 'reserved', connectors: [{ connectorIndex: 1, availability: 'reserved' }], reservedFor: { id: 'd1000000-0000-4000-8000-000000000001', className: 'AssignedRight' } });
    assert.equal(slugOf(await open({ point: E2 })), 'charging-point-unavailable');
    const ok = await open({ point: E2, extra: { assignedRight: { id: 'd1000000-0000-4000-8000-000000000001', className: 'AssignedRight' } } });
    assert.equal(ok.status, 201);
  });

  test('parkingSession mode without a parkingSession reference is 422', async () => {
    const res = await open({ settlement: { mode: 'parkingSession' } });
    assert.equal(res.status, 422);
    assert.equal(slugOf(res), 'request-unprocessable');
  });

  test('POST /v1/charging/sessions requires an Idempotency-Key', async () => {
    const res = await bridge('POST', '/v1/charging/sessions', { place: { id: P1, className: 'Place' }, chargingPoint: { id: E1, className: 'ElectricChargingEquipment' } });
    assert.equal(slugOf(res), 'idempotency-key-required');
  });
});

describe('server-side idle (§23.2 rule 2, §23.5)', () => {
  test('complete becomes idle after the grace and idle is billed per started minute', async () => {
    const s = (await open()).body;
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:00:00Z' });
    await event(s.id, { eventType: 'chargingStarted', time: '2026-09-21T08:00:00Z', meterWh: 0 });
    await event(s.id, { eventType: 'chargingEnded', time: '2026-09-21T09:00:00Z', meterWh: 10000, stopReason: 'evFull' });
    sim.clock.set('2026-09-21T09:09:59Z');
    assert.equal(sim.store.collection('chargingSessions').get(s.id).chargingStatus, 'complete');
    sim.clock.set('2026-09-21T09:10:00Z');
    assert.equal(sim.store.collection('chargingSessions').get(s.id).chargingStatus, 'idle');
    const idleEvents = sim.events.outbox.filter((e) => e.envelope.type === 'apx.charging.idle.started.v1');
    assert.equal(idleEvents.length, 1);
    sim.clock.set('2026-09-21T09:12:01Z');
    const read = await sim.request('GET', `/v1/charging/sessions/${s.id}`, { token: 'agent-console' });
    assert.equal(read.body.cost.idle.currencyValue, 1.2); // 2 min 1 s → 3 started minutes × $0.40
    const unplug = await event(s.id, { eventType: 'unplugged', time: '2026-09-21T09:12:49Z' });
    assert.equal(unplug.body.cost.idle.currencyValue, 1.2);
    assert.equal(unplug.body.cost.energy.currencyValue, 3.5);
  });
});

describe('settlement modes (§23.5)', () => {
  const unplugged = async (settlement) => {
    const s = (await open({ settlement })).body;
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:00:00Z' });
    return s;
  };

  test('directPayment: payment before unplugged is a conflict, after it closes the session', async () => {
    const s = await unplugged({ mode: 'directPayment' });
    const pay = { payment: { id: 'd9000000-0000-4000-8000-000000000001', className: 'PaymentRecord' } };
    assert.equal(slugOf(await bridge('POST', `/v1/charging/sessions/${s.id}/payment`, pay)), 'charging-settlement-conflict');
    await event(s.id, { eventType: 'unplugged', time: '2026-09-21T08:01:00Z' });
    const res = await bridge('POST', `/v1/charging/sessions/${s.id}/payment`, pay);
    assert.equal(res.status, 200);
    noContractIssue(res);
    assert.equal(res.body.chargingStatus, 'closed');
    assert.equal(res.body.settlement.payment.id, pay.payment.id);
    assert.equal(slugOf(await bridge('POST', `/v1/charging/sessions/${s.id}/payment`, pay)), 'charging-settlement-conflict');
  });

  test('parkingSession: payment is a conflict; settling the stay closes the charge', async () => {
    const opened = (await open({ point: E2, settlement: { mode: 'parkingSession' }, extra: { parkingSession: { id: STAY, className: 'Session' } } })).body;
    await event(opened.id, { eventType: 'pluggedIn', time: '2026-09-21T08:00:00Z' });
    await event(opened.id, { eventType: 'unplugged', time: '2026-09-21T08:02:00Z' });
    assert.equal(slugOf(await bridge('POST', `/v1/charging/sessions/${opened.id}/payment`, { payment: { id: 'd9000000-0000-4000-8000-000000000002', className: 'PaymentRecord' } })), 'charging-settlement-conflict');
    await sim.dispatch({ method: 'POST', path: '/sim/inject', headers: {}, body: JSON.stringify({ kind: 'parkingSessionSettled', session: STAY }) });
    assert.equal(sim.store.collection('chargingSessions').get(opened.id).chargingStatus, 'closed');
  });

  test('chargingNetwork: recording the CDR after unplugged closes it, without money', async () => {
    const s = await unplugged({ mode: 'chargingNetwork' });
    await event(s.id, { eventType: 'unplugged', time: '2026-09-21T08:01:00Z' });
    const res = await bridge('POST', `/v1/charging/sessions/${s.id}/payment`, { externalReference: 'CDR-77' });
    assert.equal(res.body.chargingStatus, 'closed');
    assert.equal(res.body.settlement.externalReference, 'CDR-77');
    assert.equal(res.body.cost, undefined);
  });
});

describe('§23.3 bay-presence fusion', () => {
  const conn = (availability) => [{ connectorIndex: 1, availability }];
  const rows = [
    ['nothing in bay, cable not connected', 'empty', 'available', 'empty', 'available'],
    ['nothing in bay, cable connected', 'empty', 'occupied', 'unknown', 'occupied'],
    ['vehicle, cable connected', 'vehicleNotPluggedIn', 'charging', 'vehiclePluggedIn', 'charging'],
    ['vehicle, cable not connected', 'vehicleNotPluggedIn', 'available', 'vehicleNotPluggedIn', 'blocked'],
    ['obstruction, cable not connected', 'blocked', 'available', 'blocked', 'blocked'],
    ['obstruction, cable connected (the cable wins)', 'blocked', 'occupied', 'blocked', 'occupied'],
    ['no report', null, 'occupied', 'unknown', 'occupied'],
    ['vehicle, not connected, but the point is out of order', 'vehicleNotPluggedIn', 'outOfOrder', 'vehicleNotPluggedIn', 'outOfOrder'],
  ];
  for (const [name, seen, connector, presence, availability] of rows) {
    test(`fuse: ${name}`, () => {
      const out = fuse(conn(connector), seen ? { presence: seen, source: 'overheadCamera' } : null);
      assert.equal(out.presence, presence);
      assert.equal(out.availability, availability);
    });
  }

  test('through the API: a vehicle without a cable blocks E2, a plug-in turns it vehiclePluggedIn', async () => {
    let res = await bay(E2, { presence: 'vehicleNotPluggedIn', source: 'overheadCamera', observedTime: '2026-09-21T08:00:00Z', vehicle: { evCapable: true } });
    noContractIssue(res);
    assert.equal(res.body.availability, 'blocked');
    assert.equal(res.body.bay.presence, 'vehicleNotPluggedIn');
    res = await status(E2, [{ connectorIndex: 1, availability: 'occupied' }]);
    assert.equal(res.body.availability, 'occupied');
    assert.equal(res.body.bay.presence, 'vehiclePluggedIn');
    assert.equal(res.body.bay.sinceTime, '2026-09-21T08:00:00Z');
  });

  test('the bridge cannot write bay: a bay member in PUT …/status is ignored', async () => {
    const res = await bridge('PUT', `/v1/charging/points/${E1}/status`, { chargingPoint: { id: E1, className: 'ElectricChargingEquipment' }, availability: 'available', connectors: conn('available'), bay: { presence: 'blocked' } });
    assert.equal(res.body.bay.presence, 'empty');
    assert.equal(res.body.availability, 'available');
  });

  test('PUT …/status with a body chargingPoint not matching the path is 400', async () => {
    const res = await bridge('PUT', `/v1/charging/points/${E1}/status`, { chargingPoint: { id: E2, className: 'ElectricChargingEquipment' }, availability: 'available' });
    assert.equal(res.status, 400);
    assert.equal(slugOf(res), 'invalid-request');
  });

  test('an ICE vehicle past the grace raises iceInEvSpace; an EV raises evBayNotCharging; an obstruction evBayBlocked', async () => {
    await bay(E2, { presence: 'vehicleNotPluggedIn', source: 'overheadCamera', observedTime: '2026-09-21T08:00:00Z', vehicle: { evCapable: false } });
    await bay(E1, { presence: 'vehicleNotPluggedIn', source: 'overheadCamera', observedTime: '2026-09-21T08:00:00Z', vehicle: { evCapable: true } });
    const types = () => sim.store.collection('alerts').all().map((a) => a.alertType).sort();
    assert.deepEqual(types(), []);
    sim.clock.set('2026-09-21T08:10:00Z');
    assert.deepEqual(types(), ['evBayNotCharging', 'iceInEvSpace']);
    await bay(E1, { presence: 'blocked', source: 'attendant', observedTime: '2026-09-21T08:11:00Z' });
    assert.ok(types().includes('evBayBlocked'));
    assert.equal(sim.store.collection('alerts').first((a) => a.alertType === 'evBayNotCharging').status, 'resolved');
  });

  test('evCharging counts for the occupancy snapshot', async () => {
    await bay(E2, { presence: 'blocked', source: 'attendant' });
    assert.deepEqual(sim.charging.evCharging(P1), { pointsTotal: 2, available: 1, charging: 0, occupiedNotCharging: 0, blocked: 1, inoperative: 0 });
  });
});

describe('§23.6 customer scope', () => {
  test('the bound token reads its own session minimized, nothing else', async () => {
    await open({ assign: BOUND, extra: { vehicle: { credentialType: 'licensePlate', credentialIdentification: 'SYN-7734' }, network: { partyId: 'US-LSG' }, authorization: { method: 'rfid', contractId: 'US-LSG-C****4471', authorizedBy: 'bridge' } } });
    const other = (await open({ point: E2 })).body;
    const own = await sim.request('GET', `/v1/charging/sessions/${BOUND}`, { token: 'driver-pwa' });
    assert.equal(own.status, 200);
    noContractIssue(own);
    for (const k of ['network', 'statusHistory', 'parkingSession', 'space', 'evseId']) assert.equal(own.body[k], undefined, k);
    assert.equal(own.body.vehicle.credentialIdentification, undefined);
    assert.equal(own.body.authorization.contractId, undefined);
    assert.equal(own.body.authorization.authorizedBy, undefined);
    assert.ok(own.body.idlePolicy);
    const theirs = await sim.request('GET', `/v1/charging/sessions/${other.id}`, { token: 'driver-pwa' });
    assert.equal(theirs.status, 404);
    const pointsRead = await sim.request('GET', `/v1/charging/points?place=${P1}`, { token: 'driver-pwa' });
    assert.equal(pointsRead.status, 200);
    for (const p of pointsRead.body.data) {
      assert.equal(p.currentSession, undefined);
      assert.equal(p.bay.vehicle, undefined);
      assert.equal(p.bay.imageLink, undefined);
      assert.equal(p.bay.observation, undefined);
      for (const c of p.connectors) assert.equal(c.currentSession, undefined);
    }
  });
});

describe('Part 6 charger commands (§23.9)', () => {
  test('stopCharging ends the charge with stopReason remote; the command succeeds', async () => {
    const s = (await open()).body;
    await event(s.id, { eventType: 'pluggedIn', time: '2026-09-21T08:00:00Z' });
    await event(s.id, { eventType: 'chargingStarted', time: '2026-09-21T08:00:00Z', meterWh: 0 });
    const cmd = await sim.request('POST', '/v1/commands', { token: 'agent-console', headers: idem(), body: { commandType: 'stopCharging', target: { id: E1, className: 'ElectricChargingEquipment' }, parameters: { connectorIndex: 1, chargingSession: { id: s.id, className: 'ChargingSession' } } } });
    assert.equal(cmd.status, 202);
    sim.clock.advance('5s');
    const after = sim.store.collection('chargingSessions').get(s.id);
    assert.equal(after.chargingStatus, 'complete');
    assert.equal(after.stopReason, 'remote');
    assert.equal(sim.store.collection('commands').get(cmd.body.id).status, 'succeeded');
  });

  test('startCharging on a session that is not plugged in fails the command', async () => {
    const s = (await open()).body;
    const cmd = await sim.request('POST', '/v1/commands', { token: 'agent-console', headers: idem(), body: { commandType: 'startCharging', target: { id: E1, className: 'ElectricChargingEquipment' }, parameters: { connectorIndex: 1, chargingSession: { id: s.id, className: 'ChargingSession' } } } });
    sim.clock.advance('5s');
    assert.equal(sim.store.collection('commands').get(cmd.body.id).status, 'failed');
  });
});
