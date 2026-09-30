# APX → APDS: Requested Changes to APDS 4.1

*As of 2026-09-30 · APX 0.13.0 · Contact: rneubauer@umojo.com*

## Summary

We are asking for fourteen small corrections to the published
`apds-api-4.1.yaml`, all already filed on `parkingdata/spec` (#33–#35,
#37–#47), plus a short list of optional additions for APDS to consider.
None of this blocks APX: APX vendors APDS 4.1 byte-for-byte and works
around each item in its own overlay, so every change below is a request,
not a dependency.

Each item says what kind it is:

- **Correction** — the schema cannot validate what the document describes.
- **Omission** — something the document describes is missing from the schema.
- **Suggestion** — a consistency or modelling idea that may well be intentional as it stands.

When APDS adopts any of these, APX removes the matching workaround in the
same release, and wherever APDS standardizes something APX currently
fills in, the APDS construct wins (APX Part 3 §3.3(8)). Thank you for the
work that has gone into APDS; we are happy to prepare pull requests for
any item the group would like.

## Part A — Corrections to apds-api-4.1.yaml

Fourteen items, each filed with the offending snippet and a minimal
suggested fix. Verified against `parkingdata/spec` at `e10dcfc`,
byte-identical to the published 4.1 document.

| # | Issue | Type | Requested change | APX today |
| --- | --- | --- | --- | --- |
| [001](errata/001-reference-schema-unsatisfiable.md) | [#33](https://github.com/parkingdata/spec/issues/33) `Reference` requires `id` + `className` but allows at most one property | Correction | Remove `minProperties`/`maxProperties` from `Reference` | Validators relax the two constraints |
| [002](errata/002-observations-example-invalid.md) | [#34](https://github.com/parkingdata/spec/issues/34) `POST /observations` `single-element` example matches neither `oneOf` branch | Correction | Add `id`/`version` to the example, or make them server-assigned | Lint exemption scoped to this one example |
| [003](errata/003-observation-discriminator-typo.md) | [#35](https://github.com/parkingdata/spec/issues/35) Discriminator key spelled `ObvservationSet` | Correction | Rename to `ObservationSet` (third-party PR [#36](https://github.com/parkingdata/spec/pull/36) is open) | None needed; tolerant tooling resolves it |
| [004](errata/004-ratetable-phantom-required.md) | [#37](https://github.com/parkingdata/spec/issues/37) `RateTable` requires `validityStart` and `activeTimes`, which it never defines | Correction | Drop the two phantom entries from `required` | Overlay replaces the list |
| [005](errata/005-observations-post-no-responses.md) | [#38](https://github.com/parkingdata/spec/issues/38) `POST /observations` declares no responses | Omission | Declare 201/400/409 like the other creates | Overlay declares them |
| [006](errata/006-observations-discriminator-collision.md) | [#39](https://github.com/parkingdata/spec/issues/39) Wrapper `type` collides with `ObservationElement.type`; no single observation validates | Correction | Rename the wrapper discriminator, or use a plain `oneOf` | Overlay uses a plain `oneOf` |
| [007](errata/007-quotes-post-no-request-body.md) | [#40](https://github.com/parkingdata/spec/issues/40) `POST /quotes` has no request body; `GET /quotes` returns one object | Omission + suggestion | Declare the request body; confirm the `GET` shape | Overlay adds an optional body |
| [008](errata/008-referencetoquote-identical-branches.md) | [#41](https://github.com/parkingdata/spec/issues/41) `ReferenceToQuote` is a `oneOf` of two identical branches | Correction | Make the branches distinct and non-empty | No workaround; book with the full `AssignedRight` |
| [009](errata/009-identifiers-ratetableid-spelling.md) | [#42](https://github.com/parkingdata/spec/issues/42) `Identifiers` requires `rateTableId`, declares `rateTableID` | Correction | Align the spelling | Overlay declares `rateTableId` |
| [010](errata/010-entities-no-extensions.md) | [#43](https://github.com/parkingdata/spec/issues/43) No entity declares the `extensions` container of Use Case §C.2.5 | Suggestion | Declare `Extensions` once on `VersionedIdentity` | Overlay adds it to 8 entities |
| [011](errata/011-geojsonobject-no-coordinates.md) | [#44](https://github.com/parkingdata/spec/issues/44) `GeoJsonObject` has no `coordinates` | Omission | Declare `coordinates`, ideally a `GeoJsonPoint` | Overlay adds `coordinates` |
| [012](errata/012-native-response-code-irregularities.md) | [#45](https://github.com/parkingdata/spec/issues/45) Response codes on `/rates`, `/rights/assigned/{id}`, `/contacts` differ from siblings | Suggestion | Align codes (201 on create; 400/404/409 declared) | Overlay adds the missing codes |
| [013](errata/013-hierarchyelement-subtypes-unmapped.md) | [#46](https://github.com/parkingdata/spec/issues/46) `HierarchyElement` maps 3 of 10 types; `VehicularAccess` (lanes) unreachable | Omission | Restore the 7 commented-out mappings | Lane fields carried unvalidated |
| [014](errata/014-rightholder-not-identifiable.md) | [#47](https://github.com/parkingdata/spec/issues/47) No identifiable `RightHolder`; `AssignedRightHolder` has no `id` | Suggestion (question) | Add an identifiable `RightHolder`, or an optional `id` | `className: "RightHolder"` with a local id |

Full reports: [APX errata folder](errata/README.md).

## Part B — Additions APDS could consider

Five suggestions, not filed as errata, where APX currently fills a gap in
its own namespace. If APDS covered any of them natively, APX would move to
the APDS form and retire its own.

| Suggestion | Why it helps | APX today |
| --- | --- | --- |
| **Read and correct one Observation by id** (`GET` / `PUT /observations/{id}`) | APDS 4.1 has no route that returns or replaces a single Observation, so an LPR read cannot be fetched or corrected after the fact | `GET /v1/lpr/reads?observation=` and `PUT /v1/lpr/reads/{observation}/access-event` (Part 13 §13.3a) |
| **Payment outcomes on `Payment`**: a status (approved / declined / reversed), a refund value in `PaymentTypeEnum`, and the means of payment per payment | APDS `Payment` records only collected money; declines, refunds, and how a customer paid have no home | `PaymentRecord` alongside, materialized into `Payment` once captured (Part 13 §13.6) |
| **Event types for access and corrections** in `EventTypeEnum` (a credential presented or refused at a lane; an observation updated) | Subscribers cannot hear a lane denial or a corrected read through APDS events | APX topics `apx.credentials.access.v1`, `apx.data.observation.updated.v1` (Parts 8, 21) |
| **`application/problem+json` (RFC 9457) as an error option** on native routes | Clients get one machine-readable error shape across APDS and APX; today native 409s carry only `ResponseStatus` | Offered when the client sends `Accept: application/problem+json` (Part 5 §5.1a, Part 12) |
| **An identifiable holder** (see Part A, 014) | Rights, permits, accounts, and payments for one customer can be grouped | `className: "RightHolder"`, local id (Part 1 §1.3 item 14) |

APX also defines surfaces APDS does not yet cover — alerts, lane control,
tolling, valet, enforcement signage. Those are offered for adoption as a
whole, not requested as changes.

## Part C — Suggested order

If the group takes these in batches, this order removes the most friction
for implementers first:

1. **Blocks validation today** — 001 (`Reference`), 004 (`RateTable`), 006 (observations), 013 (lane and equipment types). Without these, strict validators reject valid APDS payloads.
2. **One-line fixes** — 003 (typo), 009 (`rateTableId`), 011 (`coordinates`), 002 (example).
3. **Missing declarations** — 005 (observation responses), 007 (quote request body), 012 (response codes).
4. **Modelling questions for discussion** — 008 (`ReferenceToQuote`), 010 (`extensions`), 014 (`RightHolder`), then the Part B additions.

As each lands in an APDS release, APX vendors that release and deletes the
matching overlay action and §1.3 entry in the same change, so the two
documents never disagree.

## References

- Filed issues: [parkingdata/spec #33–#35, #37–#47](https://github.com/parkingdata/spec/issues?q=is%3Aissue+author%3Arneubauer)
- Full errata reports with snippets and fixes: [docs/errata](errata/README.md)
- How APX treats each today: [APX Part 1 §1.3](standard/01-normative-references.md)
- APX release under review: [v0.13.0](https://github.com/rneubauer/apx/releases/tag/v0.13.0)
- The testing that found them: [vetting suite by module](scenarios/by-module/README.md)
- Contact: rneubauer@umojo.com
