# Scenario 08 — Resolution context: monthly parker, balance hold, courtesy limit

**The story.** A monthly parker presses the intercom at Lakeside Garage's
Exit 3 — the gate won't open. Before the agent (an AI agent tonight) says
a word, one APX call has already assembled: who this is, why access was
denied, that two courtesy exits were already granted this week, and what
the agent is — and is not — allowed to do about it. The policy engine, not
the AI, draws that line.

**Actors.** Call-center platform (`apx.resolution:read`,
`apx.control:execute`, `apx.support:manage` scopes) → Lakeside Garage APX
server (`apx-resolution` + `apx-control` classes).

## Step 1 — The intercom call resolves to a context

The intercom is the call platform's own hardware — the PARCS knows nothing
about SIP, and never has to (Part 17 §17.1). The platform's provisioning
already maps this intercom to Exit 3's lane UUID, so it opens the
interaction with one parking-domain call:

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-938383",
  "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" }
}
```

(`interactionId` is opaque to APX — the platform knows it's a SIP call;
APX never does.)

The server resolves lane → current denial → credential → account, and
answers with the assembled context:

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 1,
  "computedAt": "2026-09-02T21:14:05Z",
  "status": "full",
  "interactionId": "interaction-938383",
  "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "issue": {
    "code": "accountBalanceDenied",
    "display": "Monthly parker denied because of outstanding balance"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "vehicle": { "plate": "SYN-1234", "country": "US", "stateProvince": "FL", "confidence": 0.98 },
  "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
  "holderDisplay": "J. Smith",
  "account": {
    "id": "c2000000-0000-4000-8000-000000000004",
    "version": 7,
    "accountStatus": "enabled",
    "balance": { "currencyType": "USD", "currencyValue": 185.00 },
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
  },
  "credential": { "id": "c3000000-0000-4000-8000-000000000005", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "outstandingBalance",
    "reasonDisplay": "Monthly account has an outstanding balance.",
    "occurredAt": "2026-09-02T21:13:58Z"
  },
  "recentOverrides": [
    { "commandType": "courtesyExit", "occurredAt": "2026-09-01T20:42:00Z" },
    { "commandType": "courtesyExit", "occurredAt": "2026-09-02T12:14:00Z" }
  ],
  "allowedActions": [
    {
      "action": "post-apx-v1-payment-links",
      "display": "Send payment link",
      "target": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "post-apx-v1-payment-links" }
    },
    {
      "action": "courtesyExit",
      "display": "Courtesy exit",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "execution": { "type": "control", "command": "courtesyExit" },
      "reason": {
        "code": "courtesyLimitReached",
        "display": "Two courtesy exits have already been provided within the previous 48 hours.",
        "policy": "max-two-courtesy-exits-48h"
      }
    }
  ],
  "recommendedAction": {
    "action": "post-apx-v1-payment-links",
    "reason": "Courtesy threshold exceeded; balance payment clears the hold immediately."
  }
}
```

Note the `execution` descriptors: the agent sees one uniform action list;
whether an action runs as a Part 6 control command or a domain operation
is APX's concern, not the agent's (Part 17 §17.4).

Everything the console renders — and everything the AI is permitted to
reason about doing — is in that one response. The AI did not decide the
courtesy exit was off the table; the policy layer did (Part 17 §17.3).

## Step 2 — The allowed action executes through its owning domain

The customer opts to pay. Sending a payment link is a *financial* action,
so it runs on the payment surface (Part 13 §13.1a) — not the command
plane — exactly as the AllowedAction's `execution` descriptor said:

```http
POST /v1/payment-links HTTP/1.1
Idempotency-Key: ctx-e5000000-payment-link
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

<!-- apx:validate PaymentLink -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000002",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "channel": "sms",
  "sentTo": "+1•••••••4567",
  "status": "sent",
  "expiresAt": "2026-09-02T22:15:41Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

Had the agent tried `courtesyExit` instead — a *control* command — the
command plane would have rejected it (`403 approval-required`) because the
context's AllowedAction said so. And if a supervisor had approved a gate
vend, the returned Command's `confirmationLevel` tells the agent exactly
what it may claim: "the open command was accepted" is not "the gate is
open" (Part 6 §6.1). The payment arrives as
`apx.accounts.payment.recorded.v1` (Scenario 07), the hold clears, and the
gate vends on the retry.

## Step 3 — The interaction is recorded for next time

```http
POST /v1/support/interactions HTTP/1.1
Content-Type: application/json
```

<!-- apx:validate SupportInteraction -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000003",
  "version": 1,
  "channel": "voice",
  "agentType": "ai",
  "agent": "callcenter-ai-agent-07",
  "startedAt": "2026-09-02T21:14:02Z",
  "endedAt": "2026-09-02T21:18:30Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "issue": { "code": "accountBalanceDenied", "display": "Monthly parker denied because of outstanding balance" },
  "summary": "Balance hold at Exit 3; customer paid $185.00 via payment link; exited normally.",
  "subjects": {
    "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
    "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
    "plate": "SYN-1234"
  },
  "actions": [
    { "id": "e6000000-0000-4000-8000-000000000002", "className": "PaymentLink" }
  ],
  "interactionId": "interaction-938383",
  "resolution": { "code": "resolved", "display": "Paid and exited" },
  "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

Next week, if the same plate hits the intercom again, Step 1's context will
carry this interaction in `supportHistory` — the agent starts with the
story, not a blank screen. One correlation id (`7c9e…`) ties the call, the
context, the command, the payment event, and this record together.
