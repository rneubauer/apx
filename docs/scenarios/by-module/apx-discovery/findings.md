# Findings — apx-discovery and apx-mtls

Each entry is something a scenario in `scenarios.md` needed
that the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-DSC-NN`
markers where the runner would otherwise fail, and in prose where the
payload validates but the spec is silent. Fixes go to the public repo as
ordinary additive PRs; the scenarios stay here.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-DSC-01 | discovery | medium | Optional features (`pushNegotiatedRate`, `matchTicket`) are visible only as permitted `commandTypes`; a read-only client and the bootstrap document cannot see them | fixed — `features` on DiscoveryDocument and (via integrator component $ref) ApxConfiguration; §6.5, §16.1–16.2, APX-DSC-04 |
| F-DSC-02 | discovery | medium | Soundness 403 for an endpoint of an unclaimed class has no problem type; 403 vs 404 unspecified | fixed — per Part 9 §9.3a: unclaimed class 404 `target-not-found`, uncovered scope 403 `insufficient-scope`; §16.2 and APX-DSC-02 aligned; no new slug |
| F-DSC-03 | discovery | low | No problem type for 401 on `/v1/discovery` (same defect as F-CTL-07) | fixed — `unauthenticated` registered (4417f2f) |
| F-DSC-04 | discovery | medium | Vendor endpoints, topics, and conformance classes: whether and how they appear in the documents is unspecified; vendor class names are unfixed | fixed — §16.2 vendor endpoints/topics under soundness; §3.1 vendor class naming `<vendor-ns>-<class>`, clients ignore unknown classes |
| F-DSC-05 | discovery | low | The bootstrap document cannot pin registry versions or the edition; `registries` key names unfixed; `apxVersion` vs edition | fixed pending integrator — `edition`, `registryVersions`, keyed `registries` defined in domains/discovery ApxConfiguration; §16.1 |
| F-DSC-06 | discovery | low | Neither `ApxConfiguration` nor `DiscoveryDocument` has an `extensions` container, contrary to Part 4 §4.3 and APX-CORE-04 | fixed — `extensions` on DiscoveryDocument; ApxConfiguration's lands with the integrator's component $ref |
| F-DSC-07 | mtls | medium | `apx-mtls`: no exemption for the unauthenticated well-known document; refusal shape for a plain-TLS client unspecified; "bound to the OAuth client" names no mechanism | fixed — new §16.3 (mTLS: well-known exempt, handshake refusal, RFC 8705 binding, 401 on mismatch); APX-TLS-01..03; RFC 8705 in Part 1 pending integrator |
| F-DSC-08 | discovery | low | Dependency table is not machine-checkable; client behaviour on an inconsistent class claim unspecified; discovery classes ⊆ bootstrap classes never stated | fixed (prose) — §16.1 closure rule and client behaviour, §16.2 subset rule, §3.1; Annex row APX-CORE-12 and a tools check requested from integrator |
| F-DSC-09 | discovery | medium | `places` absent vs `[]` for a token without the claim; soundness vs fail-closed for place-targeting endpoints | fixed — §16.2: no claim reflects as `places: []`; callable = at least one target in granted places (prose MUST; schema `required` not changed) |
| F-DSC-10 | discovery | low | `GET /v1/discovery` declares no 403 or 429 | fixed — 403/429 declared (4417f2f) |
| F-DSC-11 | discovery | low | `rateLimits` keys, units, and windows are unnamed | fixed — §16.2 and schema description fix `rateLimits` keys (`requestsPerMinute`, `commandsPerMinute`, `burst`, `subscriptionsMax`, `streamConnectionsMax`) |
| F-DSC-12 | discovery | low | `endpoints[].path` form, `methods` casing, and whether APDS `EventTypeEnum` topics belong in `topics` are unfixed | fixed — `path` is the bundle template relative to `apiBase`, upper-case `methods`, `topics` include APDS EventTypeEnum; §16.2 and descriptions |
| F-DSC-13 | discovery | medium | The well-known document cannot say where the API is mounted (`apiBase`) | fixed pending integrator — optional `apiBase` in domains/discovery ApxConfiguration; §16.1 REQUIRED when not at origin root |
| F-DSC-14 | discovery | low | `Cache-Control: private, max-age=300` RECOMMENDED versus "not cacheable across token changes" | fixed — §16.2 lifetime rule: grant change via new token, max-age capped by token lifetime, refetch on 403 |

---

## F-DSC-01 — Optional features are advertised only as permissions

**Where it showed up.** DSC-02, DSC-03, DSC-12. Part 6 §6.5 says an
implementation "that lists `pushNegotiatedRate` or `matchTicket` in its
capability document (Part 16) MUST meet the corresponding section in
full". The only member of `DiscoveryDocument` that can carry them is
`commandTypes`, described as "command types this client may execute
(empty without apx.control:execute)". A read-only console, a BI client,
or a client reading the bootstrap document therefore cannot learn whether
the host supports the features; and a client with execute scope cannot
tell "the host does not offer negotiated rates" from "my grant excludes
them". `ApxConfiguration` has no member for optional features at all.

**Proposed fix.** Add an optional `features` array of strings to
`ApxConfiguration` (host-wide: what the implementation offers) and to
`DiscoveryDocument` (what this client may use), with a small registry or
a fixed list in Part 6 §6.5: `negotiatedRates`, `ticketMatching`. Say
that `commandTypes` remains the permission list and `features` the
capability list, and that §6.5's "lists … in its capability document"
means `features`.

## F-DSC-02 — Unlisted endpoint of an unclaimed class: which 403?

**Where it showed up.** DSC-05. §16.2: "calls to APX endpoints NOT listed
MUST fail with 403." When the endpoint is unlisted for want of a scope,
`insufficient-scope` fits; for want of a place, `insufficient-grant`.
When the host simply does not implement the class (`/v1/valet/queue` on
a host without `apx-valet`), the route may not exist at all, so
implementers will split between 404 and a 403 with no registered
`type`. Part 12 has no slug for "not offered by this implementation".

**Proposed fix.** Register `endpoint-not-offered` (403) in Part 12 §12.2:
"the route belongs to a conformance class this implementation does not
claim, or to a feature it does not offer". In §16.2 say which slug
applies to each reason (scope, grant, not offered), and that a route the
implementation does not serve at all MAY be 404 only when the
`/.well-known` document does not claim the class.

## F-DSC-03 — No problem type for 401

**Where it showed up.** DSC-07, DSC-13. `GET /v1/discovery` declares 401
with a `Problem` body whose `type` must be registered; Part 12 registers
nothing at 401. Identical to F-CTL-07; recorded here so this module's
gap markers resolve against a finding in its own file.

**Proposed fix.** As F-CTL-07: register `unauthenticated` (401), "missing,
malformed, expired, revoked, or certificate-unbound access token". One
PR closes both findings.

## F-DSC-04 — Vendor extensions in the discovery documents

**Where it showed up.** DSC-11. Part 3 §3.3 places vendor endpoints under
`/apx/x/<ns>/`, vendor topics under `<ns>.`, and lets a vendor define
"your own conformance class" (partner-extension-guide). Part 16 says
nothing about any of them: whether vendor endpoints appear in
`endpoints`, whether vendor topics appear in `topics`, whether the
soundness rule covers `/apx/x/` (a vendor route not listed → 403?), and
how a vendor class is named in `conformanceClasses` so a client can
distinguish it from an APX class it has never heard of. The schema
accepts any string, so `acmecorp-loyalty`, `acmecorp:loyalty`, and
`x-acmecorp-loyalty` are all "valid" today.

**Proposed fix.** In §16.2: vendor endpoints and topics MUST appear in
the discovery document under the same soundness rule as APX ones; vendor
conformance classes MUST be named `<vendor-ns>-<class>` and MUST NOT
begin with `apx-`; clients MUST ignore classes they do not recognise. In
§3.3 add the naming rule alongside the existing four namespace rules.
Optionally a note in Part 11 saying vendor code lists MAY be advertised
in `registries` under their own names, as DSC-11 does.

## F-DSC-05 — Registry versions and the edition cannot be pinned

**Where it showed up.** DSC-01, DSC-14. Part 11 §11.2: an implementation
"MUST serve or link the registry versions it validates against, and MUST
advertise those URLs in `/.well-known/apx-configuration.registries`".
`registries` is a map of string → URI; the version is discoverable only
by fetching each file. The map's key names are never fixed (registry
`name`? file name?). `apxVersion` is described as "APX standard version
implemented (semver)" while Part 3 §3.4 publishes editions with the same
number series; a client cannot tell whether "0.10.0" is the edition it
should read the Parts from or the API version.

**Proposed fix.** Say that `registries` keys are the registry `name`
values from Part 11's table (and vendor list names for vendor lists).
Add an optional `registryVersions` map (name → integer) and an optional
`edition` string to `ApxConfiguration`, and state that `apxVersion` is
the edition when both are present. Alternatively make each `registries`
value an object `{ "locator": uri, "version": integer }`; that is not
additive, so the two new members are preferred.

## F-DSC-06 — The two documents have no `extensions` container

**Where it showed up.** DSC-11. Part 4 §4.3: "Every APX resource schema
includes an optional `extensions` object"; APX-CORE-04 tests it. Neither
`ApxConfiguration` nor `DiscoveryDocument` declares one, and neither sets
`additionalProperties: false`, so the container in DSC-11 validates by
accident while being an unregistered key by §3.3(2). A vendor that
wants to decorate the discovery document (program ids, a vendor
registry pointer) has no conforming place to put it.

**Proposed fix.** Add `extensions: { $ref: Extensions }` to both schemas.
If the documents are deliberately not "resources" (no id/version), say
so in §16 and exempt them from APX-CORE-04 explicitly.

## F-DSC-07 — What mutual TLS changes on the wire is unspecified

**Where it showed up.** DSC-13. APX-TLS-01: "Mutual TLS on all APX
endpoints; TLS 1.2 minimum (1.3 RECOMMENDED); client identity bound to
the OAuth client." Three things a certifier cannot test from that: (1)
§16.1 makes the well-known document unauthenticated and reachable "with
nothing but a hostname", while "all APX endpoints" would put it behind a
client certificate, so a prospective client cannot learn that mTLS is
required; (2) what a client without a certificate observes (a TLS
`certificate_required` alert, a 401, a 403) is not stated; (3) "bound to
the OAuth client" names no mechanism, so one implementation will use RFC
8705 certificate-bound tokens (`cnf.x5t#S256`) and another a CN-to-client
lookup, and a token replayed over a differently-certificated connection
has no defined outcome.

**Proposed fix.** In Part 9 §9.1 add an `apx-mtls` subsection: the
well-known document MUST remain retrievable without a client
certificate; every other APX and APDS-native route MUST require one and
MUST refuse at the handshake (no HTTP response) when absent; tokens
SHOULD be certificate-bound per RFC 8705, and a token whose `cnf` does
not match the connection certificate MUST be refused 401
(`unauthenticated`, F-DSC-03). Add RFC 8705 to Part 1. Annex A row
APX-TLS-01 then splits into three testable rows.

## F-DSC-08 — Inconsistent class claims are not machine-checkable

**Where it showed up.** DSC-09. Part 3 §3.1's dependency table makes
`apx-resolution` without `apx-control` non-conforming, and A.20 says the
well-known document "MUST advertise exactly the classes the ICS claims".
Nothing in the schema, the Spectral rules, or the prose lets a client or
a certifier detect the violation from the document, and nothing says
what a client should do when it sees one (refuse? treat the dependent
class as absent?). Separately, §16.2 never states that a discovery
document's `conformanceClasses` is a subset of the bootstrap document's.

**Proposed fix.** In §16.1 say `conformanceClasses` MUST be closed under
the §3.1 dependency table and MUST list only registry values (or vendor
classes per F-DSC-04); in §16.2 say discovery classes are a subset of
bootstrap classes. Add a conformance row to Annex A (APX-CORE-12:
"advertised classes are dependency-closed") and a tools check that
validates example documents against the registry.

## F-DSC-09 — No places: what the document says, and what it lists

**Where it showed up.** DSC-06. `places` is optional on
`DiscoveryDocument`; its description says an empty array means no
places. A token that carries no `apx_places` claim (fail-closed: no
places) can therefore be reflected "exactly" either as an absent member
or as `[]`, and clients will special-case both. Worse, the soundness
rule promises that "every endpoint listed MUST be callable by the client
(given valid inputs)". For a token with no places there are no valid
inputs to `/v1/lanes/{id}/current` or `POST /v1/commands`; listing them
breaks the promise, omitting them hides a scope the client does hold.

**Proposed fix.** Make `places` required on `DiscoveryDocument`; a token
without the claim reflects as `[]`. In §16.2 define "callable" as
"callable for at least one target inside the granted places", so
place-targeting endpoints are omitted when `places` is empty and a
client can read an empty list as the misconfiguration it is.

## F-DSC-10 — Discovery declares no 403 or 429

**Where it showed up.** DSC-08. §16.2 says the operation needs "any APX
scope", so a token with only APDS scopes must be refused; the natural
answer is 403 `insufficient-scope`, which the operation does not
declare. Nor does it declare 429, though the document is "computed
per-request" and is the one endpoint every client polls. The well-known
operation declares only 200 and can also be throttled. Same family as
F-CTL-08.

**Proposed fix.** Add the shared `Forbidden` and `TooManyRequests`
responses to `GET /v1/discovery`, and `TooManyRequests` to
`GET /.well-known/apx-configuration`, along with the Spectral rule
proposed in F-CTL-08.

## F-DSC-11 — `rateLimits` is a map of unnamed integers

**Where it showed up.** DSC-15. `rateLimits` is "advisory per-client
limits" with `additionalProperties: integer`. The key names
(`requestsPerMinute`? `rpm`? `commands`?), the unit, and the window are
unspecified, so no client can act on the member without vendor
documentation, and a server cannot express "60 commands per minute with
a burst of 20" except by inventing keys, as DSC-15 does.

**Proposed fix.** Fix a small vocabulary in §16.2:
`requestsPerMinute`, `commandsPerMinute`, `subscriptionsMax`,
`streamConnectionsMax`; say every value is a per-credential integer and
that other keys are advisory vendor additions. Optionally note that a
429 `detail` SHOULD name the key that was exceeded.

## F-DSC-12 — Endpoint path form, method casing, and APDS topics

**Where it showed up.** DSC-02. `endpoints[].path` is described as
"concrete callable endpoints" but every realistic list needs templated
paths (`/v1/commands/{id}`), and nothing says whether the OpenAPI
template form, an RFC 6570 template, or a concrete example URL is
expected; `methods` casing is unfixed. `topics` is "topics this client
may subscribe to", and Part 8 lets clients subscribe to APDS
`EventTypeEnum` values as well as APX topics, but §16.2 never says
whether the APDS ones belong in the list.

**Proposed fix.** In the schema descriptions: `path` is the OpenAPI path
template exactly as it appears in the bundle (APDS-native routes
unchanged), `methods` are upper-case HTTP method names; `topics` lists
both APX registry topics and APDS `EventTypeEnum` values the credential
may subscribe to.

## F-DSC-13 — The well-known document cannot say where the API lives

**Where it showed up.** DSC-12. RFC 8615 fixes `/.well-known/` at the
origin root, and §16.1 says so. An aggregator (Part 18) or any deployment
that mounts the API under a path prefix (`/parking/v1`) or on a different
host from the one whose root serves the document has no member in
`ApxConfiguration` that tells the client where `/v1` and the APDS routes
are. A client "with nothing but a hostname" still needs a second piece
of out-of-band configuration. Multi-tenant hosts serving several
implementations from one origin have the same problem in reverse.

**Proposed fix.** Add optional `apiBase` (uri) to `ApxConfiguration`:
the URL every path in the bundle is relative to; absent means the
origin root. Say in §16.1 that when the API is not at the origin root
the member is REQUIRED, and that discovery `endpoints[].path` values
are relative to it.

## F-DSC-14 — Cache the document, but not across token changes

**Where it showed up.** DSC-10. §16.2: "computed per-request; it is not
cacheable across token changes (`Cache-Control: private, max-age=300`
RECOMMENDED)". A grant narrowed at 08:04 leaves a client holding a
document until 08:08 that lists places it can no longer reach; the
server has already begun refusing them. Neither sentence is normative on
the client, so one SDK will refetch on every 403 and another will trust
the cache. There is also no way for the server to signal "your document
changed" other than a 403 on a listed endpoint, which the soundness rule
says must not happen.

**Proposed fix.** Say in §16.2 that the document is valid for the
lifetime of the token it was computed for, that a grant change MUST be
accompanied by token revocation or expiry (so the client's next
discovery is with a new token), and that a client receiving 403 on a
listed endpoint SHOULD refetch discovery before retrying. Keep the
`Cache-Control` recommendation but tie `max-age` to the token's
remaining lifetime.

## Runner issues

None that affect the result. One observation, not a defect: when a
scenario in a non-Control module sends a command body (DSC-04 posts a
`vendGate` to show the grant refusal), the report prints
`command types: 1/15 unused: …` against the Control registry. It is
correct and harmless, but a reader of this module's report might take
the line for a coverage shortfall. If it becomes confusing, the line
could be suppressed for modules whose tags do not include `Control`.
