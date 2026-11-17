---
title: APX decisions, October to November 2026
audience: staff
product: APX
status: current
reviewed: 2026-11-16
source: Decisions made by Rick Neubauer (APX maintainer) in working sessions, 2026-10-14 to 2026-11-16
---

# APX decisions, October to November 2026

What was asked, what was decided and why. Design decisions with lasting effect on the standard have their own
record in [`docs/decisions/`](../../decisions/README.md); this file links to them rather than repeating them.

## The API stays outside ISO (2026-10-14)

- **Asked:** should the APX API go into ISO/TS 5206-1 along with APDS?
- **Decided:** no. Only data elements are offered to APDS; the API, its routes, delivery and command workflow stay in
  APX as the implementation specification. Recorded as [ADR 0010](../../decisions/0010-api-stays-out-of-iso.md).
- **Why:** anything in an ISO standard is hard to change; APX needs to move quickly.

## Devices use APDS equipment names only (2026-10-14)

- **Decided:** APX does not invent device types. Devices carry the APDS `equipmentType` plus an APX `role` from a
  fixed code list. Missing APDS values are requested from APDS. [ADR 0011](../../decisions/0011-apds-equipment-types-only.md).

## Every provider registers (2026-11-08)

- **Asked:** can APX have a registry of data providers, like the provider list in MDS, so that data can always be
  traced to the vendor that sent it?
- **Decided:** yes, and registration is **required now**, even if a provider only registers a name, so adoption can
  be tracked. Carrying the provider id inside the data is optional for now and expected to become required later.
  Systems that combine data from several providers key every record by provider and local id, because "everybody
  makes their own location ID" and ids from different providers can collide once systems interconnect.
- **Implemented:** PR #60. Design note: [the provider registry](../proposals/APX-provider-registry-2026-11-08.md).

## Installation ids and product entries (2026-11-13, confirmed 2026-11-16)

- **Asked:** a review found that local ids are often unique per site, not per provider, so provider plus local id can
  still collide within one vendor.
- **Decided:** add an optional installation id, and key by provider, installation and local id. A company registers
  once and may add an entry per product. The provider id in the discovery document stays recommended (SHOULD).
- **Implemented:** PR #60, merged 2026-11-16.

## A minimal request to APDS (2026-11-13, confirmed 2026-11-16)

- **Asked:** do all the proposed data elements have to be in APDS for APX to work?
- **Decided:** no. Leave the root APDS as it is and ask only for what is necessary: corrections to the APDS documents,
  and five `EquipmentTypeEnum` values (`barrier`, `gate`, `ticketDispenser`, `intercom` and the new `exitVerifier`, so
  an exit lane can be typed in APDS terms). The other 126 elements stay in APX, listed in an appendix for later.
- **Why:** a small, clearly necessary request is easier for the committee to approve, and APX already carries
  everything else as extensions.
- **Implemented:** PR #62. Design note: [a minimal request to APDS](../proposals/APX-apds-minimal-ask-2026-11-13.md).

## APDS issues are tagged by type (2026-11-15)

- **Decided:** the 14 issues filed on the APDS repository carry their type at the start of the title: `[Bug]`,
  `[Feature request]`, `[Suggestion]` or `[Question]`. The maintainers are asked to apply matching labels.

## Negotiated price is required for command-centre integrations (2026-11-15)

- **Decided:** for a command-centre or call-centre integration, the `pushNegotiatedRate` command is a Must, and it must
  accept any stated amount (the `negotiatedAmounts` feature), not only preset rate tables.
- **Why:** vendors and operators both ask for agents to be able to settle on an arbitrary price; `agent` and `reason`
  keep every override audited.

## Documentation ships with the change (2026-11-03)

- **Decided:** a change is not done until its documentation is done, in the same pull request. The developer guide,
  conformance guide, decision records, folder READMEs and simulator user guide were written to catch up (PRs #54 to
  #58).
