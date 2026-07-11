import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app.js';
import { IDS } from '../src/fixtures.js';
import { verifySignature } from '../src/events/dispatcher.js';

interface CapturedDelivery {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function makeSink(handler: (n: number) => number): {
  server: Server;
  url: () => string;
  captured: CapturedDelivery[];
} {
  const captured: CapturedDelivery[] = [];
  let count = 0;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      captured.push({ headers: req.headers, body });
      count += 1;
      res.statusCode = handler(count);
      res.end();
    });
  });
  return {
    server,
    url: () => {
      const address = server.address();
      if (typeof address === 'object' && address) return `http://127.0.0.1:${address.port}/hook`;
      throw new Error('sink not listening');
    },
    captured,
  };
}

let ctx: AppContext;
let token: string;

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0, 25, 50] }); // short schedule for tests
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

describe('delivery fabric', () => {
  it('stock APDS EventSubscription works and deliveries are HMAC-signed', async () => {
    const sink = makeSink(() => 200);
    await new Promise<void>((resolve) => sink.server.listen(0, resolve));

    // Stock APDS body: endpoint + topics only.
    const subscribeResponse = await ctx.app.inject({
      method: 'POST',
      url: '/webhooks',
      headers: auth(),
      payload: { endpoint: sink.url(), topics: ['RateUpdated'] },
    });
    expect(subscribeResponse.statusCode).toBe(201);
    const subscription = subscribeResponse.json();
    expect(subscription.secret).toBeTypeOf('string');

    await ctx.app.inject({
      method: 'PUT',
      url: `/rates/${IDS.rateTable}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: { note: 'event test' },
    });
    await ctx.dispatcher.idle();

    expect(sink.captured).toHaveLength(1);
    const delivery = sink.captured[0]!;
    const envelope = JSON.parse(delivery.body);
    expect(envelope.type).toBe('RateUpdated');
    expect(envelope.subject).toMatchObject({ id: IDS.rateTable, className: 'RateTable' });

    const signatureOk = verifySignature(
      subscription.secret,
      String(delivery.headers['apx-timestamp']),
      delivery.body,
      String(delivery.headers['apx-signature'])
    );
    expect(signatureOk).toBe(true);

    // Tampered body must fail verification.
    expect(
      verifySignature(
        subscription.secret,
        String(delivery.headers['apx-timestamp']),
        delivery.body + 'tamper',
        String(delivery.headers['apx-signature'])
      )
    ).toBe(false);

    sink.server.close();
  });

  it('retries a flaky sink then records delivered', async () => {
    const sink = makeSink((n) => (n === 1 ? 500 : 200));
    await new Promise<void>((resolve) => sink.server.listen(0, resolve));

    const subscription = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: { endpoint: sink.url(), topics: ['SessionCreated'] },
      })
    ).json();

    await ctx.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: auth(),
      payload: { placeRef: { id: IDS.place, className: 'Place' } },
    });
    await ctx.dispatcher.idle();

    expect(sink.captured.length).toBe(2);
    const ledger = (
      await ctx.app.inject({
        method: 'GET',
        url: `/webhooks/${subscription.id}/deliveries`,
        headers: auth(),
      })
    ).json();
    expect(ledger.data[0]).toMatchObject({ status: 'delivered', attempts: 2 });

    sink.server.close();
  });

  it('marks the subscription failed after exhausting retries and publishes apx.subscription.failed.v1', async () => {
    const sink = makeSink(() => 500);
    await new Promise<void>((resolve) => sink.server.listen(0, resolve));

    const subscription = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: { endpoint: sink.url(), topics: ['PlaceUpdated'] },
      })
    ).json();

    // A second SSE subscription observes the failure event.
    const observer = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: { transport: 'sse', topics: ['apx.subscription.failed.v1'] },
      })
    ).json();

    await ctx.app.inject({
      method: 'PUT',
      url: `/places/${IDS.place}`,
      headers: { ...auth(), 'apx-update-mode': 'change' },
      payload: { note: 'trigger' },
    });
    await ctx.dispatcher.idle();

    const list = (
      await ctx.app.inject({ method: 'GET', url: '/webhooks', headers: auth() })
    ).json();
    const failed = list.data.find((s: { id: string }) => s.id === subscription.id);
    expect(failed.status).toBe('failed');

    const observed = ctx.dispatcher.buffered(observer.id);
    expect(observed.some((e) => e.envelope.type === 'apx.subscription.failed.v1')).toBe(true);

    sink.server.close();
  });

  it('SSE delivers with Last-Event-ID resume', async () => {
    const subscription = (
      await ctx.app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: auth(),
        payload: { transport: 'sse', topics: ['AssignedRightCreated'] },
      })
    ).json();

    await ctx.app.inject({
      method: 'POST',
      url: '/rights/assigned',
      headers: auth(),
      payload: { issuer: { id: IDS.org, className: 'Organisation' } },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/rights/assigned',
      headers: auth(),
      payload: { issuer: { id: IDS.org, className: 'Organisation' } },
    });

    const buffered = ctx.dispatcher.buffered(subscription.id);
    expect(buffered).toHaveLength(2);

    // Resume after seq 1 over the live SSE endpoint.
    await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    const address = ctx.app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(
      `http://127.0.0.1:${port}/apx/v1/events/stream?subscription=${subscription.id}`,
      { headers: { ...auth(), 'last-event-id': '1', accept: 'text/event-stream' } }
    );
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('id: 2');
    expect(text).toContain('AssignedRightCreated');
    expect(text).not.toContain('id: 1\n');
    await reader.cancel();
  });

  it('plain APDS delete-subscription shape works (404 message per vendored spec)', async () => {
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: '/webhooks/00000000-0000-4000-8000-000000000000',
      headers: auth(),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ status: 'error', code: 404 });
  });
});
