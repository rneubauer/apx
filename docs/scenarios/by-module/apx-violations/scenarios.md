# apx-violations — vetting scenarios

<!-- apx:module apx-violations tag=Violations ics=VIO -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-violations`. Gaps the spec cannot express are marked
`gap=F-VIO-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage, root place `b1…0001`, operated by organisation
`a1…0001`. Under it: Level 2, a permit-only reserved level (`b1…0003`,
bay 218 `b3…0218`); Lot C, a gateless pay-by-plate surface lot
(`b1…0004`); and Level 4 (`b1…0006`), opened 2026-09-22. Lot D
(`b1…0005`) is a leased overflow lot the operator also runs, bound under
its own root with no enforcement policy. Harbor Deck (`b1…0002`) is another
operator's garage outside the token's grant. Devices: the mobile LPR van
`b2…0031`, officer Okafor's handheld `b2…0417`; officer Okafor's Contact
is `c1…0417`, appellant Contacts `c1…0044` and `c1…0045`. Policies: Lot C
`d4…0001` (mail only for camera detections, cap 2× unpaid, refuse; 25% at
30 days, +$15 at 60, ceiling 3×; signage required), garage root `d4…0002`
(inherited by Level 2; cap $50 clamp; +$10 at 30 days; signage required).
Signage: Lot C entrance `d5…0001`, Level 2 entry `d5…0002`. Violations
are `d3…NNNN`, sessions `f1…`, observations `f2…`, rights `e1…`, the
settling PaymentRecord `d9…0001`.

Every request carries `Authorization: Bearer …` with scopes
`apx.violations:read apx.violations:manage` and `apx_places`
`["b1000000-0000-4000-8000-000000000001", "b1000000-0000-4000-8000-000000000005"]`
unless the scenario says
otherwise. Requests that create resources send the create shape; `id`,
`version`, `violationStatus`, `eligibilityCheck`, `policy`, `signage`,
`amountHistory`, `notice`, `appeal`, and `statusHistory` are
server-assigned.

---

## VIO-01 — Handheld screen-pop: entitled by a permit bound to the garage

<!-- apx:scenario VIO-01 kind=happy ics=APX-VIO-06 -->

**Given** officer Okafor walks Level 2 with a handheld that asks one
question per plate. **When** it asks about `SYN-1234`, whose monthly
permit is bound to the garage root, an ancestor of Level 2. **Then**
`entitled: true` with the ancestor-bound right as the `valid` basis and
the last read; nothing is created. The same question with an explicit
`credentialType` and `at` is answered for that instant.

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-1234&place=b1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234" },
  "checkedTime": "2026-09-24T10:12:30Z",
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
    "observationDateTime": "2026-09-24T07:58:12Z",
    "confidence": 0.98,
    "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0051.jpg"
  }
}
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=HT-0093&credentialType=hangtag&place=b1000000-0000-4000-8000-000000000003&at=2026-09-24T10:12:30Z -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "hangtag", "credentialIdentification": "HT-0093" },
  "checkedTime": "2026-09-24T10:12:30Z",
  "entitled": true,
  "basis": [
    {
      "right": { "id": "e1000000-0000-4000-8000-000000000013", "className": "AssignedRight" },
      "rightType": "monthlyPermit",
      "validFrom": "2026-09-01T00:00:00Z",
      "validTo": "2026-09-30T23:59:59Z",
      "status": "valid"
    }
  ]
}
```

---

## VIO-02 — Not entitled: wrong level, early arrival, and a place that does not exist

<!-- apx:scenario VIO-02 kind=happy ics=APX-VIO-06 -->

**Given** `SYN-8820` holds a Level 3 permit and is parked on Level 2, and
`SYN-7007` has a reservation on Level 2 starting at noon. **When** the
handheld asks at 10:14, and again for `SYN-7007` at 11:30 in the past.
**Then** `wrongPlace` and `notYetValid` bases with advisory
`suggestedViolationType` values the officer is free to overrule; a place
id nobody has is 404.

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-8820&place=b1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820" },
  "checkedTime": "2026-09-24T10:14:05Z",
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
    "observationDateTime": "2026-09-24T08:31:47Z",
    "confidence": 0.96,
    "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0052.jpg"
  }
}
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-7007&place=b1000000-0000-4000-8000-000000000003&at=2026-09-24T11:30:00Z -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7007" },
  "checkedTime": "2026-09-24T11:30:00Z",
  "entitled": false,
  "basis": [
    {
      "right": { "id": "e1000000-0000-4000-8000-000000000031", "className": "AssignedRight" },
      "rightType": "reservation",
      "validFrom": "2026-09-24T12:00:00Z",
      "validTo": "2026-09-24T18:00:00Z",
      "status": "notYetValid"
    }
  ],
  "suggestedViolationType": "notYetValidRight",
  "graceUntil": "2026-09-24T11:45:00Z"
}
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-8820&place=b1000000-0000-4000-8000-00000000dead -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-00000000dead visible to this credential.",
  "instance": "/v1/enforcement/eligibility"
}
```

---

## VIO-03 — The LPR van finds an overstay in Lot C

<!-- apx:scenario VIO-03 kind=happy ics=APX-VIO-01,APX-VIO-08,APX-VIO-09 -->

**Given** the van's 09:31 read of `SYN-4471` is already an APDS
Observation, and the pay-by-plate session ended at 09:05. **When** the
pipeline records the violation with the observation, an image link, and
the location copied from the Observation. **Then** 201 in `detected`
with the eligibility check the server ran at creation stored on the
record, and `apx.violations.detected.v1` is published with the Violation
as `data`.

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-093104-SYN-4471
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T09:31:04Z",
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
      "imageType": "plate",
      "capturedTime": "2026-09-24T09:31:04Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" }
    }
  ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6212, 41.8829 ] },
    "accuracyMetres": 2.5
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 1,
  "violationType": "expiredRight",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T09:31:04Z",
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
      "imageType": "plate",
      "capturedTime": "2026-09-24T09:31:04Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" }
    }
  ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6212, 41.8829 ] },
    "accuracyMetres": 2.5
  },
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471" },
    "checkedTime": "2026-09-24T09:31:04Z",
    "entitled": false,
    "basis": [
      {
        "session": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
        "rightType": "payByPlate",
        "validFrom": "2026-09-24T07:05:00Z",
        "validTo": "2026-09-24T09:05:00Z",
        "status": "expired"
      }
    ],
    "suggestedViolationType": "expiredRight",
    "graceUntil": "2026-09-24T09:20:00Z"
  },
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c", "detail": "rule paybyplate-expiry-15m; grace to 09:20 elapsed" }
  ],
  "recordInfo": {
    "creationTime": "2026-09-24T09:31:05Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "lpr-pipeline-lot-c"
  }
}
```

The event, place-bound on `Violation.place`:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  "type": "apx.violations.detected.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-24T09:31:05Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000001",
    "version": 1,
    "violationType": "expiredRight",
    "violationStatus": "detected",
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94 },
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
    "statusHistory": [
      { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c" }
    ]
  }
}
```

---

## VIO-04 — The van uploads the same batch twice, then a bug reuses a key

<!-- apx:scenario VIO-04 kind=edge ics=APX-VIO-01 -->

**Given** the van lost connectivity after the 201 in VIO-03. **When** it
retries with the identical key and body. **Then** 200 with the ORIGINAL
violation, whatever state it has reached; no second record. A later
upload that reuses the key for a different plate is 409
`idempotency-conflict` and records nothing.

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-093104-SYN-4471
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T09:31:04Z",
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
      "imageType": "plate",
      "capturedTime": "2026-09-24T09:31:04Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" }
    }
  ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6212, 41.8829 ] },
    "accuracyMetres": 2.5
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 1,
  "violationType": "expiredRight",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94, "rule": "paybyplate-expiry-15m" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" } ],
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c" }
  ]
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-093104-SYN-4471
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:33:10Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.91 },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000042", "className": "Observation" } ]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key lprvan-07-20260924-093104-SYN-4471 was first used at 2026-09-24T09:31:05Z for a detection of SYN-4471.",
  "instance": "/v1/violations"
}
```

---

## VIO-05 — Malformed detections: no key, no detection, latitude first, unknown type, unknown place

<!-- apx:scenario VIO-05 kind=refusal ics=APX-VIO-01,APX-VIO-09 -->

**Given** five broken integrations. **When** one omits `Idempotency-Key`,
one sends no `detection`, one sends coordinates latitude-first (the
second element, −87.62, is outside −90..90), one uses a `violationType`
in nobody's registry, and one names a place that does not exist.
**Then** 400 `idempotency-key-required`, 400 `invalid-request` twice
(with `errors[]` naming the member), and 422 `reference-unknown` twice —
the types the route's 400 and 422 descriptions now name (F-VIO-02,
F-VIO-03 fixed).

```http
POST /v1/violations
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:40:00Z", "principal": "lpr-pipeline-lot-c" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000042", "className": "Observation" } ]
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/violations is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-094100-bad1
```

<!-- apx:request POST /v1/violations invalid -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "detection is required (detection.mode, detection.detectedTime).",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-094100-bad2
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:41:00Z", "principal": "lpr-pipeline-lot-c" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000042", "className": "Observation" } ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ 41.8831, -87.6209 ] }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "location.observedLocation.coordinates[1] = -87.6209 is outside -90..90; GeoJSON positions are [longitude, latitude] (Part 19 §19.9).",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-094100-bad3
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "doubleParked",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:41:00Z", "principal": "lpr-pipeline-lot-c" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000042", "className": "Observation" } ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Violation type not in a served registry",
  "status": 422,
  "detail": "violationType doubleParked is not in apx-violation-types or any implementer list this server serves.",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-094100-bad4
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-00000000dead", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:41:00Z", "principal": "lpr-pipeline-lot-c" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5150" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000042", "className": "Observation" } ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Place unknown",
  "status": 422,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-00000000dead.",
  "instance": "/v1/violations"
}
```

---

## VIO-06 — The pipeline reads a monthly permit holder: recorded, and dismissed

<!-- apx:scenario VIO-06 kind=happy ics=APX-VIO-01 -->

**Given** the van also reads `SYN-1234` in Lot C, and the garage-wide
monthly permit covers Lot C. **When** the pipeline submits it anyway
(its pre-filter is off). **Then** 201, but in `dismissed`, with the
`valid` basis on the record: the audit shows what was checked, and the
queue's false-positive rate is measurable.

```http
POST /v1/violations
Idempotency-Key: lprvan-07-20260924-093250-SYN-1234
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "noValidRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:32:50Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.97, "rule": "paybyplate-no-session" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000043", "className": "Observation" } ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000002",
  "version": 1,
  "violationType": "noValidRight",
  "violationStatus": "dismissed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:32:50Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.97, "rule": "paybyplate-no-session" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000043", "className": "Observation" } ],
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234" },
    "checkedTime": "2026-09-24T09:32:50Z",
    "entitled": true,
    "basis": [
      {
        "right": { "id": "e1000000-0000-4000-8000-000000000012", "className": "AssignedRight" },
        "rightType": "monthlyPermit",
        "validFrom": "2026-09-01T00:00:00Z",
        "validTo": "2026-09-30T23:59:59Z",
        "status": "valid"
      }
    ]
  },
  "relatedRight": { "id": "e1000000-0000-4000-8000-000000000012", "className": "AssignedRight" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:32:51Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "dismissed", "time": "2026-09-24T09:32:51Z", "actor": "lakeside-apx", "detail": "entitled: AssignedRight e1000000-0000-4000-8000-000000000012 (monthlyPermit, garage-wide) valid at detectedTime" }
  ]
}
```

---

## VIO-07 — Guided: the officer records the candidate, then confirms with a corrected type

<!-- apx:scenario VIO-07 kind=happy ics=APX-VIO-03,APX-VIO-08,APX-VIO-09 -->

**Given** the screen-pop in VIO-02 said `wrongPlace` for `SYN-8820`.
**When** the handheld records a `guided` detection with the officer's
own position, and on site the officer finds the car in the accessible
bay and confirms with `violationType: restrictedSpace`. **Then** 201
`detected`, then 200 `confirmed` carrying the officer's correction, and
`apx.violations.status.v1` is published for the review. `location` is
now described as *modelled on* the APDS Observation `Location` —
`observerLocation` optional, `accuracyMetres` added — so the handheld's
body is conformant as written (F-VIO-16 fixed).

```http
POST /v1/violations
Idempotency-Key: hh-0417-20260924-101430
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "wrongPlace",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": {
    "mode": "guided",
    "detectedTime": "2026-09-24T10:14:30Z",
    "detector": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" },
    "principal": "officer-0417"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-101430-1.jpg",
      "imageType": "overview",
      "capturedTime": "2026-09-24T10:14:28Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000417", "className": "SupplementalEquipment" },
      "description": "windshield, Level 3 permit hangtag visible"
    }
  ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6201, 41.8835 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6202, 41.8834 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Level 2, bay 218" } ],
    "accuracyMetres": 6
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 1,
  "violationType": "wrongPlace",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": {
    "mode": "guided",
    "detectedTime": "2026-09-24T10:14:30Z",
    "detector": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" },
    "principal": "officer-0417"
  },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "evidence": [
    {
      "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-101430-1.jpg",
      "imageType": "overview",
      "capturedTime": "2026-09-24T10:14:28Z",
      "device": { "id": "b2000000-0000-4000-8000-000000000417", "className": "SupplementalEquipment" },
      "description": "windshield, Level 3 permit hangtag visible"
    }
  ],
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6201, 41.8835 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6202, 41.8834 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Level 2, bay 218" } ],
    "accuracyMetres": 6
  },
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820" },
    "checkedTime": "2026-09-24T10:14:30Z",
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
    { "state": "detected", "time": "2026-09-24T10:14:31Z", "actor": "officer-0417" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/review -->
```json
{
  "decision": "confirm",
  "violationType": "restrictedSpace",
  "note": "Bay 218 is the accessible bay; no placard displayed. Level 3 permit is beside the point.",
  "reviewer": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 2,
  "violationType": "restrictedSpace",
  "violationStatus": "confirmed",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:14:30Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL", "description": "grey SUV" },
  "relatedRight": { "id": "e1000000-0000-4000-8000-000000000027", "className": "AssignedRight" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:14:31Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:15:02Z", "actor": "officer-0417", "detail": "violationType wrongPlace → restrictedSpace: Bay 218 is the accessible bay; no placard displayed." }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4e",
  "type": "apx.violations.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000003", "className": "Violation" },
  "time": "2026-09-24T10:15:02Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000003",
    "version": 2,
    "violationType": "restrictedSpace",
    "violationStatus": "confirmed",
    "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
    "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:14:30Z", "principal": "officer-0417" },
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL" },
    "statusHistory": [
      { "state": "detected", "time": "2026-09-24T10:14:31Z", "actor": "officer-0417" },
      { "state": "confirmed", "time": "2026-09-24T10:15:02Z", "actor": "officer-0417" }
    ]
  }
}
```

---

## VIO-08 — Skipping review: a guided candidate, and an automated one where the policy forbids it

<!-- apx:scenario VIO-08 kind=refusal ics=APX-VIO-03 -->

**Given** a guided detection of `SYN-6102` in Lot C still in `detected`,
and an automated bay-camera detection of a cloned permit on Level 2,
where the garage policy in force says `unreviewedIssuance.permitted:
false`. **When** the pipeline first reads the effective policy, then an
over-eager integration issues both straight away. **Then** the pipeline
can see the refusal coming from `…/policies/effective`; 409
`violation-not-issuable` twice; issuing an id that does not exist is 404
(F-VIO-04 fixed: the rule is on the policy resource).

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000002",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "name": "Lakeside Garage structure rules",
  "policyStatus": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "unreviewedIssuance": { "permitted": false },
  "penaltyCap": { "maximumAmount": { "currencyType": "USD", "currencyValue": 50.0 }, "onExceed": "clamp" },
  "signageRequired": true
}
```

```http
POST /v1/violations
Idempotency-Key: hh-0417-20260924-102015
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6210, 41.8830 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Lot C, row 3, bay 14" } ],
    "accuracyMetres": 4
  },
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-102015-1.jpg", "capturedTime": "2026-09-24T10:20:12Z" } ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000004",
  "version": 1,
  "violationType": "expiredRight",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6210, 41.8830 ] },
    "observedLocationTextual": [ { "language": "en", "string": "Lot C, row 3, bay 14" } ],
    "accuracyMetres": 4
  },
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-102015-1.jpg", "capturedTime": "2026-09-24T10:20:12Z" } ],
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102" },
    "checkedTime": "2026-09-24T10:20:15Z",
    "entitled": false,
    "basis": [
      { "session": { "id": "f1000000-0000-4000-8000-000000000061", "className": "Session" }, "rightType": "payByPlate", "validFrom": "2026-09-24T08:00:00Z", "validTo": "2026-09-24T10:00:00Z", "status": "expired" }
    ],
    "suggestedViolationType": "expiredRight"
  },
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000061", "className": "Session" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:20:16Z", "actor": "officer-0417" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{ "noticeKind": "citation", "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "deliveryMethod": "windshield" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-not-issuable",
  "title": "Violation not issuable",
  "status": 409,
  "detail": "Detection mode guided requires review before issuance; current status is detected.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

```http
POST /v1/violations
Idempotency-Key: baycam-l2-20260924-103005-PM-4410
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "permitMisuse",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T10:30:05Z", "principal": "baycam-pipeline-l2", "confidence": 0.92, "rule": "permit-plate-mismatch" },
  "vehicle": { "credentialType": "permit", "credentialIdentification": "PM-4410", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000061", "className": "Observation" } ],
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0061.jpg", "imageType": "overview", "capturedTime": "2026-09-24T10:30:05Z" } ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000005",
  "version": 1,
  "violationType": "permitMisuse",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T10:30:05Z", "principal": "baycam-pipeline-l2", "confidence": 0.92, "rule": "permit-plate-mismatch" },
  "vehicle": { "credentialType": "permit", "credentialIdentification": "PM-4410", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000061", "className": "Observation" } ],
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
    "credential": { "credentialType": "permit", "credentialIdentification": "PM-4410" },
    "checkedTime": "2026-09-24T10:30:05Z",
    "entitled": false,
    "basis": [
      { "right": { "id": "e1000000-0000-4000-8000-000000000044", "className": "AssignedRight" }, "rightType": "monthlyPermit", "status": "suspended" }
    ],
    "suggestedViolationType": "permitMisuse"
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:30:06Z", "actor": "baycam-pipeline-l2" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/issue -->
```json
{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 50.0 }, "deliveryMethod": "mail" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-not-issuable",
  "title": "Violation not issuable",
  "status": 409,
  "detail": "Policy d4000000-0000-4000-8000-000000000002 v3 in force at Level 2 has unreviewedIssuance.permitted false; review first.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000005/issue"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/issue -->
```json
{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 35.0 } }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/issue"
}
```

---

## VIO-09 — Dismissed on site, reviewed twice, dismissed without a reason

<!-- apx:scenario VIO-09 kind=refusal ics=APX-VIO-02,APX-VIO-03 -->

**Given** the handheld read `SYN-2211` on Level 2 but the plate is
`SYN-2271` with a valid permit. **When** the officer dismisses with
`plateMisread`, then the handheld's retry reviews the same record again,
and a back-office user dismisses the Level 2 permit case with no
`reason`. **Then** 200 `dismissed` (never deleted), 409
`violation-transition-illegal`, and 400 `invalid-request` for the
missing reason — the rule is in the schema's `reason` description and
§19.1 rule 1, and `review` declares the 400 (F-VIO-05 fixed; stated in
prose rather than an `if/then`, which would narrow an existing request
body). Reviewing an unknown id is 404.

```http
POST /v1/violations
Idempotency-Key: hh-0417-20260924-104000
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "noValidRight",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:40:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-2211", "jurisdiction": "US-IL" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [ -87.6203, 41.8836 ] } }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000006",
  "version": 1,
  "violationType": "noValidRight",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:40:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-2211", "jurisdiction": "US-IL" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [ -87.6203, 41.8836 ] } },
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-2211" },
    "checkedTime": "2026-09-24T10:40:00Z",
    "entitled": false,
    "basis": [],
    "suggestedViolationType": "noValidRight"
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:40:01Z", "actor": "officer-0417" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000006/review -->
```json
{
  "decision": "dismiss",
  "reason": "plateMisread",
  "note": "Plate is SYN-2271; permit e1…0029 valid.",
  "reviewer": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000006",
  "version": 2,
  "violationType": "noValidRight",
  "violationStatus": "dismissed",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:40:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-2211", "jurisdiction": "US-IL" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:40:01Z", "actor": "officer-0417" },
    { "state": "dismissed", "time": "2026-09-24T10:41:10Z", "actor": "officer-0417", "detail": "plateMisread: Plate is SYN-2271; permit e1…0029 valid." }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000006/review -->
```json
{ "decision": "dismiss", "reason": "plateMisread" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "review is valid only from detected; violation d3000000-0000-4000-8000-000000000006 is dismissed.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000006/review"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/review -->
```json
{ "decision": "dismiss", "note": "looks fine to me" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required when decision is dismiss.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000005/review"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/review -->
```json
{ "decision": "confirm" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/review"
}
```

---

## VIO-10 — Unreviewed automated issuance by mail, policy and signage frozen on

<!-- apx:scenario VIO-10 kind=happy ics=APX-VIO-03,APX-VIO-08,APX-VIO-10,APX-VIO-12 -->

**Given** the VIO-03 overstay in Lot C, and Lot C policy `d4…0001`
(`unreviewedIssuance` permitted at confidence ≥ 0.9; mail allowed for
automated detections within 14 days, with one observation, one image,
and a position). **When** the pipeline issues a $35 mailed notice.
**Then** 200 `issued`, with the policy version, the entrance sign in
force at `detectedTime`, the unpaid fee ($18.00) and the resulting cap
(2× = $36.00) as `unpaidAmount`/`capAmount`, and the first
`amountHistory` entry frozen onto the record, and
`apx.violations.issued.v1` published (F-VIO-06 fixed).

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000001/issue -->
```json
{
  "noticeKind": "notice",
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-24T23:59:59Z",
  "deliveryMethod": "mail"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 2,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.94, "rule": "paybyplate-expiry-15m" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000041", "className": "Observation" } ],
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0041.jpg", "imageType": "plate", "capturedTime": "2026-09-24T09:31:04Z" } ],
  "location": { "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] }, "observerLocation": { "type": "Point", "coordinates": [ -87.6212, 41.8829 ] } },
  "relatedSession": { "id": "f1000000-0000-4000-8000-000000000044", "className": "Session" },
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000001", "version": 1, "className": "Signage" } ],
  "notice": {
    "noticeKind": "notice",
    "noticeNumber": "LG-2026-018301",
    "issuedTime": "2026-09-24T09:31:09Z",
    "issuedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "deliveryMethod": "mail"
  },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-24T23:59:59Z",
  "unpaidAmount": { "currencyType": "USD", "currencyValue": 18.0 },
  "capAmount": { "currencyType": "USD", "currencyValue": 36.0 },
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T09:31:09Z", "reason": "issued", "detail": "unpaid fee 18.00 (session f1…0044 overstay); cap 2× = 36.00" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T09:31:09Z", "actor": "lpr-pipeline-lot-c", "detail": "unreviewed automated issuance (confidence 0.94 ≥ 0.9); policy d4…0001 v1; notice LG-2026-018301 queued for mail" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c50",
  "type": "apx.violations.issued.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-24T09:31:09Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000001",
    "version": 2,
    "violationType": "expiredRight",
    "violationStatus": "issued",
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z" },
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
    "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
    "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-24T09:31:09Z", "deliveryMethod": "mail" },
    "amount": { "currencyType": "USD", "currencyValue": 35.0 },
    "dueTime": "2026-10-24T23:59:59Z"
  }
}
```

---

## VIO-11 — A guided notice by mail, then above the cap, then lawful on the windshield

<!-- apx:scenario VIO-11 kind=refusal ics=APX-VIO-10,APX-VIO-12 -->

**Given** the guided Lot C detection `d3…0004` from VIO-08. **When** the
officer confirms it, the handheld defaults to mail, then retries on the
windshield at $40 against an $18 unpaid fee, then sends a body with no
`amount`, then at $35. **Then** 422 `delivery-method-not-permitted`
(mail is lawful only for camera detections), 422 `penalty-exceeds-cap`
(2× = $36, `onExceed: refuse`), 400 `invalid-request`, and finally 200
`issued` with the policy, sign, `unpaidAmount`, and `capAmount` frozen.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/review -->
```json
{ "decision": "confirm", "reviewer": { "id": "c1000000-0000-4000-8000-000000000417", "className": "Contact" } }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000004",
  "version": 2,
  "violationType": "expiredRight",
  "violationStatus": "confirmed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:20:16Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:22:40Z", "actor": "officer-0417" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "dueTime": "2026-10-24T23:59:59Z", "deliveryMethod": "mail" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/delivery-method-not-permitted",
  "title": "Delivery method not permitted",
  "status": 422,
  "detail": "Policy d4000000-0000-4000-8000-000000000001 v1: detection mode guided permits deliveryMethod windshield, handed; not mail.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{ "noticeKind": "citation", "amount": { "currencyType": "USD", "currencyValue": 40.0 }, "dueTime": "2026-10-24T23:59:59Z", "deliveryMethod": "windshield" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/penalty-exceeds-cap",
  "title": "Penalty exceeds cap",
  "status": 422,
  "detail": "Amount 40.00 exceeds the policy cap of 2× the unpaid fee 18.00 = 36.00 (onExceed: refuse).",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue invalid -->
```json
{ "noticeKind": "citation", "deliveryMethod": "windshield" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "amount is required.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue",
  "errors": [ { "pointer": "/amount", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{ "noticeKind": "citation", "noticeNumber": "LG-2026-018510", "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "dueTime": "2026-10-24T23:59:59Z", "deliveryMethod": "windshield" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000004",
  "version": 3,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "location": {
    "observedLocation": { "type": "Point", "coordinates": [ -87.6209, 41.8831 ] },
    "observerLocation": { "type": "Point", "coordinates": [ -87.6210, 41.8830 ] }
  },
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000001", "version": 1, "className": "Signage" } ],
  "notice": { "noticeKind": "citation", "noticeNumber": "LG-2026-018510", "issuedTime": "2026-09-24T10:24:02Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-24T23:59:59Z",
  "unpaidAmount": { "currencyType": "USD", "currencyValue": 18.0 },
  "capAmount": { "currencyType": "USD", "currencyValue": 36.0 },
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T10:24:02Z", "reason": "issued" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:20:16Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:22:40Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T10:24:02Z", "actor": "officer-0417", "detail": "citation LG-2026-018510 on windshield; policy d4…0001 v1; signage d5…0001 v1" }
  ]
}
```

---

## VIO-12 — Too late, and not enough evidence

<!-- apx:scenario VIO-12 kind=refusal ics=APX-VIO-10 -->

**Given** two automated Lot C detections the back office only now gets
to: `d3…0007`, a maximum-stay overstay detected sixteen days ago, and
`d3…0008`, a street-cleaning read whose camera sent no position.
**When** both are issued by mail. **Then** 422 `notice-deadline-passed`
(14 days) and 422 `delivery-method-not-permitted` with `detail` naming
the missing evidence.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000007/issue -->
```json
{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 30.0 }, "deliveryMethod": "mail" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/notice-deadline-passed",
  "title": "Notice deadline passed",
  "status": 422,
  "detail": "Detected 2026-09-08T14:02:00Z (maximumStayExceeded); policy d4000000-0000-4000-8000-000000000001 v1 allows mail within P14D, which elapsed 2026-09-22T14:02:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000007/issue"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000008/issue -->
```json
{ "noticeKind": "notice", "amount": { "currencyType": "USD", "currencyValue": 30.0 }, "deliveryMethod": "mail" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/delivery-method-not-permitted",
  "title": "Delivery method not permitted",
  "status": 422,
  "detail": "Policy d4000000-0000-4000-8000-000000000001 v1 requires location.observedLocation for mail notices on automated detections; violation d3000000-0000-4000-8000-000000000008 (noParkingPeriod) has none.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000008/issue"
}
```

---

## VIO-13 — Level 2 inherits the garage policy, and the cap clamps

<!-- apx:scenario VIO-13 kind=happy ics=APX-VIO-10,APX-VIO-12 -->

**Given** Level 2 has no policy of its own; the garage root carries
`d4…0002` (penalty cap $50, `onExceed: clamp`). **When** the handheld
asks what applies on Level 2, then issues the confirmed accessible-bay
case from VIO-07 at $75. **Then** the effective lookup returns the root
policy, and the issue succeeds at $50 with a single first
`amountHistory` entry `reason: cap`, `amount` $50, and `requestedAmount`
$75 — the shape §19.10 rule 2 now fixes (F-VIO-07 fixed).

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000003&at=2026-09-24T10:14:30Z -->
<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000002",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "name": "Lakeside Garage structure rules",
  "policyStatus": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "deliveryRules": [
    { "detectionModes": [ "automated", "guided", "manual" ], "deliveryMethods": [ "windshield", "handed", "mail" ], "noticeDeadline": "P7D" }
  ],
  "unreviewedIssuance": { "permitted": false },
  "penaltyCap": { "maximumAmount": { "currencyType": "USD", "currencyValue": 50.0 }, "onExceed": "clamp" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addAmount": { "currencyType": "USD", "currencyValue": 10.0 } }
  ],
  "overallCeiling": { "maximumAmount": { "currencyType": "USD", "currencyValue": 100.0 } },
  "appealWindowDays": 30,
  "signageRequired": true
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/issue -->
```json
{ "noticeKind": "citation", "noticeNumber": "LG-2026-018342", "amount": { "currencyType": "USD", "currencyValue": 75.0 }, "dueTime": "2026-10-24T23:59:59Z", "deliveryMethod": "windshield" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 3,
  "violationType": "restrictedSpace",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "space": { "id": "b3000000-0000-4000-8000-000000000218", "className": "Space" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:14:30Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-8820", "jurisdiction": "US-IL" },
  "policy": { "id": "d4000000-0000-4000-8000-000000000002", "version": 3, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000002", "version": 1, "className": "Signage" } ],
  "notice": { "noticeKind": "citation", "noticeNumber": "LG-2026-018342", "issuedTime": "2026-09-24T10:15:40Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 50.0 },
  "dueTime": "2026-10-24T23:59:59Z",
  "capAmount": { "currencyType": "USD", "currencyValue": 50.0 },
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 50.0 }, "requestedAmount": { "currencyType": "USD", "currencyValue": 75.0 }, "time": "2026-09-24T10:15:40Z", "reason": "cap", "detail": "clamped to policy d4…0002 v3 maximum 50.00" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:14:31Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:15:02Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T10:15:40Z", "actor": "officer-0417", "detail": "clamped 75.00 → 50.00" }
  ]
}
```

---

## VIO-14 — Manual finds: a new level with no sign yet, and a lot with no policy at all

<!-- apx:scenario VIO-14 kind=refusal ics=APX-VIO-03,APX-VIO-10,APX-VIO-12 -->

**Given** Level 4 (`b1…0006`) opened on 2026-09-22 under the garage
policy (`signageRequired: true`), but its entry sign has not been
recorded; and Lot D (`b1…0005`), a leased overflow lot bound under a
separate root, has no policy anywhere up its tree. **When** the
officer creates a `manual` obstruction on Level 4, confirms their own
finding, and issues; then does the same for a car across two bays in
Lot D. **Then** 422 `signage-required` on Level 4; on Lot D, 404 from
the effective lookup and a 200 issue with no policy checks and no
`policy` frozen on.

```http
POST /v1/violations
Idempotency-Key: hh-0417-20260924-111500
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "obstruction",
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:15:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-3090", "jurisdiction": "US-WI", "description": "white van blocking ramp" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [ -87.6199, 41.8837 ] } },
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/evidence/hh-0417-111500-1.jpg", "imageType": "overview", "capturedTime": "2026-09-24T11:14:50Z" } ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000010",
  "version": 1,
  "violationType": "obstruction",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:15:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-3090", "jurisdiction": "US-WI", "description": "white van blocking ramp" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [ -87.6199, 41.8837 ] } },
  "eligibilityCheck": {
    "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-3090" },
    "checkedTime": "2026-09-24T11:15:00Z",
    "entitled": false,
    "basis": []
  },
  "statusHistory": [ { "state": "detected", "time": "2026-09-24T11:15:01Z", "actor": "officer-0417" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000010/review -->
```json
{ "decision": "confirm", "note": "own finding confirmed" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000010",
  "version": 2,
  "violationType": "obstruction",
  "violationStatus": "confirmed",
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:15:00Z", "principal": "officer-0417" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:15:01Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T11:15:20Z", "actor": "officer-0417", "detail": "own finding confirmed" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000010/issue -->
```json
{ "noticeKind": "citation", "amount": { "currencyType": "USD", "currencyValue": 50.0 }, "deliveryMethod": "handed" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/signage-required",
  "title": "Signage required",
  "status": 422,
  "detail": "Policy d4000000-0000-4000-8000-000000000002 v3 requires posted signage; no Signage was in force at b1000000-0000-4000-8000-000000000006 or an ancestor at 2026-09-24T11:15:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000010/issue"
}
```

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No EnforcementPolicy in force at b1000000-0000-4000-8000-000000000005 or any ancestor at 2026-09-24T11:30:00Z.",
  "instance": "/v1/enforcement/policies/effective"
}
```

```http
POST /v1/violations
Idempotency-Key: hh-0417-20260924-113000
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "other",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7720", "jurisdiction": "US-IL" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [ -87.6231, 41.8822 ] } }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000011",
  "version": 1,
  "violationType": "other",
  "violationStatus": "detected",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7720", "jurisdiction": "US-IL" },
  "statusHistory": [ { "state": "detected", "time": "2026-09-24T11:30:01Z", "actor": "officer-0417" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/review -->
```json
{ "decision": "confirm", "note": "parked across bays 7 and 8" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000011",
  "version": 2,
  "violationType": "other",
  "violationStatus": "confirmed",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z", "principal": "officer-0417" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:30:01Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T11:30:30Z", "actor": "officer-0417" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/issue -->
```json
{ "noticeKind": "warning", "amount": { "currencyType": "USD", "currencyValue": 0.0 }, "deliveryMethod": "windshield", "note": "first offence: warning" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000011",
  "version": 3,
  "violationType": "other",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7720", "jurisdiction": "US-IL" },
  "signage": [],
  "notice": { "noticeKind": "warning", "noticeNumber": "LG-2026-018515", "issuedTime": "2026-09-24T11:31:00Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 0.0 },
  "amountHistory": [ { "amount": { "currencyType": "USD", "currencyValue": 0.0 }, "time": "2026-09-24T11:31:00Z", "reason": "issued" } ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:30:01Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T11:30:30Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T11:31:00Z", "actor": "officer-0417", "detail": "no EnforcementPolicy in force; issued without policy checks; alert apx.alert.raised.v1 sent" }
  ]
}
```

---

## VIO-15 — Paid online: the money goes through Part 13, the violation links it

<!-- apx:scenario VIO-15 kind=lifecycle ics=APX-VIO-02,APX-VIO-05,APX-VIO-08 -->

**Given** the mailed notice `LG-2026-018301` from VIO-10, and the driver
paid $35 on the portal through `POST /v1/payments`, which returned
PaymentRecord `d9…0001`. **When** the portal attaches it, then its retry
attaches it again, and an integration tries to pay the still-`detected`
Level 2 case, an unknown id, and a body with no `payment`. **Then** 200
`paid` with `apx.violations.status.v1`, then 409
`violation-transition-illegal` twice, 404, and 400 `invalid-request`.
On 2026-10-19 — day 25, past Lot C's 21-day `appealWindowDays` — the
driver asks to contest after paying: 409 `appeal-closed` (the window, not
the state, refuses it; inside the window a pay-then-appeal is lawful,
VIO-29, F-VIO-13 fixed). A month later reconciliation has closed it
server-side.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000001/payment -->
```json
{
  "payment": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" },
  "note": "portal card payment, reference LG-2026-018301"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 3,
  "violationType": "expiredRight",
  "violationStatus": "paid",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-24T09:31:09Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "dueTime": "2026-10-24T23:59:59Z",
  "payment": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T09:31:09Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "paid", "time": "2026-09-27T19:02:11Z", "actor": "appeals-portal", "detail": "PaymentRecord d9…0001" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c51",
  "type": "apx.violations.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-27T19:02:11Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000001",
    "version": 3,
    "violationType": "expiredRight",
    "violationStatus": "paid",
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z" },
    "payment": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" }
  }
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000001/payment -->
```json
{ "payment": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" } }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "payment is valid only from issued; violation d3000000-0000-4000-8000-000000000001 is paid.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000001/payment"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000001/appeals -->
```json
{ "reason": "paidUnderProtest", "detail": "Paid to stop the late fee; I had extended in the app." }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Appeal window P21D (policy d4…0001 v1) from notice issue 2026-09-24T09:31:09Z elapsed 2026-10-15T09:31:09Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000001/appeals"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000001/payment invalid -->
```json
{ "note": "portal forgot the reference" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "payment is required.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000001/payment",
  "errors": [ { "pointer": "/payment", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/payment -->
```json
{ "payment": { "id": "d9000000-0000-4000-8000-000000000002", "className": "PaymentRecord" } }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "payment is valid only from issued; violation d3000000-0000-4000-8000-000000000005 is detected.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000005/payment"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/payment -->
```json
{ "payment": { "id": "d9000000-0000-4000-8000-000000000002", "className": "PaymentRecord" } }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/payment"
}
```

A month later, after the refund window, the server closes it:

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000001",
  "version": 4,
  "violationType": "expiredRight",
  "violationStatus": "closed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "payment": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:31:05Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T09:31:09Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "paid", "time": "2026-09-27T19:02:11Z", "actor": "appeals-portal" },
    { "state": "closed", "time": "2026-10-27T00:00:03Z", "actor": "apx-scheduler", "detail": "reconciled; 30-day refund window elapsed" }
  ]
}
```

---

## VIO-16 — Appealed inside the window: escalation pauses, the reviewer reduces

<!-- apx:scenario VIO-16 kind=lifecycle ics=APX-VIO-04,APX-VIO-07,APX-VIO-11 -->

**Given** `d3…0009`, an automated Lot C early-arrival case
(`notYetValidRight`) mailed at $35 on 2026-09-24. **When** the driver
appeals on 2026-10-10 with a photo of the reservation (appellant media,
held as untrusted), day 30 passes while the appeal is open, and the
reviewer reduces to $20 on 2026-10-28. **Then** `appealed`, no
escalation entry at day 30, and back to `issued` at $20 with
`reason: appealReduced`. The escalation clock paused for the 18 days
`appealed`, so the late-30 step does not fire on return; it falls due
on day 30 of time spent `issued`, 2026-11-11 (F-VIO-09 fixed, §19.10
rule 3). A second appeal is 409 `appeal-closed`.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000009/appeals -->
```json
{
  "reason": "reservationHeld",
  "detail": "My reservation started at noon; I arrived at 11:40 and waited.",
  "appellant": { "id": "c1000000-0000-4000-8000-000000000045", "className": "Contact" },
  "evidenceLinks": [ "https://appeals.lakeside-garage.example/uploads/4a7e-reservation.png" ]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000009",
  "version": 3,
  "violationType": "notYetValidRight",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T11:40:12Z" },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018520", "issuedTime": "2026-09-24T11:40:20Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "appeal": {
    "reason": "reservationHeld",
    "detail": "My reservation started at noon; I arrived at 11:40 and waited.",
    "appellant": { "id": "c1000000-0000-4000-8000-000000000045", "className": "Contact" },
    "openedTime": "2026-10-10T16:05:00Z",
    "openedFrom": "issued"
  },
  "amountHistory": [ { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T11:40:20Z", "reason": "issued" } ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:40:13Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T11:40:20Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "appealed", "time": "2026-10-10T16:05:00Z", "actor": "appeals-portal", "detail": "1 appellant upload quarantined for scanning" }
  ]
}
```

Day 31, the appeal still open: the schedule has not fired.

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000009 -->
<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000009",
  "version": 3,
  "violationType": "notYetValidRight",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T11:40:12Z" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "amountHistory": [ { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T11:40:20Z", "reason": "issued" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000009/appeals/resolve -->
```json
{
  "resolution": "reduced",
  "adjustedAmount": { "currencyType": "USD", "currencyValue": 20.0 },
  "note": "Reservation confirmed for 12:00; arrival 20 minutes early. Early-arrival reduction."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000009",
  "version": 4,
  "violationType": "notYetValidRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T11:40:12Z" },
  "amount": { "currencyType": "USD", "currencyValue": 20.0 },
  "appeal": {
    "reason": "reservationHeld",
    "openedTime": "2026-10-10T16:05:00Z",
    "resolvedTime": "2026-10-28T09:12:00Z",
    "resolution": "reduced",
    "resolutionNote": "Reservation confirmed for 12:00; arrival 20 minutes early. Early-arrival reduction."
  },
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T11:40:20Z", "reason": "issued" },
    { "amount": { "currencyType": "USD", "currencyValue": 20.0 }, "time": "2026-10-28T09:12:00Z", "reason": "appealReduced" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:40:13Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T11:40:20Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "appealed", "time": "2026-10-10T16:05:00Z", "actor": "appeals-portal" },
    { "state": "issued", "time": "2026-10-28T09:12:00Z", "actor": "reviewer-0212", "detail": "appeal reduced: 35.00 → 20.00" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000009/appeals -->
```json
{ "reason": "reservationHeld", "detail": "Still unfair." }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000009 already had its one appeal (resolved reduced 2026-10-28T09:12:00Z).",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000009/appeals"
}
```

---

## VIO-17 — Appeal dismissed: closed, and everything after it refused

<!-- apx:scenario VIO-17 kind=lifecycle ics=APX-VIO-02,APX-VIO-04 -->

**Given** the $50 accessible-bay citation `d3…0003` from VIO-13. **When**
the driver appeals with a photo of the placard, and the reviewer
dismisses. **Then** `appealed`, then `closed`. Afterwards resolving
again and appealing again are 409 `appeal-closed`, and voiding or paying
the closed record is 409 `violation-transition-illegal`. Appealing or
resolving an unknown id is 404.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/appeals -->
```json
{
  "reason": "placardDisplayed",
  "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" },
  "evidenceLinks": [ "https://appeals.lakeside-garage.example/uploads/77b1-placard.jpg" ]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 4,
  "violationType": "restrictedSpace",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:14:30Z" },
  "amount": { "currencyType": "USD", "currencyValue": 50.0 },
  "appeal": { "reason": "placardDisplayed", "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" }, "openedTime": "2026-09-25T08:30:00Z" }
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/appeals/resolve -->
```json
{ "resolution": "dismissed", "note": "Valid placard, face-down on the dashboard; officer photo angle missed it." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000003",
  "version": 5,
  "violationType": "restrictedSpace",
  "violationStatus": "closed",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:14:30Z" },
  "amount": { "currencyType": "USD", "currencyValue": 50.0 },
  "appeal": {
    "reason": "placardDisplayed",
    "openedTime": "2026-09-25T08:30:00Z",
    "resolvedTime": "2026-09-26T14:00:00Z",
    "resolution": "dismissed",
    "resolutionNote": "Valid placard, face-down on the dashboard; officer photo angle missed it."
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:14:31Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:15:02Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T10:15:40Z", "actor": "officer-0417" },
    { "state": "appealed", "time": "2026-09-25T08:30:00Z", "actor": "appeals-portal" },
    { "state": "closed", "time": "2026-09-26T14:00:00Z", "actor": "reviewer-0212", "detail": "appeal dismissed" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/appeals/resolve -->
```json
{ "resolution": "upheld" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000003 has no open appeal; it is closed.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000003/appeals/resolve"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/appeals -->
```json
{ "reason": "placardDisplayed" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000003 is closed.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000003/appeals"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000003/void -->
```json
{ "reason": "issuedInError" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000003 is closed (terminal); void is refused.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000003/void"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/appeals -->
```json
{ "reason": "notTheVehicle" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/appeals"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/appeals/resolve -->
```json
{ "resolution": "dismissed" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/appeals/resolve"
}
```

---

## VIO-18 — Upheld, and the transitions that are not allowed

<!-- apx:scenario VIO-18 kind=refusal ics=APX-VIO-02,APX-VIO-04 -->

**Given** the Lot D warning `d3…0011` from VIO-14, and the confirmed but
unissued Level 4 case `d3…0010`. **When** the driver appeals the
warning, the reviewer first sends `reduced` with no `adjustedAmount`,
then `upheld`; someone resolves the un-appealed `d3…0004`; someone
appeals the never-issued `d3…0010`; and a portal bug opens an appeal
with no `reason`. **Then** `appealed` (`openedFrom: issued`); 400
`invalid-request` for the missing amount (declared, and stated in the
`adjustedAmount` description and §19.1 rule 3: F-VIO-05 fixed);
`upheld` back to `issued` with the amount unchanged; 409 `appeal-closed`
for the resolve with no open appeal, and 409
`violation-transition-illegal` for the appeal from `confirmed` — §19.1
rule 3 now draws that line explicitly (F-VIO-08 fixed); and 400
`invalid-request` for the reason-less appeal.

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/appeals invalid -->
```json
{ "detail": "portal sent no reason" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000011/appeals",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/appeals -->
```json
{ "reason": "notTheVehicle", "detail": "My car was in bay 7 only." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000011",
  "version": 4,
  "violationType": "other",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z" },
  "amount": { "currencyType": "USD", "currencyValue": 0.0 },
  "appeal": { "reason": "notTheVehicle", "detail": "My car was in bay 7 only.", "openedTime": "2026-09-24T18:00:00Z", "openedFrom": "issued" }
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/appeals/resolve invalid -->
```json
{ "resolution": "reduced" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "adjustedAmount is required when resolution is reduced.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000011/appeals/resolve"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000011/appeals/resolve -->
```json
{ "resolution": "upheld", "note": "Officer photo shows the vehicle across bays 7 and 8." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000011",
  "version": 5,
  "violationType": "other",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "detection": { "mode": "manual", "detectedTime": "2026-09-24T11:30:00Z" },
  "amount": { "currencyType": "USD", "currencyValue": 0.0 },
  "appeal": {
    "reason": "notTheVehicle",
    "openedTime": "2026-09-24T18:00:00Z",
    "resolvedTime": "2026-09-25T09:00:00Z",
    "resolution": "upheld",
    "resolutionNote": "Officer photo shows the vehicle across bays 7 and 8."
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T11:30:01Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T11:30:30Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T11:31:00Z", "actor": "officer-0417" },
    { "state": "appealed", "time": "2026-09-24T18:00:00Z", "actor": "appeals-portal" },
    { "state": "issued", "time": "2026-09-25T09:00:00Z", "actor": "reviewer-0212", "detail": "appeal upheld" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve -->
```json
{ "resolution": "dismissed" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000004 is issued with no open appeal.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000010/appeals -->
```json
{ "reason": "notTheVehicle" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "appeals is valid only from issued; violation d3000000-0000-4000-8000-000000000010 is confirmed.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000010/appeals"
}
```

---

## VIO-19 — Day 30 and day 60: the server escalates; a late appeal is refused

<!-- apx:scenario VIO-19 kind=lifecycle ics=APX-VIO-04,APX-VIO-08,APX-VIO-11 -->

**Given** the $35 windshield citation `d3…0004` from VIO-11, unpaid and
unappealed, under Lot C policy (grace 14 days, +25% at 30, +$15 at 60,
ceiling 3× = $105, appeal window 21 days). **When** day 30 passes, the
driver tries to appeal on day 45, and day 60 passes. **Then** the server
appends `late-30` ($43.75) and publishes `apx.violations.status.v1`; the
appeal is 409 `appeal-closed` (outside the window); `late-60` brings it
to $58.75. No client computed either amount.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c52",
  "type": "apx.violations.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000004", "className": "Violation" },
  "time": "2026-10-24T10:24:05Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000004",
    "version": 4,
    "violationType": "expiredRight",
    "violationStatus": "issued",
    "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
    "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z" },
    "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
    "amount": { "currencyType": "USD", "currencyValue": 43.75 },
    "amountHistory": [
      { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T10:24:02Z", "reason": "issued" },
      { "amount": { "currencyType": "USD", "currencyValue": 43.75 }, "time": "2026-10-24T10:24:05Z", "reason": "escalation", "step": "late-30", "detail": "+25% per policy d4…0001 v1; ceiling 105.00" }
    ]
  }
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals -->
```json
{ "reason": "didNotSeeNotice", "detail": "Never saw anything on my windshield." }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/appeal-closed",
  "title": "Appeal closed",
  "status": 409,
  "detail": "Appeal window of 21 days from 2026-09-24T10:24:02Z closed 2026-10-15T10:24:02Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals"
}
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000004",
  "version": 5,
  "violationType": "expiredRight",
  "violationStatus": "issued",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z", "principal": "officer-0417" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6102", "jurisdiction": "US-IL" },
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "version": 1, "className": "EnforcementPolicy" },
  "signage": [ { "id": "d5000000-0000-4000-8000-000000000001", "version": 1, "className": "Signage" } ],
  "notice": { "noticeKind": "citation", "noticeNumber": "LG-2026-018510", "issuedTime": "2026-09-24T10:24:02Z", "deliveryMethod": "windshield" },
  "amount": { "currencyType": "USD", "currencyValue": 58.75 },
  "dueTime": "2026-10-24T23:59:59Z",
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T10:24:02Z", "reason": "issued" },
    { "amount": { "currencyType": "USD", "currencyValue": 43.75 }, "time": "2026-10-24T10:24:05Z", "reason": "escalation", "step": "late-30" },
    { "amount": { "currencyType": "USD", "currencyValue": 58.75 }, "time": "2026-11-23T10:24:04Z", "reason": "escalation", "step": "late-60", "detail": "+15.00 per policy d4…0001 v1; ceiling 105.00" }
  ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:20:16Z", "actor": "officer-0417" },
    { "state": "confirmed", "time": "2026-09-24T10:22:40Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-09-24T10:24:02Z", "actor": "officer-0417" },
    { "state": "issued", "time": "2026-10-24T10:24:05Z", "actor": "apx-scheduler", "detail": "escalation late-30: 35.00 → 43.75" },
    { "state": "issued", "time": "2026-11-23T10:24:04Z", "actor": "apx-scheduler", "detail": "escalation late-60: 43.75 → 58.75" }
  ]
}
```

---

## VIO-20 — Void: a duplicate, a missed deadline, and what cannot be voided

<!-- apx:scenario VIO-20 kind=lifecycle ics=APX-VIO-02 -->

**Given** the Level 2 bay-camera case `d3…0005` turns out to duplicate a
handheld citation, and `d3…0007` can no longer be lawfully noticed
(VIO-12). **When** the supervisor voids both, voids `d3…0005` again,
tries to review it, voids the already-`dismissed` `d3…0006`, voids an
unknown id, and sends a void with no `reason`. **Then** 200 `voided`
twice with the record and history intact, 409
`violation-transition-illegal` three times, 404, and 400
`invalid-request`. The terminal set is now named once — `dismissed`,
`closed`, `voided` — and `paid` is voidable with a refund reference
(VIO-29; F-VIO-10 fixed).

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/void -->
```json
{ "reason": "duplicate", "note": "Same vehicle cited by handheld as LG-2026-018344." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000005",
  "version": 2,
  "violationType": "permitMisuse",
  "violationStatus": "voided",
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T10:30:05Z", "principal": "baycam-pipeline-l2" },
  "vehicle": { "credentialType": "permit", "credentialIdentification": "PM-4410", "jurisdiction": "US-IL" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000061", "className": "Observation" } ],
  "evidence": [ { "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0061.jpg", "imageType": "overview" } ],
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:30:06Z", "actor": "baycam-pipeline-l2" },
    { "state": "voided", "time": "2026-09-24T12:00:00Z", "actor": "sup-m.reyes", "detail": "duplicate: Same vehicle cited by handheld as LG-2026-018344." }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000007/void -->
```json
{ "reason": "policyException", "note": "Notice deadline passed before back-office review." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000007",
  "version": 2,
  "violationType": "maximumStayExceeded",
  "violationStatus": "voided",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-08T14:02:00Z" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-08T14:02:01Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "voided", "time": "2026-09-24T12:01:00Z", "actor": "sup-m.reyes", "detail": "policyException: Notice deadline passed before back-office review." }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000005 is already voided.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000005/void"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000005/review -->
```json
{ "decision": "confirm" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "review is valid only from detected; violation d3000000-0000-4000-8000-000000000005 is voided.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000005/review"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000006/void -->
```json
{ "reason": "issuedInError" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/violation-transition-illegal",
  "title": "Violation transition illegal",
  "status": 409,
  "detail": "Violation d3000000-0000-4000-8000-000000000006 is dismissed (terminal); void is refused.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000006/void"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-0000000000ff/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff/void"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000008/void invalid -->
```json
{ "note": "no reason given" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000008/void",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

---

## VIO-21 — The back office works the queue: filters, and the notice number a driver quotes

<!-- apx:scenario VIO-21 kind=happy ics=APX-VIO-02,APX-VIO-07 -->

**Given** a supervisor clearing Lot C's backlog at noon, and a driver on
the phone who quotes the number printed on their windshield. **When**
the console lists by plate, by place + status + mode + type + since, and
by place + a `since`..`until` window, then looks up `LG-2026-018510` by
notice number, then reads an id that does not exist. **Then** paginated
lists in the APDS envelope (the plate is visible because the token holds
`apx.violations:read`), the notice-number match, and 404 (F-VIO-11
fixed for `noticeNumber` and `until`; a list-valued `place` is deferred,
since changing the parameter's type would break existing clients).

<!-- apx:request GET /v1/violations?plate=SYN-4471 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790251200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d3000000-0000-4000-8000-000000000001",
      "version": 2,
      "violationType": "expiredRight",
      "violationStatus": "issued",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:31:04Z" },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-4471", "jurisdiction": "US-IL" },
      "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018301", "issuedTime": "2026-09-24T09:31:09Z", "deliveryMethod": "mail" },
      "amount": { "currencyType": "USD", "currencyValue": 35.0 }
    }
  ]
}
```

<!-- apx:request GET /v1/violations?place=b1000000-0000-4000-8000-000000000004&status=issued&detectionMode=automated&type=notYetValidRight&since=2026-09-24T00:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790251200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d3000000-0000-4000-8000-000000000009",
      "version": 2,
      "violationType": "notYetValidRight",
      "violationStatus": "issued",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-09-24T11:40:12Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.93 },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7007", "jurisdiction": "US-IL" },
      "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018520", "issuedTime": "2026-09-24T11:40:20Z", "deliveryMethod": "mail" },
      "amount": { "currencyType": "USD", "currencyValue": 35.0 }
    }
  ]
}
```

<!-- apx:request GET /v1/violations?place=b1000000-0000-4000-8000-000000000004&status=detected&since=2026-09-01T00:00:00Z&until=2026-09-24T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790251200, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d3000000-0000-4000-8000-000000000008",
      "version": 1,
      "violationType": "noParkingPeriod",
      "violationStatus": "detected",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-09-23T06:15:40Z", "principal": "lpr-pipeline-lot-c", "rule": "street-cleaning-tue-0600" },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9031", "jurisdiction": "US-IN" },
      "observations": [ { "id": "f2000000-0000-4000-8000-000000000070", "className": "Observation" } ],
      "evidence": [ { "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0070.jpg", "imageType": "plate" } ]
    },
    {
      "id": "d3000000-0000-4000-8000-000000000007",
      "version": 1,
      "violationType": "maximumStayExceeded",
      "violationStatus": "detected",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-09-08T14:02:00Z", "principal": "lpr-pipeline-lot-c", "rule": "max-stay-4h" },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1180", "jurisdiction": "US-IL" },
      "observations": [ { "id": "f2000000-0000-4000-8000-000000000019", "className": "Observation" } ]
    }
  ]
}
```

<!-- apx:request GET /v1/violations?noticeNumber=LG-2026-018510 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790251200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d3000000-0000-4000-8000-000000000004",
      "version": 3,
      "violationType": "expiredRight",
      "violationStatus": "issued",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "guided", "detectedTime": "2026-09-24T10:20:15Z" },
      "notice": { "noticeKind": "citation", "noticeNumber": "LG-2026-018510", "issuedTime": "2026-09-24T10:24:02Z", "deliveryMethod": "windshield" }
    }
  ]
}
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No violation d3000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-0000000000ff"
}
```

---

## VIO-22 — Putting the law on file for Lot C

<!-- apx:scenario VIO-22 kind=happy ics=APX-VIO-10 -->

**Given** counsel's summary of the state private-lot notice statute, in
June. **When** the back office creates the Lot C policy with an
operator extension for its enforcement tooling, retries it, reuses the
key for a different body, forgets the key, binds a policy to an unknown
place, and writes an escalation step whose fixed `addAmount` alone
exceeds the ceiling. **Then** 201 (with `unreviewedIssuance` permitted
at confidence ≥ 0.9 for automated detections, which VIO-10 relies on),
200 (the current representation), 409 `idempotency-conflict`, 400
`idempotency-key-required`, 422 `reference-unknown`, and 422
`request-unprocessable` — the types the route now names (F-VIO-03
fixed). The last refusal is the one case §19.10 rule 3 still refuses;
steps that merely could reach the ceiling are lawful, because the
ceiling clamps (F-VIO-14 fixed). Then the list, the read, and a 404.

```http
POST /v1/enforcement/policies
Idempotency-Key: bo-policy-lot-c-2026
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
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
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25 },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 } }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

<!-- apx:response 201 -->
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
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25 },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 } }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "statusHistory": [
    { "state": "active", "time": "2026-06-20T14:00:00Z", "actor": "backoffice-jlee", "detail": "loaded from counsel's summary of §12-405" }
  ],
  "recordInfo": { "creationTime": "2026-06-20T14:00:00Z", "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" }, "creationUser": "backoffice-jlee" },
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

```http
POST /v1/enforcement/policies
Idempotency-Key: bo-policy-lot-c-2026
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
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
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25 },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 } }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

```http
POST /v1/enforcement/policies
Idempotency-Key: bo-policy-lot-c-2026
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "penaltyCap": { "maximumMultipleOfUnpaid": 3, "onExceed": "clamp" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key bo-policy-lot-c-2026 was first used at 2026-06-20T14:00:00Z with a different policy body.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/enforcement/policies requires an Idempotency-Key header.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
Idempotency-Key: bo-policy-typo-01
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-00000000dead", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Place unknown",
  "status": 422,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-00000000dead.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
Idempotency-Key: bo-policy-lot-d-draft
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z",
  "escalation": [ { "step": "late-30", "afterDays": 30, "addAmount": { "currencyType": "USD", "currencyValue": 80.0 } } ],
  "overallCeiling": { "maximumAmount": { "currencyType": "USD", "currencyValue": 60.0 } }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Enforcement policy invalid",
  "status": 422,
  "detail": "escalation step late-30 adds 80.00, which alone exceeds overallCeiling.maximumAmount 60.00.",
  "instance": "/v1/enforcement/policies"
}
```

<!-- apx:request GET /v1/enforcement/policies?place=b1000000-0000-4000-8000-000000000001&status=active&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790251200, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d4000000-0000-4000-8000-000000000002",
      "version": 3,
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "name": "Lakeside Garage structure rules",
      "policyStatus": "active",
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "penaltyCap": { "maximumAmount": { "currencyType": "USD", "currencyValue": 50.0 }, "onExceed": "clamp" },
      "signageRequired": true
    },
    {
      "id": "d4000000-0000-4000-8000-000000000001",
      "version": 1,
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "name": "State private-lot notice rules — Lot C",
      "policyStatus": "active",
      "effectiveFrom": "2026-07-01T00:00:00Z",
      "signageRequired": true
    }
  ]
}
```

<!-- apx:request GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "appealWindowDays": 21,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "statusHistory": [ { "state": "active", "time": "2026-06-20T14:00:00Z", "actor": "backoffice-jlee" } ],
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

<!-- apx:request GET /v1/enforcement/policies/d4000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No EnforcementPolicy d4000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-0000000000ff"
}
```

---

## VIO-23 — The statute changes: a versioned policy update

<!-- apx:scenario VIO-23 kind=lifecycle ics=APX-VIO-10 -->

**Given** the legislature extends the appeal window to 30 days from
2026-10-01. **When** the back office PUTs v1 → v2 carrying the extension
it never touched, a second console PUTs against v1 a minute later, an
update names an unknown policy, and one sets `effectiveTo` before
`effectiveFrom`, and a script PUTs a body with no `place`. **Then** 200
v2 with the extension preserved byte-for-byte, 409 `version-conflict`,
404, 422 `request-unprocessable` (F-VIO-03 fixed), and 400
`invalid-request`. The precondition travels as `If-Match: "1"` (the
route now declares the shared `IfMatch` parameter); the body `version`
is the equivalent Part 4 §4.2a allows, and both are shown (F-VIO-12
fixed). Violations issued under v1 keep v1 (VIO-19 still shows it); the
effective lookup now returns v2.

```http
PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
If-Match: "1"
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "authority": { "jurisdiction": "US-IL", "citation": "Synthetic Stat. §12-405 as amended 2026-10-01" },
  "deliveryRules": [
    { "detectionModes": [ "automated" ], "deliveryMethods": [ "mail", "electronic" ], "noticeDeadline": "P14D",
      "minimumEvidence": { "observations": 1, "images": 1, "locationRequired": true } },
    { "detectionModes": [ "guided", "manual" ], "deliveryMethods": [ "windshield", "handed" ], "noticeDeadline": "PT1H" }
  ],
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "escalation": [
    { "step": "late-30", "afterDays": 30, "addPercent": 25 },
    { "step": "late-60", "afterDays": 60, "addAmount": { "currencyType": "USD", "currencyValue": 15.0 } }
  ],
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 30,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "name": "State private-lot notice rules — Lot C",
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "authority": { "jurisdiction": "US-IL", "citation": "Synthetic Stat. §12-405 as amended 2026-10-01" },
  "unreviewedIssuance": { "permitted": true, "minimumConfidence": 0.9 },
  "penaltyCap": { "maximumMultipleOfUnpaid": 2, "onExceed": "refuse" },
  "overallCeiling": { "maximumMultipleOfIssued": 3 },
  "appealWindowDays": 30,
  "paymentGraceDays": 14,
  "signageRequired": true,
  "statusHistory": [
    { "state": "active", "time": "2026-06-20T14:00:00Z", "actor": "backoffice-jlee" },
    { "state": "active", "time": "2026-09-30T16:00:00Z", "actor": "backoffice-jlee", "detail": "v2: appealWindowDays 21 → 30 per amendment" }
  ],
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "paymentGraceDays": 10
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "EnforcementPolicy d4000000-0000-4000-8000-000000000001 is at version 2; update was based on version 1.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-0000000000ff -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "policyStatus": "retired",
  "effectiveFrom": "2026-07-01T00:00:00Z"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No EnforcementPolicy d4000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000002",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "effectiveTo": "2025-12-31T00:00:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Enforcement policy invalid",
  "status": 422,
  "detail": "effectiveTo 2025-12-31T00:00:00Z precedes effectiveFrom 2026-01-01T00:00:00Z.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000002 invalid -->
```json
{
  "version": 3,
  "policyStatus": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "place is required.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000002",
  "errors": [ { "pointer": "/place", "detail": "required" } ]
}
```

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "id": "d4000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "policyStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "appealWindowDays": 30,
  "signageRequired": true,
  "extensions": { "apds-ext:lakeside:enforcement-ops@1.0": { "handheldProfile": "lot-c-surface", "reviewQueue": "lot-c" } }
}
```

---

## VIO-24 — Recording the signs, and asking what was posted on the day

<!-- apx:scenario VIO-24 kind=happy ics=APX-VIO-12 -->

**Given** Level 4's entry sign goes up at 13:00 on 2026-09-24, two hours
after the refused citation in VIO-14. **When** the back office records
it, retries, reuses the key for a different sign, forgets the key, and
binds one to an unknown place; then an appeals reviewer asks what was in
force on Level 4 at 11:15 and on Level 2 at 10:14, lists the garage's
signs, reads one, and reads and asks about ids that do not exist.
**Then** 201, 200, 409, 400, 422 `reference-unknown` (F-VIO-03 fixed); an empty
answer for Level 4 at 11:15 (which is why VIO-14 was refused, and why
this record does not help it retroactively); the Level 2 sign; a list;
a record; and 404s.

```http
POST /v1/enforcement/signage
Idempotency-Key: bo-sign-l4-entry-2026
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [
    { "language": "en", "string": "LEVEL 4. Permit parking only. Vehicles obstructing ramps or lanes are subject to a $50 citation." },
    { "language": "es", "string": "NIVEL 4. Solo con permiso. Los vehículos que obstruyan rampas o carriles están sujetos a una multa de $50." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6198, 41.8838 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/l4-entry-2026-09.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000002", "className": "EnforcementPolicy" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000003",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [
    { "language": "en", "string": "LEVEL 4. Permit parking only. Vehicles obstructing ramps or lanes are subject to a $50 citation." },
    { "language": "es", "string": "NIVEL 4. Solo con permiso. Los vehículos que obstruyan rampas o carriles están sujetos a una multa de $50." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6198, 41.8838 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/l4-entry-2026-09.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000002", "className": "EnforcementPolicy" },
  "statusHistory": [ { "state": "active", "time": "2026-09-24T13:05:00Z", "actor": "backoffice-jlee", "detail": "installed and photographed 13:00" } ]
}
```

```http
POST /v1/enforcement/signage
Idempotency-Key: bo-sign-l4-entry-2026
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [
    { "language": "en", "string": "LEVEL 4. Permit parking only. Vehicles obstructing ramps or lanes are subject to a $50 citation." },
    { "language": "es", "string": "NIVEL 4. Solo con permiso. Los vehículos que obstruyan rampas o carriles están sujetos a una multa de $50." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6198, 41.8838 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/l4-entry-2026-09.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000002", "className": "EnforcementPolicy" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000003",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [ { "language": "en", "string": "LEVEL 4. Permit parking only. Vehicles obstructing ramps or lanes are subject to a $50 citation." } ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z"
}
```

```http
POST /v1/enforcement/signage
Idempotency-Key: bo-sign-l4-entry-2026
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [ { "language": "en", "string": "LEVEL 4 RATES: $3/hour." } ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z",
  "signType": "ratesBoard"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key bo-sign-l4-entry-2026 was first used at 2026-09-24T13:05:00Z for Signage d5000000-0000-4000-8000-000000000003.",
  "instance": "/v1/enforcement/signage"
}
```

```http
POST /v1/enforcement/signage
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "text": [ { "language": "en", "string": "LEVEL 4 RATES: $3/hour." } ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/enforcement/signage requires an Idempotency-Key header.",
  "instance": "/v1/enforcement/signage"
}
```

```http
POST /v1/enforcement/signage
Idempotency-Key: bo-sign-typo-01
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-00000000dead", "className": "Place" },
  "text": [ { "language": "en", "string": "LEVEL 5. Permit parking only." } ],
  "signageStatus": "active",
  "effectiveFrom": "2026-09-24T13:00:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Place unknown",
  "status": 422,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-00000000dead.",
  "instance": "/v1/enforcement/signage"
}
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b1000000-0000-4000-8000-000000000006&at=2026-09-24T11:15:00Z -->
<!-- apx:response 200 -->
```json
{ "data": [] }
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b3000000-0000-4000-8000-000000000218&at=2026-09-24T10:14:30Z -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "d5000000-0000-4000-8000-000000000002",
      "version": 1,
      "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
      "text": [ { "language": "en", "string": "LEVEL 2 RESERVED. Permit holders only. Accessible bays require a valid placard. Violations $50." } ],
      "signageStatus": "active",
      "effectiveFrom": "2026-03-01T00:00:00Z",
      "imageLink": "https://api.lakeside-garage.example/signage/l2-entry-2026-03.jpg",
      "signType": "entrance"
    }
  ]
}
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b1000000-0000-4000-8000-00000000dead -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-00000000dead visible to this credential.",
  "instance": "/v1/enforcement/signage/effective"
}
```

<!-- apx:request GET /v1/enforcement/signage?place=b1000000-0000-4000-8000-000000000001&status=active&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790254800, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "id": "d5000000-0000-4000-8000-000000000001",
      "version": 1,
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "text": [ { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 21 days." } ],
      "signageStatus": "active",
      "effectiveFrom": "2026-07-01T00:00:00Z",
      "signType": "entrance"
    },
    {
      "id": "d5000000-0000-4000-8000-000000000002",
      "version": 1,
      "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
      "text": [ { "language": "en", "string": "LEVEL 2 RESERVED. Permit holders only. Accessible bays require a valid placard. Violations $50." } ],
      "signageStatus": "active",
      "effectiveFrom": "2026-03-01T00:00:00Z",
      "signType": "entrance"
    },
    {
      "id": "d5000000-0000-4000-8000-000000000003",
      "version": 1,
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "text": [ { "language": "en", "string": "LEVEL 4. Permit parking only. Vehicles obstructing ramps or lanes are subject to a $50 citation." } ],
      "signageStatus": "active",
      "effectiveFrom": "2026-09-24T13:00:00Z",
      "signType": "entrance"
    }
  ]
}
```

<!-- apx:request GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [
    { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 21 days." },
    { "language": "es", "string": "PAGUE POR PLACA. El estacionamiento sin pagar o vencido está sujeto a un aviso de $35; los avisos impagos aumentan 25% después de 30 días. Apelaciones dentro de 21 días." }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6214, 41.8827 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/lot-c-entrance-2026-07.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "className": "EnforcementPolicy" },
  "statusHistory": [ { "state": "active", "time": "2026-06-28T10:12:00Z", "actor": "backoffice-jlee" } ]
}
```

<!-- apx:request GET /v1/enforcement/signage/d5000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No Signage d5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-0000000000ff"
}
```

---

## VIO-25 — The appeal window changes: the sign is superseded, never rewritten

<!-- apx:scenario VIO-25 kind=refusal ics=APX-VIO-12 -->

**Given** the Lot C entrance sign `d5…0001` is frozen on issued
violations (VIO-10, VIO-11) and the amended statute (VIO-23) needs it to
say 30 days. **When** the back office PUTs new wording onto it, then
instead ends it (`effectiveTo`, `superseded`, text unchanged), then a
second console PUTs against the stale version (`If-Match: "1"`, Part 4
§4.2a; F-VIO-12 fixed), one updates an unknown id, and one sends a body
with no `text`. **Then** 422 `signage-referenced`, 200 v2, 409
`version-conflict`, 404, and 400 `invalid-request`. The new wording is
a new record (as in VIO-24).

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [ { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 30 days." } ],
  "signageStatus": "active",
  "effectiveFrom": "2026-07-01T00:00:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/signage-referenced",
  "title": "Signage referenced by an issued violation",
  "status": 422,
  "detail": "Signage d5000000-0000-4000-8000-000000000001 v1 is frozen on 3 issued violations (e.g. d3000000-0000-4000-8000-000000000004); set effectiveTo and record the new wording as a new Signage.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [
    { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 21 days." },
    { "language": "es", "string": "PAGUE POR PLACA. El estacionamiento sin pagar o vencido está sujeto a un aviso de $35; los avisos impagos aumentan 25% después de 30 días. Apelaciones dentro de 21 días." }
  ],
  "signageStatus": "superseded",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "effectiveTo": "2026-10-01T00:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6214, 41.8827 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/lot-c-entrance-2026-07.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "className": "EnforcementPolicy" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [
    { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 21 days." },
    { "language": "es", "string": "PAGUE POR PLACA. El estacionamiento sin pagar o vencido está sujeto a un aviso de $35; los avisos impagos aumentan 25% después de 30 días. Apelaciones dentro de 21 días." }
  ],
  "signageStatus": "superseded",
  "effectiveFrom": "2026-07-01T00:00:00Z",
  "effectiveTo": "2026-10-01T00:00:00Z",
  "location": { "type": "Point", "coordinates": [ -87.6214, 41.8827 ] },
  "imageLink": "https://api.lakeside-garage.example/signage/lot-c-entrance-2026-07.jpg",
  "signType": "entrance",
  "policy": { "id": "d4000000-0000-4000-8000-000000000001", "className": "EnforcementPolicy" },
  "statusHistory": [
    { "state": "active", "time": "2026-06-28T10:12:00Z", "actor": "backoffice-jlee" },
    { "state": "superseded", "time": "2026-09-30T16:10:00Z", "actor": "backoffice-jlee", "detail": "replaced 2026-10-01 by new entrance sign (30-day appeals)" }
  ]
}
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [ { "language": "en", "string": "PAY BY PLATE. Unpaid or expired parking is subject to a $35 notice; unpaid notices increase 25% after 30 days. Appeals within 21 days." } ],
  "signageStatus": "removed",
  "effectiveFrom": "2026-07-01T00:00:00Z"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Signage d5000000-0000-4000-8000-000000000001 is at version 2; update was based on version 1.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-0000000000ff -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "text": [ { "language": "en", "string": "EXIT" } ],
  "signageStatus": "removed",
  "effectiveFrom": "2026-07-01T00:00:00Z"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No Signage d5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000002 invalid -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000003", "className": "Place" },
  "signageStatus": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "text is required.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000002",
  "errors": [ { "pointer": "/text", "detail": "required" } ]
}
```

---

## VIO-26 — Wrong scope, wrong garage, an ep-only client, and a grant-trimmed basis

<!-- apx:scenario VIO-26 kind=security ics=APX-VIO-06,APX-VIO-07 -->

**Given** four credentials: a read-only reporting token
(`apx.violations:read`), an APDS enforcement-provider client holding
only the native `ep` role, the ordinary enforcement token pointed at
Harbor Deck, and a handheld token granted Level 2 only. **When** each
calls what it should not. **Then** every mutating operation refuses the
read-only token with 403 `insufficient-scope`; every read refuses the
`ep`-only client (the APDS role reaches the native routes, not
`/v1/violations`, and plate values appear only under
`apx.violations:*`); Harbor Deck targets are 403 `insufficient-grant`;
and the Level-2-only handheld gets an eligibility answer whose
`basis[]` omits the Lot C session it could not read directly (§19.3
rule 3).

```http
GET /v1/enforcement/eligibility?credential=SYN-4471&place=b1000000-0000-4000-8000-000000000003
Authorization: Bearer <apx.violations:read; apx_places: ["b1000000-0000-4000-8000-000000000003"]>
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-4471&place=b1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000003",
    "className": "Place"
  },
  "credential": {
    "credentialType": "licensePlate",
    "credentialIdentification": "SYN-4471"
  },
  "checkedTime": "2026-09-24T14:05:00Z",
  "entitled": false,
  "basis": [],
  "suggestedViolationType": "noValidRight"
}
```

```http
GET /v1/violations
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/violations?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/violations requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Authorization: Bearer <apx.violations:read only>
Idempotency-Key: ro-2
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T14:00:00Z",
    "principal": "lpr-pipeline-lot-c"
  },
  "vehicle": {
    "credentialType": "licensePlate",
    "credentialIdentification": "SYN-5150"
  },
  "observations": [
    {
      "id": "f2000000-0000-4000-8000-000000000080",
      "className": "Observation"
    }
  ]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations"
}
```

```http
GET /v1/violations/d3000000-0000-4000-8000-000000000004
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/violations/{id} requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/review
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/review -->
```json
{
  "decision": "confirm"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/review requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/review"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{
  "amount": {
    "currencyType": "USD",
    "currencyValue": 35
  }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/issue requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment -->
```json
{
  "payment": {
    "id": "d9000000-0000-4000-8000-000000000003",
    "className": "PaymentRecord"
  }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/payment requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/payment"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals -->
```json
{
  "reason": "notTheVehicle"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/appeals requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve -->
```json
{
  "resolution": "upheld"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/appeals/resolve requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/void
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/void -->
```json
{
  "reason": "duplicate"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/violations/{id}/void requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/void"
}
```

```http
GET /v1/enforcement/eligibility
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-5150&place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/eligibility requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/eligibility"
}
```

```http
GET /v1/enforcement/policies
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/policies?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/policies requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
Authorization: Bearer <apx.violations:read only>
Idempotency-Key: ro-12
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/enforcement/policies requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/enforcement/policies"
}
```

```http
GET /v1/enforcement/policies/effective
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/policies/effective requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/policies/effective"
}
```

```http
GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/policies/{id} requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/enforcement/policies/{id} requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
GET /v1/enforcement/signage
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/signage?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/signage requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/signage"
}
```

```http
POST /v1/enforcement/signage
Authorization: Bearer <apx.violations:read only>
Idempotency-Key: ro-17
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/enforcement/signage requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/enforcement/signage"
}
```

```http
GET /v1/enforcement/signage/effective
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/signage/effective requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/signage/effective"
}
```

```http
GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
Authorization: Bearer <APDS role ep; no apx.* scopes>
```

<!-- apx:request GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/enforcement/signage/{id} requires scope apx.violations:read; token carries only the APDS ep role.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

```http
PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
Authorization: Bearer <apx.violations:read only>
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/enforcement/signage/{id} requires scope apx.violations:manage; token carries apx.violations:read.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000201 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Target belongs to place b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000201"
}
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-4471&place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Target belongs to place b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/enforcement/eligibility"
}
```

```http
POST /v1/violations
Idempotency-Key: lprvan-07-harbor-0001
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": {
    "id": "b1000000-0000-4000-8000-000000000002",
    "className": "Place"
  },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T14:00:00Z",
    "principal": "lpr-pipeline-lot-c"
  },
  "vehicle": {
    "credentialType": "licensePlate",
    "credentialIdentification": "SYN-5150"
  },
  "observations": [
    {
      "id": "f2000000-0000-4000-8000-000000000080",
      "className": "Observation"
    }
  ]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Target belongs to place b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/violations"
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000201/void -->
```json
{
  "reason": "duplicate"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Target belongs to place b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000201/void"
}
```

---


## VIO-27 — The handheld's token expires mid-shift

<!-- apx:scenario VIO-27 kind=security ics=APX-VIO-07 -->

**Given** officer Okafor's handheld and the back-office console both keep
going after their tokens expire at 14:00. **When** each of the twenty
Violations operations is called on the expired token. **Then** 401 on
every one, and no plate value, image link, or policy detail leaks in the
body. Every body carries the `unauthenticated` type Part 12 now
registers at 401 (F-VIO-01 fixed, with F-CTL-07).

```http
GET /v1/violations
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/violations?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
Authorization: Bearer <expired>
Idempotency-Key: exp-28
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T14:00:00Z",
    "principal": "lpr-pipeline-lot-c"
  },
  "vehicle": {
    "credentialType": "licensePlate",
    "credentialIdentification": "SYN-5150"
  },
  "observations": [
    {
      "id": "f2000000-0000-4000-8000-000000000080",
      "className": "Observation"
    }
  ]
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations"
}
```

```http
GET /v1/violations/d3000000-0000-4000-8000-000000000004
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/review
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/review -->
```json
{
  "decision": "confirm"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/review"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{
  "amount": {
    "currencyType": "USD",
    "currencyValue": 35
  }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment -->
```json
{
  "payment": {
    "id": "d9000000-0000-4000-8000-000000000003",
    "className": "PaymentRecord"
  }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/payment"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals -->
```json
{
  "reason": "notTheVehicle"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve -->
```json
{
  "resolution": "upheld"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/void
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/void -->
```json
{
  "reason": "duplicate"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/void"
}
```

```http
GET /v1/enforcement/eligibility
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-5150&place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/eligibility"
}
```

```http
GET /v1/enforcement/policies
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/policies?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
Authorization: Bearer <expired>
Idempotency-Key: exp-38
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/policies"
}
```

```http
GET /v1/enforcement/policies/effective
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/policies/effective"
}
```

```http
GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
Authorization: Bearer <expired>
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
GET /v1/enforcement/signage
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/signage?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/signage"
}
```

```http
POST /v1/enforcement/signage
Authorization: Bearer <expired>
Idempotency-Key: exp-43
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/signage"
}
```

```http
GET /v1/enforcement/signage/effective
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/signage/effective"
}
```

```http
GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

```http
PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
Authorization: Bearer <expired>
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T14:00:00Z.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

---


## VIO-28 — Monday 06:00: the street-cleaning sweep floods the server

<!-- apx:scenario VIO-28 kind=edge ics=APX-VIO-01 -->

**Given** three LPR vans upload the street-cleaning sweep at once while
the back office reloads policies and handhelds poll eligibility.
**When** the credential exceeds its rate. **Then** 429 `rate-limited`
with `Retry-After` on all twenty operations; a van that retries with
the same `Idempotency-Key` after the wait gets the original, never a
second violation (VIO-04).

```http
GET /v1/violations
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/violations?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations"
}
```

```http
POST /v1/violations
→ 429, Retry-After: 5
Idempotency-Key: sweep-50
```

<!-- apx:request POST /v1/violations -->
```json
{
  "violationType": "expiredRight",
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "detection": {
    "mode": "automated",
    "detectedTime": "2026-09-24T14:00:00Z",
    "principal": "lpr-pipeline-lot-c"
  },
  "vehicle": {
    "credentialType": "licensePlate",
    "credentialIdentification": "SYN-5150"
  },
  "observations": [
    {
      "id": "f2000000-0000-4000-8000-000000000080",
      "className": "Observation"
    }
  ]
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations"
}
```

```http
GET /v1/violations/d3000000-0000-4000-8000-000000000004
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/violations/d3000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/review
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/review -->
```json
{
  "decision": "confirm"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/review"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/issue -->
```json
{
  "amount": {
    "currencyType": "USD",
    "currencyValue": 35
  }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/issue"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/payment -->
```json
{
  "payment": {
    "id": "d9000000-0000-4000-8000-000000000003",
    "className": "PaymentRecord"
  }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/payment"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals -->
```json
{
  "reason": "notTheVehicle"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve -->
```json
{
  "resolution": "upheld"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/appeals/resolve"
}
```

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000004/void
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000004/void -->
```json
{
  "reason": "duplicate"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000004/void"
}
```

```http
GET /v1/enforcement/eligibility
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/eligibility?credential=SYN-5150&place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/eligibility"
}
```

```http
GET /v1/enforcement/policies
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/policies?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/policies"
}
```

```http
POST /v1/enforcement/policies
→ 429, Retry-After: 5
Idempotency-Key: sweep-60
```

<!-- apx:request POST /v1/enforcement/policies -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/policies"
}
```

```http
GET /v1/enforcement/policies/effective
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/policies/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/policies/effective"
}
```

```http
GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001
→ 429, Retry-After: 5
```

<!-- apx:request PUT /v1/enforcement/policies/d4000000-0000-4000-8000-000000000001 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "policyStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/policies/d4000000-0000-4000-8000-000000000001"
}
```

```http
GET /v1/enforcement/signage
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/signage?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/signage"
}
```

```http
POST /v1/enforcement/signage
→ 429, Retry-After: 5
Idempotency-Key: sweep-65
```

<!-- apx:request POST /v1/enforcement/signage -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/signage"
}
```

```http
GET /v1/enforcement/signage/effective
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/signage/effective?place=b1000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/signage/effective"
}
```

```http
GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

```http
PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003
→ 429, Retry-After: 5
```

<!-- apx:request PUT /v1/enforcement/signage/d5000000-0000-4000-8000-000000000003 -->
```json
{
  "place": {
    "id": "b1000000-0000-4000-8000-000000000004",
    "className": "Place"
  },
  "text": [
    {
      "language": "en",
      "string": "PERMIT PARKING ONLY"
    }
  ],
  "signageStatus": "active",
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/enforcement/signage/d5000000-0000-4000-8000-000000000003"
}
```

---

## VIO-29 — Pay now, contest later: a reduced appeal refunds the difference; a paid notice voided in error

<!-- apx:scenario VIO-29 kind=lifecycle ics=APX-VIO-02,APX-VIO-04,APX-VIO-05 -->

**Given** `d3…0021`, an automated Lot C notice of $35 issued 2026-09-24
and paid on 2026-09-26 (PaymentRecord `d9…0004`) by a driver who wanted
to stop any late fee; and `d3…0022`, a $35 notice paid the same day that
the operator later finds was issued against a misread plate. **When** the
driver appeals `d3…0021` on day 5, inside the 21-day window; the
reviewer reduces it to $20 and the portal refunds $15 through Part 13
(`d9…0005`); and the supervisor voids `d3…0022` with the full refund
`d9…0006`. **Then** `appealed` with `appeal.openedFrom: paid`, back to
`paid` at $20 with `appeal.refund` recorded, and `voided` from `paid`
with the refund linked. This is the §19.6 path that was unreachable
before (F-VIO-13 fixed) and the `paid → voided` transition (F-VIO-10).

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000021/appeals -->
```json
{
  "reason": "paidUnderProtest",
  "detail": "Paid to avoid the late fee; my app shows the extension until 10:00.",
  "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000021",
  "version": 4,
  "violationType": "expiredRight",
  "violationStatus": "appealed",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:52:00Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.95 },
  "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-018530", "issuedTime": "2026-09-24T09:52:06Z", "deliveryMethod": "mail" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "payment": { "id": "d9000000-0000-4000-8000-000000000004", "className": "PaymentRecord" },
  "appeal": {
    "reason": "paidUnderProtest",
    "detail": "Paid to avoid the late fee; my app shows the extension until 10:00.",
    "appellant": { "id": "c1000000-0000-4000-8000-000000000044", "className": "Contact" },
    "openedTime": "2026-09-29T08:10:00Z",
    "openedFrom": "paid"
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:52:01Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T09:52:06Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "paid", "time": "2026-09-26T12:00:40Z", "actor": "appeals-portal", "detail": "PaymentRecord d9…0004" },
    { "state": "appealed", "time": "2026-09-29T08:10:00Z", "actor": "appeals-portal", "detail": "pay-then-appeal, day 5 of 21" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000021/appeals/resolve -->
```json
{
  "resolution": "reduced",
  "adjustedAmount": { "currencyType": "USD", "currencyValue": 20.0 },
  "refund": { "id": "d9000000-0000-4000-8000-000000000005", "className": "PaymentRecord" },
  "note": "Extension confirmed to 09:45; seven minutes over. Refunded 15.00 via /v1/payments/d9…0004/refund."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000021",
  "version": 5,
  "violationType": "expiredRight",
  "violationStatus": "paid",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T09:52:00Z" },
  "amount": { "currencyType": "USD", "currencyValue": 20.0 },
  "payment": { "id": "d9000000-0000-4000-8000-000000000004", "className": "PaymentRecord" },
  "amountHistory": [
    { "amount": { "currencyType": "USD", "currencyValue": 35.0 }, "time": "2026-09-24T09:52:06Z", "reason": "issued" },
    { "amount": { "currencyType": "USD", "currencyValue": 20.0 }, "time": "2026-09-30T15:30:00Z", "reason": "appealReduced", "detail": "refund d9…0005 15.00" }
  ],
  "appeal": {
    "reason": "paidUnderProtest",
    "openedTime": "2026-09-29T08:10:00Z",
    "openedFrom": "paid",
    "resolvedTime": "2026-09-30T15:30:00Z",
    "resolution": "reduced",
    "resolutionNote": "Extension confirmed to 09:45; seven minutes over. Refunded 15.00 via /v1/payments/d9…0004/refund.",
    "refund": { "id": "d9000000-0000-4000-8000-000000000005", "className": "PaymentRecord" }
  },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T09:52:01Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T09:52:06Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "paid", "time": "2026-09-26T12:00:40Z", "actor": "appeals-portal" },
    { "state": "appealed", "time": "2026-09-29T08:10:00Z", "actor": "appeals-portal" },
    { "state": "paid", "time": "2026-09-30T15:30:00Z", "actor": "reviewer-0212", "detail": "appeal reduced: 35.00 → 20.00; refund d9…0005" }
  ]
}
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000022/void -->
```json
{
  "reason": "issuedInError",
  "refund": { "id": "d9000000-0000-4000-8000-000000000006", "className": "PaymentRecord" },
  "note": "Plate misread SYN-3318 for SYN-3313; full refund issued."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d3000000-0000-4000-8000-000000000022",
  "version": 4,
  "violationType": "expiredRight",
  "violationStatus": "voided",
  "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
  "detection": { "mode": "automated", "detectedTime": "2026-09-24T10:05:00Z" },
  "amount": { "currencyType": "USD", "currencyValue": 35.0 },
  "payment": { "id": "d9000000-0000-4000-8000-000000000007", "className": "PaymentRecord" },
  "statusHistory": [
    { "state": "detected", "time": "2026-09-24T10:05:01Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "issued", "time": "2026-09-24T10:05:06Z", "actor": "lpr-pipeline-lot-c" },
    { "state": "paid", "time": "2026-09-26T13:10:00Z", "actor": "appeals-portal" },
    { "state": "voided", "time": "2026-10-02T11:00:00Z", "actor": "sup-m.reyes", "detail": "issuedInError; refund d9…0006" }
  ]
}
```

---
