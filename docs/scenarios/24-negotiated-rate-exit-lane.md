# Scenario 24 — Negotiated rate at the exit lane: the deck says what may be offered, the audit says who offered it

**The story.** Lakeside Garage, Wednesday 15:20. A driver at exit lane 2
presses the intercom: the pay station wants **$45.00** for a stay that
started at 09:12, and she was told at the office next door that parking
"would be about twenty." The rate is correct — the event table is in force
today — but the operator has told its call center it may resolve exactly
this complaint with a customer-service flat rate.

Nobody edits the deck. The call platform already mirrors Lakeside's rate
tables through the native `/rates` route, and one of those tables carries
the APX flag that says *this one may be offered*. The agent picks it for
the car in the lane, the pay station requotes, and the command record
names the agent who chose it. The next car prices at $45.00 as before.

**Actors.** Call platform (mirrors the deck: `apx.data:read` on the native
routes); call-center agent console (`apx.control:read`,
`apx.control:execute`) → Lakeside Garage APX server.

## Step 1 — The screen-pop

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
    "ticketNumber": "T-4471",
    "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
    "issuedTime": "2026-09-24T09:12:40Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 45.0 },
    "paidInFull": false,
    "validations": [],
    "lpr": {
      "plate": "7GKX221",
      "confidence": 0.96,
      "observation": { "id": "f2000000-0000-4000-8000-000000000902", "className": "Observation" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0902.jpg"
    }
  }
}
```

Ticket `T-4471`, in since 09:12, $45.00 due, no validations. The amount is
right for the table in force; the question is whether the operator allows
something else to be offered.

## Step 2 — Which tables may be offered? Ask the mirrored deck, not a memo

The call platform synced Lakeside's rate deck last night with the Part 5
change feed on the native route — `mode=full` once, `mode=change` with a
cursor since — so the agent's console already holds every table. Two of
them apply at this place (APDS-shaped, abridged; only the APX decoration
is validated here):

```http
GET /rates?place_ids=b1000000-0000-4000-8000-000000000001&mode=change&cursor=… HTTP/1.1
```

<!-- apx:validate RatePolicy at /data/1/extensions/apds-ext:apx:ratepolicy@1.0 -->
```json
{
  "data": [
    {
      "id": "f2000000-0000-4000-8000-000000000062",
      "version": 12,
      "rateTableName": { "en": "Event flat rate — Lakeside Amphitheater" },
      "availability": "public",
      "rateType": "event"
    },
    {
      "id": "f2000000-0000-4000-8000-000000000064",
      "version": 2,
      "rateTableName": { "en": "Customer-service flat rate" },
      "availability": "restricted",
      "rateType": "daily",
      "extensions": {
        "apds-ext:apx:ratepolicy@1.0": {
          "negotiable": true,
          "displayName": "Customer-service flat $20",
          "note": "Offer for rate complaints referred by on-site tenants. Log the tenant in reason."
        }
      }
    }
  ]
}
```

The event table carries no decoration: it is the deck, not an offer. The
customer-service table carries `negotiable: true`, with a label and a note
for the agent. The note is guidance for the presenting system; the server
never evaluates it (Part 6 §6.6). APX defines no selection rules — no
length-of-stay bands, no time windows — the call platform applies its own,
and here it shows the agent one button.

## Step 3 — Push the negotiated rate to the car in the lane

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: lane2-T-4471-negotiated-01
Content-Type: application/json

{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "f2000000-0000-4000-8000-000000000064", "version": 2, "className": "RateTable" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "rate complaint referred by tenant Harbor Dental; customer-service flat offered"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000061",
  "version": 3,
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "f2000000-0000-4000-8000-000000000064", "version": 2, "className": "RateTable" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "rate complaint referred by tenant Harbor Dental; customer-service flat offered",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T15:21:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T15:21:02Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-24T15:21:03Z", "actor": "lakeside-parcs", "detail": "rate table f2000000…0064 v2 applied to ticket T-4471; lane deck unchanged" }
  ]
}
```

Three things the record settles without anyone writing a memo. *What* was
offered: table `f2…0064` at version 2 exactly, a VersionedReference. *To
whom*: the current ticket at lane 2 only — `pushRate` would have repriced
the lane for every car behind her, which is why that command needs a
supervisor (Scenario 12) and this one does not. *Who chose it*: `agent`,
distinct from `requestedBy` (the call-center organisation) and from any
approver.

## Step 4 — The lane, requoted

```http
GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current HTTP/1.1
```

<!-- apx:validate LaneStatus -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-4471",
    "session": { "id": "c4000000-0000-4000-8000-000000000031", "className": "Session" },
    "issuedTime": "2026-09-24T09:12:40Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 20.0 },
    "paidInFull": false,
    "validations": [],
    "negotiatedRate": {
      "rateTable": { "id": "f2000000-0000-4000-8000-000000000064", "version": 2, "className": "RateTable" },
      "command": { "id": "d1000000-0000-4000-8000-000000000061", "className": "Command" },
      "agent": "agent:j.okafor"
    }
  }
}
```

$20.00 due, and the screen-pop itself says why: a negotiated rate, which
table, which command, which agent. She pays at the terminal and the gate
vends normally. The session's APDS segment references table `f2…0064`
like any other rate — a stock APDS consumer reading `/sessions` sees a
stay priced by a named table, which is the truth.

## Step 5 — What the server refuses

Later the same afternoon a different agent tries to offer the *event*
table's cheaper sibling from last season, which the operator never flagged:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: lane2-T-4488-negotiated-01
Content-Type: application/json

{
  "commandType": "pushNegotiatedRate",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "rateTable": { "id": "f2000000-0000-4000-8000-000000000063", "version": 5, "className": "RateTable" }
  },
  "agent": "agent:p.lindqvist",
  "agentType": "human"
}
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/rate-not-negotiable",
  "title": "Rate table is not negotiable at this place",
  "status": 422,
  "detail": "RateTable f2000000-0000-4000-8000-000000000063 carries no apds-ext:apx:ratepolicy@1.0 negotiable flag for place b1000000-0000-4000-8000-000000000001."
}
```

The flag is the whole of the server's rule. Which flagged table to offer,
when, and to whom is the presenting system's guardrail and the operator's
policy — deliberately outside the standard (Part 6 §6.6).
