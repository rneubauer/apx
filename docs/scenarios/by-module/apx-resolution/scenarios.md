# apx-resolution — vetting scenarios

<!-- apx:module apx-resolution tag=Resolution,Support ics=RES -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-resolution`. Gaps the spec cannot express are marked
`gap=F-RES-NN` and explained in `findings.md`; the 401 shape reuses
`F-CTL-07` from `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), entry lane 1 `b2…0001`, exit
lane 2 `b2…0002`, exit gate `c1…0002`, pay-in-lane terminal `c1…0003`,
the exit-lane intercom `c1…0005` (inventoried as SupplementalEquipment).
Harbor Deck (`b1…0002`, exit lane `b2…0003`) belongs to another operator
and is outside the token's grant. Operator organisation `a1…0001`.
Parkers: J. Smith, monthly (holder `a3…0001`, account `a4…0001`,
credential `c3…0001`, plate SYN-1234); M. Rivera, monthly (holder
`a3…0002`, credential `c3…0002`); a visitor with prepaid reservation
LKG-88214 (`e2…0014`, plate SVN-4821). Agents: `agent:j.okafor` (human),
`sup:m.reyes` (supervisor), `ai:lakeside-voicebot-02` (AI). Contexts are
`e5…`, payment links `e6…`, support interactions `e7…`, payments `e8…`,
events `e9…`, commands `d1…02NN`, sessions `c4…`, observations `f2…`;
correlation ids are `ca000000-…-00NN`, one per episode.

Every request carries `Authorization: Bearer …` with scopes
`apx.resolution:read apx.control:read apx.control:execute apx.lpr:read
apx.data:write apx.payments:write apx.reservations:manage
apx.support:manage apx.accounts:read` and `apx_places` =
`["b1000000-0000-4000-8000-000000000001"]` unless the scenario says
otherwise. Requests that create resources send the create shape; `id`,
`version`, `status`, and `confirmationLevel` are server-assigned. All
timestamps are RFC 3339 UTC on 2026-09-24.

---

## RES-01 — The intercom at exit lane 2 becomes a context before anyone speaks

<!-- apx:scenario RES-01 kind=happy ics=APX-RES-01,APX-RES-03,APX-RES-05 -->

**Given** J. Smith, a monthly parker with a $185.00 balance hold, is
denied at exit lane 2 and presses the intercom; the call platform maps
that intercom to the lane on its own side. **When** it posts the lane with
an opaque `interactionId` and a freshly minted `correlationId`. **Then**
201 with a full context: the issue classified, the live lane status, the
account section (the token holds `apx.accounts:read`), two courtesy exits
already in `recentOverrides`, and three policy decisions — a payment link
allowed, a courtesy exit refused with a machine-readable reason, and a
gate vend gated behind a supervisor. `recommendedAction` names one of the
allowed ones. Each `OverrideRecord` now says which agent granted the
earlier courtesy and why, copied from the Command (was F-RES-13).

```http
POST /v1/resolution/contexts
Content-Type: application/json
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940101",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 1,
  "computedAt": "2026-09-24T21:14:05Z",
  "status": "full",
  "interactionId": "interaction-940101",
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "monthlyCredential": {
      "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
      "cardNumber": "MC-0777",
      "accessGranted": false,
      "denialReason": "account past due",
      "lastActivity": "2026-09-24T21:13:58Z"
    }
  },
  "vehicle": { "plate": "SYN-1234", "country": "US", "stateProvince": "FL", "confidence": 0.98 },
  "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
  "holderDisplay": "J. Smith",
  "account": {
    "id": "a4000000-0000-4000-8000-000000000001",
    "version": 7,
    "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
    "accountStatus": "enabled",
    "balance": { "currencyType": "USD", "currencyValue": 185.0 },
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
  },
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "outstandingBalance",
    "reasonDisplay": "Monthly account has an outstanding balance.",
    "occurredAt": "2026-09-24T21:13:58Z"
  },
  "recentOverrides": [
    {
      "commandType": "courtesyExit",
      "command": { "id": "d1000000-0000-4000-8000-000000000201", "className": "Command" },
      "occurredAt": "2026-09-23T20:42:00Z",
      "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "agent": "agent:t.vance",
      "agentType": "human",
      "reason": "card reader fault at exit lane 2"
    },
    {
      "commandType": "courtesyExit",
      "command": { "id": "d1000000-0000-4000-8000-000000000202", "className": "Command" },
      "occurredAt": "2026-09-24T12:14:00Z",
      "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "agent": "ai:lakeside-voicebot-02",
      "agentType": "ai",
      "reason": "balance hold; payment link undeliverable"
    }
  ],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "courtesyLimitReached",
        "display": "Two courtesy exits have already been provided within the previous 48 hours.",
        "policy": "max-two-courtesy-exits-48h"
      }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "balanceHoldVendGated",
        "display": "Vending for an account on balance hold needs a supervisor.",
        "policy": "balance-hold-vend-supervisor"
      }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "Courtesy limit reached; a balance payment clears the hold immediately."
  },
  "recordInfo": {
    "creationTime": "2026-09-24T21:14:05Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "callcenter-platform"
  }
}
```

---

## RES-02 — Preloading: the server creates the context on the second denial

<!-- apx:scenario RES-02 kind=lifecycle ics=APX-RES-01 -->

**Given** M. Rivera badges twice at entry lane 1 and is denied twice.
**When** the PARCS creates a context on its own (§17.2 preloading) and
publishes `apx.resolution.context.created.v1`, bound to the place per
Part 8 §8.5 by `data.place`. **Then** the agent console receives the
envelope before the call is answered, reads the context by id, and gets
the same `version: 1` because nothing material changed.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ResolutionContext at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000001",
  "type": "apx.resolution.context.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ResolutionContext" },
  "time": "2026-09-24T07:52:11Z",
  "data": {
    "id": "e5000000-0000-4000-8000-000000000002",
    "version": 1,
    "computedAt": "2026-09-24T07:52:11Z",
    "status": "full",
    "issue": { "code": "passbackViolation", "display": "Credential denied at entry — anti-passback violation" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
    "allowedActions": [
      {
        "action": "resetPassback",
        "target": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
        "allowed": true,
        "execution": { "type": "control", "command": "resetPassback" }
      }
    ],
    "recommendedAction": { "action": "resetPassback" }
  },
  "extensions": {
    "apds-ext:apx:correlation@1.0": { "correlationId": "ca000000-0000-4000-8000-000000000002" }
  }
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 1,
  "computedAt": "2026-09-24T07:52:11Z",
  "status": "full",
  "correlationId": "ca000000-0000-4000-8000-000000000002",
  "issue": { "code": "passbackViolation", "display": "Credential denied at entry — anti-passback violation" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "holder": { "id": "a3000000-0000-4000-8000-000000000002", "className": "RightHolder" },
  "holderDisplay": "M. Rivera",
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
  "allowedActions": [
    {
      "action": "resetPassback",
      "display": "Reset anti-passback state",
      "target": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "resetPassback" }
    }
  ],
  "recommendedAction": { "action": "resetPassback", "reason": "Recorded presence contradicts a vehicle at an entry lane." }
}
```

---

## RES-03 — "I lost my ticket": a plate over chat finds the entry

<!-- apx:scenario RES-03 kind=happy ics=APX-RES-01,APX-RES-05 -->

**Given** a driver on the web chat says they lost their ticket and types
their plate; the chat platform knows the garage but no lane. **When** it
posts `plate` + `place`. **Then** the entry LPR read resolves the open
session, so no lost-ticket fee is needed: policy allows a payment link on
the session for the true amount and lists nothing physical, because no
lane is known. `laneStatus` is absent — graceful degradation, not an
error.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "chat-77310",
  "correlationId": "ca000000-0000-4000-8000-000000000003",
  "channel": "chat",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "plate": "SYN-7781"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000003",
  "version": 1,
  "computedAt": "2026-09-24T18:02:40Z",
  "status": "full",
  "interactionId": "chat-77310",
  "correlationId": "ca000000-0000-4000-8000-000000000003",
  "issue": { "code": "lostTicket", "display": "Customer cannot present the entry ticket; session found by plate" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "vehicle": {
    "plate": "SYN-7781",
    "country": "US",
    "stateProvince": "FL",
    "confidence": 0.95,
    "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0031/plate.jpg"
  },
  "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link for the open session",
      "target": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "Entry read at 13:41 matched the plate; the session prices from its true entry, no lost-ticket fee."
  }
}
```

---

## RES-04 — Paid ticket, gate did not open: the AI agent presses one button and claims no more than the sensor confirms

<!-- apx:scenario RES-04 kind=happy ics=APX-RES-03,APX-RES-05 -->

**Given** a driver at exit lane 2 reads a ticket number to the voice bot
after a paid ticket failed to vend. **When** the bot posts `ticketNumber`
+ `place`. **Then** the context shows the ticket paid in full and the
gate healthy, policy allows a single `vendGate` and refuses a hold-open,
and the bot executes exactly the recommended action with `agentType: ai`.
At `confirmationLevel: accepted` the bot may say only "I have sent the
open command"; after the poll shows `physicallyConfirmed` it may say
"the gate is open".

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940104",
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "channel": "voice",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-58201"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000004",
  "version": 1,
  "computedAt": "2026-09-24T20:41:12Z",
  "status": "full",
  "interactionId": "interaction-940104",
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "issue": { "code": "gateVendFailed", "display": "Ticket is paid in full but the exit gate did not open" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-58201",
      "session": { "id": "c4000000-0000-4000-8000-000000000021", "className": "Session" },
      "issuedTime": "2026-09-24T17:02:44Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 0.0 },
      "paidInFull": true
    }
  },
  "session": { "id": "c4000000-0000-4000-8000-000000000021", "className": "Session" },
  "devices": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T20:41:05Z",
      "stateChangedTime": "2026-09-24T06:00:12Z"
    }
  ],
  "allowedActions": [
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "vendGate" }
    },
    {
      "action": "holdGateOpen",
      "display": "Hold gate open",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "holdGateOpen" },
      "reason": {
        "code": "holdOpenRestricted",
        "display": "Hold-open is reserved for supervised event-egress mode.",
        "policy": "hold-open-event-mode-only"
      }
    }
  ],
  "recommendedAction": {
    "action": "vendGate",
    "reason": "Ticket T-58201 is paid in full and the gate reports available; one vend clears the lane."
  }
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0004-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "reason": "gateVendFailed — ticket T-58201 paid in full, gate did not cycle",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "expiryTime": "2026-09-24T20:44:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000204",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "reason": "gateVendFailed — ticket T-58201 paid in full, gate did not cycle",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "expiryTime": "2026-09-24T20:44:00Z",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:41:40Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:41:40Z", "actor": "lakeside-parcs" }
  ]
}
```

Two seconds later the bot polls before it speaks:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000204 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000204",
  "version": 5,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000004",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:41:40Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:41:40Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T20:41:41Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T20:41:41Z", "actor": "gate-c1000000-0002" },
    { "state": "succeeded", "time": "2026-09-24T20:41:43Z", "actor": "gate-c1000000-0002", "detail": "barrier raised — gate-state sensor reports open" }
  ]
}
```

---

## RES-05 — Card declined at the pay-in-lane terminal: the payment link is the way out

<!-- apx:scenario RES-05 kind=happy ics=APX-RES-01,APX-RES-03,APX-RES-05 -->

**Given** a transient parker's card is declined twice at terminal
`c1…0003`; the terminal's help button is inventoried, so the platform
anchors the interaction to the `device`. **When** the agent sends a
payment link for the ticket, the console retries after a timeout with
the same key, a bug reuses the key with a different body, a client sends
an unsupported channel, and a read-only token tries. **Then** 201, 200
with the ORIGINAL link, 409 `idempotency-conflict`, 400
`invalid-request` (registered since F-RES-01), and 403
`insufficient-scope`. The link never carries a
PAN; `sentTo` is masked.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940105",
  "correlationId": "ca000000-0000-4000-8000-000000000005",
  "channel": "intercom",
  "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000005",
  "version": 1,
  "computedAt": "2026-09-24T21:38:20Z",
  "status": "full",
  "interactionId": "interaction-940105",
  "correlationId": "ca000000-0000-4000-8000-000000000005",
  "issue": { "code": "paymentDeclined", "display": "Card payment declined at the exit lane terminal" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-61077",
      "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
      "issuedTime": "2026-09-24T13:11:03Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 18.0 },
      "paidInFull": false
    }
  },
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "payments": [
    {
      "id": "e8000000-0000-4000-8000-000000000051",
      "transactionID": "TXN-2026-090144",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T21:37:02Z",
      "amount": { "currencyType": "USD", "currencyValue": 18.0 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "declined",
      "ticketNumber": "T-61077",
      "cardLast4": "4242"
    }
  ],
  "devices": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T21:38:12Z"
    }
  ],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "sessionUnpaid",
        "display": "The session has an outstanding amount due; free vends for unpaid transient sessions are not permitted.",
        "policy": "no-vend-while-unpaid"
      }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "The terminal declined the card twice; a hosted link accepts another card without holding the lane."
  }
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0005-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000005", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000005"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000005",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.0 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "sent",
  "expiresAt": "2026-09-24T22:38:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000005", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000005"
}
```

The 201 never reached the console; it retries with the same key and body:

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0005-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000005", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000005"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000005",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.0 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "opened",
  "expiresAt": "2026-09-24T22:38:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000005", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000005"
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0005-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "email"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key ctx-e5-0005-paylink was first used at 2026-09-24T21:39:02Z with channel sms.",
  "instance": "/v1/payment-links"
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0005-paylink-fax
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "fax"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "channel fax is not a supported delivery channel at this place (sms, email).",
  "instance": "/v1/payment-links"
}
```

```http
POST /v1/payment-links
Authorization: Bearer <apx.resolution:read only>
Idempotency-Key: ctx-e5-0005-paylink-ro
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/payment-links requires scope apx.payments:write; token carries apx.resolution:read.",
  "instance": "/v1/payment-links"
}
```

---

## RES-06 — "The restaurant validated me": a ticket number, a provider check, a command

<!-- apx:scenario RES-06 kind=happy ics=APX-RES-03,APX-RES-05 -->

**Given** a driver at exit lane 2 sees $14.00 due and claims a Harbor
Restaurant validation. **When** the agent posts the ticket number and the
lane. **Then** the context shows an unvalidated ticket, policy allows
`applyValidation` and refuses a vend, and the execution descriptor sends
the agent to the command plane with the context and correlation id
attached. The AI classifies and proposes; the server decided.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940106",
  "correlationId": "ca000000-0000-4000-8000-000000000006",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "ticketNumber": "T-70443"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000006",
  "version": 1,
  "computedAt": "2026-09-24T20:12:44Z",
  "status": "full",
  "interactionId": "interaction-940106",
  "correlationId": "ca000000-0000-4000-8000-000000000006",
  "issue": { "code": "validationMissing", "display": "Customer reports a merchant validation that is not applied to the ticket" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-70443",
      "session": { "id": "c4000000-0000-4000-8000-000000000023", "className": "Session" },
      "issuedTime": "2026-09-24T17:48:19Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 14.0 },
      "paidInFull": false,
      "validations": []
    }
  },
  "allowedActions": [
    {
      "action": "applyValidation",
      "display": "Apply merchant validation",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "applyValidation" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "sessionUnpaid",
        "display": "A validation adjusts the amount due; it does not waive the remainder.",
        "policy": "no-vend-while-unpaid"
      }
    }
  ],
  "recommendedAction": {
    "action": "applyValidation",
    "reason": "The ticket carries no validation; if the claimed provider is on the place's list, apply it and requote."
  }
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0006-validation
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-70443",
    "provider": { "id": "a2000000-0000-4000-8000-000000000012", "className": "Organisation" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "validationMissing — Harbor Restaurant validation not applied at merchant",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000006", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000006"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000206",
  "version": 2,
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-70443",
    "provider": { "id": "a2000000-0000-4000-8000-000000000012", "className": "Organisation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "validationMissing — Harbor Restaurant validation not applied at merchant",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000006", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000006",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:13:30Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:13:30Z", "actor": "lakeside-parcs" }
  ]
}
```

---

## RES-07 — Rate dispute: the policy decisions bind the command plane

<!-- apx:scenario RES-07 kind=refusal ics=APX-RES-03,APX-RES-04 -->

**Given** a context whose policy says `pushRate` requires supervisor
approval, `holdGateOpen` is not allowed, and `closeLane` is not listed at
all. **When** the agent pushes the corrected table without approval, then
with it; the AI agent tries the hold-open; and a console sends a
`closeLane` naming the context. **Then** 403 `approval-required`, 202,
403 `action-not-allowed`, and — for the unlisted type — 403
`action-not-allowed`, which Part 17 §17.3 now requires: not offered by
the named context is not allowed (was F-RES-11).

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940107",
  "correlationId": "ca000000-0000-4000-8000-000000000007",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000007",
  "version": 1,
  "computedAt": "2026-09-24T15:22:08Z",
  "status": "full",
  "interactionId": "interaction-940107",
  "correlationId": "ca000000-0000-4000-8000-000000000007",
  "issue": { "code": "rateDispute", "display": "Amount due does not match the expected rate calculation" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-81290",
      "session": { "id": "c4000000-0000-4000-8000-000000000024", "className": "Session" },
      "issuedTime": "2026-09-24T11:05:37Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 45.0 },
      "paidInFull": false
    }
  },
  "allowedActions": [
    {
      "action": "pushRate",
      "display": "Push corrected rate table",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "execution": { "type": "control", "command": "pushRate" },
      "reason": {
        "code": "rateChangeRequiresApproval",
        "display": "A rate-table push reprices every transaction at the target; supervisor approval is required.",
        "policy": "rate-push-supervisor-approval"
      }
    },
    {
      "action": "holdGateOpen",
      "display": "Hold gate open",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "holdGateOpen" },
      "reason": {
        "code": "holdOpenRestricted",
        "display": "Hold-open is reserved for supervised event-egress mode.",
        "policy": "hold-open-event-mode-only"
      }
    },
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "c4000000-0000-4000-8000-000000000024", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    }
  ],
  "recommendedAction": {
    "action": "pushRate",
    "reason": "The active table does not match the schedule; correcting it reprices this ticket and every one behind it."
  }
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0007-pushrate-a
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 12, "className": "RateTable" } },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000007", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000007"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/approval-required",
  "title": "Approval required",
  "status": 403,
  "detail": "Context e5000000-0000-4000-8000-000000000007 allows pushRate only with approval by role supervisor; no approval evidence supplied.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0007-pushrate-b
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 12, "className": "RateTable" } },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "rateDispute — event flat-rate table left active after last night's concert",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T15:25:40Z", "note": "Schedule confirms the standard table today." },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000007", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000007"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000207",
  "version": 2,
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 12, "className": "RateTable" } },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "rateDispute — event flat-rate table left active after last night's concert",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T15:25:40Z", "note": "Schedule confirms the standard table today." },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000007", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000007",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T15:26:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T15:26:02Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0007-hold
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "agent": "ai:lakeside-voicebot-02",
  "agentType": "ai",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000007", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000007"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/action-not-allowed",
  "title": "Action not allowed by policy",
  "status": 403,
  "detail": "Context e5000000-0000-4000-8000-000000000007 evaluated holdGateOpen as allowed=false (holdOpenRestricted).",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0007-close
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "closeLane",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000007", "className": "ResolutionContext" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/action-not-allowed",
  "title": "Action not allowed by policy",
  "status": 403,
  "detail": "closeLane is not among the actions evaluated for context e5000000-0000-4000-8000-000000000007; this server treats an unlisted action as not allowed.",
  "instance": "/v1/commands"
}
```

---

## RES-08 — "It says I'm already inside": passback read, reset, re-read

<!-- apx:scenario RES-08 kind=happy ics=APX-RES-07,APX-RES-01,APX-RES-05 -->

**Given** M. Rivera's credential is recorded `inside` because yesterday's
exit was attendant-waved and never read. **When** the platform posts the
credential and the entry lane, the console refreshes the passback overlay
on its own read, the agent issues `resetPassback`, and re-reads. **Then**
the context's `passback` section says why, policy allows the reset and
refuses a blind vend, and the overlay returns to `normal` with no
override counted against courtesy policy.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940108",
  "correlationId": "ca000000-0000-4000-8000-000000000008",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000008",
  "version": 1,
  "computedAt": "2026-09-24T07:52:11Z",
  "status": "full",
  "interactionId": "interaction-940108",
  "correlationId": "ca000000-0000-4000-8000-000000000008",
  "issue": { "code": "passbackViolation", "display": "Credential denied at entry — anti-passback violation" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "holder": { "id": "a3000000-0000-4000-8000-000000000002", "className": "RightHolder" },
  "holderDisplay": "M. Rivera",
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
  "passback": {
    "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
    "state": "violation",
    "expectedPresence": "outside",
    "recordedPresence": "inside",
    "lastAccess": {
      "direction": "entry",
      "occurredAt": "2026-09-23T08:03:47Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
    }
  },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "passbackViolation",
    "reasonDisplay": "Credential is recorded as already inside.",
    "occurredAt": "2026-09-24T07:51:58Z"
  },
  "allowedActions": [
    {
      "action": "resetPassback",
      "display": "Reset anti-passback state",
      "target": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "resetPassback" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "passbackUncorrected",
        "display": "A blind vend would leave the credential in violation and strand it again tomorrow.",
        "policy": "correct-state-before-vend"
      }
    }
  ],
  "recommendedAction": {
    "action": "resetPassback",
    "reason": "Recorded presence contradicts the vehicle physically at an entry lane; a reset fixes the cause."
  }
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000002/passback -->
<!-- apx:response 200 -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
  "state": "violation",
  "expectedPresence": "outside",
  "recordedPresence": "inside",
  "lastAccess": {
    "direction": "entry",
    "occurredAt": "2026-09-23T08:03:47Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
  }
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0008-reset
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "resetPassback",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" } },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "exit never recorded 2026-09-23 (attendant-directed exit); customer at entry lane 1",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000008", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000008"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000208",
  "version": 2,
  "commandType": "resetPassback",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" } },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "exit never recorded 2026-09-23 (attendant-directed exit); customer at entry lane 1",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000008", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000008",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T07:53:20Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T07:53:20Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000002/passback -->
<!-- apx:response 200 -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
  "state": "normal",
  "expectedPresence": "outside",
  "recordedPresence": "outside",
  "lastAccess": {
    "direction": "entry",
    "occurredAt": "2026-09-23T08:03:47Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
  }
}
```

---

## RES-09 — forceOut, forceIn, and a credential nobody tracks

<!-- apx:scenario RES-09 kind=lifecycle ics=APX-RES-07 -->

**Given** a night of construction egress where the attendant waved out
forty monthly cars. **When** the supervisor forces one credential
`outside` after the fact, later forces it `inside` when the driver is
physically parked and the entry read was missed, and the console asks
for the passback status of a transient credential the site does not
track, and of an id that does not exist. **Then** 202, 200 `outside`,
202, 200 `state: unknown` for the untracked credential, and 404 only for
the unknown id (Part 17 §17.8; was F-RES-07).

```http
POST /v1/commands
Idempotency-Key: sup-0093-forceout
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "forceOut",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" } },
  "agent": "sup:m.reyes",
  "agentType": "human",
  "reason": "attendant-directed egress 2026-09-23 22:10–22:40; no exit reads",
  "correlationId": "ca000000-0000-4000-8000-000000000009"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000209",
  "version": 2,
  "commandType": "forceOut",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" } },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "sup:m.reyes",
  "agentType": "human",
  "reason": "attendant-directed egress 2026-09-23 22:10–22:40; no exit reads",
  "correlationId": "ca000000-0000-4000-8000-000000000009",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T06:10:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T06:10:00Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000001/passback -->
<!-- apx:response 200 -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "state": "normal",
  "expectedPresence": "outside",
  "recordedPresence": "outside",
  "lastAccess": {
    "direction": "entry",
    "occurredAt": "2026-09-23T08:15:02Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
  }
}
```

```http
POST /v1/commands
Idempotency-Key: sup-0094-forcein
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "forceIn",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" } },
  "agent": "sup:m.reyes",
  "agentType": "human",
  "reason": "vehicle confirmed on level 2 by patrol; entry reader offline 08:00–08:20"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000210",
  "version": 2,
  "commandType": "forceIn",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": { "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" } },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "sup:m.reyes",
  "agentType": "human",
  "reason": "vehicle confirmed on level 2 by patrol; entry reader offline 08:00–08:20",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T08:31:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T08:31:10Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-0000000000fe/passback -->
<!-- apx:response 200 -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-0000000000fe", "className": "Credential" },
  "state": "unknown"
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-0000000000ff/passback -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential c3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/c3000000-0000-4000-8000-0000000000ff/passback"
}
```

---

## RES-10 — "I prepaid but it wants full price": candidates, correction, re-read

<!-- apx:scenario RES-10 kind=happy ics=APX-RES-08,APX-RES-01,APX-RES-05 -->

**Given** the entry camera read SVN-4821 as 5VN-4B21 at 0.41, so the
reservation never linked. **When** the platform posts the lane plus the
reservation code the customer reads out, the agent lists the lane's
candidates since the exit approach, writes the top one to the session
citing its Observation, and re-reads the context. **Then** the context
names the unlinked reservation and allows only the plate correction;
the candidates come best-first with access-controlled imagery; the PUT
returns the corrected association; and the re-read is `version: 2` with
access granted and nothing left to do.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940110",
  "correlationId": "ca000000-0000-4000-8000-000000000010",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reservationCode": "LKG-88214"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000010",
  "version": 1,
  "computedAt": "2026-09-24T22:41:37Z",
  "status": "full",
  "interactionId": "interaction-940110",
  "correlationId": "ca000000-0000-4000-8000-000000000010",
  "issue": { "code": "reservationMismatch", "display": "Prepaid reservation exists but is not linked to the current session (misread plate)" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "vehicle": { "plate": "5VN-4B21", "country": "US", "stateProvince": "FL", "confidence": 0.41 },
  "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
  "reservation": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
    "reservationState": "confirmed",
    "plannedStart": "2026-09-24T17:30:00Z",
    "plannedEnd": "2026-09-24T23:30:00Z"
  },
  "allowedActions": [
    {
      "action": "put-apx-v1-sessions-id-plate",
      "display": "Correct the session's plate",
      "target": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "put-apx-v1-sessions-id-plate" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "sessionUnsettled",
        "display": "The session is unpaid; correcting the plate links the prepaid reservation and settles it.",
        "policy": "no-vend-on-unsettled-session"
      }
    }
  ],
  "recommendedAction": {
    "action": "put-apx-v1-sessions-id-plate",
    "reason": "The entry read is low-confidence and a confirmed reservation exists for tonight; the plate is the link."
  }
}
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002&since=2026-09-24T22:30:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790289700, "offset": 0, "pageSize": 50, "total": 2 },
  "data": [
    {
      "plate": "SVN-4821",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.97,
      "observationDateTime": "2026-09-24T22:39:04Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/plate.jpg",
      "vehicleImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/vehicle.jpg"
    },
    {
      "plate": "5VN-4B21",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.41,
      "observationDateTime": "2026-09-24T17:41:22Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" }
    }
  ]
}
```

```http
PUT /v1/sessions/c4000000-0000-4000-8000-000000000031/plate
Content-Type: application/json
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
  "reason": "entry LPR misread (0.41); corrected from exit-lane candidate confirmed by customer"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" }
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000010 -->
<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000010",
  "version": 2,
  "computedAt": "2026-09-24T22:43:10Z",
  "status": "full",
  "interactionId": "interaction-940110",
  "correlationId": "ca000000-0000-4000-8000-000000000010",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "vehicle": { "plate": "SVN-4821", "country": "US", "stateProvince": "FL", "confidence": 0.97 },
  "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
  "reservation": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
    "reservationState": "checkedIn",
    "plannedStart": "2026-09-24T17:30:00Z",
    "plannedEnd": "2026-09-24T23:30:00Z"
  },
  "accessDecision": {
    "status": "granted",
    "reasonDisplay": "Prepaid reservation applied; amount due 0.00.",
    "occurredAt": "2026-09-24T22:43:02Z"
  },
  "allowedActions": []
}
```

---

## RES-11 — No plate on the session: the engine's second choice was the right one

<!-- apx:scenario RES-11 kind=happy ics=APX-RES-08 -->

**Given** a session opened with a plate the engine could not settle on;
the back-office console already holds the session id. **When** it
resolves a context by `session` alone, the agent lists candidates by
`session`, sees the winning read carried `alternateReads` in its Part 13
§13.3a detail, and writes the alternate; then a console asks for
candidates with neither `session` nor `lane`, a BI token without
`apx.lpr:read` asks, and someone corrects a session that does not exist.
**Then** 201 classified `plateUnresolved`, 200, 200, 400
`invalid-request` (registered since F-RES-01), 403
`insufficient-scope`, 404 `target-not-found`.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "backoffice-5510",
  "correlationId": "ca000000-0000-4000-8000-000000000011",
  "channel": "web",
  "session": { "id": "c4000000-0000-4000-8000-000000000041", "className": "Session" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000011",
  "version": 1,
  "computedAt": "2026-09-24T14:18:30Z",
  "status": "full",
  "interactionId": "backoffice-5510",
  "correlationId": "ca000000-0000-4000-8000-000000000011",
  "issue": { "code": "plateUnresolved", "display": "Session carries a low-confidence plate association (0.58)" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "vehicle": { "plate": "RVR-8821", "country": "US", "stateProvince": "IL", "confidence": 0.58 },
  "session": { "id": "c4000000-0000-4000-8000-000000000041", "className": "Session" },
  "allowedActions": [
    {
      "action": "put-apx-v1-sessions-id-plate",
      "display": "Correct the session's plate",
      "target": { "id": "c4000000-0000-4000-8000-000000000041", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "put-apx-v1-sessions-id-plate" }
    }
  ],
  "recommendedAction": {
    "action": "put-apx-v1-sessions-id-plate",
    "reason": "The entry read is below the 0.80 association threshold; review the candidates and confirm with the customer."
  }
}
```

<!-- apx:request GET /v1/lpr/candidates?session=c4000000-0000-4000-8000-000000000041 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "plate": "RVR-8821",
      "stateProvince": "IL",
      "confidence": 0.58,
      "observationDateTime": "2026-09-24T14:12:08Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0041/plate.jpg",
      "detail": {
        "plate": { "value": "RVR-8821", "confidence": 0.58 },
        "stateProvince": { "value": "IL", "confidence": 0.88 },
        "alternateReads": [
          { "plate": "RVR-8B21", "stateProvince": "IL", "confidence": 0.55 },
          { "plate": "PVR-8821", "stateProvince": "IL", "confidence": 0.21 }
        ],
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "receding",
        "engine": "vendor-x/7.2"
      }
    }
  ]
}
```

The customer reads "R-V-R eight B two one" off their registration; the
agent picks the alternate:

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate -->
```json
{
  "plate": "RVR-8B21",
  "country": "US",
  "stateProvince": "IL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
  "reason": "plateUnresolved — engine alternate read confirmed against customer registration"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000041", "className": "Session" },
  "plate": "RVR-8B21",
  "country": "US",
  "stateProvince": "IL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" }
}
```

<!-- apx:request GET /v1/lpr/candidates?since=2026-09-24T14:00:00Z -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Identifier required",
  "status": 400,
  "detail": "GET /v1/lpr/candidates needs session or lane.",
  "instance": "/v1/lpr/candidates"
}
```

```http
GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/lpr/candidates requires scope apx.lpr:read; token carries apx.data:read.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-0000000000ff/plate -->
```json
{
  "plate": "RVR-8B21"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No session c4000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-0000000000ff/plate"
}
```

---

## RES-12 — Barcode-only reservation: the explicit session ↔ right link

<!-- apx:scenario RES-12 kind=happy ics=APX-RES-01,APX-RES-05 -->

**Given** Harbor Restaurant's shuttle lot sells barcode reservations and
the customer's code was never scanned at entry, so no plate can carry
the link. **When** the context resolves the reservation from the code and
the agent applies the link with the code as evidence. **Then** policy
lists `put-apx-v1-sessions-id-assigned-right` as the domain action, the
PUT returns the applied link, and the prepaid rate follows from the
implementation's normal rating.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940112",
  "correlationId": "ca000000-0000-4000-8000-000000000012",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reservationCode": "LKG-90031"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000012",
  "version": 1,
  "computedAt": "2026-09-24T23:02:15Z",
  "status": "full",
  "interactionId": "interaction-940112",
  "correlationId": "ca000000-0000-4000-8000-000000000012",
  "issue": { "code": "reservationMismatch", "display": "Prepaid reservation exists but is not linked to the current session (code not scanned)" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "session": { "id": "c4000000-0000-4000-8000-000000000032", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" },
  "reservation": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" },
    "reservationState": "confirmed",
    "plannedStart": "2026-09-24T18:00:00Z",
    "plannedEnd": "2026-09-25T01:00:00Z"
  },
  "allowedActions": [
    {
      "action": "put-apx-v1-sessions-id-assigned-right",
      "display": "Link the reservation to this session",
      "target": { "id": "c4000000-0000-4000-8000-000000000032", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "put-apx-v1-sessions-id-assigned-right" }
    }
  ],
  "recommendedAction": {
    "action": "put-apx-v1-sessions-id-assigned-right",
    "reason": "No plate was read at entry; the barcode reservation must be linked explicitly."
  }
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" },
  "reservationCode": "LKG-90031",
  "reason": "code not scanned at entry; customer presented confirmation"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000032", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" }
}
```

---

## RES-13 — The link is refused: consumed, unknown, or out of scope

<!-- apx:scenario RES-13 kind=refusal ics=APX-RES-01 -->

**Given** three more link attempts. **When** the reservation was already
consumed by another session earlier tonight, the AssignedRight id does
not exist, and a token without `apx.reservations:manage` tries. **Then**
409 `right-not-linkable`, 404 `target-not-found`, 403
`insufficient-scope`. Nothing materializes in the APDS Session in any of
the three.

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" },
  "reservationCode": "LKG-90031"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "AssignedRight e2000000-0000-4000-8000-000000000015 was consumed by session c4000000-0000-4000-8000-000000000032 at 2026-09-24T23:03:40Z.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-0000000000ff", "className": "AssignedRight" }
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No AssignedRight e2000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right"
}
```

```http
PUT /v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right
Authorization: Bearer <apx.resolution:read apx.data:write>
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000016", "className": "AssignedRight" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/sessions/{id}/assigned-right requires scope apx.reservations:manage.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000033/assigned-right"
}
```

---

## RES-14 — "The machine won't take my card": the fault is in `devices[]` before anyone retries

<!-- apx:scenario RES-14 kind=happy ics=APX-RES-03,APX-RES-05 -->

**Given** the pay-in-lane terminal's card reader faulted four minutes
ago. **When** the intercom call resolves the lane. **Then** the context
carries the live device overlay, policy allows a free vend because the
fault is the operator's, gates a remote restart behind a maintenance
role, and recommends the vend. Where `apx-alerts` is deployed the fault
already raised an alert; this module only needs to show it.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940114",
  "correlationId": "ca000000-0000-4000-8000-000000000014",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000014",
  "version": 1,
  "computedAt": "2026-09-24T19:22:48Z",
  "status": "full",
  "interactionId": "interaction-940114",
  "correlationId": "ca000000-0000-4000-8000-000000000014",
  "issue": { "code": "equipmentFault", "display": "Exit lane 2 payment terminal is reporting a fault" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "session": { "id": "c4000000-0000-4000-8000-000000000042", "className": "Session" },
  "devices": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "deviceState": "fault",
      "lastCommunication": "2026-09-24T19:22:40Z",
      "stateChangedTime": "2026-09-24T19:18:31Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T19:22:41Z"
    }
  ],
  "allowedActions": [
    {
      "action": "vendGate",
      "display": "Vend gate (equipment fault)",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "vendGate" }
    },
    {
      "action": "restartDevice",
      "display": "Restart payment terminal",
      "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "maintenance",
      "execution": { "type": "control", "command": "restartDevice" },
      "reason": {
        "code": "maintenanceApprovalRequired",
        "display": "Remote restarts of payment devices require maintenance approval.",
        "policy": "payment-device-restart-gated"
      }
    }
  ],
  "recommendedAction": {
    "action": "vendGate",
    "reason": "Terminal faulted mid-transaction; operator policy grants exit on equipment fault rather than holding the lane."
  }
}
```

---

## RES-15 — The account service is slow: partial first, full on re-read

<!-- apx:scenario RES-15 kind=lifecycle ics=APX-RES-02,APX-RES-03 -->

**Given** the operator's account service is answering in eight seconds
tonight. **When** the platform resolves a monthly credential at exit lane
2. **Then** the server answers within its budget with `status: partial`,
names the sources still resolving, classifies the issue as `unknown`,
and lists no actions rather than guessing; the re-read a few seconds
later is `full`, `version: 2`, classified, with decisions; and the cheap
`allowed-actions` read returns the same decisions as `data[]`.

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940115",
  "correlationId": "ca000000-0000-4000-8000-000000000015",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000015",
  "version": 1,
  "computedAt": "2026-09-24T23:40:01Z",
  "status": "partial",
  "pendingSources": [ "account-service", "payment-history" ],
  "interactionId": "interaction-940115",
  "correlationId": "ca000000-0000-4000-8000-000000000015",
  "issue": { "code": "unknown", "display": "Denial at exit lane 2; account state not yet available" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "outstandingBalance",
    "occurredAt": "2026-09-24T23:39:52Z"
  },
  "allowedActions": []
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000015 -->
<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000015",
  "version": 2,
  "computedAt": "2026-09-24T23:40:09Z",
  "status": "full",
  "interactionId": "interaction-940115",
  "correlationId": "ca000000-0000-4000-8000-000000000015",
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
  "holderDisplay": "J. Smith",
  "account": {
    "id": "a4000000-0000-4000-8000-000000000001",
    "version": 7,
    "accountStatus": "enabled",
    "balance": { "currencyType": "USD", "currencyValue": 185.0 }
  },
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "outstandingBalance",
    "reasonDisplay": "Monthly account has an outstanding balance.",
    "occurredAt": "2026-09-24T23:39:52Z"
  },
  "payments": [],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "courtesyLimitReached",
        "display": "Two courtesy exits have already been provided within the previous 48 hours.",
        "policy": "max-two-courtesy-exits-48h"
      }
    }
  ],
  "recommendedAction": { "action": "post-apx-v1-payment-links" }
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000015/allowed-actions -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "courtesyLimitReached",
        "display": "Two courtesy exits have already been provided within the previous 48 hours.",
        "policy": "max-two-courtesy-exits-48h"
      }
    }
  ]
}
```

---

## RES-16 — Time passes: decisions change, then the context expires

<!-- apx:scenario RES-16 kind=lifecycle ics=APX-RES-03,APX-RES-05 -->

**Given** the payment link from RES-01's episode was paid three minutes
after the context was computed. **When** the agent re-evaluates before
touching the gate, and — an hour and a half later — a supervisor opens
the same context from the shift log. **Then** the re-evaluation now
allows `vendGate` without approval and drops the payment link; the late
reads are 404 because contexts MAY expire (≥ 1 hour recommended) and the
caller must re-resolve. Part 17 §17.2 now says the server SHOULD record
the context version its check used in the command's audit trail and
retain those decisions after expiry; the `Command.resolutionContext`
field itself still cannot carry the version on the wire (F-RES-10, left
open for the control schema owner).

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "vendGate" }
    },
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "balanceSettled",
        "display": "The balance was paid at 21:17; a courtesy exit is no longer the right tool.",
        "policy": "courtesy-only-while-blocked"
      }
    }
  ]
}
```

Ninety minutes later:

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Context e5000000-0000-4000-8000-000000000001 expired at 2026-09-24T22:14:05Z; re-resolve with POST /v1/resolution/contexts.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Context e5000000-0000-4000-8000-000000000001 expired at 2026-09-24T22:14:05Z.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions"
}
```

---

## RES-17 — Nothing to resolve: no identifier, a phone number, an unknown ticket

<!-- apx:scenario RES-17 kind=refusal ics=APX-RES-01 -->

**Given** three broken callers. **When** one sends only `interactionId`
and `channel` (schema-valid: `minProperties: 1` counts them), one sends
the caller's phone number as if APX were a telephony system, and one
sends a ticket number no PARCS at this place ever issued. **Then** 400
`invalid-request`, 400 `invalid-request`, and 404. Part 17 §17.1 now
names the nine identifying members and says correlation metadata does
not count and unknown members are ignored (was F-RES-02); the schema
still passes the first two bodies, because narrowing `minProperties: 1`
to an `anyOf` would reject bodies existing clients send (breaking), so
the server's 400 carries the rule. `invalid-request` is registered (was
F-RES-01).

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940117",
  "channel": "intercom"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Identifier required",
  "status": 400,
  "detail": "No parking-domain identifier supplied (lane, device, place, session, holder, credential, plate, ticketNumber, or reservationCode).",
  "instance": "/v1/resolution/contexts"
}
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940118",
  "channel": "voice",
  "phoneNumber": "+15550100"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Identifier required",
  "status": 400,
  "detail": "No parking-domain identifier supplied; phoneNumber is not an APX identifier and was ignored (Part 17 §17.1). Map the call to a lane or device on the call platform first.",
  "instance": "/v1/resolution/contexts"
}
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940119",
  "channel": "chat",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "Z-000000"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No session, ticket, or reservation at Lakeside Garage matches ticketNumber Z-000000.",
  "instance": "/v1/resolution/contexts"
}
```

---

## RES-18 — Scopes and grants: projection, refusal, fail-closed, and a gated domain write

<!-- apx:scenario RES-18 kind=security ics=APX-RES-02,APX-RES-04,APX-CORE-06,APX-CORE-07,APX-CORE-08 -->

**Given** six tokens. **When** a token with `apx.resolution:read` but
without `apx.accounts:read` resolves J. Smith's denial; a BI token with
only `apx.data:read` posts a context; Harbor Deck's operator reads a
Lakeside context by id; the BI token re-evaluates actions; a Lakeside
token reads passback for a credential whose last access was at Harbor
Deck; a token with no `apx_places` claim resolves a lane; and an agent
corrects a plate that policy said needs a supervisor. **Then** 201 with
the `account` and `payments` sections omitted (never a privilege
escalation), 403 `insufficient-scope`, 403 `insufficient-grant`, 403
`insufficient-scope`, 403 `insufficient-grant`, 403 `insufficient-grant`
(fail-closed), and 403 `approval-required` — which the retry now
satisfies with the body's `approval` member (Part 17 §17.3; was
F-RES-04).

```http
POST /v1/resolution/contexts
Authorization: Bearer <apx.resolution:read apx.control:read; no apx.accounts:read>
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940120",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000020",
  "version": 1,
  "computedAt": "2026-09-24T21:14:05Z",
  "status": "full",
  "interactionId": "interaction-940120",
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "monthlyCredential": {
      "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
      "accessGranted": false,
      "denialReason": "account past due"
    }
  },
  "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
  "holderDisplay": "J. Smith",
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "outstandingBalance",
    "reasonDisplay": "Monthly account has an outstanding balance.",
    "occurredAt": "2026-09-24T21:13:58Z"
  },
  "allowedActions": [
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "balanceHoldVendGated",
        "display": "Vending for an account on balance hold needs a supervisor.",
        "policy": "balance-hold-vend-supervisor"
      }
    }
  ]
}
```

```http
POST /v1/resolution/contexts
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/resolution/contexts requires scope apx.resolution:read; token carries apx.data:read.",
  "instance": "/v1/resolution/contexts"
}
```

```http
GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000002"]>
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Context e5000000-0000-4000-8000-000000000001 is anchored to place b1000000-0000-4000-8000-000000000001, which is not in the token's apx_places grant.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001"
}
```

```http
GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/resolution/contexts/{id}/allowed-actions requires scope apx.resolution:read; token carries apx.data:read.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions"
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000077/passback -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential c3000000-0000-4000-8000-000000000077 last accessed place b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/c3000000-0000-4000-8000-000000000077/passback"
}
```

```http
POST /v1/resolution/contexts
Authorization: Bearer <no apx_places claim at all>
```

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/resolution/contexts"
}
```

The context for session `c4…0043` listed `put-apx-v1-sessions-id-plate`
with `requiresApproval: true` (the session already has a payment
posted). The agent writes anyway:

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000043/plate -->
```json
{
  "plate": "KLM-2210",
  "country": "US",
  "stateProvince": "FL",
  "reason": "customer states plate; no candidate read available"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/approval-required",
  "title": "Approval required",
  "status": 403,
  "detail": "Context e5000000-0000-4000-8000-000000000043 allows put-apx-v1-sessions-id-plate only with approval by role supervisor; no approval evidence supplied.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000043/plate"
}
```

The supervisor approves and the agent retries with the evidence:

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000043/plate -->
```json
{
  "plate": "KLM-2210",
  "country": "US",
  "stateProvince": "FL",
  "reason": "customer states plate; no candidate read available",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T21:31:05Z", "note": "Registration photo checked." }
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000043", "className": "Session" },
  "plate": "KLM-2210",
  "country": "US",
  "stateProvince": "FL",
  "version": 5
}
```

---

## RES-19 — Recording the interaction: a human, the event, and an AI that says only what was confirmed

<!-- apx:scenario RES-19 kind=happy ics=APX-RES-06 -->

**Given** J. Okafor closes the RES-01 call after the payment link was
paid, and the voice bot closes the RES-04 call after the sensor confirmed
the gate. **When** each records the interaction — summary, subjects, the
actions taken, the correlation id, and (for the human) an operator CRM
case in `extensions`. **Then** 201 each, the server assigns `id` and
`version`, publishes `apx.support.interaction.recorded.v1`, and the AI's
summary states the outcome at the confirmation level it reached, not
beyond. No transcript is stored. (An interaction opened at answer time
and completed later with `PUT /v1/support/interactions/{id}` is RES-26;
was F-RES-12.)

```http
POST /v1/support/interactions
Content-Type: application/json
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T21:14:02Z",
  "endedAt": "2026-09-24T21:18:30Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
  "subjects": {
    "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
    "account": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
    "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
    "plate": "SYN-1234"
  },
  "actions": [
    { "id": "e6000000-0000-4000-8000-000000000001", "className": "PaymentLink" }
  ],
  "interactionId": "interaction-940101",
  "resolution": { "code": "resolved", "display": "Paid and exited" },
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "extensions": {
    "apds-ext:umojo:crm-case@1.0": { "caseId": "CRM-55120", "queue": "parking-tier1" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000001",
  "version": 1,
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T21:14:02Z",
  "endedAt": "2026-09-24T21:18:30Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
  "subjects": {
    "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
    "account": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
    "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
    "plate": "SYN-1234"
  },
  "actions": [
    { "id": "e6000000-0000-4000-8000-000000000001", "className": "PaymentLink" }
  ],
  "interactionId": "interaction-940101",
  "resolution": { "code": "resolved", "display": "Paid and exited" },
  "correlationId": "ca000000-0000-4000-8000-000000000001",
  "recordInfo": {
    "creationTime": "2026-09-24T21:18:41Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "agent:j.okafor"
  },
  "extensions": {
    "apds-ext:umojo:crm-case@1.0": { "caseId": "CRM-55120", "queue": "parking-tier1" }
  }
}
```

The server publishes the record; `data.place` binds it (Part 8 §8.5).

<!-- apx:validate EventEnvelope -->
<!-- apx:validate SupportInteraction at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000019",
  "type": "apx.support.interaction.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e7000000-0000-4000-8000-000000000001", "className": "SupportInteraction" },
  "time": "2026-09-24T21:18:41Z",
  "data": {
    "id": "e7000000-0000-4000-8000-000000000001",
    "version": 1,
    "channel": "voice",
    "agentType": "human",
    "agent": "agent:j.okafor",
    "startedAt": "2026-09-24T21:14:02Z",
    "endedAt": "2026-09-24T21:18:30Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "issue": { "code": "accountBalanceDenied" },
    "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
    "interactionId": "interaction-940101",
    "resolution": { "code": "resolved" },
    "correlationId": "ca000000-0000-4000-8000-000000000001"
  },
  "extensions": {
    "apds-ext:apx:correlation@1.0": { "correlationId": "ca000000-0000-4000-8000-000000000001" }
  }
}
```

The voice bot's record for RES-04:

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "ai",
  "agent": "ai:lakeside-voicebot-02",
  "startedAt": "2026-09-24T20:41:02Z",
  "endedAt": "2026-09-24T20:42:10Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "gateVendFailed", "display": "Ticket is paid in full but the exit gate did not open" },
  "summary": "Paid ticket T-58201 failed to vend at exit lane 2; vendGate executed per policy; gate-state sensor confirmed open (physicallyConfirmed); customer told the gate is open.",
  "subjects": {
    "session": { "id": "c4000000-0000-4000-8000-000000000021", "className": "Session" }
  },
  "actions": [
    { "id": "d1000000-0000-4000-8000-000000000204", "className": "Command" }
  ],
  "interactionId": "interaction-940104",
  "resolution": { "code": "resolved", "display": "Gate vended, physically confirmed" },
  "correlationId": "ca000000-0000-4000-8000-000000000004"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000004",
  "version": 1,
  "channel": "voice",
  "agentType": "ai",
  "agent": "ai:lakeside-voicebot-02",
  "startedAt": "2026-09-24T20:41:02Z",
  "endedAt": "2026-09-24T20:42:10Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "gateVendFailed", "display": "Ticket is paid in full but the exit gate did not open" },
  "summary": "Paid ticket T-58201 failed to vend at exit lane 2; vendGate executed per policy; gate-state sensor confirmed open (physicallyConfirmed); customer told the gate is open.",
  "subjects": {
    "session": { "id": "c4000000-0000-4000-8000-000000000021", "className": "Session" }
  },
  "actions": [
    { "id": "d1000000-0000-4000-8000-000000000204", "className": "Command" }
  ],
  "interactionId": "interaction-940104",
  "resolution": { "code": "resolved", "display": "Gate vended, physically confirmed" },
  "correlationId": "ca000000-0000-4000-8000-000000000004"
}
```

---

## RES-20 — "They called twice this week": history by plate, by holder, and inside the next context

<!-- apx:scenario RES-20 kind=happy ics=APX-RES-06,APX-RES-01,APX-CORE-04 -->

**Given** the two records from RES-19 and an older one. **When** a
supervisor queries by plate, then by holder since Monday, and J. Smith
presses the intercom again on Friday. **Then** paginated lists in the
APDS `{meta, data}` shape with the CRM extension preserved verbatim
(round-trip), and the new context carries the earlier interaction in
`supportHistory` so the agent starts with the story.

<!-- apx:request GET /v1/support/interactions?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790290800, "offset": 0, "pageSize": 50, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000001",
      "version": 1,
      "channel": "voice",
      "agentType": "human",
      "agent": "agent:j.okafor",
      "startedAt": "2026-09-24T21:14:02Z",
      "endedAt": "2026-09-24T21:18:30Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
      "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
      "subjects": {
        "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
        "account": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
        "plate": "SYN-1234"
      },
      "actions": [ { "id": "e6000000-0000-4000-8000-000000000001", "className": "PaymentLink" } ],
      "interactionId": "interaction-940101",
      "resolution": { "code": "resolved", "display": "Paid and exited" },
      "correlationId": "ca000000-0000-4000-8000-000000000001",
      "extensions": {
        "apds-ext:umojo:crm-case@1.0": { "caseId": "CRM-55120", "queue": "parking-tier1" }
      }
    }
  ]
}
```

<!-- apx:request GET /v1/support/interactions?holder=a3000000-0000-4000-8000-000000000001&since=2026-09-21T00:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790290800, "offset": 0, "pageSize": 50, "total": 2 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000001",
      "version": 1,
      "channel": "voice",
      "agentType": "human",
      "agent": "agent:j.okafor",
      "startedAt": "2026-09-24T21:14:02Z",
      "endedAt": "2026-09-24T21:18:30Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "issue": { "code": "accountBalanceDenied" },
      "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
      "resolution": { "code": "resolved" },
      "correlationId": "ca000000-0000-4000-8000-000000000001",
      "extensions": {
        "apds-ext:umojo:crm-case@1.0": { "caseId": "CRM-55120", "queue": "parking-tier1" }
      }
    },
    {
      "id": "e7000000-0000-4000-8000-000000000000",
      "version": 1,
      "channel": "voice",
      "agentType": "ai",
      "agent": "ai:lakeside-voicebot-02",
      "startedAt": "2026-09-23T20:40:11Z",
      "endedAt": "2026-09-23T20:43:02Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "issue": { "code": "accountBalanceDenied" },
      "summary": "Balance hold; courtesy exit granted (second of two in 48 h).",
      "actions": [ { "id": "d1000000-0000-4000-8000-000000000201", "className": "Command" } ],
      "resolution": { "code": "resolved" }
    }
  ]
}
```

Friday, the same credential, the same lane:

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940220",
  "correlationId": "ca000000-0000-4000-8000-000000000020",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000021",
  "version": 1,
  "computedAt": "2026-09-25T21:02:33Z",
  "status": "full",
  "interactionId": "interaction-940220",
  "correlationId": "ca000000-0000-4000-8000-000000000020",
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "holder": { "id": "a3000000-0000-4000-8000-000000000001", "className": "RightHolder" },
  "holderDisplay": "J. Smith",
  "credential": { "id": "c3000000-0000-4000-8000-000000000001", "className": "Credential" },
  "supportHistory": [
    {
      "id": "e7000000-0000-4000-8000-000000000001",
      "version": 1,
      "channel": "voice",
      "agentType": "human",
      "agent": "agent:j.okafor",
      "startedAt": "2026-09-24T21:14:02Z",
      "endedAt": "2026-09-24T21:18:30Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "issue": { "code": "accountBalanceDenied" },
      "summary": "Balance hold at exit lane 2; customer paid $185.00 via payment link; exited normally.",
      "resolution": { "code": "resolved" },
      "correlationId": "ca000000-0000-4000-8000-000000000001"
    }
  ],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "a4000000-0000-4000-8000-000000000001", "className": "Account" },
      "allowed": true,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "Same holder paid by link yesterday; the autopay on file failed again this morning."
  }
}
```

---

## RES-21 — Support refusals: no filter, a bad body, wrong scope, and a retry that records twice

<!-- apx:scenario RES-21 kind=refusal ics=APX-RES-06,APX-CORE-05 -->

**Given** four misbehaving clients. **When** one lists interactions with
no subject filter, one posts `agentType: bot`, a token without
`apx.support:manage` posts and then lists, and a console whose 201 was
lost retries the identical POST under the same `Idempotency-Key`.
**Then** 400 `invalid-request` twice (registered since F-RES-01), 403
twice, and the retry is a 200 replay of the ORIGINAL record, not a
second 201 (was F-RES-08: the route now takes the optional
`Idempotency-Key`). The same key with a different body is 409
`idempotency-conflict`.

<!-- apx:request GET /v1/support/interactions -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Identifier required",
  "status": 400,
  "detail": "GET /v1/support/interactions needs at least one of plate, holder, account, session, place.",
  "instance": "/v1/support/interactions"
}
```

<!-- apx:request POST /v1/support/interactions invalid -->
```json
{
  "channel": "voice",
  "agentType": "bot",
  "startedAt": "2026-09-24T20:41:02Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "agentType must be one of human, ai.",
  "instance": "/v1/support/interactions"
}
```

```http
POST /v1/support/interactions
Authorization: Bearer <apx.resolution:read only>
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "chat",
  "agentType": "ai",
  "agent": "ai:lakeside-chatbot-01",
  "startedAt": "2026-09-24T18:02:30Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "summary": "Lost ticket; session found by plate; payment link sent."
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/support/interactions requires scope apx.support:manage; token carries apx.resolution:read.",
  "instance": "/v1/support/interactions"
}
```

```http
GET /v1/support/interactions?plate=SYN-7781
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/support/interactions?plate=SYN-7781 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/support/interactions requires scope apx.support:manage or apx.resolution:read; token carries apx.data:read.",
  "instance": "/v1/support/interactions"
}
```

The chat platform recorded RES-03's interaction under
`Idempotency-Key: rec-chat-77310` and its 201 was lost; it retries the
same body with the same key:

```http
POST /v1/support/interactions
Idempotency-Key: rec-chat-77310
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "chat",
  "agentType": "ai",
  "agent": "ai:lakeside-chatbot-01",
  "startedAt": "2026-09-24T18:02:30Z",
  "endedAt": "2026-09-24T18:06:12Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket" },
  "summary": "Lost ticket; session found by plate; payment link sent.",
  "subjects": { "plate": "SYN-7781", "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" } },
  "interactionId": "chat-77310",
  "correlationId": "ca000000-0000-4000-8000-000000000003"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000031",
  "version": 1,
  "channel": "chat",
  "agentType": "ai",
  "agent": "ai:lakeside-chatbot-01",
  "startedAt": "2026-09-24T18:02:30Z",
  "endedAt": "2026-09-24T18:06:12Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket" },
  "summary": "Lost ticket; session found by plate; payment link sent.",
  "subjects": { "plate": "SYN-7781", "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" } },
  "interactionId": "chat-77310",
  "correlationId": "ca000000-0000-4000-8000-000000000003"
}
```

A buggy client reuses the key for a different call:

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "chat",
  "agentType": "ai",
  "agent": "ai:lakeside-chatbot-01",
  "startedAt": "2026-09-24T19:15:00Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "summary": "Hours of operation question.",
  "interactionId": "chat-77402"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency conflict",
  "status": 409,
  "detail": "Idempotency-Key rec-chat-77310 was first used with a different body (interaction e7000000-0000-4000-8000-000000000031).",
  "instance": "/v1/support/interactions"
}
```

---

## RES-22 — One id from the intercom to the shift log: call → context → command → event → record

<!-- apx:scenario RES-22 kind=happy ics=APX-RES-01,APX-RES-03,APX-RES-04,APX-RES-05,APX-RES-06 -->

**Given** a supervisor asks "what happened on the 22:05 call at exit
lane 2". **When** the platform minted `ca…0022` at first contact and
every hop carried it: the resolve request, the courtesy exit (approved),
the command status event (as `extensions["apds-ext:apx:correlation@1.0"]`),
and the interaction record naming the command in `actions`. **Then** each
artefact carries the same id, and the one read that reconstructs the
episode, `GET /v1/support/interactions?correlationId=`, now exists (was
F-RES-05). The `courtesyExit` parameter name follows the F-CTL-05
proposal (`holder`).

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-940122",
  "correlationId": "ca000000-0000-4000-8000-000000000022",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000022",
  "version": 1,
  "computedAt": "2026-09-24T22:05:14Z",
  "status": "full",
  "interactionId": "interaction-940122",
  "correlationId": "ca000000-0000-4000-8000-000000000022",
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "holder": { "id": "a3000000-0000-4000-8000-000000000003", "className": "RightHolder" },
  "holderDisplay": "R. Chen",
  "credential": { "id": "c3000000-0000-4000-8000-000000000003", "className": "Credential" },
  "recentOverrides": [],
  "allowedActions": [
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "courtesyRequiresApproval",
        "display": "First courtesy exit in 48 hours; supervisor sign-off required after 22:00.",
        "policy": "courtesy-night-supervisor"
      }
    },
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "a4000000-0000-4000-8000-000000000003", "className": "Account" },
      "allowed": true,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    }
  ],
  "recommendedAction": { "action": "post-apx-v1-payment-links" }
}
```

The customer's phone is dead; the supervisor approves a courtesy exit:

```http
POST /v1/commands
Idempotency-Key: ctx-e5-0022-courtesy
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "courtesyExit",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "holder": { "id": "a3000000-0000-4000-8000-000000000003", "className": "RightHolder" } },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "balance hold; customer cannot receive a link; first courtesy in 48 h",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T22:06:30Z" },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000022",
  "expiryTime": "2026-09-24T22:09:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000222",
  "version": 2,
  "commandType": "courtesyExit",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "holder": { "id": "a3000000-0000-4000-8000-000000000003", "className": "RightHolder" } },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "balance hold; customer cannot receive a link; first courtesy in 48 h",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T22:06:30Z" },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000022",
  "expiryTime": "2026-09-24T22:09:00Z",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T22:06:41Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T22:06:41Z", "actor": "lakeside-parcs" }
  ]
}
```

The gate event arrives on the platform's subscription with the same id
in the envelope's extension container:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Command at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000022",
  "type": "apx.control.command.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d1000000-0000-4000-8000-000000000222", "className": "Command" },
  "time": "2026-09-24T22:06:44Z",
  "data": {
    "id": "d1000000-0000-4000-8000-000000000222",
    "version": 5,
    "commandType": "courtesyExit",
    "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
    "correlationId": "ca000000-0000-4000-8000-000000000022",
    "status": "succeeded",
    "confirmationLevel": "physicallyConfirmed"
  },
  "extensions": {
    "apds-ext:apx:correlation@1.0": { "correlationId": "ca000000-0000-4000-8000-000000000022" }
  }
}
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:05:10Z",
  "endedAt": "2026-09-24T22:07:20Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "accountBalanceDenied" },
  "summary": "Balance hold; no working phone for a link; supervisor-approved courtesy exit, gate confirmed open.",
  "subjects": {
    "holder": { "id": "a3000000-0000-4000-8000-000000000003", "className": "RightHolder" },
    "credential": { "id": "c3000000-0000-4000-8000-000000000003", "className": "Credential" }
  },
  "actions": [
    { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
    { "id": "d1000000-0000-4000-8000-000000000222", "className": "Command" }
  ],
  "interactionId": "interaction-940122",
  "resolution": { "code": "resolved", "display": "Courtesy exit granted" },
  "correlationId": "ca000000-0000-4000-8000-000000000022"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000022",
  "version": 1,
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:05:10Z",
  "endedAt": "2026-09-24T22:07:20Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "accountBalanceDenied" },
  "summary": "Balance hold; no working phone for a link; supervisor-approved courtesy exit, gate confirmed open.",
  "subjects": {
    "holder": { "id": "a3000000-0000-4000-8000-000000000003", "className": "RightHolder" },
    "credential": { "id": "c3000000-0000-4000-8000-000000000003", "className": "Credential" }
  },
  "actions": [
    { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
    { "id": "d1000000-0000-4000-8000-000000000222", "className": "Command" }
  ],
  "interactionId": "interaction-940122",
  "resolution": { "code": "resolved", "display": "Courtesy exit granted" },
  "correlationId": "ca000000-0000-4000-8000-000000000022"
}
```

The supervisor's question, as the standard promises it can be asked:

<!-- apx:request GET /v1/support/interactions?correlationId=ca000000-0000-4000-8000-000000000022 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790294400, "offset": 0, "pageSize": 50, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000022",
      "version": 1,
      "channel": "voice",
      "agentType": "human",
      "agent": "agent:j.okafor",
      "startedAt": "2026-09-24T22:05:10Z",
      "endedAt": "2026-09-24T22:07:20Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "summary": "Balance hold; no working phone for a link; supervisor-approved courtesy exit, gate confirmed open.",
      "actions": [
        { "id": "e5000000-0000-4000-8000-000000000022", "className": "ResolutionContext" },
        { "id": "d1000000-0000-4000-8000-000000000222", "className": "Command" }
      ],
      "correlationId": "ca000000-0000-4000-8000-000000000022"
    }
  ]
}
```

---

## RES-23 — Two agents correct the same plate

<!-- apx:scenario RES-23 kind=edge ics=APX-RES-08 -->

**Given** the chat bot and a human agent both have session `c4…0041`
open. **When** the human writes RVR-8B21 at 14:20:02 and the bot, working
from a candidates list fetched at 14:19, writes RVR-8821 at 14:20:05.
**Then** each cites the Session version it read in `If-Match`; the
human's write lands (version 3 → 4) and the bot's, still citing 3, is
refused with 409 `version-conflict`, nothing written (Part 17 §17.5;
was F-RES-06).

```http
PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate
If-Match: "3"
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate -->
```json
{
  "plate": "RVR-8B21",
  "country": "US",
  "stateProvince": "IL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
  "reason": "customer registration confirms 8B21"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000041", "className": "Session" },
  "plate": "RVR-8B21",
  "country": "US",
  "stateProvince": "IL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
  "version": 4
}
```

```http
PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate
If-Match: "3"
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate -->
```json
{
  "plate": "RVR-8821",
  "country": "US",
  "stateProvince": "IL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
  "reason": "top candidate"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Session c4000000-0000-4000-8000-000000000041 is at version 4; the plate was set to RVR-8B21 by agent:j.okafor at 2026-09-24T14:20:02Z.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000041/plate"
}
```

---

## RES-24 — Throttled: every route in the module answers 429 with Retry-After

<!-- apx:scenario RES-24 kind=edge ics=APX-CORE-05 -->

**Given** a console that re-resolves on every keystroke. **When** it
exceeds the per-credential read and write limits across the module.
**Then** 429 `rate-limited` with `Retry-After` on each route. Every
route, the assigned-right link included, now declares the shared 429
(was F-RES-09; the Spectral rule from F-CTL-08 keeps it that way).

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Resolve rate for this credential exceeded 30/min; retry after 2 seconds.",
  "instance": "/v1/resolution/contexts"
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions"
}
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000001/passback -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/credentials/c3000000-0000-4000-8000-000000000001/passback"
}
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T23:50:00Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/support/interactions"
}
```

<!-- apx:request GET /v1/support/interactions?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/support/interactions"
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0024-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/payment-links"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate -->
```json
{
  "plate": "RVR-8B21"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000041/plate"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right"
}
```

---

## RES-25 — Expired token: every route answers 401 `unauthenticated`

<!-- apx:scenario RES-25 kind=edge ics=APX-CORE-05,APX-CORE-06 -->

**Given** the call platform's token expired mid-shift. **When** it keeps
calling. **Then** 401 `unauthenticated` on every route (registered in
Part 12 since F-CTL-07).

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/resolution/contexts"
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/resolution/contexts/e5000000-0000-4000-8000-000000000001/allowed-actions"
}
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request GET /v1/credentials/c3000000-0000-4000-8000-000000000001/passback -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/credentials/c3000000-0000-4000-8000-000000000001/passback"
}
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T23:50:00Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/support/interactions"
}
```

<!-- apx:request GET /v1/support/interactions?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/support/interactions"
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5-0025-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payment-links"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate -->
```json
{
  "plate": "RVR-8B21"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000041/plate"
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000015", "className": "AssignedRight" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right"
}
```

---

## RES-26 — Open the record when the call is answered, complete it at hang-up

<!-- apx:scenario RES-26 kind=lifecycle ics=APX-RES-06,APX-CORE-05 -->

**Given** a console that records the interaction the second the call is
answered, so the correlation id exists from the start. **When** it posts
the open record, reads it back, completes it with `If-Match: "1"`, and a
second console, still holding version 1, tries to complete it too.
**Then** 201, 200, 200 at version 2 (the topic publishes again, `version`
telling create from update), and 409 `version-conflict`. The routes
refuse a bad body (400), an unknown id (404), the wrong scope (403), a
dead token (401), and a burst (429). Closes F-RES-12.

```http
POST /v1/support/interactions
Idempotency-Key: rec-interaction-940126
```

<!-- apx:request POST /v1/support/interactions -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "interactionId": "interaction-940126",
  "correlationId": "ca000000-0000-4000-8000-000000000026"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000026",
  "version": 1,
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "interactionId": "interaction-940126",
  "correlationId": "ca000000-0000-4000-8000-000000000026"
}
```

<!-- apx:request GET /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000026",
  "version": 1,
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "interactionId": "interaction-940126",
  "correlationId": "ca000000-0000-4000-8000-000000000026"
}
```

```http
PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026
If-Match: "1"
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:40:03Z",
  "endedAt": "2026-09-24T22:44:51Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket" },
  "summary": "Lost ticket; session found by plate; paid lost-ticket fee by link.",
  "subjects": { "plate": "SYN-7781" },
  "interactionId": "interaction-940126",
  "resolution": { "code": "resolved" },
  "correlationId": "ca000000-0000-4000-8000-000000000026"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000026",
  "version": 2,
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:j.okafor",
  "startedAt": "2026-09-24T22:40:03Z",
  "endedAt": "2026-09-24T22:44:51Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "lostTicket" },
  "summary": "Lost ticket; session found by plate; paid lost-ticket fee by link.",
  "subjects": { "plate": "SYN-7781" },
  "interactionId": "interaction-940126",
  "resolution": { "code": "resolved" },
  "correlationId": "ca000000-0000-4000-8000-000000000026"
}
```

The topic publishes the update; `version: 2` says it is not a new call:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate SupportInteraction at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000026",
  "type": "apx.support.interaction.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e7000000-0000-4000-8000-000000000026", "className": "SupportInteraction" },
  "time": "2026-09-24T22:44:52Z",
  "data": {
    "id": "e7000000-0000-4000-8000-000000000026",
    "version": 2,
    "channel": "voice",
    "agentType": "human",
    "startedAt": "2026-09-24T22:40:03Z",
    "endedAt": "2026-09-24T22:44:51Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "summary": "Lost ticket; session found by plate; paid lost-ticket fee by link.",
    "correlationId": "ca000000-0000-4000-8000-000000000026"
  }
}
```

A second console, still on version 1, completes the same record:

```http
PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026
If-Match: "1"
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "agent": "agent:t.vance",
  "startedAt": "2026-09-24T22:40:03Z",
  "endedAt": "2026-09-24T22:45:10Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "summary": "Transferred call; caller hung up."
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "SupportInteraction e7000000-0000-4000-8000-000000000026 is at version 2; the request was made against version 1.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 invalid -->
```json
{
  "channel": "voice",
  "agentType": "bot",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "agentType must be one of human, ai.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026",
  "errors": [ { "pointer": "/agentType", "detail": "must be one of human, ai" } ]
}
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-0000000000ff -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No support interaction e7000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request GET /v1/support/interactions/e7000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No support interaction e7000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-0000000000ff"
}
```

```http
GET /v1/support/interactions/e7000000-0000-4000-8000-000000000026
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/support/interactions/{id} requires scope apx.support:manage or apx.resolution:read; token carries apx.data:read.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

```http
PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026
Authorization: Bearer <apx.resolution:read only>
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/support/interactions/{id} requires scope apx.support:manage; token carries apx.resolution:read.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

The same console on an expired token, then polling the record too fast:

<!-- apx:request GET /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

<!-- apx:request GET /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read limit of 20 requests per second exceeded; retry after 1 second.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

<!-- apx:request PUT /v1/support/interactions/e7000000-0000-4000-8000-000000000026 -->
```json
{
  "channel": "voice",
  "agentType": "human",
  "startedAt": "2026-09-24T22:40:03Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write limit of 5 requests per second exceeded; retry after 2 seconds.",
  "instance": "/v1/support/interactions/e7000000-0000-4000-8000-000000000026"
}
```

---

## RES-27 — Domain writes refused: a malformed body, and a plate on a settled session

<!-- apx:scenario RES-27 kind=refusal ics=APX-RES-08,APX-CORE-05 -->

**Given** a console whose form lost its fields, and an agent correcting
the plate of session `c4…0051`, which ended at 21:02 and was billed by
plate, where the operator's dispute window is 30 minutes. **When** the
console PUTs a plate body with no `plate` and a link body with no
`assignedRight`; the agent corrects the plate at 21:20 with a reason,
then again at 22:10. **Then** 400 `invalid-request` twice; 200 inside
the dispute window (an audited adjustment, `reason` given); and 422
`session-not-open` outside it (Part 17 §17.5; was F-LPR-10).

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000041/plate invalid -->
```json
{
  "country": "US",
  "stateProvince": "IL",
  "reason": "customer read plate aloud"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "plate is required.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000041/plate",
  "errors": [ { "pointer": "/plate", "detail": "required" } ]
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right invalid -->
```json
{
  "reservationCode": "LKG-88301",
  "reason": "barcode scanned at the kiosk"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "assignedRight is required.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000032/assigned-right",
  "errors": [ { "pointer": "/assignedRight", "detail": "required" } ]
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000051/plate -->
```json
{
  "plate": "MNO-3801",
  "country": "US",
  "stateProvince": "FL",
  "reason": "receipt shows MNO-3301; registration shows MNO-3801 (dispute D-4410)"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "c4000000-0000-4000-8000-000000000051", "className": "Session" },
  "plate": "MNO-3801",
  "country": "US",
  "stateProvince": "FL",
  "version": 6
}
```

<!-- apx:request PUT /v1/sessions/c4000000-0000-4000-8000-000000000051/plate -->
```json
{
  "plate": "MNO-3301",
  "reason": "customer changed their mind"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/session-not-open",
  "title": "Session is not open",
  "status": 422,
  "detail": "Session c4000000-0000-4000-8000-000000000051 ended 2026-09-24T21:02:00Z; the 30-minute correction window has passed.",
  "instance": "/v1/sessions/c4000000-0000-4000-8000-000000000051/plate"
}
```

---

## RES-28 — The way out offered on a channel the place does not run

<!-- apx:scenario RES-28 kind=refusal ics=APX-ACC-04 -->

**Given** a declined card at the exit, and a resolution context that
offers a payment link. **When** the agent asks for the link by fax, a
channel Lakeside does not run. **Then** 422 `request-unprocessable`, with
the supported channels in `detail`, so the agent can offer SMS instead.

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5000000-0028-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61081",
  "channel": "fax"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Delivery channel not supported",
  "status": 422,
  "detail": "Channel fax is not offered at this place; supported channels are sms and email.",
  "instance": "/v1/payment-links"
}
```
