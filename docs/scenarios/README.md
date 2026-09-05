# APX Scenarios — the API at work

Fifteen end-to-end stories showing real wire exchanges against an APX
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
