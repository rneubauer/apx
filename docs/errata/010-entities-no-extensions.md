**Suggested title:** Suggestion: declare the `extensions` container (Use Case §C.2.5) in the OpenAPI

---

*Type: suggestion — this may well be intentional.*

## Summary

The APDS Use Case Document (§C.2.5) defines an `extensions` container as
the official extension mechanism, with keys of the form
`apds-ext:<namespace>:<class>@<major>.<minor>`. No schema in the OpenAPI
document declares it: the string `extensions` does not occur in
`apds-api-4.1.yaml`.

## Where

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), every
entity schema — in particular those carried by `EventData` and the
native routes: `HierarchyElement`, `Session`, `RateTable`,
`RightSpecification`, `AssignedRight` (line 6738), `ContactPoint`,
`ObservationElement`, `ObservationSet`.

## Why it matters

This may be deliberate — the open `additionalProperties` already lets
the container through. Declaring it would add a little on top: the key pattern would be checked
(a malformed key such as `apds-ext:Vendor:Loyalty@1` would be caught),
generated models would keep the container, and readers would have a
declared place to look for it.

## Impact

Every extension profile built on APDS — APX's `ratepolicy`,
`reservation`, and `lpr-read` decorations among them — would be able
to test "preserve unknown extension keys on round-trip" against the
schema.

## Suggested fix

Declare the container once and reference it from `VersionedIdentity` (so
every versioned entity inherits it), or from each entity:

```yaml
Extensions:
  type: object
  propertyNames:
    pattern: '^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\.[0-9]+$'
  additionalProperties:
    type: object
VersionedIdentity:
  properties:
    …
    extensions:
      $ref: '#/components/schemas/Extensions'
```

## APX workaround

The APX data overlay declares `extensions` (APX's `Extensions` schema,
which is exactly the above) on the eight entity schemas listed, in the
bundled document.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
