**Suggested title:** `RateTable` requires `validityStart` and `activeTimes`, which it never defines

---

*Type: schema error.*

## Summary

`RateTable` lists two members in `required` that are not properties of
`RateTable` or of anything it inherits. JSON Schema still demands the
keys, so a rate table — including the ones in the APDS examples —
does not validate against the schema as written.

## Where

`apds-api-4.1.yaml`, `components.schemas.RateTable`, lines 5702–5744 (at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`).

```yaml
RateTable:
  allOf:
    - $ref: '#/components/schemas/VersionedIdentity'
    - type: object
      properties:
        rateTableName: …
        rateTableID: …
        availability: …
        validity:
          $ref: '#/components/schemas/Validity'
        rateLineCollections: …
      required:
        - rateTableName
        - availability
        - validityStart     # <-- not a property
        - activeTimes       # <-- not a property
        - rateLineCollections
```

## Why it matters

`required` names keys the instance must have; it does not care whether
`properties` describes them. A client that sends a correct rate table —
validity window in `validity.validityTimeSpecification`, active times in
each `RateLineCollection` — fails validation, and one that adds two
undocumented keys to pass has no type to give them. The two names look
like members of an earlier draft that moved into `validity` and
`RateLineCollection` without the `required` list following. Issue #32
reports the same kind of leftover in the rate domain, and a maintainer
confirmed there that `RateUsageConditionsTypeEnum` is a remnant of an
earlier version of APDS, from before rate usage moved into
`RightSpecification`.

## Impact

Every `POST /rates`, `PUT /rates/{id}`, and `GET /rates` payload fails
schema validation, so generated clients and validating gateways would
reject the rate deck. Rate mirroring is a common reason for a third party
to read APDS, so it seemed worth raising.

## Suggested fix

```diff
       required:
         - rateTableName
         - availability
-        - validityStart
-        - activeTimes
         - rateLineCollections
```

If the window and active times are meant to be mandatory, require
`validity` (and, inside `RateLineCollection`, its active-times member)
instead.

## APX workaround

The APX data overlay (`spec/openapi/overlays/apx-data-overlay.yaml`)
replaces the list with `[rateTableName, availability,
rateLineCollections]` in the bundled document. Remove the action when a
corrected release is vendored.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
