import Fastify, { type FastifyInstance } from 'fastify';
import { Store } from './store.js';
import { CLIENTS, seed } from './fixtures.js';
import { issueToken, problem } from './auth.js';
import { Dispatcher } from './events/dispatcher.js';
import { registerDataRoutes } from './routes/data.js';
import { registerWebhookRoutes } from './routes/webhooks.js';

export interface AppOptions {
  /** Override the normative webhook retry schedule (tests use a short one). */
  retryScheduleMs?: number[];
}

export interface AppContext {
  app: FastifyInstance;
  store: Store;
  dispatcher: Dispatcher;
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
      conformanceClasses: ['apx-data', 'apx-events', 'apx-events-sse'],
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

  registerDataRoutes(app, store, dispatcher);
  registerWebhookRoutes(app, dispatcher);

  return { app, store, dispatcher };
}
