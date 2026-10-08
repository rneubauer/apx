/**
 * apx-validations (Part 20): merchant validation programs, instrument
 * stock, the redemption ledger every channel writes, reversal, and
 * merchant billing statements. Part 6 §6.3 integration: control derives
 * its provider list from active `validationPrograms`, and every
 * `applyValidation` it executes (hook `validation.applied`) is
 * materialized here as a `ValidationRedemption` with `command` set.
 *
 * Collections: validationPrograms, issuances, validationInstruments (id =
 * code), redemptions, statements; writes sessions (`_amountDue`,
 * `_validations`) and payments (a Payment of type `validation`).
 * Hints: `_place` (owning HierarchyElement), `_program`, `_provider`,
 * `_issuance`, `_voidedWith`, `_redemptionIds`/`_creditIds` (what a closed
 * statement billed / credited).
 *
 * World sections read: validationPrograms[], validationIssuances[]
 * (with `codes[]`, `redeemed{code: redemptionId}`), validationRedemptions[],
 * validationStatements[], validations{ presetCodes{issuanceId: [code]},
 * hourlyRate }, sessions[] (`_ticketNumber`, `_amountDue`, `_rateTable`).
 */
import { expandId } from '../kernel/auth.mjs';
import { parseDuration } from '../kernel/clock.mjs';
import { money, refOf, wire } from './common.mjs';
import { createLedger } from './validations/ledger.mjs';
import { registerPrograms } from './validations/programs.mjs';
import { registerRedemptions } from './validations/redemptions.mjs';
import { createIdemLedger } from './validations/scope.mjs';
import { hourlyRate, localDate, periodAround, reductionFor } from './validations/rules.mjs';

const ID = (v) => (typeof v === 'string' ? expandId(v) : v);

export default {
  name: 'validations',
  register(sim) {
    const coll = (name) => sim.store.collection(name);
    const ledger = createLedger(sim);
    const idem = createIdemLedger();
    let operatorDefault = null; // the world's default credential while `actAs` stands in for it

    // ---------- seeding ----------

    const placeOfProgram = (world, programId) => coll('validationPrograms').get(programId)?._place ?? (world.validationPrograms ?? []).find((p) => p.id === programId)?.place?.id;

    function seedIssuance(world, row) {
      const { codes = [], redeemed = {}, benefit, placeId, ...batch } = row;
      const programId = batch.program?.id;
      const place = placeId ?? placeOfProgram(world, programId);
      coll('issuances').put({ version: 1, issuanceStatus: 'issued', ...batch, _program: programId, _place: place });
      const programBenefit = benefit ?? (world.validationPrograms ?? []).find((p) => p.id === programId)?.benefit;
      for (const code of codes) {
        const used = redeemed[code];
        const voided = !used && batch.issuanceStatus === 'void';
        coll('validationInstruments').put({
          id: code,
          code,
          program: refOf(programId, 'ValidationProgram'),
          issuance: refOf(batch.id, 'ValidationIssuance'),
          instrumentStatus: used ? 'redeemed' : voided ? 'void' : 'valid',
          ...(batch.validFrom ? { validFrom: batch.validFrom } : {}),
          ...(batch.validTo ? { validTo: batch.validTo } : {}),
          ...(programBenefit ? { benefit: programBenefit } : {}),
          ...(used ? { redemption: refOf(used, 'ValidationRedemption') } : {}),
          ...(voided && batch.voidDetail ? { voidDetail: (({ voidedCount: _n, ...d }) => d)(batch.voidDetail), _voidedWith: batch.id } : {}),
          _program: programId,
          _place: place,
          _issuance: batch.id,
        });
      }
    }

    sim.seed((world) => {
      idem.clear();
      operatorDefault = null;
      for (const s of world.sessions ?? []) if (!coll('sessions').has(s.id)) coll('sessions').put({ ...s, _place: s._place ?? s.hierarchyElement?.id });
      for (const t of world.rateTables ?? []) if (!coll('rateTables').has(t.id)) coll('rateTables').put(t);
      for (const p of world.validationPrograms ?? []) coll('validationPrograms').put({ version: 1, statusHistory: [], ...p, _place: p.place?.id });
      for (const row of world.validationIssuances ?? []) seedIssuance(world, row);
      for (const r of world.validationRedemptions ?? []) {
        const program = (world.validationPrograms ?? []).find((p) => p.id === r.program?.id);
        coll('redemptions').put({ version: 1, ...r, _place: r.place?.id, _program: r.program?.id, _provider: program?.provider?.id ?? r._provider });
      }
      for (const s of world.validationStatements ?? []) {
        coll('statements').put({ version: 1, statementStatus: 'closed', ...s, _program: s.program?.id, _place: s.place?.id ?? placeOfProgram(world, s.program?.id), _redemptionIds: (s.lines ?? []).map((l) => l.redemption?.id) });
      }
    });

    for (const name of ['validationPrograms', 'issuances', 'redemptions', 'statements']) sim.view(name, (r) => wire(r));

    // ---------- operations ----------

    const { amend } = registerPrograms(sim, { ledger, idem });
    registerRedemptions(sim, { ledger, idem });

    // ---------- Part 6 integration: an applyValidation command lands in the ledger ----------

    sim.hooks.on('validation.applied', (payload) => ledger.fromCommand(payload));

    // ---------- injectors: the world acting on its own ----------

    /** A guest scans a code at a pay station (or a lane device): the full §20.3 evaluation. */
    sim.injector('redeemAtPayStation', ({ code, ticket, device, session, time, id, channel = 'payStation' }) => {
      const inst = coll('validationInstruments').get(code);
      if (!inst) throw new Error(`no instrument ${code}`);
      const deviceId = ID(device);
      const placeId = (deviceId && sim.hierarchy.placeOf(deviceId)?.id) ?? inst._place;
      const rec = ledger.redeem({
        program: coll('validationPrograms').get(inst._program),
        placeId,
        code,
        ticket,
        sessionRef: session ? { id: ID(session) } : undefined,
        appliedTime: time ?? sim.clock.now(),
        channel,
        appliedBy: deviceId ? `paystation-${deviceId}` : undefined,
        assignedId: id ? ID(id) : undefined,
      });
      return wire(rec);
    });

    /** The clock crosses the end of the program's billing period (monthly unless the program says weekly). */
    sim.injector('statementPeriodEnds', ({ program, cycle, offset = 0 }) => {
      const p = program ? coll('validationPrograms').get(ID(program)) : null;
      const c = cycle ?? (p?.billing?.billingCycle === 'weekly' ? 'weekly' : 'monthly');
      const { start, end } = periodAround(sim.clock.nowMs(), c);
      sim.clock.set(end + parseDuration(offset));
      const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
      return { cycle: c, periodStart: iso(start), periodEnd: iso(end), now: sim.clock.now() };
    });

    /** A back-office edit made outside the scenario's requests (a concurrent user, a suspension). */
    sim.injector('programUpdate', ({ program, set = {}, status, actor = 'backoffice', detail, time }) => {
      const id = ID(program);
      if (!coll('validationPrograms').has(id)) throw new Error(`no program ${id}`);
      const changes = { ...set, ...(status ? { programStatus: status } : {}) };
      return wire(amend(id, changes, { actor, detail, time }));
    });

    /** Fill a program's day with redemptions recorded elsewhere, up to `count` (default: its maxPerDay cap). */
    sim.injector('redemptionVolume', ({ program, date, count, place }) => {
      const p = coll('validationPrograms').get(ID(program));
      if (!p) throw new Error(`no program ${program}`);
      const placeId = ID(place) ?? p._place;
      const tz = sim.hierarchy.get(placeId)?.timeZone ?? 'UTC';
      const already = coll('redemptions').find((r) => r._program === p.id && r.redemptionStatus === 'applied' && r._place === placeId && localDate(r.appliedTime, tz) === date).length;
      const n = count ?? Math.max(0, (p.rules?.maxPerDay ?? 0) - already);
      const table = ledger.rateTableOf(null, placeId);
      const amount = money(reductionFor(p.benefit, undefined, hourlyRate(sim.world, table)), p.benefit?.amount?.currencyType ?? 'USD');
      const base = Date.parse(`${date}T17:00:00Z`);
      for (let i = 0; i < n; i += 1) {
        const appliedTime = new Date(base + i * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        coll('redemptions').insert({
          program: refOf(p.id, 'ValidationProgram'),
          place: refOf(placeId, 'Place'),
          ticketNumber: `T-${date.replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
          appliedTime,
          channel: 'payStation',
          appliedBy: 'volume-backfill',
          validationId: `VAL-${date.replace(/-/g, '')}-B${String(i + 1).padStart(5, '0')}`,
          amountReduced: amount,
          ...(p.benefit?.duration ? { durationComped: p.benefit.duration } : {}),
          redemptionStatus: 'applied',
          statusHistory: [{ state: 'applied', time: appliedTime, actor: 'volume-backfill' }],
          _place: placeId,
          _program: p.id,
          _provider: p.provider?.id,
        });
      }
      return { program: p.id, date, inserted: n, total: already + n };
    });

    /**
     * The scenario's caller for the requests that follow: the world's
     * `default` credential becomes the named one (a merchant terminal);
     * `{ credential: null }` restores the operator's.
     */
    sim.injector('actAs', ({ credential }) => {
      const creds = sim.world.credentials;
      operatorDefault ??= creds.default;
      if (!credential) {
        creds.default = operatorDefault;
        return { default: 'operator' };
      }
      if (!creds[credential]) throw new Error(`no credential ${credential}`);
      creds.default = structuredClone(creds[credential]);
      return { default: credential };
    });
  },
};
