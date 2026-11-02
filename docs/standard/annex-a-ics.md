# APX Annex A — Conformance Requirements and ICS Template (normative)

This annex numbers the testable requirements of each conformance class so a
certification body, procurement team, or implementer can build a test
matrix. Identifiers are stable: `APX-<CLASS>-<NN>` never renumber; new
requirements append. Each row cites the defining section — the cited text
is authoritative; the row is its handle.

Requirements marked **C** are conditional (apply only when the
implementation has the named capability).

## A.1 Cross-cutting (all classes)

| ID | Requirement | Source |
|---|---|---|
| APX-CORE-01 | APDS-defined routes/schemas/conventions used verbatim by $ref; no APDS entity redefined, subset, or re-shaped | §0.2 |
| APX-CORE-02 | A plain APDS 4.1 client works unmodified for the routes it uses | §0.2 |
| APX-CORE-03 | Every APX resource carries `id` (UUID) + `version`; client-supplied id collision → 409 | §4.1 |
| APX-CORE-04 | Unknown `extensions` keys preserved on round-trip; keys match the §4.3 pattern | §4.3 |
| APX-CORE-05 | All APX errors are RFC 9457 problem+json with registered `type` URIs | §12 |
| APX-CORE-06 | OAuth2 client-credentials supported; HTTPS everywhere | §9.1 |
| APX-CORE-07 | Missing scope → 403 `insufficient-scope`; out-of-grant target → 403 `insufficient-grant` | §9.2–9.3 |
| APX-CORE-08 | `apx_places` fail-closed: absent/empty = no places; all-places only via explicit `"*"` | §9.3 |
| APX-CORE-09 | `GET /.well-known/apx-configuration` served unauthenticated at host root | §16.1 |
| APX-CORE-10 | Personal-data minimization, access-controlled imagery, published retention with purge | §9.6 |
| APX-CORE-11 | Aggregated/imported HierarchyElements: source id preserved or aliased via `operatorDefinedReference` | §4.1a, §18.2 |
| APX-CORE-12 | `/.well-known/apx-configuration` `conformanceClasses` are closed under the §3.1 dependency table and list only registry values or vendor classes | §3.1, §16.1 |
| APX-CORE-13 | Vendor additions stay in the vendor's namespace: extension keys `apds-ext:<vendor-ns>:…`, endpoints under `/apx/x/<vendor-ns>/`, topics prefixed `<vendor-ns>.`; never the `apx` namespace or `apx.` prefix; no unregistered keys outside `extensions`; no APX-registered code-list value reused with different semantics | §3.3, §10.1–10.2 |
| APX-CORE-14 | Every registry version the implementation validates against is served or linked and advertised in `/.well-known/apx-configuration` `registries`; every advertised URL resolves | §11.2 |
| APX-CORE-15 **C** (receives a migrated place) | Onboarding at the receiving implementation: the grant names exactly the migrated subtree root(s), never `"*"`; imported historical entities keep their `recordInfo` provenance | §18.3 |
| APX-CORE-16 **C** (hands over a migrated place) | After the agreed cutover the releasing implementation publishes no events bound to the moved place, and its change feeds emit tombstones for the entities it no longer hosts | §18.4 |
| APX-CORE-17 **C** (publishes credential digests) | `apds-ext:apx:credential-digest@1.0` computed as HMAC-SHA-256 under the normalization published with each key; keys served only by `GET /v1/digest-keys` under `apx.digest:use`; rotation by `keyId` with both keys served during the overlap | §9.6 r6 |
| APX-CORE-18 | For each claimed class, every route of that class in the §5.2 rule 8 table accepts `mode=change&cursor=`: the route's own list envelope with `updateMode` (`change`, absent on a `mode=full` page), `cursor`, `deleted`, `grantAdditions`, `next`, and no `meta`; whole current representations, never an older state after a newer one; no cursor → an empty page with the head cursor; a change in a filtered feed when the resource matched before or after it; §5.2 rules 1, 2, 4–7 (a foreign or expired cursor is 404 `target-not-found`) | §5.2 r8 |
| APX-CORE-19 **C** (replicated site implementation) | Authority per place and entity class declared in discovery `replication[]`; a write against it is 409 `not-authoritative`; replicated writes keep origin `id`, `RecordInfo.origin`, `creationTime`, and the original `statusHistory[]` times under `apx.replication:write`; idempotency keys origin-scoped | §18.6, §16.2 |
| APX-CORE-20 | Every plate-, card-, or phone-keyed lookup served is also served in its body form (`…:search`, `…:check`) with the same rules and answers | §9.6 r7 |

## A.2 `apx-data`

| ID | Requirement | Source |
|---|---|---|
| APX-DATA-01 | The eight native APDS routes served | §5.6 |
| APX-DATA-02 | `APX-Update-Mode: full\|change` on updates (creates are always full); change body validated as `ChangePayload` with each member checked against the native property schema; explicit-null clears, absent unchanged; stale version → `version-conflict`; `Accept: application/problem+json` on a native route → registered Problem | §5.1, §5.1a |
| APX-DATA-03 | `mode=change` feed on /places, /sessions, /rates, /rights/assigned (and /observations where ingest is served) returning ChangeFeedPage | §5.2, §5.6 |
| APX-DATA-04 | Feed ordered and gapless per (class, credential, filter set); replay from any issued cursor exactly-once | §5.2 r1, r5–6 |
| APX-DATA-05 | Cursors honored ≥7 days; older or foreign → 404 `target-not-found` (always a Problem); tombstones emitted and retained for the window | §5.2 r2, r4–5 |
| APX-DATA-06 | Grant expansion signaled via `grantAdditions` on the first page after the change | §5.2 r7 |
| APX-DATA-07 | Client sending no APX headers/params observes pure APDS 4.1 behavior | §5.6 |
| APX-DATA-08 **C** (holds occupancy) | `GET /v1/places/{id}/occupancy` served; snapshot derivable from the Place hierarchy | §5.5 |
| APX-DATA-09 | `apds-ext:apx:session-detail@1.0` accepted on native Session writes and preserved; with `apx-lpr`, a read bound as `entry`/`exit` to another Session of the place is 409 `read-already-bound` unless `supersedes` names it, and `LprRead.session` follows the bindings, naming the Session without `parent` that holds the read | §5.8 r1–2, §5.6 |
| APX-DATA-10 **C** (holds occupancy) | `GET /v1/places/{id}/occupancy/history` buckets aligned in the place time zone, derived from held DemandTable records, never guessed | §5.5a |
| APX-DATA-11 | An `apds-ext:apx:session-detail@1.0` write refused with 422 `request-unprocessable`, nothing written, for two `representative` reads, `lifecycle` and `actualEnd` disagreeing (`open` with one, any other state without), or a `parent` whose element is not an ancestor; a read naming no visible Observation → 422 `reference-unknown`; `final` never refuses a later revision; `MatchEvidence` carries `target`, `matchType` (closed set), `applied`, and `plate.method` / `vehicle.level` when those blocks are present; evidence for one link agrees at both ends | §5.8 r1, r3, r5–6, §5.6 |
| APX-DATA-12 | `apds-ext:apx:stay-compliance@1.0` accepted on native Session writes and preserved; `status` and `family` required, a registry status with another family → 422 `request-unprocessable`; `pendingStatus` only with `reviewRequired` (else 422 `request-unprocessable`); `evaluatedTime` and `sequence` required, a lower `sequence` than held → 409 `evaluation-out-of-order`; `final` never refuses a later evaluation; a `policy` naming nothing visible → 422 `reference-unknown` | §5.9 r1–2, r4–5, §5.6 |
| APX-DATA-13 | The stay-compliance decoration left out of every Session served to a token (native reads, change feed, Session event deliveries) without `apx.compliance:read`; a write carrying it without `apx.compliance:write` → 403 `insufficient-scope`, nothing written; a write omitting it keeps the stored block | §5.9 r7–8, §9.6 r8 |

## A.3 `apx-events`

| ID | Requirement | Source |
|---|---|---|
| APX-EVT-01 | Stock APDS `EventSubscription` accepted; stock request → APDS 200/202 ResponseStatus with the new id as the single `ids[]` entry; `Prefer: return=representation` → 201 with one-time secret (webhook transport); `Idempotency-Key` replay returns the subscription without the secret | §8.1 |
| APX-EVT-02 | Every delivery HMAC-SHA256-signed (`APX-Signature`, `APX-Timestamp`, `APX-Delivery-Id`); ±5-min replay window enforced by receivers | §8.3, §9.4 |
| APX-EVT-03 | Retry schedule 0s/30s/2m/10m/1h then hourly to 24h, as delays between consecutive attempts (27 attempts); every attempt in `attemptHistory`; exhaustion → status `failed` + `apx.subscription.failed.v1` (data `SubscriptionFailure`) | §8.3 |
| APX-EVT-04 | Envelope `id` and body stable across retries; `APX-Delivery-Id` unique per attempt; every attempt re-signed with its own `APX-Timestamp` | §8.3 |
| APX-EVT-05 | Per-topic place binding populated; `filters.places` matches bound place; unbindable events never delivered beyond grant | §8.5 |
| APX-EVT-06 | EventTypeEnum topics published for every entity class served for writes; APX topics of every claimed class published | §8.6 |
| APX-EVT-07 | Secret ≥32 bytes entropy; `APX-Key-Id` on every delivery during rotation overlap; overlap ends on `retireKeyIds` or 24 h after rotation | §8.1, §9.4 |
| APX-EVT-08 | `filters.alertTypes` delivers only listed alert types on alert topics, combined with `severityFloor` and `places` | §8.5a |

## A.4 `apx-events-sse`

| ID | Requirement | Source |
|---|---|---|
| APX-SSE-01 | `GET /v1/events/stream` for transport=sse subscriptions; `id:` = per-subscription sequence | §8.4 |
| APX-SSE-02 | `Last-Event-ID` resumes strictly after that sequence; ≥1000 events or 15 min buffered; older than the buffer → 410 `stream-position-expired` | §8.4 |

## A.5 `apx-control`

| ID | Requirement | Source |
|---|---|---|
| APX-CTL-01 | `POST /v1/commands` with REQUIRED Idempotency-Key; same key+body → the command as it currently stands (200); different body → 409 `idempotency-conflict`; unknown `commandType` or missing `target` → 400 `invalid-request` | §6.1 |
| APX-CTL-02 | Commands perishable: past `expiryTime` → `expired`, MUST NOT fire | §6.1 |
| APX-CTL-03 | Immutable append-only `statusHistory` on every transition; transitions publish `apx.control.command.status.v1` | §6.1 |
| APX-CTL-04 | Cancel allowed until `dispatched`; after → 409 `command-not-cancellable`; a `holdGateOpen` is released by its `expiryTime`, a later `closeLane`, or a `setDeviceState` on the held gate, and then `succeeded` | §6.1 |
| APX-CTL-05 | `confirmationLevel` reported truthfully; consumers never overclaim beyond it | §6.1 |
| APX-CTL-06 | vendGate, lostTicket, pushRate, applyValidation implemented; lane inquiry; provider query; device status | §6.5 |
| APX-CTL-07 | `applyValidation` with unlisted provider → 422 `validation-provider-unknown` | §6.3 |
| APX-CTL-08 | Lost-ticket fee taken from the rate deck's disclosed lostTicketFee line; absent line → synchronous 422 `lost-ticket-fee-undefined`, no command created or dispatched | §6.1 |
| APX-CTL-09 | *(conditional — negotiated rates)* `pushNegotiatedRate` applies only to the target lane's current ticket, never the deck; a table not flagged `apds-ext:apx:ratepolicy@1.0` `negotiable` for the place → 422 `rate-not-negotiable`; the flag travels inside the RateTable on `/rates` | §6.6 |
| APX-CTL-10 | *(conditional — negotiated rates)* `agent` REQUIRED on `pushNegotiatedRate` (400 `agent-required`); the lane's `currentTicket.negotiatedRate` names the table version and the command | §6.6 |
| APX-CTL-11 | *(conditional — ticket matching)* Lane inquiry returns advisory `matchCandidates[]` when no ticket is in the machine or a `plate`/`phone`/`credential` lookup is given; the server never binds without `matchTicket` | §6.7 |
| APX-CTL-12 | *(conditional — ticket matching)* `matchTicket` with `agent` REQUIRED prices the exit from the matched session's true entry time, materializes the exit into the APDS Session on vend (`SessionUpdated`), refuses a closed/foreign session (422 `session-not-open`) and an empty lane (409 `lane-no-current-transaction`) | §6.7 |
| APX-CTL-13 | `GET /v1/commands` returns only grant-scoped commands and honours `target`, `place` (subtree), `commandType`, `status`, `agent`, `since`, `until`; `GET /v1/devices` honours `place` (subtree) and `deviceState`; a `place` outside the grant → 403 `insufficient-grant` | §6.1b, §6.4 |
| APX-CTL-14 | A `succeeded` `lostTicket`, `matchTicket`, or `pushNegotiatedRate` carries `result` with the §6.1a members, consistent with the lane inquiry | §6.1a |
| APX-CTL-16 **C** (negotiated amounts) | `pushNegotiatedRate` with `parameters.amount` sets the current ticket's `amountDue` to that amount, with no floor or ceiling; exactly one of `rateTable`/`amount`, `agent` and `reason` REQUIRED, the ticket's currency, no negative value (400 `invalid-request`); `amount` without the `negotiatedAmounts` feature → 422 `rate-not-negotiable`; the lane's `currentTicket.negotiatedAmount` carries `amount`, `reason`, `agent` and the command, and `currentTicket.negotiatedRate` (with its required `rateTable`) is absent | §6.6 |
| APX-CTL-15 **C** (display reports what it showed) | A `succeeded` `displayMessage` carries `result.display` (shown time, content hash, wording version, screenshot link, acknowledgement); template parameters accepted | §6.1, §6.1a |
| APX-CTL-17 **C** (offers them) | `ejectTicket`, `cancelTransaction`, `reprintReceipt` accepted as device-targeted commands with the §6.1 rules; a device that cannot perform one reports `failed` in `statusHistory`, never a silent success | §6.1 |
| APX-CTL-18 | A `DeviceStatus` in `fault` carries `fault` (`code`, `displayText`, `since`) where the device reports one; `consumables[]` with `kind` and `level` where the device holds them, a `low` or `empty` level raising `consumableLow`; `maintenanceMode` honoured; last contact reported only as `lastCommunication` | §6.4, §7.7 |

## A.6 `apx-alerts`

| ID | Requirement | Source |
|---|---|---|
| APX-ALT-01 | Alert lifecycle raised→acknowledged→resolved with immutable statusHistory; illegal transitions → 409 `alert-transition-illegal`; an `AlertTransition` body's `detail` and `agent` are recorded on the appended history entry | §7.2, §7.3 |
| APX-ALT-02 | Idempotent raise (Idempotency-Key semantics as APX-CTL-01; a replay returns the alert as it currently stands) | §7.2 |
| APX-ALT-03 | Alert types from `apx-alert-types` (open registry); subtree-inclusive place filtering; `device` and `relatedEntity` filters honoured | §7.1, §7.2 |
| APX-ALT-04 | An alert still `raised` or `acknowledged` at its `expiryTime` becomes `expired` and publishes `apx.alert.status.v1`; an alert without one never expires | §7.3 |
| APX-ALT-05 | An alert with no place binding is visible to every token of its organisation regardless of `apx_places`, never to other organisations, and excluded from `place`-filtered lists | §7.1 |
| APX-ALT-06 | A `webhookDeliveryFailed` alert never generates webhook deliveries to the subscription whose failure it reports | §7.4 |
| APX-ALT-07 **C** (claims `apx-plate-lists`) | List-arrival alerts (`watchListArrival`, `scofflawArrival`, `refusedServiceArrival`) carry the `PlateListEntry` as `relatedEntity` and the read as evidence | §7.6, §24.4 |
| APX-ALT-08 **C** (claims `apx-resolution`) | Service-request alerts (`receiptRequested`, `refundRequested`, `citationInquiry`, `damageReported`, `customerCallbackRequested`) carry `supportInteraction` naming the call they came from and `relatedEntity` naming what the site acts on; `consumableLow` names the device and the consumable | §7.1, §7.7 |

## A.7 `apx-discovery`

| ID | Requirement | Source |
|---|---|---|
| APX-DSC-01 | `GET /v1/discovery` reflects the presented token's scopes/org/places exactly; no `apx_places` claim → `places: []`; `conformanceClasses` ⊆ the bootstrap document's | §16.2 |
| APX-DSC-02 | Soundness: every listed endpoint/command callable for at least one target in the granted places; an unlisted endpoint the server implements → 403 `insufficient-scope`; an endpoint of an unclaimed class → 404 `target-not-found` | §16.2, §9.3a |
| APX-DSC-03 | Two clients with different grants receive different documents | §16.2 |
| APX-DSC-04 | Offered optional features listed in `features` of the bootstrap document and of every discovery document whose client holds a scope of the class | §16.1, §16.2, §6.5 |
| APX-DSC-05 **C** (claims `apx-ui-launch`) | `uiSurfaces[]` lists only surfaces the client may launch at a granted place, with display modes, launch modes, actions and places; `placeCapabilities[]`, where present, lists per place a subset of the document's `commandTypes`, `uiSurfaces` and `features` | §16.2, §25.1 |

## A.8 `apx-accounts` / A.9 `apx-payment-history`

| ID | Requirement | Source |
|---|---|---|
| APX-ACC-01 | Account lookup by any filter combination; results constrained to the caller's grant | §13.1, §13.5 |
| APX-ACC-02 | Take-payment idempotent; declines → 422; approved account payments reduce balance | §13.1 |
| APX-ACC-03 | `PaymentRecord.place` populated (site binding); `apx.accounts.payment.recorded.v1` published for every recorded payment | §13.5, §13.4 |
| APX-ACC-04 | Payment links / refund / void / capture as domain operations with Idempotency-Key; refunds gated per policy; payment links readable and cancellable | §13.1a |
| APX-ACC-05 | Payment state machine per the §13.1a table (a hold = `approved` + `captureStatus: authorized` via `captureLater`, capture/void, cumulative `refundedAmount`); every other action → 409 `payment-state-illegal`; holds excluded from `GET /v1/payments` unless `captureStatus=authorized`, never published or materialized until captured; the recorded event re-published on every status or amount change | §13.1a, §13.2, §13.4 |
| APX-ACC-06 | More than four card digits in any body member or query parameter → 422 `personal-data-not-permitted`, refused before persisting or logging | §13.1, §13.2 |
| APX-ACC-07 **C** (persists APDS Payment) | Every `approved`, captured PaymentRecord is materialized as, or bound to, a native APDS `Payment` with a `paymentLines` entry of `paymentType: payment` and `value` = `amount` (or, for a record itemized per §13.6a, with its `lines` unchanged as `paymentLines` and its `rateSold` copied, never the lines a second time in the decoration); declined records and uncaptured holds are not | §13.6, §13.6a |
| APX-ACC-08 | `POST /v1/accounts:search` and `POST /v1/payments:search` answer as their `GET`s, with the same key, window, hold, and grant rules | §13.1, §13.2 |
| APX-ACC-10 | `POST /v1/payments/{id}/receipt` re-sends a settled payment's receipt by `channel` with `destination` in the body, answering 202 `ReceiptDelivery`; unsupported channel → 422 `receipt-channel-unsupported`; unsettled payment → 409 `payment-state-illegal`; refund `reasonCode` accepted and returned | §13.1a |
| APX-ACC-09 **C** (itemizes payments) | `apds-ext:apx:payment-detail@1.0` accepted on `POST /v1/payments` with `lines` as APDS `PaymentLine`s, the code in `idCode` (from `apx-payment-line-codes` or the implementer's own list; `validation` ⇔ `paymentType: validation`); `paymentType: payment` lines that do not sum to `amount` (same `currencyType`) → 422 `request-unprocessable`, nothing charged; the decoration returned unchanged on the record, `GET /v1/payments`, and the recorded event; refunds never rewrite the lines; on a native `Payment` the decoration carries `rateSold` only (no `lines`); no invented lines and no zero-fee line inferred | §13.6a |
| APX-PHX-01 | Truncated-key lookups without `date` constrained to last 8 hours, not configurable wider; `ticketNumber` and `account` exempt; a query with no key → 400 (except `mode=change`, APX-PHX-02) | §13.2, §9.6 |
| APX-PHX-02 | `GET /v1/payments?mode=change` serves the payment feed without a key or window, exactly the records `apx.accounts.payment.recorded.v1` delivers (holds from capture, voided holds never); `ticketLast4`/`cardLast4` with `mode=change` → 400 `invalid-request` | §13.2, §5.2 r8 |

## A.10 `apx-lpr`

| ID | Requirement | Source |
|---|---|---|
| APX-LPR-01 | Ingest via native `POST /observations`; cross-lookup plate↔ticket (and by Observation id or Session) with confidence + imagery links; a lookup with no key → 400 `invalid-request`; value-keyed lookups bounded by the grant and never 403, entity-keyed ones outside it → 403 | §13.3, §13.5(4) |
| APX-LPR-02 | `LprRead.place` populated; `apx.data.observation.created.v1` published per ingest and `apx.data.observation.updated.v1` per replace; purged imagery removed and flagged `purgedImagery`, purged reads absent from every lookup | §13.5, §13.4, §13.3b |
| APX-LPR-03 | **C** (engine supplies it): `apds-ext:apx:lpr-read@1.0` accepted on ingest and projected as `LprRead.detail` / `PlateCandidate.detail`; winning values mirrored into the APDS-native fields; per-attribute confidences 0–1; nothing guessed when absent (no sentinel values, no 0,0 location); an engine read id reused as the Observation `id` makes a re-send `409 id-collision` | §13.3a(1–3, 8) |
| APX-LPR-04 | `accessEvent` accepted from the LPR system and projected on `detail`, never inferred by the server; revisions via `PUT /v1/lpr/reads/{observation}/access-event` (`If-Match`, stale → 409 `version-conflict`, same value → no-op) publish `apx.data.observation.updated.v1`; `movement` accepts `toward`/`away` and the deprecated `approaching`/`receding`; `laneTravel` deprecated | §13.3a(3–4), §13.4 |
| APX-LPR-05 | **C** (lane has LPR cameras): `apds-ext:apx:lane-cameras@1.0` accepted and preserved on `VehicularAccess`, `cameraId` unique within the Place (duplicate → 422 `request-unprocessable`) and equal to `Image.cameraID` on its reads | §13.3a(5) |
| APX-LPR-06 | Reads link their Session (`LprRead.session`); `GET /v1/lpr/reads?session=` lists a Session's reads, a Session outside the grant → 403; Session start and end follow reads' capture time, never arrival time | §13.3a(6, 8), §13.5(4) |
| APX-LPR-07 | `GET /v1/lpr/reads/{observation}` and `POST /v1/lpr/reads:search` served with the lookup's grant and purge rules | §13.3 |
| APX-LPR-08 **C** (reviews reads) | `detail.review` state and reasons; `PUT /v1/lpr/reads/{observation}/plate` writes the decision, keeps the engine's values (with confidences) in `review.original` on the first correction and never changes them, bumps the Observation version, publishes `apx.data.observation.updated.v1`, honours `If-Match` (stale → 409 `version-conflict`); same decision and values → no-op (no version, no event); `corrected` without `plate`, or plate values with another decision → 422 `request-unprocessable`; no Session changed; without `apx.lpr:read` the 200 echoes only caller-supplied plate values | §13.3a(4a), §9.6 |
| APX-LPR-09 | `LprRead.images[]` lists every unpurged image with its kind; `plateExtended`/`context` carried as strings | §13.3c |
| APX-LPR-10 | Vehicle attributes of a read with no plate country kept in `detail` and `vehicleAncillaryIdentification` omitted, never dropped | §13.3a(1) |
| APX-LPR-11 | Passage facts (`accessEvent`, `movement`, `plateFace`, `frameReads`, `platesRead`, `captureGroup`, `speed`, `engine`) served under `apx.data:read` and on the observation topics to subscribers without `apx.lpr:read`; plate-bearing members only under `apx.lpr:*` | §13.3a(7), §9.6 r1 |

## A.11 `apx-reservations` / A.12 `apx-permits`

| ID | Requirement | Source |
|---|---|---|
| APX-RSV-01 | Reservations as native Quote→AssignedRight with `apds-ext:apx:reservation@1.0`; lifecycle per the Part 14 transition table (illegal → 409); `plannedUses[0]` authoritative and mirrored by the extension | §14 |
| APX-RSV-02 | Holder ids treated as local; cross-system correlation by plate; place-scoped history lookups; recent lookup requires `plate` or `holder` (both intersect) | §14.1a |
| APX-RSV-03 | `PUT /v1/sessions/{id}/assigned-right` materializes into the APDS Session (`segments[].assignedRight`) + SessionUpdated; unlinkable right, or a different right on a linked session → 409 `right-not-linkable`; unlink reverts the segment and the reservation state | §14.1b |
| APX-PRM-01 | Pooled issuance over RightSpecification/RightPool; exhaustion → 409 `pool-exhausted`; refusals per §14.2a; Idempotency-Key replay consumes no second slot | §14.2, §14.2a |
| APX-PRM-02 | Issued permit materialized onto the native AssignedRight per §14.2b (CustomerCredential holder, VehicleCredential per vehicle, PlannedUse + `expiry`); native `credential_id` filters resolve against the identification string; cancellation or expiry returns the slot | §14.2b, §14.2c |
| APX-PRM-03 **C** (multi-vehicle permits with a limit) | `apds-ext:apx:permit@1.1` `maxConcurrentVehicles` honoured; an overage billed per `overageBilling` or cited as `permitMisuse`; no pool slot moves | §14.2d |

## A.13 `apx-tolling`

| ID | Requirement | Source |
|---|---|---|
| APX-TOL-01 | TollTransaction idempotent create binding Observations→pricing→Payment reference | §15 |
| APX-TOL-02 | Dispute lifecycle; re-dispute of closed → 409 `dispute-closed` | §15 |
| APX-TOL-03 | Transitions per the §15.1 table (price, payment, void, dispute, resolve); anything else → 409 `toll-transition-illegal`; re-attaching the attached payment → 200 unchanged; `adjusted` moves the old amount to `dispute.originalPricing` | §15.1, §15.2 |

## A.14 `apx-resolution`

| ID | Requirement | Source |
|---|---|---|
| APX-RES-01 | Context resolves from any parking-domain identifiers; never fails for absent ones; telephony values accepted only as the comms-point members (`callerId`, `dialedNumber`, `commsDeviceId`), never SIP identifiers; a server without comms points → 422 `comms-point-unknown` on those members | §17.1–17.2 |
| APX-RES-02 | Partial results supported; context never includes sections the token couldn't read directly | §17.2 |
| APX-RES-03 | AllowedActions evaluated server-side; denied/gated actions carry machine-readable reasons | §17.3 |
| APX-RES-04 | Policy decisions BINDING on execution, on commands and on domain operations alike: 403 `action-not-allowed` / `approval-required`; a command type the named context does not offer → 403 `action-not-allowed` | §17.3 |
| APX-RES-05 | `recommendedAction` is one of allowedActions (runtime check); execution descriptors name only supported actions and satisfy the `AllowedAction` conditional rules | §17.3 |
| APX-RES-06 | Support interactions recorded (idempotent under `Idempotency-Key`), completable by versioned PUT, queryable by subject or `correlationId`; summaries not transcripts | §17.6 |
| APX-RES-07 **C** (tracks passback) | Passback read + resetPassback/forceIn/forceOut commands; a known but untracked credential → 200 `state: unknown` | §17.4, §17.8 |
| APX-RES-08 **C** (stores LPR) | Plate candidates read + `PUT /v1/sessions/{id}/plate` materializing into the APDS Session + SessionUpdated; stale `If-Match` → 409 `version-conflict`; closed session outside the dispute window → 422 `session-not-open` | §17.5 |
| APX-RES-09 | `interactionId` treated as opaque (echoed on the context, recordable on support interactions, never interpreted); a caller's `correlationId` carried on the context, commands, payment links, events, and support interactions of the same episode (SHOULD) | §17.7 |
| APX-RES-10 **C** (gates any action) | `POST /v1/approvals` opens a `pending` request with `role`, `action`, `target`, `requestedBy` and `correlationId`; `decide` records `approved`/`denied` with `decidedBy`; a decision on a non-pending request → 409 `approval-closed`; `expiresAt` honoured; every transition publishes `apx.approvals.changed.v1`; an `approval` citing `approvalRequest` is verifiable against the request | §17.3a |
| APX-RES-11 | `reservationIssuer` and `guestReference` accepted as qualifiers (never counted as identifying members); `commsPoint`, `callerId`, `dialedNumber`, `commsDeviceId` resolved to the lane when the comms point has one, else the place only | §17.1, §26.4 |
| APX-RES-12 **C** (claims `apx-ui-launch`) | `execution.type: ui` carries `surface`; the policy decision binds the launch; `SupportInteraction.resolution.code` from `apx-interaction-outcomes` or an implementer code; `actions[]` may reference `UiLaunch` and `UiActionRecord` | §17.3, §17.6, §25.5 |

## A.15 `apx-violations`

| ID | Requirement | Source |
|---|---|---|
| APX-VIO-01 | Violation idempotent create (Idempotency-Key semantics as APX-CTL-01); eligibility check performed and recorded at creation; entitled vehicles recorded as `dismissed` with basis | §19.1, §19.2 |
| APX-VIO-02 | Lifecycle per §19.1 with immutable `statusHistory[]`; terminal states `dismissed`, `closed`, `voided`; illegal transitions → 409 `violation-transition-illegal`; void from every non-terminal state (incl. `paid`), never deletes | §19.1 |
| APX-VIO-03 | `guided`/`manual` detections reviewed before issuance; unreviewed issue → 409 `violation-not-issuable`; automated unreviewed-issuance rule applied from `EnforcementPolicy.unreviewedIssuance` where present, otherwise published in operator documentation | §19.4 |
| APX-VIO-04 | One appeal per violation, from `issued` or (within the appeal window) `paid`; `upheld`/`reduced` return to the state opened from, `dismissed` closes; `appeal-closed` for a second appeal, a closed/voided violation, a passed window, or a resolve with no open appeal; `amount` changes only via `reduced` | §19.1, §19.6 |
| APX-VIO-05 | Settlement by Payment reference only (Part 13 takes the money, and returns it on a pay-then-appeal via `refund`); `paid` only from `issued` | §19.6 |
| APX-VIO-06 | `GET /v1/enforcement/eligibility` derivable from held APDS rights/sessions; ancestor-bound rights count; `basis[]` never exceeds the token's `/rights/assigned` grant; `suggestedViolationType` advisory | §19.3 |
| APX-VIO-07 | Evidence and `lastRead` imagery as access-controlled links; plate values only under `apx.violations:*`; retention published; appellant media treated as untrusted | §19.5, §9.6 |
| APX-VIO-08 | `apx.violations.detected.v1`, `.issued.v1`, `.status.v1` published; place-bound on `Violation.place` | §19.7 |
| APX-VIO-09 | `Violation.location` modelled on the APDS Observation Location shape (optional `observerLocation`, added `accuracyMetres`), GeoJSON [lon, lat]; guided/manual carry `observerLocation`; automated copies from the Observation | §19.9 |
| APX-VIO-10 | Policy in force resolved by nearest-ancestor-or-self at `detectedTime`; `…/policies/effective` returns exactly what `issue` applies; refusals per §19.10 rule 2 with the named problem types; `policy`, `signage[]`, `unpaidAmount`, `capAmount`, and the first `amountHistory` entry (`issued`, or `cap` with `requestedAmount`) frozen at issue | §19.10 |
| APX-VIO-11 | Escalation server-applied per schedule, never before `paymentGraceDays`, never while `appealed` (days appealed do not count), clamped at `overallCeiling`; each step appended to `amountHistory` and published; clients never compute penalties | §19.10 |
| APX-VIO-12 | Signage history immutable (text change on a referenced record → 422 `signage-referenced`); in-force signage frozen on the violation at issue; `signageRequired` enforced | §19.11 |
| APX-VIO-13 | Partial payments appended to `payments[]` as `ViolationAppliedPayment` (amount, `paidTime`, Part 13 `payment` or a source `reference`) and summed in `amountPaid`; `paid` only when `amountPaid` ≥ `amount`; refunds reduce `amountPaid` | §19.6a |
| APX-VIO-14 | `POST /v1/enforcement/violation-imports` idempotent and keyed on `system`+`recordId`; higher `sourceRevision` (else later `sourceUpdatedTime`) updates, the same is a no-op, older is 409 `version-conflict`; at or past `issued` without `notice` or `amount` → 400 `invalid-request`; `paid` with `amountPaid` < `amount` → 422 `request-unprocessable`; `statusHistory[]` append-only, source times kept; no eligibility check or cap applied; `GET /v1/violations` filters `sourceSystem` and `sourceRecordId` | §19.13 r1–4, §19.2 |
| APX-VIO-15 | `POST /v1/violations/{id}/session` with `If-Match` (stale → 409 `version-conflict`) sets, corrects, or clears (`session: null`) `relatedSession` and writes the match-evidence decoration; valid in every state, terminal included; no `statusHistory[]` entry; a change bumps `version` and publishes `status.v1`, identical content is a no-op; unknown or invisible Session → 422 `reference-unknown`, Session outside the place hierarchy → 422 `request-unprocessable` | §19.13 r6 |
| APX-VIO-16 | `issue` refused with 409 `violation-not-issuable`, whatever the detection mode, while any LPR read in `observations[]` has plate review `pending` or `rejected` | §19.4 r6, §13.3a(4a) |
| APX-VIO-17 | `issue` refused with 409 `violation-not-issuable` when the `relatedSession` link's evidence (`apds-ext:apx:match-evidence@1.0` on the Violation, or the related Session's `session-detail.matches[]` entry for it) has `plate.method: lenient` or `applied: false` | §19.4 r5, §5.8 r5 |
| APX-VIO-18 | `EnforcementPolicy.stayGrace` `entryMinutes` and `exitMinutes` accepted as independent optional integers ≥ 0 (absent = no grace on that side, `0` = none) and inherited and versioned with the policy; `EligibilityResult.graceUntil` derived from the `stayGrace` of the policy in force at `checkedTime` (entry side while no right covers the stay, exit side once its rights have ended), absent when that side has no grace or a right covers the stay | §19.10 r7, §19.3 r5 |

## A.16 `apx-validations`

| ID | Requirement | Source |
|---|---|---|
| APX-VAL-01 | Program lifecycle `active ⇄ suspended → ended` via versioned `PUT` (`If-Match` or body `version`, Part 4 §4.2a); stale version → 409 `version-conflict`; out of `ended` → 422 `program-not-active`; ambiguous benefit → 422 `request-unprocessable`; `statusHistory[]` immutable | §20.1 |
| APX-VAL-02 | Provider list (Part 6) derived from active programs covering the queried place or an ancestor, each row carrying `program`; `applyValidation` materializes a `ValidationRedemption` | §20.1, §6.3 |
| APX-VAL-03 | Issuance idempotent, program taken from the path; `codes[]` returned exactly once; codes ≥ 64 bits entropy and implementation-unique; unknown/out-of-grant code → 404 never 403; batches and single codes voidable, redeemed codes unaffected | §20.2 |
| APX-VAL-04 | Redemption idempotent; rule set evaluated in order with 422 `program-not-active` / `instrument-invalid` / `redemption-limit-exceeded` (place mismatch → `request-unprocessable`); `stackable` evaluated both ways; APDS-native validation record materialized and returned as `validationId`; `amountReduced` is the actual effect | §20.3 |
| APX-VAL-05 | Reversal restores amount due (open session) and instrument; already reversed → 409 `redemption-reversed`; a redemption on a closed statement is reversed without editing it and credited on the next statement | §20.4 |
| APX-VAL-06 | `apx.validations:redeem` confined to the token's own provider (`apx_org`) for reads, issuance, voiding, redemption, and events; another provider's resource → 404; cannot enrol, reverse, or close | §20.5 |
| APX-VAL-07 | Statement preview computable for any period; closed statements immutable and non-overlapping (409 `statement-overlap`); post-closure reversals appear as `credit` lines on the next statement, `billableAmount` net of them | §20.6 |
| APX-VAL-08 | `apx.validations.redeemed.v1`, `.program.status.v1`, `.statement.closed.v1` published; place-bound | §20.7 |

## A.17 `apx-credentials`

| ID | Requirement | Source |
|---|---|---|
| APX-CRD-01 | Lifecycle per §21.1 with immutable `statusHistory[]`; illegal transitions (including `replace` from `issued`) → 409 `credential-transition-illegal`; terminal replace → 409 `credential-not-replaceable`; identification unique per type among non-terminal records → 409 `credential-identification-in-use` whose `detail` identifies no record, holder, or place; a window already over (`validity.end`, suspend `until`) → 422 `request-unprocessable` | §21.1 |
| APX-CRD-02 | Active records materialized as APDS `CredentialAssigned` (`identifier` → the record) on every listed AssignedRight; removed/ended on suspend, lost, revoke, expire; restored on resume; lane denies non-active credentials from the transition instant | §21.2 |
| APX-CRD-03 | `replace` idempotent and atomic on the AssignedRight (one `AssignedRightUpdated`); `replaces`/`replacedBy` linked; deposit settled per `oldDepositStatus`; the predecessor retains all other fields | §21.3 |
| APX-CRD-04 | Access events recorded with outcome and seeded `denialReason`; unmatched presentations recorded as `AccessEvent` with `presented`; `GET …/{id}/access-events` and `GET /v1/access-events` served, grant-scoped; `apx.credentials.access.v1` published; passback corrections remain Part 17 | §21.4 |
| APX-CRD-05 | Identification, serials, and access events under Part 9 §9.6; no identification-in-use oracle outside `apx.credentials:manage` | §21.5 |
| APX-CRD-06 | `apx.credentials.status.v1` on every transition including server-side `expired`, timed resume, and activation at `validity.start` (`activateOnStart`) | §21.1, §21.6 |

## A.18 `apx-valet`

| ID | Requirement | Source |
|---|---|---|
| APX-VLT-01 | Lifecycle per §22.1 with immutable `statusHistory[]`, every state reachable by a route (`pickup`, `cancel`, re-`park` from `staged`); illegal transitions → 409 `valet-transition-illegal`; `retrieve` from `dropped` → 409 `valet-vehicle-not-located`; drop-off idempotent and ignores client-sent server-written members; `park` honours `If-Match` (409 `version-conflict`) | §22.1 |
| APX-VLT-02 | ValetTicket references the APDS Session (and AssignedRight where issued) and never restates the stay or the money; `closed` follows Session settlement | §22, §22.1, §22.4 |
| APX-VLT-03 | Drop-off condition report immutable after `dropped` (corrections appended through `POST …/condition` as new dated entries); imagery as access-controlled links; `customerAcknowledged` captured where obtainable | §22.2 |
| APX-VLT-04 | `retrieve` sets `etaMinutes` (minutes until `promisedTime`, never negative) and `promisedTime` and publishes `apx.valet.retrieval.requested.v1`; a repeat while `requested`/`retrieving` is 200 with nothing republished; queue ordered by `promisedTime`; scheduled pickups surface inside the horizon | §22.3 |
| APX-VLT-05 | Handback verifies the claimant; failure → 403 `valet-verification-failed` recorded in `statusHistory`; `verificationValue` never stored; handback condition report recorded | §22.4 |
| APX-VLT-06 | `apx.valet:request` confined to the caller's own ticket(s) — any other ticket → 404 `target-not-found`; operator tokens outside the grant → 403 `insufficient-grant`; minimized read returns exactly the §22.5 member list (no `statusHistory`, storage, key tag, or condition report); can only read, retrieve, cancel-retrieval | §22.5 |
| APX-VLT-07 | No raw phone/e-mail on the ticket (`contactChannel.handle` opaque/masked; SHOULD refuse with 422 `personal-data-not-permitted`); condition-imagery retention published | §22.6 |
| APX-VLT-08 | `apx.valet.ticket.status.v1` on every transition; place-bound on `ValetTicket.place` | §22.7 |

## A.19 `apx-mtls`

| ID | Requirement | Source |
|---|---|---|
| APX-TLS-01 | Client certificate required on every APX and APDS-native route except `/.well-known/apx-configuration`; TLS 1.2 minimum (1.3 RECOMMENDED); a connection without one is refused at the handshake | §9.1, §16.3 |
| APX-TLS-02 | `/.well-known/apx-configuration` retrievable without a client certificate and lists `apx-mtls` | §16.3 |
| APX-TLS-03 | Tokens certificate-bound per RFC 8705 (SHOULD); a token whose binding does not match the connection certificate → 401 `unauthenticated` | §16.3 |

## A.20 Implementation Conformance Statement (template)

An ICS is a filled-in copy of this annex plus the header below. Publish it
with the implementation's documentation; `/.well-known/apx-configuration`
MUST advertise exactly the classes the ICS claims.

```
Implementation: <product, version>
Supplier:       <organisation>
APX edition:    <e.g. 0.3.0>   APDS version: 4.1
Date:           <ISO 8601>

Classes claimed: [ ] apx-data  [ ] apx-events  [ ] apx-events-sse
  [ ] apx-control  [ ] apx-alerts  [ ] apx-discovery  [ ] apx-accounts
  [ ] apx-payment-history  [ ] apx-lpr  [ ] apx-reservations
  [ ] apx-permits  [ ] apx-tolling  [ ] apx-resolution  [ ] apx-violations
  [ ] apx-validations  [ ] apx-credentials  [ ] apx-valet  [ ] apx-mtls
  [ ] apx-charging  [ ] apx-plate-lists  [ ] apx-ui-launch
  [ ] apx-site-config

For each requirement row of every claimed class (and A.1):
  <ID>: PASS | N/A (conditional not applicable) | DEVIATION (explain)
```

A claim with any unexplained non-PASS row on a claimed class is
non-conforming (§3.1: no partial classes).

## A.21 `apx-charging` (Part 23)

| ID | Requirement | Source |
|---|---|---|
| APX-EVC-01 | ChargingPointStatus keyed by Reference to the APDS ElectricChargingEquipment; carries `refillPointIndex`/`evseId`; static descriptive fields never duplicated; bridge `PUT …/status` cannot write `bay` | §23.1 |
| APX-EVC-02 | Lifecycle per §23.2 driven by `ChargingEvent`s applied in time order with immutable `statusHistory[]`; illegal transitions → 409 `charging-transition-illegal`; open on an unavailable point → 409 `charging-point-unavailable` | §23.2 |
| APX-EVC-03 | `complete → idle` server-side after `idlePolicy.graceMinutes`; `idleStartedTime` set; `apx.charging.idle.started.v1` published | §23.2, §23.12 |
| APX-EVC-04 | Bay presence fused per the §23.3 table; `vehicleNotPluggedIn`/`blocked` yield `availability: blocked` when no cable is connected (a connected cable wins); camera Observation carried as evidence; `bay.vehicle`/`imageLink` operator-scope only | §23.1, §23.3 |
| APX-EVC-05 | `deliveredKwh` never derived from time × rated power; absent energy means unreported | §23.4 |
| APX-EVC-06 | `settlement.mode` honoured: `parkingSession` requires the Session reference and refuses `…/payment` (409 `charging-settlement-conflict`); `directPayment` closes on the payment attached after `unplugged` (earlier → 409); `chargingNetwork` records energy and idle without money; `idlePolicy` snapshotted, never re-priced, idle billed per started unit | §23.5 |
| APX-EVC-07 | `apx.charging:status` confined to the caller's own session(s) and the place's point availability; reads minimized exactly per the §23.6 omit-lists | §23.6 |
| APX-EVC-08 | `OccupancySnapshot.evCharging` populated where point status is held | §23.7 |
| APX-EVC-09 | Charger actions only via Part 6 commands; `confirmationLevel` discipline applies | §23.9 |
| APX-EVC-10 | `apx.charging.session.status.v1` on every transition; `apx.charging.point.status.v1` on availability/presence change; place-bound on `.place` | §23.12 |

## A.22 `apx-plate-lists` (Part 24)

| ID | Requirement | Source |
|---|---|---|
| APX-PLL-01 | Lists with a registry or implementer `category`, an owning organisation, per-place flags, and `status`; every `places[].place` written inside the writer's grant (403 `insufficient-grant`) | §24.1 |
| APX-PLL-02 | List visibility: a place in the grant, or the caller's `apx_org` owns it; versioned `PUT` (409 `version-conflict`) | §24.1, Part 9 §9.3a |
| APX-PLL-03 | Entries with an APDS `CredentialTypeEnum` credential and validity; adding a credential already on the list with overlapping validity updates it (200) | §24.2 |
| APX-PLL-04 | Plate values only under `apx.platelists:*`; digests MAY stand in (Part 9 §9.6 r6) | §24.2 |
| APX-PLL-05 | Change feed on `/v1/plate-lists` and `/v1/plate-lists/{id}/entries`; entry removal tombstoned | §24.3, Part 5 §5.2 r8 |
| APX-PLL-06 | `apx.platelists.changed.v1` on every list or entry change, carrying no plate values | §24.3 |

## A.23 `apx-ui-launch` (Part 25)

| ID | Requirement | Source |
|---|---|---|
| APX-UIL-01 | Offered surfaces are `apx-ui-surfaces` values listed in `uiSurfaces[]` of the bootstrap and discovery documents under the soundness rule; an unoffered surface → 422 `ui-surface-unknown`; an unlisted display mode → 422 `ui-display-mode-unsupported` | §25.1 |
| APX-UIL-02 | Handshake mode: `POST /v1/ui/launches` returns 201 with a single-use `url` valid at most 60 s (`expiresIn` clamped), bound to the surface, subject, agent and place; the agent is logged in automatically; `Idempotency-Key` replay → 200 | §25.2 |
| APX-UIL-03 **C** (offers signed tokens) | A JWS (`ES256`/`RS256`, never `none`) with `aud` the implementation, `exp` ≤ 60 s after `iat`, unique `jti`, and the request members as claims, delivered by form POST or URL fragment, opens the surface and creates the launch; expired, replayed or badly signed tokens refused | §25.2, §9.8 |
| APX-UIL-04 | Lifecycle `issued → opened → closed \| expired` with `openedAt`/`closedAt`; a second use of the url or token refused; action or close on a terminal launch → 409 `ui-launch-closed`, on an expired issued launch → 409 `ui-launch-expired`; every transition publishes `apx.ui.launch.changed.v1`; reads never return a usable `url` after `issued` | §25.2, §25.3 |
| APX-UIL-05 | Loopback, native first: every action with a supported APX operation produces that operation's own record and events, carrying the launch's `correlationId`, `agent` and `agentType` | §25.4 |
| APX-UIL-06 | Every other action recorded as a `UiActionRecord` (`action`, `outcome`, `occurredAt`, `summary`, `result` where any) via `POST /v1/ui/launches/{id}/actions` or an equivalent internal record, publishing `apx.ui.action.recorded.v1`; no action inferred from an opened launch | §25.4 |
| APX-UIL-07 | `returnFields[]` answered in `fields` by pointer, each unsupplied field listed in `unavailable[]` with `notSupported` or `notApplicable`, never omitted silently | §25.4 |
| APX-UIL-08 | Launch material never in a query string, referrer or log; no personal data or secrets in a url or token; `embed` only for registered origins with `frame-ancestors` set, else `popup`/`tab`; the opened session ends with the launch; signing keys and handshake secrets rotatable and never returned by a read | §25.6, §9.7, §9.8 |
| APX-UIL-09 **C** (claims `apx-resolution`) | `AllowedAction.execution.type: ui` offered with `surface` where no API operation exists; the decision binds the launch; launches and action records referenced from `SupportInteraction.actions[]` | §25.5 |

## A.24 `apx-site-config` (Part 26)

| ID | Requirement | Source |
|---|---|---|
| APX-SCF-01 | Every SupplementalEquipment served carries `apds-ext:apx:equipment-detail@1.0` with a `role` from `apx-equipment-roles` (a code, never free text); `equipmentType` still the nearest APDS value; `macAddresses[]` twelve lower-case hex digits; no IP address member | §26.1 |
| APX-SCF-02 | `GET /v1/equipment?place=` with `role`, `area`, `lane`, `level` filters and the Part 5 change feed; `GET /v1/equipment/{id}`; a `place` outside the grant → 403 `insufficient-grant`; the same elements and decorations served on the native `/places` routes | §26.1 r9 |
| APX-SCF-03 | `area` from `apx-area-types`; `level`, `lane`, `builtInto`, `controls[]`, `serviceProvider` as defined; `firmwareVersion`/`softwareVersion` readable by every client that may read the place | §26.1, §26.2 |
| APX-SCF-04 **C** (inventories cameras) | A camera is `role: camera` with `apds-ext:apx:camera@1.0`: `view[]` (≥ 1), `mounting` (with `builtInto` when `builtIn`), `faces` on lanes/plazas/ramps, `recorder`, `streams[]`, `retentionDays`; no address, user name or password; `lane-cameras@1.0` unchanged | §26.3 |
| APX-SCF-05 **C** (offers `cameraViews`/`cameraPlayback`) | `POST /v1/cameras/{id}/views` returns 201 with a single-use `url` bound to the agent, `expiresAt` ≤ 5 min; `playback` honours `from`/`to`; offline or unsupported kind → 409 `camera-view-unavailable`; range outside `retentionDays` → 422 `playback-range-unavailable`; every issue and use logged against agent and `correlationId`; the feature listed in discovery | §26.3, §9.8 |
| APX-SCF-06 | `CommsPoint` with a registry `type`, `place`, optional `lane`/`equipment`/`serves`/`coverage[]`, and at least one of `phoneNumber` (E.164), `callerId` (E.164), `commsDeviceId`; no SIP user name, realm or password accepted (422 `personal-data-not-permitted` for a password) | §26.4, §9.7 |
| APX-SCF-07 | `GET /v1/comms-points` honours `place`, `lane`, `type`, `callerId`, `dialedNumber` (= `phoneNumber`), `commsDeviceId` and serves the change feed; `POST`/`PUT`/`DELETE` under `apx.siteconfig:manage` with versioned `PUT` (409 `version-conflict`) and tombstoned `DELETE`; a comms point resolves to its lane when it has one, else its place only | §26.4 |
| APX-SCF-08 | `apds-ext:apx:place-operations@1.0` carries `commsAccountId` and `escalationContacts[]` as `apx-escalation-roles` values with `order` and `hours`; no names or numbers | §26.4 r5, §26.5 |
| APX-SCF-09 | `apds-ext:apx:external-ids@1.0` accepted and preserved on any HierarchyElement with `system` a URI; `POST /v1/identifiers:resolve` answers `target`, `className`, `place` for a held pair and 404 `target-not-found` otherwise, never confirming an element outside the grant | §26.6 |
| APX-SCF-10 | `apx.equipment.changed.v1` on every create, change or removal of a decorated SupplementalEquipment; `apx.commspoints.changed.v1` on every comms-point change; removals carry the last representation; both lists serve the change feed | §26.7 |
| APX-SCF-11 | No read, event or feed page of this Part carries a PARCS key, camera or device password, or credential-bearing stream address, in any member or nested text | §9.7 |
| APX-SCF-12 | `POST /v1/display-records` under `apx.displays:record` (Idempotency-Key optional), immutable once written; `display` a SupplementalEquipment (else 422 `reference-unknown`), `place` derived from it (a disagreeing body `place` → 422 `request-unprocessable`); `messageKind` a registry value or implementer code; `shownTime` required and the Part 6 §6.1a display members as defined; no message text or plate stored; with `command`, `shownTime` and `contentHash` agree with its `CommandResult.display` (else 422 `request-unprocessable`) | §26.9 r1–5, §9.6 r8 |
| APX-SCF-13 | `GET /v1/display-records` honours `place`, `display`, `messageKind`, `session`, `observation`, `since`/`until` and serves the change feed; `GET /v1/display-records/{id}`; `apx.displays.shown.v1` published for every record, place-bound | §26.9 r6–7 |
