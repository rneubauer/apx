**Suggested title:** Typo in `POST /observations` discriminator mapping: `ObvservationSet`

---

## Summary

The discriminator mapping on the `POST /observations` request body spells
the second key `ObvservationSet`, with an extra `v`. The value clients
actually send, and the only other member of `ObservationDataType`, is
`ObservationSet`, so the mapping has no entry for it.

## Where

`apds-api-4.1.yaml`, `paths./observations.post`, line 404 (at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`).

```yaml
- oneOf:
    - $ref: '#/components/schemas/ObservationElement'
    - $ref: '#/components/schemas/ObservationSet'
  discriminator:
    propertyName: type
    mapping:
      ObservationElement: '#/components/schemas/ObservationElement'
      ObvservationSet: '#/components/schemas/ObservationSet'   # <-- extra "v"
```

For comparison, `components.schemas.ObservationDataType` (line 7604) is the
enum the `type` property draws from:

```yaml
ObservationDataType:
  description: used as discriminator between a single observation element and an observation set
  type: string
  enum:
    - ObservationElement
    - ObservationSet
```

## Why it is a defect

A client sending the legal value `type: ObservationSet` finds no matching
key in the mapping. Tolerant tooling falls back to the implicit rule and
resolves a schema whose name equals the property value, which happens to be
correct here, so the mistake is invisible with many libraries. Strict
tooling treats an unmapped discriminator value as a failure to resolve the
subschema.

Either way the document says something it does not mean, and the mapping key
as written can never be sent by a conforming client.

## Impact

The lowest severity of the three and the cheapest to fix. Its real cost is
confusion: a reader comparing the mapping against the enum has to work out
which spelling is authoritative, and a code generator keying off the mapping
may emit a type name nobody can produce.

## Suggested fix

One character:

```diff
       mapping:
         ObservationElement: '#/components/schemas/ObservationElement'
-        ObvservationSet: '#/components/schemas/ObservationSet'
+        ObservationSet: '#/components/schemas/ObservationSet'
```

## Note

We are not working around this one, because the tooling we use resolves the
subschema by name regardless. We report it because it is unambiguous and
trivially fixable, and because a generator that behaved differently would be
hard for its user to debug.

---

*Found while building APX, an additive companion standard to APDS 4.1.*
