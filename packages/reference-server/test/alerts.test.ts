import { createServer, type Server } from 'node:http';
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

function raise(payload: Record<string, unknown>, key: string) {
  return ctx.app.inject({
    method: 'POST',
    url: '/apx/v1/alerts',
    headers: auth({ 'idempotency-key': key }),
    payload,
  });
}

describe('alerts', () => {
  it('raise → webhook notify → acknowledge → resolve, with immutable history', async () => {
    const captured: string[] = [];
    const sink: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        captured.push(body);
        res.statusCode = 200;
        res.end();
      });
    });
    await new Promise<void>((resolve) => sink.listen(0, resolve));
    const address = sink.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    await ctx.app.inject({
      method: 'POST',
      url: '/webhooks',
      headers: auth(),
      payload: {
        endpoint: `http://127.0.0.1:${port}/hook`,
        topics: ['apx.alert.raised.v1', 'apx.alert.status.v1'],
      },
    });

    const raised = await raise(
      {
        alertType: 'deviceFault',
        severity: 'major',
        source: { device: { id: IDS.gateEntry, className: 'SupplementalEquipment' } },
      },
      'e2e-1'
    );
    expect(raised.statusCode).toBe(201);
    const alert = raised.json();
    expect(alert.status).toBe('raised');
    expect(alert.statusHistory).toHaveLength(1);

    const acknowledged = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/alerts/${alert.id}/acknowledge`,
      headers: auth(),
      payload: { detail: 'tech dispatched' },
    });
    expect(acknowledged.json().status).toBe('acknowledged');

    const resolved = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/alerts/${alert.id}/resolve`,
      headers: auth(),
    });
    expect(resolved.json().status).toBe('resolved');
    expect(resolved.json().statusHistory).toHaveLength(3);
    expect(resolved.json().statusHistory[1].detail).toBe('tech dispatched');

    await ctx.dispatcher.idle();
    const types = captured.map((c) => JSON.parse(c).type);
    expect(types).toContain('apx.alert.raised.v1');
    expect(types.filter((t) => t === 'apx.alert.status.v1')).toHaveLength(2);

    // Terminal state: further transitions conflict.
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/apx/v1/alerts/${alert.id}/resolve`,
      headers: auth(),
    });
    expect(again.statusCode).toBe(409);

    sink.close();
  });

  it('requires Idempotency-Key and deduplicates replays', async () => {
    const noKey = await ctx.app.inject({
      method: 'POST',
      url: '/apx/v1/alerts',
      headers: auth(),
      payload: { alertType: 'overstay', severity: 'warning' },
    });
    expect(noKey.statusCode).toBe(400);
    expect(noKey.json().type).toContain('idempotency-key-required');

    const first = await raise({ alertType: 'overstay', severity: 'warning' }, 'dup-1');
    const replay = await raise({ alertType: 'overstay', severity: 'warning' }, 'dup-1');
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(first.json().id);

    const conflict = await raise({ alertType: 'overstay', severity: 'critical' }, 'dup-1');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().type).toContain('idempotency-conflict');
  });

  it('filters by severity floor and place subtree', async () => {
    await raise(
      { alertType: 'laneBlocked', severity: 'critical', source: { place: IDS.laneEntry } },
      'f-1'
    );
    await raise(
      { alertType: 'intercomRequest', severity: 'info', source: { place: IDS.laneEntry } },
      'f-2'
    );

    const bySeverity = await ctx.app.inject({
      method: 'GET',
      url: '/apx/v1/alerts?severityFloor=major',
      headers: auth(),
    });
    const severities = bySeverity.json().data.map((a: { severity: string }) => a.severity);
    expect(severities.every((s: string) => ['major', 'critical'].includes(s))).toBe(true);

    // Subtree: alerts on the entry LANE are found via the parent PLACE id.
    const byPlace = await ctx.app.inject({
      method: 'GET',
      url: `/apx/v1/alerts?place=${IDS.place}`,
      headers: auth(),
    });
    const types = byPlace.json().data.map((a: { alertType: string }) => a.alertType);
    expect(types).toContain('laneBlocked');
    expect(types).toContain('deviceFault'); // device alert, device is in the subtree
  });
});
