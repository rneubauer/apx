**Suggested title:** `HierarchyElement` discriminator maps only three of its ten types, so `VehicularAccess` and six others cannot be reached

---

*Type: schema gap — the commented-out entries may be deliberate work in progress.*

## Summary

`HierarchyElementTypeEnum` lists ten types, and seven of them —
`identifiedArea`, `subplaceElement`, `specificArea`, `vehicularAccess`,
`electricChargingEquipment`, `supplementalEquipment`,
`supplementalServiceFacility` — are described in the document. But the
`HierarchyElement` discriminator maps only `campus`, `place`, and
`space`; the other seven entries are commented out. So a place-hierarchy
payload with `type: vehicularAccess` is read as a bare
`HierarchyElement`, and the fields that make it a lane (`accessType`,
`accessLaneSpecifics`, …) are never checked. We may well be missing the
reason these were left out; we raise it in case it is not intentional.

## Where

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

- `components.schemas.HierarchyElementTypeEnum`, lines 3496–3522 — the
  ten values.
- `components.schemas.HierarchyElement`, lines 3799–3818 — the
  discriminator:

```yaml
discriminator:
  propertyName: type
  mapping:
    campus: '#/components/schemas/Campus'
    place: '#/components/schemas/Place'
    space: '#/components/schemas/Space'
    #subplaceElement: '#/components/schemas/SubPlace'
    #identifiedArea: '#/components/schemas/IdentifiedArea'
    #specificArea: '#/components/schemas/SpecificArea'
    #vehicularAccess: '#/components/schemas/VehicularAccess'
    #electricChargingEquipment: '#/components/schemas/ElectricChargingEquipment'
    #supplementalEquipment: '#/components/schemas/SupplementalEquipment'
    #supplementalServiceFacility: '#/components/schemas/SupplementalServiceFacility'
```

- `components.schemas.VehicularAccess`, line 4215 — defined, with
  `accessType` required, but referenced from nowhere, so bundlers drop
  it.

## Why it matters

Lanes are how LPR, gates, and lane-level control are modelled on APDS,
and `VehicularAccess` is the type for them. With no mapping, generated
clients have no `VehicularAccess` class to deserialize into, and a
validator accepts a lane with, say, `accessType: "sideways"`. The same
holds for the other unmapped types.

## Impact

Moderate for anyone configuring lanes or equipment through the place
routes; none for `campus`, `place`, or `space`, which work as intended.

## Suggested fix

Restore the seven mapping entries; every one of their schemas is already
defined in the document:

```diff
       mapping:
         campus: '#/components/schemas/Campus'
         place: '#/components/schemas/Place'
         space: '#/components/schemas/Space'
-        #identifiedArea: '#/components/schemas/IdentifiedArea'
-        #specificArea: '#/components/schemas/SpecificArea'
-        #vehicularAccess: '#/components/schemas/VehicularAccess'
+        identifiedArea: '#/components/schemas/IdentifiedArea'
+        specificArea: '#/components/schemas/SpecificArea'
+        vehicularAccess: '#/components/schemas/VehicularAccess'
         …
```

A discriminator on a base schema without a
`oneOf` is advisory in JSON Schema, so for validators to act on it the
place routes' request bodies would also need a `oneOf` over the
subtypes.

## APX workaround

APX validates its own lane decoration, `apds-ext:apx:lane-cameras@1.0`,
wherever it appears (Part 4 §4.3), so camera configuration is checked.
The APDS lane fields themselves are carried as sent until APDS maps the
type.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
