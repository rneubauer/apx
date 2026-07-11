import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';

let ctx: AppContext;

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/oauth/token',
    payload: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
  });
  return response.json().access_token;
}

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0] });
});

afterAll(async () => {
  await ctx.app.close();
});

describe('credential-scoped discovery (apx-discovery)', () => {
  it('different grants produce provably different capability documents', async () => {
    const operatorToken = await getToken('apx-operator', 'operator-secret');
    const lprToken = await getToken('lpr-vendor', 'lpr-secret');

    const operatorDoc = (
      await ctx.app.inject({
        method: 'GET',
        url: '/apx/v1/discovery',
        headers: { authorization: `Bearer ${operatorToken}` },
      })
    ).json();
    const lprDoc = (
      await ctx.app.inject({
        method: 'GET',
        url: '/apx/v1/discovery',
        headers: { authorization: `Bearer ${lprToken}` },
      })
    ).json();

    // Operator: full world, no place restriction, all command types.
    expect(operatorDoc.places).toEqual([]);
    expect(operatorDoc.commandTypes).toContain('vendGate');
    expect(operatorDoc.conformanceClasses).toContain('apx-control');
    expect(operatorDoc.endpoints.map((e: { path: string }) => e.path)).toContain(
      '/apx/v1/commands'
    );

    // LPR vendor: place-limited, no control surface at all.
    expect(lprDoc.places).toEqual([IDS.place]);
    expect(lprDoc.commandTypes).toEqual([]);
    expect(lprDoc.conformanceClasses).not.toContain('apx-control');
    const lprPaths = lprDoc.endpoints.map((e: { path: string }) => e.path);
    expect(lprPaths).toContain('/apx/v1/lpr/reads');
    expect(lprPaths).not.toContain('/apx/v1/commands');
    expect(lprDoc.topics).toEqual([]); // no subscriptions:manage scope

    expect(JSON.stringify(operatorDoc)).not.toEqual(JSON.stringify(lprDoc));
  });

  it('the document is sound: advertised endpoints callable, unadvertised ones 403', async () => {
    const lprToken = await getToken('lpr-vendor', 'lpr-secret');
    const headers = { authorization: `Bearer ${lprToken}` };

    // Advertised: /apx/v1/lpr/reads works.
    const advertised = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/lpr/reads?plate=SYN-1234',
      headers,
    });
    expect(advertised.statusCode).toBe(200);

    // Not advertised: POST /apx/v1/commands is 403 for this client.
    const unadvertised = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: { ...headers, 'idempotency-key': 'nope' },
      payload: {
        commandType: 'vendGate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
      },
    });
    expect(unadvertised.statusCode).toBe(403);
  });

  it('requires authentication and advertises the class in the bootstrap', async () => {
    const anonymous = await ctx.app.inject({ method: 'GET', url: '/apx/v1/discovery' });
    expect(anonymous.statusCode).toBe(401);

    const bootstrap = await ctx.app.inject({
      method: 'GET',
      url: '/.well-known/apx-configuration',
    });
    expect(bootstrap.json().conformanceClasses).toContain('apx-discovery');
  });
});
