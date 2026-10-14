/**
 * apx-validations (Part 20 §20.3) with apx-control: a ticket validated
 * before the vehicle reaches the exit lane shows the redemption on the
 * lane's currentTicket.validations[], not only the reduced amount due.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const GARAGE = 'b1000000-0000-4000-8000-000000000001';
const EXIT_2 = 'b2000000-0000-4000-8000-000000000002';
const BISTRO = 'a2000000-0000-4000-8000-000000000077';

let sim;
const call = (method, path, body, { token = 'default', key } = {}) =>
  sim.request(method, path, { body, token, headers: key ? { 'idempotency-key': key } : {} });
const lane = async () => (await call('GET', `/v1/lanes/${EXIT_2}/current`, undefined, { token: 'console-lakeside' })).body;

beforeEach(async () => {
  sim = new Simulator({ world: 'apx-validations' });
  sim.clock.set('2026-09-24T19:30:00Z');
  const program = await call(
    'POST',
    '/v1/validations/programs',
    {
      place: { id: GARAGE, className: 'Place' },
      provider: { id: BISTRO, className: 'Organisation' },
      name: 'Harbor Bistro',
      validationType: 'twoHourComp',
      programStatus: 'active',
      benefit: { description: 'First two hours comped', duration: 'PT2H' },
      rules: { maxPerTicket: 1, stackable: false },
      billing: { model: 'merchantPays', unitPrice: { currencyType: 'USD', currencyValue: 4 }, billingCycle: 'monthly' },
      issuanceMethods: ['api'],
    },
    { key: 'enrol' }
  );
  assert.equal(program.status, 201, JSON.stringify(program.body));
  await call('POST', '/sim/inject', { kind: 'vehicleLeaves', lane: EXIT_2 });
  const redeemed = await call(
    'POST',
    '/v1/validations/redemptions',
    { program: { id: program.body.id, className: 'ValidationProgram' }, place: { id: GARAGE, className: 'Place' }, ticketNumber: 'T-1001', appliedTime: '2026-09-24T19:30:00Z', channel: 'merchantApp', appliedBy: 'hb-ipad-foh' },
    { token: 'harbor-bistro-ipad', key: 'redeem' }
  );
  assert.equal(redeemed.status, 201, JSON.stringify(redeemed.body));
});

test('a vehicle arriving after validation carries the redemption on the lane', async () => {
  const arrived = await call('POST', '/sim/inject', { kind: 'vehicleArrives', lane: EXIT_2, ticketNumber: 'T-1001' });
  assert.equal(arrived.status, 200, JSON.stringify(arrived.body));
  const { currentTicket } = await lane();
  assert.equal(currentTicket.ticketNumber, 'T-1001');
  assert.equal(currentTicket.amountDue.currencyValue, 3);
  assert.equal(currentTicket.validations.length, 1);
  assert.equal(currentTicket.validations[0].providerName, 'Harbor Bistro');
  assert.equal(currentTicket.validations[0].amountReduced.currencyValue, 6);
});

test('a ticket with no redemptions arrives with an empty validations list', async () => {
  await call('POST', '/sim/inject', { kind: 'vehicleArrives', lane: EXIT_2, ticketNumber: 'T-9999', amountDue: { currencyType: 'USD', currencyValue: 5 } });
  const { currentTicket } = await lane();
  assert.deepEqual(currentTicket.validations, []);
});
