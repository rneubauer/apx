import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../../reference-server/src/app.js';
import { runConformance } from '../src/harness.js';

let ctx: AppContext;
let baseUrl: string;

beforeAll(async () => {
  ctx = buildApp({ retryScheduleMs: [0], deviceDelayMs: 5 });
  await ctx.app.listen({ port: 0, host: '127.0.0.1' });
  const address = ctx.app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('conformance harness', () => {
  it('passes green against the reference server', async () => {
    const results = await runConformance({
      baseUrl,
      clientId: 'apx-operator',
      clientSecret: 'operator-secret',
    });
    const failures = results.filter((r) => !r.ok);
    expect(failures, JSON.stringify(failures, null, 2)).toHaveLength(0);
    // Suites ran for the classes the server claims.
    const classes = new Set(results.map((r) => r.conformanceClass));
    for (const expected of [
      'core',
      'apx-data',
      'apx-events',
      'apx-alerts',
      'apx-control',
      'apx-discovery',
    ]) {
      expect(classes).toContain(expected);
    }
  }, 30000);

  it('fails against a deliberately broken implementation', async () => {
    // A fake server that CLAIMS classes but violates the rules:
    // alerts don't require Idempotency-Key, lists have no meta, no id-collision 409.
    const broken = Fastify({ logger: false });
    broken.get('/.well-known/apx-configuration', async () => ({
      apxVersion: '0.0.1',
      apdsVersion: '4.1',
      tokenEndpoint: '/oauth/token',
      conformanceClasses: ['apx-data', 'apx-alerts'],
    }));
    broken.post('/oauth/token', async () => ({ access_token: 'fake-token', token_type: 'Bearer' }));
    broken.get('/places', async () => [{ id: 'not-paginated' }]);
    broken.post('/contacts', async (_request, reply) =>
      reply.status(201).send({ id: 'always-same' })
    );
    broken.get('/contacts/:id', async () => ({ id: 'always-same' }));
    broken.post('/v1/alerts', async (_request, reply) =>
      reply.status(201).send({ id: 'no-key-needed', status: 'raised' })
    );
    await broken.listen({ port: 0, host: '127.0.0.1' });
    const address = broken.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const results = await runConformance({
      baseUrl: `http://127.0.0.1:${port}`,
      clientId: 'x',
      clientSecret: 'y',
    });
    const failures = results.filter((r) => !r.ok);
    expect(failures.length).toBeGreaterThanOrEqual(3);

    await broken.close();
  }, 30000);
});
