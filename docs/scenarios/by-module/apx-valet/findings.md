# Findings — apx-valet (Part 22)

Each entry is something a scenario in `scenarios.md` needed that
the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-VLT-NN`
markers where the wire exchange fails validation, so the runner reports
them as known gaps rather than failures. Findings whose exchange still
validates (the gap is in the prose, or in a route that does not exist)
carry no marker and say so.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-VLT-01 | valet | low | No problem type for an invalid ticket body on drop-off (the 400 "invalid ticket") | fixed — 400 on drop-off names `invalid-request` (registered in 4417f2f) |
| F-VLT-02 | valet | medium | No problem type for the 422 "unknown place, lane, or customer reference" on drop-off | fixed — 422 on drop-off names `reference-unknown` |
| F-VLT-03 | valet | low | No problem type for 401 (cross-cutting; same gap as F-CTL-07) | fixed — `unauthenticated` registered (4417f2f); VLT-17/24 cover every route |
| F-VLT-04 | valet | medium | `dropped → cancelled` is in the state machine but no operation reaches it | fixed — new `POST /v1/valet/tickets/{id}/cancel` (ValetCancelRequest), `dropped → cancelled` only |
| F-VLT-05 | valet | medium | `requested → retrieving` has no operation, and §22.1.2 ("park-style updates") contradicts §22.1.1 | fixed — new `POST …/{id}/pickup` (ValetPickupRequest) sets `retrievingBy`; the `park`-style sentence in §22.1 rule 2 removed; step stays optional |
| F-VLT-06 | valet | medium | `staged → parked` ("re-parked by the operator") has no route; a staged car nobody collects is stuck | fixed — `park` legal from `staged` (re-park: clears staging, sets cancelledTime/cancelReason `re-parked`) |
| F-VLT-07 | valet | medium | Condition-report corrections (§22.2.3) have no route once the ticket leaves `dropped` | fixed — new `POST …/{id}/condition` (ConditionReport body, append-only, optional Idempotency-Key); optional `recordedTime`/`recordedBy` on damage entries |
| F-VLT-08 | valet | medium | Out-of-grant and not-own tickets: OpenAPI says 404, Part 9 / APX-CORE-07 says 403; §22.5 does not choose | fixed — §22.5 + 404 descriptions per Part 9 §9.3a: `:request` token → 404 for any unbound ticket; operator out of grant → 403 |
| F-VLT-09 | valet | low | Repeated `park` has no concurrency precondition; `version-conflict` is unreachable in Valet | fixed — optional `If-Match` on `park`; 409 `version-conflict` declared in the description (§22.1 rule 6) |
| F-VLT-10 | valet | low | §22.6 MUST NOT (raw phone/e-mail in `handle`) has no error shape and cannot be expressed in the schema | fixed — §22.6 SHOULD refuse with 422 `personal-data-not-permitted` (registered at 422, not 400); drop-off 422 description names it |
| F-VLT-11 | valet | medium | `statusHistory`, `storage`, `retrieval`, `recordInfo` are not readOnly: the create body may carry an audit trail | deferred (breaking) — marking request properties readOnly narrows the create body; instead §22.1 rule 5 (MUST ignore client-sent storage/retrieval/handback/statusHistory/recordInfo) and the POST/ValetTicket descriptions |
| F-VLT-12 | valet | low | The minimized `apx.valet:request` read is prose only; its field list is ambiguous and scenario 21 contradicts it | fixed — §22.5 lists the minimized projection exactly (no statusHistory, requestedBy, contactChannel…); applies to read, retrieve, cancel-retrieval; scenario 21 and VLT-06/07/08/09 corrected |
| F-VLT-13 | valet | low | A second `retrieve` while `requested` is 409, so "CAR" texted twice is an error every gateway must translate | fixed — `retrieve` while `requested`/`retrieving` is 200 with the current ticket, nothing appended or republished (§22.3 rule 4) |
| F-VLT-14 | valet | low | `etaMinutes` for a scheduled pickup is undefined (minutes until `requestedFor`, or minutes of work?) | fixed — `etaMinutes` = max(0, floor(promisedTime − now)), recomputed on every read; `promisedTime` = requestedFor when scheduled (§22.3 rule 1, schema descriptions) |
| F-VLT-15 | valet | low | Public scenario 21 shows `meta.totalCount`, which does not validate against APDS `PaginatedListMeta` | fixed — public scenario 21 Step 4 `meta` now APDS PaginatedListMeta |
| F-VLT-16 | valet | low | `GET /v1/valet/tickets` `place` is a single UUID while the description says subtree-inclusive and APDS `place` filters are lists | deferred (breaking) — `place` uuid → list changes the parameter type; belongs with cross-cutting A9 |

---

## F-VLT-01 — Invalid ticket body has no registered problem type

**Where it showed up.** VLT-03 (`gap=F-VLT-01`). `POST /v1/valet/tickets`
declares 400 as "Missing Idempotency-Key or invalid ticket", but Part 12
registers only `idempotency-key-required` at 400 for the first case. A
ticket with no `dropOff` — the second case — has no registered `type`
URI to be refused with. The same shape of gap as F-CTL-01.

**Proposed fix.** Register one generic `invalid-request` (400) in Part 12
§12.2 — "request body fails the operation's schema or a documented
structural rule; `detail` names the property" — and reference it from
every 400 description that says "invalid …". One slug across modules is
better than a per-module `valet-ticket-invalid`; the schema path in
`detail` is what a console needs.

## F-VLT-02 — Unknown reference in a body has no 422 problem type

**Where it showed up.** VLT-03 (`gap=F-VLT-02`). The 422 on drop-off is
"Unknown place, lane, or customer reference". Part 12's only slug for
an entity that does not exist is `target-not-found`, registered at 404
and pinned to one status. A server that receives a `place` Reference to
a HierarchyElement it has never heard of has no conforming body to
answer with.

**Proposed fix.** Register `reference-unknown` (422): "a Reference in
the request body names an entity that does not exist, or is not
visible to this operator; `detail` names the property and the id". It
is reusable by every module whose create body carries References
(Violations, Validations, Credentials all have the same 422).

## F-VLT-03 — No problem type for 401

**Where it showed up.** VLT-17 (nine `gap=F-VLT-03` markers, one per
operation). The shared `Unauthorized` response is `problem+json` with a
`Problem` whose `type` must be registered, and Part 12 registers
nothing at 401. Identical to F-CTL-07; recorded here so the Valet PR
can be tracked on its own.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2:
"missing, malformed, expired, or revoked access token". One registry
line fixes every module.

## F-VLT-04 — `cancelled` has no operation

**Where it showed up.** VLT-22 (no marker: the only conforming evidence
is the status event, which validates). §22.1 draws
`dropped ──▶ cancelled (custody never taken; terminal)` and the
`valetStatus` enum has the value, but no route transitions to it.
Scenario 21's attendant, whose driver walked off to the self-park deck
mid-walk-around, has a `dropped` ticket forever — or the server does
something out of band and publishes an event nobody can reproduce
through the API.

**Proposed fix.** Additive `POST /v1/valet/tickets/{id}/cancel` with a
`ValetCancelRequest` (`reason` required, `note`), scope
`apx.valet:manage`, legal from `dropped` only (409
`valet-transition-illegal` otherwise), appending `statusHistory[]` and
publishing `apx.valet.ticket.status.v1`. The server SHOULD close the
APDS Session it opened at drop-off at zero.

## F-VLT-05 — `requested → retrieving` has no operation, and the prose contradicts itself

**Where it showed up.** VLT-10 (no marker; the `retrieving` state is
shown as an event only). §22.1.2 says the runner picking the car up "is
a server-recorded step … with no separate API operation —
implementations MAY expose it via `park`-style updates". §22.1.1 says
`park` is valid from `dropped` (and repeated while `parked`) and
anything else is 409 `valet-transition-illegal`. A `park` on a
`requested` ticket is therefore illegal by §22.1.1 and permitted by
§22.1.2. Two vendors will read this differently, and the runner board
(which is what `retrieving` and `retrievingBy` exist for) has no
portable way to record who has the car.

**Proposed fix.** Either add `POST /v1/valet/tickets/{id}/pickup`
(scope `apx.valet:manage`, body `{ "retrievingBy": "…" }`, legal from
`requested`, sets `retrieval.retrievingBy` and transitions to
`retrieving`), or delete the `park`-style sentence in §22.1.2 and say
plainly that `retrieving` is optional and server-inferred, and that
`stage` from `requested` is the normal path. The first is small and
makes the queue meaningful; the second at least removes the
contradiction.

## F-VLT-06 — A staged car cannot go back down

**Where it showed up.** VLT-10 (the 409 validates; no marker). The
cancel-retrieval description says "a staged car is re-parked by the
operator, not cancelled here", but §22.1.1 makes `park` legal only from
`dropped | parked`, and the only transition out of `staged` is
`handback`. A guest who sees their car at the kerb and says "another
half hour" leaves the operator with a car blocking the staging lane and
no conforming call to put it back.

**Proposed fix.** Allow `park` from `staged` in §22.1.1 and the `park`
description: it records the new `storage`, clears
`retrieval.stagingLane`/`stagedTime`, sets `cancelledTime`/`cancelReason`
("re-parked"), and transitions to `parked`. This reuses the existing
route and body; `cancel-retrieval` stays customer-callable and
`park` stays operator-only, which is the right split.

## F-VLT-07 — Condition-report corrections have no route

**Where it showed up.** VLT-21 (no marker; the `park` exchange
validates but the correction lands in `statusHistory[].detail`).
§22.2.3: "the drop-off condition report is immutable once the ticket
leaves `dropped`; corrections are new `damage[]` entries with a later
`recordedTime`, never edits." No operation can append such an entry:
`park` carries `note` only, `stage` carries `note` only, and the ticket
itself has no PUT. The runner who finds a door ding at P3 — the exact
case the sentence describes — has nowhere to record it that a damage
claim will look at.

**Proposed fix.** Additive `POST /v1/valet/tickets/{id}/condition`
taking a `ConditionReport` fragment (`damage[]`, `imageLinks[]`,
`notes`), scope `apx.valet:manage`, legal in any non-terminal state,
appended (never merged) to `dropOff.conditionReport.damage[]` with
server-set `recordedTime` and `recordedBy`, and a `statusHistory[]`
entry. Alternatively accept an optional `conditionReport` on
`ValetParkRequest` with the same append-only semantics; the dedicated
route is clearer about immutability.

## F-VLT-08 — 403 or 404 for a ticket the caller may not see

**Where it showed up.** VLT-15, VLT-16 (both validate; no marker). The
404 descriptions on `GET …/{id}`, `retrieve`, and `cancel-retrieval`
say "No such ticket (or outside the caller's grant)". Part 9 and Annex
A APX-CORE-07 say an out-of-grant target is 403 `insufficient-grant`.
§22.5 says a `apx.valet:request` token "is confined to the ticket(s) it
was minted for" without saying what a request for another ticket
returns. The scenarios chose 403 for operator tokens (CORE-07) and 404
for customer tokens (so a claim link cannot enumerate tickets), but
that split is the author's, not the spec's.

**Proposed fix.** Say it in §22.5 and in the three 404 descriptions:
operator scopes (`:read`, `:manage`) get 403 `insufficient-grant` for a
ticket outside `apx_places`, per Part 9; a `apx.valet:request` token
gets 404 `target-not-found` for any ticket it is not bound to, so that
existence is not disclosed. Reword the 404 descriptions to "No such
ticket, or not bound to this `apx.valet:request` token".

## F-VLT-09 — Repeated `park` is last-write-wins

**Where it showed up.** VLT-04 (validates; no marker). `park` "MAY be
repeated while `parked` to update `storage`", and `ValetTicket` carries
`version`, but `ValetParkRequest` has no `version` or `If-Match`
precondition and no `version-conflict` response is declared. Two
runners moving the same car in the same minute overwrite each other's
`storage` silently; the ticket ends up pointing at a space the car is
not in. This is the only "versioned write" in Valet and it is not
versioned.

**Proposed fix.** Optional `If-Match: "<version>"` (or an optional
`version` member on `ValetParkRequest`) that, when present, makes the
server refuse with 409 `version-conflict` if the ticket has moved on.
Absent, behaviour is unchanged. Declare 409 `version-conflict` in the
`park` description alongside `valet-transition-illegal`.

## F-VLT-10 — §22.6's MUST NOT has no error shape

**Where it showed up.** VLT-23 (`gap=F-VLT-10`). "Implementations MUST
NOT carry raw phone numbers or e-mail addresses on the ticket." The
schema describes `handle` as opaque or masked but cannot enforce it,
and a server that refuses a PMS integration sending `+1 312 555 0199`
has no registered problem type. Annex A APX-VLT-07 tests the MUST NOT
but there is no wire-visible way to pass it except by never receiving
such a body.

**Proposed fix.** Register `personal-data-not-permitted` (400) in Part
12 §12.2 — "a property the standard defines as opaque/masked carries
personal data in the clear (Part 9 §9.6)" — and say in §22.6 that a
server SHOULD refuse with it rather than store or silently mask. The
same slug serves any module with a minimization rule.

## F-VLT-11 — The create body can carry an audit trail

**Where it showed up.** VLT-01 (validates; no marker — the scenario
avoided the fields by discipline, not because the schema forbids
them). `ValetTicket` is both the create body and the resource. Only
`id`, `version`, `valetStatus`, and `handback` are `readOnly`;
`statusHistory`, `storage`, `retrieval`, and `recordInfo` are writable,
so a client may post a ticket that arrives already "parked in P3 with
keys on hook 17, requested by SMS, ETA 8", complete with a
`statusHistory[]` of its own choosing. Part 4 §4.2 makes
`statusHistory[]` the authoritative audit record; it should not be
client-supplied.

**Proposed fix.** Mark `statusHistory`, `storage`, `retrieval`, and
`recordInfo` as `readOnly: true` on `ValetTicket` (they are written only
by `park`, `retrieve`, and the server). Leave `session` and
`assignedRight` writable, since an operator that opens the Session
before the drop-off call may legitimately reference it, and say so in
the `POST` description ("the server opens the Session unless one is
referenced").

## F-VLT-12 — The minimized read has no normative field list

**Where it showed up.** VLT-06 (validates; no marker). §22.5 lists what
is omitted ("`storage`, attendant principals, `dropOff.keyTag`, and
condition images") and what is returned ("status, `etaMinutes`,
`promisedTime`, `stagingLane`, `ticketNumber`, and the vehicle summary")
and leaves the rest open: are `statusHistory[].actor` values "attendant
principals"? Is `damage[].description` a "condition image"? Does
`customer.contactChannel` come back? Public scenario 21 Step 3 shows
the minimized read WITH `statusHistory` naming `attendant-0031` and
`runner-0107`, which is the opposite of the sentence it illustrates.

**Proposed fix.** Make the minimized projection normative as a list of
retained properties: `id`, `version`, `place`, `ticketNumber`,
`vehicle`, `customer.displayName`, `dropOff.time`,
`retrieval.{requestedTime, requestedFor, channel, etaMinutes,
promisedTime, stagingLane, stagedTime, cancelledTime}`,
`handback.time`, `valetStatus`, `extensions`; everything else omitted,
including `statusHistory`. Then fix scenario 21 Step 3 to match.

## F-VLT-13 — "CAR" twice is an error

**Where it showed up.** VLT-14 (validates; no marker). `retrieve` is
legal from `parked` only; a second request while `requested` is 409
`valet-transition-illegal`. Guests text twice. Every SMS gateway, PWA,
and voice bot must catch that 409, recognise it as "already on its
way", GET the ticket, and reply with the ETA — or show the guest an
error.

**Proposed fix.** Make `retrieve` idempotent from `requested` and
`retrieving`: return 200 with the current ticket (and ETA) and do not
append to `statusHistory[]` or republish
`apx.valet.retrieval.requested.v1`. Keep 409 from `staged`,
`handedBack`, `closed`, and `cancelled`. State it in §22.1.1 and the
operation description.

## F-VLT-14 — `etaMinutes` for a scheduled pickup

**Where it showed up.** VLT-08 (validates; no marker). §22.3.1: "the
server MUST set `retrieval.etaMinutes` and `promisedTime` on every
request". For an as-soon-as-possible request that is clear. For a
07:30 pickup booked at 22:10, is `etaMinutes` 559 (minutes until the
promised time) or the runner's expected effort, or 0 until the horizon
is reached? The scenario chose 559 because a customer app that shows
"ready in N minutes" needs a number that counts down; nothing in the
text says so.

**Proposed fix.** Define `etaMinutes` as `max(0, promisedTime − now)`
in whole minutes, recomputed on every read and event, and `promisedTime`
as `requestedFor` when scheduled, else `requestedTime` plus the
operator's estimate. One sentence in §22.3.1.

## F-VLT-15 — Public scenario 21 shows a `meta` that does not validate

**Where it showed up.** VLT-08, VLT-20 (the vetting payloads use the
real shape; no marker). `docs/scenarios/21-valet-…md` Step 4 shows
`"meta": { "totalCount": 3 }`. The bundle's list responses use APDS
`PaginatedListMeta`, which requires `referenceInstant`, `offset`,
`pageSize`, and `total`. A reader who copies the public example gets a
response no conforming server would send. Step 3's minimized read also
contradicts §22.5 (see F-VLT-12).

**Proposed fix.** Correct Step 4 to
`{ "referenceInstant": …, "offset": 0, "pageSize": 100, "total": 3 }`
and Step 3 to omit `statusHistory`. Docs-only; no spec change.

## F-VLT-16 — The list's `place` filter is one UUID

**Where it showed up.** VLT-20 (validates; no marker). `GET
/v1/valet/tickets` describes `place` as "subtree-inclusive" with
`schema: { type: string, format: uuid }` — one id. The APDS `place`
filter the rest of the standard leans on (and F-CTL-04 proposes for
devices) is a comma-separated list of HierarchyElement ids. An operator
with three valet stands under one garage can pass the garage, but one
with stands in two garages needs two calls.

**Proposed fix.** Loosen `place` on both Valet list operations to
`type: string` with the APDS comma-separated-ids semantics, keeping
subtree inclusion. Existing single-UUID callers are unaffected.

---

## Runner issues

**Stacked `apx:validate` markers bind one block only.** The brief (and
public scenario 21) stack two markers over one event block:

```
<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json … ```
```

Against the `run.mjs` of 23:24 (18,858 bytes), the first marker was
reported as "apx:validate marker without a ```json block" and only the
second was checked; six events in `scenarios.md` hit it, and the file
was briefly worked around by repeating each envelope block once per
marker. The `run.mjs` revision of 23:42 (20,847 bytes) stacks any
number of `apx:validate` markers onto the next block (`expect.validates`),
so the workaround was reverted and the stacked form is what the file
now uses. Nothing was changed in `run.mjs` by this module. Resolved;
recorded so the earlier duplicate blocks are not mistaken for intent.
