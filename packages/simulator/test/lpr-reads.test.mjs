/**
 * The body-form and path-form lookups added for Part 9 §9.6 rules 6–7:
 * apx-lpr read-back by path, `reads:search`, and the read-level plate
 * review (Part 13 §13.3, §13.3a(4a), §13.3b); `GET /v1/digest-keys`
 * (§9.6 rule 6); `POST /v1/enforcement/eligibility:check` (Part 19 §19.3).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Simulator } from '../src/index.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';

const READ_KEY = 'apds-ext:apx:lpr-read@1.0';
const obs = (n) => `f2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const IN_GRANT = obs(13); // 5VN-4B21 at Lakeside, entry, engine read FL
const OUTSIDE = obs(920); // Harbor, outside the default grant
const UNKNOWN = obs(4040);
const LAKESIDE_ORG = 'a1000000-0000-4000-8000-000000000001';

let sim;
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);
const call = (method, path, body, token = '…', headers = {}) => sim.request(method, path, { body, headers, token });
const updates = (id) => sim.events.outbox.filter((e) => e.envelope.subject?.id === id && e.envelope.type === 'apx.data.observation.updated.v1');
const review = (id, body, token, headers) => call('PUT', `/v1/lpr/reads/${id}/plate`, body, token, headers);

describe('apx-lpr reads', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-lpr' });
  });

  describe('GET /v1/lpr/reads/{observation}', () => {
    test('returns the same LprRead as ?observation=', async () => {
      const byPath = await call('GET', `/v1/lpr/reads/${IN_GRANT}`);
      const byQuery = await call('GET', `/v1/lpr/reads?observation=${IN_GRANT}`);
      assert.equal(byPath.status, 200);
      noContractIssue(byPath);
      assert.deepEqual(byPath.body, byQuery.body.data[0]);
    });

    test('a read outside the grant is 403 insufficient-grant', async () => {
      const res = await call('GET', `/v1/lpr/reads/${OUTSIDE}`);
      assert.equal(res.status, 403);
      assert.equal(slugOf(res), 'insufficient-grant');
    });

    test('an unknown read is 404 target-not-found', async () => {
      const res = await call('GET', `/v1/lpr/reads/${UNKNOWN}`);
      assert.equal(res.status, 404);
      assert.equal(slugOf(res), 'target-not-found');
    });

    test('a purged read is 404, not a tombstone (§13.3b)', async () => {
      sim.injectors.get('purgeReads')({ observation: IN_GRANT }, sim);
      const res = await call('GET', `/v1/lpr/reads/${IN_GRANT}`);
      assert.equal(res.status, 404);
    });
  });

  describe('POST /v1/lpr/reads:search', () => {
    test('answers exactly as the GET', async () => {
      const post = await call('POST', '/v1/lpr/reads:search', { plate: 'SVN-4821' });
      const get = await call('GET', '/v1/lpr/reads?plate=SVN-4821');
      assert.equal(post.status, 200);
      noContractIssue(post);
      assert.ok(post.body.data.length > 0);
      assert.deepEqual(post.body.data, get.body.data);
    });

    test('a body without any lookup key is 400 invalid-request, never a bulk export', async () => {
      const res = await call('POST', '/v1/lpr/reads:search', { place: 'b1000000-0000-4000-8000-000000000001' });
      assert.equal(res.status, 400);
      assert.equal(slugOf(res), 'invalid-request');
    });

    test('a place outside the grant is 403', async () => {
      const res = await call('POST', '/v1/lpr/reads:search', { plate: 'HBR-5510', place: 'b1000000-0000-4000-8000-000000000002' });
      assert.equal(res.status, 403);
      assert.equal(slugOf(res), 'insufficient-grant');
    });

    test('a read outside the grant is not returned', async () => {
      const res = await call('POST', '/v1/lpr/reads:search', { plate: 'HBR-5510' });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
    });
  });

  describe('PUT /v1/lpr/reads/{observation}/plate (§13.3a(4a))', () => {
    const correction = { decision: 'corrected', plate: 'SVN-4B21', country: 'US', stateProvince: 'US-WA', reviewer: 'rev-17' };

    test('corrected writes the values, keeps the original, bumps the version, publishes once', async () => {
      const res = await review(IN_GRANT, correction);
      assert.equal(res.status, 200);
      noContractIssue(res);
      assert.equal(res.body.plate, 'SVN-4B21');
      const d = res.body.detail;
      assert.equal(d.plate.value, 'SVN-4B21');
      assert.equal(d.review.state, 'corrected');
      assert.equal(d.review.decidedBy, 'rev-17');
      assert.equal(d.review.original.plate.value, '5VN-4B21');
      assert.equal(d.review.original.plate.confidence, 0.41);
      const stored = sim.store.collection('observations').get(IN_GRANT);
      assert.equal(stored.observedCredentialId, 'SVN-4B21');
      assert.equal(stored.vehicleAncillaryIdentification.stateProvince, 'US-WA');
      assert.equal(stored.version, 2);
      assert.equal(updates(IN_GRANT).length, 1);
    });

    test('resending the same decision is a no-op: no new version, no event', async () => {
      await review(IN_GRANT, correction);
      const again = await review(IN_GRANT, correction);
      assert.equal(again.status, 200);
      assert.equal(sim.store.collection('observations').get(IN_GRANT).version, 2);
      assert.equal(updates(IN_GRANT).length, 1);
    });

    test('a later correction never changes review.original', async () => {
      await review(IN_GRANT, correction);
      const res = await review(IN_GRANT, { decision: 'corrected', plate: 'SVN-4821' });
      assert.equal(res.body.detail.plate.value, 'SVN-4821');
      assert.equal(res.body.detail.review.original.plate.value, '5VN-4B21');
    });

    test('corrected without plate, or plate with another decision, is 422', async () => {
      for (const body of [{ decision: 'corrected' }, { decision: 'confirmed', plate: 'X' }, { decision: 'rejected', country: 'US' }]) {
        const res = await review(IN_GRANT, body);
        assert.equal(res.status, 422, JSON.stringify(body));
        assert.equal(slugOf(res), 'request-unprocessable');
      }
      assert.equal(sim.store.collection('observations').get(IN_GRANT).version, 1);
    });

    test('a stale If-Match is 409 version-conflict and writes nothing', async () => {
      const res = await review(IN_GRANT, { decision: 'confirmed' }, '…', { 'if-match': '"7"' });
      assert.equal(res.status, 409);
      assert.equal(slugOf(res), 'version-conflict');
      assert.equal(updates(IN_GRANT).length, 0);
    });

    test('without apx.lpr:read the 200 echoes only the values the caller sent', async () => {
      const res = await review(IN_GRANT, { decision: 'corrected', plate: 'SVN-4B21' }, 'apx.data:write only');
      assert.equal(res.status, 200);
      noContractIssue(res);
      assert.deepEqual(Object.keys(res.body).sort(), ['observation', 'plate', 'review', 'version']);
      assert.equal(res.body.review.state, 'corrected');
    });

    test('outside the grant is 403; unknown is 404', async () => {
      assert.equal((await review(OUTSIDE, { decision: 'confirmed' })).status, 403);
      assert.equal((await review(UNKNOWN, { decision: 'confirmed' })).status, 404);
    });

    test('the write changes no Session', async () => {
      const before = JSON.stringify(sim.store.collection('sessions').all());
      await review(IN_GRANT, correction);
      assert.equal(JSON.stringify(sim.store.collection('sessions').all()), before);
    });

    test('a rejected entry read opens no visit at a pay-by-plate place', async () => {
      const injected = sim.injectors.get('plateRead')({ lane: sim.world.lanes.find((l) => sim.hierarchy.placeOf(l.id)?.id === 'b1000000-0000-4000-8000-000000000006').id, plate: 'RJT-0001', accessEvent: 'unknown' }, sim);
      await review(injected.observation, { decision: 'rejected' });
      const o = sim.store.collection('observations').get(injected.observation);
      assert.equal(o.extensions[READ_KEY].review.state, 'rejected');
      assert.equal(sim.lpr.model.pair({ ...o, extensions: { ...o.extensions, [READ_KEY]: { ...o.extensions[READ_KEY], accessEvent: 'entry' } } }), null);
    });
  });
});

describe('GET /v1/digest-keys (§9.6 rule 6)', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-lpr' });
  });

  test('serves the caller organisation key; it reproduces sim.digest values', async () => {
    const res = await call('GET', '/v1/digest-keys', undefined, 'apx.digest:use only');
    assert.equal(res.status, 200);
    noContractIssue(res);
    assert.equal(res.body.keys.length, 1);
    const [k] = res.body.keys;
    assert.equal(k.alg, 'HS256');
    assert.ok(Buffer.from(k.key, 'base64url').length >= 32);
    const mine = createHmac('sha256', Buffer.from(k.key, 'base64url')).update('SVN4821|US-WA').digest('base64url');
    const theirs = sim.digest.compute(LAKESIDE_ORG, 'svn-4821', 'us-wa');
    assert.equal(theirs.keyId, k.keyId);
    assert.equal(theirs.value, mine);
  });

  test('keys are per operator: another organisation digests differently', () => {
    const a = sim.digest.compute(LAKESIDE_ORG, 'SVN-4821');
    const b = sim.digest.compute('a1000000-0000-4000-8000-000000000002', 'SVN-4821');
    assert.notEqual(a.value, b.value);
  });

  test('key material is served under no other scope', async () => {
    const res = await call('GET', '/v1/digest-keys', undefined, 'apx.lpr:read only');
    assert.equal(res.status, 403);
    assert.equal(slugOf(res), 'insufficient-scope');
  });

  test('configured keys rotate by keyId; both served during the overlap', async () => {
    const key = (n) => Buffer.alloc(32, n).toString('base64url');
    sim.world.digest = {
      keys: [
        { org: LAKESIDE_ORG, keyId: 'k1', key: key(1), validTo: '2099-01-01T00:00:00Z' },
        { org: LAKESIDE_ORG, keyId: 'k2', key: key(2), validFrom: '2020-01-01T00:00:00Z' },
        { org: LAKESIDE_ORG, keyId: 'k0', key: key(0), validTo: '2020-01-01T00:00:00Z' },
      ],
    };
    const res = await call('GET', '/v1/digest-keys', undefined, 'apx.digest:use only');
    assert.deepEqual(res.body.keys.map((k) => k.keyId), ['k1', 'k2']);
    noContractIssue(res);
    assert.equal(sim.digest.compute(LAKESIDE_ORG, 'SVN-4821').keyId, 'k2');
  });
});

describe('POST /v1/enforcement/eligibility:check (§19.3, §9.6 rule 7)', () => {
  const LOT_B = 'b1000000-0000-4000-8000-000000000003';
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-violations' });
  });

  test('answers exactly as the GET', async () => {
    for (const [credential, credentialType, at] of [['SYN-8820'], ['SYN-1234'], ['HT-0093', 'hangtag', '2026-09-24T10:12:30Z']]) {
      const q = new URLSearchParams({ credential, place: LOT_B, ...(credentialType ? { credentialType } : {}), ...(at ? { at } : {}) });
      const get = await call('GET', `/v1/enforcement/eligibility?${q}`);
      const post = await call('POST', '/v1/enforcement/eligibility:check', { credential, place: LOT_B, ...(credentialType ? { credentialType } : {}), ...(at ? { at } : {}) });
      assert.equal(post.status, 200);
      noContractIssue(post);
      assert.deepEqual(post.body, get.body);
    }
  });

  test('an unknown place is 404; a missing credential is 400', async () => {
    const unknown = await call('POST', '/v1/enforcement/eligibility:check', { credential: 'SYN-8820', place: 'b1000000-0000-4000-8000-00000000dead' });
    assert.equal(unknown.status, 404);
    const missing = await call('POST', '/v1/enforcement/eligibility:check', { place: LOT_B });
    assert.equal(missing.status, 400);
    assert.equal(slugOf(missing), 'invalid-request');
  });
});
