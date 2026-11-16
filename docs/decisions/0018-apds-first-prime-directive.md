# ADR-0018: APDS-first is the prime directive

## Status

Accepted

## Date

Foundational; in force since the first edition (0.1.0, 2026-08-21). No
separate decision date is recorded.

## Context

APX exists to add what APDS 4.1 leaves out: real-time delivery, operational
control, alerting, discovery and the operational domains. APDS is the
shared standard that parking vendors already implement, and its core data
model is published as ISO/TS 5206-1. If APX redefined or re-shaped APDS
entities, a plain APDS client would stop working against an APX server, and
the two standards would drift apart.

## Decision

Part 0 §0.2 sets three rules:

- Where APDS 4.1 defines a route, schema or convention, an APX
  implementation MUST use it verbatim.
- APX MUST NOT redefine, subset or re-shape any APDS entity. APX resources
  point to APDS entities with `Reference` or `VersionedReference`.
- A plain APDS 4.1 client MUST work against an APX implementation without
  changes, for the routes and features it uses.

The rule is enforced in the repository:

- The APDS 4.1 OpenAPI document is vendored unmodified in
  `spec/vendor/apds/4.1/` and reused by `$ref`.
- `tools/check-vendor.mjs` recomputes the SHA-256 of every vendored file and
  compares it with `CHECKSUM.sha256`. CI fails on any difference.
- CONTRIBUTING.md lists the rule first among the ground rules and says the
  vendored tree MUST NOT be edited.

## Consequences

- New APX data goes beside APDS entities, as `apds-ext:apx:*` decorations
  or APX-owned resources, never inside a changed APDS schema.
- Later decisions follow from it: 0003 (credentials materialize as APDS
  records), 0010 (data elements are proposed to APDS, the API stays in
  APX) and 0011 (devices use APDS `EquipmentTypeEnum` only).
- A fix to APDS itself cannot be made here. It goes to the APDS maintainers
  as a suggestion.

## References

- Part 0 §0.2 (prime directive)
- CONTRIBUTING.md (ground rules)
- `tools/check-vendor.mjs` and `spec/vendor/apds/4.1/CHECKSUM.sha256`
- CHANGELOG 0.1.0 (2026-08-21): "APDS 4.1 vendored verbatim,
  checksum-guarded"
