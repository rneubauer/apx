# APX Scenarios — the API at work

Twenty-six end-to-end stories showing real wire exchanges against an APX
implementation. Every JSON payload marked with an `<!-- apx:validate … -->`
comment is machine-validated against the bundled spec by
`npm run scenarios:check` — the samples cannot drift from the standard.

| # | Scenario | Classes exercised |
|---|---|---|
| [01](01-lane-status-call-center.md) | Lane status when a call hits the call center | `apx-control` (read) |
| [02](02-call-center-gate-vend.md) | Call-center gate vend — validate, vend, fault, alert | `apx-control`, `apx-alerts`, `apx-events` |
| [03](03-data-sync-and-webhooks.md) | Data sync & signed webhooks | `apx-data`, `apx-events` |
| [04](04-lpr-lost-ticket.md) | LPR transient parker with a lost ticket | `apx-lpr`, `apx-accounts`, `apx-payment-history`, `apx-control` |
| [05](05-reservation-lifecycle.md) | Reservation lifecycle — quote to check-in to no-show | `apx-reservations`, `apx-events` |
| [06](06-reservation-set-time-extension.md) | Reservation for a set time, then extending it — pre-arrival, mid-stay, and declined | `apx-reservations` |
| [07](07-analytics-occupancy-feed.md) | The analytics feed — occupancy, payments, plate reads into a BI warehouse | `apx-data`, `apx-events`, `apx-accounts`, `apx-lpr` |
| [08](08-resolution-monthly-balance.md) | Resolution context — monthly parker, balance hold, courtesy limit, AI agent | `apx-resolution`, `apx-control` |
| [09](09-resolution-gate-vend-failed.md) | Paid but the gate didn't open — vend, confirmation levels | `apx-resolution`, `apx-control` |
| [10](10-resolution-payment-declined.md) | Card declined at the exit — payment link as the way out | `apx-resolution`, `apx-accounts` |
| [11](11-resolution-validation-missing.md) | "The restaurant validated me" — provider lookup, applyValidation | `apx-resolution`, `apx-control` |
| [12](12-resolution-rate-dispute.md) | $45 vs $12 — rate verification and supervised pushRate | `apx-resolution`, `apx-control` |
| [13](13-resolution-passback-violation.md) | "It says I'm already inside" — anti-passback reset | `apx-resolution`, `apx-control` |
| [14](14-resolution-reservation-plate-mismatch.md) | Prepaid reservation, misread plate — candidates, correction, the plate is the link | `apx-resolution`, `apx-lpr`, `apx-reservations` |
| [15](15-resolution-equipment-fault.md) | Payment terminal fault — the context knows before the customer retries | `apx-resolution`, `apx-control`, `apx-alerts` |
| [16](16-violation-automated-overstay.md) | Automated enforcement — LPR overstay, notice by mail, appeal reduced, paid | `apx-violations`, `apx-accounts`, `apx-events` |
| [17](17-violation-guided-handheld.md) | Guided enforcement — handheld eligibility check, officer confirms, citation on the windshield | `apx-violations`, `apx-lpr` |
| [18](18-validation-program-merchant.md) | Validation program — enrol a restaurant, issue QR codes, redeem at the pay station, cap hit, close the month | `apx-validations`, `apx-control` |
| [19](19-violation-policy-signage-escalation.md) | The law at the location — policy and signage on file, a mailed notice refused, issued lawfully with coordinates, day-31 escalation | `apx-violations`, `apx-events` |
| [20](20-credential-lost-card-replacement.md) | Lost keycard — replaced on the phone at noon, the old card denied at the gate at six, the access log says why | `apx-credentials`, `apx-accounts`, `apx-events` |
| [21](21-valet-dropoff-retrieve-handback.md) | Valet — drop-off with a scanned condition report, "bring my car" by text with an ETA, staged, verified handback, and the scratch that was already there | `apx-valet`, `apx-events` |
| [22](22-lpr-shared-driveway.md) | Gateless lot, shared driveway in the snow — a car enters on the exit lane, front plate from one camera and rear plate from the other, one passage, `accessEvent: entry`, no wrong-way anything; the exit closes the session and `?session=` lists the whole visit | `apx-lpr` |
| [23](23-tolling-gantry-dispute.md) | Tolling — a gantry retry that must not double-bill, settlement against an account, a misread plate disputed and refunded, and a resolved dispute that cannot be reopened | `apx-tolling`, `apx-accounts`, `apx-events` |
| [24](24-negotiated-rate-exit-lane.md) | Negotiated rate — the mirrored deck says which tables are negotiable, the agent picks one for the car in the lane, the deck is untouched, and the audit names who chose it | `apx-control`, `apx-data`, `apx-resolution` |
| [25](25-ticket-matching-exit-lane.md) | Ticket matching — no ticket at the exit: the camera's entry read is offered as a candidate, a permit holder is found by phone, the agent binds the open session, the exit prices from the real entry, and the lost-ticket fee is the fallback, not the default | `apx-control`, `apx-lpr`, `apx-accounts` |
| [27](27-lpr-reversible-lane.md) | Reversible lane — one camera facing each way so a rear plate is read in either mode, an old front-plate camera on the entry lane, a read first reported `unknown` and corrected by the LPR system, and the `observation.updated.v1` event that carries the correction to billing | `apx-lpr`, `apx-events` |

## By module — the vetting suite

Under these stories sits the test bench the spec was vetted with:
[**377 scenarios, one folder per conformance class**](by-module/README.md),
each with its findings. Every request and response is checked against the
bundle by `npm run vetting`.

| Module | Scenarios | Findings |
|---|---|---|
| [`apx-accounts`](by-module/apx-accounts/scenarios.md) | 26 | [14](by-module/apx-accounts/findings.md) |
| [`apx-alerts`](by-module/apx-alerts/scenarios.md) | 22 | [9](by-module/apx-alerts/findings.md) |
| [`apx-control`](by-module/apx-control/scenarios.md) | 25 | [10](by-module/apx-control/findings.md) |
| [`apx-credentials`](by-module/apx-credentials/scenarios.md) | 26 | [11](by-module/apx-credentials/findings.md) |
| [`apx-data`](by-module/apx-data/scenarios.md) | 33 | [16](by-module/apx-data/findings.md) |
| [`apx-discovery`](by-module/apx-discovery/scenarios.md) | 16 | [14](by-module/apx-discovery/findings.md) |
| [`apx-events`](by-module/apx-events/scenarios.md) | 24 | [17](by-module/apx-events/findings.md) |
| [`apx-lpr`](by-module/apx-lpr/scenarios.md) | 35 | [19](by-module/apx-lpr/findings.md) |
| [`apx-permits`](by-module/apx-permits/scenarios.md) | 15 | [12](by-module/apx-permits/findings.md) |
| [`apx-reservations`](by-module/apx-reservations/scenarios.md) | 24 | [16](by-module/apx-reservations/findings.md) |
| [`apx-resolution`](by-module/apx-resolution/scenarios.md) | 28 | [13](by-module/apx-resolution/findings.md) |
| [`apx-tolling`](by-module/apx-tolling/scenarios.md) | 24 | [14](by-module/apx-tolling/findings.md) |
| [`apx-valet`](by-module/apx-valet/scenarios.md) | 25 | [16](by-module/apx-valet/findings.md) |
| [`apx-validations`](by-module/apx-validations/scenarios.md) | 25 | [13](by-module/apx-validations/findings.md) |
| [`apx-violations`](by-module/apx-violations/scenarios.md) | 29 | [17](by-module/apx-violations/findings.md) |

## Conventions

- **Base URL** `https://api.lakeside-garage.example` — a synthetic operator,
  "Lakeside Garage". All identifiers, plates, names, and card fragments are
  fake and follow the patterned UUIDs (`b1…`, `c1…`) so object types are
  recognizable at a glance.
- **Auth**: every request carries `Authorization: Bearer <token>` from the
  OAuth2 client-credentials flow (scenario 03 shows it once; the others
  elide it).
- Requests that create resources send a *create shape* (no `id`, `version`,
  or `status` — the server assigns those) and are shown unannotated;
  responses are full resources and are validated.
- Timestamps are RFC 3339 UTC. Money is APDS `AmountInCurrency`
  (`currencyType`/`currencyValue`). References are `{"id", "className"}`.
