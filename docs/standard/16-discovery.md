# APX Part 16 — Discovery (optional class `apx-discovery`)

Two layers:

## 16.1 Unauthenticated bootstrap (REQUIRED for all implementations)

`GET /.well-known/apx-configuration` (RFC 8615, served at the host root):
token endpoint, APDS version, supported conformance classes, registry
locations. This is how a client with nothing but a hostname gets started.

- **Where the API lives.** `apiBase` is the URL every path in the bundle is
  relative to, APX and APDS-native routes alike. It is REQUIRED when the API
  is not mounted at the origin root that serves this document (an
  aggregator under `/parking`, a separate API host); absent means that
  origin root.
- **Classes.** `conformanceClasses` MUST list exactly the classes the ICS
  claims (Annex A.20), MUST be closed under the Part 3 §3.1 dependency
  table, and MUST contain only `apx-conformance-classes` registry values or
  vendor classes named per Part 3 §3.1. A client that finds a class claimed
  without a class it requires MUST treat the dependent class as not
  offered, and MUST ignore classes it does not recognise.
- **Features.** `features` lists the optional features the implementation
  offers (Part 6 §6.5: `negotiatedRates`, `ticketMatching`). An offered
  feature MUST be listed; an unlisted one is not offered.
- **Registries and edition.** `registries` is keyed by the registry `name`
  from Part 11 (vendor lists by their own name). `registryVersions`, keyed
  the same way, gives the version of each list the implementation validates
  against (Part 11 §11.2). `apxVersion` is the edition implemented (Part 3
  §3.4); when `edition` is also present the two are equal.
- The document carries an optional `extensions` container (Part 4 §4.3),
  as does the discovery document.

## 16.2 Credential-scoped capability document (the optional class)

`GET /v1/discovery` (authenticated, any APX scope; a token with none is
`403 insufficient-scope`):

- MUST reflect the presented token exactly — scopes, `apx_org`,
  `apx_places` — and return only what THIS client can use: conformance
  classes, endpoints (APDS-native and APX), permitted command types,
  offered features, subscribable topics, granted place subtrees, advisory
  rate limits. A token with no `apx_places` claim is reflected as
  `places: []`, never by omitting the member.
- `conformanceClasses` MUST be a subset of the bootstrap document's.
- Two clients with different grants MUST receive different documents.
- **Soundness rule (normative, conformance-tested):** every endpoint and
  command listed MUST be callable by the client for at least one target
  inside its granted places (given valid inputs), so a client whose
  `places` is empty sees no place-targeting endpoint. What an unlisted
  call receives follows Part 9 §9.3a: an endpoint the server implements
  but the token's scopes do not cover is `403 insufficient-scope`; a
  listed endpoint called with a target outside the grant is
  `403 insufficient-grant`; an endpoint of a class the server does not
  claim is `404 target-not-found`. The document is a promise, not
  advertising.
- **Forms.** `endpoints[].path` is the OpenAPI path template exactly as it
  appears in the bundle (`/v1/commands/{id}`), relative to `apiBase`;
  `methods` are upper-case HTTP method names. `topics` lists APX registry
  topics, APDS `EventTypeEnum` values (Part 8), and vendor topics the
  credential may subscribe to. `commandTypes` is the permission list and
  `features` the capability list; a feature is listed for any client
  holding a scope of its class, so a read-only client can see it.
- **Vendor extensions.** Vendor endpoints (`/apx/x/<vendor-ns>/…`), topics
  (`<vendor-ns>.…`), and conformance classes (Part 3 §3.1, §3.3) appear in
  the document under the same soundness rule as APX ones.
- **Rate limits.** `rateLimits` keys are `requestsPerMinute`,
  `commandsPerMinute`, `burst` (most requests in any one second),
  `subscriptionsMax`, and `streamConnectionsMax`; every value is a
  per-credential integer, and other keys are advisory vendor additions. A
  `429 rate-limited` `detail` SHOULD name the key that was exceeded.
- **Lifetime.** The document is computed per request and is valid for the
  lifetime of the token it was computed for. A change to a client's scopes
  or grant MUST take effect through a new token (the old one revoked or
  left to expire), so a client's next discovery with its new token is
  current. `Cache-Control: private` is RECOMMENDED, with a `max-age` no
  longer than the token's remaining lifetime. A client that receives 403 on
  a listed endpoint SHOULD refetch discovery before retrying.

## 16.3 Mutual TLS (`apx-mtls`) and the bootstrap document (normative)

An implementation claiming `apx-mtls` requires TLS 1.2 or later (1.3
RECOMMENDED) and a client certificate on every APX and APDS-native route
except `/.well-known/apx-configuration`, which MUST remain retrievable
without one and MUST list `apx-mtls`, so a prospective client can learn the
requirement. A connection without a client certificate is refused at the
TLS handshake (`certificate_required`); no HTTP response is sent. Access
tokens SHOULD be certificate-bound per RFC 8705 (`cnf.x5t#S256`); a token
whose binding does not match the connection's certificate MUST be refused
with `401 unauthenticated`.
