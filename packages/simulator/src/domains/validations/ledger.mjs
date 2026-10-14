/**
 * The redemption ledger every channel writes (Part 20 §20.3–§20.4): the
 * closed rule set, the APDS-native materialization (session amount due,
 * a Payment of type `validation`, the lane's current ticket), instrument
 * consumption, reversal, and the record a Part 6 `applyValidation`
 * command materializes.
 */
import { fail } from '../../kernel/problems.mjs';
import { uuid } from '../../kernel/store.mjs';
import { entry, money, refOf, text, wire } from '../common.mjs';
import { hourlyRate, localDate, reductionFor } from './rules.mjs';

const TOPIC = 'apx.validations.redeemed.v1';
const VALIDATION_ID_START = 318;

export function createLedger(sim) {
  const coll = (name) => sim.store.collection(name);
  const programs = () => coll('validationPrograms');
  const instruments = () => coll('validationInstruments');
  const redemptions = () => coll('redemptions');
  const sessions = () => coll('sessions');
  const nowMs = () => sim.clock.nowMs();
  const apxActor = () => sim.world.actors?.apx ?? 'lakeside-apx';

  // ---------- instruments ----------

  const instrumentStatus = (i, atMs = nowMs()) => (i.instrumentStatus === 'valid' && i.validTo && Date.parse(i.validTo) <= atMs ? 'expired' : i.instrumentStatus);

  const instrumentView = (i) => ({
    code: i.code,
    program: i.program,
    ...(i.issuance ? { issuance: i.issuance } : {}),
    instrumentStatus: instrumentStatus(i),
    ...(i.validFrom ? { validFrom: i.validFrom } : {}),
    ...(i.validTo ? { validTo: i.validTo } : {}),
    ...(i.benefit ? { benefit: i.benefit } : {}),
    ...(i.redemption ? { redemption: i.redemption } : {}),
    ...(i.voidDetail ? { voidDetail: i.voidDetail } : {}),
    ...(i.extensions ? { extensions: i.extensions } : {}),
  });

  // ---------- the ticket ----------

  const findSession = (sessionRef, ticket) => {
    if (sessionRef?.id && sessions().has(sessionRef.id)) return sessions().get(sessionRef.id);
    return ticket ? sessions().first((s) => s._ticketNumber === ticket) : undefined;
  };
  const laneFor = (ticket) => (ticket ? sim.control?.lanes().first((l) => l.current?.ticketNumber === ticket) : undefined);
  const sessionOpen = (s) => Boolean(s) && (!s.actualEnd || Date.parse(s.actualEnd) > nowMs());
  const sameTicket = (r, sessionId, ticket) => Boolean((sessionId && r.session?.id === sessionId) || (ticket && r.ticketNumber === ticket));
  const rateTableOf = (session, placeId) => {
    if (session?._rateTable) return coll('rateTables').get(session._rateTable) ?? { id: session._rateTable };
    return sim.control?.tablesAtPlace?.(placeId)?.[0] ?? coll('rateTables').all()[0];
  };
  const timeZoneOf = (placeId) => sim.hierarchy.get(placeId)?.timeZone ?? 'UTC';
  const nameOf = (programId) => programs().get(programId)?.name ?? programId;

  // ---------- §20.3 rule set ----------

  /**
   * The program's status when the redemption happened: the last history
   * entry at or before `atMs` (a pay station's queued record is judged by
   * when it was applied); after the last entry that is the current status.
   */
  function statusAt(program, atMs) {
    if (!program.statusHistory?.length) return { state: program.programStatus, since: undefined };
    const past = program.statusHistory.filter((h) => Date.parse(h.time) <= atMs).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const last = past.at(-1);
    return last ? { state: last.state, since: last.time } : { state: 'not yet enrolled', since: undefined };
  }

  function checkProgram(program, placeId, atMs) {
    if (placeId !== program._place && !sim.hierarchy.within(placeId, program._place)) {
      fail('request-unprocessable', `ValidationProgram ${program.id} validates parking at place ${program._place}, not ${placeId}.`);
    }
    if (program.programStatus === 'ended') fail('program-not-active', `ValidationProgram ${program.id} is ended; ended is terminal.`);
    const { state, since } = statusAt(program, atMs);
    if (state !== 'active') fail('program-not-active', `ValidationProgram ${program.id} is ${state}${since ? ` since ${since}` : ''}.`);
  }

  function checkInstrument(program, code, atMs) {
    if (!code) {
      if (!(program.issuanceMethods ?? []).includes('api')) {
        fail('instrument-invalid', `ValidationProgram ${program.id} has no api issuance method; a redemption must name an instrumentCode.`);
      }
      return null;
    }
    const inst = instruments().get(code);
    if (!inst || inst._program !== program.id) fail('instrument-invalid', `Code ${code} is unknown.`);
    const status = instrumentStatus(inst, atMs);
    if (status === 'void') {
      const v = inst.voidDetail ?? {};
      fail('instrument-invalid', `Code ${code} is void (${inst._voidedWith ? `issuance ${inst._voidedWith} ` : ''}voided ${v.time ?? 'earlier'}${v.reason ? `: ${v.reason}` : ''}).`);
    }
    if (status === 'expired') fail('instrument-invalid', `Code ${code} expired at ${inst.validTo}.`);
    if (status === 'redeemed') {
      const used = inst.redemption && redemptions().get(inst.redemption.id);
      fail('instrument-invalid', `Code ${code} was redeemed${used ? ` at ${used.appliedTime} on ticket ${used.ticketNumber ?? used.session?.id} (redemption ${used.id})` : ''}.`);
    }
    return inst;
  }

  function checkLimits(program, { placeId, sessionId, ticket, appliedTime, table }) {
    const rules = program.rules ?? {};
    const label = ticket ?? sessionId;
    const onTicket = label ? redemptions().find((r) => r.redemptionStatus === 'applied' && sameTicket(r, sessionId, ticket)) : [];
    const mine = onTicket.filter((r) => r._program === program.id);
    if (rules.maxPerTicket && mine.length >= rules.maxPerTicket) {
      fail('redemption-limit-exceeded', `Program rule maxPerTicket=${rules.maxPerTicket}: ticket ${label} already carries redemption ${mine.map((r) => r.id).join(', ')}.`);
    }
    if (rules.maxPerDay) {
      const tz = timeZoneOf(placeId);
      const day = localDate(appliedTime, tz);
      const count = redemptions().find((r) => r._program === program.id && r.redemptionStatus === 'applied' && r._place === placeId && localDate(r.appliedTime, tz) === day).length;
      if (count >= rules.maxPerDay) fail('redemption-limit-exceeded', `Program rule maxPerDay=${rules.maxPerDay}: ${count} redemptions already applied at place ${placeId} on ${day}.`);
    }
    const others = onTicket.filter((r) => r._program !== program.id);
    if (others.length && rules.stackable === false) {
      fail('redemption-limit-exceeded', `Program rule stackable=false: ticket ${label} already carries a redemption of program ${others[0]._program} (${nameOf(others[0]._program)}).`);
    }
    const blocker = others.find((r) => programs().get(r._program)?.rules?.stackable === false);
    if (blocker) fail('redemption-limit-exceeded', `Program rule stackable=false on program ${blocker._program} (${nameOf(blocker._program)}), already applied to ticket ${label}.`);
    const allowed = rules.applicableRateTables ?? [];
    if (table && allowed.length && !allowed.some((t) => t.id === table.id)) {
      fail('redemption-limit-exceeded', `Program rule applicableRateTables: session ${sessionId ?? label} is priced from RateTable ${table.id}${text(table.rateTableName) ? ` (${text(table.rateTableName)})` : ''}, which the program does not cover.`);
    }
    if (table?.validation === false) fail('redemption-limit-exceeded', `RateTable ${table.id} does not accept validations (APDS RateTable.validation).`);
  }

  // ---------- materialization ----------

  const nextValidationId = (appliedTime) => `VAL-${appliedTime.slice(0, 10).replace(/-/g, '')}-${String(sim.store.next('validationLedger', VALIDATION_ID_START)).padStart(6, '0')}`;

  /** The APDS-native record: a Payment of type `validation` carrying the validationId. */
  function materializePayment(rec) {
    coll('payments').insert(
      {
        serviceProvider: { id: sim.hierarchy.operatorOf(rec._place) ?? sim.world.organisation?.id, version: 1, className: 'Organisation' },
        transactionID: rec.validationId,
        dateCollected: rec.appliedTime,
        paymentLines: [{ id: uuid(), version: 1, paymentType: 'validation', value: rec.amountReduced }],
        _place: rec._place,
        _kind: 'validation',
        _redemption: rec.id,
        ...(rec.session ? { _session: rec.session.id } : {}),
      },
      { provenance: false }
    );
  }

  /** Session amount due and its applied validations (Segment.validationId). */
  function applyToSession(session, rec, delta) {
    if (!session) return;
    sessions().update(
      session.id,
      (s) => ({
        ...s,
        ...(s._amountDue && sessionOpen(s) ? { _amountDue: money(s._amountDue.currencyValue + delta, s._amountDue.currencyType) } : {}),
        _validations: delta < 0 ? [...(s._validations ?? []), { validationId: rec.validationId, redemption: rec.id, validationType: programs().get(rec._program)?.validationType }] : (s._validations ?? []).filter((v) => v.redemption !== rec.id),
      }),
      { bump: false }
    );
  }

  /** One entry of the Part 6 lane view's currentTicket.validations[]. */
  const laneEntry = (rec, program) => ({ provider: program.provider, ...(program.name ? { providerName: program.name } : {}), ...(program.validationType ? { validationType: program.validationType } : {}), validationId: rec.validationId, amountReduced: rec.amountReduced, appliedTime: rec.appliedTime });

  /** The Part 6 lane view: currentTicket.validations[] and amountDue. */
  function applyToLane(lane, rec, program, delta) {
    if (!lane?.current) return;
    sim.control.lanes().update(
      lane.id,
      (l) => {
        const due = l.current.amountDue ? money(l.current.amountDue.currencyValue + delta, l.current.amountDue.currencyType) : undefined;
        const validations = delta < 0
          ? [...(l.current.validations ?? []), laneEntry(rec, program)]
          : (l.current.validations ?? []).filter((v) => v.validationId !== rec.validationId);
        return { ...l, current: { ...l.current, ...(due ? { amountDue: due, paidInFull: due.currencyValue === 0 } : {}), validations } };
      },
      { bump: false }
    );
  }

  /**
   * A vehicle reaching a lane carries the redemptions already applied to its
   * ticket (§20.3: the lane's currentTicket.validations[] reflects them). The
   * amount due already includes them, from the session.
   */
  function syncLaneOnArrival(lane) {
    const ticket = lane?.current;
    if (!ticket || ticket.validations?.length) return;
    const applied = redemptions().find((r) => r.redemptionStatus === 'applied' && sameTicket(r, ticket.session?.id, ticket.ticketNumber));
    if (!applied.length) return;
    const validations = applied.map((r) => laneEntry(r, programs().get(r._program) ?? {}));
    sim.control.lanes().update(lane.id, (l) => ({ ...l, current: { ...l.current, validations } }), { bump: false });
  }

  function publish(rec) {
    sim.events.publish({ type: TOPIC, data: wire(rec), subject: refOf(rec.id, 'ValidationRedemption'), place: rec._place });
    sim.hooks.emit('validation.redeemed', { redemption: rec });
  }

  /**
   * Evaluate the §20.3 rules and record a redemption. `input`: program,
   * placeId, placeRef, code, ticket, sessionRef, appliedTime, channel,
   * appliedBy, command, extensions, assignedId, actor, actorName.
   */
  function redeem(input) {
    const { program, placeId } = input;
    const appliedTime = input.appliedTime ?? sim.clock.now();
    const atMs = Date.parse(appliedTime);
    checkProgram(program, placeId, atMs);
    const inst = checkInstrument(program, input.code, atMs);
    const session = findSession(input.sessionRef, input.ticket);
    const ticket = input.ticket ?? session?._ticketNumber;
    const sessionId = input.sessionRef?.id ?? session?.id;
    const table = rateTableOf(session, placeId);
    checkLimits(program, { placeId, sessionId, ticket, appliedTime, table });
    const lane = laneFor(ticket);
    const due = (sessionOpen(session) ? session._amountDue : undefined) ?? lane?.current?.amountDue;
    const benefit = inst?.benefit ?? program.benefit;
    const reduced = reductionFor(benefit, due?.currencyValue, hourlyRate(sim.world, table));
    const currency = due?.currencyType ?? benefit?.amount?.currencyType ?? 'USD';
    const actorName = input.appliedBy ?? input.actorName ?? apxActor();
    const detail = due ? `${ticket ?? sessionId} amount due ${due.currencyValue.toFixed(2)} → ${(due.currencyValue - reduced).toFixed(2)}` : undefined;
    const rec = redemptions().insert(
      {
        program: refOf(program.id, 'ValidationProgram'),
        place: input.placeRef ?? refOf(placeId, 'Place'),
        ...(input.code ? { instrumentCode: input.code } : {}),
        ...(ticket ? { ticketNumber: ticket } : {}),
        ...(sessionId ? { session: refOf(sessionId, 'Session') } : {}),
        appliedTime,
        channel: input.channel,
        ...(input.appliedBy ? { appliedBy: input.appliedBy } : {}),
        ...(input.command ? { command: input.command } : {}),
        validationId: nextValidationId(appliedTime),
        amountReduced: money(reduced, currency),
        ...(benefit?.duration ? { durationComped: benefit.duration } : {}),
        redemptionStatus: 'applied',
        statusHistory: [entry('applied', appliedTime, actorName, detail)],
        ...(input.extensions ? { extensions: input.extensions } : {}),
        _place: placeId,
        _program: program.id,
        _provider: program.provider?.id,
      },
      { assignedId: input.assignedId, actor: input.actor }
    );
    if (inst) instruments().update(inst.id, (i) => ({ ...i, instrumentStatus: 'redeemed', redemption: refOf(rec.id, 'ValidationRedemption') }), { bump: false });
    applyToSession(session, rec, -reduced);
    applyToLane(lane, rec, program, -reduced);
    materializePayment(rec);
    publish(rec);
    return rec;
  }

  /** §20.4: applied → reversed; restore what is still open; credit a closed period on the next statement. */
  function reverse(rec, { reason, note, actorName }) {
    if (rec.redemptionStatus === 'reversed') {
      fail('redemption-reversed', `Redemption ${rec.id} was reversed at ${rec.reversal?.time} by ${rec.reversal?.actor}.`);
    }
    const now = sim.clock.now();
    const billedOn = coll('statements').first((s) => s._program === rec._program && (s._redemptionIds ?? []).includes(rec.id));
    const session = findSession(rec.session, rec.ticketNumber);
    const reduced = rec.amountReduced?.currencyValue ?? 0;
    const notes = [reason];
    if (billedOn) notes.push(`billed on closed statement ${billedOn.id}, credit due on the next statement`);
    if (sessionOpen(session) && session._amountDue) notes.push(`${rec.ticketNumber ?? session.id} amount due restored to ${(session._amountDue.currencyValue + reduced).toFixed(2)}`);
    else if (session) notes.push('session closed, amount due not reopened');
    applyToSession(session, rec, reduced);
    if (!rec.command) applyToLane(laneFor(rec.ticketNumber), rec, programs().get(rec._program) ?? {}, reduced);
    const inst = rec.instrumentCode ? instruments().get(rec.instrumentCode) : null;
    if (inst?.redemption?.id === rec.id) {
      if (!inst.validTo || Date.parse(inst.validTo) > nowMs()) {
        instruments().update(inst.id, ({ redemption: _r, ...i }) => ({ ...i, instrumentStatus: 'valid' }), { bump: false });
        notes.push(`code ${inst.code} returned to valid`);
      } else notes.push('code past its window, stays redeemed');
    }
    const next = redemptions().update(rec.id, (r) => ({
      ...r,
      redemptionStatus: 'reversed',
      reversal: { reason, ...(note ? { note } : {}), time: now, actor: actorName, ...(billedOn ? { closedStatement: refOf(billedOn.id, 'ValidationStatement') } : {}) },
      statusHistory: [...(r.statusHistory ?? []), entry('reversed', now, actorName, notes.join('; '))],
    }));
    publish(next);
    return next;
  }

  /** The redemption an `applyValidation` command materializes (hook `validation.applied`). */
  function fromCommand({ command, provider, ticket, validationId, reduced, place }) {
    const program = provider?._programId ? programs().get(provider._programId) : null;
    if (!program) return null;
    const lane = sim.control?.lanes().get(command.target?.id);
    const current = lane?.current?.ticketNumber === ticket ? lane.current : laneFor(ticket)?.current;
    const session = findSession(current?.session, ticket);
    const now = sim.clock.now();
    const after = current?.amountDue;
    const detail = `materialized from command ${command.id}${after ? `; ${ticket} amount due ${(after.currencyValue + reduced).toFixed(2)} → ${after.currencyValue.toFixed(2)}` : ''}`;
    const rec = redemptions().insert({
      program: refOf(program.id, 'ValidationProgram'),
      place: refOf(place ?? program._place, 'Place'),
      ...(ticket ? { ticketNumber: ticket } : {}),
      ...(session ? { session: refOf(session.id, 'Session') } : {}),
      appliedTime: now,
      channel: 'callCenter',
      ...(command.agent ? { appliedBy: command.agent } : {}),
      command: refOf(command.id, 'Command'),
      validationId,
      amountReduced: money(reduced ?? 0, after?.currencyType ?? 'USD'),
      ...(program.benefit?.duration ? { durationComped: program.benefit.duration } : {}),
      redemptionStatus: 'applied',
      statusHistory: [entry('applied', now, apxActor(), detail)],
      _place: place ?? program._place,
      _program: program.id,
      _provider: program.provider?.id,
    });
    applyToSession(session, rec, -(reduced ?? 0));
    materializePayment(rec);
    publish(rec);
    return rec;
  }

  return { redeem, reverse, fromCommand, syncLaneOnArrival, instrumentView, instrumentStatus, publish, rateTableOf };
}
