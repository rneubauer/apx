# apx-tolling — vetting scenarios

<!-- apx:module apx-tolling tag=Tolling ics=TOL -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-tolling`. Gaps the spec cannot express are marked
`gap=F-TOL-NN` and explained in `findings.md`.

**Cast.** Lakeside Harbor Crossing is the tolled access road Lakeside
Garage's operator (`a1…0001`) runs into the garage complex: no barriers,
one gantry `hc-01` (`b4…0001`, a SupplementalEquipment under place
`b1…0001`) that reads transponders and plates and bills to an account on
file. Harbor Deck (`b1…0002`) is a different operator's estate; its bridge
gantry `b4…0002` is outside the token's grant. Reads arrive first as
native APDS Observations (`f2…08xx`); toll transactions are `e9…08xx`;
settling PaymentRecords are `9c0d…19xx`. The monthly holder whose plate
gets misread is `c1…0221` (RightHolder). Actors in the audit trail:
`gantry-hc-01`, `toll-pricing`, `billing-batch`, `agent-0219` (call
center), `backoffice-jlee`.

Every request carries `Authorization: Bearer …` with scope
`apx.tolling:manage` and `apx_places: ["b1…0001"]` unless the scenario
says otherwise. Requests that create a transaction send the create shape;
`id`, `version`, `transactionStatus`, and `statusHistory` are
server-assigned. Timestamps are RFC 3339 UTC.

---

## TOL-01 — 07:14, a transponder passes the gantry

<!-- apx:scenario TOL-01 kind=happy ics=APX-TOL-01,APX-CORE-03 -->

**Given** gantry `hc-01` ingested a transponder hit and a plate read as
two Observations. **When** the gantry bridge posts a toll transaction
that references both, the credential, and the flat 2-axle peak price,
under a key derived from the gantry, the read time, and its sequence
number. **Then** 201 with the transaction already `priced` (pricing is
synchronous here), a two-entry audit trail, and
`apx.tolling.transaction.created.v1` published with the transaction as
`data`.

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T071408-0417
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000801",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing", "detail": "peak weekday rate, 2-axle" }
  ]
}
```

The event the warehouse subscription receives:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  "type": "apx.tolling.transaction.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000801", "className": "TollTransaction" },
  "time": "2026-09-22T07:14:09Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000801",
    "version": 2,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "observations": [
      { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
      { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
    ],
    "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
    "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
    "transactionStatus": "priced",
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
      { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing", "detail": "peak weekday rate, 2-axle" }
    ]
  }
}
```

---

## TOL-02 — The uplink flapped: the gantry re-sends the same read

<!-- apx:scenario TOL-02 kind=edge ics=APX-TOL-01 -->

**Given** the 201 from TOL-01 never reached the gantry bridge, and the
bridge re-sends everything it buffered once the uplink returns. **When**
the identical body arrives under the identical key, a minute later.
**Then** 200 with the transaction the key created, `e9…0801`, in its
current representation (still version 2 here): not a new transaction,
not a second charge (Part 4 §4.2a, §15.2; F-TOL-12 fixed).

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T071408-0417
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000801",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing", "detail": "peak weekday rate, 2-axle" }
  ]
}
```

---

## TOL-03 — Same key, different read

<!-- apx:scenario TOL-03 kind=refusal ics=APX-TOL-01,APX-CORE-05 -->

**Given** a firmware bug in the gantry bridge reuses the sequence number
after a reboot. **When** the 07:52 plate-only passage is posted under the
07:14 key. **Then** 409 `idempotency-conflict`; the second passage is not
recorded and the bridge must re-key it.

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T071408-0417
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key gantry-hc-01-20260922T071408-0417 was first used at 2026-09-22T07:14:09Z for transaction e9000000-0000-4000-8000-000000000801 with a different body.",
  "instance": "/v1/tolling/transactions"
}
```

---

## TOL-04 — Malformed ingests: no key, no toll point, throttled

<!-- apx:scenario TOL-04 kind=refusal ics=APX-TOL-01,APX-CORE-05 -->

**Given** three misbehaving gantry bridges. **When** one posts without
`Idempotency-Key`, one posts a body with no `tollPoint`, and one replays
its whole 40-minute buffer in a burst. **Then** 400
`idempotency-key-required`, 400 `invalid-request` for the invalid
transaction (F-TOL-05 fixed), and 429 with
`Retry-After` so the buffer drains at a rate the server can take.

```http
POST /v1/tolling/transactions
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000812", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-51007" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/tolling/transactions requires an Idempotency-Key header; gantry retries must not double-bill.",
  "instance": "/v1/tolling/transactions"
}
```

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T080102-0533
```

<!-- apx:request POST /v1/tolling/transactions invalid -->
```json
{
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000813", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-51008" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid transaction",
  "status": 400,
  "detail": "tollPoint is required.",
  "instance": "/v1/tolling/transactions"
}
```

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T080104-0534
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000814", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-51009" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Ingest rate for this credential exceeded 120/min; retry after 5 seconds. Buffered reads keep their original keys.",
  "instance": "/v1/tolling/transactions"
}
```

---

## TOL-05 — Settled against the account that night

<!-- apx:scenario TOL-05 kind=happy ics=APX-TOL-01 -->

**Given** the nightly billing run charged the holder's account through
the Part 13 payment surface and holds a PaymentRecord. **When** it
attaches that reference to `e9…0801`. **Then** 200 with the transaction
`paid` at version 3, the history naming the batch, and
`apx.tolling.transaction.status.v1` published. The toll record holds a
reference; it never becomes a parallel ledger.

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-22"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000801",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
  "transactionStatus": "paid",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing", "detail": "peak weekday rate, 2-axle" },
    { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch", "detail": "account autopay, batch 2026-09-22" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000801", "className": "TollTransaction" },
  "time": "2026-09-23T02:11:40Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000801",
    "version": 3,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
    "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
    "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
    "transactionStatus": "paid",
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
      { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing" },
      { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch", "detail": "account autopay, batch 2026-09-22" }
    ]
  }
}
```

---

## TOL-06 — The billing batch re-runs: paying a paid transaction

<!-- apx:scenario TOL-06 kind=refusal ics=APX-TOL-01,APX-TOL-03,APX-CORE-05 -->

**Given** the nightly batch crashed after `e9…0801` was attached and its
restart replays the whole file. **When** it re-sends the same attach with
the same `Idempotency-Key`, then attaches a second, different
PaymentRecord to the transaction already `paid`, then reuses a key with a
different body, then attaches one to an id that never existed. **Then**
200 unchanged for the replay (§15.1; F-TOL-13 fixed), 409
`toll-transition-illegal` for the different payment (F-TOL-03 fixed), 409
`idempotency-conflict` for the reused key, and a declared 404.

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment
Idempotency-Key: autopay-20260922-0801
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-22"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000801",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [
    { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" },
    { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" }
  ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
  "transactionStatus": "paid",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing", "detail": "peak weekday rate, 2-axle" },
    { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch", "detail": "account autopay, batch 2026-09-22" }
  ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1903", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-22 (re-run)"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000801 is paid (PaymentRecord 9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901 attached 2026-09-23T02:11:40Z); payment may be attached only in priced.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment"
}
```

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment
Idempotency-Key: autopay-20260922-0801
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1905", "className": "PaymentRecord" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key autopay-20260922-0801 was first used with PaymentRecord 9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1904", "className": "PaymentRecord" }
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/payment"
}
```

---

## TOL-07 — Pricing is asynchronous: created first, priced later

<!-- apx:scenario TOL-07 kind=lifecycle ics=APX-TOL-01,APX-TOL-03 -->

**Given** an operator whose toll pricing depends on an axle-count
classifier that runs a few seconds behind the gantry, outside the APX
server. **When** the bridge posts the passage without `pricing`, the
classifier prices it through `POST …/{id}/price`, and a retry of the
classifier prices it again. **Then** 201 in `created`; 200 `priced` and
a status event; 409 `toll-transition-illegal` for the second price
(a later change goes through a dispute), and a read shows the price
(§15.1; F-TOL-02 fixed).

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T081530-0601
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000821", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-60311" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000803",
  "version": 1,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000821", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-60311" },
  "transactionStatus": "created",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T08:15:31Z", "actor": "gantry-hc-01" }
  ]
}
```

Four seconds later the classifier reports a 3-axle vehicle:

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price
Idempotency-Key: classifier-0803
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price -->
```json
{
  "pricing": { "currencyType": "USD", "currencyValue": 4.25 },
  "detail": "peak weekday rate, 3-axle (classifier confidence 0.94)"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000803",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000821", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-60311" },
  "pricing": { "currencyType": "USD", "currencyValue": 4.25 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T08:15:31Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T08:15:35Z", "actor": "toll-pricing", "detail": "peak weekday rate, 3-axle (classifier confidence 0.94)" }
  ]
}
```

The classifier's own retry, with a fresh key and a recomputed price:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price -->
```json
{
  "pricing": { "currencyType": "USD", "currencyValue": 4.50 }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000803 is priced; pricing may be set only in created. Change a price through a dispute.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price"
}
```

The status event for the pricing:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000803", "className": "TollTransaction" },
  "time": "2026-09-22T08:15:35Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000803",
    "version": 2,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "observations": [ { "id": "f2000000-0000-4000-8000-000000000821", "className": "Observation" } ],
    "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-60311" },
    "pricing": { "currencyType": "USD", "currencyValue": 4.25 },
    "transactionStatus": "priced",
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T08:15:31Z", "actor": "gantry-hc-01" },
      { "state": "priced", "time": "2026-09-22T08:15:35Z", "actor": "toll-pricing", "detail": "peak weekday rate, 3-axle (classifier confidence 0.94)" }
    ]
  }
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803 -->
<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000803",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000821", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-60311" },
  "pricing": { "currencyType": "USD", "currencyValue": 4.25 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T08:15:31Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T08:15:35Z", "actor": "toll-pricing", "detail": "peak weekday rate, 3-axle (classifier confidence 0.94)" }
  ]
}
```

---

## TOL-08 — 07:52, the passage that was not hers

<!-- apx:scenario TOL-08 kind=happy ics=APX-TOL-02,APX-TOL-01 -->

**Given** a vehicle with no transponder passed at 07:52 and the gantry
fell back to the plate, reading `SYN-9930` at 0.71 confidence; the
transaction was created, priced, and billed to the monthly holder of that
plate. **When** she calls ten days later, three hundred miles from the
crossing, and the agent opens a dispute naming her as `disputedBy`.
**Then** 200 with the transaction `disputed`, the original reads still
referenced, the payment still attached, and a status event. Disputes
are operator-opened, on the holder's behalf here, and `disputedBy` names
the party (§15.1; F-TOL-08 fixed — APX v1 defines no customer scope).

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T075231-0498
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000802",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
    { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" }
  ]
}
```

Billed that night like TOL-05 (PaymentRecord `9c0d…1902`). On 2 October:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes -->
```json
{
  "reason": "wrongVehicle",
  "detail": "Holder was out of state; gantry image shows a silver sedan, holder's vehicle is a black pickup. Plate read confidence 0.71.",
  "disputedBy": { "id": "c1000000-0000-4000-8000-000000000221", "className": "RightHolder" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000802",
  "version": 4,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
  "transactionStatus": "disputed",
  "dispute": {
    "reason": "wrongVehicle",
    "openedTime": "2026-10-02T15:20:11Z"
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
    { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
    { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
    { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219", "detail": "wrongVehicle; holder out of state, image mismatch" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "8d9e0f1a-2b3c-4d4e-8f5a-6b7c8d9e0f1a",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000802", "className": "TollTransaction" },
  "time": "2026-10-02T15:20:11Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000802",
    "version": 4,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
    "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
    "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
    "transactionStatus": "disputed",
    "dispute": { "reason": "wrongVehicle", "openedTime": "2026-10-02T15:20:11Z" },
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
      { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
      { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
      { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219", "detail": "wrongVehicle; holder out of state, image mismatch" }
    ]
  }
}
```

---

## TOL-09 — Image review agrees: refunded

<!-- apx:scenario TOL-09 kind=happy ics=APX-TOL-02 -->

**Given** the back office compared the gantry image with the vehicle on
the holder's account. **When** it resolves the dispute as `refunded`
with a note. **Then** 200 with the transaction `resolved`,
`dispute.resolvedTime` and `dispute.resolution` set, the history entry
naming the reviewer, and the refund itself taken as a Part 13 refund
against the original payment. `refunded` is one of the §15.1 base
resolution codes (F-TOL-10 fixed; registry entry pending).

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes/resolve -->
```json
{
  "resolution": "refunded",
  "note": "Image review: not the holder's vehicle. Refund issued against the original payment; plate read below the 0.85 auto-bill threshold, gantry flagged for recalibration."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000802",
  "version": 5,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
  "transactionStatus": "resolved",
  "dispute": {
    "reason": "wrongVehicle",
    "openedTime": "2026-10-02T15:20:11Z",
    "resolvedTime": "2026-10-03T09:41:02Z",
    "resolution": "refunded"
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
    { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
    { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
    { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219" },
    { "state": "resolved", "time": "2026-10-03T09:41:02Z", "actor": "backoffice-jlee", "detail": "refunded; gantry hc-01 flagged for recalibration" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000802", "className": "TollTransaction" },
  "time": "2026-10-03T09:41:02Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000802",
    "version": 5,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
    "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
    "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
    "transactionStatus": "resolved",
    "dispute": { "reason": "wrongVehicle", "openedTime": "2026-10-02T15:20:11Z", "resolvedTime": "2026-10-03T09:41:02Z", "resolution": "refunded" },
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01" },
      { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
      { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
      { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219" },
      { "state": "resolved", "time": "2026-10-03T09:41:02Z", "actor": "backoffice-jlee", "detail": "refunded; gantry hc-01 flagged for recalibration" }
    ]
  }
}
```

---

## TOL-10 — A stale export tries to reopen the dispute

<!-- apx:scenario TOL-10 kind=refusal ics=APX-TOL-02,APX-CORE-05 -->

**Given** the dispute on `e9…0802` was resolved on 3 October. **When** a
reconciliation job working from a month-old export posts a new dispute on
the same transaction. **Then** 409 `dispute-closed`; the transaction stays
`resolved` and the job is told to raise an adjustment instead. Resolved
is resolved.

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes -->
```json
{ "reason": "wrongVehicle" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/dispute-closed",
  "title": "Dispute closed",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000802 has a dispute resolved 2026-10-03T09:41:02Z as refunded. Raise a new adjustment instead.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes"
}
```

---

## TOL-11 — Resolving what is not open

<!-- apx:scenario TOL-11 kind=refusal ics=APX-TOL-02,APX-CORE-05 -->

**Given** two operator mistakes. **When** the back office resolves
`e9…0802` a second time, and then resolves `e9…0801`, which was paid and
never disputed, and finally resolves an id that does not exist. **Then**
the first is 409 `dispute-closed` (a closed dispute); the second is 409
`toll-transition-illegal`, since resolve is allowed from `disputed` only
(§15.1; F-TOL-03 fixed); the third is the declared 404 (F-TOL-06 fixed).

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes/resolve -->
```json
{ "resolution": "upheld", "note": "second reviewer, duplicate queue item" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/dispute-closed",
  "title": "Dispute closed",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000802: dispute already resolved 2026-10-03T09:41:02Z as refunded.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes/resolve"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/disputes/resolve -->
```json
{ "resolution": "upheld" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000801 is paid and has no dispute to resolve.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/disputes/resolve"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/disputes/resolve -->
```json
{ "resolution": "upheld" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/disputes/resolve"
}
```

---

## TOL-12 — Two agents dispute the same charge, and one disputes a ghost

<!-- apx:scenario TOL-12 kind=refusal ics=APX-TOL-02,APX-CORE-05 -->

**Given** the holder called twice and reached two agents. **When** the
second agent opens a dispute on `e9…0802` while the first one is still
open (before TOL-09), and a third agent mistypes the id. **Then** the
second dispute is 409 `toll-transition-illegal` — a dispute opens from
`priced` or `paid` only (§15.1; F-TOL-03 fixed) — and the mistyped id is
the declared 404 (F-TOL-06 fixed).

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes -->
```json
{
  "reason": "wrongVehicle",
  "detail": "Holder called back; same complaint.",
  "disputedBy": { "id": "c1000000-0000-4000-8000-000000000221", "className": "RightHolder" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000802 already has a dispute open since 2026-10-02T15:20:11Z; add to it or wait for resolution.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/disputes -->
```json
{ "reason": "wrongVehicle" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/disputes"
}
```

---

## TOL-13 — Upheld, and adjusted: the two other resolutions

<!-- apx:scenario TOL-13 kind=lifecycle ics=APX-TOL-02,APX-TOL-03 -->

**Given** two more disputes. A driver disputes `e9…0804` (paid) claiming
the gantry double-read; the image shows one passage and the dispute is
`upheld`, money stays where it is. A haulier disputes `e9…0805`
(priced, unpaid) because the classifier counted a lifted axle; the
back office resolves `adjusted` with `adjustedPricing` at the 2-axle
price. **When** each is resolved and the haulier's account then pays.
**Then** both end `resolved`; the adjusted one carries the new price in
`pricing` and the old one in `dispute.originalPricing`, and — being
unpaid and `adjusted` — accepts the payment and moves to `paid` (§15.1;
F-TOL-11 fixed).

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes -->
```json
{
  "reason": "duplicateCharge",
  "detail": "Driver says he crossed once on 22 Sep and was billed twice.",
  "disputedBy": { "id": "c1000000-0000-4000-8000-000000000222", "className": "RightHolder" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000804",
  "version": 4,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000831", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1905", "className": "PaymentRecord" },
  "transactionStatus": "disputed",
  "dispute": { "reason": "duplicateCharge", "openedTime": "2026-09-24T10:02:40Z" },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T17:40:12Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T17:40:12Z", "actor": "toll-pricing" },
    { "state": "paid", "time": "2026-09-23T02:11:44Z", "actor": "billing-batch" },
    { "state": "disputed", "time": "2026-09-24T10:02:40Z", "actor": "agent-0219", "detail": "duplicateCharge" }
  ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes/resolve -->
```json
{
  "resolution": "upheld",
  "note": "Two passages 17:40 and 18:55 on the gantry log, both with images of the same vehicle; the other charge is e9…0809. Charge stands."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000804",
  "version": 5,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000831", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1905", "className": "PaymentRecord" },
  "transactionStatus": "resolved",
  "dispute": {
    "reason": "duplicateCharge",
    "openedTime": "2026-09-24T10:02:40Z",
    "resolvedTime": "2026-09-24T14:15:03Z",
    "resolution": "upheld"
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T17:40:12Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T17:40:12Z", "actor": "toll-pricing" },
    { "state": "paid", "time": "2026-09-23T02:11:44Z", "actor": "billing-batch" },
    { "state": "disputed", "time": "2026-09-24T10:02:40Z", "actor": "agent-0219", "detail": "duplicateCharge" },
    { "state": "resolved", "time": "2026-09-24T14:15:03Z", "actor": "backoffice-jlee", "detail": "upheld; two distinct passages on the gantry log" }
  ]
}
```

The haulier's lifted axle:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000805/disputes -->
```json
{
  "reason": "wrongClass",
  "detail": "Tractor unit ran with the tag axle lifted; billed as 3-axle.",
  "disputedBy": { "id": "a2000000-0000-4000-8000-000000000031", "className": "Organisation" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000805",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000841", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-80031" },
  "pricing": { "currencyType": "USD", "currencyValue": 4.25 },
  "transactionStatus": "disputed",
  "dispute": { "reason": "wrongClass", "openedTime": "2026-09-23T08:30:00Z" },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T09:03:50Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T09:03:54Z", "actor": "toll-pricing", "detail": "3-axle (classifier confidence 0.62)" },
    { "state": "disputed", "time": "2026-09-23T08:30:00Z", "actor": "agent-0219", "detail": "wrongClass; fleet account holder" }
  ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000805/disputes/resolve -->
```json
{
  "resolution": "adjusted",
  "adjustedPricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "note": "Image confirms lifted tag axle; repriced at 2-axle."
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000805",
  "version": 4,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000841", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-80031" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "resolved",
  "dispute": {
    "reason": "wrongClass",
    "openedTime": "2026-09-23T08:30:00Z",
    "resolvedTime": "2026-09-23T11:05:19Z",
    "resolution": "adjusted",
    "disputedBy": { "id": "a2000000-0000-4000-8000-000000000031", "className": "Organisation" },
    "originalPricing": { "currencyType": "USD", "currencyValue": 4.25 }
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T09:03:50Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T09:03:54Z", "actor": "toll-pricing", "detail": "3-axle (classifier confidence 0.62)" },
    { "state": "disputed", "time": "2026-09-23T08:30:00Z", "actor": "agent-0219", "detail": "wrongClass; fleet account holder" },
    { "state": "resolved", "time": "2026-09-23T11:05:19Z", "actor": "backoffice-jlee", "detail": "adjusted; pricing 4.25 -> 2.75 (2-axle)" }
  ]
}
```

That night's billing batch settles the adjusted amount:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000805/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1907", "className": "PaymentRecord" },
  "note": "fleet autopay, batch 2026-09-23"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000805",
  "version": 5,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000841", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-80031" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1907", "className": "PaymentRecord" },
  "transactionStatus": "paid",
  "dispute": {
    "reason": "wrongClass",
    "openedTime": "2026-09-23T08:30:00Z",
    "resolvedTime": "2026-09-23T11:05:19Z",
    "resolution": "adjusted",
    "disputedBy": { "id": "a2000000-0000-4000-8000-000000000031", "className": "Organisation" },
    "originalPricing": { "currencyType": "USD", "currencyValue": 4.25 }
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T09:03:50Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T09:03:54Z", "actor": "toll-pricing", "detail": "3-axle (classifier confidence 0.62)" },
    { "state": "disputed", "time": "2026-09-23T08:30:00Z", "actor": "agent-0219", "detail": "wrongClass; fleet account holder" },
    { "state": "resolved", "time": "2026-09-23T11:05:19Z", "actor": "backoffice-jlee", "detail": "adjusted; pricing 4.25 -> 2.75 (2-axle)" },
    { "state": "paid", "time": "2026-09-24T02:10:12Z", "actor": "billing-batch", "detail": "fleet autopay, batch 2026-09-23" }
  ]
}
```

---

## TOL-14 — Voided: terminal

<!-- apx:scenario TOL-14 kind=lifecycle ics=APX-TOL-02,APX-TOL-01,APX-TOL-03 -->

**Given** gantry `hc-01` produced a read during a maintenance test with
the operator's own service truck, and the transaction `e9…0806` must not
be billed. **When** the back office voids it through
`POST …/{id}/void`, then voids it again, then a clerk disputes it and
the batch tries to pay it. **Then** 200 `voided` and a status event
(F-TOL-01 fixed); the second void, the dispute, and the payment are all
409 `toll-transition-illegal` — a voided transaction never had a
dispute, so `dispute-closed` does not apply (§15.1; F-TOL-09 fixed).

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/void
Idempotency-Key: backoffice-void-0806
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/void -->
```json
{ "reason": "exemptVehicle", "note": "maintenance test passage, operator service vehicle" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000806",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000851", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "LKS-SVC1" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "voided",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T11:02:17Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T11:02:17Z", "actor": "toll-pricing" },
    { "state": "voided", "time": "2026-09-22T11:20:00Z", "actor": "backoffice-jlee", "detail": "exemptVehicle: maintenance test passage, operator service vehicle" }
  ]
}
```

A second reviewer, working the same queue item under a new key:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/void -->
```json
{ "reason": "exemptVehicle" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000806 is already voided; void is allowed from created or priced.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/void"
}
```

A paid charge cannot be voided either; it is refunded through a dispute:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000801 is paid; open a dispute and resolve it refunded.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/void"
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "0f1a2b3c-4d5e-4f6a-8b7c-8d9e0f1a2b3c",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e9000000-0000-4000-8000-000000000806", "className": "TollTransaction" },
  "time": "2026-09-22T11:20:00Z",
  "data": {
    "id": "e9000000-0000-4000-8000-000000000806",
    "version": 3,
    "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
    "observations": [ { "id": "f2000000-0000-4000-8000-000000000851", "className": "Observation" } ],
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "LKS-SVC1" },
    "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
    "transactionStatus": "voided",
    "statusHistory": [
      { "state": "created", "time": "2026-09-22T11:02:17Z", "actor": "gantry-hc-01" },
      { "state": "priced", "time": "2026-09-22T11:02:17Z", "actor": "toll-pricing" },
      { "state": "voided", "time": "2026-09-22T11:20:00Z", "actor": "backoffice-jlee", "detail": "exemptVehicle: maintenance test passage, operator service vehicle" }
    ]
  }
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806 -->
<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000806",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000851", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "LKS-SVC1" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "voided",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T11:02:17Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-22T11:02:17Z", "actor": "toll-pricing" },
    { "state": "voided", "time": "2026-09-22T11:20:00Z", "actor": "backoffice-jlee", "detail": "exemptVehicle: maintenance test passage, operator service vehicle" }
  ]
}
```

A week later a fleet clerk, working from the plate list, disputes it:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/disputes -->
```json
{ "reason": "wrongVehicle", "detail": "LKS-SVC1 is a service vehicle and should not be tolled." }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000806 is voided (2026-09-22T11:20:00Z); voided is terminal and cannot be disputed.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/disputes"
}
```

Attaching a payment to it is equally illegal:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1906", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-22"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/toll-transition-illegal",
  "title": "Toll transaction transition illegal",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000806 is voided; payment may be attached only in priced.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000806/payment"
}
```

---

## TOL-15 — The call center looks up a plate; the back office pages through disputes

<!-- apx:scenario TOL-15 kind=happy ics=APX-TOL-01,APX-TOL-02 -->

**Given** the holder on the phone gives her plate. **When** the agent
lists paid transactions for `SYN-9930`, and later the back office pages
through everything in `disputed`. **Then** the APDS `{meta, data}`
envelope with the plate's transactions, and page 2 of the dispute queue.

<!-- apx:request GET /v1/tolling/transactions?plate=SYN-9930&status=paid -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790852400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e9000000-0000-4000-8000-000000000802",
      "version": 3,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
      "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
      "transactionStatus": "paid",
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
        { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
        { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/tolling/transactions?status=disputed&page=2 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790935200, "offset": 100, "pageSize": 100, "total": 101 },
  "data": [
    {
      "id": "e9000000-0000-4000-8000-000000000804",
      "version": 4,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1905", "className": "PaymentRecord" },
      "transactionStatus": "disputed",
      "dispute": { "reason": "duplicateCharge", "openedTime": "2026-09-24T10:02:40Z" },
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T17:40:12Z", "actor": "gantry-hc-01" },
        { "state": "priced", "time": "2026-09-22T17:40:12Z", "actor": "toll-pricing" },
        { "state": "paid", "time": "2026-09-23T02:11:44Z", "actor": "billing-batch" },
        { "state": "disputed", "time": "2026-09-24T10:02:40Z", "actor": "agent-0219", "detail": "duplicateCharge" }
      ]
    }
  ]
}
```

---

## TOL-16 — "Everything at hc-01 between 07:00 and 08:00", and "everything for tag 44192"

<!-- apx:scenario TOL-16 kind=edge ics=APX-TOL-01 -->

**Given** the gantry was flagged for recalibration and the back office
wants every transaction it produced in the morning peak, and separately
the fleet desk wants every charge against transponder `TAG-44192`.
**When** they query by toll point and time window, by transponder, by
place, and with a mistyped status. **Then** the declared `tollPoint`,
`since`/`until`, `credentialType`/`credentialIdentification`, and
`place` filters answer each question, and `status=payed` is 400
`invalid-request` rather than an empty list (§15.2; F-TOL-04 fixed —
`status` keeps its free-string schema, since narrowing it would break
existing clients, and the enum is enforced as a field rule).

<!-- apx:request GET /v1/tolling/transactions?tollPoint=b4000000-0000-4000-8000-000000000001&since=2026-09-22T07:00:00Z&until=2026-09-22T08:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790935200, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "e9000000-0000-4000-8000-000000000801",
      "version": 3,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
      "transactionStatus": "paid",
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
        { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing" },
        { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch" }
      ]
    },
    {
      "id": "e9000000-0000-4000-8000-000000000802",
      "version": 5,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
      "transactionStatus": "resolved",
      "dispute": { "reason": "wrongVehicle", "openedTime": "2026-10-02T15:20:11Z", "resolvedTime": "2026-10-03T09:41:02Z", "resolution": "refunded" },
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01" },
        { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
        { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
        { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219" },
        { "state": "resolved", "time": "2026-10-03T09:41:02Z", "actor": "backoffice-jlee" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/tolling/transactions?credentialType=rfid&credentialIdentification=TAG-44192 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790935200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e9000000-0000-4000-8000-000000000801",
      "version": 3,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
      "transactionStatus": "paid",
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T07:14:09Z", "actor": "gantry-hc-01" },
        { "state": "priced", "time": "2026-09-22T07:14:09Z", "actor": "toll-pricing" },
        { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch" }
      ]
    }
  ]
}
```

---

## TOL-17 — Read one transaction, with provenance; read one that is not there

<!-- apx:scenario TOL-17 kind=happy ics=APX-TOL-01,APX-CORE-03 -->

**Given** an auditor with the transaction id from a customer letter.
**When** they read `e9…0802` and then a mistyped id. **Then** the full
resource with `recordInfo` and the untruncated audit trail, and 404
`target-not-found`.

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802 -->
<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000802",
  "version": 5,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000811", "className": "Observation" } ],
  "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-9930" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1902", "className": "PaymentRecord" },
  "transactionStatus": "resolved",
  "dispute": {
    "reason": "wrongVehicle",
    "openedTime": "2026-10-02T15:20:11Z",
    "resolvedTime": "2026-10-03T09:41:02Z",
    "resolution": "refunded"
  },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T07:52:31Z", "actor": "gantry-hc-01", "detail": "plate fallback, confidence 0.71" },
    { "state": "priced", "time": "2026-09-22T07:52:31Z", "actor": "toll-pricing" },
    { "state": "paid", "time": "2026-09-23T02:11:41Z", "actor": "billing-batch" },
    { "state": "disputed", "time": "2026-10-02T15:20:11Z", "actor": "agent-0219" },
    { "state": "resolved", "time": "2026-10-03T09:41:02Z", "actor": "backoffice-jlee", "detail": "refunded; gantry hc-01 flagged for recalibration" }
  ],
  "recordInfo": {
    "creationTime": "2026-09-22T07:52:31Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "gantry-hc-01",
    "lastUpdate": "2026-10-03T09:41:02Z",
    "lastUpdateUser": "backoffice-jlee"
  }
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff"
}
```

---

## TOL-18 — A BI token, a data token, and an LPR token try the toll routes

<!-- apx:scenario TOL-18 kind=security ics=APX-CORE-07,APX-CORE-05 -->

**Given** three tokens that are not `apx.tolling:manage`: the warehouse's
`apx.data:read`, the gantry's own `apx.lpr:write`, and the payment
service's `apx.payments:write`. **When** the first lists transactions,
the second posts one, and the third attaches a payment. **Then** 403
`insufficient-scope` each time: the module has one scope and every
route requires it. Plate values leave the server only under a tolling,
LPR, violations, or accounts scope (Part 9 §9.6), which is why the list
is refused rather than minimized.

```http
GET /v1/tolling/transactions?plate=SYN-9930
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/tolling/transactions?plate=SYN-9930 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/tolling/transactions requires scope apx.tolling:manage; token carries apx.data:read.",
  "instance": "/v1/tolling/transactions"
}
```

```http
POST /v1/tolling/transactions
Authorization: Bearer <apx.lpr:write only>
Idempotency-Key: gantry-hc-01-20260922T090011-0620
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000861", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions requires scope apx.tolling:manage; token carries apx.lpr:write.",
  "instance": "/v1/tolling/transactions"
}
```

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment
Authorization: Bearer <apx.payments:write only>
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1907", "className": "PaymentRecord" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions/{id}/payment requires scope apx.tolling:manage; token carries apx.payments:write.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment"
}
```

---

## TOL-19 — Harbor Deck's gantry, and a token with no places at all

<!-- apx:scenario TOL-19 kind=security ics=APX-CORE-07,APX-CORE-08 -->

**Given** a misconfigured bridge at Harbor Deck's bridge gantry `b4…0002`
pointed at Lakeside's APX endpoint with Lakeside's credential (grant
`apx_places: ["b1…0001"]`), and a second Lakeside token issued with no
`apx_places` claim. **When** the bridge posts a passage, and the second
token lists transactions. **Then** 403 `insufficient-grant` because the
toll point is outside the grant, and an empty list because an absent
claim means no places (fail-closed), not all places.

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hd-02-20260922T071500-0001
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000871", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-90001" },
  "pricing": { "currencyType": "USD", "currencyValue": 3.5 }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Toll point b4000000-0000-4000-8000-000000000002 belongs to place b1000000-0000-4000-8000-000000000002, which is not in this token's apx_places grant.",
  "instance": "/v1/tolling/transactions"
}
```

```http
GET /v1/tolling/transactions?status=priced
Authorization: Bearer <apx.tolling:manage, no apx_places claim>
```

<!-- apx:request GET /v1/tolling/transactions?status=priced -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790935200, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## TOL-20 — Throttled, then the token dies

<!-- apx:scenario TOL-20 kind=edge ics=APX-CORE-05,APX-CORE-06 -->

**Given** a back-office reconciliation job that lists and attaches
payments in a tight loop, on a token that expires at midnight. **When**
it exceeds the rate limit, and later keeps going on the expired token.
**Then** 429 with `Retry-After` on the list and payment routes, and 401
on create, list, and payment, with problem type `unauthenticated`
(F-TOL-07 fixed).

```http
GET /v1/tolling/transactions?status=priced
→ 429, Retry-After: 2
```

<!-- apx:request GET /v1/tolling/transactions?status=priced -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/tolling/transactions"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1907", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-23"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 2 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment"
}
```

After midnight, on the expired token:

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260925T000210-0002
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000881", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 1.75 }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T00:00:00Z.",
  "instance": "/v1/tolling/transactions"
}
```

<!-- apx:request GET /v1/tolling/transactions?status=priced -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T00:00:00Z.",
  "instance": "/v1/tolling/transactions"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment -->
```json
{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1907", "className": "PaymentRecord" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment"
}
```

---

## TOL-21 — The gantry's own telemetry rides along in `extensions`

<!-- apx:scenario TOL-21 kind=edge ics=APX-CORE-04,APX-TOL-01 -->

**Given** the gantry vendor records lane, speed, and axle count under
its own extension key. **When** the bridge sends them on the create and
the back office reads the transaction later. **Then** the key is
preserved verbatim on the round-trip; the server neither validates nor
strips what it does not understand.

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260924T063012-0710
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000891", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "extensions": {
    "apds-ext:gantryco:passage@1.2": { "lane": 2, "speedKph": 47, "axles": 2, "classifierModel": "axl-3.1" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000807",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000891", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-24T06:30:13Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-24T06:30:13Z", "actor": "toll-pricing" }
  ],
  "extensions": {
    "apds-ext:gantryco:passage@1.2": { "lane": 2, "speedKph": 47, "axles": 2, "classifierModel": "axl-3.1" }
  }
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000807 -->
<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000807",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000891", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-24T06:30:13Z", "actor": "gantry-hc-01" },
    { "state": "priced", "time": "2026-09-24T06:30:13Z", "actor": "toll-pricing" }
  ],
  "extensions": {
    "apds-ext:gantryco:passage@1.2": { "lane": 2, "speedKph": 47, "axles": 2, "classifierModel": "axl-3.1" }
  }
}
```

---

## TOL-22 — Same passage, fresh key: the duplicate the idempotency key cannot catch

<!-- apx:scenario TOL-22 kind=edge ics=APX-TOL-01,APX-TOL-02 -->

**Given** the gantry rebooted mid-buffer and re-ingested the 18:55
passage of `TAG-70220` as new Observations under a new sequence number.
**When** the bridge posts it. **Then** 201: a second transaction
`e9…0809` for one crossing, because the key is new and the server has no
rule for "same credential, same toll point, within N seconds". The
operator catches it in reconciliation and disputes its own transaction
as `duplicateCharge` before billing, `disputedBy` its own Organisation —
an operator-initiated dispute, which §15.1 now allows (F-TOL-08 fixed).
The cleaner outcome, a void before billing, is TOL-23 (F-TOL-01 fixed).

```http
POST /v1/tolling/transactions
Idempotency-Key: gantry-hc-01-20260922T185502-0002
```

<!-- apx:request POST /v1/tolling/transactions -->
```json
{
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000833", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000809",
  "version": 2,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000833", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "priced",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T19:03:40Z", "actor": "gantry-hc-01", "detail": "buffered read, gantry reboot 18:58" },
    { "state": "priced", "time": "2026-09-22T19:03:40Z", "actor": "toll-pricing" }
  ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes -->
```json
{
  "reason": "duplicateCharge",
  "detail": "Same tag, same gantry, 18:55:02 twice: observations f2…0832 (e9…0810) and f2…0833 re-ingested after reboot. Operator-initiated.",
  "disputedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000809",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000833", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70220" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "disputed",
  "dispute": { "reason": "duplicateCharge", "openedTime": "2026-09-23T01:30:00Z" },
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T19:03:40Z", "actor": "gantry-hc-01", "detail": "buffered read, gantry reboot 18:58" },
    { "state": "priced", "time": "2026-09-22T19:03:40Z", "actor": "toll-pricing" },
    { "state": "disputed", "time": "2026-09-23T01:30:00Z", "actor": "reconciliation-job", "detail": "duplicateCharge; operator-initiated, held from billing batch" }
  ]
}
```

---

## TOL-23 — The reboot duplicate, voided before billing

<!-- apx:scenario TOL-23 kind=lifecycle ics=APX-TOL-01,APX-TOL-03 -->

**Given** the same reboot produced a second duplicate, `e9…0811`, which
reconciliation catches before it is disputed or billed. **When** the job
voids it with reason `duplicate`, then looks for everything else the
gantry produced during the reboot window at Lakeside, and mistypes a
status. **Then** 200 `voided` (§15.1; F-TOL-01 fixed), the list answers
by `place` and window, and `status=payed` is 400 `invalid-request`
(F-TOL-04). A void body without `reason` is 400, a void on an unknown id
is 404.

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000811/void
Idempotency-Key: recon-20260923-void-0811
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000811/void -->
```json
{ "reason": "duplicate", "note": "re-ingested after gantry reboot 18:58; original is e9…0810" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000811",
  "version": 3,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
  "observations": [ { "id": "f2000000-0000-4000-8000-000000000834", "className": "Observation" } ],
  "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70221" },
  "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
  "transactionStatus": "voided",
  "statusHistory": [
    { "state": "created", "time": "2026-09-22T19:03:41Z", "actor": "gantry-hc-01", "detail": "buffered read, gantry reboot 18:58" },
    { "state": "priced", "time": "2026-09-22T19:03:41Z", "actor": "toll-pricing" },
    { "state": "voided", "time": "2026-09-23T01:31:10Z", "actor": "reconciliation-job", "detail": "duplicate: re-ingested after gantry reboot 18:58" }
  ]
}
```

<!-- apx:request GET /v1/tolling/transactions?place=b1000000-0000-4000-8000-000000000001&since=2026-09-22T18:55:00Z&until=2026-09-22T19:05:00Z&status=voided -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790935200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e9000000-0000-4000-8000-000000000811",
      "version": 3,
      "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
      "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-70221" },
      "pricing": { "currencyType": "USD", "currencyValue": 2.75 },
      "transactionStatus": "voided",
      "statusHistory": [
        { "state": "created", "time": "2026-09-22T19:03:41Z", "actor": "gantry-hc-01" },
        { "state": "priced", "time": "2026-09-22T19:03:41Z", "actor": "toll-pricing" },
        { "state": "voided", "time": "2026-09-23T01:31:10Z", "actor": "reconciliation-job" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/tolling/transactions?status=payed -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "status must be one of created, priced, paid, disputed, resolved, voided.",
  "instance": "/v1/tolling/transactions",
  "errors": [ { "pointer": "/query/status", "detail": "unknown value payed" } ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void invalid -->
```json
{ "note": "no reason given" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/void"
}
```

The external classifier from TOL-07 prices an id that does not exist,
and sends a price with no amount:

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/price -->
```json
{ "pricing": { "currencyType": "USD", "currencyValue": 4.25 } }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No toll transaction e9000000-0000-4000-8000-0000000008ff.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-0000000008ff/price"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000813/price invalid -->
```json
{ "detail": "3-axle" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "pricing is required.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000813/price",
  "errors": [ { "pointer": "/pricing", "detail": "required" } ]
}
```

---

## TOL-24 — The shared responses on the remaining toll routes

<!-- apx:scenario TOL-24 kind=edge ics=APX-CORE-05,APX-CORE-06,APX-CORE-07 -->

**Given** the reconciliation job of TOL-20 (throttled, then on an
expired token), a BI token with no `apx.tolling:manage`, and a buggy
client. **When** each hits the routes earlier scenarios did not. **Then**
the shared 401, 403, 429, and 400 responses every secured toll operation
declares (Part 12 §12.3; F-TOL-06 fixed).

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-23T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801"
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/tolling/transactions/{id} requires apx.tolling:manage.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801"
}
```

<!-- apx:request GET /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 20 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000801"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment invalid -->
```json
{ "note": "payment reference missing" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "payment is required.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/payment",
  "errors": [ { "pointer": "/payment", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price -->
```json
{ "pricing": { "currencyType": "USD", "currencyValue": 4.25 } }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-23T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price -->
```json
{ "pricing": { "currencyType": "USD", "currencyValue": 4.25 } }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions/{id}/price requires apx.tolling:manage.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price -->
```json
{ "pricing": { "currencyType": "USD", "currencyValue": 4.25 } }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 20 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000803/price"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-23T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions/{id}/void requires apx.tolling:manage.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void -->
```json
{ "reason": "duplicate" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 20 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000812/void"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes invalid -->
```json
{ "detail": "no reason given" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes -->
```json
{ "reason": "wrongVehicle" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-23T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes -->
```json
{ "reason": "wrongVehicle" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions/{id}/disputes requires apx.tolling:manage.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes -->
```json
{ "reason": "wrongVehicle" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 20 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000804/disputes"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve invalid -->
```json
{ "note": "resolution missing" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "resolution is required.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve",
  "errors": [ { "pointer": "/resolution", "detail": "required" } ]
}
```

An `adjusted` resolution without `adjustedPricing` is refused the same
way (§15.1):

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve -->
```json
{ "resolution": "adjusted", "note": "repriced" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "adjustedPricing is required when resolution is adjusted.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve",
  "errors": [ { "pointer": "/adjustedPricing", "detail": "required when resolution is adjusted" } ]
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve -->
```json
{ "resolution": "withdrawn" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-23T00:00:00Z.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve -->
```json
{ "resolution": "withdrawn" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/tolling/transactions/{id}/disputes/resolve requires apx.tolling:manage.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve"
}
```

<!-- apx:request POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve -->
```json
{ "resolution": "withdrawn" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 20 seconds.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000809/disputes/resolve"
}
```
