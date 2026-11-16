**Suggested title:** Data Dictionary vs API: `PaymentTypeEnum` has two values in the API document and five in the Data Dictionary

---

*Type: bug (omission), with a small question.*

*Suggested labels: `bug`, `api`, `Data Dictionary`, `question`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `PaymentTypeEnum` has `base`, `refund`,
`surcharge`, `validation` and `Vat`. The API document has `payment` and
`validation`. The API document's `payment` and the Data Dictionary's
`base` carry the same definition ("Indicates financial payment made"),
so they may be two names for one value.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.46, Table A.172.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.PaymentTypeEnum`, line 5837.

## Why it matters

Payment lines cannot tell a refund, a surcharge or a tax from the base
payment. The API document's own `PaymentLine` description already
mentions "base fee, taxes, surcharges".

## Suggested fix

Add `base`, `refund`, `surcharge` and `Vat` to the API document. Could
the group also say whether `payment` and `base` are the same value, and
which name should stay? We do not ask for either to be removed.

## APX workaround

APX keeps a `PaymentRecord` beside `Payment`, and uses the code list
`apx-payment-line-codes` for `PaymentLine.idCode`.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
