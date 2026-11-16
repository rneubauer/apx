# ADR-0012: Signage sits in the Place domain, Tier 2

## Status

Accepted

## Date

2026-10-14

## Context

`Signage` records the posted sign text, photo, position and in-force window
at a location. It was added for enforcement, where some laws require the
sign text on file ([ADR-0001](0001-violations-module.md)). When APX data
elements were placed on the APDS data map for the APDS proposals, Signage
could go in Enforcement or in Place.

## Decision

- In the data model, Signage sits in the Place domain, under
  Layout/Structure/Equipment, not in Enforcement. A sign is part of the
  site.
- It stays in Tier 2: kept as an APX extension for now, not in the first
  ISO submission.

## Consequences

- This is a placement in the data model only. The API is unchanged:
  Signage is still served under `/v1/enforcement/signage` and defined in
  Part 19 §19.11, and violations still freeze it at issue.

## References

- `docs/data-model-by-domain.md`, "Decided" and "Tier 2"
- Part 19 §19.11
