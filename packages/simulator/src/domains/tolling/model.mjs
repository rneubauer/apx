/**
 * apx-tolling (Part 15) model: the transaction state table, the audit
 * actors, the crossing's rate deck, gantry reads as APDS Observations, and
 * settlement through PaymentRecords in the shared `payments` collection.
 *
 * Nothing here knows about HTTP. The route layer (../tolling.mjs) checks
 * the caller first and calls `createModel(sim)`.
 *
 * World section `tolling`:
 *   actors      { pricing, payment, dispute, operatorDispute, resolve, void }
 *   keyActors   { "<Idempotency-Key prefix>": "<actor>" } — who is calling, by key
 *   reads[]     compact gantry reads seeded as Observations:
 *               { id, gantry, transponder | plate, time, confidence }
 *   peakHours   [[fromHourUtc, toHourUtc], ...] for read-driven pricing
 *   pairWindowMs  reads at one gantry this close together are one passage
 *   reasons / resolutions  implementer code lists (Part 11) beyond the registries
 */
import { registryValues } from '../../kernel/spec.mjs';
import { fail } from '../../kernel/problems.mjs';
import { wire, refOf, entry, money, text } from '../common.mjs';

export const COLLECTION = 'tollTransactions';
export const STATUSES = ['created', 'priced', 'paid', 'disputed', 'resolved', 'voided'];
export const DISPUTABLE = new Set(['priced', 'paid']);
export const VOIDABLE = new Set(['created', 'priced']);
export const PAYABLE_RESOLUTIONS = new Set(['upheld', 'adjusted']);
export const BASE_REASONS = registryValues('apx-toll-dispute-reasons');
export const BASE_RESOLUTIONS = registryValues('apx-toll-dispute-resolutions');

const PAYMENT_TOPIC = 'apx.accounts.payment.recorded.v1';
const DEFAULT_ACTORS = {
  pricing: 'toll-pricing',
  payment: 'billing-batch',
  dispute: 'agent-0219',
  operatorDispute: 'reconciliation-job',
  resolve: 'backoffice-jlee',
  void: 'backoffice-jlee',
};
const DEFAULT_PEAK = [
  [6, 10],
  [16, 19],
];
const DEFAULT_PAIR_WINDOW_MS = 2000;
const DEFAULT_LOCATION = { type: 'Point', coordinates: [-87.6125, 41.8853] };

export function createModel(sim) {
  const txns = () => sim.store.collection(COLLECTION);
  const payments = () => sim.store.collection('payments');
  const accounts = () => sim.store.collection('accounts');
  const observations = () => sim.store.collection('observations');
  const config = () => sim.world.tolling ?? {};

  // ---------- who acts ----------

  /** The audit actor for an action: the caller named by its key prefix, else the cast's default. */
  const actorFor = (action, idemKey) => {
    for (const [prefix, actor] of Object.entries(config().keyActors ?? {})) {
      if (idemKey && idemKey.startsWith(prefix)) return actor;
    }
    return config().actors?.[action] ?? DEFAULT_ACTORS[action];
  };

  const gantryNode = (id) => {
    const node = sim.hierarchy.get(id);
    return node?.kind === 'device' && (node.equipmentType === 'tollGantry' || node.tollPoint === true) ? node : null;
  };
  const gantryActor = (id) => {
    const node = sim.hierarchy.get(id);
    return node?.actor ?? (node?.name ? `gantry-${node.name}` : 'gantry');
  };
  const operatorRef = (placeId) => {
    const org = sim.hierarchy.operatorOf(placeId) ?? sim.world.organisation?.id;
    return org ? refOf(org, 'Organisation') : undefined;
  };

  // ---------- codes ----------

  const reasons = () => [...BASE_REASONS, ...(config().reasons ?? [])];
  const resolutions = () => [...BASE_RESOLUTIONS, ...(config().resolutions ?? [])];
  const requireCode = (value, allowed, member, list) => {
    if (!allowed.includes(value)) {
      fail('invalid-request', `${member} ${value} is not in ${list} or this server's implementer list (${allowed.join(', ')}).`, { errors: [{ pointer: `/${member}`, detail: `unknown value ${value}` }] });
    }
  };

  // ---------- the crossing's rate deck ----------

  const rateLines = (placeId) => {
    const ids = sim.world.placeRates?.[placeId] ?? [];
    const out = [];
    for (const id of ids) {
      const table = sim.store.collection('rateTables').get(id);
      for (const coll of table?.rateLineCollections ?? []) {
        for (const line of coll.rateLines ?? []) out.push({ line, description: text(line.description) ?? '', currency: coll.applicableCurrency ?? 'USD' });
      }
    }
    return out;
  };

  const isPeak = (iso) => {
    const hour = new Date(iso).getUTCHours();
    return (config().peakHours ?? DEFAULT_PEAK).some(([from, to]) => hour >= from && hour < to);
  };

  /** The applicable rate for a passage: axle count and peak window pick the line. */
  const rateFor = (placeId, { axles = 2, time }) => {
    const lines = rateLines(placeId);
    const byAxles = lines.filter((l) => l.description.includes(`${axles}-axle`));
    const peak = isPeak(time ?? sim.clock.now());
    const pick =
      byAxles.find((l) => (peak ? /\bpeak/.test(l.description) && !/off-peak/.test(l.description) : /off-peak/.test(l.description))) ?? byAxles[0] ?? lines[0];
    return pick ? { pricing: money(pick.line.value, pick.currency), detail: pick.description } : null;
  };

  /** The rate line an amount was priced at, for the audit detail. */
  const basisOf = (placeId, pricing) => {
    if (!pricing) return undefined;
    const hit = rateLines(placeId).find((l) => l.currency === pricing.currencyType && Number(l.line.value) === Number(pricing.currencyValue));
    return hit?.description;
  };

  // ---------- reads ----------

  const credentialOfRead = (read) =>
    read.transponder ? { credentialType: 'rfid', credentialIdentification: read.transponder } : { credentialType: 'licensePlate', credentialIdentification: read.plate };

  /** An APDS ObservationElement for one gantry read. */
  const observationOfRead = (read) => {
    const node = sim.hierarchy.get(read.gantry);
    const place = sim.hierarchy.placeOf(read.gantry)?.id;
    const cred = credentialOfRead(read);
    const org = operatorRef(place);
    return {
      id: read.id,
      version: 1,
      method: cred.credentialType === 'rfid' ? 'rfTransponder' : 'anpr',
      type: cred.credentialType,
      observer: node?.name ?? read.gantry,
      observedCredentialId: cred.credentialIdentification,
      observationStartTime: read.time,
      creationDateTime: read.time,
      location: { observerLocation: node?.location ?? DEFAULT_LOCATION },
      observerOrganisation: { id: org?.id ?? 'operator', version: 1, className: 'Organisation' },
      elementIds: { id: read.gantry, version: 1, className: 'SupplementalEquipment' },
      ...(read.confidence !== undefined ? { confidence: { overallConfidence: read.confidence } } : {}),
      _place: place,
      _device: read.gantry,
    };
  };

  /** The gantry an ingested Observation came from, if any. */
  const gantryOfObservation = (obs) => {
    const candidates = [obs?._device, obs?.elementIds?.id, obs?.observerElement?.id];
    for (const id of candidates) if (id && gantryNode(id)) return id;
    if (obs?.observer) {
      const byName = sim.hierarchy.all('device').find((n) => gantryNode(n.id) && (n.name === obs.observer || n.actor === obs.observer));
      if (byName) return byName.id;
    }
    return null;
  };

  const readOfObservation = (obs, gantry) => {
    const rfid = obs.type === 'rfid' || obs.method === 'rfTransponder';
    const value = obs.observedCredentialId;
    if (!value) return null;
    return {
      id: obs.id,
      gantry,
      ...(rfid ? { transponder: value } : { plate: value }),
      time: obs.observationStartTime ?? obs.creationDateTime ?? sim.clock.now(),
      confidence: obs.confidence?.overallConfidence,
    };
  };

  /** Audit detail for `created`: a plate-only passage records its read confidence. */
  const createdDetail = (credential, observationRefs) => {
    if (credential?.credentialType !== 'licensePlate') return undefined;
    const confidences = (observationRefs ?? []).map((r) => observations().get(r.id)?.confidence?.overallConfidence).filter((c) => typeof c === 'number');
    return confidences.length ? `plate fallback, confidence ${Math.min(...confidences)}` : undefined;
  };

  // ---------- transactions ----------

  const subject = (id) => refOf(id, 'TollTransaction');

  /** Insert a transaction; `pricing` present means it is priced in the same instant. */
  const create = (input, { assignedId, actorOrg, gantryActor: createdBy, pricingActor, pricingDetail, createdNote, place }) => {
    const now = sim.clock.now();
    const history = [entry('created', now, createdBy, createdNote)];
    if (input.pricing) history.push(entry('priced', now, pricingActor, pricingDetail));
    const rec = txns().insert(
      {
        ...input,
        transactionStatus: input.pricing ? 'priced' : 'created',
        statusHistory: history,
        _place: place,
        _org: sim.hierarchy.operatorOf(place),
      },
      { assignedId, actor: { org: actorOrg, user: createdBy }, version: input.pricing ? 2 : 1 }
    );
    sim.events.publish({ type: 'apx.tolling.transaction.created.v1', data: wire(rec), subject: subject(rec.id), place });
    sim.hooks.emit('toll.created', { transaction: rec });
    return rec;
  };

  /** Move a transaction to `state`, append the audit row, publish the status event. */
  const transition = (id, state, actor, detail, patch = {}) => {
    const now = sim.clock.now();
    const next = txns().update(
      id,
      (t) => ({ ...t, ...patch, transactionStatus: state, statusHistory: [...(t.statusHistory ?? []), entry(state, now, actor, detail)] }),
      { actor: { user: actor } }
    );
    sim.events.publish({ type: 'apx.tolling.transaction.status.v1', data: wire(next), subject: subject(id), place: next._place });
    sim.hooks.emit('toll.status', { transaction: next, state });
    return next;
  };

  /** Create a transaction from a gantry read (the injector and the observation hook). */
  const createFromRead = (read, { transactionId, pricing, axles, note } = {}) => {
    const place = sim.hierarchy.placeOf(read.gantry)?.id;
    const credential = credentialOfRead(read);
    const rate = pricing ? { pricing, detail: basisOf(place, pricing) } : rateFor(place, { axles, time: read.time });
    const ref = refOf(read.id, 'Observation');
    return create(
      {
        tollPoint: refOf(read.gantry, 'SupplementalEquipment'),
        observations: [ref],
        credential,
        ...(rate ? { pricing: rate.pricing } : {}),
        _fromRead: true,
        _readTime: read.time,
      },
      {
        assignedId: transactionId,
        actorOrg: operatorRef(place),
        gantryActor: gantryActor(read.gantry),
        pricingActor: actorFor('pricing'),
        pricingDetail: rate?.detail,
        createdNote: note ?? createdDetail(credential, [ref]),
        place,
      }
    );
  };

  /** A second read of the same passage (transponder plus plate) joins the open transaction. */
  const pairedTransaction = (read) => {
    const window = config().pairWindowMs ?? DEFAULT_PAIR_WINDOW_MS;
    const at = Date.parse(read.time);
    return txns().first(
      (t) => t._fromRead && t.tollPoint.id === read.gantry && VOIDABLE.has(t.transactionStatus) && Math.abs(Date.parse(t._readTime) - at) <= window
    );
  };

  const joinPassage = (txn, read) => {
    const preferTag = read.transponder && txn.credential?.credentialType !== 'rfid';
    return txns().update(txn.id, (t) => ({
      ...t,
      observations: [...(t.observations ?? []), refOf(read.id, 'Observation')],
      ...(preferTag ? { credential: credentialOfRead(read) } : {}),
    }));
  };

  // ---------- settlement (Part 13 PaymentRecords) ----------

  const accountFor = (credential) => {
    if (!credential?.credentialIdentification) return null;
    const value = credential.credentialIdentification;
    return (
      accounts().first((a) =>
        credential.credentialType === 'rfid' ? (a._transponders ?? []).includes(value) : (a.plates ?? []).includes(value)
      ) ?? null
    );
  };

  const ledger = () => (sim.accounts && typeof sim.accounts.takePayment === 'function' ? sim.accounts : null);

  const publishPayment = (rec) => {
    const { version: _v, recordInfo: _r, ...data } = wire(rec);
    sim.events.publish({ type: PAYMENT_TOPIC, data, subject: refOf(rec.id, 'PaymentRecord'), place: rec._place });
    sim.hooks.emit('payment.recorded', { payment: rec });
  };

  /**
   * The settling PaymentRecord: the one already on file, or the charge the
   * billing run takes against the account on file for the credential.
   */
  const settlingPayment = (txn, ref, actor) => {
    const existing = payments().get(ref.id);
    if (existing) {
      if (existing.paymentStatus !== 'approved' || existing.captureStatus === 'authorized') {
        fail('payment-state-illegal', `PaymentRecord ${ref.id} is ${existing.paymentStatus}${existing.captureStatus === 'authorized' ? ' (a hold)' : ''}; it settles nothing.`);
      }
      return existing;
    }
    const account = accountFor(txn.credential);
    const input = {
      place: txn._place,
      ...(account ? { account: { id: account.id } } : {}),
      amount: txn.pricing,
      meansOfPayment: account?._meansOfPayment ?? (txn.credential?.credentialType === 'rfid' ? 'tollTag' : 'mobileAccount'),
      channel: 'other',
    };
    const actorRef = { org: operatorRef(txn._place), user: actor };
    if (ledger()) return ledger().takePayment(input, { assignedId: ref.id, actor: actorRef });
    const now = sim.clock.now();
    const n = sim.store.next('tollPaymentTxn', 40001);
    const rec = payments().insert(
      {
        transactionID: `TOLL-${now.slice(0, 10).replace(/-/g, '')}-${String(n).padStart(6, '0')}`,
        place: refOf(txn._place, 'Place'),
        dateCollected: now,
        amount: money(input.amount.currencyValue, input.amount.currencyType),
        meansOfPayment: input.meansOfPayment,
        channel: input.channel,
        paymentStatus: 'approved',
        captureStatus: 'captured',
        ...(account ? { account: refOf(account.id, 'Account') } : {}),
        postings: [],
        _place: txn._place,
        _org: sim.hierarchy.operatorOf(txn._place),
        _tollTransaction: txn.id,
      },
      { assignedId: ref.id, actor: actorRef }
    );
    publishPayment(rec);
    return rec;
  };

  /** A dispute resolved `refunded`: the money goes back on the original payment (Part 13 §13.1a). */
  const refundSettlement = (txn, actor) => {
    if (!txn.payment) return null;
    const rec = payments().get(txn.payment.id) ?? settlingPayment(txn, txn.payment, actor);
    if (rec.paymentStatus === 'reversed') return rec;
    const actorRef = { org: operatorRef(txn._place), user: actor };
    if (ledger() && typeof ledger().refund === 'function') return ledger().refund(rec.id, undefined, { actor: actorRef });
    const now = sim.clock.now();
    const next = payments().update(
      rec.id,
      (p) => ({ ...p, refundedAmount: money(p.amount.currencyValue, p.amount.currencyType), paymentStatus: 'reversed', _reversedAt: now, _refundFor: txn.id }),
      { actor: actorRef }
    );
    publishPayment(next);
    return next;
  };

  return {
    txns,
    payments,
    observations,
    config,
    actorFor,
    gantryNode,
    gantryActor,
    operatorRef,
    reasons,
    resolutions,
    requireCode,
    rateFor,
    basisOf,
    observationOfRead,
    gantryOfObservation,
    readOfObservation,
    createdDetail,
    create,
    transition,
    createFromRead,
    pairedTransaction,
    joinPassage,
    accountFor,
    settlingPayment,
    refundSettlement,
  };
}
