/**
 * Redemptions and statements (Part 20 §20.3, §20.4, §20.6): the ledger
 * routes and merchant billing.
 */
import { fail } from '../../kernel/problems.mjs';
import { paginate, parseInstant, placeOfTarget, refOf, visibleRows, wire } from '../common.mjs';
import { computeStatement } from './rules.mjs';
import { owns, requireOperator, requirePlaceParam, visibleProgram, visibleRecord } from './scope.mjs';
import { actorName } from './programs.mjs';

const STATEMENT_TOPIC = 'apx.validations.statement.closed.v1';

const withoutLines = ({ lines: _l, ...rest }) => rest;
const byTimeDesc = (key) => (a, b) => (b[key] ?? '').localeCompare(a[key] ?? '') || b.id.localeCompare(a.id);

export function registerRedemptions(sim, { ledger, idem }) {
  const redemptions = () => sim.store.collection('redemptions');
  const statements = () => sim.store.collection('statements');
  const programs = () => sim.store.collection('validationPrograms');

  // ---------- redemptions ----------

  sim.on('post-apx-v1-validations-redemptions', (ctx) => {
    const replay = idem.replay(ctx, wire);
    if (replay) return replay;
    const b = ctx.body;
    const { place } = placeOfTarget(ctx, b.place, 'place');
    const program = programs().get(b.program?.id);
    if (!program || !owns(ctx, program)) fail('reference-unknown', 'program names no ValidationProgram visible to this credential.');
    const rec = ledger.redeem({
      program,
      placeId: place?.id ?? b.place.id,
      placeRef: b.place,
      code: b.instrumentCode,
      ticket: b.ticketNumber,
      sessionRef: b.session,
      appliedTime: b.appliedTime,
      channel: b.channel,
      appliedBy: b.appliedBy,
      command: b.command,
      extensions: b.extensions,
      assignedId: ctx.assignId,
      actor: ctx.actor,
      actorName: actorName(ctx),
    });
    idem.remember(ctx, 'redemptions', rec.id);
    return { status: 201, body: wire(rec), idem: { collection: 'redemptions', id: rec.id } };
  });

  sim.on('get-apx-v1-validations-redemptions', (ctx) => {
    const q = (name) => ctx.query.get(name);
    const placeId = q('place');
    if (placeId) requirePlaceParam(ctx, placeId);
    const since = q('since');
    const rows = visibleRows(ctx, 'redemptions')
      .filter((r) => owns(ctx, programs().get(r._program) ?? { provider: { id: r._provider } }))
      .filter((r) => !placeId || ctx.hierarchy.within(r._place, placeId))
      .filter((r) => !q('program') || r._program === q('program'))
      .filter((r) => !q('command') || r.command?.id === q('command'))
      .filter((r) => !q('ticket') || r.ticketNumber === q('ticket'))
      .filter((r) => !q('session') || r.session?.id === q('session'))
      .filter((r) => !q('channel') || r.channel === q('channel'))
      .filter((r) => !q('status') || r.redemptionStatus === q('status'))
      .filter((r) => !since || Date.parse(r.appliedTime) >= Date.parse(since))
      .sort(byTimeDesc('appliedTime'));
    return paginate(ctx, rows);
  });

  sim.on('get-apx-v1-validations-redemptions-id', (ctx) => wire(visibleRecord(ctx, 'redemptions', ctx.params.id, 'ValidationRedemption')));

  sim.on('post-apx-v1-validations-redemptions-id-reverse', (ctx) => {
    requireOperator(ctx, 'POST /v1/validations/redemptions/{id}/reverse');
    const rec = visibleRecord(ctx, 'redemptions', ctx.params.id, 'ValidationRedemption');
    return wire(ledger.reverse(rec, { reason: ctx.body.reason, note: ctx.body.note, actorName: actorName(ctx) }));
  });

  // ---------- statements ----------

  const period = (start, end, names) => {
    const from = parseInstant(start, names[0]);
    const to = parseInstant(end, names[1]);
    if (from >= to) {
      fail('invalid-request', `${names[0]} ${start} is not before ${names[1]} ${end}.`, { errors: [{ pointer: names[2], detail: `must be before ${names[1]}` }] });
    }
    return { from, to };
  };

  sim.on('get-apx-v1-validations-programs-id-statement', (ctx) => {
    const program = visibleProgram(ctx, ctx.params.id);
    const from = ctx.query.get('from');
    const to = ctx.query.get('to');
    period(from, to, ['from', 'to', '/query/from']);
    return { ...wire(computeStatement(sim.store, program, from, to)), statementStatus: 'preview' };
  });

  sim.on('post-apx-v1-validations-programs-id-statements', (ctx) => {
    requireOperator(ctx, 'POST /v1/validations/programs/{id}/statements');
    const program = visibleProgram(ctx, ctx.params.id);
    const replay = idem.replay(ctx, wire);
    if (replay) return replay;
    const { periodStart, periodEnd, note } = ctx.body;
    const { from, to } = period(periodStart, periodEnd, ['periodStart', 'periodEnd', '/periodStart']);
    const clash = statements().first((s) => s._program === program.id && Date.parse(s.periodStart) < to && from < Date.parse(s.periodEnd));
    if (clash) {
      fail('statement-overlap', `${periodStart}..${periodEnd} overlaps closed statement ${clash.id} (${clash.periodStart}..${clash.periodEnd}).`);
    }
    const computed = computeStatement(sim.store, program, periodStart, periodEnd);
    const rec = statements().insert(
      {
        ...computed,
        statementStatus: 'closed',
        closedTime: ctx.now(),
        closedBy: actorName(ctx),
        ...(note ? { note } : {}),
        _program: program.id,
        _place: program._place,
      },
      { assignedId: ctx.assignId, actor: ctx.actor }
    );
    for (const id of computed._creditIds) {
      redemptions().update(id, (r) => ({ ...r, reversal: { ...r.reversal, creditedOn: refOf(rec.id, 'ValidationStatement') } }));
    }
    sim.events.publish({ type: STATEMENT_TOPIC, data: withoutLines(wire(rec)), subject: refOf(rec.id, 'ValidationStatement'), place: rec._place });
    idem.remember(ctx, 'statements', rec.id);
    return { status: 201, body: wire(rec), idem: { collection: 'statements', id: rec.id } };
  });

  sim.on('get-apx-v1-validations-programs-id-statements', (ctx) => {
    const program = visibleProgram(ctx, ctx.params.id);
    const rows = statements()
      .find((s) => s._program === program.id)
      .sort(byTimeDesc('periodStart'))
      .map(withoutLines);
    return paginate(ctx, rows);
  });

  sim.on('get-apx-v1-validations-statements-id', (ctx) => wire(visibleRecord(ctx, 'statements', ctx.params.id, 'ValidationStatement')));
}
