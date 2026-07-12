import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  return response.json().access_token;
}

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0], deviceDelayMs: 5, dispatchDelayMs: 25 });
  token = await getToken('apx-operator', 'operator-secret');
});

afterAll(async () => {
  await ctx.app.close();
});

const auth = (extra: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  ...extra,
});

async function pollUntilTerminal(id: string, timeoutMs = 2000): Promise<Record<string, unknown>> {
  const terminal = new Set(['succeeded', 'failed', 'expired', 'cancelled', 'rejected']);
  const start = Date.now();
  for (;;) {
    const response = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/commands/${id}`,
      headers: auth(),
    });
    const command = response.json();
    if (terminal.has(command.status)) return command;
    if (Date.now() - start > timeoutMs) throw new Error(`command ${id} not terminal in time`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('flagship call-center flow (2018 Required tier)', () => {
  it('screen-pop → validation providers → applyValidation → vendGate → fault → alert', async () => {
    // 1. Lane inquiry (screen-pop).
    const lane = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/lanes/${IDS.laneExit}/current`,
      headers: auth(),
    });
    expect(lane.statusCode).toBe(200);
    const laneState = lane.json();
    expect(laneState.currentTicket.ticketNumber).toBe('T-1001');
    expect(laneState.currentTicket.amountDue).toMatchObject({ type: 'USD', value: 9 });
    expect(laneState.currentTicket.lpr.plate).toBe('SYN-1234');
    expect(laneState.monthlyCredential.accessGranted).toBe(false);
    expect(laneState.monthlyCredential.recentEvents).toHaveLength(10);

    // 2. Validation providers at the place.
    const providers = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/validations/providers?place=${IDS.place}`,
      headers: auth(),
    });
    expect(providers.json().data).toHaveLength(2);
    const provider = providers.json().data[0].provider;

    // 3. Apply a validation to the ticket.
    const validation = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'val-1' }),
      payload: {
        commandType: 'applyValidation',
        target: { id: IDS.laneExit, className: 'VehicularAccess' },
        parameters: { ticket: 'T-1001', provider },
      },
    });
    expect(validation.statusCode).toBe(202);
    const validated = await pollUntilTerminal(validation.json().id);
    expect(validated.status).toBe('succeeded');

    // 4. Vend the exit gate.
    const vend = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'vend-1' }),
      payload: {
        commandType: 'vendGate',
        target: { id: IDS.laneExit, className: 'VehicularAccess' },
        reason: 'customer assistance',
      },
    });
    expect(vend.statusCode).toBe(202);
    const vended = await pollUntilTerminal(vend.json().id);
    expect(vended.status).toBe('succeeded');
    const states = (vended.statusHistory as Array<{ state: string }>).map((h) => h.state);
    expect(states).toEqual(['received', 'accepted', 'dispatched', 'executing', 'succeeded']);

    // 5. Force the pay station into fault (sandbox vendor extension) → auto alert.
    const fault = await ctx.app.inject({
      method: 'POST',
      url: `/apx/x/sandbox/devices/${IDS.payStation}/state`,
      headers: auth(),
      payload: { state: 'fault' },
    });
    expect(fault.json().deviceState).toBe('fault');

    const alerts = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/alerts?type=deviceFault',
      headers: auth(),
    });
    const found = alerts
      .json()
      .data.find(
        (a: { source?: { device?: { id?: string } } }) => a.source?.device?.id === IDS.payStation
      );
    expect(found).toBeDefined();
    expect(found.severity).toBe('major');

    // 6. Device status overlay reflects the fault.
    const device = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/devices/${IDS.payStation}`,
      headers: auth(),
    });
    expect(device.json().deviceState).toBe('fault');
  });
});

describe('command plane rules', () => {
  it('requires Idempotency-Key and deduplicates', async () => {
    const noKey = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth(),
      payload: {
        commandType: 'vendGate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
      },
    });
    expect(noKey.statusCode).toBe(400);

    const payload = {
      commandType: 'lostTicket',
      target: { id: IDS.laneEntry, className: 'VehicularAccess' },
      parameters: { method: 'flatFee' },
    };
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'lt-1' }),
      payload,
    });
    const replay = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'lt-1' }),
      payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(first.json().id);
  });

  it('expires perishable commands instead of firing late', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'exp-1' }),
      payload: {
        commandType: 'vendGate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
        expiryTime: '2020-01-01T00:00:00Z',
      },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe('expired');
  });

  it('cancels within the dispatch window; refuses after terminal', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'cancel-1' }),
      payload: {
        commandType: 'displayMessage',
        target: { id: IDS.payStation, className: 'SupplementalEquipment' },
        parameters: { message: 'please wait' },
      },
    });
    const cancelled = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/commands/${created.json().id}/cancel`,
      headers: auth(),
    });
    expect(cancelled.json().status).toBe('cancelled');

    // Still cancelled after the dispatch timer fires (no zombie execution).
    await new Promise((resolve) => setTimeout(resolve, 60));
    const after = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/commands/${created.json().id}`,
      headers: auth(),
    });
    expect(after.json().status).toBe('cancelled');

    const again = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/commands/${created.json().id}/cancel`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(409);
  });

  it('pushRate validates the RateTable reference', async () => {
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'rate-bad' }),
      payload: {
        commandType: 'pushRate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
        parameters: { rateTable: { id: '00000000-0000-4000-8000-00000000dead', version: 1 } },
      },
    });
    const result = await pollUntilTerminal(bad.json().id);
    expect(result.status).toBe('failed');

    const good = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'rate-good' }),
      payload: {
        commandType: 'pushRate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
        parameters: { rateTable: { id: IDS.rateTable, version: 1 } },
      },
    });
    expect((await pollUntilTerminal(good.json().id)).status).toBe('succeeded');
  });

  it('rejects applyValidation from a provider not on the place list (422 validation-provider-unknown)', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'val-unknown' }),
      payload: {
        commandType: 'applyValidation',
        target: { id: IDS.laneExit, className: 'VehicularAccess' },
        parameters: {
          ticket: 'T-1001',
          provider: { id: '00000000-0000-4000-8000-00000000bad1', className: 'Organisation' },
        },
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().type).toContain('validation-provider-unknown');
  });

  it('an authorized validation lands on the lane state and reduces the amount due', async () => {
    const before = (
      await ctx.app.inject({
        method: 'GET',
        url: `/apx/v1/lanes/${IDS.laneExit}/current`,
        headers: auth(),
      })
    ).json();
    const validationsBefore = before.currentTicket.validations.length;
    const dueBefore = before.currentTicket.amountDue.value;

    const providers = (
      await ctx.app.inject({
        method: 'GET',
        url: `/apx/v1/validations/providers?place=${IDS.place}`,
        headers: auth(),
      })
    ).json().data;

    const command = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: auth({ 'idempotency-key': 'val-lane-state' }),
      payload: {
        commandType: 'applyValidation',
        target: { id: IDS.laneExit, className: 'VehicularAccess' },
        parameters: { ticket: 'T-1001', provider: providers[1].provider }, // flatDiscount = -$3
      },
    });
    expect((await pollUntilTerminal(command.json().id)).status).toBe('succeeded');

    const after = (
      await ctx.app.inject({
        method: 'GET',
        url: `/apx/v1/lanes/${IDS.laneExit}/current`,
        headers: auth(),
      })
    ).json();
    expect(after.currentTicket.validations).toHaveLength(validationsBefore + 1);
    expect(after.currentTicket.amountDue.value).toBe(Math.max(0, dueBefore - 3));

    // The lookup discloses what each validation is WORTH (dispute evidence).
    expect(providers[0].benefit).toMatchObject({ description: 'First two hours comped', duration: 'PT2H' });
    expect(providers[1].benefit).toMatchObject({ amount: { type: 'USD', value: 3 } });

    // The applied entry carries the vendor identity AND the actual value taken off.
    const applied = after.currentTicket.validations.at(-1);
    expect(applied.providerName).toBe('Harbor Restaurant (synthetic)');
    expect(applied.validationType).toBe('flatDiscount');
    expect(applied.validationId).toMatch(/^VAL-/);
    expect(applied.amountReduced).toMatchObject({ type: 'USD', value: Math.min(3, dueBefore) });
  });

  it('enforces place grants (403 insufficient-grant for out-of-grant operator)', async () => {
    const otherToken = await getToken('other-operator', 'other-secret');
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/commands',
      headers: { authorization: `Bearer ${otherToken}`, 'idempotency-key': 'grant-1' },
      payload: {
        commandType: 'vendGate',
        target: { id: IDS.laneEntry, className: 'VehicularAccess' },
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().type).toContain('insufficient-grant');
  });
});
