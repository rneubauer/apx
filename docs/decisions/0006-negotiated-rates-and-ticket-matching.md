# ADR-0006: Negotiated rates and ticket matching as optional control features

## Status

Accepted. The "no free-form amount" rule is superseded by
[ADR-0009](0009-negotiated-amounts.md).

## Date

2026-09-24

## Context

The goal is to close open tickets at the exit lane and reduce lost revenue.
Two needs came up. First, a call-center agent offers a negotiated rate to a
driver and pushes it to the lane. Second, a driver with no ticket should be
matched to the entry that was already recorded, by plate, phone or
credential.

## Decision

- Both are optional features of `apx-control` in Part 6, not a new Part.
- Rate deck sync is APDS-native (`/rates` plus the Part 5 change feed). APX
  adds no rate model. It adds only the decoration
  `apds-ext:apx:ratepolicy@1.0` (`RatePolicy.negotiable`) on the RateTable.
- `pushNegotiatedRate` selects a flagged table and applies it to the lane's
  current ticket only. At this date no free-form amount was allowed.
- APX defines no selection rules (no length-of-stay bands or time windows).
  The presenting system builds its own guardrails.
- `Command.agent` and `agentType` (`human` or `ai`) are REQUIRED on both new
  commands. `requestedBy` stays the organization.
- `matchTicket` binds the lane transaction to an open Session.
  `LaneStatus.matchCandidates[]` is advisory. The `phone` lookup is an
  account key, not a telephony id. `lostTicket` stays the explicit fallback.

## Consequences

- The rate deck stays authoritative, and every reduction is attributable to
  an agent.
- `apx-command-types` gained `pushNegotiatedRate` and `matchTicket`.

## References

- Part 6 §6.6 (negotiated rates), §6.7 (ticket matching)
- CHANGELOG 0.10.0 (2026-09-24)
