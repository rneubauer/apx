**Suggested title:** `POST /observations` `single-element` example matches neither branch of its own `oneOf`

---

## Summary

The `single-element` request example embedded in `POST /observations` omits
the `id` and `version` that `ObservationElement` requires, and it does not
satisfy `ObservationSet` either. The request body is a `oneOf` over those
two schemas, so the example validates against neither branch of the schema
it illustrates.

## Where

`apds-api-4.1.yaml`, `paths./observations.post`, example at line 408 (at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`).

```yaml
examples:
  single-element:
    value:
      type: ObservationElement
      method: visual
      observer: Officer Peterson
      observationStartTime: 2026-01-01T10:02:00Z
      creationDateTime: 2026-01-01T10:04:00Z
      observedCredentialId: BD51 SMR
      location:
        observerLocation:
          type: Point
          coordinates: [-2.3058626, 53.4723193]
      observerOrganisation:
        id: SAMPLECITY
        version: 1
```

## Why it is a defect

`ObservationElement` is `allOf: [VersionedIdentity, {...}]`, and
`VersionedIdentity` requires `id` and `version`. The example supplies
neither, so the element branch fails.

The other branch, `ObservationSet`, also composes `VersionedIdentity` and
additionally requires `creator`, which the example does not have. The
`oneOf` therefore matches zero branches rather than exactly one.

## Impact

Low severity, high friction: this is the first example a reader copies when
implementing observation ingest. Anyone who pastes it into a request against
a validating server gets a rejection and reasonably concludes their own
setup is at fault.

It also trips linting. A ruleset that validates embedded examples against
their schemas reports the operation as defective, which forces every
downstream consumer to carry an exemption.

## Reproduce

Validate the example value against the `POST /observations` request body
schema with any 2020-12 validator. It fails both branches: missing `id` and
`version` for `ObservationElement`, and additionally missing `creator` for
`ObservationSet`.

## Suggested fix

Two readings, and the right fix depends on which you intend.

**If clients supply the identity on create**, the example is simply
incomplete and wants two more lines:

```diff
   single-element:
     value:
       type: ObservationElement
+      id: 7b1f0f4e-9a1e-4b3a-9f0e-2c5d6b7a8c90
+      version: 1
       method: visual
```

**If the server assigns the identity on create**, which is the more common
REST convention and which the `id` path parameter on
`GET /observations/{id}` hints at, then the example is right and the
*request schema* is wrong: a create body should not require a
server-assigned `id` and `version`. That would call for a create-shaped
request schema rather than reusing the full resource.

We do not know which you intend, and the distinction matters to
implementers, so we have not assumed one. Clarifying it would be worth more
than the example fix on its own.

## How we work around it

We vendor `apds-api-4.1.yaml` byte-identical and never edit it, so we scope
a single lint exemption to this one operation, with a comment pointing here.
Our own examples and every payload in our scenario suite are validated
normally, so no coverage is lost.

---

*Found while building APX, an additive companion standard to APDS 4.1.*
