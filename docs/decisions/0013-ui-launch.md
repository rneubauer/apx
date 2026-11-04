# ADR-0013: UI launch is defined once for every module

## Status

Accepted

## Date

2026-10-17

## Context

In remote-assistance call centers, most actions happen in a vendor's own web
screen, not through an API. Afterwards the two systems do not agree: money
amounts and gate vends are rarely recorded back. Vendors will take years to
implement every APX module, but they already have good screens.

## Decision

- A vendor may offer its own screens, and an APX client may open them for
  staff (operators, call-center agents) with automatic login.
- This is done once, cross-cutting for every module (reservations, LPR,
  tickets, enforcement, validations, tolling and so on), not only for the
  call center. Modules add entries to the `apx-ui-surfaces` registry.
- Login is automatic in one of two ways: a handshake
  (`POST /v1/ui/launches` with the normal token in the header returns a
  single-use URL valid 60 seconds), or a short-lived signed token (JWS).
- The launch carries the agent, a `correlationId` and, optionally, the
  `interactionId` of the call or case.
- Loopback is required. Everything done on the vendor screen comes back as
  the native APX record carrying the launch's `correlationId` and agent. If
  no APX operation exists yet, the vendor emits a `UiActionRecord`.
- `AllowedAction.execution.type` gains `ui`.

## Consequences

- Vendors get a day-one on-ramp, and both systems' reporting matches.
- The new `ui` enum value is handled as in
  [ADR-0007](0007-new-response-enum-values-allowed.md).

## References

- Part 25 §25.1–25.8
- Part 17 §17.3 rule 6
- `docs/apx-additional-functions/APX-ui-launch-and-field-gaps-2026-10-17.md`,
  Part A
- CHANGELOG 0.15.0 (2026-10-21)
