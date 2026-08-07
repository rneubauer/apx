# Scenario 05 — Reservation lifecycle: quote → book → amend → check-in → no-show

**The story.** A concert Friday night. A driver books a spot at Lakeside
Garage through a reservation app, extends it when dinner runs long, and is
recognized by plate on arrival — no ticket, no QR code, the gate just opens.
Their friend books too, never shows, and the no-show sweep handles it.

**Actors.** Reservation platform (`apx.reservations:manage`,
`apx.data:read`) → Lakeside Garage APX server.

**The design.** APX adds **no parallel booking object**. A reservation *is*
a native APDS `AssignedRight` carrying the
`apds-ext:apx:reservation@1.0` extension — every APDS-native system sees a
normal assigned right; APX-aware systems see the reservation lifecycle in
the extension.

## Step 1 — Quote (stock APDS)

Price discovery is the native APDS quote flow, unchanged (abridged —
shapes are stock APDS 4.1 `QuoteRightRequest`/`QuoteRightResponse`):

```http
POST /quotes HTTP/1.1

{ "referencedRightSpecification": { "...": "Friday 18:00–23:00, Lakeside Garage" } }
```

## Step 2 — Book: an AssignedRight with the reservation extension

```http
POST /rights/assigned HTTP/1.1
Content-Type: application/json

{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "credentials": [{ "credentialType": "licensePlate", "identifier": "SYN-1234" }],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-08-14T18:00:00Z",
      "plannedEnd": "2026-08-14T23:00:00Z"
    }
  }
}
```

The response is the full native `AssignedRight`; the extension rides in the
standard `extensions` container (shown here trimmed to the fields the
reservation platform reads back):

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-08-14T18:00:00Z",
      "plannedEnd": "2026-08-14T23:00:00Z"
    }
  }
}
```

Any APDS 4.1 intermediary that handles this object MUST round-trip the
`extensions` keys untouched (tolerant reader, faithful writer) — the
reservation survives passing through systems that have never heard of APX.

## Step 3 — Amend: dinner ran long

A native `PUT` on the same resource, extension state → `amended`:

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 HTTP/1.1
```

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "amended",
      "plannedStart": "2026-08-14T18:00:00Z",
      "plannedEnd": "2026-08-15T01:00:00Z"
    }
  }
}
```

## Step 4 — Check-in: the LPR read is the key

Friday 18:04. The entry camera reads `SYN-1234`; the PARCS matches it to the
reservation's plate credential, opens the gate, creates the native
`Session`, and flips the extension to `checkedIn` with a link to that
session:

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-08-14T18:00:00Z",
      "plannedEnd": "2026-08-15T01:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000014", "className": "Session" }
    }
  }
}
```

Call-center bonus: any later LPR lookup on this plate carries the driver's
recent reservations, so an agent sees the booking context instantly:

```http
GET /v1/reservations/recent?plate=SYN-1234 HTTP/1.1
```

<!-- apx:validate ReservationSummary at /data/0 -->
```json
{
  "data": [
    {
      "reservation": { "id": "e2000000-0000-4000-8000-000000000002", "className": "AssignedRight" },
      "reservationState": "checkedIn",
      "plannedStart": "2026-08-14T18:00:00Z",
      "plannedEnd": "2026-08-15T01:00:00Z"
    }
  ]
}
```

## Step 5 — The friend never shows

The no-show sweep runs after the grace period. The friend's reservation
flips to `noShow` and the fabric announces it on
`apx.reservation.noshow.v1` — the reservation platform refunds or charges
per its own policy:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d6e",
  "type": "apx.reservation.noshow.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000003", "className": "AssignedRight" },
  "time": "2026-08-14T19:30:00Z",
  "data": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000003", "className": "AssignedRight" },
    "reservationState": "noShow",
    "plannedStart": "2026-08-14T18:00:00Z"
  }
}
```

One lifecycle, five states (`confirmed → amended → checkedIn` /
`cancelled` / `noShow`), zero new top-level resources — the entire feature
is a disciplined use of APDS's own extension container.
