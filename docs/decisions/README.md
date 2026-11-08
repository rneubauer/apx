# Architecture Decision Records

An Architecture Decision Record (ADR) is a short note that records one
significant design decision: what was decided, when, why, and what follows
from it. ADRs explain why APX looks the way it does. The written standard in
`docs/standard/` and the OpenAPI in `spec/openapi/` say what APX is; the
ADRs say why.

## Format

Each ADR is one Markdown file with these headings:

- **Status**: one of the values below.
- **Date**: the day the decision was confirmed.
- **Context**: the problem and the facts that forced a choice.
- **Decision**: what was decided, in plain terms, with real field and route
  names.
- **Consequences**: what follows, including what was left out on purpose.
- **References**: the Part and section of the standard where the decision
  lands, and the CHANGELOG version that shipped it.

## Numbering

Files are named `NNNN-short-title.md`, for example
`0008-lpr-access-event.md`. Numbers are four digits, assigned in order and
never reused. A decision that is changed later is not edited away: a new ADR
records the change, and the old one is marked Superseded.

## Status values

| Status | Meaning |
|---|---|
| Proposed | Written for review; not yet decided. |
| Accepted | Decided and in force. |
| Superseded | Replaced, in whole or in part, by a later ADR named in the Status line. |

## Index

| # | Title | Date | Status |
|---|---|---|---|
| [0001](0001-violations-module.md) | Violations module for automated and guided enforcement | 2026-09-19 | Accepted |
| [0002](0002-validations-module.md) | Validations module with a merchant scope | 2026-09-19 | Accepted |
| [0003](0003-credentials-module.md) | Credentials module and the APDS materialization rule | 2026-09-20 | Accepted |
| [0004](0004-valet-module.md) | Valet module with a customer scope and condition reports | 2026-09-20 | Accepted |
| [0005](0005-ev-charging-module.md) | EV charging as a parking-side module | 2026-09-20 | Accepted |
| [0006](0006-negotiated-rates-and-ticket-matching.md) | Negotiated rates and ticket matching as optional control features | 2026-09-24 | Accepted, partly superseded by 0009 |
| [0007](0007-new-response-enum-values-allowed.md) | New values in response enums are allowed before 1.0 | 2026-09-28 | Accepted |
| [0008](0008-lpr-access-event.md) | LPR reads record what happened; no derivation logic in APX | 2026-09-28 | Accepted |
| [0009](0009-negotiated-amounts.md) | Negotiated rates may push any amount | 2026-10-08 | Accepted |
| [0010](0010-api-stays-out-of-iso.md) | The API stays in APX; only data elements go to APDS | 2026-10-14 | Accepted |
| [0011](0011-apds-equipment-types-only.md) | Devices use APDS EquipmentTypeEnum only | 2026-10-14 | Accepted |
| [0012](0012-signage-in-place.md) | Signage sits in the Place domain, Tier 2 | 2026-10-14 | Accepted |
| [0013](0013-ui-launch.md) | UI launch is defined once for every module | 2026-10-17 | Accepted |
| [0014](0014-site-configuration.md) | Site configuration from APX alone | 2026-10-18 | Accepted |
| [0015](0015-stay-grace.md) | Separate entry and exit grace on EnforcementPolicy | 2026-10-22 | Accepted |
| [0016](0016-display-records.md) | Display records in Part 26 | 2026-10-22 | Accepted |
| [0017](0017-stay-compliance.md) | Stay compliance on the Session, under its own scope | 2026-10-22 | Accepted |
| [0018](0018-apds-first-prime-directive.md) | APDS-first is the prime directive | Foundational (since 0.1.0) | Accepted |
| [0019](0019-gaps-rulings-2026-10-12.md) | Stricter rules adopted with gaps G1 to G21 | 2026-10-12 | Accepted |
| [0020](0020-camera-decoration.md) | Cameras get their own decoration; lane-cameras stays unchanged | 2026-10-18 | Accepted |
