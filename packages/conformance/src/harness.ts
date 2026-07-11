/**
 * APX conformance harness. Runs against ANY base URL; suites map 1:1 to the
 * conformance classes the implementation claims in its bootstrap document.
 * Passing = the operational meaning of "implements APX".
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';

export interface CheckResult {
  name: string;
  conformanceClass: string;
  ok: boolean;
  detail: string;
}

export interface HarnessOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

function verifySignature(secret: string, timestamp: string, body: string, header: string): boolean {
  const match = /^v1=([0-9a-f]+)$/.exec(header ?? '');
  if (!match) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  );
  const actual = Buffer.from(match[1]!);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function runConformance(options: HarnessOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const record = (name: string, conformanceClass: string, ok: boolean, detail = '') =>
    results.push({ name, conformanceClass, ok, detail });

  const base = options.baseUrl.replace(/\/$/, '');

  // --- Bootstrap ---
  let config: { conformanceClasses?: string[]; tokenEndpoint?: string } = {};
  try {
    const response = await fetch(`${base}/.well-known/apx-configuration`);
    config = await response.json();
    record(
      'bootstrap document',
      'core',
      response.ok && Array.isArray(config.conformanceClasses) && Boolean(config.tokenEndpoint),
      `classes: ${config.conformanceClasses?.join(', ') ?? 'none'}`
    );
  } catch (error) {
    record('bootstrap document', 'core', false, String(error));
    return results;
  }
  const claimed = new Set(config.conformanceClasses ?? []);

  // --- Token ---
  const tokenUrl = new URL(config.tokenEndpoint!, `${base}/`).toString();
  let token = '';
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: options.clientId,
        client_secret: options.clientSecret,
      }),
    });
    const body = await response.json();
    token = body.access_token ?? '';
    record('oauth2 client-credentials token', 'core', response.ok && Boolean(token));
  } catch (error) {
    record('oauth2 client-credentials token', 'core', false, String(error));
    return results;
  }
  const authed = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        // Only declare a JSON body when one is actually sent (bodyless POSTs
        // must not claim a content type — strict parsers reject empty JSON).
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...((init.headers as Record<string, string>) ?? {}),
      },
    });

  // --- apx-data ---
  if (claimed.has('apx-data')) {
    const list = await authed('/places');
    const listBody = await list.json().catch(() => ({}));
    record(
      'native list returns PaginatedList shape (stock APDS)',
      'apx-data',
      list.ok &&
        typeof listBody.meta?.referenceInstant !== 'undefined' &&
        Array.isArray(listBody.data) &&
        !('cursor' in listBody),
      `total=${listBody.meta?.total}`
    );

    const feed = await authed('/places?mode=change');
    const feedBody = await feed.json().catch(() => ({}));
    const cursorOk = feed.ok && typeof feedBody.cursor === 'string';
    let replayOk = false;
    if (cursorOk) {
      const replay = await authed(`/places?mode=change&cursor=${feedBody.cursor}`);
      const replayBody = await replay.json().catch(() => ({}));
      replayOk = replay.ok && Array.isArray(replayBody.items) && replayBody.items.length === 0;
    }
    record('change feed issues a gapless cursor', 'apx-data', cursorOk && replayOk);

    const fixedId = randomUUID();
    const first = await authed('/contacts', {
      method: 'POST',
      body: JSON.stringify({ id: fixedId, name: 'conformance-probe' }),
    });
    const dup = await authed('/contacts', {
      method: 'POST',
      body: JSON.stringify({ id: fixedId, name: 'conformance-probe' }),
    });
    record(
      'client-supplied id collision is 409 (APDS convention)',
      'apx-data',
      first.status === 201 && dup.status === 409
    );

    // Tolerant reader / faithful writer: unknown extension keys are preserved.
    const extKey = 'apds-ext:conformance-probe:marker@1.0';
    const extProbe = await authed('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'ext-probe', extensions: { [extKey]: { probe: true } } }),
    });
    const extBody = await extProbe.json().catch(() => ({}));
    const readBack = await authed(`/contacts/${extBody.id}`);
    const readBody = await readBack.json().catch(() => ({}));
    record(
      'unknown extension keys preserved on round-trip',
      'apx-data',
      Boolean(readBody.extensions?.[extKey]?.probe)
    );
  }

  // --- apx-events ---
  if (claimed.has('apx-events')) {
    const captured: Array<{
      headers: Record<string, string | string[] | undefined>;
      body: string;
    }> = [];
    const sink: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        captured.push({ headers: req.headers, body });
        res.statusCode = 200;
        res.end();
      });
    });
    await new Promise<void>((resolve) => sink.listen(0, resolve));
    const address = sink.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const subscribe = await authed('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: `http://127.0.0.1:${port}/hook`,
        topics: ['OrganisationCreated'],
      }),
    });
    const subscription = await subscribe.json().catch(() => ({}));
    record(
      'stock APDS EventSubscription accepted',
      'apx-events',
      subscribe.status === 201 && typeof subscription.secret === 'string'
    );

    await authed('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'event-trigger-probe' }),
    });
    // Wait up to 5s for delivery.
    const deadline = Date.now() + 5000;
    while (captured.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const delivery = captured[0];
    let signatureOk = false;
    if (delivery) {
      signatureOk = verifySignature(
        subscription.secret,
        String(delivery.headers['apx-timestamp']),
        delivery.body,
        String(delivery.headers['apx-signature'])
      );
    }
    record(
      'webhook delivered with valid HMAC signature',
      'apx-events',
      Boolean(delivery) && signatureOk,
      delivery ? '' : 'no delivery within 5s'
    );
    if (subscription.id) await authed(`/webhooks/${subscription.id}`, { method: 'DELETE' });
    sink.close();
  }

  // --- apx-alerts ---
  if (claimed.has('apx-alerts')) {
    const noKey = await authed('/apx/v1/alerts', {
      method: 'POST',
      body: JSON.stringify({ alertType: 'deviceFault', severity: 'info' }),
    });
    record('alert raise without Idempotency-Key is 400', 'apx-alerts', noKey.status === 400);

    const key = `conf-${randomUUID()}`;
    const payload = JSON.stringify({ alertType: 'deviceFault', severity: 'info' });
    const first = await authed('/apx/v1/alerts', {
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: payload,
    });
    const firstBody = await first.json().catch(() => ({}));
    const replay = await authed('/apx/v1/alerts', {
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: payload,
    });
    const replayBody = await replay.json().catch(() => ({}));
    record(
      'alert raise is idempotent (replay returns original)',
      'apx-alerts',
      first.status === 201 && replay.status === 200 && firstBody.id === replayBody.id
    );

    const resolve = await authed(`/apx/v1/alerts/${firstBody.id}/resolve`, { method: 'POST' });
    const resolveBody = await resolve.json().catch(() => ({}));
    record(
      'alert lifecycle transition appends to statusHistory',
      'apx-alerts',
      resolve.ok &&
        resolveBody.status === 'resolved' &&
        Array.isArray(resolveBody.statusHistory) &&
        resolveBody.statusHistory.length >= 2
    );
  }

  // --- apx-control ---
  if (claimed.has('apx-control')) {
    const noKey = await authed('/apx/v1/commands', {
      method: 'POST',
      body: JSON.stringify({
        commandType: 'displayMessage',
        target: { id: randomUUID(), className: 'SupplementalEquipment' },
      }),
    });
    record('command without Idempotency-Key is 400', 'apx-control', noKey.status === 400);

    // Find a real device target through the device overlay.
    let targetId: string | undefined;
    const devices = await authed('/apx/v1/devices');
    if (devices.ok) {
      const body = await devices.json().catch(() => ({}));
      targetId = body.data?.[0]?.device?.id;
    }
    if (targetId) {
      const command = await authed('/apx/v1/commands', {
        method: 'POST',
        headers: { 'idempotency-key': `conf-${randomUUID()}` },
        body: JSON.stringify({
          commandType: 'displayMessage',
          target: { id: targetId, className: 'SupplementalEquipment' },
          parameters: { message: 'conformance probe' },
        }),
      });
      const commandBody = await command.json().catch(() => ({}));
      let terminal = false;
      const deadline = Date.now() + 5000;
      while (!terminal && Date.now() < deadline) {
        const poll = await authed(`/apx/v1/commands/${commandBody.id}`);
        const state = (await poll.json().catch(() => ({}))).status;
        terminal = ['succeeded', 'failed', 'expired', 'cancelled', 'rejected'].includes(state);
        if (!terminal) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      record(
        'command reaches a terminal lifecycle state (202 + async execution)',
        'apx-control',
        command.status === 202 && terminal
      );
    } else {
      record(
        'command reaches a terminal lifecycle state',
        'apx-control',
        false,
        'no device discoverable'
      );
    }
  }

  // --- apx-discovery ---
  if (claimed.has('apx-discovery')) {
    const discovery = await authed('/apx/v1/discovery');
    const doc = await discovery.json().catch(() => ({}));
    record(
      'discovery document reflects this credential',
      'apx-discovery',
      discovery.ok &&
        doc.client === options.clientId &&
        Array.isArray(doc.endpoints) &&
        doc.endpoints.length > 0
    );
  }

  return results;
}
