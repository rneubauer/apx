# Findings — what the scenarios could not express

Each entry is something a scenario needed that the public spec
(`apx` at v0.10.0) does not define, or defines ambiguously. IDs are
stable; scenarios cite them in `gap=F-NN` markers so the runner reports
them as known gaps rather than failures, and reports them as resolved
once the spec is fixed. Fixes go to the public repo as ordinary additive
PRs; the scenarios stay here.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-CTL-01 | control | low | No problem type for an unknown `commandType` | fixed — 400 description names `invalid-request` for unknown type / missing target (4417f2f registered it); §6.1 says so |
| F-CTL-02 | control | medium | `Command` has no structured result; lost-ticket number and fee live only in `statusHistory[].detail` | fixed — optional readOnly `Command.result` (`CommandResult`), members per type in new §6.1a |
| F-CTL-03 | control | medium | `lostTicket` with no `lostTicketFee` line: sync 4xx or async `failed`? No problem type either way | fixed — §6.1: synchronous `422 lost-ticket-fee-undefined`, no command created; declared on POST /v1/commands; APX-CTL-08 |
| F-CTL-04 | control | medium | `GET /v1/devices` has no `place` filter | fixed — optional `place` (list, subtree) and `deviceState` on GET /v1/devices; §6.4; APX-CTL-13 |
| F-CTL-05 | control | medium | Parameter names for `courtesyExit` (and the three passback commands) are not in the §6.1 normative parameter list | fixed — §6.1 lists `resetPassback/forceIn/forceOut.credential`, `courtesyExit.holder` (Part 17 §17.4 restatement left to its owner) |
| F-CTL-06 | control | low | `POST /v1/commands/{id}/cancel` declares no 404 | fixed — 404 declared on cancel (4417f2f) |
| F-CTL-07 | control | low | No problem type for 401 | fixed — `unauthenticated` registered (4417f2f) |
| F-CTL-08 | control | low | 401/403/429 declared on some Control operations and not others | fixed — shared 401/403/429 on every operation plus Spectral rule (4417f2f) |
| F-CTL-09 | control | low | How a `holdGateOpen` is released is under-specified | fixed — §6.1 hold-open release: `expiryTime`, `closeLane`, or `setDeviceState` releases; hold ends `succeeded` |
| F-CTL-10 | control | medium | No way to list or query commands; the audit trail is reachable only by id or by subscribing to events | fixed — new `GET /v1/commands` (target, place, commandType, status, agent, since, until), §6.1b, APX-CTL-13 |

---

## F-CTL-01 — Unknown `commandType` has no registered problem type

**Where it showed up.** CTL-04. The 400 on `POST /v1/commands` is
described as "Missing Idempotency-Key, unknown commandType, or missing
target", but Part 12 registers only `idempotency-key-required` for 400 on
this route. A server has no registered `type` URI to return for the other
two cases.

**Proposed fix.** Register `command-type-unknown` (400) and
`target-required` (400) in Part 12 §12.2, and name them in the 400
description. Alternatively one generic `invalid-request` (400) for all
body-shape errors; the specific slugs are more useful to a console.

## F-CTL-02 — `Command` carries no structured result

**Where it showed up.** CTL-09. Part 6 §6.1 says a successful
`lostTicket` "command result names the issued ticket and fee", but the
`Command` schema has no result field. The only places the ticket number
and fee can appear are the free-text `statusHistory[].detail` and the
lane inquiry afterwards. A console that needs the ticket number to
continue (print, take payment) has to parse prose or make a second call.

**Proposed fix.** Additive optional `result` object on `Command`,
populated on `succeeded`, with per-command-type normative members
alongside the parameter list in §6.1: `lostTicket` → `ticketNumber`,
`session` (Reference), `amountDue` (AmountInCurrency);
`matchTicket` → `session`, `amountDue`; `pushNegotiatedRate` →
`rateTable` (VersionedReference), `amountDue`. Other types leave it
absent.

## F-CTL-03 — Lost ticket with no fee line: which failure, and which shape?

**Where it showed up.** CTL-10. §6.1: "a rate deck with no lostTicketFee
line makes the command fail rather than guess." Annex A APX-CTL-08 says
"absent line → command fails". Neither says whether the server refuses
synchronously (a 4xx at POST time, the way `validation-provider-unknown`
does) or accepts and transitions to `failed`. There is no problem type
for the synchronous reading. The scenario had to pick the asynchronous
one because it is the only shape expressible today.

**Proposed fix.** Decide and say so. The consistent choice with §6.3 is
synchronous: the deck is server-side state the server can check at POST
time, so refuse with `422 lost-ticket-fee-undefined` and register it.
If asynchronous is preferred, §6.1 should say "transitions to `failed`
with the reason in `detail`" so implementers do not split.

## F-CTL-04 — Device list cannot be filtered by place

**Where it showed up.** CTL-16. `GET /v1/devices` returns "every
SupplementalEquipment the caller may see" with only the APDS `page`
parameter. An operator credential granted forty garages gets one
paginated list of every device it owns. The APDS-native routes and the
APX provider lookup both take `place`.

**Proposed fix.** Additive `place` query parameter on `GET /v1/devices`,
same semantics as the APDS `place` filter (comma-separated
HierarchyElement ids, subtree-inclusive), plus optionally `deviceState`
for "show me everything in fault". Both are optional, so existing
callers are unaffected.

## F-CTL-05 — Parameters for the registry v2 commands are not in the normative list

**Where it showed up.** CTL-15, CTL-21. §6.1 lists normative parameters
per command type, but only for the nine registry v1 types plus the two
v3 ones. The four v2 types are defined in Part 17 §17.4 with
"parameters: `credential`" for `resetPassback`/`forceIn`/`forceOut` and
"the account/holder referenced in parameters" for `courtesyExit`. Two
vendors will name the courtesy parameter differently.

**Proposed fix.** Move the four into the §6.1 parameter list:
`resetPassback.credential`, `forceIn.credential`, `forceOut.credential`
(Reference to Credential), `courtesyExit.holder` (Reference to
RightHolder). Part 17 §17.4 then points at §6.1 instead of restating.

## F-CTL-06 — Cancel declares no 404

**Where it showed up.** CTL-07. `POST /v1/commands/{id}/cancel` declares
200 and 409 only. Cancelling an id that does not exist has no declared
response; `GET /v1/commands/{id}` does declare 404.

**Proposed fix.** Add 404 (`target-not-found`) to the cancel operation.
See also F-CTL-08.

## F-CTL-07 — No problem type for 401

**Where it showed up.** CTL-14, CTL-23. The shared `Unauthorized`
response is `application/problem+json` with the `Problem` schema, whose
`type` must be a registered URI. Part 12 registers nothing for 401, so a
conforming server cannot produce a conforming 401 body.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2:
"missing, malformed, expired, or revoked access token".

## F-CTL-08 — Auth and throttling responses declared inconsistently

**Where it showed up.** Coverage report. `GET /v1/devices` and
`GET /v1/validations/providers` declare 401/403/429 through the shared
responses; `POST /v1/commands` declares them inline;
`GET /v1/commands/{id}`, `POST /v1/commands/{id}/cancel`,
`GET /v1/devices/{id}`, and `GET /v1/lanes/{id}/current` declare none of
them. Every one of those is a secured operation that can return all
three.

**Proposed fix.** Declare 401, 403, and 429 on every secured operation
via the shared components, and add a Spectral rule to
`tools/.spectral.yaml` that fails the build when a secured operation
lacks them. This is likely true across all modules, not just Control;
the other module files will confirm.

## F-CTL-09 — Releasing a hold-open is under-specified

**Where it showed up.** CTL-22. The registry entry for `holdGateOpen`
says "until released by a subsequent setDeviceState or closeLane
command". `setDeviceState` targets a SupplementalEquipment and takes an
`apx-device-states` value (`available`, `occupied`, `inoperative`,
`outOfService`, `fault`, `unknown`); none of those means "stop holding".
`closeLane` closes the lane, which is more than releasing the hold.

**Proposed fix.** Either say that `holdGateOpen` is released by its
`expiryTime` or by cancel while `executing` (which today is refused,
APX-CTL-04), or add a `releaseGate` command type. The first is smaller.

## F-CTL-10 — Commands cannot be listed

**Where it showed up.** Every scenario that polls. Part 4 §4.2 makes
`statusHistory` the authoritative audit record, and Part 6 says every
control transaction is tracked end to end, but the only read is
`GET /v1/commands/{id}`. A supervisor asking "what was vended at lane 2
between 18:00 and 19:00, and by whom" has no route; the answer exists
only if someone subscribed to `apx.control.command.status.v1` and kept
the events.

**Proposed fix.** Additive `GET /v1/commands` with filters `target`,
`place` (subtree), `commandType`, `status`, `agent`, `from`, `to`,
paginated in the APDS `{meta, data}` envelope, scope `apx.control:read`,
grant-scoped like everything else. Resolution contexts already show
`recentOverrides`, so the data exists server-side.
