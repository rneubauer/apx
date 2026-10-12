/**
 * apx-credentials (Part 21) — the CredentialRecord lifecycle: the state
 * machine of §21.1, the APDS materialization of §21.2 onto the shared
 * `assignedRights` collection, the server-side transitions the clock
 * drives (activateOnStart, suspension.until, validity.end), and the
 * status events of §21.6.
 *
 * Internal hints on a stored record: `_places` (the ids of `places[]`, or
 * the issuer's grant when the record names none — the grant check),
 * `_place` (the first of them), `_org` (the issuing organisation),
 * `_passback` (presence overlay, see access.mjs), `_allowedDays` (UTC
 * weekdays an active record may be used on; a world-only hint for
 * schedule-limited permits).
 */
import { fail } from '../../kernel/problems.mjs';
import { entry, refOf, wire } from '../common.mjs';

export const COLL = 'credentialRecords';
export const TERMINAL = new Set(['revoked', 'expired', 'replaced']);
export const NON_TERMINAL = new Set(['issued', 'active', 'suspended', 'lost']);

/** Which states each action may start from (§21.1 lifecycle diagram). */
export const FROM = {
  activate: ['issued'],
  suspend: ['active'],
  resume: ['suspended'],
  'report-lost': ['active', 'suspended'],
  revoke: ['issued', 'active', 'suspended', 'lost'],
};
export const TARGET = { activate: 'active', suspend: 'suspended', resume: 'active', 'report-lost': 'lost', revoke: 'revoked' };

const STOCK_PREFIX = { bluetooth: 'MB-', rfid: 'C-', electronicID: 'F-', hangtag: 'HT-', licensePlate: 'PL-', permit: 'PM-', qrCode: 'QR-', barcode: 'BC-', ticket: 'MS-', eticket: 'ET-' };
const PASSED_MS = 1000; // validity.end "passes" one second after the inclusive end instant

export const placesOf = (rec) => rec?._places ?? (rec?.places ?? []).map((p) => p.id);

/** A human list for a 409 detail: "a, b, or c". */
const orList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${xs.length > 2 ? ',' : ''} or ${xs.at(-1)}`);

export function createLifecycle(sim) {
  const recs = () => sim.store.collection(COLL);
  const rights = () => sim.store.collection('assignedRights');
  const now = () => sim.clock.now();

  const publishStatus = (rec) =>
    sim.events.publish({
      type: 'apx.credentials.status.v1',
      data: wire(rec),
      time: rec.statusHistory?.at(-1)?.time,
      subject: refOf(rec.id, 'CredentialRecord'),
      place: rec._place ?? null,
      org: rec._org?.id ?? null,
    });

  // ---------- §21.2 materialization ----------

  const issuerName = (rec) => {
    const place = sim.hierarchy.get(placesOf(rec)[0]);
    return place?.name ? [{ language: 'en', string: place.name }] : undefined;
  };

  const credentialAssigned = (rec) => ({
    type: rec.credentialType,
    ...(rec.credentialAssignedType ? { credentialAssignedType: rec.credentialAssignedType } : {}),
    identifier: refOf(rec.id, 'CredentialRecord'),
    ...(issuerName(rec) ? { issuer: issuerName(rec) } : {}),
  });

  /**
   * Bring every AssignedRight the given records name in line with their
   * status — present while `active`, absent otherwise — with one update
   * (and one AssignedRightUpdated) per right, so a replace swaps atomically.
   */
  const syncRights = (records, { publish = true } = {}) => {
    const ids = new Set(records.map((r) => r.id));
    const touched = new Set(records.flatMap((r) => (r.assignedRights ?? []).map((a) => a.id)));
    for (const arId of touched) {
      const ar = rights().get(arId);
      if (!ar) continue;
      const kept = (ar.rightHolder?.credentials ?? []).filter((c) => !ids.has(c.identifier?.id));
      const added = records.filter((r) => r.credentialStatus === 'active' && (r.assignedRights ?? []).some((a) => a.id === arId)).map(credentialAssigned);
      const before = JSON.stringify(ar.rightHolder?.credentials ?? []);
      const credentials = [...kept, ...added];
      if (JSON.stringify(credentials) === before) continue;
      const next = rights().update(arId, (x) => ({ ...x, rightHolder: { ...(x.rightHolder ?? {}), credentials } }), { bump: publish });
      if (publish) sim.events.publish({ type: 'AssignedRightUpdated', data: wire(next), subject: refOf(arId, 'AssignedRight'), place: next._place ?? null });
    }
  };

  // ---------- transitions ----------

  /** Apply one lifecycle transition: history, suspension, materialization, event. */
  const apply = (id, state, actor, detail, { patch = {}, time } = {}) => {
    const before = recs().get(id);
    const next = recs().update(id, (r) => {
      const out = { ...r, ...patch, credentialStatus: state, statusHistory: [...(r.statusHistory ?? []), entry(state, time ?? now(), actor, detail)] };
      if (state !== 'suspended') delete out.suspension;
      return out;
    });
    if ((before.credentialStatus === 'active') !== (state === 'active')) syncRights([next]);
    publishStatus(next);
    sim.hooks.emit('credential.status', { credential: next, previous: before.credentialStatus });
    return next;
  };

  /** 409 credential-transition-illegal with a detail that says why. */
  const refuse = (action, rec) => {
    const s = rec.credentialStatus;
    if (s === 'replaced') {
      const succ = rec.replacedBy?.id;
      fail('credential-transition-illegal', `${rec.id} is replaced (terminal)${succ ? `; ${action} the successor ${succ} if that is the intent` : ''}.`);
    }
    if (TERMINAL.has(s)) fail('credential-transition-illegal', `${rec.id} is ${s} (terminal); ${s === 'expired' ? 'issue a new credential with a new validity' : 'issue a new credential instead'}.`);
    if (action === 'report-lost' && s === 'lost') {
      const since = [...(rec.statusHistory ?? [])].reverse().find((h) => h.state === 'lost')?.time;
      fail('credential-transition-illegal', `${rec.id} is already lost${since ? ` (since ${since})` : ''}; replace or revoke it.`);
    }
    const need = FROM[action];
    fail('credential-transition-illegal', `${action} requires credentialStatus ${orList(need)}; ${rec.id} is ${s}${s === 'issued' && action === 'suspend' ? ' (never activated)' : ''}.`);
  };

  /** A requested transition (handler or injector), with the §21.1 checks. */
  const act = (rec, action, { actor, reason, note, until, time } = {}) => {
    if (!FROM[action]?.includes(rec.credentialStatus)) refuse(action, rec);
    const detail = note ?? reason;
    if (action === 'suspend') {
      if (until !== undefined && Date.parse(until) <= sim.clock.nowMs()) {
        fail('request-unprocessable', `until ${until} is not in the future; nothing was suspended (Part 21 §21.1 rule 7).`);
      }
      const next = apply(rec.id, 'suspended', actor, detail, { patch: { suspension: { ...(reason ? { reason } : {}), ...(until ? { until } : {}) } }, time });
      if (until) scheduleResume(next.id, until);
      return next;
    }
    return apply(rec.id, TARGET[action], actor, detail, { time });
  };

  // ---------- the clock ----------

  const scheduleResume = (id, until) =>
    sim.clock.schedule(
      until,
      () => {
        const r = recs().get(id);
        if (r?.credentialStatus === 'suspended' && r.suspension?.until === until) apply(id, 'active', 'system', 'suspension.until reached');
      },
      `credential ${id} resume`
    );

  const expire = (id, detail = 'validity.end passed') => {
    const r = recs().get(id);
    if (!r || !NON_TERMINAL.has(r.credentialStatus)) return r;
    return apply(id, 'expired', 'system', detail);
  };

  /** Arm the server-side transitions a record's dates call for. */
  const scheduleTimers = (rec) => {
    if (!NON_TERMINAL.has(rec.credentialStatus)) return;
    const end = rec.validity?.end;
    if (end) sim.clock.schedule(Date.parse(end) + PASSED_MS, () => expire(rec.id), `credential ${rec.id} expiry`);
    const start = rec.validity?.start;
    if (rec.activateOnStart && rec.credentialStatus === 'issued' && start && Date.parse(start) > sim.clock.nowMs()) {
      sim.clock.schedule(
        start,
        () => {
          if (recs().get(rec.id)?.credentialStatus === 'issued') apply(rec.id, 'active', 'system', 'activateOnStart: validity.start reached');
        },
        `credential ${rec.id} activateOnStart`
      );
    }
    if (rec.credentialStatus === 'suspended' && rec.suspension?.until) scheduleResume(rec.id, rec.suspension.until);
  };

  // ---------- identification ----------

  /** §21.1 rule 2: unique per credentialType among non-terminal records, implementation-wide. */
  const assertUnique = (type, identification, exceptId) => {
    const taken = recs().first((r) => r.id !== exceptId && r.credentialType === type && r.credentialIdentification === identification && NON_TERMINAL.has(r.credentialStatus));
    // §21.5: the detail names the type and nothing else — no record, holder, place, or state.
    if (taken) fail('credential-identification-in-use', `${type} ${identification} is held by a non-terminal credential record.`);
  };

  /** Server-assigned identification from pre-encoded stock (§21.3). */
  const mintIdentification = (type) => {
    for (;;) {
      const n = sim.store.next(`credentialStock.${type}`, 0);
      const value = `${STOCK_PREFIX[type] ?? 'X-'}${(0x7f3a91c2 + n * 0x1d3).toString(16).toUpperCase().padStart(8, '0')}`;
      if (!recs().first((r) => r.credentialType === type && r.credentialIdentification === value)) return value;
    }
  };

  /** The record a reader value names: the live holder of the value, else the latest terminal one. */
  const matchPresented = (identification, type) => {
    const rows = recs().find((r) => r.credentialIdentification === identification && (!type || r.credentialType === type));
    const live = rows.find((r) => NON_TERMINAL.has(r.credentialStatus));
    if (live) return live;
    const lastTime = (r) => r.statusHistory?.at(-1)?.time ?? '';
    return rows.sort((a, b) => (lastTime(b) > lastTime(a) ? 1 : -1))[0] ?? null;
  };

  return { recs, rights, publishStatus, syncRights, apply, act, refuse, expire, scheduleTimers, assertUnique, mintIdentification, matchPresented };
}
