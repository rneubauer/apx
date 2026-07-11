# APX Part 14 — Reservations & Permits (optional classes)

Both classes are **thin profiles over APDS native machinery** — no parallel
booking or permit entities exist.

## 14.1 `apx-reservations`

The reservation lifecycle rides entirely on native routes:

1. **Quote** — native `POST /quotes` (QuoteRightRequest/Response).
2. **Book** — native `POST /rights/assigned`: an AssignedRight carrying the
   `apds-ext:apx:reservation@1.0` extension (`reservationState: confirmed`,
   `plannedStart/plannedEnd` — the APDS PlannedUse concept).
3. **Amend** — native `PUT /rights/assigned/{id}` (change mode);
   `reservationState: amended`.
4. **Cancel** — native `DELETE` or state `cancelled`.
5. **Check-in** — creating a native Session whose segment references the
   AssignedRight transitions the reservation to `checkedIn` and sets
   `checkInSession`. This is the normative linkage.
6. **No-show** — a reservation whose `plannedStart` + grace period passes
   with no check-in transitions to `noShow` and publishes
   `apx.reservation.noshow.v1`. The grace period is operator policy.

Events: native APDS `AssignedRightCreated/Updated/Deleted` topics carry the
reservation payloads; only no-show adds an APX topic.

## 14.2 `apx-permits`

Permits = pooled RightSpecifications:

- **Pool availability** — `GET /apx/v1/permits/pools/{rightSpecId}/availability`
  → `{capacity, issued, available}` (profile over APDS RightPool).
- **Issue** — `POST /apx/v1/permits/issue` creates a native AssignedRight
  with multiple vehicle `credentials[]` (APDS annual-permit pattern: one
  right, many vehicles). Pool exhaustion is `409` with problem type
  `https://apx-standard.org/problems/pool-exhausted`.
- **Renewal** — re-issue against the same holder with a new validity window;
  implementations SHOULD link renewals via `extensions`.
- **Waitlist** — OPTIONAL convention: on exhaustion an implementation MAY
  record a vendor-extension waitlist entry; APX v1 does not standardize
  waitlist processing.

Permit consumption (entry/exit) is ordinary APDS Session/Observation data.
