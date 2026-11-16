**Suggested title:** Data Dictionary vs API: `RateLineTypeEnum` lacks `perUnit`

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `RateLineTypeEnum` includes `perUnit`. The API
document has only `flatRate`, `flatRateTier` and `incrementingRate`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.50, Table A.176.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.RateLineTypeEnum`, line 5486.

## Why it matters

A rate line priced per unit, for example per kWh, cannot be typed in the
API document as the Data Dictionary allows.

## Suggested fix

Add `perUnit` to the API document.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
