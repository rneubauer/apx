# Findings — apx-resolution (Part 17, Annex A APX-RES)

Each entry is something a scenario in `scenarios.md` needed
that the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-RES-NN`
markers so the runner reports them as known gaps rather than failures,
and reports them as resolved once the spec is fixed. The 401 shape is
not re-registered here: the module's 401 exchanges cite `F-CTL-07` from
`findings.md`. Fixes go to the public repo as ordinary additive PRs; the
scenarios stay here.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-RES-01 | resolution | medium | Five declared 400s in the module have no registered problem type | fixed — `invalid-request` (4417f2f) named in every 400 of the module; payment-links 400 is the accounts group's |
| F-RES-02 | resolution | medium | `ResolutionResolveRequest` cannot express "at least one parking-domain identifier"; telephony keys pass the schema | fixed (prose) — §17.1 names the nine identifying members, 400 `invalid-request` otherwise, unknown members ignored; the schema `anyOf` is withheld because it narrows a request schema (breaking) |
| F-RES-03 | resolution | low | `AllowedAction` / `recommendedAction` conditional MUSTs are prose-only | fixed — `if/then` on `AllowedAction` and `execution`; `recommendedAction` membership a runtime check (§17.3(4–5), APX-RES-05) |
| F-RES-04 | resolution | medium | Domain-executed actions have no `approval` carrier; §17.3 enforcement names only the command plane | fixed — optional `approval` on plate, assigned-right, and unlink bodies; §17.3 enforcement covers domain ops; `POST /v1/payment-links` body is the accounts group's |
| F-RES-05 | resolution | medium | Support history cannot be queried by `correlationId`, `interactionId`, or `credential` | fixed — three optional query params, each sufficient alone |
| F-RES-06 | resolution | low | No optimistic concurrency on `PUT /v1/sessions/{id}/plate` and `/assigned-right`; 409 `version-conflict` undeclared | fixed — shared `IfMatch` + 409 `version-conflict` on both; 200 returns Session `version` |
| F-RES-07 | resolution | low | Passback 404 conflates "no such credential" with "passback not tracked" | fixed — known-but-untracked is 200 `state: unknown`; 404 only for an unknown credential (§17.8) |
| F-RES-08 | resolution | medium | `POST /v1/support/interactions` has no `Idempotency-Key`, no replay, no conflict; retries double-record | fixed — optional `Idempotency-Key` (required would be breaking), 200 replay, 409 `idempotency-conflict` |
| F-RES-09 | resolution | low | `PUT /v1/sessions/{id}/assigned-right` declares no 429; auth/throttle declarations uneven (confirms F-CTL-08) | fixed — 429 declared and Spectral rule added (4417f2f) |
| F-RES-10 | resolution | medium | `Command.resolutionContext` is an unversioned Reference; the decision the agent executed against is not reconstructible after recompute | open (other owner) — §17.2 now says servers SHOULD record the context version used and retain those decisions; the wire field on `Command`/`PaymentLink` belongs to the control/accounts schemas (asked of integrator) |
| F-RES-11 | resolution | medium | Executing a command type absent from the context's `allowedActions` is unspecified | fixed — §17.3(3): not offered = 403 `action-not-allowed`; no context = Part 9 only; registry wording widening asked of integrator |
| F-RES-12 | resolution | medium | Support interactions cannot be updated: topic says "recorded or updated", `version` exists, no PUT/PATCH | fixed — new `GET` and `PUT /v1/support/interactions/{id}` (If-Match, 409); topic publishes on update |
| F-RES-13 | resolution | low | `OverrideRecord` has no `agent` or `reason`; the console must dereference every Command | fixed — optional `agent`, `agentType`, `reason` on `OverrideRecord` |

---

## F-RES-01 — Five declared 400s have no registered problem type

**Where it showed up.** RES-05 (`POST /v1/payment-links` 400 "no
account/ticket/session to settle, or unsupported channel"), RES-11
(`GET /v1/lpr/candidates` 400 "neither session nor lane given"), RES-17
(`POST /v1/resolution/contexts` 400 "no usable identifier supplied"),
RES-21 (`GET /v1/support/interactions` 400 "no filter given" and
`POST /v1/support/interactions` 400 "invalid interaction"). Every one of
these is declared in the OpenAPI with a `Problem` body, and Part 12
registers no 400 slug other than `idempotency-key-required`,
`unknown-topic`, and `agent-required`. A conforming server has no `type`
URI to return; the scenarios use `identifier-required` and
`invalid-request`, both unregistered.

**Proposed fix.** Register two generic 400 types in Part 12 §12.2:
`identifier-required` ("a read or resolve that needs at least one
subject identifier or filter received none") for the three filter/resolve
cases, and `invalid-request` ("request body or parameters fail the
operation's schema or a documented value constraint") for body-shape
errors, including the unsupported payment-link channel. Name them in the
five 400 descriptions. F-CTL-01 proposed `invalid-request` as an
alternative for the Control 400s; registering it once serves both.

## F-RES-02 — The resolve request cannot say "at least one identifier"

**Where it showed up.** RES-17. `ResolutionResolveRequest` has
`minProperties: 1`, but `interactionId`, `correlationId`, and `channel`
count toward it, so `{ "interactionId": "…", "channel": "intercom" }` is
schema-valid and resolves nothing. §17.1 forbids telephony identifiers,
yet the schema has no `additionalProperties: false` (rightly — tolerant
reader), so `{ "phoneNumber": "+15550100" }` also validates. Neither the
runner nor a generated client can catch either; only the server's 400
can, and that has no problem type (F-RES-01).

**Proposed fix.** Replace `minProperties: 1` with an `anyOf` of
`required` over the nine identifying members (`device`, `place`, `lane`,
`session`, `holder`, `credential`, `plate`, `ticketNumber`,
`reservationCode`) — OpenAPI 3.1 allows it and every existing valid body
still validates. Keep the prose ban on telephony keys and add one
sentence: unknown members are ignored, and a body with no identifying
member is 400 `identifier-required`.

## F-RES-03 — `AllowedAction` conditional rules are prose-only

**Where it showed up.** RES-01, RES-15, RES-16. The schema says `reason`
is "REQUIRED when allowed=false or requiresApproval=true", that
`execution` carries "exactly one of command/operationId per type", and
that `recommendedAction` "MUST be one of allowedActions". None of the
three is expressed in JSON Schema, so an `allowed: false` action with no
reason, a `type: control` descriptor carrying an `operationId`, or a
recommendation naming an unlisted action all validate. The scenarios
comply by hand; a vendor's conformance suite cannot check them from the
bundle.

**Proposed fix.** Add `if/then` blocks to `AllowedAction`: `allowed:
false` or `requiresApproval: true` → `required: [reason]`; `execution.type:
control` → `required: [command]`, `type: domain` → `required:
[operationId]`. The `recommendedAction` membership rule cannot be a
schema constraint; add it to the Annex A APX-RES-05 test description as
a runtime check.

## F-RES-04 — Domain-executed actions have nowhere to carry approval

**Where it showed up.** RES-18 (last exchange). `Approval` describes
itself as "one shared shape for control commands and domain actions
(e.g. refunds)", and `POST /v1/payments/{id}/refund` does carry
`approval`. The three domain actions this module's contexts list —
`PUT /v1/sessions/{id}/plate`, `PUT /v1/sessions/{id}/assigned-right`,
`POST /v1/payment-links` — have no `approval` member in their request
bodies, and §17.3 item 3 makes the decisions binding "on the command
plane" only. A policy that says `put-apx-v1-sessions-id-plate` requires
a supervisor can be evaluated but not satisfied: the 403
`approval-required` is expressible, the approved retry is not.

**Proposed fix.** Additive optional `approval` (`$ref: Approval`) on the
three request bodies, and one sentence in §17.3: "Enforcement applies
equally to domain operations named by an `execution.type: domain`
descriptor; the approval evidence rides the request body's `approval`
member." `PaymentLink` gains `approval` as a resource property so the
audit is visible on read.

## F-RES-05 — Support history cannot be queried by correlation id

**Where it showed up.** RES-22. §17.7 promises that one `correlationId`
"reconstructs: interaction → context → policy decision → action → gate
event → interaction record", and both `SupportInteraction` and the
resolve request carry it. `GET /v1/support/interactions` filters only by
`plate`, `holder`, `account`, `session`, `place`, `since`. A supervisor
holding the correlation id from a command's audit trail — or the call
platform holding its own `interactionId` — has no route to the record.
`subjects.credential` exists on the record but has no filter either.

**Proposed fix.** Additive optional query parameters `correlationId`
(uuid), `interactionId` (string, exact match), and `credential` (uuid)
on `GET /v1/support/interactions`, each acceptable as the "at least one
filter" on its own.

## F-RES-06 — No optimistic concurrency on the session façade PUTs

**Where it showed up.** RES-23. `PUT /v1/sessions/{id}/plate` and
`PUT /v1/sessions/{id}/assigned-right` are "naturally idempotent", but
two agents can hold the same session open (RES-11's bot and human), and
the second write silently replaces the first. The underlying APDS
Session is versioned; the façade takes no version and declares no 409
`version-conflict`, so a server that wants to refuse a stale correction
has no conforming response. Low severity because the last write is
usually the human's, but the audit trail then shows two corrections with
no sign that one was blind.

**Proposed fix.** Optional `If-Match` header (the APDS Session `version`
as an entity tag) on both PUTs, and declare 409 `version-conflict` on
both; without the header the current last-writer-wins behaviour is
unchanged.

## F-RES-07 — Passback 404 means two different things

**Where it showed up.** RES-09 (last exchange). The 404 on
`GET /v1/credentials/{id}/passback` is described as "no such credential
or no passback tracking". A console cannot distinguish a typo in the id
from a transient ticket credential the site legitimately does not track,
and the second case is not an error at all — §17.8 makes passback
conditional on the implementation tracking it.

**Proposed fix.** Keep 404 `target-not-found` for an unknown credential
and return 200 with `state: unknown` for a known credential the site does
not track (the enum already has the value), or register
`passback-not-tracked` (404) if a distinct refusal is preferred. The
first is smaller and needs no registry change.

## F-RES-08 — Recording an interaction is not idempotent

**Where it showed up.** RES-21 (last exchange). `POST
/v1/support/interactions` declares no `Idempotency-Key`, no 200 replay,
and no 409 `idempotency-conflict`, unlike `POST /v1/payment-links` and
`POST /v1/commands`. A console whose 201 was lost retries and records
the call twice; the next context then tells the agent "they called
twice yesterday" about one call. Part 12's `idempotency-key-required`
says "mutating operation", which reads as a general rule the route does
not follow.

**Proposed fix.** Declare `Idempotency-Key` (required) on the POST, add
200 "idempotent replay — returns the ORIGINAL record" and 409
`idempotency-conflict`, matching the payment-link pattern exactly.
Existing clients that already send the header are unaffected; ones that
do not get a 400 `idempotency-key-required` and a one-line fix.

## F-RES-09 — Declared-response inconsistencies in this module

**Where it showed up.** RES-24 (assigned-right 429), RES-25 (every 401).
`PUT /v1/sessions/{id}/assigned-right` declares 401/403/404/409 but no
429, while every other route in the module declares 429 through the
shared component. The 401 bodies all use the unregistered
`unauthenticated` slug (F-CTL-07). This confirms F-CTL-08's expectation
that the unevenness is cross-module.

**Proposed fix.** Add `"429": { $ref: "#/components/responses/TooManyRequests" }`
to the assigned-right PUT, register `unauthenticated` (401) per
F-CTL-07, and adopt the Spectral rule F-CTL-08 proposes so the build
catches the next one.

## F-RES-10 — The executed decision is not reconstructible

**Where it showed up.** RES-16. A context recomputes on every read and
`version` increments "when anything material changed"; in RES-16 the
decisions for `e5…0001` change between 21:14 (vend requires approval)
and 21:17 (vend allowed). `Command.resolutionContext` is a plain
`Reference`, so a command executed at 21:15 records which context it
resolved but not which version of the decisions it was checked against.
After the context expires (≥ 1 hour, then 404) nothing remains. For an
AI agent whose actions will be audited, "policy allowed it at the time"
must be provable.

**Proposed fix.** Make `Command.resolutionContext` (and
`PaymentLink.resolutionContext`) a `VersionedReference`, populated by the
server with the context version the enforcement check used; and say in
§17.2 that servers SHOULD retain the `allowedActions` of each version
for the audit retention period even after the context expires from the
read route.

## F-RES-11 — An action the context never evaluated

**Where it showed up.** RES-07 (last exchange). §17.3 item 3 defines the
outcome for `allowed=false` (403 `action-not-allowed`) and for
`requiresApproval` without evidence (403 `approval-required`). It says
nothing about a command that names a `resolutionContext` whose
`allowedActions` do not mention that command type at all. Two readings
are defensible: unlisted means not evaluated, so the command is subject
only to scope and grant; or unlisted means not offered, so it is
refused. The scenario shows the refusing reading with
`action-not-allowed`, which the registry description does not quite
cover ("evaluated as not allowed").

**Proposed fix.** One sentence in §17.3: "A command naming a
resolutionContext whose current allowedActions do not include the
command type MUST be refused with 403 `action-not-allowed`; a command
that names no resolutionContext is subject only to Part 9." Widen the
registry description of `action-not-allowed` to "evaluated as not
allowed or not offered by the named context".

## F-RES-12 — Support interactions cannot be updated

**Where it showed up.** RES-19. The topic `apx.support.interaction.recorded.v1`
is described as "recorded or updated", `SupportInteraction.version`
exists and is readOnly, yet the only write is `POST`. The natural
console flow — open the record when the call is answered so the
correlation id exists from the first second, close it with `endedAt`,
`resolution`, and `actions` when the call ends — cannot be expressed; a
console must buffer everything and post once at the end, and an
interaction that drops mid-call is never recorded.

**Proposed fix.** Additive `PUT /v1/support/interactions/{id}` (scope
`apx.support:manage`) taking the full `SupportInteraction` with
`version` for optimistic concurrency, declaring 200, 404
`target-not-found`, and 409 `version-conflict`; and a matching
`GET /v1/support/interactions/{id}`. The topic then publishes on both
create and update with `version` telling them apart.

## F-RES-13 — Overrides do not say who

**Where it showed up.** RES-01. `recentOverrides[]` is what tells an
agent "two courtesy exits already this week", and the first question a
supervisor asks is "who granted them". `OverrideRecord` carries
`commandType`, `occurredAt`, `requestedBy` (the organisation), `place`,
and a `command` Reference. The agent principal and the reason — both on
the underlying `Command` — are absent, so a console renders one extra
`GET /v1/commands/{id}` per row before it can answer.

**Proposed fix.** Additive optional `agent`, `agentType`, and `reason`
on `OverrideRecord`, copied from the summarized Command, mirroring what
`LaneStatus.currentTicket.negotiatedRate` already does with `agent`.

## Runner issues

- **Consecutive `apx:validate` markers** (EventEnvelope plus `<Data> at /data`
  over one block) were at first a false failure: the second marker made
  `flushDangling()` report the first as having no ```json block. Worked
  around by repeating each event block once per marker; after the runner
  was updated to queue stacked markers, the duplicates in RES-02, RES-19,
  and RES-22 were collapsed back to one block with two markers.
- **Exchanges on `POST /v1/commands` and `GET /v1/commands/{id}`** are
  validated but counted toward no module (they carry the Control tag).
  Expected, noted so the coverage block is not misread: the module's
  own 10 operations are at 100 percent regardless.
- **`command types: 9/15`** in the coverage block counts against the
  whole registry, not the module's four Part 17 entries (`resetPassback`,
  `forceIn`, `forceOut`, `courtesyExit`), all of which appear. Cosmetic.
