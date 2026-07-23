# APX Part 9 — Security Profile

APDS leaves security to the Distributing Party. APX narrows that to an
interoperable profile without prescribing an identity provider.

## 9.1 Authentication

- Implementations MUST support **OAuth 2.0 client credentials** (RFC 6749).
- The token endpoint is advertised in `/.well-known/apx-configuration`.
- Access tokens SHOULD be JWTs; introspection-based opaque tokens MAY be
  used if the resource server enforces the same claims.
- All APX traffic MUST use HTTPS. The `apx-mtls` conformance class adds
  mutual TLS.

## 9.2 Scopes

Scopes follow `apx.<domain>:<verb>` (full list in the OpenAPI
`securitySchemes`). A request whose token lacks the operation's scope MUST
receive HTTP 403 with problem type
`https://apx-standard.org/problems/insufficient-scope`.

## 9.3 Grants (normative claims)

Two token claims bound a client's world:

- `apx_org` — object `{id, className}` (APDS Reference, className
  `Organisation`): the client's organisation. Implementations MUST attribute
  writes (`recordInfo.creator`, command `requestedBy` defaults) to it.
- `apx_places` — array of HierarchyElement UUID strings. A grant on an
  element includes its entire subtree (Campus → … → Space). Absence of the
  claim means all places. A request targeting a place/device outside the
  grant MUST receive 403 with problem type
  `https://apx-standard.org/problems/insufficient-grant` — even when the
  scope check passes.

Discovery (`GET /v1/discovery`) MUST reflect scopes and grants exactly:
a client can call everything its discovery document lists, and nothing more.

## 9.4 Webhook authenticity

- Every webhook delivery MUST be signed: `APX-Signature: v1=<hex>` where
  `<hex>` = HMAC-SHA256(secret, `<APX-Timestamp>` + "." + raw body).
- `APX-Timestamp` is RFC 3339; receivers MUST reject deliveries older/newer
  than 5 minutes (replay window).
- Subscription secrets are exchanged out of band or at subscription time via
  `secretRef`; rotation uses a dual-key overlap window (both keys valid
  until the old one is retired).

## 9.5 Reference implementation caveat

The reference server ships an **in-memory toy token issuer for sandbox use
only**. It is loudly non-production; real deployments bring their own IdP.
