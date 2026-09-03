# Scenario 09 — Resolution context: paid ticket, gate vend failed

**The story.** A transient parker pays at the lobby pay-on-foot machine,
drives to Lakeside Garage's Exit 3, feeds in the paid ticket — and the gate
stays down. The intercom call lands on an AI agent whose console already
shows: the ticket is paid in full, the gate hardware is alive, and a single
vend is on the table. The agent's job is to press the one button policy has
already approved — and to describe the outcome no more confidently than the
API confirms it (Part 6 §6.1).

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:execute` scopes) → Lakeside Garage APX server
(`apx-resolution` + `apx-control` classes).

## Step 1 — One call assembles the context

The platform's provisioning maps this intercom to Exit 3's lane UUID
(Part 17 §17.1 — APX never sees telephony identifiers):

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-941207",
  "correlationId": "3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6a70",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000011",
  "version": 1,
  "computedAt": "2026-09-03T20:41:12Z",
  "status": "full",
  "interactionId": "interaction-941207",
  "correlationId": "3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6a70",
  "issue": {
    "code": "gateVendFailed",
    "display": "Ticket is paid in full but the exit gate did not open"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-58201",
      "session": { "id": "c4000000-0000-4000-8000-000000000021", "className": "Session" },
      "issuedTime": "2026-09-03T17:02:44Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 0.00 },
      "paidInFull": true
    }
  },
  "devices": [
    {
      "device": { "id": "b3000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-03T20:41:05Z",
      "stateChangedTime": "2026-09-03T06:00:12Z"
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
    "reason": "Ticket T-58201 is paid in full and the gate reports available; a single vend clears the lane."
  }
}
```

Everything that matters is in one response: the paid ticket (`laneStatus`),
the gate's live health (`devices[]` — `available` and communicating, so
this is a lost vend pulse, not an equipment fault), and the policy
decisions. The AI did not conclude a vend was safe; the policy layer
evaluated the paid ticket and said so (Part 17 §17.3).

## Step 2 — Vend the gate, claim only what's confirmed

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: ctx-e5000000-0011-vend
Content-Type: application/json

{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "gateVendFailed — ticket T-58201 paid in full, gate did not cycle",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000011", "className": "ResolutionContext" },
  "correlationId": "3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6a70",
  "expiryTime": "2026-09-03T20:44:00Z"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000041",
  "version": 1,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "gateVendFailed — ticket T-58201 paid in full, gate did not cycle",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000011", "className": "ResolutionContext" },
  "correlationId": "3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6a70",
  "expiryTime": "2026-09-03T20:44:00Z",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-03T20:41:40Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-03T20:41:40Z", "actor": "lakeside-parcs" }
  ]
}
```

`confirmationLevel: accepted` is a leash on the agent's mouth (Part 6
§6.1): right now the only true sentence is *"I've sent the open command"*.
Not "the gate is opening", and certainly not "the gate is open" — an AI
agent MUST NOT report an outcome stronger than the confirmation level.

## Step 3 — The sensor, not the agent, says the gate is open

```http
GET /v1/commands/d1000000-0000-4000-8000-000000000041 HTTP/1.1
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000041",
  "version": 4,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000011", "className": "ResolutionContext" },
  "correlationId": "3f1a2b3c-4d5e-4f60-8a1b-2c3d4e5f6a70",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-09-03T20:41:40Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-03T20:41:40Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-03T20:41:41Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-03T20:41:41Z", "actor": "gate-b3000000-0031" },
    { "state": "succeeded", "time": "2026-09-03T20:41:43Z", "actor": "gate-b3000000-0031", "detail": "barrier raised — gate-state sensor reports open" }
  ]
}
```

`physicallyConfirmed` — the gate-state sensor verified the barrier is up.
*Now* the agent may say "the gate is open; drive through." One correlation
id (`3f1a…`) ties intercom call → context → command → sensor confirmation,
and the immutable `statusHistory` answers "who opened that gate, and why"
forever (Part 4 §4.2).
