**Suggested title:** Data Dictionary vs API: `RightHolder` is a versioned identifiable class in the Data Dictionary but has no identity in the API document

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`, `model`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary defines `RightHolder` as a class with stereotype
`D2VersionedIdentifiable`, with `holderCredential` and `assignedRight`
associations. The API document has only `AssignedRightHolder`, embedded
in each `AssignedRight`, with no `id`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), Right package, class table and associations for `RightHolder`.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.AssignedRightHolder`, line 6806.

## Why it matters

Two rights issued to the same holder cannot say so, and nothing can
reference a holder. This is the Data Dictionary side of the question
already raised in parkingdata/spec#47.

## Suggested fix

Add `RightHolder` to the API document as a versioned identifiable class,
as the Data Dictionary defines it, or at least an optional `id` on
`AssignedRightHolder`.

## APX workaround

APX sends `className: "RightHolder"` with a local id.

## Note for the filer

Because #47 is still open, this may be better posted as a comment on #47
than as a new issue. That is the filer's choice.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
