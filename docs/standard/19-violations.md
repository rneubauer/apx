# APX Part 19 — Violations (optional class `apx-violations`)

Enforcement: what operators variously call tickets, notices, warnings, and
citations, under one resource — **Violation**. A **net-new surface**: APDS
4.1 has no violation entity. It does have the pieces enforcement needs, and
APX builds on them rather than beside them:

- **Eligibility comes from `AssignedRight`.** APDS's own text calls
  assigned rights "the most important source of information for connected
  enforcement systems to check the eligibility of a parked vehicle". APX
  never redefines that; it composes it (§19.3).
- **Evidence is native `Observation` + `Image`** (links, never inline —
  Part 9 §9.6). Location is a `HierarchyElement` reference; the vehicle is
  an APDS `CredentialTypeEnum` credential; money is `AmountInCurrency`;
  settlement links a `Payment` (Part 13).
- **Identity reuses APDS's enforcement role.** The vendored `oAuth` scheme
  already defines the `ep` (Enforcement Provider) role, and `Contact`
  carries an `enforcementSystemProvider` responsibility. An enforcement
  client reads the native routes with `ep` and the APX routes with
  `apx.violations:*`.

Two enforcement styles are first-class, distinguished by
`detection.mode`:

| Mode | Who finds it | Who decides | Typical detector |
|---|---|---|---|
| `automated` | a camera/sensor pipeline | policy (no human) | fixed LPR, bay sensors, mobile LPR vans |
| `guided` | the system surfaces a candidate | an officer, on site | handheld: eligibility check → confirm → issue |
| `manual` | an officer | the officer | handheld / mobile app |

## 19.1 The Violation resource and lifecycle

See schema `Violation`. One resource carries the whole story: `detection`,
`eligibilityCheck` (the §19.3 answer at detection time), `observations[]`
and `evidence[]` (references and links), `notice` (what was issued),
`amount`/`dueTime`/`payment` (settlement), `appeal`, and the immutable
`statusHistory[]` (Part 4 §4.2).

**Lifecycle (normative).**

```
detected ──review──▶ confirmed ──issue──▶ issued ──payment──▶ paid ──▶ closed
   └──review──▶ dismissed

issued ──appeals──▶ appealed ──upheld / reduced──▶ issued
paid   ──appeals──▶ appealed ──upheld / reduced──▶ paid     (pay-then-appeal)
                    appealed ──dismissed─────────▶ closed

every non-terminal state ──void──▶ voided
```

The **terminal** states are `dismissed`, `closed`, and `voided`; every
other state (`detected`, `confirmed`, `issued`, `appealed`, `paid`) is
non-terminal.

1. `review` is valid only from `detected`; `issue` from `confirmed`, or
   from `detected` when `detection.mode` is `automated` AND the policy in
   force permits unreviewed issuance (§19.4 rule 1). A `guided` or
   `manual` detection MUST pass through `review` before `issue` — 409
   `violation-not-issuable` otherwise. A `dismiss` decision MUST carry a
   `reason`; without one it is 400 `invalid-request`.
2. `payment` is valid only from `issued`; `appeals` from `issued`, or
   from `paid` within the policy's `appealWindowDays` (pay-then-appeal,
   §19.6); `appeals/resolve` only from `appealed`. Any other transition
   is 409 `violation-transition-illegal`, except the appeal refusals of
   rule 3. `paid → closed` is a server-side administrative transition
   (reconciliation complete, appeal and refund windows elapsed —
   operator policy) with no API operation.
3. One appeal per violation. The state it was opened from is recorded
   as `appeal.openedFrom`. `upheld` returns to that state (`issued` or
   `paid`); `reduced` does the same with `amount` replaced by
   `adjustedAmount` (REQUIRED; 400 `invalid-request` without it);
   `dismissed` moves to `closed`. **`appeal-closed`** is the refusal for
   the appeal itself: opening a second appeal, opening one on a
   `closed` or `voided` violation or after the appeal window, and
   resolving when no appeal is open, whatever the state. Opening an
   appeal on a violation that was never issued (`detected`,
   `confirmed`, `dismissed`) is `violation-transition-illegal`.
4. `void` is valid from every non-terminal state and never deletes
   anything: the record, evidence links, and `statusHistory[]` remain
   readable. Voiding a `paid` violation SHOULD carry the Part 13
   `refund` reference that returned the money. `void` from a terminal
   state is 409 `violation-transition-illegal`.
5. A detection whose eligibility check finds the vehicle **entitled** is
   still recorded — as `dismissed`, with the basis — so the audit trail
   shows what was checked. Implementations MAY suppress creation under a
   documented policy (e.g. automated pipelines that pre-filter), but MUST
   NOT silently drop a `guided` or `manual` submission.
6. `amount` and `dueTime` are set at `issue` and change only through
   `appeals/resolve` (`reduced`) or a server-applied escalation step of
   the policy in force (§19.10); every change is appended to
   `amountHistory[]`, and `amount` always equals its last entry.
   Collections handoff beyond `closed`/`voided` is out of scope for this
   edition; implementers carry it in `extensions` (Part 3 §3.3).

## 19.2 Endpoints

Scopes: `apx.violations:read` (list, read, eligibility) and
`apx.violations:manage` (create and every transition). Every list is
paginated in the APDS `PaginatedList` shape and constrained to the
caller's place grant (Part 9 §9.3).

- `POST /v1/violations` — record a detection. **Idempotency-Key
  REQUIRED** (cameras and handhelds retry; a retry must not create a
  second violation). The server performs the §19.3 eligibility check and
  records it. Publishes `apx.violations.detected.v1`. An unknown `place`
  or a `violationType` outside the served registries is 422
  `reference-unknown`; a malformed body is 400 `invalid-request`.
- `GET /v1/violations?plate=&noticeNumber=&status=&type=&place=&detectionMode=&since=&until=&sourceSystem=&sourceRecordId=`
  / `GET …/{id}`. `noticeNumber` is the lookup a driver can make with
  what they hold; like `plate`, it names no place, so it returns only
  violations at granted places (Part 9 §9.3a rule 3). `sourceSystem` and
  `sourceRecordId` find a violation imported from another system by its
  source record (§19.13); `sourceRecordId`, too, names no place.
- `POST …/{id}/review` — `confirm` | `dismiss` (guided enforcement). A
  `violationType` in the body corrects the detector's classification.
- `POST …/{id}/issue` — issue the warning/notice/citation: `noticeKind`,
  `amount`, `dueTime`, `deliveryMethod`. Publishes
  `apx.violations.issued.v1`.
- `POST …/{id}/payment` — attach the settling Payment reference → `paid`,
  or a partial payment that leaves it `issued` (§19.6a).
  The payment itself is taken through Part 13 (`POST /v1/payments`, a
  payment link, or an APDS Payment ingested from a pay station).
- `POST …/{id}/appeals` — open the appeal (from `issued`, or from `paid`
  within the appeal window); `POST …/{id}/appeals/resolve` — `upheld` |
  `reduced` (+ `adjustedAmount`) | `dismissed`, with `refund` on a
  pay-then-appeal.
- `POST …/{id}/void` — void with reason (and `refund` when `paid`).
- `POST /v1/violations:search` and `POST /v1/enforcement/eligibility:check`
  — the list lookup and the eligibility check with the plate in a body,
  never a URL; same rules and answers as the `GET`s (Part 9 §9.6 rule 7).
- `POST /v1/enforcement/violation-imports` and `POST …/{id}/session` —
  violations issued by another system, and the Session link set after
  creation (§19.13). The import lives under `/v1/enforcement`, not
  `/v1/violations/…`, for the reason the eligibility check does: no
  literal segment sits beside `/v1/violations/{id}`.
- The versioned `PUT`s on policies and signage take the version last
  read as `If-Match` or body `version` (Part 4 §4.2a).
- `GET /v1/enforcement/eligibility?credential=&credentialType=&place=&at=`
  — §19.3. Lives under `/v1/enforcement` rather than `/v1/violations/…`
  because no violation exists yet when the question is asked (and to
  keep the path unambiguous against `/v1/violations/{id}`).

Every transition appends to `statusHistory[]` and publishes
`apx.violations.status.v1`.

## 19.3 The eligibility check (guided enforcement)

`GET /v1/enforcement/eligibility` answers "is this vehicle entitled to be
here right now, and by what?" — the guided-enforcement screen-pop, the
counterpart of Part 6's lane inquiry. It returns an `EligibilityResult`:

- `entitled` — true when at least one `basis[]` entry is `valid` for the
  place at `checkedTime`.
- `basis[]` — every AssignedRight and Session considered, with a
  `status` explaining why it does or does not cover the stay: `valid`,
  `expired`, `notYetValid`, `wrongPlace`, `consumed`, `suspended`.
- `suggestedViolationType` — when not entitled, the `apx-violation-types`
  value the server's rules suggest. **Advisory**: the officer decides at
  `review`; the server's suggestion is never binding.
- `graceUntil` — when operator policy grants a grace period.
- `lastRead` — the latest plate read of the credential at the place.

**Normative rules.**

1. The answer MUST be derivable from the APDS entities the server holds
   (`/rights/assigned`, `/sessions`, and the Part 14 reservation/permit
   profiles). This is a convenience READ in the spirit of Part 5 §5.5
   (occupancy) and Part 6 (lane inquiry): a client MAY compute the same
   answer from the native routes, and the AssignedRight remains
   authoritative where they disagree.
2. Rights bound to an ancestor of `place` in the hierarchy (a campus
   permit, a lot-wide reservation) MUST count as covering it; rights
   bound to a sibling or a different subtree are `wrongPlace`.
3. `basis[]` MUST NOT include rights the token could not read directly
   via `/rights/assigned` under its grant.
4. Evaluating at a past `at` MUST use the rights and sessions as they
   were at that instant (a backdated payment does not retroactively
   entitle an already-detected violation unless operator policy says so
   at `review`).

## 19.4 Automated and guided enforcement (normative)

1. **Automated.** An `automated` detection MUST carry at least one
   `observations[]` reference or one `evidence[]` link, and SHOULD carry
   `detection.confidence` and `detection.rule`. Whether an automated
   detection may proceed `detected → issued` without review is operator
   policy. Where the EnforcementPolicy in force (§19.10) carries
   `unreviewedIssuance`, that is the policy: the server MUST refuse
   `issue` (409 `violation-not-issuable`) unless `permitted` is true,
   the detection's `confidence` is at least `minimumConfidence` (when
   set), and its `violationType` is in `violationTypes` (when set).
   Where the policy is silent, the rule MUST be published in operator
   documentation and enforced the same way. Publishing it on the policy
   lets pipelines read it from `…/policies/effective` in advance.
2. **Guided.** A `guided` detection MUST be reviewed by a human before
   issuance. Implementations SHOULD publish `apx.violations.detected.v1`
   so handhelds can queue candidates; the eligibility check result at
   detection time is recorded so the officer sees what the system saw.
3. **Manual.** A `manual` detection MAY be created and issued by the same
   officer in sequence; the review step still applies (the officer
   confirms their own finding) so that every issued violation has a
   `confirmed` entry with an actor in `statusHistory[]`.
4. `detection.principal` (badge id, pipeline name) and
   `statusHistory[].actor` are opaque strings — no personnel directory is
   implied by this standard.
5. **Match evidence: excuse, never accuse.** How `relatedSession` was
   linked MAY be recorded as the decoration
   `apds-ext:apx:match-evidence@1.0` (Part 5 §5.8 rule 5). Where that
   evidence, or the related Session's `session-detail` `matches[]` entry
   whose `target` is this Violation, has `plate.method: lenient` or
   `applied: false`, the server MUST refuse `issue` with 409
   `violation-not-issuable`: a lenient or shadow match may excuse a stay
   but never accuse one. This holds for every server and every detection
   mode.
6. **Reviewed reads.** Whatever the detection mode, the server MUST
   refuse `issue` (409 `violation-not-issuable`, `detail` naming the
   read) while any LPR read in the Violation's `observations[]` has
   `detail.review.state` `pending` (its plate review is not done) or
   `rejected` (a reviewer found it unusable as plate evidence) — Part 13
   §13.3a(4a). A read with no `review`, or one `notRequired`,
   `confirmed`, or `corrected`, does not block issuance.

## 19.5 Evidence and privacy

Violations carry plate values and imagery and are subject to Part 9 §9.6
in full: plate values appear only under `apx.violations:*` (and the other
scopes §9.6 lists); `evidence[].imageLink` and `lastRead.imageLink` MUST be
access-controlled under the same authentication and place grant as the
violation; retention MUST be published and purgeable. Appeals may carry
`evidenceLinks` supplied by the appellant; implementations MUST treat them
as untrusted media and SHOULD scan or transcode before serving.

## 19.6 Settlement and appeals

Money on a violation is never taken by this Part. `amount` is what is
owed; `payment` is the reference to how it was settled — an APX
`PaymentRecord` (`POST /v1/payments` with the violation's notice number as
the reference, or a `PaymentLink` for pay-by-mail/online) or a native APDS
`Payment`. Attaching it moves the violation to `paid` and, where the
implementation claims `apx-accounts`, the payment's own
`apx.accounts.payment.recorded.v1` event fires as usual.

**Pay then appeal.** A driver may pay first and contest later: an
appeal opened from `paid` within the policy's `appealWindowDays` moves
the violation to `appealed` with `appeal.openedFrom: paid`, and no
escalation applies meanwhile. `upheld` returns it to `paid`. `reduced`
returns it to `paid` with the new `amount`, and the difference is
refunded through Part 13 §13.1a (`/v1/payments/{id}/refund`); `dismissed`
closes it and the whole payment is refunded the same way. The resolve
call carries the refund's reference as `refund`, recorded on
`appeal.refund`. The money moves only through Part 13; this Part records
the link.

Appeal reasons and resolutions are implementer code lists (jurisdictional
vocabulary varies too widely to close); `apx-violation-types` is the only
APX registry this Part defines.

### 19.6a Partial payment (normative)

1. A payment attached with `POST …/{id}/payment` contributes its
   `amount`, or the whole outstanding amount when `amount` is absent.
   Every attached payment is appended to `payments[]` as a
   `ViolationAppliedPayment` (`amount`, `paidTime`, and the Part 13
   `payment` reference) and added to `amountPaid`. A payment an import
   source took itself (§19.13), with no Part 13 record here, carries the
   source's own `reference` instead of `payment`.
2. `paid` means `amountPaid` ≥ `amount`. A payment that leaves an
   outstanding balance keeps the violation `issued`, appends a
   `statusHistory[]` entry noting it, and publishes
   `apx.violations.status.v1`; the escalation clock keeps running on the
   outstanding balance.
3. `payment` is the payment that settled the violation; it is set when
   the violation becomes `paid`.
4. Refunds on a pay-then-appeal (§19.6) and on void reduce `amountPaid`
   by the refunded amount.

## 19.7 Eventing

- `apx.violations.detected.v1` on creation (data: `Violation`).
- `apx.violations.issued.v1` on issuance (data: `Violation`).
- `apx.violations.status.v1` on every other transition — review, payment
  (partial payments included), appeal open/resolve, void — and on a
  change of the Session link or an applied import revision (§19.13)
  (data: `Violation`).

Place binding (Part 8 §8.5) uses `Violation.place`. Subscriptions to these
topics require `apx.violations:read` (Part 9 §9.6 rule 4).

## 19.8 APDS alignment

| Concept | APDS construct reused | APX adds |
|---|---|---|
| Entitlement | `AssignedRight`, `Session`, `/rights/assigned` | the composed `EligibilityResult` read |
| Evidence | `Observation`, `Image`, `Confidence` | references and access-controlled links on the violation |
| Location | `HierarchyElementReference` (`place`, `space`) | subtree semantics for ancestor-bound rights |
| Vehicle | `CredentialTypeEnum` (`licensePlate`, `permit`, `rfid`…) | `jurisdiction`, officer description |
| Issuer | `Contact` / `Organisation` reference; `ep` OAuth role | `notice.issuedBy` |
| Money | `AmountInCurrency`, `Payment` | `amount`, `dueTime`, `payment` reference |
| Lifecycle | — (APDS has none) | the §19.1 state machine and `statusHistory[]` |

Should APDS standardize an enforcement or citation entity natively, Part 3
§3.3(8) applies: the APDS construct wins and this Part migrates to it.

## 19.9 Location of the finding

`Violation.location` carries where the vehicle was and from where it was
observed. It is **modelled on** the APDS `Observation.Location` shape and
reuses its member names and types — `observedLocation` and
`observerLocation` (APDS `PointLocation`, GeoJSON Point) and
`observedLocationTextual` (`MultilingualString`) — with two differences:
`observerLocation` is optional here (APDS requires it; a finding from a
fixed sensor may have none), and APX adds `accuracyMetres`. It is not a
`$ref` to the APDS schema, so an APDS `Location` copied from an
Observation validates here, but not necessarily the reverse.

1. GeoJSON positions are `[longitude, latitude]` **in that order**.
   Enforcement tools that store latitude first MUST swap on the wire;
   implementations SHOULD reject positions whose first element is
   outside −180..180 (400 `invalid-request`, `errors[].pointer` naming
   the position).
2. `guided` and `manual` detections SHOULD carry `observerLocation` (the
   officer's position) — it is the evidence that the officer could see
   the vehicle and the signage. `automated` detections SHOULD copy
   `location` from the underlying Observation.
3. Coordinates are personal data when joined to a plate; Part 9 §9.6
   applies in full (scope minimization, retention, purge).

## 19.10 Enforcement policy (normative)

Jurisdictions increasingly regulate *when* a private-lot violation may
be issued or mailed, *how much* it may exceed the unpaid fee, and *how*
it may escalate. APX carries those rules as an `EnforcementPolicy` bound
to a HierarchyElement — a machine-readable summary the operator
configures from the governing statute (`authority.citation`), never the
statute itself — and makes them **binding on the server**, the same
principle Part 17 applies to allowed actions.

1. **Binding and inheritance.** A policy binds to `place` and applies to
   its subtree. The policy in force at an element is the nearest
   ancestor-or-self `active` policy whose `effectiveFrom`/`effectiveTo`
   covers the instant. `GET /v1/enforcement/policies/effective?place=`
   returns exactly what the server applies, so handhelds, pipelines, and
   appeals portals see the same rules.
2. **At `issue` the server MUST** resolve the policy in force at
   `Violation.place` at `detectedTime` and refuse with 422 when:
   - `notice.deliveryMethod` is not listed in a `deliveryRules` entry
     covering `detection.mode` → `delivery-method-not-permitted`;
   - the matching entry's `noticeDeadline` has elapsed since
     `detectedTime` → `notice-deadline-passed`;
   - the violation carries fewer `observations`/`evidence` images than
     the entry's `minimumEvidence`, or `locationRequired` and no
     `location.observedLocation` → `delivery-method-not-permitted`
     (`detail` names the missing evidence);
   - `amount` exceeds the cap and `onExceed` is `refuse` →
     `penalty-exceeds-cap`; with `clamp`, the server issues at the cap.
     The cap is the lowest `penaltyCap` bound; the relative bounds
     (`maximumMultipleOfUnpaid`, `maximumPercentOverUnpaid`) apply to
     the unpaid parking fee for the stay, which the server derives from
     the rate deck in force and records as `unpaidAmount`, with the
     resulting cap as `capAmount`;
   - `signageRequired` is true and no Signage (§19.11) was in force at
     `place` or an ancestor at `detectedTime` → `signage-required`.
   On success the server freezes `policy` (VersionedReference),
   `signage[]`, `unpaidAmount` and `capAmount` (where a cap applied),
   and the first `amountHistory` entry onto the violation. That entry
   is `reason: issued` with the issued amount; when the amount was
   clamped it is instead a single entry `reason: cap` whose `amount` is
   the clamped figure and whose `requestedAmount` is what `issue` asked
   for. A place with **no** policy in force issues without these
   checks; implementations SHOULD alert (Part 7) when a place under an
   enforcement class has none.
3. **Escalation is server-applied.** For a violation in `issued`, each
   `escalation[]` step fires once, when `afterDays` have elapsed since
   `notice.issuedTime` (and never before `paymentGraceDays`), adding
   `addAmount` and/or `addPercent` of the current amount, subject to
   `overallCeiling`: a step that would pass the ceiling clamps to it.
   The result is appended to `amountHistory[]` (`reason: escalation`,
   `step`) and `apx.violations.status.v1` is published. **The clock
   pauses during an appeal:** steps MUST NOT fire while `appealed`, and
   days spent `appealed` do not count toward `afterDays` or
   `paymentGraceDays`. A violation returning to `issued` after
   `upheld`/`reduced` therefore resumes the schedule where it stood
   when the appeal opened; nothing that "fell due" during the appeal
   fires on return. A policy step whose fixed `addAmount` alone exceeds
   `overallCeiling.maximumAmount` is refused at policy create or update
   (422 `request-unprocessable`); steps that merely could reach the
   ceiling are lawful. Clients MUST NOT compute penalties themselves.
4. `appealWindowDays`: an appeal opened within the window, from
   `issued` or from `paid`, MUST be accepted (subject to §19.1 rule 3);
   outside it, implementations MAY refuse with 409 `appeal-closed`.
5. A violation keeps the policy version it was issued under; policy
   updates (`PUT`, with the version last read per Part 4 §4.2a) affect
   issuance and escalation from then on only.
6. **Errors on policy and signage writes.** A body Reference that names
   nothing visible (an unknown `place`) is 422 `reference-unknown`; an
   inconsistent policy (an inverted effective window, the fixed step of
   rule 3) is 422 `request-unprocessable`; a body that fails the schema
   is 400 `invalid-request` (Part 12 §12.4).

## 19.11 Signage (normative)

Notice-and-signage laws make "what was posted at the place on the day"
evidence, as much as the plate photo. `Signage` records the posted text
(`MultilingualString`, verbatim), a photo (`imageLink`, access-controlled
per Part 9 §9.6), the sign's own `location`, `signType`, and the window
it was in force. It binds to a HierarchyElement with subtree inheritance;
`GET /v1/enforcement/signage/effective?place=&at=` returns everything in
force.

1. **History is immutable.** Changing the wording is a new record (or
   new version) with a new `effectiveFrom`, and `effectiveTo` set on the
   old one. `PUT` that alters `text` on a record any issued violation
   references is refused (422 `signage-referenced`).
2. **Frozen at issue.** The server records on the violation, as
   `signage[]` VersionedReferences, every Signage in force at `place` or
   an ancestor at `detectedTime`. Appeals see the sign text and photo
   the officer saw.
3. When the policy in force sets `signageRequired`, issuance without any
   such record is refused (`signage-required`, §19.10).
4. Signage is not a rate deck: it records what was displayed, not what
   is charged. Where the two disagree, the discrepancy is what the appeal
   is about, and the standard preserves both.

APDS 4.1 has no signage concept (`PlaceInformation` carries operating
restrictions and times, not posted text); this is net-new, built to APDS
conventions and subject to Part 3 §3.3(8).

## 19.12 Charging bays (Part 23)

A vehicle in an EV charging bay that is not plugged in — an ICE vehicle
or an EV not charging — is the existing `restrictedSpace` type, evidenced
by the bay Observation the Part 23 §23.3 fusion recorded. Registered in
`apx-violation-types` v2: `chargingBayIdle` — a vehicle remained connected in a
charging bay after charging completed beyond the posted idle limit; the
candidate is raised by a consumer of `apx.charging.idle.started.v1` when
`idlePolicy.maxIdleMinutes` elapses (Part 23 §23.10). Whether idle is a
fee, a violation, or both is the place's enforcement policy (§19.10) and
signage (§19.11).

## 19.13 Violations issued by an external enforcement system (normative)

Enforcement vendors issue citations on their own systems and report them
afterwards. The lifecycle of §19.1 assumes this server detected and
issued the violation through its own API calls, stamped with its own
time; an already-issued citation from elsewhere arrives in whatever
state its source has reached, with the source's times.

1. **Import.** `POST /v1/enforcement/violation-imports` (scope
   `apx.violations:manage`, `Idempotency-Key` REQUIRED) records a
   `ViolationImport`: a violation in any state, with the
   `statusHistory[]` times and actors the source recorded, its notice,
   amounts and payments, and the decoration
   `apds-ext:apx:violation-source@1.0` (`ViolationSource`: `system`,
   `recordId`, `sourceStatus`, `sourceRevision`, `sourceUpdatedTime`,
   and the server-set `receivedTime`). `ViolationImport` is its own
   request body, not a `Violation`: the members a `Violation` marks
   read-only (`violationStatus`, `notice`, `amountPaid`, `payments`) are
   ordinary members here, because the source, not this server, decided
   them. The server MAY keep the source's `id` or mint its own.
2. **Keyed on the source.** The pair `system` + `recordId` identifies the
   record. A later import with a higher `sourceRevision` — or, when the
   source keeps no counter, a later `sourceUpdatedTime` — updates it
   (200, version + 1, `apx.violations.status.v1`); the same revision is
   a no-op 200; an older one is 409 `version-conflict`. With neither
   ordering member, every import applies.
3. **What an import must say.** A state at or past issuance (`issued`,
   `paid`, `appealed`, `closed`) MUST carry `notice` (with
   `noticeNumber` and `issuedTime`) and `amount`, else 400
   `invalid-request`. `paid` MUST have `amountPaid` at least `amount`; a
   part-paid citation is `issued` with its `payments[]` (§19.6a), and
   `paid` below `amount` is 422 `request-unprocessable`. Payments the
   source took itself carry its own `reference` (§19.6a rule 1).
   `statusHistory[]` is append-only: the server keeps the entries it
   already holds and appends only the source's entries later than its
   last one, never rewriting history (Part 4 §4.2).
4. **The source decided.** The server performs no eligibility check
   (§19.3) and applies no policy clamp (§19.10) to an import; the
   source's status vocabulary is kept in `sourceStatus` and mapped onto
   `violationStatus` (a partial payment is `issued` with `amountPaid`,
   §19.6a). The first import publishes `apx.violations.detected.v1`,
   and `apx.violations.issued.v1` when the imported state is at or
   beyond `issued`. `sourceRecordId`, like `noticeNumber`, is a lookup
   that names no place (Part 9 §9.3a rule 3).
5. **Thereafter.** An imported violation follows §19.1 like any other:
   later transitions are API calls stamped by this server.
6. **Linking a Session after creation.** `POST /v1/violations/{id}/session`
   (`ViolationSessionLink`) sets, corrects, or clears (`session: null`)
   `relatedSession`, and writes the match evidence as the decoration
   `apds-ext:apx:match-evidence@1.0` (Part 5 §5.8), with the Session as
   `target`.
   - The link is not a lifecycle transition: it is valid in every
     state, terminal ones included, and appends nothing to
     `statusHistory[]`.
   - `If-Match` carries the Violation `version` last read (Part 4
     §4.2a); a stale one is 409 `version-conflict` and nothing is
     written. A change increments `version` and publishes
     `apx.violations.status.v1`; resending what the violation already
     holds is a no-op (200, no new version, no event).
   - A Session that does not exist or is not visible to the caller is
     422 `reference-unknown`; one at a place outside the hierarchy of
     the violation's `place` — neither the same element, an ancestor,
     nor a descendant — is 422 `request-unprocessable`.
   - Recording lenient or unapplied evidence on a violation is allowed;
     it then blocks `issue` (§19.4 rule 5).
