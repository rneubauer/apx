# APDS 4.1 errata found while building APX

Three defects in the published APDS 4.1 OpenAPI document, found by building
a companion standard on top of it and validating every example in CI.

They are **defects in APDS, not in APX**. The APX repository vendors
`apds-api-4.1.yaml` byte-identical and checksum-guarded (Part 0 §0.2,
Part 1 §1.1), so none of them originates here, and none can be fixed here:
the prime directive forbids editing the vendored file. Each is worked
around in APX's own tooling instead, narrowly, with a comment pointing at
the erratum.

## Status

| # | Defect | Filed upstream |
|---|---|---|
| [001](001-reference-schema-unsatisfiable.md) | `Reference` is unsatisfiable: two required properties, at most one permitted | [#33](https://github.com/parkingdata/spec/issues/33), open |
| [002](002-observations-example-invalid.md) | `POST /observations` `single-element` example matches neither branch of its own `oneOf` | [#34](https://github.com/parkingdata/spec/issues/34), open |
| [003](003-observation-discriminator-typo.md) | Discriminator mapping key misspelled `ObvservationSet` | [#35](https://github.com/parkingdata/spec/issues/35), open |

All three were filed on 2026-09-23. Update this table as they are triaged.
Remove an entry only once a corrected APDS release is vendored, because the
workaround in our tooling has to come out at the same moment.

**Verified against upstream on 2026-09-23.** `parkingdata/spec` at `master`
was byte-identical to the vendored copy, commit
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b` (2026-03-03), so all three are
live in the currently published document.

## The reports

Each file is the issue body as filed, with the suggested title at the top.
One issue per defect, because they are independent: 003 is a one-character
fix that should not wait behind a discussion of 001.

Filing them was a courtesy to the Alliance, not a precondition for anything
in APX. Keep these files in step with the upstream discussion, so the
reasoning stays in the package even if an issue is later closed.

## Why they ship with the submission

The APX cover letter offers these as evidence that the erratum discipline
works: a companion standard that validates every payload in CI finds
defects in its base that prose review does not. They travel with the
submission so the working group can read exactly what will be filed rather
than take the claim on trust.
