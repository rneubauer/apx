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
  with the full subscription including the signing `secret`, returned
  exactly once, in that response only.
- `DELETE /webhooks/{id}` — revoke (native APDS operation).
- `GET /webhooks`, `PATCH /webhooks/{id}` — APX additive operations (list,
  update topics/filters/status, rotate secret).
- `GET /webhooks/{id}/deliveries` — the delivery ledger.
- `topics[]` mixes APDS `EventTypeEnum` values and APX topics freely.

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
- Receivers MUST verify the signature and reject deliveries outside a
  ±5 minute timestamp window.
- Success = any 2xx response. Anything else triggers the retry schedule:
  **0s, 30s, 2m, 10m, 1h, then hourly up to 24h total.** After exhaustion
  the subscription transitions to `failed`, an
  `apx.subscription.failed.v1` event is published, and (where `apx-alerts`
  is implemented) a `webhookDeliveryFailed` alert is raised.
- The event `id` is stable across retries (receiver-side dedup key);
  `APX-Delivery-Id` is unique per attempt.
- Ordering is best-effort per subscription; receivers MUST NOT assume
  cross-topic ordering. The data-profile cursor (Part 5) is the
  exactly-once path.

## 8.4 SSE (optional class `apx-events-sse`)

- `GET /v1/events/stream?subscription={id}` with `Accept:
  text/event-stream`, authenticated like any APX call. The subscription
  MUST have `transport: sse`.
- Each event: `id:` = a monotonically increasing per-subscription sequence,
  `data:` = the EventEnvelope JSON.
- Reconnection with `Last-Event-ID` resumes strictly after that sequence;
  servers MUST buffer at least 1000 events or 15 minutes per subscription.
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
   MUST populate the Observation's element binding.
3. `filters.places` matches an event when its bound place is inside any
   granted subtree. An event with NO resolvable place binding matches only
   subscriptions without a `places` filter, and MUST NOT be delivered to a
   subscriber whose `apx_places` grant would not include it — when in
   doubt, drop rather than leak (Part 9 §9.3).

## 8.6 Publishing obligations

Implementations claiming `apx-events` MUST publish the APDS EventTypeEnum
topics for every entity class they serve writes for, and the APX topics of
every other conformance class they claim (registry `apx-topics`).
