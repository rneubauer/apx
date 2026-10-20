# Changelog

All notable changes to the APX standard. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow the
conformance/versioning rules in Part 3 of the written standard.
The machine-readable spec (`spec/openapi/apx.yaml`, bundled as
`spec/dist/apx-v1.*`) is normative; entries here are informative.

## [Unreleased]

One additive normative change: the bundle now mounts the APDS 4.1 native
routes `GET`/`PUT`/`DELETE /observations/{id}` and `GET /quotes/{id}`,
which it had left out. The other bundle edit is editorial: the `DeviceStatus`
description now says exactly how device states relate to APDS
`RefillPointStatusEnum`, which covers refill points only. The reference simulator now covers the Part 19 behaviour
adopted in 0.14.0, and the vetting suite cites every APX-VIO row. Part 12's
problem-type table loses a stray merge-conflict marker (editorial; no row
changed).


**Compatibility.** Part 25 adds the value `ui` to
`AllowedAction.execution.type`, which appears in three resolution-context
responses. The oasdiff gate counts a new response enum value as breaking, so
the three findings are listed, with this reason, in
`spec/oasdiff/err-ignore.txt`. Part 17 §17.3 gains rule 6: a client MUST
skip an execution type it does not recognise, so the value set can keep
growing additively.

**Added.**
- **Part 25, UI launch** (optional class `apx-ui-launch`, Annex A.23).
  A vendor's own screens, named per module in the new `apx-ui-surfaces`
  registry (`lane.console`, `reservation.detail`, `violation.appeal`,
  `toll.dispute`, …), opened for an agent with automatic login: a
  handshake (`POST /v1/ui/launches` returns a single-use URL valid 60 s)
  or a signed JWS token (`ES256`/`RS256`, `exp` ≤ 60 s, form POST or URL
  fragment). The `UiLaunch` lifecycle `issued → opened → closed |
  expired`, and the loopback rule: everything done on the screen comes
  back as the native APX record (command, refund, redemption…) carrying
  the launch's `correlationId` and agent, or, where no APX operation
  exists, as a `UiActionRecord` with the `returnFields` the host asked
  for and `unavailable[]` for the rest. `AllowedAction.execution.type`
  gains `ui`; discovery gains `uiSurfaces[]`; topics
  `apx.ui.launch.changed.v1` and `apx.ui.action.recorded.v1`; scopes
  `apx.ui:launch`, `:read`, `:record`; problem types
  `ui-surface-unknown`, `ui-display-mode-unsupported`,
  `ui-launch-expired`, `ui-launch-closed`.
- **Part 26, Site configuration** (optional class `apx-site-config`,
  Annex A.24): a location described from APX alone. Four Level B
  decorations: `apds-ext:apx:equipment-detail@1.0` on every
  SupplementalEquipment, with a `role` from the fixed
  `apx-equipment-roles` list (thirty codes: `gate`, `accessDoor`,
  `ticketDispenser`, `exitVerifier`, `cardReader`, `camera`, `intercom`,
  `videoGateway`, …) beside the untouched APDS `equipmentType`, plus
  manufacturer, model, firmware and software versions (RECOMMENDED),
  serial, MAC addresses, `area` (`apx-area-types`, nineteen codes from
  `lane` to `elevator`), `level`, `lane`, `builtInto`, `controls[]` and
  `serviceProvider`, and a note on why IP addresses are left out;
  `apds-ext:apx:camera@1.0` (mounting, `view[]` from `plate` to
  `equipmentInteraction`, facing, recorder, streams, retention, a
  `credentialRef` that is never a secret); `apds-ext:apx:external-ids@1.0`
  (typed `{system, id}`, the issuer names itself by URI);
  `apds-ext:apx:place-operations@1.0` (`commsAccountId`, escalation
  contacts as roles only). The `CommsPoint` resource: intercom, analog
  dialer, posted number, kiosk, QR code or app, with `phoneNumber` (the
  number called when help is requested), `callerId` (the number the
  device calls out as) and `commsDeviceId`, the gate or door it `serves`,
  and coverage; SIP data deliberately left out. Routes `GET /v1/equipment`,
  `GET/POST/PUT/DELETE /v1/comms-points`, `POST /v1/identifiers:resolve`,
  `POST /v1/cameras/{id}/views` (live, snapshot, playback as single-use
  links ≤ 5 min; features `cameraViews`, `cameraPlayback`); topics
  `apx.equipment.changed.v1`, `apx.commspoints.changed.v1`; registries
  `apx-equipment-roles`, `apx-area-types`, `apx-comms-point-types`,
  `apx-escalation-roles`; problem types `camera-view-unavailable`,
  `playback-range-unavailable`, `comms-point-unknown`. The after-hours
  access door is walked through in §26.8.
- Part 9: §9.7 integration secrets (no read, event or feed carries a
  PARCS key, camera or device password, in any member or nested text;
  secrets are named, never carried; a write that carries one is refused)
  and §9.8 launch material and view links.
- Part 17: §17.1 resolve request gains `reservationIssuer`,
  `guestReference` (hotel room, company, tenant, event), `commsPoint`,
  `callerId`, `dialedNumber`, `commsDeviceId`, and the telephony layering
  rule is amended for comms points; §17.3a approval requests
  (`POST /v1/approvals`, `…/{id}/decide`, `apx.approvals.changed.v1`,
  `approval-closed`), the decided request cited as `approvalRequest`
  evidence; §17.6 `apx-interaction-outcomes` for
  `SupportInteraction.resolution.code`; `apx-issue-types` v2 adds the
  twenty-three issues at least five of ten operator call centers share,
  from a six-month sample of 176,860 calls.
- Part 6: `DeviceStatus` gains `fault`, `consumables[]` and
  `maintenanceMode`; `apx-command-types` v6 adds `ejectTicket`,
  `cancelTransaction`, `reprintReceipt`.
- Part 7: §7.7 alert types `consumableLow`, `receiptRequested`,
  `refundRequested`, `citationInquiry`, `damageReported`,
  `customerCallbackRequested` (`apx-alert-types` v6); `Alert` gains
  `supportInteraction`.
- Part 13: `POST /v1/payments/{id}/receipt` (`receipt-channel-unsupported`)
  and refund `reasonCode` from `apx-refund-reasons`. Part 14:
  `ReservationSummary` gains `issuer` and `amountPaid`. Part 16:
  `placeCapabilities[]`.
- Native routes `GET`, `PUT` and `DELETE /observations/{id}` and
  `GET /quotes/{id}`, mounted verbatim from APDS 4.1. Earlier text (LPR
  findings F-LPR-12 and F-LPR-16, and the `observation` parameter of
  `GET /v1/lpr/reads`) said APDS lacked them; it does not. The data
  overlay gives them the shared 401/403/429 and the problem+json
  alternative, and gives `PUT /observations/{id}` the §5.1 update modes,
  a request body and a 400, which APDS leaves out (candidate C-026 in
  `docs/apx-specification/06-apds-requests.md`, not yet filed). A
  replacement through the native `PUT` publishes
  `apx.data.observation.updated.v1`. `PUT
  /v1/lpr/reads/{observation}/access-event` and `?observation=` stay. Both
  routes join the PARCS Starter Profile, and the simulator implements
  them.
- `docs/apds-submission/`: the APX Data Specification for the APDS
  committee, in the form of the APDS 4.1 documents: an Overview, an
  Information Model, a Data Dictionary in the APDS table format, and a Use
  Case Document numbered C.3. It covers every data element and enumeration
  the APX API needs, in three tiers, and no API. The documents are
  generated from `spec/proposals/apds-additions/*.yaml` and prose in
  `docs/apds-submission/src/` by `tools/build-apds-submission.mjs`, which
  checks every type against the names in the APDS 4.1 Data Dictionary and
  refuses anything APDS already defines. `npm test` and CI run it with
  `--check`. The README now says the API is APX's preferred implementation
  specification, kept separate from the data-element proposals.
- `docs/apx-specification/`: the APX Specification document set, in the
  form of the APDS 4.1 documentation, covering everything in the API and
  everything APX asks of APDS: 01 Overview, 02 Information Model (module
  narratives with generated class diagrams), 03 Data Dictionary (every
  class, attribute, association, enumeration and code list, in the APDS
  table format), 04 Use Case Document (the 32 scenarios), 05 Interface
  Specification (every operation and webhook) and 06 Requests to APDS
  (errata, Data Dictionary differences C-015 to C-026 as unfiled
  candidates, new enumeration values, the proposed data elements and other
  suggestions). 02, 03, 05 and 06 are built from `spec/dist/apx-v1.yaml`
  and `docs/apx-specification/src/` by `tools/build-apx-docs.mjs`;
  `npm test` and CI run it with `--check`. `npm run apxdocs:pdf` renders
  print-ready PDFs.
- `tools/check-apx-docs-coverage.mjs`, run by `apxdocs:check`: reads the
  bundle and the registries directly and fails if 03 Data Dictionary lacks
  any APX class, member, enumeration value or code-list entry (today 150
  classes, 1,638 members, 515 values, 294 entries, all present).
- Print editions closer to APDS 4.1: covers without running header or
  footer, class diagrams at their natural size instead of stretched to the
  page width, and Data Dictionary tables on landscape pages from clause
  A.1 with the APDS column widths and each class name on its first row
  only (the web edition gets the same widths).
- Partner/vendor guide: a section on offering your own screens through
  Part 25 UI launch (surfaces, automatic login, reporting actions back).
- Docs overlay: the Charging tag joins the "Vehicles and access" group, so
  the reference navigation shows the charging routes (editorial).
- APDS change requests: the suggestion to add `GET`/`PUT
  /observations/{id}` is withdrawn; APDS 4.1 already defines both.
- `docs/data-model-by-domain.md`: every APX schema placed on the APDS
  high-level data map (APDS, extension, new element, or API-only), with
  exact required fields, plus a proposed Tier 1 shortlist of data elements
  for ISO TS 5206-1 with required and optional attributes.
- APDS change requests, Part B: a suggestion to add lane equipment
  (`gate`, `barrier`, `ticketDispenser`, `intercom`) to
  `EquipmentTypeEnum`. Part B rows are now checked against the APDS 4.1
  Data Dictionary as well as the API document: `lprCamera`, a `refund`
  payment type and an identifiable `RightHolder` are already in the
  Dictionary, and the rows say so.
- `packages/simulator` now implements every operation in the bundle
  (185/185): Part 24 plate lists (lists, entries, the change feed on both,
  `apx.platelists.changed.v1`, arrival alerts), the LPR read routes
  (`GET /v1/lpr/reads/{observation}`, `POST /v1/lpr/reads:search`,
  `PUT /v1/lpr/reads/{observation}/plate`), `GET /v1/digest-keys`,
  `POST /v1/enforcement/eligibility:check`, `POST /v1/accounts:search`,
  `POST /v1/payments:search`, and `GET /v1/places/{id}/occupancy/history`.
  It also fixes the stock APDS plate lookup on `/rights/assigned` for
  rights held through a CredentialRecord (§14.2b), prices quotes from the
  rate tables, offers the §5.2 change feed on the APX list routes, and
  raises `occupancyThresholdExceeded` on a threshold crossing.
- Simulator UI: a **Fabric** view showing Part 8 delivery live, with a
  traffic generator (`/sim/traffic`), endpoint fail and recover, and SSE
  drop and reconnect. There are now twenty narrated demos, including five
  analytics demos in a new `analytics-lakeside` world and a plate-list
  demo. The README, quickstart, overview, executive summary and scenarios
  index link to the hosted simulator at
  <https://rneubauer.github.io/apx/simulator/>.
- `packages/simulator`, apx-violations: `POST /v1/enforcement/violation-imports`
  (Part 19 §19.13 rules 1–4). It is keyed on the source's `system` +
  `recordId`. A higher `sourceRevision` (else a later `sourceUpdatedTime`)
  updates the record, the same revision is a no-op 200, and an older one is
  409 `version-conflict`. `statusHistory[]` is append-only, with source
  times kept. `paid` below `amount` and a payment in another currency are
  422. Imports get no eligibility check or policy clamp, a warning is
  `issued` at zero, and the first import publishes `detected.v1` (plus
  `issued.v1` at or past issuance).
- `POST /v1/violations/{id}/session` (§19.13 rule 6): sets, corrects, or
  clears the link (`session: null`), in any state. `If-Match` is honoured.
  Evidence is written as `apds-ext:apx:match-evidence@1.0` targeting the
  Session. A repeat is a no-op, and there is no `statusHistory[]` entry. An
  unknown Session is 422 `reference-unknown`, and one outside the place
  hierarchy is 422 `request-unprocessable`.
- Partial payments (§19.6a): `payments[]` and `amountPaid` on every
  attachment, `paid` only when `amountPaid` ≥ `amount`, a part payment
  noted in `statusHistory[]` while the violation stays `issued`, an appeal
  reduced to no more than `amountPaid` settling it (`paid`), and refunds
  on appeal resolution and void reducing `amountPaid`.
- The §19.4 issuance gates, in every detection mode: lenient or unapplied
  match evidence (the Violation's decoration, or the related Session's
  `session-detail` `matches[]` entry) and LPR reads whose plate review is
  `pending` or `rejected` refuse `issue` with 409 `violation-not-issuable`.
- `sourceSystem` / `sourceRecordId` filters on `GET /v1/violations`, and
  `POST /v1/violations:search` with the same filters. `until` is now
  exclusive, as declared.
- Vetting scenarios VIO-30 to VIO-34 restored, plus two new ones. VIO-35
  covers a read in review, a rejected read, and a shadow match on the
  Session. VIO-36 covers a warning imported at zero, found by its source
  record, then linked, relinked unchanged, cleared, and relinked after void.
  The suite now has 386 scenarios, and apx-violations cites Annex A
  APX-VIO-13 to 17 (17/17). The world adds the fixtures these scenarios
  read, and `test/violations.test.mjs` adds 24 unit tests.

**Fixed.**
- `DeviceStatus` (spec), Part 6 §6.4, Part 11 and the `apx-device-states`
  registry said device states mirror an APDS `RefillPointStatusEnum`
  without saying where it lives. It is in the APDS 4.1 Data Dictionary
  (A.3.53, on `RefillPoint.status`) but not in `apds-api-4.1.yaml`, and it
  covers refill points only. They now say so, and that APX device states
  follow its style and share four of its values. No value changed.
- Simulator: `PUT /v1/sessions/{id}/assigned-right` refused a right
  already linked to another open session only when the right carried the
  reservations extension (RES-13).
- Simulator: `PUT /v1/sessions/{id}/plate` now applies the decision of
  the live resolution context that evaluated the plate action
  (Part 17 §17.3 rule 3): `allowed: false` is 403 `action-not-allowed`,
  and `requiresApproval` without `approval` is 403 `approval-required`
  (RES-18).
- Simulator: world-seeded resolution contexts with no pinned subjects no
  longer throw on every recompute.
- Replay stage directions: RES-18 opens its context as `plateUnresolved`,
  as its prose says. RES-23 restores session `c4…0041` to fixture version 3,
  which RES-11 had already advanced in the shared replay.
- Vetting scenario EVT-07: the stream request for the `webhook`
  subscription `e8…0003` now expects 404 `target-not-found`, not 410.
  Part 8 §8.4 checks `transport` before state.
- Vetting scenario RES-05: an undelivered `channel` is 422
  `request-unprocessable` (Part 13 §13.1a and the operation's 422), not
  400. The 400 is kept with §13.1a's other case, a body that names
  nothing to settle.

## [0.14.0] — 2026-10-12

**Added.**
- **EV charging (Part 23, optional class `apx-charging`)** merged from
  `beta/ev-charging` and registered: the parking-side view of charging,
  not a charger protocol (OCPP) or a roaming protocol (OCPI), whose
  identifiers ride along opaquely. APDS 4.1 already has the static
  infrastructure (`ElectricChargingEquipment`, `ElectricChargingPoint`,
  `Connector`, the IEC enums, `kWh`, `refillPointIndex`,
  `electricVehicleOnly`), all reused by `$ref`. New: `ChargingPointStatus`
  (live availability per point and connector in the OCPI status
  vocabulary, `currentSession`, `reservedFor`, and `bay` presence);
  `ChargingBayPresence` (what the overhead camera, sensor, or attendant
  sees — `empty | vehiclePluggedIn | vehicleNotPluggedIn | blocked`,
  fused with the charger's connector state by a normative table so "car
  in the EV bay, not plugged in" and "bay blocked" are first-class facts
  with the Observation as evidence); `ChargingSession` referencing the
  APDS Session for the stay — authorization (APDS
  `AuthenticationAndIdentificationEnum`), the OCPP-aligned lifecycle
  `authorized → pluggedIn → charging ⇄ suspended → complete → idle →
  unplugged → closed` with server-side `idle` after a snapshotted
  `idlePolicy` grace, energy and state of charge, cost breakdown, and
  three settlement modes (`parkingSession` one bill at exit,
  `directPayment`, `chargingNetwork`); `ChargingEvent` (the bridge's
  ingest, one per OCPP TransactionEvent). Nine operations under
  `/v1/charging`; scopes `apx.charging:read`/`:manage` and the customer
  `apx.charging:status` (minimized). Additive cross-links:
  `ValetTicket.charging` (Part 22 §22.9), `OccupancySnapshot.evCharging`
  (Part 5 §5.5). Charger control through the Part 6 command plane
  (§6.8). Scenario 26 (ICE in the bay caught by the camera, free-vend
  charge attributed to the parking session by bay LPR, idle after
  complete, `unlockConnector`, one bill at exit). Registered in this
  change: `apx-conformance-classes` v7 (`apx-charging`), `apx-topics` v11
  (`apx.charging.session.status.v1`, `apx.charging.idle.started.v1`,
  `apx.charging.point.status.v1`), `apx-command-types` v4
  (`startCharging`, `stopCharging`, `unlockConnector`), `apx-alert-types`
  v4 (`evBayNotCharging`, `evBayBlocked`), `apx-violation-types` v2
  (`chargingBayIdle`), and Part 12 problem types
  `charging-transition-illegal`, `charging-point-unavailable`,
  `charging-settlement-conflict`; Annex A.21 rows are claimable.
- **What an external pairing engine needs to write back.** Twenty-one gaps
  found splitting an edge pairing engine from a cloud core
  (`docs/apx-additional-functions/APX-gaps-2026-10-08.md`, G1–G21),
  adopted as follows. All additive.
  - Session detail (G1–G4, Part 5 §5.8): decoration
    `apds-ext:apx:session-detail@1.0` (`SessionDetail`) on the APDS
    Session — the reads behind the visit with roles, `lifecycle`,
    `closure` (end reason from new registry `apx-session-end-reasons` v1,
    inferred end, `startObserved: false` for exit-only Sessions, which
    consumers exclude from dwell and occupancy), `matches[]`
    (`MatchEvidence`: `matchType` from a closed set — `right`, `valet`,
    `violation`, `list`, `exitPairing`, `sweep`, `other` — plate method,
    edit cost, vehicle evidence level, shadow matches, `decidedBy`
    `system | person`, no plate characters), and `parent`/`passThrough`
    for area Sessions. The same `MatchEvidence` is
    `apds-ext:apx:match-evidence@1.0` on Violation and ValetTicket, and
    both ends of one link MUST agree. New problem type
    `read-already-bound` (409). A write is 422 `request-unprocessable`
    for two `representative` reads, a `lifecycle` that disagrees with
    `actualEnd`, or a `parent` whose element is not an ancestor, and 422
    `reference-unknown` for a read naming no visible Observation; the
    data overlay declares the 422 and the `read-already-bound` 409 on
    `POST /sessions` and `PUT /sessions/{id}`. `final` is never a lock;
    a server that pairs reads itself SHOULD write the same block; exit-only
    Sessions SHOULD set `actualStart` equal to `actualEnd`; children SHOULD
    close with `parentExit` by the parent's end. A Violation whose Session
    link rests on `lenient` or unapplied evidence is not issuable (Part 19
    §19.4 rule 5, a MUST for every server).
  - Read review (G5, Part 13 §13.3a(4a)): `PUT /v1/lpr/reads/{observation}/plate`
    (`PlateCorrection`: confirmed, corrected, rejected; plate values only
    with `corrected`, else 422; the same decision and values a no-op)
    and `LprReadDetail.review` with reasons from new registry
    `apx-read-review-reasons` v2 (v1 plus `conflictingReads`); the
    engine's values kept once, with confidences, in `review.original`.
    Part 19 §19.4 rule 6 refuses to issue, for every detection mode,
    while an evidence read is pending or rejected.
  - Violations issued elsewhere (G6, Part 19 §19.6a, §19.13):
    `POST /v1/enforcement/violation-imports` (outside `/v1/violations/`
    so no literal segment sits beside `{id}`; its own `ViolationImport`
    body; keyed on `system` + `recordId`, `sourceRevision` or else
    `sourceUpdatedTime` ordering, decoration
    `apds-ext:apx:violation-source@1.0`; `notice` and `amount` required
    at or past `issued`, `paid` below `amount` refused, history
    append-only), `sourceSystem`/`sourceRecordId` filters on
    `GET /v1/violations`, `POST /v1/violations/{id}/session` to set,
    correct, or clear the Session link later with evidence in any state,
    and partial payment (`payments[]` of `ViolationAppliedPayment`,
    `amountPaid`, the attachment's `amount`). The `Violation`
    sub-objects `detection`, `vehicle`, `evidence`, and `location` are
    now named schemas; the wire shape is unchanged.
  - Change feed on APX lists (G7, Part 5 §5.2 rule 8): `mode=change&cursor=`
    on eighteen `/v1` list routes of stateful resources (commands, alerts,
    accounts, payments, toll transactions, violations, enforcement
    policies and signage, validation programs, issuances, redemptions and
    statements, credentials, access events, valet tickets, charging
    sessions, plate lists and their entries), each a MUST of the class
    that owns the route. The change page is the route's own list envelope
    with optional `updateMode`, `cursor`, `deleted`, `grantAdditions` and
    `next` members (new schemas `ChangeFeedUpdateMode`, `ChangeFeedCursor`,
    `ChangeFeedTombstones`, `ChangeFeedGrantAdditions`, `ChangeFeedNext`)
    and no `meta`, so no existing response is re-typed; a refused cursor
    is the shared `CursorRefused` 404. Items are whole current
    representations, never an older state after a newer one; no cursor
    returns an empty page holding the head cursor; a filtered feed carries
    a change when the resource matched before or after it; tombstones
    cover retention purges and moved places. The payment feed needs no key
    and no 8-hour window, shows holds from capture, and refuses
    `ticketLast4`/`cardLast4` (Part 13 §13.2). Annex A APX-CORE-18 (revised)
    and APX-PHX-02.
  - Payment detail (G8, Part 13 §13.6a): decoration
    `apds-ext:apx:payment-detail@1.0` with `rateSold` and `lines` that
    reuse APDS `PaymentLine` by `$ref`, the line code in `idCode`; new
    registry `apx-payment-line-codes` v1 (`base`, `convenienceFee`,
    `serviceFee`, `tax`, `discount`, `validation`, `idle`, `energy`). A
    `validation` line is `paymentType: validation` (the value offset, not
    money collected); every other code is `paymentType: payment`, a
    `discount` negative. The `payment` lines MUST sum to `amount`, else
    422 `request-unprocessable` with nothing charged; refunds never
    rewrite the lines; the decoration is returned unchanged on reads and
    events; no zero-fee line is inferred. One store: on a native APDS
    `Payment` the decoration carries `rateSold` only, and a materialized
    record's lines become its `paymentLines` unchanged (§13.6). The data
    overlay declares `extensions` on `Payment` (erratum 010 workaround,
    now nine entities). Annex A APX-ACC-07 amended, APX-ACC-09 expanded;
    a Part B suggestion in `docs/apds-change-requests.md` offers the code
    list and the rate-sold member to APDS. Worked scenario 32.
  - Permit concurrency (G9, Part 14 §14.2d): `apds-ext:apx:permit@1.1`
    adds `maxConcurrentVehicles` and `overageBilling`.
  - Plate lists (G10, new Part 24, class `apx-plate-lists`): six
    operations under `/v1/plate-lists`, change feed on lists and entries,
    topic `apx.platelists.changed.v1`, registry
    `apx-plate-list-categories` v1, scopes `apx.platelists:read`/`:manage`,
    Annex A.22.
  - Credential digests (G11, Part 9 §9.6 rule 6, optional): decoration
    `apds-ext:apx:credential-digest@1.0` and `GET /v1/digest-keys` under
    new scope `apx.digest:use`. Specified as MAY, pending the operator
    decision the brief names.
  - Replication (G12, Part 18 §18.6): authority per place and class in
    `DiscoveryDocument.replication[]`, `RecordInfo.origin`, scope
    `apx.replication:write`, origin-scoped idempotency keys, new problem
    type `not-authoritative` (409).
  - Display proof (G13, Part 6 §6.1, §6.1a): `displayMessage` template
    parameters and `CommandResult.display`.
  - List-arrival alerts (G14, Part 7 §7.6, Part 8 §8.5a): `watchListArrival`,
    `scofflawArrival`, `refusedServiceArrival` (`apx-alert-types` v5) and
    `SubscriptionFilters.alertTypes`.
  - Occupancy history (G15, Part 5 §5.5a):
    `GET /v1/places/{id}/occupancy/history` (`OccupancyHistoryPage`).
  - Keys in bodies (G16, Part 9 §9.6 rule 7): `POST /v1/lpr/reads:search`,
    `/v1/accounts:search`, `/v1/payments:search`, `/v1/violations:search`,
    `/v1/enforcement/eligibility:check`. The Spectral path rule now
    accepts a trailing `:verb` segment.
  - Read-back by path (G17): `GET /v1/lpr/reads/{observation}`.
  - Images (G19, Part 13 §13.3c): `LprRead.images[]` with kinds
    `plateExtended` and `context`.
  - G18–G20 and a Session end reason are also new suggestions in Part B of
    `docs/apds-change-requests.md`. Registries bumped:
    `apx-conformance-classes` v8, `apx-topics` v12, `apx-alert-types` v5.
    Annex A rows APX-CORE-17 to 20, APX-DATA-09 to 11, APX-EVT-08,
    APX-CTL-15, APX-ALT-07, APX-ACC-08/09, APX-LPR-07 to 11, APX-PRM-03,
    APX-VIO-13 to 17, APX-PLL-01 to 06.
- `packages/simulator`: a stateful simulator of every APX and APDS-native
  route in the bundle, with a simulated clock, the Part 8 event fabric,
  and one behaviour module per conformance class. It replays the
  by-module vetting suite (`node bin/apx-sim.mjs replay`) and runs
  scripted scenarios; see its README.
- `docs/apds-change-requests.md`: the change requests for the APDS working
  group (errata 001–014, five optional additions, a suggested order),
  linked from the landing page and the errata README.
- The vetting suite is now public: 379 scenarios in
  `docs/scenarios/by-module/`, one folder per conformance class with its
  findings (221), linked from the worked scenarios. `npm run vetting`
  checks every request and response against the bundle. DATA-34 (session
  detail and match evidence on a pairing client's Session) is new; the
  module table is refreshed from `npm run vetting`.
- Worked scenarios 28–32, written against the gap work above: 28 a
  pairing client's session detail and match evidence (Part 5 §5.8), 29
  plate review on an LPR read (Part 13 §13.3a(4a)), 30 a citation
  imported from another enforcement system with a part payment and a late
  session link (Part 19 §19.13), 31 an enforcement back office catching up
  on the change feed after three days offline (Part 5 §5.2 rule 8), 32
  payment detail and the revenue report (Part 13 §13.6a).
- The next round in the open: 150 proposed operational cases drafted by
  ChatGPT, with the brief they came from, in `docs/scenarios/proposed/`
  (unverified, awaiting triage).
- `apx-access-denial-reasons` v2: `credentialNotYetActive`, for a
  credential presented while still `issued`. Part 21 §21.4 promised one
  denial reason per non-active lifecycle state and `issued` had none.
  A registry addition, so no new edition is needed (Part 11 §11.3).

**Changed.**
- Part 13 §13.3a(1) (G20): a read whose plate country is unknown keeps
  make, model, and colour in `detail` and omits
  `vehicleAncillaryIdentification`, instead of dropping them.
- Part 13 §13.3a(7) and Part 9 §9.6 rule 1 (G21): the passage facts of a
  read (`accessEvent`, `movement`, `plateFace`, `frameReads`,
  `platesRead`, `captureGroup`, `speed`, `engine`) are served under
  `apx.data:read`, including on the observation topics; plate-bearing
  members stay under `apx.lpr:*`.
- Scenario headers: three vetting exchanges gained the http block the
  prose already described (accounts ACC-25, valet VLT-15, reservations
  RSV-06), found by replaying the suite against the simulator.
- Negotiated rates can push any amount (Part 6 §6.3, §6.6). A new
  optional feature, `negotiatedAmounts` (registry `apx-features` v2,
  offered only with `negotiatedRates`), lets `pushNegotiatedRate` carry
  `parameters.amount` instead of a table: the amount the current ticket
  owes, with no floor or ceiling, zero included. `agent` and `reason`
  are REQUIRED with an amount; both or neither member, a negative value,
  or another currency is `400 invalid-request`; an amount on a host
  without the feature is `422 rate-not-negotiable`. The lane inquiry
  reports a stated amount in a new optional sibling,
  `currentTicket.negotiatedAmount` (`amount`, `reason`, `agent`,
  `command`), so `currentTicket.negotiatedRate` and its required
  `rateTable` are unchanged and the schema change is purely additive; a
  ticket shows at most one of the two. `result.amountDue` restates the
  amount. §6.3's design rule now
  names this as the one single-ticket price change outside validations,
  attributable to an agent with a reason. `apx-command-types` v5
  (description only), Annex A APX-CTL-16, vetting scenario CTL-26. This
  reverses the 0.10.0 "selection, not invention" rule, deliberately.

## [0.13.0] — 2026-09-29

A mechanical audit of every Part against the bundle, Annex A, and the
registries, run ahead of the APDS working-group review.

**Changed (breaking).**
- `PaymentRecord.method` is replaced by two members. `meansOfPayment` is
  APDS `MeansOfPaymentEnum` by `$ref`: APX had its own `card | cash |
  other` list for a concept APDS already names, which Part 4 §4.4
  forbids. `channel` (`lane | payStation | agent | autoAttendant | online
  | other`) says where the payment was captured; `autoAttendant` moves
  there, since it was never a means of payment.

**Added.**
- Registries `apx-access-denial-reasons` (the ten seeded Part 21 values,
  now also the vocabulary of the lane inquiry's
  `monthlyCredential.denialReason`, which was an untyped string) and
  `apx-features` (`negotiatedRates`, `ticketMatching`). Both lists were
  previously only in schema descriptions.
- Part 11 §11.1a: the rule for choosing a vocabulary's form (APDS enum,
  APX enum, registry, or plain string). Vendor features are named
  `<vendor-ns>-<feature>` (Part 16 §16.1).
- Annex A rows for normative text that had none: APX-CORE-13 to 16,
  APX-ALT-06, APX-ACC-07, APX-RES-09.
- Erratum 014 (APDS has no identifiable RightHolder), filed as
  parkingdata/spec#47, and Part 1 §1.3
  item 14 describing the `className: "RightHolder"` convention.

**Fixed.**
- The toll dispute `reason` and `resolution` fields now name their
  registries; the registry-entry issue template lists all eleven
  registries; the cover letter's scenario and errata counts are current.

## [0.12.2] — 2026-09-28

A cross-module check of every refusal the private vetting scenarios
claim, run against the schema directly, found that the six native `PUT`s
accepted any body carrying an `id`. This release closes that and one
smaller gap.

**Fixed.**
- Native `PUT` bodies are checked again. They are
  `anyOf [<native schema>, ChangePayload]` because the `APX-Update-Mode`
  header picks the shape; the generic `ChangePayload` requires only `id`,
  so a full-mode body with wrong types, unknown members, or malformed
  `extensions` validated through the change branch. Each route now uses a
  typed change payload derived from its class at build time
  (`HierarchyElementChangePayload`, `ContactPointChangePayload`,
  `RightSpecificationChangePayload`, `RateTableChangePayload`,
  `SessionChangePayload`, `AssignedRightChangePayload`;
  `tools/change-payloads.mjs`): every member optional and nullable,
  scalars typed as the class types them, `extensions` bound, unknown
  members refused. Part 5 §5.1a now requires a validator that knows the
  header to apply that branch alone. The generic `ChangePayload` remains
  the shape of change-feed items.
- `ViolationAppealResolution` enforces in the schema what Part 19 already
  said: a `reduced` resolution requires `adjustedAmount`.
- Part 1 §1.3 erratum 013 notes that devices (`SupplementalEquipment`)
  are unmapped like lanes; the overview's enforcement routes name their
  `PUT …/{id}` paths.

## [0.12.1] — 2026-09-28

Re-vetting the LPR module against 0.12.0 found that the edition named a
route that does not exist and that APX's own decorations were never
checked on the wire. This release fixes both. Every change is additive
for conforming payloads; payloads whose APX decoration values contradict
their own schemas, which were never conformant, now fail validation.

**Fixed.**
- The `accessEvent` revision route. 0.12.0 told the LPR system to revise
  a read through native `PUT /observations/{id}`, which APDS 4.1 does not
  have (only `GET` and `POST /observations`), so
  `apx.data.observation.updated.v1` could never fire. New
  `PUT /v1/lpr/reads/{observation}/access-event` (`apx.data:write`,
  `If-Match`, stale → 409 `version-conflict`, the current value → a
  no-op) writes the value into the Observation's decoration, increments
  its `version`, and publishes the updated event (Part 13 §13.3a(4),
  §13.4, Part 8, Annex A APX-LPR-04). Scenario 27's correction step uses
  it.
- APX decorations are validated wherever they appear. The `Extensions`
  container bound no key to a schema, so `lpr-read` with `speed: -1` or
  `accessEvent: "sideways"`, and `lane-cameras` with `faces: "upward"`,
  all passed. `Extensions` now binds `devicestatus`, `ratepolicy`,
  `lpr-read`, `lane-cameras`, `reservation`, and `permit` to their schemas
  (Part 4 §4.3). Part 4's own example, which omitted `device` from
  `devicestatus`, is corrected.
- A duplicate `cameraId` within a Place is refused with 422
  `request-unprocessable`, now declared on native `POST /places` and
  `PUT /places/{id}` (Part 13 §13.3a(5), Annex A APX-LPR-05).

**Added.** Erratum 013: APDS 4.1's `HierarchyElement` discriminator maps
only `campus`, `place`, and `space`, so `VehicularAccess` — the lane —
validates as a bare `HierarchyElement` and its `accessType` is never
checked. Filed upstream as parkingdata/spec#46.

## [0.12.0] — 2026-09-28

LPR reads say what happened; APX no longer derives what it means. An
implementer with rear-reading cameras — how almost every site is set up
— copied the facing-camera pairs of §13.3a(4) and inverted every
`laneTravel` result, readers that report movement but no plate face had
no rule, and Scenario 22 contradicted the rule it illustrated. The fix is
to take the logic out: the cameras report camera facts, the LPR system
reports whether the read was an entry or an exit, the lane records how
its cameras are set up, and a Session is the visit between an entry and
an exit. Every change to the wire format is additive; no field or value
is removed or renamed.

**Added.**
- `LprReadDetail.accessEvent` (`entry | exit | unknown`), reported by
  the LPR system and never inferred by the server. The lane a vehicle
  used does not change it — on a shared driveway an entry on the exit
  lane is still an entry. The LPR system MAY revise it by replacing the
  Observation through native `PUT /observations/{id}` (Part 13
  §13.3a(4)).
- `apds-ext:apx:lane-cameras@1.0` (`LaneCameras`) on the APDS
  `VehicularAccess`: each camera's `cameraId` (unique within the Place,
  equal to `Image.cameraID`) and whether it `faces` `inward` or
  `outward`. Facing is relative to the facility, so it holds on
  reversible lanes, where one camera each way gets a rear plate in either
  mode (§13.3a(5)).
- `movement` values `toward` and `away`.
- `LprReadDetail.frameReads` (how many frames read the plate — what lets
  a one-plate camera call movement), `plateBox` (the plate's position as
  fractions of the frame), `speed` (km/h, absent when not measured) and
  `plateCategory`.
- `GET /v1/lpr/reads?session=` — every read behind one visit (§13.3,
  §13.5(4)).
- Topic `apx.data.observation.updated.v1` (registry `apx-topics` v10),
  published on every Observation replace so a revised `accessEvent`
  reaches billing (§13.4, Part 8).
- §13.3a(6) Reads, passages, and Sessions; §13.3a(8) ingest mapping —
  the engine's read id as the Observation `id` so a re-send is `409
  id-collision`, capture time (never arrival time) drives the Session,
  no 0,0 locations, confidences on 0–1.
- Scenario 27: a reversible lane with two cameras, a front-plate camera,
  and a late correction. Annex A rows APX-LPR-05 and -06.

**Changed.**
- Scenario 22 rewritten as a shared driveway in the snow (file renamed
  `22-lpr-shared-driveway.md`).
- `bodyType` is the engine's own class label, carried as reported;
  `platesRead` counts distinct plates, not frames.
- APX defines no wrong-way travel. `wrongWayTravel` stays in
  `apx-alert-types` (v3) as an operator-defined alert with a reworded
  description; APX never raises it. The `apds-ext:apx:alert-evidence@1.0`
  decoration, previously defined only in §13.3a, is now defined in Part 7
  §7.1 for any alert.

**Deprecated (removed at 1.0).**
- `LprRead.laneTravel` — servers SHOULD return `unknown`.
- `movement` values `approaching` and `receding` — accepted as synonyms
  of `toward` and `away`.

**Deferred.** A freight-identifiers module — USDOT numbers first,
shipping-container codes later — as reads alongside plate reads, sharing
`captureGroup` and lane cameras. APDS has no credential type for either,
so it needs its own design and likely an upstream request. A standard
`vehicleType` (APDS `VehicleTypeEnum`) on reads waits for a use case
that prices LPR reads by vehicle type.

## [0.11.0] — 2026-09-25

Vetting release. Every conformance class was exercised by private
scenario suites that validate request bodies, query parameters, status
codes, and response bodies against the bundle; this edition closes what
they found. Every change is additive: nothing is removed, renamed, or
narrowed. Findings that could only be fixed by a breaking change are
deferred to a future major and listed at the end.

**Errors you can actually produce.** Many declared error responses had no
registered problem type, so no conforming body existed for them. Part 12
registers `unauthenticated` (401), `invalid-request` (400, with an
`errors[]` member naming each JSON Pointer), `reference-unknown` and
`request-unprocessable` (422), `personal-data-not-permitted`,
`lost-ticket-fee-undefined`, `stream-position-expired` (410), and the four
missing illegal-transition types (alert, toll, payment, reservation).
§12.3 now requires every secured operation to declare 401, 403, and 429,
every id-addressed one 404, and every one with a body 400; 96 missing
declarations were added and a Spectral rule keeps it true. §12.4 says how
to choose a type.

**Two cross-cutting rules.** Part 4 §4.2a gives one optimistic-concurrency
rule for every versioned write (`If-Match`, or `version` in the body, as
the precondition; 409 `version-conflict` when stale) and says an
idempotent replay returns the current representation. Part 9 §9.3a says
what a caller learns outside its grant: 403 for the place grant, 404 for
narrower ownership scopes, and an empty 200 for place-less lookups under
an empty grant.

**Data and events.** The data profile now covers the APDS-native routes in
the OpenAPI itself: native PUTs declare `APX-Update-Mode` and accept a
`ChangePayload` body; native 400/404/409 offer `application/problem+json`
beside `ResponseStatus`; every native operation declares 401/403/429; the
change feed extends to `/observations`. Nine newly found APDS 4.1 defects
are recorded as errata 004–012 and worked around narrowly in the data
overlay. The delivery fabric now requires every retry to be re-signed with
a fresh `APX-Timestamp` (without it the replay window rejected every retry
after five minutes), records each attempt in the ledger, and adds
`GET /webhooks/{id}`, merge-patch updates with version checks, idempotent
creation, key retirement, and a named data schema for every topic.
`tools/validate-scenarios.mjs` gains an `apx:request` marker that validates
request bodies too.

**Control, alerts, discovery.** Control gains an audit query,
`GET /v1/commands`; a structured `Command.result` for `lostTicket`,
`matchTicket`, and `pushNegotiatedRate`; a synchronous 422 for a lost
ticket with no fee line; `place` and `deviceState` filters on devices; and
fixed parameter names for the passback and courtesy commands. Alerts gain
`expiryTime`, an optional note-and-agent body on acknowledge and resolve,
and `device`/`relatedEntity` filters. Discovery documents gain `features`,
`extensions`, `apiBase`, `edition`, and `registryVersions`; Part 16 §16.3
specifies what `apx-mtls` changes on the wire.

**Accounts, tolling, permits.** Payments gain an explicit state machine
(authorize-only holds via `captureLater`, reported as `captureStatus: authorized`; cumulative `refundedAmount`;
`payment-state-illegal`), readable and cancellable payment links, more
lookup filters, and refusal of card data before it is logged. Tolling
gains price and void routes, a transition table, list filters, and a
defined `adjusted` resolution; its dispute codes are registered as
`apx-toll-dispute-reasons` and `apx-toll-dispute-resolutions`. Permit
issue takes an optional `Idempotency-Key` (a retry no longer burns pool
capacity) and §14.2b defines how a permit lands on the native
AssignedRight.

**LPR, resolution, reservations.** LPR reads require a key, accept
`place` and `observation`, and return `lane`, `cameraId`, and
`extensions`; §13.3b defines purged reads. The plate and assigned-right
session writes take `If-Match` and approval evidence, and a new unlink
route undoes a link. Support interactions can be read, completed, and
filtered by `correlationId`. Reservations gain a transition table and
more filters; public scenarios 05 and 06 now match the OpenAPI.

**Violations, validations.** Terminal violation states are named once,
a paid violation can be voided with a refund or appealed within the
window, the escalation clock pauses during an appeal, and each violation
records its unpaid fee and cap. A redemption reversed in a closed period
is now credited on the next statement instead of refused, so
`statement-closed` is reserved and no longer returned. Issuance batches
and codes can be voided, and public scenario 18 now validates.

**Credentials, valet.** Credentials can activate at `validity.start`,
and a new `GET /v1/access-events` lists attempts by place and lane,
including cards that match no record. Valet gains `pickup`, `cancel`, and
`condition` routes, re-parking of a staged car, a harmless repeated
`retrieve`, and an exact customer-scope field list; public scenarios 20
and 21 now validate.

**Deferred to a future major (breaking).** Existing single-UUID `place`
filters stay single-valued (turning them into lists changes their type);
new filters added in this edition take lists. Schema-level `if/then`
rules, `pattern` constraints on existing parameters, and readOnly on
create-body members stay in prose with a declared refusal, because adding
them would narrow requests clients already send. `ReferenceToQuote`
(erratum 008) has no additive workaround and waits for APDS.

## [0.10.0] — 2026-09-24

Negotiated rates and ticket matching (Part 6 §6.6–6.7, optional features
of class `apx-control`). Both close open tickets at the exit lane; neither
touches the rate deck.

**The rate deck was never missing.** APDS 4.1 owns `RateTable` and serves
it at `/rates` with `modified_since`; the APX data overlay already put that
route in the Part 5 change feed. Part 5 §5.2 now says so in one paragraph
for a third party mirroring the deck. What APDS cannot say is which tables
an agent may *offer*: new Level B decoration `apds-ext:apx:ratepolicy@1.0`
(`RatePolicy`: `negotiable`, `displayName`, `note`) on the RateTable, so
the flag travels with the deck on every sync. New command
`pushNegotiatedRate` (registry `apx-command-types` v3) applies a flagged
table to the **current ticket at the lane only** — `pushRate` remains the
deck-level correction — and is refused for an unflagged table
(`422 rate-not-negotiable`) or an empty lane
(`409 lane-no-current-transaction`). The lane inquiry shows
`currentTicket.negotiatedRate` (table version, command, agent). APX
deliberately defines **no selection rules** — no length-of-stay bands or
time windows; the presenting system applies its own guardrails — and **no
free-form amount**: selection from the deck keeps §6.3's revenue-integrity
rule intact.

**Ticket matching.** A driver at the exit with no ticket used to get the
lost-ticket fee or a courtesy vend; the entry was usually recorded anyway.
`GET /v1/lanes/{id}/current` now returns advisory `matchCandidates[]`
(`MatchCandidate`: open session, entry time and lane, `matchedBy`
plateRead | credential | account | reservation, evidence, confidence,
`amountDueIfMatched`, entry image) when no ticket is in the machine or
when a `plate`, `phone`, or `credential` lookup is passed — `phone` is an
account key per Part 13, not a call identifier, and Part 17 §17.1's
layering rule is unchanged. New command `matchTicket` (`parameters.session`
+ `evidence`) binds the lane's transaction to the open session, prices the
exit from its true entry time, and MUST close the APDS Session on vend
with `SessionUpdated`; refused for a closed or foreign session
(`422 session-not-open`). `lostTicket` is the explicit fallback.

**Who did it.** `Command` gains optional `agent` and `agentType`
(`human | ai`, mirroring SupportInteraction), REQUIRED on both new
commands (`400 agent-required`): distinct from `requestedBy` (the
organisation) and `approval.approvedBy` (the approver). Part 12 gains four
problem types; Annex A.5 gains conditional rows APX-CTL-09 through 12;
Part 17 §17.4 lists the registry v3 entries. Scenarios 24 (negotiated
rate from the mirrored deck, refused when unflagged) and 25 (plate-read
candidate matched, permit holder found by phone, closed session refused).
Examples overlay: `RatePolicy`, `MatchCandidate`.

## [0.9.1] — 2026-09-23

Submission-readiness pass. No change to any route, schema, or required
field: the API surface is identical to 0.9.0.

**The reference now explains itself.** Two new overlays decorate the bundle
alongside the data-profile one, and both are **informative** rather than
normative (Part 0 §0.5, Part 3 §3.4): `apx-docs-overlay.yaml` supplies the
reader's orientation in `info.description`, a per-domain narrative on each
of the sixteen tags, and `x-tagGroups`; `apx-examples-overlay.yaml` gives 35
resource schemas a worked payload, each lifted from a scenario where CI
already validates it. Validated schema examples went from 9 to 44.
`tools/apply-overlay.mjs` now applies an ordered list of overlays and can
create an absent node. `examples:check` relaxes the vendored APDS
`Reference` defect exactly as `scenarios:check` does; without that, every
example containing a reference failed, which is why only primitives had one.

**The registries are actually published.** Part 11 §11.2 said they were
served at their `locator` URLs; `apx-standard.org` has no DNS, so the
document asserted something untrue. They are now served from the
documentation site under `/registries/`, byte-identical to
`spec/registries/` and republished by CI, and §11.2 describes that. Part 12
gains the RFC 9457 §3.1.1 clarification that a problem `type` is a stable
identifier rather than a location, so those URIs are correct as they stand.

**An edition is now a fixed set of files.** New generated
`spec/edition.json` pins the bundle and every overlay by checksum, each
registry with its version, the vendored APDS release and its checksum, the
Parts, and the conformance classes. CI fails if it goes stale. Part 3 §3.4
cites it as what a proposer should name when asking for adoption.

**Documentation site.** A landing page listing every module, generated from
the bundle so it cannot drift, each linking to its section of the reference
and to the governing Part; the whole written standard compiled into one
document at `/apx-standard.md`; the bundles and the edition manifest served
alongside. CI builds the entire site on every pull request.

**APDS errata.** A third defect recorded and all three filed upstream: the
`Reference` schema is unsatisfiable
([#33](https://github.com/parkingdata/spec/issues/33)), the observations
`single-element` example matches neither branch of its own `oneOf`
([#34](https://github.com/parkingdata/spec/issues/34)), and the
observation-set discriminator mapping key is misspelled
([#35](https://github.com/parkingdata/spec/issues/35)). Filing-ready reports
live in `docs/errata/`.

**Also:** scenario 23 covers tolling, previously the only domain with none
(a gantry retry that must not double-bill, settlement against an account, a
misread plate disputed and refunded, and a resolved dispute that cannot be
reopened); `SECURITY.md` and `CODE_OF_CONDUCT.md`; issue templates for
registry requests per Part 11 §11.3 and for specification defects, plus a
pull request template; and the CI breaking-change gate now actually runs,
having previously written its base bundle where the action's container could
not see it.

## [0.9.0] — 2026-09-21

LPR read fidelity (Part 13 §13.3a, class `apx-lpr`). APDS's Observation
carries plate, state, make, model, colour, and one overall confidence;
it has no confidence per attribute, no alternate candidates, and nothing
about how the vehicle moved. New Level B decoration
`apds-ext:apx:lpr-read@1.0` (`LprReadDetail`) on the ingested Observation,
projected as `LprRead.detail` and `PlateCandidate.detail`: per-attribute
`AttributeRead`s (plate, country, stateProvince, make, model, color,
bodyType — each `value` + `confidence`), `alternateReads[]`,
`platesRead` (how many plates were read in the passage), `plateFace`
(`front | rear | unknown` — the vehicle's orientation to the camera),
`movement` (`approaching | receding | stopped | unknown`), `captureGroup`,
`engine`. Server-derived `LprRead.laneTravel` (`withLane | againstLane |
unknown`) from plate face + movement + camera orientation + the lane's
APDS `accessType` — the gateless "entered on the exit lane" signal; new
alert type `wrongWayTravel` (registry `apx-alert-types` v2); the Session
is still opened for the plate. Ingest stays native `POST /observations`;
winning values MUST also appear in the APDS-native fields. Annex A.10
rows APX-LPR-03 (conditional) and 04; scenario 22 (gateless lot: wrong-way
entry caught by plate face and movement, correct exit with two plates
read and a second-ranked candidate). CI: the oasdiff base bundle is now
extracted inside the workspace (the action's container never saw
`/tmp`).

## [0.8.0] — 2026-09-20

Valet (Part 22, optional class `apx-valet`) — a net-new domain (APDS has
no valet entity). `ValetTicket` referencing the APDS Session for the
stay: `vehicle`, minimized `customer` with an opaque `contactChannel`,
`dropOff` (lane, attendant, mileage, fuel, key tag, items left,
condition report), `storage` (Space or zone, key location), `retrieval`
(channel `sms|app|web|voiceBot|kiosk|attendant|callCenter`, scheduled
`requestedFor`, opaque `interaction` id, server-set `etaMinutes` and
`promisedTime`, staging), `handback` (verification method, mileage,
condition report), lifecycle `dropped → parked → requested → retrieving
→ staged → handedBack → closed` with cancel-retrieval and immutable
`statusHistory`. `ConditionReport` — notes, structured `damage[]`
(area, severity, image), walk-around `imageLinks[]`, `customerAcknowledged`
— at both ends; drop-off report immutable after `dropped`. Nine
operations under `/v1/valet` including `GET /v1/valet/queue` (the runner
board); scopes `apx.valet:read`/`:manage` and the customer-confined
`apx.valet:request` (minimized read, retrieve, cancel — works for texts,
PWAs, voice bots); topics `apx.valet.ticket.status.v1`,
`apx.valet.retrieval.requested.v1`; problem types
`valet-transition-illegal`, `valet-vehicle-not-located`,
`valet-verification-failed` (recorded in statusHistory); Annex A.18
(APX-VLT-01…08); scenario 21 (scanned drop-off report, retrieve by text
with ETA, staged, verified handback, damage claim answered).

## [0.7.0] — 2026-09-20

Credentials (Part 21, optional class `apx-credentials`) — the lifecycle
of keycards, fobs, RFID tags and transponders, mobile credentials,
hangtags, and plates used as the credential. `CredentialRecord` (APDS
`CredentialTypeEnum` read technology + identification, assigned type,
holder/account, assigned rights, places, validity, physical `media` with
serial, batch, and deposit, `replaces`/`replacedBy`, immutable
`statusHistory`); lifecycle `issued → active ⇄ suspended`, `→ lost`,
`→ revoked`, server-side `expired`, and one-call `replace` issuing an
active successor. **APDS materialization is normative:** an active
record MUST appear as `CredentialAssigned` on the holder's AssignedRights
with `identifier` → the record, and MUST be removed on suspend, lost,
revoke, expire — a plain APDS lane sees the truth without APX.
`CredentialAccessEvent` + `GET …/{id}/access-events` (granted/denied with
seeded `denialReason`) and topic `apx.credentials.access.v1` (APDS has no
access events); topic `apx.credentials.status.v1`. Ten operations under
`/v1/credentials` (the Part 17 `…/{id}/passback` read is unchanged);
scopes `apx.credentials:read`/`:manage`; problem types
`credential-identification-in-use`, `credential-transition-illegal`,
`credential-not-replaceable`; additive `Account.credentials[]`
(Part 13); Annex A.17 (APX-CRD-01…06); scenario 20 (lost keycard
replaced by phone, old card refused by an APDS-only lane, access log).

## [0.6.0] — 2026-09-19

Violations (Part 19) extension: the law at the location. New
`EnforcementPolicy` bound to a HierarchyElement with subtree inheritance
— lawful notice delivery per detection mode with deadlines and minimum
evidence, penalty cap over the unpaid fee (refuse or clamp), ordered
server-applied escalation schedule with an overall ceiling, appeal
window, payment grace, `signageRequired`, statute provenance. New
`Signage` — posted text (`MultilingualString`), photo link, sign
position, in-force window, immutable history. `Violation` gains
`location` (APDS Observation `Location` shape: observed and observer
`PointLocation`, textual, accuracy), `policy` and `signage[]` frozen at
issue as VersionedReferences, and `amountHistory[]` (issued, escalation
steps, appeal reductions, cap clamps). Ten operations under
`/v1/enforcement/policies` and `/v1/enforcement/signage` including
`…/effective?place=&at=` resolution reads; `issue` now enforces the
policy in force with 422 `delivery-method-not-permitted`,
`notice-deadline-passed`, `penalty-exceeds-cap`, `signage-required`;
`signage-referenced` on text edits to referenced signs. §19.1 rule 6
replaced (escalation now in scope, collections still out). Annex A
APX-VIO-09…12; scenario 19.

## [0.5.0] — 2026-09-19

Validations program management (Part 20, optional class
`apx-validations`) — the merchant side of the Part 6 §6.3 surface.
`ValidationProgram` (merchant enrolment at a place: benefit as exactly
one of amount/duration/percentage, a closed rule set — maxPerTicket,
maxPerDay, validityWindow, stackable, applicableRateTables — billing
model merchantPays/operatorAbsorbs/split, versioned `PUT` lifecycle
`active ⇄ suspended → ended`); `ValidationIssuance` (batches of codes,
QR, stamps, digital; codes returned exactly once); `ValidationInstrument`
(code check, 404-never-403); `ValidationRedemption` (the ledger every
channel writes — pay station, merchant app, lane, and the Part 6
`applyValidation` command — carrying the APDS `Segment.validationId` and
the ACTUAL `amountReduced`; reversible); `ValidationStatement` (preview
any period, close it into an immutable non-overlapping statement).
Fifteen operations under `/v1/validations`; scopes
`apx.validations:read`/`:manage` and the merchant-confined
`apx.validations:redeem`; topics `apx.validations.redeemed.v1`,
`.program.status.v1`, `.statement.closed.v1`; problem types
`program-not-active`, `instrument-invalid`, `redemption-limit-exceeded`,
`redemption-reversed`, `statement-closed`, `statement-overlap`; additive
`ValidationProvider.program` reference (Part 6 provider list now derives
from active programs when the class is claimed); Annex A.16
(APX-VAL-01…08); scenario 18 (enrol, issue QR codes, redeem at the pay
station, per-ticket cap refused, close the month).

## [0.4.0] — 2026-09-19

Violations (Part 19, optional class `apx-violations`) — enforcement as a
net-new domain. One `Violation` resource for tickets, notices, warnings,
and citations; two first-class detection modes (`automated` camera/sensor
pipelines and `guided` handheld enforcement, plus `manual`); lifecycle
`detected → confirmed | dismissed → issued → paid | appealed`, `voided`
terminal, immutable `statusHistory[]`; guided/manual detections MUST be
reviewed before issuance (409 `violation-not-issuable`); one appeal per
violation with `upheld`/`reduced`/`dismissed`; settlement by Payment
reference only (money taken via Part 13). New `GET
/v1/enforcement/eligibility` — the handheld screen-pop composed from APDS
AssignedRights/Sessions (which remain authoritative), with a per-basis
reason (`valid`, `expired`, `wrongPlace`…) and an advisory
`suggestedViolationType`. Ten operations under `/v1/violations` and
`/v1/enforcement`; scopes `apx.violations:read`/`:manage`; topics
`apx.violations.detected.v1`, `.issued.v1`, `.status.v1`; new registry
`apx-violation-types` (10 entries); problem types
`violation-transition-illegal`, `violation-not-issuable`,
`appeal-closed`; Annex A.15 (APX-VIO-01…08); scenarios 16 (automated LPR
overstay → mailed notice → appeal reduced → paid) and 17 (guided
handheld: eligibility check, confirm, windshield citation, and the 409
when review is skipped). Part 9 §9.6 plate-scope list extended; reuses
APDS's `ep` (Enforcement Provider) role and `enforcementSystemProvider`
responsibility rather than defining an enforcement identity.

## [0.3.0] — 2026-09-05

Customer Service & Resolution (Part 17, class `apx-resolution`) plus the
API-mechanics hardening pass. Highlights: one aggregated resolution-context
call with policy-decided allowed actions ("the LLM is never the policy
engine"), anti-passback, plate correction, payment links/refunds, support
history, opaque `interactionId` (no telephony in the PARCS contract),
`confirmationLevel` honesty on commands, scenarios 08–15, APDS 4.1
upstream-pin + strictness-audit fixes, per-operation OAuth scopes on all 47
APX operations, request bodies on the formerly body-less POSTs, uniform
idempotent-replay/401/403/409/422/429 declarations, APDS `page` +
`PaginatedListMeta` pagination on every APX list, `spectral:oas` base
ruleset, and an openapi-typescript codegen smoke test in `npm test`
(new dev dependency). Second documented APDS erratum (invalid
`/observations` example).

Multi-site semantics (Block B): identifier locality + aggregation alias
convention via `operatorDefinedReference` (Part 4 §4.1a; Part 2 UUID claim
scoped to APX resources); change-feed cursor scope, filtered-feed
gaplessness, and grant-expansion signaling via `ChangeFeedPage.grantAdditions`
(Part 5 §5.2 rules 5–7); **BREAKING:** `apx_places` is now fail-closed —
absent/empty = no places, explicit `"*"` = all (Part 9 §9.3, discovery
aligned); webhook secret hygiene — `secretRef`, `activeKeyIds`, `APX-Key-Id`
header required during rotation overlap, minimum secret entropy (Part 9
§9.4, Part 8 §8.3); new Part 18 "Aggregation and Onboarding" — the
standalone-site → platform transition (identity survival, credential,
subscriptions, cursors, cutover, `EventEnvelope.source` change).

Committee packaging (Block C): Annex A — numbered conformance requirements
(`APX-<CLASS>-<NN>`) for all 14 classes + cross-cutting core, and the ICS
template; Part 3 — class dependency table, APX→APDS reconciliation clause
(§3.3(8)), and the APDS version policy (§3.5: one release per edition,
re-vendor = new edition, no in-band negotiation); Part 13 §13.6 —
normative PaymentRecord ↔ APDS Payment field mapping with the
materialization rule; Part 11 §11.3 — open registration authority (60-day
decisions, appeal path); CONTRIBUTING — governance/end-state and patent
intent (pending legal review); draft submission cover letter
(docs/submission-cover-letter.md).

Final review decisions: explicit reservation↔session link for
barcode-only reservations (`PUT /v1/sessions/{id}/assigned-right`,
Part 14 §14.1b, materializing into `segments[].assignedRight`); per-ticket
price adjustment formally answered by validations/discounts — no raw
override, by design (Part 6 §6.3); problem registry completed
(pool-exhausted, right-not-linkable, action-not-allowed,
approval-required, rate-limited; command-not-cancellable aligned with
Part 6); Reservations tag added.

## [0.2.0] — 2026-09-02

Submission-readiness revision: fixes the seven blockers from the
pre-committee review. One breaking change (see below), permitted pre-1.0.

### Added
- **Data-profile overlay** (`spec/openapi/overlays/apx-data-overlay.yaml`,
  OpenAPI Overlay 1.0) — the Part 5 `mode`/`cursor` parameters and
  `ChangeFeedPage` response alternate are now machine-readable on the four
  §5.6 routes. Applied to the dist bundle by `npm run spec:bundle`
  (`tools/apply-overlay.mjs`); declared a normative artifact (Part 0 §0.5,
  Part 3 §3.4). Part 5 documents the native-routes-vs-parallel-route trade.
- **Privacy and data protection** (Part 9 §9.6): minimization,
  access-controlled imagery, published retention with purge capability,
  purpose limitation, and the truncated-key window as a hard control.
- **Event place binding** (Part 8 §8.5): a normative per-topic rule for
  how events bind to a HierarchyElement, and grant-safe `filters.places`
  semantics (drop rather than leak).
- **Site binding on aggregators** (Part 13 §13.5): place-less lookups
  (`/v1/accounts`, `/v1/payments`, `/v1/lpr/reads`) MUST be constrained
  to the caller's `apx_places` grant; optional `place` narrowing.
- Shared `401`/`403` problem responses declared on all APX list/read
  operations (previously only two operations declared them).
- APDS's own `oAuth` security scheme is now included in the bundle —
  vendored operations no longer reference an undefined scheme.

### Changed
- **BREAKING:** `PaymentRecord.place` and `LprRead.place` are now REQUIRED
  (APDS `Reference` to the HierarchyElement) so payments and plate reads
  are always attributable to their site; `Account.places` added
  (optional). Scenario payloads updated.
- `POST /webhooks` now preserves the stock APDS 4.1 response contract
  (`200`/`202` + `ResponseStatus`); the APX-rich `201` (subscription +
  one-time secret) is selected with `Prefer: return=representation`
  (Part 8 §8.1). A plain APDS client observes pure APDS behavior.
- Part 0 §0.5 precedence rule scoped: effective OpenAPI prevails for
  APX-defined paths; the vendored APDS document prevails for native paths.
- Part 3: §3.1 now lists `apx-control` and `apx-alerts` among the optional
  classes; §3.4 names Parts 0–16 (not 0–12) as normative.
- Server URL placeholder no longer uses `example.com`; remaining
  Redocly lint warnings resolved (declared 4XX responses).

### Removed
- All references to the unpublished internal "2018" requirements document;
  the affected requirements now stand on their own text (Parts 6, 13,
  control/accounts/LPR schema descriptions).

## [0.1.1] — 2026-08-25

### Added
- **Occupancy snapshot** (Part 5 §5.5): `GET /v1/places/{id}/occupancy`
  returns an `OccupancySnapshot` — verbatim APDS `Supply` + latest
  `DemandType` plus a derived, clamped `available` count. Required for
  `apx-data` implementations that hold occupancy data. Included in the
  PARCS Starter Profile (now 26 paths).
- **Analytics event topics** (registry `apx-topics` v3, Part 13 §13.4):
  `apx.data.occupancy.v1` (occupancy movement),
  `apx.accounts.payment.recorded.v1` (every recorded payment), and
  `apx.data.observation.created.v1` (every ingested LPR/sensor
  Observation) — closing the APDS `EventTypeEnum` gaps for financial and
  sensor analytics.
- **Route map** (`docs/route-map.md`): maps conventional place-nested REST
  expectations to the actual APDS/APX routes, with curl examples.
- **Tooling**: PR breaking-change gate (oasdiff) in CI; reference docs
  published to GitHub Pages on every push to `main`; `npm run mock`
  (Prism mock server); `npm run docs:build`.
- **Governance**: this changelog and `CONTRIBUTING.md`.

### Fixed
- Part 0 §0.5 documents table now lists Parts 13–16.
- `docs/apx-overview.md` covers the occupancy read and analytics topics.

## [0.1.0] — 2026-08-21

Initial complete v1 draft. All domains specified: data profile (Part 5),
delivery fabric (Part 8), control (Part 6), alerts (Part 7), security
(Part 9), extensibility & registries (Parts 10–11), errors (Part 12),
accounts/payments/LPR (Part 13), reservations & permits (Part 14),
tolling (Part 15), discovery (Part 16). APDS 4.1 vendored verbatim,
checksum-guarded. Six spec-validated end-to-end scenarios. PARCS Starter
Profile subset. CI validation on Ubuntu and Windows.
