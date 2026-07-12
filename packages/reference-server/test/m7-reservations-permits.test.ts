import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';
import { RESERVATION_EXT } from '../src/routes/reservations.js';

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

const auth = () => ({ authorization: `Bearer ${token}` });

describe('reservations (thin profile over native routes)', () => {
  it('quote → book → amend → check-in → session e2e', async () => {
    // 1. Quote via the NATIVE APDS route.
    const quote = await ctx.app.inject({
      method: 'POST',
      url: '/quotes',
      headers: auth(),
      payload: { quoteRequestId: 'q-1', requestTime: new Date().toISOString() },
    });
    expect(quote.statusCode).toBe(200);
    expect(quote.json().responseTime).toBeTypeOf('string');

    // 2. Book via NATIVE POST /rights/assigned with the reservation extension.
    const booked = await ctx.app.inject({
      method: 'POST',
      url: '/rights/assigned',
      headers: auth(),
      payload: {
        rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
        issuer: { id: IDS.org, className: 'Organisation' },
        extensions: {
          [RESERVATION_EXT]: {
            reservationState: 'confirmed',
            plannedStart: '2027-01-01T10:00:00Z',
            plannedEnd: '2027-01-01T18:00:00Z',
          },
        },
      },
    });
    expect(booked.statusCode).toBe(201);
    const reservation = booked.json();

    // 3. Amend via NATIVE change-mode PUT.
    const amended = await ctx.app.inject({
      method: 'PUT',
      url: `/rights/assigned/${reservation.id}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: {
        extensions: {
          [RESERVATION_EXT]: {
            reservationState: 'amended',
            plannedStart: '2027-01-01T12:00:00Z',
            plannedEnd: '2027-01-01T20:00:00Z',
          },
        },
      },
    });
    expect(amended.json().extensions[RESERVATION_EXT].reservationState).toBe('amended');

    // 4. Check-in: creating a NATIVE Session referencing the AssignedRight.
    const session = await ctx.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: auth(),
      payload: {
        placeRef: { id: IDS.place, className: 'Place' },
        segments: [
          {
            assignedRight: { id: reservation.id, version: 3, className: 'AssignedRight' },
            actualStart: new Date().toISOString(),
          },
        ],
      },
    });
    expect(session.statusCode).toBe(201);

    const after = await ctx.app.inject({
      method: 'GET',
      url: `/rights/assigned/${reservation.id}`,
      headers: auth(),
    });
    const ext = after.json().extensions[RESERVATION_EXT];
    expect(ext.reservationState).toBe('checkedIn');
    expect(ext.checkInSession).toMatchObject({ className: 'Session' });
  });

  it('no-show sweep transitions overdue confirmations and publishes the event', async () => {
    const observer = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: { transport: 'sse', topics: ['apx.reservation.noshow.v1'] },
      })
    ).json();

    await ctx.app.inject({
      method: 'POST',
      url: '/rights/assigned',
      headers: auth(),
      payload: {
        rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
        issuer: { id: IDS.org, className: 'Organisation' },
        extensions: {
          [RESERVATION_EXT]: {
            reservationState: 'confirmed',
            plannedStart: '2020-01-01T10:00:00Z',
          },
        },
      },
    });

    const sweep = await ctx.app.inject({
      method: 'POST',
      url: '/apx/x/sandbox/reservations/sweep',
      headers: auth(),
    });
    expect(sweep.json().sweptCount).toBeGreaterThanOrEqual(1);

    const events = ctx.dispatcher.buffered(observer.id);
    expect(events.some((e) => e.envelope.type === 'apx.reservation.noshow.v1')).toBe(true);
  });
});

describe('customer reservation history', () => {
  it('returns the same customer’s reservations by plate, newest first, capped at 10', async () => {
    const byPlate = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/reservations/recent?plate=SYN-1234',
      headers: auth(),
    });
    const initial = byPlate.json().data;
    expect(initial).toHaveLength(2);
    expect(initial[0].reservationState).toBe('checkedIn'); // 2026-07-01 before 2026-06-15
    expect(initial[0].plannedStart > initial[1].plannedStart).toBe(true);

    // Requires plate or holder.
    const bad = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/reservations/recent',
      headers: auth(),
    });
    expect(bad.statusCode).toBe(400);

    // Cap: create 11 more for the same holder → lookup returns exactly 10.
    for (let i = 1; i <= 11; i += 1) {
      await ctx.app.inject({
        method: 'POST',
        url: '/rights/assigned',
        headers: auth(),
        payload: {
          rightSpecification: { id: IDS.rightSpec, version: 1, className: 'RightSpecification' },
          issuer: { id: IDS.org, className: 'Organisation' },
          assignedRightHolder: {
            id: 'e4000000-0000-4000-8000-000000000011',
            className: 'RightHolder',
          },
          extensions: {
            [RESERVATION_EXT]: {
              reservationState: 'confirmed',
              plannedStart: `2027-03-${String(i).padStart(2, '0')}T09:00:00Z`,
            },
          },
        },
      });
    }
    const capped = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/reservations/recent?plate=SYN-1234',
      headers: auth(),
    });
    expect(capped.json().data).toHaveLength(10);
    expect(capped.json().data[0].plannedStart).toBe('2027-03-11T09:00:00Z');
  });
});

describe('permits (pooled RightSpecifications)', () => {
  it('pool availability → multi-vehicle issuance → exhaustion 409', async () => {
    const availability = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/permits/pools/${IDS.pooledRightSpec}/availability`,
      headers: auth(),
    });
    expect(availability.json()).toMatchObject({ capacity: 2, issued: 0, available: 2 });

    // Issue one permit valid for TWO vehicles (APDS annual-permit pattern).
    const issued = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/permits/issue',
      headers: auth(),
      payload: {
        rightSpecification: {
          id: IDS.pooledRightSpec,
          version: 1,
          className: 'RightSpecification',
        },
        holder: { id: 'e4000000-0000-4000-8000-000000000011', className: 'RightHolder' },
        credentials: [
          { credentialType: 'licensePlate', credentialIdentification: 'SYN-1111' },
          { credentialType: 'licensePlate', credentialIdentification: 'SYN-2222' },
        ],
      },
    });
    expect(issued.statusCode).toBe(201);
    expect(issued.json().credentials).toHaveLength(2);

    const after = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/permits/pools/${IDS.pooledRightSpec}/availability`,
      headers: auth(),
    });
    expect(after.json()).toMatchObject({ issued: 1, available: 1 });

    // Fill the pool, then expect exhaustion.
    await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/permits/issue',
      headers: auth(),
      payload: {
        rightSpecification: {
          id: IDS.pooledRightSpec,
          version: 1,
          className: 'RightSpecification',
        },
        holder: { id: 'e4000000-0000-4000-8000-000000000012', className: 'RightHolder' },
      },
    });
    const exhausted = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/permits/issue',
      headers: auth(),
      payload: {
        rightSpecification: {
          id: IDS.pooledRightSpec,
          version: 1,
          className: 'RightSpecification',
        },
        holder: { id: 'e4000000-0000-4000-8000-000000000013', className: 'RightHolder' },
      },
    });
    expect(exhausted.statusCode).toBe(409);
    expect(exhausted.json().type).toContain('pool-exhausted');
  });
});
