/**
 * The apx-accounts ledger: the PaymentRecord state machine of Part 13
 * §13.1a (sale, hold, capture, void, refund, posting), payment links and
 * their lifecycle, account balances, the §13.4 recorded event, and the
 * §13.6 materialization of collected payments as APDS `Payment`s.
 *
 * Nothing here knows about HTTP or grants: the route layer
 * (../accounts.mjs) checks the caller first, and the resolution module
 * calls these functions through `sim.accounts`.
 */
import { fail } from '../../kernel/problems.mjs';
import { parseDuration } from '../../kernel/clock.mjs';
import { wire, refOf, money } from '../common.mjs';
import { maskDestination } from './pii.mjs';

export const TOPIC = 'apx.accounts.payment.recorded.v1';
const OPEN_LINK = new Set(['sent', 'opened']);
const DEFAULT_POLICY = {
  linkChannels: ['sms', 'email'],
  linkTtl: 'PT1H',
  refundApprovalRole: 'supervisor',
  arSystem: 'paris',
  authorizationLifecycle: true,
  transactionPrefix: 'TXN',
  transactionStart: 90150,
  confirmationStart: 88214,
  ivrCardLast4: undefined,
  declineCardLast4: [],
};

const round2 = (n) => Number(Number(n).toFixed(2));
const fmt = (a) => `${Number(a.currencyValue).toFixed(2)} ${a.currencyType}`;

export const isHold = (p) => p.paymentStatus === 'approved' && p.captureStatus === 'authorized';
export const isCollected = (p) => p.paymentStatus === 'approved' && p.captureStatus !== 'authorized';

/** PaymentRecord on the wire: no simulator `version`/`recordInfo` (the schema declares neither). */
export function paymentView(rec) {
  const { version: _v, recordInfo: _r, ...rest } = wire(rec);
  return rest;
}

export function createLedger(sim) {
  const payments = () => sim.store.collection('payments');
  const accounts = () => sim.store.collection('accounts');
  const links = () => sim.store.collection('paymentLinks');
  const sessions = () => sim.store.collection('sessions');
  const policy = () => ({ ...DEFAULT_POLICY, ...(sim.world.accountsPolicy ?? {}) });
  let outcomes = []; // armed by the paymentOutcome injector

  const reset = () => {
    outcomes = [];
  };

  // ---------- tickets and accounts ----------

  /** What the world knows about a ticket: its session, amount due, contact phone. */
  const ticketInfo = (ticketNumber, placeId) => {
    if (!ticketNumber) return null;
    const t = (sim.world.tickets ?? []).find((x) => x.ticketNumber === ticketNumber && (!placeId || !x.placeId || x.placeId === placeId));
    const s = sessions().first((x) => x._ticketNumber === ticketNumber && (!placeId || !x._place || x._place === placeId)) ?? (t?.session ? sessions().get(t.session) : undefined);
    if (!t && !s) return null;
    return {
      ticketNumber,
      session: s?.id ?? t?.session,
      amountDue: s?._amountDue ?? t?.amountDue,
      phone: t?.phone ?? s?._phone,
      email: t?.email,
      place: t?.placeId ?? s?._place,
    };
  };

  const norm = (v) => String(v ?? '').replace(/[\s-]/g, '').toUpperCase();
  const digits = (v) => String(v ?? '').replace(/\D/g, '');

  /** Raw account search (no grant filter); every given key must match. */
  const findAccounts = ({ name, phone, email, card, plate } = {}) =>
    accounts().find((a) => {
      if (name && !String(a.name ?? '').toLowerCase().includes(String(name).toLowerCase())) return false;
      if (phone && digits(a.phone) !== digits(phone)) return false;
      if (email && String(a.email ?? '').toLowerCase() !== String(email).toLowerCase()) return false;
      if (card && norm(a.cardNumber) !== norm(card)) return false;
      if (plate && !(a.plates ?? []).some((p) => norm(p) === norm(plate))) return false;
      return true;
    });

  /** Apply fn to the balance; an account that tracks no balance is left alone unless `create`. */
  const setBalance = (accountId, fn, actor, { create = false } = {}) => {
    const a = accounts().get(accountId);
    if (!a || (!a.balance && !create)) return a ?? null;
    const cur = a.balance ?? money(0);
    return accounts().update(accountId, (x) => ({ ...x, balance: money(fn(cur.currencyValue), cur.currencyType) }), { actor });
  };

  // ---------- APDS mirror (§13.6) and the lane ----------

  const serviceProvider = (placeId) => ({ id: sim.hierarchy.operatorOf(placeId) ?? sim.world.organisation?.id, version: 1, className: 'Organisation' });

  const apdsPayment = (rec, paymentType, value) => ({
    id: rec.id,
    version: 1,
    dateCollected: rec.dateCollected,
    serviceProvider: serviceProvider(rec._place),
    transactionID: rec.transactionID,
    ...(rec.account ? { idCode: rec.account.id } : {}),
    paymentLines: [{ id: `${rec.id}-1`, version: 1, paymentType, value }],
  });

  /** Put (or replace, or with value null remove) an APDS Payment on the session and its AssignedRight. */
  const mirror = (sessionId, payment, remove = false) => {
    const s = sessionId ? sessions().get(sessionId) : null;
    if (!s) return;
    const merge = (list) => [...(list ?? []).filter((p) => p.id !== payment.id), ...(remove ? [] : [payment])];
    sessions().update(s.id, (x) => ({ ...x, _payments: merge(x._payments) }), { bump: false });
    const rights = sim.store.collection('assignedRights');
    if (s._assignedRight && rights.has(s._assignedRight)) rights.update(s._assignedRight, (r) => ({ ...r, payments: merge(r.payments) }));
  };

  /** A collected ticket payment lowers what the session (and the lane showing that ticket) still owes. */
  const reduceDue = (rec, delta) => {
    const s = rec._session ? sessions().get(rec._session) : null;
    if (s?._amountDue) {
      sessions().update(s.id, (x) => ({ ...x, _amountDue: money(Math.max(0, x._amountDue.currencyValue - delta), x._amountDue.currencyType) }), { bump: false });
    }
    const lanes = sim.control?.lanes?.();
    if (!lanes || !rec.ticketNumber) return;
    for (const l of lanes.find((x) => x.current?.ticketNumber === rec.ticketNumber && x.current.amountDue)) {
      lanes.update(
        l.id,
        (x) => {
          const due = money(Math.max(0, x.current.amountDue.currencyValue - delta), x.current.amountDue.currencyType);
          return { ...x, current: { ...x.current, amountDue: due, paidInFull: due.currencyValue === 0 } };
        },
        { bump: false }
      );
    }
  };

  const publish = (rec) => {
    sim.events.publish({ type: TOPIC, data: paymentView(rec), subject: refOf(rec.id, 'PaymentRecord'), place: rec._place });
    sim.hooks.emit('payment.recorded', { payment: rec });
  };

  /** Side effects of money actually collected (a sale, or a hold at capture). */
  const settle = (rec, actor) => {
    if (rec.account) setBalance(rec.account.id, (b) => b - rec.amount.currencyValue, actor);
    reduceDue(rec, rec.amount.currencyValue);
    mirror(rec._session, apdsPayment(rec, 'payment', rec.amount));
  };

  // ---------- take a payment ----------

  const nextTransactionId = (now) => {
    const p = policy();
    const n = sim.store.next('transactionID', p.transactionStart);
    return `${p.transactionPrefix}-${now.slice(0, 4)}-${String(n).padStart(6, '0')}`;
  };

  const consumeOutcome = (input) => {
    const i = outcomes.findIndex(
      (o) => (!o.ticketNumber || o.ticketNumber === input.ticketNumber) && (!o.account || o.account === input.account?.id) && (!o.place || o.place === input.place)
    );
    if (i !== -1) return outcomes.splice(i, 1)[0];
    if (input.cardLast4 && policy().declineCardLast4.includes(input.cardLast4)) return { outcome: 'declined', reason: 'Issuer declined (do not honour).' };
    return null;
  };

  /**
   * Record a payment attempt. `place` is the HierarchyElement id. Returns the
   * stored record: `declined`, a hold (`captureLater`), or a collected sale.
   */
  const takePayment = (input, { assignedId, actor } = {}) => {
    const now = sim.clock.now();
    const p = policy();
    if (input.captureLater && !p.authorizationLifecycle) fail('request-unprocessable', 'This server does not model an authorization lifecycle; captureLater is refused (Part 13 §13.1a).');
    const forced = consumeOutcome(input);
    const declined = forced?.outcome === 'declined';
    const ticket = ticketInfo(input.ticketNumber, input.place);
    const cardLast4 = input.cardLast4 ?? (input.channel === 'autoAttendant' ? p.ivrCardLast4 : undefined);
    const hold = !declined && input.captureLater === true;
    const rec = payments().insert(
      {
        ...(forced?.payment ? { id: forced.payment } : {}),
        transactionID: forced?.transactionID ?? nextTransactionId(now),
        place: refOf(input.place, 'Place'),
        dateCollected: now,
        amount: money(input.amount.currencyValue, input.amount.currencyType),
        ...(input.meansOfPayment ? { meansOfPayment: input.meansOfPayment } : {}),
        ...(input.channel ? { channel: input.channel } : {}),
        paymentStatus: declined ? 'declined' : 'approved',
        ...(hold ? { captureStatus: 'authorized' } : {}),
        ...(input.captureLater !== undefined ? { captureLater: input.captureLater } : {}),
        ...(input.account ? { account: refOf(input.account.id, 'Account') } : {}),
        ...(input.ticketNumber ? { ticketNumber: input.ticketNumber } : {}),
        ...(cardLast4 ? { cardLast4 } : {}),
        postings: [],
        ...(input.extensions ? { extensions: input.extensions } : {}),
        _place: input.place,
        _session: input.session ?? ticket?.session,
        ...(input.link ? { _link: input.link } : {}),
        ...(declined ? { _declineReason: forced.reason ?? 'Issuer declined.' } : {}),
      },
      { assignedId, actor }
    );
    if (declined) publish(rec);
    else if (!hold) {
      settle(rec, actor);
      publish(rec);
    }
    return rec;
  };

  // ---------- lifecycle actions (§13.1a table) ----------

  const getPayment = (id) => payments().get(id) ?? fail('target-not-found', `No payment ${id}.`);

  const stateWords = (p) => {
    if (p.paymentStatus === 'declined') return `is declined (attempted ${p.dateCollected}); nothing was collected`;
    if (p.paymentStatus === 'reversed' && p._voidedAt) return `was voided at ${p._voidedAt}; nothing remains`;
    if (p.paymentStatus === 'reversed') return `is already reversed (refunded in full at ${p._reversedAt ?? p.dateCollected})`;
    if (isHold(p)) return 'is a hold (captureStatus authorized); nothing has been collected';
    return `was captured at ${p.dateCollected}`;
  };
  const illegal = (p, action, rule) => fail('payment-state-illegal', `Payment ${p.id} ${stateWords(p)}; ${action}: ${rule}.`);

  const sameCurrency = (p, amount, what) => {
    if (amount && amount.currencyType !== p.amount.currencyType) fail('request-unprocessable', `${what} is in ${amount.currencyType}; the payment is in ${p.amount.currencyType}.`);
  };

  const capture = (id, amount, { actor } = {}) => {
    const p = getPayment(id);
    if (!isHold(p)) illegal(p, 'capture', 'only a hold (approved, captureStatus authorized) can be captured');
    sameCurrency(p, amount, 'Capture amount');
    if (amount && amount.currencyValue > p.amount.currencyValue) fail('request-unprocessable', `Capture amount ${fmt(amount)} exceeds the authorized ${fmt(p.amount)}.`);
    if (amount && amount.currencyValue <= 0) fail('request-unprocessable', 'Capture amount must be greater than zero; void the hold to release it.');
    const now = sim.clock.now();
    const next = payments().update(id, (x) => ({ ...x, amount: amount ? money(amount.currencyValue, x.amount.currencyType) : x.amount, captureStatus: 'captured', dateCollected: now, _authorizedAmount: x.amount }), { actor });
    settle(next, actor);
    publish(next);
    return next;
  };

  const voidHold = (id, { actor } = {}) => {
    const p = getPayment(id);
    if (!isHold(p)) illegal(p, 'void', p.paymentStatus === 'approved' ? 'a captured payment is refunded, not voided' : 'only a hold can be voided');
    // A voided hold is never published: no consumer was told of it and no money moved (§13.1a).
    return payments().update(id, (x) => ({ ...x, paymentStatus: 'reversed', _voidedAt: sim.clock.now() }), { actor });
  };

  const refundable = (p) => round2(p.amount.currencyValue - (p.refundedAmount?.currencyValue ?? 0));

  /** Refund state check, without moving money (the route layer checks approval in between). */
  const assertRefundable = (id) => {
    const p = getPayment(id);
    if (!isCollected(p)) illegal(p, 'refund', isHold(p) ? 'void the hold instead' : 'only an approved, captured payment can be refunded');
    return p;
  };

  const refund = (id, amount, { actor } = {}) => {
    const p = assertRefundable(id);
    sameCurrency(p, amount, 'Refund amount');
    const remaining = refundable(p);
    const value = amount ? round2(amount.currencyValue) : remaining;
    if (value <= 0) fail('request-unprocessable', 'Refund amount must be greater than zero.');
    if (value > remaining) {
      fail('request-unprocessable', `Refund of ${fmt(money(value, p.amount.currencyType))} exceeds the ${fmt(money(remaining, p.amount.currencyType))} still refundable (amount ${p.amount.currencyValue.toFixed(2)}, refundedAmount ${(p.refundedAmount?.currencyValue ?? 0).toFixed(2)}).`);
    }
    const now = sim.clock.now();
    const total = round2((p.refundedAmount?.currencyValue ?? 0) + value);
    const full = total >= p.amount.currencyValue;
    const next = payments().update(
      id,
      (x) => ({ ...x, refundedAmount: money(total, x.amount.currencyType), ...(full ? { paymentStatus: 'reversed', _reversedAt: now } : {}), _refunds: [...(x._refunds ?? []), { amount: value, time: now }] }),
      { actor }
    );
    if (p.account) setBalance(p.account.id, (b) => b + value, actor);
    // APDS has no refund vocabulary: a reversed record leaves the APDS surface, a partial one shows the net (§13.6).
    if (full) mirror(p._session, { id: p.id }, true);
    else mirror(p._session, apdsPayment(next, 'payment', money(refundable(next), p.amount.currencyType)));
    publish(next);
    return next;
  };

  /** The PARIS-style AR write-back; only an approved, captured payment posts. */
  const post = (id, { postedTo, account, note } = {}, { actor } = {}) => {
    const p = getPayment(id);
    if (!isCollected(p)) illegal(p, 'posting', 'only approved payments can be posted');
    const target = p.account?.id ?? account?.id;
    if (account && !p.account) {
      if (!accounts().has(account.id)) fail('reference-unknown', `Account ${account.id} names nothing that exists.`);
      setBalance(account.id, (b) => b - refundable(p), actor);
      payments().update(id, (x) => ({ ...x, account: refOf(account.id, 'Account') }), { bump: false });
    }
    const balance = target ? accounts().get(target)?.balance : undefined;
    const posting = {
      confirmationNumber: `CONF-${sim.store.next('confirmation', policy().confirmationStart)}`,
      accountUpdated: Boolean(target),
      ...(balance ? { newBalance: balance } : {}),
      postedTo: postedTo ?? policy().arSystem,
      time: sim.clock.now(),
      ...(note ? { _note: note } : {}),
    };
    payments().update(id, (x) => ({ ...x, postings: [...(x.postings ?? []), wire(posting)] }), { bump: false });
    return wire(posting);
  };

  // ---------- payment links ----------

  const linkTransition = (id, status, extra = {}) => links().update(id, (l) => ({ ...l, ...extra, status, _history: [...(l._history ?? []), { status, time: sim.clock.now() }] }));

  const scheduleExpiry = (link) => {
    if (!link.expiresAt || !OPEN_LINK.has(link.status)) return;
    sim.clock.schedule(
      link.expiresAt,
      () => {
        const cur = links().get(link.id);
        if (cur && OPEN_LINK.has(cur.status)) linkTransition(cur.id, 'expired');
      },
      `payment link expiry ${link.id}`
    );
  };

  /** Defaults a link from what it settles: amount due, session, masked destination. */
  const createLink = (input, { assignedId, actor, contextVersion } = {}) => {
    const now = sim.clock.now();
    const account = input.account ? accounts().get(input.account.id) : null;
    const ticket = ticketInfo(input.ticketNumber, input.place.id);
    const session = input.session?.id ?? ticket?.session;
    const amount = input.amount ?? (account ? account.balance : undefined) ?? ticket?.amountDue ?? (session ? sessions().get(session)?._amountDue : undefined);
    const destination = input.channel === 'email' ? (account?.email ?? ticket?.email) : (account?.phone ?? ticket?.phone);
    const sentTo = maskDestination(input.channel, destination);
    const expiresAt = input.expiresAt ?? new Date(Date.parse(now) + parseDuration(policy().linkTtl)).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const { id: _id, version: _v, status: _s, payment: _p, resolutionContextVersion: _rv, sentTo: _st, ...rest } = input;
    const link = links().insert(
      {
        ...rest,
        place: refOf(input.place.id, input.place.className ?? 'Place'),
        ...(session ? { session: refOf(session, 'Session') } : {}),
        ...(amount ? { amount } : {}),
        ...(sentTo ? { sentTo } : {}),
        status: 'sent',
        expiresAt,
        ...(contextVersion ? { resolutionContextVersion: contextVersion } : {}),
        _place: input.place.id,
        _history: [{ status: 'sent', time: now }],
      },
      { assignedId, actor }
    );
    scheduleExpiry(link);
    return link;
  };

  const getLink = (id) => links().get(id) ?? fail('target-not-found', `No payment link ${id}.`);

  const cancelLink = (id, { reason, note } = {}, { actor } = {}) => {
    const l = getLink(id);
    if (!OPEN_LINK.has(l.status)) {
      const why =
        l.status === 'paid'
          ? `is paid (payment ${l.payment?.id}); refund the payment instead`
          : l.status === 'expired'
            ? `expired at ${l.expiresAt}; only a sent or opened link can be cancelled`
            : 'is already cancelled';
      fail('payment-state-illegal', `Payment link ${id} ${why}.`);
    }
    return linkTransition(id, 'cancelled', { _cancel: { reason, note, time: sim.clock.now(), by: actor?.user } });
  };

  const openLink = (id) => {
    const l = getLink(id);
    if (l.status !== 'sent') throw new Error(`payment link ${id} is ${l.status}; only a sent link opens`);
    return linkTransition(id, 'opened');
  };

  /** The customer pays on the hosted page: a PaymentRecord is taken and the link becomes paid. */
  const payLink = (id, { amount, payment, cardLast4, meansOfPayment = 'paymentCreditCard', outcome } = {}) => {
    const l = getLink(id);
    if (!OPEN_LINK.has(l.status)) throw new Error(`payment link ${id} is ${l.status}; the hosted page no longer accepts payment`);
    const value = amount === undefined ? l.amount : typeof amount === 'number' ? money(amount, l.amount?.currencyType ?? 'USD') : amount;
    if (!value) throw new Error(`payment link ${id} carries no amount; give one`);
    if (payment || outcome) outcomes.unshift({ payment, outcome: outcome ?? 'approved', place: l._place });
    const rec = takePayment({ place: l._place, account: l.account, ticketNumber: l.ticketNumber, session: l.session?.id, amount: value, meansOfPayment, channel: 'online', cardLast4, link: id });
    if (rec.paymentStatus !== 'approved') return { link: links().get(id), payment: rec };
    return { link: linkTransition(id, 'paid', { payment: refOf(rec.id, 'PaymentRecord') }), payment: rec };
  };

  const armOutcome = (o) => {
    if (o.payment && payments().has(o.payment)) throw new Error(`payment ${o.payment} already exists; an outcome arms the next attempt`);
    if (!['approved', 'declined'].includes(o.outcome)) throw new Error("outcome must be 'approved' or 'declined'");
    outcomes.push(o);
    return { armed: outcomes.length, next: o };
  };

  return {
    reset,
    policy,
    ticketInfo,
    findAccounts,
    setBalance,
    takePayment,
    capture,
    voidHold,
    assertRefundable,
    refund,
    post,
    createLink,
    cancelLink,
    openLink,
    payLink,
    scheduleExpiry,
    armOutcome,
    mirror,
    apdsPayment,
    refundable,
  };
}
