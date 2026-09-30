# apx-credentials — vetting scenarios

<!-- apx:module apx-credentials tag=Credentials ics=CRD -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-credentials`. Gaps the spec cannot express are marked
`gap=F-CRD-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), entry lane `b2…0001` with
reader `b2…0011`, exit lane 2 `b2…0002` with reader `b2…0012`. Harbor
Deck (`b1…0002`, entry lane `b2…0003`) is a different operator's garage
the token has no grant for. The operator organisation is `a1…0001`.
Holders: Maya Okafor `c1…0102` (monthly parker, account
`7a8b9c0d-…-9c0d`, AssignedRight `e1…0102` — the parker from public
scenario 20), Ray Delgado `c1…0103` (monthly, fob, AssignedRight
`e1…0103`), Northshore Plumbing `c1…0104` (fleet account `a3…0104`,
AssignedRight `e1…0104`), contractor Dana Ruiz `c1…0105` (AssignedRight
`e1…0105`), and a Harbor Deck tenant `c1…0201`. Credentials are `d6…01NN`;
access events `d7…04NN`; event envelopes `e7…NNNN`. Maya's keycard
`d6…0101` (`C-0048812`) and its successor `d6…0102` (`C-0051207`) keep
the identifiers and timestamps of scenario 20.

Every request carries `Authorization: Bearer …` with scopes
`apx.credentials:read apx.credentials:manage` and `apx_places:
["b1…0001"]` unless the scenario says otherwise. Requests that create
resources send the create shape; `id`, `version`, `credentialStatus`,
`suspension`, `replacedBy`, and `statusHistory` are server-assigned. There
is no `PUT` in this module, so there is no `version-conflict` scenario.

---

## CRD-01 — Issue a keycard for a new monthly parker

<!-- apx:scenario CRD-01 kind=happy ics=APX-CRD-01,APX-CRD-05,APX-CRD-06 -->

**Given** Maya Okafor signs a monthly contract starting January 1 and the
front desk pulls an HID proximity card from stock. **When** the desk
issues it with an idempotency key, a $25 deposit, and the validity window.
**Then** the server answers 201 with the record in `issued` (nothing opens
the gate yet), publishes `apx.credentials.status.v1`, and a read returns
the same record with its identification — visible only because the token
carries `apx.credentials:*`.

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20251228-1510-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-004512",
    "batch": "2025-Q4-B",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-004512",
    "batch": "2025-Q4-B",
    "issuedTime": "2025-12-28T15:10:00Z",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" }
  ],
  "recordInfo": {
    "creationTime": "2025-12-28T15:10:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "frontdesk-mkim"
  }
}
```

The status event, as delivered to a subscriber:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000001",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "time": "2025-12-28T15:10:00Z",
  "data": {
    "id": "d6000000-0000-4000-8000-000000000101",
    "version": 1,
    "credentialType": "rfid",
    "credentialIdentification": "C-0048812",
    "credentialAssignedType": "customer",
    "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
    "credentialStatus": "issued",
    "statusHistory": [
      { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" }
    ]
  }
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-004512",
    "batch": "2025-Q4-B",
    "issuedTime": "2025-12-28T15:10:00Z",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" }
  ]
}
```

The desk left `activateOnStart` unset, so the card stays `issued` until
someone calls `activate` (walked in CRD-04). Public scenario 20 issues
the same card with `activateOnStart: true`, which is why it shows
`active` from January 1 with actor `system` (F-CRD-06, fixed: §21.1
rule 6; the self-activating issue is walked in CRD-25).

---

## CRD-02 — The desk console retries: same key, then the wrong key

<!-- apx:scenario CRD-02 kind=edge ics=APX-CRD-01,APX-CORE-05 -->

**Given** the 201 from CRD-01 was lost to a Wi-Fi drop at the front desk.
**When** the console retries with the identical key and body, then a
console bug reuses the key for a different card, then a third client
forgets the header altogether. **Then** 200 with the ORIGINAL record (one
card issued, not two), 409 `idempotency-conflict`, and 400
`idempotency-key-required`.

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20251228-1510-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-004512",
    "batch": "2025-Q4-B",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-004512",
    "batch": "2025-Q4-B",
    "issuedTime": "2025-12-28T15:10:00Z",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" }
  ]
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20251228-1510-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0048813",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key fd-mkim-20251228-1510-issue was first used at 2025-12-28T15:10:00Z to issue rfid C-0048812; this body differs.",
  "instance": "/v1/credentials"
}
```

```http
POST /v1/credentials
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0048813",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/credentials is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/credentials"
}
```

---

## CRD-03 — Malformed record, unknown holder

<!-- apx:scenario CRD-03 kind=refusal ics=APX-CRD-01,APX-CORE-05 -->

**Given** two broken issue requests. **When** one omits `credentialType`
and one names a RightHolder that does not exist. **Then** 400
`invalid-request` and 422 `reference-unknown`, both declared on the
operation and both now registered in Part 12 and named in its
descriptions (F-CRD-02 and F-CRD-01, fixed).

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260901-0800-issue
```

<!-- apx:request POST /v1/credentials invalid -->
```json
{
  "credentialIdentification": "F-2201-0900",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "credentialType is required.",
  "instance": "/v1/credentials"
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260901-0801-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0900",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-0000000000ff", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Referenced entity unknown",
  "status": 422,
  "detail": "holder RightHolder c1000000-0000-4000-8000-0000000000ff does not exist.",
  "instance": "/v1/credentials"
}
```

---

## CRD-04 — Ray's fob: issued at the desk, activated on collection, seen by a stock APDS lane

<!-- apx:scenario CRD-04 kind=lifecycle ics=APX-CRD-01,APX-CRD-02,APX-CORE-02 -->

**Given** Ray Delgado's monthly right starts today and the desk has a
garage-remote fob ready. **When** the desk issues it at 09:00 and
activates it at 09:05 when Ray collects it. **Then** the record goes
`issued → active`, and the entry lane — an APDS-native client that only
reads `/rights/assigned` — sees a `CredentialAssigned` whose `identifier`
points at the CredentialRecord, without ever speaking APX.

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260902-0900-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": {
    "form": "fob",
    "serialNumber": "LNR-433-018822",
    "batch": "2026-Q2-F",
    "deposit": { "currencyType": "USD", "currencyValue": 15.0 }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 1,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": {
    "form": "fob",
    "serialNumber": "LNR-433-018822",
    "batch": "2026-Q2-F",
    "issuedTime": "2026-09-02T09:00:00Z",
    "deposit": { "currencyType": "USD", "currencyValue": 15.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/activate -->
```json
{
  "reason": "collected",
  "note": "Handed to holder at front desk; ID checked."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 2,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": {
    "form": "fob",
    "serialNumber": "LNR-433-018822",
    "batch": "2026-Q2-F",
    "issuedTime": "2026-09-02T09:00:00Z",
    "deposit": { "currencyType": "USD", "currencyValue": 15.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "active",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim", "detail": "Handed to holder at front desk; ID checked." }
  ]
}
```

The entry lane, a stock APDS 4.1 client, asks the question it has always
asked:

<!-- apx:request GET /rights/assigned?credential_type=electronicID&credential_id=F-2201-0917 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1788512400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e1000000-0000-4000-8000-000000000103",
      "version": 7,
      "rightSpecification": { "id": "e0000000-0000-4000-8000-000000000001", "version": 3, "className": "RightSpecification" },
      "rightHolder": {
        "credentials": [
          {
            "type": "electronicID",
            "credentialAssignedType": "customer",
            "identifier": { "id": "d6000000-0000-4000-8000-000000000103", "className": "CredentialRecord" },
            "issuer": [ { "language": "en", "string": "Lakeside Garage" } ]
          }
        ]
      },
      "issuanceTime": "2026-09-02T09:05:12Z",
      "expiry": "2027-08-31T23:59:59Z"
    }
  ]
}
```

---

## CRD-05 — Activate twice, activate nothing

<!-- apx:scenario CRD-05 kind=refusal ics=APX-CRD-01 -->

**Given** the fob from CRD-04 is already `active`. **When** the desk
double-clicks Activate, then a stale bookmark hits an id that never
existed, on both the read and the activate route. **Then** 409
`credential-transition-illegal` (active is not `issued`), and 404 twice.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/activate -->
```json
{ "reason": "collected" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "activate requires credentialStatus issued; d6000000-0000-4000-8000-000000000103 is active.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000103/activate"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/activate -->
```json
{ "reason": "collected" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/activate"
}
```

---

## CRD-06 — Suspended for non-payment until the 17th, denied at the gate, resumed by the clock

<!-- apx:scenario CRD-06 kind=lifecycle ics=APX-CRD-01,APX-CRD-02,APX-CRD-04,APX-CRD-06 -->

**Given** Ray's September invoice is unpaid on the 10th. **When** billing
suspends the fob with `until` set to the 17th, Ray presents it at the
entry lane that evening, and the 17th arrives. **Then** the record shows
`suspension`, the stock APDS query on the AssignedRight comes back empty,
the lane denies with `credentialSuspended` and the access event is
published, and at the appointed instant the server resumes it with actor
`system` and publishes the status event.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/suspend -->
```json
{
  "reason": "nonPayment",
  "note": "Invoice INV-2026-09-0103 unpaid; auto-resume on grace-period end.",
  "until": "2026-09-17T00:00:00Z"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 3,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "fob", "serialNumber": "LNR-433-018822", "deposit": { "currencyType": "USD", "currencyValue": 15.0 }, "depositStatus": "held" },
  "credentialStatus": "suspended",
  "suspension": { "reason": "nonPayment", "until": "2026-09-17T00:00:00Z" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim" },
    { "state": "suspended", "time": "2026-09-10T08:00:00Z", "actor": "billing-batch", "detail": "Invoice INV-2026-09-0103 unpaid; auto-resume on grace-period end." }
  ]
}
```

The AssignedRight no longer carries the fob (§21.2 rule 2):

<!-- apx:request GET /rights/assigned?credential_type=electronicID&credential_id=F-2201-0917 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789200000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

That evening at the entry lane:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000002",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000103", "className": "CredentialRecord" },
  "time": "2026-09-10T17:20:44Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000420",
    "credential": { "id": "d6000000-0000-4000-8000-000000000103", "className": "CredentialRecord" },
    "occurredAt": "2026-09-10T17:20:44Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialSuspended"
  }
}
```

At 2026-09-17T00:00:00Z the server resumes the fob itself and publishes:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000003",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000103", "className": "CredentialRecord" },
  "time": "2026-09-17T00:00:00Z",
  "data": {
    "id": "d6000000-0000-4000-8000-000000000103",
    "version": 4,
    "credentialType": "electronicID",
    "credentialIdentification": "F-2201-0917",
    "credentialAssignedType": "customer",
    "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
    "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
    "credentialStatus": "active",
    "statusHistory": [
      { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
      { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim" },
      { "state": "suspended", "time": "2026-09-10T08:00:00Z", "actor": "billing-batch" },
      { "state": "active", "time": "2026-09-17T00:00:00Z", "actor": "system", "detail": "suspension.until reached" }
    ]
  }
}
```

---

## CRD-07 — Suspend and resume by hand, and the transitions that do not exist

<!-- apx:scenario CRD-07 kind=lifecycle ics=APX-CRD-01,APX-CRD-02 -->

**Given** Ray is travelling for a week and asks the desk to freeze the
fob without an end date. **When** the desk suspends it on the 18th and
resumes it on the 22nd, then clicks Resume again, and then tries to
suspend a hangtag that was issued but never collected. **Then** 200,
200, 409 `credential-transition-illegal` (already active), and 409
`credential-transition-illegal` (`issued` cannot be suspended, only
activated or revoked); an unknown id is 404 on both routes.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/suspend -->
```json
{ "reason": "holderRequest", "note": "Holder abroad until the 22nd." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 5,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "credentialStatus": "suspended",
  "suspension": { "reason": "holderRequest" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim" },
    { "state": "suspended", "time": "2026-09-10T08:00:00Z", "actor": "billing-batch" },
    { "state": "active", "time": "2026-09-17T00:00:00Z", "actor": "system" },
    { "state": "suspended", "time": "2026-09-18T16:40:00Z", "actor": "frontdesk-mkim", "detail": "Holder abroad until the 22nd." }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/resume -->
```json
{ "reason": "holderRequest", "note": "Holder back; resumed at the desk." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 6,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "credentialStatus": "active",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim" },
    { "state": "suspended", "time": "2026-09-10T08:00:00Z", "actor": "billing-batch" },
    { "state": "active", "time": "2026-09-17T00:00:00Z", "actor": "system" },
    { "state": "suspended", "time": "2026-09-18T16:40:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-22T08:12:30Z", "actor": "frontdesk-mkim", "detail": "Holder back; resumed at the desk." }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/resume -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "resume requires credentialStatus suspended; d6000000-0000-4000-8000-000000000103 is active.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000103/resume"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000110/suspend -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "suspend requires credentialStatus active; d6000000-0000-4000-8000-000000000110 is issued (never activated).",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000110/suspend"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/suspend -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/suspend"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/resume -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/resume"
}
```

---

## CRD-08 — Reported lost from active, stolen while suspended, and the states that cannot be lost

<!-- apx:scenario CRD-08 kind=lifecycle ics=APX-CRD-01,APX-CRD-02 -->

**Given** Maya calls at noon on the 19th: the keycard is gone (scenario
20). **When** the agent reports it lost; later, Northshore Plumbing's
windshield transponder — suspended for an account balance — is reported
stolen from a van; then someone tries report-lost on the uncollected
hangtag and again on Maya's already-lost card. **Then** 200 (`active →
lost`), 200 (`suspended → lost`), 409, 409, and 404 for an unknown id.
From each `lost` instant the lane denies the credential.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/report-lost -->
```json
{ "reason": "holderRequest", "note": "Caller reports card missing since yesterday evening." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 5,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "deposit": { "currencyType": "USD", "currencyValue": 25.0 }, "depositStatus": "held" },
  "credentialStatus": "lost",
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system" },
    { "state": "lost", "time": "2026-09-19T12:03:41Z", "actor": "agent-0212", "detail": "Caller reports card missing since yesterday evening." }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000104/report-lost -->
```json
{ "reason": "stolen", "note": "Van broken into overnight; police ref LPD-26-088412." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000104",
  "version": 4,
  "credentialType": "rfid",
  "credentialIdentification": "TR-8841-0032",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "transponder", "serialNumber": "TRX-9A-221034", "batch": "2026-Q3-T" },
  "credentialStatus": "lost",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" },
    { "state": "active", "time": "2026-09-01T10:02:00Z", "actor": "fleet-desk" },
    { "state": "suspended", "time": "2026-09-20T06:00:00Z", "actor": "billing-batch", "detail": "account balance over limit" },
    { "state": "lost", "time": "2026-09-23T07:45:10Z", "actor": "agent-0212", "detail": "Van broken into overnight; police ref LPD-26-088412." }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000110/report-lost -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "report-lost requires credentialStatus active or suspended; d6000000-0000-4000-8000-000000000110 is issued.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000110/report-lost"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/report-lost -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000101 is already lost (since 2026-09-19T12:03:41Z); replace or revoke it.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000101/report-lost"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/report-lost -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/report-lost"
}
```

---

## CRD-09 — Replace the lost card from pre-encoded stock, in one call

<!-- apx:scenario CRD-09 kind=happy ics=APX-CRD-01,APX-CRD-03,APX-CRD-06 -->

**Given** Maya's card is `lost` and the front desk holds pre-encoded
stock. **When** the agent replaces it, forfeiting the old deposit against
the new one, and the console retries the same call after a timeout.
**Then** 201 with the successor already `active`, inheriting holder,
account, assigned right, places, and validity; the predecessor reads
`replaced` with `replacedBy` and its deposit `forfeited`; the retry
returns 200 with the SAME successor. The AssignedRight swapped cards in
one `AssignedRightUpdated`.

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace
Idempotency-Key: cc-0212-20260919-1204-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace -->
```json
{
  "reason": "lost",
  "credentialIdentification": "C-0051207",
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-006903",
    "batch": "2026-Q3-A",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 }
  },
  "oldDepositStatus": "forfeited",
  "note": "Replacement issued at front desk; parker to collect."
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000102",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0051207",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-006903",
    "batch": "2026-Q3-A",
    "issuedTime": "2026-09-19T12:04:20Z",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "active",
  "replaces": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212", "detail": "replacement for d6000000-0000-4000-8000-000000000101 (lost)" },
    { "state": "active", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212" }
  ]
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 6,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "deposit": { "currencyType": "USD", "currencyValue": 25.0 }, "depositStatus": "forfeited" },
  "credentialStatus": "replaced",
  "replacedBy": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system" },
    { "state": "lost", "time": "2026-09-19T12:03:41Z", "actor": "agent-0212" },
    { "state": "replaced", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212", "detail": "successor d6000000-0000-4000-8000-000000000102; deposit forfeited" }
  ]
}
```

The predecessor keeps every field it had, `assignedRights[]` included, as
the record of what it used to open; only its status, `replacedBy`, the
deposit status, and the history changed. Being `replaced`, it is
materialized on nothing (F-CRD-10, fixed: §21.3; public scenario 20 now
shows the same).

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace
Idempotency-Key: cc-0212-20260919-1204-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace -->
```json
{
  "reason": "lost",
  "credentialIdentification": "C-0051207",
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-006903",
    "batch": "2026-Q3-A",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 }
  },
  "oldDepositStatus": "forfeited",
  "note": "Replacement issued at front desk; parker to collect."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000102",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0051207",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-006903",
    "batch": "2026-Q3-A",
    "issuedTime": "2026-09-19T12:04:20Z",
    "deposit": { "currencyType": "USD", "currencyValue": 25.0 },
    "depositStatus": "held"
  },
  "credentialStatus": "active",
  "replaces": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212", "detail": "replacement for d6000000-0000-4000-8000-000000000101 (lost)" },
    { "state": "active", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212" }
  ]
}
```

The status event for the predecessor's `replaced` transition:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000004",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "time": "2026-09-19T12:04:20Z",
  "data": {
    "id": "d6000000-0000-4000-8000-000000000101",
    "version": 6,
    "credentialType": "rfid",
    "credentialIdentification": "C-0048812",
    "credentialStatus": "replaced",
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
    "replacedBy": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
    "statusHistory": [
      { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
      { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system" },
      { "state": "lost", "time": "2026-09-19T12:03:41Z", "actor": "agent-0212" },
      { "state": "replaced", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212" }
    ]
  }
}
```

---

## CRD-10 — Everything replace refuses

<!-- apx:scenario CRD-10 kind=refusal ics=APX-CRD-01,APX-CRD-03,APX-CORE-05 -->

**Given** the replaced card from CRD-09, the hangtag revoked in CRD-12,
the seasonal hangtag that expired in CRD-13, and the uncollected hangtag
still in `issued`. **When** a replacement is requested on each, then on
Ray's fob with a successor identification that is already live, then
with the key from CRD-09 and a different body, then without a key, then
on an id that does not exist. **Then** 409 `credential-not-replaceable`
three times, 409 `credential-transition-illegal` for `issued` (F-CRD-04,
fixed: §21.1 rule 1 now says so, and `credential-not-replaceable` is
reserved for terminal states), 409
`credential-identification-in-use`, 409 `idempotency-conflict`, 400
`idempotency-key-required`, and 404.

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace
Idempotency-Key: cc-0212-20260924-0901-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace -->
```json
{ "reason": "lost", "credentialIdentification": "C-0051300" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-not-replaceable",
  "title": "Credential cannot be replaced",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000101 is replaced (successor d6000000-0000-4000-8000-000000000102); replace the successor instead.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000101/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000110/replace
Idempotency-Key: cc-0212-20260924-0902-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000110/replace -->
```json
{ "reason": "reissue", "credentialIdentification": "HT-0341" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-not-replaceable",
  "title": "Credential cannot be replaced",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000110 is revoked; issue a new credential instead.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000110/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000112/replace
Idempotency-Key: cc-0212-20260924-0903-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000112/replace -->
```json
{ "reason": "reissue", "credentialIdentification": "HT-0342" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-not-replaceable",
  "title": "Credential cannot be replaced",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000112 expired at 2026-08-31T23:59:59Z; issue a new credential for the new season.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000112/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000113/replace
Idempotency-Key: cc-0212-20260924-0904-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000113/replace -->
```json
{ "reason": "damaged" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "replace requires credentialStatus active, suspended, or lost; d6000000-0000-4000-8000-000000000113 is issued.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000113/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace
Idempotency-Key: cc-0212-20260924-0905-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace -->
```json
{ "reason": "damaged", "credentialIdentification": "F-2201-0918", "media": { "form": "fob", "serialNumber": "LNR-433-018823" } }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-identification-in-use",
  "title": "Credential identification already in use",
  "status": 409,
  "detail": "electronicID F-2201-0918 is held by a non-terminal credential record.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000103/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace
Idempotency-Key: cc-0212-20260919-1204-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace -->
```json
{ "reason": "lost", "credentialIdentification": "C-0051208", "oldDepositStatus": "refunded" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key cc-0212-20260919-1204-replace was first used at 2026-09-19T12:04:20Z with a different body.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000101/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace -->
```json
{ "reason": "damaged" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/credentials/{id}/replace issues a credential and requires an Idempotency-Key header.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000103/replace"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/replace
Idempotency-Key: cc-0212-20260924-0906-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/replace -->
```json
{ "reason": "lost" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/replace"
}
```

---

## CRD-11 — 6 PM: the old card at the gate, and the next morning's question

<!-- apx:scenario CRD-11 kind=happy ics=APX-CRD-02,APX-CRD-04,APX-CRD-05 -->

**Given** the old card was taken off the AssignedRight at noon. **When**
someone presents it at the entry lane at 18:02 and Maya asks the next
morning whether anyone used it. **Then** the APDS-native lane finds no
right carrying `C-0048812` and denies; the server records the attempt
with `denialReason: credentialReplaced` and publishes it; the history
route returns newest-first, filters by `outcome`, pages, and 404s for an
unknown credential.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000005",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "time": "2026-09-19T18:02:17Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000410",
    "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
    "occurredAt": "2026-09-19T18:02:17Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialReplaced"
  }
}
```

Next morning, from Maya's app (`apx.credentials:read`):

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101/access-events?since=2026-09-18T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789977600, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000410",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-19T18:02:17Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "credentialReplaced"
    },
    {
      "id": "d7000000-0000-4000-8000-000000000388",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-18T17:41:05Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "device": { "id": "b2000000-0000-4000-8000-000000000012", "className": "SupplementalEquipment" },
      "direction": "exit",
      "outcome": "granted",
      "session": { "id": "f1000000-0000-4000-8000-000000000318", "className": "Session" }
    }
  ]
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101/access-events?outcome=denied -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789977600, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000410",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-19T18:02:17Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "credentialReplaced"
    }
  ]
}
```

The full nine-month history is 212 events; page 3 at the default page
size of 100 holds the oldest twelve:

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101/access-events?page=3 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789977600, "offset": 200, "pageSize": 100, "total": 212 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000012",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-01-14T08:02:51Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "direction": "entry",
      "outcome": "granted",
      "session": { "id": "f1000000-0000-4000-8000-000000000012", "className": "Session" }
    }
  ]
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-0000000000ff/access-events -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/access-events"
}
```

---

## CRD-12 — Revoke: never collected, stolen, and twice is once too many

<!-- apx:scenario CRD-12 kind=lifecycle ics=APX-CRD-01,APX-CRD-02,APX-CRD-06 -->

**Given** a contractor hangtag issued on the 1st that nobody ever
collected, and Northshore's transponder now `lost` with a police
reference. **When** the desk revokes the hangtag from `issued` and the
fleet desk revokes the transponder from `lost`, then a second revoke
lands on each, and one on Maya's replaced card. **Then** 200, 200, and
409 `credential-transition-illegal` three times: `revoked` and `replaced`
are terminal. The transponder's `CredentialAssigned` is gone from the
fleet AssignedRight; an unknown id is 404.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000110/revoke -->
```json
{ "reason": "notCollected", "note": "Issued 2026-09-01, never collected; returned to stock." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000110",
  "version": 2,
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0340",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000340", "batch": "2026-Q3-H" },
  "credentialStatus": "revoked",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:30:00Z", "actor": "frontdesk-mkim" },
    { "state": "revoked", "time": "2026-09-15T09:00:00Z", "actor": "frontdesk-mkim", "detail": "Issued 2026-09-01, never collected; returned to stock." }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000104/revoke -->
```json
{ "reason": "stolen", "note": "Police ref LPD-26-088412; fleet will re-tag the van." }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000104",
  "version": 5,
  "credentialType": "rfid",
  "credentialIdentification": "TR-8841-0032",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "transponder", "serialNumber": "TRX-9A-221034", "batch": "2026-Q3-T" },
  "credentialStatus": "revoked",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" },
    { "state": "active", "time": "2026-09-01T10:02:00Z", "actor": "fleet-desk" },
    { "state": "suspended", "time": "2026-09-20T06:00:00Z", "actor": "billing-batch" },
    { "state": "lost", "time": "2026-09-23T07:45:10Z", "actor": "agent-0212" },
    { "state": "revoked", "time": "2026-09-23T08:10:00Z", "actor": "fleet-desk", "detail": "Police ref LPD-26-088412; fleet will re-tag the van." }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000006",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000104", "className": "CredentialRecord" },
  "time": "2026-09-23T08:10:00Z",
  "data": {
    "id": "d6000000-0000-4000-8000-000000000104",
    "version": 5,
    "credentialType": "rfid",
    "credentialIdentification": "TR-8841-0032",
    "credentialAssignedType": "vehicle",
    "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
    "credentialStatus": "revoked",
    "statusHistory": [
      { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" },
      { "state": "active", "time": "2026-09-01T10:02:00Z", "actor": "fleet-desk" },
      { "state": "suspended", "time": "2026-09-20T06:00:00Z", "actor": "billing-batch" },
      { "state": "lost", "time": "2026-09-23T07:45:10Z", "actor": "agent-0212" },
      { "state": "revoked", "time": "2026-09-23T08:10:00Z", "actor": "fleet-desk" }
    ]
  }
}
```

<!-- apx:request GET /rights/assigned?credential_type=rfid&credential_id=TR-8841-0032 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790323800, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000110/revoke -->
```json
{ "reason": "notCollected" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000110 is revoked (terminal).",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000110/revoke"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000101/revoke -->
```json
{ "reason": "securityIncident" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000101 is replaced (terminal); revoke the successor d6000000-0000-4000-8000-000000000102 if that is the intent.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000101/revoke"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-0000000000ff/revoke -->
```json
{ "reason": "securityIncident" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No credential d6000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-0000000000ff/revoke"
}
```

---

## CRD-13 — The season ends at midnight: expired by the server, denied at the gate

<!-- apx:scenario CRD-13 kind=lifecycle ics=APX-CRD-01,APX-CRD-02,APX-CRD-04,APX-CRD-06 -->

**Given** a summer-season hangtag whose `validity.end` is
2026-08-31T23:59:59Z. **When** that instant passes, the holder tries the
gate on September 1, and the desk later tries to reactivate it. **Then**
the server moves it to `expired` with actor `system` and publishes the
status event like any other transition; the lane denies with
`credentialExpired`; and `activate` is 409 `credential-transition-illegal`
because `expired` is terminal. There is no route that sets expiry — it is
the clock.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000007",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000112", "className": "CredentialRecord" },
  "time": "2026-09-01T00:00:00Z",
  "data": {
    "id": "d6000000-0000-4000-8000-000000000112",
    "version": 3,
    "credentialType": "hangtag",
    "credentialIdentification": "HT-0212",
    "credentialAssignedType": "customer",
    "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
    "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
    "validity": { "start": "2026-06-01T00:00:00Z", "end": "2026-08-31T23:59:59Z" },
    "credentialStatus": "expired",
    "statusHistory": [
      { "state": "issued", "time": "2026-05-28T14:00:00Z", "actor": "frontdesk-mkim" },
      { "state": "active", "time": "2026-06-01T08:15:00Z", "actor": "frontdesk-mkim" },
      { "state": "expired", "time": "2026-09-01T00:00:00Z", "actor": "system", "detail": "validity.end passed" }
    ]
  }
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000112 -->
<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000112",
  "version": 3,
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0212",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-06-01T00:00:00Z", "end": "2026-08-31T23:59:59Z" },
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000212", "batch": "2026-Q2-H" },
  "credentialStatus": "expired",
  "statusHistory": [
    { "state": "issued", "time": "2026-05-28T14:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-06-01T08:15:00Z", "actor": "frontdesk-mkim" },
    { "state": "expired", "time": "2026-09-01T00:00:00Z", "actor": "system", "detail": "validity.end passed" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000008",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000112", "className": "CredentialRecord" },
  "time": "2026-09-01T07:58:03Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000401",
    "credential": { "id": "d6000000-0000-4000-8000-000000000112", "className": "CredentialRecord" },
    "occurredAt": "2026-09-01T07:58:03Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialExpired"
  }
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000112/activate -->
```json
{ "reason": "holderRequest", "note": "Holder wants the tag back for September." }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-transition-illegal",
  "title": "Credential transition not allowed from current state",
  "status": 409,
  "detail": "d6000000-0000-4000-8000-000000000112 is expired (terminal); issue a new credential with a new validity.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000112/activate"
}
```

---

## CRD-14 — Upgrade the fob to a mobile credential, deposit refunded

<!-- apx:scenario CRD-14 kind=happy ics=APX-CRD-03,APX-CRD-02 -->

**Given** Ray installs the garage app and wants to stop carrying the
fob. **When** the desk replaces the active fob with a Bluetooth mobile
credential, leaving the identification to the server (the app enrolls
against whatever the server mints) and refunding the $15 deposit.
**Then** 201 with a successor of a different `credentialType`, no
deposit, `media.form: mobile`, and the fob `replaced` with its deposit
`refunded` — one atomic swap on the AssignedRight.

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace
Idempotency-Key: fd-mkim-20260924-1015-replace
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/replace -->
```json
{
  "reason": "upgrade",
  "credentialType": "bluetooth",
  "media": { "form": "mobile" },
  "oldDepositStatus": "refunded",
  "note": "Fob returned to stock; $15 refunded to card on file."
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000108",
  "version": 1,
  "credentialType": "bluetooth",
  "credentialIdentification": "MB-7F3A91C2",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "mobile", "issuedTime": "2026-09-24T10:15:40Z" },
  "credentialStatus": "active",
  "replaces": { "id": "d6000000-0000-4000-8000-000000000103", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-24T10:15:40Z", "actor": "frontdesk-mkim", "detail": "replacement for d6000000-0000-4000-8000-000000000103 (upgrade)" },
    { "state": "active", "time": "2026-09-24T10:15:40Z", "actor": "frontdesk-mkim" }
  ]
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000103 -->
<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000103",
  "version": 7,
  "credentialType": "electronicID",
  "credentialIdentification": "F-2201-0917",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000103", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000103", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-02T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "fob", "serialNumber": "LNR-433-018822", "deposit": { "currencyType": "USD", "currencyValue": 15.0 }, "depositStatus": "refunded" },
  "credentialStatus": "replaced",
  "replacedBy": { "id": "d6000000-0000-4000-8000-000000000108", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-02T09:00:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-02T09:05:12Z", "actor": "frontdesk-mkim" },
    { "state": "suspended", "time": "2026-09-10T08:00:00Z", "actor": "billing-batch" },
    { "state": "active", "time": "2026-09-17T00:00:00Z", "actor": "system" },
    { "state": "suspended", "time": "2026-09-18T16:40:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-09-22T08:12:30Z", "actor": "frontdesk-mkim" },
    { "state": "replaced", "time": "2026-09-24T10:15:40Z", "actor": "frontdesk-mkim", "detail": "successor d6000000-0000-4000-8000-000000000108; deposit refunded" }
  ]
}
```

---

## CRD-15 — Fleet onboarding: a plate as the credential, a windshield transponder, a contractor hangtag

<!-- apx:scenario CRD-15 kind=happy ics=APX-CRD-01,APX-CRD-02 -->

**Given** Northshore Plumbing signs a fleet contract and a contractor
needs a visible tag for the loading dock. **When** the fleet desk issues
the van's plate as its credential (`licensePlate`, identifies the
vehicle, no media deposit), a windshield transponder for a second van,
and a hangtag for the contractor, then activates the plate. **Then**
three 201s and a 200, and the plate is materialized on the fleet
AssignedRight as a `vehicle` `CredentialAssigned` the LPR lane can match
without any APX call.

```http
POST /v1/credentials
Idempotency-Key: fleet-20260901-1000-plate
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "licensePlate",
  "credentialIdentification": "NSP4471",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "plate" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000105",
  "version": 1,
  "credentialType": "licensePlate",
  "credentialIdentification": "NSP4471",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "plate", "issuedTime": "2026-09-01T10:00:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" }
  ]
}
```

```http
POST /v1/credentials
Idempotency-Key: fleet-20260901-1000-transponder
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "TR-8841-0032",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "transponder", "serialNumber": "TRX-9A-221034", "batch": "2026-Q3-T" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000104",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "TR-8841-0032",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "transponder", "serialNumber": "TRX-9A-221034", "batch": "2026-Q3-T", "issuedTime": "2026-09-01T10:00:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" }
  ]
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260901-1030-hangtag
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0339",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000105", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2026-11-30T23:59:59Z" },
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000339", "batch": "2026-Q3-H" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000106",
  "version": 1,
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0339",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000105", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2026-11-30T23:59:59Z" },
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000339", "batch": "2026-Q3-H", "issuedTime": "2026-09-01T10:30:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:30:00Z", "actor": "frontdesk-mkim" }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000105/activate -->
```json
{ "reason": "contractStart" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000105",
  "version": 2,
  "credentialType": "licensePlate",
  "credentialIdentification": "NSP4471",
  "credentialAssignedType": "vehicle",
  "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
  "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000104", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-09-01T00:00:00Z", "end": "2027-08-31T23:59:59Z" },
  "media": { "form": "plate", "issuedTime": "2026-09-01T10:00:00Z" },
  "credentialStatus": "active",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-01T10:00:00Z", "actor": "fleet-desk" },
    { "state": "active", "time": "2026-09-01T10:01:00Z", "actor": "fleet-desk", "detail": "contractStart" }
  ]
}
```

What the LPR lane sees on the fleet right:

<!-- apx:request GET /rights/assigned?credential_type=licensePlate&credential_id=NSP4471 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1788429660, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e1000000-0000-4000-8000-000000000104",
      "version": 3,
      "rightSpecification": { "id": "e0000000-0000-4000-8000-000000000002", "version": 1, "className": "RightSpecification" },
      "rightHolder": {
        "credentials": [
          {
            "type": "licensePlate",
            "credentialAssignedType": "vehicle",
            "identifier": { "id": "d6000000-0000-4000-8000-000000000105", "className": "CredentialRecord" }
          }
        ]
      },
      "issuanceTime": "2026-09-01T10:01:00Z",
      "expiry": "2027-08-31T23:59:59Z"
    }
  ]
}
```

---

## CRD-16 — The list, sliced every way the console needs

<!-- apx:scenario CRD-16 kind=happy ics=APX-CRD-05,APX-CRD-01 -->

**Given** the desk console's search box. **When** it lists by holder,
by type and place, by status, by account, and by exact identification,
and pages a long result. **Then** each answer is the APDS `{meta, data}`
envelope constrained to the Lakeside grant, and identification values
appear because the token carries `apx.credentials:read`.

<!-- apx:request GET /v1/credentials?holder=c1000000-0000-4000-8000-000000000102 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000102",
      "version": 1,
      "credentialType": "rfid",
      "credentialIdentification": "C-0051207",
      "credentialAssignedType": "customer",
      "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
      "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
      "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
      "credentialStatus": "active",
      "replaces": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" }
    },
    {
      "id": "d6000000-0000-4000-8000-000000000101",
      "version": 6,
      "credentialType": "rfid",
      "credentialIdentification": "C-0048812",
      "credentialAssignedType": "customer",
      "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
      "credentialStatus": "replaced",
      "replacedBy": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" }
    }
  ]
}
```

<!-- apx:request GET /v1/credentials?type=licensePlate&place=b1000000-0000-4000-8000-000000000001&status=active -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000105",
      "version": 2,
      "credentialType": "licensePlate",
      "credentialIdentification": "NSP4471",
      "credentialAssignedType": "vehicle",
      "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
      "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
      "credentialStatus": "active"
    }
  ]
}
```

<!-- apx:request GET /v1/credentials?account=a3000000-0000-4000-8000-000000000104&status=revoked -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000104",
      "version": 5,
      "credentialType": "rfid",
      "credentialIdentification": "TR-8841-0032",
      "credentialAssignedType": "vehicle",
      "holder": { "id": "c1000000-0000-4000-8000-000000000104", "className": "RightHolder" },
      "account": { "id": "a3000000-0000-4000-8000-000000000104", "className": "Account" },
      "credentialStatus": "revoked"
    }
  ]
}
```

<!-- apx:request GET /v1/credentials?identification=F-2201-0917&type=electronicID -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000103",
      "version": 7,
      "credentialType": "electronicID",
      "credentialIdentification": "F-2201-0917",
      "credentialAssignedType": "customer",
      "holder": { "id": "c1000000-0000-4000-8000-000000000103", "className": "RightHolder" },
      "credentialStatus": "replaced",
      "replacedBy": { "id": "d6000000-0000-4000-8000-000000000108", "className": "CredentialRecord" }
    }
  ]
}
```

All 1,340 Lakeside records, page 14:

<!-- apx:request GET /v1/credentials?place=b1000000-0000-4000-8000-000000000001&page=14 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790330400, "offset": 1300, "pageSize": 100, "total": 1340 },
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000106",
      "version": 1,
      "credentialType": "hangtag",
      "credentialIdentification": "HT-0339",
      "credentialAssignedType": "customer",
      "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
      "credentialStatus": "issued"
    }
  ]
}
```

---

## CRD-17 — Wrong scope, wrong garage, no grant at all

<!-- apx:scenario CRD-17 kind=security ics=APX-CORE-07,APX-CORE-08,APX-CRD-05 -->

**Given** a read-only credentials token, a token with only
`apx.accounts:read`, a Lakeside manage token, and a manage token with no
`apx_places` claim. **When** the read-only token issues and resumes; the
accounts token searches by identification (the oracle §21.5 forbids);
the Lakeside token reads, activates, suspends, reports lost, replaces,
and reads the history of a Harbor Deck tenant's card, and issues a card
whose only place is Harbor Deck; and the claimless token revokes Maya's
card. **Then** 403 `insufficient-scope` three times, 403
`insufficient-grant` for every Harbor Deck target, and 403
`insufficient-grant` for the claimless token (fail-closed).

```http
POST /v1/credentials
Authorization: Bearer <apx.credentials:read only>
Idempotency-Key: ro-0001
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0051400",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/credentials requires scope apx.credentials:manage; token carries apx.credentials:read.",
  "instance": "/v1/credentials"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000103/resume -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/credentials/{id}/resume requires scope apx.credentials:manage; token carries apx.credentials:read.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000103/resume"
}
```

```http
GET /v1/credentials?identification=C-0051207
Authorization: Bearer <apx.accounts:read only>
```

<!-- apx:request GET /v1/credentials?identification=C-0051207 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/credentials requires scope apx.credentials:read; token carries apx.accounts:read.",
  "instance": "/v1/credentials"
}
```

```http
Authorization: Bearer <apx.credentials:manage, apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000111 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000111/activate -->
```json
{ "reason": "collected" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111/activate"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000111/suspend -->
```json
{ "reason": "nonPayment" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111/suspend"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000111/report-lost -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111/report-lost"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000111/replace
Idempotency-Key: harbor-0001
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000111/replace -->
```json
{ "reason": "lost" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111/replace"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000111/access-events -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Credential d6000000-0000-4000-8000-000000000111 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000111/access-events"
}
```

A credential for a holder outside the grant — the only place it would be
valid at is Harbor Deck:

```http
POST /v1/credentials
Idempotency-Key: harbor-0002
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0090001",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" } ]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "places[0] b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/credentials"
}
```

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000102/revoke
Authorization: Bearer <apx.credentials:manage, no apx_places claim at all>
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/revoke -->
```json
{ "reason": "securityIncident" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/revoke"
}
```

---

## CRD-18 — Uniqueness across garages, without becoming an oracle

<!-- apx:scenario CRD-18 kind=security ics=APX-CRD-01,APX-CRD-05 -->

**Given** Harbor Deck holds a live `rfid` card `C-0077120` and Lakeside
receives a batch printed with the same number. **When** the Lakeside desk
issues it; then a Lakeside read-only token searches for it; then the
desk issues a hangtag numbered like Maya's live card, and finally
reissues `C-0048812`, whose old record is terminal. **Then** 409
`credential-identification-in-use` with a `detail` that names the type
and nothing else — no record, holder, place, or state (F-CRD-05, fixed:
§21.1 rule 2 keeps uniqueness implementation-wide because a lane cannot
tell two identical cards apart, and §21.5 now requires the `detail` to
identify nothing, so the collision reveals only that the value is
taken); an empty 200 for the
read (grant-constrained, no leak); 201 (unique per type); and 201 with no
`replaces` (a terminal record's identification may be reissued).

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1100-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0077120",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000106", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-007120" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-identification-in-use",
  "title": "Credential identification already in use",
  "status": 409,
  "detail": "rfid C-0077120 is held by a non-terminal credential record.",
  "instance": "/v1/credentials"
}
```

```http
GET /v1/credentials?type=rfid&identification=C-0077120
Authorization: Bearer <apx.credentials:read, apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/credentials?type=rfid&identification=C-0077120 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790334000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1101-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "hangtag",
  "credentialIdentification": "C-0051207",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000351" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000113",
  "version": 1,
  "credentialType": "hangtag",
  "credentialIdentification": "C-0051207",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000105", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "hangtag", "serialNumber": "HT-2026-000351", "issuedTime": "2026-09-24T11:01:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-24T11:01:00Z", "actor": "frontdesk-mkim" }
  ]
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1102-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000106", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "batch": "2025-Q4-B" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000114",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000106", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "batch": "2025-Q4-B", "issuedTime": "2026-09-24T11:02:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-24T11:02:00Z", "actor": "frontdesk-mkim", "detail": "identification previously held by terminal record d6000000-0000-4000-8000-000000000101; card recovered and re-stocked" }
  ]
}
```

---

## CRD-19 — A magstripe card the enum cannot name: extensions survive the round-trip

<!-- apx:scenario CRD-19 kind=edge ics=APX-CORE-04,APX-CRD-01 -->

**Given** Lakeside still runs one magstripe lane and APDS
`CredentialTypeEnum` has no magstripe value (Part 21 maps it to `ticket`
and carries the technology in `extensions`). **When** the desk issues the
card with an `apds-ext:lakeside:readtech@1.0` block and a loyalty block
from a vendor the server has never heard of, then reads it back, then a
client sends a key that does not match the §4.3 pattern. **Then** 201
and 200 carry both keys byte-for-byte, and the malformed key is 400
`invalid-request` (F-CRD-02, fixed).

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1130-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "ticket",
  "credentialIdentification": "MS-0090-2211",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "MAG-2211-000090" },
  "extensions": {
    "apds-ext:lakeside:readtech@1.0": { "technology": "magstripe", "track": 2 },
    "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000109",
  "version": 1,
  "credentialType": "ticket",
  "credentialIdentification": "MS-0090-2211",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "MAG-2211-000090", "issuedTime": "2026-09-24T11:30:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-24T11:30:00Z", "actor": "frontdesk-mkim" }
  ],
  "extensions": {
    "apds-ext:lakeside:readtech@1.0": { "technology": "magstripe", "track": 2 },
    "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold" }
  }
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000109 -->
<!-- apx:response 200 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000109",
  "version": 1,
  "credentialType": "ticket",
  "credentialIdentification": "MS-0090-2211",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "media": { "form": "physicalCard", "serialNumber": "MAG-2211-000090", "issuedTime": "2026-09-24T11:30:00Z" },
  "credentialStatus": "issued",
  "statusHistory": [
    { "state": "issued", "time": "2026-09-24T11:30:00Z", "actor": "frontdesk-mkim" }
  ],
  "extensions": {
    "apds-ext:lakeside:readtech@1.0": { "technology": "magstripe", "track": 2 },
    "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold" }
  }
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1131-issue
```

<!-- apx:request POST /v1/credentials invalid -->
```json
{
  "credentialType": "ticket",
  "credentialIdentification": "MS-0090-2212",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "extensions": {
    "x-lakeside-readtech": { "technology": "magstripe" }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "extensions key \"x-lakeside-readtech\" does not match ^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\\.[0-9]+$ (Part 4 §4.3).",
  "instance": "/v1/credentials"
}
```

---

## CRD-20 — Denied for passback: the access log says so, the fix lives in Part 17

<!-- apx:scenario CRD-20 kind=edge ics=APX-CRD-04 -->

**Given** Maya's new card was used to let a friend in and never exited.
**When** she presents it at the entry lane herself at 08:03. **Then** the
lane denies with `denialReason: passback`, the event is published, and
the agent who takes the call reads the passback overlay on the Part 17
route (`apx.control:read`) and clears it with a `resetPassback` command —
nothing in this Part changes the credential's lifecycle for it.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000009",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
  "time": "2026-09-24T08:03:47Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000431",
    "credential": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
    "occurredAt": "2026-09-24T08:03:47Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "passback"
  }
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000102/passback -->
<!-- apx:response 200 -->
```json
{
  "credential": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
  "state": "violation",
  "expectedPresence": "outside",
  "recordedPresence": "inside",
  "lastAccess": {
    "direction": "entry",
    "occurredAt": "2026-09-23T19:12:05Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }
  }
}
```

---

## CRD-21 — 2 am: a card nobody issued, and every denial at lane 1 tonight

<!-- apx:scenario CRD-21 kind=edge ics=APX-CRD-04,APX-CRD-05 -->

**Given** at 02:14 someone presents an HID card numbered `C-0099999`
that no CredentialRecord at Lakeside has ever carried. **When** the lane
denies it with `unknownCredential` and the night supervisor wants every
denial at lane 1 tonight. **Then** the event is an `AccessEvent` with no
`credential` and the value read in `presented` (F-CRD-07, fixed: §21.4
rule 2), and `GET /v1/access-events` lists it by lane alongside the
denials of known cards (F-CRD-08, fixed). A malformed filter is 400; the
Harbor Deck lane is outside the grant, 403; an expired token, 401; a
supervisor dashboard refreshing every second, 429. The per-credential
history now also takes `until` and `direction`.

`CredentialAccessEvent.credential` stays required — relaxing it would
break clients of the per-credential history — so the unmatched event is
validated as the superset `AccessEvent`:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate AccessEvent at /data -->
<!-- apx:validate PresentedCredential at /data/presented -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000010",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-25T02:14:09Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000440",
    "presented": { "credentialType": "rfid", "credentialIdentification": "C-0099999" },
    "occurredAt": "2026-09-25T02:14:09Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "unknownCredential"
  }
}
```

<!-- apx:request GET /v1/access-events?lane=b2000000-0000-4000-8000-000000000001&outcome=denied&since=2026-09-24T22:00:00Z&until=2026-09-25T06:00:00Z -->
<!-- apx:response 200 -->
<!-- apx:validate CredentialAccessEvent at /data/1 -->
```json
{
  "meta": { "referenceInstant": 1790317800, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000440",
      "presented": { "credentialType": "rfid", "credentialIdentification": "C-0099999" },
      "occurredAt": "2026-09-25T02:14:09Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "unknownCredential"
    },
    {
      "id": "d7000000-0000-4000-8000-000000000438",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-24T23:41:52Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "credentialReplaced"
    }
  ]
}
```

The same question by place, subtree-inclusive and comma-separated:

<!-- apx:request GET /v1/access-events?place=b1000000-0000-4000-8000-000000000001&denialReason=unknownCredential&direction=entry&since=2026-09-24T22:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790317800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000440",
      "presented": { "credentialType": "rfid", "credentialIdentification": "C-0099999" },
      "occurredAt": "2026-09-25T02:14:09Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "unknownCredential"
    }
  ]
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000101/access-events?since=2026-09-24T00:00:00Z&until=2026-09-25T00:00:00Z&direction=entry -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790317800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000438",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-24T23:41:52Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "credentialReplaced"
    }
  ]
}
```

<!-- apx:request GET /v1/access-events?lane=b2000000-0000-4000-8000-000000000001&outcome=maybe -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "outcome must be granted or denied.",
  "instance": "/v1/access-events",
  "errors": [ { "pointer": "/outcome", "detail": "must be one of granted, denied" } ]
}
```

<!-- apx:request GET /v1/access-events?lane=b2000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Lane b2000000-0000-4000-8000-000000000003 belongs to b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/access-events"
}
```

```http
GET /v1/access-events?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <expired at 03:00>
```

<!-- apx:request GET /v1/access-events?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/access-events"
}
```

<!-- apx:request GET /v1/access-events?place=b1000000-0000-4000-8000-000000000001&outcome=denied -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 120/min; retry after 3 seconds.",
  "instance": "/v1/access-events"
}
```

---

## CRD-22 — The night shift's token expires at 03:00

<!-- apx:scenario CRD-22 kind=edge ics=APX-CORE-06 -->

**Given** the desk console kept a token that expired at 03:00. **When**
it touches every route in the module before anyone notices. **Then** 401
`unauthenticated` on each, declared everywhere via the shared
`Unauthorized` response (F-CRD-03, fixed: the type is registered in
Part 12). `GET /v1/access-events` is covered in CRD-21.

<!-- apx:request POST /v1/credentials -->
```json
{ "credentialType": "rfid", "credentialIdentification": "C-0051500", "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" } }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials"
}
```

<!-- apx:request GET /v1/credentials?status=active -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000102 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000113/activate -->
```json
{ "reason": "collected" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000113/activate"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/suspend -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/suspend"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/resume -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/resume"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost -->
```json
{ "reason": "holderRequest" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/revoke -->
```json
{ "reason": "securityIncident" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/revoke"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/replace -->
```json
{ "reason": "damaged" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/replace"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000102/access-events -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T03:00:00Z.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/access-events"
}
```

---

## CRD-23 — The card-file sync replays the whole garage at 2 am

<!-- apx:scenario CRD-23 kind=edge ics=APX-CORE-05 -->

**Given** a nightly integration that re-drives every credential through
the API instead of reading the change feed. **When** it exceeds the
per-credential rate limit on every route in the module. **Then** 429
`rate-limited` with `Retry-After` on each; nothing is issued or
transitioned by a throttled call.

```http
→ 429, Retry-After: 5 (every exchange below)
```

<!-- apx:request POST /v1/credentials -->
```json
{ "credentialType": "rfid", "credentialIdentification": "C-0051600", "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" } }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials"
}
```

<!-- apx:request GET /v1/credentials?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 5 seconds.",
  "instance": "/v1/credentials"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000102 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000113/activate -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000113/activate"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/suspend -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/suspend"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/resume -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/resume"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/revoke -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/revoke"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/replace -->
```json
{ "reason": "sync" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/replace"
}
```

<!-- apx:request GET /v1/credentials/d6000000-0000-4000-8000-000000000102/access-events -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 5 seconds.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/access-events"
}
```


---

## CRD-24 — A console build that forgot the reason

<!-- apx:scenario CRD-24 kind=refusal ics=APX-CRD-01,APX-CORE-05 -->

**Given** a new desk-console release whose transition dialog drops the
required `reason`. **When** it activates, suspends, resumes, reports
lost, and revokes Maya's current card. **Then** 400 `invalid-request` on
each with an `errors[]` pointer to `/reason` (Part 12 §12.4); the card
stays `active` and nothing is published.

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/activate invalid -->
```json
{ "note": "from the desk" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/activate",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/suspend invalid -->
```json
{ "note": "from the desk" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/suspend",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/resume invalid -->
```json
{ "note": "from the desk" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/resume",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost invalid -->
```json
{ "note": "from the desk" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/report-lost",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/revoke invalid -->
```json
{ "note": "from the desk" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/revoke",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

---

## CRD-25 — Windows already over, and a card that activates itself

<!-- apx:scenario CRD-25 kind=edge ics=APX-CRD-01,APX-CRD-06 -->

**Given** a bulk import that still carries last season's contract, a
billing batch that queues suspensions and replays them late, and a
contractor hangtag the desk wants live the moment its window opens.
**When** the import issues a card whose `validity.end` has passed, the
batch suspends Maya's card `until` a time already gone, and the desk
issues the hangtag with `activateOnStart: true` and a `validity.start`
already past. **Then** 422 `request-unprocessable` twice, nothing
written (F-CRD-11, fixed: §21.1 rule 7) — and 201 with the hangtag
already `active`, activated by `system` at issue (F-CRD-06, fixed:
§21.1 rule 6), materialized per §21.2 and published like any other
transition.

```http
POST /v1/credentials
Idempotency-Key: import-2026-09-24-row-0417
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "rfid",
  "credentialIdentification": "C-0033017",
  "credentialAssignedType": "customer",
  "holder": {
    "id": "c1000000-0000-4000-8000-000000000106",
    "className": "RightHolder"
  },
  "places": [
    {
      "id": "b1000000-0000-4000-8000-000000000001",
      "className": "Place"
    }
  ],
  "validity": {
    "start": "2025-09-01T00:00:00Z",
    "end": "2026-08-31T23:59:59Z"
  },
  "media": {
    "form": "physicalCard",
    "serialNumber": "HID-77A3-003017"
  }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request cannot be processed",
  "status": 422,
  "detail": "validity.end 2026-08-31T23:59:59Z is not in the future; a credential would be issued already expired (Part 21 §21.1 rule 7).",
  "instance": "/v1/credentials"
}
```

<!-- apx:request POST /v1/credentials/d6000000-0000-4000-8000-000000000102/suspend -->
```json
{
  "reason": "nonPayment",
  "until": "2026-09-20T00:00:00Z",
  "note": "queued 2026-09-19"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request cannot be processed",
  "status": 422,
  "detail": "until 2026-09-20T00:00:00Z is not in the future; nothing was suspended (Part 21 §21.1 rule 7).",
  "instance": "/v1/credentials/d6000000-0000-4000-8000-000000000102/suspend"
}
```

```http
POST /v1/credentials
Idempotency-Key: fd-mkim-20260924-1405-issue
```

<!-- apx:request POST /v1/credentials -->
```json
{
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0400215",
  "credentialAssignedType": "vehicle",
  "holder": {
    "id": "c1000000-0000-4000-8000-000000000105",
    "className": "RightHolder"
  },
  "assignedRights": [
    {
      "id": "e1000000-0000-4000-8000-000000000105",
      "className": "AssignedRight"
    }
  ],
  "places": [
    {
      "id": "b1000000-0000-4000-8000-000000000001",
      "className": "Place"
    }
  ],
  "validity": {
    "start": "2026-09-24T00:00:00Z",
    "end": "2026-10-31T23:59:59Z"
  },
  "activateOnStart": true,
  "media": {
    "form": "hangtag",
    "serialNumber": "HT-2026-000415"
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000121",
  "version": 2,
  "credentialType": "hangtag",
  "credentialIdentification": "HT-0400215",
  "credentialAssignedType": "vehicle",
  "holder": {
    "id": "c1000000-0000-4000-8000-000000000105",
    "className": "RightHolder"
  },
  "assignedRights": [
    {
      "id": "e1000000-0000-4000-8000-000000000105",
      "className": "AssignedRight"
    }
  ],
  "places": [
    {
      "id": "b1000000-0000-4000-8000-000000000001",
      "className": "Place"
    }
  ],
  "validity": {
    "start": "2026-09-24T00:00:00Z",
    "end": "2026-10-31T23:59:59Z"
  },
  "activateOnStart": true,
  "media": {
    "form": "hangtag",
    "serialNumber": "HT-2026-000415",
    "issuedTime": "2026-09-24T14:05:00Z"
  },
  "credentialStatus": "active",
  "statusHistory": [
    {
      "state": "issued",
      "time": "2026-09-24T14:05:00Z",
      "actor": "frontdesk-mkim"
    },
    {
      "state": "active",
      "time": "2026-09-24T14:05:00Z",
      "actor": "system",
      "detail": "activateOnStart: validity.start already reached at issue"
    }
  ]
}
```

---

## CRD-26 — Monday morning: every other way a lane says no

<!-- apx:scenario CRD-26 kind=edge ics=APX-CRD-04,APX-CRD-05 -->

**Given** six credentials the Lakeside system knows, each refused for a
different reason. **When** each is presented at entry lane 1 between
06:40 and 07:45. **Then** each denial is a `CredentialAccessEvent` naming
its record, carrying the matching `apx-access-denial-reasons` value, and
published on `apx.credentials.access.v1`. With CRD-06 (`credentialSuspended`),
CRD-11 (`credentialReplaced`), CRD-13 (`credentialExpired`), CRD-20
(`passback`), and CRD-21 (`unknownCredential`), every value of the
registry (v2) now has a scenario:

- `credentialNotYetActive` — Dana Ruiz's October contractor hangtag (`d6…0130`), issued on Friday with `validity.start` 2026-10-01 and not yet `active`.
- `credentialLost` — a fob Ray Delgado reported lost on Saturday (`d6…0131`, `lost`).
- `credentialRevoked` — a keycard the operator revoked when a tenant moved out (`d6…0132`, `revoked`).
- `accountBalance` — Northshore Plumbing's fleet card (`d6…0133`, `active`) while the fleet account is 60 days past due.
- `outsidePlace` — a Riverside-lot permit (`d6…0134`, `active`, `places` = the same operator's Riverside lot `b1…0003`) presented at Lakeside.
- `outsideValidity` — a weekend-only resident permit (`d6…0135`, `active`) presented on a Monday.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000050",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000130", "className": "CredentialRecord" },
  "time": "2026-09-28T06:41:12Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000450",
    "credential": { "id": "d6000000-0000-4000-8000-000000000130", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T06:41:12Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialNotYetActive"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000051",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000131", "className": "CredentialRecord" },
  "time": "2026-09-28T06:52:40Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000451",
    "credential": { "id": "d6000000-0000-4000-8000-000000000131", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T06:52:40Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialLost"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000052",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000132", "className": "CredentialRecord" },
  "time": "2026-09-28T07:05:03Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000452",
    "credential": { "id": "d6000000-0000-4000-8000-000000000132", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T07:05:03Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credentialRevoked"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000053",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000133", "className": "CredentialRecord" },
  "time": "2026-09-28T07:19:55Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000453",
    "credential": { "id": "d6000000-0000-4000-8000-000000000133", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T07:19:55Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "accountBalance"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000054",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000134", "className": "CredentialRecord" },
  "time": "2026-09-28T07:31:27Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000454",
    "credential": { "id": "d6000000-0000-4000-8000-000000000134", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T07:31:27Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "outsidePlace"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000055",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d6000000-0000-4000-8000-000000000135", "className": "CredentialRecord" },
  "time": "2026-09-28T07:44:08Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000455",
    "credential": { "id": "d6000000-0000-4000-8000-000000000135", "className": "CredentialRecord" },
    "occurredAt": "2026-09-28T07:44:08Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "outsideValidity"
  }
}
```
