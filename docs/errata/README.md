# APDS 4.1 errata found while building APX

Twelve defects in the published APDS 4.1 OpenAPI document, found by
building a companion standard on top of it and validating every example —
and, since 2026-09-25, every request and response of a private scenario
suite covering each conformance class — in CI.

They are **defects in APDS, not in APX**. The APX repository vendors
`apds-api-4.1.yaml` byte-identical and checksum-guarded (Part 0 §0.2,
Part 1 §1.1), so none of them originates here, and none can be fixed here:
the prime directive forbids editing the vendored file. Each is worked
around in APX's own tooling or in the data overlay
(`spec/openapi/overlays/apx-data-overlay.yaml`) instead, narrowly, with a
comment pointing at the erratum.

## Status

| # | Defect | Filed upstream |
|---|---|---|
| [001](001-reference-schema-unsatisfiable.md) | `Reference` is unsatisfiable: two required properties, at most one permitted | [#33](https://github.com/parkingdata/spec/issues/33), open |
| [002](002-observations-example-invalid.md) | `POST /observations` `single-element` example matches neither branch of its own `oneOf` | [#34](https://github.com/parkingdata/spec/issues/34), open |
| [003](003-observation-discriminator-typo.md) | Discriminator mapping key misspelled `ObvservationSet` | [#35](https://github.com/parkingdata/spec/issues/35), open |
| [004](004-ratetable-phantom-required.md) | `RateTable` requires `validityStart` and `activeTimes`, which it never defines | not yet filed |
| [005](005-observations-post-no-responses.md) | `POST /observations` declares no responses | not yet filed |
| [006](006-observations-discriminator-collision.md) | `POST /observations` wrapper `type` collides with `ObservationElement.type`; no single observation validates | not yet filed |
| [007](007-quotes-post-no-request-body.md) | `POST /quotes` declares no request body; `GET /quotes` returns one object | not yet filed |
| [008](008-referencetoquote-identical-branches.md) | `ReferenceToQuote` is a `oneOf` of two identical branches | not yet filed |
| [009](009-identifiers-ratetableid-spelling.md) | `Identifiers` requires `rateTableId` but declares `rateTableID` | not yet filed |
| [010](010-entities-no-extensions.md) | No entity schema declares the `extensions` container of Use Case §C.2.5 | not yet filed |
| [011](011-geojsonobject-no-coordinates.md) | `GeoJsonObject` declares no `coordinates` | not yet filed |
| [012](012-native-response-code-irregularities.md) | Response codes on `/rates`, `/rights/assigned/{id}`, `/contacts` differ from their siblings | not yet filed |

001–003 were filed on 2026-09-23; 004–012 were found on 2026-09-25 and
are ready to file. Update this table as they are triaged.
Remove an entry only once a corrected APDS release is vendored, because the
workaround in our tooling has to come out at the same moment.

**Verified against upstream on 2026-09-23.** `parkingdata/spec` at `master`
was byte-identical to the vendored copy, commit
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b` (2026-03-03), so all twelve
are live in the currently published document (004–012 cite line numbers
at that commit).

## The reports

Each file is the issue body as filed, with the suggested title at the top.
One issue per defect, because they are independent: 003 is a one-character
fix that should not wait behind a discussion of 001. 005, 006, and 003
all touch `POST /observations` and can be fixed in one upstream change, but
are filed separately so each can be closed on its own.

Filing them was a courtesy to the Alliance, not a precondition for anything
in APX. Keep these files in step with the upstream discussion, so the
reasoning stays in the package even if an issue is later closed.

## Why they ship with the submission

The APX cover letter offers these as evidence that the erratum discipline
works: a companion standard that validates every payload in CI finds
defects in its base that prose review does not. They travel with the
submission so the working group can read exactly what will be filed rather
than take the claim on trust.
