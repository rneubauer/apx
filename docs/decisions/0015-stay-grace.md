# ADR-0015: Separate entry and exit grace on EnforcementPolicy

## Status

Accepted

## Date

2026-10-22 (decisions D1 and D2)

## Context

At a live site the ruling is 15 minutes of grace on entry and 15 minutes on
exit, kept apart. A stay's compliance must be explainable on both sides, and
one grace number cannot do that. APDS 4.1 has no grace concept. APX had
`EligibilityResult.graceUntil` but nowhere to configure the policy behind
it.

## Decision

- **D1.** Add `stayGrace {entryMinutes, exitMinutes}` to `EnforcementPolicy`.
  Both are optional and independent. Absent means no grace on that side; `0`
  means explicitly none.
- **D2.** `EligibilityResult.graceUntil` is derived from `stayGrace`.
- APX states the minutes. How they combine with rights stays engine logic,
  following the 2026-09-28 rule that APX records policy and outcomes, not the
  rule between them ([ADR-0008](0008-lpr-access-event.md)).

## Consequences

- Grace inherits down the place hierarchy and keeps versions with the
  policy, so an appeal can see what grace applied that day.
- The alternative, Part 26 `PlaceOperations`, was rejected: it would split
  enforcement policy across two objects and lose the versioned history.

## References

- Part 19 §19.10 rule 7, §19.3 rule 5
- `docs/apx-additional-functions/APX-nexus-core-needs-2026-10-22.md`, N1
- CHANGELOG 0.16.0 (2026-11-01)
