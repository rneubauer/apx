/**
 * The /v1/enforcement surface: the §19.3 eligibility read, the §19.10
 * EnforcementPolicy resource (with `effective`), and the §19.11 Signage
 * resource (with `effective`). Policy and signage PUTs are versioned
 * (Part 4 §4.2a); creates take an Idempotency-Key the kernel enforces.
 */
import { fail } from '../../kernel/problems.mjs';
import { entry, getVisible, paginate, wire, checkPrecondition } from '../common.mjs';
import { evaluateEligibility } from './eligibility.mjs';
import { policies, signs, policyInForce, signageInForce, validatePolicyBody, validateSignageBody, withHistory } from './policy.mjs';
import { violations } from './timers.mjs';
import { toMs, iso, actorOf, bodyPlace, queryPlace, deepEqual } from './model.mjs';

const SERVER_MEMBERS = ['id', 'version', 'statusHistory', 'recordInfo'];
const writable = (b) => Object.fromEntries(Object.entries(b).filter(([k]) => !SERVER_MEMBERS.includes(k) && !k.startsWith('_')));

/** The members a PUT changed, for the statusHistory detail. */
const changed = (before, after) =>
  [...new Set([...Object.keys(writable(before)), ...Object.keys(after)])].filter((k) => !SERVER_MEMBERS.includes(k) && !k.startsWith('_') && !deepEqual(before[k], after[k]));

const atParam = (ctx) => {
  const at = ctx.query.get('at');
  return at ? toMs(at) : ctx.clock.nowMs();
};

/** List rows whose place lies in the grant and, when `place` is given, in its subtree. */
function listByPlace(ctx, coll, statusMember) {
  const place = ctx.query.has('place') ? queryPlace(ctx, ctx.query.get('place')) : null;
  const status = ctx.query.get('status');
  return coll
    .find((r) => {
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, r._place)) return false;
      if (place && !ctx.hierarchy.within(r._place, place.id)) return false;
      if (status && r[statusMember] !== status) return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * A create whose X-Sim-Assign-Id names a record the world already holds
 * for the same place: the cast was seeded with what this exchange creates
 * (the suite's narrative is not chronological), so the record is adopted
 * once instead of duplicated.
 */
function adoptSeeded(ctx, coll, b, sameAs) {
  const seeded = ctx.assignId ? coll.get(ctx.assignId) : null;
  if (!seeded?._seeded || seeded.place?.id !== b.place?.id || !sameAs(seeded)) return null;
  return coll.update(seeded.id, (r) => ({ ...r, _seeded: false }), { bump: false });
}

export function registerEnforcement(sim) {
  // ---------- eligibility (§19.3) ----------

  sim.on('get-apx-v1-enforcement-eligibility', (ctx) => {
    const node = queryPlace(ctx, ctx.query.get('place'));
    const credential = { credentialType: ctx.query.get('credentialType') ?? 'licensePlate', credentialIdentification: ctx.query.get('credential') };
    return evaluateEligibility(sim, { credential, placeId: node.id, atMs: atParam(ctx), principal: ctx.principal });
  });

  // Part 9 §9.6 rule 7: the same question with the credential in the body, never a URL. Same answer.
  sim.on('post-apx-v1-enforcement-eligibility-check', (ctx) => {
    const b = ctx.body;
    const node = queryPlace(ctx, b.place);
    const credential = { credentialType: b.credentialType ?? 'licensePlate', credentialIdentification: b.credential };
    return evaluateEligibility(sim, { credential, placeId: node.id, atMs: b.at ? toMs(b.at) : ctx.clock.nowMs(), principal: ctx.principal });
  });

  // ---------- policies (§19.10) ----------

  sim.view('enforcementPolicies', (r) => wire(r));
  sim.view('signage', (r) => wire(r));

  sim.on('post-apx-v1-enforcement-policies', (ctx) => {
    const b = ctx.body;
    const node = bodyPlace(ctx, b.place);
    validatePolicyBody(b);
    const adopted = adoptSeeded(ctx, policies(sim), b, (s) => s.name === b.name && s.effectiveFrom === b.effectiveFrom);
    if (adopted) return { status: 201, body: wire(adopted), idem: { collection: 'enforcementPolicies', id: adopted.id } };
    const now = ctx.clock.now();
    const rec = policies(sim).insert(
      { ...writable(b), statusHistory: [entry(b.policyStatus, now, actorOf(ctx))], _place: node.id },
      { assignedId: ctx.assignId, actor: ctx.actor }
    );
    const stored = policies(sim).update(rec.id, withHistory, { bump: false });
    return { status: 201, body: wire(stored), idem: { collection: 'enforcementPolicies', id: stored.id } };
  });

  sim.on('get-apx-v1-enforcement-policies', (ctx) => paginate(ctx, listByPlace(ctx, policies(sim), 'policyStatus')));

  sim.on('get-apx-v1-enforcement-policies-effective', (ctx) => {
    const node = queryPlace(ctx, ctx.query.get('place'));
    const atMs = atParam(ctx);
    const p = policyInForce(sim, node.id, atMs);
    if (!p) fail('target-not-found', `No EnforcementPolicy in force at ${node.id} or any ancestor at ${iso(atMs)}.`);
    return wire(p);
  });

  sim.on('get-apx-v1-enforcement-policies-id', (ctx) => wire(getVisible(ctx, 'enforcementPolicies', ctx.params.id, { what: 'EnforcementPolicy' })));

  sim.on('put-apx-v1-enforcement-policies-id', (ctx) => {
    const cur = getVisible(ctx, 'enforcementPolicies', ctx.params.id, { what: 'EnforcementPolicy' });
    checkPrecondition(ctx, cur);
    const b = ctx.body;
    const node = bodyPlace(ctx, b.place);
    validatePolicyBody(b);
    const now = ctx.clock.now();
    const next = writable(b);
    const diff = changed(cur, next);
    policies(sim).update(
      cur.id,
      (r) => ({
        id: r.id,
        ...next,
        statusHistory: [...(r.statusHistory ?? []), entry(b.policyStatus, now, actorOf(ctx), `v${r.version + 1}: ${diff.length ? diff.join(', ') : 'no change'}`)],
        recordInfo: r.recordInfo,
        _place: node.id,
        _history: r._history,
      }),
      { actor: ctx.actor }
    );
    return wire(policies(sim).update(cur.id, withHistory, { bump: false }));
  });

  // ---------- signage (§19.11) ----------

  sim.on('post-apx-v1-enforcement-signage', (ctx) => {
    const b = ctx.body;
    const node = bodyPlace(ctx, b.place);
    validateSignageBody(b);
    if (b.policy?.id && !policies(sim).has(b.policy.id)) fail('reference-unknown', `No EnforcementPolicy ${b.policy.id}.`);
    const adopted = adoptSeeded(ctx, signs(sim), b, (s) => deepEqual(s.text, b.text));
    if (adopted) return { status: 201, body: wire(adopted), idem: { collection: 'signage', id: adopted.id } };
    const rec = signs(sim).insert(
      { ...writable(b), statusHistory: [entry(b.signageStatus, ctx.clock.now(), actorOf(ctx))], _place: node.id },
      { assignedId: ctx.assignId, actor: ctx.actor }
    );
    return { status: 201, body: wire(rec), idem: { collection: 'signage', id: rec.id } };
  });

  sim.on('get-apx-v1-enforcement-signage', (ctx) => paginate(ctx, listByPlace(ctx, signs(sim), 'signageStatus')));

  sim.on('get-apx-v1-enforcement-signage-effective', (ctx) => {
    const node = queryPlace(ctx, ctx.query.get('place'));
    return { data: signageInForce(sim, node.id, atParam(ctx)).map(wire) };
  });

  sim.on('get-apx-v1-enforcement-signage-id', (ctx) => wire(getVisible(ctx, 'signage', ctx.params.id, { what: 'Signage' })));

  sim.on('put-apx-v1-enforcement-signage-id', (ctx) => {
    const cur = getVisible(ctx, 'signage', ctx.params.id, { what: 'Signage' });
    checkPrecondition(ctx, cur);
    const b = ctx.body;
    const node = bodyPlace(ctx, b.place);
    validateSignageBody(b);
    if (!deepEqual(cur.text, b.text)) {
      const frozen = violations(sim).find((v) => v.notice && (v.signage ?? []).some((s) => s.id === cur.id));
      if (frozen.length) {
        fail('signage-referenced', `Signage ${cur.id} v${cur.version} is frozen on ${frozen.length} issued violation${frozen.length > 1 ? 's' : ''} (e.g. ${frozen[0].id}); set effectiveTo and record the new wording as a new Signage.`);
      }
    }
    const now = ctx.clock.now();
    const next = writable(b);
    const diff = changed(cur, next);
    const detail = b.effectiveTo && b.effectiveTo !== cur.effectiveTo ? `in force until ${b.effectiveTo}` : `v${cur.version + 1}: ${diff.join(', ') || 'no change'}`;
    return wire(
      signs(sim).update(
        cur.id,
        (r) => ({ id: r.id, ...next, statusHistory: [...(r.statusHistory ?? []), entry(b.signageStatus, now, actorOf(ctx), detail)], recordInfo: r.recordInfo, _place: node.id }),
        { actor: ctx.actor }
      )
    );
  });
}
