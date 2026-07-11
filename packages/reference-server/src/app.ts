import Fastify, { type FastifyInstance } from 'fastify';
import { Store } from './store.js';
import { CLIENTS, seed } from './fixtures.js';
import { issueToken, problem } from './auth.js';
import { Dispatcher } from './events/dispatcher.js';
import { registerDataRoutes } from './routes/data.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerAlertRoutes } from './routes/alerts.js';
import { registerControlRoutes } from './routes/control.js';
import { registerAccountRoutes } from './routes/accounts.js';
import { registerLprRoutes } from './routes/lpr.js';
import { makeCheckInHook, registerReservationRoutes } from './routes/reservations.js';
import { registerTollingRoutes } from './routes/tolling.js';
import { registerDiscoveryRoutes } from './routes/discovery.js';

const CONFORMANCE_CLASSES = [
  'apx-data',
  'apx-events',
  'apx-events-sse',
  'apx-alerts',
  'apx-control',
  'apx-accounts',
  'apx-payment-history',
  'apx-lpr',
  'apx-reservations',
  'apx-permits',
  'apx-tolling',
  'apx-discovery',
];
import { DeviceSimulator } from './devices-sim.js';

export interface AppOptions {
  /** Override the normative webhook retry schedule (tests use a short one). */
  retryScheduleMs?: number[];
  /** Simulated device action delay (default 500ms; tests use a short one). */
  deviceDelayMs?: number;
  /** Delay before a command is dispatched (cancellation window). */
  dispatchDelayMs?: number;
}

export interface AppContext {
  app: FastifyInstance;
  store: Store;
  dispatcher: Dispatcher;
  devices: DeviceSimulator;
}

export function buildApp(options: AppOptions = {}): AppContext {
  const app = Fastify({ logger: false });
  const store = new Store();
  const dispatcher = options.retryScheduleMs
    ? new Dispatcher(options.retryScheduleMs)
    : new Dispatcher();
  seed(store);

  // --- Toy OAuth2 token endpoint (sandbox only, loudly non-production) ---
  app.post('/oauth/token', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const client = CLIENTS.find(
      (c) => c.clientId === body.client_id && c.clientSecret === body.client_secret
    );
    if (!client || body.grant_type !== 'client_credentials') {
      return problem(reply, 400, 'unauthenticated', 'Invalid client credentials or grant type');
    }
    return reply.send({
      access_token: issueToken(client),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: client.scopes.join(' '),
    });
  });

  // --- Bootstrap configuration (RFC 8615) ---
  app.get('/.well-known/apx-configuration', async (_request, reply) => {
    return reply.send({
      apxVersion: '0.1.0',
      apdsVersion: '4.1',
      tokenEndpoint: '/oauth/token',
      conformanceClasses: CONFORMANCE_CLASSES,
      registries: {
        'apx-command-types': 'https://apx-standard.org/registries/apx-command-types.json',
        'apx-alert-types': 'https://apx-standard.org/registries/apx-alert-types.json',
        'apx-device-states': 'https://apx-standard.org/registries/apx-device-states.json',
        'apx-topics': 'https://apx-standard.org/registries/apx-topics.json',
        'apx-conformance-classes':
          'https://apx-standard.org/registries/apx-conformance-classes.json',
      },
    });
  });

  // Auto-raise alerts from simulated device faults (Part 6 §6.4 SHOULD).
  const raiseAlert = (data: Record<string, unknown>) => {
    const now = new Date().toISOString();
    const alert = store.for('Alert').create({
      ...data,
      status: 'raised',
      detectionTime: now,
      statusHistory: [{ state: 'raised', time: now, actor: 'facility-sim' }],
    });
    const source = data.source as { place?: string } | undefined;
    dispatcher.publish(
      dispatcher.makeEnvelope('apx.alert.raised.v1', alert, {
        id: String(alert.id),
        className: 'Alert',
      }),
      source?.place ? [source.place] : []
    );
  };
  const devices = new DeviceSimulator(store, dispatcher, options.deviceDelayMs ?? 500, raiseAlert);

  registerDataRoutes(app, store, dispatcher, makeCheckInHook(store));
  registerWebhookRoutes(app, dispatcher);
  registerAlertRoutes(app, store, dispatcher);
  registerControlRoutes(app, store, dispatcher, devices, options.dispatchDelayMs ?? 0);
  registerAccountRoutes(app, store);
  registerLprRoutes(app, store);
  registerReservationRoutes(app, store, dispatcher);
  registerTollingRoutes(app, store, dispatcher);
  registerDiscoveryRoutes(app, CONFORMANCE_CLASSES);

  return { app, store, dispatcher, devices };
}
