# apx-ui-launch — vetting scenarios

<!-- apx:module apx-ui-launch tag=UI_launch ics=UIL -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-ui-launch`. Gaps the spec cannot express are
marked `gap=F-UIL-NN` and explained in `findings.md`; the 401 shape
reuses `F-CTL-07` from `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), exit lane 2 `b2…0002`, exit
gate `c1…0002`, pay-in-lane terminal `c1…0003`. Harbor Deck (`b1…0002`,
exit lane `b2…0003`) belongs to another operator and is outside the
token's grant. Operator organisation `a1…0001`. The PARCS vendor
Gatewise runs the lane console at `https://ui.gatewise.example`; the
call-center console is the host. Parkers: a transient driver with ticket
`T-61099` (session `c4…0099`) who lost it; a visitor with reservation
`LKG-88214` (`e2…0014`). Agents: `agent:j.okafor` (human),
`ai:lakeside-voicebot-02` (AI). Launches are `ea…0ANN`, action records
`eb…0BNN`, commands `d1…03NN`, support interactions `e7…07NN`, events
`e9…0ENN`; correlation ids are `ca000000-…-00NN`, one per episode.

Every request carries `Authorization: Bearer …` with scopes
`apx.ui:launch apx.ui:read apx.ui:record apx.control:execute
apx.resolution:read apx.support:manage` and `apx_places` =
`["b1000000-0000-4000-8000-000000000001"]` unless the scenario says
otherwise. Requests that create resources send the create shape; `id`,
`version`, `url`, `expiresAt`, and `status` are server-assigned. All
timestamps are RFC 3339 UTC on 2026-10-18.

---

## UIL-01 — Lost ticket, handled in the vendor's own screen, and the record still matches

<!-- apx:scenario UIL-01 kind=happy ics=APX-UIL-02,APX-UIL-04,APX-UIL-05 -->

**Given** a driver at exit lane 2 lost ticket `T-61099`, and Lakeside's
PARCS does not yet implement the `lostTicket` command through APX but
has a good lane console of its own. **When** the host console asks for a
launch of `lane.console` on the lane, naming the agent and the call's
`correlationId`, with its normal access token in the `Authorization`
header. **Then** 201 with a single-use `url` that expires in 60 seconds
(§25.3). The console opens it in a popup; the agent is signed in
without a second login. The agent issues the lost-ticket fee in the
vendor's screen; the implementation records that as an ordinary
`lostTicket` Command carrying the launch's `correlationId` and the agent
(§25.5), then the screen closes the launch. The launch record lists
what was done, and the call record can be reconciled to the PARCS
transaction by `correlationId` alone.

```http
POST /v1/ui/launches
Idempotency-Key: cc-9001-launch
```

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951001",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "returnFields": ["/ticketNumber", "/amountDue"]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a01",
  "version": 1,
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951001",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "returnFields": ["/ticketNumber", "/amountDue"],
  "url": "https://ui.gatewise.example/launch/8f3c0e1b-5d2a-4b7e-9c6f-1a2b3c4d5e6f",
  "expiresAt": "2026-10-18T14:03:12Z",
  "status": "issued",
  "actions": [],
  "recordInfo": {
    "creationTime": "2026-10-18T14:02:12Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "agent:j.okafor"
  }
}
```

The popup opens the `url`; the implementation consumes it and the
launch moves to `opened`:

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-000000000a01 -->
<!-- apx:response 200 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a01",
  "version": 2,
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951001",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "returnFields": ["/ticketNumber", "/amountDue"],
  "url": "https://ui.gatewise.example/launch/8f3c0e1b-5d2a-4b7e-9c6f-1a2b3c4d5e6f",
  "expiresAt": "2026-10-18T14:03:12Z",
  "status": "opened",
  "openedAt": "2026-10-18T14:02:15Z",
  "actions": []
}
```

In the vendor's screen the agent issues the lost-ticket fee. The
implementation records it as the Command it would have been through the
API, carrying the launch's `correlationId` and agent (§25.5 rule 1);
subscribers see the usual `apx.control.command.status.v1`:

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000301",
  "version": 4,
  "commandType": "lostTicket",
  "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "ticket T-61099 lost; fee issued in the Gatewise lane console",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "expiryTime": "2026-10-18T14:08:00Z",
  "priority": "normal",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-10-18T14:04:40Z", "actor": "gatewise-ui" },
    { "state": "accepted", "time": "2026-10-18T14:04:40Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-10-18T14:04:41Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-10-18T14:04:43Z", "actor": "pay-c1000000-0003", "detail": "lost ticket LT-0021 issued; $32.00 due" }
  ],
  "result": { "ticketNumber": "LT-0021", "amountDue": { "currencyType": "USD", "currencyValue": 32.00 } }
}
```

The screen then closes the launch. The launch's `actions[]` names the
Command as the `result` of what was done, with the requested fields
filled from it:

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a01/close -->
<!-- apx:response 200 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a01",
  "version": 4,
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951001",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "returnFields": ["/ticketNumber", "/amountDue"],
  "url": "https://ui.gatewise.example/launch/8f3c0e1b-5d2a-4b7e-9c6f-1a2b3c4d5e6f",
  "expiresAt": "2026-10-18T14:03:12Z",
  "status": "closed",
  "openedAt": "2026-10-18T14:02:15Z",
  "closedAt": "2026-10-18T14:04:50Z",
  "actions": [
    {
      "id": "eb000000-0000-4000-8000-000000000b01",
      "launch": { "id": "ea000000-0000-4000-8000-000000000a01", "className": "UiLaunch" },
      "action": "lostTicket",
      "outcome": "completed",
      "occurredAt": "2026-10-18T14:04:43Z",
      "agent": "agent:j.okafor",
      "summary": "Lost ticket LT-0021 issued at pay-in-lane 3; $32.00 due.",
      "result": { "id": "d1000000-0000-4000-8000-000000000301", "className": "Command" },
      "fields": { "/ticketNumber": "LT-0021", "/amountDue": { "currencyType": "USD", "currencyValue": 32.00 } },
      "correlationId": "ca000000-0000-4000-8000-000000000001"
    }
  ]
}
```

Every transition publishes `apx.ui.launch.changed.v1`; the host's
subscription receives the close:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate UiLaunch at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e01",
  "type": "apx.ui.launch.changed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "ea000000-0000-4000-8000-000000000a01", "className": "UiLaunch" },
  "time": "2026-10-18T14:04:50Z",
  "data": {
    "id": "ea000000-0000-4000-8000-000000000a01",
    "version": 4,
    "surface": "lane.console",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "agent": "agent:j.okafor",
    "agentType": "human",
    "correlationId": "ca000000-0000-4000-8000-000000000001",
    "displayMode": "popup",
    "expiresAt": "2026-10-18T14:03:12Z",
    "status": "closed",
    "openedAt": "2026-10-18T14:02:15Z",
    "closedAt": "2026-10-18T14:04:50Z",
    "actions": [
      {
        "id": "eb000000-0000-4000-8000-000000000b01",
        "launch": { "id": "ea000000-0000-4000-8000-000000000a01", "className": "UiLaunch" },
        "action": "lostTicket",
        "outcome": "completed",
        "occurredAt": "2026-10-18T14:04:43Z",
        "summary": "Lost ticket LT-0021 issued at pay-in-lane 3; $32.00 due.",
        "result": { "id": "d1000000-0000-4000-8000-000000000301", "className": "Command" }
      }
    ]
  }
}
```

The console retries the launch after a timeout with the same key and
body and gets the launch as it now stands, not a second url:

```http
POST /v1/ui/launches
Idempotency-Key: cc-9001-launch
```

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951001",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "returnFields": ["/ticketNumber", "/amountDue"]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a01",
  "version": 4,
  "surface": "lane.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "displayMode": "popup",
  "url": "https://ui.gatewise.example/launch/8f3c0e1b-5d2a-4b7e-9c6f-1a2b3c4d5e6f",
  "expiresAt": "2026-10-18T14:03:12Z",
  "status": "closed",
  "openedAt": "2026-10-18T14:02:15Z",
  "closedAt": "2026-10-18T14:04:50Z",
  "actions": []
}
```

---

## UIL-02 — The vendor cannot say it in APX yet: the action record fallback

<!-- apx:scenario UIL-02 kind=happy ics=APX-UIL-06,APX-UIL-07 -->

**Given** the voice bot opens the `validation.redeem` surface for a
session whose cinema validation was not applied, asking for the
provider, the amount applied and the provider's own code. **When** the
agent applies the validation in the vendor's screen and the
implementation has no `applyValidation` through APX. **Then** it MUST
record a `UiActionRecord` instead (§25.5 rule 2): the action, the
outcome, a summary, the requested fields it can supply, and the one it
cannot listed in `unavailable` with a reason, never silently dropped.
201, and `apx.ui.action.recorded.v1` is published.

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "validation.redeem",
  "subject": { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "correlationId": "ca000000-0000-4000-8000-000000000002",
  "displayMode": "embed",
  "returnFields": ["/validation/provider", "/validation/amount", "/validation/providerCode"]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a02",
  "version": 1,
  "surface": "validation.redeem",
  "subject": { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "correlationId": "ca000000-0000-4000-8000-000000000002",
  "displayMode": "embed",
  "returnFields": ["/validation/provider", "/validation/amount", "/validation/providerCode"],
  "url": "https://ui.gatewise.example/launch/2b7e9c6f-1a2b-4c4d-8e6f-8f3c0e1b5d2a",
  "expiresAt": "2026-10-18T14:21:00Z",
  "status": "issued",
  "actions": []
}
```

The vendor's screen records what the agent did:

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions -->
```json
{
  "action": "applyValidation",
  "outcome": "completed",
  "occurredAt": "2026-10-18T14:22:31Z",
  "agent": "agent:j.okafor",
  "summary": "Lakeside Cinema validation applied to T-61077: 2 hours free.",
  "fields": {
    "/validation/provider": "Lakeside Cinema",
    "/validation/amount": { "currencyType": "USD", "currencyValue": 8.00 }
  },
  "unavailable": [
    { "field": "/validation/providerCode", "reason": "notSupported" }
  ],
  "correlationId": "ca000000-0000-4000-8000-000000000002"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "eb000000-0000-4000-8000-000000000b02",
  "launch": { "id": "ea000000-0000-4000-8000-000000000a02", "className": "UiLaunch" },
  "action": "applyValidation",
  "outcome": "completed",
  "occurredAt": "2026-10-18T14:22:31Z",
  "agent": "agent:j.okafor",
  "summary": "Lakeside Cinema validation applied to T-61077: 2 hours free.",
  "fields": {
    "/validation/provider": "Lakeside Cinema",
    "/validation/amount": { "currencyType": "USD", "currencyValue": 8.00 }
  },
  "unavailable": [
    { "field": "/validation/providerCode", "reason": "notSupported" }
  ],
  "correlationId": "ca000000-0000-4000-8000-000000000002"
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate UiActionRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e02",
  "type": "apx.ui.action.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "ea000000-0000-4000-8000-000000000a02", "className": "UiLaunch" },
  "time": "2026-10-18T14:22:31Z",
  "data": {
    "id": "eb000000-0000-4000-8000-000000000b02",
    "launch": { "id": "ea000000-0000-4000-8000-000000000a02", "className": "UiLaunch" },
    "action": "applyValidation",
    "outcome": "completed",
    "occurredAt": "2026-10-18T14:22:31Z",
    "agent": "agent:j.okafor",
    "summary": "Lakeside Cinema validation applied to T-61077: 2 hours free.",
    "fields": {
      "/validation/provider": "Lakeside Cinema",
      "/validation/amount": { "currencyType": "USD", "currencyValue": 8.00 }
    },
    "unavailable": [
      { "field": "/validation/providerCode", "reason": "notSupported" }
    ],
    "correlationId": "ca000000-0000-4000-8000-000000000002"
  }
}
```

A screen where the agent looked and did nothing records that too, so
the call record is never left guessing:

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions -->
```json
{
  "action": "other",
  "outcome": "noAction",
  "occurredAt": "2026-10-18T14:23:05Z",
  "agent": "agent:j.okafor",
  "summary": "Checked the session; nothing further needed."
}
```

<!-- apx:response 201 -->
```json
{
  "id": "eb000000-0000-4000-8000-000000000b03",
  "launch": { "id": "ea000000-0000-4000-8000-000000000a02", "className": "UiLaunch" },
  "action": "other",
  "outcome": "noAction",
  "occurredAt": "2026-10-18T14:23:05Z",
  "agent": "agent:j.okafor",
  "summary": "Checked the session; nothing further needed."
}
```

---

## UIL-03 — Signed-token mode: no handshake call, the host signs the launch itself

<!-- apx:scenario UIL-03 kind=happy ics=APX-UIL-03,APX-UIL-01 -->

**Given** Gatewise also accepts a launch token at its `launchUrl`, as
its discovery entry says. **When** the host mints a JWS whose claims are
the launch request, with `aud` the implementation, `exp` 60 seconds
out and a unique `jti`, and posts it to the `launchUrl` by form POST
(never in the query string, §25.3). **Then** the implementation
verifies it against the host's registered key, creates the launch
itself, and the host finds it by `correlationId`. The token's claims
are shown for the record; the form POST is out of band for APX.

The surface as discovery advertises it (Part 16 §16.2):

<!-- apx:validate UiSurface -->
```json
{
  "surface": "lane.console",
  "subjectClass": "VehicularAccess",
  "displayModes": ["popup", "tab", "embed"],
  "launchModes": ["handshake", "signedToken"],
  "launchUrl": "https://ui.gatewise.example/launch",
  "actions": ["lostTicket", "applyValidation", "vendGate", "pushRate"],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
}
```

The claims of the token the host signs (ES256, `kid` registered at
onboarding):

<!-- apx:validate UiLaunchToken -->
```json
{
  "iss": "https://console.lakeside-oncall.example",
  "aud": "https://api.lakeside-garage.example",
  "iat": 1792333500,
  "exp": 1792333560,
  "jti": "2f4a9c8e-7b1d-4e3a-9c5b-6d7e8f9a0b1c",
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "interactionId": "interaction-951003",
  "correlationId": "ca000000-0000-4000-8000-000000000003",
  "displayMode": "tab",
  "returnFields": ["/ticketNumber"]
}
```

The host reads the launch the implementation created from the token:

<!-- apx:request GET /v1/ui/launches?correlationId=ca000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792333570, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "ea000000-0000-4000-8000-000000000a03",
      "version": 2,
      "surface": "lane.console",
      "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "agent": "agent:j.okafor",
      "agentType": "human",
      "interactionId": "interaction-951003",
      "correlationId": "ca000000-0000-4000-8000-000000000003",
      "displayMode": "tab",
      "returnFields": ["/ticketNumber"],
      "expiresAt": "2026-10-18T14:26:00Z",
      "status": "opened",
      "openedAt": "2026-10-18T14:25:04Z",
      "actions": []
    }
  ]
}
```

No `url` is minted in this mode: the token was the launch.

---

## UIL-04 — Launch refused: an unknown surface, a mode the surface does not offer, a subject that does not exist

<!-- apx:scenario UIL-04 kind=refusal ics=APX-UIL-01,APX-CORE-05 -->

**Given** a console that guesses. **When** it asks for a surface
Gatewise does not offer, then `embed` on a surface that offers only
`popup`, then a session id nobody has. **Then** 422
`ui-surface-unknown`, 422 `ui-display-mode-unsupported`, and 422
`reference-unknown`; a body with no `agent` is 400 `invalid-request`.
Discovery already said which surfaces and modes exist (§25.2); a
server never improvises a screen.

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "toll.dispute",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "displayMode": "popup"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/ui-surface-unknown",
  "title": "UI surface not offered",
  "status": 422,
  "detail": "This implementation offers no toll.dispute surface; see uiSurfaces in GET /v1/discovery.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "session.detail",
  "subject": { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "displayMode": "embed"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/ui-display-mode-unsupported",
  "title": "Display mode not supported by this surface",
  "status": 422,
  "detail": "session.detail offers popup and tab; the host's origin is not registered for embedding.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "session.detail",
  "subject": { "id": "c4000000-0000-4000-8000-0000000000ff", "className": "Session" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "displayMode": "popup"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Referenced entity unknown",
  "status": 422,
  "detail": "subject: no Session c4000000-0000-4000-8000-0000000000ff at this place.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request POST /v1/ui/launches invalid -->
```json
{
  "surface": "lane.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "displayMode": "popup"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "Body fails the UiLaunchRequest schema.",
  "instance": "/v1/ui/launches",
  "errors": [
    { "pointer": "/agent", "message": "required" },
    { "pointer": "/agentType", "message": "required" }
  ]
}
```

---

## UIL-05 — Too late, and twice: an expired launch, a closed launch

<!-- apx:scenario UIL-05 kind=refusal ics=APX-UIL-04 -->

**Given** a launch nobody opened within 60 seconds, and the UIL-01
launch that is already closed. **When** a screen tries to record an
action on each, and the closed one is closed again. **Then** 409
`ui-launch-expired`, 409 `ui-launch-closed`, 409 `ui-launch-closed`.
An expired launch publishes `apx.ui.launch.changed.v1` with status
`expired` when the implementation notices; the host mints a new launch
rather than reusing one (§25.4).

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-000000000a05 -->
<!-- apx:response 200 -->
```json
{
  "id": "ea000000-0000-4000-8000-000000000a05",
  "version": 2,
  "surface": "lane.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000005",
  "displayMode": "popup",
  "url": "https://ui.gatewise.example/launch/5d2a4b7e-9c6f-4a2b-8c4d-3c4d5e6f8f3c",
  "expiresAt": "2026-10-18T14:31:00Z",
  "status": "expired",
  "actions": []
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a05/actions -->
```json
{
  "action": "vendGate",
  "outcome": "completed",
  "occurredAt": "2026-10-18T14:35:10Z",
  "summary": "Gate vended from the lane console."
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/ui-launch-expired",
  "title": "UI launch expired",
  "status": 409,
  "detail": "Launch ea000000-0000-4000-8000-000000000a05 expired at 2026-10-18T14:31:00Z without being opened.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a05/actions"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a01/actions -->
```json
{
  "action": "reprintReceipt",
  "outcome": "completed",
  "occurredAt": "2026-10-18T14:36:00Z",
  "summary": "Receipt reprinted."
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/ui-launch-closed",
  "title": "UI launch closed",
  "status": 409,
  "detail": "Launch ea000000-0000-4000-8000-000000000a01 was closed at 2026-10-18T14:04:50Z; open a new launch to record further actions.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a01/actions"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a01/close -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/ui-launch-closed",
  "title": "UI launch closed",
  "status": 409,
  "detail": "Launch ea000000-0000-4000-8000-000000000a01 is already closed.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a01/close"
}
```

---

## UIL-06 — Scopes and grants: the host may launch, the screen may record, nobody sees a secret

<!-- apx:scenario UIL-06 kind=security ics=APX-UIL-08,APX-CORE-07,APX-CORE-08 -->

**Given** three credentials: the host console with `apx.ui:launch
apx.ui:read`, the vendor screen's own client with `apx.ui:record`, and
a wallboard with `apx.ui:read` only. **When** the wallboard tries to
launch, the host tries to record an action, and the host names Harbor
Deck. **Then** 403 `insufficient-scope`, 403 `insufficient-scope`, 403
`insufficient-grant`. A read of any launch carries the single-use `url`
and nothing else that could sign a parker or an agent in: no launch
secret, no signing key, no session cookie (Part 9 §9.7, §25.6). The
`url` is dead after its first use; a second open is refused by the
screen itself, out of band, and the record still shows one `openedAt`.

The wallboard, `apx.ui:read` only:

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "place.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "wall:lakeside",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000006",
  "displayMode": "tab"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/ui/launches requires apx.ui:launch; token holds apx.ui:read.",
  "instance": "/v1/ui/launches"
}
```

The host console, which may launch but not record:

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions -->
```json
{
  "action": "other",
  "outcome": "completed",
  "occurredAt": "2026-10-18T14:40:00Z",
  "summary": "Typed from the call notes."
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/ui/launches/{id}/actions requires apx.ui:record; token holds apx.ui:launch apx.ui:read. Only the launched surface records what was done in it.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions"
}
```

The host console, naming a place outside its grant:

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "lane.console",
  "subject": { "id": "b2000000-0000-4000-8000-000000000003", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000006",
  "displayMode": "popup"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is outside the token's apx_places grant.",
  "instance": "/v1/ui/launches"
}
```

A read by the screen's client, which holds no `apx.ui:read`, is refused
the same way; and a launch read never lists the vendor's launch secret:

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-000000000a02 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/ui/launches/{id} requires apx.ui:read; token holds apx.ui:record.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02"
}
```

---

## UIL-07 — Part 17 offers the screen when the API cannot do it

<!-- apx:scenario UIL-07 kind=happy ics=APX-UIL-09,APX-RES-12,APX-RES-03 -->

**Given** a resolution context for the UIL-01 call. **When** the server
has no `lostTicket` through APX but Gatewise offers `lane.console`.
**Then** the allowed action's `execution.type` is `ui`, naming the
surface and the subject, so the agent sees "do it in the vendor's
screen" beside the API actions (Part 17 §17.3). The support interaction
that closes the call references the launch and its action record in
`actions[]`.

<!-- apx:validate AllowedAction -->
```json
{
  "action": "lostTicket",
  "display": "Issue lost ticket (vendor console)",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "allowed": true,
  "requiresApproval": false,
  "execution": {
    "type": "ui",
    "surface": "lane.console",
    "subject": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
  }
}
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "intercom",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-10-18T14:01:50Z",
  "endedAt": "2026-10-18T14:05:10Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket", "display": "Lost ticket" },
  "summary": "Lost ticket at exit lane 2; LT-0021 issued in the Gatewise lane console; $32.00 paid; exited.",
  "subjects": { "session": { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session" } },
  "actions": [
    { "id": "ea000000-0000-4000-8000-000000000a01", "className": "UiLaunch" },
    { "id": "eb000000-0000-4000-8000-000000000b01", "className": "UiActionRecord" },
    { "id": "d1000000-0000-4000-8000-000000000301", "className": "Command" }
  ],
  "interactionId": "interaction-951001",
  "resolution": { "code": "resolved", "display": "Lost ticket issued and paid" },
  "correlationId": "ca000000-0000-4000-8000-000000000001"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 1,
  "channel": "intercom",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-10-18T14:01:50Z",
  "endedAt": "2026-10-18T14:05:10Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket", "display": "Lost ticket" },
  "summary": "Lost ticket at exit lane 2; LT-0021 issued in the Gatewise lane console; $32.00 paid; exited.",
  "subjects": { "session": { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session" } },
  "actions": [
    { "id": "ea000000-0000-4000-8000-000000000a01", "className": "UiLaunch" },
    { "id": "eb000000-0000-4000-8000-000000000b01", "className": "UiActionRecord" },
    { "id": "d1000000-0000-4000-8000-000000000301", "className": "Command" }
  ],
  "interactionId": "interaction-951001",
  "resolution": { "code": "resolved", "display": "Lost ticket issued and paid" },
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "recordInfo": {
    "creationTime": "2026-10-18T14:05:12Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "agent:j.okafor"
  }
}
```

---

## UIL-08 — Every launch of a shift, and a launch that failed in the screen

<!-- apx:scenario UIL-08 kind=lifecycle ics=APX-UIL-04,APX-UIL-06 -->

**Given** the shift supervisor reviews what was done in vendor screens
today. **When** they list the place's launches by agent and status.
**Then** a paginated list of launch records; one of them shows a
`failed` outcome, recorded by the screen when the PARCS refused the
action, so a failure in the vendor's screen is as visible as a failed
Command.

<!-- apx:request GET /v1/ui/launches?place=b1000000-0000-4000-8000-000000000001&agent=agent:j.okafor&status=closed -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792339200, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "ea000000-0000-4000-8000-000000000a08",
      "version": 3,
      "surface": "lane.console",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "agent": "agent:j.okafor",
      "agentType": "human",
      "correlationId": "ca000000-0000-4000-8000-000000000008",
      "displayMode": "popup",
      "url": "https://ui.gatewise.example/launch/9c6f1a2b-3c4d-4e6f-8f3c-0e1b5d2a4b7e",
      "expiresAt": "2026-10-18T15:40:00Z",
      "status": "closed",
      "openedAt": "2026-10-18T15:39:10Z",
      "closedAt": "2026-10-18T15:41:02Z",
      "actions": [
        {
          "id": "eb000000-0000-4000-8000-000000000b08",
          "launch": { "id": "ea000000-0000-4000-8000-000000000a08", "className": "UiLaunch" },
          "action": "vendGate",
          "outcome": "failed",
          "occurredAt": "2026-10-18T15:40:50Z",
          "agent": "agent:j.okafor",
          "summary": "Vend refused by the lane controller: barrier in fault.",
          "correlationId": "ca000000-0000-4000-8000-000000000008"
        }
      ]
    },
    {
      "id": "ea000000-0000-4000-8000-000000000a01",
      "version": 4,
      "surface": "lane.console",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "agent": "agent:j.okafor",
      "agentType": "human",
      "correlationId": "ca000000-0000-4000-8000-000000000001",
      "displayMode": "popup",
      "url": "https://ui.gatewise.example/launch/8f3c0e1b-5d2a-4b7e-9c6f-1a2b3c4d5e6f",
      "expiresAt": "2026-10-18T14:03:12Z",
      "status": "closed",
      "openedAt": "2026-10-18T14:02:15Z",
      "closedAt": "2026-10-18T14:04:50Z",
      "actions": []
    }
  ]
}
```

A launch nobody has is 404:

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No UI launch ea000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-0000000000ff"
}
```

---

## UIL-09 — Throttled, and expired tokens: every route answers the same way

<!-- apx:scenario UIL-09 kind=edge ics=APX-CORE-05,APX-CORE-06 -->

**Given** a console in a retry storm, then the same console after its
token expired. **When** it hits each route. **Then** 429 `rate-limited`
with `Retry-After`, then 401 `unauthenticated`.

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "lane.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000009",
  "displayMode": "popup"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-000000000a01 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a01"
}
```

<!-- apx:request GET /v1/ui/launches?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions -->
```json
{
  "action": "other",
  "outcome": "noAction",
  "occurredAt": "2026-10-18T14:50:00Z",
  "summary": "Nothing done."
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/close -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02/close"
}
```

After the token expires:

<!-- apx:request GET /v1/ui/launches/ea000000-0000-4000-8000-000000000a01 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T15:00:00Z.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a01"
}
```

<!-- apx:request POST /v1/ui/launches -->
```json
{
  "surface": "lane.console",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000009",
  "displayMode": "popup"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T15:00:00Z.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request GET /v1/ui/launches?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T15:00:00Z.",
  "instance": "/v1/ui/launches"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions -->
```json
{
  "action": "other",
  "outcome": "noAction",
  "occurredAt": "2026-10-18T15:01:00Z",
  "summary": "Nothing done."
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T15:00:00Z.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02/actions"
}
```

<!-- apx:request POST /v1/ui/launches/ea000000-0000-4000-8000-000000000a02/close -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T15:00:00Z.",
  "instance": "/v1/ui/launches/ea000000-0000-4000-8000-000000000a02/close"
}
```
