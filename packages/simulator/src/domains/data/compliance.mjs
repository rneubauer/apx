/**
 * Part 5 §5.9: the stay-compliance decoration a compliance engine writes
 * on the native Session (`apds-ext:apx:stay-compliance@1.0`). The write
 * rules (1 family, 2 pendingStatus, 4 sequence, 5 policy), the scopes
 * that guard the block (7 read, 8 write), and what a token without
 * `apx.compliance:read` sees: the Session with the block left out, on the
 * native reads, the §5.2 change feed and the Session event deliveries.
 * The rules that score a stay stay in the engine; the simulator only
 * holds the outcome.
 */
import { fail } from '../../kernel/problems.mjs';
import { registryDescription, validateRequestSchema, fmtErrors, ajvToErrors } from '../../kernel/spec.mjs';
import { refuse, isObj } from './model.mjs';

export const STAY_COMPLIANCE = 'apds-ext:apx:stay-compliance@1.0';
const READ = 'apx.compliance:read';
const WRITE = 'apx.compliance:write';
const STATUSES = 'apx-stay-compliance-statuses';
const SESSION_EVENTS = new Set(['SessionCreated', 'SessionUpdated', 'SessionDeleted']);

/** The family the registry gives a status (its entryDescription opens "Family: x."); undefined for an implementer code. */
export const familyOf = (status) => registryDescription(STATUSES, status)?.match(/^Family: (\w+)\./)?.[1];

const blockOf = (rec) => rec?.extensions?.[STAY_COMPLIANCE];
const carries = (body) => isObj(body?.extensions) && Object.hasOwn(body.extensions, STAY_COMPLIANCE);

/** The record without the decoration, and without an `extensions` left empty by its removal. */
export function withoutCompliance(rec) {
  if (!carries(rec)) return rec;
  const { [STAY_COMPLIANCE]: _block, ...rest } = rec.extensions;
  const { extensions: _all, ...out } = rec;
  return Object.keys(rest).length ? { ...out, extensions: rest } : out;
}

/** A list envelope, a feed page or one Session, with the block left out of every Session in it. */
function redactBody(body) {
  if (!isObj(body)) return body;
  if (Array.isArray(body.data)) return { ...body, data: body.data.map(withoutCompliance) };
  if (Array.isArray(body.items)) return { ...body, items: body.items.map(withoutCompliance) };
  return withoutCompliance(body);
}

export function createCompliance(sim, engine) {
  const policies = () => sim.store.collection('enforcementPolicies');

  /** Rule 5: `policy` names an EnforcementPolicy the caller can see, at a version it has had. */
  function checkPolicy(ctx, ref) {
    if (!ref) return;
    const p = policies().get(ref.id);
    const visible = p && (!p._place || (ctx.principal.hasGrant && sim.hierarchy.covers(ctx.principal.places, p._place)));
    const hadVersion = visible && (ref.version === undefined || ref.version === p.version || Boolean(p._history?.[ref.version]));
    if (!hadVersion) refuse(ctx, 422, 'reference-unknown', `stay-compliance policy ${ref.id}${ref.version ? ` v${ref.version}` : ''} names no EnforcementPolicy visible to this credential.`);
  }

  /**
   * The checks a Session write carrying the decoration passes, in order:
   * the write scope (rule 8), the schema, the registry family (rule 1),
   * pendingStatus (rule 2), the sequence (rule 4), the policy (rule 5).
   * Any failure refuses the whole write. `held` is the block the Session
   * holds now (null on a create).
   */
  function checkWrite(ctx, block, held, sessionId) {
    if (!ctx.principal.has(WRITE)) fail('insufficient-scope', `Writing ${STAY_COMPLIANCE} requires ${WRITE}.`);
    if (block === null) refuse(ctx, 422, 'request-unprocessable', `${STAY_COMPLIANCE} has no removal; an engine that withdraws its score writes status unscored (Part 5 §5.9 rule 8).`);
    const errors = validateRequestSchema('StayCompliance', block);
    if (errors) refuse(ctx, 400, 'invalid-request', `${STAY_COMPLIANCE} fails the StayCompliance schema: ${fmtErrors(errors).slice(0, 300)}`, undefined, { errors: ajvToErrors(errors) });
    const family = familyOf(block.status);
    if (family && family !== block.family) refuse(ctx, 422, 'request-unprocessable', `stay-compliance status ${block.status} is family ${family} in ${STATUSES}; the write says ${block.family}.`);
    if (block.pendingStatus !== undefined && block.status !== 'reviewRequired') refuse(ctx, 422, 'request-unprocessable', 'pendingStatus is allowed only with status reviewRequired.');
    // `final` is never a lock (rule 4): only a lower sequence is refused; an equal one replaces.
    if (held && block.sequence < held.sequence) {
      refuse(ctx, 409, 'evaluation-out-of-order', `Session ${sessionId} holds stay-compliance sequence ${held.sequence}; the write carries sequence ${block.sequence}.`);
    }
    checkPolicy(ctx, block.policy);
  }

  /**
   * Before a native Session write: refuse a bad decoration, or carry the
   * stored block over a write that omits it (rule 8: a client that cannot
   * see the block cannot erase it). Returns the body to write.
   */
  function prepareWrite(ctx, current) {
    const body = ctx.body ?? {};
    const held = blockOf(current) ?? null;
    if (carries(body)) {
      checkWrite(ctx, body.extensions[STAY_COMPLIANCE], held, current?.id ?? body.id);
      return body;
    }
    const changeMode = String(ctx.headers['apx-update-mode'] ?? 'full').toLowerCase() === 'change';
    if (!held || (changeMode && !Object.hasOwn(body, 'extensions'))) return body;
    return { ...body, extensions: { ...(isObj(body.extensions) ? body.extensions : {}), [STAY_COMPLIANCE]: held } };
  }

  /** Wrap a Session create or update so the decoration rules run first; `idOf(ctx)` names the Session written. */
  const guardWrite = (handler, idOf) => (ctx) => {
    const current = engine.coll('sessions').get(idOf(ctx));
    // A Session outside the grant is the route's own 403; the decoration is not looked at.
    const visible = current && engine.covered(ctx.principal, engine.placesOf('sessions', current));
    const body = prepareWrite(ctx, visible ? current : null);
    return handler(body === ctx.body ? ctx : { ...ctx, body });
  };

  /** Wrap a Session read (one, a list, a feed page): the block is left out for a token without the read scope (rule 7). */
  const guardRead = (handler) => async (ctx) => {
    const out = await handler(ctx);
    if (ctx.principal?.has(READ)) return out;
    const envelope = isObj(out) && typeof out.status === 'number' && Object.hasOwn(out, 'body');
    return envelope ? { ...out, body: redactBody(out.body) } : redactBody(out);
  };

  // Rule 7 for deliveries: a subscription created by a token without the read scope gets the Session without the block.
  sim.events.addRedactor((sub, env) => {
    if (!SESSION_EVENTS.has(env.type) || !carries(env.data) || (sub._scopes ?? []).includes(READ)) return env;
    return { ...env, data: withoutCompliance(env.data) };
  });

  return { guardWrite, guardRead, familyOf, withoutCompliance };
}
