**Suggested title:** `POST /observations` declares no responses

---

## Summary

The ingest operation for observations has a request body and no
`responses` member at all. It is the only APDS 4.1 operation without
one.

## Where

`apds-api-4.1.yaml`, `paths./observations.post`, lines 380–422 (at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`). The operation ends after
`requestBody.content.application/json.examples` with no `responses` key.

## Why it is a defect

OpenAPI 3.0 and 3.1 both make `responses` REQUIRED on an operation
object, so the document is invalid at this point (tools tolerate it
because the rest of the document is well-formed). More practically, a
camera or PARCS vendor cannot tell whether a successful ingest answers
200, 201, or 202, or whether the body is a `ResponseStatus`, the stored
observation, or nothing, and a generated client or gateway has no
success response to accept.

## Impact

Every LPR, RFID, and sensor integration posts to this route. Each
implementer will pick a status and a body independently, and the choices
will not interoperate.

## Suggested fix

Declare the responses the other native creates declare:

```yaml
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ResponseStatus' }
        '400':
          description: Bad Request
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ResponseStatus' }
        '409':
          description: Conflict
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ResponseStatus' }
```

## APX workaround

The APX data overlay declares exactly these three responses (plus APX's
shared 401/403/429 and a `problem+json` alternative on 400/409) on the
bundled operation.

---

*Found while building APX, an additive companion standard to APDS 4.1.*
