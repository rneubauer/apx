/**
 * apx-reservations §14.1b — the explicit link between a Session and its
 * AssignedRight, and the audited unlink. Both are façades over APDS state:
 * the link lands in `segments[].assignedRight` of the native Session
 * through `sim.data` (which publishes SessionUpdated), and the reservation
 * follows through the check-in rule (§14.1 rule 5) in reservations.mjs.
 *
 * Session hints: `_linked` { right, segment, previous, code, reason, time }
 * (what the link replaced, so the unlink can put it back; `false` once undone).
 * Right hints: `_preCheckIn` (the state the unlink returns the reservation to).
 */
import { fail } from '../../kernel/problems.mjs';
import { checkPrecondition } from '../common.mjs';
import { extOf, stateOf, windowOf, refOf } from './model.mjs';

const NO_GRANT = 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).';
const CREDENTIAL_TYPES = new Set(['barcode', 'bluetooth', 'eticket', 'hangtag', 'licensePlate', 'permit', 'qrCode', 'rfid', 'ticket', 'electronicID', 'ticketcoupon', 'vehicleplate']);

export function createLinks(sim, { rewrite }) {
  const sessions = () => sim.store.collection('sessions');
  const rights = () => sim.store.collection('assignedRights');
  const config = () => sim.world.reservations ?? {};

  function visibleSession(ctx) {
    const s = sessions().get(ctx.params.id);
    if (!s) fail('target-not-found', `No session ${ctx.params.id}.`);
    if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
    if (s._place && !ctx.hierarchy.covers(ctx.principal.places, s._place)) {
      fail('insufficient-grant', `Session ${s.id} belongs to place ${s._place}, which is not in the token's apx_places grant.`);
    }
    return s;
  }

  /** The segment a link acts on: the open one, else the last. */
  const currentSegment = (s) => {
    const segs = s.segments ?? [];
    return [...segs].reverse().find((g) => !g?.actualEnd) ?? segs.at(-1) ?? null;
  };

  /** A segment right that is the lane's drive-up right (or names nothing this server holds). */
  const isDriveUp = (ref) => {
    const r = rights().get(ref?.id);
    return !r || (config().driveUpSpec && r.rightSpecification?.id === config().driveUpSpec);
  };

  const linkedRef = (s) => {
    const seg = currentSegment(s);
    return seg?.assignedRight && !isDriveUp(seg.assignedRight) ? seg.assignedRight : null;
  };

  const placesMatch = (a, b) => !a || !b || sim.hierarchy.within(a, b) || sim.hierarchy.within(b, a);

  /** §14.1b: why `right` cannot be linked to session `s`, or null. */
  function whyNotLinkable(right, s) {
    const ext = extOf(right);
    const state = ext?.reservationState;
    const use = right.plannedUses?.[0];
    if (!placesMatch(right._place, s._place)) {
      const name = sim.hierarchy.get(right._place)?.name;
      return `Assigned right ${right.id} was issued for place ${right._place}${name ? ` (${name})` : ''}; the session is at ${s._place}.`;
    }
    if (state === 'cancelled') {
      return `Assigned right ${right.id} was cancelled${use?.cancelTime ? ` at ${use.cancelTime}` : ''}; a cancelled reservation cannot be checked in. Book again.`;
    }
    if (state === 'noShow') {
      const since = use?.expiryTime ?? ext.noShowAfter;
      return `Assigned right ${right.id} is in reservationState noShow${since ? ` since ${since}` : ''}; the planned use expired.`;
    }
    if (ext) {
      const holder = ext.checkInSession?.id && ext.checkInSession.id !== s.id ? sessions().get(ext.checkInSession.id) : null;
      const other = holder ?? sessions().first((x) => x.id !== s.id && !x.actualEnd && (x.segments ?? []).some((g) => g?.assignedRight?.id === right.id));
      if (other) return `Assigned right ${right.id} is already consumed by session ${other.id}${other.actualStart ? ` (checked in ${other.actualStart})` : ''}.`;
    }
    const w = windowOf(right);
    const at = s.actualStart ?? sim.clock.now();
    const t = Date.parse(at);
    if ((w.start && t < Date.parse(w.start)) || (w.end && t > Date.parse(w.end))) {
      return `Assigned right ${right.id} is valid ${w.start ?? '(open)'} to ${w.end ?? '(open)'}; the session started ${at}, outside the validity window.`;
    }
    return null;
  }

  const validationTypeOf = (right, code) => {
    if (code) return ['barcode'];
    const types = (right.rightHolder?.credentials ?? []).map((c) => c?.type).filter((t) => CREDENTIAL_TYPES.has(t));
    return types.length ? [...new Set(types)] : ['licensePlate'];
  };

  /** PUT /v1/sessions/{id}/assigned-right */
  function link(ctx) {
    const s = visibleSession(ctx);
    checkPrecondition(ctx, s);
    const ref = ctx.body.assignedRight;
    const right = rights().get(ref.id);
    if (!right) fail('target-not-found', `No assigned right ${ref.id}.`);
    const out = (version) => ({ session: refOf(s.id, 'Session'), assignedRight: refOf(right.id, 'AssignedRight'), version });
    const current = linkedRef(s);
    if (current?.id === right.id) return out(s.version); // naturally idempotent
    if (current) {
      fail('right-not-linkable', `Session ${s.id} is already linked to assigned right ${current.id}; unlink it first (POST /v1/sessions/{id}/assigned-right/unlink).`);
    }
    const why = whyNotLinkable(right, s);
    if (why) fail('right-not-linkable', why);
    const seg = currentSegment(s);
    const target = { id: right.id, version: right.version, className: 'AssignedRight' };
    const code = ctx.body.reservationCode;
    const segments = seg
      ? [{ id: seg.id, assignedRight: target, ...(code ? { validationId: code } : {}) }]
      : [...(s.segments ?? []), { id: crypto.randomUUID(), version: 1, actualStart: s.actualStart ?? ctx.now(), assignedRight: target, validationType: validationTypeOf(right, code), ...(code ? { validationId: code } : {}) }];
    const linked = { right: right.id, segment: seg?.id ?? null, previous: seg?.assignedRight ?? null, code: code ?? null, reason: ctx.body.reason ?? null, time: ctx.now() };
    const next = sim.data.change('sessions', s.id, { segments, _linked: linked }, ctx.principal);
    return out(next.version);
  }

  /** The drive-up right a reverted segment points at: what the link replaced, else the lane's drive-up right. */
  function driveUpRef(s, principal) {
    const prev = s._linked?.previous;
    if (prev?.id) return prev;
    const spec = config().driveUpSpec;
    const known = config().driveUpRight ? rights().get(config().driveUpRight) : rights().first((r) => r.rightSpecification?.id === spec && (!r._place || placesMatch(r._place, s._place)));
    const r =
      known ??
      sim.data.create(
        'assignedRights',
        {
          rightSpecification: { id: spec, version: sim.store.collection('rightSpecs').get(spec)?.version ?? 1, className: 'RightSpecification' },
          rightHolder: { credentials: s.identifiedCredentials ?? [] },
          issueMethod: 'ticket',
          issuanceTime: s.actualStart ?? sim.clock.now(),
        },
        principal
      );
    return { id: r.id, version: r.version, className: 'AssignedRight' };
  }

  /** POST /v1/sessions/{id}/assigned-right/unlink */
  function unlink(ctx) {
    const s = visibleSession(ctx);
    checkPrecondition(ctx, s);
    if (s.actualEnd) {
      fail('session-not-open', `Session ${s.id} ended ${s.actualEnd} and was settled; unlinking would re-price a closed session. Raise a dispute instead.`);
    }
    const linked = linkedRef(s);
    if (!linked) return { session: refOf(s.id, 'Session'), version: s.version };
    const seg = currentSegment(s);
    const fallback = driveUpRef(s, ctx.principal);
    const next = sim.data.change('sessions', s.id, { segments: [{ id: seg.id, assignedRight: fallback, validationId: null }], _linked: false }, ctx.principal);
    revertCheckIn(linked.id, s.id);
    return { session: refOf(s.id, 'Session'), unlinkedRight: refOf(linked.id, 'AssignedRight'), version: next.version };
  }

  /** The reservation goes back to its pre-check-in state, `checkInSession` cleared (§14.1b). */
  function revertCheckIn(rightId, sessionId) {
    const right = rights().get(rightId);
    const ext = extOf(right);
    if (!ext || stateOf(right) !== 'checkedIn' || (ext.checkInSession && ext.checkInSession.id !== sessionId)) return;
    rewrite(rightId, { reservationState: right._preCheckIn || 'confirmed', checkInSession: undefined }, { _preCheckIn: false });
  }

  return { link, unlink, whyNotLinkable, linkedRef };
}
