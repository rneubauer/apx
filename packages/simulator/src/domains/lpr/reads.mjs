/**
 * apx-lpr read routes (Part 13 §13.3, §13.3a(4a), §13.3b; Part 9 §9.6):
 * the cross-lookup by query (`GET /v1/lpr/reads`) and by body
 * (`POST /v1/lpr/reads:search`), the read-back by path
 * (`GET /v1/lpr/reads/{observation}`) and the reviewer's plate decision
 * on one read (`PUT /v1/lpr/reads/{observation}/plate`).
 *
 * Every route sweeps retention first, so a purged read is 404 / absent.
 */
import { fail } from '../../kernel/problems.mjs';
import { paginate, refOf, checkPrecondition, wire } from '../common.mjs';
import { READ_KEY } from './model.mjs';

const LOOKUP_KEYS = ['plate', 'ticket', 'observation', 'session'];
const PLATE_MEMBERS = ['plate', 'country', 'stateProvince'];
/** A value a reviewer typed is certain; the engine's confidence survives in review.original. */
const REVIEWER_CONFIDENCE = 1;

export function registerReadRoutes(sim, m) {
  const requireGrantOn = (ctx, id, what) => {
    if (!m.covered(ctx.principal, id)) fail('insufficient-grant', `${what} is not in the token's apx_places grant.`);
  };

  /** The one lookup behind the GET and the POST: same key rule, grants, and rows (§13.3). */
  function lookup(ctx, keys, route, pointerPrefix) {
    m.sweep();
    const { plate, ticket, observation, session: sessionId, place } = keys;
    if (!LOOKUP_KEYS.some((k) => keys[k])) {
      fail('invalid-request', `${route} requires plate, ticket, observation, or session.`, { errors: [{ pointer: `${pointerPrefix}plate`, detail: 'one of plate, ticket, observation, session is required' }] });
    }
    if (place) requireGrantOn(ctx, place, `Place ${place}`);
    const session = sessionId ? m.sessions().get(sessionId) : null;
    if (session) requireGrantOn(ctx, session._place, `Session ${session.id} at place ${session._place}`);
    if (!ctx.principal.hasGrant || (sessionId && !session)) return [];
    return m
      .reads()
      .filter((o) => {
        if (!m.covered(ctx.principal, m.bindingOf(o))) return false;
        if (observation && o.id !== observation) return false;
        if (plate && !m.plateMatches(o, plate)) return false;
        if (ticket && m.sessionOf(o)?._ticketNumber !== ticket) return false;
        if (session && m.sessionOf(o)?.id !== session.id) return false;
        if (place && !sim.hierarchy.within(m.bindingOf(o), place)) return false;
        return true;
      })
      .sort(m.newestFirst)
      .map(m.projectRead);
  }

  sim.on('get-apx-v1-lpr-reads', (ctx) => {
    const keys = Object.fromEntries([...LOOKUP_KEYS, 'place'].map((n) => [n, ctx.query.get(n)]));
    return paginate(ctx, lookup(ctx, keys, 'GET /v1/lpr/reads', '?'));
  });

  // Part 9 §9.6 rule 7: the same lookup with the plate in a body, never a URL.
  sim.on('post-apx-v1-lpr-reads-search', (ctx) => {
    const b = ctx.body ?? {};
    const rows = lookup(ctx, b, 'POST /v1/lpr/reads:search', '/');
    const page = Number.isInteger(b.page) ? b.page : 1;
    return paginate({ clock: ctx.clock, query: { int: (n) => (n === 'page' ? page : ctx.query.int(n)) } }, rows);
  });

  /** A path-addressed read: unknown or purged → 404; outside the grant → 403 (§13.3, §13.3b). */
  function readAt(ctx) {
    m.sweep();
    const id = ctx.params.observation;
    const o = m.observations().get(id);
    if (!m.isRead(o)) fail('target-not-found', `No LPR read with Observation id ${id}.`);
    if (!m.covered(ctx.principal, m.bindingOf(o))) fail('insufficient-grant', `Observation ${id} was read at place ${m.placeOf(o)}, outside the token's apx_places grant.`);
    return o;
  }

  sim.on('get-apx-v1-lpr-reads-observation', (ctx) => wire(m.projectRead(readAt(ctx))));

  // ---------- PUT /v1/lpr/reads/{observation}/plate (§13.3a(4a)) ----------

  sim.on('put-apx-v1-lpr-reads-observation-plate', (ctx) => {
    const o = readAt(ctx);
    const b = ctx.body;
    checkDecision(b);
    checkPrecondition(ctx, o);
    const detail = m.detailOf(o) ?? {};
    let current = o;
    if (!isNoOp(o, detail, b)) {
      current = sim.data.change('observations', o.id, decide(ctx, o, detail, b), ctx.principal);
      sim.events.publish({ type: 'apx.data.observation.updated.v1', data: wire(current), subject: { id: current.id, className: 'ObservationElement' }, place: current._lane ?? current._place ?? null });
      sim.hooks.emit('lpr.plateReviewed', { observation: current, decision: b.decision });
    }
    if (ctx.principal.has('apx.lpr:read')) return wire(m.projectRead(current));
    // Part 9 §9.6 rule 1: without apx.lpr:read, echo only the plate values the caller sent.
    return {
      observation: refOf(current.id, 'Observation'),
      version: current.version,
      review: { state: m.detailOf(current)?.review?.state ?? b.decision },
      ...Object.fromEntries(PLATE_MEMBERS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])),
    };
  });

  function checkDecision(b) {
    if (b.decision === 'corrected' && !b.plate) fail('request-unprocessable', 'decision corrected requires plate (Part 13 §13.3a(4a)). Nothing was written.');
    const stray = PLATE_MEMBERS.filter((k) => b[k] !== undefined);
    if (b.decision !== 'corrected' && stray.length) {
      fail('request-unprocessable', `${stray.join(', ')} belong to decision corrected only; decision is ${b.decision} (Part 13 §13.3a(4a)). Nothing was written.`);
    }
  }

  /** The read already carries this decision and these values: 200, no new version, no event. */
  function isNoOp(o, detail, b) {
    if (detail.review?.state !== b.decision) return false;
    if (b.decision !== 'corrected') return true;
    const vai = o.vehicleAncillaryIdentification ?? {};
    return (
      o.observedCredentialId === b.plate &&
      (b.country === undefined || (vai.country ?? detail.country?.value) === b.country) &&
      (b.stateProvince === undefined || (vai.stateProvince ?? detail.stateProvince?.value) === b.stateProvince)
    );
  }

  /** The engine's values as AttributeReads, kept once in review.original. */
  function originalOf(o, detail) {
    const vai = o.vehicleAncillaryIdentification ?? {};
    const conf = o.confidence?.overallConfidence;
    const attr = (own, value) => own ?? (value !== undefined ? { value, ...(typeof conf === 'number' ? { confidence: conf } : {}) } : undefined);
    const plate = attr(detail.plate, o.observedCredentialId);
    const country = attr(detail.country, vai.country);
    const stateProvince = attr(detail.stateProvince, vai.stateProvince);
    return { ...(plate ? { plate } : {}), ...(country ? { country } : {}), ...(stateProvince ? { stateProvince } : {}) };
  }

  /** The change-mode patch a decision writes into the Observation. */
  function decide(ctx, o, detail, b) {
    const prior = detail.review ?? {};
    const review = {
      ...prior,
      state: b.decision,
      decidedTime: ctx.now(),
      decidedBy: b.reviewer ?? ctx.principal.sub,
      ...(b.decision === 'corrected' && !prior.original ? { original: originalOf(o, detail) } : {}),
    };
    if (b.decision !== 'corrected') return { extensions: { ...(o.extensions ?? {}), [READ_KEY]: { ...detail, review } } };
    const attr = (value) => ({ value, confidence: REVIEWER_CONFIDENCE });
    const nextDetail = {
      ...detail,
      plate: attr(b.plate),
      ...(b.country !== undefined ? { country: attr(b.country) } : {}),
      ...(b.stateProvince !== undefined ? { stateProvince: attr(b.stateProvince) } : {}),
      review,
    };
    // APDS 4.1 requires country in vehicleAncillaryIdentification (§13.3a(1)): without one, the values stay in detail.
    const vai = { ...(o.vehicleAncillaryIdentification ?? {}), ...(b.country !== undefined ? { country: b.country } : {}), ...(b.stateProvince !== undefined ? { stateProvince: b.stateProvince } : {}) };
    return {
      observedCredentialId: b.plate,
      ...(vai.country ? { vehicleAncillaryIdentification: vai } : {}),
      extensions: { ...(o.extensions ?? {}), [READ_KEY]: nextDetail },
    };
  }
}
