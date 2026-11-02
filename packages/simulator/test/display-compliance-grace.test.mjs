/**
 * The 0.16 additions: display records (Part 26 §26.9), the stay-compliance
 * decoration on native Sessions (Part 5 §5.9), and the stay grace on the
 * enforcement policy with the `graceUntil` it derives (Part 19 §19.10
 * rule 7, §19.3 rule 5).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (i, className) => ({ id: i, className });
const GARAGE = id('b1', 1);
const HARBOR = id('b1', 2);
const LOT_C = id('b1', 4);
const EXIT_SIGN = id('c1', 40);
const ENTRY_SIGN = id('c1', 41);
const BARRIER = id('c1', 2);
const READ = id('f3', 140);
const STAY = id('c4', 77);
const COMMAND = id('cb', 31);
const SC = 'apds-ext:apx:stay-compliance@1.0';
const PROBLEM = { accept: 'application/problem+json' };

let sim;
const call = (method, path, body, { token = 'default', headers = {} } = {}) => sim.request(method, path, { body, token, headers });
const slug = (res) => (typeof res.body?.type === 'string' ? res.body.type.split('/').pop() : null);
const events = (type) => sim.events.outbox.filter((r) => r.envelope.type === type).map((r) => r.envelope);

describe('display records (Part 26 §26.9)', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-site-config' });
    sim.clock.set('2026-10-21T14:03:13Z');
  });

  let n = 100;
  const unpaidExit = (extra = {}) => ({
    id: id('c5', ++n),
    version: 1,
    display: ref(EXIT_SIGN, 'SupplementalEquipment'),
    messageKind: 'transientExitUnpaid',
    observation: ref(READ, 'ObservationElement'),
    session: ref(STAY, 'Session'),
    shownTime: '2026-10-21T14:03:12Z',
    contentHash: 'sha256:9f2c1e0b7a4d',
    wordingVersion: 'exit-2026-10',
    acknowledgedBy: 'player',
    ...extra,
  });
  const record = (body, opts = {}) => call('POST', '/v1/display-records', body, { token: '<edge-controller>', ...opts });

  test('the edge records what the sign showed: place derived from the sign, one notice, an idempotent retry, no text and no plate', async () => {
    const key = { 'idempotency-key': 'sign-c1-0040-2026-10-21T14:03:12Z' };
    const body = unpaidExit();
    const first = await record(body, { headers: key });
    assert.equal(first.status, 201);
    assert.deepEqual(first.body.place, ref(GARAGE, 'Place'));
    assert.equal(first.body.recordInfo.creationUser, 'svc:edge-lakeside');
    const again = await record(body, { headers: key });
    assert.equal(again.status, 200);
    assert.equal(again.body.id, first.body.id);
    const shown = events('apx.displays.shown.v1');
    assert.equal(shown.length, 1);
    assert.deepEqual(shown[0].subject, ref(EXIT_SIGN, 'SupplementalEquipment'));
    assert.equal(shown[0].data.id, first.body.id);
    assert.doesNotMatch(JSON.stringify(first.body), /SYN-7720|message"/);
    assert.equal((await call('GET', `/v1/display-records/${first.body.id}`)).body.messageKind, 'transientExitUnpaid');
  });

  test('the list filters by place, sign, kind, stay, read and shownTime window, newest first', async () => {
    const mine = (await record(unpaidExit())).body.id;
    const list = async (qs) => (await call('GET', `/v1/display-records?${qs}`)).body;
    const all = await list(`place=${GARAGE}`);
    assert.equal(all.meta.total, 3, 'two seeded and the new one');
    assert.equal(all.data[0].id, mine, 'newest first');
    assert.deepEqual((await list(`display=${ENTRY_SIGN}`)).data.map((r) => r.messageKind), ['transientEntrance']);
    assert.equal((await list('messageKind=transientExitUnpaid')).meta.total, 1);
    assert.equal((await list(`session=${STAY}`)).meta.total, 2, 'the entrance welcome and the unpaid exit of the same stay');
    assert.equal((await list(`observation=${READ}`)).data[0].id, mine);
    assert.equal((await list('since=2026-10-21T14:00:00Z&until=2026-10-21T14:03:12Z')).data.map((r) => r.messageKind).join(), 'idle', 'since inclusive, until exclusive');
    assert.equal(slug(await call('GET', `/v1/display-records?place=${HARBOR}`)), 'insufficient-grant');
    assert.equal((await call('GET', `/v1/display-records/${id('c5', 999)}`)).status, 404);
  });

  test('the change feed carries a new record after the cursor', async () => {
    const head = await call('GET', '/v1/display-records?mode=change');
    assert.equal(head.body.updateMode, 'change');
    assert.deepEqual(head.body.data, []);
    const mine = (await record(unpaidExit())).body.id;
    const page = await call('GET', `/v1/display-records?mode=change&cursor=${encodeURIComponent(head.body.cursor)}`);
    assert.deepEqual(page.body.data.map((r) => r.id), [mine]);
  });

  test('refusals: not a sign, an unknown sign, a disagreeing place, a stay or read nobody holds, no scope', async () => {
    assert.equal(slug(await record(unpaidExit({ display: ref(BARRIER, 'SupplementalEquipment') }))), 'reference-unknown');
    assert.equal(slug(await record(unpaidExit({ display: ref(id('c1', 999), 'SupplementalEquipment') }))), 'reference-unknown');
    assert.equal(slug(await record(unpaidExit({ place: ref(HARBOR, 'Place') }))), 'request-unprocessable');
    assert.equal((await record(unpaidExit({ place: ref(GARAGE, 'Place') }))).status, 201, 'an agreeing place is fine');
    assert.equal(slug(await record(unpaidExit({ session: ref(id('c4', 999), 'Session') }))), 'reference-unknown');
    assert.equal(slug(await record(unpaidExit({ observation: ref(id('f3', 999), 'ObservationElement') }))), 'reference-unknown');
    assert.equal(slug(await record(unpaidExit(), { token: '<city-platform>' })), 'insufficient-scope');
    assert.equal(events('apx.displays.shown.v1').length, 1, 'only the agreeing record was written');
  });

  test('a record naming a displayMessage command agrees with its CommandResult.display', async () => {
    const commanded = (extra) => ({ id: id('c5', ++n), version: 1, display: ref(EXIT_SIGN, 'SupplementalEquipment'), messageKind: 'entranceRefused', command: ref(COMMAND, 'Command'), ...extra });
    assert.equal(slug(await record(commanded({ shownTime: '2026-10-21T14:20:00Z', contentHash: 'sha256:77d0c5e1f2a8' }))), 'request-unprocessable');
    assert.equal(slug(await record(commanded({ shownTime: '2026-10-21T14:20:05Z', contentHash: 'sha256:1b7e42aa90c3' }))), 'request-unprocessable');
    assert.equal((await record(commanded({ shownTime: '2026-10-21T14:20:05.000Z', contentHash: 'sha256:77d0c5e1f2a8' }))).status, 201);
    assert.equal(slug(await record(commanded({ command: ref(id('cb', 999), 'Command'), shownTime: '2026-10-21T14:20:05Z' }))), 'reference-unknown');
  });

  test('the simulated PARCS proves a displayMessage it ran, and a record naming it must agree', async () => {
    const message = { commandType: 'displayMessage', target: ref(EXIT_SIGN, 'SupplementalEquipment'), parameters: { message: [{ language: 'en', string: 'Please pay at the machine' }] } };
    const sent = await call('POST', '/v1/commands', message, { headers: { 'idempotency-key': 'console-display-1' } });
    assert.equal(sent.status, 202, JSON.stringify(sent.body));
    sim.clock.advance(5000);
    const done = await call('GET', `/v1/commands/${sent.body.id}`);
    assert.equal(done.body.status, 'succeeded');
    const shown = done.body.result.display;
    assert.match(shown.contentHash, /^sha256:[0-9a-f]{12}$/);
    const body = { id: id('c5', ++n), version: 1, display: ref(EXIT_SIGN, 'SupplementalEquipment'), messageKind: 'fallback', command: ref(sent.body.id, 'Command'), shownTime: shown.shownTime, contentHash: shown.contentHash };
    assert.equal((await record(body)).status, 201);
  });
});

describe('stay compliance on native Sessions (Part 5 §5.9)', () => {
  const VISIT = id('c4', 1);
  const POLICY = { id: id('d4', 2), className: 'EnforcementPolicy', version: 2 };

  beforeEach(() => {
    sim = new Simulator({ world: 'apx-data' });
    sim.clock.set('2026-09-25T09:00:00Z');
  });

  const score = (block, { token = '<compliance-engine>', mode = 'change', headers = {} } = {}) =>
    call('PUT', `/sessions/${VISIT}`, { id: VISIT, extensions: { [SC]: block } }, { token, headers: { 'apx-update-mode': mode, ...PROBLEM, ...headers } });
  const held = async (token = '<owner-bi>') => (await call('GET', `/sessions/${VISIT}`, undefined, { token })).body.extensions?.[SC];
  const evaluation = (extra) => ({ status: 'paidLate', family: 'other', flags: ['paidAfterExit'], evaluatedTime: '2026-09-25T08:30:00Z', sequence: 2, final: false, policy: POLICY, ...extra });

  /** Walk the city's Session feed from `cursor` to its head: every item and the cursor at the head. */
  const drain = async (cursor) => {
    const items = [];
    for (;;) {
      const page = (await call('GET', `/sessions?mode=change${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, undefined, { token: '<city-platform>' })).body;
      items.push(...page.items);
      cursor = page.cursor;
      if (!page.next) return { items, cursor };
    }
  };

  test('the engine re-scores the stay; only readers with apx.compliance:read see the block, on reads, lists and the feed', async () => {
    const { cursor } = await drain();
    assert.equal((await score(evaluation())).status, 200);
    assert.equal((await held()).status, 'paidLate');
    assert.equal(await held('<city-platform>'), undefined, 'the city sees the Session without the block');
    const city = await call('GET', `/sessions/${VISIT}`, undefined, { token: '<city-platform>' });
    assert.equal(city.body.actualEnd, '2026-09-24T18:14:34Z', 'the rest of the Session is unchanged');
    const listed = (token) => call('GET', '/sessions', undefined, { token }).then((r) => r.body.data.find((s) => s.id === VISIT));
    assert.equal((await listed('<owner-bi>')).extensions[SC].sequence, 2);
    assert.equal((await listed('<city-platform>')).extensions, undefined);
    const item = (await drain(cursor)).items.find((i) => i.id === VISIT);
    assert.ok(item, 'the change is in the feed');
    assert.equal(item.extensions?.[SC], undefined);
  });

  test('sequence orders the evaluations: lower is 409, equal replaces, final is never a lock', async () => {
    await score(evaluation({ final: true }));
    const late = await score(evaluation({ status: 'lateStart', family: 'violation', flags: undefined, sequence: 1 }));
    assert.equal(late.status, 409);
    assert.equal(slug(late), 'evaluation-out-of-order');
    assert.equal((await score(evaluation({ status: 'paid', family: 'compliant', flags: undefined }))).status, 200, 'an equal sequence replaces');
    assert.equal((await score(evaluation({ sequence: 3 }))).status, 200, 'final: true did not lock the Session');
    assert.equal((await held()).sequence, 3);
  });

  test('the registry family, pendingStatus, the policy and the schema are checked; nothing is written on a refusal', async () => {
    const before = await held();
    assert.equal(slug(await score(evaluation({ status: 'overstay', family: 'compliant' }))), 'request-unprocessable');
    assert.equal(slug(await score(evaluation({ status: 'paid', family: 'compliant', pendingStatus: 'overstay' }))), 'request-unprocessable');
    assert.equal(slug(await score(evaluation({ policy: { ...POLICY, id: id('d4', 999) } }))), 'reference-unknown');
    assert.equal(slug(await score(evaluation({ policy: { ...POLICY, version: 7 } }))), 'reference-unknown', 'a version the policy never had');
    assert.equal(slug(await score(evaluation({ sequence: 0 }))), 'invalid-request');
    assert.deepEqual(await held(), before);
    assert.equal((await score(evaluation({ status: 'reviewRequired', family: 'withheld', pendingStatus: 'overstay' }))).status, 200);
    assert.equal((await score(evaluation({ status: 'lakesideCourtesy', family: 'compliant', policy: undefined }))).status, 200, 'an implementer code takes the family it states');
  });

  test('writing the block needs apx.compliance:write; a write that omits it keeps the stored block', async () => {
    const before = await held();
    const parcs = await score(evaluation({ sequence: 9 }), { token: '<lakeside-parcs>' });
    assert.equal(parcs.status, 403);
    assert.equal(slug(parcs), 'insufficient-scope');
    assert.deepEqual(await held(), before, 'nothing written');
    const current = (await call('GET', `/sessions/${VISIT}`, undefined, { token: '<owner-bi>' })).body;
    const { extensions: _drop, ...withoutBlock } = current;
    const full = await call('PUT', `/sessions/${VISIT}`, withoutBlock, { token: '<lakeside-parcs>', headers: { 'apx-update-mode': 'full' } });
    assert.equal(full.status, 200, JSON.stringify(full.body));
    assert.deepEqual(await held(), before, 'a full replacement without the block keeps it');
    const change = await call('PUT', `/sessions/${VISIT}`, { id: VISIT, extensions: { 'apds-ext:lakeside:note@1.0': { note: 'checked' } } }, { token: '<lakeside-parcs>', headers: { 'apx-update-mode': 'change' } });
    assert.equal(change.status, 200, JSON.stringify(change.body));
    assert.deepEqual(await held(), before, 'a change that replaces extensions keeps it too');
  });

  test('Session event deliveries leave the block out for a subscription created without apx.compliance:read', async () => {
    const CITY = 'https://city.example/hooks/sessions';
    const ENGINE = 'https://engine.example/hooks/sessions';
    for (const [token, endpoint] of [['<city-platform>', CITY], ['<compliance-engine, apx.subscriptions:manage>', ENGINE]]) {
      const sub = await call('POST', '/webhooks', { endpoint, topics: ['SessionUpdated'] }, { token });
      assert.ok(sub.status < 300, JSON.stringify(sub.body));
    }
    await score(evaluation());
    const delivered = (url) => sim.events.receivers.get(url).inbox.map((d) => JSON.parse(d.body)).filter((e) => e.type === 'SessionUpdated');
    assert.equal(delivered(CITY).at(-1).data.extensions?.[SC], undefined);
    assert.equal(delivered(ENGINE).at(-1).data.extensions[SC].status, 'paidLate');
  });
});

describe('stay grace and graceUntil (Part 19 §19.10 rule 7, §19.3 rule 5)', () => {
  const LOT_C_POLICY = id('d4', 1);
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-violations' });
    sim.clock.set('2026-10-22T12:00:00Z');
  });

  const eligibility = (plate, at) => call('GET', `/v1/enforcement/eligibility?credential=${plate}&place=${LOT_C}&at=${at}`).then((r) => r.body);
  const setGrace = async (stayGrace) => {
    const cur = (await call('GET', `/v1/enforcement/policies/${LOT_C_POLICY}`)).body;
    const { statusHistory: _h, recordInfo: _r, stayGrace: _g, ...rest } = cur;
    return call('PUT', `/v1/enforcement/policies/${LOT_C_POLICY}`, { ...rest, ...(stayGrace ? { stayGrace } : {}) }, { headers: { 'if-match': `"${cur.version}"` } });
  };

  test('entry side while nothing covers the stay, exit side once its rights have ended, absent while a right covers it', async () => {
    const entering = await eligibility('SYN-5150', '2026-10-22T10:09:00Z');
    assert.equal(entering.entitled, false);
    assert.equal(entering.graceUntil, '2026-10-22T10:17:00Z', 'entry at 10:02 plus entryMinutes 15');
    const overstaying = await eligibility('SYN-6262', '2026-10-22T11:06:00Z');
    assert.equal(overstaying.graceUntil, '2026-10-22T11:15:00Z', 'paid until 11:00 plus exitMinutes 15');
    const covered = await eligibility('SYN-6262', '2026-10-22T10:30:00Z');
    assert.equal(covered.entitled, true);
    assert.equal(covered.graceUntil, undefined);
  });

  test('stayGrace is stored and versioned with the policy; a side without grace has no graceUntil; below zero fails the schema', async () => {
    const put = await setGrace({ entryMinutes: 0 });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.deepEqual(put.body.stayGrace, { entryMinutes: 0 });
    assert.equal((await eligibility('SYN-5150', '2026-10-22T10:09:00Z')).graceUntil, '2026-10-22T10:02:00Z', '0 states there is none');
    assert.equal((await eligibility('SYN-6262', '2026-10-22T11:06:00Z')).graceUntil, undefined, 'no exitMinutes, no exit grace');
    assert.equal((await setGrace(null)).status, 200);
    assert.equal((await eligibility('SYN-5150', '2026-10-22T10:09:00Z')).graceUntil, undefined, 'no stayGrace, no graceUntil');
    const negative = await setGrace({ exitMinutes: -5 });
    assert.equal(negative.status, 400);
    assert.equal(slug(negative), 'invalid-request');
  });
});
