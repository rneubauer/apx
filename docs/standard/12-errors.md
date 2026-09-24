# APX Part 12 — Error Model

## 12.1 Problem details

APX endpoints MUST return errors as RFC 9457 `application/problem+json`
using the `Problem` schema. APDS-native routes keep their APDS-documented
error shapes (`ResponseStatus`); implementations SHOULD additionally accept
`Accept: application/problem+json` there.

## 12.2 APX problem-type registry

Base URI: `https://apx-standard.org/problems/`

A `type` URI is a **stable identifier, not a location**. Per RFC 9457 §3.1.1
it need not dereference, and clients MUST match on the exact string rather
than fetching it. The base URI above is therefore fixed even though the
domain is not yet delegated (Part 11 §11.2), and it will not change when the
domain goes live. The human-readable documentation for every type is the
table below.

| Slug | Status | When |
|---|---|---|
| `insufficient-scope` | 403 | Token lacks the operation's OAuth scope |
| `insufficient-grant` | 403 | Scope OK but target outside `apx_places`/`apx_org` grant |
| `idempotency-key-required` | 400 | Mutating operation sent without `Idempotency-Key` |
| `idempotency-conflict` | 409 | Same `Idempotency-Key` replayed with a different body |
| `id-collision` | 409 | Client-supplied UUID already exists (APDS convention) |
| `version-conflict` | 409 | Update targets a stale object version |
| `command-expired` | 422 | Command `expiryTime` passed before dispatch |
| `command-not-cancellable` | 409 | Cancel requested at `dispatched` or later (Part 6 §6.1) |
| `unknown-topic` | 400 | Subscription references an unregistered topic |
| `subscription-failed` | 410 | Operation on a subscription in `failed` state |
| `target-not-found` | 404 | Referenced APDS/APX entity does not exist |
| `validation-provider-unknown` | 422 | applyValidation names a provider not offered at the place |
| `payment-declined` | 422 | Take-payment attempt declined by the payment layer |
| `dispute-closed` | 409 | Toll dispute operation on a closed dispute |
| `pool-exhausted` | 409 | Permit issuance against an exhausted RightPool (Part 14 §14.2) |
| `right-not-linkable` | 409 | AssignedRight already consumed, outside validity, or wrong place (Part 14 §14.1b) |
| `action-not-allowed` | 403 | Execution of an action the current resolution context evaluated as not allowed (Part 17 §17.3) |
| `approval-required` | 403 | Requires-approval action executed without approval evidence (Part 17 §17.3) |
| `rate-limited` | 429 | Throttled; response carries `Retry-After` (§12.3) |
| `violation-transition-illegal` | 409 | Violation transition requested from a state that does not allow it (Part 19 §19.1) |
| `violation-not-issuable` | 409 | `issue` on an unreviewed `guided`/`manual` detection, or an `automated` one where policy forbids unreviewed issuance (Part 19 §19.4) |
| `appeal-closed` | 409 | Appeal operation on a violation with no open appeal, a second appeal, or a closed/voided violation (Part 19 §19.1) |
| `program-not-active` | 422 | Issuance or redemption against a validation program that is not `active`, or a transition out of `ended` (Part 20 §20.1, §20.3) |
| `instrument-invalid` | 422 | Validation code unknown, void, expired, or already redeemed; or an instrument required and absent (Part 20 §20.3) |
| `redemption-limit-exceeded` | 422 | A program rule (maxPerTicket, maxPerDay, stackable, applicableRateTables) refuses the redemption (Part 20 §20.3) |
| `redemption-reversed` | 409 | Reverse requested on an already-reversed redemption (Part 20 §20.4) |
| `statement-closed` | 409 | Reverse requested on a redemption inside a closed statement period (Part 20 §20.4) |
| `statement-overlap` | 409 | Closing a period that overlaps an existing closed statement (Part 20 §20.6) |
| `delivery-method-not-permitted` | 422 | `issue` with a notice delivery method, or without the minimum evidence, the enforcement policy in force does not permit for the detection mode (Part 19 §19.10) |
| `notice-deadline-passed` | 422 | `issue` after the policy's notice deadline for the delivery method has elapsed since detection (Part 19 §19.10) |
| `penalty-exceeds-cap` | 422 | `issue` amount above the policy's penalty cap with `onExceed: refuse` (Part 19 §19.10) |
| `signage-required` | 422 | `issue` at a place whose policy requires posted signage and none was in force at detection (Part 19 §19.10–19.11) |
| `signage-referenced` | 422 | `PUT` altering the text of a Signage record an issued violation references (Part 19 §19.11) |
| `credential-identification-in-use` | 409 | Issuing or replacing with an identification already held by a non-terminal record of the same type (Part 21 §21.1) |
| `credential-transition-illegal` | 409 | Credential transition requested from a state that does not allow it (Part 21 §21.1) |
| `credential-not-replaceable` | 409 | `replace` on a revoked, expired, or already-replaced credential (Part 21 §21.1) |
| `valet-transition-illegal` | 409 | Valet ticket transition requested from a state that does not allow it (Part 22 §22.1) |
| `valet-vehicle-not-located` | 409 | `retrieve` on a ticket still in `dropped` — no parked position recorded yet (Part 22 §22.1) |
| `valet-verification-failed` | 403 | Handback claimant verification failed; the attempt is recorded in `statusHistory` (Part 22 §22.4) |
| `agent-required` | 400 | `pushNegotiatedRate` or `matchTicket` without `agent` — the selecting or matching principal is mandatory (Part 6 §6.6–6.7) |
| `rate-not-negotiable` | 422 | `pushNegotiatedRate` names a RateTable not flagged negotiable for the target's place, or one that does not apply there (Part 6 §6.6) |
| `lane-no-current-transaction` | 409 | `pushNegotiatedRate` or `matchTicket` at a lane with no vehicle transaction in progress (Part 6 §6.6–6.7) |
| `session-not-open` | 422 | `matchTicket` names a Session that is closed, already bound to an exit, or at a different place (Part 6 §6.7) |

Problem responses SHOULD include `detail` and MAY carry additional members
(RFC 9457 extension members), including an `extensions` container.

## 12.3 General HTTP conventions

- 429 with `Retry-After` for throttling (APDS convention).
- 202 for accepted-but-asynchronous work (commands).
- Pagination, where APX defines list endpoints, follows the APDS
  `PaginatedList` metadata shape.
