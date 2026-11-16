**Suggested title:** Data Dictionary vs API: `RefillPoint.status` and `RefillPointStatusEnum` are missing from the API document

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary defines the attribute `RefillPoint.status` (0..1),
typed `RefillPointStatusEnum`, and lists it among the changes from 4.0
to 4.1 ("Bug correction - Attribute "status" added to the class
"RefillPoint""). The API document's `RefillPoint` schema has no
`status`, and `RefillPointStatusEnum` is not declared.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.53, Table A.179 (`RefillPointStatusEnum`, 13 values from
  `available` to `unknown`), and the `RefillPoint` attribute table.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.RefillPoint`, line 5256: no `status`.

## Why it matters

A charging or refuelling operator cannot say through the API whether a
refill point is available, occupied or out of order, although the Data
Dictionary gives it the words to do so.

## Suggested fix

Declare `RefillPointStatusEnum` with the Data Dictionary values, and add
an optional `status` to `RefillPoint` that references it.

## APX workaround

APX code list `apx-device-states` follows the same style and shares four
of its values. APX's energy extensions reuse `RefillPointStatusEnum` as
the Data Dictionary defines it.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
