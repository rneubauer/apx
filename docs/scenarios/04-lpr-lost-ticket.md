# Scenario 04 — LPR transient parker with a lost ticket

**The story.** A transient parker reaches the Lakeside Garage exit and can't
find the ticket. No account, no monthly card — the strongest credential
available is the **plate the LPR camera already read**. The agent works down
the identity chain: plate → account → payment history → lost-ticket fee.

**Actors.** Call-center agent console (`apx.lpr:read`, `apx.accounts:read`,
`apx.control:execute`, `apx.payments:write`) → Lakeside Garage APX server.

## Step 1 — What did the camera see?

The lane inquiry (see [Scenario 01](01-lane-status-call-center.md)) shows no
ticket in the machine. The agent pivots to the LPR cross-lookup:

```http
GET /v1/lpr/reads?plate=SYN-1234 HTTP/1.1
```

<!-- apx:validate LprRead at /data/0 -->
```json
{
  "data": [
    {
      "plate": "SYN-1234",
      "confidence": 0.97,
      "observation": { "id": "f2000000-0000-4000-8000-000000000001", "className": "Observation" },
      "observationDateTime": "2026-08-06T08:02:02Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000.jpg",
      "recentReservations": []
    }
  ]
}
```

The entry camera bound plate `SYN-1234` to ticket `T-1001` at 8:02 AM — the
"lost" ticket is found, with entry time and photo evidence. If the LPR read
had failed (dirty plate, no camera on that lane), the chain continues.

## Step 2 — Any account on file?

```http
GET /v1/accounts?plate=SYN-1234 HTTP/1.1
```

```json
{ "data": [] }
```

A transient parker — no monthly account. One identity source left.

## Step 3 — The lookup of last resort: payment history

The driver says they paid at the pay station earlier with the card ending
`0777`. Payment history is searchable by **truncated PAN only** (PCI-safe),
within the standard's 8-hour privacy window:

```http
GET /v1/payments?cardLast4=0777&date=2026-08-06 HTTP/1.1
```

<!-- apx:validate PaymentRecord at /data/0 -->
```json
{
  "data": [
    {
      "id": "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c",
      "transactionID": "PARIS-20260806-00311",
      "dateCollected": "2026-08-06T12:44:09Z",
      "amount": { "currencyType": "USD", "currencyValue": 4.5 },
      "method": "card",
      "paymentStatus": "approved",
      "ticketNumber": "T-1001",
      "cardLast4": "0777",
      "postings": []
    }
  ]
}
```

Confirmed: the same ticket `T-1001`, partially paid at midday. Two
independent credentials (plate, card fragment) now agree on the identity.

## Step 4 — When nothing matches: issue a lost ticket

Suppose neither the plate nor the card had matched. The `lostTicket`
command issues a replacement ticket at the lane, priced from the **rate
deck's disclosed lost-ticket fee** (the command fails rather than guesses if
the place hasn't disclosed one):

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: cc-4412-lt
Content-Type: application/json

{
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reason": "no ticket, no LPR match, no payment match"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d1e",
  "version": 3,
  "commandType": "lostTicket",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "reason": "no ticket, no LPR match, no payment match",
  "parameters": {
    "issuedTicket": "LT-0007",
    "amountDue": { "currencyType": "USD", "currencyValue": 32.0 }
  },
  "status": "succeeded",
  "statusHistory": [
    { "state": "received", "time": "2026-08-06T18:24:10Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-08-06T18:24:10Z", "actor": "lakeside-parcs" },
    { "state": "succeeded", "time": "2026-08-06T18:24:11Z", "actor": "lane-b2000000-0002", "detail": "LT ticket issued at lane" }
  ]
}
```

## Step 5 — Take the payment, close the loop

In the happy path from Step 3, $4.50 of ticket `T-1001` is already paid;
the agent collects the remainder and the payment **writes back to
accounting**:

```http
POST /v1/payments HTTP/1.1
Idempotency-Key: cc-4412-pay
Content-Type: application/json

{
  "ticketNumber": "T-1001",
  "amount": { "currencyType": "USD", "currencyValue": 4.5 },
  "method": "card"
}
```

<!-- apx:validate PaymentRecord -->
<!-- apx:validate Posting at /postings/0 -->
```json
{
  "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
  "transactionID": "PARIS-20260806-00347",
  "dateCollected": "2026-08-06T18:26:40Z",
  "amount": { "currencyType": "USD", "currencyValue": 4.5 },
  "method": "card",
  "paymentStatus": "approved",
  "ticketNumber": "T-1001",
  "cardLast4": "0777",
  "postings": [
    {
      "confirmationNumber": "CONF-88214",
      "accountUpdated": false,
      "postedTo": "PARIS",
      "time": "2026-08-06T18:26:41Z"
    }
  ]
}
```

The `transactionID` and posting confirmation give the operator's accounting
system a reconcilable trail — the payment taken over the phone lands in the
same ledger as the pay-station payment from Step 3.
