/**
 * Part 17 §17.1–17.2: identifier resolution and context composition.
 *
 * `resolveSubjects` turns whatever parking-domain identifiers the caller
 * presented into the subjects of one interaction (lane, session, ticket,
 * credential, holder, account, reservation, plate) and pins them: a
 * context describes one episode, so a later car at the same lane does not
 * change what it is about. `compose` re-reads the live state of those
 * pinned subjects (balances, passback, devices, payments, overrides,
 * support history) into the ResolutionContext body and its policy facts.
 */
import { fail } from '../../kernel/problems.mjs';
import { refOf } from '../common.mjs';
import { registryValues } from '../../kernel/spec.mjs';

const ISSUES = registryValues('apx-issue-types');
const FAULT_STATES = new Set(['fault', 'outOfService', 'inoperative', 'offline']);
const DEAD_COMMAND = new Set(['failed', 'rejected', 'cancelled', 'expired']);
const OVERRIDE_TYPES = new Set(['courtesyExit', 'vendGate', 'holdGateOpen', 'resetPassback', 'forceIn', 'forceOut']);

export const IDENTIFIERS = ['lane', 'device', 'place', 'session', 'holder', 'credential', 'plate', 'ticketNumber', 'reservationCode'];

const DENIALS = {
  'account past due': { reasonCode: 'outstandingBalance', reasonDisplay: 'Monthly account has an outstanding balance.', issue: 'accountBalanceDenied' },
  accountBalance: { reasonCode: 'outstandingBalance', reasonDisplay: 'Monthly account has an outstanding balance.', issue: 'accountBalanceDenied' },
  passback: { reasonCode: 'passbackViolation', reasonDisplay: 'Credential is recorded as already inside.', issue: 'passbackViolation' },
};

const norm = (p) => String(p ?? '').replace(/[\s-]/g, '').toUpperCase();
const hours = (h) => h * 3600_000;

export function createComposer(sim) {
  const coll = (n) => sim.store.collection(n);
  const node = (id) => (id ? sim.hierarchy.get(id) : null);
  const placeIdOf = (id) => sim.hierarchy.placeOf(id)?.id ?? null;
  const denials = () => ({ ...DENIALS, ...(sim.world.resolutionPolicy?.denialReasons ?? {}) });

  // ---------- lookups ----------

  const credentialRecord = (id) => coll('credentialRecords').get(id) ?? null;
  const accessCredential = (id) => coll('accessCredentials').get(id) ?? null;
  const holderName = (id) => (sim.world.rightHolders ?? []).find((h) => h.id === id)?.name ?? coll('accounts').first((a) => a.holder?.id === id)?.name;
  const accountOfHolder = (holder) => (holder ? coll('accounts').first((a) => a.holder?.id === holder) : null);
  const laneWith = (pred) => coll('lanes').first(pred) ?? null;
  const sessionByTicket = (ticket, placeId) =>
    coll('sessions').first((s) => s._ticketNumber === ticket && (!placeId || !s._place || sim.hierarchy.within(s._place, placeId) || sim.hierarchy.within(placeId, s._place)));
  const openSessionByPlate = (plate, placeId) =>
    coll('sessions').first((s) => !s.actualEnd && norm(s._plate) === norm(plate) && (!placeId || !s._place || sim.hierarchy.within(s._place, placeId)));
  const reservationByCode = (code) => coll('assignedRights').first((r) => r._reservationCode === code) ?? null;

  const refNode = (ref, what, kinds) => {
    const n = node(ref.id);
    if (!n || (kinds && !kinds.includes(n.kind))) fail('reference-unknown', `${what} ${ref.className ?? ''} ${ref.id} names nothing that exists or is visible to the caller.`.replace(/\s+/g, ' '));
    return n;
  };

  /** §17.1: resolve every relationship we can; never fail because an identifier is absent. */
  const resolveSubjects = (input) => {
    const s = { lane: null, device: null, place: null, session: null, ticketNumber: input.ticketNumber ?? null, credential: null, holder: null, account: null, reservation: null, plate: input.plate ?? null };
    const unresolved = [];
    if (input.device) {
      const d = refNode(input.device, 'device', ['device']);
      s.device = d.id;
      if (d.laneId) s.lane = d.laneId;
    }
    if (input.lane) s.lane = refNode(input.lane, 'lane', ['lane']).id;
    if (input.place) s.place = refNode(input.place, 'place').id;
    const anchor = () => s.place ?? (s.lane ? placeIdOf(s.lane) : s.device ? placeIdOf(s.device) : null);
    if (input.session) {
      if (coll('sessions').has(input.session.id)) s.session = input.session.id;
      else unresolved.push(`session ${input.session.id}`);
    }
    if (input.ticketNumber) {
      const lane = laneWith((l) => l.current?.ticketNumber === input.ticketNumber && (!s.lane || l.id === s.lane));
      const sess = sessionByTicket(input.ticketNumber, anchor()) ?? (lane?.current?.session ? coll('sessions').get(lane.current.session.id) : null);
      if (sess) s.session ??= sess.id;
      if (lane) s.lane ??= lane.id;
      if (!sess && !lane) unresolved.push(`ticketNumber ${input.ticketNumber}`);
    }
    if (input.credential) {
      const id = input.credential.id;
      if (credentialRecord(id) || accessCredential(id)) s.credential = id;
      else unresolved.push(`credential ${id}`);
    }
    if (input.holder) {
      const id = input.holder.id;
      if (holderName(id) || accountOfHolder(id) || coll('credentialRecords').first((r) => r.holder?.id === id)) s.holder = id;
      else unresolved.push(`holder ${id}`);
    }
    if (input.plate) {
      const sess = openSessionByPlate(input.plate, anchor());
      const lane = laneWith((l) => norm(l.lastRead?.plate) === norm(input.plate) || norm(l.current?.lpr?.plate) === norm(input.plate));
      if (sess) s.session ??= sess.id;
      if (lane && !input.place) s.lane ??= lane.id;
      if (!sess && !lane) unresolved.push(`plate ${input.plate}`);
    }
    if (input.reservationCode) {
      const r = reservationByCode(input.reservationCode);
      if (r) s.reservation = r.id;
      else unresolved.push(`reservationCode ${input.reservationCode}`);
    }
    // what the lane itself knows right now
    const lane = s.lane ? coll('lanes').get(s.lane) : null;
    if (lane?.current?.session && !s.session) s.session = lane.current.session.id;
    if (lane?.current?.ticketNumber && !s.ticketNumber && lane.current.session?.id === s.session) s.ticketNumber = lane.current.ticketNumber;
    if (lane?.credential?.credential?.id && !s.credential && !lane.current) s.credential = lane.credential.credential.id;
    const sess = s.session ? coll('sessions').get(s.session) : null;
    if (sess) {
      s.ticketNumber ??= sess._ticketNumber ?? null;
      s.credential ??= sess._credential ?? null;
      s.holder ??= sess._holder ?? null;
      if (!s.lane) s.lane = laneWith((l) => l.current?.session?.id === sess.id)?.id ?? null;
      if (!s.reservation && sess._assignedRight) s.reservation = sess._assignedRight;
    }
    if (s.credential) {
      const rec = credentialRecord(s.credential);
      s.holder ??= rec?.holder?.id ?? (typeof accessCredential(s.credential)?.holder === 'string' ? accessCredential(s.credential).holder : null);
      if (rec?.account?.id) s.account = rec.account.id;
    }
    s.account ??= accountOfHolder(s.holder)?.id ?? null;
    s.place = s.place ?? anchor() ?? (sess?._place ?? null) ?? credentialRecord(s.credential)?._place ?? coll('assignedRights').get(s.reservation)?._place ?? null;
    const subjectFound = s.lane || s.device || s.session || s.credential || s.holder || s.reservation;
    if (unresolved.length && !subjectFound) {
      const where = s.place ? ` at ${node(s.place)?.name ?? s.place}` : '';
      fail('target-not-found', `No session, ticket, credential, or reservation${where} matches ${unresolved.join(', ')}.`);
    }
    if (!s.place) fail('target-not-found', 'The identifiers resolve to nothing anchored to a place this server knows.');
    if (lane) s.laneRead = lane.current ? (lane.current.lpr ? { ...lane.current.lpr } : null) : lane.lastRead ? { plate: lane.lastRead.plate, confidence: lane.lastRead.confidence } : null;
    s.accessDecision = accessDecisionAt(s, lane);
    return s;
  };

  /** The most recent access decision (Part 21 access events first, then the lane's monthly credential overlay). */
  const accessDecisionAt = (s, lane) => {
    const events = coll('accessEvents')
      .find((e) => s.credential && e.credential?.id === s.credential)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    const ev = events[0];
    if (ev) {
      const m = denials()[ev.denialReason] ?? {};
      return { status: ev.outcome === 'granted' ? 'granted' : 'denied', ...(ev.denialReason ? { reasonCode: m.reasonCode ?? ev.denialReason } : {}), ...(m.reasonDisplay ? { reasonDisplay: m.reasonDisplay } : {}), occurredAt: ev.occurredAt, _issue: m.issue };
    }
    const mc = lane?.credential;
    if (mc && (s.credential ? mc.credential?.id === s.credential : !lane.current)) {
      const m = denials()[mc.denialReason] ?? {};
      return {
        status: mc.accessGranted ? 'granted' : 'denied',
        ...(mc.accessGranted ? {} : { reasonCode: m.reasonCode ?? mc.denialReason }),
        ...(!mc.accessGranted && m.reasonDisplay ? { reasonDisplay: m.reasonDisplay } : {}),
        ...(mc.lastActivity ? { occurredAt: mc.lastActivity } : {}),
        _issue: mc.accessGranted ? undefined : m.issue,
      };
    }
    return null;
  };

  // ---------- facts ----------

  const commandTime = (c) => c.statusHistory?.find((h) => h.state === 'succeeded')?.time ?? c.statusHistory?.[0]?.time ?? c.recordInfo?.creationTime ?? '';

  const overridesFor = (s, sinceMs) =>
    coll('commands')
      .find((c) => {
        if (!OVERRIDE_TYPES.has(c.commandType) || DEAD_COMMAND.has(c.status)) return false;
        const p = c.parameters ?? {};
        const mine = (s.holder && p.holder?.id === s.holder) || (s.account && p.account?.id === s.account) || (s.credential && p.credential?.id === s.credential);
        return mine && Date.parse(commandTime(c)) >= sinceMs;
      })
      .sort((a, b) => (commandTime(a) < commandTime(b) ? -1 : 1));

  const overrideRecord = (c) => ({
    commandType: c.commandType,
    command: refOf(c.id, 'Command'),
    occurredAt: commandTime(c),
    ...(c.requestedBy ? { requestedBy: c.requestedBy } : {}),
    ...(c._place ? { place: refOf(c._place, 'Place') } : {}),
    ...(c.agent ? { agent: c.agent } : {}),
    ...(c.agentType ? { agentType: c.agentType } : {}),
    ...(c.reason ? { reason: c.reason } : {}),
  });

  const laneDevices = (laneId) =>
    sim.control
      .devices()
      .find((d) => d._lane === laneId)
      .sort((a, b) => Number(FAULT_STATES.has(b.deviceState)) - Number(FAULT_STATES.has(a.deviceState)) || a.id.localeCompare(b.id));

  const deviceInfo = (d) => sim.hierarchy.get(d.id) ?? {};

  /** Live facts about the pinned subjects, for the body and the policy. */
  const facts = (rec, cfg, extraCourtesy) => {
    const s = rec._subjects;
    const now = sim.clock.now();
    const nowMs = sim.clock.nowMs();
    const lane = s.lane ? coll('lanes').get(s.lane) : null;
    const session = s.session ? coll('sessions').get(s.session) : null;
    const account = s.account ? coll('accounts').get(s.account) : null;
    const cred = s.credential ? credentialRecord(s.credential) : null;
    const reservation = s.reservation ? coll('assignedRights').get(s.reservation) : null;
    const laneHoldsSession = lane?.current?.session && session && lane.current.session.id === session.id;
    const due = laneHoldsSession && lane.current.amountDue ? lane.current.amountDue : session?._amountDue ?? null;
    const devices = lane ? laneDevices(lane.id) : [];
    const faults = devices.filter((d) => FAULT_STATES.has(d.deviceState) && deviceInfo(d).equipmentType !== 'intercom').map((d) => ({ id: d.id, ...deviceInfo(d), deviceState: d.deviceState }));
    const payments = sim.accounts?.paymentsFor ? sim.accounts.paymentsFor({ ticketNumber: s.ticketNumber, account: s.account, session: s.session }) : [];
    const sortedPayments = [...payments].sort((a, b) => (a.dateCollected < b.dateCollected ? 1 : -1));
    const declined = sortedPayments[0]?.paymentStatus === 'declined';
    const collected = sortedPayments.some((p) => p.paymentStatus === 'approved') || (session?._payments ?? []).length > 0 || Boolean(session?._paid);
    const pb = cred && sim.credentials?.passbackStatus ? sim.credentials.passbackStatus(cred) : null;
    const window = sinceHours(nowMs, cfg.courtesy.windowHours);
    const overrides = s.holder || s.credential || s.account ? overridesFor(s, window) : [];
    const courtesyCount = overrides.filter((c) => c.commandType === 'courtesyExit').length + (extraCourtesy(s.holder) ?? 0);
    const plateRead = Boolean(session?._plate || (laneHoldsSession && lane.current?.lpr) || s.laneRead?.plate);
    const reservationLinked = Boolean(reservation && session && (session._assignedRight === reservation.id || (reservation._plate && norm(session._plate) === norm(reservation._plate))));
    const providers = s.place && sim.control?.providersAt ? sim.control.providersAt(s.place).length > 0 : false;
    const scheduled = cfg.scheduledRateTables?.[s.place] ?? sim.world.placeRates?.[s.place]?.[0];
    return {
      now,
      nowMs,
      place: { id: s.place },
      lane,
      session,
      account,
      credential: s.credential ? { id: s.credential } : null,
      holder: s.holder,
      reservation,
      reservationLinked,
      plateRead,
      ticketNumber: s.ticketNumber ?? (laneHoldsSession ? lane.current.ticketNumber : null),
      amountDue: due ? due.currencyValue : null,
      amountDueMoney: due,
      paidInFull: due ? due.currencyValue === 0 : false,
      balance: account?.balance?.currencyValue ?? 0,
      devices,
      faults,
      payments: sortedPayments,
      declined,
      sessionPaid: collected,
      passback: pb,
      passbackViolation: pb?.state === 'violation',
      overrides,
      courtesyCount,
      providers,
      noValidations: laneHoldsSession ? (lane.current.validations ?? []).length === 0 : false,
      rateMismatch: Boolean(session?._rateTable && scheduled && session._rateTable !== scheduled),
      plateConfidence: session?._plateConfidence ?? s.laneRead?.confidence ?? null,
      laneHoldsSession,
    };
  };

  const sinceHours = (nowMs, h) => nowMs - hours(h);

  /** Classify the issue from the facts (apx-issue-types, first match wins). */
  const classify = (f, s, cfg) => {
    if (f.passbackViolation) return 'passbackViolation';
    if (s.accessDecision?._issue && ISSUES.includes(s.accessDecision._issue)) return s.accessDecision._issue;
    if (f.account && f.balance > cfg.balanceHold.threshold && s.accessDecision?.status === 'denied') return 'accountBalanceDenied';
    if (f.reservation && !f.reservationLinked) return 'reservationMismatch';
    if (f.faults.length) return 'equipmentFault';
    if (f.declined) return 'paymentDeclined';
    if (f.laneHoldsSession && f.paidInFull) return 'gateVendFailed';
    if (f.rateMismatch) return 'rateDispute';
    if (f.laneHoldsSession && f.amountDue > 0 && f.noValidations && f.providers) return 'validationMissing';
    if (s.plate && !s.lane && f.session) return 'lostTicket';
    if (f.session && f.plateConfidence !== null && f.plateConfidence < cfg.plateThreshold) return 'plateUnresolved';
    return 'unknown';
  };

  const issueDisplay = (code, f, s, cfg) => {
    const custom = cfg.issueDisplay?.[code];
    if (custom) return custom;
    const laneName = f.lane?.name ?? 'the lane';
    switch (code) {
      case 'accountBalanceDenied':
        return 'Monthly parker denied because of outstanding balance';
      case 'passbackViolation':
        return `Credential denied at ${f.lane?.accessType === 'exit' ? 'exit' : 'entry'} — anti-passback violation`;
      case 'gateVendFailed':
        return 'Ticket is paid in full but the exit gate did not open';
      case 'paymentDeclined':
        return `Card payment declined at the ${laneName} terminal`;
      case 'validationMissing':
        return 'Customer reports a merchant validation that is not applied to the ticket';
      case 'rateDispute':
        return 'Amount due does not match the expected rate calculation';
      case 'lostTicket':
        return 'Customer cannot present the entry ticket; session found by plate';
      case 'reservationMismatch':
        return `Prepaid reservation exists but is not linked to the current session (${f.plateRead ? 'misread plate' : 'code not scanned'})`;
      case 'plateUnresolved':
        return `Session carries a low-confidence plate association (${f.plateConfidence})`;
      case 'equipmentFault':
        return `${laneName} ${f.faults[0]?.name ?? 'device'} is reporting a fault`;
      default:
        return s.lane ? `Unclassified interaction at ${laneName}` : 'The issue could not be classified from available signals.';
    }
  };

  // ---------- the body ----------

  const currentTicket = (t) => ({
    ...(t.ticketNumber ? { ticketNumber: t.ticketNumber } : {}),
    ...(t.session ? { session: t.session } : {}),
    ...(t.issuedTime ? { issuedTime: t.issuedTime } : {}),
    ...(t.amountDue ? { amountDue: t.amountDue } : {}),
    ...(t.paidInFull !== undefined ? { paidInFull: t.paidInFull } : {}),
    validations: t.validations ?? [],
    ...(t.lpr ? { lpr: t.lpr } : {}),
    ...(t.negotiatedRate ? { negotiatedRate: t.negotiatedRate } : {}),
    ...(t.matchedCommand ? { matchedCommand: t.matchedCommand } : {}),
  });

  const laneStatus = (f, s) => {
    const l = f.lane;
    const out = { lane: refOf(l.id, 'VehicularAccess') };
    if (l.current && (!s.session || f.laneHoldsSession)) out.currentTicket = currentTicket(l.current);
    if (l.credential && (!s.credential || l.credential.credential?.id === s.credential)) out.monthlyCredential = l.credential;
    return out;
  };

  const vehicle = (f, s) => {
    const sess = f.session;
    const region = (p) => ({ ...(cfgRegion(p) ?? {}) });
    if (sess?._plate) {
      return {
        plate: sess._plate,
        ...region(sess),
        ...(sess._plateConfidence !== undefined ? { confidence: sess._plateConfidence } : {}),
        ...(sess._plateImage ? { plateImage: sess._plateImage } : {}),
      };
    }
    const r = f.laneHoldsSession && f.lane.current?.lpr ? f.lane.current.lpr : s.laneRead;
    if (!r?.plate) return null;
    return { plate: r.plate, ...region(sess), ...(typeof r.confidence === 'number' ? { confidence: r.confidence } : {}), ...(r.imageLink ? { plateImage: r.imageLink } : {}) };
  };

  const cfgRegion = (sess) => {
    if (sess?._country || sess?._stateProvince) return { ...(sess._country ? { country: sess._country } : {}), ...(sess._stateProvince ? { stateProvince: sess._stateProvince } : {}) };
    return sim.world.resolutionPolicy?.plateRegion ?? null;
  };

  const reservationSummary = (r, linked) => ({
    reservation: refOf(r.id, 'AssignedRight'),
    reservationState: linked ? 'checkedIn' : r._reservationState ?? 'confirmed',
    ...(r.plannedStart ? { plannedStart: r.plannedStart } : {}),
    ...(r.plannedEnd ? { plannedEnd: r.plannedEnd } : {}),
  });

  const supportHistory = (rec, s, cfg, nowMs) => {
    const since = nowMs - hours(cfg.supportHistoryHours);
    return coll('supportInteractions')
      .find((i) => {
        const sub = i.subjects ?? {};
        const about = (s.holder && sub.holder?.id === s.holder) || (s.account && sub.account?.id === s.account) || (s.credential && sub.credential?.id === s.credential) || (s.session && sub.session?.id === s.session);
        if (!about || (rec.correlationId && i.correlationId === rec.correlationId)) return false;
        const t = Date.parse(i.startedAt);
        return t >= since && t <= nowMs;
      })
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .map(({ subjects: _s, actions: _a, extensions: _e, recordInfo: _r, ...rest }) => Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('_'))));
  };

  /** Everything the context's correlationId threads (§17.7). */
  const correlated = (rec) => {
    const id = rec.correlationId;
    if (!id) return [];
    const pick = (name, cls) => coll(name).find((r) => r.correlationId === id && r.id !== rec.id).map((r) => refOf(r.id, cls));
    return [...pick('commands', 'Command'), ...pick('paymentLinks', 'PaymentLink'), ...pick('supportInteractions', 'SupportInteraction')];
  };

  /**
   * The full (unprojected) context body for the record's pinned subjects.
   * `pending` lists sources still resolving: their sections are omitted,
   * the issue is `unknown`, and nothing is offered (§17.2 partial results).
   */
  const compose = (rec, { cfg, pending, extraCourtesy }) => {
    const s = rec._subjects;
    const f = facts(rec, cfg, extraCourtesy);
    const partial = pending.length > 0;
    const accountPending = partial && pending.includes('account-service');
    const issueCode = partial ? 'unknown' : rec._issue ?? classify(f, s, cfg);
    f.issue = issueCode;
    const display = partial ? `${s.accessDecision?.status === 'denied' ? 'Denial' : 'Interaction'} at ${f.lane?.name ?? 'the place'}; ${accountPending ? 'account' : 'source'} state not yet available` : issueDisplay(issueCode, f, s, cfg);
    const v = vehicle(f, s);
    const access = s.accessDecision ? Object.fromEntries(Object.entries(s.accessDecision).filter(([k]) => !k.startsWith('_'))) : null;
    const placeNode = node(s.place);
    const body = {
      status: partial ? 'partial' : 'full',
      ...(partial ? { pendingSources: pending } : {}),
      ...(rec.interactionId ? { interactionId: rec.interactionId } : {}),
      ...(rec.correlationId ? { correlationId: rec.correlationId } : {}),
      issue: { code: issueCode, display },
      place: refOf(s.place, 'Place'),
      ...(placeNode?.name ? { placeDisplay: placeNode.name } : {}),
      ...(f.lane ? { lane: refOf(f.lane.id, 'VehicularAccess'), laneStatus: laneStatus(f, s) } : {}),
      ...(v ? { vehicle: v } : {}),
      ...(f.session ? { session: refOf(f.session.id, 'Session') } : {}),
      ...(s.holder && !accountPending ? { holder: refOf(s.holder, 'RightHolder'), ...(holderName(s.holder) ? { holderDisplay: holderName(s.holder) } : {}) } : {}),
      ...(f.account && !accountPending ? { account: Object.fromEntries(Object.entries(f.account).filter(([k]) => !k.startsWith('_') && k !== 'recordInfo')) } : {}),
      ...(f.reservation ? { assignedRight: refOf(f.reservation.id, 'AssignedRight'), reservation: reservationSummary(f.reservation, f.reservationLinked) } : {}),
      ...(s.credential ? { credential: refOf(s.credential, 'Credential') } : {}),
      ...(f.passback && f.passback.state !== 'unknown' ? { passback: { ...f.passback, credential: refOf(s.credential, 'Credential') } } : {}),
      ...(access ? { accessDecision: access } : {}),
      ...(!partial && (f.payments.length || f.account) ? { payments: f.payments.slice(0, 5).map((p) => sim.accounts.paymentView(p)) } : {}),
      ...(f.devices.length ? { devices: f.devices.map((d) => sim.control.deviceStatus(d)) } : {}),
      ...(s.holder || s.credential ? { recentOverrides: f.overrides.map(overrideRecord) } : {}),
    };
    const history = partial ? [] : supportHistory(rec, s, cfg, f.nowMs);
    if (history.length) body.supportHistory = history;
    const related = correlated(rec);
    if (rec.correlationId) body.extensions = { 'apds-ext:apx:correlation@1.0': { correlationId: rec.correlationId, ...(related.length ? { related } : {}) } };
    return { body, facts: f, issue: partial ? null : issueCode };
  };

  return { resolveSubjects, compose };
}
