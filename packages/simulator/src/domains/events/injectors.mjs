/**
 * Injectors for apx-events: the world acting on the delivery fabric.
 *
 *   publishEvent        { type, data, subject?, place?, org?, id?, time?, count? }
 *                       publish an envelope as another domain would (place
 *                       null = unbound; omitted = derived by the §8.5 rule);
 *                       `count` publishes a burst of fresh envelopes
 *   subscriptionPolicy  { approval: 'auto' | 'operator' }   how a stock
 *                       POST /webhooks is answered: 200 activated, or 202
 *                       held (paused) for back-office approval
 *   approveSubscription { subscription, approve = true }    the operator's
 *                       decision on a 202: activate and release held events,
 *                       or decline (delete)
 *   sseCursor           { subscription, seq }   the stream had already
 *                       carried `seq` frames before the scenario began
 */
import { isKnownTopic } from './topics.mjs';

const MAX_BURST = 10_000;

export function registerInjectors(sim, { state, subs }) {
  sim.injector('publishEvent', (args) => {
    const { type, data, subject, org, id, time, dataschema } = args;
    if (!type || !isKnownTopic(type, sim.world.events?.vendorTopics ?? [])) throw new Error(`publishEvent: unknown topic ${type}`);
    if (!data || typeof data !== 'object') throw new Error('publishEvent: data (an object) is required');
    const count = Math.max(1, Math.min(MAX_BURST, Number(args.count ?? 1)));
    const place = Object.hasOwn(args, 'place') ? args.place : undefined;
    let last;
    for (let i = 0; i < count; i += 1) {
      last = sim.events.publish({ type, data, subject, place, org, dataschema, time, id: count === 1 ? id : undefined });
    }
    const record = sim.events.outbox.at(-1);
    return { published: count, last: { id: last.id, type: last.type, time: last.time }, place: record?.place ?? null, deliveredTo: record?.deliveries ?? [] };
  });

  sim.injector('subscriptionPolicy', ({ approval }) => {
    if (!['auto', 'operator'].includes(approval)) throw new Error("subscriptionPolicy: approval must be 'auto' or 'operator'");
    state.approval = approval;
    return { approval };
  });

  sim.injector('approveSubscription', ({ subscription, approve = true }) => {
    const rec = subs().get(subscription);
    if (!rec) throw new Error(`no subscription ${subscription}`);
    if (!rec._pending) throw new Error(`subscription ${subscription} is not awaiting approval`);
    if (!approve) {
      subs().delete(subscription);
      return { subscription, declined: true };
    }
    subs().update(subscription, (s) => ({ ...s, status: 'active', _pending: undefined }), { bump: false });
    sim.events.resume(subscription);
    return { subscription, status: 'active' };
  });

  sim.injector('sseCursor', ({ subscription, seq }) => {
    const rec = subs().get(subscription);
    if (!rec) throw new Error(`no subscription ${subscription}`);
    if (rec.transport !== 'sse') throw new Error(`subscription ${subscription} has transport ${rec.transport}`);
    if (!Number.isInteger(seq) || seq < (rec._sseSeq ?? 0)) throw new Error('sseCursor: seq must be an integer at or after the current sequence');
    subs().update(subscription, (s) => ({ ...s, _sseSeq: seq }), { bump: false });
    return { subscription, seq };
  });
}
