**Suggested title:** `POST /observations`: the wrapper's `type` collides with `ObservationElement.type`, so no single observation validates

---

## Summary

The request schema of `POST /observations` constrains `type` twice with
disjoint enums. The wrapper says `type` is `ObservationDataType`
(`ObservationElement | ObservationSet`); the element branch says `type`
is `CredentialTypeEnum` (`licensePlate`, `rfid`, …). Both apply to the
same property, so no value satisfies them, and `type` is required.

## Where

`apds-api-4.1.yaml`, `paths./observations.post.requestBody`, lines
387–406 (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

```yaml
schema:
  allOf:
    - type: object
      properties:
        type:
          $ref: '#/components/schemas/ObservationDataType'   # ObservationElement | ObservationSet
    - oneOf:
        - $ref: '#/components/schemas/ObservationElement'     # its own `type` is CredentialTypeEnum
        - $ref: '#/components/schemas/ObservationSet'
      discriminator:
        propertyName: type
        …
  required:
    - type
```

and `components.schemas.ObservationElement`:

```yaml
type:
  $ref: '#/components/schemas/CredentialTypeEnum'
```

## Why it is a defect

`type: licensePlate` fails the wrapper; `type: ObservationElement` fails
the element; omitting `type` fails `required`. A single element can
therefore never be posted. An `ObservationSet` validates only because the
set has no `type` property of its own, so today the only conformant way to
post one read is to wrap it in a one-element set. The embedded
`single-element` example (erratum 002) fails for this reason as well as
for its missing `id`. The discriminator mapping typo (erratum 003) sits
in the same block.

## Impact

High for LPR and sensor ingest: every single-read post from a camera is
schema-invalid, and a validating server must reject it.

## Suggested fix

Either rename the wrapper discriminator so it no longer shares a name with
the element's credential type:

```diff
     - type: object
       properties:
-        type:
+        observationDataType:
           $ref: '#/components/schemas/ObservationDataType'
     …
       discriminator:
-        propertyName: type
+        propertyName: observationDataType
   required:
-    - type
+    - observationDataType
```

or drop the wrapper and the discriminator and let the `oneOf` stand on
structure — `ObservationSet` requires `creator`, which an element does
not carry, and an element requires `method`, `location`, and
`observerOrganisation`, which a set does not.

## APX workaround

The APX data overlay takes the second option in the bundled document:
the request schema is a plain `oneOf [ObservationElement, ObservationSet]`
and an element's `type` is its `CredentialTypeEnum` value.

---

*Found while building APX, an additive companion standard to APDS 4.1.*
