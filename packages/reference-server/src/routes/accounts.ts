/**
 * APX accounts & payments (Part 13): lookup, take-payment, accounting
 * write-back, payment history with the 8-hour last-4 privacy window.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Store } from '../store.js';
import { problem, requireScope } from '../auth.js';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function registerAccountRoutes(app: FastifyInstance, store: Store): void {
  const accounts = () => store.for('Account');
  const payments = () => store.for('PaymentRecord');
  const idempotency = new Map<string, { bodyHash: string; paymentId: string }>();

  app.get('/v1/accounts', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.accounts:read')) return;
    const query = request.query as Record<string, string | undefined>;
    let list = accounts().list();
    if (query.name) {
      const name = query.name.toLowerCase();
      list = list.filter((a) => String(a.name ?? '').toLowerCase().includes(name));
    }
    if (query.phone) list = list.filter((a) => a.phone === query.phone);
    if (query.card) list = list.filter((a) => a.cardNumber === query.card);
    if (query.plate)
      list = list.filter((a) => (a.plates as string[] | undefined)?.includes(query.plate!));
    return reply.send({ data: list });
  });

  app.get('/v1/accounts/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.accounts:read')) return;
    const { id } = request.params as { id: string };
    try {
      return await reply.send(accounts().get(id));
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such account');
    }
  });

  app.post('/v1/payments', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.payments:write')) return;
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
      return reply.status(200).send(payments().get(seen.paymentId));
    }

    const amount = body.amount as { type?: string; value?: number } | undefined;
    if (!amount?.value || amount.value <= 0) {
      return problem(reply, 422, 'payment-declined', 'Invalid amount');
    }
    // Sandbox decline hook: value 13.13 simulates a processor decline.
    if (amount.value === 13.13) {
      return problem(reply, 422, 'payment-declined', 'Processor declined (sandbox rule)');
    }

    const accountRef = body.account as { id?: string } | undefined;
    let newBalance: { type: string; value: number } | undefined;
    if (accountRef?.id) {
      try {
        const account = accounts().get(accountRef.id);
        const balance = account.balance as { type: string; value: number };
        newBalance = { type: balance.type, value: Math.max(0, balance.value - amount.value) };
        accounts().applyChange(account.id, { balance: newBalance });
      } catch {
        return problem(reply, 404, 'target-not-found', 'No such account');
      }
    }

    const payment = payments().create({
      ...body,
      transactionID: `TXN-${randomUUID().slice(0, 8).toUpperCase()}`,
      dateCollected: new Date().toISOString(),
      paymentStatus: 'approved',
      postings: [],
    });
    idempotency.set(key, { bodyHash, paymentId: payment.id });
    return reply.status(201).send(payment);
  });

  app.post('/v1/payments/:id/postings', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.payments:write')) return;
    const { id } = request.params as { id: string };
    let payment;
    try {
      payment = payments().get(id);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such payment');
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const accountRef = (body.account ?? payment.account) as { id?: string } | undefined;
    let newBalance: unknown;
    if (accountRef?.id) {
      try {
        newBalance = accounts().get(accountRef.id).balance;
      } catch {
        newBalance = undefined;
      }
    }
    const posting = {
      confirmationNumber: `CONF-${randomUUID().slice(0, 8).toUpperCase()}`,
      accountUpdated: Boolean(accountRef?.id),
      newBalance,
      postedTo: String(body.postedTo ?? 'paris'),
      time: new Date().toISOString(),
    };
    const postings = [...(payment.postings as unknown[]), posting];
    payments().applyChange(id, { postings });
    return reply.status(201).send(posting);
  });

  app.get('/v1/payments', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.accounts:read')) return;
    const query = request.query as Record<string, string | undefined>;
    let list = payments().list();
    let truncatedLookup = false;
    if (query.ticketLast4) {
      truncatedLookup = true;
      list = list.filter((p) => String(p.ticketNumber ?? '').endsWith(query.ticketLast4!));
    }
    if (query.cardLast4) {
      // The transient-parker lookup of last resort: no LPR, no readable
      // ticket — only the tail digits of the card they paid with.
      truncatedLookup = true;
      list = list.filter((p) => String(p.cardLast4 ?? '').endsWith(query.cardLast4!));
    }
    if (truncatedLookup) {
      if (!query.date) {
        // Privacy rule: truncated-key lookups are constrained to the last 8 hours.
        const cutoff = new Date(Date.now() - EIGHT_HOURS_MS).toISOString();
        list = list.filter((p) => String(p.dateCollected) >= cutoff);
      } else {
        list = list.filter((p) => String(p.dateCollected).startsWith(query.date!));
      }
    }
    return reply.send({ data: list });
  });
}
