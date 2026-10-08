/**
 * Who may see what in apx-validations (Part 20 §20.5, Part 9 §9.3a):
 * merchant confinement to the token's own provider, place-grant checks,
 * path-addressed lookups, and an Idempotency-Key ledger scoped to the
 * caller's organisation.
 */
import { fail } from '../../kernel/problems.mjs';
import { hashBody } from '../../kernel/store.mjs';

export const REDEEM = 'apx.validations:redeem';
const OPERATOR_SCOPES = ['apx.validations:read', 'apx.validations:manage'];
export const HIDDEN = 'No such resource visible to this credential (Part 9 §9.3a rule 2).';

/** Organisations that operate a place in the hierarchy (the operator side). */
function operatorOrgs(sim) {
  const out = new Set();
  for (const node of sim.hierarchy.all('place')) if (node.operator) out.add(node.operator);
  if (sim.world.organisation?.id) out.add(sim.world.organisation.id);
  return out;
}

/**
 * The provider organisation a merchant token is confined to (§20.5), or
 * null for an operator token. A token is a merchant's when it carries
 * `redeem` without `read`/`manage`, or when its `apx_org` operates no
 * place (descriptive tokens inherit the operator's scopes).
 */
export function confinedTo(sim, principal) {
  if (!principal?.has(REDEEM)) return null;
  const org = principal.org?.id ?? null;
  if (!OPERATOR_SCOPES.some((s) => principal.has(s))) return org ?? '(no apx_org)';
  if (org && !operatorOrgs(sim).has(org)) return org;
  return null;
}

/** 403 insufficient-scope for an operator-only action attempted by a merchant token. */
export function requireOperator(ctx, what) {
  const org = confinedTo(ctx.sim, ctx.principal);
  if (org) fail('insufficient-scope', `${what} requires scope apx.validations:manage; a merchant token (apx.validations:redeem, apx_org ${org}) carries only its own provider's rights.`);
}

export const inGrant = (ctx, place) => Boolean(place) && ctx.principal.hasGrant && ctx.hierarchy.covers(ctx.principal.places, place);

/** A place named by a query parameter must be inside the grant (403 otherwise). */
export function requirePlaceParam(ctx, placeId) {
  if (!ctx.principal.hasGrant) fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');
  if (!ctx.hierarchy.covers(ctx.principal.places, placeId)) {
    if (!ctx.hierarchy.has(placeId)) fail('target-not-found', `No place ${placeId} visible to this credential.`);
    fail('insufficient-grant', `Place ${placeId} is not in the token's apx_places grant.`);
  }
}

/** Whether the caller may see a program's records (operator: yes; merchant: own provider only). */
export function owns(ctx, program) {
  const org = confinedTo(ctx.sim, ctx.principal);
  return !org || program?.provider?.id === org;
}

/** A program addressed by path id: 404 missing, 403 outside the place grant, 404 another provider's. */
export function visibleProgram(ctx, id) {
  const program = ctx.coll('validationPrograms').get(id);
  if (!program) fail('target-not-found', `No ValidationProgram ${id}.`);
  if (program._place && !inGrant(ctx, program._place)) {
    fail('insufficient-grant', `ValidationProgram ${id} is bound to place ${program._place}, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).`);
  }
  if (!owns(ctx, program)) fail('target-not-found', HIDDEN);
  return program;
}

/** A record (redemption, statement) addressed by path id, owned through its program. */
export function visibleRecord(ctx, collection, id, what) {
  const rec = ctx.coll(collection).get(id);
  if (!rec) fail('target-not-found', `No ${what} ${id}.`);
  if (rec._place && !inGrant(ctx, rec._place)) fail('insufficient-grant', `${what} ${id} is at place ${rec._place}, outside the token's apx_places grant.`);
  if (!owns(ctx, ctx.coll('validationPrograms').get(rec._program) ?? { provider: { id: rec._provider } })) fail('target-not-found', HIDDEN);
  return rec;
}

/**
 * Idempotency-Key ledger scoped to the caller's organisation, consulted
 * after the kernel's per-credential ledger: a merchant terminal's retry
 * replays even when it arrives on a fresh token of the same organisation.
 */
export function createIdemLedger() {
  const entries = new Map();
  const keyOf = (ctx) => `${ctx.principal.org?.id ?? ctx.principal.sub}|${ctx.op.operationId}|${ctx.idemKey}`;
  return {
    clear: () => entries.clear(),
    /** A 200 replay envelope, a 409, or null when the key is new. */
    replay(ctx, view) {
      if (!ctx.idemKey) return null;
      const hit = entries.get(keyOf(ctx));
      if (!hit) return null;
      if (hit.hash !== hashBody(ctx.body)) fail('idempotency-conflict', `Idempotency-Key ${ctx.idemKey} was first used at ${hit.time} with a different body.`);
      const rec = ctx.coll(hit.collection).get(hit.id);
      if (!rec) return null;
      return { status: 200, body: view(rec), headers: { 'x-sim-idempotent-replay': 'true' } };
    },
    remember(ctx, collection, id) {
      if (ctx.idemKey) entries.set(keyOf(ctx), { hash: hashBody(ctx.body), collection, id, time: ctx.now() });
    },
  };
}
