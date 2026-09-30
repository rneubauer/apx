# APDS 4.1 errata found while building APX

Fourteen issues in the published APDS 4.1 OpenAPI document, found by
building a companion standard on top of it and validating every example —
and, since 2026-09-25, every request and response of a private scenario
suite covering each conformance class — in CI.
Eleven are schema errors, omissions, or gaps; 010, 012, and the
`GET /quotes` half of 007 are consistency suggestions that may well be
intentional, and are filed as such; 014 is a question about the model.
Each report says which kind it is.

They are **in APDS, not in APX**. The APX repository vendors
`apds-api-4.1.yaml` byte-identical and checksum-guarded (Part 0 §0.2,
Part 1 §1.1), so none of them originates here, and none can be fixed here:
the prime directive forbids editing the vendored file. Each is worked
around in APX's own tooling or in the data overlay
(`spec/openapi/overlays/apx-data-overlay.yaml`) instead, narrowly, with a
comment pointing at the erratum.

The one-page summary for the APDS working group, with optional additions
and a suggested order, is [Requested APDS changes](../apds-change-requests.md).

## Status

| # | Issue | Filed upstream |
|---|---|---|
| [001](001-reference-schema-unsatisfiable.md) | `Reference` is unsatisfiable: two required properties, at most one permitted | [#33](https://github.com/parkingdata/spec/issues/33), open |
| [002](002-observations-example-invalid.md) | `POST /observations` `single-element` example matches neither branch of its own `oneOf` | [#34](https://github.com/parkingdata/spec/issues/34), open |
| [003](003-observation-discriminator-typo.md) | Discriminator mapping key misspelled `ObvservationSet` | [#35](https://github.com/parkingdata/spec/issues/35), open; fix proposed in PR [#36](https://github.com/parkingdata/spec/pull/36) |
| [004](004-ratetable-phantom-required.md) | `RateTable` requires `validityStart` and `activeTimes`, which it never defines | [#37](https://github.com/parkingdata/spec/issues/37), open |
| [005](005-observations-post-no-responses.md) | `POST /observations` declares no responses | [#38](https://github.com/parkingdata/spec/issues/38), open |
| [006](006-observations-discriminator-collision.md) | `POST /observations` wrapper `type` collides with `ObservationElement.type`; no single observation validates | [#39](https://github.com/parkingdata/spec/issues/39), open |
| [007](007-quotes-post-no-request-body.md) | `POST /quotes` declares no request body; `GET /quotes` returns one object | [#40](https://github.com/parkingdata/spec/issues/40), open |
| [008](008-referencetoquote-identical-branches.md) | `ReferenceToQuote` is a `oneOf` of two identical branches | [#41](https://github.com/parkingdata/spec/issues/41), open |
| [009](009-identifiers-ratetableid-spelling.md) | `Identifiers` requires `rateTableId` but declares `rateTableID` | [#42](https://github.com/parkingdata/spec/issues/42), open |
| [010](010-entities-no-extensions.md) | No entity schema declares the `extensions` container of Use Case §C.2.5 | [#43](https://github.com/parkingdata/spec/issues/43), open |
| [011](011-geojsonobject-no-coordinates.md) | `GeoJsonObject` declares no `coordinates` | [#44](https://github.com/parkingdata/spec/issues/44), open |
| [012](012-native-response-code-irregularities.md) | Response codes on `/rates`, `/rights/assigned/{id}`, `/contacts` differ from their siblings | [#45](https://github.com/parkingdata/spec/issues/45), open |
| [013](013-hierarchyelement-subtypes-unmapped.md) | `HierarchyElement` discriminator maps only three of ten types; `VehicularAccess` unreachable | [#46](https://github.com/parkingdata/spec/issues/46), open |
| [014](014-rightholder-not-identifiable.md) | Question: no identifiable `RightHolder`; `AssignedRightHolder` has no id | [#47](https://github.com/parkingdata/spec/issues/47), open |

001–003 were filed on 2026-09-23; 004–012 were found on 2026-09-25 and
filed on 2026-09-28 as #37–#45. 013 was found on 2026-09-28 while
re-vetting LPR for 0.12.0 and filed the same day as #46. 014 was found on
2026-09-29 by a mechanical audit of class names in the APX prose, and
checked against the APDS Information Model 4.0 as well as the OpenAPI
document; filed on 2026-09-29 as #47. Update this table as they are triaged.
Remove an entry only once a corrected APDS release is vendored, because the
workaround in our tooling has to come out at the same moment.

**Verified against upstream.** 001–003 on 2026-09-23; all twelve again on
2026-09-26, each claim checked against the vendored schema with `allOf`
and `$ref` resolved, and every cited line number confirmed. On both dates
`parkingdata/spec` at `master` was byte-identical to the vendored copy,
commit `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b` (2026-03-03), so all
twelve are live in the currently published document.

**Upstream activity.** A third party opened pull request
[#36](https://github.com/parkingdata/spec/pull/36) on 2026-09-23 with the
one-character fix for 003
([#35](https://github.com/parkingdata/spec/issues/35)); it is open. 004 is
the same kind of leftover as the older issue
[#32](https://github.com/parkingdata/spec/issues/32), where a maintainer
confirmed that rate-usage fields are remnants of an earlier APDS version;
004 cites it.

## The reports

Each file is the issue body as filed, with the suggested title at the top.
One issue per report, because they are independent: 003 is a one-character
fix that should not wait behind a discussion of 001. 005, 006, and 003
all touch `POST /observations` and can be fixed in one upstream change, but
are filed separately so each can be closed on its own.

Filing them was a courtesy to the Alliance, not a precondition for anything
in APX. Keep these files in step with the upstream discussion, so the
reasoning stays in the package even if an issue is later closed.

## Why they ship with the submission

The APX cover letter offers these as evidence that the erratum discipline
works: a companion standard that validates every payload in CI finds
issues in its base that prose review does not. They travel with the
submission so the working group can read exactly what was filed rather
than take the claim on trust.
