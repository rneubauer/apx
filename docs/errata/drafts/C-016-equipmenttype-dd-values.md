**Suggested title:** Data Dictionary vs API: ten `EquipmentTypeEnum` values are missing from the API document

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`, `Data Dictionary`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

The Data Dictionary's `EquipmentTypeEnum` includes `lprCamera`,
`securityCamera`, `occupancySensor`, `occupancyObjectSensingCamera`,
`door`, `doorWithAccessCredential`, `doorWithSecurityReview`,
`emergencyExitDoor`, `cargoShippingDoor` and `dropOffLocation`. None of
the ten appears in the API document's `EquipmentTypeEnum`.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.23, Table A.149.
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `components.schemas.EquipmentTypeEnum`, line 5044.

## Why it matters

A site cannot type its cameras, sensors or doors with the names APDS has
already agreed, so they are sent as `other` or not typed at all.

## Suggested fix

Add the ten values to the API document's `EquipmentTypeEnum`.

## APX workaround

Device references point at `SupplementalEquipment` without an equipment
type.

## Note for the filer

This pairs well with the separate change request for five lane-equipment
values ([CR-001](CR-001-equipmenttype-lane-values.md)), but the two are
independent. This one only aligns the API document with the Data
Dictionary.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
