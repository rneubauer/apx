# APX Part 13 — Accounts, Payments, LPR (optional classes)

Three optional conformance classes for call-center and back-office
integration over live PARCS state.

## 13.1 `apx-accounts`

- `GET /v1/accounts?name=|phone=|email=|card=|plate=` — look up accounts
  by any combination. Returns Account[] with balances and
  status. Scope `apx.accounts:read`. `email` (like `phone`) is personal
  data under Part 9 §9.6 and is returned only under this scope.
- `GET /v1/accounts/{id}` — full account info.
- `POST /v1/payments` — take a payment. Body:
  account Reference (or `ticketNumber`), the (required) `place` binding,
  `amount`, `method`
  (`autoAttendant` = PCI-compliant IVR captures the card out of band; APX
  never carries PANs). **Idempotency-Key REQUIRED.** Returns a
  PaymentRecord with `transactionID`. A body naming neither `account` nor
  `ticketNumber` is `400 invalid-request`. Declines are `422
  payment-declined`; the declined attempt is still recorded (and
  published, §13.4), and the problem SHOULD carry a `payment` extension
  member — a Reference to that declined PaymentRecord — so the caller can
  cite it without a second lookup. `captureLater: true` asks for an
  authorization only — a hold (§13.1a). Captured account payments reduce
  the account balance; a hold does not until it is captured. Scope
  `apx.payments:write`.
- `POST /v1/payments/{id}/postings` — accounting write-back
  (PARIS-style): posts account/card/amount/transaction
  ID to the AR system and returns `{confirmationNumber, accountUpdated,
  newBalance}`. Only an `approved`, captured payment can be posted.
- **No card data (normative).** No APX request carries more than the
  truncated last four card digits, in a body member or a query parameter.
  A server that receives more (a PAN in `cardLast4`, an undeclared
  `cardNumber` member, a PAN pasted into a search) MUST refuse it with
  `422 personal-data-not-permitted` before the request is persisted or
  logged, and MUST NOT echo the digits in the problem.

## 13.1a Payment lifecycle and payment links (financial actions)

Customer-service financial actions are domain operations here — never
control commands (Part 17 §17.4):

- `POST /v1/payment-links` — send a hosted payment link (sms/email) for an
  account, ticket, or session; returns the `PaymentLink` lifecycle
  resource (`sent → opened → paid | expired | cancelled`). The action of
  first resort when policy blocks a gate override. APX never carries PANs;
  `sentTo` is masked. A body naming nothing to settle is `400
  invalid-request`; a `channel` the server does not deliver on is `422
  request-unprocessable`.
- `GET /v1/payment-links/{id}` — the link's current state (scope
  `apx.accounts:read` or `apx.payments:write`), grant-checked on its
  `place`; once `paid`, `payment` references the PaymentRecord.
- `POST /v1/payment-links/{id}/cancel` — `sent | opened → cancelled`; the
  hosted page MUST stop accepting payment from that instant. A link that
  is `paid`, `expired`, or `cancelled` is `409 payment-state-illegal`.
- `POST /v1/payments/{id}/refund` — full, or partial per `amount`.
  Refunds SHOULD require approval by default operator policy; approval
  evidence rides the request when the resolution context demanded it.
- `POST /v1/payments/{id}/void` / `POST /v1/payments/{id}/capture` —
  release or settle a hold, where the implementation models an
  authorization lifecycle.

The four payment actions take a REQUIRED `Idempotency-Key`; link cancel
takes an optional one (Part 4 §4.2a). Completion of a link-initiated
payment publishes `apx.accounts.payment.recorded.v1` like any other.

**Payment states and transitions (normative).** `paymentStatus` is one of
`approved`, `declined`, `reversed`. An approved payment also carries
`captureStatus`: `captured` (funds collected; absent means the same) or
`authorized` — a **hold**, where the payment layer approved an
authorization-only request, funds are held, and nothing is collected:

| From (`paymentStatus` / `captureStatus`) | Action | To | Notes |
|---|---|---|---|
| (create, sale) | `POST /v1/payments` | `approved` / `captured` (or absent), or `declined` | the default |
| (create, `captureLater: true`) | `POST /v1/payments` | `approved` / `authorized` (a hold), or `declined` | a server without an authorization lifecycle refuses `captureLater` with `422 request-unprocessable` |
| `approved` / `authorized` | capture | `approved` / `captured` | `amount` MAY be lowered to the captured amount; more than was authorized is `422 request-unprocessable` |
| `approved` / `authorized` | void | `reversed` / `authorized` | hold released, nothing collected |
| `approved` / `captured` | refund | `approved` or `reversed` | `refundedAmount` grows by the refund; the record becomes `reversed` when `refundedAmount` reaches `amount`. A refund above what remains is `422 request-unprocessable` |
| `approved` / `captured` | posting | unchanged | the AR write-back |

Every other combination — refunding or posting a hold or a `declined` or
`reversed` payment, capturing or voiding anything that is not a hold — is
`409 payment-state-illegal`, and nothing changes. `declined` and
`reversed` are terminal.

**Holds stay out of sight of consumers that predate `captureStatus`
(normative).** A hold is returned to the caller that created it (the 201,
its idempotent replay, and capture/void responses), but:

1. `GET /v1/payments` MUST NOT return a hold unless the query carries
   `captureStatus=authorized` (§13.2);
2. `apx.accounts.payment.recorded.v1` MUST NOT be published for a hold; it
   is first published at capture, with the captured record. Voiding a
   hold publishes nothing, since no consumer was told of it and no money
   moved;
3. a hold is never materialized as an APDS `Payment` (§13.6) and does not
   change an account balance until it is captured.

A hold's record therefore reads `paymentStatus: approved` only to its own
creator and to callers who ask for holds.

## 13.2 `apx-payment-history`

- `GET /v1/payments?ticketLast4=&cardLast4=&ticketNumber=&account=&date=&place=`
  — payments made on a ticket or an account. `cardLast4` (truncated PAN,
  PCI-permitted) is
  the **transient-parker lookup of last resort**: at locations without LPR,
  a caller who cannot read their ticket usually has nothing else.
  **Keys (normative):** a query MUST carry at least one key —
  `ticketLast4`, `cardLast4`, `ticketNumber` (exact), or `account` (the
  account's statement view); `date` and `place` only narrow a keyed query.
  A query with no key is `400 invalid-request`: the operation never serves
  the whole ledger.
  **Privacy rule (normative):** truncated-key lookups (`ticketLast4` or
  `cardLast4`) without a `date` are constrained to the last 8 hours; older
  records require the full ticket number (`ticketNumber`) or an
  account-scoped query (`account`), which are exempt from the window. All
  results remain constrained to the caller's grant (§13.5).
  A `cardLast4` (or any other parameter) carrying more than four card
  digits is `422 personal-data-not-permitted`, refused before the request
  is logged (§13.1).
  **Holds (normative):** results exclude holds (`captureStatus:
  authorized`, §13.1a) unless the query carries `captureStatus=authorized`,
  which returns only holds; `captureStatus=captured` returns only
  collected payments. `captureStatus` narrows a keyed query and is never a
  key on its own.

## 13.3 `apx-lpr`

- Ingest is NATIVE: LPR vendors `POST /observations` (APDS route) with
  Confidence and Image — nothing new to implement.
- `GET /v1/lpr/reads?plate=|ticket=|observation=` — the bidirectional
  cross-lookup: plate → ticket/session (+ accuracy + screenshot),
  ticket → plate, and Observation id → read (the read-back route for one
  ingested Observation, which APDS 4.1 lacks). Scope `apx.lpr:read`.
  **At least one of `plate`, `ticket`, or `observation` is REQUIRED**; a
  call with none is 400 `invalid-request`, never a bulk export (Part 9
  §9.6). Keys given together intersect; the optional `place` narrows
  below the grant (§13.5(3)). Every read carries its (required) `place`
  binding (§13.5) and, where the Observation references one, its `lane`
  (the lane `laneTravel` is derived from) and `cameraId`, so an entry
  read and an exit read for the same ticket can be told apart.
- **Extensions on the read.** `LprRead.extensions` and
  `PlateCandidate.extensions` project the underlying Observation's
  `extensions` container minus the `apds-ext:apx:lpr-read@1.0` block
  (which is `detail`), so a vendor key preserved on ingest is visible
  through the APX surface (Part 4 §4.3).

### 13.3a Read detail: per-attribute confidence and passage geometry (normative)

APDS's Observation carries the plate, the vehicle's `country`,
`stateProvince`, `make`, `model`, and `color`, one overall `Confidence`,
and per-character confidence — but no confidence per attribute, no
alternate candidates, and nothing about how the vehicle moved. Modern LPR
engines produce all of that, and gateless sites depend on it. APX adds it
as the Level B decoration `apds-ext:apx:lpr-read@1.0` (`LprReadDetail`) in
the Observation's `extensions` container (Part 4 §4.3), so a camera vendor
still ingests through native `POST /observations` and a plain APDS
consumer still sees a valid Observation.

1. **Per-attribute reads.** `detail.plate`, `.country`, `.stateProvince`,
   `.make`, `.model`, `.color`, `.bodyType` are each an `AttributeRead`
   (`value` + `confidence` 0–1). The winning values MUST also appear in
   the APDS-native fields (`observedCredentialId`,
   `vehicleAncillaryIdentification`) so APDS-only readers see them;
   `Confidence.overallConfidence` remains the overall score. Every
   attribute is optional — an engine that does not classify colour omits
   `color` rather than guessing.
2. **Alternate reads.** `detail.alternateReads[]` keeps the candidate
   plate strings the engine rejected, best first, each with confidence.
   Part 17 §17.5 plate correction SHOULD offer them as `PlateCandidate`s.
3. **Passage geometry.** `detail.platesRead` is how many plates of the
   vehicle the camera captured during the passage (1, or 2 for front and
   rear across frames — two reads are what let the engine call movement
   with confidence). `detail.plateFace` (`front | rear | unknown`) is
   which plate was read, i.e. the vehicle's orientation relative to the
   camera. `detail.movement` (`approaching | receding | stopped |
   unknown`) is the vehicle's motion relative to the camera. These are
   camera facts; they say nothing about the lane by themselves.
4. **Lane travel (server-derived).** The server MUST set
   `LprRead.laneTravel` (`withLane | againstLane | unknown`) by combining
   `plateFace` and `movement` with the camera's configured orientation
   and the lane's APDS `VehicularAccess.accessType` (`entry | exit |
   reversible`). The mapping from camera mount to lane direction is
   implementation configuration (as Part 17 §17.1 treats the SIP-URI-to-
   lane mapping); the *output* is interoperable. Informative canonical
   case, camera facing the traffic it is meant to read: on an `exit`
   lane, `front` + `approaching` = `withLane`, `rear` + `receding` =
   `againstLane`; on an `entry` lane the same pairs are `withLane` and
   `againstLane` respectively; a `reversible` lane yields `unknown`
   unless the lane's current direction is known to the server. Without
   `plateFace` or `movement`, `laneTravel` is `unknown`, never guessed.
5. **Wrong-way handling.** `againstLane` on a gateless site is the
   "entered on the exit lane" signal. The server SHOULD raise the
   `wrongWayTravel` alert (registry `apx-alert-types`, Part 7) with the
   Observation as evidence, and MUST still open or match the Session for
   the plate — the driver is charged for parking, not for the lot's
   geometry; what happens next (signage, enforcement under Part 19) is
   operator policy. The alert's `relatedEntity` is the **Session** (what
   an operator acts on); the evidence Observation(s) ride the alert's
   `extensions` under `apds-ext:apx:alert-evidence@1.0` as
   `{ "observations": [Reference, …] }`. The same shape serves any alert
   whose subject and evidence are different entities.
6. **Grouping.** `detail.captureGroup` links the reads of one passage
   (front and rear, several frames) so a consumer counting vehicles
   counts once. `LprRead` returns one row per Observation; the group id
   is how a consumer collapses them.
7. **Privacy.** `detail` is plate-bearing personal data under Part 9
   §9.6: it appears only under `apx.lpr:*` (and the Part 17 candidate
   route); make, model, and colour are carried as attributes of the
   read, not as a vehicle registry.

### 13.3b Retention and purge of reads (normative)

Part 9 §9.6 requires a published retention period for plate reads and
imagery and purge on schedule. On the APX surface a purge looks like
this, so "purged" and "never captured" stay distinguishable:

1. **Imagery purge.** When a read's imagery passes its retention, the
   server removes `imageLink` (and `PlateCandidate.plateImage` /
   `vehicleImage`) from the read and sets `purgedImagery: true`. The read
   itself survives until its own retention. A previously issued image
   link MAY answer 404 or 410; it MUST NOT return the image.
2. **Read purge.** When the read passes its retention, it disappears from
   every APX lookup (`/v1/lpr/reads`, `/v1/lpr/candidates`, resolution
   contexts) and the server emits the APDS entity's deletion on the Part 5
   change feed, so downstream copies can follow. A purged read is not
   tombstoned on the APX surface.

## 13.4 Eventing — the analytics feed

APDS's native `EventTypeEnum` publishes entity lifecycle events for
Sessions, Places, Rates, Rights, and Organisations — but **not** for
payments or observations, the two highest-value streams for financial and
LPR analytics. APX closes both gaps (registry `apx-topics`):

- `apx.accounts.payment.recorded.v1` — published for every recorded
  payment, whether taken via `POST /v1/payments` or ingested from a lane
  device. Event `data` is the PaymentRecord. Implementations claiming
  `apx-accounts` MUST publish it. It is published on creation (declined
  attempts included) **and again on every change** to `paymentStatus`,
  `amount`, or `refundedAmount` (refund), always carrying the full current
  record; consumers key on `data.id` and keep the latest by event `time`,
  so a finance feed learns of every reversal without double-counting. A
  hold (§13.1a) is not published at creation: its first event is at
  capture, and voiding a hold publishes nothing.
- `apx.data.observation.created.v1` — published for every ingested
  Observation (LPR read, RFID hit, sensor event). Event `data` is the
  APDS Observation; `subject` references it. Implementations claiming
  `apx-lpr` MUST publish it; implementations serving `POST /observations`
  writes SHOULD publish it regardless.

**The full-fidelity export recipe (informative).** An analytics platform
that wants *everything* about a location combines three mechanisms, all
already normative: (1) bulk/exactly-once history via the Part 5 change
feed (`mode=change&cursor=…`) on every native route — sessions, rates,
rights, observations; (2) real-time push via one Part 8 subscription
mixing APDS EventTypeEnum topics with the APX topics above plus
`apx.data.occupancy.v1`, alert, and command topics; (3) point-in-time
convenience reads (occupancy §5.5, lane inquiry §6.2). Nothing about a
place that APX models is unreachable by feed.

## 13.5 Site binding on aggregating implementations (normative)

Payments, accounts, and LPR reads must remain attributable and isolated
per location when one endpoint fronts many places (Part 8 §8.5, Part 9
§9.3):

1. `PaymentRecord.place` and `LprRead.place` are REQUIRED — every payment
   and plate read names the HierarchyElement it belongs to, in API
   responses and in event payloads alike. `Account.places` SHOULD be
   populated where accounts are place-scoped.
2. **Grant enforcement on place-less lookups.** `GET /v1/accounts`,
   `GET /v1/payments`, and `GET /v1/lpr/reads` need no place parameter,
   but their results MUST be constrained to records whose place binding
   (or, for accounts, any of whose `places`) falls inside the caller's
   `apx_places` grant. A credential granted one garage searching by
   name, plate, or truncated card MUST NOT see records from any other
   location. The scope check alone is NOT sufficient authorization for
   these routes. Under an absent or empty grant these lookups return
   `200` with an empty `data` array, never 403 (Part 9 §9.3a(3)); a
   lookup by id (`GET /v1/accounts/{id}`, `GET /v1/payment-links/{id}`)
   of a record at an ungranted place is `403 insufficient-grant`
   (§9.3a(1)).
3. `GET /v1/accounts` and `GET /v1/payments` declare an optional `place`
   query parameter (comma-separated HierarchyElement ids,
   subtree-inclusive) that narrows results below the grant, the pattern
   established by `/v1/reservations/recent` (Part 14 §14.1a). A `place`
   outside the grant is `403 insufficient-grant`. Implementations that do
   not implement narrowing MAY ignore it.
4. **LPR lookups outside the grant** (Part 9 §9.3a). `GET /v1/lpr/reads`
   declares the item 3 `place` parameter (the HierarchyElement and its
   subtree). A lookup keyed by a value — `plate`, `ticket`, or an
   `observation` id — returns only in-grant reads and is never 403 on
   the key's account: under an empty grant it is an empty 200, so the
   answer never confirms that a plate was seen somewhere the caller may
   not look. A lookup that names an entity outside the grant —
   `place=` on the reads, `lane=` or `session=` on `/v1/lpr/candidates`
   — is 403 `insufficient-grant`.

## 13.6 PaymentRecord ↔ APDS Payment mapping (normative)

APDS 4.1 defines `Payment` — a settled-payment *record* embedded in the
rights/session model, requiring `serviceProvider` and `paymentLines[]`.
APX's `PaymentRecord` is not a parallel definition of that concept but the
*action record* of taking a payment: addressable, idempotent, and able to
represent outcomes APDS's Payment cannot (declined, reversed). The two
relate field-by-field:

| APX `PaymentRecord` | APDS `Payment` | Note |
|---|---|---|
| `id` / `version` | `VersionedIdentity` (allOf) | same identity shape |
| `transactionID` | `transactionID` | identical meaning |
| `dateCollected` | `dateCollected` | identical (`dateAuthorised` has no APX field; authorization time is the record's creation) |
| `amount` | `paymentLines[].value` summed | APX carries the total; line itemization stays APDS-side |
| `method` | — | APX-only (PCI-safe method label; APDS has no per-payment method) |
| `paymentStatus` | — | APX-only; APDS Payment records only collected payments — `approved` with `captureStatus` `captured` (or absent) is the only state that maps |
| `captureStatus`, `captureLater` | — | APX-only (§13.1a); a hold (`captureStatus: authorized`) is not materialized until it is captured |
| `refundedAmount` | — | APX-only lifecycle member (§13.1a); APDS `PaymentTypeEnum` has no refund value, so a partial refund is visible only on the APX surface |
| `account` | `idCode` / RightHolder linkage | correlation, not identity |
| `place` | — | APX-only site binding (§13.5) |
| `ticketNumber`, `cardLast4`, `postings` | — | APX-only call-center/AR surface |
| — | `serviceProvider` | APDS-required; populated by the implementation when materializing |

**Materialization rule:** an implementation that persists APDS `Payment`
entities MUST materialize every `approved`, captured PaymentRecord (a hold
only once it is captured) as (or bind it
to) a native `Payment` with a `paymentLines` entry of `paymentType:
payment` and `value` = `amount`, so plain APDS consumers see the money
without speaking APX. Declined and reversed records exist only on the APX
surface — APDS has no vocabulary for them, which is precisely the gap
`PaymentRecord` fills.
