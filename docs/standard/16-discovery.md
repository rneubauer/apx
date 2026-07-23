# APX Part 16 — Discovery (optional class `apx-discovery`)

Two layers:

## 16.1 Unauthenticated bootstrap (REQUIRED for all implementations)

`GET /.well-known/apx-configuration` (RFC 8615, served at the host root):
token endpoint, APDS version, supported conformance classes, registry
locations. This is how a client with nothing but a hostname gets started.

## 16.2 Credential-scoped capability document (the optional class)

`GET /v1/discovery` (authenticated, any APX scope):

- MUST reflect the presented token exactly — scopes, `apx_org`,
  `apx_places` — and return only what THIS client can use: conformance
  classes, concrete endpoints (APDS-native and APX), permitted command
  types, subscribable topics, granted place subtrees, advisory rate limits.
- Two clients with different grants MUST receive different documents.
- **Soundness rule (normative, conformance-tested):** every endpoint/command
  listed MUST be callable by the client (given valid inputs), and calls to
  APX endpoints NOT listed MUST fail with 403. The document is a promise,
  not advertising.
- The document is computed per-request; it is not cacheable across token
  changes (`Cache-Control: private, max-age=300` RECOMMENDED).
