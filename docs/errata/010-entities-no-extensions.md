**Suggested title:** No APDS 4.1 entity schema declares the `extensions` container of Use Case §C.2.5

---

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

## Why it is a defect

The extensions mechanism is normative in the use-case document and
absent from the machine-readable contract. Payloads carrying it validate
only because the entity schemas leave `additionalProperties` open, so:
the key pattern is never checked (a malformed key such as
`apds-ext:Vendor:Loyalty@1` passes), generated models drop the container
on the floor, and a reader has no declared place to look for it.

## Impact

Every extension profile built on APDS — APX's `ratepolicy`,
`reservation`, and `lpr-read` decorations among them — rides on an
undeclared property, and "preserve unknown extension keys on
round-trip" cannot be tested against the schema.

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

*Found while building APX, an additive companion standard to APDS 4.1.*
