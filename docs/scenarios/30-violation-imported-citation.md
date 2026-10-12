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
source decoration `apds-ext:apx:violation-source@1.0` (Part 19 §19.13). The
record is keyed on `system` + `recordId`; the `Idempotency-Key` is built
from the key and the revision, so a retry replays and the next revision
applies:

```http
POST /v1/enforcement/violation-imports HTTP/1.1
Host: api.lakeside-garage.example
Authorization: Bearer eyJ…
Idempotency-Key: example-enforcement:EX-2026-018342:1
Content-Type: application/json
```

<!-- apx:request POST /v1/enforcement/violation-imports -->
<!-- apx:validate ViolationSource at /extensions/apds-ext:apx:violation-source@1.0 -->
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
      "sourceUpdatedTime": "2026-10-01T14:07:12Z",
      "officer": "0417"
    }
  }
}
```

The server records it (201) at `issued`, with the officer's issue time —
not the time it arrived. It runs no eligibility check (§19.3) and applies
no policy clamp to the $40 (§19.10): the platform issued it, under its own
authority (§19.13 rule 4). Because this is the first import and the state
is at issuance, both `apx.violations.detected.v1` and
`apx.violations.issued.v1` are published.

## Step 2 — A part payment arrives as revision 3

The driver pays $15 on the platform. The connector sends revision 3, with
the platform's own status wording, `partiallyPaid`, and the payment the
platform took itself — so it carries the platform's `reference`, not a
Part 13 `payment` (§19.6a rule 1):

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
      "sourceUpdatedTime": "2026-10-04T09:12:00Z",
      "officer": "0417"
    }
  }
}
```

Revision 3 is newer than revision 1, so it applies in place: 200,
`version` 2, `apx.violations.status.v1` (§19.13 rule 2). $15 is less than
$40, so the violation stays `issued` — `paid` means `amountPaid` is at
least `amount` (§19.6a rule 2), and an import that said `paid` here would
be 422 `request-unprocessable`. A connector that replays revision 3 gets a
no-op 200; one that sends revision 1 again now is 409 `version-conflict`.
`statusHistory[]` is append-only: the server keeps the entry it holds and
appends only source entries later than it — here there are none.

## Step 3 — Reconciliation links the stay

That night the reconciliation job matches the citation to Session
`f1…0071`, the stay `SYN-5520` was in. The link is set after creation
with `POST /v1/violations/{id}/session`, conditioned on the version last
read, and the evidence for the match travels in the body's `evidence`
member; the server writes it onto the violation as
`apds-ext:apx:match-evidence@1.0`, with the Session as `target` (§19.13
rule 6):

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000030/session HTTP/1.1
Host: api.lakeside-garage.example
Authorization: Bearer eyJ…
If-Match: "2"
Content-Type: application/json
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000030/session -->
<!-- apx:validate MatchEvidence at /evidence -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000071", "className": "Session" },
  "reason": "lateMatch",
  "evidence": {
    "target": { "id": "f1000000-0000-4000-8000-000000000071", "className": "Session" },
    "matchType": "violation",
    "plate": { "method": "exact", "jurisdiction": "agrees" },
    "applied": true,
    "decidedBy": "system",
    "decidedTime": "2026-10-04T23:40:00Z"
  }
}
```

The link is not a lifecycle transition: nothing is appended to
`statusHistory[]`, it is valid in every state, and it is allowed on an
imported violation. It bumps `version` to 3 and publishes
`apx.violations.status.v1`; sending the same link again is a no-op. A
stale `If-Match` would be 409 `version-conflict`, and a Session at Lot D —
outside the hierarchy of Lot C — would be 422 `request-unprocessable`.
The evidence is `exact` and applied, so it could support a notice; a
`lenient` one would block `issue` (§19.4 rule 5) — though this citation
was issued by the platform, not here.

## Step 4 — What reporting reads

Reporting finds the record by the platform's key, without knowing
Lakeside's id — `sourceRecordId`, like `noticeNumber`, is a lookup that
names no place (§19.13 rule 4):

```http
GET /v1/violations?sourceSystem=example-enforcement&sourceRecordId=EX-2026-018342 HTTP/1.1
Host: api.lakeside-garage.example
Authorization: Bearer eyJ…
```

The one violation in the page:

<!-- apx:validate Violation -->
<!-- apx:validate ViolationSource at /extensions/apds-ext:apx:violation-source@1.0 -->
<!-- apx:validate MatchEvidence at /extensions/apds-ext:apx:match-evidence@1.0 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000030",
  "version": 3,
  "violationType": "noValidRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-10-01T14:05:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5520", "jurisdiction": "US-IL" },
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000071", "className": "Session" },
  "notice": { "noticeKind": "citation", "noticeNumber": "EX-2026-018342", "issuedTime": "2026-10-01T14:07:12Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 40.0 },
  "dueTime": "2026-10-22T23:59:59Z",
  "amountPaid": { "currencyType": "USD", "currencyValue": 15.0 },
  "payments": [
    { "amount": { "currencyType": "USD", "currencyValue": 15.0 }, "paidTime": "2026-10-04T09:12:00Z", "reference": "PMT-77120" }
  ],
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 40.0 }, "time": "2026-10-01T14:07:12Z", "reason": "issued", "detail": "example-enforcement revision 1" }
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
      "receivedTime": "2026-10-04T09:15:02Z",
      "officer": "0417"
    },
    "apds-ext:apx:match-evidence@1.0": {
      "target": { "id": "f1000000-0000-4000-8000-000000000071", "className": "Session" },
      "matchType": "violation",
      "plate": { "method": "exact", "jurisdiction": "agrees" },
      "applied": true,
      "decidedBy": "system",
      "decidedTime": "2026-10-04T23:40:00Z"
    }
  }
}
```

## What the standard guarantees here

- **Nobody pretends.** The decoration says who issued the citation; the
  times are the officer's; `sourceStatus` keeps the platform's own word
  while `violationStatus` carries the APX state it maps to.
- **One record per citation.** `system` + `recordId` is the key; a higher
  `sourceRevision` updates, the same one is a no-op, an older one is 409
  `version-conflict` (Annex A APX-VIO-14).
- **The source decided.** No eligibility check and no cap on import; what
  happens next follows §19.1 like any other violation, stamped by this
  server (§19.13 rule 5).
- **Part payments are first-class.** `amountPaid` and `payments[]` show
  what was paid; `paid` only when it covers `amount` (APX-VIO-13).
- **The stay is linked when it is known**, through its own route, with
  the evidence for the match beside it and no lifecycle entry
  (APX-VIO-15).
