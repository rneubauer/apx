# Scenario 12 — Resolution context: "it says $45 but it should be $12"

**The story.** Sunday morning at Lakeside Garage, Exit 3. The display
demands $45.00; the driver, who parked for four hours, expected the $12.00
daily max. They're right: Saturday night's concert flat rate was never
rolled back. The fix is not a favor typed into a keypad — it is a rate-table
correction that policy gates behind a supervisor, executed as an audited
command, and it fixes the price for every car behind this one too.

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:execute` scopes) → Lakeside Garage APX server
(`apx-resolution` + `apx-control` classes); a human supervisor for the
approval.

## Step 1 — The context frames the dispute

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-943902",
  "correlationId": "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1aa0",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000014",
  "version": 1,
  "computedAt": "2026-09-06T15:22:08Z",
  "status": "full",
  "interactionId": "interaction-943902",
  "correlationId": "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1aa0",
  "issue": {
    "code": "rateDispute",
    "display": "Amount due does not match the expected rate calculation"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-81290",
      "session": { "id": "c4000000-0000-4000-8000-000000000024", "className": "Session" },
      "issuedTime": "2026-09-06T11:05:37Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 45.00 },
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
    "reason": "The active rate table does not match the schedule; correcting it reprices this ticket and every one behind it."
  }
}
```

## Step 2 — Verify against the rate deck, not the customer's memory

Rates are APDS's own machinery — APX adds no parallel rate model (Part 17
§17.4). The agent checks the native `/rates` lookup for the place
(abridged APDS-shaped response, not APX-validated):

```http
GET /rates?place=b1000000-0000-4000-8000-000000000001 HTTP/1.1
```

```json
{
  "rateTables": [
    {
      "id": "f1000000-0000-4000-8000-000000000061",
      "version": 3,
      "rateTableName": "Event flat rate — Lakeside Amphitheater",
      "note": "Assigned for 2026-09-05 event egress; flat $45.00",
      "activeAtLane": "b2000000-0000-4000-8000-000000000002"
    },
    {
      "id": "f2000000-0000-4000-8000-000000000062",
      "version": 12,
      "rateTableName": "Standard hourly, $12.00 daily max",
      "note": "Scheduled table for non-event days"
    }
  ]
}
```

The event table (`f1…`, flat $45.00) is still active at the lane a day
after the concert; the scheduled table (`f2…`, $12.00 daily max) is what
Sunday should be running. The driver's $12.00 claim is verified from the
operator's own rate deck — the agent now *knows*, rather than believes.

## Step 3 — Push the correct table, with approval evidence attached

The context's AllowedAction said `requiresApproval: true`, so the command
MUST carry approval evidence — without it the command plane answers
`403 approval-required` no matter who asks (Part 17 §17.3). A supervisor
reviews and approves; the agent executes:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: ctx-e5000000-0014-pushrate
Content-Type: application/json

{
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "f2000000-0000-4000-8000-000000000062", "version": 12, "className": "RateTable" }
  },
  "reason": "rateDispute — event flat-rate table left active after 2026-09-05 concert",
  "approval": { "approvedBy": "supervisor:m.alvarez", "approvedAt": "2026-09-06T15:25:40Z", "note": "Schedule confirms standard table for 2026-09-06." },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000014", "className": "ResolutionContext" },
  "correlationId": "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1aa0"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000043",
  "version": 3,
  "commandType": "pushRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "f2000000-0000-4000-8000-000000000062", "version": 12, "className": "RateTable" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "rateDispute — event flat-rate table left active after 2026-09-05 concert",
  "approval": { "approvedBy": "supervisor:m.alvarez", "approvedAt": "2026-09-06T15:25:40Z", "note": "Schedule confirms standard table for 2026-09-06." },
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000014", "className": "ResolutionContext" },
  "correlationId": "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1aa0",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-06T15:26:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-06T15:26:02Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-06T15:26:04Z", "actor": "lakeside-parcs", "detail": "rate table f2000000…0062 v12 applied at lane; open transactions repriced" }
  ]
}
```

The lane requotes the ticket at $12.00, the driver pays at the terminal,
and the gate vends normally. The audit trail is complete without anyone
writing a memo: the command records *what* changed (`parameters.rateTable`,
a VersionedReference — table `f2…` at version 12 exactly), *why*
(`reason`), *who asked* (`requestedBy`), *who approved*
(`approval.approvedBy`, per the `approvalRole` the policy demanded), and
*against which dispute* (`resolutionContext` + the `9e0f…` correlation id).
Any later context at this lane will surface the push in
`recentOverrides[]`. The agent never had the power to "just change the
price" — it proposed; policy, a supervisor, and the command plane disposed.
