# Findings — apx-tolling

Each entry is something a scenario in `scenarios.md` needed
that the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-TOL-NN`
markers so the runner reports them as known gaps rather than failures,
and reports them as resolved once the spec is fixed. Fixes land in the
spec as ordinary additive PRs.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-TOL-01 | tolling | medium | `voided` is a terminal state that no operation produces | fixed: `POST …/{id}/void` from `created`/`priced` |
| F-TOL-02 | tolling | medium | No route moves a transaction from `created` to `priced`; asynchronous pricing only works inside the server | fixed: `POST …/{id}/price` from `created` |
| F-TOL-03 | tolling | medium | Illegal transitions (pay a paid/voided one, second dispute, resolve with nothing open) have no problem type; payment declares no 409 | fixed: `toll-transition-illegal`, 409 on payment, §15.1 transition table |
| F-TOL-04 | tolling | medium | List filters: no `tollPoint`/`place`, no time window, no way to name a non-plate credential; `status` is a free string | fixed: `tollPoint`, list `place`, `credentialType`/`credentialIdentification`, `since`/`until`; `status` enum enforced as a 400 field rule, schema narrowing deferred (breaking) |
| F-TOL-05 | tolling | low | 400 "invalid transaction" on create has no registered problem type | fixed: `invalid-request` (4417f2f), named in the create 400 |
| F-TOL-06 | tolling | low | Dispute routes declare no 404; 401/403/429 declared on three operations and not the other three | fixed: shared responses declared on all toll routes (4417f2f) |
| F-TOL-07 | tolling | low | No problem type for 401 (same gap as F-CTL-07) | fixed: `unauthenticated` registered (4417f2f) |
| F-TOL-08 | tolling | medium | Who may dispute is unspecified: one operator scope, no customer scope, `disputedBy` class list not fixed | fixed: operator-opened only, `disputedBy` semantics in §15.1; no customer scope in v1 |
| F-TOL-09 | tolling | low | Prose, OpenAPI, and Part 12 disagree on disputing a `voided` transaction | fixed: voided = `toll-transition-illegal`, resolved = `dispute-closed` |
| F-TOL-10 | tolling | low | Dispute `reason`/`resolution`: prose reads as a fixed list, schema says implementer code list, no registry | fixed: base reason/resolution codes in §15.1; registries requested from the integrator |
| F-TOL-11 | tolling | medium | `adjusted` resolution has nowhere to carry the adjusted amount; whether `pricing` is rewritten and whether payment may follow `resolved` is unsaid | fixed: `adjustedPricing`, readOnly `dispute.originalPricing`, payment allowed after `upheld`/`adjusted` |
| F-TOL-12 | tolling | low | Idempotent replay "returns the ORIGINAL transaction": creation snapshot or current representation? | fixed: replay returns the current representation (Part 4 §4.2a, §15.2) |
| F-TOL-13 | tolling | low | `POST …/{id}/payment` takes no `Idempotency-Key` although billing batches retry | fixed: optional `Idempotency-Key` on payment; re-attaching the same payment = 200 |
| F-TOL-14 | tolling | low | `credential.credentialType` is a free string while APDS `CredentialTypeEnum` already has `licensePlate` and `rfid` | deferred (breaking): `$ref` to `CredentialTypeEnum` narrows a request field; §15.1 now says SHOULD |

---

## F-TOL-01 — `voided` has no route

**Where it showed up.** TOL-14, TOL-22. Part 15 §15.1 names `voided` as
the terminal state and the `transactionStatus` enum carries it, but the
six operations are create, list, read, attach payment, open dispute,
resolve dispute. Nothing produces `voided`. A maintenance passage by the
operator's own service truck, or a duplicate created under a fresh key
(TOL-22), can only be voided through the vendor console; APX sees the
result in the status event and on read, never the action. Part 19 gives
Violations `POST …/{id}/void` for exactly this.

**Proposed fix.** Additive `POST /v1/tolling/transactions/{id}/void`
with a body `{ reason, note? }`, scope `apx.tolling:manage`, 200 with
the voided transaction, 409 `toll-transition-illegal` (F-TOL-03) from
`paid`, `disputed`, `resolved`, or `voided` — or, if a paid transaction
may be voided with a refund, say so and name the refund path. Publishes
`apx.tolling.transaction.status.v1` like every other transition.

## F-TOL-02 — No route from `created` to `priced`

**Where it showed up.** TOL-07. §15.1 gives the lifecycle `created →
priced → paid`, and public scenario 23 says "an operator whose pricing
is asynchronous would return `created` and publish a status event when
the price lands". The only writer of `pricing` is the create body. An
external pricing engine (a classifier service, a rate engine at the
operator's back office) has no operation to set the price on a
`created` transaction: there is no `PUT`, no `PATCH`, no `…/price`. The
two-state lifecycle is therefore reachable only when pricing lives
inside the APX server.

**Proposed fix.** Additive `POST /v1/tolling/transactions/{id}/price`
with body `{ pricing: AmountInCurrency, detail? }`, allowed in `created`
only (409 `toll-transition-illegal` otherwise), 200 with the `priced`
transaction. Alternatively a `PUT /v1/tolling/transactions/{id}` with
`version` for optimistic concurrency, but a narrow transition route
matches the rest of the module better and avoids opening `pricing` to
rewrite after payment.

## F-TOL-03 — Illegal transitions have no problem type; payment declares no 409

**Where it showed up.** TOL-06, TOL-11, TOL-12, TOL-14. Part 12
registers one toll slug, `dispute-closed` ("toll dispute operation on a
closed dispute"). The state machine forbids at least four other things
the scenarios hit: attaching a payment to a `paid` transaction (a
re-run billing batch), attaching one to a `voided` transaction, opening
a second dispute while one is open, and resolving a transaction that
was never disputed (the resolve route's declared 409 says "no open
dispute", which is not a *closed* dispute). `POST …/{id}/payment`
declares no 409 at all, so the first two have no declared response
either. Violations, Credentials, and Valet each have a
`*-transition-illegal` slug for this.

**Proposed fix.** Register `toll-transition-illegal` (409) in Part 12
§12.2: "toll transaction transition requested from a state that does
not allow it (Part 15 §15.1)". Declare 409 on `POST …/{id}/payment`.
Write the transition table into §15.1: payment from `priced` only;
dispute from `priced`, `paid`, and (if intended) `created`; resolve from
`disputed` only; `dispute-closed` reserved for a transaction whose
dispute is already `resolved`.

## F-TOL-04 — The list cannot answer the questions operators ask

**Where it showed up.** TOL-16. `GET /v1/tolling/transactions` declares
`plate`, `status`, and `page`. A gantry flagged for recalibration
(TOL-09) raises "everything hc-01 produced between 07:00 and 08:00";
there is no `tollPoint`, no `place` (every other APX list takes `place`
subtree-inclusive), and no time window (`since` on Violations and
Alerts, `from`/`to` on statements, APDS `start_after`/`start_before`
on Observations). A fleet desk asking for every charge against a
transponder has no parameter: `plate` cannot hold a tag id, and the
`credential` object has no filter. `status` is `type: string` rather
than the `transactionStatus` enum, so a typo returns an empty list
instead of a 400.

**Proposed fix.** Additive query parameters on the list: `place`
(APDS semantics, subtree-inclusive), `tollPoint` (uuid),
`credentialType` and `credentialIdentification` (matching the
`credential` object; `plate` stays as a convenience alias for
`credentialType=licensePlate`), `since` and `until` (RFC 3339, against
`statusHistory[0].time`), and tighten `status` to the enum. All
optional; existing callers unaffected. Pick one time-window name pair
for the whole standard while doing it; today three are in use.

## F-TOL-05 — "Invalid transaction" has no registered problem type

**Where it showed up.** TOL-04. The 400 on `POST /v1/tolling/transactions`
is described as "Missing Idempotency-Key or invalid transaction", but
Part 12 registers only `idempotency-key-required` at 400. A body with no
`tollPoint` has no registered `type` to return. Same shape as F-CTL-01.

**Proposed fix.** Register a generic `invalid-request` (400) in Part 12
for body-shape errors on any APX route ("request body fails the
operation's schema; `detail` names the first violation"), and reference
it from every 400 description that says "invalid". One slug serves
Control (F-CTL-01), Tolling, and whichever module is vetted next.

## F-TOL-06 — 404 missing on the dispute routes; 401/403/429 declared on half the module

**Where it showed up.** TOL-11, TOL-12, and the coverage report. `POST
…/{id}/disputes` and `POST …/{id}/disputes/resolve` declare 200 and 409
only; a mistyped id has no declared response while `GET …/{id}` and
`POST …/{id}/payment` declare 404. The shared `Unauthorized`/
`Forbidden`/`TooManyRequests` responses are declared on create, list,
and payment and absent from read, disputes, and resolve, all of which
are secured by the same scope. Same shape as F-CTL-06 and F-CTL-08.

**Proposed fix.** Add 404 (`target-not-found`) to both dispute
operations, and declare 401/403/429 via the shared components on all
six. The Spectral rule proposed under F-CTL-08 would catch both.

## F-TOL-07 — No problem type for 401

**Where it showed up.** TOL-20. Identical to F-CTL-07: the shared
`Unauthorized` response is `application/problem+json` with a `Problem`
body whose `type` must be registered, and nothing is registered at 401.
Logged here so the tolling file is self-contained; one fix closes both.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2.

## F-TOL-08 — Who may dispute

**Where it showed up.** TOL-08, TOL-22. Part 15 has one scope,
`apx.tolling:manage`, on all six operations, and describes the dispute
as something the holder raises ("she disputes it"). In practice the
call-center agent opens it on her behalf under the operator's token,
which is what the scenarios show. Nothing says whether a customer
channel — a fleet portal, a holder PWA, a bot acting for the holder —
may open a dispute on its own transaction the way Part 22 §22.5 lets a
valet customer request a retrieval under `apx.valet:request`. Nor is
`disputedBy` constrained: the schema is a bare `Reference`, and the
scenarios put a `RightHolder`, an `Organisation` (fleet), and the
operator's own `Organisation` (TOL-22, an operator-initiated duplicate)
there. Part 9 §9.6 says plate values appear only under the four
operator scopes, which a customer scope would need to reconcile with
"own transactions only".

**Proposed fix.** Decide and write it down. The minimal text: "Disputes
are opened by the operator (`apx.tolling:manage`), on the holder's
behalf or on its own initiative; `disputedBy` references the party on
whose behalf the dispute is raised (`RightHolder`, `Organisation`, or
`Contact`) and MAY be absent for operator-initiated disputes." If a
customer channel is wanted, add `apx.tolling:dispute` on `GET …/{id}`
(own, minimized) and `POST …/{id}/disputes` (own), modelled on Part 22
§22.5, with "own" defined by the credential on the transaction.

## F-TOL-09 — Disputing a `voided` transaction: three texts, two answers

**Where it showed up.** TOL-14. Part 15 §15.1: "a dispute moves any
non-voided transaction to `disputed`" — so `voided` is refused, but it
does not say how. The OpenAPI description on the disputes operation:
"Re-disputing a resolved/voided transaction is 409 dispute-closed". Part
12: `dispute-closed` is "toll dispute operation on a closed dispute". A
voided transaction never had a dispute, so the registered meaning does
not cover it; the OpenAPI text stretches the slug to a second meaning.
The scenario followed the OpenAPI because it is the only registered
slug at 409 on that route.

**Proposed fix.** With F-TOL-03 in place, `voided` → 409
`toll-transition-illegal` and `resolved` → 409 `dispute-closed`; amend
the OpenAPI description and §15.2 to say so. If the committee prefers
one slug for both, widen the Part 12 definition of `dispute-closed` to
"dispute operation on a transaction whose dispute is resolved or which
is voided".

## F-TOL-10 — Dispute reasons and resolutions: fixed list or implementer list?

**Where it showed up.** TOL-09, TOL-13. §15.1 says "resolution to
`resolved` (with `dispute.resolution`: upheld | refunded | adjusted)",
which reads as normative; the schema says "upheld | refunded | adjusted
(implementer code list)" and the resolve operation says "resolution
values … are implementer code lists". `TollDisputeOpen.reason` is
likewise free text with one example (`wrongVehicle`); the scenarios
needed `duplicateCharge` and `wrongClass` too. Part 11 has registries
for alert types, issue types, violation types, and nothing for toll
dispute codes. Two operators will spell "refund" differently and a
shared analytics warehouse will not be able to count refunds.

**Proposed fix.** Add `apx-toll-dispute-reasons` (`wrongVehicle`,
`duplicateCharge`, `wrongClass`, `notLiable`, `other`) and
`apx-toll-dispute-resolutions` (`upheld`, `refunded`, `adjusted`,
`withdrawn`) to `spec/registries/`, reference them from the two schemas
the way `apx-alert-types` is referenced, and keep the Part 11 extension
path open for vendor values.

## F-TOL-11 — What `adjusted` adjusts

**Where it showed up.** TOL-13. A dispute resolved `adjusted` changes
the amount owed, but `TollDisputeResolution` carries only `resolution`
and `note`, and `TollTransaction` has one `pricing`. The scenario
rewrote `pricing` from 4.25 to 2.75 and recorded the old value in the
history `detail`, which is the only place it fits. Three things are
unsaid: whether `pricing` may be rewritten after `priced` (Part 4 §4.2
protects `statusHistory`, not `pricing`); where the adjusted amount is
carried on the resolution request so the server does not have to parse
`note`; and whether a transaction that was `priced` (unpaid) when
disputed and is now `resolved` can still take a payment — the payment
route "transitions to paid", and `resolved` is not `priced`.

**Proposed fix.** Additive `adjustedPricing: AmountInCurrency` on
`TollDisputeResolution` (required when `resolution` is `adjusted`),
additive `originalPricing` on `TollTransaction.dispute` set by the
server when pricing changes, and a sentence in §15.1: "`resolved` with
`adjusted` or `upheld` on an unpaid transaction accepts a payment like
`priced`; `refunded` does not." F-TOL-03's transition table is the
natural place.

## F-TOL-12 — Which "original" does the replay return

**Where it showed up.** TOL-02. The 200 on create is "Idempotent replay
— same key + same body returns the ORIGINAL transaction". Gantry retries
arrive seconds to minutes later; billing may already have moved the
transaction to `paid`. "Original" can mean the representation as it was
at creation (a snapshot, so the retry sees exactly what the first call
would have) or the transaction the key created, in its current state.
The Control exemplar took the second reading for commands; Part 15 does
not say. A bridge that reconciles on `version` will see either 2 or 3.

**Proposed fix.** One sentence in §15.2 and the operation description:
"returns the transaction the key created, in its current representation
(so `version` and `transactionStatus` may have advanced)". That is the
cheaper of the two to implement and matches Part 6.

## F-TOL-13 — Payment attach is not idempotent

**Where it showed up.** TOL-06. `POST …/{id}/payment` is the one write a
batch job performs thousands of times a night, and it takes no
`Idempotency-Key`. A batch that crashes after the attach and replays its
file re-sends the same PaymentRecord reference; with F-TOL-03 in place
that is a 409, which the batch must then classify as "already done"
rather than "failed". Re-sending the same reference should be a
harmless 200, and a different reference a refusal.

**Proposed fix.** Accept an optional `Idempotency-Key` on the payment
route with the Part 6 semantics (same key + same body → 200 with the
current transaction; same key + different body → 409
`idempotency-conflict`), and add to §15.2: "attaching the PaymentRecord
already attached returns 200 unchanged". The header stays optional so
existing clients are unaffected.

## F-TOL-14 — `credentialType` is a free string next to an APDS enum

**Where it showed up.** TOL-01. `TollTransaction.credential.credentialType`
is `type: string` with the description "licensePlate, rfid
transponder…". APDS 4.1's `CredentialTypeEnum` already lists
`licensePlate` and `rfid` (and `barcode`, `bluetooth`, `eticket`, …),
and APX's own rule (APX-CORE-01) is to use APDS definitions verbatim by
`$ref`. Public scenario 23 uses `rfid`; a vendor reading the
description alone will send `transponder`.

**Proposed fix.** `$ref` `credentialType` to the APDS
`CredentialTypeEnum`, and say in §15.1 that `credentialIdentification`
carries the plate string or tag id as read. Additive for every client
already using enum values; a client sending free text would need to
map, which is the point.

## Runner issues

None that produced a false pass or a false fail. One usability note:
`<!-- apx:validate <Schema> at /pointer -->` validates the *next*
```json block at that pointer, so the block after an `EventEnvelope`
check plus a `TollTransaction at /data` check must be the same envelope
written twice; two markers stacked over one block fail the first with
"apx:validate marker without a ```json block". The README grammar does
not say this. Each event in `scenarios.md` therefore appears twice
back to back, which is correct for the runner and noisy for a reader. A
small extension — letting consecutive `apx:validate` markers share the
following block — would remove the duplication; not changed here.
