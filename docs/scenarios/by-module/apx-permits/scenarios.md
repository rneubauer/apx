# apx-permits — vetting scenarios

<!-- apx:module apx-permits tag=Permits ics=PRM -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-permits`. Gaps the spec cannot express are marked
`gap=F-PRM-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), operated by organisation
`a1…0001`. Harbor Deck (`b1…0002`, operator `a1…0002`) is a different
operator's garage the token has no grant for. RightSpecifications:
Lakeside monthly permit `e1…0010` (v3, `permitParking`, one RightPool of
120), Lakeside event reservation `e1…0011` (not pooled), Lakeside Q4
monthly `e1…0012` (two RightPools, October and November), Harbor Deck
monthly `e1…0020` (pooled, outside the grant). Holders (className
`RightHolder`, ids local to Lakeside per §14.1a): Priya Natarajan
`c1…0201`, Marcus Bell `c1…0202`, Lakeside Bakery fleet `c1…0203`.
Issued permits are AssignedRights `e2…0101` onward; the CredentialRecords
the plates materialize as are `d6…03NN`. Plates: `PRY-2201`, `PRY-2202`
(Priya), `MBL-7710` (Marcus), `BKR-0001` … `BKR-0003` (bakery vans).

Every request carries `Authorization: Bearer …` with scope
`apx.permits:manage` and `apx_places: ["b1…0001"]` unless the scenario
says otherwise. Native APDS routes (`/rights/specs`, `/rights/assigned`)
appear where the profile says a stock APDS client reads or writes the
same state; they validate against the APDS schemas but are tagged
Right Specifications / Assigned Rights, so they are not in this module's
coverage table. `POST /v1/permits/issue` sends the create shape; `id`,
`version`, `assignedRightIssuer`, and `issuanceTime` are server-assigned.

---

## PRM-01 — Check the pool, issue a two-vehicle permit, read it back as stock APDS

<!-- apx:scenario PRM-01 kind=happy ics=APX-PRM-01,APX-PRM-02 -->

**Given** Priya Natarajan buys an annual monthly-parker permit for her
two cars at the front desk. **When** the desk console checks the pool,
issues the permit with both plates, and the entry lane (which only speaks
APDS) reads the assigned right back. **Then** availability shows three
left, the 201 is a native `AssignedRight` with one `CustomerCredential`
for the holder and one `VehicleCredential` per plate, the stock read
returns the same entity, and availability now shows two left. The
rendering follows the §14.2b materialization list: holder → one
`CustomerCredential`, each plate → one `VehicleCredential` (a
CredentialRecord reference, since Lakeside claims `apx-credentials`),
validity → one `PlannedUse` plus `expiry` (F-PRM-06 fixed).

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "capacity": 120,
  "issued": 117,
  "available": 3
}
```

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-natarajan-annual
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2201" },
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2202" }
  ],
  "validity": { "start": "2026-09-24T00:00:00Z", "end": "2027-09-23T23:59:59Z" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T14:05:12Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
}
```

The entry lane's stock APDS read of the same right:

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T14:05:12Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "capacity": 120,
  "issued": 118,
  "available": 2
}
```

---

## PRM-02 — The pool is empty: 409, and the vendor's waitlist

<!-- apx:scenario PRM-02 kind=refusal ics=APX-PRM-01 -->

**Given** two more permits went out after PRM-01 and the pool reads
zero. **When** Marcus Bell asks for one. **Then** 409 `pool-exhausted`
with the counts in `detail`, and, because Lakeside implements the
OPTIONAL waitlist convention, a vendor-extension member on the problem
naming his waitlist entry. §14.2 now says plainly that the waitlist is
not interoperable and a client must not rely on it (F-PRM-07: won't
fix beyond that clarification).

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "capacity": 120,
  "issued": 120,
  "available": 0
}
```

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-bell-annual
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "MBL-7710" }
  ],
  "validity": { "start": "2026-10-01T00:00:00Z", "end": "2027-09-30T23:59:59Z" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/pool-exhausted",
  "title": "Right pool exhausted",
  "status": 409,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000010 v3: 120 of 120 assigned rights issued; none available.",
  "instance": "/v1/permits/issue",
  "extensions": {
    "apds-ext:lakeside:waitlist@1.0": {
      "entry": "WL-2026-0412",
      "position": 7,
      "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
      "recordedAt": "2026-09-24T14:20:33Z"
    }
  }
}
```

---

## PRM-03 — The desk retries after a timeout

<!-- apx:scenario PRM-03 kind=edge ics=APX-PRM-01 -->

**Given** the 201 from PRM-01 never reached the desk console. **When**
it retries with the same `Idempotency-Key` and body, then a colleague
reuses the key for a different holder, then a kiosk issues with no key
at all. **Then** 200 with the AssignedRight the key issued (no second
slot consumed), 409 `idempotency-conflict`, and — because the header
is optional (making it REQUIRED would break existing clients) — a plain
201 for the keyless kiosk, which is exactly the double-issue a retrying
client avoids by sending the key (§14.2; F-PRM-01 fixed).

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-natarajan-annual
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2201" },
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2202" }
  ],
  "validity": { "start": "2026-09-24T00:00:00Z", "end": "2027-09-23T23:59:59Z" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000101",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T14:05:12Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-natarajan-annual
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "MBL-7710" }
  ]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key desk-20260924-natarajan-annual was first used at 2026-09-24T14:05:12Z for holder c1000000-0000-4000-8000-000000000201.",
  "instance": "/v1/permits/issue"
}
```

```http
POST /v1/permits/issue
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000104",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T14:07:40Z",
  "plannedUses": [
    { "startTime": "2026-09-24T14:07:40Z", "endTime": "2026-10-24T14:07:39Z" }
  ],
  "expiry": "2026-10-24T14:07:39Z"
}
```

---

## PRM-04 — Unknown pool, unknown RightSpecification, unknown holder

<!-- apx:scenario PRM-04 kind=refusal ics=APX-PRM-01 -->

**Given** a permit portal with a stale cache of RightSpecification ids
and a typo in a holder id. **When** it asks availability for a
RightSpecification that does not exist, issues against it, and issues
for a holder that does not exist. **Then** the availability read is a
declared 404 `target-not-found`; the two issue attempts name nothing
through a body Reference, so each is 422 `reference-unknown` (§14.2a(2);
F-PRM-02 fixed — 404 is kept for path ids).

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-0000000000ff/availability -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No RightSpecification e1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-0000000000ff/availability"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: portal-20260924-0001
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-0000000000ff", "version": 1, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Reference names nothing",
  "status": 422,
  "detail": "No RightSpecification e1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/permits/issue"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: portal-20260924-0002
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-0000000002ff", "className": "RightHolder" }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Reference names nothing",
  "status": 422,
  "detail": "No RightHolder c1000000-0000-4000-8000-0000000002ff at this implementation (holder ids are local, Part 14 §14.1a).",
  "instance": "/v1/permits/issue"
}
```

---

## PRM-05 — A RightSpecification that is not pooled, and a stale spec version

<!-- apx:scenario PRM-05 kind=refusal ics=APX-PRM-01 -->

**Given** `e1…0011` is Lakeside's event-reservation RightSpecification:
it exists, is sold through quotes, and carries no `rightPools`. **When**
a console asks its availability, tries to issue a permit from it, and
then issues from the monthly spec naming version 2 when v3 is current.
**Then** the availability read is the declared 404 ("no pool for this
RightSpecification", indistinguishable by type from "no such spec"); the
issue against an unpooled spec is 422 `request-unprocessable` naming the
rule (§14.2a(4); F-PRM-03 fixed); the stale version is the declared 409
`version-conflict` (§14.2a(3)).

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000011 -->
<!-- apx:response 200 -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000011",
  "version": 1,
  "description": [ { "language": "en", "string": "Lakeside event reservation" } ],
  "type": "oneTimeUseParking",
  "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "transferable": false,
  "credentials": [ "licensePlate", "qrCode" ],
  "hierarchyElements": [ { "id": "b1000000-0000-4000-8000-000000000001", "version": 4, "className": "Place" } ],
  "validity": { "validityTimeSpecification": { "overallStartTime": "2026-01-01T00:00:00Z" } }
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000011/availability -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000011 has no RightPool; it is not a pooled permit specification.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-000000000011/availability"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-event-as-permit
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000011", "version": 1, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2201" }
  ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "RightSpecification is not pooled",
  "status": 422,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000011 v1 has no RightPool; permits are issued only from pooled specifications (Part 14 §14.2).",
  "instance": "/v1/permits/issue"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-stale-spec
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 2, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Stale object version",
  "status": 409,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000010 is at version 3; version 2 was superseded on 2026-08-01T00:00:00Z (pool resized 100 → 120).",
  "instance": "/v1/permits/issue"
}
```

---

## PRM-06 — Wrong scope, and Harbor Deck's pool

<!-- apx:scenario PRM-06 kind=security ics=APX-PRM-01,APX-CORE-06,APX-CORE-07 -->

**Given** a BI token with only `apx.data:read`, and the desk token whose
`apx_places` names Lakeside only. **When** the BI token reads a pool and
issues a permit, and the desk token reads Harbor Deck's pool and issues
from it. **Then** 403 `insufficient-scope` twice and 403
`insufficient-grant` twice — the RightSpecification's `hierarchyElements`
place it at Harbor Deck, outside the grant. Both Permits operations
now declare 401, 403, and 429 (F-PRM-04 fixed).

```http
GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/permits/pools/{rightSpecId}/availability requires scope apx.permits:manage; token carries apx.data:read.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability"
}
```

```http
POST /v1/permits/issue
Authorization: Bearer <apx.data:read only>
Idempotency-Key: bi-0001
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/permits/issue requires scope apx.permits:manage; token carries apx.data:read.",
  "instance": "/v1/permits/issue"
}
```

```http
GET /v1/permits/pools/e1000000-0000-4000-8000-000000000020/availability
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000020/availability -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000020 is available at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-000000000020/availability"
}
```

```http
POST /v1/permits/issue
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
Idempotency-Key: desk-20260924-harbor-0001
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000020", "version": 1, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000020 is available at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/permits/issue"
}
```

---

## PRM-07 — Renewal: a new window, linked through extensions, vendor keys preserved

<!-- apx:scenario PRM-07 kind=happy ics=APX-PRM-01,APX-CORE-09 -->

**Given** Priya's permit `e2…0101` expires 2027-09-23 and she renews in
advance. **When** the desk re-issues against the same holder with the
next window, links the renewal in `extensions` as §14.2 recommends, and
carries a fleet-accounting key the server has never heard of. **Then**
201 with a new AssignedRight whose `extensions` echo both keys, and the
stock read shows them unchanged (tolerant reader, faithful writer).
§14.2 names the link key `apds-ext:apx:permit@1.0` (`PermitExtension`,
`renews`) and `PermitIssueRequest` now declares `extensions` (F-PRM-05
fixed). The vendored APDS `AssignedRight` still declares no container,
so the response validates only because APDS does not forbid extra
properties (upstream; Part 3 §3.3(8) item).

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-natarajan-renew-2027
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2201" },
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2202" }
  ],
  "validity": { "start": "2027-09-24T00:00:00Z", "end": "2028-09-23T23:59:59Z" },
  "extensions": {
    "apds-ext:apx:permit@1.0": {
      "renews": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" }
    },
    "apds-ext:acmecorp:fleet@1.0": { "costCentre": "CC-4471", "poNumber": "PO-2027-0088" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000102",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T15:10:40Z",
  "plannedUses": [
    { "startTime": "2027-09-24T00:00:00Z", "endTime": "2028-09-23T23:59:59Z" }
  ],
  "expiry": "2028-09-23T23:59:59Z",
  "extensions": {
    "apds-ext:apx:permit@1.0": {
      "renews": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" }
    },
    "apds-ext:acmecorp:fleet@1.0": { "costCentre": "CC-4471", "poNumber": "PO-2027-0088" }
  }
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000102 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000102",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T15:10:40Z",
  "plannedUses": [
    { "startTime": "2027-09-24T00:00:00Z", "endTime": "2028-09-23T23:59:59Z" }
  ],
  "expiry": "2028-09-23T23:59:59Z",
  "extensions": {
    "apds-ext:apx:permit@1.0": {
      "renews": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" }
    },
    "apds-ext:acmecorp:fleet@1.0": { "costCentre": "CC-4471", "poNumber": "PO-2027-0088" }
  }
}
```

---

## PRM-08 — The bakery adds a third van: native PUT, stale version first

<!-- apx:scenario PRM-08 kind=lifecycle ics=APX-PRM-01 -->

**Given** Lakeside Bakery's fleet permit `e2…0103` (issued earlier
today with two vans) is at version 2 after the server materialized the
plates. **When** the fleet manager's tool adds `BKR-0003` by writing the
whole AssignedRight back through the native route, first with the
version it cached (1), then with the current one (2). **Then** the APDS
409 in the APDS `ResponseStatus` shape, then 200, and the read shows
version 3 with three vehicles. §14.2c now says vehicles change through
the native PUT, that the allow-list applies to the new van, and that no
pool slot moves (F-PRM-09 fixed). The Part 5 MUST to refuse a stale
version with problem `version-conflict` is still inexpressible on a
native route whose 409 is `ResponseStatus`; that is the cross-cutting
native-error-dialect overlay (A7), not a permits change.

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000103
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000103",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000203", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000311", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000312", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000313", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T09:30:00Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "Assigned right can not be updated: version 1 is stale, current version is 2.",
  "ids": [ "e2000000-0000-4000-8000-000000000103" ]
}
```

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000103
APX-Update-Mode: full
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000103",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000203", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000311", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000312", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000313", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T09:30:00Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
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
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000203", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000311", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000312", "className": "CredentialRecord" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000313", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T09:30:00Z",
  "plannedUses": [
    { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
  ],
  "expiry": "2027-09-23T23:59:59Z"
}
```

---

## PRM-09 — The bakery closes: cancel the permit, and the pool gets a slot back

<!-- apx:scenario PRM-09 kind=lifecycle ics=APX-PRM-01,APX-PRM-02 -->

**Given** the bakery shuts in October and asks for a pro-rated refund.
**When** the desk cancels the fleet permit. **Then** cancellation is the
native APDS `DELETE`, which answers in the APDS shape; the pool
afterwards shows one more available, as §14.2c requires, and the refund
finds its payment through the AssignedRight's native `payments[]`
`transactionID` (F-PRM-08 fixed; no dedicated cancel route was added).

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Assigned right deleted successfully.",
  "ids": [ "e2000000-0000-4000-8000-000000000103" ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000103 -->
<!-- apx:response 404 -->
```json
{
  "status": "error",
  "code": 404,
  "message": "Assigned right not found.",
  "ids": [ "e2000000-0000-4000-8000-000000000103" ]
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "capacity": 120,
  "issued": 119,
  "available": 1
}
```

---

## PRM-10 — A permit that has not started yet, seen from the entry lane

<!-- apx:scenario PRM-10 kind=lifecycle ics=APX-PRM-01,APX-PRM-02 -->

**Given** the slot freed in PRM-09 goes to Marcus Bell from the waitlist,
starting 1 October. **When** the desk issues it on 24 September and
Marcus drives in the same evening, the entry lane runs its stock APDS
query for the plate bounded by now. **Then** 201, an empty list at the
lane (denied: not yet valid), and on 1 October the same query returns
the right. The lane matches the plate string while the AssignedRight
carries a CredentialRecord reference; §14.2b now requires the server to
resolve `credential_id` against the identification string whichever
identifier form it materialized (F-PRM-06 fixed).

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-bell-from-waitlist
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "MBL-7710" }
  ],
  "validity": { "start": "2026-10-01T00:00:00Z", "end": "2027-09-30T23:59:59Z" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000104",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "rightHolder": {
    "credentials": [
      { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" } },
      { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000321", "className": "CredentialRecord" } }
    ]
  },
  "issueMethod": "permit",
  "issuanceTime": "2026-09-24T16:02:00Z",
  "plannedUses": [
    { "startTime": "2026-10-01T00:00:00Z", "endTime": "2027-09-30T23:59:59Z" }
  ],
  "expiry": "2027-09-30T23:59:59Z"
}
```

The entry lane, 24 September 18:02 UTC (stock APDS):

<!-- apx:request GET /rights/assigned?place=b1000000-0000-4000-8000-000000000001&credential_type=licensePlate&credential_id=MBL-7710&start_before=2026-09-24T18:02:00Z&end_after=2026-09-24T18:02:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272920, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

The same lane, 1 October 07:15 UTC:

<!-- apx:request GET /rights/assigned?place=b1000000-0000-4000-8000-000000000001&credential_type=licensePlate&credential_id=MBL-7710&start_before=2026-10-01T07:15:00Z&end_after=2026-10-01T07:15:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790838900, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e2000000-0000-4000-8000-000000000104",
      "version": 1,
      "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
      "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "rightHolder": {
        "credentials": [
          { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" } },
          { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000321", "className": "CredentialRecord" } }
        ]
      },
      "issueMethod": "permit",
      "issuanceTime": "2026-09-24T16:02:00Z",
      "plannedUses": [
        { "startTime": "2026-10-01T00:00:00Z", "endTime": "2027-09-30T23:59:59Z" }
      ],
      "expiry": "2027-09-30T23:59:59Z"
    }
  ]
}
```

---

## PRM-11 — Malformed issue: no holder, and a credential type the spec does not allow

<!-- apx:scenario PRM-11 kind=refusal ics=APX-PRM-01 -->

**Given** a portal integration under development. **When** it posts an
issue with no `holder`, and another with an `rfid` credential against a
RightSpecification whose `credentials` list allows only `licensePlate`.
**Then** the first is the declared 400 `invalid-request`; the second is
422 `request-unprocessable` naming the allow-list rule (§14.2a(5);
F-PRM-02, F-PRM-03 fixed). `credentialType` stays a free string in the
schema — narrowing it to `CredentialTypeEnum` would break existing
clients — and a non-enum value is 400 `invalid-request` by the
§14.2a(1) field rule, as the third attempt shows.

```http
POST /v1/permits/issue
Idempotency-Key: portal-20260924-0003
```

<!-- apx:request POST /v1/permits/issue invalid -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2201" }
  ]
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Request body invalid",
  "status": 400,
  "detail": "PermitIssueRequest requires holder.",
  "instance": "/v1/permits/issue"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: portal-20260924-0004
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "rfid", "credentialIdentification": "C-0090114" }
  ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Credential type not allowed by the RightSpecification",
  "status": 422,
  "detail": "RightSpecification e1000000-0000-4000-8000-000000000010 v3 allows credentials [licensePlate]; rfid is not among them.",
  "instance": "/v1/permits/issue"
}
```

```http
POST /v1/permits/issue
Idempotency-Key: portal-20260924-0005
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licencePlate", "credentialIdentification": "MBL-7710" }
  ]
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "credentialType licencePlate is not an APDS CredentialTypeEnum value.",
  "instance": "/v1/permits/issue",
  "errors": [ { "pointer": "/credentials/0/credentialType", "detail": "not a CredentialTypeEnum value" } ]
}
```

---

## PRM-12 — A plate that is already on someone else's active permit

<!-- apx:scenario PRM-12 kind=edge ics=APX-PRM-01 -->

**Given** Priya sold `PRY-2202` to Marcus and did not tell the garage.
**When** Marcus's permit is issued with that plate while Priya's `e2…0101`
still carries it. **Then** Lakeside's policy is one plate, one permit,
so it refuses with 409 `credential-identification-in-use`, which §14.2a(6)
licenses whether or not the server claims `apx-credentials` (F-PRM-03
fixed); a server that allows the plate on two permits says so in its
ICS.

```http
POST /v1/permits/issue
Idempotency-Key: desk-20260924-bell-second-car
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" },
  "credentials": [
    { "credentialType": "licensePlate", "credentialIdentification": "MBL-7710" },
    { "credentialType": "licensePlate", "credentialIdentification": "PRY-2202" }
  ],
  "validity": { "start": "2026-10-01T00:00:00Z", "end": "2027-09-30T23:59:59Z" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/credential-identification-in-use",
  "title": "Credential identification already in use",
  "status": 409,
  "detail": "licensePlate PRY-2202 is an active credential on AssignedRight e2000000-0000-4000-8000-000000000101 (holder c1000000-0000-4000-8000-000000000201) until 2027-09-23T23:59:59Z.",
  "instance": "/v1/permits/issue"
}
```

---

## PRM-13 — What the fabric says when a permit is issued

<!-- apx:scenario PRM-13 kind=happy ics=APX-PRM-01 -->

**Given** a subscriber on the native `AssignedRightCreated` topic (the
permit profile adds no topic of its own). **When** PRM-01's permit is
issued. **Then** one envelope with the AssignedRight as `data`. Part 8
says `data` is the APDS `EventData` shape, but the bundle does not carry
`EventData` or `EventTypeEnum`, so the closest checkable statement is
"data is an AssignedRight" (F-PRM-11, owned by apx-events). §14.2c now
names `apx.permits.pool.availability.v1` for pool-count changes
(F-PRM-10; the `apx-topics` registry entry is pending). The subscriber's
first 2xx is lost and the delivery is retried two seconds later with
the identical envelope (same `id`, Part 8 §8.2): the envelope is checked
on the first delivery and its `data` on the retry.

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  "type": "AssignedRightCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
  "time": "2026-09-24T14:05:12Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000101",
    "version": 1,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
    "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "rightHolder": {
      "credentials": [
        { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
        { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
        { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
      ]
    },
    "issueMethod": "permit",
    "issuanceTime": "2026-09-24T14:05:12Z",
    "plannedUses": [
      { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
    ],
    "expiry": "2027-09-23T23:59:59Z"
  }
}
```

The retry, `APX-Delivery-Id` new, envelope unchanged:

<!-- apx:validate AssignedRight at /data -->
```json
{
  "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  "type": "AssignedRightCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000101", "className": "AssignedRight" },
  "time": "2026-09-24T14:05:12Z",
  "data": {
    "id": "e2000000-0000-4000-8000-000000000101",
    "version": 1,
    "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
    "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "rightHolder": {
      "credentials": [
        { "credentialAssignedType": "customer", "type": "permit", "identifier": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" } },
        { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000301", "className": "CredentialRecord" } },
        { "credentialAssignedType": "vehicle", "type": "licensePlate", "identifier": { "id": "d6000000-0000-4000-8000-000000000302", "className": "CredentialRecord" } }
      ]
    },
    "issueMethod": "permit",
    "issuanceTime": "2026-09-24T14:05:12Z",
    "plannedUses": [
      { "startTime": "2026-09-24T00:00:00Z", "endTime": "2027-09-23T23:59:59Z" }
    ],
    "expiry": "2027-09-23T23:59:59Z"
  }
}
```

---

## PRM-14 — One RightSpecification, two pools: which one is "availability"?

<!-- apx:scenario PRM-14 kind=edge ics=APX-PRM-01 -->

**Given** Lakeside's Q4 monthly spec `e1…0012` carries one RightPool
for October (80 issued of 100) and one for November (12 of 100), the
way APDS models per-period pools. **When** the sales portal asks
availability with no period, then with `at=` for November, then by
`pool` id. **Then** the first answer is the pool whose validity contains
now (October), the second and third are November, and each names the
selected `pool` and its `validity`; `capacity` is
`distributedAssignedRights + availableAssignedRights` of that pool
(§14.2; F-PRM-12 fixed).

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000012 -->
<!-- apx:response 200 -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000012",
  "version": 2,
  "description": [ { "language": "en", "string": "Lakeside monthly permit — Q4 2026" } ],
  "type": "permitParking",
  "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "transferable": false,
  "credentials": [ "licensePlate" ],
  "hierarchyElements": [ { "id": "b1000000-0000-4000-8000-000000000001", "version": 4, "className": "Place" } ],
  "validity": { "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-11-30T23:59:59Z" } },
  "rightPools": [
    {
      "id": "e4000000-0000-4000-8000-000000000121",
      "version": 1,
      "assignedRightsIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "distributedAssignedRights": 80,
      "availableAssignedRights": 20,
      "validity": { "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-10-31T23:59:59Z" } }
    },
    {
      "id": "e4000000-0000-4000-8000-000000000122",
      "version": 1,
      "assignedRightsIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "distributedAssignedRights": 12,
      "availableAssignedRights": 88,
      "validity": { "validityTimeSpecification": { "overallStartTime": "2026-11-01T00:00:00Z", "overallEndTime": "2026-11-30T23:59:59Z" } }
    }
  ]
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000012/availability -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000012", "version": 2, "className": "RightSpecification" },
  "pool": { "id": "e4000000-0000-4000-8000-000000000121", "version": 1, "className": "RightPool" },
  "validity": { "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-10-31T23:59:59Z" } },
  "capacity": 100,
  "issued": 80,
  "available": 20
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000012/availability?at=2026-11-01T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000012", "version": 2, "className": "RightSpecification" },
  "pool": { "id": "e4000000-0000-4000-8000-000000000122", "version": 1, "className": "RightPool" },
  "validity": { "validityTimeSpecification": { "overallStartTime": "2026-11-01T00:00:00Z", "overallEndTime": "2026-11-30T23:59:59Z" } },
  "capacity": 100,
  "issued": 12,
  "available": 88
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000012/availability?pool=e4000000-0000-4000-8000-000000000122 -->
<!-- apx:response 200 -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000012", "version": 2, "className": "RightSpecification" },
  "pool": { "id": "e4000000-0000-4000-8000-000000000122", "version": 1, "className": "RightPool" },
  "validity": { "validityTimeSpecification": { "overallStartTime": "2026-11-01T00:00:00Z", "overallEndTime": "2026-11-30T23:59:59Z" } },
  "capacity": 100,
  "issued": 12,
  "available": 88
}
```

---

## PRM-15 — Midnight renewal batch: throttled, then a dead token

<!-- apx:scenario PRM-15 kind=edge ics=APX-CORE-05 -->

**Given** a permit portal renews 400 permits in a burst at 00:00.
**When** it exceeds the write rate limit, and later keeps going on an
expired token. **Then** 429 with `Retry-After` on both operations and
401 on both, all declared, with problem type `unauthenticated`
(F-PRM-04 fixed).

```http
POST /v1/permits/issue
Idempotency-Key: portal-20261001-renew-0217
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000201", "className": "RightHolder" },
  "validity": { "start": "2027-09-24T00:00:00Z", "end": "2028-09-23T23:59:59Z" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/permits/issue"
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability"
}
```

```http
POST /v1/permits/issue
Authorization: Bearer <expired>
Idempotency-Key: portal-20261001-renew-0218
```

<!-- apx:request POST /v1/permits/issue -->
```json
{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000010", "version": 3, "className": "RightSpecification" },
  "holder": { "id": "c1000000-0000-4000-8000-000000000202", "className": "RightHolder" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-01T00:00:00Z.",
  "instance": "/v1/permits/issue"
}
```

<!-- apx:request GET /v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-01T00:00:00Z.",
  "instance": "/v1/permits/pools/e1000000-0000-4000-8000-000000000010/availability"
}
```
