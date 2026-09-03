# Scenario 11 — Resolution context: "the restaurant said parking was validated"

**The story.** A driver at Lakeside Garage's Exit 3 sees $14.00 due and
presses the intercom: "Harbor Restaurant said they validated my parking."
The ticket shows no validation. Two lookups settle everything the call
needs: is Harbor Restaurant actually allowed to validate here, and what is
that validation actually *worth*? The provider list is authoritative on
both — the agent never has to take the restaurant's word (or the
driver's) for it (Part 6 §6.3).

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:read`, `apx.control:execute` scopes) → Lakeside Garage APX
server (`apx-resolution` + `apx-control` classes).

## Step 1 — The context shows a clean, unvalidated ticket

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-942380",
  "correlationId": "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d90",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000013",
  "version": 1,
  "computedAt": "2026-09-05T20:12:44Z",
  "status": "full",
  "interactionId": "interaction-942380",
  "correlationId": "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d90",
  "issue": {
    "code": "validationMissing",
    "display": "Customer reports a merchant validation that is not applied to the ticket"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-70443",
      "session": { "id": "c4000000-0000-4000-8000-000000000023", "className": "Session" },
      "issuedTime": "2026-09-05T17:48:19Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 14.00 },
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

`currentTicket.validations` is empty — the restaurant's stamp never reached
the ticket. Note also what policy did *not* allow: a validation is a rate
adjustment, not a free exit, and the gate stays policy-locked until the
recalculated remainder is paid.

## Step 2 — Is the restaurant a validator here, and what is it worth?

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
      "benefit": { "description": "$3.00 off", "amount": { "currencyType": "USD", "currencyValue": 3.00 } }
    }
  ]
}
```

Harbor Restaurant is on the list, and its validation is worth **$3.00 off**
— not free parking. The disclosed `benefit` lets the agent reset the
driver's expectation before touching anything: "the restaurant's validation
takes three dollars off; eleven dollars will remain." The list is
authoritative, not advisory — an `applyValidation` naming a provider that
is not on it is rejected with `422 validation-provider-unknown` (Part 6
§6.3).

## Step 3 — Apply the validation through the command plane

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: ctx-e5000000-0013-validation
Content-Type: application/json

{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-70443",
    "provider": { "id": "a2000000-0000-4000-8000-000000000012", "className": "Organisation" }
  },
  "reason": "validationMissing — Harbor Restaurant validation not applied at merchant",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000013", "className": "ResolutionContext" },
  "correlationId": "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d90"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000042",
  "version": 2,
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-70443",
    "provider": { "id": "a2000000-0000-4000-8000-000000000012", "className": "Organisation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "validationMissing — Harbor Restaurant validation not applied at merchant",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000013", "className": "ResolutionContext" },
  "correlationId": "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d90",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-05T20:13:30Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-05T20:13:30Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-05T20:13:31Z", "actor": "lakeside-parcs", "detail": "validation applied; amount due recalculated" }
  ]
}
```

The lane inquiry now shows the applied entry in
`currentTicket.validations[]` — with `amountReduced: $3.00` as dispute
evidence — and `amountDue` recalculated to $11.00 (Part 6 §6.3). The driver
pays the remainder at the terminal and the gate vends normally. Everything
the agent asserted came from the API: the provider list said who may
validate, the `benefit` said what it's worth, and the command's audit trail
says who applied it, when, and against which resolution context.
