# Findings — apx-violations (enforcement)

Each entry is something an `scenarios.md` scenario needed that the public spec (`apx` at v0.10.0) does not define, or defines ambiguously. IDs are stable. Where the runner fails an exchange, the scenario cites the finding in a `gap=F-VIO-NN` marker. Where the exchange validates but the scenario had to choose a reading, the prose cites it.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-VIO-01 | violations | low | No problem type for 401 (same defect as F-CTL-07) | fixed — `unauthenticated` (401) registered in Part 12 (4417f2f); VIO-27 uses it |
| F-VIO-02 | violations | low | No problem type for a malformed body on the 400 the create routes declare | fixed — the three create 400s and §19.9 rule 1 name `invalid-request` (with `errors[]`) |
| F-VIO-03 | violations | medium | The 422s on create/PUT (unknown place, unknown `violationType`, invalid policy) have no registered problem types | fixed — 422 descriptions name `reference-unknown` / `request-unprocessable`; no new slugs |
| F-VIO-04 | violations | medium | "Automated detections may be issued unreviewed" is binding server policy, but `EnforcementPolicy` cannot express it | fixed — optional `EnforcementPolicy.unreviewedIssuance { permitted, minimumConfidence, violationTypes[] }`; §19.4 rule 1 applies it, documentation governs when absent |
| F-VIO-05 | violations | low | `review` (dismiss without `reason`) and `appeals/resolve` (`reduced` without `adjustedAmount`) declare no 400 | fixed — 400 declared on all six routes; the two conditional rules stated in the schema descriptions and §19.1 (an `if/then` would narrow existing request bodies) |
| F-VIO-06 | violations | medium | `penaltyCap` relative to "the unpaid fee" has no unpaid-fee basis on the Violation | fixed — readOnly `Violation.unpaidAmount` and `capAmount`, frozen at `issue` |
| F-VIO-07 | violations | low | Shape of `amountHistory` after a `clamp` is not fixed | fixed — clamp writes a single first entry `reason: cap` with new `requestedAmount` |
| F-VIO-08 | violations | low | Resolve with no open appeal: `appeal-closed` (route, Part 12) or `violation-transition-illegal` (§19.1 rule 2)? | fixed — §19.1 rule 3: `appeal-closed` for the appeal itself (second, closed/voided, window, resolve with none open); never-issued states are `violation-transition-illegal` |
| F-VIO-09 | violations | medium | An escalation step that fell due while `appealed`: fires on return, or is skipped? | fixed — the escalation clock pauses while `appealed` (§19.10 rule 3; schema descriptions) |
| F-VIO-10 | violations | medium | Which states are terminal: is `void` allowed from `dismissed` and `paid`? Schema, §19.1, and route disagree | fixed — terminal set named once (`dismissed`, `closed`, `voided`); `void` from every other state incl. `paid`, with optional `ViolationVoid.refund` |
| F-VIO-11 | violations | medium | `GET /v1/violations` cannot find a violation by notice number; `place` takes only one value | fixed in part — optional `noticeNumber` and `until` added; list-valued `place` deferred (breaking: changes the parameter's type) |
| F-VIO-12 | violations | medium | Versioned `PUT` never says how "the version last read" is sent (`version` is readOnly, no `If-Match`) | fixed — shared `IfMatch` on both versioned PUTs; prose points at Part 4 §4.2a |
| F-VIO-13 | violations | medium | Pay-then-appeal cannot be expressed, so §19.6 "refund after a dismissed appeal" can never happen | fixed — `paid → appealed` within `appealWindowDays`; `appeal.openedFrom`, `appeal.refund`, `ViolationAppealResolution.refund`; VIO-29 |
| F-VIO-14 | violations | low | Policy 422 "escalation step that could exceed the ceiling" contradicts §19.10 rule 3 (the ceiling clamps) | fixed — 422 narrowed to a fixed `addAmount` that alone exceeds `overallCeiling.maximumAmount` (`request-unprocessable`) |
| F-VIO-15 | violations | low | (upstream APDS) `GeoJsonObject` declares no `coordinates`; the §19.9 lon/lat rule cannot be schema-checked | deferred (upstream) — erratum 011; overlay declares an optional `coordinates` array; the Point wrap on APX fields stays with Violations |
| F-VIO-16 | violations | low | `Violation.location` claims the APDS Observation `Location` shape but diverges from it | fixed — schema and §19.9 say "modelled on" and list the two differences |
| F-VIO-17 | vio | low | `ViolationAppealResolution`: "`adjustedAmount` required when `reduced`" was prose only; a `reduced` body without it validated | fixed (0.12.2) — `if`/`then` in the schema |

---

## F-VIO-01 — No problem type for 401
**Where it showed up.** VIO-27 (all twenty operations). Every operation declares 401 through the shared `Unauthorized` response, whose `Problem.type` must be registered; Part 12 registers nothing at 401.
**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2. Closes this and F-CTL-07.

## F-VIO-02 — No problem type for a malformed body
**Where it showed up.** VIO-05 (no `detection`; latitude-first coordinates), VIO-09, VIO-18. The three create routes declare a 400 for an invalid body; only `idempotency-key-required` is registered at 400. §19.9 rule 1 says to reject out-of-range positions but gives no type.
**Proposed fix.** Register `invalid-request` (400) with an `errors[]` extension member (`pointer`, `detail`); name it in the three 400 descriptions.

## F-VIO-03 — Unregistered 422s on create and update
**Where it showed up.** VIO-05, VIO-22, VIO-23, VIO-24. Declared 422s: unknown place or `violationType` on `POST /v1/violations`; unknown place or over-ceiling escalation on policy create; "invalid policy" on PUT; unknown place on signage create. None has a registered type.
**Proposed fix.** Register `place-unknown`, `violation-type-unknown`, and `policy-invalid` (all 422) and reference them from the four descriptions.

## F-VIO-04 — Unreviewed automated issuance is not in the policy resource
**Where it showed up.** VIO-08, VIO-10. §19.4 rule 1 makes unreviewed `detected → issued` binding (409 `violation-not-issuable`) but the rule lives only in "operator documentation", so `…/policies/effective` cannot tell a pipeline in advance.
**Proposed fix.** Add optional `EnforcementPolicy.unreviewedIssuance { permitted (default false), minimumConfidence, violationTypes[] }`; §19.4 rule 1 refers to it.

## F-VIO-05 — Conditional body rules on review and resolve have no declared 400
**Where it showed up.** VIO-09 (dismiss without `reason`), VIO-18 (`reduced` without `adjustedAmount`). Neither rule is in the schema; neither route declares a 400.
**Proposed fix.** Encode both with `if/then`; declare 400 `invalid-request` on `review`, `issue`, `payment`, `appeals`, `appeals/resolve`, `void`.

## F-VIO-06 — A cap relative to the unpaid fee has no unpaid fee to apply to
**Where it showed up.** VIO-10, VIO-11. The relative caps (`maximumMultipleOfUnpaid`, `maximumPercentOverUnpaid`) apply to a figure the Violation does not carry, so neither the officer nor an appeal can check a `penalty-exceeds-cap`.
**Proposed fix.** Add readOnly `Violation.unpaidAmount`, set and frozen at `issue`; optionally `capAmount`.

## F-VIO-07 — `amountHistory` after a clamp
**Where it showed up.** VIO-13. §19.10 rule 2 says a clamp records `reason: cap` and also that the first entry is `reason: issued`; three different histories all satisfy the text.
**Proposed fix.** On a clamp the first entry is `reason: cap` with the clamped amount and the requested amount in `detail`; or add `requestedAmount`.

## F-VIO-08 — Two problem types for one refusal
**Where it showed up.** VIO-15, VIO-18. §19.1 rule 2 says any other transition is `violation-transition-illegal`; the route and Part 12 say "no open appeal" is `appeal-closed`.
**Proposed fix.** §19.1 rule 3: `appeal-closed` only when the appeal is exhausted, the violation is closed/voided, or the window has passed; every other state mismatch is `violation-transition-illegal`.

## F-VIO-09 — Escalation overdue during an appeal
**Where it showed up.** VIO-16. A step that fell due while `appealed` either fires on return or is skipped; "resumes from the original issuedTime" suggests it fires at once.
**Proposed fix.** Pause the escalation clock while `appealed` (`afterDays` counts only days in `issued`), or fire overdue steps `paymentGraceDays` after return.

## F-VIO-10 — Which states are terminal?
**Where it showed up.** VIO-15, VIO-20. The schema, the §19.1 diagram, §19.1 rule 2, and the void route disagree about whether `dismissed`, `paid`, and `closed` can be voided.
**Proposed fix.** Name the terminal set once (`dismissed`, `closed`, `voided`); allow void from `detected`, `confirmed`, `issued`, `appealed`, and `paid` (the last with a Part 13 refund reference); align schema and route text.

## F-VIO-11 — No lookup by notice number
**Where it showed up.** VIO-21. A driver holds the notice number, which §19.6 also makes the payment `reference`, but the list cannot filter by it; `place` is single-valued; no `until`.
**Proposed fix.** Add optional `noticeNumber`, `until`, and list-valued `place` to `GET /v1/violations`.

## F-VIO-12 — How a versioned PUT carries the version
**Where it showed up.** VIO-23, VIO-25. The PUTs require "the version last read", but `version` is readOnly and no `If-Match` is declared.
**Proposed fix.** One rule in Part 4 for every versioned PUT: required `If-Match` (428 when absent), or body `version` REQUIRED as the precondition.

## F-VIO-13 — Pay-then-appeal cannot be expressed
**Where it showed up.** VIO-15. Appeals open only from `issued`, so §19.6's "refund after a dismissed appeal" can never happen; "pay now, contest later" is refused.
**Proposed fix.** Allow `paid → appealed` within `appealWindowDays`; resolutions return to `paid` (with a partial-refund reference when reduced) or `closed` (with a full refund); add `refund` to `ViolationAppealResolution`.

## F-VIO-14 — "Could exceed the ceiling" is not an error by §19.10
**Where it showed up.** VIO-22. Policy create declares a 422 for an escalation that "could exceed" the ceiling, but §19.10 rule 3 says the ceiling clamps.
**Proposed fix.** Drop that clause, or narrow it to a single fixed `addAmount` that alone exceeds `overallCeiling.maximumAmount`.

## F-VIO-15 — (upstream APDS) `GeoJsonObject` has no coordinates
**Where it showed up.** VIO-05. The vendored `GeoJsonObject` declares only `type` and `bbox`, so a Point with no coordinates validates.
**Proposed fix.** Upstream `GeoJsonPoint`; locally, wrap the three APX fields with `allOf` adding `type: const Point` and a constrained `coordinates`.

## F-VIO-16 — `Violation.location` is not quite the APDS `Location` shape
**Where it showed up.** VIO-07, VIO-09. It claims the APDS shape but drops the required `observerLocation` and adds `accuracyMetres`.
**Proposed fix.** `allOf` the APDS `Location` plus `accuracyMetres`, or say "modelled on" and list the differences.

## Runner issues
- Stacked `apx:validate` markers: fixed in the runner during this pass; duplicate event blocks merged.
- readOnly members in request bodies are not flagged (correct for OpenAPI 3.1), so F-VIO-12 lives in prose only.
