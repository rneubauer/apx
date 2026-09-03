# Scenario 13 — Resolution context: "the system says I'm already inside"

**The story.** A monthly parker badges in at Lakeside Garage's Entry 1 —
denied. She badges again — denied again — and presses the intercom. The
system believes her credential is already inside the garage: yesterday she
entered normally, but at closing time an attendant was waving cars out of
a construction-blocked exit lane and her badge was never read on the way
out. Anti-passback is doing exactly its job on data that no longer matches
the world. The fix is not a gate vend; it is correcting the credential's
recorded state — and policy, not the agent, says so.

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:read`, `apx.control:execute` scopes) → Lakeside Garage APX
server (`apx-resolution` + `apx-control` classes).

## Step 1 — The denial resolves to a context

The platform's provisioning maps this intercom to Entry 1's lane UUID
(Part 17 §17.1 — no telephony identifiers ever reach APX):

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-104417",
  "correlationId": "3f1c2b4a-8d6e-4f2a-9c1b-5a7e8d9f0a1b",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
}
```

The server resolves lane → denial → credential, and the context arrives
with the passback overlay already attached:

<!-- apx:validate ResolutionContext -->
<!-- apx:validate PassbackStatus at /passback -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000013",
  "version": 1,
  "computedAt": "2026-09-02T07:52:11Z",
  "status": "full",
  "interactionId": "interaction-104417",
  "correlationId": "3f1c2b4a-8d6e-4f2a-9c1b-5a7e8d9f0a1b",
  "issue": {
    "code": "passbackViolation",
    "display": "Credential denied at entry — anti-passback violation"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000013", "className": "RightHolder" },
  "holderDisplay": "M. Rivera",
  "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" },
  "passback": {
    "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" },
    "state": "violation",
    "expectedPresence": "outside",
    "recordedPresence": "inside",
    "lastAccess": {
      "direction": "entry",
      "occurredAt": "2026-09-01T08:03:47Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
    }
  },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "passbackViolation",
    "reasonDisplay": "Credential is recorded as already inside.",
    "occurredAt": "2026-09-02T07:51:58Z"
  },
  "allowedActions": [
    {
      "action": "resetPassback",
      "display": "Reset anti-passback state",
      "target": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "resetPassback" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "allowed": false,
      "requiresApproval": false,
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
    "reason": "Recorded presence contradicts the vehicle physically at an entry lane; a reset fixes the cause, not the symptom."
  }
}
```

The story is in `passback`: last access was an **entry** yesterday morning,
no exit ever recorded, so `recordedPresence` says `inside` while the car
sits at an entry lane. Policy has already ruled: reset the state, don't
vend around it (Part 17 §17.3).

## Step 2 — Confirming the overlay on its own read

The passback overlay has a dedicated read (Part 17 §17.4) — the agent's
console refreshes it directly, cheaper than recomputing the whole context:

```http
GET /v1/credentials/c3000000-0000-4000-8000-000000000013/passback HTTP/1.1
```

<!-- apx:validate PassbackStatus -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" },
  "state": "violation",
  "expectedPresence": "outside",
  "recordedPresence": "inside",
  "lastAccess": {
    "direction": "entry",
    "occurredAt": "2026-09-01T08:03:47Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
  }
}
```

## Step 3 — Reset, verify, retry

`resetPassback` is an operational action, so it runs on the Part 6 command
plane — exactly as the AllowedAction's `execution` descriptor said. The
credential rides in `parameters` (Part 17 §17.4); the context and
correlation id tie the command into the interaction's audit chain:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: ctx-e5000013-reset-passback
Content-Type: application/json

{
  "commandType": "resetPassback",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" }
  },
  "reason": "exit never recorded 2026-09-01 (attendant-directed exit); customer at Entry 1",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000013", "className": "ResolutionContext" },
  "correlationId": "3f1c2b4a-8d6e-4f2a-9c1b-5a7e8d9f0a1b"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c13",
  "version": 3,
  "commandType": "resetPassback",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" }
  },
  "reason": "exit never recorded 2026-09-01 (attendant-directed exit); customer at Entry 1",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000013", "className": "ResolutionContext" },
  "correlationId": "3f1c2b4a-8d6e-4f2a-9c1b-5a7e8d9f0a1b",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-02T07:53:20Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-02T07:53:20Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-02T07:53:21Z", "actor": "lakeside-parcs", "detail": "passback state cleared" }
  ]
}
```

A re-read shows the overlay back to normal:

<!-- apx:validate PassbackStatus -->
```json
{
  "credential": { "id": "c3000000-0000-4000-8000-000000000013", "className": "Credential" },
  "state": "normal",
  "expectedPresence": "outside",
  "recordedPresence": "outside"
}
```

The agent asks the customer to badge once more — this time the PARCS
grants access on its own rules and the gate opens as a normal entry, not
an override. Nothing to vend, nothing to count against courtesy policy,
and tomorrow's exit will work too, because the state was fixed rather than
bypassed. One correlation id (`3f1c…`) links the call, the context, the
policy decision, and the reset for the audit trail.
