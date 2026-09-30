# Findings — apx-reservations

Each entry is something a scenario in `scenarios.md`
needed that the public spec (`apx` at v0.10.0, vendoring APDS 4.1) does
not define, or defines ambiguously. IDs are stable; scenarios cite them
in `gap=F-RSV-NN` markers so the runner reports them as known gaps rather
than failures, and reports them as resolved once the spec is fixed.
Entries marked "(upstream APDS)" are issues in the vendored
`apds-api-4.1.yaml`; APX can only work around them until APDS fixes them.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-RSV-01 | reservations | high | (upstream APDS) `POST /quotes` declares no request body, so a quote request has nowhere to go | fixed (overlay) — optional request body `oneOf [QuoteRightRequest, QuoteSessionExtensionRequest]`; erratum 007 |
| F-RSV-02 | reservations | high | (upstream APDS) `ReferenceToQuote` is a `oneOf` of two identical branches, so booking from a quote can never validate; it also has no place for the reservation extension | deferred (upstream) — erratum 008; every local relaxation narrows requests or breaks full AssignedRight bodies |
| F-RSV-03 | reservations | low | (upstream APDS) `Identifiers` requires `rateTableId` but declares `rateTableID` | fixed (overlay) — `rateTableId` declared on Identifiers; erratum 009 |
| F-RSV-04 | reservations | medium | Public scenarios 05/06 disagree with the OpenAPI: create returns `ResponseStatus`, not the right, and `credentials[]` is drawn in a shape APDS does not have | fixed — scenarios 05/06 redrawn (`rightHolder.credentials[]`, 201 `ResponseStatus` + read-back, full `AssignedRight` validated); §14.1 step 2 states the credential shape |
| F-RSV-05 | reservations | medium | (upstream APDS) `AssignedRight` declares no `extensions`, so the profile's carrier is undeclared and the §4.3 key pattern is not enforced there | fixed (overlay) — `extensions` declared on AssignedRight; erratum 010 |
| F-RSV-06 | reservations | medium | A change-mode `PUT` body (identity + changed fields, §5.1) cannot validate against `AssignedRight` | fixed (for reservations) — §14.1 step 3: amend bodies MUST keep the required members until a change-mode schema exists; the general schema is F-DATA-02 (data owner) |
| F-RSV-07 | reservations | medium | Nothing says whether `version` in a native `PUT` body is the expected-current version or the next one | fixed — Part 4 §4.2a (4417f2f), cited in §14.1 step 3 |
| F-RSV-08 | reservations | medium | §5.1 mandates problem `version-conflict` on native writes, but native 409s declare only `ResponseStatus` | fixed (overlay) — `application/problem+json` beside `ResponseStatus` on native 400/404/409 (Part 5 §5.1a) |
| F-RSV-09 | reservations | medium | No problem type for an illegal reservation transition; §14.1b's `right-not-linkable` list omits `cancelled`/`noShow` rights | fixed — §14.1 transition table; `reservation-transition-illegal` registered (4417f2f); §14.1b lists `cancelled`/`noShow`; native delivery waits on F-RSV-08 |
| F-RSV-10 | reservations | low | `plannedUses[]` and the extension's `plannedStart`/`plannedEnd` duplicate each other; which one is authoritative is unstated | fixed — `plannedUses[0]` authoritative, extension mirrors; `cancelTime`/`expiryTime` set (§14.1) |
| F-RSV-11 | reservations | low | `apx.reservation.noshow.v1` names no data schema; the grace period cannot be discovered | fixed — §14.1 names `ReservationSummary`; read-only `noShowAfter` on the extension and summary; registry text asked of integrator |
| F-RSV-12 | reservations | low | `GET /v1/reservations/recent` declares no 401/403/429, and no 404 for an unknown `place` | fixed — 401/403/429 (4417f2f) and 404 for an unknown place |
| F-RSV-13 | reservations | medium | Recent lookup: the declared 400 has no registered type; no time window or state filter; `plate`+`holder` precedence unspecified | fixed — `invalid-request`; optional `from`/`to`/`state`; both keys intersect |
| F-RSV-14 | reservations | medium | The `plate` lookup key has no `country`/`stateProvince` qualifier | fixed — optional `country`/`stateProvince` query params |
| F-RSV-15 | reservations | low | `PUT /v1/sessions/{id}/assigned-right` declares no 400 (no slug for it either) and no 429 | fixed — 400/429 + `invalid-request` (4417f2f) |
| F-RSV-16 | reservations | medium | Re-pointing an already-linked session, and unlinking, are unspecified | fixed — a different right on a linked session is 409 `right-not-linkable`; new `POST /v1/sessions/{id}/assigned-right/unlink` (POST action with a body so `reason`/`approval` can ride it, rather than DELETE) |

---

## F-RSV-01 — `POST /quotes` has no request body (upstream APDS)

**Where it showed up.** RSV-01, RSV-08, RSV-09. The vendored `post-quote`
operation declares responses only, with no `requestBody`, although Part 14
§14.1 step 1 says "Quote — native `POST /quotes`
(QuoteRightRequest/Response)" and public scenario 06 sends a
`QuoteSessionExtensionRequest` to it. The 200 shape is also odd: it
inlines `PaginatedListMeta` at the top level (`referenceInstant`,
`offset`, `pageSize`, `total` beside `data`) instead of the
`{meta, data}` envelope every other APDS list uses.

**Proposed fix.** Overlay the operation in `apx.yaml` the way `/webhooks`
is overlaid: same operationId, add a `requestBody` of
`oneOf [QuoteRightRequest, QuoteSessionExtensionRequest]`, and keep the
vendored responses verbatim. Raise both the missing body and the inlined
meta with the APDS working group.

## F-RSV-02 — Booking from a quote reference cannot validate (upstream APDS)

**Where it showed up.** RSV-03. `create-assigned_right` takes
`oneOf [AssignedRight, ReferenceToQuote]`. `ReferenceToQuote` is itself
`oneOf [ReferenceQuoteExtension, ReferenceQuoteNew]`, and those two
schemas have identical properties (`quoteResponseId`, `optionId`) and no
required members. Every body matches both branches, so no body can
satisfy `ReferenceToQuote`. (An `AssignedRight` body passes only because
the inner `oneOf` fails, which leaves the outer one matching exactly
once, by accident.) The reference shape also has nowhere to carry
`apds-ext:apx:reservation@1.0`.

**Proposed fix.** Upstream: make the branches distinguishable, either with
a discriminator or by requiring different members. APX: add to §14.1 that
a reservation booked by quote reference takes `plannedStart`/`plannedEnd`
from the option's quoted `start`/`end`, enters `confirmed`, and MAY be
followed by a change-mode `PUT` that attaches the extension. The
simpler alternative is to say that reservations MUST be booked with the
full `AssignedRight` shape.

## F-RSV-03 — `Identifiers` required-key typo (upstream APDS)

**Where it showed up.** RSV-01. `Option.identifiers[]` items require
`rateTableId` and `rightSpecificationId`, but the declared property is
`rateTableID`. The scenario leaves `identifiers` out, which loses the
rate-table reference the quote is for.

**Proposed fix.** Upstream: rename the property to `rateTableId`. APX:
add it to the list of known APDS errata next to the `Reference`
minProperties/maxProperties one.

## F-RSV-04 — Public scenarios 05 and 06 draw shapes the OpenAPI does not have

**Where it showed up.** RSV-02, RSV-05. Scenario 05 says the response to
`POST /rights/assigned` "is the full native `AssignedRight`". The
vendored route returns 201 `ResponseStatus`, so a client has to `GET` the
right to see the extension. Both public scenarios also show
`"credentials": [{"credentialType": "licensePlate", "identifier":
"SYN-1234"}]` at the top level. APDS puts credentials under
`rightHolder.credentials[]` as `CredentialAssigned` (`type`,
`credentialAssignedType`, and `identifier` as a `Reference`), and
`rightHolder` is required.

**Proposed fix.** Redraw both public scenarios with the APDS shapes used
here: `rightHolder.credentials[]`, `identifier: {id, className}`, and a
`GET` after the 201. Add to §14.1 step 2 that the plate on file is a
`CredentialAssigned` of type `licensePlate` on the holder.

## F-RSV-05 — `AssignedRight` has no `extensions` container (upstream APDS)

**Where it showed up.** RSV-02, RSV-23. The profile lives in
`AssignedRight.extensions["apds-ext:apx:reservation@1.0"]`, but the
vendored `AssignedRight` (like every APDS entity) declares no
`extensions` property. The container exists only in the APDS use-case
prose (§C.2.5) and in APX's own `Extensions` schema, which no APDS entity
references. Payloads validate only because `additionalProperties` is
unset. As a result the §4.3 key pattern is never checked on an
AssignedRight: RSV-23's malformed key `apds-ext:ParkAhead:Loyalty@1`
passes schema validation, and only a disciplined server refuses it.

**Proposed fix.** Upstream: add `extensions: {$ref: Extensions}` to
`VersionedIdentity`, or to each entity. APX, immediately: state in §4.3
that servers MUST reject extension keys that do not match the pattern on
any entity (400 on native routes), and add a lint rule that checks it.

## F-RSV-06 — Change-mode `PUT` bodies cannot validate

**Where it showed up.** RSV-08. §5.1 defines a change-mode payload as
"identity plus only the changed fields". The vendored `AssignedRight`
requires `rightSpecification` and `rightHolder`, so a minimal
change-mode body fails `update-assigned_right`. A server that validates
request bodies against the published schema will refuse every
change-mode write.

**Proposed fix.** State in §5.1 that for change-mode writes the request
schema is the entity with `required` reduced to `[id, version]`. Encode
it by overlaying the native `PUT` bodies with
`oneOf [Entity, EntityChange]`. Until then, say that change-mode clients
MUST still send the entity's required members.

## F-RSV-07 — Which `version` goes in a `PUT` body?

**Where it showed up.** RSV-05, RSV-06. §5.1 refuses a write "targeting
a stale `version`". Public scenario 06 shows the amended object with
`version: 2` as the payload. Nothing says whether the client sends the
version it read (optimistic concurrency) or the version it expects to
create. If two vendors pick differently, each will reject the other's
writes as stale.

**Proposed fix.** Add one sentence to §5.1: "`version` in a `PUT` body is
the version the client last read; the server increments it, and refuses
the write with `version-conflict` when the stored version differs." The
scenarios here follow this rule.

## F-RSV-08 — `version-conflict` cannot be returned on a native route

**Where it showed up.** RSV-06. §5.1 says servers MUST reject a stale
write with problem `version-conflict`, and §12.1 says native routes
SHOULD accept `Accept: application/problem+json`. The vendored 409 on
`update-assigned_right` declares only `application/json` →
`ResponseStatus`. The MUST therefore has no declared response to use,
and the SHOULD does not appear in the OpenAPI at all.

**Proposed fix.** Overlay the native 400 and 409 responses on writes with
a second content type, `application/problem+json` → `Problem`, selected
by `Accept`, and make that the normative way for a client to ask for it.
This is additive: a plain APDS client never sends that `Accept` header
and keeps getting `ResponseStatus`.

## F-RSV-09 — Illegal reservation transitions have no problem type

**Where it showed up.** RSV-10, RSV-11, RSV-12. §14.1 names five states
but never says which transitions are illegal. Part 12 has no slug for
the case, while every other APX state machine has a
`*-transition-illegal` type. The refusals here are therefore native
`ResponseStatus` 409s with the rule written in free text. On the link
route, §14.1b lists only "already consumed, outside validity, wrong
place". A `cancelled` or `noShow` right fits none of these, so RSV-11
and RSV-12 had to stretch "outside validity" to cover them.

**Proposed fix.** Add a transition table to §14.1:
- `confirmed` → `amended`, `checkedIn`, `cancelled`, or `noShow`
- `amended` → `checkedIn`, `cancelled`, or `noShow`
- `checkedIn` accepts only changes to the planned times
- `cancelled` and `noShow` are terminal

Register `reservation-transition-illegal` (409), delivered per F-RSV-08.
Extend §14.1b's list with "or in reservationState `cancelled` or
`noShow`".

## F-RSV-10 — `plannedUses[]` versus the extension's planned times

**Where it showed up.** RSV-02, RSV-05, RSV-08, RSV-10. §14.1 calls
`plannedStart`/`plannedEnd` "the APDS PlannedUse concept", and APDS
already has `plannedUses[].startTime/endTime/cancelTime/expiryTime`.
The scenarios carry both and keep them in step by hand. Nothing says a
server must keep them equal, or which one wins when a plain APDS client
edits `plannedUses[0]`.

**Proposed fix.** In §14.1: `plannedUses[0]` is authoritative, and the
extension fields MUST mirror it on every write. Also set `cancelTime` on
cancel, and `expiryTime` to plannedStart plus the grace period on
no-show.

## F-RSV-11 — No-show event data and grace period

**Where it showed up.** RSV-11. The `apx-topics` entry says "data:
AssignedRight reference + reservation state". The EventEnvelope example
is shaped like a `ReservationSummary`, and no schema is named. The grace
period is "operator policy" and is not exposed anywhere a platform could
read it, so a platform cannot tell a customer when the reservation will
lapse.

**Proposed fix.** Change the registry entry to "(data:
ReservationSummary)". Add an optional `noShowGraceMinutes`, either in the
class's Part 16 discovery block or in an extension on the
RightSpecification.

## F-RSV-12 — `GET /v1/reservations/recent` declares no 401/403/429

**Where it showed up.** RSV-16. The operation declares only 200 and 400.
It is secured, takes `place`, and falls under the Part 13 §13.5 grant
constraint, so in practice it returns `insufficient-scope`,
`insufficient-grant`, `rate-limited`, and 401 (the 401 type is itself
unregistered, F-CTL-07). An unknown `place` has no declared 404. This is
the same pattern as F-CTL-08.

**Proposed fix.** Add the shared `Unauthorized`, `Forbidden`, and
`TooManyRequests` responses, plus a 404 (`target-not-found`) for an
unknown `place`.

## F-RSV-13 — The recent lookup: unnamed 400, no window, no precedence

**Where it showed up.** RSV-15.
1. The declared 400 ("Neither plate nor holder given") has no registered
   problem type.
2. There is no `from`/`to` window, no `state` filter, and no paging. A
   dispute about a booking older than the last ten cannot be answered
   here; the caller has to fall back to the native list with
   `credential_id` and epoch filters.
3. When both `plate` and `holder` are sent, nothing says whether the
   results intersect or one key wins.

**Proposed fix.**
- Register `invalid-request` (400) for this case and for F-RSV-15.
- Add optional `from`/`to` (RFC 3339, applied to `plannedStart`;
  `from > to` returns 400) and `state`, keeping ten rows as the default
  `limit`.
- Define both keys together as an intersection.

## F-RSV-14 — The plate key has no jurisdiction

**Where it showed up.** RSV-13, RSV-22. `plate` is a bare string. Every
other APX plate surface (`PlateCandidate`, `PUT /v1/sessions/{id}/plate`,
`LprRead`) carries `country` + `stateProvince`. `SVN-4821` in Florida and
`SVN-4821` in Georgia are different cars, so a screen-pop on the bare
string can merge two customers' histories.

**Proposed fix.** Add optional `country` and `stateProvince` query
parameters using the §17.5 vocabulary. When they are absent, match on the
plate string alone.

## F-RSV-15 — The link route declares no 400 and no 429

**Where it showed up.** RSV-20, RSV-21. The route declares
200/401/403/404/409. A body without the required `assignedRight` needs a
400, and Part 12 has no 400 slug for a malformed body outside the
idempotency case. The route is a write and can be throttled, but it
declares no 429.

**Proposed fix.** Declare 400 (`invalid-request`, per F-RSV-13) and the
shared `TooManyRequests` response.

## F-RSV-16 — Re-pointing and unlinking

**Where it showed up.** RSV-18. "Naturally idempotent" covers sending the
same body twice. It does not cover a PUT with a *different* right on a
session that is already linked: replace the link (which un-consumes the
first right) or refuse? There is also no audited way to undo a mistaken
link. The only route is a native `PUT /sessions/{id}`, which bypasses the
audit fields the APX route adds.

**Proposed fix.** Specify that a second link with a different right is
409 `right-not-linkable` ("session already linked"). Add
`DELETE /v1/sessions/{id}/assigned-right` with scope
`apx.reservations:manage` and a required `reason`. It reverts the segment
to the drive-up right, publishes `SessionUpdated`, and returns the
reservation to its pre-check-in state.

## Runner issues

1. **Stacked `apx:validate` markers (fixed by the coordinator).** Earlier,
   a second marker over the same block made the first one fail with
   "apx:validate marker without a ```json block". This was reproduced
   with a probe file (since deleted). The first draft worked around it
   by repeating each event's `data` in a separate block. `run.mjs` now
   supports stacked markers, so the events use
   `EventEnvelope` + `<Schema> at /data` over one block, with no
   duplicated payloads and no gap markers.
2. **Absolute file arguments.** `node run.mjs <file>` joins its argument
   onto the script directory, so a bare file name works but an absolute
   path does not. Cosmetic; not changed.
