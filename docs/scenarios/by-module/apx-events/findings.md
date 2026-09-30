# Findings — apx-events / apx-events-sse

Each entry is something a scenario in `scenarios.md` needed that
the public spec (`apx` at v0.10.0) does not define, or defines
ambiguously. IDs are stable; scenarios cite them in `gap=F-EVT-NN`
markers so the runner reports them as known gaps rather than failures,
and reports them as resolved once the spec is fixed. Fixes land in the
spec as ordinary additive PRs.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-EVT-01 | events | low | Body-shape errors on `POST /webhooks` (no endpoint, empty topics, bad extension key) have no registered problem type; only `unknown-topic` is | fixed — `invalid-request` (registered in 4417f2f) named in the POST 400; PATCH declares 400 |
| F-EVT-02 | events | low | 401/403/429 undeclared on `POST /webhooks`, `PATCH`, `DELETE`; `insufficient-grant` for `filters.places` outside the grant never mentioned | fixed — 401/403/429 declared (4417f2f); §8.1 and §8.5 rule 4 make out-of-grant `filters.places` 403 `insufficient-grant` |
| F-EVT-03 | events | low | No problem type for 401 (same defect as F-CTL-07) | fixed — `unauthenticated` registered in 4417f2f |
| F-EVT-04 | events | medium | `DeliveryRecord` has no per-attempt history: the retry schedule and per-attempt `APX-Delivery-Id` are unobservable; schedule wording ambiguous; ledger has no filters | fixed — `DeliveryRecord.attemptHistory[]`; schedule values are delays (27 attempts, §8.3); ledger filters status/eventId/since |
| F-EVT-05 | events | medium | `apx.subscription.failed.v1` has no data schema and no `className` for the subscription reference | fixed — `SubscriptionFailure` schema + webhook entry + §8.7 (registry text: integrator) |
| F-EVT-06 | events | low | `apx.reservation.noshow.v1` names no data schema; `ReservationSummary` fits | fixed — §8.7 + webhook entry name `ReservationSummary` (registry text: integrator) |
| F-EVT-07 | events | medium | `apx.data.observation.created.v1` says data is "the APDS Observation"; APDS 4.1 defines `ObservationSet`/`ObservationElement`, no `Observation` | fixed — data is `ObservationElement`, `elementIds` MUST (§8.5, §8.7, webhook entry; registry text: integrator) |
| F-EVT-08 | events | medium | `PATCH /webhooks/{id}` declares no 410; which operations a `failed` subscription refuses, and 404-vs-410 precedence on the stream, are unstated | fixed — 410 on PATCH; §8.1 failed-state rules; stream checks transport before status (§8.4) |
| F-EVT-09 | events | medium | Secret rotation: no way to retire the old key or name key ids; weak secret has no error shape (PATCH declares no 400, no slug) | fixed — `keyId`, writeOnly `retireKeyIds`, 24 h default overlap; weak secret is 400 `invalid-request` (no new slug) |
| F-EVT-10 | events | medium | No `GET /webhooks/{id}` | fixed — `GET /webhooks/{id}` added |
| F-EVT-11 | events | medium | `PATCH` takes the full schema (`topics` required, so status-only bodies are invalid); no 409 `version-conflict`; `POST /webhooks` takes no `Idempotency-Key` | fixed — PATCH body is a merge patch (`ApxEventSubscriptionPatch`), `If-Match` + 409; POST takes `Idempotency-Key` + 409 |
| F-EVT-12 | events | low | `paused` semantics (queue vs drop) undefined; client-set `failed` has no refusal shape | fixed — paused holds events 24 h and delivers on resume; client-set `failed` is 400 `invalid-request` (no new slug) |
| F-EVT-13 | events-sse | medium | `Last-Event-ID` older than the buffer: behaviour undefined, no loss signal to the client | fixed (pending registration) — 410 `stream-position-expired` (§8.4); slug needs a Part 12 row, gap marker kept until then |
| F-EVT-14 | events | high | Retries must be re-signed with a fresh `APX-Timestamp`; unstated, and without it the ±5-minute window rejects every retry after the first five minutes | fixed — §8.3 re-signing rule, APX-EVT-04, webhook description |
| F-EVT-15 | events | low | Part 9 §9.6(4) purpose limitation on subscriptions has no status, slug, or declared response | fixed — §8.1: 403 `insufficient-scope` at creation/update (Part 9 §9.6(4) mirror sentence: integrator) |
| F-EVT-16 | events-sse | low | SSE nits: stream response is a bare `string`; SSE subscriptions are promised a secret they cannot use; wrong-transport 404 has no fitting slug | fixed — frame grammar in §8.4 and the stream op; secret only for webhook transport; wrong transport stays 404 `target-not-found` |
| F-EVT-17 | events | low | Stock 200/202 `ResponseStatus` carries the new subscription id only if the server chooses to put it in `ids[]` | fixed — §8.1 MUST: new id is the single `ids[]` entry (upstream suggestion, not an erratum) |

---

## F-EVT-01 — Body-shape errors on subscribe have one registered slug

**Where it showed up.** EVT-03, EVT-18. The 400 on `POST /webhooks` is
described as "Missing/unknown topics or endpoint", but Part 12 registers
only `unknown-topic` at 400. A webhook-transport subscription without an
`endpoint`, an empty `topics[]`, or an `extensions` key that breaks the
§4.3 pattern all have to be refused, and the server has no registered
`type` to return. `PATCH /webhooks/{id}` declares no 400 at all.

**Proposed fix.** Register `endpoint-required` (400, "transport webhook
without endpoint") and a generic `invalid-request` (400, "request body
fails schema validation") in Part 12 §12.2; declare 400 on `PATCH
/webhooks/{id}`. F-CTL-01 proposes the same generic slug for Control; one
registration serves both.

## F-EVT-02 — Auth and throttling responses declared on the reads only

**Where it showed up.** EVT-11, EVT-12. `GET /webhooks`,
`GET /webhooks/{id}/deliveries`, and `GET /v1/events/stream` declare
401/403/429 through the shared components; `POST /webhooks`,
`PATCH /webhooks/{id}`, and `DELETE /webhooks/{id}` declare none. Every
one is a secured operation. The place-grant case is worse than
undeclared: nothing in Part 8 or Part 9 says that `filters.places`
naming a subtree outside `apx_places` is refused with
`insufficient-grant`, although §9.3 makes any "place-targeting request"
fail that way and §8.5 forbids ever delivering beyond the grant.

**Proposed fix.** Declare 401/403/429 on the three mutating operations
via the shared components (the Spectral rule F-CTL-08 proposes would
catch this). Add one sentence to §8.5: "A subscription whose
`filters.places` names an element outside the token's `apx_places` MUST
be refused with `insufficient-grant`; a token with no `apx_places` claim
cannot create a place-filtered subscription."

## F-EVT-03 — No problem type for 401

**Where it showed up.** EVT-12. Same as F-CTL-07: the shared
`Unauthorized` response is `application/problem+json` and Part 12
registers nothing at 401.

**Proposed fix.** Register `unauthenticated` (401) in Part 12 §12.2, as
F-CTL-07 proposes.

## F-EVT-04 — The ledger records outcomes, not attempts

**Where it showed up.** EVT-05, EVT-06, EVT-23. `DeliveryRecord` holds
`attempts` (a count), one `deliveryId`, one `lastCode`, and one `time`.
APX-EVT-03 and APX-EVT-04 are about the sequence of attempts — their
times on the normative schedule and the per-attempt `APX-Delivery-Id`
values — and none of that is observable through the API; a receiver
disputing "you never retried" and a server saying "we did, 25 times" have
no shared record. Two smaller things surfaced alongside: the schedule
text "0s, 30s, 2m, 10m, 1h, then hourly up to 24h" reads either as
intervals between attempts or as offsets from the first one (the two
give different attempt times), and the ledger takes only `page`, so an
operator cannot ask for `status=retrying` or the history of one
`eventId`.

**Proposed fix.** Additive optional `attemptHistory[]` on
`DeliveryRecord`, each entry `{deliveryId, time, code}`, with
`deliveryId` at the top level documented as the latest attempt's id. Say
in §8.3 that the schedule values are delays between consecutive attempts.
Add optional `status`, `eventId`, and `since` query parameters to
`GET /webhooks/{id}/deliveries`.

## F-EVT-05 — The self-referential event has no schema

**Where it showed up.** EVT-06. The registry entry for
`apx.subscription.failed.v1` says "data: subscription reference" and
nothing else. What an operator needs on that event — which endpoint, when
it failed, the first event that could not be delivered, how many attempts,
the last code — has no home, and the `className` to use in the reference
(`ApxEventSubscription`, or APDS's `EventSubscription`) is not stated.

**Proposed fix.** Add a `SubscriptionFailure` schema to the events
domain: `subscription` (Reference, className `ApxEventSubscription`),
`endpoint`, `failedTime`, `firstFailedEventId`, `attempts`, `lastCode`;
name it in the registry entry and in §8.3.

## F-EVT-06 — No-show event data is described in prose only

**Where it showed up.** EVT-21. The registry says "AssignedRight
reference + reservation state"; Part 14 §14.1 says only that the topic is
published. The bundle's `EventEnvelope` example shows
`{reservation, reservationState, plannedStart}`, which is exactly the
existing `ReservationSummary` schema, but nothing says so.

**Proposed fix.** In the registry entry and Part 14 §14.1, state "data:
`ReservationSummary`" and set `dataschema` accordingly in the example.

## F-EVT-07 — "The APDS Observation" is not an APDS 4.1 schema

**Where it showed up.** EVT-22. Part 13 §13.3 and the registry say the
observation event's data is "the APDS Observation" and that `subject`
references it. APDS 4.1 defines `ObservationSet` (a batch with
`observationElements[]`) and `ObservationElement` (one read); there is no
`Observation`. A publisher could send either, and the two are not
interchangeable for a consumer. The scenario used `ObservationElement`,
whose `elementIds` is the natural carrier for the §8.5 element binding.

**Proposed fix.** State in §13.3 and the registry: "data:
`ObservationElement`; `subject.className` `ObservationElement`; publishers
MUST populate `elementIds` with the observing lane or place." If a batch
form is wanted, register a separate topic for `ObservationSet`.

## F-EVT-08 — What a failed subscription refuses is not written down

**Where it showed up.** EVT-07. Part 12 registers `subscription-failed`
(410) as "Operation on a subscription in `failed` state", but only
`GET /v1/events/stream` declares it. `PATCH /webhooks/{id}` declares
200/404 only, and yet the schema says "PATCH status=active to resume" —
so at least one PATCH must succeed on a failed subscription while (the
scenario assumed) others are refused. Also unstated: a webhook-transport
subscription that is `failed` hits both the stream's 404 ("transport is
not sse") and its 410; which wins is a coin toss.

**Proposed fix.** In §8.3: "While `failed`, a subscription accepts
`PATCH` only when the body sets `status: active` (which also resets the
retry state); every other write, and the SSE stream, MUST answer 410
`subscription-failed`. The ledger remains readable." Declare 410 on
`PATCH /webhooks/{id}`. State that transport is checked before status on
the stream.

## F-EVT-09 — Rotation starts an overlap it cannot end

**Where it showed up.** EVT-08. PATCHing a new `secret` (or `secretRef`)
adds a second entry to `activeKeyIds` and every delivery carries
`APX-Key-Id`; §9.4 says the overlap lasts "until the old one is retired".
There is no operation or field that retires it: the client cannot say
"drop `k-2026-09-24-a`", cannot choose the id it will see in
`APX-Key-Id`, and cannot tell how long the server will keep the old key.
Separately, §9.4 makes 32 bytes of entropy a MUST, but a shorter
client-supplied secret has no error shape — PATCH declares no 400 and no
slug exists.

**Proposed fix.** Additive `retireKeyIds[]` (writeOnly) on
`ApxEventSubscription`, honoured by PATCH, plus an optional `keyId` the
client may supply alongside `secret`/`secretRef`; document a default
overlap (say 24 h) after which the server retires the old key on its own.
Register `secret-too-weak` (400) and declare 400 on PATCH (see F-EVT-01).

## F-EVT-10 — A subscription cannot be read by id

**Where it showed up.** EVT-17. `GET /webhooks` lists everything the
caller may see; `PATCH` returns the updated resource; but there is no
`GET /webhooks/{id}`. A dashboard that holds an id from a 201 or from
`ResponseStatus.ids[]` has to page through the list to find its status
or `activeKeyIds`. The runner cannot even validate the exchange the
scenario wanted, because the operation does not exist.

**Proposed fix.** Additive `GET /webhooks/{id}` (tag Subscription, scope
`apx.subscriptions:manage`, 200 `ApxEventSubscription` without secret,
404 `target-not-found`, plus the shared 401/403/429).

## F-EVT-11 — Updates are full-body, unversioned, and creates are not idempotent

**Where it showed up.** EVT-07, EVT-15. Three related gaps on the write
side. (1) `PATCH /webhooks/{id}` takes `ApxEventSubscription`, whose
`topics` is required, so the status-only body the schema itself
describes ("PATCH status=active to resume") does not validate; a client
must resend its topic list to resume, rotate a secret, or pause. (2) The
resource carries `version` and APX-CORE-03 / APX-DATA-02 make a stale
version a `version-conflict`, but PATCH declares no 409 and Part 8 never
mentions optimistic concurrency for subscriptions. (3) `POST /webhooks`
takes no `Idempotency-Key`, unlike every other APX create; a create
retried after a lost response makes a second subscription and doubles
every delivery.

**Proposed fix.** Define PATCH as JSON Merge Patch (RFC 7396) over
`ApxEventSubscription` with no required members in the request; declare
409 `version-conflict` when the body carries a `version` that is stale;
add an optional `Idempotency-Key` header to `POST /webhooks` with the
Part 12 replay/conflict semantics (optional, so stock APDS clients are
unaffected).

## F-EVT-12 — Paused means what, exactly

**Where it showed up.** EVT-16. `status: paused` exists in the enum and
nowhere else. Whether events published during a pause are queued and
delivered on resume (with the ledger showing them as `retrying`) or
dropped (never attempted) is undefined; the two behaviours are opposite
for a consumer that pauses to deploy. Also undefined: what a client gets
for setting `status: failed`, a server-assigned state.

**Proposed fix.** In §8.1: "While `paused`, matching events are retained
for up to 24 hours and delivered in order on resume; the ledger shows
them as `retrying` with `attempts: 0`" — or the drop rule, but pick one.
Say that `failed` is server-assigned and a client PATCH setting it is
refused with 409 `subscription-transition-illegal` (register it).

## F-EVT-13 — Resuming past the buffer is silent

**Where it showed up.** EVT-14. §8.4 requires a buffer of at least 1000
events or 15 minutes and says `Last-Event-ID` resumes strictly after that
sequence. It does not say what happens when the sequence is older than
the buffer. A server may start from the oldest frame it has, start from
"now", or refuse; in the first two the client has no way to learn that a
gap exists, which defeats the point of resume.

**Proposed fix.** Additive: when `Last-Event-ID` is older than the
buffer, the server MUST either answer 410 with a new problem type
`stream-position-expired` (client should re-sync via the Part 5 change
feed) or open the stream with a first comment frame
`: resumed-from <oldest-seq> gap-after <last-event-id>` before the first
event. The 410 is simpler and matches the existing 410 on the route.

## F-EVT-14 — Retries and the replay window contradict each other unless retries are re-signed

**Where it showed up.** EVT-23. §8.3 and §9.4 make receivers reject
deliveries whose `APX-Timestamp` is more than five minutes from local
time, and the same section schedules retries at 10 minutes, 1 hour, and
hourly for a day. If `APX-Timestamp` is the event's time or the first
attempt's time, every retry after the 2-minute one is rejected by a
conforming receiver, and the subscription fails for a reason that has
nothing to do with the endpoint. The only workable reading is that each
attempt sets `APX-Timestamp` to the attempt time and recomputes the
signature, keeping the body (and the envelope `id`) unchanged — but the
standard does not say it.

**Proposed fix.** In §8.3, after the header list: "Each attempt is signed
independently: `APX-Timestamp` is the time of that attempt and
`APX-Signature` is computed over it and the unchanged body. The envelope
`time` and `id` do not change across attempts." Add the sentence to
APX-EVT-04's wording in Annex A.

## F-EVT-15 — Purpose limitation on subscriptions has no shape

**Where it showed up.** EVT-12. Part 9 §9.6(4): "a subscription MUST NOT
deliver a topic the credential could not read synchronously." Whether the
server refuses at creation (which status, which slug) or accepts and
silently filters is unstated; the scenario chose 403 `insufficient-scope`
at creation, which is undeclared on `POST /webhooks` (F-EVT-02).

**Proposed fix.** In §9.6(4) add: "Implementations MUST refuse such a
subscription at creation or update with 403 `insufficient-scope`, naming
the topic and the missing scope in `detail`." List the plate-bearing
topics and their required scopes in Part 8 §8.6 or the registry.

## F-EVT-16 — SSE loose ends

**Where it showed up.** EVT-13, EVT-14. Three small things. The stream's
200 is declared as `text/event-stream` with schema `type: string`, so the
frame format (`id:` = sequence, `data:` = envelope JSON, one event per
frame) exists only in prose and no tool can check an example. §8.1 says
the 201 "MUST" include the signing secret, but an SSE subscription has
nothing to sign, so a conforming server generates and discloses a secret
nobody will use. The 404 for "subscription transport is not sse" has no
fitting slug — `target-not-found` is a stretch for a subscription that
does exist.

**Proposed fix.** Describe the frame grammar normatively in §8.4 (and
note that `retry:` MAY be sent). In §8.1, "including the signing secret
when `transport` is `webhook`". Register `transport-mismatch` (404) or
reuse 409 with a new slug; either is fine, one should be named.

## F-EVT-17 — The stock response and the subscription id

**Where it showed up.** EVT-01. A stock APDS client receives 200/202
`ResponseStatus`, whose only slot for an identifier is the optional
`ids[]` ("list of conflicting/missing ids"). The client needs the id to
call `DELETE /webhooks/{id}`, which is a native APDS operation. Nothing
in APDS 4.1 or Part 8 says the server puts the new id there; a stock
client on a server that does not has no way to revoke.

**Proposed fix.** In §8.1: "The stock 200/202 `ResponseStatus` MUST carry
the new subscription's id as the single entry of `ids[]`." (Upstream
APDS: the same sentence belongs in the `/webhooks` description; worth
raising with the APDS committee, since it affects every APDS server, not
only APX ones.)

## Runner issues

Two behaviours of the 23:24 revision of `run.mjs` bit this module and
were fixed in the 23:42 revision while the file was being written; they
are recorded here only so the history of the scenario file makes sense.
(1) Stacked `apx:validate` markers over one block (the form the task and
public scenario 03 use) were rejected — each marker flushed the previous
one as "marker without a ```json block" — so the first draft repeated
every envelope block; the current runner stacks them and the duplicates
have been collapsed. (2) A `gap=` on a request marker was settled twice
(path check, then body check), so EVT-07's status-only `PATCH`
(`gap=F-EVT-11`, which fails only on the body) was printed both as a
known gap and as "no longer fails — remove the gap marker"; the current
runner settles the request once and the false "resolved" line is gone.

One limitation remains and is not a bug. **An `apx:request` for an
operation that does not exist cannot be followed by an `apx:response`.**
With `gap=F-EVT-10` on `GET /webhooks/{id}` the request is correctly
reported as a gap, but any `apx:response` after it fails hard
("apx:response without a preceding apx:request") with no gap
attribution. EVT-17 shows the intended response as an unannotated block
instead, so nobody should expect that response to be validated.
