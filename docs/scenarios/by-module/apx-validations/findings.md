# Findings — apx-validations (Part 20)

Each entry is something a scenario in `scenarios.md`
needed that the public spec (`apx` at v0.10.0) does not define, or
defines ambiguously. IDs are stable; scenarios cite them in
`gap=F-VAL-NN` markers where the wire exchange fails validation, so the
runner reports them as known gaps rather than failures. Findings whose
exchange still validates (the gap is in the prose, or in a route that
does not exist) carry no marker and say so.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-VAL-01 | validations | low | No problem type for 401 (cross-cutting; same gap as F-CTL-07) | fixed — `unauthenticated` (401) registered in Part 12 (4417f2f); VAL-24 uses it |
| F-VAL-02 | validations | medium | `POST /v1/validations/programs` 422 has no registered problem type; `ValidationBenefit` does not enforce "exactly one of amount/duration/percentage" | fixed — 422 names `reference-unknown` / `request-unprocessable`; the benefit `oneOf` deferred (breaking: narrows a request body), rule stated in prose and enforced as the 422 |
| F-VAL-03 | validations | low | Issuance with a method not in `issuanceMethods`: 422 declared, no problem type | fixed — method not in `issuanceMethods` is `request-unprocessable`, named in the 422 |
| F-VAL-04 | validations | medium | `ValidationIssuance.program` is required in the create body although the path names the program; public scenario 18 omits it and is schema-invalid | fixed — request body is new `ValidationIssuanceRequest` (`program` optional, must match the path); response schema unchanged; public scenario 18 valid |
| F-VAL-05 | validations | medium | `issuanceStatus: void` and `instrumentStatus: void` exist but no operation can void a batch or a code | fixed — `POST …/issuances/{issuanceId}/void` and `POST /v1/validations/instruments/{code}/void` (`ValidationVoid`, `voidDetail`); VAL-25 |
| F-VAL-06 | validations | high | §20.4 refuses a post-closure reversal, §20.6 says it appears as a credit line on the next statement; no operation can record the credit | fixed — option (a): reverse succeeds in a closed period; `reversal.closedStatement`/`creditedOn`; `credit` lines (`lineKind`, `originalStatement`, `creditCount`); `statement-closed` no longer returned |
| F-VAL-07 | validations | medium | A merchant token reading another provider's program, redemption, or statement by id: 403 or 404 is not fixed (codes are explicitly 404) | fixed — §20.5 cites Part 9 §9.3a rule 2: another provider's resource is 404 on every route; place outside grant stays 403 |
| F-VAL-08 | validations | medium | `rules.stackable` is evaluated on the incoming program only; whether a non-stackable program already on the ticket blocks a stackable one is not said | fixed — `stackable` evaluated both ways (§20.3 rule 3, schema, APX-VAL-04) |
| F-VAL-09 | validations | low | The redemption materialized by `applyValidation` cannot be found from the command: no `command` filter, no result on `Command` | fixed — optional `command` filter on `GET /v1/validations/redemptions`; the `Command.result` side waits on F-CTL-02 |
| F-VAL-10 | validations | medium | `ValidationProvider.benefit` has no `percentage`, so a percentage program cannot be mirrored into the Part 6 provider list as §20.1(2) requires | open — `ValidationProvider.benefit` lives in `domains/control` (control group); proposed fix unchanged |
| F-VAL-11 | validations | low | `version` is `readOnly` on every resource yet PUT requires it in the body | fixed — shared `IfMatch` on the program PUT; prose points at Part 4 §4.2a |
| F-VAL-12 | validations | low | No problem type for "invalid program/issuance/redemption/period" (400); PUT declares no 400; the statement preview declares no 400 for `from ≥ to` | fixed — descriptions name `invalid-request`; 400 declared on the preview GET (the PUT's came with 4417f2f) |
| F-VAL-13 | validations | low | A place mismatch at redemption is reported as `program-not-active`, conflating two conditions | fixed — place mismatch is `request-unprocessable` with `detail` naming the program's place; no new slug |

---

## F-VAL-01 — No problem type for 401

**Where it showed up.** VAL-24, on all fifteen operations. The shared
`Unauthorized` response is `application/problem+json` with the
`Problem` schema, whose `type` must be a registered URI. Part 12
registers nothing for 401. Identical to F-CTL-07; listed here so the
module's gap markers resolve to a local entry.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2:
"missing, malformed, expired, or revoked access token". One entry
closes this gap in every module.

## F-VAL-02 — Enrolment 422 has no problem type, and the benefit invariant is prose only

**Where it showed up.** VAL-03. `POST /v1/validations/programs` declares
422 for "unknown place or provider, or a benefit with more than one of
amount/duration/percentage". Part 12 registers no slug for either case.
`target-not-found` fits the first in meaning but is registered at 404.
Separately, `ValidationBenefit` is a plain object with three optional
members: a benefit carrying both `amount` and `duration` validates,
so the "exactly one" rule in §20.1 and the schema description is
enforced by nobody the bundle can see.

**Proposed fix.** Register `benefit-ambiguous` (422, "benefit carries
none or more than one of amount, duration, percentage") and
`reference-not-found` (422, "a Reference in the body names an entity
that does not exist") in Part 12 §12.2, and name them in the 422
description. Add `oneOf: [{required: [amount]}, {required:
[duration]}, {required: [percentage]}]` to `ValidationBenefit` so the
invariant is machine-checked. `ValidationProvider.benefit` should get
the same constraint once F-VAL-10 is fixed.

## F-VAL-03 — Issuance method not in `issuanceMethods` has no problem type

**Where it showed up.** VAL-09. The 422 on `POST …/issuances` is
declared as "Program not active, or method not in the program's
issuanceMethods"; only the first half has a slug.

**Proposed fix.** Register `issuance-method-not-permitted` (422,
"method not in the program's issuanceMethods") in Part 12 §12.2.

## F-VAL-04 — `program` is required in the issuance create body

**Where it showed up.** VAL-08. `ValidationIssuance` lists `program` in
`required` and does not mark it `readOnly`, so the create body must
repeat the program the path already names. Public scenario 18 step 2
sends `{ quantity, method, issuedTo }`, which the bundle rejects. Two
implementers will disagree on whether a body whose `program` differs
from the path is a 400, a 404, or silently overwritten.

**Proposed fix.** Mark `program` `readOnly: true` on `ValidationIssuance`
(the server sets it from the path), matching how `id` and `version` are
handled; the OpenAPI 3.1 rule then stops requiring it in requests and
scenario 18 becomes valid as written. `ValidationRedemption.program` is
genuinely client-supplied and stays as it is.

## F-VAL-05 — Nothing can void a batch or a code

**Where it showed up.** VAL-12. `ValidationIssuance.issuanceStatus` is
`issued | void` and `ValidationInstrument.instrumentStatus` includes
`void`, both `readOnly`, and §20.3 lists "void" as an
`instrument-invalid` cause. There is no `PUT` on an issuance, no
`…/issuances/{id}/void`, and no per-code operation. A stolen sheet of
QR codes — the reason the state exists — cannot be voided through APX.
The scenario shows the state as read; nothing in the file produces it.

**Proposed fix.** Additive `POST /v1/validations/programs/{id}/issuances/{issuanceId}/void`
(scope `manage`, or `redeem` for the owning provider) with a
`{ reason, note }` body, transitioning `issued → void` and every
un-redeemed instrument in the batch to `void`; declare `redeemed` codes
unaffected. Optionally a per-code
`POST /v1/validations/instruments/{code}/void` for a single leaked code.
No new topic; the instrument read is the source of truth.

## F-VAL-06 — The post-closure credit has no route

**Where it showed up.** VAL-19. §20.4: a redemption inside a closed
statement "cannot be reversed (409 `statement-closed`); the correction
is a credit line on the next statement." §20.6: "Redemptions reversed
after closure appear as negative `billable` lines on the next closed
statement." The second sentence presupposes a reversal that the first
refuses. No operation records a credit, so the negative line in the
October preview cannot be produced by any conforming client. Merchant
disputes after invoicing are the normal case, not the edge.

**Proposed fix.** Pick one. (a) Allow the reversal: `POST …/reverse`
succeeds on a redemption in a closed period, the closed statement stays
immutable, and the reversal is flagged `reversal.creditedOn` (Reference
to the next statement) when that period closes; drop `statement-closed`.
(b) Keep the refusal and add
`POST /v1/validations/programs/{id}/credits` `{ redemption, reason,
amount }` that lands as a negative line on the next closed statement.
(a) is smaller and keeps one ledger; the statement line schema already
allows a negative `billable`.

## F-VAL-07 — Other providers' resources by id: 403 or 404

**Where it showed up.** VAL-20. §20.5 says a merchant token "MUST NOT
see other providers' programs or redemptions", §20.2 says a code
outside the grant is "404, never 403", and Part 9 §9.3 / APX-CORE-07
say out-of-grant targets are 403 `insufficient-grant`. For
`GET /v1/validations/programs/{id}`, `…/redemptions/{id}`,
`…/statements/{id}`, and the per-program sub-routes hit with another
provider's program id, the spec does not choose. The scenario uses 403
`insufficient-grant` because Part 9 is normative for grants; a server
that reasons from §20.2 will return 404, and both will claim
conformance.

**Proposed fix.** One sentence in §20.5: "A resource outside the token's
provider grant is 403 `insufficient-grant` on every route except
`GET /v1/validations/instruments/{code}`, which is 404 (§20.2)." Or the
reverse, if enumeration of program ids by merchants is a concern; then
say 404 everywhere and cite it in APX-CORE-07 as the sanctioned
exception.

## F-VAL-08 — Whose `stackable` governs

**Where it showed up.** VAL-13. §20.3 rule 3: refuse when "`rules.stackable`
is false and another program is already applied to the ticket" — read
naturally, the incoming program's flag. If the bistro (stackable:
false) is already on the ticket and the cinema (stackable: true) is
applied next, the rule as written allows it, and the bistro's
non-stackable promise is broken by the second program. The closed rule
set exists so two implementations agree; here they will not.

**Proposed fix.** Make it symmetric in §20.3: "refuse if the incoming
program is not stackable and any other program is already applied, or
if any already-applied program is not stackable." Say it in Annex A
APX-VAL-04 as well.

## F-VAL-09 — The command and the redemption it materialized are not linked from the command side

**Where it showed up.** VAL-04. §6.3 and APX-VAL-02 say every
`applyValidation` materializes a `ValidationRedemption`, and the
redemption carries `command`. The reverse direction has nothing: the
`Command` has no result (F-CTL-02), and `GET /v1/validations/redemptions`
filters by program, place, ticket, session, channel, status, and
`since` — not by `command`. The console that issued the command has to
query by ticket and hope there is one match.

**Proposed fix.** Additive `command` query parameter (uuid) on
`GET /v1/validations/redemptions`, and — once F-CTL-02 lands —
`applyValidation.result.redemption` (Reference) on the command.

## F-VAL-10 — A percentage program cannot appear in the provider list

**Where it showed up.** VAL-04, VAL-05. §20.1(2) is normative: the Part
6 provider list MUST be the active programs "with `benefit` and
`validationType` copied from the program". `ValidationBenefit` allows
`percentage`; `ValidationProvider.benefit` allows only `amount` and
`duration` and says "exactly one of amount or duration". A 25 percent
program has no legal row. The scenario shows the row with `percentage`
anyway; it validates only because `ValidationProvider.benefit` has no
`additionalProperties: false`.

**Proposed fix.** Make `ValidationProvider.benefit` a `$ref` to
`ValidationBenefit` (it was clearly copied from it), so the two cannot
drift again.

## F-VAL-11 — `version` is readOnly and required on PUT

**Where it showed up.** VAL-05, VAL-06, VAL-07. Every PUT carries
`version` "the client last read" (§20.1, Part 5 §5.1) and the schema
marks `version` `readOnly: true`. Under OpenAPI 3.1 a readOnly property
"SHOULD NOT be sent as part of the request"; strict client generators
drop it, and the PUT then cannot express the precondition it exists
for. The bundle validates the scenario only because the runner does not
enforce readOnly on requests. Cross-cutting: every versioned APX
resource has the same shape.

**Proposed fix.** Either drop `readOnly` from `version` (keep it on
`id`) with a description "server-assigned; echoed on PUT as the
optimistic-concurrency precondition", or move the precondition to an
`If-Match` / `APX-Version` header and say so in Part 5 §5.1. The first
is one line per schema.

## F-VAL-12 — No problem type for malformed bodies, and two routes with no 400 at all

**Where it showed up.** VAL-18 (gap marker on the reversed period).
`POST …/statements` declares 400 for "Missing Idempotency-Key or invalid
period"; the three other POSTs declare "…or invalid program /
issuance / redemption". Only `idempotency-key-required` is registered.
`PUT /v1/validations/programs/{id}` declares no 400 for a malformed
body at all, and `GET …/statement` declares no 400 for `from` not
before `to`.

**Proposed fix.** Register one generic `invalid-request` (400, "body or
parameters fail schema or semantic validation; `detail` names the
member") in Part 12 §12.2, declare 400 on the PUT and on the preview
GET, and reference the slug in every "invalid …" description. Same
family as F-CTL-01.

## F-VAL-13 — Place mismatch is reported as `program-not-active`

**Where it showed up.** VAL-14. §20.3 rule 1: "`program-not-active` —
program not `active` (or place mismatch)". The parenthesis makes one
slug carry two unrelated diagnoses: the program is suspended, or the
client named the wrong place. A pay station can recover from the second
(retry with the program's place) and not from the first. The Part 12
entry for the slug does not mention place at all.

**Proposed fix.** Either add the place case to the Part 12 description
of `program-not-active`, or register `program-place-mismatch` (422)
and move the parenthesis there. The second is more useful to a device.

## Runner issues

Two behaviours were observed in `run.mjs` as it stood when this module
was started; both were fixed in the runner during the session (file
timestamp 23:42), and the scenarios were rewritten to the current
behaviour. Nothing is worked around with a gap marker.

1. Two `apx:validate` markers on one block. The earlier runner
   reported the first as "apx:validate marker without a ```json
   block", so every event envelope had to be duplicated (one block per
   marker). The current runner stacks validate markers on one block;
   `scenarios.md` uses `<!-- apx:validate EventEnvelope -->`
   followed by `<!-- apx:validate ValidationProgram at /data -->` on a
   single block, as the method asks.

2. A `gap=` on an `apx:request` marker whose failure is in the body.
   The earlier runner settled the marker's context inside
   `checkRequest` (no failure there) and reported the same gap as both
   "known gap" (from the body check) and "no longer fails — remove the
   gap marker" (from the marker check). The current runner reports it
   once, against the marker line. Noted so the F-VAL-04 markers are not
   removed on the strength of a stale "resolved" line.
