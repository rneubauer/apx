**Suggested title:** `PUT /observations/{id}` declares no request body and no 400

---

*Type: bug (omission).*

*Suggested labels: `bug`, `api`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

`PUT /observations/{id}` is described as "update the given Observation",
but it declares no `requestBody`, so a client cannot tell from the
document what to send. It also declares no 400, which every other `PUT`
does. The Data Dictionary gives `ObservationElement` an
`observationElementRecordUpdate` association, so updating an Observation
is clearly intended.

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), Table A.46 (`observationElementRecordUpdate`).
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), `paths./observations/{id}.put`, path at line 425: responses
  200, 404 and 409 only; no `requestBody`.

## Why it matters

It is the same kind of omission as parkingdata/spec#40 (`POST /quotes`).
Generated clients produce an update call that sends nothing.

## Suggested fix

Declare an `ObservationElement` request body and a 400 response, as on
the other `PUT` operations.

## APX workaround

The APX data overlay declares both, leaving the vendored document
untouched.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
