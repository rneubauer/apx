# APX Part 13 — Accounts, Payments, LPR (optional classes)

Three optional conformance classes for call-center and back-office
integration over live PARCS state.

## 13.1 `apx-accounts`

- `GET /v1/accounts?name=|phone=|card=|plate=` — look up accounts by any
  combination. Returns Account[] with balances and
  status. Scope `apx.accounts:read`.
- `GET /v1/accounts/{id}` — full account info.
- `POST /v1/payments` — take a payment. Body:
  account Reference (or `ticketNumber`), the (required) `place` binding,
  `amount`, `method`
  (`autoAttendant` = PCI-compliant IVR captures the card out of band; APX
  never carries PANs). **Idempotency-Key REQUIRED.** Returns a
  PaymentRecord with `transactionID`. Declines are `422 payment-declined`.
  Approved account payments reduce the account balance. Scope
  `apx.payments:write`.
- `POST /v1/payments/{id}/postings` — accounting write-back
  (PARIS-style): posts account/card/amount/transaction
  ID to the AR system and returns `{confirmationNumber, accountUpdated,
  newBalance}`.

## 13.1a Payment lifecycle and payment links (financial actions)

Customer-service financial actions are domain operations here — never
control commands (Part 17 §17.4):

- `POST /v1/payment-links` — send a hosted payment link (sms/email) for an
  account, ticket, or session; returns the `PaymentLink` lifecycle
  resource (`sent → opened → paid | expired | cancelled`). The action of
  first resort when policy blocks a gate override. APX never carries PANs;
  `sentTo` is masked.
- `POST /v1/payments/{id}/refund` — full, or partial per `amount`.
  Refunds SHOULD require approval by default operator policy; approval
  evidence rides the request when the resolution context demanded it.
- `POST /v1/payments/{id}/void` / `POST /v1/payments/{id}/capture` —
  authorization lifecycle where the implementation models it.

All four take a REQUIRED `Idempotency-Key`. Completion of a link-initiated
payment publishes `apx.accounts.payment.recorded.v1` like any other.

## 13.2 `apx-payment-history`

- `GET /v1/payments?ticketLast4=&cardLast4=&date=` — payments made on a
  ticket. `cardLast4` (truncated PAN, PCI-permitted) is
  the **transient-parker lookup of last resort**: at locations without LPR,
  a caller who cannot read their ticket usually has nothing else.
  **Privacy rule (normative):** truncated-key lookups (`ticketLast4` or
  `cardLast4`) without a `date` are constrained to the last 8 hours; older
  records require the full ticket number or an account-scoped query.

## 13.3 `apx-lpr`

- Ingest is NATIVE: LPR vendors `POST /observations` (APDS route) with
  Confidence and Image — nothing new to implement.
- `GET /v1/lpr/reads?plate=|ticket=` — the bidirectional cross-lookup:
  plate → ticket/session (+ accuracy + screenshot),
  ticket → plate. Scope `apx.lpr:read`. Every read carries its (required)
  `place` binding (§13.5).

## 13.4 Eventing — the analytics feed

APDS's native `EventTypeEnum` publishes entity lifecycle events for
Sessions, Places, Rates, Rights, and Organisations — but **not** for
payments or observations, the two highest-value streams for financial and
LPR analytics. APX closes both gaps (registry `apx-topics`):

- `apx.accounts.payment.recorded.v1` — published for every recorded
  payment, whether taken via `POST /v1/payments` or ingested from a lane
  device. Event `data` is the PaymentRecord. Implementations claiming
  `apx-accounts` MUST publish it.
- `apx.data.observation.created.v1` — published for every ingested
  Observation (LPR read, RFID hit, sensor event). Event `data` is the
  APDS Observation; `subject` references it. Implementations claiming
  `apx-lpr` MUST publish it; implementations serving `POST /observations`
  writes SHOULD publish it regardless.

**The full-fidelity export recipe (informative).** An analytics platform
that wants *everything* about a location combines three mechanisms, all
already normative: (1) bulk/exactly-once history via the Part 5 change
feed (`mode=change&cursor=…`) on every native route — sessions, rates,
rights, observations; (2) real-time push via one Part 8 subscription
mixing APDS EventTypeEnum topics with the APX topics above plus
`apx.data.occupancy.v1`, alert, and command topics; (3) point-in-time
convenience reads (occupancy §5.5, lane inquiry §6.2). Nothing about a
place that APX models is unreachable by feed.

## 13.5 Site binding on aggregating implementations (normative)

Payments, accounts, and LPR reads must remain attributable and isolated
per location when one endpoint fronts many places (Part 8 §8.5, Part 9
§9.3):

1. `PaymentRecord.place` and `LprRead.place` are REQUIRED — every payment
   and plate read names the HierarchyElement it belongs to, in API
   responses and in event payloads alike. `Account.places` SHOULD be
   populated where accounts are place-scoped.
2. **Grant enforcement on place-less lookups.** `GET /v1/accounts`,
   `GET /v1/payments`, and `GET /v1/lpr/reads` take no place parameter,
   but their results MUST be constrained to records whose place binding
   (or, for accounts, any of whose `places`) falls inside the caller's
   `apx_places` grant. A credential granted one garage searching by
   name, plate, or truncated card MUST NOT see records from any other
   location. The scope check alone is NOT sufficient authorization for
   these routes.
3. Implementations MAY additionally accept a `place` query parameter on
   these lookups to narrow results below the grant (the pattern
   established by `/v1/reservations/recent`, Part 14 §14.1a).
