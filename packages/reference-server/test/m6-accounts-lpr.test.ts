import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';

let ctx: AppContext;
let token: string;

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0], deviceDelayMs: 5 });
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

describe('accounts & payments (2018 Desirable tier)', () => {
  it('balance lookup → payment → write-back → new balance e2e', async () => {
    // Lookup by phone, card, and plate all find the same account.
    const byPhone = await ctx.app.inject({
      method: 'GET',
      url: '/v1/accounts?phone=%2B13125550100',
      headers: auth(),
    });
    expect(byPhone.json().data).toHaveLength(1);
    const account = byPhone.json().data[0];
    expect(account.balance).toMatchObject({ type: 'USD', value: 45 });

    const byPlate = await ctx.app.inject({
      method: 'GET',
      url: '/v1/accounts?plate=SYN-1234',
      headers: auth(),
    });
    expect(byPlate.json().data[0].id).toBe(account.id);

    // Take a payment against the account.
    const payment = await ctx.app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: auth({ 'idempotency-key': 'pay-1' }),
      payload: {
        account: { id: account.id, className: 'Account' },
        amount: { type: 'USD', value: 45 },
        method: 'autoAttendant',
      },
    });
    expect(payment.statusCode).toBe(201);
    const record = payment.json();
    expect(record.transactionID).toMatch(/^TXN-/);
    expect(record.paymentStatus).toBe('approved');

    // Accounting write-back (PARIS-style).
    const posting = await ctx.app.inject({
      method: 'POST',
      url: `/v1/payments/${record.id}/postings`,
      headers: auth(),
      payload: { postedTo: 'paris', account: { id: account.id, className: 'Account' } },
    });
    expect(posting.statusCode).toBe(201);
    expect(posting.json().accountUpdated).toBe(true);
    expect(posting.json().newBalance).toMatchObject({ type: 'USD', value: 0 });
    expect(posting.json().confirmationNumber).toMatch(/^CONF-/);
  });

  it('declines invalid payments and enforces idempotency', async () => {
    const declined = await ctx.app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: auth({ 'idempotency-key': 'pay-decline' }),
      payload: { amount: { type: 'USD', value: 13.13 }, method: 'card' },
    });
    expect(declined.statusCode).toBe(422);
    expect(declined.json().type).toContain('payment-declined');

    const noKey = await ctx.app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: auth(),
      payload: { amount: { type: 'USD', value: 5 } },
    });
    expect(noKey.statusCode).toBe(400);
  });

  it('payment history by ticket last-4 honors the 8-hour privacy window', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/payments',
      headers: auth({ 'idempotency-key': 'pay-ticket' }),
      payload: {
        ticketNumber: 'T-1001',
        amount: { type: 'USD', value: 9 },
        method: 'card',
        cardLast4: '4123',
      },
    });

    // Transient lookup of last resort: card tail digits (works with 3 digits too).
    const byCard = await ctx.app.inject({
      method: 'GET',
      url: '/v1/payments?cardLast4=123',
      headers: auth(),
    });
    expect(byCard.json().data).toHaveLength(1);
    expect(byCard.json().data[0].ticketNumber).toBe('T-1001');

    const recent = await ctx.app.inject({
      method: 'GET',
      url: '/v1/payments?ticketLast4=1001',
      headers: auth(),
    });
    expect(recent.json().data).toHaveLength(1);
    expect(recent.json().data[0].ticketNumber).toBe('T-1001');

    // A date-scoped query for an old day returns nothing (no fabrication).
    const old = await ctx.app.inject({
      method: 'GET',
      url: '/v1/payments?ticketLast4=1001&date=2020-01-01',
      headers: auth(),
    });
    expect(old.json().data).toHaveLength(0);
  });
});

describe('LPR cross-lookup (apx-lpr)', () => {
  it('plate → ticket and ticket → plate round-trip with screenshot', async () => {
    const byPlate = await ctx.app.inject({
      method: 'GET',
      url: '/v1/lpr/reads?plate=SYN-1234',
      headers: auth(),
    });
    const read = byPlate.json().data[0];
    expect(read.ticketNumber).toBe('T-1001');
    expect(read.confidence).toBeCloseTo(0.97);
    expect(read.session).toMatchObject({ id: IDS.session, className: 'Session' });

    // The customer's reservation history rides along (newest first).
    expect(read.recentReservations).toHaveLength(2);
    expect(read.recentReservations[0].reservationState).toBe('checkedIn');
    expect(read.recentReservations[1].reservationState).toBe('noShow');

    const byTicket = await ctx.app.inject({
      method: 'GET',
      url: '/v1/lpr/reads?ticket=T-1001',
      headers: auth(),
    });
    const reverse = byTicket.json().data[0];
    expect(reverse.plate).toBe('SYN-1234');
    expect(reverse.imageLink).toContain('https://');
    expect(reverse.recentReservations).toHaveLength(2);
  });

  it('LPR ingest is the native APDS observations route', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/observations',
      headers: auth(),
      payload: {
        observationDateTime: new Date().toISOString(),
        observationType: 'anpr',
        credentialObservation: {
          credentialType: 'licensePlate',
          credentialIdentification: 'SYN-5678',
          confidence: { value: 0.88 },
        },
      },
    });
    expect(created.statusCode).toBe(201);

    const lookup = await ctx.app.inject({
      method: 'GET',
      url: '/v1/lpr/reads?plate=SYN-5678',
      headers: auth(),
    });
    expect(lookup.json().data[0].confidence).toBeCloseTo(0.88);
  });
});
