/**
 * The field gaps of 2026-10: approval requests (Part 17 §17.3a), receipt
 * re-send and refund reasons (Part 13 §13.1a), device faults, supplies and
 * maintenance mode with the consumableLow alert (Part 6 §6.4, Part 7), the
 * new device commands (Part 6 §6.1), guest references and reservation
 * issuers (Part 17 §17.1, Part 14 §14.1a), and interaction outcomes.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`; // the suite's xx…NNNN shorthand, NNNN as written
const cid = (n) => `ca000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GARAGE = id('b1', 1);
const LANE_2 = id('b2', 2);
const TERMINAL = id('c1', 3);
const ref = (i, className) => ({ id: i, className });

let sim;
const call = (method, path, body, { token = 'default', headers = {} } = {}) => sim.request(method, path, { body, token, headers });
const slug = (res) => (typeof res.body?.type === 'string' ? res.body.type.split('/').pop() : null);
const events = (type) => sim.events.outbox.filter((r) => r.envelope.type === type).map((r) => r.envelope);

beforeEach(() => {
  sim = new Simulator({ world: 'apx-resolution' });
  sim.clock.set('2026-10-18T16:30:00Z');
});

test('an approval request is asked, listed, decided once, cited by the command, and lapses on the clock', async () => {
  // The create body carries id and version: ApxResourceCore requires them and the bundle does not mark them readOnly.
  const body = { id: id('ec', '201'), version: 1, place: ref(GARAGE, 'Place'), action: 'vendGate', target: ref(LANE_2, 'VehicularAccess'), requestedBy: 'agent:j.okafor', agentType: 'human', role: 'supervisor', correlationId: 'ca000000-0000-4000-8000-000000000201', reason: 'balance hold', expiresAt: '2026-10-18T16:40:00Z' };
  const r = await call('POST', '/v1/approvals', body, { headers: { 'idempotency-key': 'ap-1' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'pending');
  assert.equal(r.body.recordInfo.creationUser, 'agent:j.okafor');
  const pending = await call('GET', `/v1/approvals?place=${GARAGE}&status=pending&role=supervisor`);
  assert.deepEqual(pending.body.data.map((a) => a.id), [r.body.id]);
  const decided = await call('POST', `/v1/approvals/${r.body.id}/decide`, { outcome: 'approved', decidedBy: 'sup:m.reyes', note: 'ok' });
  assert.equal(decided.body.status, 'approved');
  assert.equal(decided.body.decision.decidedAt, '2026-10-18T16:30:00Z');
  assert.equal(slug(await call('POST', `/v1/approvals/${r.body.id}/decide`, { outcome: 'denied', decidedBy: 'sup:a.lund' })), 'approval-closed');
  assert.equal(events('apx.approvals.changed.v1').length, 2);
  // evidence citing a request that was not approved is refused; an approved one passes the gate
  const other = await call('POST', '/v1/approvals', { ...body, id: id('ec', '202'), correlationId: 'ca000000-0000-4000-8000-000000000202' });
  const refused = await call('POST', '/v1/commands', { commandType: 'vendGate', target: ref(LANE_2, 'VehicularAccess'), approval: { approvedBy: 'sup:m.reyes', approvalRequest: ref(other.body.id, 'ApprovalRequest') } }, { headers: { 'idempotency-key': 'v-1' } });
  assert.equal(slug(refused), 'approval-required');
  const ok = await call('POST', '/v1/commands', { commandType: 'vendGate', target: ref(LANE_2, 'VehicularAccess'), approval: { approvedBy: 'sup:m.reyes', approvalRequest: ref(r.body.id, 'ApprovalRequest') } }, { headers: { 'idempotency-key': 'v-2' } });
  assert.equal(ok.status, 202);
  sim.clock.set('2026-10-18T16:41:00Z');
  assert.equal((await call('GET', `/v1/approvals/${other.body.id}`)).body.status, 'expired');
  assert.equal((await call('GET', `/v1/approvals/${id('ec', 32)}`)).body.status, 'expired', 'the seeded request nobody decided');
  assert.equal((await call('GET', `/v1/approvals/${id('ec', 255)}`)).status, 404);
});

test('guest references and reservation issuers resolve; the summary says who sold it and what was paid', async () => {
  const guest = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000210', channel: 'intercom', lane: ref(LANE_2, 'VehicularAccess'), guestReference: { kind: 'hotelRoom', value: '412' } });
  assert.equal(guest.status, 201);
  assert.equal(guest.body.issue.code, 'authorizedVisitor');
  assert.equal(guest.body.issue.display, 'Hotel guest, room 412');
  assert.ok(guest.body.allowedActions.some((a) => a.action === 'applyValidation' && a.allowed));
  const sold = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000211', channel: 'intercom', lane: ref(LANE_2, 'VehicularAccess'), reservationCode: 'LKG-88214', reservationIssuer: 'parkahead' });
  assert.equal(sold.body.reservation.issuer, 'parkahead');
  assert.equal(sold.body.reservation.amountPaid.currencyValue, 18);
  // A qualifier nobody matches does not fail a context the lane already anchors (§17.1): it is simply not resolved.
  const wrongSeller = await call('POST', '/v1/resolution/contexts', { correlationId: cid(212), lane: ref(LANE_2, 'VehicularAccess'), reservationCode: 'LKG-88214', reservationIssuer: 'nobody' });
  assert.equal(wrongSeller.status, 201);
  assert.equal(wrongSeller.body.reservation, undefined);
  const noGuest = await call('POST', '/v1/resolution/contexts', { correlationId: cid(213), lane: ref(LANE_2, 'VehicularAccess'), guestReference: { kind: 'company', value: 'Acme' } });
  assert.equal(noGuest.status, 201);
  assert.notEqual(noGuest.body.issue.code, 'authorizedVisitor');
  assert.equal((await call('POST', '/v1/resolution/contexts', { correlationId: cid(215), guestReference: { kind: 'company', value: 'Acme' } })).status, 404, 'nothing anchors it: 404');
});

test('comms points resolve a context by caller id, dialed number and comms point reference', async () => {
  const byCaller = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-000000000029', channel: 'intercom', callerId: '+15550100201' });
  assert.equal(byCaller.status, 201);
  assert.equal(byCaller.body.lane.id, LANE_2);
  const posted = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-00000000002a', channel: 'voice', dialedNumber: '+15550100042' });
  assert.equal(posted.body.issue.code, 'generalInquiry');
  assert.equal(posted.body.lane, undefined);
  const byRef = await call('POST', '/v1/resolution/contexts', { correlationId: 'ca000000-0000-4000-8000-00000000002c', channel: 'intercom', commsPoint: ref(id('cc', 'c01'), 'CommsPoint') });
  assert.equal(byRef.body.lane.id, LANE_2);
  const none = await call('POST', '/v1/resolution/contexts', { correlationId: cid(214), channel: 'intercom', phoneNumber: '+15550100201' });
  assert.equal(none.status, 400);
  assert.match(none.body.detail, /commsPoint, callerId, dialedNumber or commsDeviceId/);
});

test('a support interaction records its outcome from apx-interaction-outcomes', async () => {
  const r = await call('POST', '/v1/support/interactions', { channel: 'intercom', agentType: 'human', agent: 'agent:j.okafor', startedAt: '2026-10-18T16:45:10Z', endedAt: '2026-10-18T16:45:25Z', place: ref(GARAGE, 'Place'), issue: { code: 'noResponse', display: 'No response from caller' }, summary: 'No answer after two prompts.', resolution: { code: 'abandoned', display: 'Caller did not respond' }, correlationId: 'ca000000-0000-4000-8000-000000000034' });
  assert.equal(r.status, 201);
  assert.equal(r.body.resolution.code, 'abandoned');
});

test('device faults, supplies and maintenance mode: DeviceStatus carries them, consumableLow is raised and resolved, ejectTicket clears a jam', async () => {
  sim.loadWorld('apx-control');
  sim.clock.set('2026-10-18T08:40:12Z');
  sim.injectors.get('deviceFault')({ device: TERMINAL, code: 'CARD_JAM', displayText: 'Card stuck in reader; eject or clear.' }, sim);
  sim.injectors.get('deviceConsumable')({ device: TERMINAL, kind: 'receiptPaper', level: 'low' }, sim);
  sim.injectors.get('deviceConsumable')({ device: TERMINAL, kind: 'coins', level: 'empty' }, sim);
  sim.injectors.get('deviceMaintenance')({ device: id('c1', 2), on: true }, sim);
  const status = await call('GET', `/v1/devices/${TERMINAL}`);
  assert.equal(status.body.deviceState, 'fault');
  assert.deepEqual(status.body.fault, { code: 'CARD_JAM', displayText: 'Card stuck in reader; eject or clear.', since: '2026-10-18T08:40:12Z' });
  assert.deepEqual(status.body.consumables.map((c) => `${c.kind}:${c.level}`).sort(), ['coins:empty', 'receiptPaper:low']);
  const barrier = await call('GET', `/v1/devices/${id('c1', 2)}`);
  assert.equal(barrier.body.maintenanceMode, true);
  assert.equal(barrier.body.deviceState, 'outOfService');
  const low = sim.store.collection('alerts').find((a) => a.alertType === 'consumableLow');
  assert.equal(low.length, 2);
  assert.equal(low.find((a) => a.severity === 'major').description[0].string, 'coins empty at pay station 3 (DeviceStatus.consumables)');
  sim.injectors.get('deviceConsumable')({ device: TERMINAL, kind: 'receiptPaper', level: 'ok' }, sim);
  assert.equal(sim.store.collection('alerts').find((a) => a.alertType === 'consumableLow' && a.status === 'resolved').length, 1);
  const eject = await call('POST', '/v1/commands', { commandType: 'ejectTicket', target: ref(TERMINAL, 'SupplementalEquipment'), agent: 'agent:j.okafor', agentType: 'human', reason: 'card jammed' }, { headers: { 'idempotency-key': 'e-1' } });
  assert.equal(eject.status, 202);
  sim.clock.advance('PT5S');
  const done = await call('GET', `/v1/commands/${eject.body.id}`);
  assert.equal(done.body.status, 'succeeded');
  assert.match(done.body.statusHistory.at(-1).detail, /CARD_JAM cleared/);
  assert.equal((await call('GET', `/v1/devices/${TERMINAL}`)).body.fault, undefined);
  for (const commandType of ['cancelTransaction', 'reprintReceipt']) {
    const c = await call('POST', '/v1/commands', { commandType, target: ref(TERMINAL, 'SupplementalEquipment'), reason: 'receipt for T-61077 did not print' }, { headers: { 'idempotency-key': `c-${commandType}` } });
    assert.equal(c.status, 202);
  }
  sim.clock.advance('PT5S');
  const reprint = sim.store.collection('commands').first((c) => c.commandType === 'reprintReceipt');
  assert.match(reprint.statusHistory.at(-1).detail, /receipt for T-61077 printed/);
});

test('a receipt is re-sent by e-mail, as a link, not by print at a site without a printer, never for a declined payment; a refund carries its reason code', async () => {
  sim.loadWorld('apx-accounts');
  sim.clock.set('2026-10-18T10:16:00Z');
  const paid = id('e8', '206');
  const email = await call('POST', `/v1/payments/${paid}/receipt`, { channel: 'email', destination: 'j.smith@example.com', agent: 'agent:j.okafor' }, { headers: { 'idempotency-key': 'r-1' } });
  assert.equal(email.status, 202);
  assert.deepEqual(email.body, { payment: ref(paid, 'PaymentRecord'), channel: 'email', status: 'queued', requestedAt: '2026-10-18T10:16:00Z' });
  const link = await call('POST', `/v1/payments/${paid}/receipt`, { channel: 'link', agent: 'agent:j.okafor' }, { headers: { 'idempotency-key': 'r-2' } });
  assert.equal(link.body.status, 'sent');
  assert.match(link.body.link, /^https:\/\/pay\.lakeside-garage\.example\/r\//);
  assert.equal(slug(await call('POST', `/v1/payments/${paid}/receipt`, { channel: 'print' }, { headers: { 'idempotency-key': 'r-3' } })), 'receipt-channel-unsupported');
  assert.equal((await call('POST', `/v1/payments/${paid}/receipt`, { channel: 'sms' }, { headers: { 'idempotency-key': 'r-4' } })).status, 400, 'sms needs a destination');
  assert.equal(slug(await call('POST', `/v1/payments/${id('e8', '215')}/receipt`, { channel: 'email', destination: 'x@example.com' }, { headers: { 'idempotency-key': 'r-5' } })), 'payment-state-illegal');
  const refund = await call('POST', `/v1/payments/${id('e8', '209')}/refund`, { amount: { currencyType: 'USD', currencyValue: 6 }, reasonCode: 'changeNotDispensed', reason: 'no change given', approval: { approvedBy: 'supervisor:m.okafor' } }, { headers: { 'idempotency-key': 'rf-1' } });
  assert.equal(refund.status, 200);
  assert.equal(refund.body.refundedAmount.currencyValue, 6);
  assert.equal(sim.store.collection('payments').get(id('e8', '209'))._refunds.at(-1).reasonCode, 'changeNotDispensed');
});
