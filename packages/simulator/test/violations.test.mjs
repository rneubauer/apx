/**
 * apx-violations (Part 19), the behaviour adopted in 0.14.0: §19.6a
 * partial payments, the §19.4 rule 5/6 issuance gates, §19.13 imports
 * keyed on the source, the Session link, and the source lookups —
 * against the apx-violations world.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';

const LOT_C = 'b1000000-0000-4000-8000-000000000004';
const LOT_D_SESSION = 'f1000000-0000-4000-8000-000000000090';
const STAY = 'f1000000-0000-4000-8000-000000000071';
const ISSUED_35 = 'd3000000-0000-4000-8000-000000000032';
const LENIENT = 'd3000000-0000-4000-8000-000000000030';
const PENDING_READ = 'd3000000-0000-4000-8000-000000000035';
const REJECTED_READ = 'd3000000-0000-4000-8000-000000000036';
const SHADOW_ON_SESSION = 'd3000000-0000-4000-8000-000000000037';
const SOURCE = 'apds-ext:apx:violation-source@1.0';
const MATCH = 'apds-ext:apx:match-evidence@1.0';

let sim;
let key = 0;
const idem = () => ({ 'idempotency-key': `k-${++key}` });
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);
const call = (method, path, body, headers = {}) => sim.request(method, path, { body, headers, token: '…' });
const usd = (v) => ({ currencyType: 'USD', currencyValue: v });
const ref = (id, className) => ({ id, className });
const topics = (id) => sim.events.outbox.filter((e) => e.envelope.subject?.id === id).map((e) => e.envelope.type);

const pay = (id, payment, amount) => call('POST', `/v1/violations/${id}/payment`, { payment: ref(payment, 'PaymentRecord'), ...(amount === undefined ? {} : { amount: usd(amount) }) });
const issue = (id) => call('POST', `/v1/violations/${id}/issue`, { noticeKind: 'citation', amount: usd(35), deliveryMethod: 'windshield' });
const link = (id, body, version) => call('POST', `/v1/violations/${id}/session`, body, version === undefined ? {} : { 'if-match': `"${version}"` });

/** A ViolationImport for record `recordId` of example-enforcement; `over` replaces members, `src` the decoration's. */
const importBody = (recordId, { over = {}, src = {} } = {}) => ({
  violationType: 'noValidRight',
  violationStatus: 'issued',
  place: ref(LOT_C, 'Place'),
  detection: { mode: 'manual', detectedTime: '2026-10-01T14:05:00Z', principal: 'officer-0417' },
  vehicle: { credentialType: 'licensePlate', credentialIdentification: 'SYN-5520' },
  notice: { noticeKind: 'citation', noticeNumber: recordId, issuedTime: '2026-10-01T14:07:12Z' },
  amount: usd(40),
  statusHistory: [{ state: 'issued', time: '2026-10-01T14:07:12Z', actor: 'officer-0417' }],
  extensions: { [SOURCE]: { system: 'example-enforcement', recordId, sourceStatus: 'issued', sourceRevision: 1, ...src } },
  ...over,
});
const importOne = (body) => call('POST', '/v1/enforcement/violation-imports', body, idem());

beforeEach(() => {
  sim = new Simulator({ world: 'apx-violations' });
  sim.clock.set('2026-10-05T18:00:00Z');
});

describe('partial payment (§19.6a)', () => {
  test('a part payment stays issued, records the payment, and notes it in statusHistory', async () => {
    const res = await pay(ISSUED_35, 'd9000000-0000-4000-8000-000000000010', 20);
    assert.equal(res.status, 200);
    noContractIssue(res);
    assert.equal(res.body.violationStatus, 'issued');
    assert.equal(res.body.version, 3);
    assert.deepEqual(res.body.amountPaid, usd(20));
    assert.equal(res.body.payments.length, 1);
    assert.equal(res.body.payment, undefined);
    assert.equal(res.body.statusHistory.at(-1).state, 'issued');
    assert.match(res.body.statusHistory.at(-1).detail, /20\.00 of 35\.00; 15\.00 outstanding/);
    assert.deepEqual(topics(ISSUED_35), ['apx.violations.status.v1']);
  });

  test('a payment without amount settles the outstanding balance and becomes `payment`', async () => {
    await pay(ISSUED_35, 'd9000000-0000-4000-8000-000000000010', 20);
    const res = await pay(ISSUED_35, 'd9000000-0000-4000-8000-000000000011');
    assert.equal(res.body.violationStatus, 'paid');
    assert.deepEqual(res.body.amountPaid, usd(35));
    assert.deepEqual(res.body.payments.map((p) => p.amount.currencyValue), [20, 15]);
    assert.equal(res.body.payment.id, 'd9000000-0000-4000-8000-000000000011');
  });

  test('a full payment in one go is also recorded in payments[] and amountPaid', async () => {
    const res = await pay(ISSUED_35, 'd9000000-0000-4000-8000-000000000012');
    assert.equal(res.body.violationStatus, 'paid');
    assert.deepEqual(res.body.amountPaid, usd(35));
    assert.equal(res.body.payments.length, 1);
  });

  test('a refund on a dismissed pay-then-appeal reduces amountPaid', async () => {
    await pay(ISSUED_35, 'd9000000-0000-4000-8000-000000000012');
    await call('POST', `/v1/violations/${ISSUED_35}/appeals`, { reason: 'notTheVehicle' });
    const res = await call('POST', `/v1/violations/${ISSUED_35}/appeals/resolve`, { resolution: 'dismissed', refund: ref('d9000000-0000-4000-8000-0000000000aa', 'PaymentRecord') });
    assert.equal(res.body.violationStatus, 'closed');
    assert.deepEqual(res.body.amountPaid, usd(0));
  });

  test('a payment in another currency than the notice is 400', async () => {
    const res = await call('POST', `/v1/violations/${ISSUED_35}/payment`, { payment: ref('d9000000-0000-4000-8000-000000000013', 'PaymentRecord'), amount: { currencyType: 'EUR', currencyValue: 10 } });
    assert.equal(res.status, 400);
    assert.equal(slugOf(res), 'invalid-request');
  });
});

describe('issuance gates (§19.4 rules 5 and 6)', () => {
  test('lenient match evidence on the violation blocks issue even where policy permits unreviewed issuance', async () => {
    const res = await issue(LENIENT);
    assert.equal(res.status, 409);
    assert.equal(slugOf(res), 'violation-not-issuable');
    assert.match(res.body.detail, /lenient/);
  });

  test('a read in plate review (pending) or rejected blocks issue of a confirmed violation', async () => {
    const pending = await issue(PENDING_READ);
    assert.equal(slugOf(pending), 'violation-not-issuable');
    assert.match(pending.body.detail, /f2000000-0000-4000-8000-000000000072.*pending/);
    const rejected = await issue(REJECTED_READ);
    assert.equal(slugOf(rejected), 'violation-not-issuable');
    assert.match(rejected.body.detail, /rejected/);
  });

  test('a shadow match on the Session side (session-detail matches[]) blocks issue', async () => {
    const res = await issue(SHADOW_ON_SESSION);
    assert.equal(slugOf(res), 'violation-not-issuable');
    assert.match(res.body.detail, /session-detail/);
  });

  test('replacing the lenient evidence with an exact match lifts the block', async () => {
    const evidence = { target: ref(STAY, 'Session'), matchType: 'violation', plate: { method: 'exact' }, applied: true };
    const linked = await link(LENIENT, { session: ref(STAY, 'Session'), evidence }, 1);
    assert.equal(linked.status, 200);
    // Past the §19.4 gate, the Lot C policy's own rules apply: a mailed
    // camera notice needs an evidence image and a location, which d3…0030 lacks.
    const res = await call('POST', `/v1/violations/${LENIENT}/issue`, { noticeKind: 'notice', amount: usd(35), deliveryMethod: 'mail' });
    assert.equal(res.status, 422);
    assert.match(res.body.detail, /evidence image/);
  });
});

describe('imports (§19.13 rules 1–4)', () => {
  test('first import is 201 at the source state with source times, detected + issued events, no eligibility check', async () => {
    const res = await importOne(importBody('EX-1'));
    assert.equal(res.status, 201);
    noContractIssue(res);
    assert.equal(res.body.violationStatus, 'issued');
    assert.equal(res.body.eligibilityCheck, undefined);
    assert.equal(res.body.statusHistory[0].time, '2026-10-01T14:07:12Z');
    assert.equal(res.body.extensions[SOURCE].receivedTime, '2026-10-05T18:00:00Z');
    assert.deepEqual(topics(res.body.id), ['apx.violations.detected.v1', 'apx.violations.issued.v1']);
  });

  test('a higher revision updates in place; the same is a no-op; an older is 409', async () => {
    const first = (await importOne(importBody('EX-2'))).body;
    const rev3 = importBody('EX-2', {
      src: { sourceRevision: 3, sourceStatus: 'partiallyPaid' },
      over: {
        payments: [{ amount: usd(15), paidTime: '2026-10-04T09:12:00Z', reference: 'PMT-1' }],
        statusHistory: [
          { state: 'issued', time: '2026-10-01T14:07:12Z', actor: 'officer-0417' },
          { state: 'issued', time: '2026-10-04T09:12:00Z', actor: 'officer-0417', detail: 'part payment' },
        ],
      },
    });
    const updated = await importOne(rev3);
    assert.equal(updated.status, 200);
    assert.equal(updated.body.id, first.id);
    assert.equal(updated.body.version, 2);
    assert.deepEqual(updated.body.amountPaid, usd(15)); // summed from payments[]
    assert.equal(updated.body.statusHistory.length, 2); // appended, not rewritten
    const same = await importOne(rev3);
    assert.equal(same.status, 200);
    assert.equal(same.body.version, 2);
    const older = await importOne(importBody('EX-2', { src: { sourceRevision: 2 } }));
    assert.equal(older.status, 409);
    assert.equal(slugOf(older), 'version-conflict');
  });

  test('without sourceRevision, sourceUpdatedTime orders the revisions', async () => {
    const t = (iso) => importBody('EX-3', { src: { sourceRevision: undefined, sourceUpdatedTime: iso } });
    await importOne(t('2026-10-02T00:00:00Z'));
    assert.equal((await importOne(t('2026-10-03T00:00:00Z'))).body.version, 2);
    assert.equal(slugOf(await importOne(t('2026-10-01T00:00:00Z'))), 'version-conflict');
  });

  test('statusHistory is append-only: entries not later than the last held one are ignored', async () => {
    await importOne(importBody('EX-4'));
    const res = await importOne(importBody('EX-4', { src: { sourceRevision: 2 }, over: { statusHistory: [{ state: 'detected', time: '2026-10-01T14:05:00Z', actor: 'rewritten' }] } }));
    assert.deepEqual(res.body.statusHistory.map((e) => e.actor), ['officer-0417']);
  });

  test('refusals: no decoration 400, no notice at issued 400, paid below amount 422, foreign currency 422', async () => {
    const { extensions: _e, ...bare } = importBody('EX-5');
    assert.equal(slugOf(await importOne(bare)), 'invalid-request');
    const { notice: _n, ...noNotice } = importBody('EX-6');
    assert.equal(slugOf(await importOne(noNotice)), 'invalid-request');
    const partPaid = await importOne(importBody('EX-7', { over: { violationStatus: 'paid', amountPaid: usd(15) } }));
    assert.equal(partPaid.status, 422);
    assert.equal(slugOf(partPaid), 'request-unprocessable');
    const foreign = await importOne(importBody('EX-8', { over: { amountPaid: { currencyType: 'EUR', currencyValue: 5 } } }));
    assert.equal(slugOf(foreign), 'request-unprocessable');
    assert.equal(slugOf(await call('POST', '/v1/enforcement/violation-imports', importBody('EX-9'))), 'idempotency-key-required');
  });

  test('a warning with no fine is issued at zero and a fully paid import is accepted as paid', async () => {
    const warning = await importOne(importBody('EX-W1', { over: { amount: usd(0), notice: { noticeKind: 'warning', noticeNumber: 'EX-W1', issuedTime: '2026-10-01T14:07:12Z' } }, src: { sourceStatus: 'warned' } }));
    assert.equal(warning.status, 201);
    assert.equal(warning.body.notice.noticeKind, 'warning');
    assert.deepEqual(warning.body.amount, usd(0));
    assert.equal(warning.body.extensions[SOURCE].sourceStatus, 'warned');
    const paid = await importOne(importBody('EX-P1', { over: { violationStatus: 'paid', amountPaid: usd(40) } }));
    assert.equal(paid.status, 201);
    assert.equal(paid.body.violationStatus, 'paid');
  });

  test('sourceSystem and sourceRecordId filter the list and the search', async () => {
    await importOne(importBody('EX-10'));
    await importOne(importBody('EX-11'));
    const bySystem = await call('GET', '/v1/violations?sourceSystem=example-enforcement');
    assert.equal(bySystem.body.meta.total, 2);
    const byRecord = await call('GET', '/v1/violations?sourceRecordId=EX-11');
    assert.deepEqual(byRecord.body.data.map((v) => v.extensions[SOURCE].recordId), ['EX-11']);
    const searched = await call('POST', '/v1/violations:search', { sourceSystem: 'example-enforcement', sourceRecordId: 'EX-10' });
    assert.equal(searched.status, 200);
    noContractIssue(searched);
    assert.equal(searched.body.meta.total, 1);
    const none = await call('GET', '/v1/violations?sourceSystem=other-vendor');
    assert.equal(none.body.meta.total, 0);
  });
});

describe('the Session link (§19.13 rule 6)', () => {
  test('sets the link with evidence targeting the Session, bumps version, publishes status, no statusHistory entry', async () => {
    const before = (await call('GET', `/v1/violations/${ISSUED_35}`)).body;
    const evidence = { target: ref('ignored-by-server', 'Session'), matchType: 'violation', plate: { method: 'exact' }, applied: true };
    const res = await link(ISSUED_35, { session: ref(STAY, 'Session'), evidence, reason: 'lateMatch' }, before.version);
    assert.equal(res.status, 200);
    noContractIssue(res);
    assert.equal(res.body.version, before.version + 1);
    assert.equal(res.body.relatedSession.id, STAY);
    assert.equal(res.body.extensions[MATCH].target.id, STAY);
    assert.equal(res.body.statusHistory.length, before.statusHistory.length);
    assert.deepEqual(topics(ISSUED_35), ['apx.violations.status.v1']);
  });

  test('a repeat is a no-op (same version, no event); null clears the link and the evidence', async () => {
    const body = { session: ref(STAY, 'Session'), evidence: { target: ref(STAY, 'Session'), matchType: 'violation', applied: true } };
    const set = await link(ISSUED_35, body);
    const again = await link(ISSUED_35, body);
    assert.equal(again.body.version, set.body.version);
    assert.equal(topics(ISSUED_35).length, 1);
    const cleared = await link(ISSUED_35, { session: null, reason: 'mismatch' }, set.body.version);
    assert.equal(cleared.body.version, set.body.version + 1);
    assert.equal(cleared.body.relatedSession, undefined);
    assert.equal(cleared.body.extensions?.[MATCH], undefined);
  });

  test('a stale If-Match is 409 and writes nothing', async () => {
    const res = await link(ISSUED_35, { session: ref(STAY, 'Session') }, 1);
    assert.equal(res.status, 409);
    assert.equal(slugOf(res), 'version-conflict');
    assert.equal((await call('GET', `/v1/violations/${ISSUED_35}`)).body.relatedSession, undefined);
  });

  test('unknown Session is 422 reference-unknown; one at Lot D is 422 request-unprocessable', async () => {
    const unknown = await link(ISSUED_35, { session: ref('f1000000-0000-4000-8000-0000000000ff', 'Session') });
    assert.equal(unknown.status, 422);
    assert.equal(slugOf(unknown), 'reference-unknown');
    const elsewhere = await link(ISSUED_35, { session: ref(LOT_D_SESSION, 'Session') });
    assert.equal(elsewhere.status, 422);
    assert.equal(slugOf(elsewhere), 'request-unprocessable');
  });

  test('the link is accepted in a terminal state', async () => {
    const voided = await call('POST', `/v1/violations/${ISSUED_35}/void`, { reason: 'issuedInError' });
    assert.equal(voided.body.violationStatus, 'voided');
    const res = await link(ISSUED_35, { session: ref(STAY, 'Session') }, voided.body.version);
    assert.equal(res.status, 200);
    assert.equal(res.body.violationStatus, 'voided');
  });
});
