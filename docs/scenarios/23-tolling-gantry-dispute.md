# Scenario 23 — Tolling: a gantry charges twice, and the second one is not your car

**The story.** Lakeside Harbor Crossing is a tolled access road the operator
runs into the garage complex: no barriers, a gantry that reads transponders
and plates, billing to an account on file. At 07:14 a transponder passes,
the transaction is created, priced, and settled against the holder's account
that night. The gantry then retries the same read because its uplink
flapped, and the idempotency key makes that a no-op rather than a second
charge.

At 07:52 a different vehicle passes with no transponder. The plate reads as
`SYN-9930`, which belongs to a monthly holder who was three hundred miles
away. She disputes it. The operator pulls the gantry image, agrees, and
resolves the dispute as refunded. A later attempt to reopen the same dispute
is refused.

**Actors.** Gantry bridge (`apx.tolling:manage`); back office
(`apx.tolling:manage`, `apx.payments:write`); the holder, through the call
center → Lakeside APX server.

## Step 1 — 07:14: the gantry reports a passage

The transponder and plate reads are ingested as native APDS Observations
first, exactly as any sensor read is. The toll transaction then references
them; it does not restate them.

```http
POST /v1/tolling/transactions HTTP/1.1
Idempotency-Key: gantry-hc-01-20260922T071408-0417
Content-Type: application/json

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

<!-- apx:validate TollTransaction -->
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

`apx.tolling.transaction.created.v1` is published. Pricing happened in the
same call here because the rate is flat by axle count and time of day; an
operator whose pricing is asynchronous would return `created` and publish a
status event when the price lands.

## Step 2 — The gantry retries, and nothing happens twice

The uplink flapped, so the bridge re-sent the identical request under the
identical key:

```http
POST /v1/tolling/transactions HTTP/1.1
Idempotency-Key: gantry-hc-01-20260922T071408-0417
Content-Type: application/json

{ "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" }, "observations": [ { "id": "f2000000-0000-4000-8000-000000000801", "className": "Observation" }, { "id": "f2000000-0000-4000-8000-000000000802", "className": "Observation" } ], "credential": { "credentialType": "rfid", "credentialIdentification": "TAG-44192" }, "pricing": { "currencyType": "USD", "currencyValue": 2.75 } }
```

The response is `200` carrying the original transaction, `e9…0801`,
unchanged at version 2. Not a new transaction, and not a second charge.
This is why `Idempotency-Key` is required on this route rather than
recommended: a gantry that loses its uplink for a minute re-sends
everything it buffered, and toll systems that get this wrong double-bill in
public.

Had the bridge re-sent the same key with a *different* body, the answer
would have been `409 idempotency-conflict`.

## Step 3 — Settled against the account

The nightly run charges the holder's account and attaches the payment:

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000801/payment HTTP/1.1
Content-Type: application/json

{
  "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1901", "className": "PaymentRecord" },
  "note": "account autopay, batch 2026-09-22"
}
```

<!-- apx:validate TollTransaction -->
```json
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
    { "state": "paid", "time": "2026-09-23T02:11:40Z", "actor": "billing-batch", "detail": "account autopay, batch 2026-09-22" }
  ]
}
```

The money itself is a Part 13 `PaymentRecord`, taken through the ordinary
payment surface and materialized as an APDS Payment. The toll transaction
holds a reference, never a parallel ledger.

## Step 4 — 07:52: the passage that was not hers

A second vehicle passes with no transponder, so the gantry falls back to the
plate and reads `SYN-9930` at 0.71 confidence. That transaction is created,
priced, and billed the same way. Ten days later the holder calls: she was in
another state, and the photograph shows a different make.

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes HTTP/1.1
Content-Type: application/json

{
  "reason": "wrongVehicle",
  "detail": "Holder was out of state; gantry image shows a silver sedan, holder's vehicle is a black pickup. Plate read confidence 0.71.",
  "disputedBy": { "id": "c1000000-0000-4000-8000-000000000221", "className": "RightHolder" }
}
```

<!-- apx:validate TollTransaction -->
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

A dispute moves any non-voided transaction aside without erasing it. The
original reads stay referenced, because the evidence that produced the
charge is the evidence that settles the argument.

## Step 5 — Resolved, and the money goes back

The back office compares the gantry image with the vehicle on the holder's
account and agrees:

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes/resolve HTTP/1.1
Content-Type: application/json

{
  "resolution": "refunded",
  "note": "Image review: not the holder's vehicle. Refund issued against the original payment; plate read below the 0.85 auto-bill threshold, gantry flagged for recalibration."
}
```

<!-- apx:validate TollTransaction -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000802",
  "version": 5,
  "tollPoint": { "id": "b4000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" },
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

The refund itself is a Part 13 refund against the original payment. The toll
record says what was decided and when; it does not move money.

## Step 6 — The dispute cannot be reopened

A month later an automated reconciliation job, working from a stale export,
tries to open the dispute again:

```http
POST /v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes HTTP/1.1
Content-Type: application/json

{ "reason": "wrongVehicle" }
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/dispute-closed",
  "title": "Dispute closed",
  "status": 409,
  "detail": "Transaction e9000000-0000-4000-8000-000000000802 has a dispute resolved 2026-10-03 as refunded. Raise a new adjustment instead.",
  "instance": "/v1/tolling/transactions/e9000000-0000-4000-8000-000000000802/disputes"
}
```

Resolved is resolved. A settled dispute that can be silently reopened is a
settled dispute that never settles, which is why this is one of the few
conflicts the standard names explicitly.

Every transition here published `apx.tolling.transaction.status.v1`, so the
operator's analytics warehouse and its gantry-health dashboard both saw the
dispute and the recalibration flag without polling for them.
