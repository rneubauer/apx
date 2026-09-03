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

## A.2 `apx-data`

| ID | Requirement | Source |
|---|---|---|
| APX-DATA-01 | The eight native APDS routes served | §5.6 |
| APX-DATA-02 | `APX-Update-Mode: full\|change` on writes; explicit-null clears, absent unchanged; stale version → `version-conflict` | §5.1 |
| APX-DATA-03 | `mode=change` feed on /places, /sessions, /rates, /rights/assigned returning ChangeFeedPage | §5.2, §5.6 |
| APX-DATA-04 | Feed ordered and gapless per (class, credential, filter set); replay from any issued cursor exactly-once | §5.2 r1, r5–6 |
| APX-DATA-05 | Cursors honored ≥7 days; older → `target-not-found`; tombstones emitted and retained for the window | §5.2 r2, r4 |
| APX-DATA-06 | Grant expansion signaled via `grantAdditions` on the first page after the change | §5.2 r7 |
| APX-DATA-07 | Client sending no APX headers/params observes pure APDS 4.1 behavior | §5.6 |
| APX-DATA-08 **C** (holds occupancy) | `GET /v1/places/{id}/occupancy` served; snapshot derivable from the Place hierarchy | §5.5 |

## A.3 `apx-events`

| ID | Requirement | Source |
|---|---|---|
| APX-EVT-01 | Stock APDS `EventSubscription` accepted; stock request → APDS 200/202 ResponseStatus; `Prefer: return=representation` → 201 with one-time secret | §8.1 |
| APX-EVT-02 | Every delivery HMAC-SHA256-signed (`APX-Signature`, `APX-Timestamp`, `APX-Delivery-Id`); ±5-min replay window enforced by receivers | §8.3, §9.4 |
| APX-EVT-03 | Retry schedule 0s/30s/2m/10m/1h then hourly to 24h; exhaustion → status `failed` + `apx.subscription.failed.v1` | §8.3 |
| APX-EVT-04 | Envelope `id` stable across retries; `APX-Delivery-Id` unique per attempt | §8.3 |
| APX-EVT-05 | Per-topic place binding populated; `filters.places` matches bound place; unbindable events never delivered beyond grant | §8.5 |
| APX-EVT-06 | EventTypeEnum topics published for every entity class served for writes; APX topics of every claimed class published | §8.6 |
| APX-EVT-07 | Secret ≥32 bytes entropy; `APX-Key-Id` on every delivery during rotation overlap | §9.4 |

## A.4 `apx-events-sse`

| ID | Requirement | Source |
|---|---|---|
| APX-SSE-01 | `GET /v1/events/stream` for transport=sse subscriptions; `id:` = per-subscription sequence | §8.4 |
| APX-SSE-02 | `Last-Event-ID` resumes strictly after that sequence; ≥1000 events or 15 min buffered | §8.4 |

## A.5 `apx-control`

| ID | Requirement | Source |
|---|---|---|
| APX-CTL-01 | `POST /v1/commands` with REQUIRED Idempotency-Key; same key+body → original (200); different body → 409 | §6.1 |
| APX-CTL-02 | Commands perishable: past `expiryTime` → `expired`, MUST NOT fire | §6.1 |
| APX-CTL-03 | Immutable append-only `statusHistory` on every transition; transitions publish `apx.control.command.status.v1` | §6.1 |
| APX-CTL-04 | Cancel allowed until `dispatched`; after → 409 `command-not-cancellable` | §6.1 |
| APX-CTL-05 | `confirmationLevel` reported truthfully; consumers never overclaim beyond it | §6.1 |
| APX-CTL-06 | vendGate, lostTicket, pushRate, applyValidation implemented; lane inquiry; provider query; device status | §6.5 |
| APX-CTL-07 | `applyValidation` with unlisted provider → 422 `validation-provider-unknown` | §6.3 |
| APX-CTL-08 | Lost-ticket fee taken from the rate deck's disclosed lostTicketFee line; absent line → command fails | §6.1 |

## A.6 `apx-alerts`

| ID | Requirement | Source |
|---|---|---|
| APX-ALT-01 | Alert lifecycle raised→acknowledged→resolved with immutable statusHistory; illegal transitions → 409 | §7 |
| APX-ALT-02 | Idempotent raise (Idempotency-Key semantics as APX-CTL-01) | §7 |
| APX-ALT-03 | Alert types from `apx-alert-types` (open registry); subtree-inclusive place filtering | §7 |

## A.7 `apx-discovery`

| ID | Requirement | Source |
|---|---|---|
| APX-DSC-01 | `GET /v1/discovery` reflects the presented token's scopes/org/places exactly | §16.2 |
| APX-DSC-02 | Soundness: every listed endpoint/command callable; unlisted APX endpoints → 403 | §16.2 |
| APX-DSC-03 | Two clients with different grants receive different documents | §16.2 |

## A.8 `apx-accounts` / A.9 `apx-payment-history`

| ID | Requirement | Source |
|---|---|---|
| APX-ACC-01 | Account lookup by any filter combination; results constrained to the caller's grant | §13.1, §13.5 |
| APX-ACC-02 | Take-payment idempotent; declines → 422; approved account payments reduce balance | §13.1 |
| APX-ACC-03 | `PaymentRecord.place` populated (site binding); `apx.accounts.payment.recorded.v1` published for every recorded payment | §13.5, §13.4 |
| APX-ACC-04 | Payment links / refund / void / capture as domain operations with Idempotency-Key; refunds gated per policy | §13.1a |
| APX-PHX-01 | Truncated-key lookups without `date` constrained to last 8 hours, not configurable wider | §13.2, §9.6 |

## A.10 `apx-lpr`

| ID | Requirement | Source |
|---|---|---|
| APX-LPR-01 | Ingest via native `POST /observations`; cross-lookup plate↔ticket with confidence + imagery links | §13.3 |
| APX-LPR-02 | `LprRead.place` populated; `apx.data.observation.created.v1` published per ingest | §13.5, §13.4 |

## A.11 `apx-reservations` / A.12 `apx-permits`

| ID | Requirement | Source |
|---|---|---|
| APX-RSV-01 | Reservations as native Quote→AssignedRight with `apds-ext:apx:reservation@1.0`; lifecycle per Part 14 | §14 |
| APX-RSV-02 | Holder ids treated as local; cross-system correlation by plate; place-scoped history lookups | §14.1a |
| APX-PRM-01 | Pooled issuance over RightSpecification/RightPool; exhaustion → 409 `pool-exhausted` | §14.2 |

## A.13 `apx-tolling`

| ID | Requirement | Source |
|---|---|---|
| APX-TOL-01 | TollTransaction idempotent create binding Observations→pricing→Payment reference | §15 |
| APX-TOL-02 | Dispute lifecycle; re-dispute of closed → 409 `dispute-closed` | §15 |

## A.14 `apx-resolution`

| ID | Requirement | Source |
|---|---|---|
| APX-RES-01 | Context resolves from any parking-domain identifiers; never fails for absent ones; no telephony identifiers accepted | §17.1–17.2 |
| APX-RES-02 | Partial results supported; context never includes sections the token couldn't read directly | §17.2 |
| APX-RES-03 | AllowedActions evaluated server-side; denied/gated actions carry machine-readable reasons | §17.3 |
| APX-RES-04 | Policy decisions BINDING on execution: 403 `action-not-allowed` / `approval-required` | §17.3 |
| APX-RES-05 | `recommendedAction` is one of allowedActions; execution descriptors name only supported actions | §17.3 |
| APX-RES-06 | Support interactions recorded/queryable; summaries not transcripts | §17.6 |
| APX-RES-07 **C** (tracks passback) | Passback read + resetPassback/forceIn/forceOut commands | §17.4 |
| APX-RES-08 **C** (stores LPR) | Plate candidates read + `PUT /v1/sessions/{id}/plate` materializing into the APDS Session + SessionUpdated | §17.5 |

## A.15 `apx-mtls`

| ID | Requirement | Source |
|---|---|---|
| APX-TLS-01 | Mutual TLS on all APX endpoints; TLS 1.2 minimum (1.3 RECOMMENDED); client identity bound to the OAuth client | §9.1 |

## A.16 Implementation Conformance Statement (template)

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
  [ ] apx-permits  [ ] apx-tolling  [ ] apx-resolution  [ ] apx-mtls

For each requirement row of every claimed class (and A.1):
  <ID>: PASS | N/A (conditional not applicable) | DEVIATION (explain)
```

A claim with any unexplained non-PASS row on a claimed class is
non-conforming (§3.1: no partial classes).
