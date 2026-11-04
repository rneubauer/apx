# ADR-0010: The API stays in APX; only data elements go to APDS

## Status

Accepted

## Date

2026-10-14 (confirmed with the standards group 2026-10-15)

## Context

APDS is published as ISO/TS 5206-1. Anything added there is hard to change.
The standards group wants the core data elements and enumerations, not an
API.

## Decision

- The APX API spec does not go into ISO/TS 5206-1.
- APX proposes new data elements to the APDS data model. They are minimal,
  stable, vendor-neutral and mostly optional. Code lists are open anchors
  whose values live in APX registries.
- The API stays in APX as the preferred implementation spec: routes,
  protocol, change feeds, delivery fabric, command workflow, scopes,
  discovery, and use-case documents describing the implementation.
- A separate data-element package asks APDS to add the elements and
  enumeration values APX needs, written in APDS's own style.
- Proposals come in tiers. Tier 1 is a minimal first submission (for example
  AccessEvent, DeviceStatus, credential lifecycle, session reads and closure,
  plate read attributes, violation core, notice, validation redemption).
  Tier 2 stays as `apds-ext:apx:*` extensions until implementations prove
  the shape.

## Consequences

- Shapes that still change stay as APX extensions.
- Proposals are checked against the APDS Data Dictionary, not only the API
  YAML, because the Dictionary defines more.

## References

- `docs/data-model-by-domain.md` (placement and tiers)
- `docs/apds-submission/` (the data-element package)
- `docs/apx-specification/` (the APX document set)
- Part 0 §0.2 (APDS-first)
