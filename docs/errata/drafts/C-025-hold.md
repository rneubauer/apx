**C-025 (on hold):** Type of `RightSpecification.transferableConditions`

---

*Type: question. Status: on hold, not drafted for filing.*

In the Data Dictionary's `RightSpecification` attribute table,
"Transferable conditions" is defined as a "statement of the conditions
under which a RightSpecification may be transferred", which reads as
`PkCommon.MultilingualString`. The API document types both
`transferable` and `transferableConditions` as boolean (lines 5383 and
5385 of `apds-api-4.1.yaml`).

The columns of that table are misaligned in the Data Dictionary PDF, so
our reading may be wrong. We hold this item until someone can confirm the
intended type from the source model. If it is confirmed, it becomes a
`question` issue with the labels `question`, `api` and `Data Dictionary`,
in the same form as the other drafts here.

APX workaround: none needed.
