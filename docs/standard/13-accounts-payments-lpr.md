# APX Part 13 — Accounts, Payments, LPR (optional classes)

Three optional conformance classes covering the 2018 "Desirable" tier.

## 13.1 `apx-accounts`

- `GET /apx/v1/accounts?name=|phone=|card=|plate=` — look up accounts by any
  combination (2018 requirement ⑥). Returns Account[] with balances and
  status. Scope `apx.accounts:read`.
- `GET /apx/v1/accounts/{id}` — full account info.
- `POST /apx/v1/payments` — take a payment (2018 requirement ⑦). Body:
  account Reference (or `ticketNumber`), `amount`, `method`
  (`autoAttendant` = PCI-compliant IVR captures the card out of band; APX
  never carries PANs). **Idempotency-Key REQUIRED.** Returns a
  PaymentRecord with `transactionID`. Declines are `422 payment-declined`.
  Approved account payments reduce the account balance. Scope
  `apx.payments:write`.
- `POST /apx/v1/payments/{id}/postings` — accounting write-back
  (2018 requirement ⑨, PARIS-style): posts account/card/amount/transaction
  ID to the AR system and returns `{confirmationNumber, accountUpdated,
  newBalance}`.

## 13.2 `apx-payment-history`

- `GET /apx/v1/payments?ticketLast4=&date=` — payments made on a ticket
  (2018 requirement ⑧). **Privacy rule (normative):** last-4 lookup without
  a `date` is constrained to the last 8 hours; older records require the
  full ticket number or an account-scoped query.

## 13.3 `apx-lpr`

- Ingest is NATIVE: LPR vendors `POST /observations` (APDS route) with
  Confidence and Image — nothing new to implement.
- `GET /apx/v1/lpr/reads?plate=|ticket=` — the bidirectional cross-lookup
  (2018 requirement ⑩): plate → ticket/session (+ accuracy + screenshot),
  ticket → plate. Scope `apx.lpr:read`.
