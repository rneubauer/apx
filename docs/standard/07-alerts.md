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
- **Evidence other than the subject.** When what an operator acts on and
  the evidence for the alert are different entities, `relatedEntity` is
  the entity acted on (for example a Session) and the evidence rides the
  alert's `extensions` under `apds-ext:apx:alert-evidence@1.0` as
  `{ "observations": [Reference, …] }` (for example the LPR reads behind
  it).
- **The call behind the alert.** An alert raised from a customer contact
  (a receipt or refund request, a citation inquiry, reported damage, a
  callback promised, §7.7) carries `supportInteraction`, a Reference to
  the Part 17 §17.6 record of that call, so the site case and the call
  record point at each other and the §17.7 correlation chain reaches the
  alert.

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

## 7.5 Charging-bay alert types (Part 23)

Registered in `apx-alert-types` v4: `evBayNotCharging` (a vehicle has occupied a
charging bay without connecting beyond the place's grace — the EV
counterpart of the seeded `iceInEvSpace`) and `evBayBlocked` (the bay is
obstructed by something other than a parked vehicle). Both are derived
from the Part 23 §23.3 bay-presence fusion and carry the camera
Observation as evidence.

## 7.6 List-arrival alert types (Part 24)

Registered in `apx-alert-types` v5:

- `watchListArrival` — a credential on a `watch` plate list was read at a
  place where the list has `alertOnArrival`;
- `scofflawArrival` — the same for a `scofflaw` list;
- `refusedServiceArrival` — a listed credential arrived at a lane where
  the list has `refuseService`, and service was refused.

Each carries the `PlateListEntry` as `relatedEntity` and the read as
evidence (`apds-ext:apx:alert-evidence@1.0`, §7.1); a refused-service
alert SHOULD also reference the `displayMessage` command whose
`result.display` proves what the lane showed (Part 6 §6.1a). Subscribers
that want only these use `filters.alertTypes` (Part 8 §8.5a).

## 7.7 Service-request and consumable alert types (Parts 6, 17)

Registered in `apx-alert-types` v6:

- `consumableLow` — a device reports a consumable (`tickets`,
  `receiptPaper`, `cash`, `coins`) at `low` or `empty` (Part 6 §6.4);
  `source.device` is the device and `description` names the consumable;
- `receiptRequested` — a customer asked for a receipt that the agent
  could not send during the call (Part 13 §13.1a);
- `refundRequested` — a customer asked for a refund the agent could not
  grant during the call; the refund, when made, is the Part 13 §13.1a
  action, and its `reasonCode` comes from `apx-refund-reasons`;
- `citationInquiry` — a customer asked about a citation or notice (Part
  19) that the call center does not handle;
- `damageReported` — a customer reported damage to, or a break-in of, a
  vehicle on site;
- `customerCallbackRequested` — the customer is owed a call back.

Each is a site case opened from a call: `relatedEntity` is what the site
acts on (the payment, the violation, the session) and `supportInteraction`
(§7.1) is the call it came from. They are the alerts a call center hands
to the operator, so the operator's queue and the call record agree on
what is still open.
