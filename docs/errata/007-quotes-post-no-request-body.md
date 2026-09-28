**Suggested title:** `POST /quotes` declares no request body (plus a question about `GET /quotes`)

---

*Type: omission, plus a consistency question.*

## Summary

`POST /quotes` ("submit a request for a quote") has no `requestBody`, so
the `QuoteRightRequest` or `QuoteSessionExtensionRequest` a client sends
is undeclared. Separately, and more of a question than a problem: `GET /quotes`
takes list filters but returns a single quote object, unlike the other
APDS list routes. That may be intentional.

## Where

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

- `paths./quotes.post`, lines 1877–1898 — `summary`, `operationId`,
  `tags`, `responses`; no `requestBody`.
- `paths./quotes.get`, lines 1851–1875 — parameters `place_ids`,
  `right_spec_ids`, `quote_type`, `modified_since`, geo filters; the 200
  schema is `oneOf` the four quote schemas (one object).

The `POST` 200 also inlines `PaginatedListMeta` beside `data` rather than
nesting it under `meta` as the other lists do.

## Why it matters

The quote request schemas exist (`QuoteRightRequest`,
`QuoteSessionExtensionRequest`) and nothing references them from a
request. A generated client has no parameter to send them in. On the
`GET`, if a single quote per query is the intent, a sentence saying so
would help; if not, a filter that matches two quotes has no declared way
to return both.

## Impact

Every reservation channel and every session-extension flow starts with
a quote. Having the request body declared would help implementers
agree on it.

## Suggested fix

```yaml
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/QuoteRightRequest'
                - $ref: '#/components/schemas/QuoteSessionExtensionRequest'
```

For the `GET`, if it is meant to be a list, return the standard list envelope (`meta` +
`data[]` of the four quote schemas) in the next major version, since
changing it is not backward compatible.

## APX workaround

The APX data overlay adds that request body to the bundled operation as
**optional** (`required: false`), so no stock client that sends nothing
is refused. Part 5 §5.7 records that `GET /quotes` returns the single
matching quote.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
