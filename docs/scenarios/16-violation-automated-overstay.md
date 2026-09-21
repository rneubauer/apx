# Scenario 16 — Automated enforcement: LPR overstay, notice by mail, appeal, paid

**The story.** Lakeside Garage's surface lot (Lot C) is pay-by-plate with
no gates. A mobile LPR van sweeps it every 30 minutes. At 9:31 AM it reads
plate `SYN-4471`; the pay-by-plate session for that plate ended at 9:05.
Operator policy for Lot C allows **unreviewed issuance** for automated
detections with confidence ≥ 0.9. A notice goes out by mail. The driver
appeals ("I extended in the app"); the reviewer finds the extension was
made *after* the read and reduces the amount rather than dismissing. The
driver pays online.

**Actors.** LPR enforcement pipeline (`apx.violations:manage`) → Lakeside
Garage APX server; appeals portal (`apx.violations:manage`); payments
(`apx.payments:write`).

## Step 1 — The pipeline records the detection

The van's read is already an APDS Observation (`POST /observations`, the
standard data route). The pipeline evaluates its rule and records the
violation. `Idempotency-Key` is required — the van uploads in batches and
retries on poor connectivity:

```http
POST /v1/violations HTTP/1.1
Idempotency-Key: lprvan-07-20260918-093104-SYN-4471
Content-Type: application/json

{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-18T09:31:04Z",
    "detector": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" },
    "principal": "lpr-pipeline-lot-c",
    "confidence": 0.94,
    "rule": "paybyplate-expiry-15m"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" } ],
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0041.jpg",
      "capturedTime": "2026-09-18T09:31:04Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" }
    }
  ]
}
```

The server runs the eligibility check at creation and stores the answer on
the record — the pay-by-plate session is found, and it is `expired`:

<!-- apx:validate Violation -->
<!-- apx:validate EligibilityResult at /eligibilityCheck -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 1,
  "violationType": "expiredRight",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-18T09:31:04Z",
    "detector": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" },
    "principal": "lpr-pipeline-lot-c",
    "confidence": 0.94,
    "rule": "paybyplate-expiry-15m"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" } ],
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0041.jpg",
      "capturedTime": "2026-09-18T09:31:04Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" }
    }
  ],
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471" },
    "checkedTime": "2026-09-18T09:31:04Z",
    "entitled": false,
    "basis": [
      {
        "session": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
        "rightType": "payByPlate",
        "validFrom": "2026-09-18T07:05:00Z",
        "validTo": "2026-09-18T09:05:00Z",
        "status": "expired"
      }
    ],
    "suggestedViolationType": "expiredRight",
    "graceUntil": "2026-09-18T09:20:00Z",
    "lastRead": {
      "observation": { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" },
      "observationDateTime": "2026-09-18T09:31:04Z",
      "confidence": 0.94,
      "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0041.jpg"
    }
  },
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T09:31:05Z", "actor": "lpr-pipeline-lot-c", "detail": "rule paybyplate-expiry-15m; grace to 09:20 elapsed" }
  ]
}
```

`apx.violations.detected.v1` publishes to subscribers. Had the check found
the vehicle entitled (a session still running, a monthly permit on the
plate), the server would still have recorded the violation — as
`dismissed`, with that basis — so the audit shows what was checked.

## Step 2 — Policy allows unreviewed issuance: the notice goes out

Lot C's published policy: automated detections at confidence ≥ 0.9 may be
issued without review. The pipeline issues a mailed notice:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000001/issue HTTP/1.1
Content-Type: application/json

{
  "noticeKind": "notice",
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "deliveryMethod": "mail"
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 2,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-18T09:31:04Z",
    "detector": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" },
    "principal": "lpr-pipeline-lot-c",
    "confidence": 0.94,
    "rule": "paybyplate-expiry-15m"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" } ],
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
  "notice": {
    "noticeKind": "notice",
    "noticeNumber": "LG-2026-018301",
    "issuedTime": "2026-09-18T09:31:09Z",
    "issuedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "deliveryMethod": "mail"
  },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T09:31:05Z", "actor": "lpr-pipeline-lot-c", "detail": "rule paybyplate-expiry-15m; grace to 09:20 elapsed" },
    { "state": "issued", "time": "2026-09-18T09:31:09Z", "actor": "lpr-pipeline-lot-c", "detail": "policy lot-c-auto-issue (confidence 0.94 ≥ 0.9); notice LG-2026-018301 queued for mail" }
  ]
}
```

`apx.violations.issued.v1` fires. Had this been a `guided` detection, the
same call would have been refused with 409 `violation-not-issuable` — a
human confirms guided candidates, always.

## Step 3 — The driver appeals

The mailed notice carries the appeals portal URL. The driver: "I extended
my parking in the app."

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000001/appeals HTTP/1.1
Content-Type: application/json

{
  "reason": "paidExtension",
  "detail": "I extended in the app for another hour.",
  "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" },
  "evidenceLinks": [ "https://appeals.lakeside-garage.example/uploads/9f2c-receipt.png" ]
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 3,
  "violationType": "expiredRight",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-18T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94 },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-18T09:31:09Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "appeal": {
    "reason": "paidExtension",
    "detail": "I extended in the app for another hour.",
    "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" },
    "openedTime": "2026-09-23T14:02:40Z"
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-18T09:31:09Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "appealed", "time": "2026-09-23T14:02:40Z", "actor": "appeals-portal", "detail": "reason paidExtension" }
  ]
}
```

## Step 4 — The reviewer resolves: reduced, not dismissed

The reviewer pulls the session (`GET /sessions/f1000000-…-0044`, a native
APDS route) and sees the extension was purchased at 9:47 — sixteen minutes
*after* the read. The violation stands, but operator policy halves the
amount when a late extension was bought the same day:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000001/appeals/resolve HTTP/1.1
Content-Type: application/json

{
  "resolution": "reduced",
  "adjustedAmount": { "currencyType": "USD", "currencyValue": 15.0 },
  "note": "Extension purchased 09:47, after the 09:31 read. Same-day late-extension reduction applied."
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 4,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-18T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94 },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-18T09:31:09Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 15.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "appeal": {
    "reason": "paidExtension",
    "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" },
    "openedTime": "2026-09-23T14:02:40Z",
    "resolvedTime": "2026-09-24T10:15:02Z",
    "resolution": "reduced",
    "resolutionNote": "Extension purchased 09:47, after the 09:31 read. Same-day late-extension reduction applied."
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-18T09:31:09Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "appealed", "time": "2026-09-23T14:02:40Z", "actor": "appeals-portal" },
    { "state": "issued", "time": "2026-09-24T10:15:02Z", "actor": "reviewer-0212", "detail": "appeal reduced: 35.00 → 15.00" }
  ]
}
```

A second appeal on this violation would be refused with 409
`appeal-closed` — one appeal per violation.

## Step 5 — Paid online: the money is taken by Part 13, the violation just links it

The portal takes the card through the ordinary payments surface (a
`PaymentLink` works equally well for pay-by-mail):

```http
POST /v1/payments HTTP/1.1
Idempotency-Key: portal-LG-2026-018301-pay
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 15.0 },
  "method": "card",
  "reference": "LG-2026-018301"
}
```

Then attaches the resulting PaymentRecord to the violation:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000001/payment HTTP/1.1
Content-Type: application/json

{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e30", "className": "PaymentRecord" },
  "note": "portal card payment"
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 5,
  "violationType": "expiredRight",
  "violationStatus": "paid",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-18T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94 },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-18T09:31:09Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 15.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e30", "className": "PaymentRecord" },
  "appeal": { "reason": "paidExtension", "openedTime": "2026-09-23T14:02:40Z", "resolvedTime": "2026-09-24T10:15:02Z", "resolution": "reduced" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-18T09:31:09Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "appealed", "time": "2026-09-23T14:02:40Z", "actor": "appeals-portal" },
    { "state": "issued", "time": "2026-09-24T10:15:02Z", "actor": "reviewer-0212", "detail": "appeal reduced: 35.00 → 15.00" },
    { "state": "paid", "time": "2026-09-24T18:40:11Z", "actor": "appeals-portal", "detail": "PaymentRecord 9c0d1e2f-…-1e30" }
  ]
}
```

The payment's own `apx.accounts.payment.recorded.v1` event lands in the
operator's financial feed exactly as a pay-station payment would
(Scenario 07); the violation's `apx.violations.status.v1` lands in the
enforcement feed. Two ledgers, one reconcilable reference.
