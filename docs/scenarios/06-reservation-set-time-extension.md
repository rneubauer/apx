# Scenario 06 — Reservation for a set time, then extending it

**The story.** A business traveler books Lakeside Garage for a fixed window:
Tuesday **06:00–18:00**, plate `SYN-5150` on file. Then reality intervenes,
twice. Before arrival, the outbound flight moves and the window stretches to
20:00. Mid-stay — car already parked — the return flight slips again and the
stay is extended a second time, priced through the native APDS
session-extension quote. A third, overnight request finally hits a wall.

**Actors.** Reservation platform (`apx.reservations:manage`) → Lakeside
Garage APX server. Companion deep-dive to
[Scenario 05](05-reservation-lifecycle.md) — same machinery, focused
entirely on the set-time-then-extend path.

## Step 1 — Book the set window

```http
POST /rights/assigned HTTP/1.1
Content-Type: application/json

{
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "credentials": [{ "credentialType": "licensePlate", "identifier": "SYN-5150" }],
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-08-11T06:00:00Z",
      "plannedEnd": "2026-08-11T18:00:00Z"
    }
  }
}
```

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000004",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "confirmed",
      "plannedStart": "2026-08-11T06:00:00Z",
      "plannedEnd": "2026-08-11T18:00:00Z"
    }
  }
}
```

The window is a hard contract: `plannedStart`/`plannedEnd` are what the
no-show sweep, the rate engine, and the availability calculation all read.

## Step 2 — Extension #1, before arrival

Monday night the airline moves the flight. The platform amends the same
resource — native `PUT`, extension state → `amended` (Part 14 §14.1 rule 3),
new end time:

```http
PUT /rights/assigned/e2000000-0000-4000-8000-000000000004 HTTP/1.1
```

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000004",
  "version": 2,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "amended",
      "plannedStart": "2026-08-11T06:00:00Z",
      "plannedEnd": "2026-08-11T20:00:00Z"
    }
  }
}
```

Note `version: 2` — writes are change-mode, so a stale-version PUT (two
amendments racing) is rejected rather than silently last-writer-wins.

## Step 3 — Check-in

Tuesday 05:52, the entry camera reads `SYN-5150`; the PARCS creates the
native `Session` and the extension records the linkage:

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000004",
  "version": 3,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-08-11T06:00:00Z",
      "plannedEnd": "2026-08-11T20:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000021", "className": "Session" }
    }
  }
}
```

## Step 4 — Extension #2, mid-stay: price it first

16:40, car on level 3, and the return flight slips to 21:15. Because a live
`Session` now exists, pricing the extra time is the **stock APDS
session-extension quote** — no APX invention needed:

```http
POST /quotes HTTP/1.1
Content-Type: application/json
```

<!-- apx:validate QuoteSessionExtensionRequest -->
```json
{
  "id": "4c5d6e7f-8a9b-4c0d-8e1f-2a3b4c5d6e7f",
  "version": 1,
  "requestedEndTime": "2026-08-11T22:00:00Z",
  "requestTime": "2026-08-11T16:40:12Z",
  "sessionId": { "id": "f1000000-0000-4000-8000-000000000021", "version": 1, "className": "Session" },
  "suppliedCredential": { "id": "e3000000-0000-4000-8000-000000000005", "version": 1, "className": "Credential" }
}
```

<!-- apx:validate QuoteSessionExtensionResponse -->
```json
{
  "id": "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a",
  "version": 1,
  "requestSessionExtensionId": { "id": "4c5d6e7f-8a9b-4c0d-8e1f-2a3b4c5d6e7f", "version": 1 },
  "sessionId": { "id": "f1000000-0000-4000-8000-000000000021", "version": 1, "className": "Session" },
  "requestTime": "2026-08-11T16:40:12Z",
  "responseTime": "2026-08-11T16:40:13Z",
  "revisedEndTime": "2026-08-11T22:00:00Z"
}
```

The server can honor 22:00. The platform shows the price (from the place's
disclosed rate deck), the traveler taps accept, and the reservation's
`plannedEnd` moves the same way as before — a change-mode `PUT`:

<!-- apx:validate ReservationExtension at /extensions/apds-ext:apx:reservation@1.0 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000004",
  "version": 4,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 1, "className": "RightSpecification" },
  "extensions": {
    "apds-ext:apx:reservation@1.0": {
      "reservationState": "checkedIn",
      "plannedStart": "2026-08-11T06:00:00Z",
      "plannedEnd": "2026-08-11T22:00:00Z",
      "checkInSession": { "id": "f1000000-0000-4000-8000-000000000021", "className": "Session" }
    }
  }
}
```

After check-in the reservation **stays `checkedIn`** — `checkInSession` is
the normative linkage (Part 14 §14.1 rule 5) and the amendment simply moves
`plannedEnd`. The pre-arrival `amended` state applies only before a session
exists.

## Step 5 — Extension #3: the polite no

21:50, one more push: keep the car overnight until 09:00 tomorrow. The
garage pre-sold Wednesday morning to a monthly cohort, so the quote comes
back declined — same shape, `reason` instead of a new end time:

<!-- apx:validate QuoteSessionExtensionResponse -->
```json
{
  "id": "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b",
  "version": 1,
  "requestSessionExtensionId": { "id": "7f8a9b0c-1d2e-4f3a-8b4c-5d6e7f8a9b0c", "version": 1 },
  "sessionId": { "id": "f1000000-0000-4000-8000-000000000021", "version": 1, "className": "Session" },
  "requestTime": "2026-08-11T21:50:44Z",
  "responseTime": "2026-08-11T21:50:45Z",
  "revisedEndTime": "2026-08-11T22:00:00Z",
  "reason": "noExtensionPossible"
}
```

`revisedEndTime` stays at the currently committed 22:00 — the decline never
shrinks what was already granted. The platform tells the traveler to move
the car tonight, and the reservation runs out at its (twice-extended) set
time.

**The pattern:** set time = `plannedStart`/`plannedEnd` on the extension;
every extension = quote (optional but polite) + change-mode `PUT` with a
version bump. No special "extend" endpoint exists because none is needed —
the audit trail is the version history of one native `AssignedRight`.
