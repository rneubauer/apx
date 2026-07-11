# APX Part 8 — Delivery Fabric (webhooks + SSE)

The `apx-events` (webhooks) and `apx-events-sse` (SSE) conformance classes.
APDS 4.1 defines `/webhooks` (subscribe/unsubscribe) but leaves the delivery
contract per-project. APX completes it — **as a superset**: a stock APDS
`EventSubscription {endpoint, topics[]}` works unmodified.

## 8.1 Subscriptions (at APDS's own `/webhooks` route)

- `POST /webhooks` — create. Body: `ApxEventSubscription`. Stock APDS bodies
  are valid (transport defaults to `webhook`; a signing `secret` is
  generated and returned once). Requires `apx.subscriptions:manage`.
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
  `Content-Type: application/json`.
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

- `GET /apx/v1/events/stream?subscription={id}` with `Accept:
  text/event-stream`, authenticated like any APX call. The subscription
  MUST have `transport: sse`.
- Each event: `id:` = a monotonically increasing per-subscription sequence,
  `data:` = the EventEnvelope JSON.
- Reconnection with `Last-Event-ID` resumes strictly after that sequence;
  servers MUST buffer at least 1000 events or 15 minutes per subscription.
- Exists for consumers that cannot expose an inbound endpoint (NAT'd PARCS,
  kiosks).

## 8.5 Publishing obligations

Implementations claiming `apx-events` MUST publish the APDS EventTypeEnum
topics for every entity class they serve writes for, and the APX topics of
every other conformance class they claim (registry `apx-topics`).
