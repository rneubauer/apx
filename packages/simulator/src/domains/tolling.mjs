/**
 * apx-tolling (Part 15): toll transactions assembled from gantry reads,
 * their lifecycle (created → priced → paid; disputed → resolved; voided),
 * settlement through PaymentRecords, disputes with registry codes, and the
 * link from ingested Observations to transactions.
 *
 * Collections: tollTransactions (`_place` the toll point's place, `_org`
 * its operator, `_fromRead`/`_readTime` for read-driven passages);
 * payments, accounts, observations, rateTables are shared and seeded
 * defensively. World sections read: tolling{}, tollTransactions[],
 * payments[], accounts[] (`_transponders`, `_meansOfPayment` hints),
 * rateTables[], placeRates{}.
 *
 * Hooks: listens to `observation.ingested` ({ element, place, lane }) from
 * the data module; emits `toll.created`, `toll.status`, `payment.recorded`.
 * Injectors: `gantryRead`, `billingBatch`.
 */
import { fail } from '../kernel/problems.mjs';
import { wire, paginate, visibleRows, getVisible, requireNode, checkPrecondition, parseInstant, refOf, isRef } from './common.mjs';
import { createModel, COLLECTION, STATUSES, DISPUTABLE, VOIDABLE, PAYABLE_RESOLUTIONS } from './tolling/model.mjs';

const WHAT = 'toll transaction';
const SERVER_MEMBERS = ['id', 'version', 'transactionStatus', 'statusHistory', 'recordInfo', 'payment', 'dispute'];

const illegal = (t, rule) => fail('toll-transition-illegal', `Transaction ${t.id} ${rule}`);
const lastTime = (t, state) => [...(t.statusHistory ?? [])].reverse().find((e) => e.state === state)?.time;
const joinDetail = (...parts) => parts.filter(Boolean).join('; ') || undefined;

export default {
  name: 'tolling',
  register(sim) {
    const m = createModel(sim);

    // ---------- seeding ----------

    sim.seed((world) => {
      const put = (name, row) => {
        const coll = sim.store.collection(name);
        if (!coll.has(row.id)) coll.put(row);
      };
      for (const t of world.rateTables ?? []) put('rateTables', t);
      for (const a of world.accounts ?? []) put('accounts', { ...a, _place: a._place ?? a.places?.[0]?.id });
      for (const p of world.payments ?? []) put('payments', { ...p, _place: p._place ?? p.place?.id, _org: p._org ?? sim.hierarchy.operatorOf(p.place?.id) });
      for (const read of world.tolling?.reads ?? []) put('observations', m.observationOfRead(read));
      for (const t of world.tollTransactions ?? []) {
        const place = sim.hierarchy.placeOf(t.tollPoint.id)?.id;
        const history = t.statusHistory ?? [];
        const first = history[0];
        const last = history.at(-1);
        put(COLLECTION, {
          ...t,
          recordInfo: t.recordInfo ?? {
            creationTime: first?.time,
            ...(m.operatorRef(place) ? { creator: m.operatorRef(place) } : {}),
            creationUser: first?.actor,
            lastUpdate: last?.time,
            lastUpdateUser: last?.actor,
          },
          _place: place,
          _org: sim.hierarchy.operatorOf(place),
        });
      }
    });

    sim.view(COLLECTION, (t) => wire(t));

    // ---------- the toll point and the caller ----------

    /** The toll point's place, with the §9.3a grant check. */
    const tollPointPlace = (ctx, ref) => {
      const node = requireNode(ctx, ref, 'tollPoint');
      if (node.kind !== 'device') {
        fail('invalid-request', `tollPoint ${ref.id} is a ${node.className}; a toll point is a SupplementalEquipment.`, { errors: [{ pointer: '/tollPoint', detail: 'SupplementalEquipment expected' }] });
      }
      const place = ctx.hierarchy.placeOf(node.id)?.id;
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, node.id)) {
        fail('insufficient-grant', `Toll point ${node.id} belongs to place ${place}, which is not in this token's apx_places grant.`);
      }
      return place;
    };

    /** A path-addressed transaction under the grant, with the If-Match precondition. */
    const load = (ctx) => {
      const t = getVisible(ctx, COLLECTION, ctx.params.id, { what: WHAT });
      checkPrecondition(ctx, t);
      return t;
    };

    const respond = (ctx, t) => ({ status: 200, body: wire(t), ...(ctx.idemKey ? { idem: { collection: COLLECTION, id: t.id } } : {}) });

    // ---------- create ----------

    sim.on('post-apx-v1-tolling-transactions', (ctx) => {
      const input = Object.fromEntries(Object.entries(ctx.body).filter(([k]) => !SERVER_MEMBERS.includes(k) && !k.startsWith('_')));
      const place = tollPointPlace(ctx, input.tollPoint);
      const t = m.create(input, {
        assignedId: ctx.assignId,
        actorOrg: ctx.principal.orgRef,
        gantryActor: m.gantryActor(input.tollPoint.id),
        pricingActor: m.actorFor('pricing'),
        pricingDetail: m.basisOf(place, input.pricing),
        createdNote: m.createdDetail(input.credential, input.observations),
        place,
      });
      return { status: 201, body: wire(t), idem: { collection: COLLECTION, id: t.id } };
    });

    // ---------- read ----------

    sim.on('get-apx-v1-tolling-transactions-id', (ctx) => wire(getVisible(ctx, COLLECTION, ctx.params.id, { what: WHAT })));

    sim.on('get-apx-v1-tolling-transactions', (ctx) => {
      const q = ctx.query;
      const status = q.get('status');
      if (status !== undefined && !STATUSES.includes(status)) {
        fail('invalid-request', `status must be one of ${STATUSES.join(', ')}.`, { errors: [{ pointer: '/query/status', detail: `unknown value ${status}` }] });
      }
      const places = q.list('place');
      for (const id of places) ctx.grant(id, 'place');
      const since = parseInstant(q.get('since'), 'since');
      const until = parseInstant(q.get('until'), 'until');
      const plate = q.get('plate');
      const credentialType = q.get('credentialType') ?? (plate !== undefined ? 'licensePlate' : undefined);
      const credentialId = q.get('credentialIdentification') ?? plate;
      const createdMs = (t) => Date.parse(t.statusHistory?.[0]?.time ?? t.recordInfo?.creationTime ?? 0);
      const rows = visibleRows(ctx, COLLECTION)
        .filter((t) => {
          if (status && t.transactionStatus !== status) return false;
          if (q.has('tollPoint') && t.tollPoint?.id !== q.get('tollPoint')) return false;
          if (places.length && !places.some((p) => ctx.hierarchy.within(t.tollPoint?.id, p) || (t._place && ctx.hierarchy.within(t._place, p)))) return false;
          if (credentialType && t.credential?.credentialType !== credentialType) return false;
          if (credentialId !== undefined && t.credential?.credentialIdentification !== credentialId) return false;
          if (since !== undefined && createdMs(t) < since) return false;
          if (until !== undefined && createdMs(t) >= until) return false;
          return true;
        })
        .sort((a, b) => createdMs(a) - createdMs(b) || a.id.localeCompare(b.id));
      return paginate(ctx, rows);
    });

    // ---------- price ----------

    sim.on('post-apx-v1-tolling-transactions-id-price', (ctx) => {
      const t = load(ctx);
      if (t.transactionStatus !== 'created') illegal(t, `is ${t.transactionStatus}; pricing may be set only in created. Change a price through a dispute.`);
      const detail = ctx.body.detail ?? m.basisOf(t._place, ctx.body.pricing);
      return respond(ctx, m.transition(t.id, 'priced', m.actorFor('pricing', ctx.idemKey), detail, { pricing: ctx.body.pricing }));
    });

    // ---------- payment ----------

    sim.on('post-apx-v1-tolling-transactions-id-payment', (ctx) => {
      const t = load(ctx);
      const ref = ctx.body.payment;
      if (t.transactionStatus === 'paid' && t.payment?.id === ref.id) return respond(ctx, t);
      const resolvedPayable = t.transactionStatus === 'resolved' && PAYABLE_RESOLUTIONS.has(t.dispute?.resolution) && !t.payment;
      if (t.transactionStatus !== 'priced' && !resolvedPayable) {
        if (t.payment) illegal(t, `is ${t.transactionStatus} (PaymentRecord ${t.payment.id} attached ${lastTime(t, 'paid') ?? 'earlier'}); payment may be attached only in priced.`);
        if (t.transactionStatus === 'resolved') illegal(t, `is resolved ${t.dispute?.resolution}; only an upheld or adjusted resolution with no payment attached takes payment.`);
        illegal(t, `is ${t.transactionStatus}; payment may be attached only in priced.`);
      }
      const actor = m.actorFor('payment', ctx.idemKey);
      const rec = m.settlingPayment(t, ref, actor);
      return respond(ctx, m.transition(t.id, 'paid', actor, ctx.body.note, { payment: refOf(rec.id, ref.className ?? 'PaymentRecord') }));
    });

    // ---------- void ----------

    sim.on('post-apx-v1-tolling-transactions-id-void', (ctx) => {
      const t = load(ctx);
      if (!VOIDABLE.has(t.transactionStatus)) {
        if (t.transactionStatus === 'voided') illegal(t, 'is already voided; void is allowed from created or priced.');
        if (t.transactionStatus === 'paid') illegal(t, 'is paid; open a dispute and resolve it refunded.');
        illegal(t, `is ${t.transactionStatus}; void is allowed from created or priced.`);
      }
      const detail = ctx.body.note ? `${ctx.body.reason}: ${ctx.body.note}` : ctx.body.reason;
      return respond(ctx, m.transition(t.id, 'voided', m.actorFor('void', ctx.idemKey), detail, { _voidReason: ctx.body.reason }));
    });

    // ---------- disputes ----------

    sim.on('post-apx-v1-tolling-transactions-id-disputes', (ctx) => {
      const b = ctx.body;
      m.requireCode(b.reason, m.reasons(), 'reason', 'apx-toll-dispute-reasons');
      if (b.disputedBy !== undefined && !isRef(b.disputedBy)) {
        fail('invalid-request', 'disputedBy must be a Reference.', { errors: [{ pointer: '/disputedBy', detail: 'Reference required' }] });
      }
      const t = load(ctx);
      if (t.transactionStatus === 'resolved') {
        fail('dispute-closed', `Transaction ${t.id} has a dispute resolved ${t.dispute?.resolvedTime} as ${t.dispute?.resolution}. Raise a new adjustment instead.`);
      }
      if (!DISPUTABLE.has(t.transactionStatus)) {
        if (t.transactionStatus === 'disputed') illegal(t, `already has a dispute open since ${t.dispute?.openedTime}; add to it or wait for resolution.`);
        if (t.transactionStatus === 'voided') illegal(t, `is voided (${lastTime(t, 'voided')}); voided is terminal and cannot be disputed.`);
        illegal(t, `is ${t.transactionStatus}; a dispute opens from priced or paid only.`);
      }
      const operatorInitiated = b.disputedBy?.id && b.disputedBy.id === t._org;
      const actor = m.actorFor(operatorInitiated ? 'operatorDispute' : 'dispute', ctx.idemKey);
      const dispute = { reason: b.reason, openedTime: ctx.now(), ...(b.disputedBy ? { disputedBy: refOf(b.disputedBy.id, b.disputedBy.className) } : {}) };
      return respond(ctx, m.transition(t.id, 'disputed', actor, joinDetail(b.reason, b.detail), { dispute }));
    });

    sim.on('post-apx-v1-tolling-transactions-id-disputes-resolve', (ctx) => {
      const b = ctx.body;
      m.requireCode(b.resolution, m.resolutions(), 'resolution', 'apx-toll-dispute-resolutions');
      if (b.resolution === 'adjusted' && !b.adjustedPricing) {
        fail('invalid-request', 'adjustedPricing is required when resolution is adjusted.', { errors: [{ pointer: '/adjustedPricing', detail: 'required when resolution is adjusted' }] });
      }
      const t = load(ctx);
      if (t.transactionStatus === 'resolved') {
        fail('dispute-closed', `Transaction ${t.id}: dispute already resolved ${t.dispute?.resolvedTime} as ${t.dispute?.resolution}.`);
      }
      if (t.transactionStatus !== 'disputed') {
        illegal(t, `is ${t.transactionStatus} and has no dispute to resolve.`);
      }
      const actor = m.actorFor('resolve', ctx.idemKey);
      const adjusted = b.resolution === 'adjusted';
      const patch = {
        ...(adjusted ? { pricing: b.adjustedPricing } : {}),
        dispute: { ...t.dispute, resolvedTime: ctx.now(), resolution: b.resolution, ...(adjusted ? { originalPricing: t.pricing } : {}) },
      };
      if (b.resolution === 'refunded') m.refundSettlement(t, actor);
      const basis = adjusted ? `pricing ${t.pricing?.currencyValue} -> ${b.adjustedPricing.currencyValue}` : undefined;
      return respond(ctx, m.transition(t.id, 'resolved', actor, joinDetail(b.resolution, basis, b.note), patch));
    });

    // ---------- the observation link ----------

    /** A read the data module ingested: a gantry's read becomes (or joins) a toll passage. */
    const onRead = (read, opts = {}) => {
      if (m.txns().first((t) => (t.observations ?? []).some((o) => o.id === read.id))) return null;
      const paired = opts.transactionId ? null : m.pairedTransaction(read);
      return paired ? m.joinPassage(paired, read) : m.createFromRead(read, opts);
    };

    sim.hooks.on('observation.ingested', ({ element }) => {
      const obs = typeof element === 'string' ? m.observations().get(element) : element;
      if (!obs?.id) return;
      const gantry = m.gantryOfObservation(obs);
      if (!gantry) return;
      const read = m.readOfObservation(obs, gantry);
      if (read) onRead(read);
    });

    // ---------- injectors: the world acting on its own ----------

    sim.injector('gantryRead', ({ gantry, plate, transponder, time, confidence, observation, transaction, pricing, axles, note }) => {
      if (!m.gantryNode(gantry)) throw new Error(`no toll gantry ${gantry}`);
      if (!plate && !transponder) throw new Error('give plate or transponder');
      const read = { id: observation ?? `f2000000-0000-4000-8000-${String(sim.store.next('tollRead', 900)).padStart(12, '0')}`, gantry, plate, transponder, time: time ?? sim.clock.now(), confidence };
      const obs = m.observations().get(read.id) ?? m.observations().put(m.observationOfRead(read));
      sim.events.publish({ type: 'apx.data.observation.created.v1', data: wire(obs), subject: refOf(obs.id, 'Observation'), place: obs._place });
      const t = onRead(read, { transactionId: transaction, pricing, axles, note });
      sim.hooks.emit('observation.ingested', { element: obs, place: obs._place, lane: null });
      return { observation: obs.id, transaction: t ? wire(t) : null };
    });

    /**
     * The nightly billing run: settle the named transactions (or every
     * payable one with an account on file) against PaymentRecords.
     */
    sim.injector('billingBatch', ({ settlements, note, actor }) => {
      const who = actor ?? m.actorFor('payment');
      const payable = (t) => t.transactionStatus === 'priced' || (t.transactionStatus === 'resolved' && PAYABLE_RESOLUTIONS.has(t.dispute?.resolution) && !t.payment);
      const work = settlements ?? m.txns().find((t) => payable(t) && m.accountFor(t.credential)).map((t) => ({ transaction: t.id }));
      const out = [];
      for (const s of work) {
        const t = m.txns().get(s.transaction);
        if (!t) throw new Error(`no toll transaction ${s.transaction}`);
        if (!payable(t)) throw new Error(`toll transaction ${t.id} is ${t.transactionStatus}; not payable`);
        // no payment id named: the ledger mints one
        const rec = m.settlingPayment(t, { id: s.payment, className: 'PaymentRecord' }, who);
        const paid = m.transition(t.id, 'paid', who, s.note ?? note, { payment: refOf(rec.id, 'PaymentRecord') });
        out.push({ transaction: paid.id, payment: paid.payment.id });
      }
      return { settled: out };
    });

    sim.tolling = { model: m, onRead };
  },
};
