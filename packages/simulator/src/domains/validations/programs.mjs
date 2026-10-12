/**
 * Programs, issuances and instruments (Part 20 §20.1–§20.2): enrolment,
 * the versioned PUT lifecycle, instrument stock, code lookup and voids.
 */
import { fail } from '../../kernel/problems.mjs';
import { parseDuration } from '../../kernel/clock.mjs';
import { checkPrecondition, entry, isRef, paginate, placeOfTarget, refOf, visibleRows, wire } from '../common.mjs';
import { CODE_METHODS, checkBenefit, codePrefix, newCode } from './rules.mjs';
import { inGrant, owns, requireOperator, requirePlaceParam, visibleProgram } from './scope.mjs';

const PROGRAM_TOPIC = 'apx.validations.program.status.v1';
const SERVER_MEMBERS = ['id', 'version', 'statusHistory', 'recordInfo'];
const TRANSITION_DETAIL = { suspended: 'suspended', ended: 'ended', active: 'resumed' };

const writable = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => !SERVER_MEMBERS.includes(k) && !k.startsWith('_')));
export const actorName = (ctx) => ctx.principal.user ?? ctx.principal.sub;

export function registerPrograms(sim, { ledger, idem }) {
  const programs = () => sim.store.collection('validationPrograms');
  const issuances = () => sim.store.collection('issuances');
  const instruments = () => sim.store.collection('validationInstruments');

  const publishStatus = (program) => sim.events.publish({ type: PROGRAM_TOPIC, data: wire(program), subject: refOf(program.id, 'ValidationProgram'), place: program._place });

  const knownOrgs = () => new Set([...(sim.world.organisations ?? []).map((o) => o.id), ...sim.hierarchy.all('place').map((n) => n.operator).filter(Boolean)]);

  /** §20.1 body checks: place (grant), provider, benefit, rate tables. Returns the program's place id. */
  function checkProgramBody(ctx, b) {
    const { node } = placeOfTarget(ctx, b.place, 'place');
    if (node.kind !== 'place') fail('request-unprocessable', `place ${node.id} is a ${node.className}, not a HierarchyElement a program can be bound to.`);
    if (!isRef(b.provider) || !knownOrgs().has(b.provider.id)) fail('reference-unknown', `No Organisation ${b.provider?.id}.`);
    checkBenefit(b.benefit);
    for (const t of b.rules?.applicableRateTables ?? []) {
      if (!sim.store.collection('rateTables').has(t.id)) fail('reference-unknown', `rules.applicableRateTables names RateTable ${t.id}, which does not exist.`);
    }
    return node.id;
  }

  /** A status change with history and the program.status event (PUT, and the programUpdate injector). */
  function amend(id, changes, { actor, detail, time, recordActor, full = false } = {}) {
    const before = programs().get(id);
    const status = changes.programStatus ?? before.programStatus;
    const changed = status !== before.programStatus;
    // full = PUT semantics (Part 5 §5.1): writable members replaced wholesale, server members and hints kept
    const keep = (p) => (full ? Object.fromEntries(Object.entries(p).filter(([k]) => SERVER_MEMBERS.includes(k) || k.startsWith('_'))) : p);
    const next = programs().update(
      id,
      (p) => ({
        ...keep(p),
        ...changes,
        statusHistory: changed ? [...(p.statusHistory ?? []), entry(status, time ?? sim.clock.now(), actor, detail ?? TRANSITION_DETAIL[status])] : p.statusHistory,
      }),
      { actor: recordActor }
    );
    if (changed) publishStatus(next);
    return next;
  }

  // ---------- programs ----------

  sim.on('post-apx-v1-validations-programs', (ctx) => {
    requireOperator(ctx, 'POST /v1/validations/programs');
    const replay = idem.replay(ctx, wire);
    if (replay) return replay;
    const b = ctx.body;
    const placeId = checkProgramBody(ctx, b);
    const rec = programs().insert(
      { ...writable(b), statusHistory: [entry(b.programStatus, ctx.now(), actorName(ctx), 'enrolled')], _place: placeId },
      { assignedId: ctx.assignId, actor: ctx.actor }
    );
    publishStatus(rec);
    idem.remember(ctx, 'validationPrograms', rec.id);
    return { status: 201, body: wire(rec), idem: { collection: 'validationPrograms', id: rec.id } };
  });

  sim.on('get-apx-v1-validations-programs', (ctx) => {
    const placeId = ctx.query.get('place');
    if (placeId) requirePlaceParam(ctx, placeId);
    const provider = ctx.query.get('provider');
    const status = ctx.query.get('status');
    const rows = visibleRows(ctx, 'validationPrograms')
      .filter((p) => owns(ctx, p))
      .filter((p) => !placeId || ctx.hierarchy.within(p._place, placeId) || ctx.hierarchy.within(placeId, p._place))
      .filter((p) => (!provider || p.provider?.id === provider) && (!status || p.programStatus === status))
      .sort((a, b) => a.id.localeCompare(b.id));
    return paginate(ctx, rows);
  });

  sim.on('get-apx-v1-validations-programs-id', (ctx) => wire(visibleProgram(ctx, ctx.params.id)));

  sim.on('put-apx-v1-validations-programs-id', (ctx) => {
    requireOperator(ctx, 'PUT /v1/validations/programs/{id}');
    const current = visibleProgram(ctx, ctx.params.id);
    checkPrecondition(ctx, current);
    const b = ctx.body;
    if (b.id && b.id !== current.id) fail('request-unprocessable', `Body id ${b.id} differs from the path's ValidationProgram ${current.id}.`);
    if (current.programStatus === 'ended' && b.programStatus !== 'ended') {
      fail('program-not-active', `ValidationProgram ${current.id} is ended; ended is terminal. Enrol a new program.`);
    }
    const placeId = checkProgramBody(ctx, b);
    return wire(amend(current.id, { ...writable(b), _place: placeId }, { actor: actorName(ctx), recordActor: ctx.actor, full: true }));
  });

  // ---------- issuances ----------

  sim.on('get-apx-v1-validations-programs-id-issuances', (ctx) => {
    const program = visibleProgram(ctx, ctx.params.id);
    const rows = issuances()
      .find((i) => i._program === program.id)
      .sort((a, b) => (b.validFrom ?? '').localeCompare(a.validFrom ?? '') || b.id.localeCompare(a.id));
    return paginate(ctx, rows);
  });

  /** Codes for a new batch: the world's pre-printed ones first (a fixture), then fresh ones. */
  function mintCodes(issuanceId, program, quantity) {
    const preset = (sim.world.validations?.presetCodes?.[issuanceId] ?? []).filter((c) => !instruments().has(c));
    const out = preset.slice(0, quantity);
    while (out.length < quantity) out.push(newCode(codePrefix(program.name), (c) => instruments().has(c) || out.includes(c)));
    return out;
  }

  sim.on('post-apx-v1-validations-programs-id-issuances', (ctx) => {
    const program = visibleProgram(ctx, ctx.params.id);
    const replay = idem.replay(ctx, wire);
    if (replay) return replay;
    const b = ctx.body;
    if (b.program && b.program.id !== program.id) fail('request-unprocessable', `Body program ${b.program.id} differs from the path's ValidationProgram ${program.id}.`);
    if (program.programStatus !== 'active') {
      fail('program-not-active', `ValidationProgram ${program.id} is ${program.programStatus}; instruments can only be issued to an active program.`);
    }
    if (program.issuanceMethods && !program.issuanceMethods.includes(b.method)) {
      fail('request-unprocessable', `ValidationProgram ${program.id} permits issuanceMethods [${program.issuanceMethods.join(', ')}]; ${b.method} requested.`);
    }
    const validFrom = b.validFrom ?? ctx.now();
    const window = program.rules?.validityWindow;
    const validTo = b.validTo ?? (window ? new Date(Date.parse(validFrom) + parseDuration(window)).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined);
    if (validTo && Date.parse(validTo) <= Date.parse(validFrom)) fail('request-unprocessable', `validTo ${validTo} is not after validFrom ${validFrom}.`);
    const { codes: _c, issuanceStatus: _s, ...rest } = writable(b);
    const rec = issuances().insert(
      { ...rest, program: refOf(program.id, 'ValidationProgram'), validFrom, ...(validTo ? { validTo } : {}), issuanceStatus: 'issued', _program: program.id, _place: program._place },
      { assignedId: ctx.assignId, actor: ctx.actor }
    );
    const codes = CODE_METHODS.has(b.method) ? mintCodes(rec.id, program, b.quantity) : [];
    for (const code of codes) {
      instruments().put({
        id: code,
        code,
        program: refOf(program.id, 'ValidationProgram'),
        issuance: refOf(rec.id, 'ValidationIssuance'),
        instrumentStatus: 'valid',
        validFrom,
        ...(validTo ? { validTo } : {}),
        benefit: program.benefit,
        _program: program.id,
        _place: program._place,
        _issuance: rec.id,
      });
    }
    idem.remember(ctx, 'issuances', rec.id);
    // codes[] appear exactly once, in this response (§20.2 rule 1); they are never stored on the batch
    return { status: 201, body: { ...wire(rec), ...(codes.length ? { codes } : {}) }, idem: { collection: 'issuances', id: rec.id } };
  });

  const voidDetail = (ctx, extra = {}) => ({ reason: ctx.body.reason, ...(ctx.body.note ? { note: ctx.body.note } : {}), time: ctx.now(), actor: actorName(ctx), ...extra });

  sim.on('post-apx-v1-validations-programs-id-issuances-issuanceid-void', (ctx) => {
    const program = visibleProgram(ctx, ctx.params.id);
    const batch = issuances().get(ctx.params.issuanceId);
    if (!batch || batch._program !== program.id) fail('target-not-found', `No ValidationIssuance ${ctx.params.issuanceId} in program ${program.id}.`);
    if (batch.issuanceStatus === 'void') return wire(batch);
    const detail = voidDetail(ctx);
    const voidable = instruments().find((i) => i._issuance === batch.id && i.instrumentStatus === 'valid');
    for (const i of voidable) instruments().update(i.id, (x) => ({ ...x, instrumentStatus: 'void', voidDetail: detail, _voidedWith: batch.id }), { bump: false });
    return wire(issuances().update(batch.id, (x) => ({ ...x, issuanceStatus: 'void', voidDetail: { ...detail, voidedCount: voidable.length } }), { actor: ctx.actor }));
  });

  // ---------- instruments ----------

  /** A code outside the grant or another provider's is 404, never 403 (§20.2 rule 4). */
  const visibleInstrument = (ctx, code) => {
    const inst = instruments().get(code);
    if (!inst || !inGrant(ctx, inst._place) || !owns(ctx, programs().get(inst._program))) fail('target-not-found', `No instrument ${code}.`);
    return inst;
  };

  sim.on('get-apx-v1-validations-instruments-code', (ctx) => ledger.instrumentView(visibleInstrument(ctx, ctx.params.code)));

  sim.on('post-apx-v1-validations-instruments-code-void', (ctx) => {
    const inst = visibleInstrument(ctx, ctx.params.code);
    const status = ledger.instrumentStatus(inst);
    if (status === 'void') return ledger.instrumentView(inst);
    if (status === 'redeemed') fail('instrument-invalid', `Code ${inst.code} was redeemed by ${inst.redemption?.id}; reverse that redemption first.`);
    return ledger.instrumentView(instruments().update(inst.id, (x) => ({ ...x, instrumentStatus: 'void', voidDetail: voidDetail(ctx) }), { bump: false }));
  });

  return { amend };
}
