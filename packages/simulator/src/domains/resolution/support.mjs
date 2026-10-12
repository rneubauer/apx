/**
 * Part 17 §17.6: support interactions — summaries and action references,
 * never transcripts. Create (optional Idempotency-Key), list by subject or
 * correlation key, read one, complete with PUT under Part 4 §4.2a.
 * `apx.support.interaction.recorded.v1` publishes on create and on every
 * update; `version` tells them apart.
 */
import { fail } from '../../kernel/problems.mjs';
import { paginate, wire, refOf, getVisible, placeOfTarget, checkPrecondition, parseInstant } from '../common.mjs';

const COLL = 'supportInteractions';
const TOPIC = 'apx.support.interaction.recorded.v1';
const SERVER = ['id', 'version', 'recordInfo'];
const LIST_KEYS = ['plate', 'holder', 'account', 'session', 'place', 'correlationId', 'interactionId', 'credential'];
const AGENT_TYPES = ['human', 'ai'];
const norm = (p) => String(p ?? '').replace(/[\s-]/g, '').toUpperCase();

/** Order-insensitive JSON for comparing a retried body with a stored record. */
const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => !k.startsWith('_') && !SERVER.includes(k))
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
};

export function registerSupport(sim) {
  const coll = () => sim.store.collection(COLL);

  const publish = (rec) => sim.events.publish({ type: TOPIC, data: wire(rec), subject: refOf(rec.id, 'SupportInteraction'), place: rec._place });

  /** Server-assigned members are the server's: a client copy is dropped, not trusted. */
  const content = (b) => Object.fromEntries(Object.entries(b).filter(([k]) => !SERVER.includes(k) && !k.startsWith('_')));

  const checkBody = (ctx, b) => {
    if (!AGENT_TYPES.includes(b.agentType)) fail('invalid-request', 'agentType must be one of human, ai.', { errors: [{ pointer: '/agentType', detail: 'must be one of human, ai' }] });
    const started = parseInstant(b.startedAt, 'startedAt');
    const ended = parseInstant(b.endedAt, 'endedAt');
    if (ended !== undefined && ended < started) fail('request-unprocessable', `endedAt ${b.endedAt} precedes startedAt ${b.startedAt}.`);
    if (typeof b.summary === 'string' && b.summary.length > 2000) {
      fail('invalid-request', 'summary is a short outcome summary, not a transcript (Part 9 §9.6); keep it under 2000 characters.', { errors: [{ pointer: '/summary', detail: 'too long' }] });
    }
    return placeOfTarget(ctx, b.place, 'place').place;
  };

  /**
   * A record the world seeded as created under an Idempotency-Key (its 201
   * was lost before the replay began) answers a retry like the kernel's
   * ledger would: 200 with the record for the same body, 409 for another.
   */
  const seededReplay = (ctx) => {
    if (!ctx.idemKey) return null;
    const rec = coll().first((r) => r._idempotencyKey === ctx.idemKey);
    if (!rec) return null;
    if (canonical(content(ctx.body)) !== canonical(rec)) fail('idempotency-conflict', `Idempotency-Key ${ctx.idemKey} was first used with a different body (interaction ${rec.id}).`);
    return { status: 200, body: wire(rec), idem: { collection: COLL, id: rec.id } };
  };

  sim.on('post-apx-v1-support-interactions', (ctx) => {
    const b = ctx.body;
    const replay = seededReplay(ctx);
    if (replay) return replay;
    const place = checkBody(ctx, b);
    const rec = coll().insert(
      { ...content(b), _place: place.id, _org: ctx.principal.org?.id, ...(ctx.idemKey ? { _idempotencyKey: ctx.idemKey } : {}) },
      { assignedId: ctx.assignId, actor: { org: ctx.actor.org, user: b.agent ?? ctx.actor.user } }
    );
    publish(rec);
    sim.hooks.emit('support.interaction', { interaction: rec, created: true });
    return { status: 201, body: wire(rec), idem: { collection: COLL, id: rec.id } };
  });

  const visible = (ctx, id) => getVisible(ctx, COLL, id, { what: 'support interaction' });

  sim.on('get-apx-v1-support-interactions-id', (ctx) => wire(visible(ctx, ctx.params.id)));

  sim.on('put-apx-v1-support-interactions-id', (ctx) => {
    const cur = visible(ctx, ctx.params.id);
    checkPrecondition(ctx, cur);
    const b = ctx.body;
    const place = checkBody(ctx, b);
    const next = coll().update(cur.id, (r) => ({ ...content(b), id: r.id, recordInfo: r.recordInfo, _place: place.id, _org: r._org, ...(r._idempotencyKey ? { _idempotencyKey: r._idempotencyKey } : {}) }), {
      actor: { user: b.agent ?? ctx.actor.user },
    });
    publish(next);
    sim.hooks.emit('support.interaction', { interaction: next, created: false });
    return wire(next);
  });

  sim.on('get-apx-v1-support-interactions', (ctx) => {
    const q = (n) => ctx.query.get(n);
    if (!LIST_KEYS.some((k) => ctx.query.has(k))) {
      fail('invalid-request', `GET /v1/support/interactions needs at least one of ${LIST_KEYS.join(', ')}.`, { errors: [{ pointer: '/query', detail: 'no subject or correlation filter' }] });
    }
    const places = ctx.query.list('place');
    for (const id of places) {
      if (!ctx.hierarchy.has(id)) fail('target-not-found', `No place ${id} visible to this credential.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
    }
    const since = q('since') ? parseInstant(q('since'), 'since') : undefined;
    if (!ctx.principal.hasGrant) return paginate(ctx, []);
    const sub = (r, k) => r.subjects?.[k]?.id;
    const rows = coll()
      .find((r) => {
        if (r._place && !ctx.hierarchy.covers(ctx.principal.places, r._place)) return false;
        if (places.length && !places.some((p) => ctx.hierarchy.within(r._place, p))) return false;
        if (q('plate') && norm(r.subjects?.plate) !== norm(q('plate'))) return false;
        for (const k of ['holder', 'account', 'session', 'credential']) if (q(k) && sub(r, k) !== q(k)) return false;
        if (q('correlationId') && r.correlationId !== q('correlationId')) return false;
        if (q('interactionId') && r.interactionId !== q('interactionId')) return false;
        if (since !== undefined && Date.parse(r.startedAt) < since) return false;
        return true;
      })
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
    return paginate(ctx, rows);
  });

  sim.view(COLL, (r) => wire(r));
}
