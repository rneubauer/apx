/**
 * apx-accounts and apx-payment-history (Part 13 §13.1, §13.1a, §13.2,
 * §13.4–§13.6): account lookups bounded by the place grant, taking a
 * payment (sale, hold, decline), the payment state machine (capture,
 * void, refund, posting), payment links, and the truncated-key payment
 * history with its 8-hour privacy window (Part 9 §9.6(5)).
 *
 * Collections: accounts (`_places`), payments (`_place`, `_session`,
 * `_link`, `_voidedAt`, `_reversedAt`, `_refunds`, `_declineReason`,
 * `_authorizedAmount`), paymentLinks (`_place`, `_history`, `_cancel`),
 * plus defensive seeds of sessions (`_ticketNumber`, `_amountDue`,
 * `_phone`, `_payments`, `_assignedRight`) and resolutionContexts.
 *
 * World sections read: accounts[], payments[], paymentLinks[], tickets[],
 * sessions[], resolutionContexts[], accountsPolicy{}.
 */
import { createHash } from 'node:crypto';
import { fail } from '../kernel/problems.mjs';
import { validateRequestBody, ajvToErrors, fmtErrors } from '../kernel/spec.mjs';
import { paginate, wire, refOf, getVisible, placeOfTarget, money, installChangeFeeds } from './common.mjs';
import { createLedger, paymentView, isHold } from './accounts/ledger.mjs';
import { scanBody, scanQuery, isRawContact } from './accounts/pii.mjs';

const WINDOW_MS = 8 * 3600_000; // Part 13 §13.2: a privacy control, never widened by configuration (Part 9 §9.6(5))
const HISTORY_KEYS = ['ticketLast4', 'cardLast4', 'ticketNumber', 'account'];
const LINK_OP = 'post-apx-v1-payment-links';

const CARD_REFUSAL = {
  cardLast4: 'cardLast4 must be 2 to 4 digits; APX never carries a primary account number (Part 9 §9.6). The request was not stored.',
  members: (m) => `The body carries members that look like card data (${m.join(', ')}). Card capture happens in the implementer's PCI scope, never on this API. The request was not stored.`,
  embedded: 'The body carries a card number. Card capture happens in the implementer\'s PCI scope, never on this API. The request was not stored.',
};

function refuseCardData(body) {
  const hit = scanBody(body);
  if (!hit) return;
  const detail = hit.kind === 'members' ? CARD_REFUSAL.members(hit.members) : CARD_REFUSAL[hit.kind];
  fail('personal-data-not-permitted', detail);
}

function refuseCardQuery(ctx) {
  const name = scanQuery(ctx.query);
  if (name) fail('personal-data-not-permitted', `${name} carries more card digits than APX accepts (at most the last four). The query was not logged.`);
}

/** Schema check for operations registered with skipBodyValidation (card data is refused first). */
function validateBody(ctx) {
  const { errors } = validateRequestBody(ctx.op, ctx.body);
  if (errors) fail('invalid-request', `request body fails the schema: ${fmtErrors(errors).slice(0, 300)}`, { errors: ajvToErrors(errors) });
}

const isoDate = (value, name) => {
  if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('invalid-request', `${name} must be a full-date (YYYY-MM-DD)`, { errors: [{ pointer: `?${name}`, detail: 'full-date expected' }] });
  return value;
};

export default {
  name: 'accounts',
  register(sim) {
    const ledger = createLedger(sim);
    const accounts = () => sim.store.collection('accounts');
    const payments = () => sim.store.collection('payments');
    const links = () => sim.store.collection('paymentLinks');
    const sessions = () => sim.store.collection('sessions');
    const contexts = () => sim.store.collection('resolutionContexts');

    // ---------- seeding ----------

    sim.seed((world) => {
      ledger.reset();
      for (const a of world.accounts ?? []) {
        accounts().put({ ...a, version: a.version ?? 1, _places: a._places ?? (a.places ?? []).map((p) => p.id) });
      }
      for (const s of world.sessions ?? []) {
        if (!sessions().has(s.id)) sessions().put({ ...s, _place: s._place ?? s.hierarchyElement?.id });
      }
      for (const p of world.payments ?? []) {
        payments().put({ postings: [], ...p, version: p.version ?? 1, _place: p._place ?? p.place?.id });
      }
      for (const l of world.paymentLinks ?? []) {
        const link = links().put({ ...l, version: l.version ?? 1, _place: l._place ?? l.place?.id });
        ledger.scheduleExpiry(link);
      }
      for (const r of world.resolutionContexts ?? []) {
        if (!contexts().has(r.id)) contexts().put({ ...r, _place: r._place ?? r.place?.id });
      }
    });

    sim.view('payments', (p) => paymentView(p));
    sim.view('paymentLinks', (l) => wire(l));

    // ---------- visibility ----------

    const covered = (principal, placeId) => principal.hasGrant && sim.hierarchy.covers(principal.places, placeId);
    const accountVisible = (principal, a) => principal.hasGrant && (!a._places?.length || a._places.some((p) => covered(principal, p)));
    const inPlaces = (placeIds, placeId) => placeIds.some((q) => sim.hierarchy.within(placeId, q) || sim.hierarchy.within(q, placeId));

    /** `place` narrowing (§13.5(3)): every named element must be inside the grant. */
    const narrowing = (ctx) => {
      const ids = ctx.query.list('place');
      for (const id of ids) {
        if (!covered(ctx.principal, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
      }
      return ids;
    };

    const visibleAccount = (ctx, id) => {
      const a = accounts().get(id);
      if (!a) fail('target-not-found', `No account ${id}.`);
      if (!accountVisible(ctx.principal, a)) {
        fail('insufficient-grant', `Account ${id} is valid only at place ${(a._places ?? []).join(', ')}, which is not in the token's apx_places grant.`);
      }
      return a;
    };

    const visiblePayment = (ctx, id) => getVisible(ctx, 'payments', id, { what: 'payment' });
    const visibleLink = (ctx, id) => getVisible(ctx, 'paymentLinks', id, { what: 'payment link' });

    // ---------- accounts ----------

    const listAccounts = (ctx) => {
      refuseCardQuery(ctx);
      const places = narrowing(ctx);
      if (!ctx.principal.hasGrant) return paginate(ctx, []);
      const q = (n) => ctx.query.get(n);
      const rows = ledger
        .findAccounts({ name: q('name'), phone: q('phone'), email: q('email'), card: q('card'), plate: q('plate') })
        .filter((a) => accountVisible(ctx.principal, a))
        .filter((a) => !places.length || !a._places?.length || a._places.some((p) => inPlaces(places, p)))
        .sort((x, y) => x.id.localeCompare(y.id));
      return paginate(ctx, rows);
    };

    sim.on('get-apx-v1-accounts', listAccounts);

    // §13.1 "lookup in a body": the same keys, rules and answer as the GET; card data is refused before the schema check.
    sim.on('post-apx-v1-accounts-search', (ctx) => searchAs(ctx, listAccounts), { skipBodyValidation: true });

    sim.on('get-apx-v1-accounts-id', (ctx) => wire(visibleAccount(ctx, ctx.params.id)));

    // ---------- payments ----------

    sim.on(
      'post-apx-v1-payments',
      (ctx) => {
        const b = ctx.body;
        refuseCardData(b);
        validateBody(ctx);
        if (!b.account && !b.ticketNumber) {
          fail('invalid-request', 'A payment needs an account reference or a ticketNumber; the body carries neither.', { errors: [{ pointer: '/', detail: 'account or ticketNumber required' }] });
        }
        const { place } = placeOfTarget(ctx, b.place, 'place');
        if (b.account) {
          const a = accounts().get(b.account.id);
          if (!a) fail('reference-unknown', `Account ${b.account.id} names nothing that exists or is visible to the caller.`);
          if (a._places?.length && !inPlaces(a._places, place.id)) fail('request-unprocessable', `Account ${a.id} is not valid at place ${place.id}.`);
        }
        if (!(b.amount.currencyValue > 0)) fail('request-unprocessable', 'amount must be greater than zero.');
        const rec = ledger.takePayment(
          { place: place.id, account: b.account, ticketNumber: b.ticketNumber, amount: b.amount, meansOfPayment: b.meansOfPayment, channel: b.channel, cardLast4: b.cardLast4, captureLater: b.captureLater, extensions: b.extensions },
          { assignedId: ctx.assignId, actor: ctx.actor }
        );
        if (rec.paymentStatus === 'declined') {
          fail('payment-declined', `${rec._declineReason} No funds were taken.`, { payment: refOf(rec.id, 'PaymentRecord') });
        }
        return { status: 201, body: paymentView(rec), idem: { collection: 'payments', id: rec.id } };
      },
      { skipBodyValidation: true }
    );

    /** Validation and grant checks shared by the lookup, its body form and the feed; returns the narrowing places. */
    const checkPaymentQuery = (ctx) => {
      const q = (n) => ctx.query.get(n);
      isoDate(q('date'), 'date');
      const captureStatus = q('captureStatus');
      if (captureStatus !== undefined && !['authorized', 'captured'].includes(captureStatus)) {
        fail('invalid-request', 'captureStatus must be authorized or captured', { errors: [{ pointer: '?captureStatus', detail: 'enum' }] });
      }
      if (q('cardLast4') !== undefined && !/^\d{2,4}$/.test(q('cardLast4'))) {
        fail('invalid-request', 'cardLast4 must be 2 to 4 digits', { errors: [{ pointer: '?cardLast4', detail: 'pattern ^[0-9]{2,4}$' }] });
      }
      const places = narrowing(ctx);
      const account = q('account');
      if (account && accounts().has(account) && ctx.principal.hasGrant && !accountVisible(ctx.principal, accounts().get(account))) {
        fail('insufficient-grant', `Account ${account} is valid only at places outside the token's apx_places grant.`);
      }
      return places;
    };

    /** The key and narrowing filters every payment answer applies (grant, place, ticket, card, account, date). */
    const paymentMatcher = (ctx, places) => {
      const q = (n) => ctx.query.get(n);
      const date = q('date');
      return (p) =>
        covered(ctx.principal, p._place) &&
        (!places.length || inPlaces(places, p._place)) &&
        (!q('ticketLast4') || String(p.ticketNumber ?? '').endsWith(q('ticketLast4'))) &&
        (!q('cardLast4') || String(p.cardLast4 ?? '').endsWith(q('cardLast4'))) &&
        (!q('ticketNumber') || p.ticketNumber === q('ticketNumber')) &&
        (!q('account') || p.account?.id === q('account')) &&
        (!date || localDate(p.dateCollected, p._place) === date);
    };

    const newestFirst = (x, y) => (x.dateCollected < y.dateCollected ? 1 : x.dateCollected > y.dateCollected ? -1 : 0);

    const listPayments = (ctx) => {
      refuseCardQuery(ctx);
      if (!HISTORY_KEYS.some((k) => ctx.query.has(k))) {
        const narrowOnly = ctx.query.has('date') || ctx.query.has('place') || ctx.query.has('captureStatus');
        fail(
          'invalid-request',
          narrowOnly
            ? 'date, place and captureStatus only narrow a keyed query; give ticketLast4, cardLast4, ticketNumber, or account.'
            : 'GET /v1/payments needs at least one key: ticketLast4, cardLast4, ticketNumber, or account; an unfiltered payment history is not served.',
          { errors: [{ pointer: '/query', detail: 'no key parameter given' }] }
        );
      }
      const places = checkPaymentQuery(ctx);
      if (!ctx.principal.hasGrant) return paginate(ctx, []);
      const captureStatus = ctx.query.get('captureStatus');
      const truncatedOnly = (ctx.query.has('ticketLast4') || ctx.query.has('cardLast4')) && !ctx.query.has('ticketNumber') && !ctx.query.has('account');
      const windowStart = truncatedOnly && !ctx.query.has('date') ? ctx.clock.nowMs() - WINDOW_MS : null;
      const matches = paymentMatcher(ctx, places);
      const rows = payments()
        .find((p) => {
          if (!matches(p)) return false;
          if (windowStart !== null && Date.parse(p.dateCollected) < windowStart) return false;
          if (captureStatus === 'authorized') return p.captureStatus === 'authorized';
          if (isHold(p) || p.captureStatus === 'authorized') return false;
          if (captureStatus === 'captured' && p.paymentStatus === 'declined') return false;
          return true;
        })
        .sort(newestFirst)
        .map(paymentView);
      return paginate(ctx, rows);
    };

    sim.on('get-apx-v1-payments', listPayments);

    // §13.2: the same keys rule, 8-hour window, hold and grant rules in a PaymentSearch body.
    sim.on('post-apx-v1-payments-search', (ctx) => searchAs(ctx, listPayments), { skipBodyValidation: true });

    /**
     * The payments feed (Part 5 §5.2 rule 8 difference 6): what
     * apx.accounts.payment.recorded.v1 delivers to the credential, so no
     * key and no 8-hour window; a hold appears at capture, never before,
     * and a voided hold never appears. Truncated keys are refused.
     */
    const paymentFeed = (ctx) => {
      refuseCardQuery(ctx);
      for (const k of ['ticketLast4', 'cardLast4']) {
        if (ctx.query.has(k)) fail('invalid-request', `${k} is not accepted with mode=change; the feed is never a way round the 8-hour window (Part 13 §13.2).`, { errors: [{ pointer: `?${k}`, detail: 'not allowed with mode=change' }] });
      }
      const places = checkPaymentQuery(ctx);
      if (!ctx.principal.hasGrant) return { data: [] };
      const captureStatus = ctx.query.get('captureStatus');
      const matches = paymentMatcher(ctx, places);
      const published = (p) => p.paymentStatus === 'declined' || (p.paymentStatus === 'approved' && p.captureStatus !== 'authorized') || (p.paymentStatus === 'reversed' && !p._voidedAt);
      const rows = payments()
        .find((p) => matches(p) && published(p) && (captureStatus !== 'captured' || p.paymentStatus !== 'declined') && captureStatus !== 'authorized')
        .sort(newestFirst)
        .map(paymentView);
      return { data: rows };
    };
    installChangeFeeds(sim, { 'get-apx-v1-payments': { handler: paymentFeed } });

    /** A `:search` body as the GET's query: arrays become comma lists; nothing else changes. */
    const searchAs = (ctx, list) => {
      const body = ctx.body ?? {};
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null) continue;
        params.set(k, Array.isArray(v) ? v.join(',') : String(v));
      }
      const query = new ctx.query.constructor(params.toString());
      refuseCardQuery({ query });
      validateBody(ctx);
      return list({ ...ctx, query });
    };

    const localDate = (instant, placeId) => {
      const tz = sim.hierarchy.placeOf(placeId)?.timeZone;
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
      } catch {
        return String(instant).slice(0, 10);
      }
    };

    sim.on(
      'post-apx-v1-payments-id-postings',
      (ctx) => {
        visiblePayment(ctx, ctx.params.id);
        const b = ctx.body ?? {};
        if (b.account) visibleAccount(ctx, b.account.id);
        return { status: 201, body: ledger.post(ctx.params.id, b, { actor: ctx.actor }) };
      },
      { allowEmptyBody: true }
    );

    sim.on(
      'post-apx-v1-payments-id-refund',
      (ctx) => {
        visiblePayment(ctx, ctx.params.id);
        ledger.assertRefundable(ctx.params.id);
        const role = ledger.policy().refundApprovalRole;
        if (role && !ctx.body?.approval?.approvedBy) {
          fail('approval-required', `Refunds at this place require ${role} approval; the request carries no approval evidence.`);
        }
        const rec = ledger.refund(ctx.params.id, ctx.body?.amount, { actor: ctx.actor });
        // Part 13 §13.1a: the counted reason (apx-refund-reasons) beside the free text, kept with the refund it explains.
        if (ctx.body?.reasonCode || ctx.body?.reason) {
          payments().update(rec.id, (p) => ({ ...p, _refunds: (p._refunds ?? []).map((r, i, all) => (i === all.length - 1 ? { ...r, ...(ctx.body.reasonCode ? { reasonCode: ctx.body.reasonCode } : {}), ...(ctx.body.reason ? { reason: ctx.body.reason } : {}) } : r)) }), { bump: false });
        }
        return { status: 200, body: paymentView(payments().get(rec.id)), idem: { collection: 'payments', id: rec.id } };
      },
      { allowEmptyBody: true }
    );

    // ---------- receipts (Part 13 §13.1a) ----------

    const RECEIPT_CHANNELS = ['email', 'sms', 'print', 'link'];
    const receiptChannels = () => sim.world.accountsPolicy?.receiptChannels ?? ['email', 'sms', 'link'];
    const receiptBase = () => (sim.world.accountsPolicy?.receiptBase ?? 'https://pay.lakeside-garage.example/r').replace(/\/$/, '');

    sim.on('post-apx-v1-payments-id-receipt', (ctx) => {
      const p = visiblePayment(ctx, ctx.params.id);
      const b = ctx.body;
      if (!RECEIPT_CHANNELS.includes(b.channel)) fail('invalid-request', `channel must be one of ${RECEIPT_CHANNELS.join(', ')}.`, { errors: [{ pointer: '/channel', detail: 'enum' }] });
      if (p.paymentStatus !== 'approved') {
        fail('payment-state-illegal', `Payment ${p.id} is ${p.paymentStatus}; only an approved payment has a receipt.`);
      }
      const offered = receiptChannels();
      if (!offered.includes(b.channel)) {
        fail('receipt-channel-unsupported', `No receipt ${b.channel === 'print' ? 'printer serves' : `${b.channel} delivery serves`} payment ${p.id}; this site offers ${offered.join(', ')}.`);
      }
      if ((b.channel === 'email' || b.channel === 'sms') && !b.destination) {
        fail('invalid-request', `channel ${b.channel} needs destination (an address or a number), in the body and never in the URL.`, { errors: [{ pointer: '/destination', detail: 'required' }] });
      }
      const now = ctx.now();
      const n = sim.store.next('receipt', 1);
      const link = b.channel === 'link' ? `${receiptBase()}/${createHash('sha256').update(`${p.id}|${n}`).digest('hex').slice(0, 32)}` : undefined;
      const delivery = { payment: refOf(p.id, 'PaymentRecord'), channel: b.channel, status: b.channel === 'link' ? 'sent' : 'queued', ...(link ? { link } : {}), requestedAt: now };
      const rec = sim.store.collection('receiptDeliveries').insert({ ...delivery, _place: p._place, _destination: b.destination, _agent: b.agent, _correlationId: b.correlationId }, { actor: { org: ctx.actor.org, user: b.agent ?? ctx.actor.user } });
      if (delivery.status === 'queued') {
        sim.clock.schedule({ delay: 2000 }, () => sim.store.collection('receiptDeliveries').update(rec.id, (r) => ({ ...r, status: 'sent' }), { bump: false }), `receipt ${rec.id} sent`);
      }
      sim.hooks.emit('receipt.requested', { payment: p, delivery: rec });
      return { status: 202, body: delivery, idem: { collection: 'receiptDeliveries', id: rec.id } };
    });
    sim.view('receiptDeliveries', (r) => {
      const { id: _i, version: _v, recordInfo: _r, ...rest } = wire(r);
      return rest;
    });

    sim.on('post-apx-v1-payments-id-void', (ctx) => {
      visiblePayment(ctx, ctx.params.id);
      const rec = ledger.voidHold(ctx.params.id, { actor: ctx.actor });
      return { status: 200, body: paymentView(rec), idem: { collection: 'payments', id: rec.id } };
    });

    sim.on(
      'post-apx-v1-payments-id-capture',
      (ctx) => {
        visiblePayment(ctx, ctx.params.id);
        const rec = ledger.capture(ctx.params.id, ctx.body?.amount, { actor: ctx.actor });
        return { status: 200, body: paymentView(rec), idem: { collection: 'payments', id: rec.id } };
      },
      { allowEmptyBody: true }
    );

    // ---------- payment links ----------

    /** Part 17 §17.3: the context's decision on sending a link; returns the context version it was checked against. */
    const contextGate = (b) => {
      if (!b.resolutionContext) return undefined;
      const rc = contexts().get(b.resolutionContext.id);
      if (!rc) fail('reference-unknown', `resolutionContext ${b.resolutionContext.id} names nothing that exists or is visible to the caller.`);
      const action = (rc.allowedActions ?? []).find((a) => a.action === LINK_OP || a.execution?.operationId === LINK_OP);
      if (action && action.allowed === false) fail('action-not-allowed', `Context ${rc.id} evaluated ${LINK_OP} as not allowed.`);
      if (action?.requiresApproval && !b.approval?.approvedBy) {
        fail('approval-required', `Context ${rc.id} allows ${LINK_OP} only with approval by role ${action.approvalRole ?? 'supervisor'}; no approval evidence supplied.`);
      }
      return rc.version;
    };

    sim.on(
      'post-apx-v1-payment-links',
      (ctx) => {
        const b = ctx.body;
        refuseCardData(b);
        if (isRawContact(b.sentTo)) fail('personal-data-not-permitted', 'sentTo is a masked handle the server assigns; a raw phone number or e-mail address is not accepted. The request was not stored.');
        validateBody(ctx);
        if (!b.account && !b.ticketNumber && !b.session) {
          fail('invalid-request', 'A payment link needs an account, a ticketNumber, or a session; the body carries none.', { errors: [{ pointer: '/', detail: 'account, ticketNumber or session required' }] });
        }
        const { place } = placeOfTarget(ctx, b.place, 'place');
        const channels = ledger.policy().linkChannels;
        if (!channels.includes(b.channel)) fail('request-unprocessable', `Channel ${b.channel} is not offered at this place; supported channels are ${channels.join(' and ')}.`);
        if (b.account) {
          if (!accounts().has(b.account.id)) fail('reference-unknown', `Account ${b.account.id} names nothing that exists or is visible to the caller.`);
          visibleAccount(ctx, b.account.id);
        }
        if (b.session && !sessions().has(b.session.id)) fail('reference-unknown', `Session ${b.session.id} names nothing that exists or is visible to the caller.`);
        if (b.expiresAt && Date.parse(b.expiresAt) <= ctx.clock.nowMs()) fail('request-unprocessable', `expiresAt ${b.expiresAt} is not in the future (server time ${ctx.now()}).`);
        if (b.amount && !(b.amount.currencyValue > 0)) fail('request-unprocessable', 'amount must be greater than zero.');
        const contextVersion = contextGate(b);
        const link = ledger.createLink({ ...b, place: { id: place.id, className: b.place.className } }, { assignedId: ctx.assignId, actor: ctx.actor, contextVersion });
        return { status: 201, body: wire(link), idem: { collection: 'paymentLinks', id: link.id } };
      },
      { skipBodyValidation: true }
    );

    sim.on('get-apx-v1-payment-links-id', (ctx) => wire(visibleLink(ctx, ctx.params.id)));

    sim.on(
      'post-apx-v1-payment-links-id-cancel',
      (ctx) => {
        visibleLink(ctx, ctx.params.id);
        const link = ledger.cancelLink(ctx.params.id, ctx.body ?? {}, { actor: ctx.actor });
        return { status: 200, body: wire(link), idem: { collection: 'paymentLinks', id: link.id } };
      },
      { allowEmptyBody: true }
    );

    // ---------- other domains ----------

    // Part 6 §6.3: an applied validation SHOULD appear APDS-side as a Payment of type `validation`.
    sim.hooks.on('validation.applied', ({ ticket, validationId, reduced, place }) => {
      if (!reduced || !validationId) return;
      const info = ledger.ticketInfo(ticket, place);
      if (!info?.session) return;
      const currency = info.amountDue?.currencyType ?? 'USD';
      const pseudo = { id: validationId, dateCollected: sim.clock.now(), transactionID: validationId, _place: place };
      ledger.mirror(info.session, ledger.apdsPayment(pseudo, 'validation', money(reduced, currency)));
    });

    // ---------- injectors ----------

    sim.injector('paymentOutcome', ({ payment, outcome = 'declined', reason, ticketNumber, account, place, transactionID }) =>
      ledger.armOutcome({ payment, outcome, reason, ticketNumber, account, place, transactionID })
    );
    sim.injector('paymentLinkOpened', ({ link }) => wire(ledger.openLink(link)));
    sim.injector('paymentLinkPaid', ({ link, amount, payment, cardLast4, meansOfPayment, outcome }) => {
      const out = ledger.payLink(link, { amount, payment, cardLast4, meansOfPayment, outcome });
      return { link: wire(out.link), payment: paymentView(out.payment) };
    });
    sim.injector('accountBalance', ({ account, balance }) => {
      const a = accounts().get(account);
      if (!a) throw new Error(`no account ${account}`);
      const value = typeof balance === 'number' ? balance : balance?.currencyValue;
      if (typeof value !== 'number') throw new Error('balance must be a number or an AmountInCurrency');
      return wire(ledger.setBalance(account, () => value, undefined, { create: true }));
    });

    // ---------- exposed for the resolution module ----------

    const grantFilter = (principal) => (a) => !principal || accountVisible(principal, a);
    sim.accounts = {
      ...ledger,
      paymentView,
      accountVisible,
      accountById: (id) => accounts().get(id) ?? null,
      accountsByPhone: (phone, principal) => ledger.findAccounts({ phone }).filter(grantFilter(principal)),
      accountsByPlate: (plate, principal) => ledger.findAccounts({ plate }).filter(grantFilter(principal)),
      paymentsFor: ({ ticketNumber, account, session } = {}) =>
        payments().find((p) => (ticketNumber && p.ticketNumber === ticketNumber) || (account && p.account?.id === account) || (session && p._session === session)),
      linksFor: ({ ticketNumber, account, session } = {}) =>
        links().find((l) => (ticketNumber && l.ticketNumber === ticketNumber) || (account && l.account?.id === account) || (session && l.session?.id === session)),
    };
  },
};
