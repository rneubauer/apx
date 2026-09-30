# apx-discovery (and apx-mtls) — vetting scenarios

<!-- apx:module apx-discovery tag=Discovery ics=DSC,TLS -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-discovery`. Gaps the spec cannot express are marked
`gap=F-DSC-NN` and explained in `findings.md`. `apx-mtls` has no
operation of its own; DSC-13 covers it in prose around the documents it
changes.

**Cast.** One host, `https://api.lakeside-garage.example`, serves two
garages: Lakeside Garage (place `b1…0001`, whose exit level is the child
element `b1…0003`) operated by Lakeside Parking (`a1…0001`), and Harbor
Deck (`b1…0002`) operated by Harbor Parking (`a1…0002`). Its token
endpoint is `https://auth.lakeside-garage.example/oauth2/token`. The host
claims `apx-data`, `apx-events`, `apx-events-sse`, `apx-control`,
`apx-alerts`, `apx-discovery`, `apx-resolution`, and `apx-lpr`, and offers
the optional negotiated-rate and ticket-matching features. Clients: the
Lakeside call-center console (`console-lakeside`, scopes
`apx.data:read apx.control:read apx.control:execute apx.resolution:read
apx.subscriptions:manage`, places `[b1…0001]`); CityPark Analytics
(`bi-citypark`, org `a1…0003`, scope `apx.data:read
apx.subscriptions:manage`, places `[b1…0001, b1…0002]`); Lakeside's own
operations client (`ops-lakeside`, wildcard grant); and a trial IVR
integration (`ivr-trial`) whose token was minted without an `apx_places`
claim. Later, Lakeside Garage moves to the CityPark aggregator at
`https://api.citypark.example`. Harbor Deck also runs a PARCS starter
host of its own at `https://parcs.harbor-deck.example`.

Exit lane 2 is `b2…0002`; Harbor Deck's exit lane is `b2…0003`. All times
are 2026-09-24, UTC.

---

## DSC-01 — A client with nothing but a hostname

<!-- apx:scenario DSC-01 kind=happy ics=APX-CORE-09,APX-CORE-06,APX-CORE-12 -->

**Given** a new integrator who has been told only "api.lakeside-garage.example".
**When** they fetch `/.well-known/apx-configuration` at the host root with
no credentials. **Then** they get the token endpoint, the APDS version,
the claimed classes, and the registry locations, and can start the OAuth2
client-credentials flow. Harbor Deck's own PARCS starter host answers the
same request with the three-class minimum. Lakeside's document also
says which edition and which registry versions it validates against, and
which optional features it offers (Part 16 §16.1; F-DSC-05 and F-DSC-01
fixed — the members land in `ApxConfiguration` when the integrator points
the component at the discovery domain schema).

```http
GET /.well-known/apx-configuration
Host: api.lakeside-garage.example
(no Authorization header)
```

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "edition": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://auth.lakeside-garage.example/oauth2/token",
  "conformanceClasses": [
    "apx-data",
    "apx-events",
    "apx-events-sse",
    "apx-control",
    "apx-alerts",
    "apx-discovery",
    "apx-resolution",
    "apx-lpr"
  ],
  "features": ["negotiatedRates", "ticketMatching"],
  "registryVersions": {
    "apx-command-types": 3,
    "apx-alert-types": 1,
    "apx-device-states": 1,
    "apx-topics": 1,
    "apx-conformance-classes": 1,
    "apx-issue-types": 1,
    "apx-violation-types": 1
  },
  "registries": {
    "apx-command-types": "https://api.lakeside-garage.example/registries/apx-command-types.json",
    "apx-alert-types": "https://api.lakeside-garage.example/registries/apx-alert-types.json",
    "apx-device-states": "https://api.lakeside-garage.example/registries/apx-device-states.json",
    "apx-topics": "https://api.lakeside-garage.example/registries/apx-topics.json",
    "apx-conformance-classes": "https://api.lakeside-garage.example/registries/apx-conformance-classes.json",
    "apx-issue-types": "https://api.lakeside-garage.example/registries/apx-issue-types.json",
    "apx-violation-types": "https://api.lakeside-garage.example/registries/apx-violation-types.json"
  }
}
```

```http
GET /.well-known/apx-configuration
Host: parcs.harbor-deck.example
```

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://parcs.harbor-deck.example/oauth2/token",
  "conformanceClasses": ["apx-data", "apx-events", "apx-control"]
}
```

---

## DSC-02 — The console bootstraps: token, then its own capability document

<!-- apx:scenario DSC-02 kind=happy ics=APX-DSC-01,APX-DSC-02,APX-DSC-04,APX-CORE-06 -->

**Given** the console has exchanged its client credentials at the token
endpoint from DSC-01 and holds a JWT with `apx_org` `a1…0001` and
`apx_places` `["b1…0001"]`. **When** it calls `GET /v1/discovery`.
**Then** the document names the client, reflects the scopes, org, and
places exactly, lists the classes the token can use (the host's eight
minus `apx-alerts` and `apx-lpr`, which no scope reaches), the concrete
endpoints, all fifteen command types including the two optional-feature
commands the host supports, the topics it may subscribe to, and advisory
limits. The response is private and cacheable for five minutes.

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside>
→ 200, Cache-Control: private, max-age=300
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-discovery", "apx-resolution"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute", "apx.resolution:read", "apx.subscriptions:manage"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/places/{id}", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/sessions/{id}", "methods": ["GET"] },
    { "path": "/rates", "methods": ["GET"] },
    { "path": "/rights/assigned", "methods": ["GET"] },
    { "path": "/webhooks", "methods": ["GET", "POST"] },
    { "path": "/webhooks/{id}", "methods": ["GET", "PUT", "DELETE"] },
    { "path": "/v1/places/{id}/occupancy", "methods": ["GET"] },
    { "path": "/v1/events/stream", "methods": ["GET"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/commands/{id}/cancel", "methods": ["POST"] },
    { "path": "/v1/devices", "methods": ["GET"] },
    { "path": "/v1/devices/{id}", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/validations/providers", "methods": ["GET"] },
    { "path": "/v1/resolution/contexts", "methods": ["POST"] },
    { "path": "/v1/resolution/contexts/{id}", "methods": ["GET"] },
    { "path": "/v1/resolution/contexts/{id}/allowed-actions", "methods": ["GET"] },
    { "path": "/v1/credentials/{id}/passback", "methods": ["GET"] },
    { "path": "/v1/lpr/candidates", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [
    "vendGate", "holdGateOpen", "closeLane", "lostTicket", "pushRate", "applyValidation",
    "setDeviceState", "displayMessage", "restartDevice",
    "resetPassback", "forceIn", "forceOut", "courtesyExit",
    "pushNegotiatedRate", "matchTicket"
  ],
  "features": ["negotiatedRates", "ticketMatching"],
  "topics": [
    "apx.control.command.status.v1",
    "apx.control.device.state.v1",
    "apx.data.occupancy.v1",
    "apx.resolution.context.created.v1",
    "SessionCreated",
    "SessionUpdated"
  ],
  "rateLimits": { "requestsPerMinute": 600, "commandsPerMinute": 60 }
}
```

The two optional features of `apx-control` (Part 6 §6.5) appear in
`features`, the capability list, separately from `commandTypes`, the
permission list; a read-only control client sees the same `features`
(DSC-16; F-DSC-01 fixed). `path` is the OpenAPI template form and
`methods` are upper-case, and APDS `EventTypeEnum` topics belong in
`topics` alongside APX ones (Part 16 §16.2; F-DSC-12 fixed).

---

## DSC-03 — Two clients, two documents

<!-- apx:scenario DSC-03 kind=happy ics=APX-DSC-03,APX-DSC-01 -->

**Given** CityPark Analytics holds a read-only token on both garages.
**When** it calls the same `GET /v1/discovery` on the same host, a minute
after the console did. **Then** its document differs in every
credential-derived member: another client id and organisation, two place
roots, only the data and event classes, no control endpoints, an
explicitly empty `commandTypes`, and only the topics a data reader may
take.

```http
GET /v1/discovery
Authorization: Bearer <bi-citypark>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "bi-citypark",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000003", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.subscriptions:manage"],
  "places": ["b1000000-0000-4000-8000-000000000001", "b1000000-0000-4000-8000-000000000002"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/places/{id}", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/sessions/{id}", "methods": ["GET"] },
    { "path": "/rates", "methods": ["GET"] },
    { "path": "/rights/assigned", "methods": ["GET"] },
    { "path": "/webhooks", "methods": ["GET", "POST"] },
    { "path": "/webhooks/{id}", "methods": ["GET", "PUT", "DELETE"] },
    { "path": "/v1/places/{id}/occupancy", "methods": ["GET"] },
    { "path": "/v1/events/stream", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [],
  "topics": ["apx.data.occupancy.v1", "SessionCreated", "SessionUpdated"],
  "rateLimits": { "requestsPerMinute": 1200 }
}
```

The BI client holds no `apx.control` scope, so its document lists no
`features`; that the host offers negotiated rates is in the bootstrap
document's `features` (DSC-01), which every client can read (F-DSC-01
fixed).

---

## DSC-04 — The document is a promise, not advertising

<!-- apx:scenario DSC-04 kind=security ics=APX-DSC-02,APX-CORE-07 -->

**Given** the console's document from DSC-02 lists no `/v1/alerts` and
no `/v1/lpr/reads`. **When** a console developer "just tries" both, and
then uses a listed endpoint (`POST /v1/commands`) against Harbor Deck's
exit lane. **Then** the two unlisted endpoints fail 403
`insufficient-scope`, and the listed one fails 403 `insufficient-grant`:
soundness covers the endpoint, the grant still bounds the inputs.

```http
GET /v1/alerts
Authorization: Bearer <console-lakeside>
```

<!-- apx:request GET /v1/alerts -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/alerts requires scope apx.alerts:read; the token carries none of the alerts scopes. The endpoint is not in this client's discovery document.",
  "instance": "/v1/alerts"
}
```

<!-- apx:request GET /v1/lpr/reads?plate=ABC123 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/lpr/reads requires scope apx.lpr:read.",
  "instance": "/v1/lpr/reads"
}
```

```http
POST /v1/commands
Authorization: Bearer <console-lakeside>
Idempotency-Key: dsc-04-harbor
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000003", "className": "VehicularAccess" },
  "reason": "wrong garage"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000003 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant [b1000000-0000-4000-8000-000000000001].",
  "instance": "/v1/commands"
}
```

---

## DSC-05 — An endpoint of a class the host does not claim

<!-- apx:scenario DSC-05 kind=refusal ics=APX-DSC-02 -->

**Given** the host claims no `apx-valet`. **When** a valet-app developer
who has the console credential calls the valet queue for Lakeside.
**Then** 404 `target-not-found`: an endpoint of a class the server does
not claim is not there, while an endpoint it implements but the token's
scopes do not cover is 403 `insufficient-scope` (DSC-04). Part 9 §9.3a
settles it and Part 16 §16.2 and APX-DSC-02 now say the same (F-DSC-02
fixed; no new problem type needed).

```http
GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <console-lakeside>
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "This implementation does not claim apx-valet; /v1/valet/queue is not served here.",
  "instance": "/v1/valet/queue"
}
```

---

## DSC-06 — The explicit wildcard, and the token with no places at all

<!-- apx:scenario DSC-06 kind=security ics=APX-CORE-08,APX-DSC-01 -->

**Given** two tokens minted the same morning: Lakeside's operations client
with the deliberate `apx_places: ["*"]`, and a trial IVR client whose
registration forgot the claim entirely. **When** each calls discovery.
**Then** the first document carries the single wildcard entry and every
data and alert endpoint; the second reflects no places and, fail-closed,
lists only what can succeed without one. A missing claim is reflected as
`places: []`, never an absent member, and "callable" means callable for
at least one target inside the granted places, so the place-targeting
routes are left out (Part 16 §16.2; F-DSC-09 fixed).

```http
GET /v1/discovery
Authorization: Bearer <ops-lakeside; apx_places ["*"]>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "ops-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-alerts", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.data:write", "apx.alerts:read", "apx.alerts:write", "apx.subscriptions:manage"],
  "places": ["*"],
  "endpoints": [
    { "path": "/places", "methods": ["GET", "POST"] },
    { "path": "/places/{id}", "methods": ["GET", "PUT"] },
    { "path": "/sessions", "methods": ["GET", "POST"] },
    { "path": "/sessions/{id}", "methods": ["GET", "PUT"] },
    { "path": "/rates", "methods": ["GET", "POST"] },
    { "path": "/rights/assigned", "methods": ["GET", "POST"] },
    { "path": "/webhooks", "methods": ["GET", "POST"] },
    { "path": "/webhooks/{id}", "methods": ["GET", "PUT", "DELETE"] },
    { "path": "/v1/places/{id}/occupancy", "methods": ["GET"] },
    { "path": "/v1/events/stream", "methods": ["GET"] },
    { "path": "/v1/alerts", "methods": ["GET", "POST"] },
    { "path": "/v1/alerts/{id}", "methods": ["GET"] },
    { "path": "/v1/alerts/{id}/acknowledge", "methods": ["POST"] },
    { "path": "/v1/alerts/{id}/resolve", "methods": ["POST"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [],
  "topics": ["apx.data.occupancy.v1", "apx.alert.raised.v1", "apx.alert.status.v1", "SessionCreated", "SessionUpdated"]
}
```

```http
GET /v1/discovery
Authorization: Bearer <ivr-trial; no apx_places claim>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "ivr-trial",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-control", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.control:read"],
  "places": [],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [],
  "topics": []
}
```

A `GET /places` from the IVR token returns an empty page (Part 9 §9.3a
rule 3), and any `/v1/lanes/{id}/current` fails `insufficient-grant`,
which is why the server MUST leave the lane route out even though the
scope would allow it.

---

## DSC-07 — Discovery without a usable token

<!-- apx:scenario DSC-07 kind=refusal ics=APX-CORE-06 -->

**Given** a script that calls `/v1/discovery` before it has fetched a
token, and a dashboard whose token expired overnight. **When** each
calls. **Then** 401 `unauthenticated` both times (Part 12; F-DSC-03
fixed).

```http
GET /v1/discovery
(no Authorization header)
→ 401, WWW-Authenticate: Bearer realm="apx"
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "No bearer token presented. Obtain one at https://auth.lakeside-garage.example/oauth2/token (see /.well-known/apx-configuration).",
  "instance": "/v1/discovery"
}
```

```http
GET /v1/discovery
Authorization: Bearer <expired>
→ 401, WWW-Authenticate: Bearer realm="apx", error="invalid_token"
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T02:00:00Z.",
  "instance": "/v1/discovery"
}
```

---

## DSC-08 — A token with no APX scope, and a client that polls discovery in a loop

<!-- apx:scenario DSC-08 kind=refusal ics=APX-DSC-01,APX-CORE-07 -->

**Given** a legacy APDS client whose token carries only the APDS `po`
scope, and a misbehaving SDK that calls discovery before every request.
**When** the first calls `/v1/discovery` ("any APX scope", §16.2) and the
second exceeds its advisory limit. **Then** 403 `insufficient-scope` and
429 `rate-limited`, both declared on the operation (F-DSC-10 fixed).

```http
GET /v1/discovery
Authorization: Bearer <scope: po>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/discovery requires at least one apx.* scope; the token carries only the APDS scope po.",
  "instance": "/v1/discovery"
}
```

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside>
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Discovery is computed per request; 600/min exceeded for this credential. Cache the document for max-age.",
  "instance": "/v1/discovery"
}
```

---

## DSC-09 — A class claimed without its dependency

<!-- apx:scenario DSC-09 kind=edge ics=APX-CORE-09 -->

**Given** Harbor Deck's PARCS vendor turns on the resolution module
before the command plane, and later a payment-history module without
accounts. **When** the bootstrap document advertises `apx-resolution`
without `apx-control`, then `apx-payment-history` without
`apx-accounts`. **Then** both documents validate against the schema, and
both are non-conforming: Part 16 §16.1 requires the claim to be closed
under Part 3 §3.1's dependency table, and a client reading either treats
`apx-resolution` and then `apx-payment-history` as not offered (F-DSC-08
fixed in prose; the Annex A row and a tools check are with the
integrator).

```http
GET /.well-known/apx-configuration
Host: parcs.harbor-deck.example
```

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://parcs.harbor-deck.example/oauth2/token",
  "conformanceClasses": ["apx-data", "apx-events", "apx-resolution"]
}
```

Three weeks later:

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://parcs.harbor-deck.example/oauth2/token",
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-resolution", "apx-payment-history"]
}
```

---

## DSC-10 — The grant is narrowed; the document follows, after the cache

<!-- apx:scenario DSC-10 kind=edge ics=APX-DSC-01,APX-DSC-03 -->

**Given** Lakeside's administrator narrows the console's grant from the
whole garage to its exit level while the console still holds a document
fetched at 08:03. **When** the console re-fetches at 08:09, after the
five-minute `max-age`, with a token re-issued under the new grant.
**Then** `places` names only the exit level and everything else is
unchanged. Between 08:04 and 08:08 the old document said the entry
level was reachable and the server said otherwise. Part 16 §16.2 now
closes that window: a grant change takes effect through a new token, the
document is valid for its token's lifetime, `max-age` is capped by that
lifetime, and a client that meets a 403 on a listed endpoint refetches
discovery before retrying (F-DSC-14 fixed).

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside; apx_places ["b1…0003"]>
→ 200, Cache-Control: private, max-age=300
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-discovery", "apx-resolution"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute", "apx.resolution:read", "apx.subscriptions:manage"],
  "places": ["b1000000-0000-4000-8000-000000000003"],
  "features": ["negotiatedRates", "ticketMatching"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/rates", "methods": ["GET"] },
    { "path": "/webhooks", "methods": ["GET", "POST"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/commands/{id}/cancel", "methods": ["POST"] },
    { "path": "/v1/devices", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/resolution/contexts", "methods": ["POST"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [
    "vendGate", "holdGateOpen", "closeLane", "lostTicket", "pushRate", "applyValidation",
    "setDeviceState", "displayMessage", "restartDevice",
    "resetPassback", "forceIn", "forceOut", "courtesyExit",
    "pushNegotiatedRate", "matchTicket"
  ],
  "topics": ["apx.control.command.status.v1", "apx.control.device.state.v1", "apx.resolution.context.created.v1"],
  "rateLimits": { "requestsPerMinute": 600, "commandsPerMinute": 60 }
}
```

A vend at the entry lane `b2…0001` with the new token is now 403
`insufficient-grant`, exactly as DSC-04 shows for Harbor Deck.

---

## DSC-11 — A vendor extension shows up in both documents

<!-- apx:scenario DSC-11 kind=edge ics=APX-DSC-02,APX-CORE-04 -->

**Given** AcmeCorp has added a loyalty domain to the Lakeside host per
Part 3 §3.3: endpoints under `/apx/x/acmecorp/`, topics under
`acmecorp.`, and its own conformance class. **When** the bootstrap and
discovery documents are fetched by a client whose token carries the
vendor scope. **Then** both documents carry the vendor entries: vendor
endpoints and topics appear under the same soundness rule as APX ones,
the vendor class is `acmecorp-loyalty` (`<vendor-ns>-<class>`, never
`apx-`), and a client that does not know it ignores it (Part 3 §3.1, Part
16 §16.2; F-DSC-04 fixed). The decoration sits in the discovery
document's declared `extensions` container (F-DSC-06 fixed; the bootstrap
document gets the same container with the integrator's component
change).

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://auth.lakeside-garage.example/oauth2/token",
  "conformanceClasses": [
    "apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-alerts",
    "apx-discovery", "apx-resolution", "apx-lpr",
    "acmecorp-loyalty"
  ],
  "registries": {
    "apx-command-types": "https://api.lakeside-garage.example/registries/apx-command-types.json",
    "apx-topics": "https://api.lakeside-garage.example/registries/apx-topics.json",
    "apx-conformance-classes": "https://api.lakeside-garage.example/registries/apx-conformance-classes.json",
    "acmecorp-loyalty-tiers": "https://loyalty.acmecorp.example/registries/acmecorp-loyalty-tiers.json"
  }
}
```

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside + acmecorp.loyalty:read>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery", "acmecorp-loyalty"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute", "apx.subscriptions:manage", "acmecorp.loyalty:read"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] },
    { "path": "/apx/x/acmecorp/loyalty/balances", "methods": ["GET"] },
    { "path": "/apx/x/acmecorp/loyalty/members/{id}", "methods": ["GET"] }
  ],
  "commandTypes": ["vendGate", "lostTicket", "pushRate", "applyValidation"],
  "topics": ["apx.control.command.status.v1", "acmecorp.loyalty.tier.changed.v1"],
  "extensions": {
    "apds-ext:acmecorp:loyalty@1.0": { "programId": "f7000000-0000-4000-8000-000000000001", "tierRegistry": "acmecorp-loyalty-tiers" }
  }
}
```

---

## DSC-12 — Lakeside joins the CityPark aggregator

<!-- apx:scenario DSC-12 kind=lifecycle ics=APX-CORE-09,APX-DSC-01,APX-DSC-03 -->

**Given** Lakeside Garage is migrated into CityPark's aggregating
implementation (Part 18 §18.3), which mounts its API under
`/parking/v1` on a shared city host. **When** the console re-runs
onboarding at the new host: bootstrap at the host root, a new
registration at CityPark's IdP with `apx_places` naming exactly the
migrated subtree root, then discovery. **Then** the bootstrap document
shows a different class set (no resolution, no LPR) and a different
token endpoint, and the discovery document proves the boundary before
any traffic flows. The bootstrap document's `apiBase` says where the
bundle's paths are mounted, so the console needs nothing out of band, and
discovery `path` values are relative to it (Part 16 §16.1; F-DSC-13
fixed, pending the integrator's component change).

```http
GET /.well-known/apx-configuration
Host: api.citypark.example
```

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://id.citypark.example/oauth2/token",
  "apiBase": "https://api.citypark.example/parking",
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-alerts", "apx-discovery"],
  "registries": {
    "apx-command-types": "https://api.citypark.example/parking/registries/apx-command-types.json",
    "apx-alert-types": "https://api.citypark.example/parking/registries/apx-alert-types.json",
    "apx-device-states": "https://api.citypark.example/parking/registries/apx-device-states.json",
    "apx-topics": "https://api.citypark.example/parking/registries/apx-topics.json",
    "apx-conformance-classes": "https://api.citypark.example/parking/registries/apx-conformance-classes.json"
  }
}
```

```http
GET /parking/v1/discovery
Host: api.citypark.example
Authorization: Bearer <console-lakeside@citypark>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute", "apx.subscriptions:manage"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/rates", "methods": ["GET"] },
    { "path": "/rights/assigned", "methods": ["GET"] },
    { "path": "/webhooks", "methods": ["GET", "POST"] },
    { "path": "/v1/places/{id}/occupancy", "methods": ["GET"] },
    { "path": "/v1/events/stream", "methods": ["GET"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/commands/{id}/cancel", "methods": ["POST"] },
    { "path": "/v1/devices", "methods": ["GET"] },
    { "path": "/v1/devices/{id}", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/validations/providers", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [
    "vendGate", "holdGateOpen", "closeLane", "lostTicket", "pushRate", "applyValidation",
    "setDeviceState", "displayMessage", "restartDevice"
  ],
  "topics": ["apx.control.command.status.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1", "SessionCreated"],
  "rateLimits": { "requestsPerMinute": 300, "commandsPerMinute": 30 }
}
```

The resolution routes the console used at Lakeside are gone: CityPark
does not claim `apx-resolution`, and the console MUST NOT assume feature
parity (§18.3 step 1). The aggregator lists only the nine registry v1
command types and no `features`: CityPark does not offer negotiated rates
or ticket matching, and its bootstrap document says so by leaving them
out of `features` (F-DSC-01 fixed).

---

## DSC-13 — Mutual TLS is advertised; a plain-TLS client never gets an HTTP answer

<!-- apx:scenario DSC-13 kind=security ics=APX-TLS-01,APX-TLS-02,APX-TLS-03,APX-CORE-06,APX-CORE-09 -->

**Given** Lakeside hardens the host with `apx-mtls`: every APX endpoint
requires a client certificate, TLS 1.2 minimum, 1.3 preferred, and each
OAuth client is registered with the thumbprint of the certificate it
presents. **When** a new integrator with no certificate fetches the
bootstrap document, then the console connects with its certificate and
calls discovery, then a console token is replayed from a laptop without
the certificate. **Then**: the bootstrap document is served — it is
the one place the integrator learns that mTLS is required — and lists
`apx-mtls`; the console's discovery works and the document is unchanged
by the class (there is nothing credential-scoped about mTLS); the replay
has no HTTP outcome at all: the server closes the handshake for want of a
certificate; and a console token presented over another client's
certificate is 401 `unauthenticated`. Part 16 §16.3 now fixes all three:
the bootstrap document stays reachable without a certificate, a missing
certificate is refused at the handshake, and tokens are bound per RFC 8705
(APX-TLS-01 to -03; F-DSC-07 fixed, with RFC 8705 to be added to Part 1 by
the integrator).

```http
GET /.well-known/apx-configuration
Host: api.lakeside-garage.example
(TLS 1.3, no client certificate — served)
```

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://auth.lakeside-garage.example/oauth2/token",
  "conformanceClasses": [
    "apx-data", "apx-events", "apx-events-sse", "apx-control", "apx-alerts",
    "apx-discovery", "apx-resolution", "apx-lpr", "apx-mtls"
  ]
}
```

```http
GET /v1/discovery
Host: api.lakeside-garage.example
(TLS 1.3, client certificate CN=console-lakeside, thumbprint bound to the token's cnf claim)
Authorization: Bearer <console-lakeside; cnf.x5t#S256=…>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery", "apx-mtls"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/places", "methods": ["GET"] },
    { "path": "/sessions", "methods": ["GET"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": ["vendGate", "lostTicket", "pushRate", "applyValidation"],
  "topics": []
}
```

```http
GET /v1/discovery
Host: api.lakeside-garage.example
(TLS 1.3, no client certificate)
Authorization: Bearer <console-lakeside>
→ TLS alert: certificate_required (handshake fails; no HTTP response)
```

The third exchange has no `apx:response`: there is nothing to validate,
which is the point.

A console token copied to the BI host, which connects with its own
certificate:

```http
GET /v1/discovery
(TLS 1.3, client certificate CN=bi-citypark)
Authorization: Bearer <console-lakeside; cnf.x5t#S256 of console-lakeside's certificate>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Token is bound to a different client certificate (cnf.x5t#S256 mismatch, RFC 8705).",
  "instance": "/v1/discovery"
}
```

---

## DSC-14 — Which registry did you mean? Versions and editions in the documents

<!-- apx:scenario DSC-14 kind=edge ics=APX-CORE-09,APX-DSC-01 -->

**Given** a client library built against edition 0.9.0, when
`apx-command-types` was at version 2 without `pushNegotiatedRate` and
`matchTicket`. **When** it bootstraps against the Lakeside host, which
validates against registry version 3, and then reads its discovery
document. **Then** `registryVersions` says `apx-command-types` is at 3
before the library fetches anything, `edition` equals `apxVersion`, and
the library knows to refresh its registry before it meets the two command
types it lacks (Part 16 §16.1; F-DSC-05 fixed, pending the integrator's
component change).

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 200 -->
```json
{
  "apxVersion": "0.10.0",
  "edition": "0.10.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://auth.lakeside-garage.example/oauth2/token",
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery"],
  "features": ["negotiatedRates", "ticketMatching"],
  "registryVersions": {
    "apx-command-types": 3,
    "apx-device-states": 1,
    "apx-topics": 1,
    "apx-conformance-classes": 1
  },
  "registries": {
    "apx-command-types": "https://api.lakeside-garage.example/registries/apx-command-types.json",
    "apx-device-states": "https://api.lakeside-garage.example/registries/apx-device-states.json",
    "apx-topics": "https://api.lakeside-garage.example/registries/apx-topics.json",
    "apx-conformance-classes": "https://api.lakeside-garage.example/registries/apx-conformance-classes.json"
  }
}
```

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": ["vendGate", "lostTicket", "pushRate", "applyValidation", "pushNegotiatedRate", "matchTicket"],
  "topics": []
}
```

---

## DSC-15 — Advisory limits, and the 429 that follows them

<!-- apx:scenario DSC-15 kind=edge ics=APX-DSC-01 -->

**Given** the console's document says `requestsPerMinute: 600`. **When**
a screen refresh bug polls `GET /v1/devices` twelve times a second.
**Then** the server throttles with 429 and `Retry-After`. The document
warned it in `rateLimits`, whose keys are now fixed (`requestsPerMinute`,
`commandsPerMinute`, `burst`, `subscriptionsMax`, `streamConnectionsMax`,
per credential), and the 429 `detail` names the key exceeded (Part 16
§16.2; F-DSC-11 fixed).

```http
GET /v1/discovery
Authorization: Bearer <console-lakeside>
```

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "console-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery"],
  "scopes": ["apx.data:read", "apx.control:read", "apx.control:execute"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/v1/devices", "methods": ["GET"] },
    { "path": "/v1/devices/{id}", "methods": ["GET"] },
    { "path": "/v1/commands", "methods": ["POST"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": ["vendGate", "lostTicket", "pushRate", "applyValidation"],
  "topics": [],
  "rateLimits": { "requestsPerMinute": 600, "commandsPerMinute": 60, "burst": 20 }
}
```

```http
GET /v1/devices
Authorization: Bearer <console-lakeside>
→ 429, Retry-After: 4
```

<!-- apx:request GET /v1/devices -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 600 exceeded for client console-lakeside; retry after 4 seconds.",
  "instance": "/v1/devices"
}
```

---

## DSC-16 — A read-only control dashboard can see the optional features

<!-- apx:scenario DSC-16 kind=happy ics=APX-DSC-04,APX-DSC-01 -->

**Given** Lakeside's wall dashboard holds only `apx.control:read`. **When**
it calls discovery. **Then** `commandTypes` is empty, since it may execute
nothing, and `features` still lists `negotiatedRates` and `ticketMatching`,
so it knows to render the negotiated-rate and matched-ticket panels of
the lane inquiry (Part 6 §6.5, Part 16 §16.2; F-DSC-01 fixed).

<!-- apx:request GET /v1/discovery -->
<!-- apx:response 200 -->
```json
{
  "client": "wall-lakeside",
  "organisation": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-discovery"],
  "scopes": ["apx.control:read"],
  "places": ["b1000000-0000-4000-8000-000000000001"],
  "endpoints": [
    { "path": "/v1/commands", "methods": ["GET"] },
    { "path": "/v1/commands/{id}", "methods": ["GET"] },
    { "path": "/v1/devices", "methods": ["GET"] },
    { "path": "/v1/devices/{id}", "methods": ["GET"] },
    { "path": "/v1/lanes/{id}/current", "methods": ["GET"] },
    { "path": "/v1/validations/providers", "methods": ["GET"] },
    { "path": "/v1/discovery", "methods": ["GET"] }
  ],
  "commandTypes": [],
  "features": ["negotiatedRates", "ticketMatching"],
  "topics": [],
  "rateLimits": { "requestsPerMinute": 300, "burst": 10 }
}
```

A burst of wallboard reloads against the bootstrap document, which is
throttled like any other route:

<!-- apx:request GET /.well-known/apx-configuration -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 60 exceeded for unauthenticated callers from this address; retry after 10 seconds.",
  "instance": "/.well-known/apx-configuration"
}
```
