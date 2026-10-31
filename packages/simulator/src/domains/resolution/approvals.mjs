/**
 * Part 17 §17.3a: approval requests — an agent asks a role (the on-call
 * supervisor, the site manager) through the API, the role's console lists
 * what is pending and decides, and the agent executes with the decision
 * as the command's approval evidence. A request lapses at `expiresAt`.
 * Every change publishes `apx.approvals.changed.v1`.
 *
 * Collection: approvalRequests (`_place`, `_org`). World section read:
 * approvals[] (seeded requests, wire shape).
 */
import { fail } from '../../kernel/problems.mjs';
import { paginate, wire, refOf, getVisible, placeOfTarget, requireNode, isRef } from '../common.mjs';

export const COLL = 'approvalRequests';
const TOPIC = 'apx.approvals.changed.v1';
const MEMBERS = ['place', 'action', 'target', 'requestedBy', 'agentType', 'role', 'interactionId', 'correlationId', 'reason', 'expiresAt', 'extensions'];
const DEFAULT_TTL_MS = 15 * 60_000;

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

export function registerApprovals(sim) {
  const coll = () => sim.store.collection(COLL);

  const publish = (rec) => sim.events.publish({ type: TOPIC, data: wire(rec), subject: refOf(rec.id, 'ApprovalRequest'), place: rec._place });

  const lapse = (id) => {
    const rec = coll().get(id);
    if (!rec || rec.status !== 'pending') return rec;
    const next = coll().update(id, (r) => ({ ...r, status: 'expired' }), { actor: { user: 'apx-approvals' } });
    publish(next);
    sim.hooks.emit('approval.changed', { request: next });
    return next;
  };

  const arm = (rec) => {
    if (rec.status === 'pending' && rec.expiresAt) sim.clock.schedule(rec.expiresAt, () => lapse(rec.id), `approval ${rec.id} lapses`);
  };

  sim.seed((world) => {
    for (const a of world.approvals ?? []) {
      const rec = { version: 1, status: 'pending', ...a, _place: a._place ?? a.place?.id };
      coll().put(rec);
      arm(rec);
    }
  });

  sim.view(COLL, (r) => wire(r));

  const visible = (ctx, id) => getVisible(ctx, COLL, id, { what: 'approval request' });

  sim.on('post-apx-v1-approvals', (ctx) => {
    const b = ctx.body;
    const { place } = placeOfTarget(ctx, b.place, 'place');
    if (b.target && isRef(b.target) && sim.hierarchy.has(b.target.id)) requireNode(ctx, b.target, 'target');
    const now = ctx.clock.nowMs();
    const rec = coll().insert(
      {
        ...Object.fromEntries(MEMBERS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])),
        ...(b.id ? { id: b.id } : {}),
        status: 'pending',
        expiresAt: b.expiresAt ?? iso(now + DEFAULT_TTL_MS),
        _place: place.id,
        _org: ctx.principal.org?.id,
      },
      { assignedId: ctx.assignId, actor: { org: ctx.actor.org, user: b.requestedBy } }
    );
    arm(rec);
    publish(rec);
    sim.hooks.emit('approval.changed', { request: rec });
    return { status: 201, body: wire(rec), idem: { collection: COLL, id: rec.id } };
  });

  sim.on('get-apx-v1-approvals', (ctx) => {
    const q = (k) => ctx.query.get(k);
    const places = ctx.query.list('place');
    for (const id of places) {
      if (!ctx.hierarchy.has(id)) fail('target-not-found', `No place ${id} visible to this credential.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is outside the token's apx_places grant.`);
    }
    if (!ctx.principal.hasGrant) return paginate(ctx, []);
    const created = (r) => r.recordInfo?.creationTime ?? '';
    const rows = coll()
      .find((r) => {
        if (r._place && !ctx.hierarchy.covers(ctx.principal.places, r._place)) return false;
        if (places.length && !places.some((p) => sim.hierarchy.within(r._place, p))) return false;
        if (q('status') && r.status !== q('status')) return false;
        if (q('role') && r.role !== q('role')) return false;
        return true;
      })
      .sort((a, b) => (created(a) < created(b) ? 1 : created(a) > created(b) ? -1 : a.id.localeCompare(b.id)));
    return paginate(ctx, rows);
  });

  sim.on('get-apx-v1-approvals-id', (ctx) => wire(visible(ctx, ctx.params.id)));

  sim.on('post-apx-v1-approvals-id-decide', (ctx) => {
    const rec = visible(ctx, ctx.params.id);
    if (rec.status !== 'pending') {
      const d = rec.decision;
      fail('approval-closed', d ? `Request ${rec.id} was ${d.outcome} by ${d.decidedBy} at ${d.decidedAt}.` : `Request ${rec.id} ${rec.status === 'expired' ? `lapsed at ${rec.expiresAt}` : `is ${rec.status}`}.`);
    }
    const b = ctx.body;
    const decidedAt = b.decidedAt ?? ctx.now();
    const next = coll().update(rec.id, (r) => ({ ...r, status: b.outcome, decision: { decidedBy: b.decidedBy, decidedAt, outcome: b.outcome, ...(b.note ? { note: b.note } : {}) } }), { actor: { user: b.decidedBy } });
    publish(next);
    sim.hooks.emit('approval.changed', { request: next });
    return wire(next);
  });

  /** The role decides off-API (a phone call recorded by the supervisor's console): { request, outcome, decidedBy, note? }. */
  sim.injector('approvalDecided', ({ request, outcome = 'approved', decidedBy = 'sup:on-call', note }) => {
    const rec = coll().get(request);
    if (!rec) throw new Error(`no approval request ${request}`);
    if (rec.status !== 'pending') throw new Error(`request ${request} is ${rec.status}`);
    const next = coll().update(request, (r) => ({ ...r, status: outcome, decision: { decidedBy, decidedAt: sim.clock.now(), outcome, ...(note ? { note } : {}) } }), { actor: { user: decidedBy } });
    publish(next);
    sim.hooks.emit('approval.changed', { request: next });
    return wire(next);
  });

  sim.approvals = { get: (id) => coll().get(id) ?? null, lapse };
}
