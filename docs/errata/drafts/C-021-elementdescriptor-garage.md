**Suggested title:** Data Dictionary vs API: `ElementDescriptorEnum` lacks `garage`

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `ElementDescriptorEnum` includes `garage`. The API
document has only `floorOrLevel`, `row` and `street`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.20, Table A.146.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.ElementDescriptorEnum`, line 3482.

## Why it matters

A small alignment, so that a hierarchy element can be described as a
garage with the Data Dictionary's name.

## Suggested fix

Add `garage` to the API document.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
