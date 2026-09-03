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

## 9.5 Token issuance

APX does not define a token issuer. Implementations bring their own IdP;
any OAuth2 client-credentials-capable issuer satisfies this Part.

## 9.6 Privacy and data protection

License-plate numbers, plate imagery, and payment records are personal
data in many jurisdictions (e.g. GDPR). APX surfaces that carry them —
Observations/LPR reads (Part 13 §13.3), the
`apx.data.observation.created.v1` stream, plate-keyed lookups, and
payment history — are subject to this clause:

1. **Minimization (normative).** Responses and event payloads MUST NOT
   carry more personal data than the requesting scope needs: full PANs are
   never carried (Part 0 §0.4); plate values appear only under `apx.lpr:*`,
   `apx.tolling:*`, or `apx.accounts:*` scopes; imagery is carried as
   links, never inline.
2. **Access-controlled imagery (normative).** `imageLink` and any other
   media URL MUST require the same authentication and place grant as the
   API call that produced it. Unauthenticated, long-lived image URLs do
   not conform.
3. **Retention (normative floor and ceiling).** The Part 5 change feed
   requires at least 7 days of history. Implementations MUST define and
   publish (in operator documentation) a retention period for plate reads,
   imagery, and truncated-card payment records, and MUST be able to purge
   them on that schedule. This standard does not set a single ceiling —
   jurisdictions differ — but indefinite retention of plate imagery does
   not conform.
4. **Purpose limitation (normative).** Subscriptions to plate-bearing
   topics require the corresponding read scope; a subscription MUST NOT
   deliver a topic the credential could not read synchronously.
5. **Truncated-key lookups.** The 8-hour window on `ticketLast4`/
   `cardLast4` lookups (Part 13 §13.2) is a privacy control, not a
   convenience limit; implementations MUST NOT widen it by configuration.

Regulatory compliance (lawful basis, data-subject rights, cross-border
transfer) remains the Distributing Party's responsibility; this clause
defines the interoperable floor the API contract itself enforces.
