# APX Part 7 — Alerts

The `apx-alerts` conformance class. APDS has no alert, event, or
notification classes — this domain is net-new, built on APX common
conventions and delivered over the Part 8 fabric.

## 7.1 The Alert resource

See the `Alert` schema. Key rules:

- `alertType` is OPEN — values come from the `apx-alert-types` registry or
  an implementer's own UserDefinedCodeList (Part 11). `severity` is CLOSED
  (`info < warning < minor < major < critical`).
- `occurrenceTime` (when it happened) vs `detectionTime` (when the system
  learned of it) — both RFC 3339; detectionTime is required.
- `source.place` carries a HierarchyElement UUID; filtering by place is
  **subtree-inclusive** (an alert on a lane matches its parent Place).
- `statusHistory[]` is the immutable audit trail; every transition appends.
- `id` is server-assigned when the raise carries none. A client MAY supply
  its own UUID on raise (Part 4 §4.1; the schema's `readOnly` marks the
  server's authority over the value, not a prohibition on this case); an id
  that already exists is `409 id-collision`, distinct from
  `idempotency-conflict`.
- **Alerts with no place binding (normative).** An alert whose subject has
  no place (a `webhookDeliveryFailed` alert about a Subscription) carries
  no `source.place` and is bound to the organisation that owns its
  subject, or that raised it (`apx_org`). It is visible to every token of
  that organisation holding `apx.alerts:read`, whatever its `apx_places`,
  is excluded from any `place`-filtered list, and may be raised by a token
  of that organisation with `apx.alerts:write` (Part 9 §9.3a rule 3). Tokens
  of other organisations never see it.

## 7.2 Endpoints

- `POST /v1/alerts` — raise. **`Idempotency-Key` header REQUIRED**
  (device retry storms must not duplicate alerts): replaying the same key
  with the same body returns the alert as it currently stands (`200`, Part 4
  §4.2a) — a replay after an acknowledgement shows `acknowledged`, since the
  point of the replay is deduplication; the same key with a different body
  is `409 idempotency-conflict`. A body that fails the schema is
  `400 invalid-request`. Scope `apx.alerts:write`.
- `GET /v1/alerts` — filters: `status`, `severityFloor`, `type`,
  `place` (subtree), `device` (matches `source.device.id`),
  `relatedEntity` (matches `relatedEntity.id`), `since` (detectionTime ≥).
  Scope `apx.alerts:read`.
- `GET /v1/alerts/{id}`.
- `POST /v1/alerts/{id}/acknowledge` and `/resolve` — lifecycle
  transitions (scope `apx.alerts:write`). Illegal transitions (e.g.
  resolving a resolved alert) are `409 alert-transition-illegal`. Both take
  an optional `AlertTransition` body: `detail` is copied into the history
  entry the transition appends, and `agent` (the human or AI principal
  acting through the client, as `Command.agent`) is recorded as that
  entry's `actor` in place of the token's principal. A request with no body
  behaves exactly as before.

## 7.3 Lifecycle

`raised → acknowledged → resolved` (normal path); `raised → resolved`
(direct) is permitted; `expired` is a server-side terminal state for alerts
with an `expiryTime`. A client MAY set `expiryTime` on raise; when it does
not, the server MAY apply a default by policy per `alertType` and returns
the value applied, so every open alert shows when it will lapse. An alert
still `raised` or `acknowledged` at its `expiryTime` transitions to
`expired` and publishes `apx.alert.status.v1`; an alert without one never
expires. Terminal states (`resolved`, `expired`) never transition again.

## 7.4 Eventing

- `apx.alert.raised.v1` on creation; `apx.alert.status.v1` on every
  transition. Event `data` is the Alert; `subject` references it.
- Subscription `filters.severityFloor` applies to alert topics (Part 8).
- Self-referential rule: a `webhookDeliveryFailed` alert MUST NOT itself
  generate webhook deliveries to the failed subscription.
