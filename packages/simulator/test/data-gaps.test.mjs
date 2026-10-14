/**
 * Data-module gaps closed: §14.2b plate lookup through a CredentialRecord,
 * priced native quotes (Part 14 §14.1 step 1), and the §5.5a occupancy
 * history with the §5.5 threshold alert.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';
import { priceTable, offsetMs } from '../src/domains/data/pricing.mjs';
import { HISTORY_CAP } from '../src/domains/data/occupancy.mjs';

const LAKESIDE = 'b1000000-0000-4000-8000-000000000001';
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const req = (sim, method, path, opts = {}) => sim.request(method, path, { token: 'default', ...opts });
const inject = (sim, args) => sim.injectors.get('occupancy')(args);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);

describe('§14.2b: credential_id resolves through the CredentialRecord', () => {
  test('a permit issued for a plate is found by the stock APDS plate query', async () => {
    const sim = new Simulator({ world: 'apx-permits' });
    sim.clock.set('2026-09-24T14:05:00Z');
    const issued = await req(sim, 'POST', '/v1/permits/issue', {
      headers: { 'idempotency-key': 'gap-prm-10' },
      body: {
        rightSpecification: { id: 'e1000000-0000-4000-8000-000000000010', version: 3, className: 'RightSpecification' },
        holder: { id: 'c1000000-0000-4000-8000-000000000202', className: 'RightHolder' },
        credentials: [{ credentialType: 'licensePlate', credentialIdentification: 'MBL-7710' }],
        validity: { start: '2026-10-01T00:00:00Z', end: '2027-09-30T23:59:59Z' },
      },
    });
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    const right = await req(sim, 'GET', `/rights/assigned/${issued.body.id ?? issued.body.assignedRight?.id ?? issued.body.data?.[0]}`);
    const vehicle = (right.body.rightHolder?.credentials ?? []).find((c) => c.credentialAssignedType === 'vehicle');
    assert.equal(vehicle?.identifier?.className, 'CredentialRecord', 'the plate is held via a CredentialRecord reference');

    const found = await req(sim, 'GET', '/rights/assigned?credential_type=licensePlate&credential_id=MBL-7710');
    assert.equal(found.status, 200);
    assert.equal(found.body.meta.total, 1);
    assert.equal(found.body.data[0].id, right.body.id);
    noContractIssue(found);

    const other = await req(sim, 'GET', '/rights/assigned?credential_type=licensePlate&credential_id=NOT-A-PLATE');
    assert.equal(other.body.meta.total, 0);
  });
});

describe('priced quotes (§14.1 step 1)', () => {
  const deck = (lines, extra = {}) => ({
    rateLineCollections: [{ collectionSequence: 1, applicableCurrency: 'USD', resetTime: '00:00', validStart: '2026-01-01T00:00:00Z', relativeTimes: true, taxIncluded: true, rateLines: lines, ...extra }],
  });

  test('priceTable: hourly increments, a daily-maximum cap, fees excluded, tiers by offset', () => {
    const hourly = deck([
      { sequence: 1, rateLineType: 'incrementingRate', incrementPeriod: 'PT1H', value: 3 },
      { sequence: 2, rateLineType: 'flatRate', value: 24, description: [{ language: 'en', string: 'daily maximum' }] },
      { sequence: 3, rateLineType: 'flatRate', value: 32, description: [{ language: 'en', string: 'lostTicketFee' }] },
    ]);
    assert.deepEqual(priceTable(hourly, '2026-09-25T18:00:00Z', '2026-09-25T20:30:00Z'), { currencyType: 'USD', currencyValue: 9, taxIncluded: true });
    assert.equal(priceTable(hourly, '2026-09-25T08:00:00Z', '2026-09-25T20:00:00Z').currencyValue, 24);
    assert.equal(priceTable(deck([{ sequence: 1, rateLineType: 'flatRate', value: 24 }]), '2026-09-25T18:00:00Z', '2026-09-25T23:00:00Z').currencyValue, 24);
    const tiers = deck([
      { sequence: 1, rateLineType: 'flatRateTier', durationStart: '00:00', durationEnd: '01:00', value: 5 },
      { sequence: 2, rateLineType: 'flatRateTier', durationStart: '01:00', durationEnd: '03:00', value: 10 },
    ]);
    assert.equal(priceTable(tiers, '2026-09-25T18:00:00Z', '2026-09-25T18:45:00Z').currencyValue, 5);
    assert.equal(priceTable(tiers, '2026-09-25T18:00:00Z', '2026-09-25T20:00:00Z').currencyValue, 15);
    assert.equal(priceTable(deck([{ sequence: 1, rateLineType: 'flatRate', value: 9 }], { validStart: '2027-01-01T00:00:00Z' }), '2026-09-25T18:00:00Z', '2026-09-25T19:00:00Z'), null);
    assert.equal(offsetMs('01:02:30'), (26 * 60 + 30) * 60_000);
  });

  test('POST /quotes answers RSV-01 with a USD 24.00 option expiring in thirty minutes', async () => {
    const sim = new Simulator({ world: 'apx-reservations' });
    sim.clock.set('2026-09-24T17:00:06Z');
    const res = await req(sim, 'POST', '/quotes', {
      body: {
        id: 'd2000000-0000-4000-8000-000000000401',
        version: 1,
        requestTime: '2026-09-24T17:00:05Z',
        periodStart: '2026-09-25T18:00:00Z',
        periodEnd: '2026-09-25T23:00:00Z',
        referencedRightSpecifications: [
          {
            elementId: { id: LAKESIDE, version: 3, className: 'Place' },
            rightSpecificationId: { id: 'e1000000-0000-4000-8000-000000000001', version: 1, className: 'RightSpecification' },
          },
        ],
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    const [quote] = res.body.data;
    assert.equal(quote.options.length, 1);
    const [option] = quote.options;
    assert.deepEqual(option.financialQuote.value, { currencyType: 'USD', currencyValue: 24 });
    assert.equal(option.financialQuote.taxIncluded, true);
    assert.equal(option.elementId.id, LAKESIDE);
    assert.deepEqual(option.quoteExpiration, { expiresDateTime: '2026-09-24T17:30:06Z', firstComeFirstServe: false });
  });

  test('a quote for an element no rate table prices carries no option, never a guess', async () => {
    const sim = new Simulator({ world: 'apx-permits' });
    const res = await req(sim, 'POST', '/quotes', {
      body: {
        id: 'd2000000-0000-4000-8000-000000000499',
        version: 1,
        requestTime: '2026-09-24T17:00:00Z',
        periodStart: '2026-09-25T18:00:00Z',
        periodEnd: '2026-09-25T19:00:00Z',
        referencedRightSpecifications: [{ elementId: { id: LAKESIDE, version: 3, className: 'Place' }, rightSpecificationId: { id: 'e1000000-0000-4000-8000-000000000010', version: 3, className: 'RightSpecification' } }],
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].options, undefined);
  });
});

describe('§5.5a occupancy history', () => {
  const history = (sim, query) => req(sim, 'GET', `/v1/places/${LAKESIDE}/occupancy/history?${query}`);

  test('hourly buckets: max, time-weighted mean, supply, samples; empty buckets carry no counts', async () => {
    const sim = new Simulator({ world: 'apx-data' });
    sim.clock.set('2026-09-25T13:00:00Z');
    inject(sim, { place: LAKESIDE, count: 100, recordDateTime: '2026-09-25T13:00:00Z' });
    inject(sim, { place: LAKESIDE, count: 200, recordDateTime: '2026-09-25T13:30:00Z' });
    sim.clock.set('2026-09-25T15:30:00Z');
    inject(sim, { place: LAKESIDE, count: 300, recordDateTime: '2026-09-25T15:00:00Z' });
    const res = await history(sim, 'from=2026-09-25T13:00:00Z&to=2026-09-25T16:00:00Z&interval=PT1H');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    const [h13, h14, h15] = res.body.buckets;
    assert.equal(res.body.buckets.length, 3);
    assert.equal(h13.start, '2026-09-25T13:00:00Z');
    assert.equal(h13.maxCount, 200);
    assert.equal(h13.avgCount, 150);
    assert.equal(h13.samples, 2);
    assert.equal(h13.supplyQuantity, 420);
    assert.deepEqual(h14, { start: '2026-09-25T14:00:00Z' });
    assert.equal(h15.avgCount, 300);
  });

  test('daily buckets align to local midnight in the place time zone (America/Chicago)', async () => {
    const sim = new Simulator({ world: 'apx-data' });
    sim.clock.set('2026-09-25T13:00:00Z');
    inject(sim, { place: LAKESIDE, count: 50 });
    const res = await history(sim, 'from=2026-09-25T12:00:00Z&to=2026-09-26T12:00:00Z&interval=P1D');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.buckets[0].start, '2026-09-25T05:00:00Z');
  });

  test('refusals: bad window, interval under a minute, and an element with no occupancy', async () => {
    const sim = new Simulator({ world: 'apx-reservations' });
    assert.equal(slugOf(await history(sim, 'from=2026-09-25T13:00:00Z&to=2026-09-25T12:00:00Z')), 'invalid-request');
    assert.equal(slugOf(await history(sim, 'from=2026-09-25T12:00:00Z&to=2026-09-25T13:00:00Z&interval=PT10S')), 'invalid-request');
    const none = await history(sim, 'from=2026-09-25T12:00:00Z&to=2026-09-25T13:00:00Z');
    assert.equal(none.status, 404);
    assert.equal(slugOf(none), 'target-not-found');
  });

  test('the history is bounded per element', async () => {
    const sim = new Simulator({ world: 'apx-reservations' });
    const start = Date.parse('2026-09-01T00:00:00Z');
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) inject(sim, { place: LAKESIDE, count: i % 400, recordDateTime: new Date(start + i * 300_000).toISOString() });
    sim.clock.set(new Date(start + (HISTORY_CAP + 5) * 300_000).toISOString());
    const res = await history(sim, `from=2026-09-01T00:00:00Z&to=${new Date(start + (HISTORY_CAP + 5) * 300_000).toISOString()}&interval=P1D`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.buckets.reduce((n, b) => n + (b.samples ?? 0), 0), HISTORY_CAP);
  });

  test('an upward threshold crossing raises occupancyThresholdExceeded (§5.5 SHOULD)', async () => {
    const sim = new Simulator({ world: 'apx-data' });
    const raised = [];
    sim.hooks.on('occupancy.threshold', (e) => raised.push(e));
    inject(sim, { place: LAKESIDE, count: 300 });
    inject(sim, { place: LAKESIDE, count: 380 });
    assert.equal(raised.length, 1);
    assert.equal(raised[0].threshold, 90);
    assert.equal(raised[0].place, LAKESIDE);
  });
});
