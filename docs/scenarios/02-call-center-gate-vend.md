# Scenario 02 — Call-center gate vend: validate, vend, fault, alert

**The story.** Continuing [Scenario 01](01-lane-status-call-center.md): the
driver at the exit lane saw a movie at Lakeside Cinema and never got the
ticket stamped. The agent applies the cinema's validation, vends the gate,
and — because this is parking — a pay station picks this exact moment to go
dark. The API turns that into an alert nobody has to phone in.

**Actors.** Call-center agent console (`apx.control:read`,
`apx.control:execute`, `apx.alerts:read`, `apx.alerts:write`) → Lakeside
Garage APX server → agent's event subscription (see
[Scenario 03](03-data-sync-and-webhooks.md) for how it was created).

## Step 1 — Who may validate here, and what is it worth?

```http
GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 HTTP/1.1
```

<!-- apx:validate ValidationProvider at /data/0 -->
<!-- apx:validate ValidationProvider at /data/1 -->
```json
{
  "data": [
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
      "name": "Lakeside Cinema",
      "validationType": "twoHoursComped",
      "benefit": { "description": "First two hours comped", "duration": "PT2H" }
    },
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000012", "className": "Organisation" },
      "name": "Harbor Restaurant",
      "validationType": "flatDiscount",
      "benefit": { "description": "$3.00 off", "amount": { "currencyType": "USD", "currencyValue": 3.0 } }
    }
  ]
}
```

The benefit is **disclosed**, so the agent can tell the driver what the
validation is worth before applying it.

## Step 2 — Apply the validation (a command, not a PUT)

Every write on the control plane is a **command** with an idempotency key —
retrying a network hiccup can never stamp the ticket twice:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: cc-4411-val
Content-Type: application/json

{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  }
}
```

The server answers `202 Accepted` with the full command resource:

<!-- apx:validate Command -->
```json
{
  "id": "9c2ef6a0-5b1d-4c8e-9f3a-7d6e5c4b3a20",
  "version": 1,
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-08-06T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-08-06T18:14:02Z", "actor": "lakeside-parcs" }
  ]
}
```

## Step 3 — Vend the gate

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: cc-4411-vend
Content-Type: application/json

{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance — cinema validation applied, remainder waived per policy",
  "expiryTime": "2026-08-06T18:16:00Z"
}
```

`expiryTime` makes the command **perishable**: if the PARCS can't execute it
within two minutes, it must expire rather than pop the gate for whoever is
in the lane later. Polling the command shows the full immutable audit trail:

```http
GET /v1/commands/5e8d7c6b-4a39-4281-b0f1-2e3d4c5b6a70 HTTP/1.1
```

<!-- apx:validate Command -->
```json
{
  "id": "5e8d7c6b-4a39-4281-b0f1-2e3d4c5b6a70",
  "version": 5,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — cinema validation applied, remainder waived per policy",
  "expiryTime": "2026-08-06T18:16:00Z",
  "status": "succeeded",
  "statusHistory": [
    { "state": "received", "time": "2026-08-06T18:14:31Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-08-06T18:14:31Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-08-06T18:14:32Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-08-06T18:14:32Z", "actor": "gate-c1000000-0002" },
    { "state": "succeeded", "time": "2026-08-06T18:14:34Z", "actor": "gate-c1000000-0002", "detail": "barrier raised" }
  ]
}
```

Gate opens, driver leaves, call ends. Who vended which gate, when, and why
is permanently answerable — `statusHistory` is append-only.

## Step 4 — Meanwhile, a pay station dies

The lobby pay station stops responding. The PARCS pushes a device-state
event to every subscriber of `apx.control.device.state.v1`:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate DeviceStatus at /data -->
```json
{
  "id": "1f2e3d4c-5b6a-4798-8c9d-0e1f2a3b4c5d",
  "type": "apx.control.device.state.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-08-06T18:17:40Z",
  "subject": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "data": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "deviceState": "fault",
    "lastCommunication": "2026-08-06T18:16:55Z",
    "stateChangedTime": "2026-08-06T18:17:40Z"
  }
}
```

…and, because the operator's alerting policy maps pay-station faults to
alerts, immediately raises one on `apx.alert.raised.v1`:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "2a3b4c5d-6e7f-4890-9a0b-1c2d3e4f5a6b",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e", "className": "Alert" },
  "time": "2026-08-06T18:17:41Z",
  "data": {
    "id": "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
    "version": 1,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "raised",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "place": "b1000000-0000-4000-8000-000000000001"
    },
    "occurrenceTime": "2026-08-06T18:17:40Z",
    "detectionTime": "2026-08-06T18:17:41Z",
    "description": [{ "language": "en", "string": "Pay station 3 not responding" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-08-06T18:17:41Z", "actor": "lakeside-parcs" }
    ]
  }
}
```

## Step 5 — The agent acknowledges the alert

```http
POST /v1/alerts/7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e/acknowledge HTTP/1.1
```

<!-- apx:validate Alert -->
```json
{
  "id": "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
  "version": 2,
  "alertType": "deviceFault",
  "severity": "major",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "occurrenceTime": "2026-08-06T18:17:40Z",
  "detectionTime": "2026-08-06T18:17:41Z",
  "description": [{ "language": "en", "string": "Pay station 3 not responding" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-08-06T18:17:41Z", "actor": "lakeside-parcs" },
    { "state": "acknowledged", "time": "2026-08-06T18:19:05Z", "actor": "apx-operator", "detail": "field tech dispatched" }
  ]
}
```

The fault→alert→acknowledge loop happened **without a phone call** — the
same fabric that delivered the vend confirmation delivered the outage.
