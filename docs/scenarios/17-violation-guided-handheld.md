# Scenario 17 — Guided enforcement: handheld eligibility check, officer confirms, citation on the windshield

**The story.** Level 2 of Lakeside Garage is a permit-only reserved area.
An enforcement officer walks it with a handheld that scans plates. For
each plate the handheld asks one question — *is this vehicle entitled to
be here right now?* — and only shows the officer the ones that aren't.
The officer confirms on site, corrects the classification the system
suggested, and issues a windshield citation from pre-printed stock.

**Actors.** Enforcement handheld app (`apx.violations:read`,
`apx.violations:manage`, APDS `ep` role for native reads) → Lakeside
Garage APX server.

## Step 1 — A plate that is fine: entitled, move on

```http
GET /v1/enforcement/eligibility?credential=SYN-1234&place=b1000000-0000-4000-8000-000000000003 HTTP/1.1
```

<!-- apx:validate EligibilityResult -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234" },
  "checkedTime": "2026-09-18T10:12:30Z",
  "entitled": true,
  "basis": [
    {
      "right": { "id": "e1000000-0000-4000-8000-000000000012", "className": "AssignedRight" },
      "rightType": "monthlyPermit",
      "validFrom": "2026-09-01T00:00:00Z",
      "validTo": "2026-09-30T23:59:59Z",
      "status": "valid"
    }
  ],
  "lastRead": {
    "observation": { "id": "f2000000-0000-4000-8000-000000000051", "className": "Observation" },
    "observationDateTime": "2026-09-18T07:58:12Z",
    "confidence": 0.98,
    "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0051.jpg"
  }
}
```

A Level-2 monthly permit, valid through the month. The handheld shows a
green tick; nothing is created. (The permit is bound to the *garage*, an
ancestor of Level 2 in the Place hierarchy, and counts — Part 19 §19.3
rule 2.)

## Step 2 — A plate that is not: wrong place

```http
GET /v1/enforcement/eligibility?credential=SYN-8820&place=b1000000-0000-4000-8000-000000000003 HTTP/1.1
```

<!-- apx:validate EligibilityResult -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820" },
  "checkedTime": "2026-09-18T10:14:05Z",
  "entitled": false,
  "basis": [
    {
      "right": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
      "rightType": "monthlyPermit",
      "validFrom": "2026-09-01T00:00:00Z",
      "validTo": "2026-09-30T23:59:59Z",
      "status": "wrongPlace"
    }
  ],
  "suggestedViolationType": "wrongPlace",
  "lastRead": {
    "observation": { "id": "f2000000-0000-4000-8000-000000000052", "className": "Observation" },
    "observationDateTime": "2026-09-18T08:31:47Z",
    "confidence": 0.96,
    "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0052.jpg"
  }
}
```

The vehicle *has* a valid monthly permit — for Level 3. The handheld shows
the officer exactly that: not "no permit", but "permit for the wrong
level", with the system's suggested classification. The officer decides.

## Step 3 — The officer records the candidate (guided)

The handheld creates the violation with `detection.mode: guided`, a photo
it just took, and the officer as the detector:

```http
POST /v1/violations HTTP/1.1
Idempotency-Key: hh-0417-20260918-101430
Content-Type: application/json

{
  "violationType": "wrongPlace",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": {
    "mode": "guided",
    "detectedTime": "2026-09-18T10:14:30Z",
    "detector": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" },
    "principal": "officer-0417"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-101430-1.jpg",
      "capturedTime": "2026-09-18T10:14:28Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000417", "className": "SupplementalEquipment" },
      "description": "windshield, Level 3 permit hangtag visible"
    }
  ]
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000002",
  "version": 1,
  "violationType": "wrongPlace",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": {
    "mode": "guided",
    "detectedTime": "2026-09-18T10:14:30Z",
    "detector": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" },
    "principal": "officer-0417"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-101430-1.jpg",
      "capturedTime": "2026-09-18T10:14:28Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000417", "className": "SupplementalEquipment" },
      "description": "windshield, Level 3 permit hangtag visible"
    }
  ],
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820" },
    "checkedTime": "2026-09-18T10:14:30Z",
    "entitled": false,
    "basis": [
      {
        "right": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
        "rightType": "monthlyPermit",
        "validFrom": "2026-09-01T00:00:00Z",
        "validTo": "2026-09-30T23:59:59Z",
        "status": "wrongPlace"
      }
    ],
    "suggestedViolationType": "wrongPlace"
  },
  "relatedRight": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T10:14:31Z", "actor": "officer-0417" }
  ]
}
```

## Step 4 — What a guided candidate must NOT do: skip review

Suppose an over-eager integration tried to issue straight away:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000002/issue HTTP/1.1
Content-Type: application/json

{ "noticeKind": "citation", "amount": { "currencyType": "USD", "currencyValue": 50.0 } }
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/violation-not-issuable",
  "title": "Violation not issuable",
  "status": 409,
  "detail": "Detection mode 'guided' requires review before issuance; current status is 'detected'.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000002"
}
```

A guided detection is always confirmed by a human first — that is the
whole point of the mode.

## Step 5 — The officer confirms

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000002/review HTTP/1.1
Content-Type: application/json

{
  "decision": "confirm",
  "note": "Level 3 permit displayed; vehicle in Level 2 reserved bay 218.",
  "reviewer": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" }
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000002",
  "version": 2,
  "violationType": "wrongPlace",
  "violationStatus": "confirmed",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-18T10:14:30Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "relatedRight": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T10:14:31Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-18T10:15:02Z", "actor": "officer-0417", "detail": "Level 3 permit displayed; vehicle in Level 2 reserved bay 218." }
  ]
}
```

Had the officer chosen `dismiss` (the hangtag was actually a Level 2
permit the camera couldn't see), the record would go to `dismissed` with
the reason — never deleted, so the queue's false-positive rate is
measurable.

## Step 6 — Citation on the windshield

The handheld prints from pre-numbered stock and passes the number in:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000002/issue HTTP/1.1
Content-Type: application/json

{
  "noticeKind": "citation",
  "noticeNumber": "LG-2026-018342",
  "amount": { "currencyType": "USD", "currencyValue": 50.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "deliveryMethod": "windshield"
}
```

<!-- apx:validate Violation -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000002",
  "version": 3,
  "violationType": "wrongPlace",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-18T10:14:30Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "relatedRight": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
  "notice": {
    "noticeKind": "citation",
    "noticeNumber": "LG-2026-018342",
    "issuedTime": "2026-09-18T10:15:40Z",
    "issuedBy": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" },
    "deliveryMethod": "windshield"
  },
  "amount": { "currencyType": "USD", "currencyValue": 50.0 },
  "dueTime": "2026-10-18T23:59:59Z",
  "statusHistory": [
    { "state": "detected", "time": "2026-09-18T10:14:31Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-18T10:15:02Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-18T10:15:40Z", "actor": "officer-0417", "detail": "citation LG-2026-018342 placed on windshield" }
  ]
}
```

`apx.violations.issued.v1` fires. From here the record follows the same
path as Scenario 16: paid via the Part 13 surface and attached with
`POST …/payment`, or appealed. And the permit holder's own resolution
context (Scenario 08) can surface this citation the next time they call —
the plate is the link.
