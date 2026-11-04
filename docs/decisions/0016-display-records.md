# ADR-0016: Display records in Part 26

## Status

Accepted

## Date

2026-10-22 (decisions D3 and D4)

## Context

An exit screen shows a car "Payment not found". The deployment needs a
record of that: which sign, which message, when, and for which read or stay.
It uses the record to measure whether signs raise compliance, and as proof
of display for a refused-service message. Part 6 §6.1a already had this
shape, but only for messages sent by an APX command. At the live site the
edge system drives the sign locally, so no APX command exists.

## Decision

- **D3.** A new resource, `DisplayRecord`, goes in Part 26 Site
  configuration. The sign is site equipment, and the sign also shows welcome
  and idle messages, so Part 19 would read as enforcement-only.
- The system that drove the sign writes it. It reuses the §6.1a proof shape,
  now the named schema `DisplayProof`.
- **D4.** Seed the registry `apx-display-message-kinds` with nine kinds:
  `transientEntrance`, `entranceRefused`, `transientExitPaid`,
  `transientExitUnpaid`, `monthlyEntrance`, `monthlyExit`,
  `monthlyExitBalanceDue`, `idle`, `fallback`.
- Not yet: separate overstay or late-start exit messages. They stay
  `transientExitUnpaid` until site data shows whether it matters.

## Consequences

- No message text and no plate are stored, only a content hash and wording
  version.
- Routes `GET`/`POST /v1/display-records` and `GET /v1/display-records/{id}`,
  topic `apx.displays.shown.v1`, scope `apx.displays:record`.
- Whether a message changed behaviour is analysis, outside APX.

## References

- Part 26 §26.9; Part 6 §6.1a
- `docs/apx-additional-functions/APX-nexus-core-needs-2026-10-22.md`, N2
- CHANGELOG 0.16.0 (2026-11-01)
