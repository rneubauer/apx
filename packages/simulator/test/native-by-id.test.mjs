/**
 * The APDS 4.1 native by-id routes the bundle mounts since they were found
 * missing: GET/PUT/DELETE /observations/{id} and GET /quotes/{id} (Part 5;
 * the overlay's request body on the PUT is candidate C-026).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';
import { PROBLEM_BASE } from '../src/kernel/spec.mjs';

const obs = (n) => `f2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const IN_GRANT = obs(13);
const OUTSIDE = obs(920);
const UNKNOWN = obs(4040);
const LAKESIDE = 'b1000000-0000-4000-8000-000000000001';

let sim;
const slugOf = (res) => (typeof res.body?.type === 'string' ? res.body.type.slice(PROBLEM_BASE.length) : null);
const noContractIssue = (res) => assert.equal(res.headers['x-sim-contract'], undefined, res.headers['x-sim-contract']);
// The LPR world's default credential has no apx.data:read; the PARCS credential has both data scopes.
const call = (method, path, body, headers = {}, token = 'lakeside-parcs') => sim.request(method, path, { body, headers, token });
const problem = { accept: 'application/problem+json' };
const updates = (id) => sim.events.outbox.filter((e) => e.envelope.subject?.id === id && e.envelope.type === 'apx.data.observation.updated.v1');

describe('/observations/{id}', () => {
  beforeEach(() => {
    sim = new Simulator({ world: 'apx-lpr' });
  });

  test('GET returns the stored ObservationElement', async () => {
    const res = await call('GET', `/observations/${IN_GRANT}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    assert.equal(res.body.id, IN_GRANT);
  });

  test('GET outside the grant is 403; unknown is 404', async () => {
    const outside = await call('GET', `/observations/${OUTSIDE}`, undefined, problem);
    assert.equal(outside.status, 403);
    assert.equal(slugOf(outside), 'insufficient-grant');
    const unknown = await call('GET', `/observations/${UNKNOWN}`, undefined, problem);
    assert.equal(unknown.status, 404);
    assert.equal(slugOf(unknown), 'target-not-found');
  });

  test('PUT in change mode bumps the version and publishes observation.updated.v1', async () => {
    const before = await call('GET', `/observations/${IN_GRANT}`);
    const res = await call('PUT', `/observations/${IN_GRANT}`, { id: IN_GRANT, version: before.body.version, observer: 'lane review desk' }, { 'apx-update-mode': 'change' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    const after = await call('GET', `/observations/${IN_GRANT}`);
    assert.equal(after.body.version, before.body.version + 1);
    assert.equal(after.body.observer, 'lane review desk');
    assert.equal(updates(IN_GRANT).length, 1);
  });

  test('PUT with a stale version is 409 version-conflict and writes nothing', async () => {
    const before = await call('GET', `/observations/${IN_GRANT}`);
    const res = await call('PUT', `/observations/${IN_GRANT}`, { id: IN_GRANT, version: before.body.version + 5, observer: 'x' }, { 'apx-update-mode': 'change', ...problem });
    assert.equal(res.status, 409);
    assert.equal(slugOf(res), 'version-conflict');
    assert.equal(updates(IN_GRANT).length, 0);
  });

  test('DELETE removes it; a later GET is 404', async () => {
    const res = await call('DELETE', `/observations/${IN_GRANT}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    const gone = await call('GET', `/observations/${IN_GRANT}`);
    assert.equal(gone.status, 404);
  });
});

describe('GET /quotes/{id}', () => {
  test('returns a quote by id; an unknown id is 404', async () => {
    sim = new Simulator({ world: 'apx-reservations' });
    sim.clock.set('2026-09-24T17:00:06Z');
    const quoted = await call('POST', '/quotes', {
      id: 'd2000000-0000-4000-8000-000000000402',
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
    }, {}, 'default');
    assert.equal(quoted.status, 200, JSON.stringify(quoted.body));
    const id = quoted.body.data[0].id;
    const res = await call('GET', `/quotes/${id}`, undefined, {}, 'default');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noContractIssue(res);
    assert.equal(res.body.id, id);
    const unknown = await call('GET', '/quotes/d2000000-0000-4000-8000-000000009999', undefined, problem, 'default');
    assert.equal(unknown.status, 404);
    assert.equal(slugOf(unknown), 'target-not-found');
  });
});
