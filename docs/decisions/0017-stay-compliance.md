# ADR-0017: Stay compliance on the Session, under its own scope

## Status

Accepted

## Date

2026-10-22 (decisions D5 and D6)

## Context

A compliance engine scores every stay: paid, within grace, overstay, waiting
for review. Other systems (reporting, a city, a call-center console) need the
same answer without re-running the engine's rules.

## Decision

- The engine writes the decoration `apds-ext:apx:stay-compliance@1.0`
  (`StayCompliance`) on the APDS Session through the native Session routes.
  It carries one `status`, its `family`, `pendingStatus`, `flags[]`,
  `evaluatedTime`, `sequence`, `final` and the `policy` version used.
- **D5.** Seed the registry `apx-stay-compliance-statuses` with the full list
  of 16 statuses from the source engine, including `unscored`,
  `reviewRequired`, `stale` and `paidLate`. Each was checked against the
  engine's compliance rules before normative text was written. The registry
  states each outcome only. Thresholds and rule order stay out of APX.
- **D6.** Per-stay compliance is read under its own scope,
  `apx.compliance:read`. Without it the block is left out.
- A compliance status is never a Violation. Issuance stays in Part 19.

## Consequences

- Writing needs `apx.compliance:write`. An out-of-order evaluation is
  `409 evaluation-out-of-order`.
- `final` is the writer's statement, not a lock.
- Families are `compliant`, `violation`, `withheld` and `other`.

## References

- Part 5 §5.9; Part 9 §9.6 rule 8
- `docs/apx-additional-functions/APX-nexus-core-needs-2026-10-22.md`, N4 and
  the appendix
- CHANGELOG 0.16.0 (2026-11-01)
