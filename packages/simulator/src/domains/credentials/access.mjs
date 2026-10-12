/**
 * apx-credentials (Part 21 §21.4) — what happens when a credential is
 * presented at a lane: the grant/deny decision with its
 * `apx-access-denial-reasons` value, the access-event log
 * (`accessEvents`, internal hint `_place`), `apx.credentials.access.v1`,
 * the lane's monthly-credential context in apx-control, and the Part 17
 * anti-passback overlay (`_passback` on the CredentialRecord:
 * { presence: inside|outside|unknown, violation, lastAccess }).
 *
 * World section read: credentialPolicy.blockedAccounts { accountId: sinceInstant }
 * (the holder's account is past due from that instant → accountBalance).
 */
import { refOf, wire } from '../common.mjs';
import { placesOf } from './lifecycle.mjs';

export const EVENTS = 'accessEvents';

const LIFECYCLE_REASON = {
  issued: 'credentialNotYetActive',
  suspended: 'credentialSuspended',
  lost: 'credentialLost',
  revoked: 'credentialRevoked',
  replaced: 'credentialReplaced',
  expired: 'credentialExpired',
};
const RECENT_EVENTS = 10;

export function createAccess(sim, life) {
  const events = () => sim.store.collection(EVENTS);
  const devices = () => sim.world.devices ?? [];

  const readerOf = (laneId) => devices().find((d) => d.laneId === laneId && /reader/i.test(d.equipmentType ?? d.name ?? ''))?.id ?? devices().find((d) => d.laneId === laneId)?.id;

  const accountBlocked = (rec, atMs) => {
    const since = sim.world.credentialPolicy?.blockedAccounts?.[rec.account?.id];
    return since !== undefined && Date.parse(since) <= atMs;
  };

  /** The decision for an active-or-not record at a lane: undefined = granted, else the denial reason. */
  const decide = (rec, { laneNode, direction, atMs }) => {
    if (rec.credentialStatus !== 'active') return LIFECYCLE_REASON[rec.credentialStatus] ?? 'unknownCredential';
    const placeId = sim.hierarchy.placeOf(laneNode.id)?.id;
    const ps = placesOf(rec);
    if (ps.length && !ps.some((p) => sim.hierarchy.within(laneNode.id, p))) return 'outsidePlace';
    const { start, end } = rec.validity ?? {};
    if ((start && Date.parse(start) > atMs) || (end && Date.parse(end) < atMs)) return 'outsideValidity';
    if (Array.isArray(rec._allowedDays) && !rec._allowedDays.includes(new Date(atMs).getUTCDay())) return 'outsideValidity';
    if (accountBlocked(rec, atMs)) return 'accountBalance';
    const presence = rec._passback?.presence;
    if ((direction === 'entry' && presence === 'inside') || (direction === 'exit' && presence === 'outside')) return 'passback';
    return placeId ? undefined : 'outsidePlace';
  };

  /** Keep the lane's monthly-credential screen-pop current, as control's laneCredential injector would. */
  const updateLane = (laneId, rec, ev, presentedValue) => {
    const lanes = sim.control?.lanes?.();
    if (!lanes?.has(laneId)) return;
    lanes.update(
      laneId,
      (l) => {
        const sameCard = l.credential?.credential?.id && l.credential.credential.id === rec?.id;
        const recent = [{ time: ev.occurredAt, event: ev.direction, lane: refOf(laneId, 'VehicularAccess') }, ...(sameCard ? (l.credential.recentEvents ?? []) : [])].slice(0, RECENT_EVENTS);
        return {
          ...l,
          credential: {
            ...(rec ? { credential: refOf(rec.id, 'CredentialRecord') } : {}),
            cardNumber: presentedValue,
            accessGranted: ev.outcome === 'granted',
            ...(ev.denialReason ? { denialReason: ev.denialReason } : {}),
            lastActivity: ev.occurredAt,
            recentEvents: recent,
          },
        };
      },
      { bump: false }
    );
  };

  /**
   * A credential presented at a lane. `credential` (a record id) or
   * `identification` (+ optional `credentialType`) names what was read.
   * Returns the stored access event.
   */
  const present = ({ credential, identification, credentialType, lane, device, direction, time, session, id }) => {
    const laneNode = sim.hierarchy.get(lane);
    if (!laneNode || laneNode.kind !== 'lane') throw new Error(`no lane ${lane}`);
    if (time && Date.parse(time) > sim.clock.nowMs()) sim.clock.set(time);
    const occurredAt = time ?? sim.clock.now();
    const atMs = Date.parse(occurredAt);
    const rec = credential ? life.recs().get(credential) : identification ? life.matchPresented(identification, credentialType) : null;
    if (credential && !rec) throw new Error(`no CredentialRecord ${credential}`);
    const dir = direction ?? (laneNode.accessType === 'exit' ? 'exit' : 'entry');
    const placeId = sim.hierarchy.placeOf(lane)?.id;
    const reader = device ?? readerOf(lane);
    const denialReason = rec ? decide(rec, { laneNode, direction: dir, atMs }) : 'unknownCredential';
    const presentedValue = rec?.credentialIdentification ?? identification;
    const ev = events().insert(
      {
        ...(id ? { id } : {}),
        ...(rec ? { credential: refOf(rec.id, 'CredentialRecord') } : { presented: { credentialType: credentialType ?? 'rfid', credentialIdentification: identification } }),
        occurredAt,
        ...(placeId ? { place: refOf(placeId, 'Place') } : {}),
        lane: refOf(lane, 'VehicularAccess'),
        ...(reader ? { device: refOf(reader, 'SupplementalEquipment') } : {}),
        direction: dir,
        outcome: denialReason ? 'denied' : 'granted',
        ...(denialReason ? { denialReason } : {}),
        ...(session && !denialReason ? { session: refOf(session, 'Session') } : {}),
        _place: placeId,
      },
      { provenance: false }
    );
    if (rec && !denialReason) setPresence(rec.id, dir === 'entry' ? 'inside' : 'outside', { direction: dir, occurredAt, place: placeId, lane });
    if (rec && denialReason === 'passback') life.recs().update(rec.id, (r) => ({ ...r, _passback: { ...(r._passback ?? {}), violation: true } }), { bump: false });
    sim.events.publish({
      type: 'apx.credentials.access.v1',
      data: wire(ev),
      time: occurredAt,
      ...(rec ? { subject: refOf(rec.id, 'CredentialRecord') } : {}),
      place: placeId ?? null,
    });
    updateLane(lane, rec, ev, presentedValue);
    sim.hooks.emit('credential.access', { event: ev, credential: rec });
    return ev;
  };

  // ---------- anti-passback (Part 17 read + control commands) ----------

  const setPresence = (id, presence, lastAccess) =>
    life.recs().update(
      id,
      (r) => ({ ...r, _passback: { ...(r._passback ?? {}), presence, violation: false, ...(lastAccess ? { lastAccess } : {}) } }),
      { bump: false }
    );

  const flip = (p) => (p === 'inside' ? 'outside' : p === 'outside' ? 'inside' : 'unknown');

  const passbackStatus = (rec) => {
    const pb = rec._passback ?? {};
    const recorded = pb.presence ?? 'unknown';
    const la = pb.lastAccess;
    return {
      credential: refOf(rec.id, 'CredentialRecord'),
      state: pb.violation ? 'violation' : recorded === 'unknown' ? 'unknown' : 'normal',
      expectedPresence: pb.violation ? flip(recorded) : recorded,
      recordedPresence: recorded,
      ...(la
        ? {
            lastAccess: {
              direction: la.direction,
              occurredAt: la.occurredAt,
              ...(la.place ? { place: refOf(la.place, 'Place') } : {}),
              ...(la.lane ? { lane: refOf(la.lane, 'VehicularAccess') } : {}),
            },
          }
        : {}),
    };
  };

  /** control's `passback` hook: resetPassback / forceIn / forceOut on parameters.credential. */
  const onPassbackCommand = ({ command }) => {
    const id = command?.parameters?.credential?.id;
    if (!id || !life.recs().has(id)) return;
    const presence = { resetPassback: 'unknown', forceIn: 'inside', forceOut: 'outside' }[command.commandType];
    if (presence) setPresence(id, presence);
  };

  /** control's `courtesyExit` hook: the holder's credentials are out, whatever passback said. */
  const onCourtesyExit = ({ command }) => {
    const p = command?.parameters ?? {};
    const holder = p.holder?.id;
    const account = p.account?.id;
    for (const r of life.recs().find((r) => (holder && r.holder?.id === holder) || (account && r.account?.id === account))) {
      if (r._passback?.presence === 'inside' || r._passback?.violation) setPresence(r.id, 'outside');
    }
  };

  return { events, present, passbackStatus, onPassbackCommand, onCourtesyExit };
}
