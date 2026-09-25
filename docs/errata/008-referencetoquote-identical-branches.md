**Suggested title:** `ReferenceToQuote` is a `oneOf` of two identical branches, so booking from a quote never validates

---

## Summary

`ReferenceToQuote` is `oneOf [ReferenceQuoteExtension, ReferenceQuoteNew]`.
The two branches have the same properties (`quoteResponseId`,
`optionId`) and no `required` members, so every instance matches both,
and `oneOf` fails whenever more than one branch matches.

## Where

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`),
`components.schemas`: `ReferenceQuoteNew` (lines 7965–7975),
`ReferenceQuoteExtension` (7977–7987), `ReferenceToQuote` (7989–7996):

```yaml
ReferenceQuoteNew:
  type: object
  properties:
    quoteResponseId: { $ref: '#/components/schemas/VersionedReference' }
    optionId:        { $ref: '#/components/schemas/VersionedReference' }
ReferenceQuoteExtension:
  type: object
  properties:
    quoteResponseId: { $ref: '#/components/schemas/VersionedReference' }
    optionId:        { $ref: '#/components/schemas/VersionedReference' }
ReferenceToQuote:
  oneOf:
    - $ref: '#/components/schemas/ReferenceQuoteExtension'
    - $ref: '#/components/schemas/ReferenceQuoteNew'
```

It is used by `POST /rights/assigned` as
`oneOf [AssignedRight, ReferenceToQuote]`.

## Why it is a defect

No instance can satisfy `ReferenceToQuote`. A full `AssignedRight` body
passes the outer `oneOf` only by accident: the inner `oneOf` fails, which
leaves exactly one outer branch matching. The documented flow "book the
option you were quoted" therefore has no valid request.

## Impact

High for reservations: booking by quote reference, the flow the quote
model exists to support, cannot be expressed. Fixing the inner schema
naively (making it satisfiable without required members) would break
the other branch too, because then every `AssignedRight` body would also
match `ReferenceToQuote`.

## Suggested fix

Make the branches distinguishable and non-empty, for example:

```yaml
ReferenceQuoteNew:
  type: object
  properties: { quoteResponseId: …, optionId: … }
  required: [quoteResponseId, optionId]
ReferenceQuoteExtension:
  type: object
  properties: { quoteResponseId: …, optionId: …, sessionId: { $ref: '#/components/schemas/VersionedReference' } }
  required: [quoteResponseId, optionId, sessionId]
```

or collapse them into one schema with a discriminator.

## APX workaround

None: any local relaxation either narrows what clients send today or
makes the outer `oneOf` ambiguous for full `AssignedRight` bodies. APX
reservations book with the full `AssignedRight` shape until APDS fixes
the schema.

---

*Found while building APX, an additive companion standard to APDS 4.1.*
