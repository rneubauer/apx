# ADR-0001: Violations module for automated and guided enforcement

## Status

Accepted

## Date

2026-09-19

## Context

Operators issue tickets, notices, warnings and citations. Some come from
camera or sensor pipelines (automated enforcement). Others come from an
officer with a handheld (guided enforcement). APDS 4.1 has no violation
entity. It does say that `AssignedRight` is the enforcement source of truth,
and it defines an `ep` (Enforcement Provider) OAuth role.

State enforcement laws also limit when a notice may be sent, how much a
penalty may exceed the unpaid fee, and how it may escalate. Some laws
require the posted sign text to be on file.

## Decision

- Add one `Violation` resource for tickets, notices, warnings and citations,
  in a new optional class `apx-violations`. Design it from APDS conventions,
  with no outside source document.
- Cover the full lifecycle, including payment and appeals. One appeal per
  violation.
- Include an eligibility check, `GET /v1/enforcement/eligibility`, built from
  APDS AssignedRights and Sessions, which stay authoritative. It lives under
  `/v1/enforcement` because `/v1/violations/eligibility` would be ambiguous
  with `/v1/violations/{id}`.
- Payments reuse `/v1/payments` and attach to a violation by Reference.
- Reuse the APDS `ep` role rather than define a new enforcement identity.
- Added the same day (0.6.0): `EnforcementPolicy` bound to a place with
  nearest-ancestor inheritance, applied by the server at issue time
  (delivery rules, penalty cap, escalation schedule, appeal window,
  `signageRequired`). `Signage` records the posted text and photo, and is
  frozen onto each violation at issue. `Violation.location` uses the APDS
  Observation location shape. Both live under `/v1/enforcement/*` with no new
  class or scope.

## Consequences

- Enforcement composes APDS rights instead of inventing an entitlement model.
- The server, not the client, applies escalation and records it in
  `Violation.amountHistory`.
- Left out on purpose: collections handoff, more than one appeal, and tow or
  boot actions. Those go in `extensions` or a new Part, not onto the state
  machine.

## References

- Part 19 §19.1–19.6 (resource, endpoints, eligibility, settlement),
  §19.9 (location), §19.10 (enforcement policy), §19.11 (signage)
- CHANGELOG 0.4.0 and 0.6.0 (2026-09-19)
