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

## 7.2 Endpoints

- `POST /v1/alerts` — raise. **`Idempotency-Key` header REQUIRED**
  (device retry storms must not duplicate alerts): replaying the same key
  with the same body returns the original alert; the same key with a
  different body is `409 idempotency-conflict`. Scope `apx.alerts:write`.
- `GET /v1/alerts` — filters: `status`, `severityFloor`, `type`,
  `place` (subtree), `since` (detectionTime ≥). Scope `apx.alerts:read`.
- `GET /v1/alerts/{id}`.
- `POST /v1/alerts/{id}/acknowledge` and `/resolve` — lifecycle
  transitions (scope `apx.alerts:write`). Illegal transitions (e.g.
  resolving a resolved alert) are `409`.

## 7.3 Lifecycle

`raised → acknowledged → resolved` (normal path); `raised → resolved`
(direct) is permitted; `expired` is a server-side terminal state for alerts
with a validity window. Terminal states never transition again.

## 7.4 Eventing

- `apx.alert.raised.v1` on creation; `apx.alert.status.v1` on every
  transition. Event `data` is the Alert; `subject` references it.
- Subscription `filters.severityFloor` applies to alert topics (Part 8).
- Self-referential rule: a `webhookDeliveryFailed` alert MUST NOT itself
  generate webhook deliveries to the failed subscription.
