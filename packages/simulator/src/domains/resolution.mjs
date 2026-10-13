/**
 * apx-resolution (Part 17): resolution contexts composed from what the
 * other domains know, the server-side policy layer whose decisions bind
 * the command plane, and support interactions.
 *
 * Collections: resolutionContexts (hints `_place`, `_org`, `_subjects`
 * — the pinned lane/session/ticket/credential/holder/account/reservation,
 * `_expiresAt`, `_issue`, `_fingerprint`, `_pending`, `_overrides`, and
 * `_policy` — the map apx-control reads on POST /v1/commands);
 * supportInteractions (`_place`, `_org`, `_idempotencyKey`). Seeds
 * accessCredentials and assignedRights (reservations) defensively.
 *
 * World sections read: resolutionPolicy{} (see resolution/policy.mjs),
 * rightHolders[], reservations[] (seeded as assignedRights with
 * `_reservationCode`, `_plate`, `_reservationState`), accessCredentials[],
 * supportInteractions[] (`_idempotencyKey` for a create whose 201 was lost).
 *
 * Hooks consumed: command.transition, payment.recorded,
 * lane.vehicleArrives, lane.vehicleLeaves, device.state, courtesyExit,
 * credential.access, validation.applied, rate.pushed (and every clock
 * tick): each recomputes the live contexts, bumping `version` and
 * publishing apx.resolution.context.created.v1 on a material change.
 * Hook emitted: resolution.context { context, created }.
 */
import { fail } from '../kernel/problems.mjs';
import { parseDuration } from '../kernel/clock.mjs';
import { wire, refOf } from './common.mjs';
import { createComposer, IDENTIFIERS } from './resolution/compose.mjs';
import { evaluate, policyConfig } from './resolution/policy.mjs';
import { registerSupport } from './resolution/support.mjs';

const COLL = 'resolutionContexts';
const TOPIC = 'apx.resolution.context.created.v1';
const NO_GRANT = 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).';
const DENY_ALL = { _default: { allowed: false } };
const EXPIRED = { _default: { allowed: false }, _expired: true };

/** §17.2 scope projection: never a section the token could not read through its own route. */
function project(rec, principal) {
  const out = wire(rec);
  if (!principal) return out;
  if (!principal.has('apx.accounts:read')) {
    delete out.account;
    delete out.payments;
  }
  if (!principal.has('apx.control:read')) {
    for (const k of ['laneStatus', 'devices', 'passback', 'recentOverrides']) delete out[k];
  }
  if (!principal.has('apx.lpr:read')) delete out.vehicle;
  return out;
}

const fingerprint = (body) => JSON.stringify(body);

export default {
  name: 'resolution',
  register(sim) {
    const contexts = () => sim.store.collection(COLL);
    const composer = createComposer(sim);
    const cfg = () => policyConfig(sim.world);
    let courtesyExtra = new Map(); // holder → courtesies granted off-API (courtesyUsed injector)
    let sourceDelays = []; // [{ sources, ms, remaining }] (sourceDelay injector)

    // ---------- seeding ----------

    sim.seed((world) => {
      courtesyExtra = new Map();
      sourceDelays = [];
      const put = (name, row) => {
        const c = sim.store.collection(name);
        if (!c.has(row.id)) c.put(row);
      };
      const list = (v) => (Array.isArray(v) ? v : []); // another domain may use the same key for config
      for (const c of list(world.accessCredentials)) put('accessCredentials', { version: 1, ...c, _place: c._place ?? c.placeId });
      for (const r of list(world.reservations)) put('assignedRights', { version: 1, ...r, _place: r._place ?? r.placeId });
      for (const i of list(world.supportInteractions)) put('supportInteractions', { version: 1, ...i, _place: i._place ?? i.place?.id });
    });

    // ---------- the context lifecycle ----------

    const expired = (rec) => rec._expiresAt && sim.clock.nowMs() >= Date.parse(rec._expiresAt);

    const pendingFor = (rec) => (rec._pending && sim.clock.nowMs() < rec._pending.until ? rec._pending.sources : []);

    /** Compose the full body for a record; the policy is evaluated unless a source is still pending. */
    const build = (rec) => {
      const pending = pendingFor(rec);
      const { body, facts, issue } = composer.compose(rec, { cfg: cfg(), pending, extraCourtesy: (h) => courtesyExtra.get(h) ?? 0 });
      if (pending.length) return { body: { ...body, allowedActions: [] }, policy: DENY_ALL, issue };
      const { allowedActions, recommendedAction, policy } = evaluate(facts, cfg(), rec._overrides ?? []);
      return { body: { ...body, allowedActions, ...(recommendedAction ? { recommendedAction } : {}) }, policy, issue };
    };

    const assemble = (rec, built, computedAt) => ({
      id: rec.id,
      version: rec.version,
      computedAt,
      ...built.body,
      ...(rec.recordInfo ? { recordInfo: rec.recordInfo } : {}),
      ...Object.fromEntries(Object.entries(rec).filter(([k]) => k.startsWith('_'))),
      _issue: rec._issue ?? built.issue ?? undefined,
      _policy: built.policy,
      _fingerprint: fingerprint(built.body),
    });

    const publish = (rec) => {
      const data = project(rec, null);
      delete data.account;
      delete data.payments;
      sim.events.publish({ type: TOPIC, data, subject: refOf(rec.id, 'ResolutionContext'), place: rec._place });
      sim.hooks.emit('resolution.context', { context: rec });
    };

    /** GET semantics (§17.2): recompute; `version` increments only when something material changed. */
    const recompute = (id) => {
      const rec = contexts().get(id);
      if (!rec) return null;
      // A context seeded verbatim by a world fixture pins no subjects, so
      // there is nothing to recompose it from; it stays as written.
      if (!rec._subjects) return rec;
      if (expired(rec)) {
        if (!rec._policy?._expired) return contexts().update(id, (r) => ({ ...r, _policy: EXPIRED }), { bump: false });
        return rec;
      }
      const built = build(rec);
      const fp = fingerprint(built.body);
      if (fp === rec._fingerprint) {
        if (JSON.stringify(rec._policy) !== JSON.stringify(built.policy)) return contexts().update(id, (r) => ({ ...r, _policy: built.policy }), { bump: false });
        return rec;
      }
      const next = contexts().update(id, (r) => assemble(r, built, sim.clock.now()));
      publish(next);
      return next;
    };

    let recomputing = false;
    const recomputeLive = () => {
      if (recomputing) return;
      recomputing = true;
      try {
        for (const r of contexts().all()) recompute(r.id);
      } finally {
        recomputing = false;
      }
    };

    /** Create a context from resolved subjects (the POST route and the openContextFor injector). */
    const create = (subjects, meta, { assignedId, actor, issue } = {}) => {
      const now = sim.clock.now();
      const ttl = parseDuration(cfg().contextTtl);
      const delay = sourceDelays.find((d) => d.remaining > 0);
      const needsAccount = Boolean(subjects.holder || subjects.account || subjects.credential);
      let pending;
      if (delay && needsAccount) {
        delay.remaining -= 1;
        pending = { sources: delay.sources, until: sim.clock.nowMs() + delay.ms };
      }
      const seed = {
        ...(meta.interactionId ? { interactionId: meta.interactionId } : {}),
        ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
        _place: subjects.place,
        _org: actor?.org?.id,
        _subjects: subjects,
        _channel: meta.channel,
        _expiresAt: new Date(Date.parse(now) + ttl).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        ...(issue ? { _issue: issue } : {}),
        ...(pending ? { _pending: pending } : {}),
      };
      const draft = { id: 'draft', version: 1, ...seed };
      const built = build(draft);
      const { id: _id, version: _v, ...rest } = assemble(draft, built, now);
      const rec = contexts().insert(rest, { assignedId, actor });
      if (pending) sim.clock.schedule(pending.until, () => recompute(rec.id), `context ${rec.id} sources answer`);
      publish(rec);
      return rec;
    };

    const visibleContext = (ctx, id) => {
      const rec = contexts().get(id);
      if (!rec) fail('target-not-found', `No resolution context ${id}.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, rec._place)) {
        fail('insufficient-grant', `Context ${id} is anchored to place ${rec._place}, which is not in the token's apx_places grant.`);
      }
      if (expired(rec)) fail('target-not-found', `Context ${id} expired at ${rec._expiresAt}; re-resolve with POST /v1/resolution/contexts.`);
      return rec;
    };

    // ---------- routes ----------

    sim.on('post-apx-v1-resolution-contexts', (ctx) => {
      const b = ctx.body;
      const present = IDENTIFIERS.filter((k) => b[k] !== undefined && b[k] !== null && b[k] !== '');
      if (!present.length) {
        const telephony = ['phoneNumber', 'phone', 'sipUri', 'callerId'].filter((k) => b[k] !== undefined);
        const why = telephony.length ? `; ${telephony.join(', ')} is not an APX identifier and was ignored (Part 17 §17.1). Map the call to a lane or device on the call platform first.` : ` (${IDENTIFIERS.join(', ')}).`;
        fail('invalid-request', `No parking-domain identifier supplied${why}`, { errors: [{ pointer: '/', detail: 'at least one identifying member required' }] });
      }
      if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
      for (const k of ['lane', 'device', 'place']) {
        if (b[k] && ctx.hierarchy.has(b[k].id) && !ctx.hierarchy.covers(ctx.principal.places, b[k].id)) {
          fail('insufficient-grant', `${k} ${b[k].id} is not in the token's apx_places grant.`);
        }
      }
      const subjects = composer.resolveSubjects(b);
      if (!ctx.hierarchy.covers(ctx.principal.places, subjects.place)) {
        fail('insufficient-grant', `The interaction resolves to place ${subjects.place}, which is not in the token's apx_places grant.`);
      }
      const rec = create(subjects, b, { assignedId: ctx.assignId, actor: ctx.actor });
      return { status: 201, body: project(rec, ctx.principal) };
    });

    sim.on('get-apx-v1-resolution-contexts-id', (ctx) => {
      visibleContext(ctx, ctx.params.id);
      return project(recompute(ctx.params.id), ctx.principal);
    });

    sim.on('get-apx-v1-resolution-contexts-id-allowed-actions', (ctx) => {
      visibleContext(ctx, ctx.params.id);
      return { data: recompute(ctx.params.id).allowedActions ?? [] };
    });

    registerSupport(sim);

    // ---------- the world changes; the contexts follow ----------

    for (const hook of ['command.transition', 'payment.recorded', 'lane.vehicleArrives', 'lane.vehicleLeaves', 'device.state', 'courtesyExit', 'credential.access', 'validation.applied', 'rate.pushed', 'support.interaction']) {
      sim.hooks.on(hook, recomputeLive);
    }
    // Time-based rules (courtesy windows, night approval, expiry) move with the clock.
    sim.clock.onTick(recomputeLive);

    // ---------- injectors ----------

    /** The call platform (or the PARCS, preloading on a repeated denial) opens a context server-side. */
    sim.injector('openContextFor', ({ id, lane, device, place, plate, ticket, ticketNumber, phone, credential, session, holder, reservationCode, issue, interactionId, correlationId, channel = 'intercom' }) => {
      const asRef = (v, cls) => (v ? (typeof v === 'string' ? refOf(v, cls) : v) : undefined);
      const input = {
        lane: asRef(lane, 'VehicularAccess'),
        device: asRef(device, 'SupplementalEquipment'),
        place: asRef(place, 'Place'),
        session: asRef(session, 'Session'),
        credential: asRef(credential, 'Credential'),
        holder: asRef(holder, 'RightHolder'),
        plate,
        ticketNumber: ticketNumber ?? ticket,
        reservationCode,
      };
      if (phone && !input.holder) {
        const acct = sim.accounts?.accountsByPhone?.(phone)?.[0];
        if (!acct) throw new Error(`no account with phone ${phone}`);
        input.holder = acct.holder;
      }
      for (const k of Object.keys(input)) if (input[k] === undefined) delete input[k];
      if (!Object.keys(input).length) throw new Error('openContextFor needs lane, device, place, plate, ticket, phone, credential, session, holder, or reservationCode');
      const subjects = composer.resolveSubjects(input);
      const org = sim.hierarchy.operatorOf(subjects.place);
      const rec = create(subjects, { interactionId, correlationId, channel }, { assignedId: id, actor: { org: org ? refOf(org, 'Organisation') : undefined, user: sim.world.actors?.parcs ?? 'parcs' }, issue });
      return wire(rec);
    });

    /** Operator policy changes: one rule for one context ('*' = every context). */
    sim.injector('policyRule', ({ context = '*', commandType, action, allowed, requiresApproval, approvalRole, reason, issue }) => {
      const name = action ?? commandType;
      if (!name) throw new Error('policyRule needs commandType (or action)');
      const rule = { action: name, ...(allowed !== undefined ? { allowed } : {}), ...(requiresApproval !== undefined ? { requiresApproval } : {}), ...(approvalRole ? { approvalRole } : {}), ...(reason ? { reason } : {}), ...(issue ? { issue } : {}) };
      const targets = context === '*' ? contexts().all() : [contexts().get(context)].filter(Boolean);
      if (context !== '*' && !targets.length) throw new Error(`no context ${context}`);
      if (context === '*') sim.world.resolutionPolicy = { ...(sim.world.resolutionPolicy ?? {}), rules: [...(sim.world.resolutionPolicy?.rules ?? []), rule] };
      else contexts().update(context, (r) => ({ ...r, _overrides: [...(r._overrides ?? []).filter((o) => o.action !== name), rule] }), { bump: false });
      recomputeLive();
      return targets.map((r) => ({ context: r.id, allowedActions: contexts().get(r.id).allowedActions }));
    });

    /** Courtesy exits granted off-API (another system, a cash-desk waiver) count toward the holder's limit. */
    sim.injector('courtesyUsed', ({ holder, count = 1 }) => {
      if (!holder) throw new Error('courtesyUsed needs holder');
      courtesyExtra.set(holder, count);
      recomputeLive();
      return { holder, extraCourtesies: count };
    });

    /** An upstream source answers slowly: the next context(s) needing it are partial until it does. */
    sim.injector('sourceDelay', ({ sources = ['account-service'], ms = 8000, contexts: n = 1 }) => {
      sourceDelays = [{ sources, ms: typeof ms === 'number' ? ms : parseDuration(ms), remaining: n }];
      return { sources, ms, contexts: n };
    });
  },
};
