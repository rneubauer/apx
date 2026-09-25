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
  → `{capacity, issued, available}` (profile over APDS RightPool) for one
  pool. APDS keeps one `RightPool` per period in
  `RightSpecification.rightPools[]`; the optional `pool` (a RightPool id)
  or `at` (an instant) query parameter selects it, and with neither the
  server uses the pool whose `validity` contains now, else the earliest
  future pool. The response names the selected `pool` and its `validity`.
  `issued` = `distributedAssignedRights`, `available` =
  `availableAssignedRights`, `capacity` = their sum; an operator that
  sells above the physical space count MAY report that count as `spaces`.
- **Issue** — `POST /v1/permits/issue` creates a native AssignedRight
  with multiple vehicle `credentials[]` (APDS annual-permit pattern: one
  right, many vehicles). Pool exhaustion is `409` with problem type
  `https://apx-standard.org/problems/pool-exhausted`. A client that may
  retry SHOULD send `Idempotency-Key` (Part 4 §4.2a): a replay returns the
  AssignedRight the key issued (200) and consumes no second slot, while a
  retry without a key issues a second permit.
- **Renewal** — re-issue against the same holder with a new validity window;
  implementations SHOULD link renewals with the `apds-ext:apx:permit@1.0`
  extension (`PermitExtension`): the renewal's issue request carries
  `extensions["apds-ext:apx:permit@1.0"].renews` (a Reference to the
  AssignedRight renewed), and the server MAY set `renewedBy` on the old
  one. APDS 4.1's `AssignedRight` declares no `extensions` container of
  its own; implementations carry the key there regardless (Part 4 §4.3),
  an item for APDS reconciliation (Part 3 §3.3(8)).
- **Waitlist** — OPTIONAL and not interoperable: on exhaustion an
  implementation MAY record a waitlist entry and MAY describe it in a
  vendor-namespaced extension member of the `pool-exhausted` problem. APX
  v1 standardizes no waitlist shape, route, or processing rule, and a
  client MUST NOT rely on one.

### 14.2a Issue refusals (normative)

In the order a server checks them:

1. A body that fails the schema, or a `credentialType` that is not an APDS
   `CredentialTypeEnum` value, is `400 invalid-request`.
2. A `rightSpecification` or `holder` that names nothing that exists, or
   nothing visible to the caller, is `422 reference-unknown`.
3. A stale `rightSpecification.version` is `409 version-conflict`.
4. A RightSpecification with no `rightPools` (an event or quote-priced
   spec) is not a permit: `422 request-unprocessable`, `detail` "not a
   pooled RightSpecification".
5. A `credentialType` absent from the RightSpecification's `credentials`
   allow-list is `422 request-unprocessable`, `detail` naming the type.
6. An identification already carried by another active AssignedRight
   issued from a RightSpecification at the same place MAY be refused with
   `409 credential-identification-in-use` whether or not the server claims
   `apx-credentials`; whether one plate may hold two permits is operator
   policy, and a server that allows it MUST say so in its ICS.
7. An exhausted pool is `409 pool-exhausted`.

### 14.2b Materialization onto the AssignedRight (normative)

The issued permit is an ordinary APDS 4.1 `AssignedRight`, so a stock
APDS lane or enforcement client needs nothing from APX to honour it. The
issue request maps onto it as follows:

1. `rightSpecification` → `AssignedRight.rightSpecification`
   (VersionedReference, as sent).
2. `holder` → one entry of `rightHolder.credentials[]` that is a
   `CustomerCredential`: `credentialAssignedType: customer`, `identifier`
   = the holder Reference (`className: RightHolder`), and `type:
   permit`.
3. Each `credentials[]` entry → one `VehicleCredential` in
   `rightHolder.credentials[]`: `credentialAssignedType: vehicle`, `type`
   = `credentialType`, and `identifier` = a Reference to the
   CredentialRecord when the server claims `apx-credentials` (Part 21
   §21.2), otherwise `{ "id": <credentialIdentification>, "className":
   <credentialType> }` — the identification string itself as the id.
4. `validity` → one `PlannedUse` in `plannedUses[]` with `startTime` =
   `validity.start` and `endTime` = `validity.end`, and `expiry` =
   `validity.end`. With no `validity`, the server applies the selected
   pool's `validity` (or `relativeValidity`) the same way.
5. `issueMethod`, `issuanceTime`, and `assignedRightIssuer` are set by the
   server.

Servers MUST resolve the native `credential_type`/`credential_id` filters
on `GET /rights/assigned` against the identification string the lane
reads (the plate, the tag id), whichever `identifier` form rule 3 chose,
so `GET /rights/assigned?credential_type=licensePlate&credential_id=MBL-7710`
finds the permit.

### 14.2c After issue (normative)

- **Vehicles.** Adding or removing a vehicle is a native
  `PUT /rights/assigned/{id}` of the whole AssignedRight (Part 5), keeping
  the `CustomerCredential` and any extensions. The allow-list rule of
  §14.2a(5) applies to every added vehicle; changing vehicles never
  consumes or returns a pool slot, because the slot is the right, not the
  vehicle.
- **Cancellation.** A permit is cancelled with native
  `DELETE /rights/assigned/{id}`, or ends at `expiry`. Either returns the
  slot to its RightPool (`availableAssignedRights` + 1,
  `distributedAssignedRights` − 1) from the moment it takes effect.
- **Money.** The payment that bought the permit SHOULD be recorded in the
  AssignedRight's native `payments[]`; with `apx-accounts`, that entry's
  `transactionID` equals the PaymentRecord's (Part 13 §13.6), which is how
  a pro-rated refund (`POST /v1/payments/{id}/refund`) finds its payment.
- **Pool changes.** Servers SHOULD publish
  `apx.permits.pool.availability.v1` (registry `apx-topics`), `data` =
  `PoolAvailability` and `subject` = the RightSpecification, whenever a
  pool's `issued` or `capacity` changes, so a portal need not recount
  native AssignedRight events.

Permit consumption (entry/exit) is ordinary APDS Session/Observation data.
