**Suggested title:** Data Dictionary vs API: `CredentialTypeEnum` lacks `other`

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `CredentialTypeEnum` includes `other`. The API
document's `CredentialTypeEnum` has no `other`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.17, Table A.143.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.CredentialTypeEnum`, line 5301.

## Why it matters

Without `other`, a credential of a kind not yet listed cannot be sent at
all, although the Data Dictionary allows it.

## Suggested fix

Add `other` to the API document.

## APX workaround

None needed.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
