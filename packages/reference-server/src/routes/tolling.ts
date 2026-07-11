/**
 * APX tolling (Part 15): TollTransaction binding Observations → pricing →
 * Payment, with dispute lifecycle and fabric events.
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Dispatcher } from '../events/dispatcher.js';
import type { Store } from '../store.js';
import { problem, requireScope } from '../auth.js';
import { IDS } from '../fixtures.js';

export function registerTollingRoutes(
  app: FastifyInstance,
  store: Store,
  dispatcher: Dispatcher
): void {
  const transactions = () => store.for('TollTransaction');
  const idempotency = new Map<string, { bodyHash: string; transactionId: string }>();

  const publish = (topic: string, transaction: Record<string, unknown>) => {
    dispatcher.publish(
      dispatcher.makeEnvelope(topic, transaction, {
        id: String(transaction.id),
        className: 'TollTransaction',
      }),
      [IDS.place]
    );
  };

  const transition = (
    id: string,
    state: string,
    actor: string,
    extra: Record<string, unknown> = {}
  ) => {
    const transaction = transactions().get(id);
    const history = [...(transaction.statusHistory as unknown[])];
    history.push({ state, time: new Date().toISOString(), actor });
    const updated = transactions().applyChange(id, {
      transactionStatus: state,
      statusHistory: history,
      ...extra,
    });
    publish('apx.tolling.transaction.status.v1', updated);
    return updated;
  };

  app.post('/apx/v1/tolling/transactions', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.tolling:manage');
    if (!principal) return;
    const key = request.headers['idempotency-key'] as string | undefined;
    if (!key) {
      return problem(reply, 400, 'idempotency-key-required', 'Idempotency-Key header is required');
    }
    const body = request.body as Record<string, unknown>;
    const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const seen = idempotency.get(key);
    if (seen) {
      if (seen.bodyHash !== bodyHash) {
        return problem(reply, 409, 'idempotency-conflict', 'Key replayed with a different body');
      }
      return reply.status(200).send(transactions().get(seen.transactionId));
    }
    if (!(body.tollPoint as { id?: string } | undefined)?.id) {
      return problem(reply, 400, 'target-not-found', 'tollPoint Reference is required');
    }
    const now = new Date().toISOString();
    const transaction = transactions().create({
      ...body,
      transactionStatus: body.pricing ? 'priced' : 'created',
      statusHistory: [
        { state: 'created', time: now, actor: principal.clientId },
        ...(body.pricing ? [{ state: 'priced', time: now, actor: principal.clientId }] : []),
      ],
    });
    idempotency.set(key, { bodyHash, transactionId: transaction.id });
    publish('apx.tolling.transaction.created.v1', transaction);
    return reply.status(201).send(transaction);
  });

  app.get('/apx/v1/tolling/transactions', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.tolling:manage')) return;
    const query = request.query as Record<string, string | undefined>;
    let list = transactions().list();
    if (query.plate) {
      list = list.filter(
        (t) =>
          (t.credential as { credentialIdentification?: string } | undefined)
            ?.credentialIdentification === query.plate
      );
    }
    if (query.status) list = list.filter((t) => t.transactionStatus === query.status);
    return reply.send({ data: list });
  });

  app.get('/apx/v1/tolling/transactions/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.tolling:manage')) return;
    const { id } = request.params as { id: string };
    try {
      return await reply.send(transactions().get(id));
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such toll transaction');
    }
  });

  app.post('/apx/v1/tolling/transactions/:id/payment', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.tolling:manage')) return;
    const { id } = request.params as { id: string };
    try {
      transactions().get(id);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such toll transaction');
    }
    const { payment } = (request.body ?? {}) as { payment?: unknown };
    if (!payment) return problem(reply, 400, 'target-not-found', 'payment Reference required');
    return reply.send(transition(id, 'paid', 'server', { payment }));
  });

  app.post('/apx/v1/tolling/transactions/:id/disputes', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.tolling:manage');
    if (!principal) return;
    const { id } = request.params as { id: string };
    let transaction;
    try {
      transaction = transactions().get(id);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such toll transaction');
    }
    const status = String(transaction.transactionStatus);
    if (status === 'resolved' || status === 'voided') {
      return problem(reply, 409, 'dispute-closed', `Cannot dispute a ${status} transaction`);
    }
    const { reason } = (request.body ?? {}) as { reason?: string };
    return reply.send(
      transition(id, 'disputed', principal.clientId, {
        dispute: { reason: reason ?? 'unspecified', openedTime: new Date().toISOString() },
      })
    );
  });

  app.post('/apx/v1/tolling/transactions/:id/disputes/resolve', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.tolling:manage');
    if (!principal) return;
    const { id } = request.params as { id: string };
    let transaction;
    try {
      transaction = transactions().get(id);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such toll transaction');
    }
    if (String(transaction.transactionStatus) !== 'disputed') {
      return problem(reply, 409, 'dispute-closed', 'No open dispute on this transaction');
    }
    const { resolution } = (request.body ?? {}) as { resolution?: string };
    const dispute = {
      ...(transaction.dispute as Record<string, unknown>),
      resolvedTime: new Date().toISOString(),
      resolution: resolution ?? 'upheld',
    };
    return reply.send(transition(id, 'resolved', principal.clientId, { dispute }));
  });
}
