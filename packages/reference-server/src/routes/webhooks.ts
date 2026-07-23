/**
 * Subscriptions at APDS's own /webhooks route (superset-compatible),
 * the delivery ledger, and the SSE stream.
 */
import type { FastifyInstance } from 'fastify';
import type { Dispatcher, Subscription } from '../events/dispatcher.js';
import { problem, requireScope } from '../auth.js';

export function registerWebhookRoutes(app: FastifyInstance, dispatcher: Dispatcher): void {
  app.post('/webhooks', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const body = request.body as Partial<Subscription> & { topics?: string[] };
    if (!Array.isArray(body.topics) || body.topics.length === 0) {
      return problem(reply, 400, 'unknown-topic', 'topics[] is required');
    }
    const transport = body.transport ?? 'webhook';
    if (transport === 'webhook' && !body.endpoint) {
      return problem(reply, 400, 'unknown-topic', 'endpoint is required for webhook transport');
    }
    const subscription = dispatcher.createSubscription({ ...body, topics: body.topics, transport });
    // The secret is returned exactly once, at creation (APX Part 8).
    return reply.status(201).send(subscription);
  });

  app.get('/webhooks', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const list = [...dispatcher.subscriptions.values()].map(({ secret: _secret, ...rest }) => rest);
    return reply.send({
      meta: {
        referenceInstant: Math.floor(Date.now() / 1000),
        offset: 0,
        pageSize: 100,
        total: list.length,
      },
      data: list,
    });
  });

  app.patch('/webhooks/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const { id } = request.params as { id: string };
    const subscription = dispatcher.subscriptions.get(id);
    if (!subscription) return problem(reply, 404, 'target-not-found', 'No such subscription');
    const body = request.body as Partial<Subscription>;
    if (body.topics) subscription.topics = body.topics;
    if (body.endpoint) subscription.endpoint = body.endpoint;
    if (body.filters) subscription.filters = body.filters;
    if (body.secret) subscription.secret = body.secret;
    if (body.status === 'active' || body.status === 'paused') subscription.status = body.status;
    subscription.version += 1;
    const { secret: _secret, ...rest } = subscription;
    return reply.send(rest);
  });

  app.delete('/webhooks/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const { id } = request.params as { id: string };
    if (!dispatcher.subscriptions.has(id)) {
      return reply
        .status(404)
        .send({ status: 'error', code: 404, message: 'a subscription with this id does not exist' });
    }
    dispatcher.subscriptions.delete(id);
    return reply.send({ status: 'ok', code: 200, message: 'subscription deleted' });
  });

  app.get('/webhooks/:id/deliveries', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const { id } = request.params as { id: string };
    if (!dispatcher.subscriptions.has(id)) {
      return problem(reply, 404, 'target-not-found', 'No such subscription');
    }
    return reply.send({ data: dispatcher.deliveries(id) });
  });

  // --- SSE stream (apx-events-sse) ---
  app.get('/v1/events/stream', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.subscriptions:manage')) return;
    const { subscription: subscriptionId } = request.query as { subscription?: string };
    const subscription = subscriptionId ? dispatcher.subscriptions.get(subscriptionId) : undefined;
    if (!subscription || subscription.transport !== 'sse') {
      return problem(reply, 404, 'target-not-found', 'No such SSE subscription');
    }

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    const lastEventId = Number(request.headers['last-event-id'] ?? 0);
    const write = (seq: number, payload: unknown) => {
      reply.raw.write(`id: ${seq}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    for (const buffered of dispatcher.buffered(subscription.id)) {
      if (buffered.seq > lastEventId) write(buffered.seq, buffered.envelope);
    }
    const unsubscribe = dispatcher.subscribeStream(subscription.id, (buffered) =>
      write(buffered.seq, buffered.envelope)
    );
    request.raw.on('close', () => {
      unsubscribe();
      reply.raw.end();
    });
    // Keep the connection open; fastify must not try to send a response.
    return reply.hijack();
  });
}
