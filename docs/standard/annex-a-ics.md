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

## A.6 `apx-alerts`

| ID | Requirement | Source |
|---|---|---|
| APX-ALT-01 | Alert lifecycle raised→acknowledged→resolved with immutable statusHistory; illegal transitions → 409 `alert-transition-illegal`; an `AlertTransition` body's `detail` and `agent` are recorded on the appended history entry | §7.2, §7.3 |
| APX-ALT-02 | Idempotent raise (Idempotency-Key semantics as APX-CTL-01; a replay returns the alert as it currently stands) | §7.2 |
| APX-ALT-03 | Alert types from `apx-alert-types` (open registry); subtree-inclusive place filtering; `device` and `relatedEntity` filters honoured | §7.1, §7.2 |
| APX-ALT-04 | An alert still `raised` or `acknowledged` at its `expiryTime` becomes `expired` and publishes `apx.alert.status.v1`; an alert without one never expires | §7.3 |
| APX-ALT-05 | An alert with no place binding is visible to every token of its organisation regardless of `apx_places`, never to other organisations, and excluded from `place`-filtered lists | §7.1 |

## A.7 `apx-discovery`

| ID | Requirement | Source |
|---|---|---|
| APX-DSC-01 | `GET /v1/discovery` reflects the presented token's scopes/org/places exactly; no `apx_places` claim → `places: []`; `conformanceClasses` ⊆ the bootstrap document's | §16.2 |
| APX-DSC-02 | Soundness: every listed endpoint/command callable for at least one target in the granted places; an unlisted endpoint the server implements → 403 `insufficient-scope`; an endpoint of an unclaimed class → 404 `target-not-found` | §16.2, §9.3a |
| APX-DSC-03 | Two clients with different grants receive different documents | §16.2 |
| APX-DSC-04 | Offered optional features listed in `features` of the bootstrap document and of every discovery document whose client holds a scope of the class | §16.1, §16.2, §6.5 |

## A.8 `apx-accounts` / A.9 `apx-payment-history`

| ID | Requirement | Source |
|---|---|---|
| APX-ACC-01 | Account lookup by any filter combination; results constrained to the caller's grant | §13.1, §13.5 |
| APX-ACC-02 | Take-payment idempotent; declines → 422; approved account payments reduce balance | §13.1 |
| APX-ACC-03 | `PaymentRecord.place` populated (site binding); `apx.accounts.payment.recorded.v1` published for every recorded payment | §13.5, §13.4 |
| APX-ACC-04 | Payment links / refund / void / capture as domain operations with Idempotency-Key; refunds gated per policy; payment links readable and cancellable | §13.1a |
| APX-ACC-05 | Payment state machine per the §13.1a table (a hold = `approved` + `captureStatus: authorized` via `captureLater`, capture/void, cumulative `refundedAmount`); every other action → 409 `payment-state-illegal`; holds excluded from `GET /v1/payments` unless `captureStatus=authorized`, never published or materialized until captured; the recorded event re-published on every status or amount change | §13.1a, §13.2, §13.4 |
| APX-ACC-06 | More than four card digits in any body member or query parameter → 422 `personal-data-not-permitted`, refused before persisting or logging | §13.1, §13.2 |
| APX-PHX-01 | Truncated-key lookups without `date` constrained to last 8 hours, not configurable wider; `ticketNumber` and `account` exempt; a query with no key → 400 | §13.2, §9.6 |

## A.10 `apx-lpr`

| ID | Requirement | Source |
|---|---|---|
| APX-LPR-01 | Ingest via native `POST /observations`; cross-lookup plate↔ticket (and by Observation id) with confidence + imagery links; a lookup with no key → 400 `invalid-request`; value-keyed lookups bounded by the grant and never 403, entity-keyed ones outside it → 403 | §13.3, §13.5(4) |
| APX-LPR-02 | `LprRead.place` populated; `apx.data.observation.created.v1` published per ingest; purged imagery removed and flagged `purgedImagery`, purged reads absent from every lookup | §13.5, §13.4, §13.3b |
| APX-LPR-03 | **C** (engine supplies it): `apds-ext:apx:lpr-read@1.0` accepted on ingest and projected as `LprRead.detail` / `PlateCandidate.detail`; winning values mirrored into the APDS-native fields; per-attribute confidences 0–1; nothing guessed when absent | §13.3a(1–3) |
| APX-LPR-04 | `laneTravel` derived from `plateFace` + `movement` + camera orientation + lane `accessType`; `unknown` when inputs are missing; `againstLane` SHOULD raise `wrongWayTravel` (`relatedEntity` the Session, the Observation under `apds-ext:apx:alert-evidence@1.0`) and MUST still open/match the Session | §13.3a(4–5) |

## A.11 `apx-reservations` / A.12 `apx-permits`

| ID | Requirement | Source |
|---|---|---|
| APX-RSV-01 | Reservations as native Quote→AssignedRight with `apds-ext:apx:reservation@1.0`; lifecycle per the Part 14 transition table (illegal → 409); `plannedUses[0]` authoritative and mirrored by the extension | §14 |
| APX-RSV-02 | Holder ids treated as local; cross-system correlation by plate; place-scoped history lookups; recent lookup requires `plate` or `holder` (both intersect) | §14.1a |
| APX-RSV-03 | `PUT /v1/sessions/{id}/assigned-right` materializes into the APDS Session (`segments[].assignedRight`) + SessionUpdated; unlinkable right, or a different right on a linked session → 409 `right-not-linkable`; unlink reverts the segment and the reservation state | §14.1b |
| APX-PRM-01 | Pooled issuance over RightSpecification/RightPool; exhaustion → 409 `pool-exhausted`; refusals per §14.2a; Idempotency-Key replay consumes no second slot | §14.2, §14.2a |
| APX-PRM-02 | Issued permit materialized onto the native AssignedRight per §14.2b (CustomerCredential holder, VehicleCredential per vehicle, PlannedUse + `expiry`); native `credential_id` filters resolve against the identification string; cancellation or expiry returns the slot | §14.2b, §14.2c |

## A.13 `apx-tolling`

| ID | Requirement | Source |
|---|---|---|
| APX-TOL-01 | TollTransaction idempotent create binding Observations→pricing→Payment reference | §15 |
| APX-TOL-02 | Dispute lifecycle; re-dispute of closed → 409 `dispute-closed` | §15 |
| APX-TOL-03 | Transitions per the §15.1 table (price, payment, void, dispute, resolve); anything else → 409 `toll-transition-illegal`; re-attaching the attached payment → 200 unchanged; `adjusted` moves the old amount to `dispute.originalPricing` | §15.1, §15.2 |

## A.14 `apx-resolution`

| ID | Requirement | Source |
|---|---|---|
| APX-RES-01 | Context resolves from any parking-domain identifiers; never fails for absent ones; no telephony identifiers accepted | §17.1–17.2 |
| APX-RES-02 | Partial results supported; context never includes sections the token couldn't read directly | §17.2 |
| APX-RES-03 | AllowedActions evaluated server-side; denied/gated actions carry machine-readable reasons | §17.3 |
| APX-RES-04 | Policy decisions BINDING on execution, on commands and on domain operations alike: 403 `action-not-allowed` / `approval-required`; a command type the named context does not offer → 403 `action-not-allowed` | §17.3 |
| APX-RES-05 | `recommendedAction` is one of allowedActions (runtime check); execution descriptors name only supported actions and satisfy the `AllowedAction` conditional rules | §17.3 |
| APX-RES-06 | Support interactions recorded (idempotent under `Idempotency-Key`), completable by versioned PUT, queryable by subject or `correlationId`; summaries not transcripts | §17.6 |
| APX-RES-07 **C** (tracks passback) | Passback read + resetPassback/forceIn/forceOut commands; a known but untracked credential → 200 `state: unknown` | §17.4, §17.8 |
| APX-RES-08 **C** (stores LPR) | Plate candidates read + `PUT /v1/sessions/{id}/plate` materializing into the APDS Session + SessionUpdated; stale `If-Match` → 409 `version-conflict`; closed session outside the dispute window → 422 `session-not-open` | §17.5 |

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

For each requirement row of every claimed class (and A.1):
  <ID>: PASS | N/A (conditional not applicable) | DEVIATION (explain)
```

A claim with any unexplained non-PASS row on a claimed class is
non-conforming (§3.1: no partial classes).
