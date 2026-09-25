# Changelog

All notable changes to the APX standard. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow the
conformance/versioning rules in Part 3 of the written standard.
The machine-readable spec (`spec/openapi/apx.yaml`, bundled as
`spec/dist/apx-v1.*`) is normative; entries here are informative.

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
