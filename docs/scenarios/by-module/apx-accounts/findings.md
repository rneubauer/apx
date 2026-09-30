# Findings — apx-accounts and apx-payment-history

Each entry is something a scenario in `scenarios.md` needed
that the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-ACC-NN`
markers so the runner reports them as known gaps rather than failures,
and reports them as resolved once the spec is fixed. Fixes land in the
spec as ordinary additive PRs.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-ACC-01 | accounts | low | No problem type for 401 (same gap as F-CTL-07) | fixed: `unauthenticated` registered in Part 12 (4417f2f) |
| F-ACC-02 | accounts | low | 401/403/429 missing on `GET /v1/accounts/{id}` and postings; 400 missing on refund/void/capture although `Idempotency-Key` is REQUIRED | fixed: shared 401/403/429/400 declared (4417f2f); 400 added to void |
| F-ACC-03 | accounts | medium | The described 400s ("nothing to settle", "unsupported channel") and the never-carry-a-PAN rule have no registered problem type | fixed: no target = 400 `invalid-request`, unsupported channel = 422 `request-unprocessable`, card data = 422 `personal-data-not-permitted` (§13.1) |
| F-ACC-04 | accounts | medium | Refund/void/capture/postings from the wrong payment state: 409 declared on three, undeclared on postings, no slug on any | fixed: 409 `payment-state-illegal` on refund/void/capture/postings (409 added to postings), §13.1a transition table |
| F-ACC-05 | accounts | medium | No authorization state: `paymentStatus` lacks `authorized` and the create shape cannot ask for authorize-only | fixed (reworked): `paymentStatus` unchanged; hold = `approved` + new readOnly `captureStatus: authorized`, via optional `captureLater`; holds hidden from `GET /v1/payments` unless `captureStatus=authorized`, not published or materialized until capture |
| F-ACC-06 | accounts | medium | `PaymentLink` has no read and no cancel route; `opened`, `paid`, `expired` are observable only by idempotent replay or the event, `cancelled` not at all | fixed: `GET /v1/payment-links/{id}` and `POST /v1/payment-links/{id}/cancel` |
| F-ACC-07 | accounts | medium | A partial refund is invisible on `PaymentRecord`; `reversed` is defined for full reversal only | fixed: readOnly `refundedAmount`, cumulative rule in §13.1a, 422 on over-refund |
| F-ACC-08 | accounts | low | §13.5(3) permits a `place` narrowing parameter on the place-less lookups; OpenAPI declares none | fixed: optional list-valued `place` on accounts and payments lookups (`/v1/lpr/reads` left to the LPR group) |
| F-ACC-09 | accounts | low | No `email` filter on `GET /v1/accounts` and no `email` on `Account` | fixed: `email` query parameter and `Account.email` |
| F-ACC-10 | payment-history | medium | `GET /v1/payments` lacks the `ticketNumber` and `account` filters §13.2 relies on, and an unfiltered query has no declared outcome | fixed: `ticketNumber` and `account` filters; a query with no key = 400 `invalid-request` (no new slug) |
| F-ACC-11 | accounts | low | 422 `payment-declined` has no defined member linking to the recorded declined `PaymentRecord` | fixed: `payment` extension member named in §13.1 (no `declineReason`) |
| F-ACC-12 | accounts | low | Whether refund/void/capture re-publish `apx.accounts.payment.recorded.v1` is unstated | fixed: §13.4 re-publishes on every status/amount/refund change with the full record |
| F-ACC-13 | accounts | low | A place-less lookup under an absent or empty `apx_places` grant: empty 200 or 403? | fixed: Part 9 §9.3a(3) empty 200 (not the 403 proposed), cross-referenced in §13.5(2) |
| F-ACC-14 | payment-history | low | `cardLast4` query parameter has no pattern; a full PAN in the query string is schema-valid and the refusal is undeclared | fixed: 422 `personal-data-not-permitted` declared and stated in §13.2; the query `pattern` is deferred (breaking) |

---

## F-ACC-01 — No problem type for 401

**Where it showed up.** ACC-24. `GET /v1/accounts`, `GET /v1/payments`,
`POST /v1/payments`, refund, void, capture, and `POST /v1/payment-links`
all declare the shared `Unauthorized` response, which is
`application/problem+json` with the `Problem` schema and a registered
`type`. Part 12 registers nothing at 401. Identical to F-CTL-07; recorded
here so the module's gap markers resolve against the same fix.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2:
"missing, malformed, expired, or revoked access token". One registration
closes F-CTL-07 and this entry together.

## F-ACC-02 — Auth, throttling, and idempotency responses declared unevenly

**Where it showed up.** ACC-03 (403 on `GET /v1/accounts/{id}`), ACC-15
(400 on refund). `GET /v1/accounts/{id}` and
`POST /v1/payments/{id}/postings` declare no 401, 403, or 429 although
both are secured and the account fetch is exactly where an out-of-grant
id shows up (§13.5). Refund, void, and capture say "Idempotency-Key
REQUIRED" in prose and in the parameter list, but declare no 400;
`POST /v1/payments` and `POST /v1/payment-links` do. The same family as
F-CTL-08.

**Proposed fix.** Declare 401/403/429 through the shared components on
`GET /v1/accounts/{id}` and the postings route, and add 400
(`idempotency-key-required`) to refund, void, and capture. The Spectral
rule proposed in F-CTL-08 (every secured operation declares the three
shared responses; every operation with a required `Idempotency-Key`
header declares 400) would catch both mechanically.

## F-ACC-03 — Body-shape and PAN refusals have no registered problem type

**Where it showed up.** ACC-07, ACC-12, ACC-20. `POST /v1/payments`
describes its 400 as "missing Idempotency-Key or no account/ticket to
settle" and `POST /v1/payment-links` as "no account/ticket/session to
settle, or unsupported channel", but Part 12 registers only
`idempotency-key-required` at 400. Separately, Part 9 §9.6(1) and Part 13
§13.1 say a full PAN is never carried, and `cardLast4` has a 2–4 digit
pattern, but a server that receives 16 digits (in `cardLast4`, in an
undeclared `cardNumber` member, or in the history query) has no
registered `type` to refuse with. The scenarios use
`settlement-target-required`, `channel-unsupported`, and
`card-data-not-accepted`.

**Proposed fix.** Register the three at 400 in Part 12 §12.2 and name
them in the 400 descriptions of the two operations. `card-data-not-accepted`
should also say the request body was not persisted or logged, since that
is the PCI point of the refusal.

## F-ACC-04 — Wrong-state refusals on the payment lifecycle have no slug

**Where it showed up.** ACC-10, ACC-15, ACC-16, ACC-17. Refund, void, and
capture each declare a 409 described as "not refundable / not voidable /
not capturable in its current state", but Part 12 registers only
`idempotency-conflict` at 409 for this module, so the two meanings share
one slug or the server invents one. Postings declares no refusal at all,
yet posting a declined or reversed payment to the AR system must be
refused. Every other module with a lifecycle has a
`<resource>-transition-illegal` slug (violations, credentials, valet).

**Proposed fix.** Register `payment-state-illegal` (409): "refund, void,
capture, or posting requested on a payment whose `paymentStatus` does not
allow it (Part 13 §13.1a)". Add 409 to the postings operation. Once
F-ACC-05 settles the state set, §13.1a should carry the transition table
(`authorized → approved | reversed`, `approved → reversed`, terminal
states refuse).

## F-ACC-05 — No authorization state and no way to request one

**Where it showed up.** ACC-16. §13.1a offers void and capture "where the
implementation models" an authorization lifecycle, but
`PaymentRecord.paymentStatus` is `approved | declined | reversed` — there
is no value for an authorized, uncaptured payment, so the record that
void and capture act on cannot be represented. The create shape also has
no field that says "authorize, do not capture"; the lane controller in
ACC-16 has to rely on an out-of-band convention. The capture response in
ACC-16 uses `approved` and the void response in ACC-17 uses `reversed`,
which is the only reading the enum allows; §13.6 says only `approved`
materializes as an APDS `Payment`, which fits.

**Proposed fix.** Add `authorized` to the enum (additive; existing
consumers that switch on the three values should treat it as "not yet
money") and an optional boolean `captureLater` (or `intent:
authorize | sale`) on the create shape, default sale. Say in §13.1a that
capture moves `authorized → approved` and may lower `amount`, void moves
`authorized → reversed`, and §13.6 materializes on capture.

**As fixed (reworked 2026-09-25).** The first fix added `authorized` to
`paymentStatus`; oasdiff v1.32.1 reports `response-property-enum-value-added`
as an ERROR (8 occurrences), so it failed the breaking-change gate. The
shipped design leaves `paymentStatus` at `approved | declined | reversed`
and adds a readOnly `captureStatus` (`authorized | captured`, absent =
captured). A hold is `paymentStatus: approved` + `captureStatus:
authorized`: the payment layer approved the authorization, funds are
held, nothing is collected. Capture sets `captured` (status stays
`approved`); void of a hold sets `reversed`; refund or posting on a hold
is 409 `payment-state-illegal`. To protect consumers that predate
`captureStatus`, a hold is returned to its creator but `GET /v1/payments`
omits it unless the query carries the new optional `captureStatus=authorized`,
`apx.accounts.payment.recorded.v1` is not published for it (first event at
capture; void of a hold publishes nothing, since no consumer saw it and no
money moved), and it is never materialized as an APDS Payment until
captured. Exercised in ACC-16 and ACC-17.

## F-ACC-06 — A payment link cannot be read or cancelled

**Where it showed up.** ACC-11, ACC-13. `PaymentLink` is "the lifecycle
resource `sent → opened → paid | expired | cancelled`", but the only
operation is `POST /v1/payment-links`. A console that wants to show the
agent "opened, not yet paid" has to replay the original Idempotency-Key
and read the state off the 200 (which the scenarios do) or subscribe to
`apx.accounts.payment.recorded.v1` and infer `paid`. Nothing reaches
`cancelled`: an agent who sent the link to the wrong number cannot kill
it before the customer taps it.

**Proposed fix.** Additive `GET /v1/payment-links/{id}` (scope
`apx.accounts:read`, 200/404, grant-checked on `place`) and
`POST /v1/payment-links/{id}/cancel` (scope `apx.payments:write`,
`Idempotency-Key`, 200 with the link in `cancelled`, 409
`payment-state-illegal` from `paid`). A `apx.accounts.payment-link.status.v1`
topic would let the console stop polling, but the two routes are the
minimum.

## F-ACC-07 — A partial refund leaves no trace on the record

**Where it showed up.** ACC-14. The refund operation takes an optional
`amount` for a partial refund and returns "the payment, now
reversed/partially refunded", but `PaymentRecord` has no field for the
refunded amount, no refunds array, and no status between `approved` and
`reversed`. The partial-refund response in ACC-14 is therefore
indistinguishable from the record before the refund: `amount` 24.00,
`paymentStatus` `approved`. The customer was given $12.00 back and the
API cannot say so; a second agent will refund it again (ACC-15 shows the
full-reversal case only because that one is expressible).

**Proposed fix.** Additive `refundedAmount` (AmountInCurrency, readOnly)
on `PaymentRecord`, and a rule in §13.1a: a refund whose cumulative
`refundedAmount` reaches `amount` sets `paymentStatus: reversed`;
otherwise the status stays `approved` and `refundedAmount` grows. A
`refunds[]` array with `{amount, time, approval, reason}` would give the
audit trail, but the single field is the minimum that stops the double
refund.

## F-ACC-08 — `place` narrowing is permitted by prose, undeclared in OpenAPI

**Where it showed up.** ACC-02. §13.5(3) says implementations "MAY
additionally accept a `place` query parameter" on `GET /v1/accounts`,
`GET /v1/payments`, and `GET /v1/lpr/reads`, following
`/v1/reservations/recent`. None of the three declares it, so a client
that sends it is sending an undeclared parameter and a validator-driven
server will reject it. The MAY is unreachable through the contract.

**Proposed fix.** Declare the optional `place` parameter on the three
operations (comma-separated HierarchyElement ids, subtree-inclusive, must
lie inside the grant or 403 `insufficient-grant`), and keep the MAY as
"servers that do not implement narrowing ignore it".

## F-ACC-09 — No e-mail lookup

**Where it showed up.** ACC-02. The console account form has name,
phone, card, plate, and e-mail; `GET /v1/accounts` declares the first
four and `Account` has no `email` property either, so even an
implementation that stores it cannot return it. E-mail is the key a
monthly parker most often remembers after phone.

**Proposed fix.** Optional `email` query parameter on `GET /v1/accounts`
and optional `email` on `Account`, both under the same §9.6 minimization
rule as `phone` (personal data, `apx.accounts:read` only). Additive.

## F-ACC-10 — Payment history has no full-ticket or account key, and no floor

**Where it showed up.** ACC-19. The §13.2 privacy rule says records older
than eight hours "require the full ticket number or an account-scoped
query", but `GET /v1/payments` declares only `ticketLast4`, `cardLast4`,
`date`, and `page`. The escape hatch the rule points at does not exist:
a driver who paid this morning and calls tonight can be found only by
guessing the date, and a monthly parker statement (every payment on
account `c2…0004`) cannot be listed at all. A query with no filter has
no declared behaviour either; serving the whole ledger is clearly wrong,
but there is no 400 to refuse it with.

**Proposed fix.** Declare `ticketNumber` (exact) and `account` (UUID) on
`GET /v1/payments`, both exempt from the 8-hour window and both still
grant-constrained under §13.5. Declare 400 with a registered
`filter-required` slug for a query that carries none of the five keys,
and say in §13.2 that `date` alone (a whole day of ledger) is allowed
only in combination with a truncated key or under `apx.accounts:read`
plus an explicit `place`.

## F-ACC-11 — The decline problem does not point at the declined record

**Where it showed up.** ACC-08. A declined attempt is recorded (it is what
the resolution context `payments[]` overlay and the recorded event
carry, `paymentStatus: declined`), but the 422 `payment-declined`
response is a bare Problem. The console that just received the 422
cannot cite the record, correlate it with the event, or attach it to a
support interaction without a second lookup by last four. RFC 9457 allows
extension members and the `Problem` schema permits them, so the scenario
adds `payment` (a Reference) — but nothing in the spec says that member
exists, so no client can rely on it.

**Proposed fix.** Define `payment` (Reference to PaymentRecord) as a
documented extension member of `payment-declined` in Part 12, and
optionally a `declineReason` code (`issuer`, `insufficientFunds`,
`fraud`, `other`) so the agent can say "your bank declined it" without
seeing the processor response.

## F-ACC-12 — Event semantics on reversal are unstated

**Where it showed up.** ACC-14. §13.4 says `apx.accounts.payment.recorded.v1`
is "published for every recorded payment". A refund, void, or capture
changes the `paymentStatus` of an existing record (and, for capture, its
`amount`). Whether that re-publishes the topic with the updated record
(the scenario assumes yes, since a finance feed that never learns of the
reversal is wrong), or whether a separate topic is intended, is not
written. Consumers reconciling money will either double-count or miss
reversals depending on the guess.

**Proposed fix.** One sentence in §13.4: the topic is published on
creation and on every `paymentStatus` or `amount` change, always with
the full current record as `data`, and consumers key on `data.id` and
take the latest by `time`. If that is not the intent, register
`apx.accounts.payment.status.v1` for the changes.

## F-ACC-13 — Fail-closed on a lookup with no target

**Where it showed up.** ACC-03. Part 9 §9.3 and APX-CORE-08: a token
without an `apx_places` claim has no places. For a targeted write the
outcome is 403 `insufficient-grant` (CTL-14). For a place-less lookup
there is no target to refuse; §13.5(2) says results "MUST be constrained
to records whose place ... falls inside the caller's grant", and an
empty grant constrains to nothing — so the scenario answers 200 with an
empty list. A server that answers 403 instead is equally defensible, and
a console will treat the two very differently ("no account" versus
"misconfigured credential").

**Proposed fix.** Say in §13.5(2) which it is. Recommend 403
`insufficient-grant` when the grant is absent or empty (the credential
is misconfigured, and hiding that behind an empty result costs an
operator a support call), and an empty 200 only when the grant is
non-empty and simply does not cover the matching records.

## F-ACC-14 — A PAN in the query string is schema-valid

**Where it showed up.** ACC-20. `cardLast4` on `PaymentRecord` has
`pattern: ^[0-9]{2,4}$`; the `cardLast4` query parameter on
`GET /v1/payments` is a bare string. A client that pastes the full card
number into the search box sends a request that validates against the
contract, and the operation declares no 400 to refuse it. Access logs
are the usual place a PAN leaks.

**Proposed fix.** Put the same `pattern` (and `maxLength: 4`) on the
query parameter, declare 400 on `GET /v1/payments` with
`card-data-not-accepted` (F-ACC-03), and add to §9.6(1) that servers
MUST refuse before logging when a query or body member carries more than
four card digits.

## Runner issues

**Stacked `apx:validate` markers.** Two consecutive validate markers
above one ```json block (the form the module brief asks for:
`<!-- apx:validate EventEnvelope -->` then
`<!-- apx:validate PaymentRecord at /data -->`) fail with
"apx:validate marker without a ```json block": `flushDangling()` runs
on every marker, so the first validate is reported dangling before the
block is reached. Confirmed with a throwaway file (deleted). Worked
around in ACC-05, ACC-08, ACC-11, and ACC-14 by repeating the event
payload under the second marker; the two copies are identical. A fix
would let `expect` hold a list of validates and run them all against the
next block.
