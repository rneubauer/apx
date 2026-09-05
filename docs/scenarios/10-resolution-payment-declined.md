# Scenario 10 — Resolution context: card declined at the exit lane

**The story.** A transient parker taps a card at Lakeside Garage's Exit 3
terminal. Declined. Taps again — declined again. The intercom call reaches
an agent whose context already shows the declined attempt, the $18.00 still
owed, and exactly one financial way out that policy has pre-approved: a
payment link to the driver's phone. Vending the gate for an unpaid session
is not on the menu — and it was the policy engine, not the agent, that took
it off (Part 17 §17.3).

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.payments:write` scopes) → Lakeside Garage APX server
(`apx-resolution` + `apx-accounts` classes).

## Step 1 — The context arrives with the decline already in it

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-941615",
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000012",
  "version": 1,
  "computedAt": "2026-09-04T21:38:20Z",
  "status": "full",
  "interactionId": "interaction-941615",
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80",
  "issue": {
    "code": "paymentDeclined",
    "display": "Card payment declined at the exit lane terminal"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "laneStatus": {
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "currentTicket": {
      "ticketNumber": "T-61077",
      "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
      "issuedTime": "2026-09-04T13:11:03Z",
      "amountDue": { "currencyType": "USD", "currencyValue": 18.00 },
      "paidInFull": false
    }
  },
  "payments": [
    {
      "id": "e8000000-0000-4000-8000-000000000051",
      "transactionID": "TXN-2026-090144",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-04T21:37:02Z",
      "amount": { "currencyType": "USD", "currencyValue": 18.00 },
      "method": "card",
      "paymentStatus": "declined",
      "ticketNumber": "T-61077",
      "cardLast4": "4242"
    }
  ],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "sessionUnpaid",
        "display": "The session has an outstanding amount due; free vends for unpaid transient sessions are not permitted.",
        "policy": "no-vend-while-unpaid"
      }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "Lane terminal declined the card twice; a hosted payment link accepts another card or wallet without holding the lane."
  }
}
```

The `payments[]` overlay is dispute-grade evidence: the agent can say "your
card ending 4242 was declined at 9:37 pm" without asking the driver a
single question. And note the shape of the two actions — one financial,
one physical — presented as one uniform list; the `execution` descriptors
route each to the surface that owns it (Part 17 §17.4).

## Step 2 — The financial action runs on the payment surface

Sending a payment link is Part 13 §13.1a territory — a domain operation,
not a control command:

```http
POST /v1/payment-links HTTP/1.1
Idempotency-Key: ctx-e5000000-0012-paylink
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

No `amount` in the request — omitting it charges the current amount due, so
the link can never disagree with the lane (Part 13 §13.1a):

<!-- apx:validate PaymentLink -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000052",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "sent",
  "expiresAt": "2026-09-04T22:38:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

APX carries the link's lifecycle, never the card — the hosted page is the
implementer's PCI scope. The driver pays with a different card; the
`apx.accounts.payment.recorded.v1` event lands (Scenario 07), the lane
recalculates to `paidInFull: true`, and the ticket vends the gate on
re-insert — no command needed. Had the agent tried `vendGate` anyway, the
command plane would have answered `403 action-not-allowed`: the context's
decisions are binding, not advisory (Part 17 §17.3). One correlation id
(`8d2b…`) chains decline → context → link → payment event for the audit.
