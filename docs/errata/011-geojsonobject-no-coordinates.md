**Suggested title:** `GeoJsonObject` declares no `coordinates`

---

*Type: small gap.*

## Summary

`GeoJsonObject` declares only `type` and `bbox`. The member that carries
the geometry, `coordinates` (RFC 7946 §3.1), is not declared, so a
`Point` with no position — or with `[lat, lon]` swapped — still validates.
This may be a deliberate simplification; we raise it in case it is not.

## Where

`apds-api-4.1.yaml`, `components.schemas.GeoJsonObject`, lines 2872–2910
(at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`). The description states
the WGS 84 longitude/latitude convention; the properties are `type` (the
nine GeoJSON type names) and `bbox`.

## Why it matters

Every geometry object in RFC 7946 except `GeometryCollection` has a
REQUIRED `coordinates` member; the schema does not declare it, so
validators cannot check that a location exists, let alone its order
or range.

## Impact

Low per payload, but it touches every located entity — observations,
place geometry, contact point locations — and the WGS 84
longitude-first rule the description states cannot be checked by a validator.

## Suggested fix

Declare the member, and preferably a `GeoJsonPoint` for the many places
that only ever carry a point:

```yaml
GeoJsonObject:
  properties:
    type: …
    bbox: …
    coordinates:
      type: array
GeoJsonPoint:
  allOf:
    - $ref: '#/components/schemas/GeoJsonObject'
    - properties:
        type: { const: Point }
        coordinates:
          type: array
          minItems: 2
          maxItems: 3
          prefixItems:
            - { type: number, minimum: -180, maximum: 180 }
            - { type: number, minimum: -90, maximum: 90 }
      required: [coordinates]
```

## APX workaround

The APX data overlay declares an optional `coordinates` array on the
bundled `GeoJsonObject`. APX fields that must be points constrain
themselves locally.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
