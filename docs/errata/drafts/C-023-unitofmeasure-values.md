**Suggested title:** Data Dictionary vs API: `UnitOfMeasureEnum` lacks `kilogrammes` and `pounds`, and spells `gpm` where the Data Dictionary has `gpmi`

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `UnitOfMeasureEnum` includes `kilogrammes`,
`pounds` and `gpmi`. The API document has no `kilogrammes` or `pounds`,
and has `gpm` where the Data Dictionary has `gpmi`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.70, Table A.194.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.UnitOfMeasureEnum`, line 6305.

## Why it matters

Vehicle weights cannot be given in the units the Data Dictionary names,
and a client cannot tell whether `gpm` and `gpmi` are the same unit.

## Suggested fix

Add `kilogrammes` and `pounds`, and align `gpm` and `gpmi` to whichever
spelling the group prefers.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
