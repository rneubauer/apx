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
   `reservationState: amended`. Amendments made **after** check-in retain
   `reservationState: checkedIn` — `checkInSession` remains the normative
   linkage and only the planned times change.
4. **Cancel** — native `DELETE` or state `cancelled`.
5. **Check-in** — creating a native Session whose segment references the
   AssignedRight transitions the reservation to `checkedIn` and sets
   `checkInSession`. This is the normative linkage.
6. **No-show** — a reservation whose `plannedStart` + grace period passes
   with no check-in transitions to `noShow` and publishes
   `apx.reservation.noshow.v1`. The grace period is operator policy.

Events: native APDS `AssignedRightCreated/Updated/Deleted` topics carry the
reservation payloads; only no-show adds an APX topic.

## 14.1a Customer identity is per-system (normative)

**APX assumes NO central catalog of users.** In real deployments each
location may run a different PARCS, each with its own user/permit database;
an APX endpoint speaks only for the system behind it. Therefore:

1. RightHolder identifiers are LOCAL to the issuing implementation. Clients
   MUST NOT assume a holder id from one APX endpoint resolves at another.
2. Cross-location/cross-system customer correlation is done by the CALLER
   using the **strongest credential available for the parker segment**:
   permits and reservations carry a plate/credential on file; transient
   parkers at LPR-equipped locations are correlated by camera reads; and
   transient parkers WITHOUT LPR are findable only by ticket number or
   truncated payment-card digits (Part 13 §13.2) — often nothing at all
   until they present the ticket at a lane (Part 6 lane inquiry).
3. History/lookup endpoints return only what the queried system knows, and
   accept an optional `place` parameter so aggregating implementations
   (one endpoint fronting many locations) can scope results per location.

## 14.1b Linking a reservation to a session (normative)

At LPR-equipped facilities the plate IS the link: correcting the session's
plate (Part 17 §17.5) lets the implementation's own matching bind the
prepaid AssignedRight. Where no plate can carry the association —
barcode-only reservations, unreadable plates — the explicit link exists:

- `PUT /v1/sessions/{id}/assigned-right` (scope `apx.reservations:manage`)
  binds the session to the AssignedRight, optionally recording the
  presented `reservationCode` as audit evidence. Naturally idempotent.
- **Materialization:** the link MUST land in the underlying APDS Session
  (`segments[].assignedRight`), MUST publish `SessionUpdated`, and MUST be
  visible to plain APDS clients — a façade over APDS-modeled state.
- An AssignedRight already consumed by another session, outside its
  validity window, or for another place is `409` (problem
  `right-not-linkable`); pricing consequences follow from the link via the
  implementation's normal rating.

## 14.2 `apx-permits`

Permits = pooled RightSpecifications:

- **Pool availability** — `GET /v1/permits/pools/{rightSpecId}/availability`
  → `{capacity, issued, available}` (profile over APDS RightPool).
- **Issue** — `POST /v1/permits/issue` creates a native AssignedRight
  with multiple vehicle `credentials[]` (APDS annual-permit pattern: one
  right, many vehicles). Pool exhaustion is `409` with problem type
  `https://apx-standard.org/problems/pool-exhausted`.
- **Renewal** — re-issue against the same holder with a new validity window;
  implementations SHOULD link renewals via `extensions`.
- **Waitlist** — OPTIONAL convention: on exhaustion an implementation MAY
  record a vendor-extension waitlist entry; APX v1 does not standardize
  waitlist processing.

Permit consumption (entry/exit) is ordinary APDS Session/Observation data.
