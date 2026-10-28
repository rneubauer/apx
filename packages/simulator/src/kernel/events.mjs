/**
 * The Part 8 delivery fabric: envelopes, subscription matching with the
 * §8.5 place binding, signed webhook delivery on the §8.3 retry schedule,
 * the delivery ledger, SSE buffers with Last-Event-ID resume, pause/hold,
 * key rotation, and the §8.3 failure cascade.
 *
 * Endpoints are simulated by default: every subscription endpoint is a
 * "receiver" with an inbox and a programmable list of response codes
 * (`world.receivers`, or PUT /sim/receivers). With `network: true` an
 * endpoint that is not a known receiver is POSTed to for real.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ALL_TOPICS } from './spec.mjs';

// Delays between consecutive attempts (§8.3): 0s, 30s, 2m, 10m, 1h, then hourly within 24h of the first.
export const RETRY_DELAYS_MS = [0, 30_000, 120_000, 600_000, 3_600_000];
export const RETRY_WINDOW_MS = 24 * 3_600_000;
export const HOLD_WINDOW_MS = 24 * 3_600_000;
export const SSE_BUFFER_MIN = 1000;
export const SSE_BUFFER_MS = 15 * 60_000;
export const SECRET_MIN_BYTES = 32;

export const sign = (secret, timestamp, body) => 'v1=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

export class EventFabric {
  constructor(sim) {
    this.sim = sim;
    this.outbox = [];
    this.receivers = new Map(); // endpoint url → { codes: [], inbox: [], default: 200 }
    this.sseClients = new Map(); // subId → Set(writer)
    this.listeners = new Set();
    this.redactors = [];
    this.network = false;
  }

  /**
   * Register `fn(sub, envelope) → envelope`: what one subscription may
   * receive of an event its topic matched (a member its creating token
   * could not read is left out, Part 5 §5.9 rule 7). Domains register at
   * load; the outbox keeps the event whole.
   */
  addRedactor(fn) {
    this.redactors.push(fn);
  }

  get subs() {
    return this.sim.store.collection('subscriptions');
  }
  get ledger() {
    return this.sim.store.collection('deliveries');
  }

  reset(world) {
    this.outbox = [];
    this.receivers.clear();
    this.sseClients.clear();
    for (const [url, cfg] of Object.entries(world.receivers ?? {})) this.receiver(url, cfg);
  }

  receiver(url, cfg = {}) {
    const r = this.receivers.get(url) ?? { url, codes: [], inbox: [], default: 200, delayMs: 0 };
    if (cfg.codes) r.codes = [...cfg.codes];
    if (cfg.default !== undefined) r.default = cfg.default;
    if (cfg.delayMs !== undefined) r.delayMs = cfg.delayMs;
    this.receivers.set(url, r);
    return r;
  }

  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- publishing ----------

  /**
   * Publish an event. `place` is the §8.5 binding (a HierarchyElement id,
   * or null for an org-scoped event with `org`); when omitted it is derived
   * from data/subject in the normative order of precedence.
   */
  publish({ type, data, subject, place, org, dataschema, source, id, time, excludeSubscription }) {
    if (!ALL_TOPICS.has(type) && !type.includes('.')) throw new Error(`simulator bug: unregistered topic ${type}`);
    const envelope = {
      id: id ?? randomUUID(),
      type,
      source: source ?? this.sim.world.eventSource ?? `${this.sim.world.host ?? 'https://api.example'}/v1`,
      time: time ?? this.sim.clock.now(),
      ...(subject ? { subject } : {}),
      ...(dataschema ? { dataschema } : {}),
      data,
    };
    const binding = place !== undefined ? place : this.bindPlace(envelope);
    const record = { envelope, place: binding, org: org ?? null, deliveries: [] };
    this.outbox.push(record);
    if (this.outbox.length > 10000) this.outbox.shift();
    for (const sub of this.subs.all()) {
      if (excludeSubscription && sub.id === excludeSubscription) continue;
      if (!this.matches(sub, envelope, binding, org)) continue;
      this.enqueue(sub, this.redactors.reduce((env, fn) => fn(sub, env) ?? env, envelope), binding);
      record.deliveries.push(sub.id);
    }
    for (const l of this.listeners) l(envelope, record);
    return envelope;
  }

  bindPlace(envelope) {
    const h = this.sim.hierarchy;
    const d = envelope.data ?? {};
    const elementIds = Array.isArray(d.elementIds) ? d.elementIds.map((e) => (typeof e === 'string' ? e : e?.id)) : d.elementIds?.id ? [d.elementIds.id] : [];
    const candidates = [
      d.place?.id ?? (typeof d.place === 'string' ? d.place : undefined),
      d.source?.place,
      envelope.subject?.id,
      d.hierarchyElement?.id ?? (typeof d.hierarchyElement === 'string' ? d.hierarchyElement : undefined),
      d.chargingPoint?.id,
      d.device?.id,
      d.lane?.id,
      d.target?.id,
      ...elementIds,
    ].filter(Boolean);
    for (const c of candidates) if (h.has(c)) return c;
    return null;
  }

  /** §8.5: topic match, then grant/filter, then severity floor. */
  matches(sub, envelope, place, org) {
    if (sub.status === 'failed') return false;
    if (!sub.topics?.includes(envelope.type)) return false;
    const h = this.sim.hierarchy;
    const grant = sub._grant; // the creating token's apx_places snapshot
    const filterPlaces = sub.filters?.places;
    if (place) {
      if (!h.covers(grant, place)) return false; // never leak outside the grant
      if (filterPlaces?.length && !filterPlaces.some((f) => h.within(place, f))) return false;
    } else {
      if (filterPlaces?.length) return false; // unbound events match only unfiltered subscriptions
      if (org) {
        if (sub._org && org !== sub._org) return false; // organisation-scoped: that organisation's subscriptions
      } else if (!(Array.isArray(grant) && grant.includes('*'))) {
        return false; // no binding at all: when in doubt, drop rather than leak (§8.5(3))
      }
    }
    const floor = sub.filters?.severityFloor;
    if (floor && envelope.type.startsWith('apx.alert.')) {
      const order = ['info', 'warning', 'minor', 'major', 'critical'];
      if (order.indexOf(envelope.data?.severity) < order.indexOf(floor)) return false;
    }
    return true;
  }

  enqueue(sub, envelope, place) {
    if (sub.transport === 'sse') {
      this.pushSse(sub.id, envelope);
      return;
    }
    if (sub.status === 'paused') {
      this.subs.update(sub.id, (s) => ({ ...s, _held: [...(s._held ?? []), { envelope, heldAt: this.sim.clock.now() }] }), { bump: false });
      return;
    }
    this.startDelivery(sub.id, envelope);
  }

  // ---------- webhook delivery ----------

  startDelivery(subId, envelope) {
    const key = `${subId}:${envelope.id}`;
    const body = JSON.stringify(envelope);
    this.ledger.put({
      id: key,
      subscription: subId,
      eventId: envelope.id,
      body,
      attempts: 0,
      status: 'retrying',
      firstAttemptAt: null,
      attemptHistory: [],
      nextTimer: null,
    });
    this.attempt(key);
  }

  attempt(key) {
    const rec = this.ledger.get(key);
    if (!rec || rec.status === 'delivered' || rec.status === 'failed') return;
    const sub = this.subs.get(rec.subscription);
    if (!sub || sub.status === 'failed') return;
    const now = this.sim.clock.now();
    const deliveryId = randomUUID();
    const signingKey = this.signingKey(sub);
    const inRotation = (sub._keys ?? []).filter((k) => !k.retiredAt).length > 1;
    const headers = {
      'content-type': 'application/json',
      'apx-signature': sign(signingKey.secret, now, rec.body),
      'apx-timestamp': now,
      'apx-delivery-id': deliveryId,
      ...(inRotation ? { 'apx-key-id': signingKey.keyId } : {}),
    };
    const n = rec.attempts + 1;
    const finish = (code) => {
      const r = this.ledger.get(key);
      if (!r) return;
      const attempt = { deliveryId, time: now, code };
      const delivered = code >= 200 && code < 300;
      const firstAt = r.firstAttemptAt ?? now;
      const elapsed = Date.parse(now) - Date.parse(firstAt);
      let status = delivered ? 'delivered' : 'retrying';
      let nextDelay = null;
      if (!delivered) {
        nextDelay = RETRY_DELAYS_MS[n] ?? 3_600_000;
        if (elapsed + nextDelay > RETRY_WINDOW_MS) {
          status = 'failed';
          nextDelay = null;
        }
      }
      this.ledger.put({ ...r, attempts: n, status, lastCode: code, time: now, firstAttemptAt: firstAt, attemptHistory: [...r.attemptHistory, attempt], lastDeliveryId: deliveryId });
      if (status === 'retrying') {
        const timer = this.sim.clock.schedule({ delay: nextDelay }, () => this.attempt(key), `webhook retry ${key} #${n + 1}`);
        this.ledger.put({ ...this.ledger.get(key), nextTimer: timer });
      } else if (status === 'failed') {
        this.subscriptionFailed(sub.id, this.ledger.get(key));
      }
    };
    const receiver = this.receivers.get(sub.endpoint);
    if (receiver || !this.network) {
      const r = receiver ?? this.receiver(sub.endpoint);
      const code = r.codes.length ? r.codes.shift() : r.default;
      r.inbox.push({ time: now, headers, body: rec.body, code, deliveryId, eventId: rec.eventId, subscription: sub.id });
      if (r.inbox.length > 1000) r.inbox.shift();
      finish(code);
      return;
    }
    fetch(sub.endpoint, { method: 'POST', headers, body: rec.body, signal: AbortSignal.timeout(10_000) })
      .then((res) => finish(res.status))
      .catch(() => finish(0));
  }

  signingKey(sub) {
    const active = (sub._keys ?? []).filter((k) => !k.retiredAt);
    return active[active.length - 1] ?? { keyId: 'k1', secret: 'unset' };
  }

  subscriptionFailed(subId, rec) {
    const sub = this.subs.get(subId);
    if (!sub || sub.status === 'failed') return;
    const now = this.sim.clock.now();
    // Server-assigned `failed` is version-neutral: the client never wrote it.
    const failed = this.subs.update(subId, (s) => ({ ...s, status: 'failed', _failedAt: now, _failure: { eventId: rec.eventId, attempts: rec.attempts, lastCode: rec.lastCode } }), { bump: false });
    for (const r of this.ledger.find((d) => d.subscription === subId && d.status === 'retrying')) {
      if (r.nextTimer) this.sim.clock.cancel(r.nextTimer);
      this.ledger.put({ ...r, status: 'failed', nextTimer: null });
    }
    const data = {
      subscription: { id: subId, className: 'ApxEventSubscription' },
      endpoint: failed.endpoint,
      failedTime: now,
      firstFailedEventId: rec.eventId,
      attempts: rec.attempts,
      lastCode: rec.lastCode,
    };
    this.publish({ type: 'apx.subscription.failed.v1', data, subject: data.subscription, place: null, org: failed._org, excludeSubscription: subId });
    this.sim.hooks.emit('subscription.failed', { subscription: failed, failure: data });
  }

  /** Resume a paused subscription: deliver held events in order, dropping those older than 24h. */
  resume(subId) {
    const sub = this.subs.get(subId);
    const held = sub?._held ?? [];
    this.subs.update(subId, (s) => ({ ...s, _held: [] }), { bump: false });
    const now = this.sim.clock.nowMs();
    for (const h of held) {
      if (now - Date.parse(h.heldAt) > HOLD_WINDOW_MS) continue;
      this.startDelivery(subId, h.envelope);
    }
  }

  /** The DeliveryRecord view of a ledger row. */
  deliveryRecord(r) {
    return {
      deliveryId: r.lastDeliveryId ?? r.attemptHistory.at(-1)?.deliveryId ?? randomUUID(),
      eventId: r.eventId,
      attempts: r.attempts,
      status: r.status,
      ...(r.lastCode !== undefined ? { lastCode: r.lastCode } : {}),
      time: r.time ?? this.sim.clock.now(),
      attemptHistory: r.attemptHistory.map((a) => ({ deliveryId: a.deliveryId, time: a.time, code: a.code })),
    };
  }

  // ---------- SSE ----------

  pushSse(subId, envelope) {
    const sub = this.subs.get(subId);
    if (!sub) return;
    const seq = (sub._sseSeq ?? 0) + 1;
    const frame = { seq, envelope, at: this.sim.clock.nowMs() };
    const buffer = [...(sub._sseBuffer ?? []), frame];
    const cutoff = this.sim.clock.nowMs() - SSE_BUFFER_MS;
    while (buffer.length > SSE_BUFFER_MIN && buffer[0].at < cutoff) buffer.shift();
    this.subs.update(subId, (s) => ({ ...s, _sseSeq: seq, _sseBuffer: buffer }), { bump: false });
    for (const w of this.sseClients.get(subId) ?? []) w(frame);
  }

  /** Frames after lastEventId; { expired: true } when the position is older than the buffer. */
  sseFrames(subId, lastEventId) {
    const sub = this.subs.get(subId);
    const buffer = sub?._sseBuffer ?? [];
    if (lastEventId === undefined || lastEventId === null || lastEventId === '') return { frames: buffer };
    const pos = Number(lastEventId);
    const oldest = buffer[0]?.seq ?? (sub?._sseSeq ?? 0) + 1;
    if (Number.isNaN(pos)) return { frames: buffer };
    if (pos < oldest - 1) return { expired: true, oldest };
    return { frames: buffer.filter((f) => f.seq > pos) };
  }

  attachSse(subId, writer) {
    if (!this.sseClients.has(subId)) this.sseClients.set(subId, new Set());
    this.sseClients.get(subId).add(writer);
    return () => this.sseClients.get(subId)?.delete(writer);
  }

  static frame(f) {
    return `id: ${f.seq}\ndata: ${JSON.stringify(f.envelope)}\n\n`;
  }

  // ---------- secrets ----------

  static mintSecret() {
    return randomBytes(SECRET_MIN_BYTES).toString('hex');
  }

  static secretStrongEnough(secret) {
    return typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= SECRET_MIN_BYTES;
  }
}
