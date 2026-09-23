**Suggested title:** `Reference` schema is unsatisfiable: requires two properties, permits at most one

---

## Summary

The `Reference` schema declares `maxProperties: 1` while requiring both `id`
and `className`. No JSON object can satisfy both constraints, so under a
strict validator every `Reference` instance in the specification is invalid,
including the ones in the document's own examples.

## Where

`apds-api-4.1.yaml`, `components.schemas.Reference` (line 2687 at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`), with the constraint on line
2695.

```yaml
Reference:
  title: Reference
  description: Represents a reference to an identifiable object where the identifier is unique.
    It is composed of an unique identifier and a string identifying the class of the referenced object.
  type: object
  x-package: common
  minProperties: 1
  maxProperties: 1          # <-- at most one property
  properties:
    id:
      type: string
    className:
      type: string
      minLength: 1
  required:
    - id                     # <-- but both are required
    - className
```

## Why it is a defect

`required: [id, className]` demands at least two properties.
`maxProperties: 1` permits at most one. The intersection is empty, so the
schema describes no possible value.

The schema's own description contradicts the constraint: it says a reference
"is composed of an unique identifier **and** a string identifying the class",
which is two properties.

## Impact

`Reference` is the general cross-object pointer, used throughout the
document. A consumer that validates payloads against the published schemas
rejects every reference, which in practice means rejecting nearly every
non-trivial response.

Most tooling never notices, because generators and mock servers commonly
ignore `minProperties` and `maxProperties`. It surfaces the moment anyone
runs real payloads through a strict JSON Schema validator. We hit it
building a CI job that validates every example in a companion
specification: thirty-five payloads failed for this reason alone, and the
only schemas that passed were primitives, because primitives are the only
ones containing no references.

## Reproduce

Validate this object, the shape every example in the document uses, against
`components.schemas.Reference` with any 2020-12 validator:

```json
{ "id": "98bccb9c-2ffe-4ca4-8e7f-eb1ae4439c29", "className": "Session" }
```

Result: fails with `must NOT have more than 1 property`. Removing either
property then fails `required`.

## Suggested fix

Delete the two constraint lines:

```diff
   type: object
   x-package: common
-  minProperties: 1
-  maxProperties: 1
   properties:
```

`required` already guarantees both properties are present, and
`additionalProperties` is unconstrained, which matches how the rest of the
document treats objects.

A guess at the history: the two lines look like they were meant for a
different shape, perhaps a one-of-several-identifiers wrapper, and were left
behind when this schema settled on a fixed pair.

## How we work around it

We vendor `apds-api-4.1.yaml` byte-identical and never edit it, so our
validators delete the two constraints from an in-memory copy before
validating, with a comment pointing here. We would rather drop the
workaround than keep it.

---

*Found while building APX, an additive companion standard to APDS 4.1. Happy
to open a pull request against the YAML if that is easier than an issue.*
