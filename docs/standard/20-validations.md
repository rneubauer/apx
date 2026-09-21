# APX Part 20 — Validations (optional class `apx-validations`)

Validation **program management**: everything an operator does around the
two pieces Part 6 §6.3 already defines — the provider lookup
(`GET /v1/validations/providers`) and the `applyValidation` command.
This Part adds merchant enrolment, instrument stock (codes, QR, stamps),
the redemption ledger every channel writes, and merchant billing.

**APDS alignment.** APDS 4.1 records that a validation *happened*
(`PaymentTypeEnum: validation`, `Segment.validationType/validationId`,
`RateTable.validation`, `RateDiscount`) and nothing about who may
validate, on what terms, or who pays. APX composes those constructs:
the merchant is a `Contact`/`Organisation`, the place a
`HierarchyElement`, the ticket a `Session`, money `AmountInCurrency`,
comped time `Duration`, and the applied validation's id **is** the APDS
`Segment.validationId`. No APDS entity is redefined; Part 3 §3.3(8)
applies if APDS later standardizes a validation program natively.

## 20.1 ValidationProgram

See schema. A program is one merchant's enrolment at one place (or
subtree root): `benefit` (exactly one of `amount`, `duration`,
`percentage`), `rules` (§20.3), `billing` (§20.6), `issuanceMethods`, and
`programStatus`.

1. **Lifecycle:** `active ⇄ suspended`; either → `ended` (terminal).
   Transitions and every other change go through `PUT` carrying the
   `version` last read; a stale version is 409 `version-conflict` (Part 5
   §5.1 full-update semantics). Any transition out of `ended` is 422
   `program-not-active`. Every transition appends `statusHistory[]` and
   publishes `apx.validations.program.status.v1`.
2. **Provider list derivation (normative).** When `apx-validations` is
   claimed, `GET /v1/validations/providers?place=` MUST return exactly the
   `active` programs whose `place` is the queried element or an ancestor
   of it, each row carrying the additive `ValidationProvider.program`
   reference, with `benefit` and `validationType` copied from the
   program. The Part 6 enforcement rule (422 `validation-provider-unknown`
   for `applyValidation` with an unlisted provider) therefore becomes
   "not an active program here".
3. Benefit and rule changes apply to redemptions from the update onward.
   Instruments already issued keep the benefit they were issued with
   (`ValidationInstrument.benefit`).

## 20.2 Instruments and issuance

`POST /v1/validations/programs/{id}/issuances` issues a batch of
`quantity` instruments of one `method`. **Idempotency-Key REQUIRED** — a
retried print job must not double the stock.

1. For `code`, `qrCode`, and `digital`, the server generates `codes[]`
   and returns them **exactly once**, in the 201 response (the Part 8 §8.1
   secret convention). Idempotent replays and later reads omit them.
   Codes MUST be unguessable (≥ 64 bits of entropy) and unique across the
   implementation, not merely across the program.
2. `stamp` batches carry no codes (physical stock, counted for billing);
   `api` batches represent redemptions a merchant system records directly
   without a per-instrument code.
3. `validTo` defaults from the program's `rules.validityWindow`; an
   instrument past `validTo` is `expired`.
4. `GET /v1/validations/instruments/{code}` returns the instrument's
   status, program, window, and benefit. A code outside the caller's grant
   is **404, never 403** — the read MUST NOT act as an oracle for guessing
   codes. Implementations SHOULD rate-limit it per credential (Part 12
   §12.3).

## 20.3 Redemption and the rule set (normative)

A redemption is one validation applied to one ticket/session. Every
channel writes the same resource:

| Channel | How it arrives |
|---|---|
| `payStation`, `lane`, `merchantApp`, `api` | `POST /v1/validations/redemptions` (**Idempotency-Key REQUIRED**) |
| `callCenter` (an agent acting on a lane) | the Part 6 `applyValidation` command; the server materializes the redemption with `command` set |

At redemption the server MUST evaluate, in order, and refuse with 422:

1. `program-not-active` — program not `active` (or place mismatch).
2. `instrument-invalid` — `instrumentCode` given but unknown, `void`,
   `expired`, or already `redeemed`; or the program requires an
   instrument (no `api` method) and none was given.
3. `redemption-limit-exceeded` — `rules.maxPerTicket` or
   `rules.maxPerDay` would be exceeded, or `rules.stackable` is false and
   another program is already applied to the ticket, or the session's
   rate table is not in `rules.applicableRateTables` (or does not accept
   validations per APDS `RateTable.validation`).

On success the server MUST: materialize the APDS-native record
(a Payment of type `validation` and the session segment's
`validationType`/`validationId`, per Part 6 §6.3) and return it as
`validationId`; set `amountReduced` (and `durationComped`) to the
**actual** effect on the amount due, never the nominal benefit; consume
the instrument (`redeemed`); and publish `apx.validations.redeemed.v1`.
Where the implementation also claims `apx-control`, the lane's
`currentTicket.validations[]` (Part 6) reflects the redemption.

The rule set above is closed so that two implementations evaluate the
same program identically. Rules beyond it (day-of-week, minimum spend,
customer segment) ride in `extensions` (Part 3 §3.3) and are the
implementer's to enforce.

## 20.4 Reversal

`POST /v1/validations/redemptions/{id}/reverse` moves `applied →
reversed`, restores the amount due on the session (and the APDS-native
record), and returns the instrument to `valid` while still inside its
window. Already reversed is 409 `redemption-reversed`. A redemption
inside a **closed** statement period cannot be reversed (409
`statement-closed`); the correction is a credit line on the next
statement, so closed statements stay immutable (§20.6).

## 20.5 Merchant scope (normative)

`apx.validations:redeem` is the merchant-facing scope. A token carrying it
(and not `:read`/`:manage`) is confined to programs whose `provider`
equals the token's `apx_org` (Part 9 §9.3): it MAY read those programs,
issue their stock, check their codes, record and list their redemptions,
and read their statements; it MUST NOT see other providers' programs or
redemptions, enrol or update programs, reverse redemptions, or close
statements. Operator scopes: `apx.validations:read` (all of the above,
read-only, across the place grant) and `apx.validations:manage`
(everything). Plate values never appear on validation resources; ticket
numbers and session references do, and are subject to Part 9 §9.6
minimization.

## 20.6 Billing statements

`billing.model` says who pays for a redemption: `merchantPays` (the
merchant is billed `unitPrice` per redemption, or the actual
`amountReduced` when `unitPrice` is absent), `operatorAbsorbs`
(statements are informational, `billableAmount` is zero), or `split`
(`merchantShare` percent of `amountReduced`).

- `GET /v1/validations/programs/{id}/statement?from=&to=` computes a
  **preview** (`statementStatus: preview`, no `id`) for any period.
- `POST /v1/validations/programs/{id}/statements` (**Idempotency-Key
  REQUIRED**) closes a period into an **immutable** statement
  (`closed`, with `id`, `lines[]`, `closedTime`, `closedBy`) that the
  operator's accounting system invoices from. Closed periods MUST NOT
  overlap (409 `statement-overlap`). Publishes
  `apx.validations.statement.closed.v1`.
- Redemptions reversed after closure appear as negative `billable` lines
  on the next closed statement, never as edits to the closed one.

APX does not invoice or take money for statements; that stays in the
operator's accounting system (Part 0 §0.4). A statement's `id` is the
reconciliation key.

## 20.7 Eventing

- `apx.validations.redeemed.v1` — a redemption was applied or reversed
  (data: `ValidationRedemption`).
- `apx.validations.program.status.v1` — a program was enrolled,
  suspended, resumed, or ended (data: `ValidationProgram`).
- `apx.validations.statement.closed.v1` — a period was closed (data:
  `ValidationStatement`, `lines[]` omitted).

Place binding (Part 8 §8.5) uses the resource's `place`. A
`apx.validations:redeem` subscription receives only events for its own
provider's programs (§20.5; Part 9 §9.6 rule 4).

## 20.8 Endpoints (summary)

| Operation | Scope |
|---|---|
| `POST /v1/validations/programs`, `PUT …/{id}` | `manage` |
| `GET /v1/validations/programs`, `GET …/{id}` | `read` or `redeem` (own) |
| `POST …/{id}/issuances` | `manage` or `redeem` (own) |
| `GET …/{id}/issuances`, `GET /v1/validations/instruments/{code}` | `read` or `redeem` (own) |
| `POST /v1/validations/redemptions` | `manage` or `redeem` (own) |
| `GET /v1/validations/redemptions`, `GET …/{id}` | `read` or `redeem` (own) |
| `POST …/{id}/reverse` | `manage` |
| `GET …/programs/{id}/statement` (preview), `GET …/programs/{id}/statements`, `GET /v1/validations/statements/{id}` | `read` or `redeem` (own) |
| `POST …/programs/{id}/statements` (close) | `manage` |

Every list is paginated in the APDS `PaginatedList` shape and constrained
to the caller's place grant.
