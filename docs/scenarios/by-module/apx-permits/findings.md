# Findings — apx-permits

Each entry is something a scenario in `scenarios.md` needed
that the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. Scenarios cite them in `gap=F-PRM-NN` markers where the
runner can see the gap; findings about prose only are cited in the
scenario text. Fixes go to the public repo as additive PRs.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-PRM-01 | permits | high | `POST /v1/permits/issue` declares no `Idempotency-Key`; a retried issue burns pool capacity; replay (200) and missing-key (400) undeclared | fixed: optional `Idempotency-Key` (REQUIRED would break clients), 200 replay, 409 widened |
| F-PRM-02 | permits | low | Issue declares no 400 or 404: unknown RightSpecification, unknown holder, malformed body have no declared response and no body-shape slug | fixed: 400 declared (4417f2f); unknown body refs = 422 `reference-unknown` (404 kept for path ids) |
| F-PRM-03 | permits | medium | Issue-time refusals with no problem type: unpooled RightSpecification, credential type not allowed by the spec, plate already on an active permit; 422 undeclared | fixed: 422 `request-unprocessable` for unpooled/allow-list, `credential-identification-in-use` licensed (§14.2a); enum typing deferred (breaking), enforced as a 400 field rule |
| F-PRM-04 | permits | low | 401/403/429 undeclared on both Permits operations | fixed: shared responses declared (4417f2f) |
| F-PRM-05 | permits | medium | "Link renewals via `extensions`": no key named, `PermitIssueRequest` has no `extensions`, vendored `AssignedRight` has none either (upstream APDS) | fixed: `extensions` on `PermitIssueRequest`, `apds-ext:apx:permit@1.0` (`PermitExtension`); AssignedRight container fixed (overlay, erratum 010) |
| F-PRM-06 | permits | high | How `holder`, `credentials[]`, and `validity` materialize onto the native `AssignedRight` is unspecified; three shapes in circulation | fixed: normative materialization list §14.2b citing APDS field names, `credential_id` resolution rule |
| F-PRM-07 | permits | low | Waitlist convention has no shape, no route, no event | won't fix: waitlist stays unstandardized in v1; §14.2 now says clients MUST NOT rely on it |
| F-PRM-08 | permits | medium | No cancel or refund operation for a permit; whether cancellation or expiry returns capacity to the pool is unstated | fixed: §14.2c native DELETE is the cancel, slot returns on cancel/expiry, `payments[]` links the refund; no new route |
| F-PRM-09 | permits | medium | No way to add or remove a vehicle on a permit; native PUT is full replace, and Part 5's `version-conflict` MUST is inexpressible on the native 409 | fixed: §14.2c vehicles via native PUT, allow-list applies, no slot moves; native 409 problem dialect is A7 (integrator) |
| F-PRM-10 | permits | low | No APX topic for pool availability changes or exhaustion | fixed: §14.2c SHOULD publish `apx.permits.pool.availability.v1`; `apx-topics` entry requested from the integrator |
| F-PRM-11 | permits | low | Bundle drops APDS `EventData`/`EventTypeEnum`; native-topic envelopes cannot be validated against the shape Part 8 names (cross-module: apx-events) | fixed (apx-events): `EventData`/`EventTypeEnum` bundled via the `apx-native-event` webhook entry (F-DATA-12) |
| F-PRM-12 | permits | medium | `PoolAvailability` under-specified: no period selector across several RightPools; `capacity` has no source on `RightPool`; oversell unaddressed | fixed: `pool` and `at` selectors, `pool`/`validity`/`spaces` in `PoolAvailability`, `capacity` defined |

---

## F-PRM-01 — Issue is not idempotent

**Where it showed up.** PRM-03. Every other APX domain operation that
creates something (`POST /v1/commands`, `/v1/alerts`, payments, tolling,
violations, validations, credentials) says **`Idempotency-Key` header
REQUIRED** and inherits the APX-CTL-01 semantics (same key + body → the
original, 200; different body → 409 `idempotency-conflict`; no key → 400
`idempotency-key-required`). `POST /v1/permits/issue` says nothing, and
declares neither 200 nor 400. A permit issue is the one create where a
duplicate has a hard cost: the second AssignedRight consumes a pool slot
and the holder is billed twice. The 409 `idempotency-conflict` in PRM-03
validates only because the operation's single declared 409 (described
"Pool exhausted") accepts any registered 409 slug.

**Proposed fix.** In §14.2 and on the operation: "**`Idempotency-Key`
REQUIRED** (semantics as APX-CTL-01)"; declare 200 (the original
AssignedRight on replay) and 400 (`idempotency-key-required`); widen the
409 description to "pool exhausted, idempotency conflict, or stale
RightSpecification version". Add a row to Annex A A.12 or fold it into
APX-PRM-01 so the ICS tests it.

## F-PRM-02 — Issue declares no 400 or 404

**Where it showed up.** PRM-04, PRM-11. An issue naming a
RightSpecification that does not exist, or a holder that does not exist
(holder ids are local, §14.1a, so a wrong id is the common case for a
multi-site portal), has no declared response; `target-not-found` is
registered but the operation does not admit a 404. A body missing
`holder` has no declared 400 and, as F-CTL-01 already notes, Part 12 has
no slug for a malformed body at all.

**Proposed fix.** Declare 404 (`target-not-found`) and 400 on
`POST /v1/permits/issue`. Register one generic `invalid-request` (400)
in Part 12 §12.2 for body-shape errors (the same fix F-CTL-01 asks for),
and reference it from every operation with a required body.

## F-PRM-03 — Refusals §14.2 never names

**Where it showed up.** PRM-05, PRM-11, PRM-12. Three refusals a permit
server must make and cannot express:

1. The RightSpecification exists but has no `rightPools` (an event or
   quote-priced spec). "Permits = pooled RightSpecifications" implies the
   refusal; nothing says what it looks like. PRM-05 used an unregistered
   `right-not-pooled` at 422.
2. The request's `credentialType` is not in the RightSpecification's
   `credentials` allow-list (APDS `RightSpecification.credentials`,
   "the allowed credential types"). PRM-11 used an unregistered
   `credential-type-not-allowed` at 422. `PermitIssueRequest.credentials[].credentialType`
   is also a free `string` rather than `CredentialTypeEnum`, so the
   schema cannot catch a misspelling.
3. A plate that is already an active credential on another permit.
   PRM-12 used Part 21's `credential-identification-in-use` (409), which
   validates because the operation has a 409, but that slug is defined
   for CredentialRecords and a server that does not claim
   `apx-credentials` has no stated licence to use it — nor does §14.2
   say whether the same plate on two permits is even a refusal.

**Proposed fix.** Register `right-not-pooled` (422) and
`credential-type-not-allowed` (422) in Part 12; declare 422 on the
operation; type `credentialType` as `CredentialTypeEnum`; and add one
sentence to §14.2: "an identification already active on another
AssignedRight at the place is 409 `credential-identification-in-use`
whether or not `apx-credentials` is claimed" (or state the opposite).

## F-PRM-04 — 401, 403, 429 undeclared on both operations

**Where it showed up.** PRM-06, PRM-15. `GET /v1/permits/pools/{rightSpecId}/availability`
and `POST /v1/permits/issue` are secured with `apx.permits:manage` and
are place-targeting (the RightSpecification's `hierarchyElements`
decide the place), so `insufficient-scope`, `insufficient-grant`, and
`rate-limited` are all real outcomes; neither declares any of them. Same
pattern as F-CTL-08; the 401 body has no registered type (F-CTL-07).

**Proposed fix.** Reference the shared `Unauthorized`, `Forbidden`, and
`TooManyRequests` responses on both operations, and adopt the Spectral
rule F-CTL-08 proposes so this stops recurring per module.

## F-PRM-05 — The renewal link has no name and nowhere to go

**Where it showed up.** PRM-07. §14.2: "implementations SHOULD link
renewals via `extensions`". Three problems. The extension key is not
named, so two vendors will pick `apds-ext:apx:permit@1.0` /
`apds-ext:vendor:renewal@1.0` / anything, and a portal cannot follow the
chain across sites. `PermitIssueRequest` declares no `extensions`
property, so the client has no sanctioned place to send the link on
issue; the scenario's request validates only because the schema does not
forbid extra properties. And the vendored APDS 4.1 `AssignedRight` has
no `extensions` property either (**upstream APDS**: the extension
container of Use Case §C.2.5 is not on the entity schemas), so the
response validates by the same accident. Part 4 §4.3 promises the
container on "every APX resource schema"; an AssignedRight is an APDS
entity, and the profile relies on it anyway.

**Proposed fix.** Add `extensions` (`Extensions`) to
`PermitIssueRequest`; register `apds-ext:apx:permit@1.0` in the
reservations/permits schema file with `renews` (Reference to
AssignedRight) and optionally `renewedBy`, the way
`apds-ext:apx:reservation@1.0` is defined; and, for the upstream issue,
either overlay `extensions` onto the vendored `AssignedRight` (and the
other five `EventData` entities) in the apx build, or record it in the
known APDS errata list next to the `Reference` min/maxProperties one.

## F-PRM-06 — Materializing the issue request onto an AssignedRight

**Where it showed up.** PRM-01, PRM-10, and every 201. The request
carries `holder` (Reference), `credentials[]` as
`{credentialType, credentialIdentification}` strings, and
`validity {start, end}`. The 201 is a native APDS `AssignedRight`, and
none of the three has a defined landing place:

- **Holder.** `AssignedRight.rightHolder` is `AssignedRightHolder`, which
  has only `credentials[]` — there is no reference to the RightHolder.
  The scenarios render the holder as a `CustomerCredential`
  (`credentialAssignedType: customer`, `identifier` → the RightHolder),
  which is the APDS 4.1 idiom, but nothing in Part 14 says so.
- **Plates.** APDS `CredentialAssigned` needs `type` (enum) and
  `identifier` (a `Reference`, id + className), not a string. Part 21
  §21.2 answers "identifier = Reference to the CredentialRecord", but
  only for servers claiming `apx-credentials`. A permits-only server has
  no rule, and the stock lane query
  `GET /rights/assigned?credential_type=licensePlate&credential_id=MBL-7710`
  (PRM-10, public scenario 20 step 4) matches the plate string against
  an entity that carries only a UUID reference — the resolution is
  implied, never written. Public scenario 05 shows a third shape,
  `credentials: [{credentialType, identifier: "SYN-1234"}]` at the top
  level of the AssignedRight, which is neither APDS nor
  `PermitIssueRequest`.
- **Validity.** `AssignedRight` has `expiry` but no start. The scenarios
  use `plannedUses[0].startTime/endTime` plus `expiry`; the APDS
  "annual permit" pattern §14.2 cites could equally mean a single
  `PlannedUse` per year, or `RightSpecification.validity` alone.

**Proposed fix.** A short normative "materialization" list in §14.2,
mirroring §21.2: holder → one `CustomerCredential` whose `identifier`
references the RightHolder; each `credentials[]` entry → one
`VehicleCredential` with `type` = `credentialType` and `identifier` =
Reference to a CredentialRecord when `apx-credentials` is claimed,
otherwise `{id: <credentialIdentification>, className: <credentialType>}`;
`validity` → one `PlannedUse` and `expiry` = `validity.end`; and the
sentence "servers MUST resolve `credential_id` filters on
`/rights/assigned` against the identification string". Then fix public
scenario 05 to the same shape.

## F-PRM-07 — The waitlist is a word, not a feature

**Where it showed up.** PRM-02. "On exhaustion an implementation MAY
record a vendor-extension waitlist entry; APX v1 does not standardize
waitlist processing." The 409 problem can carry the entry as an RFC 9457
extension member (PRM-02 does), but there is no shape for it, no route
to read or cancel a position, no rule on whether the next free slot is
offered or auto-issued, and no event when a slot frees (F-PRM-10). A
customer who was told "you are number 7" has nothing to ask.

**Proposed fix.** Either delete the sentence (it promises nothing
testable) or standardize the minimum: an `apds-ext:apx:waitlist@1.0`
object on the problem and on the RightSpecification's pool
(`entry`, `position`, `holder`, `recordedAt`), and a `DELETE` on a
`/v1/permits/waitlist/{entry}` route. Small, optional, and enough for a
portal to show and cancel a position.

## F-PRM-08 — No way to cancel a permit, and the pool does not say what happens

**Where it showed up.** PRM-09. The only cancellation is the native
`DELETE /rights/assigned/{id}` (APDS `ResponseStatus`, no reason, no
actor, no refund). §14.2 covers issue and renewal only. Two things a
server must decide alone: whether a cancelled or expired AssignedRight
returns its slot to the RightPool (PRM-09 assumes yes: `available` goes
from 0 to 1), and how the pro-rated refund reaches Part 13
(`POST /v1/accounts/{id}/payments/{paymentId}/refund` exists, but
nothing links a permit to the payment that bought it —
`AssignedRight.payments[]` is APDS's own field and the profile never
mentions it).

**Proposed fix.** Add `POST /v1/permits/{id}/cancel` (scope
`apx.permits:manage`, `Idempotency-Key`, body `{reason, effectiveAt?}`,
200 with the AssignedRight, 409 `right-not-cancellable` for an already
cancelled or expired right); state that cancellation and expiry MUST
return the slot to the pool at `effectiveAt`; and say that
`AssignedRight.payments[]` is where the issuing payment is recorded so
the refund route has something to point at.

## F-PRM-09 — Adding a vehicle means rewriting the whole right

**Where it showed up.** PRM-08. "One right, many vehicles" is the
selling point of the profile, yet the only way to add or remove a
vehicle after issue is the native `PUT /rights/assigned/{id}` with the
entire AssignedRight. Two consequences. A client must round-trip every
field, including the `CustomerCredential` for the holder and any
`extensions`, and gets APDS's `ResponseStatus` 409 on a stale version —
while Part 5 §5.1 says servers "MUST reject a change-mode write
targeting a stale `version` with problem `version-conflict`", a
`Problem` body the native route's declared 409 (`ResponseStatus`,
`application/json`) cannot carry. And nothing says whether the added
plate must respect the pool (it should not: the slot is the right, not
the vehicle) or the RightSpecification's `credentials` allow-list (it
should).

**Proposed fix.** Additive `PUT /v1/permits/{id}/credentials` (full
list, `Idempotency-Key`, 200 with the AssignedRight, 409
`version-conflict` on a stale `If-Match`/`version`, 422
`credential-type-not-allowed`), or at least a sentence in §14.2 that
vehicles are changed through the native PUT and that the allow-list
applies. Separately, Part 5 should say how `version-conflict` is
delivered on native routes whose 409 is `ResponseStatus` (content
negotiation per Part 12 §12.1, with the declared response widened to
both media types).

## F-PRM-10 — Nobody is told when a pool changes

**Where it showed up.** PRM-13. The profile adds no topic. Issue and
cancel surface as native `AssignedRightCreated`/`Deleted`, which a
subscriber can count, but a portal that wants "Lakeside monthly: 2 left"
or "a slot freed, offer it to position 1" has to replay every
AssignedRight event and recompute the pool. `apx.data.occupancy.v1`
exists for the analogous physical count.

**Proposed fix.** Register `apx.permits.pool.availability.v1` in
`apx-topics` with `data` = `PoolAvailability` (plus `previous` counts),
published whenever `issued` or `capacity` changes, `subject` = the
RightSpecification. Optional for `apx-permits`, like the waitlist.

## F-PRM-11 — Native-topic payloads cannot be validated from the bundle

**Where it showed up.** PRM-13. Part 8 §8.2: "For APDS EventTypeEnum
topics, `data` is the APDS `EventData` shape." The vendored
`apds-api-4.1.yaml` defines `EventData` (a `oneOf` over six entities)
and `EventTypeEnum`, but neither is referenced from any APX operation,
so the bundler drops both from `apx-v1.json`. A validator working from
the bundle cannot check that `type: AssignedRightCreated` carries an
AssignedRight, or that a topic string is a legal APDS value; the runner
here validates `AssignedRight at /data` directly as the nearest
substitute. This belongs to `apx-events` but showed up first here.

**Proposed fix.** Reference `EventData` from `EventEnvelope.data` via a
`oneOf` (APX topic payloads, or `EventData`) or list both schemas
explicitly in the bundle's retained components, and type
`ApxEventSubscription.topics[]` items as `oneOf [EventTypeEnum,
registered APX topic pattern]`.

## F-PRM-12 — `PoolAvailability` reads one number from a structure that has several

**Where it showed up.** PRM-14, and PRM-01's `capacity`. APDS models
pools per period: `RightSpecification.rightPools[]` is an array, each
`RightPool` with its own `validity` (October, November) or
`relativeValidity` (every month). `GET …/availability` takes only the
RightSpecification id, so with two pools the server picks one by a rule
the profile does not state; a portal selling November cannot ask for
November. And `PoolAvailability.capacity` corresponds to nothing on
`RightPool`, which carries `distributedAssignedRights` and
`availableAssignedRights` only — so `capacity` is either their sum
(then it is derived and should say so) or an oversell ceiling the
operator set elsewhere (monthly permits are routinely sold above the
space count), which is the more useful reading and is undefined.

**Proposed fix.** Add optional `at` (date-time) and `pool` (RightPool
id) query parameters to the availability operation, with the rule
"absent → the pool whose validity contains now, else the earliest
future pool"; return `pool` (VersionedReference) and the pool's
`validity` window in `PoolAvailability`; and define `capacity` as
`distributedAssignedRights + availableAssignedRights` of that pool, with
an optional `spaces` for the physical count when the operator oversells.

## Runner issues

- **Stacked `apx:validate` markers.** Two `apx:validate` markers placed
  directly above one ```json block (the pattern public scenario 20 uses
  in step 5, `CredentialAccessEvent at /data/0` and `/data/1`) are not
  accepted: the second marker makes the first one dangling and it is
  reported as "apx:validate marker without a ```json block". PRM-13
  works around it by repeating the envelope as the webhook retry so each
  validate has its own block. Not fixed here; either the runner should
  let several validate markers share the next block, or the header
  comment should say one block per marker.
- **`gap=` on a request marker that passes** is reported under
  "resolved gaps — remove the gap marker" even when the paired response
  legitimately carries the gap. Harmless (exit code unaffected), but the
  message reads as if the finding were closed; PRM-03 keeps the marker
  on the response only.
