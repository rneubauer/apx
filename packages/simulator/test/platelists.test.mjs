/**
 * apx-plate-lists (Part 24): lists with per-place flags and the grant
 * rules (§24.1), entries with the upsert rule (§24.2), the §5.2 rule 8
 * change feed on both routes and apx.platelists.changed.v1 (§24.3), and
 * the §24.4 arrival alert.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/index.mjs';

const id = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GARAGE = id('b1', 1);
const HARBOR = id('b1', 2);
const LANE_1 = id('b2', 1);
const WATCH = id('e7', 1);
const SCOFFLAW = id('e7', 2);
const PAID = id('e8', 202);
const place = (p, flags = {}) => ({ place: { id: p, className: 'Place' }, ...flags });
const plate = (value, extra = {}) => ({ credential: { credentialType: 'licensePlate', credentialIdentification: value, ...extra } });

let sim;
const call = (method, path, body, { token = 'default', headers = {} } = {}) => sim.request(method, path, { body, token, headers });
const events = (type) => sim.events.outbox.filter((r) => r.envelope.type === type).map((r) => r.envelope);

beforeEach(() => {
  sim = new Simulator({ world: 'apx-plate-lists' });
});

test('lists are visible by grant or by ownership, never otherwise (§24.1 rule 3)', async () => {
  const lakeside = await call('GET', '/v1/plate-lists');
  assert.equal(lakeside.body.meta.total, 4);
  const harbor = await call('GET', '/v1/plate-lists', undefined, { token: 'harbor-plate-desk' });
  assert.deepEqual(harbor.body.data.map((l) => l.id).sort(), [SCOFFLAW, id('e7', 4)]);
  assert.equal((await call('GET', `/v1/plate-lists/${WATCH}`, undefined, { token: 'harbor-plate-desk' })).body.type.endsWith('insufficient-grant'), true);
  // A list with no places is visible to its owner only; to others it does not exist.
  const bare = await call('POST', '/v1/plate-lists', { name: 'Draft', category: 'watch', status: 'active' });
  assert.equal(bare.status, 201);
  assert.equal((await call('GET', `/v1/plate-lists/${bare.body.id}`)).status, 200);
  assert.equal((await call('GET', `/v1/plate-lists/${bare.body.id}`, undefined, { token: 'harbor-plate-desk' })).status, 404);
  assert.equal((await call('GET', '/v1/plate-lists?category=scofflaw')).body.meta.total, 1);
  assert.equal((await call('GET', `/v1/plate-lists?place=${HARBOR}`, undefined, { token: 'city-parking-authority' })).body.meta.total, 2);
});

test('every place written must be inside the grant and known', async () => {
  const outside = await call('POST', '/v1/plate-lists', { name: 'x', category: 'watch', status: 'active', places: [place(HARBOR)] });
  assert.equal(outside.status, 403);
  assert.match(outside.body.type, /insufficient-grant$/);
  const unknown = await call('POST', '/v1/plate-lists', { name: 'x', category: 'watch', status: 'active', places: [place(id('b1', 99))] });
  assert.equal(unknown.status, 422);
  const created = await call('POST', '/v1/plate-lists', { name: 'Lot staff', category: 'staffParking', status: 'active', places: [place(GARAGE, { enforced: true })] });
  assert.equal(created.status, 201, 'an implementer category is accepted');
  assert.equal(created.body.owner.id, id('a1', 1));
  assert.equal(created.body.entryCount, 0);
});

test('PUT replaces the policy under If-Match and keeps the entries (§24.1 rule 5)', async () => {
  const body = { name: 'Lakeside watch list', category: 'watch', status: 'suspended', places: [place(GARAGE, { alertOnArrival: false })] };
  const ok = await call('PUT', `/v1/plate-lists/${WATCH}`, body, { headers: { 'if-match': '"1"' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.version, 2);
  assert.equal(ok.body.status, 'suspended');
  assert.equal(ok.body.entryCount, 2);
  const stale = await call('PUT', `/v1/plate-lists/${WATCH}`, { ...body, version: 1 });
  assert.equal(stale.status, 409);
  assert.match(stale.body.type, /version-conflict$/);
  assert.equal((await call('GET', `/v1/plate-lists/${WATCH}/entries`)).body.meta.total, 2, 'entries stay readable on a suspended list');
});

test('adding a listed plate with overlapping validity updates the entry (§24.2 rule 2)', async () => {
  const opts = { token: 'city-parking-authority' };
  const first = await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, { ...plate('GHN5528', { jurisdiction: 'IL' }), details: { noticeCount: 3 } }, opts);
  assert.equal(first.status, 201);
  const again = await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, { ...plate('GHN 5528'), details: { noticeCount: 4 } }, opts);
  assert.equal(again.status, 200);
  assert.equal(again.body.id, first.body.id);
  assert.equal(again.body.version, 2);
  assert.equal(again.body.credential.jurisdiction, 'IL');
  assert.equal(again.body.details.noticeCount, 4);
  // A later, non-overlapping window is a second entry.
  const later = await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, { ...plate('LKS0920'), validity: { start: '2027-01-01T00:00:00Z' } });
  assert.equal(later.status, 201);
  const watchLater = await call('POST', `/v1/plate-lists/${WATCH}/entries`, { ...plate('LKS0920', { jurisdiction: 'IL' }), validity: { start: '2027-01-01T00:00:00Z' } });
  assert.equal(watchLater.status, 201, 'the seeded entry ends 2026-12-31, so the windows do not overlap');
  const bad = await call('POST', `/v1/plate-lists/${WATCH}/entries`, { ...plate('Q1'), validity: { start: '2026-10-02T00:00:00Z', end: '2026-10-01T00:00:00Z' } });
  assert.equal(bad.status, 400);
  assert.equal((await call('GET', `/v1/plate-lists/${SCOFFLAW}`)).body.entryCount, 5);
});

test('entries filter by credential and activeAt', async () => {
  const one = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?credential=BRT7781`);
  assert.equal(one.body.meta.total, 1);
  const allow = id('e7', 3);
  assert.equal((await call('GET', `/v1/plate-lists/${allow}/entries?activeAt=2026-12-15T00:00:00Z`)).body.meta.total, 1);
  assert.equal((await call('GET', `/v1/plate-lists/${allow}/entries?activeAt=2026-10-15T00:00:00Z`)).body.meta.total, 2);
  const entry = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries/${id('e8', 201)}`);
  assert.equal(entry.body.list.id, SCOFFLAW);
  assert.equal((await call('GET', `/v1/plate-lists/${WATCH}/entries/${id('e8', 201)}`)).status, 404, 'an entry of another list');
});

test('the entry feed: head cursor, whole items, tombstones, retries, cursor scope (§24.3 rule 1)', async () => {
  const edge = { token: 'edge-lpr-vendor' };
  const head = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change`, undefined, edge);
  assert.equal(head.status, 200);
  assert.deepEqual(head.body.data, []);
  assert.equal(head.body.updateMode, 'change');
  assert.equal(head.body.meta, undefined);
  const added = await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, plate('GHN5528'), { token: 'city-parking-authority' });
  await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, { ...plate('GHN5528'), details: { noticeCount: 4 } }, { token: 'city-parking-authority' });
  assert.equal((await call('DELETE', `/v1/plate-lists/${SCOFFLAW}/entries/${PAID}`, undefined, { token: 'city-parking-authority' })).status, 204);
  assert.equal((await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries/${PAID}`)).status, 404);

  const page = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&cursor=${head.body.cursor}`, undefined, edge);
  assert.equal(page.status, 200);
  assert.equal(page.body.data.length, 1, 'two changes to one entry arrive once, latest state');
  assert.equal(page.body.data[0].id, added.body.id);
  assert.equal(page.body.data[0].version, 2);
  assert.deepEqual(page.body.deleted.map((d) => [d.id, d.className]), [[PAID, 'PlateListEntry']]);
  assert.equal(page.body.next, null);
  const retry = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&cursor=${head.body.cursor}`, undefined, edge);
  assert.deepEqual(retry.body, page.body, 'a retried cursor yields the same page');
  const quiet = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&cursor=${page.body.cursor}`, undefined, edge);
  assert.deepEqual(quiet.body.data, []);

  const other = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&cursor=${head.body.cursor}`);
  assert.equal(other.status, 404, 'another credential');
  const filtered = await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&credential=BRT7781&cursor=${head.body.cursor}`, undefined, edge);
  assert.equal(filtered.status, 404, 'another filter set');
  const otherList = await call('GET', `/v1/plate-lists/${WATCH}/entries?mode=change&cursor=${head.body.cursor}`, undefined, edge);
  assert.equal(otherList.status, 404, 'another list');
  sim.clock.set('2026-10-02T18:00:01Z');
  assert.equal((await call('GET', `/v1/plate-lists/${SCOFFLAW}/entries?mode=change&cursor=${head.body.cursor}`, undefined, edge)).status, 404, 'past retention');
});

test('the list feed shows a change that takes a list out of a filtered view', async () => {
  const head = await call('GET', '/v1/plate-lists?mode=change&status=active');
  await call('PUT', `/v1/plate-lists/${WATCH}`, { name: 'Lakeside watch list', category: 'watch', status: 'retired', places: [place(GARAGE)] });
  const page = await call('GET', `/v1/plate-lists?mode=change&status=active&cursor=${head.body.cursor}`);
  assert.equal(page.status, 200);
  assert.deepEqual(page.body.data.map((l) => [l.id, l.status]), [[WATCH, 'retired']]);
  const harborHead = await call('GET', '/v1/plate-lists?mode=change', undefined, { token: 'harbor-plate-desk' });
  await call('PUT', `/v1/plate-lists/${WATCH}`, { name: 'Lakeside watch list', category: 'watch', status: 'active', places: [place(GARAGE)] });
  const harborPage = await call('GET', `/v1/plate-lists?mode=change&cursor=${harborHead.body.cursor}`, undefined, { token: 'harbor-plate-desk' });
  assert.deepEqual(harborPage.body.data, [], 'a list outside the grant never shows');
});

test('every change publishes apx.platelists.changed.v1 without plate values (§24.3 rule 2)', async () => {
  await call('POST', `/v1/plate-lists/${WATCH}/entries`, plate('NEW1234'));
  await call('DELETE', `/v1/plate-lists/${WATCH}/entries/${id('e8', 101)}`);
  const seen = events('apx.platelists.changed.v1');
  assert.equal(seen.length, 2);
  assert.deepEqual(seen.map((e) => e.data.entryCount), [3, 2]);
  assert.equal(seen[0].subject.id, WATCH);
  assert.doesNotMatch(JSON.stringify(seen), /NEW1234|WTC4471/);
});

test('scopes: read cannot write, and no plate-list scope reads nothing', async () => {
  assert.equal((await call('POST', `/v1/plate-lists/${SCOFFLAW}/entries`, plate('X1'), { token: 'edge-lpr-vendor' })).status, 403);
  assert.equal((await call('DELETE', `/v1/plate-lists/${SCOFFLAW}/entries/${PAID}`, undefined, { token: 'edge-lpr-vendor' })).status, 403);
  const none = await call('GET', '/v1/plate-lists', undefined, { token: 'console-lakeside' });
  assert.equal(none.status, 403);
  assert.match(none.body.type, /insufficient-scope$/);
});

test('a read of a listed plate raises the arrival alert where alertOnArrival (§24.4)', async () => {
  await call('POST', '/sim/inject', { kind: 'plateRead', lane: LANE_1, plate: 'BRT7781' });
  await call('POST', '/sim/inject', { kind: 'plateRead', lane: LANE_1, plate: 'ELV2200' }); // allow list: no alert
  await call('POST', '/sim/inject', { kind: 'plateRead', lane: LANE_1, plate: 'CITY1042' }); // enforcement fleet: no alert
  const alerts = (await call('GET', '/v1/alerts')).body.data;
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].alertType, 'scofflawArrival');
  assert.deepEqual(alerts[0].relatedEntity, { id: id('e8', 201), className: 'PlateListEntry' });
  assert.ok(alerts[0].extensions['apds-ext:apx:alert-evidence@1.0'].observations[0].id);
  // A suspended list applies nowhere (§24.1 rule 4).
  await call('PUT', `/v1/plate-lists/${WATCH}`, { name: 'w', category: 'watch', status: 'suspended', places: [place(GARAGE, { alertOnArrival: true })] });
  await call('POST', '/sim/inject', { kind: 'plateRead', lane: LANE_1, plate: 'WTC4471' });
  assert.equal((await call('GET', '/v1/alerts')).body.meta.total, 1);
  assert.deepEqual((await call('GET', '/sim/contract')).body.violations, []);
});
