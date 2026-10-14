/**
 * The body-form lookups of Part 13 (`POST /v1/accounts:search`,
 * `POST /v1/payments:search`), the Part 5 §5.2 rule 8 change feed on the
 * APX list routes (common.mjs installChangeFeeds), and a paid payment link
 * settling what the exit lane shows (Part 13 §13.1a, Part 17 §17.3).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { encodeToken } from '../src/kernel/auth.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';
import { APX_FEED_ROUTES } from '../src/domains/common.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const LAKESIDE = id('b1', 1);
const HARBOR = id('b1', 2);
const LAKESIDE_ORG = { id: id('a1', 1), className: 'Organisation' };
const HOLD = id('e8', 206); // approved, captureStatus authorized, T-61201

let sim;
const call = (method, path, body, token = '…', headers = {}) => sim.request(method, path, { body, headers, token });
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);
const tokenFor = (sub, scopes, places = [LAKESIDE]) => encodeToken({ sub, scopes, apx_places: places, apx_org: LAKESIDE_ORG });
const ids = (res) => res.body.data.map((r) => r.id);

/** Take the head cursor of a feed. */
async function head(path, token) {
  const res = await call('GET', `${path}${path.includes('?') ? '&' : '?'}mode=change`, undefined, token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  noContractIssue(res);
  return res.body.cursor;
}
const follow = (path, cursor, token) => call('GET', `${path}${path.includes('?') ? '&' : '?'}mode=change&cursor=${encodeURIComponent(cursor)}`, undefined, token);

describe('Part 13 body-form lookups', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-accounts' });
  });

  test('POST /v1/accounts:search answers exactly as GET /v1/accounts', async () => {
    const byGet = await call('GET', '/v1/accounts?phone=%2B15550104567');
    const byBody = await call('POST', '/v1/accounts:search', { phone: '+15550104567' });
    assert.equal(byBody.status, 200);
    noContractIssue(byBody);
    assert.deepEqual(byBody.body.data, byGet.body.data);
    assert.deepEqual(ids(byBody), [id('c2', 4)], 'the Harbor account is outside the grant');
  });

  test('accounts:search takes place as an array and narrows by it', async () => {
    const res = await call('POST', '/v1/accounts:search', { name: 'Smith', place: [LAKESIDE] });
    assert.equal(res.status, 200);
    assert.ok(ids(res).includes(id('c2', 4)));
  });

  test('a card number in accounts:search is 422 personal-data-not-permitted, digits not echoed', async () => {
    const res = await call('POST', '/v1/accounts:search', { card: '4111111111111111' });
    assert.equal(res.status, 422);
    assert.equal(slugOf(res), 'personal-data-not-permitted');
    assert.ok(!JSON.stringify(res.body).includes('4111111111111111'));
  });

  test('accounts:search refuses a body that fails the schema', async () => {
    const res = await call('POST', '/v1/accounts:search', { page: 0 });
    assert.equal(res.status, 400);
    assert.equal(slugOf(res), 'invalid-request');
  });

  test('accounts:search needs apx.accounts:read', async () => {
    const res = await call('POST', '/v1/accounts:search', { phone: '+15550104567' }, tokenFor('pay-only', ['apx.payments:write']));
    assert.equal(res.status, 403);
    assert.equal(slugOf(res), 'insufficient-scope');
  });

  test('POST /v1/payments:search answers as the GET and keeps the key rule', async () => {
    const byGet = await call('GET', '/v1/payments?ticketNumber=T-61040');
    const byBody = await call('POST', '/v1/payments:search', { ticketNumber: 'T-61040' });
    assert.equal(byBody.status, 200);
    noContractIssue(byBody);
    assert.deepEqual(byBody.body.data, byGet.body.data);
    assert.equal(byBody.body.data.length, 1);

    const keyless = await call('POST', '/v1/payments:search', { date: '2026-09-24', place: [LAKESIDE] });
    assert.equal(keyless.status, 400);
    assert.equal(slugOf(keyless), 'invalid-request');
  });

  test('payments:search keeps the hold rule: captureStatus=authorized returns only holds', async () => {
    const res = await call('POST', '/v1/payments:search', { ticketNumber: 'T-61201', captureStatus: 'authorized' });
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res), [HOLD]);
    const plain = await call('POST', '/v1/payments:search', { ticketNumber: 'T-61201' });
    assert.deepEqual(ids(plain), []);
  });

  test('a card number in payments:search cardLast4 is 422, not a schema 400', async () => {
    const res = await call('POST', '/v1/payments:search', { cardLast4: '4111111111111111' });
    assert.equal(res.status, 422);
    assert.equal(slugOf(res), 'personal-data-not-permitted');
  });
});

describe('Part 5 §5.2 rule 8 change feed on APX list routes', () => {
  test('the rule-8 table is read from the bundle: all 18 routes', () => {
    assert.equal(APX_FEED_ROUTES.size, 18);
    assert.equal(APX_FEED_ROUTES.get('get-apx-v1-violations'), 'Violation');
    assert.equal(APX_FEED_ROUTES.get('get-apx-v1-payments'), 'PaymentRecord');
  });

  describe('accounts', () => {
    beforeEach(() => {
      sim = new Simulator({ world: 'apx-accounts' });
    });

    test('without a cursor: an empty change page holding the head, no meta', async () => {
      const res = await call('GET', '/v1/accounts?mode=change');
      assert.equal(res.status, 200);
      noContractIssue(res);
      assert.equal(res.body.updateMode, 'change');
      assert.deepEqual(res.body.data, []);
      assert.equal(typeof res.body.cursor, 'string');
      assert.equal(res.body.meta, undefined);
      assert.equal(res.body.next, null);
    });

    test('mode=full (or absent) is the ordinary page and carries no updateMode', async () => {
      for (const path of ['/v1/accounts', '/v1/accounts?mode=full']) {
        const res = await call('GET', path);
        assert.equal(res.status, 200);
        assert.equal(res.body.updateMode, undefined);
        assert.ok(res.body.meta);
      }
    });

    test('an unknown mode is 400 invalid-request', async () => {
      const res = await call('GET', '/v1/accounts?mode=delta');
      assert.equal(res.status, 400);
      assert.equal(slugOf(res), 'invalid-request');
    });

    test('a changed account arrives whole after the cursor, once', async () => {
      const cursor = await head('/v1/accounts');
      sim.injectors.get('accountBalance')({ account: id('c2', 4), balance: 42 }, sim);
      const page = await follow('/v1/accounts', cursor);
      assert.equal(page.status, 200);
      noContractIssue(page);
      assert.deepEqual(ids(page), [id('c2', 4)]);
      assert.equal(page.body.data[0].balance.currencyValue, 42);
      assert.equal(page.body.data[0].name, 'J. Smith', 'items are whole, not change payloads');
      assert.notEqual(page.body.cursor, cursor);

      const after = await follow('/v1/accounts', page.body.cursor);
      assert.deepEqual(after.body.data, [], 'nothing new after the second cursor');
      assert.equal(after.body.cursor, page.body.cursor, 'the same position re-issues the same cursor');
    });

    test('replaying a cursor yields the same page (rule 1)', async () => {
      const cursor = await head('/v1/accounts');
      sim.injectors.get('accountBalance')({ account: id('c2', 5), balance: 7 }, sim);
      const first = await follow('/v1/accounts', cursor);
      const again = await follow('/v1/accounts', cursor);
      assert.deepEqual(again.body, first.body);
    });

    test('a change outside the grant never appears (rule 6)', async () => {
      const cursor = await head('/v1/accounts');
      sim.injectors.get('accountBalance')({ account: id('c2', 6), balance: 9 }, sim); // Harbor
      const page = await follow('/v1/accounts', cursor);
      assert.deepEqual(page.body.data, []);
    });

    test('an unknown cursor is 404 target-not-found, always a Problem', async () => {
      const res = await follow('/v1/accounts', 'account:99999');
      assert.equal(res.status, 404);
      assert.equal(slugOf(res), 'target-not-found');
      noContractIssue(res);
    });

    test('a cursor is scoped to its credential and its filter set (rule 5)', async () => {
      const cursor = await head('/v1/accounts');
      const other = await follow('/v1/accounts', cursor, tokenFor('another-client', ['apx.accounts:read']));
      assert.equal(other.status, 404);
      assert.equal(slugOf(other), 'target-not-found');
      const filtered = await follow('/v1/accounts?name=Smith', cursor);
      assert.equal(filtered.status, 404);
    });

    test('a cursor older than the 7-day window is 404 (rule 2)', async () => {
      const cursor = await head('/v1/accounts');
      sim.clock.advance('P8D');
      const res = await follow('/v1/accounts', cursor);
      assert.equal(res.status, 404);
      assert.equal(slugOf(res), 'target-not-found');
    });

    test('grant additions are signalled on the first page after the grant grows (rule 7)', async () => {
      const narrow = tokenFor('grow', ['apx.accounts:read'], [LAKESIDE]);
      const wide = tokenFor('grow', ['apx.accounts:read'], [LAKESIDE, HARBOR]);
      const cursor = await head('/v1/accounts', narrow);
      const page = await follow('/v1/accounts', cursor, wide);
      assert.equal(page.status, 200);
      assert.deepEqual(page.body.grantAdditions, [HARBOR]);
      noContractIssue(page);
    });
  });

  describe('payments (difference 6)', () => {
    beforeEach(() => {
      sim = new Simulator({ world: 'apx-accounts' });
    });

    test('mode=change needs no key, where the lookup does', async () => {
      const lookup = await call('GET', '/v1/payments');
      assert.equal(lookup.status, 400);
      const res = await call('GET', '/v1/payments?mode=change');
      assert.equal(res.status, 200);
      noContractIssue(res);
      assert.equal(res.body.updateMode, 'change');
    });

    test('ticketLast4 and cardLast4 are refused with mode=change', async () => {
      for (const q of ['ticketLast4=1201', 'cardLast4=8812']) {
        const res = await call('GET', `/v1/payments?${q}&mode=change`);
        assert.equal(res.status, 400, q);
        assert.equal(slugOf(res), 'invalid-request');
      }
    });

    test('a hold appears at capture, never before; a voided hold never appears', async () => {
      const cursor = await head('/v1/payments');
      const taken = await call(
        'POST',
        '/v1/payments',
        { place: { id: LAKESIDE, className: 'Place' }, ticketNumber: 'T-61303', amount: { currencyType: 'USD', currencyValue: 11 }, meansOfPayment: 'paymentCreditCard', captureLater: true },
        '…',
        { 'Idempotency-Key': 'feed-hold-1' }
      );
      assert.equal(taken.status, 201, JSON.stringify(taken.body));
      const quiet = await follow('/v1/payments', cursor);
      assert.deepEqual(quiet.body.data, [], 'an uncaptured hold is not in the feed');

      const voided = await call('POST', `/v1/payments/${taken.body.id}/void`, undefined, '…', { 'Idempotency-Key': 'feed-void-1' });
      assert.equal(voided.status, 200, JSON.stringify(voided.body));
      const still = await follow('/v1/payments', quiet.body.cursor);
      assert.deepEqual(still.body.data, [], 'a voided hold never appears');

      const captured = await call('POST', `/v1/payments/${HOLD}/capture`, undefined, '…', { 'Idempotency-Key': 'feed-capture-1' });
      assert.equal(captured.status, 200, JSON.stringify(captured.body));
      const page = await follow('/v1/payments', still.body.cursor);
      assert.deepEqual(ids(page), [HOLD]);
      assert.equal(page.body.data[0].captureStatus, 'captured');
      noContractIssue(page);
    });
  });

  describe('filtered feeds see a resource leave the view (difference 4)', () => {
    beforeEach(() => {
      sim = new Simulator({ world: 'apx-alerts' });
    });

    test('acknowledging a raised alert shows in the status=raised feed', async () => {
      const ALERT = id('e7', 799); // bound to Harbor, b1…0002
      const ops = tokenFor('ops', ['apx.alerts:read', 'apx.alerts:write'], [LAKESIDE, HARBOR]);
      const cursor = await head('/v1/alerts?status=raised', ops);
      const ack = await call('POST', `/v1/alerts/${ALERT}/acknowledge`, {}, ops, { 'Idempotency-Key': 'ack-1' });
      assert.ok(ack.status < 300, JSON.stringify(ack.body));
      const page = await follow('/v1/alerts?status=raised', cursor, ops);
      assert.equal(page.status, 200);
      noContractIssue(page);
      assert.deepEqual(ids(page), [ALERT]);
      assert.notEqual(page.body.data[0].status, 'raised');
      const after = await follow('/v1/alerts?status=raised', page.body.cursor, ops);
      assert.deepEqual(after.body.data, [], 'once out of the view it is not repeated');
    });
  });

  test('every implemented rule-8 route answers a head page that meets the contract', async () => {
    const worlds = { 'apx-control': ['/v1/commands'], 'apx-violations': ['/v1/violations', '/v1/enforcement/policies', '/v1/enforcement/signage'], 'apx-tolling': ['/v1/tolling/transactions'], 'apx-valet': ['/v1/valet/tickets'], 'apx-credentials': ['/v1/credentials', '/v1/access-events'] };
    for (const [world, paths] of Object.entries(worlds)) {
      sim = new Simulator({ world });
      for (const path of paths) {
        const res = await call('GET', `${path}?mode=change`);
        assert.ok([200, 403].includes(res.status), `${world} ${path}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
        if (res.status === 200) {
          noContractIssue(res);
          assert.equal(res.body.updateMode, 'change', path);
          assert.deepEqual(res.body.data, [], path);
        }
      }
    }
  });
});

describe('a paid payment link settles the exit lane (Part 13 §13.1a, Part 17)', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-resolution' });
  });

  test('the lane holding the lost-ticket session shows nothing owing once the link is paid', async () => {
    const LANE = id('b2', 2);
    const SESSION = id('c4', 34);
    sim.injectors.get('vehicleArrives')({ lane: LANE, session: SESSION, plate: 'SYN-7781' }, sim);
    const before = await call('GET', `/v1/lanes/${LANE}/current`);
    assert.equal(before.body.currentTicket.amountDue.currencyValue, 21);

    const link = await call('POST', '/v1/payment-links', { place: { id: LAKESIDE, className: 'Place' }, session: { id: SESSION, className: 'Session' }, channel: 'sms' }, '…', { 'Idempotency-Key': 'lane-link-1' });
    assert.equal(link.status, 201, JSON.stringify(link.body));
    sim.injectors.get('paymentLinkPaid')({ link: link.body.id, cardLast4: '7731' }, sim);

    const after = await call('GET', `/v1/lanes/${LANE}/current`);
    assert.equal(after.body.currentTicket.amountDue.currencyValue, 0);
    assert.equal(after.body.currentTicket.paidInFull, true);
  });

  test('every seeded session meets the bundle (identifiedCredentials and segments minItems)', async () => {
    const token = tokenFor('reader', ['apx.data:read']);
    for (const s of sim.store.collection('sessions').all()) {
      const res = await call('GET', `/sessions/${s.id}`, undefined, token);
      assert.equal(res.status, 200, s.id);
      noContractIssue(res);
    }
  });

  test('the entry read behind session c4…0034 is seeded', () => {
    const o = sim.store.collection('observations').get(id('f2', 31));
    assert.ok(o, 'observation f2…0031');
    assert.equal(o.observedCredentialId, 'SYN-7781');
  });
});
