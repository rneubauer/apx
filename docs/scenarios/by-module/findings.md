# Findings — consolidated (APX v0.10.0)

The per-module detail lives in `apx-<module>/findings.md`; this file
groups the 205 findings by the fix that closes them, so the 0.11.0 update
can be planned as a small number of changes rather than 205 edits. IDs are
unchanged and still cited by `gap=` markers in the scenario files.

## Totals

| Module | File | Findings | High |
|---|---|---|---|
| control | apx-control/findings.md | 10 | 0 |
| data | apx-data/findings.md | 15 | 2 |
| events | apx-events/findings.md | 17 | 1 |
| alerts | apx-alerts/findings.md | 9 | 0 |
| discovery | apx-discovery/findings.md | 14 | 0 |
| accounts | apx-accounts/findings.md | 14 | 0 |
| lpr | apx-lpr/findings.md | 15 | 1 |
| reservations | apx-reservations/findings.md | 16 | 2 |
| permits | apx-permits/findings.md | 12 | 2 |
| tolling | apx-tolling/findings.md | 14 | 0 |
| resolution | apx-resolution/findings.md | 13 | 0 |
| violations | apx-violations/findings.md | 16 | 0 |
| validations | apx-validations/findings.md | 13 | 1 |
| credentials | apx-credentials/findings.md | 11 | 0 |
| valet | apx-valet/findings.md | 16 | 0 |
| **total** | | **205** | **10** (98 medium, 97 low) |

Severity is each author's call and is not yet normalized across modules.

---

## A. Cross-cutting fixes (one change closes many findings)

**A1. Register `unauthenticated` (401) in Part 12.** Every 401 in the spec
is declared as a `Problem` whose `type` must be registered, and none is.
F-CTL-07, F-ACC-01, F-CRD-03, F-DSC-03, F-EVT-03, F-LPR-06, F-TOL-07,
F-VAL-01, F-VLT-03, F-VIO-01; reused by alerts and resolution.

**A2. Register a generic `invalid-request` (400) with an `errors[]`
member.** Body-shape 400s are declared everywhere but only
`idempotency-key-required` is registered at 400. F-CTL-01, F-ALT-05,
F-CRD-02, F-EVT-01, F-LPR-05, F-LPR-09, F-PRM-02, F-RES-01, F-TOL-05,
F-VAL-12, F-VLT-01, F-VIO-02, F-VIO-05, F-RSV-13, F-RSV-15, F-ACC-03.

**A3. Register `reference-unknown` (422) for a body Reference that names
nothing.** F-CRD-01, F-VLT-02, F-VIO-03, F-VAL-02, F-PRM-02.

**A4. Register per-resource illegal-transition slugs where they are
missing.** Violations, credentials, and valet have one; alerts, tolling,
reservations, and payments do not. F-ALT-01, F-TOL-03, F-RSV-09, F-ACC-04.

**A5. Declare 401, 403, 404, and 429 on every secured operation, and add a
Spectral rule that fails the build when one is missing.** The single
largest cluster, found in every module. F-CTL-06, F-CTL-08, F-ACC-02,
F-ALT-02, F-DATA-03, F-DSC-10, F-EVT-02, F-PRM-04, F-RES-09, F-RSV-12,
F-RSV-15, F-TOL-06.

**A6. One optimistic-concurrency rule in Part 4.** `version` is readOnly
yet every versioned PUT needs it, and no `If-Match` is declared. Choose
`If-Match` with 428, or body `version` REQUIRED as the precondition, and
say whether it is the version read or the next one. F-VIO-12, F-VAL-11,
F-RSV-07, F-EVT-11, F-LPR-08, F-RES-06, F-VLT-09, F-PRM-09.

**A7. Error dialect on the APDS-native routes.** Part 5 requires
`version-conflict` problems on native writes, but the vendored 409s
declare only `ResponseStatus`, and the §12.1 `Accept` negotiation is not in
the OpenAPI. Needs an overlay that adds `application/problem+json` to the
native error responses. F-DATA-04, F-DATA-05, F-RSV-08, F-PRM-09.

**A8. Idempotency on every create that consumes something.** F-PRM-01
(high: a retried permit issue burns pool capacity), F-RES-08, F-TOL-13,
F-EVT-11. Also state that a replay returns the current representation, not
a snapshot: F-ALT-09, F-TOL-12.

**A9. `place` filters: list-valued, subtree-inclusive, and present
everywhere a list is.** F-CTL-04, F-CRD-09, F-VLT-16, F-VIO-11, F-ACC-08,
F-LPR-07, F-DATA-15, F-TOL-04.

**A10. Place-less lookups and the grant.** Say once, in Part 9, whether a
lookup that names no place under an empty grant returns an empty 200 or
403, and how place-less resources (a subscription-failure alert) are
scoped. F-ACC-13, F-LPR-14, F-ALT-08, F-DSC-09.

**A11. 403 or 404 for a resource outside the caller's grant or ownership.**
Pick one rule in Part 9. F-VLT-08, F-VAL-07, F-DSC-02.

**A12. `extensions` containers where Part 4 §4.3 promises them.** APX
resources missing it, and APDS entities that never declare it, so
APX-CORE-04 rests on undeclared keys. F-DATA-06, F-LPR-03, F-LPR-12,
F-RSV-05, F-PRM-05, F-DSC-06.

**A13. Name the data schema of every topic.** F-EVT-05, F-EVT-06,
F-EVT-07, F-RSV-11, F-PRM-10. The bundle also drops APDS
`EventData`/`EventTypeEnum`, which Parts 5 and 8 cite: F-DATA-12, F-PRM-11.

## B. High-severity findings

| ID | What breaks |
|---|---|
| F-EVT-14 | Retries are not required to be re-signed with a fresh `APX-Timestamp`, so a receiver enforcing the ±5-minute window rejects every retry after the first five minutes. A real interop bug. |
| F-DATA-02 | Change-mode writes cannot validate: native schemas require full state and forbid the explicit-null sentinel. Part 5 §5.1 is unimplementable as specified. See also F-DATA-01, F-RSV-06. |
| F-DATA-07 | (upstream) `RateTable` requires two properties it never defines, so no RateTable can validate. |
| F-DATA-09, F-LPR-02 | (upstream) `POST /observations` discriminator collides with `ObservationElement.type`; no single-element ingest body can validate. |
| F-RSV-01 | (upstream) `POST /quotes` declares no request body. |
| F-RSV-02 | (upstream) `ReferenceToQuote` is a `oneOf` of two identical branches, so booking from a quote can never validate. |
| F-PRM-01 | Permit issue has no `Idempotency-Key`. |
| F-PRM-06 | How a permit materializes onto the native `AssignedRight` is unspecified; three different shapes are in circulation. |
| F-VAL-06 | §20.4 refuses a reversal in a closed period while §20.6 says it becomes a credit on the next statement, and no operation can record that credit. |

## C. Items in the APDS 4.1 document (filed upstream as errata)

These sit in the vendored, checksum-guarded APDS 4.1 file, so APX cannot
edit them. They join the three errata already filed.

- `RateTable` required-but-undefined properties: F-DATA-07.
- `POST /observations`: no responses (F-DATA-08, F-LPR-01); discriminator collision and the `ObvservationSet` mapping typo (F-DATA-09, F-LPR-02); no `extensions` on `ObservationElement` (F-LPR-03).
- `/quotes`: no request body, single-object list (F-DATA-10, F-RSV-01); `ReferenceToQuote` identical branches (F-RSV-02); `rateTableId` vs `rateTableID` (F-RSV-03).
- `AssignedRight` has no `extensions` (F-RSV-05, F-PRM-05).
- `GeoJsonObject` has no `coordinates` (F-VIO-15).
- Response-code irregularities on `/rates`, `/rights/assigned`, `/contacts` (F-DATA-14).

Where APX needs a working shape before APDS ships a fix, an overlay can
supply it without touching the vendored file, as the data overlay already
does.

## D. State machines with unreachable states or missing routes

Each of these is a state the spec defines that no operation can produce,
or a transition users need that has no route.

- Tolling: `voided` and `created → priced` (F-TOL-01, F-TOL-02).
- Valet: `dropped → cancelled`, `requested → retrieving`, `staged → parked`, condition-report corrections (F-VLT-04 to F-VLT-07).
- Validations: voiding an issuance or instrument (F-VAL-05).
- Accounts: an `authorized` state for authorize-then-capture; payment-link read and cancel (F-ACC-05, F-ACC-06).
- Credentials: automatic activation at `validity.start` (F-CRD-06).
- Violations: pay-then-appeal, and which states are terminal (F-VIO-13, F-VIO-10).
- Permits: cancel, refund, and changing vehicles (F-PRM-08, F-PRM-09).
- Reservations: re-pointing or unlinking a session's right (F-RSV-16).

## E. Missing read and list routes

- `GET /v1/commands`, the audit query (F-CTL-10).
- `GET /webhooks/{id}` (F-EVT-10).
- `GET /v1/access-events` by lane or place (F-CRD-08).
- Payment-link read (F-ACC-06).
- Support-interaction read and update (F-RES-12).
- Support history by `correlationId` (F-RES-05).

## F. Defects in the public scenario docs

These pass `npm run scenarios:check` today only because that check
validates responses and not requests. The runner here checks both.

- Scenarios 05 and 06: the create returns `ResponseStatus`, not the right, and `credentials[]` is not an APDS shape (F-RSV-04).
- Scenario 18: the issuance body omits the required `program` (F-VAL-04).
- Scenario 21: `meta.totalCount` is not in `PaginatedListMeta` (F-VLT-15), and the minimized customer read contradicts §22.6 (F-VLT-12).
- Scenario 03: `modified_since` is sent as RFC 3339, but APDS defines it as a Unix epoch (F-DATA-13).

Porting the runner's request-body check into `tools/validate-scenarios.mjs`
would stop this class of drift in the public repo.

## G. Everything else

The remaining findings are module-local ambiguities: a rule stated only in
prose, a filter a real console needs, an enum that should be a registry, or
an event whose trigger is unstated. Each is in its module file with a
proposed additive fix.

## G — 0.12.0 re-vet (2026-09-28), fixed in 0.12.1 except upstream 013

The LPR module was re-vetted after 0.12.0 (access events, lane cameras,
Sessions) and grew from 22 to 35 scenarios. Four new findings, all
fixed in 0.12.1 except the upstream half of F-LPR-17:

| IDs | Fix |
|---|---|
| F-LPR-16 | **High.** The `accessEvent` revision route (`PUT /observations/{id}`) does not exist in APDS 4.1; `observation.updated.v1` can never fire. Needs an APX route (or other mechanism). |
| F-LPR-17 | (upstream) `VehicularAccess` is unreachable through the `HierarchyElement` discriminator, so lanes and `lane-cameras` are never validated. Overlay fix plus candidate erratum 013. |
| F-LPR-18 | No named refusal for a duplicate `cameraId` within a Place. |
| F-LPR-19 | **High.** APX's own decorations (`lpr-read`, `lane-cameras`, …) were never validated inside `extensions`. |

## H — cross-module refusal probe (2026-09-28), fixed in 0.12.2

Every `invalid`-marked request in all fifteen files (69) was validated
against the schema directly. Seven were accepted: five native `PUT`s
(F-DATA-16, high), one appeal resolution (F-VIO-17, low), and one unknown
`commandType` (by design: registries are open, checked at runtime). After
0.12.2 only the command case and one change-mode ambiguity (see F-DATA-16)
remain, both expected.
