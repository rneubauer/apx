# Findings — apx-alerts

Each entry is something an `scenarios.md` scenario needed that
the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-ALT-NN`
markers. A gap first logged by another module keeps that module's id:
ALT-17 cites `F-CTL-07` (no problem type for 401) rather than duplicating
it here.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-ALT-01 | alerts | medium | No problem type for an illegal alert transition (409) | fixed — `alert-transition-illegal` registered (4417f2f), named in both 409s and §7.2 |
| F-ALT-02 | alerts | medium | 401/403/404/429 declared on some Alerts operations and not others; `GET /v1/alerts/{id}` cannot express `insufficient-grant` | fixed — shared 401/403/404/429 declared (4417f2f) |
| F-ALT-03 | alerts | medium | `expired` depends on a validity window the Alert schema cannot carry | fixed — optional `Alert.expiryTime`; §7.3 and APX-ALT-04 |
| F-ALT-04 | alerts | medium | `acknowledge`/`resolve` take no body; the history `detail` cannot be supplied by the caller | fixed — optional `AlertTransition` body (`detail`, `agent`) on acknowledge/resolve, plus 400 |
| F-ALT-05 | alerts | low | No problem type for an invalid alert body (400) | fixed — 400 description names `invalid-request` (registered in 4417f2f) |
| F-ALT-06 | alerts | low | `GET /v1/alerts` cannot filter by `source.device` or `relatedEntity` | fixed — optional `device` and `relatedEntity` query parameters on GET /v1/alerts |
| F-ALT-07 | alerts | low | `Alert.id` is `readOnly` but APX-CORE-03 / Part 4 §4.1 expect client-supplied ids | fixed (prose) — §7.1 and `Alert.id` description: client MAY supply id, collision 409 `id-collision`; `readOnly` kept (removing it is not needed and the general rule is Part 4's) |
| F-ALT-08 | alerts | medium | Place-less alerts (`webhookDeliveryFailed`) vs the `apx_places` grant and the `place` filter: unspecified | fixed — §7.1 place-less alerts bound to the owning org (Part 9 §9.3a rule 3), excluded from `place` lists; APX-ALT-05 |
| F-ALT-09 | alerts | low | Idempotent replay after a transition: original snapshot or current state? | fixed — §7.2 and the 200 descriptions: replay returns the current representation (Part 4 §4.2a); same on POST /v1/commands |

---

## F-ALT-01 — Illegal alert transition has no registered problem type

**Where it showed up.** ALT-07, ALT-09. Part 7 §7.2 and the OpenAPI say
"illegal transitions are 409", and §7.3 says terminal states never
transition again, but Part 12 registers no alert slug at 409. Every other
lifecycle domain has one (`command-not-cancellable`,
`violation-transition-illegal`, `credential-transition-illegal`,
`valet-transition-illegal`). A server has no registered `type` URI to
return when a console acknowledges an acknowledged, resolved, or expired
alert.

**Proposed fix.** Register `alert-transition-illegal` (409) in Part 12
§12.2: "Alert transition requested from a state that does not allow it
(Part 7 §7.3)", and name it in the 409 descriptions of
`POST /v1/alerts/{id}/acknowledge` and `/resolve`.

## F-ALT-02 — Auth and not-found responses declared inconsistently

**Where it showed up.** ALT-08, ALT-15, ALT-16, and the coverage report.
`POST /v1/alerts` and `GET /v1/alerts` declare 401/403/429 through the
shared components; `GET /v1/alerts/{id}` declares only 200 and 404;
`POST /v1/alerts/{id}/acknowledge` and `/resolve` declare only 200 and
409 — no 401, 403, 404, or 429. All five are secured, grant-scoped
operations. The sharpest consequence: Part 9 §9.3 makes
`403 insufficient-grant` a MUST for an out-of-grant target, but a read of
Harbor Deck's alert by id has no declared 403, so a server following the
OpenAPI literally can only answer 404 (ALT-16). Acknowledging an id that
does not exist has no declared response at all (ALT-08). Same family as
F-CTL-08.

**Proposed fix.** Declare 401, 403, and 429 via the shared components on
all five Alerts operations, add 404 (`target-not-found`) to `acknowledge`
and `resolve`, and let the Spectral rule proposed in F-CTL-08 keep it
that way.

## F-ALT-03 — `expired` needs a validity window the schema cannot hold

**Where it showed up.** ALT-09. Part 7 §7.3: "`expired` is a server-side
terminal state for alerts with a validity window." Nothing on `Alert`
names that window: no `expiryTime`, no `validUntil`, no duration. A
client cannot ask for one when it raises, cannot see when an open alert
will lapse, and a console cannot tell an alert that will expire from one
that will sit in `raised` forever. The scenario had to put the window in
operator configuration and the reason in `statusHistory[].detail`.

**Proposed fix.** Additive optional `expiryTime` (DateTime) on `Alert`,
settable on raise and defaulted by server policy per `alertType`; when
present and the alert is still `raised` or `acknowledged` at that
instant, the server transitions it to `expired` and publishes
`apx.alert.status.v1`. §7.3 then says "alerts with an `expiryTime`"
instead of "with a validity window".

## F-ALT-04 — Transitions take no body, so the caller cannot annotate them

**Where it showed up.** ALT-20 (and every acknowledge in the file).
`POST /v1/alerts/{id}/acknowledge` and `/resolve` declare no
`requestBody`. The `statusHistory[]` entry has an optional `detail`, and
the public scenario 02 shows an acknowledgement carrying
`detail: "field tech dispatched"` — but nothing in the contract lets the
client say that. The audit trail Part 4 §4.2 calls authoritative can only
ever record server-authored reasons for human transitions.

**Proposed fix.** Additive optional JSON body on both operations:
`{ "detail": string, "actor": string }`, where `detail` is copied to the
appended history entry and `actor` (optional) overrides the principal
derived from the token for consoles acting on behalf of a named agent.
Existing callers that send no body are unaffected.

## F-ALT-05 — Invalid alert body has no registered problem type

**Where it showed up.** ALT-04. The 400 on `POST /v1/alerts` is
described as "Missing Idempotency-Key or invalid alert", but Part 12
registers only `idempotency-key-required` at 400 for this route. A
closed-enum `severity` violation or a missing `detectionTime` has no
registered `type` to return. Same shape as F-CTL-01.

**Proposed fix.** Register `alert-invalid` (400) — or, if F-CTL-01 lands
as a generic `invalid-request` (400), use that and name it in the 400
description. The generic slug is the smaller change across modules.

## F-ALT-06 — The list cannot be filtered by device or related entity

**Where it showed up.** ALT-10, ALT-12. The list takes `status`,
`severityFloor`, `type`, `place`, `since`. Two routine operator questions
have no query: "everything open on pay station 3" (`source.device`) and
"everything about this session / this subscription" (`relatedEntity`).
Both are answerable only by paging the whole place and filtering
client-side. `Alert.source.device` and `Alert.relatedEntity` are already
first-class fields, so the data exists.

**Proposed fix.** Additive optional query parameters `device` (uuid,
matches `source.device.id`) and `relatedEntity` (uuid, matches
`relatedEntity.id`) on `GET /v1/alerts`. Both optional; existing callers
are unaffected.

## F-ALT-07 — `Alert.id` is readOnly, but the standard expects client-supplied ids

**Where it showed up.** ALT-19. Annex A APX-CORE-03 and Part 4 §4.1 say
client-supplied ids follow the APDS convention and collide with 409
`id-collision`; the `POST /v1/alerts` request body is the `Alert` schema,
in which `id` is `readOnly: true`. OpenAPI 3.1 readOnly means the
property SHOULD NOT be sent in a request. The prose and the schema
disagree, and a strict request validator would reject the very case
APX-CORE-03 describes. The runner does not enforce readOnly on requests,
so this exchange passes; the contradiction is in the spec, not the
scenario.

**Proposed fix.** Either drop `readOnly` from `id` on the resources that
accept client-supplied ids (Alert included) and say in the description
"optional on create; server-assigned when absent", or state in Part 4
§4.1 that APX resources are server-identified and APX-CORE-03's collision
rule applies only to APDS-native routes. The first keeps CORE-03 as
written.

## F-ALT-08 — Place-less alerts and the place grant

**Where it showed up.** ALT-14. `webhookDeliveryFailed` concerns a
Subscription, which has no place, so `source.place` is absent. Part 8
§8.5 answers the eventing side (no binding → deliver only to
subscriptions without a `places` filter, never to a grant that would not
include it). Part 7 and Part 9 say nothing about the REST side: does a
token whose `apx_places` is Lakeside see this alert at all? Is a
place-less alert included in, or excluded from, `GET /v1/alerts?place=…`?
Which grant authorises raising one? Fail-closed (§9.3) would hide it from
every place-scoped token, leaving only an `"*"` grant able to see the one
alert that says the operator's own notifications are broken.

**Proposed fix.** One paragraph in Part 7 §7.1: an alert without a
resolvable place binding is bound to the raising organisation (`apx_org`);
it is visible to tokens of that organisation regardless of `apx_places`,
is excluded from any `place`-filtered list, and may be raised by a token
of that organisation with `apx.alerts:write`.

## F-ALT-09 — Replay after a transition: snapshot or current state?

**Where it showed up.** ALT-02. Part 7 §7.2 and the 200 description say a
same-key, same-body replay "returns the original alert". After the alert
has been acknowledged, "original" could mean the version-1 snapshot the
first 201 returned or the alert as it now stands (version 2,
`acknowledged`). The Control exemplar (CTL-02) reads the same wording as
"current state"; a device that replays for hours during a link outage
would see either a frozen `raised` or the truth depending on the vendor.

**Proposed fix.** Say "returns the alert as it currently stands, with a
200" in §7.2 and in the 200 description; the point of the replay is
dedup, not time travel. Apply the same sentence to `POST /v1/commands`
for consistency.

## Runner issues

1. **Stacked `apx:validate` markers are not supported.** Placing
   `<!-- apx:validate EventEnvelope -->` directly above
   `<!-- apx:validate Alert at /data -->` makes the runner report the
   first as "apx:validate marker without a ```json block": `expect` holds
   one pending check, and the second marker flushes the first as dangling.
   The public scenarios in `apx/docs/scenarios/` stack them freely.
   Worked around by keeping only `Alert at /data` on the nine event
   payloads in `scenarios.md`, so the envelope fields (`id`, `type`,
   `source`, `time`) are not validated by this runner. Fix: collect
   consecutive validate markers into a list and run all of them against
   the next block.
2. **A request-marker `gap=` prints a false "resolved" line.** A gap on an
   `apx:request` marker is evaluated twice with separate contexts: once
   for path/query resolution (`checkRequest`) and once for the body
   (`checkRequestBody`). In ALT-20 the body check fails as intended and is
   listed under known gaps, but the path check on the same marker never
   fails, so the run also prints
   `F-ALT-04 scenarios.md:1765 no longer fails — remove the gap marker`.
   The marker must stay. Fix: settle a request marker's gap once, after
   both checks, or only treat it as resolved when neither context failed.
