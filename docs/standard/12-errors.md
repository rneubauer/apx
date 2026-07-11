# APX Part 12 — Error Model

## 12.1 Problem details

APX endpoints MUST return errors as RFC 9457 `application/problem+json`
using the `Problem` schema. APDS-native routes keep their APDS-documented
error shapes (`ResponseStatus`); implementations SHOULD additionally accept
`Accept: application/problem+json` there.

## 12.2 APX problem-type registry

Base URI: `https://apx-standard.org/problems/`

| Slug | Status | When |
|---|---|---|
| `insufficient-scope` | 403 | Token lacks the operation's OAuth scope |
| `insufficient-grant` | 403 | Scope OK but target outside `apx_places`/`apx_org` grant |
| `idempotency-key-required` | 400 | Mutating operation sent without `Idempotency-Key` |
| `idempotency-conflict` | 409 | Same `Idempotency-Key` replayed with a different body |
| `id-collision` | 409 | Client-supplied UUID already exists (APDS convention) |
| `version-conflict` | 409 | Update targets a stale object version |
| `command-expired` | 422 | Command `expiryTime` passed before dispatch |
| `command-not-cancellable` | 409 | Cancel requested after a terminal state |
| `unknown-topic` | 400 | Subscription references an unregistered topic |
| `subscription-failed` | 410 | Operation on a subscription in `failed` state |
| `target-not-found` | 404 | Referenced APDS/APX entity does not exist |
| `validation-provider-unknown` | 422 | applyValidation names a provider not offered at the place |
| `payment-declined` | 422 | Take-payment attempt declined by the payment layer |
| `dispute-closed` | 409 | Toll dispute operation on a closed dispute |

Problem responses SHOULD include `detail` and MAY carry additional members
(RFC 9457 extension members), including an `extensions` container.

## 12.3 General HTTP conventions

- 429 with `Retry-After` for throttling (APDS convention).
- 202 for accepted-but-asynchronous work (commands).
- Pagination, where APX defines list endpoints, follows the APDS
  `PaginatedList` metadata shape.
