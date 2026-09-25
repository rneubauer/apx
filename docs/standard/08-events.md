# APX Part 8 — Delivery Fabric (webhooks + SSE)

The `apx-events` (webhooks) and `apx-events-sse` (SSE) conformance classes.
APDS 4.1 defines `/webhooks` (subscribe/unsubscribe) but leaves the delivery
contract per-project. APX completes it — **as a superset**: a stock APDS
`EventSubscription {endpoint, topics[]}` works unmodified.

## 8.1 Subscriptions (at APDS's own `/webhooks` route)

- `POST /webhooks` — create. Body: `ApxEventSubscription`. Stock APDS bodies
  are valid (transport defaults to `webhook`). Requires
  `apx.subscriptions:manage`.
  **Response negotiation (normative):** the stock APDS 4.1 response
  contract is preserved. A request WITHOUT `Prefer: return=representation`
  (RFC 7240) MUST receive APDS's documented `200`/`202` with
  `ResponseStatus` — a plain APDS client observes pure APDS behavior. An
  APX client sends `Prefer: return=representation` and MUST receive `201`
  with the full subscription including the signing `secret` when
  `transport` is `webhook`, returned exactly once, in that response only.
  An SSE subscription has nothing to sign and gets no secret. The stock
  `200`/`202` `ResponseStatus` MUST carry the new subscription's id as
  the single entry of `ids[]`, so a stock client can later revoke it.
  **Idempotency.** `POST /webhooks` takes the optional `Idempotency-Key`
  (Part 4 §4.2a). A replay with the same body returns the same status
  with the subscription as it now stands — never the secret a second
  time (rotate it if the first response was lost); the same key with a
  different body is 409 `idempotency-conflict`.
  **Refusals at creation and update.** A topic the credential could not
  read synchronously MUST be refused with 403 `insufficient-scope`,
  naming the topic and the missing scope in `detail` (Part 9 §9.6(4)); the
  read scope of a topic is the scope of the read route of its data
  schema (e.g. `apx.lpr:read` for `apx.data.observation.created.v1`). A
  `filters.places` entry outside the token's `apx_places` grant MUST be
  refused with 403 `insufficient-grant`, and a token with no `apx_places`
  claim cannot create a place-filtered subscription. A webhook-transport
  subscription without `endpoint`, an empty `topics[]`, a secret under 32
  bytes of entropy, or a malformed `extensions` key is 400
  `invalid-request` with an `errors[]` pointer; an unregistered topic is
  400 `unknown-topic`.
- `GET /webhooks/{id}` — read one subscription (APX additive operation).
  Secrets are never returned.
- `PATCH /webhooks/{id}` — update (APX additive operation). The body is a
  JSON Merge Patch (RFC 7396) over the subscription
  (`ApxEventSubscriptionPatch`): members present replace the stored
  value, absent members are unchanged, so `{"status": "active"}` alone
  resumes a subscription. The precondition is `If-Match` or the body
  `version`; a stale one is 409 `version-conflict` (Part 4 §4.2a).
- `DELETE /webhooks/{id}` — revoke (native APDS operation).
- `GET /webhooks` — list (APX additive operation).
- `GET /webhooks/{id}/deliveries` — the delivery ledger (§8.3), filterable
  by `status`, `eventId`, and `since`.
- `topics[]` mixes APDS `EventTypeEnum` values and APX topics freely.

**Subscription states.** `active` delivers. `paused` (client-set) holds
matching events for up to 24 hours and delivers them in order on resume;
an event older than 24 hours when the subscription resumes is dropped,
and a held event has no ledger record until its first attempt. `failed`
is server-assigned when the retry schedule is exhausted (§8.3); a client
PATCH setting `status: failed` is 400 `invalid-request`. While `failed`,
the subscription MUST accept a PATCH only when the body sets `status:
active` (which also resets the retry state); every other PATCH, and the
SSE stream, MUST answer 410 `subscription-failed`. `GET` of the
subscription, its ledger, and `DELETE` remain available in every state.

**Key rotation (Part 9 §9.4).** A PATCH carrying `secret` or `secretRef`
starts a rotation: the new key joins `activeKeyIds` and signs every
delivery from then on, and deliveries carry `APX-Key-Id`. The client MAY
name the new key with `keyId` (else the server assigns one). The overlap
ends when the client PATCHes `retireKeyIds` naming the old key, or
automatically 24 hours after the rotation. Retiring the last active key
is 400 `invalid-request`.

## 8.2 The envelope

Every delivery carries exactly one `EventEnvelope` (Part 4 conventions;
CloudEvents-aligned). For APDS EventTypeEnum topics, `data` is the APDS
`EventData` shape and `subject` references the changed entity.

## 8.3 Webhook delivery (normative)

- HTTP POST of the envelope JSON to the subscription endpoint.
- Headers: `APX-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + body)>`,
  `APX-Timestamp` (RFC 3339), `APX-Delivery-Id` (UUID, new per attempt),
  `APX-Key-Id` (REQUIRED during secret-rotation overlap windows, else
  optional — Part 9 §9.4), `Content-Type: application/json`.
- **Every attempt is signed independently.** `APX-Timestamp` is the time
  of that attempt and `APX-Signature` is computed over it and the
  unchanged body. The body — and with it the envelope `id` and `time` —
  is byte-identical across attempts. (A retry that reused the first
  attempt's timestamp would fall outside the receiver's window after five
  minutes, and the subscription would fail for a reason that has nothing
  to do with the endpoint.)
- Receivers MUST verify the signature and reject deliveries outside a
  ±5 minute timestamp window.
- Success = any 2xx response. Anything else triggers the retry schedule:
  **0s, 30s, 2m, 10m, 1h, then hourly up to 24h total.** The values are
  *delays between consecutive attempts*: the first attempt is sent at
  once, the second 30 s after the first fails, the third 2 min after the
  second, the fourth 10 min after that, the fifth 1 h after that, and
  then one attempt an hour for as long as the next attempt would fall
  within 24 hours of the first — 27 attempts, the last 23 h 12 min 30 s
  after the first. When the last attempt fails the subscription
  transitions to `failed`, an `apx.subscription.failed.v1` event (data:
  `SubscriptionFailure`) is published to the organisation's other
  subscriptions that list the topic — never to the failed one — and
  (where `apx-alerts` is implemented) a `webhookDeliveryFailed` alert is
  raised.
- The event `id` is stable across retries (receiver-side dedup key);
  `APX-Delivery-Id` is unique per attempt.
- **The ledger records attempts.** `GET /webhooks/{id}/deliveries` holds
  one `DeliveryRecord` per (event, subscription): the attempt count, the
  status, the latest attempt's `deliveryId`/`lastCode`/`time`, and
  `attemptHistory[]` — every attempt's `APX-Delivery-Id`, time (which is
  its `APX-Timestamp`), and HTTP code, so a receiver and a publisher
  disputing a retry share one record.
- Ordering is best-effort per subscription; receivers MUST NOT assume
  cross-topic ordering. The data-profile cursor (Part 5) is the
  exactly-once path.

## 8.4 SSE (optional class `apx-events-sse`)

- `GET /v1/events/stream?subscription={id}` with `Accept:
  text/event-stream`, authenticated like any APX call. The subscription
  MUST have `transport: sse`.
- **Frame grammar (normative).** One event per frame: an `id:` line
  carrying a monotonically increasing per-subscription sequence (a
  decimal integer), exactly one `data:` line carrying the EventEnvelope
  JSON on a single line, and a blank line. Servers MAY send `retry:`
  lines and comment lines (`: keep-alive`); they carry no events.
- Reconnection with `Last-Event-ID` resumes strictly after that sequence;
  servers MUST buffer at least 1000 events or 15 minutes per subscription.
  When `Last-Event-ID` is older than the oldest buffered frame the server
  MUST answer 410 `stream-position-expired` rather than resume with a
  silent gap; the client re-syncs through the Part 5 change feed and
  reconnects without `Last-Event-ID`.
- Checks run in this order: the subscription exists and is visible (else
  404 `target-not-found`); its `transport` is `sse` (else 404
  `target-not-found` — there is no stream for it); it is not `failed`
  (else 410 `subscription-failed`); then the `Last-Event-ID` position.
- Exists for consumers that cannot expose an inbound endpoint (NAT'd PARCS,
  kiosks).

## 8.5 Place binding and filtering (normative)

Subscription `filters.places` and per-site analytics both require every
event to be attributable to a location. The binding rule, per topic:

1. An event is **bound to a place** by, in order of precedence: (a) a
   `place` field in `data` (e.g. OccupancySnapshot, PaymentRecord);
   (b) a `source.place` field in `data` (Alerts); (c) `subject` when it
   references a HierarchyElement; (d) the place that inventories the
   subject device (`SupplementalEquipment`) or contains the subject
   entity (e.g. a Session's `hierarchyElement`).
2. Publishers MUST populate at least one of these bindings on every event
   whose topic concerns a physical location. In particular:
   `apx.accounts.payment.recorded.v1` data carries the (required)
   `PaymentRecord.place`; `apx.data.observation.created.v1` publishers
   MUST populate the `ObservationElement`'s `elementIds` with the
   observing lane or place.
3. `filters.places` matches an event when its bound place is inside any
   granted subtree. An event with NO resolvable place binding matches only
   subscriptions without a `places` filter, and MUST NOT be delivered to a
   subscriber whose `apx_places` grant would not include it — when in
   doubt, drop rather than leak (Part 9 §9.3).
4. A subscription whose `filters.places` names an element outside the
   token's `apx_places` grant is refused at creation or update with 403
   `insufficient-grant` (§8.1); the filter can narrow the grant, never
   widen it.

## 8.6 Publishing obligations

Implementations claiming `apx-events` MUST publish the APDS EventTypeEnum
topics for every entity class they serve writes for, and the APX topics of
every other conformance class they claim (registry `apx-topics`).

## 8.7 Topic data schemas (normative)

Every topic names the schema its `data` validates against; publishers MAY
set the envelope's `dataschema` to it. Most APX topics carry the
resource of their own domain (registry `apx-topics`). The ones whose
data lives elsewhere, and the APDS topics, are also declared as typed
entries of the OpenAPI `webhooks` object, so the bundle carries their
schemas:

| Topic | `data` | `subject` |
|---|---|---|
| APDS `EventTypeEnum` values (`SessionCreated`, …) | APDS `EventData` (the entity; for `*Deleted`, its last state) | the entity |
| `apx.subscription.failed.v1` | `SubscriptionFailure` (subscription Reference with `className` `ApxEventSubscription`, `endpoint`, `failedTime`, `firstFailedEventId`, `attempts`, `lastCode`) | the subscription |
| `apx.data.observation.created.v1` | APDS `ObservationElement` — one event per element, so an ingested `ObservationSet` yields one event per read | the element (`className` `ObservationElement`) |
| `apx.reservation.noshow.v1` | `ReservationSummary` | the AssignedRight |
| `apx.data.occupancy.v1` | `OccupancySnapshot` | the HierarchyElement |
