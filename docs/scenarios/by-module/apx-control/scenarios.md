# apx-control — vetting scenarios

<!-- apx:module apx-control tag=Control ics=CTL -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-control`. Gaps the spec cannot express are marked
`gap=F-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), entry lane `b2…0001`, exit
lane 2 `b2…0002`, exit gate `c1…0002`, pay station 3 `c1…0003`, lane
display `c1…0004`. Harbor Deck (`b1…0002`, exit lane `b2…0003`) is a
different operator's garage the token has no grant for. The operator
organisation is `a1…0001`. Validation providers: Lakeside Cinema
`a2…0011`, Harbor Restaurant `a2…0012`, Harbor Deck's hotel `a2…0013`.
Rate tables: standard deck `d5…0001`, customer-service flat $20 `d5…0002`
(flagged negotiable), event rate `d5…0003` (not flagged).

Every request carries `Authorization: Bearer …` with scopes
`apx.control:read apx.control:execute` unless the scenario says otherwise.
Requests that create resources send the create shape; `id`, `version`,
`status`, `confirmationLevel`, and `statusHistory` are server-assigned.

---

## CTL-01 — Vend the exit gate for a customer, confirmed by the sensor

<!-- apx:scenario CTL-01 kind=happy ics=APX-CTL-01,APX-CTL-03,APX-CTL-05,APX-CTL-06 -->

**Given** a driver at exit lane 2 whose ticket was resolved on the phone.
**When** the agent vends the gate with an idempotency key, a reason, and a
two-minute expiry. **Then** the server answers 202 with the command in
`accepted`, and polling shows the full audit trail through `succeeded`
with `physicallyConfirmed`, so the agent may say "the gate is open".

```http
POST /v1/commands
Idempotency-Key: cc-7710-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance — payment taken by phone",
  "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "expiryTime": "2026-09-24T18:16:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000101",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — payment taken by phone",
  "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "expiryTime": "2026-09-24T18:16:00Z",
  "priority": "normal",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" }
  ]
}
```

Two seconds later the console polls:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000101",
  "version": 5,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — payment taken by phone",
  "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "expiryTime": "2026-09-24T18:16:00Z",
  "priority": "normal",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T18:14:03Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T18:14:03Z", "actor": "gate-c1000000-0002" },
    { "state": "succeeded", "time": "2026-09-24T18:14:05Z", "actor": "gate-c1000000-0002", "detail": "barrier raised; loop sensor cleared" }
  ]
}
```

---

## CTL-02 — The console retries after a timeout: same key, same body

<!-- apx:scenario CTL-02 kind=edge ics=APX-CTL-01 -->

**Given** the 202 from CTL-01 never reached the console (network blip).
**When** the console retries with the identical key and body. **Then** the
server returns 200 with the ORIGINAL command, whatever state it has
reached since; no second vend is issued. Polling an id that never existed
is a 404.

```http
POST /v1/commands
Idempotency-Key: cc-7710-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance — payment taken by phone",
  "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "expiryTime": "2026-09-24T18:16:00Z"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000101",
  "version": 5,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — payment taken by phone",
  "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "expiryTime": "2026-09-24T18:16:00Z",
  "status": "succeeded",
  "confirmationLevel": "physicallyConfirmed",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T18:14:03Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T18:14:03Z", "actor": "gate-c1000000-0002" },
    { "state": "succeeded", "time": "2026-09-24T18:14:05Z", "actor": "gate-c1000000-0002", "detail": "barrier raised; loop sensor cleared" }
  ]
}
```

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No command d1000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-0000000000ff"
}
```

---

## CTL-03 — Same key reused for a different lane

<!-- apx:scenario CTL-03 kind=refusal ics=APX-CTL-01,APX-CORE-05 -->

**Given** a console bug reuses `cc-7710-vend` for a vend at the entry
lane. **When** the body differs from the stored one. **Then** 409
`idempotency-conflict`; nothing is executed.

```http
POST /v1/commands
Idempotency-Key: cc-7710-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "reason": "entry gate stuck"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key cc-7710-vend was first used at 2026-09-24T18:14:02Z for a vendGate targeting b2000000-0000-4000-8000-000000000002.",
  "instance": "/v1/commands"
}
```

---

## CTL-04 — Malformed requests: no key, unknown type, throttled

<!-- apx:scenario CTL-04 kind=refusal ics=APX-CTL-01,APX-CORE-05 -->

**Given** three broken clients. **When** one omits `Idempotency-Key`, one
sends a `commandType` that is in nobody's registry, and one exceeds the
rate limit. **Then** each is refused with a registered problem type: the
unknown type is `invalid-request` (Part 6 §6.1, Part 12 §12.4; F-CTL-01
fixed).

```http
POST /v1/commands
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/commands is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7711-open
```

<!-- apx:request POST /v1/commands invalid -->
```json
{
  "commandType": "openBarrier",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Unknown command type",
  "status": 400,
  "detail": "commandType openBarrier is not in apx-command-types or any registered vendor list.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7712-vend
→ 429, Retry-After: 3
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Command rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/commands"
}
```

---

## CTL-05 — Perishable: the PARCS link is down for three minutes

<!-- apx:scenario CTL-05 kind=lifecycle ics=APX-CTL-02,APX-CTL-03 -->

**Given** the operator's link to the lane controller drops right after a
vend is accepted with a 30-second expiry. **When** the link recovers three
minutes later. **Then** the command has transitioned to `expired`, the
history says why, and the gate did NOT open for whoever is in the lane
now. A command submitted with an expiry already in the past is refused
synchronously with 422 `command-expired`.

```http
POST /v1/commands
Idempotency-Key: cc-7720-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T18:30:30Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000102",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T18:30:30Z",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:30:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:30:00Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000102 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000102",
  "version": 3,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T18:30:30Z",
  "status": "expired",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:30:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:30:00Z", "actor": "lakeside-parcs" },
    { "state": "expired", "time": "2026-09-24T18:30:30Z", "actor": "lakeside-parcs", "detail": "expiryTime passed before dispatch; lane controller unreachable since 18:30:01" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7721-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "expiryTime": "2026-09-24T18:20:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/command-expired",
  "title": "Command expired",
  "status": 422,
  "detail": "expiryTime 2026-09-24T18:20:00Z is already in the past (server time 2026-09-24T18:33:10Z).",
  "instance": "/v1/commands"
}
```

---

## CTL-06 — Cancel a hold-open that was issued by mistake

<!-- apx:scenario CTL-06 kind=lifecycle ics=APX-CTL-04,APX-CTL-03 -->

**Given** a supervisor issued `holdGateOpen` on the wrong lane. **When**
they cancel it while it is still `accepted`. **Then** 200 with the
command in `cancelled`, a new history entry naming who cancelled, and the
gate never held.

```http
POST /v1/commands
Idempotency-Key: sup-0093-hold
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "reason": "event egress",
  "expiryTime": "2026-09-24T21:00:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000103",
  "version": 2,
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "event egress",
  "expiryTime": "2026-09-24T21:00:00Z",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:00:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:00:10Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-000000000103/cancel -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000103",
  "version": 3,
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "event egress",
  "expiryTime": "2026-09-24T21:00:00Z",
  "status": "cancelled",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:00:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:00:10Z", "actor": "lakeside-parcs" },
    { "state": "cancelled", "time": "2026-09-24T19:00:25Z", "actor": "apx-operator", "detail": "wrong lane — entry lane 1 targeted instead of exit lane 2" }
  ]
}
```

---

## CTL-07 — Cancel arrives after dispatch

<!-- apx:scenario CTL-07 kind=refusal ics=APX-CTL-04 -->

**Given** the vend from CTL-01 already reached the device. **When** a
cancel is requested. **Then** 409 `command-not-cancellable` and the
command's state is unchanged. Cancelling an id that does not exist has no
declared response (F-CTL-06).

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-000000000101/cancel -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/command-not-cancellable",
  "title": "Command not cancellable",
  "status": 409,
  "detail": "Command d1000000-0000-4000-8000-000000000101 is in state succeeded; cancel is allowed only in received or accepted.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000101/cancel"
}
```

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-0000000000ff/cancel -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No command d1000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-0000000000ff/cancel"
}
```

---

## CTL-08 — The device says no: rejected, and failed

<!-- apx:scenario CTL-08 kind=lifecycle ics=APX-CTL-03,APX-CTL-05 -->

**Given** the exit gate is in `fault`. **When** an agent vends it. **Then**
the PARCS rejects the command (`rejected`, with the reason in the
history). Later the fault clears, a second vend is dispatched, and the
barrier motor times out: `failed`. In neither case is `confirmationLevel`
above `deviceAcknowledged`, so an AI agent must tell the customer the vend
was requested, not that the gate opened.

```http
POST /v1/commands
Idempotency-Key: cc-7730-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T19:12:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000104",
  "version": 1,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T19:12:00Z",
  "status": "received",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:10:00Z", "actor": "apx-operator" }
  ]
}
```

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000104 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000104",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance",
  "expiryTime": "2026-09-24T19:12:00Z",
  "status": "rejected",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:10:00Z", "actor": "apx-operator" },
    { "state": "rejected", "time": "2026-09-24T19:10:00Z", "actor": "lakeside-parcs", "detail": "gate c1000000-0002 is in state fault (barrier arm sensor); vend refused" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7731-vend
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "customer assistance — retry after fault cleared",
  "expiryTime": "2026-09-24T19:20:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000105",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — retry after fault cleared",
  "expiryTime": "2026-09-24T19:20:00Z",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:18:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:18:00Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000105 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000105",
  "version": 5,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "customer assistance — retry after fault cleared",
  "expiryTime": "2026-09-24T19:20:00Z",
  "status": "failed",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:18:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:18:00Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T19:18:01Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T19:18:01Z", "actor": "gate-c1000000-0002" },
    { "state": "failed", "time": "2026-09-24T19:18:09Z", "actor": "gate-c1000000-0002", "detail": "barrier motor timeout after 8s; arm did not reach open position" }
  ]
}
```

---

## CTL-09 — Lost ticket at the exit, fee from the deck

<!-- apx:scenario CTL-09 kind=happy ics=APX-CTL-06,APX-CTL-08,APX-CTL-14 -->

**Given** a driver at lane 2 with no ticket and no match candidates.
**When** the agent issues `lostTicket` with the operator's method code.
**Then** the command succeeds with a `result` naming the issued ticket,
its session, and the fee (Part 6 §6.1a; F-CTL-02 fixed), and the lane
inquiry shows the same ticket with `amountDue` equal to the deck's
`lostTicketFee` line.

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "matchCandidates": []
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7740-lost
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "method": "flatFee" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "no ticket, no entry read, no account; driver accepts the fee"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000106",
  "version": 2,
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "method": "flatFee" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "no ticket, no entry read, no account; driver accepts the fee",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:30:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:30:00Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000106 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000106",
  "version": 4,
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "method": "flatFee" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "no ticket, no entry read, no account; driver accepts the fee",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T19:30:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T19:30:00Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T19:30:01Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-24T19:30:02Z", "actor": "lane-b2000000-0002", "detail": "lost ticket T-LT-0091 issued; fee USD 32.00 from RateTable d5000000-0000-4000-8000-000000000001 v7 line lostTicketFee" }
  ],
  "result": {
    "ticketNumber": "T-LT-0091",
    "session": { "id": "c4000000-0000-4000-8000-000000000091", "className": "Session" },
    "amountDue": { "currencyType": "USD", "currencyValue": 32.0 }
  }
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-LT-0091",
    "session": { "id": "c4000000-0000-4000-8000-000000000091", "className": "Session" },
    "issuedTime": "2026-09-24T19:30:02Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 32.0 },
    "paidInFull": false,
    "validations": []
  }
}
```

---

## CTL-10 — Lost ticket, but the deck has no lostTicketFee line

<!-- apx:scenario CTL-10 kind=refusal ics=APX-CTL-08 -->

**Given** the deck in force was pushed without a `lostTicketFee` line.
**When** an agent issues `lostTicket`. **Then** the server refuses the POST
synchronously with 422 `lost-ticket-fee-undefined` and creates no command:
the deck is server-side state it can check before accepting (Part 6 §6.1;
F-CTL-03 fixed).

```http
POST /v1/commands
Idempotency-Key: cc-7741-lost
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": { "method": "flatFee" },
  "agent": "agent:j.okafor",
  "agentType": "human"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/lost-ticket-fee-undefined",
  "title": "No lost-ticket fee in the rate deck",
  "status": 422,
  "detail": "RateTable d5000000-0000-4000-8000-000000000001 v8 in force at place b1000000-0000-4000-8000-000000000001 has no rate line described lostTicketFee; no lost ticket was issued.",
  "instance": "/v1/commands"
}
```

The agent falls back to `matchTicket`, or a supervisor restores the line
with `pushRate`; nothing was dispatched to the lane.

---

## CTL-11 — Apply a cinema validation and watch the amount fall

<!-- apx:scenario CTL-11 kind=happy ics=APX-CTL-06,APX-CTL-07 -->

**Given** ticket T-1001 owes $9.00 at lane 2 and the driver saw a film.
**When** the agent lists the place's providers, sees the cinema's
benefit, and applies it. **Then** the lane's `currentTicket.validations`
gains an entry with the actual `amountReduced`, and `amountDue` drops.

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790281200, "offset": 0, "pageSize": 100, "total": 2 },
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

```http
POST /v1/commands
Idempotency-Key: cc-7750-val
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  },
  "reason": "driver has cinema stub; not stamped"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000108",
  "version": 2,
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "driver has cinema stub; not stamped",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-1001",
    "session": { "id": "c4000000-0000-4000-8000-000000000001", "className": "Session" },
    "issuedTime": "2026-09-24T15:02:11Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 3.0 },
    "paidInFull": false,
    "validations": [
      {
        "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
        "providerName": "Lakeside Cinema",
        "validationType": "twoHoursComped",
        "validationId": "VAL-2026-0924-00417",
        "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
        "appliedTime": "2026-09-24T18:14:03Z"
      }
    ],
    "lpr": {
      "plate": "SYN-1234",
      "confidence": 0.97,
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0901.jpg"
    }
  }
}
```

---

## CTL-12 — A provider from the other garage

<!-- apx:scenario CTL-12 kind=refusal ics=APX-CTL-07 -->

**Given** Harbor Deck's hotel validates at Harbor Deck, not at Lakeside.
**When** an agent applies it at Lakeside lane 2. **Then** 422
`validation-provider-unknown`; the provider list is authoritative.

```http
POST /v1/commands
Idempotency-Key: cc-7751-val
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000013", "className": "Organisation" }
  }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/validation-provider-unknown",
  "title": "Validation provider not offered at this place",
  "status": 422,
  "detail": "Organisation a2000000-0000-4000-8000-000000000013 is not on the provider list for place b1000000-0000-4000-8000-000000000001.",
  "instance": "/v1/commands"
}
```

---

## CTL-13 — Supervisor corrects the deck with pushRate

<!-- apx:scenario CTL-13 kind=happy ics=APX-CTL-06 -->

**Given** the evening rate on the deck is wrong and the resolution context
said `pushRate` requires supervisor approval. **When** the agent pushes
rate table v8 with approval evidence. **Then** 202; the whole lane now
prices from v8. This is the deck-level correction, unlike CTL-19.

```http
POST /v1/commands
Idempotency-Key: cc-7760-rate
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 8, "className": "RateTable" }
  },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T20:01:40Z", "note": "evening rate published wrong on v7" },
  "reason": "deck correction"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000109",
  "version": 2,
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 8, "className": "RateTable" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T20:01:40Z", "note": "evening rate published wrong on v7" },
  "reason": "deck correction",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:02:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:02:00Z", "actor": "lakeside-parcs" }
  ]
}
```

---

## CTL-14 — Wrong scope, wrong grant, no grant, dead token

<!-- apx:scenario CTL-14 kind=security ics=APX-CORE-06,APX-CORE-07,APX-CORE-08 -->

**Given** five tokens. **When** a read-only token posts a command; an
execute token targets Harbor Deck's lane; a token with no `apx_places`
claim targets Lakeside; an expired token posts a command; and a BI token
with only `apx.data:read` reads devices and providers. **Then** 403
`insufficient-scope`, 403 `insufficient-grant`, 403 `insufficient-grant`
(fail-closed), 401, and two more 403s. Part 12 registers no problem type
for 401 (F-CTL-07).

```http
POST /v1/commands
Authorization: Bearer <apx.control:read only>
Idempotency-Key: ro-0001
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/commands requires scope apx.control:execute; token carries apx.control:read.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
Idempotency-Key: harbor-0001
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000003", "className": "VehicularAccess" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000003 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Authorization: Bearer <no apx_places claim at all>
Idempotency-Key: noclaim-0001
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Authorization: Bearer <expired>
Idempotency-Key: expired-0001
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T17:00:00Z.",
  "instance": "/v1/commands"
}
```

```http
GET /v1/devices
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/devices -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/devices requires scope apx.control:read; token carries apx.data:read.",
  "instance": "/v1/devices"
}
```

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/validations/providers requires scope apx.control:read; token carries apx.data:read.",
  "instance": "/v1/validations/providers"
}
```

---

## CTL-15 — The policy layer gates the command plane

<!-- apx:scenario CTL-15 kind=security ics=APX-CTL-01 -->

**Given** a resolution context for a monthly parker where policy says
`vendGate` requires supervisor approval and `courtesyExit` is not allowed
(courtesy limit reached). **When** the agent vends without approval,
then with it, then tries a courtesy exit. **Then** 403
`approval-required`, 202, and 403 `action-not-allowed`. Enforcement is
server-side; the agent never decides permissibility.

```http
POST /v1/commands
Idempotency-Key: ctx-0021-vend-a
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "correlationId": "9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a",
  "reason": "monthly holder, balance hold"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/approval-required",
  "title": "Approval required",
  "status": 403,
  "detail": "Context d7000000-0000-4000-8000-000000000001 allows vendGate only with approval by role supervisor; no approval evidence supplied.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-0021-vend-b
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "correlationId": "9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T20:15:30Z" },
  "reason": "monthly holder, balance hold; supervisor approved one exit"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000110",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "correlationId": "9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a",
  "approval": { "approvedBy": "sup:m.reyes", "approvedAt": "2026-09-24T20:15:30Z" },
  "reason": "monthly holder, balance hold; supervisor approved one exit",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:15:41Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:15:41Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: ctx-0021-courtesy
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "courtesyExit",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "account": { "id": "a2000000-0000-4000-8000-000000000077", "className": "RightHolder" }
  },
  "resolutionContext": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/action-not-allowed",
  "title": "Action not allowed by policy",
  "status": 403,
  "detail": "Context d7000000-0000-4000-8000-000000000001 evaluated courtesyExit as allowed=false: courtesy limit (2 per 30 days) reached on 2026-09-19.",
  "instance": "/v1/commands"
}
```

---

## CTL-16 — Device inventory: list, read, unknown, and filtered by place and state

<!-- apx:scenario CTL-16 kind=happy ics=APX-CTL-06,APX-CTL-13 -->

**Given** an operations dashboard. **When** it lists devices, reads one,
reads a bad id, then narrows the list to Lakeside, to Lakeside's faults,
and tries Harbor Deck. **Then** a paginated list, a `DeviceStatus`, 404,
two filtered lists, and 403 `insufficient-grant` (Part 6 §6.4; F-CTL-04
fixed).

<!-- apx:request GET /v1/devices?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790284800, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T20:59:58Z",
      "stateChangedTime": "2026-09-24T19:17:00Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "deviceState": "fault",
      "lastCommunication": "2026-09-24T18:16:55Z",
      "stateChangedTime": "2026-09-24T18:17:40Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T20:59:59Z",
      "stateChangedTime": "2026-09-24T05:00:12Z"
    }
  ]
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "deviceState": "fault",
  "lastCommunication": "2026-09-24T18:16:55Z",
  "stateChangedTime": "2026-09-24T18:17:40Z"
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No SupplementalEquipment c1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/devices/c1000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request GET /v1/devices?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790284800, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T20:59:58Z",
      "stateChangedTime": "2026-09-24T19:17:00Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "deviceState": "fault",
      "lastCommunication": "2026-09-24T18:16:55Z",
      "stateChangedTime": "2026-09-24T18:17:40Z"
    },
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-09-24T20:59:59Z",
      "stateChangedTime": "2026-09-24T05:00:12Z"
    }
  ]
}
```

"Show me everything in fault at Lakeside":

<!-- apx:request GET /v1/devices?place=b1000000-0000-4000-8000-000000000001&deviceState=fault -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790284800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "deviceState": "fault",
      "lastCommunication": "2026-09-24T18:16:55Z",
      "stateChangedTime": "2026-09-24T18:17:40Z"
    }
  ]
}
```

<!-- apx:request GET /v1/devices?place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/devices"
}
```

---

## CTL-17 — Take a pay station out of service, tell the lane, reboot it

<!-- apx:scenario CTL-17 kind=happy ics=APX-CTL-06,APX-CTL-03 -->

**Given** pay station 3 is faulting. **When** the tech marks it
`outOfService`, posts a bilingual message on the lane display, and
reboots the station. **Then** three commands, and the device overlay
reads `outOfService` with a new `stateChangedTime`.

```http
POST /v1/commands
Idempotency-Key: tech-0400-oos
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "setDeviceState",
  "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "parameters": { "state": "outOfService" },
  "reason": "card reader fault; tech dispatched"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000111",
  "version": 2,
  "commandType": "setDeviceState",
  "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "parameters": { "state": "outOfService" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "card reader fault; tech dispatched",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:20:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:20:00Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: tech-0400-msg
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "displayMessage",
  "target": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
  "parameters": {
    "message": [
      { "language": "en", "string": "Pay station 3 out of service — please use station 1" },
      { "language": "es", "string": "Estación de pago 3 fuera de servicio — use la estación 1" }
    ]
  },
  "expiryTime": "2026-09-24T22:00:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000112",
  "version": 2,
  "commandType": "displayMessage",
  "target": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
  "parameters": {
    "message": [
      { "language": "en", "string": "Pay station 3 out of service — please use station 1" },
      { "language": "es", "string": "Estación de pago 3 fuera de servicio — use la estación 1" }
    ]
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "expiryTime": "2026-09-24T22:00:00Z",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:20:05Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:20:05Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: tech-0400-restart
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "restartDevice",
  "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "reason": "first-line fix before site visit"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000113",
  "version": 2,
  "commandType": "restartDevice",
  "target": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "first-line fix before site visit",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:20:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:20:10Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "deviceState": "outOfService",
  "lastCommunication": "2026-09-24T18:21:30Z",
  "stateChangedTime": "2026-09-24T18:20:01Z"
}
```

---

## CTL-18 — Screen-pop with a denied monthly card, and an unknown lane

<!-- apx:scenario CTL-18 kind=happy ics=APX-CTL-06 -->

**Given** a monthly parker whose card was refused. **When** the console
asks for the lane. **Then** the ticket, the plate read, and the credential
context with the denial reason and recent events, in one call. A lane id
that does not exist is 404.

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-1001",
    "session": { "id": "c4000000-0000-4000-8000-000000000001", "className": "Session" },
    "issuedTime": "2026-09-24T08:02:11Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 9.0 },
    "paidInFull": false,
    "validations": [],
    "lpr": {
      "plate": "SYN-1234",
      "confidence": 0.97,
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0901.jpg"
    }
  },
  "monthlyCredential": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" },
    "cardNumber": "MC-0777",
    "accessGranted": false,
    "denialReason": "account past due",
    "lastActivity": "2026-09-23T18:22:00Z",
    "recentEvents": [
      { "time": "2026-09-23T18:22:00Z", "event": "exit", "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" } },
      { "time": "2026-09-23T08:04:31Z", "event": "entry", "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" } }
    ]
  }
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-00000000dead/current -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No lane b2000000-0000-4000-8000-00000000dead visible to this credential.",
  "instance": "/v1/lanes/b2000000-0000-4000-8000-00000000dead/current"
}
```

---

## CTL-19 — Negotiated rate: selected from the deck, refused when unflagged

<!-- apx:scenario CTL-19 kind=happy ics=APX-CTL-09,APX-CTL-10 -->

**Given** the mirrored deck flags `d5…0002` as negotiable and `d5…0003`
not. **When** the agent applies the flat $20 to the car in lane 2. **Then**
202, and the lane shows `negotiatedRate` naming the table version, the
command, and the agent. The event table is refused with 422; a request
without `agent` is refused with 400; an empty lane with 409.

```http
POST /v1/commands
Idempotency-Key: cc-7770-nego
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000002", "version": 3, "className": "RateTable" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "customer waited 40 minutes at a failed pay station"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000114",
  "version": 2,
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000002", "version": 3, "className": "RateTable" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "customer waited 40 minutes at a failed pay station",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:30:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:30:00Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-1044",
    "session": { "id": "c4000000-0000-4000-8000-000000000044", "className": "Session" },
    "issuedTime": "2026-09-24T09:15:00Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 20.0 },
    "paidInFull": false,
    "validations": [],
    "negotiatedRate": {
      "rateTable": { "id": "d5000000-0000-4000-8000-000000000002", "version": 3, "className": "RateTable" },
      "command": { "id": "d1000000-0000-4000-8000-000000000114", "className": "Command" },
      "agent": "agent:j.okafor",
      "policy": { "negotiable": true, "displayName": "Customer-service flat $20", "note": "Use for service failures only" }
    }
  }
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7771-nego
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000003", "version": 1, "className": "RateTable" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-not-negotiable",
  "title": "Rate table not negotiable",
  "status": 422,
  "detail": "RateTable d5000000-0000-4000-8000-000000000003 v1 carries no apds-ext:apx:ratepolicy@1.0 negotiable flag for place b1000000-0000-4000-8000-000000000001.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7772-nego
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000002", "version": 3, "className": "RateTable" }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/agent-required",
  "title": "Agent required",
  "status": 400,
  "detail": "pushNegotiatedRate requires agent: the principal who selected the rate.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7773-nego
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "d5000000-0000-4000-8000-000000000002", "version": 3, "className": "RateTable" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/lane-no-current-transaction",
  "title": "No transaction in progress at the lane",
  "status": 409,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000001 has no vehicle transaction in progress.",
  "instance": "/v1/commands"
}
```

---

## CTL-20 — Ticket matching by a named card, and what it refuses

<!-- apx:scenario CTL-20 kind=happy ics=APX-CTL-11,APX-CTL-12 -->

**Given** a monthly holder at lane 2 whose card will not read; he reads
the card number to the agent. **When** the agent passes it as a lookup
key, confirms, and matches. **Then** a `credential` candidate, a 202
`matchTicket`, and the lane shows `matchedCommand`. Matching a session
that closed an hour ago is 422; matching at an empty lane is 409.

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current?credential=MC-0777 -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "matchCandidates": [
    {
      "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
      "entryTime": "2026-09-24T07:30:48Z",
      "entryLane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "matchedBy": "credential",
      "evidence": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" },
      "confidence": 0.85,
      "amountDueIfMatched": { "currencyType": "USD", "currencyValue": 0.0 }
    }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: lane2-match-20260924-2045
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
    "evidence": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "card MC-0777 read back and name confirmed"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000115",
  "version": 2,
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
    "evidence": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "card MC-0777 read back and name confirmed",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T20:45:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T20:45:10Z", "actor": "lakeside-parcs" }
  ]
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 200 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
    "issuedTime": "2026-09-24T07:30:48Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 0.0 },
    "paidInFull": true,
    "validations": [],
    "matchedCommand": { "id": "d1000000-0000-4000-8000-000000000115", "className": "Command" }
  }
}
```

```http
POST /v1/commands
Idempotency-Key: lane2-match-20260924-2050
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000049", "className": "Session" }
  },
  "agent": "agent:t.nguyen",
  "agentType": "ai"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/session-not-open",
  "title": "Session is not open at this place",
  "status": 422,
  "detail": "Session c4000000-0000-4000-8000-000000000049 ended 2026-09-24T19:40:05Z.",
  "instance": "/v1/commands"
}
```

```http
POST /v1/commands
Idempotency-Key: lane1-match-20260924-2051
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" }
  },
  "agent": "agent:t.nguyen",
  "agentType": "ai"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/lane-no-current-transaction",
  "title": "No transaction in progress at the lane",
  "status": 409,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000001 has no vehicle transaction in progress.",
  "instance": "/v1/commands"
}
```

---

## CTL-21 — Anti-passback corrections and a tracked courtesy exit

<!-- apx:scenario CTL-21 kind=happy ics=APX-CTL-03 -->

**Given** a monthly card stuck "inside" after a tailgate exit, a holder
who walked out on foot, and a holder whose entry was never recorded
because the reader was down. **When** the agent resets passback for the
first, forces the second to "outside", forces the third to "inside", and
later vends a courtesy exit for a fourth holder whose card is being
replaced. **Then** four 202s. The parameters are the ones Part 6 §6.1 now
lists: `credential` for the three passback corrections and `holder` for
the courtesy exit (F-CTL-05 fixed).

```http
POST /v1/commands
Idempotency-Key: cc-7780-pb
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "resetPassback",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" }
  },
  "reason": "tailgated out behind another car on 2026-09-23"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000116",
  "version": 2,
  "commandType": "resetPassback",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "tailgated out behind another car on 2026-09-23",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:00:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:00:00Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7781-fo
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "forceOut",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000002", "className": "Credential" }
  },
  "reason": "holder left on foot; car stays overnight"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000117",
  "version": 2,
  "commandType": "forceOut",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000002", "className": "Credential" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "holder left on foot; car stays overnight",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:02:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:02:00Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7781-fi
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "forceIn",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000003", "className": "Credential" }
  },
  "reason": "entry reader offline 07:40–07:55; holder is inside on CCTV"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000121",
  "version": 2,
  "commandType": "forceIn",
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "parameters": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000003", "className": "Credential" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "entry reader offline 07:40–07:55; holder is inside on CCTV",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:04:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:04:00Z", "actor": "lakeside-parcs" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: cc-7782-courtesy
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "courtesyExit",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "holder": { "id": "a2000000-0000-4000-8000-000000000078", "className": "RightHolder" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "first courtesy this month; card replacement in progress"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000118",
  "version": 2,
  "commandType": "courtesyExit",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "holder": { "id": "a2000000-0000-4000-8000-000000000078", "className": "RightHolder" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "first courtesy this month; card replacement in progress",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:10:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:10:00Z", "actor": "lakeside-parcs" }
  ]
}
```

---

## CTL-22 — Event egress: hold the exit open, then close the lane

<!-- apx:scenario CTL-22 kind=lifecycle ics=APX-CTL-02,APX-CTL-04,APX-CTL-06 -->

**Given** a stadium event lets out. **When** the operator holds the exit
gate open with high priority until 23:00, the crowd clears early, and a
supervisor closes the lane at 22:40. **Then** the `closeLane` releases the
hold, which ends `succeeded` with the releasing command in `detail` (Part 6
§6.1 hold-open release; F-CTL-09 fixed). Had nobody intervened, the hold
would have released itself at its `expiryTime`.

```http
POST /v1/commands
Idempotency-Key: ops-event-hold
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "priority": "high",
  "expiryTime": "2026-09-24T23:00:00Z",
  "reason": "event egress 22:00–23:00"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000119",
  "version": 3,
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "priority": "high",
  "expiryTime": "2026-09-24T23:00:00Z",
  "reason": "event egress 22:00–23:00",
  "status": "executing",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:59:50Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:59:50Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T21:59:51Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T21:59:51Z", "actor": "gate-c1000000-0002", "detail": "barrier held open" }
  ]
}
```

```http
POST /v1/commands
Idempotency-Key: ops-event-close
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "closeLane",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "crowd cleared early; post-event cleaning"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000120",
  "version": 2,
  "commandType": "closeLane",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "crowd cleared early; post-event cleaning",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T22:40:00Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T22:40:00Z", "actor": "lakeside-parcs" }
  ]
}
```

The hold, read a moment later:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000119 -->
<!-- apx:response 200 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000119",
  "version": 4,
  "commandType": "holdGateOpen",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "priority": "high",
  "expiryTime": "2026-09-24T23:00:00Z",
  "reason": "event egress 22:00–23:00",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T21:59:50Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T21:59:50Z", "actor": "lakeside-parcs" },
    { "state": "dispatched", "time": "2026-09-24T21:59:51Z", "actor": "lakeside-parcs" },
    { "state": "executing", "time": "2026-09-24T21:59:51Z", "actor": "gate-c1000000-0002", "detail": "barrier held open" },
    { "state": "succeeded", "time": "2026-09-24T22:40:01Z", "actor": "lakeside-parcs", "detail": "hold released by closeLane d1000000-0000-4000-8000-000000000120" }
  ]
}
```

---

## CTL-23 — A dashboard polls too fast, then its token dies

<!-- apx:scenario CTL-23 kind=edge ics=APX-CORE-05 -->

**Given** an operations dashboard polling device state every 200 ms.
**When** it exceeds the read rate limit, and later keeps polling on an
expired token. **Then** 429 with `Retry-After` on both read routes, and
401 on both. The 401 problem type is the same unregistered one as CTL-14
(F-CTL-07).

<!-- apx:request GET /v1/devices -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/devices"
}
```

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/providers"
}
```

<!-- apx:request GET /v1/devices -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/devices"
}
```

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/validations/providers"
}
```

---

## CTL-24 — The supervisor's question: what was vended at lane 2, and by whom

<!-- apx:scenario CTL-24 kind=happy ics=APX-CTL-13,APX-CTL-03 -->

**Given** a driver complains the next morning that lane 2 "opened for the
car in front and not for me". **When** the supervisor lists the
`vendGate` commands at lane 2 between 18:00 and 19:00, then everything
agent `j.okafor` did that evening at Lakeside, then asks about Harbor
Deck. **Then** the audit trail comes back from the same records
`apx.control.command.status.v1` published, and Harbor Deck is 403
`insufficient-grant` (Part 6 §6.1b; F-CTL-10 fixed).

<!-- apx:request GET /v1/commands?target=b2000000-0000-4000-8000-000000000002&commandType=vendGate&since=2026-09-24T18:00:00Z&until=2026-09-24T19:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d1000000-0000-4000-8000-000000000101",
      "version": 5,
      "commandType": "vendGate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
      "reason": "customer assistance — payment taken by phone",
      "correlationId": "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      "expiryTime": "2026-09-24T18:16:00Z",
      "priority": "normal",
      "status": "succeeded",
      "confirmationLevel": "physicallyConfirmed",
      "statusHistory": [
        { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
        { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" },
        { "state": "dispatched", "time": "2026-09-24T18:14:03Z", "actor": "lakeside-parcs" },
        { "state": "executing", "time": "2026-09-24T18:14:03Z", "actor": "gate-c1000000-0002" },
        { "state": "succeeded", "time": "2026-09-24T18:14:05Z", "actor": "gate-c1000000-0002", "detail": "barrier raised; loop sensor cleared" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/commands?place=b1000000-0000-4000-8000-000000000001&agent=agent:j.okafor&status=succeeded&since=2026-09-24T19:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d1000000-0000-4000-8000-000000000106",
      "version": 4,
      "commandType": "lostTicket",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "parameters": { "method": "flatFee" },
      "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
      "agent": "agent:j.okafor",
      "agentType": "human",
      "reason": "no ticket, no entry read, no account; driver accepts the fee",
      "status": "succeeded",
      "confirmationLevel": "deviceAcknowledged",
      "statusHistory": [
        { "state": "received", "time": "2026-09-24T19:30:00Z", "actor": "apx-operator" },
        { "state": "accepted", "time": "2026-09-24T19:30:00Z", "actor": "lakeside-parcs" },
        { "state": "dispatched", "time": "2026-09-24T19:30:01Z", "actor": "lakeside-parcs" },
        { "state": "succeeded", "time": "2026-09-24T19:30:02Z", "actor": "lane-b2000000-0002" }
      ],
      "result": {
        "ticketNumber": "T-LT-0091",
        "session": { "id": "c4000000-0000-4000-8000-000000000091", "className": "Session" },
        "amountDue": { "currencyType": "USD", "currencyValue": 32.0 }
      }
    }
  ]
}
```

<!-- apx:request GET /v1/commands?place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/commands"
}
```

The nightly export job pages too fast, and later runs on a stale token:

<!-- apx:request GET /v1/commands?page=7 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/commands"
}
```

<!-- apx:request GET /v1/commands?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token revoked at 2026-09-25T02:00:00Z.",
  "instance": "/v1/commands"
}
```

---

## CTL-25 — The shared refusals on every other Control route

<!-- apx:scenario CTL-25 kind=security ics=APX-CORE-05,APX-CORE-07 -->

**Given** the same four failure modes every client meets eventually.
**When** they hit the id-addressed Control routes. **Then** each route
answers with the shared response and a registered type: 403 for a target
outside the grant or a missing scope, 429 when throttled, 401 on a dead
token (Part 12 §12.3).

A Lakeside token reads Harbor Deck's command, device, and lane, then
tries to cancel with a read-only token:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000199 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Command d1000000-0000-4000-8000-000000000199 targets VehicularAccess b2000000-0000-4000-8000-000000000003 at place b1000000-0000-4000-8000-000000000002, outside the token's apx_places grant.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000199"
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-000000000031 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "SupplementalEquipment c1000000-0000-4000-8000-000000000031 is at place b1000000-0000-4000-8000-000000000002, outside the token's apx_places grant.",
  "instance": "/v1/devices/c1000000-0000-4000-8000-000000000031"
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000003/current -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000003 is at place b1000000-0000-4000-8000-000000000002, outside the token's apx_places grant.",
  "instance": "/v1/lanes/b2000000-0000-4000-8000-000000000003/current"
}
```

```http
POST /v1/commands/d1000000-0000-4000-8000-000000000103/cancel
Authorization: Bearer <apx.control:read only>
```

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-000000000103/cancel -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/commands/{id}/cancel requires scope apx.control:execute; token carries apx.control:read.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000103/cancel"
}
```

A console polling in a tight loop:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000101 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 1 second.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-000000000103/cancel -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "commandsPerMinute 60 exceeded for this credential; retry after 3 seconds.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000103/cancel"
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 1 second.",
  "instance": "/v1/devices/c1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 1 second.",
  "instance": "/v1/lanes/b2000000-0000-4000-8000-000000000002/current"
}
```

The same console after its token expires:

<!-- apx:request GET /v1/commands/d1000000-0000-4000-8000-000000000101 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request POST /v1/commands/d1000000-0000-4000-8000-000000000103/cancel -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/commands/d1000000-0000-4000-8000-000000000103/cancel"
}
```

<!-- apx:request GET /v1/devices/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/devices/c1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/lanes/b2000000-0000-4000-8000-000000000002/current"
}
```
