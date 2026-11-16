**Suggested title:** Question: accessibility value names differ between the Data Dictionary and the API document

---

*Type: question.*

*Suggested labels: `question`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's accessibility enumeration (`AccessibilityEnum`)
has `accessForPersonsWithDisabilities` and `disabledMarked`. The API
document's `AccessibilityTypeEnum` has `disabledAccessible` and
`disabledMarkedThere` instead. The Data Dictionary's own definition of
`barrierFreeAccessible` still mentions `disabledAccessible`, so the
intended names may simply need confirming.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.2 (`AccessibilityEnum`).
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.AccessibilityTypeEnum`, line 4248.

## Why it matters

Two implementations reading the two documents would use different words
for the same accessibility feature.

## Suggested fix

Could the group confirm which names are intended, and align the other
document? We do not mind which way.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
