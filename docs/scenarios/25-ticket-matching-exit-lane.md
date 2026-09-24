# Scenario 25 — Ticket matching: no ticket at the exit, and the entry was recorded anyway

**The story.** Lakeside Garage, Thursday 17:40. A car pulls up to exit
lane 2 and the driver presses the intercom: no ticket. Yesterday this
conversation ended one of two ways — a lost-ticket fee the driver argued
with, or a courtesy vend the operator ate. Neither closes the ticket that
was opened at 08:02 when the car came in.

The entry *was* recorded. The camera read the plate on the way in, the
camera has just read it again on the way out, and the server already knows
which open session that is. The agent confirms with the driver, binds the
exit to the entry, and the ticket closes at the fare for nine and a half
hours — not the lost-ticket fee, not zero. A second caller in the same
hour is a monthly permit holder whose card is at home; his open session is
found by the phone number on his account. Both are the same command, and
both records say who made the match.

**Actors.** Call-center agent console (`apx.control:read`,
`apx.control:execute`, `apx.accounts:read`) → Lakeside Garage APX server.
Contrast [Scenario 04](04-lpr-lost-ticket.md), where the chain ends in the
lost-ticket fee; that path is now the fallback, not the default.

## Step 1 — The screen-pop, with candidates

No ticket is in the machine, so the lane inquiry computes match candidates
on its own (Part 6 §6.7):

```http
GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current HTTP/1.1
Host: api.lakeside-garage.example
Authorization: Bearer eyJ…
```

<!-- apx:validate LaneStatus -->
<!-- apx:validate MatchCandidate at /matchCandidates/0 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "matchCandidates": [
    {
      "session": { "id": "c4000000-0000-4000-8000-000000000051", "className": "Session" },
      "ticketNumber": "T-4502",
      "entryTime": "2026-09-24T08:02:17Z",
      "entryLane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "plate": "KLM4410",
      "matchedBy": "plateRead",
      "evidence": { "id": "f2000000-0000-4000-8000-000000000911", "className": "Observation" },
      "confidence": 0.94,
      "amountDueIfMatched": { "currencyType": "USD", "currencyValue": 14.0 },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0911.jpg"
    }
  ]
}
```

One candidate: the exit camera's read of `KLM4410` matches an entry read at
08:02 on lane 1, ticket `T-4502`, still open. The entry image is a click
away and the fare, if matched, is $14.00. The agent reads the plate back to
the driver — "silver hatchback, K-L-M four-four-one-zero?" — and gets a
yes. Candidates are advisory; nothing has been bound yet.

## Step 2 — Bind the exit to the entry

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: lane2-match-20260924-1741
Content-Type: application/json

{
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000051", "className": "Session" },
    "evidence": { "id": "f2000000-0000-4000-8000-000000000911", "className": "Observation" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "no ticket; plate confirmed verbally against entry read"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000062",
  "version": 3,
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000051", "className": "Session" },
    "evidence": { "id": "f2000000-0000-4000-8000-000000000911", "className": "Observation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "no ticket; plate confirmed verbally against entry read",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T17:41:20Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T17:41:20Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-09-24T17:41:21Z", "actor": "lakeside-parcs", "detail": "lane 2 transaction bound to session c4000000…0051 (T-4502, entry 08:02:17); priced from entry" }
  ]
}
```

## Step 3 — The lane now holds the real ticket

```http
GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current HTTP/1.1
```

<!-- apx:validate LaneStatus -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "currentTicket": {
    "ticketNumber": "T-4502",
    "session": { "id": "c4000000-0000-4000-8000-000000000051", "className": "Session" },
    "issuedTime": "2026-09-24T08:02:17Z",
    "amountDue": { "currencyType": "USD", "currencyValue": 14.0 },
    "paidInFull": false,
    "validations": [],
    "lpr": {
      "plate": "KLM4410",
      "confidence": 0.94,
      "observation": { "id": "f2000000-0000-4000-8000-000000000912", "className": "Observation" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0912.jpg"
    },
    "matchedCommand": { "id": "d1000000-0000-4000-8000-000000000062", "className": "Command" }
  }
}
```

The lane's current ticket *is* `T-4502` now, priced from 08:02 at the
table that applied to it. The driver pays $14.00 at the terminal and the
gate vends; on that vend the APDS Session closes with its exit segment and
the exit Observation, and `SessionUpdated` goes out, so any stock APDS
consumer sees one complete stay. There is no APX-side matching store to
reconcile later — the match is the session's exit, and `matchedCommand`
on the screen-pop says who made it.

## Step 4 — Same hour, a permit holder without his card

The next caller at lane 2 is a monthly parker. No ticket was ever issued —
he entered on his keycard at 07:30 — and the card is on his kitchen table.
The camera missed the plate (a bike rack). He gives the agent the phone
number on his account, and the agent passes it as a lookup key:

```http
GET /v1/lanes/b2000000-0000-4000-8000-000000000002/current?phone=%2B15125550144 HTTP/1.1
```

<!-- apx:validate MatchCandidate at /matchCandidates/0 -->
```json
{
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "matchCandidates": [
    {
      "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
      "entryTime": "2026-09-24T07:30:48Z",
      "entryLane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "matchedBy": "account",
      "evidence": { "id": "a2000000-0000-4000-8000-000000000077", "className": "RightHolder" },
      "confidence": 0.8,
      "amountDueIfMatched": { "currencyType": "USD", "currencyValue": 0.0 }
    }
  ]
}
```

The phone number is an account key here, exactly as on
`GET /v1/accounts?phone=` (Part 13 §13.1) — not a call identifier; the
call platform still mapped the call to lane 2 before touching APX (Part 17
§17.1). The holder's account has one open session, entered on the keycard
at 07:30, and the fare if matched is $0.00 because his permit covers it.
The agent confirms name and vehicle and issues the same command with the
RightHolder as evidence:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: lane2-match-20260924-1758
Content-Type: application/json

{
  "commandType": "matchTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "session": { "id": "c4000000-0000-4000-8000-000000000052", "className": "Session" },
    "evidence": { "id": "a2000000-0000-4000-8000-000000000077", "className": "RightHolder" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "monthly holder without card; identified by account phone, name and vehicle confirmed"
}
```

The response is a `202` Command exactly as in Step 2, and the gate vends
at $0.00 — as a *matched exit on the permit*, not a courtesy vend counted
against the holder (Part 17 §17.4). The open session closes.

## Step 5 — When nothing matches

A third caller's plate reads clean, matches no entry at this place, has no
account, and no reservation: `matchCandidates` comes back empty. The agent
falls through to `lostTicket` exactly as in Scenario 04, and the fee is
the deck's disclosed lostTicketFee line (Part 6 §6.1). Both paths close an
open ticket; both name the agent; the audit shows which path was taken.

## Step 6 — What the server refuses

An agent on a different console tries to match a session that closed an
hour ago:

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/session-not-open",
  "title": "Session is not open at this place",
  "status": 422,
  "detail": "Session c4000000-0000-4000-8000-000000000049 ended 2026-09-24T16:40:05Z; a matchTicket must name an open session at the target lane's place."
}
```

And a `matchTicket` or `pushNegotiatedRate` without `agent` is refused
with `400 agent-required` before anything else is checked: the standard
does not say how confident a match must be or who must approve it, but it
does insist on knowing who made it.
