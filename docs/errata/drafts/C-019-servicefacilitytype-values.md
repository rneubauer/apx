**Suggested title:** Data Dictionary vs API: `ServiceFacilityTypeEnum` lacks `currencyExchange` and `transportInterchange`

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `ServiceFacilityTypeEnum` includes
`currencyExchange` and `transportInterchange`. The API document's
`ServiceFacilityTypeEnum` has neither.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.59, Table A.185.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.ServiceFacilityTypeEnum`, line 3540.

## Why it matters

A small alignment, so that a Place can describe these facilities with
the Data Dictionary's names.

## Suggested fix

Add the two values to the API document.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
