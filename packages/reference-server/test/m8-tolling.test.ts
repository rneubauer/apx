import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';

let ctx: AppContext;
let token: string;

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0] });
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/oauth/token',
    payload: {
      grant_type: 'client_credentials',
      client_id: 'apx-operator',
      client_secret: 'operator-secret',
    },
  });
  token = response.json().access_token;
});

afterAll(async () => {
  await ctx.app.close();
});

const auth = (extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  ...extra,
});

describe('tolling (net-new surface, APDS conventions)', () => {
  it('plate read → transaction → payment → dispute open/resolve, with topic events', async () => {
    const observer = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: {
          transport: 'sse',
          topics: ['apx.tolling.transaction.created.v1', 'apx.tolling.transaction.status.v1'],
        },
      })
    ).json();

    // 1. The toll read is a NATIVE Observation.
    const read = await ctx.app.inject({
      method: 'POST',
      url: '/observations',
      headers: auth(),
      payload: {
        observationDateTime: new Date().toISOString(),
        observationType: 'anpr',
        credentialObservation: {
          credentialType: 'licensePlate',
          credentialIdentification: 'SYN-TOLL1',
          confidence: { value: 0.95 },
        },
      },
    });
    const observationId = read.json().id;

    // 2. Create the toll transaction binding the observation.
    const payload = {
      tollPoint: { id: IDS.gateEntry, className: 'SupplementalEquipment' },
      observations: [{ id: observationId, className: 'Observation' }],
      credential: { credentialType: 'licensePlate', credentialIdentification: 'SYN-TOLL1' },
      pricing: { type: 'USD', value: 2.5 },
    };
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/tolling/transactions',
      headers: auth({ 'idempotency-key': 'toll-1' }),
      payload,
    });
    expect(created.statusCode).toBe(201);
    const transaction = created.json();
    expect(transaction.transactionStatus).toBe('priced');

    // Idempotent replay returns the same transaction.
    const replay = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/tolling/transactions',
      headers: auth({ 'idempotency-key': 'toll-1' }),
      payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(transaction.id);

    // 3. Attach the settling payment.
    const paid = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/tolling/transactions/${transaction.id}/payment`,
      headers: auth(),
      payload: {
        payment: { id: '77777777-0000-4000-8000-000000000001', className: 'PaymentRecord' },
      },
    });
    expect(paid.json().transactionStatus).toBe('paid');

    // 4. Dispute open → resolve.
    const disputed = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/tolling/transactions/${transaction.id}/disputes`,
      headers: auth(),
      payload: { reason: 'wrong plate match' },
    });
    expect(disputed.json().transactionStatus).toBe('disputed');

    const resolved = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/tolling/transactions/${transaction.id}/disputes/resolve`,
      headers: auth(),
      payload: { resolution: 'refunded' },
    });
    expect(resolved.json().transactionStatus).toBe('resolved');
    expect(resolved.json().dispute.resolution).toBe('refunded');

    // Closed disputes stay closed.
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/tolling/transactions/${transaction.id}/disputes`,
      headers: auth(),
      payload: { reason: 'retry' },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().type).toContain('dispute-closed');

    // 5. Events flowed on both topics; plate lookup works.
    const types = ctx.dispatcher.buffered(observer.id).map((e) => e.envelope.type);
    expect(types).toContain('apx.tolling.transaction.created.v1');
    expect(
      types.filter((t) => t === 'apx.tolling.transaction.status.v1').length
    ).toBeGreaterThanOrEqual(3);

    const byPlate = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/tolling/transactions?plate=SYN-TOLL1',
      headers: auth(),
    });
    expect(byPlate.json().data).toHaveLength(1);

    // Audit trail is complete.
    const states = resolved.json().statusHistory.map((h: { state: string }) => h.state);
    expect(states).toEqual(['created', 'priced', 'paid', 'disputed', 'resolved']);
  });
});
