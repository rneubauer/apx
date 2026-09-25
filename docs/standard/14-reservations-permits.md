# APX Part 14 — Reservations & Permits (optional classes)

Both classes are **thin profiles over APDS native machinery** — no parallel
booking or permit entities exist.

## 14.1 `apx-reservations`

The reservation lifecycle rides entirely on native routes:

1. **Quote** — native `POST /quotes` (QuoteRightRequest/Response).
2. **Book** — native `POST /rights/assigned`: an AssignedRight carrying the
   `apds-ext:apx:reservation@1.0` extension (`reservationState: confirmed`,
   `plannedStart/plannedEnd` — the APDS PlannedUse concept). The plate on
   file is a `CredentialAssigned` of `type: licensePlate` under
   `rightHolder.credentials[]` (its `identifier` a Reference), never a
   top-level member. The native create answers 201 `ResponseStatus`
   naming the id; a client that wants the stored right (with the
   server-set `noShowAfter`) reads it back with `GET /rights/assigned/{id}`.
3. **Amend** — native `PUT /rights/assigned/{id}` (change mode);
   `reservationState: amended`. Amendments made **after** check-in retain
   `reservationState: checkedIn` — `checkInSession` remains the normative
   linkage and only the planned times change. The body's `version` is the
   version the client last read (Part 4 §4.2a); a stale one is refused
   with `version-conflict`. Until a change-mode schema exists for native
   entities (Part 5 §5.1), an amend body MUST still carry the
   AssignedRight's required members (`id`, `version`,
   `rightSpecification`, `rightHolder`) so it validates against the
   published schema.
4. **Cancel** — native `DELETE` or state `cancelled`. The server sets
   `plannedUses[0].cancelTime`.
5. **Check-in** — creating a native Session whose segment references the
   AssignedRight transitions the reservation to `checkedIn` and sets
   `checkInSession`. This is the normative linkage.
6. **No-show** — a reservation whose `plannedStart` + grace period passes
   with no check-in transitions to `noShow`, sets
   `plannedUses[0].expiryTime` to that instant, and publishes
   `apx.reservation.noshow.v1` with a `ReservationSummary` as `data`. The
   grace period is operator policy; the server exposes its effect as the
   read-only `noShowAfter` on the extension (and on `ReservationSummary`),
   so a platform can tell the customer when the booking lapses.

**Planned times.** `plannedUses[0].startTime`/`endTime` are authoritative;
the extension's `plannedStart`/`plannedEnd` MUST mirror them on every
write. A server receiving a write where the two disagree applies
`plannedUses[0]` and rewrites the extension to match, so a plain APDS
client editing `plannedUses[0]` still moves the reservation.

**Transitions (normative).**

| From | Legal transitions |
|---|---|
| `confirmed` | `amended`, `checkedIn`, `cancelled`, `noShow` |
| `amended` | `amended` (a further amendment), `checkedIn`, `cancelled`, `noShow` |
| `checkedIn` | changes to the planned times only (the state stays `checkedIn`); back to its pre-check-in state only through the §14.1b unlink |
| `cancelled`, `noShow` | none — terminal |

Any other transition (amending or cancelling a `cancelled` or `noShow`
right, cancelling after check-in, reverting to `confirmed` by a write) is refused
with 409. On the native routes the refusal is the APDS `ResponseStatus`
409, or the problem `reservation-transition-illegal` where the client
negotiates `application/problem+json` (Part 12 §12.1).

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
4. **The recent lookup.** `GET /v1/reservations/recent` requires `plate`
   or `holder` (400 `invalid-request` otherwise); both together
   intersect. A bare plate string is ambiguous across jurisdictions, so
   the optional `country` and `stateProvince` (APDS
   `VehicleAncillaryIdentification` vocabulary, as in Part 17 §17.5)
   qualify it; absent, the plate string alone is matched. Optional
   `from`/`to` (applied to `plannedStart`; `from` after `to` is 400) and
   `state` reach past the ten most recent for disputes. An unknown
   `place` is 404 `target-not-found`; a place outside the grant is 403
   `insufficient-grant` (Part 9 §9.3a).

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
  validity window, for another place, or in `reservationState`
  `cancelled` or `noShow` is `409` (problem `right-not-linkable`);
  pricing consequences follow from the link via the implementation's
  normal rating.
- **Re-pointing.** Re-sending the same link is a no-op 200. A link naming
  a *different* right on a session already linked to one is `409`
  `right-not-linkable` ("session already linked") — a link is never
  silently replaced.
- **Unlinking.** `POST /v1/sessions/{id}/assigned-right/unlink` (scope
  `apx.reservations:manage`, `reason` REQUIRED) is the audited undo: it
  reverts the segment to the drive-up right, returns the reservation to
  its pre-check-in state (clearing `checkInSession`), materializes in the
  APDS Session, and publishes `SessionUpdated`. Unlinking a session with
  nothing linked is a no-op 200; a closed Session is 422
  `session-not-open`. Re-point = unlink, then link.
- **Concurrency and approval.** Both writes take `If-Match` with the APDS
  Session `version` the client read (409 `version-conflict` when stale,
  Part 4 §4.2a) and an optional `approval` for actions a resolution
  context gated (Part 17 §17.3).

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
