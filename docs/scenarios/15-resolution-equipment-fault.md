# Scenario 15 — Resolution context: "the machine won't take my card"

**The story.** A transient parker at Lakeside Garage's Exit 2 dips a card
into the pay-in-lane terminal. Nothing. Second card — nothing. They press
the intercom, apologizing for their bank. But the fault is not the card:
the terminal's card reader faulted four minutes ago, and the resolution
context says so *before* the agent asks the customer to retry. Nobody gets
told to "try another card" at a dead terminal, and policy — not the agent —
decides the gate opens free of charge.

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:execute` scopes) → Lakeside Garage APX server
(`apx-resolution` + `apx-control` + `apx-alerts` classes).

## Step 1 — The context arrives with the diagnosis attached

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-120655",
  "correlationId": "5b2d3e4f-7a8c-4b9d-8e0f-1a2b3c4d5e15",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

The context's `devices[]` section is the live status of the lane's
equipment — the point of carrying it here is that the agent sees the fault
before forming a theory about the customer's card:

<!-- apx:validate ResolutionContext -->
<!-- apx:validate DeviceStatus at /devices/0 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000015",
  "version": 1,
  "computedAt": "2026-09-02T19:22:48Z",
  "status": "full",
  "interactionId": "interaction-120655",
  "correlationId": "5b2d3e4f-7a8c-4b9d-8e0f-1a2b3c4d5e15",
  "issue": {
    "code": "equipmentFault",
    "display": "Exit 2 payment terminal is reporting a fault"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "session": { "id": "f1000000-0000-4000-8000-000000000041", "className": "Session" },
  "devices": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000021", "className": "SupplementalEquipment" },
      "deviceState": "fault",
      "lastCommunication": "2026-09-02T19:22:40Z",
      "stateChangedTime": "2026-09-02T19:18:31Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000022", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-02T19:22:41Z"
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
      "target": { "id": "c1000000-0000-4000-8000-000000000021", "className": "SupplementalEquipment" },
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

Two policy decisions, both made server-side (Part 17 §17.3): the vend is
allowed *because* the fault is the operator's, and the restart is gated
behind a maintenance approval. The agent — human or AI — executes; it does
not decide. Where `apx-alerts` is deployed, the fault has already raised a
`deviceFault` alert on `apx.alert.raised.v1` (scenario 02 walks that flow),
so operations knew before the customer did.

## Step 2 — Vend the gate, claim only what is confirmed

The vend runs on the Part 6 command plane, tied back to the context:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: ctx-e5000015-vend
Content-Type: application/json

{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "payment terminal fault at Exit 2; free exit per policy",
  "expiryTime": "2026-09-02T19:26:00Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000015", "className": "ResolutionContext" },
  "correlationId": "5b2d3e4f-7a8c-4b9d-8e0f-1a2b3c4d5e15"
}
```

Polling a moment later:

```http
GET /v1/commands/8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e15 HTTP/1.1
```

<!-- apx:validate Command -->
```json
{
  "id": "8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e15",
  "version": 4,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "payment terminal fault at Exit 2; free exit per policy",
  "expiryTime": "2026-09-02T19:26:00Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000015", "className": "ResolutionContext" },
  "correlationId": "5b2d3e4f-7a8c-4b9d-8e0f-1a2b3c4d5e15",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-09-02T19:23:44Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-02T19:23:44Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-02T19:23:45Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-02T19:23:47Z", "actor": "gate-c1000000-0022", "detail": "barrier raised; gate-state sensor confirmed" }
  ]
}
```

`confirmationLevel: physicallyConfirmed` means the gate-state sensor
verified the barrier actually rose — so the agent may say "the gate is
open," not merely "the open command was accepted" (Part 6 §6.1). This
distinction is load-bearing for AI agents speaking to customers.

## Step 3 — The terminal comes back

A maintenance tech approves and executes the gated `restartDevice` later
that evening. When the terminal recovers, the PARCS publishes the state
change on `apx.control.device.state.v1`, whose event data is the same
DeviceStatus overlay every subscriber already understands:

<!-- apx:validate DeviceStatus -->
```json
{
  "device": { "id": "c1000000-0000-4000-8000-000000000021", "className": "SupplementalEquipment" },
  "deviceState": "available",
  "lastCommunication": "2026-09-02T20:05:12Z",
  "stateChangedTime": "2026-09-02T20:05:12Z"
}
```

The alert clears on `apx.alert.status.v1`, and the next resolution context
computed at Exit 2 shows a healthy `devices[]` list. One correlation id
(`5b2d…`) ties the intercom call, the context, the fault it surfaced, and
the vend that resolved it — and the free exit is attributable to a policy
(`equipmentFault` at the lane), not to an agent's mood.
