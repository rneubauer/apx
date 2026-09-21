# Changelog

All notable changes to the APX standard. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow the
conformance/versioning rules in Part 3 of the written standard.
The machine-readable spec (`spec/openapi/apx.yaml`, bundled as
`spec/dist/apx-v1.*`) is normative; entries here are informative.

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
