/**
 * The APX delivery fabric: subscription registry, HMAC-signed webhook
 * dispatch with the normative retry schedule, delivery ledger, and SSE
 * buffers. Shared by every domain (data, control, alerts, tolling…).
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  time: string;
  subject?: { id: string; className: string };
  data: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  version: number;
  endpoint?: string;
  topics: string[];
  transport: 'webhook' | 'sse';
  filters?: { places?: string[]; severityFloor?: string };
  secret: string;
  status: 'active' | 'paused' | 'failed';
}

export interface DeliveryRecord {
  deliveryId: string;
  eventId: string;
  attempts: number;
  status: 'delivered' | 'retrying' | 'failed';
  lastCode: number;
  time: string;
}

export interface BufferedEvent {
  seq: number;
  envelope: EventEnvelope;
}

const SEVERITY_ORDER = ['info', 'warning', 'minor', 'major', 'critical'];

/** Normative schedule (ms): 0s, 30s, 2m, 10m, 1h, then hourly to 24h. */
export const NORMATIVE_RETRY_SCHEDULE_MS: number[] = [
  0,
  30_000,
  120_000,
  600_000,
  3_600_000,
  ...Array.from({ length: 23 }, () => 3_600_000),
];

export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  header: string
): boolean {
  const match = /^v1=([0-9a-f]+)$/.exec(header ?? '');
  if (!match) return false;
  const expected = Buffer.from(sign(secret, timestamp, body));
  const actual = Buffer.from(match[1]!);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Dispatcher {
  readonly subscriptions = new Map<string, Subscription>();
  private readonly ledger = new Map<string, DeliveryRecord[]>();
  private readonly buffers = new Map<string, BufferedEvent[]>();
  private readonly listeners = new Map<string, Set<(event: BufferedEvent) => void>>();
  private readonly seqs = new Map<string, number>();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly retryScheduleMs: number[] = NORMATIVE_RETRY_SCHEDULE_MS,
    private readonly source = 'urn:apx:reference-server'
  ) {}

  createSubscription(input: Partial<Subscription> & { topics: string[] }): Subscription {
    const subscription: Subscription = {
      id: input.id ?? randomUUID(),
      version: 1,
      endpoint: input.endpoint,
      topics: input.topics,
      transport: input.transport ?? 'webhook',
      filters: input.filters,
      secret: input.secret ?? randomUUID().replaceAll('-', ''),
      status: 'active',
    };
    this.subscriptions.set(subscription.id, subscription);
    this.ledger.set(subscription.id, []);
    this.buffers.set(subscription.id, []);
    return subscription;
  }

  deliveries(subscriptionId: string): DeliveryRecord[] {
    return this.ledger.get(subscriptionId) ?? [];
  }

  buffered(subscriptionId: string): BufferedEvent[] {
    return this.buffers.get(subscriptionId) ?? [];
  }

  subscribeStream(subscriptionId: string, listener: (event: BufferedEvent) => void): () => void {
    let set = this.listeners.get(subscriptionId);
    if (!set) {
      set = new Set();
      this.listeners.set(subscriptionId, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  makeEnvelope(
    type: string,
    data: Record<string, unknown>,
    subject?: { id: string; className: string }
  ): EventEnvelope {
    return {
      id: randomUUID(),
      type,
      source: this.source,
      time: new Date().toISOString(),
      subject,
      data,
    };
  }

  /** Fire-and-forget publish; await idle() in tests. */
  publish(envelope: EventEnvelope, placeIds: string[] = []): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.status !== 'active') continue;
      if (!subscription.topics.includes(envelope.type)) continue;
      const placeFilter = subscription.filters?.places;
      if (placeFilter && !placeIds.some((id) => placeFilter.includes(id))) continue;
      const floor = subscription.filters?.severityFloor;
      const severity = envelope.data.severity;
      if (
        floor &&
        typeof severity === 'string' &&
        SEVERITY_ORDER.indexOf(severity) < SEVERITY_ORDER.indexOf(floor)
      ) {
        continue;
      }

      if (subscription.transport === 'sse') {
        const seq = (this.seqs.get(subscription.id) ?? 0) + 1;
        this.seqs.set(subscription.id, seq);
        const buffered: BufferedEvent = { seq, envelope };
        this.buffers.get(subscription.id)?.push(buffered);
        for (const listener of this.listeners.get(subscription.id) ?? []) listener(buffered);
      } else {
        const task = this.deliverWithRetry(subscription, envelope).catch(() => undefined);
        this.pending.add(task);
        void task.finally(() => this.pending.delete(task));
      }
    }
  }

  /** Await all in-flight webhook deliveries (test helper). */
  async idle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }

  private async deliverWithRetry(
    subscription: Subscription,
    envelope: EventEnvelope
  ): Promise<void> {
    const body = JSON.stringify(envelope);
    let lastCode = 0;
    for (let attempt = 0; attempt < this.retryScheduleMs.length; attempt += 1) {
      await sleep(this.retryScheduleMs[attempt]!);
      const timestamp = new Date().toISOString();
      try {
        const response = await fetch(subscription.endpoint!, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'apx-timestamp': timestamp,
            'apx-signature': `v1=${sign(subscription.secret, timestamp, body)}`,
            'apx-delivery-id': randomUUID(),
          },
          body,
        });
        lastCode = response.status;
      } catch {
        lastCode = 0;
      }
      const delivered = lastCode >= 200 && lastCode < 300;
      this.record(
        subscription.id,
        envelope.id,
        attempt + 1,
        delivered ? 'delivered' : 'retrying',
        lastCode
      );
      if (delivered) return;
    }
    this.record(subscription.id, envelope.id, this.retryScheduleMs.length, 'failed', lastCode);
    subscription.status = 'failed';
    this.publish(
      this.makeEnvelope('apx.subscription.failed.v1', {
        subscription: { id: subscription.id, className: 'ApxEventSubscription' },
      })
    );
  }

  private record(
    subscriptionId: string,
    eventId: string,
    attempts: number,
    status: DeliveryRecord['status'],
    lastCode: number
  ): void {
    const records = this.ledger.get(subscriptionId);
    if (!records) return;
    const existing = records.find((r) => r.eventId === eventId);
    if (existing) {
      existing.attempts = attempts;
      existing.status = status;
      existing.lastCode = lastCode;
      existing.time = new Date().toISOString();
    } else {
      records.push({
        deliveryId: randomUUID(),
        eventId,
        attempts,
        status,
        lastCode,
        time: new Date().toISOString(),
      });
    }
  }
}
