# Findings — apx-lpr

Each entry is something a scenario in `scenarios.md` needed that
the public spec (`apx` at v0.10.0, re-checked at 0.12.0 on 2026-09-28, vendored APDS 4.1) does not define,
or defines ambiguously. IDs are stable; scenarios cite them in
`gap=F-LPR-NN` markers so the runner reports them as known gaps rather
than failures, and reports them as resolved once the spec is fixed.
Entries marked "(upstream APDS)" are issues in the vendored
`apds-api-4.1.yaml`; the fix there is an APX overlay or an upstream
issue, not an edit to the vendored file.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-LPR-01 | lpr | medium | (upstream APDS) `POST /observations` declares no responses at all | fixed (overlay) — 201/400/409 `ResponseStatus` like the other native creates (not the echoed Observation); erratum 005 |
| F-LPR-02 | lpr | high | (upstream APDS) `POST /observations` discriminator `type` collides with `ObservationElement.type`; no single-element body can validate | fixed (overlay) — plain `oneOf [ObservationElement, ObservationSet]`; erratum 006 |
| F-LPR-03 | lpr | low | (upstream APDS) `ObservationElement` declares no `extensions` container; the `apds-ext:apx:lpr-read@1.0` decoration is an undeclared additional property | fixed (overlay) — `extensions` declared on ObservationElement/Set; erratum 010 (the lpr-read value check stays with LPR) |
| F-LPR-04 | lpr | medium | `LprRead` has no `lane`; `laneTravel` is derived from a lane the consumer cannot see | fixed — optional `lane` and `cameraId` on `LprRead` (§13.3) |
| F-LPR-05 | lpr | low | No problem type for a lookup with no key; `GET /v1/lpr/reads` declares no 400 | fixed — 400 `invalid-request` declared; one of plate/ticket/observation REQUIRED (§13.3) |
| F-LPR-06 | lpr | low | No problem type for 401 (same as F-CTL-07) | fixed — `unauthenticated` registered (4417f2f) |
| F-LPR-07 | lpr | low | The `place` narrowing parameter §13.5(3) permits is not declared on `GET /v1/lpr/reads` | fixed — optional `place` (subtree) declared; out-of-grant 403 (§13.5(4)) |
| F-LPR-08 | lpr | medium | `PUT /v1/sessions/{id}/plate` has no optimistic-concurrency hook and declares no 409 | fixed — `If-Match` + 409 `version-conflict`; 200 returns Session `version` (§17.5) |
| F-LPR-09 | lpr | low | `PUT /v1/sessions/{id}/plate` declares no 400; Part 12 has no body-shape slug | fixed — 400 + `invalid-request` (4417f2f) |
| F-LPR-10 | lpr | medium | Plate correction on a closed or settled session: allowed or refused is unsaid, and no refusal is declared | fixed — closed session only inside dispute window with `reason`, else 422 `session-not-open` (§17.5); registry wording widening asked of integrator |
| F-LPR-11 | lpr | medium | `PUT /v1/sessions/{id}/plate` returns plate values under `apx.data:write`, which §9.6(1) does not list as a plate-bearing scope | fixed — §17.5: the 200 echoes only caller-supplied values; adding `apx.lpr:read` to the route's security would be breaking, so not done; §9.6(1) note asked of integrator |
| F-LPR-12 | lpr | low | `LprRead`, `PlateCandidate`, `LprReadDetail` have no `extensions`; a vendor's extension key cannot be seen through the APX surface, and (upstream) there is no `GET /observations/{id}` | fixed — `extensions` on `LprRead`/`PlateCandidate`; `observation=` lookup on `/v1/lpr/reads` |
| F-LPR-13 | lpr | low | Retention and purge are required, but the wire shape of a purged image or read is undefined | fixed — new §13.3b; `purgedImagery` flag on `LprRead`/`PlateCandidate` |
| F-LPR-14 | lpr | low | Place-less lookup outside the grant: empty 200 or 403 `insufficient-grant` is not fixed | fixed — Part 9 §9.3a (4417f2f) applied in §13.5(4): value keys empty 200, entity keys 403 |
| F-LPR-15 | lpr | low | `wrongWayTravel` alert: one `relatedEntity` for two entities (Observation and Session) | fixed — §13.3a(5): `relatedEntity` is the Session, evidence under `apds-ext:apx:alert-evidence@1.0` |
| F-LPR-16 | lpr | high | 0.12.0 tells the LPR system to revise `accessEvent` through native `PUT /observations/{id}`, a route APDS 4.1 does not have (only `GET`/`POST /observations`); `observation.updated.v1` has no trigger | fixed (0.12.1) — `PUT /v1/lpr/reads/{observation}/access-event` (`If-Match`, 409 stale, no-op on same value); all five citations updated; LPR-27/28/35 |
| F-LPR-17 | lpr | medium | (upstream APDS) `VehicularAccess` is unreachable: `HierarchyElementTypeEnum` lists `vehicularAccess` but the `HierarchyElement` discriminator mapping for it (and six other subtypes) is commented out, so a lane validates as a bare `HierarchyElement` — `accessType: "sideways"` and `lane-cameras` with `faces: "upward"` both pass | APX half fixed (0.12.1) — `lane-cameras` bound to `LaneCameras` via `Extensions` (F-LPR-19); upstream half **open** as erratum 013 (not yet filed) |
| F-LPR-18 | lpr | low | `cameraId` MUST be unique within the Place (§13.3a(5)), but no problem type is named for a duplicate and native `PUT /places/{id}` declares no 422 | fixed (0.12.1) — 422 `request-unprocessable` declared on native `POST /places` and `PUT /places/{id}` via the data overlay (§13.3a(5)) |
| F-LPR-19 | lpr | high | APX's own decorations are never validated: `Extensions` binds no key to a schema, so `lpr-read` with `speed: -1`, `accessEvent: "sideways"`, or a 0–100 confidence passes (LPR-33's refusals were asserted, not checked — the runner skips `invalid` bodies) | fixed (0.12.1) — `Extensions` binds `devicestatus`, `ratepolicy`, `lpr-read`, `lane-cameras`, `reservation`, `permit` (Part 4 §4.3); one private DATA scenario (`devicestatus` without `device`) and Part 4's example corrected |

---

## F-LPR-01 — (upstream APDS) The ingest route declares no responses

**Where it showed up.** LPR-01, LPR-04, LPR-06, LPR-20. `POST
/observations` is the only ingest path for `apx-lpr` ("Ingest is NATIVE",
Part 13 §13.3), yet the vendored operation has a `requestBody` and no
`responses` member at all. A camera vendor cannot know whether to expect
200, 201, or 202, or whether the body is the stored Observation, an APDS
`ResponseStatus`, or nothing; the runner cannot validate any response,
and a gateway generated from the bundle would reject every reply.

**Proposed fix.** APX cannot edit the vendored file, but the APX build
already overlays APDS routes (the `$ref` at `apx.yaml:122`). Add an
overlay that declares `201` (the stored `ObservationElement` or
`ObservationSet`, echoed with server-assigned `id`/`version` where the
client omitted them), `400` (`ResponseStatus` or, with `Accept:
application/problem+json`, `Problem`), plus the shared 401/403/429. Raise
the omission upstream with the APDS working group in the same breath.

## F-LPR-02 — (upstream APDS) The ingest discriminator makes every single Observation invalid

**Where it showed up.** LPR-01, LPR-04, LPR-06, LPR-20. The request
schema is `allOf: [{type: ObservationDataType}, {oneOf:
[ObservationElement, ObservationSet], discriminator: type}]` with `type`
required. `ObservationDataType` is the enum `ObservationElement |
ObservationSet`. But `ObservationElement` itself defines `type` as
`CredentialTypeEnum` (`licensePlate`, `rfid`, …). The same property
therefore has two disjoint enums: `type: licensePlate` fails the wrapper,
`type: ObservationElement` fails the element, and omitting it fails the
`required`. Verified against the bundle: no single-element body
validates. APDS's own inline example (`type: ObservationElement`,
`method: visual`) fails its own schema. An `ObservationSet` wrapping the
element does validate, because the set has no `type` property of its
own, so the only conformant way to post one LPR read today is to wrap it
in a one-element set.

**Proposed fix.** Upstream, rename the wrapper discriminator (for
example `observationDataType`) or drop the wrapper and let the `oneOf`
stand on structural difference (`observationElements` is only on the
set). In APX, until upstream moves: the overlay from F-LPR-01 SHOULD
replace the request schema with the plain `oneOf`, and Part 13 §13.3
SHOULD say in one sentence that a single read MAY be posted as a
one-element `ObservationSet`, which is the shape that works everywhere.

## F-LPR-03 — (upstream APDS) The decoration lives in an undeclared property

**Where it showed up.** LPR-01. Part 13 §13.3a and Part 4 §4.3 put
`apds-ext:apx:lpr-read@1.0` in the Observation's `extensions` container
"as the official APDS extension mechanism", but the vendored
`ObservationElement` (and every other APDS 4.1 schema; the file contains
no `extensions` anywhere) declares no such property. The bundle accepts
it only because APDS schemas leave `additionalProperties` open. Nothing
validates the decoration's shape at ingest, so a camera sending
`confidence: 97` instead of `0.97` is not caught until it appears as an
invalid `LprRead.detail`.

**Proposed fix.** In the same overlay, declare `extensions:
{$ref: Extensions}` on `ObservationElement`, and add a Spectral or ajv
build check that the `apds-ext:apx:lpr-read@1.0` value, when present,
validates against `LprReadDetail`. That gives implementers ingest-time
validation without touching APDS.

## F-LPR-04 — A read knows its place but not its lane

**Where it showed up.** LPR-02, LPR-03, LPR-21. `LprRead.place` is
required (§13.5) and `laneTravel` is derived from "the lane's APDS
`VehicularAccess.accessType`", but the read carries no reference to that
lane. A console showing "entered at lane 1, 08:02" has to dereference
`observation` and read `elementIds` off the native entity, and there is
no route to do that by id (F-LPR-12). `PlateCandidate` has `lane`;
`LprRead` does not. A ticket→plate lookup returning entry and exit reads
(LPR-03) cannot say which was which.

**Proposed fix.** Additive optional `lane` (Reference to
`VehicularAccess`) on `LprRead`, populated from the Observation's
`elementIds` when that references a lane; and `cameraId` (string, the
APDS `Image.cameraID`) is cheap to add at the same time. Both optional,
so existing consumers are unaffected.

## F-LPR-05 — No key, no slug

**Where it showed up.** LPR-10. `GET /v1/lpr/candidates` declares a 400
"Neither session nor lane given" but Part 12 registers no problem type
for it. `GET /v1/lpr/reads` has the same failure mode (neither `plate`
nor `ticket`) and declares no 400 at all, so a server that refuses has
no declared status and a server that answers with every read it can see
has turned a plate-keyed surface into a bulk export, against §9.6(1).

**Proposed fix.** Register `lookup-key-required` (400) in Part 12 §12.2
("a keyed lookup called with none of its keys"), declare 400 on `GET
/v1/lpr/reads`, and say in §13.3 that at least one of `plate`/`ticket`
is REQUIRED. The same slug serves `GET /v1/accounts` and `GET
/v1/payments`, which have the same shape.

## F-LPR-06 — No problem type for 401

**Where it showed up.** LPR-18. All three LPR operations declare the
shared `Unauthorized` response (`Problem` schema), and Part 12 registers
nothing at 401. Identical to F-CTL-07; recorded here so the module file
stands alone.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2, as
proposed in F-CTL-07.

## F-LPR-07 — The place filter the prose permits is not in the OpenAPI

**Where it showed up.** LPR-21. Part 13 §13.5(3): "Implementations MAY
additionally accept a `place` query parameter on these lookups to narrow
results below the grant". `GET /v1/lpr/reads` declares `plate`, `ticket`,
`page` only. An OpenAPI-validating gateway (or this runner) rejects
`place` as undeclared, so the MAY cannot be exercised interoperably; a
regional operator with forty garages gets one merged list per plate.

**Proposed fix.** Declare optional `place` on `GET /v1/lpr/reads` (and
on `GET /v1/accounts`, `GET /v1/payments`) with the APDS `place`
semantics (comma-separated HierarchyElement ids, subtree-inclusive) and
"MUST be inside the grant; otherwise 403 `insufficient-grant`". Servers
that do not narrow may ignore it, which is what the MAY already says.

## F-LPR-08 — Two agents correct the same session; the last one wins silently

**Where it showed up.** LPR-12. `PUT /v1/sessions/{id}/plate` is a write
to a versioned APDS Session ("MUST materialize in the underlying APDS
Session", §17.5) but takes no `version`, no `If-Match`, and declares no
409. Part 12 registers `version-conflict` (409) for exactly this, and the
task list for every module asks for a stale-version scenario; here it
cannot be written. Scenario 14 shows the resolution context's `version`
incrementing after the correction, so the server tracks the number; the
client just cannot cite it.

**Proposed fix.** Additive optional `expectedVersion` (integer, the
Session version the client read) in the request body, or accept
`If-Match` with the Session version as the entity tag; when present and
stale, 409 `version-conflict`. Declare 409 on the operation. Absent, the
write is unconditional, so existing clients are unchanged.

## F-LPR-09 — A body without a plate has no declared refusal

**Where it showed up.** LPR-13. The request schema requires `plate`;
the operation declares 200/401/403/404/429 and nothing for a malformed
body. `POST /v1/alerts` and `POST /v1/support/interactions` declare 400
for the same case, and Part 12 has no generic body-shape slug (F-CTL-01
asked for one from the Control side).

**Proposed fix.** Declare 400 on `PUT /v1/sessions/{id}/plate`, and
register one generic `invalid-request` (400) in Part 12 §12.2 for
schema-invalid bodies across all APX routes, keeping the specific slugs
(`idempotency-key-required`, `agent-required`) for the cases a console
must distinguish.

## F-LPR-10 — Correcting a closed session

**Where it showed up.** LPR-14. Nothing in Part 17 §17.5 or Part 13 says
whether a plate may be corrected on a Session that has ended, been
billed by plate, or been bound to an exit. On a pay-by-plate lot the
plate is the billing key: changing it after settlement moves a charge
from one registered keeper to another. Allowing it silently is a
financial-integrity problem; refusing it needs a declared response, and
none exists. `session-not-open` (422) is registered for `matchTicket`
with almost the right words.

**Proposed fix.** State the rule in §17.5: correction is allowed while
the Session is open or within the operator's dispute window; outside
that, 422 `session-not-open` (widen the registry text to "matchTicket or
plate correction names a Session that is closed …"). Declare 422 on the
operation. If corrections on closed sessions are meant to be allowed,
say so and require `reason`, since it is then an audited financial
adjustment.

## F-LPR-11 — A write scope that returns a plate value

**Where it showed up.** LPR-22 (also LPR-11, LPR-15). The operation's
security requirement is `apx.data:write` alone; its 200 body carries
`plate`, `country`, `stateProvince`. Part 9 §9.6(1): "plate values
appear only under `apx.lpr:*`, `apx.tolling:*`, `apx.violations:*`, or
`apx.accounts:*` scopes". Both cannot be true. Scenario 14 sidesteps it
by giving the platform `apx.lpr:read` as well, but the OpenAPI does not
require that.

**Proposed fix.** Either require both scopes on the operation
(`apxOAuth: ["apx.data:write", "apx.lpr:read"]`, which the candidates
read side already needs, so no real client loses anything), or add
`apx.data:write` to the §9.6(1) list with the note that the write
surface echoes only the value the caller supplied. The first is the
smaller change and the more defensible one.

## F-LPR-12 — Extensions have nowhere to go on the APX side

**Where it showed up.** LPR-20. Part 4 §4.3: "Every APX resource schema
includes an optional `extensions` object". `LprRead`, `PlateCandidate`,
`AttributeRead`, and `LprReadDetail` do not. A vendor key preserved on
the Observation (correctly, tolerant reader) is unreachable through the
cross-lookup, and the native read-back is a filtered list (`GET
/observations` by place/time/geo), since APDS 4.1 declares no `GET
/observations/{id}` (upstream). The round-trip test the method asks for
can be shown on the Observation and the event but not on any LPR
resource.

**Proposed fix.** Additive `extensions: {$ref: Extensions}` on `LprRead`
and `PlateCandidate`, with §13.3a saying the server projects the
Observation's `extensions` minus the APX block (which is already
`detail`). An `observation` query parameter on `GET /v1/lpr/reads`
(lookup by Observation id) would close the read-back gap without waiting
for upstream.

## F-LPR-13 — What a purged read looks like

**Where it showed up.** LPR-19. §9.6(3) requires a published retention
period for plate reads and imagery and the ability to purge on schedule.
It does not say whether a read whose imagery is purged is returned
without `imageLink` (as modelled), or with a link that answers 410, or
not at all; nor whether a purged read is simply absent from the
cross-lookup (indistinguishable from "never seen") or is tombstoned for
the Part 5 change feed. Two implementers will differ, and an auditor
cannot tell "purged" from "no camera".

**Proposed fix.** Two sentences in §9.6(3): imagery purge removes
`imageLink`/`plateImage`/`vehicleImage` from the read (the row survives
until its own retention); read purge removes the row from every APX
lookup and emits the APDS entity's deletion on the change feed so
downstream copies can follow. Optionally a `purgedImagery: true` flag on
`LprRead` so consumers can distinguish "no picture taken" from "picture
purged".

## F-LPR-14 — Out of grant on a place-less lookup: empty or 403?

**Where it showed up.** LPR-16. §13.5(2) says results "MUST be
constrained to records whose place binding … falls inside the caller's
`apx_places` grant" and the caller "MUST NOT see records from any other
location". That is satisfied by an empty 200 (modelled) and by a 403.
The two differ in what they leak: a 403 on `?plate=HBR-5510` confirms
the plate was seen somewhere the caller may not look. For `?lane=` on
candidates the target is a granted-or-not entity, so 403 is the
Part 9 §9.3 answer; for a plate the empty page is the safer one. The
standard should say which.

**Proposed fix.** Add to §13.5(2): a lookup keyed by a value (`plate`,
`ticket`, `name`, `cardLast4`) returns only in-grant records and never
403 on the key's account; a lookup keyed by an entity id (`lane`,
`session`, `place`) outside the grant is 403 `insufficient-grant`.

## F-LPR-15 — The wrong-way alert points at one thing

**Where it showed up.** LPR-06. §13.3a(5): raise `wrongWayTravel` "with
the Observation as evidence" and "MUST still open or match the Session".
`Alert.relatedEntity` is a single Reference. The alert can point at the
Observation (the evidence) or the Session (what an operator acts on),
not both; the modelled alert chose the Observation and put the session
id in prose.

**Proposed fix.** Additive optional `evidence` (array of Reference) on
`Alert`, so `relatedEntity` can be the Session and `evidence[]` the
Observation(s); or, smaller, say in §13.3a(5) that `relatedEntity` is
the Session and the Observation goes in `extensions` under a registered
`apds-ext:apx:alert-evidence@1.0`. The first is the reusable one
(`overstay`, `passbackViolation` have the same two-entity shape).

## F-LPR-16 — The revision route 0.12.0 relies on does not exist

Found by LPR-27 and LPR-28 (2026-09-28, against 0.12.0). §13.3a(4) says
the LPR system MAY revise `accessEvent` "by replacing the Observation
through native APDS `PUT /observations/{id}` with the next `version`",
and §13.4 makes `apx.data.observation.updated.v1` fire on that replace.
APDS 4.1 defines `/observations` with `GET` and `POST` only; there is no
`/observations/{id}` path at all (the same absence F-LPR-12 found for
`GET`, solved there with `GET /v1/lpr/reads?observation=`). So the only
way to change an Observation is a new one, and the updated topic can
never fire. Cited in five places: Part 13 §13.3a(4) and §13.4, Part 8
topic table, Annex A APX-LPR-04, and the `accessEvent` description in
the OpenAPI.

Options: (a) an APX route, e.g. `PUT /v1/lpr/reads/{observation}` or a
narrow `PUT /v1/lpr/reads/{observation}/access-event` with `If-Match`,
409 `version-conflict`, and the updated event; (b) declare
`PUT /observations/{id}` in the data overlay as an APX addition on the
native path (the overlay already adds responses and parameters to native
routes, but not whole paths); (c) append-only: a new Observation that
names the one it supersedes. (a) keeps APDS untouched and matches how
F-LPR-12 was solved.

## F-LPR-17 — (upstream APDS) The lane entity cannot be reached, so lanes are never checked

Found by LPR-23 and a probe. `HierarchyElementTypeEnum` includes
`vehicularAccess`, and `VehicularAccess` (an `IdentifiedArea`, with
required `accessType`) is defined, but the `HierarchyElement`
discriminator maps only `campus`, `place`, and `space`; the other seven
entries — `vehicularAccess` among them — are commented out
(`apds-api-4.1.yaml` line 3815). Redocly drops the orphaned schema from
the bundle. A `PUT /places/{id}` with `type: vehicularAccess` therefore
validates as a bare `HierarchyElement`: a probe with
`accessType: "sideways"`, `cameraId: 42`, and `faces: "upward"` passed.
So APX-LPR-05 cannot be checked on the wire. APX side: the data overlay
could restore the mapping for `vehicularAccess` (APX already treats lanes
as VehicularAccess everywhere), or constrain `extensions` so the
`apds-ext:apx:lane-cameras@1.0` key must match `LaneCameras`. Upstream:
file as erratum 013, softly — the commented-out entries may be
deliberate work in progress.

## F-LPR-18 — A duplicate camera has no named refusal

Found by LPR-24. §13.3a(5) makes `cameraId` unique within the Place, but
says nothing about what the server does when a write breaks that, and
the native `PUT /places/{id}` declares 200/400/401/403/404/409/429 only.
`invalid-request` (400) is for schema violations; this is semantic.
Either declare 422 `request-unprocessable` on the native place writes in
the data overlay, or say 409 and name a slug. Low: a server can refuse
with 400 today, but clients cannot rely on which.

## F-LPR-19 — APX decorations were never checked where they travel

Found while fixing F-LPR-17 (2026-09-28). The APX `Extensions` schema had
`additionalProperties: {type: object}` and no `properties`, so every
decoration value was "any object". A probe Observation with `lpr-read`
`speed: -1`, `accessEvent: "sideways"`, and an attribute confidence of 97
validated. LPR-33 had claimed those are 400s, but it marks its bodies
`invalid`, which the runner does not validate, so the claim was never
tested. Fixed in 0.12.1 by binding each schema-backed APX key inside
`Extensions`; the probe now fails. Binding surfaced one malformed
decoration in the private suite (DATA, `devicestatus` without its
required `device`) and the same mistake in Part 4 §4.3's example.
`alert-evidence` and `correlation` are prose-only and remain unbound.
Runner lesson: an `invalid` marker asserts, it does not verify; a refusal
that matters should also be probed against the schema directly.

## Runner issues

Both observed while this file was being written, against the run.mjs of
2026-09-24 23:23; both no longer reproduce against the run.mjs of 23:42
(a sibling module's edit). Recorded so the history of the markers in
scenarios.md makes sense; nothing here was changed by the LPR work.

1. **Stacked `apx:validate` markers** (fixed). The earlier runner kept
   one pending expectation, so a second `apx:validate` above one
   `json` block replaced the first and reported it as "apx:validate
   marker without a ```json block", a false failure. The current
   runner stacks them (`expect.validates`). LPR-01, LPR-06, and LPR-20
   now use the intended form: `EventEnvelope` plus
   `ObservationElement at /data` on each observation event.
2. **`gap=` on a request marker settled twice** (fixed). The earlier
   runner settled the request context after the path and query checks
   and again after the body check, so a body-only failure such as
   F-LPR-02 was listed under both "known gaps" and "resolved gaps …
   remove the gap marker" for the same marker. The current runner
   settles once when the request is complete; the false "resolved"
   lines are gone.
