/**
 * Shared vocabulary of the apx-violations module (Part 19): states, the
 * world's `enforcement` configuration, credential matching, instants, and
 * the few problem helpers every handler file uses.
 */
import { registryValues } from '../../kernel/spec.mjs';
import { fail } from '../../kernel/problems.mjs';

export const DAY_MS = 86_400_000;
export const TERMINAL = new Set(['dismissed', 'closed', 'voided']);
/** Violation types whose premise is "no entitlement": an entitled vehicle makes them moot (§19.1 rule 5). */
export const ENTITLEMENT_TYPES = new Set(['noValidRight', 'expiredRight', 'notYetValidRight', 'wrongPlace']);
const REGISTERED_TYPES = registryValues('apx-violation-types');
const PLATE_TYPES = new Set(['licensePlate', 'vehicleplate']);

export const TOPIC = {
  detected: 'apx.violations.detected.v1',
  issued: 'apx.violations.issued.v1',
  status: 'apx.violations.status.v1',
};

/** world.enforcement, with defaults. */
export function config(sim) {
  return {
    refundWindowDays: 30,
    noticePrefix: 'LG-2026-',
    noticeStart: 18301,
    actor: 'apx-server',
    scheduler: 'apx-scheduler',
    violationTypes: [],
    serviceArea: null,
    ...(sim.world.enforcement ?? {}),
  };
}

export const isKnownType = (sim, type) => REGISTERED_TYPES.includes(type) || config(sim).violationTypes.includes(type);

export const toMs = (value) => (value === undefined || value === null ? undefined : Date.parse(value));
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
export const fmt = (n) => Number(n).toFixed(2);
export const round2 = (n) => Math.round(Number(n) * 100) / 100;
export const short = (id) => (typeof id === 'string' && id.length > 8 ? `${id.slice(0, 2)}…${id.slice(-4)}` : String(id));
export const vref = (rec, className) => ({ id: rec.id, version: rec.version, className });
export const deepEqual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const normIdent = (s) => String(s ?? '').replace(/[\s-]/g, '').toUpperCase();

/** Whether two `{credentialType, credentialIdentification}` pairs name the same credential. */
export function sameCredential(a, b) {
  if (!a || !b) return false;
  if (normIdent(a.credentialIdentification) !== normIdent(b.credentialIdentification)) return false;
  return a.credentialType === b.credentialType || (PLATE_TYPES.has(a.credentialType) && PLATE_TYPES.has(b.credentialType));
}

/** APDS CredentialAssigned[] → `{credentialType, credentialIdentification}`[]. */
export const fromAssigned = (list) =>
  (list ?? []).filter((c) => c?.type && c.identifier?.id).map((c) => ({ credentialType: c.type, credentialIdentification: c.identifier.id }));

/** The actor string for statusHistory: the principal's user or subject. */
export const actorOf = (ctx) => ctx?.principal?.user ?? ctx?.principal?.sub ?? 'apx-client';

export const transitionIllegal = (detail) => fail('violation-transition-illegal', detail);

export function invalid(pointer, detail) {
  fail('invalid-request', detail, { errors: [{ pointer, detail: 'required' }] });
}

/** The node a body Reference names, or 422 reference-unknown; then the place grant (403). */
export function bodyPlace(ctx, reference, what = 'place') {
  const node = reference?.id ? ctx.hierarchy.get(reference.id) : null;
  if (!node) fail('reference-unknown', `No HierarchyElement ${reference?.id ?? '(none)'}.`);
  ensureGranted(ctx, node, what);
  return node;
}

/** A place named in the query: unknown → 404, outside the grant → 403 (Part 9 §9.3a rule 1). */
export function queryPlace(ctx, id) {
  const node = id ? ctx.hierarchy.get(id) : null;
  if (!node) fail('target-not-found', `No HierarchyElement ${id} visible to this credential.`);
  ensureGranted(ctx, node, 'place');
  return node;
}

export function ensureGranted(ctx, node, what = 'target') {
  if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, node.id)) {
    const owning = ctx.hierarchy.root(node.id) ?? node;
    fail('insufficient-grant', `Target belongs to place ${node.id} (${owning.name ?? what}), which is not in the token's apx_places grant.`);
  }
}

/** Whether `rec` (with effectiveFrom/effectiveTo) is in its window at `atMs`. */
export const inWindow = (rec, atMs) => toMs(rec.effectiveFrom) <= atMs && (!rec.effectiveTo || atMs < toMs(rec.effectiveTo));
