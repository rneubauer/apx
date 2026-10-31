# APX Data Specification: proposed additions to APDS

*Draft for the APDS committee · based on APDS 4.1 (2026-01-14) · Contact: rneubauer@umojo.com*

This folder holds the documents APX offers to the Alliance for Parking
Data Standards: the data elements and enumerations APX asks APDS to add to
its data model (ISO TS 5206-1). They follow the APDS 4.1 document set, so
each can be read beside its APDS counterpart.

| Document | Read it beside | What it covers |
| --- | --- | --- |
| [01 Overview](01-overview.md) | APDS Overview 4.1 | Why each addition is needed and what sharing it gives the sector |
| [02 Information Model](02-information-model.md) | APDS Information Model 4.1 | The proposed classes, attributes, relationships and enumerations by domain, with diagrams and the full list by tier |
| [03 Data Dictionary](03-data-dictionary.md) | APDS Data Dictionary 4.1 | Every proposed class, attribute, association and value, in the APDS table format |
| [04 Use Case Document](04-use-cases.md) | APDS Use Case Document 4.1 | Worked examples, numbered C.3 to follow the APDS examples |

## What is and is not proposed

These documents describe **data only**. The APX API (routes, delivery,
security, discovery and command workflow) is APX's preferred
implementation specification on top of APDS. It stays separate and is not
proposed for the data model. See the [APX overview](../apx-overview.md) and
the [written standard](../standard/00-scope.md) for the API.

Corrections to the published APDS 4.1 API document are filed separately
in [APX → APDS: Requested Changes](../apds-change-requests.md).

## How these documents are made

The tables and summaries are generated from one source, so the four
documents always agree:

- `spec/proposals/apds-additions/*.yaml`: every proposed element, in the
  columns of the APDS Data Dictionary ([format](../../spec/proposals/README.md)).
- `docs/apds-submission/src/*.md`: the prose for each domain and the
  shared introductions.

`npm run submission:build` rebuilds the documents. `npm test` and CI fail
if they are out of date, or if any proposal uses a type that is not in
APDS 4.1 or this proposal, or re-proposes something APDS 4.1 already
defines.
