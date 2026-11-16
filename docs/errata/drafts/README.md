# Draft APDS tickets (not filed)

These are ready-to-file drafts for the items in the minimal request to
APDS that are not yet on `parkingdata/spec`. **None of them has been
filed or sent anywhere.** Each is written in the same form as the filed
reports in [the errata folder](../README.md): a suggested title, a type,
suggested labels from the APDS repository's own set (`bug`, `api`,
`change request`, `Data Dictionary`, `model`, `question`, `pending`), and
a short, polite body citing the APDS 4.1 Data Dictionary table.

The background for each item is in Parts B and C of
[APX Requests to APDS](../../apx-specification/06-apds-requests.md). The
decision to keep the request this small is recorded in
[the design note](../../apx-additional-functions/APX-apds-minimal-ask-2026-11-13.md).

## Corrections: Data Dictionary vs API document (C-015 to C-026)

| # | Draft | Type | Suggested labels |
| --- | --- | --- | --- |
| C-015 | [`RefillPoint.status` and `RefillPointStatusEnum` missing](C-015-refillpoint-status.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-016 | [Ten `EquipmentTypeEnum` values missing](C-016-equipmenttype-dd-values.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-017 | [`PaymentTypeEnum` values differ](C-017-paymenttype-values.md) | bug, with a question | `bug`, `api`, `Data Dictionary`, `question` |
| C-018 | [`RightHolder` has no identity in the API document](C-018-rightholder-identifiable.md) | bug | `bug`, `api`, `Data Dictionary`, `model` |
| C-019 | [`ServiceFacilityTypeEnum` lacks two values](C-019-servicefacilitytype-values.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-020 | [`RateLineTypeEnum` lacks `perUnit`](C-020-ratelinetype-perunit.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-021 | [`ElementDescriptorEnum` lacks `garage`](C-021-elementdescriptor-garage.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-022 | [`CredentialTypeEnum` lacks `other`](C-022-credentialtype-other.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-023 | [`UnitOfMeasureEnum` values differ](C-023-unitofmeasure-values.md) | bug | `bug`, `api`, `Data Dictionary` |
| C-024 | [Accessibility value names differ](C-024-accessibility-values.md) | question | `question`, `api`, `Data Dictionary` |
| C-025 | [Type of `transferableConditions`](C-025-hold.md) | question | **On hold**: not drafted for filing until the intended type is confirmed |
| C-026 | [`PUT /observations/{id}` has no request body](C-026-put-observations-request-body.md) | bug | `bug`, `api` |

## Change request: five `EquipmentTypeEnum` values

| # | Draft | Type | Suggested labels |
| --- | --- | --- | --- |
| CR-001 | [Five lane-equipment values for `EquipmentTypeEnum`](CR-001-equipmenttype-lane-values.md) | change request | `change request`, `model`, `Data Dictionary`, `api` |

## Before filing

- Rick decides whether to file, and in what form: one issue each, one
  combined issue, or through the Data Dictionary process (Open question 1
  in 06).
- C-018 may be better as a comment on the open issue #47.
- Re-check each line number against `parkingdata/spec` at the time of
  filing. All were checked against commit `e10dcfc`, byte-identical to
  the vendored 4.1 document.
- When an item is filed, move its file up to `docs/errata/` with the next
  number, add it to the Status table there, and remove it from this
  index.
