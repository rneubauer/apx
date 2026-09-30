# apx-reservations — vetting scenarios

<!-- apx:module apx-reservations tag=Reservations ics=RSV -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-reservations`. Gaps the spec cannot express are
marked `gap=F-RSV-NN` and explained in `findings.md`.

The class is a thin profile: the lifecycle rides on the NATIVE APDS
routes `/quotes`, `/rights/assigned`, `/sessions` (tagged Quote, Assigned
Rights, Sessions — they do not count in this module's coverage table, but
the runner still validates every body against the APDS schemas) plus two
APX routes, `GET /v1/reservations/recent` and
`PUT /v1/sessions/{id}/assigned-right`.

**Cast.** Lakeside Garage (place `b1…0001`, version 3), entry lane
`b2…0001`, exit lane 2 `b2…0002`. Harbor Deck (`b1…0002`) is a different
operator's garage the token has no grant for. The operator organisation
is `a1…0001`; the reservation platform ParkAhead is `a1…0002` and calls
with scope `apx.reservations:manage` unless a scenario says otherwise.
Right specifications: evening reservation `e1…0001` v1 (plate on file),
barcode-only event reservation `e1…0002` v1, Harbor Deck's own `e1…0003`,
and the drive-up right `e1…0009` the lane creates for transient sessions.
Holders are LOCAL ids (§14.1a): Priya `a3…0301`, plate `SYN-1234`; Theo
`a3…0302`, plate `SYN-7788`; Marisol `a3…0303`, plate `SYN-5150`; Dev
`a3…0304`, barcode `LKG-88301`; Nadia `a3…0305`, plate `SVN-4821`.
Reservations are AssignedRights `e2…01NN`, sessions `f1…02NN`, segments
`f3…02NN`, quotes `d2…04NN`, observations `f2…05NN`, events `e9…06NN`.

Native APDS creates follow the APDS convention of client-supplied
`id` + `version: 1` (Part 4 §4.1); the APX link route takes no id. Times
are RFC 3339 UTC; the concert is Friday 2026-09-25.

---

## RSV-01 — Quote Friday night before booking it

<!-- apx:scenario RSV-01 kind=happy ics=APX-RSV-01,APX-CORE-01 -->

**Given** Priya wants Lakeside Garage 18:00–23:00 on concert Friday.
**When** ParkAhead asks for a native APDS quote against the evening
right specification. **Then** 200 with one `QuoteRightResponse` carrying
an option priced at USD 24.00 that expires in thirty minutes. The
vendored APDS `POST /quotes` declares no request body at all (F-RSV-01),
and its `Identifiers` block has a required-key typo, so the option omits
it (F-RSV-03).

```http
POST /quotes
Content-Type: application/json
```

<!-- apx:request POST /quotes -->
```json
{
  "id": "d2000000-0000-4000-8000-000000000401",
  "version": 1,
  "requestTime": "2026-09-24T17:00:05Z",
  "periodStart": "2026-09-25T18:00:00Z",
  "periodEnd": "2026-09-25T23:00:00Z",
  "referencedRightSpecifications": [
    {
      "elementId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "rightSpecificationId": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" }
    }
  ]
}
```

<!-- apx:response 200 -->
```json
{
  "referenceInstant": 1790269205,
  "offset": 0,
  "pageSize": 10,
  "total": 1,
  "data": [
    {
      "id": "d2000000-0000-4000-8000-000000000402",
      "version": 1,
      "start": "2026-09-25T18:00:00Z",
      "end": "2026-09-25T23:00:00Z",
      "requestTime": "2026-09-24T17:00:05Z",
      "responseTime": "2026-09-24T17:00:06Z",
      "quoteRequestId": { "id": "d2000000-0000-4000-8000-000000000401", "version": 1, "className": "QuoteRightRequest" },
      "options": [
        {
          "id": "d2000000-0000-4000-8000-000000000403",
          "version": 1,
          "elementId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
          "exact": true,
          "quoteExpiration": { "expiresDateTime": "2026-09-24T17:30:06Z", "firstComeFirstServe": false },
          "financialQuote": {
            "serviceProvider": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
            "taxIncluded": true,
            "transactionId": "LKG-88214",
            "value": { "currencyType": "USD", "currencyValue": 24.0 }
          }
        }
      ]
    }
  ]
}
```

---

## RSV-02 — Book: an AssignedRight wearing the reservation extension

<!-- apx:scenario RSV-02 kind=happy ics=APX-RSV-01,APX-CORE-01,APX-CORE-02,APX-CORE-04 -->

**Given** Priya accepted the quote. **When** ParkAhead creates a native
AssignedRight with her plate on file, a `plannedUses` entry, and the
`apds-ext:apx:reservation@1.0` extension in `confirmed`. **Then** the
native 201 `ResponseStatus` names the id, a plain APDS read returns the
full right with the extension intact, and `AssignedRightCreated` is
published with the right as `data`. Public scenarios 05 and 06 now draw
the same shapes (201 `ResponseStatus`, then a read-back;
`rightHolder.credentials[]`; was F-RSV-04). `AssignedRight` itself
declares no `extensions` property (F-RSV-05, upstream). The extension's
planned times mirror `plannedUses[0]`, which Part 14 §14.1 now makes
authoritative (was F-RSV-10).

```http
POST /rights/assigned
Content-Type: application/json
```

<!-- apx:request POST /rights/assigned -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T17:02:11Z",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-25T23:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-25T23:00:00Z"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "message": "Assigned right created successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000101" ]
}
```

A plain APDS client reads it back and sees a normal assigned right:

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T17:02:11Z",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-25T23:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-25T23:00:00Z"
    }
  }
}
```

The extension object, checked on its own:

<!-- apx:validate ReservationExtension -->
```json
{
  "reservationState": "confirmed",
  "plannedStart": "2026-09-25T18:00:00Z",
  "plannedEnd": "2026-09-25T23:00:00Z"
}
```

The fabric publishes the native APDS topic, `data` checked as an
`AssignedRight`:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate AssignedRight at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000601",
  "type": "AssignedRightCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
  "time": "2026-09-24T17:02:11Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000101",
    "version": 1,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
    "rightHolder": {
      "credentials": [
        { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
      ]
    },
    "extensions": {
      "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-09-25T18:00:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
    }
  }
}
```

---

## RSV-03 — Book straight from the quote reference

<!-- apx:scenario RSV-03 kind=edge ics=APX-RSV-01,APX-CORE-01 -->

**Given** the same quote, and a platform that prefers the APDS
"reference the option" create shape. **When** it posts a
`ReferenceToQuote` naming the response and the option. **Then** the
server would create the right from the quote, but the vendored schema
cannot validate the body: `ReferenceToQuote` is a `oneOf` of two
identical branches, so every body matches both (F-RSV-02). There is also
nowhere in this shape to put the reservation extension, so the server
must infer `plannedStart`/`plannedEnd` from the quote.

```http
POST /rights/assigned
Content-Type: application/json
```

<!-- apx:request POST /rights/assigned gap=F-RSV-02 -->
```json
{
  "quoteResponseId": { "id": "d2000000-0000-4000-8000-000000000402", "version": 1, "className": "QuoteRightResponse" },
  "optionId": { "id": "d2000000-0000-4000-8000-000000000403", "version": 1, "className": "Option" }
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "message": "Assigned right created from quote option d2000000-0000-4000-8000-000000000403.",
  "ids": [ "e2000000-0000-4000-8000-000000000113" ]
}
```

---

## RSV-04 — Book refused: colliding id, missing holder

<!-- apx:scenario RSV-04 kind=refusal ics=APX-CORE-03,APX-RSV-01 -->

**Given** two broken retries. **When** one re-posts Priya's booking with
the id that already exists, and one omits `rightHolder`. **Then** the
native route answers 409 and 400 in the APDS `ResponseStatus` shape,
which Part 12 §12.1 permits on native routes; nothing is created.

```http
POST /rights/assigned
Content-Type: application/json
```

<!-- apx:request POST /rights/assigned -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-09-25T18:00:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
  }
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "Assigned right e2000000-0000-4000-8000-000000000101 already exists (version 1).",
  "ids": [ "e2000000-0000-4000-8000-000000000101" ]
}
```

<!-- apx:request POST /rights/assigned invalid -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000114",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-09-25T18:00:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "status": "error",
  "code": 400,
  "message": "Assigned right can not be created due to missing required attributes: rightHolder."
}
```

---

## RSV-05 — Amend before arrival: dinner runs long

<!-- apx:scenario RSV-05 kind=lifecycle ics=APX-RSV-01,APX-DATA-02 -->

**Given** Priya's confirmed reservation at version 1. **When** ParkAhead
pushes the end from 23:00 to 01:00 with a native PUT carrying the version
it read. **Then** 200, the read shows version 2 in `amended`, and
`AssignedRightUpdated` carries the new state. The body's `version` is
the version the client last read (Part 4 §4.2a, cited from Part 14
§14.1 step 3; was F-RSV-07).

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000101
APX-Update-Mode: full
Content-Type: application/json
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T17:02:11Z",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-26T01:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "amended",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-26T01:00:00Z"
    }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right updated successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000101" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T17:02:11Z",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-26T01:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "amended",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-26T01:00:00Z"
    }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate AssignedRight at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000602",
  "type": "AssignedRightUpdated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
  "time": "2026-09-24T21:15:40Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000101",
    "version": 2,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
    "rightHolder": {
      "credentials": [
        { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
      ]
    },
    "extensions": {
      "apds-ext:apx:reservation@1.0": { "reservationState": "amended", "plannedStart": "2026-09-25T18:00:00Z", "plannedEnd": "2026-09-26T01:00:00Z" }
    }
  }
}
```

---

## RSV-06 — Two amendments race: the stale one loses

<!-- apx:scenario RSV-06 kind=refusal ics=APX-DATA-02,APX-CORE-05 -->

**Given** a second ParkAhead worker still holding version 1 of Priya's
reservation. **When** it PUTs its own amendment. **Then** 409: the
native route answers in the APDS `ResponseStatus` shape, which is what
its OpenAPI declares. Part 5 §5.1 mandates problem `version-conflict`
for exactly this case and Part 12 §12.1 says native routes SHOULD honour
`Accept: application/problem+json`, but the vendored route declares no
such content, so the problem+json variant is a gap (F-RSV-08).

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000101
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "amended", "plannedStart": "2026-09-25T17:30:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
  }
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "version-conflict: assigned right e2000000-0000-4000-8000-000000000101 is at version 2; the update targeted version 1.",
  "ids": [ "e2000000-0000-4000-8000-000000000101" ]
}
```

The same request with `Accept: application/problem+json`:

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "amended", "plannedStart": "2026-09-25T17:30:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
  }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000101 is at version 2; the update targeted version 1.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000101"
}
```

---

## RSV-07 — Check-in: the entry camera reads the plate

<!-- apx:scenario RSV-07 kind=lifecycle ics=APX-RSV-01,APX-RSV-02 -->

**Given** Friday 18:04 and the entry camera reads `SYN-1234`. **When**
the PARCS matches it to the plate credential on Priya's reservation,
opens the gate, and creates the native Session whose segment references
the AssignedRight. **Then** 201, the reservation transitions to
`checkedIn` with `checkInSession` set (§14.1 rule 5), and
`AssignedRightUpdated` says so. The plate is the link; no APX call was
needed.

```http
POST /sessions
Content-Type: application/json
```

<!-- apx:request POST /sessions -->
```json
{
  "id": "f1000000-0000-4000-8000-000000000201",
  "version": 1,
  "actualStart": "2026-09-25T18:04:10Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
  "identifiedCredentials": [
    { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
  ],
  "identifiedVehicle": { "country": "US", "stateProvince": "FL" },
  "segments": [
    {
      "id": "f3000000-0000-4000-8000-000000000211",
      "version": 1,
      "actualStart": "2026-09-25T18:04:10Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 2, "className": "AssignedRight" },
      "validationType": [ "licensePlate" ]
    }
  ]
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "message": "Session created successfully.",
  "ids": [ "f1000000-0000-4000-8000-000000000201" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T17:02:11Z",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-26T01:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-26T01:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000201", "className": "Session" }
    }
  }
}
```

<!-- apx:validate ReservationExtension -->
```json
{
  "reservationState": "checkedIn",
  "plannedStart": "2026-09-25T18:00:00Z",
  "plannedEnd": "2026-09-26T01:00:00Z",
  "checkInSession": { "id": "f1000000-0000-4000-8000-000000000201", "className": "Session" }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate AssignedRight at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000603",
  "type": "AssignedRightUpdated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
  "time": "2026-09-25T18:04:11Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000101",
    "version": 3,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
    "rightHolder": {
      "credentials": [
        { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
      ]
    },
    "extensions": {
      "apds-ext:apx:reservation@1.0": {
        "reservationState": "checkedIn",
        "plannedStart": "2026-09-25T18:00:00Z",
        "plannedEnd": "2026-09-26T01:00:00Z",
        "checkInSession": { "id": "f1000000-0000-4000-8000-000000000201", "className": "Session" }
      }
    }
  }
}
```

---

## RSV-08 — Set-time reservation extended mid-stay

<!-- apx:scenario RSV-08 kind=lifecycle ics=APX-RSV-01 -->

**Given** Marisol's set-time reservation `e2…0103` (Tuesday 06:00–18:00,
plate `SYN-5150`), checked in at 05:52 as session `f1…0202`, now at
version 3. **When** at 16:40 her return flight slips and ParkAhead prices
the extra hours with the stock APDS session-extension quote, then moves
`plannedEnd` with a change-mode PUT. **Then** the quote honours 22:00,
the PUT is 200, and the reservation STAYS `checkedIn` — after check-in
only the planned times move (§14.1 rule 3). Part 14 §14.1 step 3 now
requires a change-mode amend to keep the AssignedRight's required
members until a change-mode schema exists (was F-RSV-06; the general
schema is F-DATA-02), so the body below validates; the quote request has
the F-RSV-01 gap.

```http
POST /quotes
Content-Type: application/json
```

<!-- apx:request POST /quotes -->
```json
{
  "id": "d2000000-0000-4000-8000-000000000411",
  "version": 1,
  "requestedEndTime": "2026-09-29T22:00:00Z",
  "requestTime": "2026-09-29T16:40:12Z",
  "sessionId": { "id": "f1000000-0000-4000-8000-000000000202", "version": 1, "className": "Session" },
  "suppliedCredential": { "id": "e3000000-0000-4000-8000-000000000501", "version": 1, "className": "Credential" }
}
```

<!-- apx:response 200 -->
```json
{
  "referenceInstant": 1790700012,
  "offset": 0,
  "pageSize": 10,
  "total": 1,
  "data": [
    {
      "id": "d2000000-0000-4000-8000-000000000412",
      "version": 1,
      "requestSessionExtensionId": { "id": "d2000000-0000-4000-8000-000000000411", "version": 1, "className": "QuoteSessionExtensionRequest" },
      "sessionId": { "id": "f1000000-0000-4000-8000-000000000202", "version": 1, "className": "Session" },
      "requestTime": "2026-09-29T16:40:12Z",
      "responseTime": "2026-09-29T16:40:13Z",
      "revisedEndTime": "2026-09-29T22:00:00Z"
    }
  ]
}
```

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000103
APX-Update-Mode: change
Content-Type: application/json
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000103",
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5150", "className": "USNumberPlate" } }
    ]
  },
  "plannedUses": [ { "startTime": "2026-09-29T06:00:00Z", "endTime": "2026-09-29T22:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-29T06:00:00Z",
      "plannedEnd": "2026-09-29T22:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000202", "className": "Session" }
    }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right updated successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000103" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000103",
  "version": 4,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5150", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "plannedUses": [ { "startTime": "2026-09-29T06:00:00Z", "endTime": "2026-09-29T22:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-29T06:00:00Z",
      "plannedEnd": "2026-09-29T22:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000202", "className": "Session" }
    }
  }
}
```

---

## RSV-09 — The third extension is declined

<!-- apx:scenario RSV-09 kind=refusal ics=APX-RSV-01 -->

**Given** Marisol at 21:50 asks to keep the car overnight until 09:00.
**When** ParkAhead quotes the extension. **Then** the quote comes back
declined with `noExtensionPossible` and `revisedEndTime` still at the
committed 22:00 — a decline never shrinks what was granted. ParkAhead
does not PUT; the reservation runs out at its twice-extended time.

<!-- apx:request POST /quotes -->
```json
{
  "id": "d2000000-0000-4000-8000-000000000413",
  "version": 1,
  "requestedEndTime": "2026-09-30T09:00:00Z",
  "requestTime": "2026-09-29T21:50:44Z",
  "sessionId": { "id": "f1000000-0000-4000-8000-000000000202", "version": 1, "className": "Session" },
  "suppliedCredential": { "id": "e3000000-0000-4000-8000-000000000501", "version": 1, "className": "Credential" }
}
```

<!-- apx:response 200 -->
```json
{
  "referenceInstant": 1790718644,
  "offset": 0,
  "pageSize": 10,
  "total": 1,
  "data": [
    {
      "id": "d2000000-0000-4000-8000-000000000414",
      "version": 1,
      "requestSessionExtensionId": { "id": "d2000000-0000-4000-8000-000000000413", "version": 1, "className": "QuoteSessionExtensionRequest" },
      "sessionId": { "id": "f1000000-0000-4000-8000-000000000202", "version": 1, "className": "Session" },
      "requestTime": "2026-09-29T21:50:44Z",
      "responseTime": "2026-09-29T21:50:45Z",
      "revisedEndTime": "2026-09-29T22:00:00Z",
      "reason": "noExtensionPossible"
    }
  ]
}
```

---

## RSV-10 — Cancel: by DELETE, by state, and too late

<!-- apx:scenario RSV-10 kind=lifecycle ics=APX-RSV-01 -->

**Given** Priya also booked next week twice by mistake (`e2…0108` and
`e2…0109`, both `confirmed`). **When** ParkAhead deletes one and sets
the other to `cancelled` with a `cancelTime` on the planned use — both
paths §14.1 rule 4 allows. **Then** 200 for each, the deleted one reads
404 and publishes `AssignedRightDeleted`, the cancelled one reads back
in `cancelled`. Deleting the reservation Priya has already checked in
on is refused with a native 409: the §14.1 transition table (cancel
after check-in is illegal) and the registered problem type
`reservation-transition-illegal` now cover it (was F-RSV-09); the native
route still answers `ResponseStatus`, since its problem+json variant
waits on the F-RSV-08 overlay.

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000108 -->
<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right deleted successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000108" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000108 -->
<!-- apx:response 404 -->
```json
{
  "status": "error",
  "code": 404,
  "message": "Assigned right not found.",
  "ids": [ "e2000000-0000-4000-8000-000000000108" ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate AssignedRight at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000604",
  "type": "AssignedRightDeleted",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000108", "className": "AssignedRight" },
  "time": "2026-09-24T21:30:02Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000108",
    "version": 1,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
    "rightHolder": {
      "credentials": [
        { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
      ]
    },
    "extensions": {
      "apds-ext:apx:reservation@1.0": { "reservationState": "cancelled", "plannedStart": "2026-09-30T18:00:00Z", "plannedEnd": "2026-09-30T22:00:00Z" }
    }
  }
}
```

The state path on the second one:

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000109
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000109 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000109",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "plannedUses": [ { "startTime": "2026-09-30T18:00:00Z", "endTime": "2026-09-30T22:00:00Z", "cancelTime": "2026-09-24T21:31:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "cancelled", "plannedStart": "2026-09-30T18:00:00Z", "plannedEnd": "2026-09-30T22:00:00Z" }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right updated successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000109" ]
}
```

And the one that is already in use:

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "Assigned right e2000000-0000-4000-8000-000000000101 is checkedIn (session f1000000-0000-4000-8000-000000000201 open); a reservation cannot be cancelled after check-in.",
  "ids": [ "e2000000-0000-4000-8000-000000000101" ]
}
```

---

## RSV-11 — Theo never shows, then shows up late

<!-- apx:scenario RSV-11 kind=lifecycle ics=APX-RSV-01,APX-RSV-03 -->

**Given** Theo's reservation `e2…0102` for 18:00 and Lakeside's
sixty-minute grace period (operator policy, §14.1 rule 6). **When** the
19:00 sweep finds no check-in. **Then** the reservation transitions to
`noShow` and `apx.reservation.noshow.v1` is published with a
`ReservationSummary` as `data` (Part 14 §14.1 step 6 now names it; the
registry text is with the integrator), and the lapse instant was
visible all along as the server-set `noShowAfter` (was F-RSV-11). At
19:40 Theo arrives, takes a ticket, and the agent tries to link the
no-show right to his drive-up session: 409 `right-not-linkable`, which
§14.1b now lists for `noShow` and `cancelled` rights (was F-RSV-09).

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000102 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000102",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-7788", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-25T23:00:00Z", "expiryTime": "2026-09-25T19:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "noShow", "plannedStart": "2026-09-25T18:00:00Z", "plannedEnd": "2026-09-25T23:00:00Z", "noShowAfter": "2026-09-25T19:00:00Z" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ReservationSummary at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000605",
  "type": "apx.reservation.noshow.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000102", "className": "AssignedRight" },
  "time": "2026-09-25T19:00:00Z",
  "data": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000102", "className": "AssignedRight" },
    "reservationState": "noShow",
    "plannedStart": "2026-09-25T18:00:00Z",
    "plannedEnd": "2026-09-25T23:00:00Z",
    "noShowAfter": "2026-09-25T19:00:00Z"
  }
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000208/assigned-right
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000208/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000102", "className": "AssignedRight" },
  "reservationCode": "LKG-88217",
  "reason": "customer arrived 19:40 with the confirmation email"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000102 is in reservationState noShow since 2026-09-25T19:00:00Z; the planned use expired at 19:00.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000208/assigned-right"
}
```

---

## RSV-12 — Illegal transitions the state machine must refuse

<!-- apx:scenario RSV-12 kind=refusal ics=APX-RSV-01,APX-RSV-03 -->

**Given** Theo's `noShow` right and Priya's `cancelled` `e2…0109`.
**When** a platform tries to PUT the no-show back to `confirmed`, tries
to amend the cancelled one, and an agent tries to check the cancelled one
in through the explicit link. **Then** two native 409s and one 409
`right-not-linkable`. Part 14 §14.1 now has the transition table
(`confirmed → amended | checkedIn | cancelled | noShow`, `amended →
amended | checkedIn | cancelled | noShow`, `checkedIn` moves only its
planned times, `cancelled` and `noShow` are terminal) and Part 12
registers `reservation-transition-illegal` (was F-RSV-09); the native
409s stay `ResponseStatus` until the F-RSV-08 overlay lets them carry it.

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000102
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000102 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000102",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-7788", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-09-25T20:00:00Z", "plannedEnd": "2026-09-25T23:00:00Z" }
  }
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "reservationState noShow is terminal; transition to confirmed is not allowed (Part 14 §14.1).",
  "ids": [ "e2000000-0000-4000-8000-000000000102" ]
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000109 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000109",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "amended", "plannedStart": "2026-09-30T18:00:00Z", "plannedEnd": "2026-10-01T00:00:00Z" }
  }
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "reservationState cancelled is terminal; transition to amended is not allowed (Part 14 §14.1).",
  "ids": [ "e2000000-0000-4000-8000-000000000109" ]
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000109", "className": "AssignedRight" },
  "reason": "customer says the cancellation was a mistake"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000109 was cancelled at 2026-09-24T21:31:00Z; a cancelled reservation cannot be checked in. Book again.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

---

## RSV-13 — Screen-pop: the caller's last reservations, by plate

<!-- apx:scenario RSV-13 kind=happy ics=APX-RSV-02,APX-CORE-02 -->

**Given** Priya calls the intercom at exit lane 2 and the camera has her
plate. **When** the console asks for her recent reservations by plate.
**Then** 200 with up to ten summaries, newest planned start first, mixed
states — the cancelled and no-show history is the dispute context. A
plain APDS client can get the same rights through the native list with
the credential filter and sees ordinary assigned rights. The plate key
takes the optional `country`/`stateProvince` qualifiers (Part 14
§14.1a(4); was F-RSV-14), which the console fills from the LPR read.

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&country=US&stateProvince=IL -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000110", "className": "AssignedRight" },
      "reservationState": "confirmed",
      "plannedStart": "2026-10-02T18:00:00Z",
      "plannedEnd": "2026-10-02T22:00:00Z"
    },
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000109", "className": "AssignedRight" },
      "reservationState": "cancelled",
      "plannedStart": "2026-09-30T18:00:00Z",
      "plannedEnd": "2026-09-30T22:00:00Z"
    },
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-26T01:00:00Z"
    },
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000111", "className": "AssignedRight" },
      "reservationState": "noShow",
      "plannedStart": "2026-09-10T18:00:00Z",
      "plannedEnd": "2026-09-10T22:00:00Z"
    }
  ]
}
```

<!-- apx:validate ReservationSummary -->
```json
{
  "reservation": { "id": "e2000000-0000-4000-8000-000000000110", "className": "AssignedRight" },
  "reservationState": "confirmed",
  "plannedStart": "2026-10-02T18:00:00Z",
  "plannedEnd": "2026-10-02T22:00:00Z"
}
```

The APDS-native equivalent, for a client that has never heard of APX:

<!-- apx:request GET /rights/assigned?credential_id=SYN-1234&credential_type=licensePlate&start_after=1790208000 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790365300, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e2000000-0000-4000-8000-000000000110",
      "version": 1,
      "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
      "rightHolder": {
        "credentials": [
          { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
        ]
      },
      "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "plannedUses": [ { "startTime": "2026-10-02T18:00:00Z", "endTime": "2026-10-02T22:00:00Z" } ],
      "extensions": {
        "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-10-02T18:00:00Z", "plannedEnd": "2026-10-02T22:00:00Z" }
      }
    }
  ]
}
```

---

## RSV-14 — The aggregator: local holder ids, re-minted place, plate as the join

<!-- apx:scenario RSV-14 kind=happy ics=APX-RSV-02,APX-CORE-11 -->

**Given** Lakeside moved behind Metro Parking Hub, which fronts several
garages and had to re-mint Lakeside's place id to `b1…00a1` (Part 18
§18.2). **When** ParkAhead, still holding Priya's Lakeside holder id,
asks the hub by holder; then asks by plate scoped to the new place id;
then reads the place. **Then** the holder lookup returns an empty list
(the id is local to the old endpoint, §14.1a, and an unknown holder is
not an error), the plate lookup finds her, and the HierarchyElement
carries the old id in `operatorDefinedReference`.

```http
GET /v1/reservations/recent?holder=a3000000-0000-4000-8000-000000000301
Host: api.metro-hub.example
```

<!-- apx:request GET /v1/reservations/recent?holder=a3000000-0000-4000-8000-000000000301 -->
<!-- apx:response 200 -->
```json
{
  "data": []
}
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&place=b1000000-0000-4000-8000-0000000000a1 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000110", "className": "AssignedRight" },
      "reservationState": "confirmed",
      "plannedStart": "2026-10-02T18:00:00Z",
      "plannedEnd": "2026-10-02T22:00:00Z"
    },
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-26T01:00:00Z"
    }
  ]
}
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-0000000000a1 -->
<!-- apx:response 200 -->
```json
{
  "id": "b1000000-0000-4000-8000-0000000000a1",
  "version": 1,
  "type": "place",
  "name": [ { "language": "en", "string": "Lakeside Garage" } ],
  "operatorDefinedReference": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
  "layer": 0,
  "hierarchyElementRecord": { "creationTime": "2026-09-20T09:00:00Z", "creator": { "id": "a1000000-0000-4000-8000-000000000003", "version": 1, "className": "Organisation" } }
}
```

---

## RSV-15 — Recent lookup refused: no key, and a window it does not have

<!-- apx:scenario RSV-15 kind=refusal ics=APX-RSV-02,APX-CORE-05 -->

**Given** a console that sends the lookup without any key, and a
dispute desk that wants "her reservations in June". **When** the first
calls with no `plate` or `holder`, and the second adds `from`/`to` —
first inverted, then correct, with a `state` filter. **Then** 400
`invalid-request` for the missing key and for the inverted window, and
200 for June's cancelled bookings (the operation now takes `from`, `to`,
and `state`, and both keys together intersect; was F-RSV-13).

<!-- apx:request GET /v1/reservations/recent -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Lookup key required",
  "status": 400,
  "detail": "GET /v1/reservations/recent needs plate or holder.",
  "instance": "/v1/reservations/recent"
}
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&from=2026-06-30T00:00:00Z&to=2026-06-01T00:00:00Z -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid window",
  "status": 400,
  "detail": "from 2026-06-30T00:00:00Z is after to 2026-06-01T00:00:00Z.",
  "instance": "/v1/reservations/recent"
}
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&holder=a3000000-0000-4000-8000-000000000301&from=2026-06-01T00:00:00Z&to=2026-07-01T00:00:00Z&state=cancelled -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000095", "className": "AssignedRight" },
      "reservationState": "cancelled",
      "plannedStart": "2026-06-19T18:00:00Z",
      "plannedEnd": "2026-06-19T23:00:00Z"
    }
  ]
}
```

---

## RSV-16 — Recent lookup: wrong scope, wrong grant, no grant, throttled, dead token

<!-- apx:scenario RSV-16 kind=security ics=APX-CORE-06,APX-CORE-07,APX-CORE-08,APX-RSV-02 -->

**Given** five tokens. **When** a BI token with only `apx.data:read`
looks up a plate; a ParkAhead token granted Lakeside asks with
`place=` Harbor Deck, then with a place id that exists nowhere; a token
with no `apx_places` claim asks by plate alone; a dashboard polls too
fast; and an expired token asks. **Then** 403 `insufficient-scope`, 403
`insufficient-grant`, 404 `target-not-found`, an empty 200 (a lookup
that names no place under an absent grant matches nothing and is never
403, Part 9 §9.3a), 429, and 401 `unauthenticated`. All are now
declared (was F-RSV-12).

```http
GET /v1/reservations/recent?plate=SYN-1234
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/reservations/recent requires scope apx.reservations:manage; token carries apx.data:read.",
  "instance": "/v1/reservations/recent"
}
```

```http
GET /v1/reservations/recent?plate=SYN-1234&place=b1000000-0000-4000-8000-000000000002
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/reservations/recent"
}
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234&place=b1000000-0000-4000-8000-0000000000ee -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No place b1000000-0000-4000-8000-0000000000ee.",
  "instance": "/v1/reservations/recent"
}
```

```http
GET /v1/reservations/recent?plate=SYN-1234
Authorization: Bearer <no apx_places claim at all>
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "data": []
}
```

```http
GET /v1/reservations/recent?plate=SYN-1234
→ 429, Retry-After: 2
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/reservations/recent"
}
```

```http
GET /v1/reservations/recent?plate=SYN-1234
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/reservations/recent?plate=SYN-1234 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T20:00:00Z.",
  "instance": "/v1/reservations/recent"
}
```

---

## RSV-17 — Barcode-only reservation: the explicit link materializes

<!-- apx:scenario RSV-17 kind=happy ics=APX-RSV-03,APX-RSV-01,APX-CORE-02 -->

**Given** Dev booked the barcode-only event reservation `e2…0104`
(code `LKG-88301`, no plate on file) and the entry lane, unable to read
the code, issued a ticket and opened a drive-up session `f1…0203` on the
drive-up right `e2…0199`. **When** the agent links the session to the
reservation, citing the presented code. **Then** 200 with the link; a
plain APDS read of the session shows `segments[].assignedRight` now
pointing at the reservation (§14.1b materialization); `SessionUpdated`
is published; and the reservation reads `checkedIn` with
`checkInSession`.

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right
Content-Type: application/json
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" },
  "reservationCode": "LKG-88301",
  "reason": "barcode unreadable at entry; code confirmed from the customer's phone"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:request GET /sessions/f1000000-0000-4000-8000-000000000203 -->
<!-- apx:response 200 -->
```json
{
  "id": "f1000000-0000-4000-8000-000000000203",
  "version": 2,
  "actualStart": "2026-09-25T18:31:04Z",
  "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-0925-1188", "className": "Ticket" } }
  ],
  "segments": [
    {
      "id": "f3000000-0000-4000-8000-000000000213",
      "version": 2,
      "actualStart": "2026-09-25T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "version": 1, "className": "AssignedRight" },
      "validationType": [ "ticket", "barcode" ],
      "validationId": "LKG-88301"
    }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Session at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000606",
  "type": "SessionUpdated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "time": "2026-09-25T18:36:20Z",
  "data": {
    "id": "f1000000-0000-4000-8000-000000000203",
    "version": 2,
    "actualStart": "2026-09-25T18:31:04Z",
    "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "identifiedCredentials": [
      { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-0925-1188", "className": "Ticket" } }
    ],
    "segments": [
      {
        "id": "f3000000-0000-4000-8000-000000000213",
        "version": 2,
        "actualStart": "2026-09-25T18:31:04Z",
        "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "version": 1, "className": "AssignedRight" },
        "validationType": [ "ticket", "barcode" ]
      }
    ]
  }
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000104 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000104",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000002", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "barcode", "credentialAssignedType": "other", "identifier": { "id": "LKG-88301", "className": "Barcode" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-25T23:30:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-25T23:30:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" }
    }
  }
}
```

---

## RSV-18 — Link replayed, then re-pointed

<!-- apx:scenario RSV-18 kind=edge ics=APX-RSV-03 -->

**Given** the console lost the 200 from RSV-17. **When** it sends the
identical PUT again. **Then** 200 with the same link and no second
segment — the route is naturally idempotent and takes no
`Idempotency-Key`. When a different agent then PUTs a different right
(Dev's duplicate booking `e2…0112`) on the already-linked session, the
answer is 409 `right-not-linkable` ("session already linked"): Part 14
§14.1b now says a link is never silently replaced, and re-pointing is
the audited unlink followed by a new link (RSV-24; was F-RSV-16).

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" },
  "reservationCode": "LKG-88301",
  "reason": "barcode unreadable at entry; code confirmed from the customer's phone"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000112", "className": "AssignedRight" },
  "reservationCode": "LKG-88302",
  "reason": "customer has two confirmations; wants the later one applied"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Session f1000000-0000-4000-8000-000000000203 is already linked to assigned right e2000000-0000-4000-8000-000000000104; unlink it first (POST /v1/sessions/{id}/assigned-right/unlink).",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right"
}
```

---

## RSV-19 — Not linkable: consumed, not yet valid, wrong garage

<!-- apx:scenario RSV-19 kind=refusal ics=APX-RSV-03 -->

**Given** a drive-up session `f1…0204` at Lakeside exit lane 2 and three
confirmations the driver waves at the intercom camera. **When** the
agent tries each: Sam's right `e2…0105`, already consumed by session
`f1…0205`; Priya's `e2…0110`, valid next Friday; and `e2…0106`, a Harbor
Deck reservation. **Then** three 409 `right-not-linkable`, each naming
why, exactly the three cases §14.1b lists.

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000105", "className": "AssignedRight" },
  "reservationCode": "LKG-88240"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000105 is already consumed by session f1000000-0000-4000-8000-000000000205 (checked in 2026-09-25T18:12:40Z).",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000110", "className": "AssignedRight" },
  "reservationCode": "LKG-88290"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000110 is valid 2026-10-02T18:00:00Z to 2026-10-02T22:00:00Z; the session started 2026-09-25T19:10:33Z, outside the validity window.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000106", "className": "AssignedRight" },
  "reservationCode": "HD-20411"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/right-not-linkable",
  "title": "AssignedRight not linkable",
  "status": 409,
  "detail": "Assigned right e2000000-0000-4000-8000-000000000106 was issued for place b1000000-0000-4000-8000-000000000002 (Harbor Deck); the session is at b1000000-0000-4000-8000-000000000001.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

---

## RSV-20 — Link: unknown session, unknown right, no right at all

<!-- apx:scenario RSV-20 kind=refusal ics=APX-RSV-03,APX-CORE-05 -->

**Given** a console with a stale screen. **When** it links a session id
that does not exist, then a right id that does not exist, then sends a
body without `assignedRight`. **Then** 404 `target-not-found` twice, and
400 `invalid-request`, now declared and registered (was F-RSV-15).

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-0000000000ff/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No session f1000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-0000000000ff/assigned-right"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-0000000000ff", "className": "AssignedRight" },
  "reservationCode": "LKG-99999"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No assigned right e2000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right invalid -->
```json
{
  "reservationCode": "LKG-88301"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "assignedRight is required.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

---

## RSV-21 — Link: wrong scope, wrong grant, dead token, throttled

<!-- apx:scenario RSV-21 kind=security ics=APX-CORE-07,APX-RSV-03 -->

**Given** four tokens. **When** a token with only `apx.data:write` links
a session; a Lakeside-granted token links a Harbor Deck session
`f1…0207`; an expired token links; and a runaway retry loop links.
**Then** 403 `insufficient-scope`, 403 `insufficient-grant`, 401
`unauthenticated`, and 429 `rate-limited`, all declared (was F-RSV-15,
F-CTL-07).

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right
Authorization: Bearer <apx.data:write only>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/sessions/{id}/assigned-right requires scope apx.reservations:manage; token carries apx.data:write.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000207/assigned-right
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000207/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000106", "className": "AssignedRight" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Session f1000000-0000-4000-8000-000000000207 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000207/assigned-right"
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right
Authorization: Bearer <expired>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T20:00:00Z.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right
→ 429, Retry-After: 3
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000204/assigned-right"
}
```

---

## RSV-22 — Prepaid, but the entry camera misread the plate

<!-- apx:scenario RSV-22 kind=happy ics=APX-RSV-02,APX-RSV-01 -->

**Given** Nadia prepaid `e2…0107` for plate `SVN-4821`; the entry camera
read `5VN-4B21` at 0.41, so the PARCS opened a plain transient session
`f1…0206` and the exit terminal wants full price (public scenario 14).
**When** the agent looks up the misread plate (nothing), looks up the
plate the customer reads out (the reservation), and corrects the session's
plate citing the clean 0.97 exit read. **Then** the implementation's own
matching binds the prepaid right: the reservation reads `checkedIn` with
`checkInSession`, and the amount due drops. At an LPR facility the plate
IS the link; no explicit link call was needed. The lookup qualifies the
plate with its jurisdiction, so a Georgia `SVN-4821` cannot merge into
Nadia's Florida history (was F-RSV-14).

<!-- apx:request GET /v1/reservations/recent?plate=5VN-4B21 -->
<!-- apx:response 200 -->
```json
{
  "data": []
}
```

<!-- apx:request GET /v1/reservations/recent?plate=SVN-4821&country=US&stateProvince=FL&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000107", "className": "AssignedRight" },
      "reservationState": "confirmed",
      "plannedStart": "2026-09-25T17:30:00Z",
      "plannedEnd": "2026-09-25T23:30:00Z"
    }
  ]
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000206/plate
Authorization: Bearer <apx.data:write apx.reservations:manage>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000206/plate -->
```json
{
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000501", "className": "Observation" },
  "reason": "entry LPR misread (0.41); corrected from exit-lane candidate confirmed by customer"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000206", "className": "Session" },
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000501", "className": "Observation" }
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000107 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000107",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SVN-4821", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "plannedUses": [ { "startTime": "2026-09-25T17:30:00Z", "endTime": "2026-09-25T23:30:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-09-25T17:30:00Z",
      "plannedEnd": "2026-09-25T23:30:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000206", "className": "Session" }
    }
  }
}
```

---

## RSV-23 — A vendor extension rides along; a malformed key does not

<!-- apx:scenario RSV-23 kind=edge ics=APX-CORE-04,APX-RSV-01 -->

**Given** ParkAhead decorates Priya's next-Friday reservation `e2…0110`
with its own loyalty extension next to the reservation one. **When** it
PUTs both and reads back; then a buggy build sends a key that violates
the §4.3 pattern. **Then** both keys survive the round-trip untouched
(tolerant reader, faithful writer), and the bad key is refused with a
native 400. The refusal is server discipline, not schema: `AssignedRight`
binds no `Extensions` schema, so the pattern is unenforced there
(F-RSV-05).

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000110
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000110 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000110",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "plannedUses": [ { "startTime": "2026-10-02T18:00:00Z", "endTime": "2026-10-02T22:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-10-02T18:00:00Z", "plannedEnd": "2026-10-02T22:00:00Z" },
    "apds-ext:parkahead:loyalty@1.0": { "tier": "gold", "memberSince": "2024-03-01" }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right updated successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000110" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000110 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000110",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "plannedUses": [ { "startTime": "2026-10-02T18:00:00Z", "endTime": "2026-10-02T22:00:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-10-02T18:00:00Z", "plannedEnd": "2026-10-02T22:00:00Z" },
    "apds-ext:parkahead:loyalty@1.0": { "tier": "gold", "memberSince": "2024-03-01" }
  }
}
```

<!-- apx:validate Extensions -->
```json
{
  "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-10-02T18:00:00Z", "plannedEnd": "2026-10-02T22:00:00Z" },
  "apds-ext:parkahead:loyalty@1.0": { "tier": "gold", "memberSince": "2024-03-01" }
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000110 invalid -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000110",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-1234", "className": "USNumberPlate" } }
    ]
  },
  "extensions": {
    "apds-ext:apx:reservation@1.0": { "reservationState": "confirmed", "plannedStart": "2026-10-02T18:00:00Z", "plannedEnd": "2026-10-02T22:00:00Z" },
    "apds-ext:ParkAhead:Loyalty@1": { "tier": "gold" }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "status": "error",
  "code": 400,
  "message": "extensions key apds-ext:ParkAhead:Loyalty@1 does not match ^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\\.[0-9]+$ (Part 4 §4.3).",
  "ids": [ "e2000000-0000-4000-8000-000000000110" ]
}
```

---

## RSV-24 — Re-pointing done right: unlink, then link

<!-- apx:scenario RSV-24 kind=lifecycle ics=APX-RSV-03,APX-CORE-05,APX-CORE-06,APX-CORE-07 -->

**Given** RSV-18's session `f1…0203`, linked to Dev's `e2…0104` at
Session version 2, and his duplicate booking `e2…0112` that he wants
applied instead. **When** the agent unlinks with a reason and
`If-Match: "2"`, repeats the unlink (lost response), links `e2…0112`,
and a second console still on version 2 tries to link. **Then** 200
with `unlinkedRight` (the segment is back on the drive-up right and
`e2…0104` returns to `confirmed`, `checkInSession` cleared), a no-op 200
without `unlinkedRight`, 200 for the new link, and 409
`version-conflict`. The unlink refuses a body without `reason` (400), an
unknown session (404), a stale version (409), a settled session (422),
the wrong scope (403), a dead token (401), and a burst (429) — Part 14
§14.1b (was F-RSV-16).

```http
POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink
If-Match: "2"
```

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "customer holds two confirmations; applying LKG-88302 instead of LKG-88301"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "unlinkedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" },
  "version": 3
}
```

The console lost that 200 and retries; nothing is linked any more:

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "customer holds two confirmations; applying LKG-88302 instead of LKG-88301"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "version": 3
}
```

The first right is back to its pre-check-in state:

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000104 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000104",
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000002", "version": 1, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "barcode", "credentialAssignedType": "other", "identifier": { "id": "LKG-88301", "className": "Barcode" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "plannedUses": [ { "startTime": "2026-09-25T18:00:00Z", "endTime": "2026-09-25T23:30:00Z" } ],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-09-25T18:00:00Z",
      "plannedEnd": "2026-09-25T23:30:00Z",
      "noShowAfter": "2026-09-25T19:00:00Z"
    }
  }
}
```

Now the link to the booking Dev wants:

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right
If-Match: "3"
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000112", "className": "AssignedRight" },
  "reservationCode": "LKG-88302",
  "reason": "customer holds two confirmations; applying LKG-88302"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000203", "className": "Session" },
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000112", "className": "AssignedRight" },
  "version": 4
}
```

A second console, still holding Session version 2, links the old code:

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right
If-Match: "2"
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right -->
```json
{
  "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "className": "AssignedRight" },
  "reservationCode": "LKG-88301"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Session f1000000-0000-4000-8000-000000000203 is at version 4; the request was made against version 2.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right"
}
```

The unlink's refusals. No reason:

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink invalid -->
```json
{}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

Unknown session:

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-0000000000ff/assigned-right/unlink -->
```json
{
  "reason": "stale screen"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No session f1000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-0000000000ff/assigned-right/unlink"
}
```

Stale version:

```http
POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink
If-Match: "3"
```

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "second console undoing a link it did not see change"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Session f1000000-0000-4000-8000-000000000203 is at version 4; the request was made against version 3.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink"
}
```

A session that ended and was billed yesterday (Priya's `f1…0201`):

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000201/assigned-right/unlink -->
```json
{
  "reason": "customer disputes the prepaid rate"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/session-not-open",
  "title": "Session is not open",
  "status": 422,
  "detail": "Session f1000000-0000-4000-8000-000000000201 ended 2026-09-26T00:52:10Z and was settled; unlinking would re-price a closed session. Raise a dispute instead.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000201/assigned-right/unlink"
}
```

Wrong scope, dead token, burst:

```http
POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink
Authorization: Bearer <apx.data:write only>
```

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "cleanup"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/sessions/{id}/assigned-right/unlink requires scope apx.reservations:manage; token carries apx.data:write.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink"
}
```

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "cleanup"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T20:00:00Z.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink"
}
```

<!-- apx:request POST /v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink -->
```json
{
  "reason": "cleanup"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/assigned-right/unlink"
}
```
