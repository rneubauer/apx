# Scenario 30 — A citation written on another system: imported, part-paid, matched to its stay

**The story.** Lakeside Garage's Lot C is patrolled by officers who write
citations on a separate citation platform, `example-enforcement`. Lakeside's
APX server holds the sessions, the rights, and the reports, and it needs
those citations as Violations — with the platform's times and status —
without pretending it issued them. At 2:07 PM officer 0417 writes citation
`EX-2026-018342` for $40 on plate `SYN-5520`. Three days later the driver
pays $15 of it on the platform. That night Lakeside's reconciliation
matches the citation to the stay the car was in.

**Actors.** The platform's connector (`apx.violations:manage`) → Lakeside
Garage APX server; Lakeside's nightly reconciliation job
(`apx.violations:manage`); reporting (`apx.violations:read`).

## Step 1 — The connector imports the citation

The connector sends the citation as the platform recorded it, with the
source decoration. The natural key is `system` + `recordId`; the
`Idempotency-Key` is built from the key and the revision, so a retry
replays and the next revision applies:

<!-- apx:request POST /v1/enforcement/violation-imports -->
```json
{
  "violationType": "noValidRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-10-01T14:05:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5520", "jurisdiction": "US-IL" },
  "notice": { "noticeKind": "citation", "noticeNumber": "EX-2026-018342", "issuedTime": "2026-10-01T14:07:12Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 40.0 },
  "dueTime": "2026-10-22T23:59:59Z",
  "statusHistory": [
    { "state": "issued", "time": "2026-10-01T14:07:12Z", "actor": "officer-0417" }
  ],
  "extensions": {
    "apds-ext:apx:violation-source@1.0": {
      "system": "example-enforcement",
      "recordId": "EX-2026-018342",
      "sourceStatus": "issued",
      "sourceRevision": 1,
      "sourceUpdatedTime": "2026-10-01T14:07:12Z"
    }
  }
}
```

The server records it (201) at `issued`, with the officer's issue time —
not the time it arrived. It runs no issuance gate and no enforcement
policy check (the platform issued it, under its own authority), and it
will apply no escalation: amounts come from the platform. Because the
citation arrives at issuance, `apx.violations.issued.v1` is published.

## Step 2 — A part payment arrives as revision 3

The driver pays $15 on the platform. The connector sends revision 3, with
the platform's own status wording, `partiallyPaid`:

<!-- apx:request POST /v1/enforcement/violation-imports -->
```json
{
  "violationType": "noValidRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-10-01T14:05:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5520", "jurisdiction": "US-IL" },
  "notice": { "noticeKind": "citation", "noticeNumber": "EX-2026-018342", "issuedTime": "2026-10-01T14:07:12Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 40.0 },
  "dueTime": "2026-10-22T23:59:59Z",
  "amountPaid": { "currencyType": "USD", "currencyValue": 15.0 },
  "payments": [
    { "amount": { "currencyType": "USD", "currencyValue": 15.0 }, "paidTime": "2026-10-04T09:12:00Z", "reference": "PMT-77120" }
  ],
  "statusHistory": [
    { "state": "issued", "time": "2026-10-01T14:07:12Z", "actor": "officer-0417" }
  ],
  "extensions": {
    "apds-ext:apx:violation-source@1.0": {
      "system": "example-enforcement",
      "recordId": "EX-2026-018342",
      "sourceStatus": "partiallyPaid",
      "sourceRevision": 3,
      "sourceUpdatedTime": "2026-10-04T09:12:00Z"
    }
  }
}
```

Revision 3 is newer than revision 1, so it applies in place: `version` 2,
`apx.violations.status.v1`. $15 is less than $40, so the violation stays
`issued` — `paid` means `amountPaid` is at least `amount` (Part 19 §19.6).
A connector that replays revision 1 now changes nothing.

## Step 3 — Reconciliation links the stay

That night the reconciliation job matches the citation to Session
`5e…0071`, the stay `SYN-5520` was in. The link is set after creation
with the version last read, and the evidence for the match travels in
`extensions` (the match-evidence decoration, where the server supports it):

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000030/session -->
```json
{
  "session": { "id": "5e000000-0000-4000-8000-000000000071", "className": "Session" },
  "reason": "lateMatch",
  "extensions": {
    "apds-ext:apx:match-evidence@1.0": {
      "target": { "id": "5e000000-0000-4000-8000-000000000071", "className": "Session" },
      "matchType": "violation",
      "plate": { "method": "exact", "jurisdiction": "agrees" },
      "applied": true,
      "decidedBy": "system"
    }
  }
}
```

The link is not a lifecycle transition: nothing is appended to
`statusHistory[]`, and it is allowed on an imported violation. What
reporting reads afterwards:

<!-- apx:validate Violation -->
<!-- apx:validate ViolationSource at /extensions/apds-ext:apx:violation-source@1.0 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000030",
  "version": 3,
  "violationType": "noValidRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-10-01T14:05:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5520", "jurisdiction": "US-IL" },
  "relatedSession": { "id": "5e000000-0000-4000-8000-000000000071", "className": "Session" },
  "notice": { "noticeKind": "citation", "noticeNumber": "EX-2026-018342", "issuedTime": "2026-10-01T14:07:12Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 40.0 },
  "dueTime": "2026-10-22T23:59:59Z",
  "amountPaid": { "currencyType": "USD", "currencyValue": 15.0 },
  "payments": [
    { "amount": { "currencyType": "USD", "currencyValue": 15.0 }, "paidTime": "2026-10-04T09:12:00Z", "reference": "PMT-77120" }
  ],
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 40.0 }, "time": "2026-10-01T14:07:12Z", "reason": "imported" }
  ],
  "statusHistory": [
    { "state": "issued", "time": "2026-10-01T14:07:12Z", "actor": "officer-0417" }
  ],
  "extensions": {
    "apds-ext:apx:violation-source@1.0": {
      "system": "example-enforcement",
      "recordId": "EX-2026-018342",
      "sourceStatus": "partiallyPaid",
      "sourceRevision": 3,
      "sourceUpdatedTime": "2026-10-04T09:12:00Z",
      "receivedTime": "2026-10-04T09:15:02Z"
    },
    "apds-ext:apx:match-evidence@1.0": {
      "target": { "id": "5e000000-0000-4000-8000-000000000071", "className": "Session" },
      "matchType": "violation",
      "plate": { "method": "exact", "jurisdiction": "agrees" },
      "applied": true,
      "decidedBy": "system"
    }
  }
}
```

## What the standard guarantees here

- **Nobody pretends.** The decoration says who issued the citation; the
  times are the officer's; `sourceStatus` keeps the platform's own word.
- **One record per citation.** `system` + `recordId` is the key; revisions
  apply in order and stale ones change nothing.
- **The source is the authority.** Lakeside's own `void`, `payment`, or
  `appeals` on this violation is 409 `violation-transition-illegal`;
  changes arrive as revisions.
- **Part payments are first-class.** `amountPaid` and `payments[]` show
  what was paid; `paid` only when it covers `amount`.
- **The stay is linked when it is known**, with the evidence for the
  match beside it.
