# Scenario 19 — The law at the location: policy and signage on file, a mailed notice refused, issued lawfully, day-31 escalation

**The story.** Lakeside Garage's surface lot (Lot C) sits in a state
whose private-lot notice law says: a notice may be mailed only for
camera-based detections with at least one image and a recorded position,
within 14 days; the penalty may not exceed twice the unpaid fee; unpaid
notices escalate by 25% at 30 days and a further $15 at 60 days, never
beyond three times the issued amount; the lot must post signage stating
the terms. The operator loads that as an enforcement policy and records
the entrance sign. A guided (handheld) detection then tries to go out by
mail and is refused; issued lawfully on the windshield instead, with
coordinates; thirty-one days later the server escalates it.

**Actors.** Operator back office (`apx.violations:manage`); enforcement
handheld (`apx.violations:manage`); the APX server's own scheduler →
Lakeside Garage APX server.

## Step 1 — The operator puts the law on file

```http
POST /v1/enforcement/policies HTTP/1.1
Idempotency-Key: bo-policy-lot-c-2026
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "authority": { "jurisdiction": "US-IL", "citation": "Synthetic Stat. §12-405 (private lot notices)" },
  "deliveryRules": [
    { "detectionModes": [ "automated" ], "deliveryMethods": [ "mail", "electronic" ], "noticeDeadline": "P14D",
      "minimumEvidence": { "observations": 1, "images": 1, "locationRequired": true } },
    { "detectionModes": [ "guided", "manual" ], "deliveryMethods": [ "windshield", "handed" ], "noticeDeadline": "PT1H" }
  ],
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25, "description": "25% late penalty" },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 }, "description": "Collection referral fee" }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true
}
```

<!-- apx:validate EnforcementPolicy -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "authority": { "jurisdiction": "US-IL", "citation": "Synthetic Stat. §12-405 (private lot notices)" },
  "deliveryRules": [
    { "detectionModes": [ "automated" ], "deliveryMethods": [ "mail", "electronic" ], "noticeDeadline": "P14D",
      "minimumEvidence": { "observations": 1, "images": 1, "locationRequired": true } },
    { "detectionModes": [ "guided", "manual" ], "deliveryMethods": [ "windshield", "handed" ], "noticeDeadline": "PT1H" }
  ],
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25, "description": "25% late penalty" },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 }, "description": "Collection referral fee" }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "statusHistory": [
    { "state": "active", "time": "2026-06-20T14:00:00Z", "actor": "backoffice-jlee", "detail": "loaded from counsel's summary of §12-405" }
  ]
}
```

The policy binds to Lot C; had it been bound to the garage root, every
lot and level beneath would inherit it unless one carried its own.

## Step 2 — And the sign

```http
POST /v1/enforcement/signage HTTP/1.1
Idempotency-Key: bo-sign-lot-c-entrance-2026
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [
    { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals: lakeside-garage.example/appeals within 21 days." },
    { "language": "es", "string": "PAGUE POR PLACA. El estacionamiento sin pagar o vencido está sujeto a un aviso de $35; los avisos impagos aumentan 25% después de 30 días. Apelaciones: lakeside-garage.example/appeals dentro de 21 días." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6214, 41.8827 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/lot-c-entrance-2026-07.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "className": "EnforcementPolicy" }
}
```

<!-- apx:validate Signage -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [
    { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals: lakeside-garage.example/appeals within 21 days." },
    { "language": "es", "string": "PAGUE POR PLACA. El estacionamiento sin pagar o vencido está sujeto a un aviso de $35; los avisos impagos aumentan 25% después de 30 días. Apelaciones: lakeside-garage.example/appeals dentro de 21 días." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6214, 41.8827 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/lot-c-entrance-2026-07.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "className": "EnforcementPolicy" },
  "statusHistory": [
    { "state": "active", "time": "2026-06-28T10:12:00Z", "actor": "backoffice-jlee", "detail": "installed 2026-06-28, photographed" }
  ]
}
```

A handheld or appeals portal asking
`GET /v1/enforcement/signage/effective?place=b1000000-…-0004&at=2026-09-18T10:20:00Z`
gets this record back — the text, the photo, and where the sign stands.

## Step 3 — A guided detection, with coordinates

An officer finds `SYN-6102` on an expired pay-by-plate session and
records it (review and confirmation as in Scenario 17, elided). The
handheld includes where the vehicle was and where the officer stood:

```http
POST /v1/violations HTTP/1.1
Idempotency-Key: hh-0417-20260918-102015
Content-Type: application/json

{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-18T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6210, 41.8830 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Lot C, row 3, bay 14" } ],
    "accuracyMetres": 4
  },
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-102015-1.jpg", "capturedTime": "2026-09-18T10:20:12Z" } ]
}
```

## Step 4 — The wrong delivery method: refused by the policy

The integration on the handheld defaults to mailing notices:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000003/issue HTTP/1.1
Content-Type: application/json

{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "dueTime": "2026-10-18T23:59:59Z", "deliveryMethod": "mail" }
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/delivery-method-not-permitted",
  "title": "Delivery method not permitted",
  "status": 422,
  "detail": "Policy d4000000-…-0001 (Synthetic Stat. §12-405): detection mode 'guided' permits deliveryMethod windshield, handed — not 'mail'.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000003/issue"
}
```

Under this state's law a mailed notice is lawful only for camera-based
detections. The server, not the handheld vendor, knows that — the same
rule every integration at this lot gets.

## Step 5 — Issued lawfully, with policy and signage frozen on

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000003/issue HTTP/1.1
Content-Type: application/json

{ "noticeKind": "notice", "noticeNumber": "LG-2026-018510", "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "dueTime": "2026-10-18T23:59:59Z", "deliveryMethod": "windshield" }
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 3,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-18T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6210, 41.8830 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Lot C, row 3, bay 14" } ],
    "accuracyMetres": 4
  },
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-102015-1.jpg", "capturedTime": "2026-09-18T10:20:12Z" } ],
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000001", "version": 1, "className": "Signage" } ],
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018510", "issuedTime": "2026-09-18T10:24:02Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-18T10:24:02Z", "reason": "issued", "detail": "unpaid fee 18.00; cap 2× = 36.00; within cap" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T10:20:16Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-18T10:22:40Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-18T10:24:02Z", "actor": "officer-0417", "detail": "policy d4000000-…-0001 v1; signage d5000000-…-0001 v1 in force" }
  ]
}
```

The violation now carries the policy version and the exact sign that
were in force at 10:20 that morning. Had the amount been $40 against an
$18 unpaid fee, the cap (2× = $36) would have refused it with
`penalty-exceeds-cap`. Had no signage been on file for Lot C,
`signage-required`.

## Step 6 — Day 31: the server escalates

No payment, no appeal. Thirty days after issuance (and past the 14-day
grace), the server applies the first step itself and publishes
`apx.violations.status.v1`:

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 4,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-18T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000001", "version": 1, "className": "Signage" } ],
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018510", "issuedTime": "2026-09-18T10:24:02Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 43.75 },
  "dueTime": "2026-10-18T23:59:59Z",
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-18T10:24:02Z", "reason": "issued" },
    { "amount": { "currencyType": "USD", "currencyValue": 43.75 }, "time": "2026-10-19T00:00:05Z", "reason": "escalation", "step": "late-30", "detail": "+25% per policy d4000000-…-0001 v1; ceiling 3× = 105.00" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T10:20:16Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-18T10:22:40Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-18T10:24:02Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-10-19T00:00:05Z", "actor": "apx-scheduler", "detail": "escalation late-30 applied: 35.00 → 43.75" }
  ]
}
```

No client computed that $43.75. The schedule lives on the policy, the
server applies it, and every consumer — the driver's portal, the
collections integration, the appeals reviewer — reads the same
`amountHistory`. The `late-60` step would add $15 at day 60; the
ceiling of three times the issued amount ($105) can never be crossed.
An appeal opened in the meantime pauses the schedule (§19.10 rule 3).
