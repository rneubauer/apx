import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';

let ctx: AppContext;
let token: string;

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/oauth/token',
    payload: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
  });
  expect(response.statusCode).toBe(200);
  return response.json().access_token;
}

beforeAll(async () => {
  ctx = buildApp();
  token = await getToken('apx-operator', 'operator-secret');
});

const auth = () => ({ authorization: `Bearer ${token}` });

describe('stock APDS 4.1 compatibility (no APX params)', () => {
  it('lists places in the native PaginatedList shape', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/places', headers: auth() });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.meta).toMatchObject({ offset: 0 });
    expect(body.meta.referenceInstant).toBeTypeOf('number');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0].id).toBe(IDS.place);
    expect(body).not.toHaveProperty('cursor');
  });

  it('supports native modified_since with deletedReferences tombstones', async () => {
    const instant = new Date(Date.now() - 1000).toISOString();
    await ctx.app.inject({
      method: 'POST',
      url: '/contacts',
      headers: auth(),
      payload: { id: '99999999-0000-4000-8000-000000000001', name: 'Temp' },
    });
    await ctx.app.inject({
      method: 'DELETE',
      url: '/contacts/99999999-0000-4000-8000-000000000001',
      headers: auth(),
    });
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/contacts?modified_since=${encodeURIComponent(instant)}`,
      headers: auth(),
    });
    const body = response.json();
    expect(body.deletedReferences?.[0]).toMatchObject({
      id: '99999999-0000-4000-8000-000000000001',
      className: 'Contact',
    });
  });

  it('returns 409 on client-supplied id collision (APDS convention)', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/places',
      headers: auth(),
      payload: { id: IDS.place, name: 'dup' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().type).toContain('id-collision');
  });
});

describe('APX data profile: change semantics + cursor feed', () => {
  it('full sync -> change-mode null-out -> change feed shows the delta', async () => {
    const initial = await ctx.app.inject({
      method: 'GET',
      url: '/rates?mode=change',
      headers: auth(),
    });
    const cursor = initial.json().cursor;
    expect(cursor).toBeTypeOf('string');

    const set = await ctx.app.inject({
      method: 'PUT',
      url: `/rates/${IDS.rateTable}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: { version: 1, note: 'temporary note' },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().version).toBe(2);

    const nullOut = await ctx.app.inject({
      method: 'PUT',
      url: `/rates/${IDS.rateTable}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: { version: 2, note: null },
    });
    expect(nullOut.statusCode).toBe(200);
    expect(nullOut.json()).not.toHaveProperty('note');

    const feed = await ctx.app.inject({
      method: 'GET',
      url: `/rates?mode=change&cursor=${cursor}`,
      headers: auth(),
    });
    const page = feed.json();
    expect(page.updateMode).toBe('change');
    expect(page.items).toHaveLength(2);
    expect(page.items[0].note).toBe('temporary note');
    expect(page.items[1].note).toBeNull();

    const replay = await ctx.app.inject({
      method: 'GET',
      url: `/rates?mode=change&cursor=${page.cursor}`,
      headers: auth(),
    });
    expect(replay.json().items).toHaveLength(0);
  });

  it('emits tombstones in the change feed', async () => {
    const start = await ctx.app.inject({
      method: 'GET',
      url: '/sessions?mode=change',
      headers: auth(),
    });
    await ctx.app.inject({ method: 'DELETE', url: `/sessions/${IDS.session}`, headers: auth() });
    const feed = await ctx.app.inject({
      method: 'GET',
      url: `/sessions?mode=change&cursor=${start.json().cursor}`,
      headers: auth(),
    });
    expect(feed.json().deleted[0]).toMatchObject({ id: IDS.session, className: 'Session' });
  });

  it('rejects a stale change-mode write with version-conflict', async () => {
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/rates/${IDS.rateTable}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: { version: 1, note: 'stale' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().type).toContain('version-conflict');
  });

  it('rejects a foreign cursor', async () => {
    const feed = await ctx.app.inject({
      method: 'GET',
      url: '/rates?mode=change',
      headers: auth(),
    });
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/sessions?mode=change&cursor=${feed.json().cursor}`,
      headers: auth(),
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('security profile', () => {
  it('rejects missing token', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/places' });
    expect(response.statusCode).toBe(401);
  });

  it('enforces scopes (lpr-vendor cannot write data)', async () => {
    const lprToken = await getToken('lpr-vendor', 'lpr-secret');
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/places',
      headers: { authorization: `Bearer ${lprToken}` },
      payload: { name: 'nope' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().type).toContain('insufficient-scope');
  });
});
