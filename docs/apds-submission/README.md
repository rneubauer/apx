# APX Data Specification: proposed additions to APDS

*Draft for the APDS committee · based on APDS 4.1 (2026-01-14) · Contact: rneubauer@umojo.com*

This folder holds the documents APX offers to the Alliance for Parking
Data Standards. They follow the APDS 4.1 document set, so each can be
read beside its APDS counterpart.

**The request is small.** APX asks for corrections to APDS 4.1 (errata
001 to 014, filed, and C-015 to C-026, drafted) and for five new
`EquipmentTypeEnum` values: `barrier`, `gate`, `ticketDispenser`,
`intercom` and `exitVerifier`. Nothing else is requested. APX works today
on APDS 4.1 as published, without any of these changes. Every other data
element in these documents is an informative APX extension, offered for
later adoption: APX already carries each one as an `apds-ext:apx:*`
extension or an APX resource, so it does not need them in APDS to
operate. Each document opens with "What we ask of APDS" and keeps the
rest apart, marked informative.

| Document | Read it beside | What it covers |
| --- | --- | --- |
| [01 Overview](01-overview.md) | APDS Overview 4.1 | What we ask of APDS, then (Annex A) why each APX extension exists and what sharing it would give the sector |
| [02 Information Model](02-information-model.md) | APDS Information Model 4.1 | The request, then the APX extensions by domain, with diagrams and the full list by tier |
| [03 Data Dictionary](03-data-dictionary.md) | APDS Data Dictionary 4.1 | Every requested value and every APX extension, in the APDS table format, each marked requested or offered for later |
| [04 Use Case Document](04-use-cases.md) | APDS Use Case Document 4.1 | Worked examples, numbered C.3 to follow the APDS examples |

## What is and is not proposed

These documents describe **data only**. The APX API (routes, delivery,
security, discovery and command workflow) is APX's preferred
implementation specification on top of APDS. It stays separate and is not
proposed for the data model. See the [APX overview](../apx-overview.md) and
the [written standard](../standard/00-scope.md) for the API.

Corrections to the published APDS 4.1 API document are listed in
[APX Requests to APDS](../apx-specification/06-apds-requests.md), Parts A
and B, with the filed reports in [errata](../errata/README.md) and the
not-yet-filed drafts in [errata drafts](../errata/drafts/README.md).

## How these documents are made

The tables and summaries are generated from one source, so the four
documents always agree:

- `spec/proposals/apds-additions/*.yaml`: every element, in the
  columns of the APDS Data Dictionary ([format](../../spec/proposals/README.md)).
  The one entry marked `ask: minimal` is the request; the generator
  renders it first and everything else as the informative annex.
- `docs/apds-submission/src/*.md`: the prose for each domain and the
  shared introductions.

`npm run submission:build` rebuilds the documents. `npm test` and CI fail
if they are out of date, or if any proposal uses a type that is not in
APDS 4.1 or this proposal, or re-proposes something APDS 4.1 already
defines.
