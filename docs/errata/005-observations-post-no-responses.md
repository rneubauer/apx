**Suggested title:** `POST /observations` declares no responses

---

*Type: omission.*

## Summary

The ingest operation for observations has a request body and no
`responses` member at all. As far as we can tell it is the only APDS 4.1
operation without one, so it looks like an oversight.

## Where

`apds-api-4.1.yaml`, `paths./observations.post`, lines 380–422 (at
`e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`). The operation ends after
`requestBody.content.application/json.examples` with no `responses` key.

## Why it matters

OpenAPI 3.0 and 3.1 both make `responses` REQUIRED on an operation
object, and most tools tolerate its absence. More practically, a
camera or PARCS vendor cannot tell whether a successful ingest answers
200, 201, or 202, or whether the body is a `ResponseStatus`, the stored
observation, or nothing, and a generated client or gateway has no
success response to accept.

## Impact

Every LPR, RFID, and sensor integration posts to this route. Without a declared response, implementers may each
pick a different status and body.

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

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
