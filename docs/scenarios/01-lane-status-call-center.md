# Scenario 01 — Lane status when a call hits the call center

**The story.** 6:12 PM at Lakeside Garage. A driver at the exit lane presses
the intercom's help button. The PARCS routes the call to the operator's call
center; the agent's console answers with a **screen-pop**: one API call that
shows everything about that lane *before the agent says hello*.

**Actors.** Call-center agent console (`apx-operator` credential, scope
`apx.control:read`) → Lakeside Garage APX server.

## Step 1 — Screen-pop: what is in the lane right now?

The intercom call carries the lane's ID. The console asks for the live lane
context:

```http
GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current HTTP/1.1
Host: api.lakeside-garage.example
Authorization: Bearer eyJ…
```

<!-- apx:validate LaneStatus -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-1001",
    "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
    "issuedTime": "2026-08-06T08:02:11Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 9.0 },
    "paidInFull": false,
    "validations": [],
    "lpr": {
      "plate": "SYN-1234",
      "confidence": 0.97,
      "observation": { "id": "f2000000-0000-4000-8000-000000000001", "className": "Observation" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000.jpg"
    }
  },
  "monthlyCredential": {
    "credential": { "id": "e3000000-0000-4000-8000-000000000001", "className": "Credential" },
    "cardNumber": "MC-0777",
    "accessGranted": false,
    "denialReason": "account past due",
    "lastActivity": "2026-08-05T18:22:00Z",
    "recentEvents": [
      { "time": "2026-08-05T18:22:00Z", "event": "exit", "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" } },
      { "time": "2026-08-05T08:04:31Z", "event": "entry", "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" } }
    ]
  }
}
```

One call, and the agent already knows the whole situation: ticket `T-1001`
owes **$9.00**, no validations applied, the LPR read the plate `SYN-1234`
with 97% confidence (image link included for visual confirmation) — and the
driver *also* presented monthly card `MC-0777`, which was **denied because
the account is past due**. That last part usually *is* the reason for the
call.

## Step 2 — Is the equipment healthy?

Before promising anything, the agent checks whether the exit gate itself is
working (maybe the problem is the hardware, not the ticket):

```http
GET /v1/devices/c1000000-0000-4000-8000-000000000002 HTTP/1.1
```

<!-- apx:validate DeviceStatus -->
```json
{
  "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "deviceState": "available",
  "lastCommunication": "2026-08-06T18:11:58Z",
  "stateChangedTime": "2026-08-06T05:00:12Z"
}
```

Gate is `available` and was heard from seconds ago — so this is a payment
conversation, not a maintenance dispatch. What the agent does next (apply a
validation, vend the gate) is [Scenario 02](02-call-center-gate-vend.md).

## If the lane ID is unknown

Errors are RFC 9457 problem documents with registered `type` URIs:

```http
GET /v1/lanes/b2000000-0000-4000-8000-00000000dead/current HTTP/1.1
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No lane b2000000-0000-4000-8000-00000000dead at this place.",
  "instance": "/v1/lanes/b2000000-0000-4000-8000-00000000dead/current"
}
```
