## Purpose

The discovery module tells a client what an APX implementation offers
and what that client may do there (APX Part 16). It has two layers. The
bootstrap document, `/.well-known/apx-configuration`, is unauthenticated
and required of every implementation: it is how a client with nothing but
a hostname gets started. The discovery document, `GET /v1/discovery`, is
computed for the presented token and lists exactly what that credential
can reach. The second layer is the optional class `apx-discovery`.

The schemas are in `spec/openapi/domains/discovery/schemas.yaml`. Neither
document is parking data. Both describe the API, and both refer to APDS
only for the client's Organisation and the place ids it is granted.

## Concepts

### Bootstrap configuration

`ApxConfiguration` is the bootstrap document (APX Part 16 §16.1). It
holds:

- `apxVersion`, the APX edition implemented, and optionally `edition`,
  equal to it when present (APX Part 3 §3.4).
- `apdsVersion`, the one APDS release the server implements. There is no
  in-band version negotiation; a client checks this value before first
  use (APX Part 3 §3.5).
- `tokenEndpoint`, where the client obtains an OAuth2 token (APX Part 9).
- `apiBase`, the URL every path in the bundle is relative to, APX and
  APDS-native alike. It is required when the API is not at the origin
  root that serves this document.
- `conformanceClasses`: exactly the classes the Implementation
  Conformance Statement claims, closed under the dependency table of APX
  Part 3 §3.1, and containing only registry values or vendor classes
  named `<vendor-ns>-<class>`.
- `features`: the optional features offered, from the `apx-features`
  registry (`negotiatedRates`, `negotiatedAmounts`, `ticketMatching`) or
  vendor features. An offered feature must be listed; an unlisted one is
  not offered.
- `registries` and `registryVersions`, keyed by registry name: where each
  code list the server validates against is served, and its version (APX
  Part 11 §11.2). An advertised URL that does not resolve does not
  conform.
- `extensions`, the APX extensions container.

Under `apx-mtls`, this document stays retrievable without a client
certificate and lists `apx-mtls`, so a prospective client can learn the
requirement (APX Part 16 §16.3).

### Discovery document

`DiscoveryDocument` reflects the presented token exactly: its scopes, its
`apx_org` and its `apx_places` grant (APX Part 16 §16.2). It holds:

- `client`, the OAuth client id, and `organisation`, an APDS Reference to
  the client's Organisation.
- `conformanceClasses`, a subset of the bootstrap document's, and the
  token's `scopes`.
- `places`, the granted place subtrees. A token with no place claim is
  reflected as an empty list, never by omitting the member.
- `endpoints`: each an OpenAPI path template exactly as it appears in
  the bundle, relative to `apiBase`, with its upper-case HTTP methods.
  APDS-native routes and vendor routes are listed on the same terms.
- `commandTypes`, the command types this client may execute, and
  `features`, the capabilities of the classes it holds a scope of. The
  first is a permission list; the second is a capability list, so a
  read-only client still sees a feature.
- `topics`: APX registry topics, APDS EventTypeEnum values and vendor
  topics the client may subscribe to.
- `rateLimits`: per-credential integers for `requestsPerMinute`,
  `commandsPerMinute`, `burst`, `subscriptionsMax` and
  `streamConnectionsMax`.
- `replication[]`, present only when a place is shared with a replicated
  site or aggregator: which side, `site` or `aggregator`, is
  authoritative for each entity class at each place, and the peer's event
  source (APX Part 18 §18.6).
- `extensions`.

### The soundness rule

The discovery document is a promise, not advertising (APX Part 16
§16.2). Every endpoint and command it lists must be callable by the
client for at least one target inside its granted places. A client with
no granted places therefore sees no place-targeting endpoint. Two clients
with different grants receive different documents. What an unlisted call
receives follows APX Part 9 §9.3a: 403 `insufficient-scope` for an
endpoint the token's scopes do not cover, 403 `insufficient-grant` for a
target outside the grant, and 404 `target-not-found` for an endpoint of a
class the server does not claim.

The document is computed per request and is valid for the lifetime of the
token it was computed for. A change of scopes or grant takes effect
through a new token, and a client that receives 403 on a listed endpoint
should fetch discovery again before retrying.

### Onboarding

Discovery is the third step of onboarding at any implementation: fetch
the bootstrap document, obtain a credential, then call discovery to prove
the boundary before any traffic flows (APX Part 18 §18.3). An aggregator
runs exactly the single-site flow; that uniformity is the design (APX
Part 18 §18.1).

### Surfaces and per-place capabilities

A discovery document lists the vendor screens the client may open as
`uiSurfaces[]` (APX Part 25 §25.1): each surface, its display and launch
modes, the actions it reports back, its launch URL and the places where
it is offered. It also says what the client can do at each place as
`placeCapabilities[]`: the command types, the surfaces and the features
offered there (APX Part 16 §16.2), so a console knows before a call
whether a site takes a `lostTicket` command, offers its lane console, or
serves camera views. The soundness rule applies to both.

## Lifecycle

No lifecycle.

## Relationship to APDS

APDS elements used as they stand: the Organisation, through a Reference,
and HierarchyElement ids in `places`. The documents list APDS-native
routes and APDS `EventTypeEnum` topics alongside APX ones, so a client
learns both from one place. APDS 4.1 itself defines no discovery or
bootstrap document; APX adds them without changing any APDS route.

Proposed to APDS: no data element. Discovery describes the interface, not
the parking data, and the APX Data Specification proposes data only.

APX-only: `ApxConfiguration` and `DiscoveryDocument`, together with the
`apx-conformance-classes` and `apx-features` registries they draw on.
