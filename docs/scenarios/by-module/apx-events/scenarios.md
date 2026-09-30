# apx-events / apx-events-sse — vetting scenarios

<!-- apx:module apx-events tag=Subscription ics=EVT,SSE -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-events`. Gaps the spec cannot express are marked
`gap=F-EVT-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`, level 2 `b3…0002`, entry lane
`b2…0001`, exit lane 2 `b2…0002`, exit gate `c1…0002`, pay station 3
`c1…0003`) is operated by organisation `a1…0001`, whose APX server
publishes from `https://api.lakeside-garage.example/v1`. Harbor Deck
(`b1…0002`) is another operator's garage. Subscribers: the city's curb
platform (`city-platform`, endpoint `https://curb.city.example/apx/events`,
granted Lakeside only), Lakeside's own ops-monitor (`ops-monitor`, granted
Lakeside), the NOC kiosk behind NAT (SSE), city finance (secret held in a
vault), and a regional auditor whose token carries the explicit `"*"`
grant. Subscriptions are `e8…00NN`, event envelopes `e9…00NN`, delivery
attempts `ea…00NN`, alerts `d3…00NN`.

Every request carries `Authorization: Bearer …` with scope
`apx.subscriptions:manage` unless the scenario says otherwise. Requests
that create resources send the create shape; `id`, `version`, `status`,
`activeKeyIds`, and `recordInfo` are server-assigned. Webhook deliveries
are shown as the HTTP request the subscriber's endpoint receives; the
runner checks the envelope with `apx:validate EventEnvelope` and, where
the topic names a data schema, `apx:validate <Schema> at /data` stacked
over the same block.

---

## EVT-01 — A stock APDS 4.1 client subscribes and sees pure APDS

<!-- apx:scenario EVT-01 kind=happy ics=APX-EVT-01,APX-CORE-02 -->

**Given** the city's legacy curb integration, written against APDS 4.1
alone, posts a stock `EventSubscription` with no `Prefer` header. **When**
Lakeside's policy routes new subscriptions to back-office approval. **Then**
the answer is APDS's own 202 `ResponseStatus`, with the new subscription's
id as the single entry of `ids[]` (Part 8 §8.1 makes that a MUST, so a
stock client can revoke what it created).
A second stock client at a server that auto-activates gets the stock 200.

```http
POST /webhooks
Content-Type: application/json
(no Prefer header)
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apds/events",
  "topics": ["SessionCreated", "SessionUpdated", "SessionDeleted"]
}
```

<!-- apx:response 202 -->
```json
{
  "status": "ok",
  "code": 202,
  "message": "Subscription request received; pending operator approval.",
  "ids": ["e8000000-0000-4000-8000-000000000001"]
}
```

```http
POST /webhooks
Content-Type: application/json
(no Prefer header)
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apds/places",
  "topics": ["PlaceUpdated", "RateUpdated"]
}
```

<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Subscription approved and activated.",
  "ids": ["e8000000-0000-4000-8000-000000000002"]
}
```

---

## EVT-02 — An APX client asks for the representation and gets the secret once

<!-- apx:scenario EVT-02 kind=happy ics=APX-EVT-01,APX-EVT-07,APX-EVT-06 -->

**Given** the city platform's APX-aware integration. **When** it subscribes
with `Prefer: return=representation`, mixing an APDS topic with two APX
topics and filtering to Lakeside, alerts at `warning` and above. **Then**
201 with the full subscription and a server-generated secret of at least
32 bytes, disclosed in this response only; the list afterwards shows the
same subscription without it.

```http
POST /webhooks
Content-Type: application/json
Prefer: return=representation
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 1,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "secret": "whsec_Q7vN3kL9pX2mR8tB4wZ6yH1jC5fS0aD3gE7uK9nM2rT",
  "activeKeyIds": ["k-2026-09-24-a"],
  "status": "active",
  "recordInfo": {
    "creationTime": "2026-09-24T22:05:11Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "city-platform"
  }
}
```

<!-- apx:request GET /webhooks?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287560, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000001",
      "version": 1,
      "endpoint": "https://curb.city.example/apds/events",
      "topics": ["SessionCreated", "SessionUpdated", "SessionDeleted"],
      "transport": "webhook",
      "status": "paused"
    },
    {
      "id": "e8000000-0000-4000-8000-000000000002",
      "version": 1,
      "endpoint": "https://curb.city.example/apds/places",
      "topics": ["PlaceUpdated", "RateUpdated"],
      "transport": "webhook",
      "status": "active"
    },
    {
      "id": "e8000000-0000-4000-8000-000000000003",
      "version": 1,
      "endpoint": "https://curb.city.example/apx/events",
      "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
      "transport": "webhook",
      "filters": {
        "places": ["b1000000-0000-4000-8000-000000000001"],
        "severityFloor": "warning"
      },
      "activeKeyIds": ["k-2026-09-24-a"],
      "status": "active"
    }
  ]
}
```

---

## EVT-03 — Refused at creation: unknown topic, no endpoint, empty topics

<!-- apx:scenario EVT-03 kind=refusal ics=APX-EVT-01,APX-CORE-05 -->

**Given** three broken clients. **When** one asks for a topic version that
does not exist, one asks for webhook transport without an endpoint, and
one sends an empty topic list. **Then** each is a 400: `unknown-topic` for the
first, `invalid-request` with an `errors[]` pointer for the other two.

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.alert.raised.v2"]
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/unknown-topic",
  "title": "Unknown topic",
  "status": 400,
  "detail": "apx.alert.raised.v2 is not in registry apx-topics, not an APDS EventTypeEnum value, and not in this server's vendor list.",
  "instance": "/webhooks"
}
```

<!-- apx:request POST /webhooks -->
```json
{
  "topics": ["apx.alert.raised.v1"],
  "transport": "webhook"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Endpoint required",
  "status": 400,
  "detail": "transport webhook requires endpoint.",
  "instance": "/webhooks"
}
```

<!-- apx:request POST /webhooks invalid -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": []
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "topics must contain at least one entry.",
  "instance": "/webhooks"
}
```

---

## EVT-04 — The first delivery: a stock APDS topic, signed the APX way

<!-- apx:scenario EVT-04 kind=happy ics=APX-EVT-02,APX-EVT-04,APX-EVT-06 -->

**Given** subscription `e8…0003` is active. **When** a car takes a ticket
at the entry lane and a Session is created. **Then** the city endpoint
receives one POST carrying the envelope, signed with the secret from
EVT-02: `APX-Signature` over `APX-Timestamp + "." + body`, a fresh
`APX-Delivery-Id`, no `APX-Key-Id` (no rotation in progress). `data` is
the stock APDS `Session`, because the topic is an APDS `EventTypeEnum`
value; `subject` references it.

```http
POST /apx/events HTTP/1.1
Host: curb.city.example
Content-Type: application/json
APX-Timestamp: 2026-09-24T22:15:03Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000001
APX-Signature: v1=3f9c1e0b7a2d4c6e8f0a1b3c5d7e9f2a4c6e8b0d1f3a5c7e9b2d4f6a8c0e1b3d
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Session at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000001",
  "type": "SessionCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c4000000-0000-4000-8000-000000000061", "className": "Session" },
  "time": "2026-09-24T22:15:02Z",
  "data": {
    "id": "c4000000-0000-4000-8000-000000000061",
    "version": 1,
    "actualStart": "2026-09-24T22:15:01Z",
    "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 12, "className": "Place" },
    "identifiedCredentials": [
      { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1061", "className": "Ticket" } }
    ],
    "segments": [
      {
        "id": "c5000000-0000-4000-8000-000000000061",
        "version": 1,
        "actualStart": "2026-09-24T22:15:01Z",
        "assignedRight": { "id": "e2000000-0000-4000-8000-000000000061", "version": 1, "className": "AssignedRight" },
        "validationType": ["ticket"]
      }
    ]
  }
}
```

The endpoint answers `200 OK` within a second. The ledger records one
attempt:

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790288160, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

---

## EVT-05 — The endpoint is down: one event id, five delivery ids, the schedule

<!-- apx:scenario EVT-05 kind=lifecycle ics=APX-EVT-03,APX-EVT-04 -->

**Given** the city platform deploys at 02:00 and its endpoint returns 503
for the next hour and a half. **When** a device-state event is published
at 02:00:00. **Then** Lakeside retries on the normative schedule — 0s,
30s, 2m, 10m, 1h, then hourly — with the same envelope `id` every time
and a new `APX-Delivery-Id` per attempt. The schedule values are delays
between consecutive attempts (Part 8 §8.3), and the ledger's
`attemptHistory` shows every attempt's delivery id, time, and code; the
operator filters the ledger to the one event it is chasing.

```http
POST /apx/events            attempt 1   02:00:00Z   APX-Delivery-Id: ea…0002   → 503
POST /apx/events            attempt 2   02:00:30Z   APX-Delivery-Id: ea…0003   → 503
POST /apx/events            attempt 3   02:02:30Z   APX-Delivery-Id: ea…0004   → 503
POST /apx/events            attempt 4   02:12:30Z   APX-Delivery-Id: ea…0005   → 503
POST /apx/events            attempt 5   03:12:30Z   APX-Delivery-Id: ea…0006   → 503
```

Every attempt carries this envelope, byte for byte the same `id`:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000002",
  "type": "apx.control.device.state.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "time": "2026-09-25T02:00:00Z",
  "data": {
    "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
    "deviceState": "fault",
    "lastCommunication": "2026-09-25T01:59:58Z",
    "stateChangedTime": "2026-09-25T02:00:00Z"
  }
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790306400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000006",
      "eventId": "e9000000-0000-4000-8000-000000000002",
      "attempts": 5,
      "status": "retrying",
      "lastCode": 503,
      "time": "2026-09-25T03:12:30Z",
      "attemptHistory": [
        { "deliveryId": "ea000000-0000-4000-8000-000000000002", "time": "2026-09-25T02:00:00Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000003", "time": "2026-09-25T02:00:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000004", "time": "2026-09-25T02:02:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000005", "time": "2026-09-25T02:12:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000006", "time": "2026-09-25T03:12:30Z", "code": 503 }
      ]
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

The same ledger, filtered to the retrying record of that one event:

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?status=retrying&eventId=e9000000-0000-4000-8000-000000000002&since=2026-09-25T02:00:00Z -->
<!-- apx:response 200 -->
<!-- apx:validate DeliveryRecord at /data/0 -->
```json
{
  "meta": { "referenceInstant": 1790306400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000006",
      "eventId": "e9000000-0000-4000-8000-000000000002",
      "attempts": 5,
      "status": "retrying",
      "lastCode": 503,
      "time": "2026-09-25T03:12:30Z"
    }
  ]
}
```

---

## EVT-06 — Twenty-four hours later: failed, the self-referential event, the alert

<!-- apx:scenario EVT-06 kind=lifecycle ics=APX-EVT-03,APX-EVT-06 -->

**Given** the city endpoint stays down for a full day. **When** the last
hourly retry (attempt 27, at 01:12:30 on the 26th — the last one that
falls within 24 hours of the first) also fails. **Then** the subscription
transitions to `failed`, the ledger entry becomes `failed`, Lakeside
publishes `apx.subscription.failed.v1` to the ops-monitor subscription
(never to the failed one), and raises a `webhookDeliveryFailed` alert.
`data` is a `SubscriptionFailure` (Part 8 §8.7): the subscription
reference plus the facts an operator needs.

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790385150, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000028",
      "eventId": "e9000000-0000-4000-8000-000000000002",
      "attempts": 27,
      "status": "failed",
      "lastCode": 503,
      "time": "2026-09-26T01:12:30Z"
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

Delivered to ops-monitor (`e8…0004`, endpoint `https://noc.lakeside-garage.example/apx`):

```http
POST /apx HTTP/1.1
Host: noc.lakeside-garage.example
Content-Type: application/json
APX-Timestamp: 2026-09-26T01:12:31Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000029
APX-Signature: v1=8c1d3e5f7a9b0c2d4e6f8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e2f4a6b8c0d
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate SubscriptionFailure at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000003",
  "type": "apx.subscription.failed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000003", "className": "ApxEventSubscription" },
  "time": "2026-09-26T01:12:30Z",
  "data": {
    "subscription": { "id": "e8000000-0000-4000-8000-000000000003", "className": "ApxEventSubscription" },
    "endpoint": "https://curb.city.example/apx/events",
    "status": "failed",
    "failedTime": "2026-09-26T01:12:30Z",
    "firstFailedEventId": "e9000000-0000-4000-8000-000000000002",
    "attempts": 27,
    "lastCode": 503
  }
}
```

The alert, on the same ops-monitor subscription (which also holds
`apx.alert.raised.v1`):

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000004",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000003", "className": "Alert" },
  "time": "2026-09-26T01:12:31Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000003",
    "version": 1,
    "alertType": "webhookDeliveryFailed",
    "severity": "major",
    "status": "raised",
    "detectionTime": "2026-09-26T01:12:30Z",
    "relatedEntity": { "id": "e8000000-0000-4000-8000-000000000003", "className": "ApxEventSubscription" },
    "description": [{ "language": "en", "string": "Subscription e8…0003 to https://curb.city.example/apx/events exhausted its retry schedule (27 attempts, last HTTP 503)." }]
  }
}
```

---

## EVT-07 — What a failed subscription still allows, and the resume

<!-- apx:scenario EVT-07 kind=refusal ics=APX-EVT-03,APX-SSE-01 -->

**Given** `e8…0003` is `failed`. **When** the city platform tries to
narrow its filters, tries to attach to the stream, reads its ledger, and
finally resumes. **Then** 410 `subscription-failed` on the update (Part 8 §8.1: while
`failed`, the only PATCH accepted is one that sets `status: active`),
410 on the stream, 200 on the ledger, and 200 on a status-only
`PATCH` — the body is a merge patch, so nothing else has to be resent.

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "major"
  }
}
```

<!-- apx:response 410 -->
```json
{
  "type": "https://apx-standard.org/problems/subscription-failed",
  "title": "Subscription is failed",
  "status": 410,
  "detail": "Subscription e8000000-0000-4000-8000-000000000003 exhausted its retry schedule at 2026-09-26T01:12:30Z; PATCH status=active to resume before changing it.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

```http
GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000003
Accept: text/event-stream
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 410 -->
```json
{
  "type": "https://apx-standard.org/problems/subscription-failed",
  "title": "Subscription is failed",
  "status": 410,
  "detail": "Subscription e8000000-0000-4000-8000-000000000003 is in state failed.",
  "instance": "/v1/events/stream"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790413200, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000028",
      "eventId": "e9000000-0000-4000-8000-000000000002",
      "attempts": 27,
      "status": "failed",
      "lastCode": 503,
      "time": "2026-09-26T01:12:30Z"
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "status": "active"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 2,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a"],
  "status": "active",
  "recordInfo": {
    "creationTime": "2026-09-24T22:05:11Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "city-platform",
    "lastUpdate": "2026-09-26T09:00:12Z",
    "lastUpdateUser": "city-platform"
  }
}
```

---

## EVT-08 — Secret rotation with an overlap window

<!-- apx:scenario EVT-08 kind=security ics=APX-EVT-07,APX-EVT-02 -->

**Given** the city's quarterly key rotation. **When** it PATCHes a new
client-supplied secret under a key id it chooses. **Then** 200 with two
`activeKeyIds`, the secret never echoed, and every delivery during the
overlap carrying `APX-Key-Id` so the receiver verifies against the right
key without trying both. The overlap ends when the client retires the old
key (EVT-24) or, failing that, 24 hours after the rotation (Part 8 §8.1).
A secret with too little entropy is 400 `invalid-request` pointing at
`/secret`.

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "secret": "whsec_Zx8Ky3Pw6Vn1Tq9Lr4Mb7Hc2Jf5Gd0Sa3Ue8Ni6Ro1Ct",
  "keyId": "k-2026-09-26-b"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 3,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a", "k-2026-09-26-b"],
  "status": "active"
}
```

A delivery during the overlap, signed with the new key:

```http
POST /apx/events HTTP/1.1
Host: curb.city.example
Content-Type: application/json
APX-Timestamp: 2026-09-26T09:14:20Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000031
APX-Key-Id: k-2026-09-26-b
APX-Signature: v1=a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef0123456789abcdef01
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate DeviceStatus at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000005",
  "type": "apx.control.device.state.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "time": "2026-09-26T09:14:20Z",
  "data": {
    "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
    "deviceState": "available",
    "lastCommunication": "2026-09-26T09:14:19Z",
    "stateChangedTime": "2026-09-26T09:14:20Z"
  }
}
```

A weak secret is refused:

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "secret": "hunter2"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "secret must carry at least 32 bytes of entropy (Part 9 §9.4); 7 bytes supplied.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003",
  "errors": [{ "pointer": "/secret", "detail": "at least 32 bytes of entropy required" }]
}
```

---

## EVT-09 — Key material that never transits the API

<!-- apx:scenario EVT-09 kind=happy ics=APX-EVT-07,APX-EVT-02,APX-EVT-05 -->

**Given** city finance's security policy forbids secrets in API bodies.
**When** it subscribes to payment events naming a `secretRef` exchanged
out of band. **Then** 201 with no `secret` and an `activeKeyIds` entry
naming the referenced key; deliveries are signed with it and carry the
`PaymentRecord`, whose required `place` is the binding the filter matches.

```http
POST /webhooks
Prefer: return=representation
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://finance.city.example/apx/payments",
  "topics": ["apx.accounts.payment.recorded.v1"],
  "secretRef": "vault://city/apx/lakeside/2026q3",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000006",
  "version": 1,
  "endpoint": "https://finance.city.example/apx/payments",
  "topics": ["apx.accounts.payment.recorded.v1"],
  "transport": "webhook",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "activeKeyIds": ["vault://city/apx/lakeside/2026q3"],
  "status": "active"
}
```

```http
POST /apx/payments HTTP/1.1
Host: finance.city.example
Content-Type: application/json
APX-Timestamp: 2026-09-25T01:42:10Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000041
APX-Signature: v1=0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000006",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d9000000-0000-4000-8000-000000000001", "className": "PaymentRecord" },
  "time": "2026-09-25T01:42:09Z",
  "data": {
    "id": "d9000000-0000-4000-8000-000000000001",
    "transactionID": "PS3-20260925-0142",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "dateCollected": "2026-09-25T01:42:08Z",
    "amount": { "currencyType": "USD", "currencyValue": 9.0 },
    "meansOfPayment": "paymentCreditCard",
    "paymentStatus": "approved",
    "ticketNumber": "T-1061",
    "cardLast4": "4242"
  }
}
```

---

## EVT-10 — Place binding: what the filter delivers, what it quietly drops

<!-- apx:scenario EVT-10 kind=happy ics=APX-EVT-05,APX-EVT-06 -->

**Given** `e8…0003` filters to Lakeside with `severityFloor: warning`.
**When** the night brings an occupancy threshold crossing on level 2
(bound by `data.place`), a major pay-station alert (bound by
`data.source.place`), a device-state change (bound through the subject
device's inventory place), an `info` alert, and a Harbor Deck alert.
**Then** the first three are delivered and the last two never appear —
not in the endpoint's log, not in the ledger.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate OccupancySnapshot at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000007",
  "type": "apx.data.occupancy.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "b3000000-0000-4000-8000-000000000002", "className": "Level" },
  "time": "2026-09-25T02:05:00Z",
  "data": {
    "place": { "id": "b3000000-0000-4000-8000-000000000002", "className": "Level" },
    "computedAt": "2026-09-25T02:05:00Z",
    "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
    "demand": { "count": 402, "occupancyCalculation": "counted", "percentage": 95.7, "recordDateTime": "2026-09-25T02:05:00Z" },
    "available": 18
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000012",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000001", "className": "Alert" },
  "time": "2026-09-25T02:10:15Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000001",
    "version": 1,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "raised",
    "detectionTime": "2026-09-25T02:10:15Z",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "place": "b1000000-0000-4000-8000-000000000001"
    }
  }
}
```

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000008",
  "type": "apx.control.device.state.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "time": "2026-09-25T02:10:16Z",
  "data": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "deviceState": "fault",
    "lastCommunication": "2026-09-25T02:10:14Z",
    "stateChangedTime": "2026-09-25T02:10:15Z"
  }
}
```

The `info` alert (`d3…0004`, "receipt paper low") is below the floor;
the Harbor Deck alert (`d3…0005`, `source.place = b1…0002`) is outside
the filter. Neither is attempted, so the ledger holds exactly three new
rows:

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790302800, "offset": 0, "pageSize": 100, "total": 4 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000053",
      "eventId": "e9000000-0000-4000-8000-000000000008",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-25T02:10:17Z"
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000052",
      "eventId": "e9000000-0000-4000-8000-000000000012",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-25T02:10:16Z"
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000051",
      "eventId": "e9000000-0000-4000-8000-000000000007",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-25T02:05:01Z"
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

---

## EVT-11 — Beyond the grant: refused at subscription, dropped at delivery

<!-- apx:scenario EVT-11 kind=security ics=APX-EVT-05,APX-CORE-07,APX-CORE-08 -->

**Given** the city token is granted Lakeside only, and ops-monitor
(`e8…0004`) has no `places` filter at all. **When** the city asks for a
Harbor Deck filter, a token with no `apx_places` claim asks for any
filter, a Harbor Deck occupancy event is published, and a validation
statement with no place at all is closed. **Then** the two subscriptions
are refused with `insufficient-grant` (Part 8 §8.5); the Harbor Deck event is never delivered to ops-monitor; and
the unbindable statement event reaches only the auditor's subscription
(`e8…0007`, grant `"*"`) — when in doubt, drop rather than leak.

```http
POST /webhooks
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.data.occupancy.v1"],
  "filters": { "places": ["b1000000-0000-4000-8000-000000000002"] }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "filters.places names b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/webhooks"
}
```

```http
POST /webhooks
Authorization: Bearer <no apx_places claim at all>
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.data.occupancy.v1"],
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/webhooks"
}
```

The Harbor Deck occupancy event exists inside the server and is bound to
`b1…0002`; ops-monitor's grant does not include it, so it is dropped
without a ledger row:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000009",
  "type": "apx.data.occupancy.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "time": "2026-09-25T02:20:00Z",
  "data": {
    "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
    "computedAt": "2026-09-25T02:20:00Z",
    "supply": { "supplyViewType": "spaceView", "supplyQuantity": 260 },
    "demand": { "count": 251, "occupancyCalculation": "counted", "recordDateTime": "2026-09-25T02:20:00Z" },
    "available": 9
  }
}
```

The statement event has no `place` in `data`, its subject is not a
HierarchyElement, and a ValidationStatement is not inventoried anywhere:
no binding resolves. It is delivered to the auditor only:

```http
POST /apx/inbox HTTP/1.1
Host: audit.region.example
APX-Timestamp: 2026-10-01T00:05:02Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000061
APX-Signature: v1=5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationStatement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000010",
  "type": "apx.validations.statement.closed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f7000000-0000-4000-8000-000000000009", "className": "ValidationStatement" },
  "time": "2026-10-01T00:05:01Z",
  "data": {
    "id": "f7000000-0000-4000-8000-000000000009",
    "version": 1,
    "program": { "id": "f5000000-0000-4000-8000-000000000011", "className": "ValidationProgram" },
    "periodStart": "2026-09-01T00:00:00Z",
    "periodEnd": "2026-10-01T00:00:00Z",
    "statementStatus": "closed",
    "billingModel": "merchantPays",
    "redemptionCount": 412,
    "reversedCount": 3,
    "totalReduced": { "currencyType": "USD", "currencyValue": 2454.0 },
    "billableAmount": { "currencyType": "USD", "currencyValue": 2454.0 },
    "closedTime": "2026-10-01T00:05:00Z",
    "closedBy": "billing-job"
  }
}
```

---

## EVT-12 — Wrong scope, wrong purpose, dead token, throttled

<!-- apx:scenario EVT-12 kind=security ics=APX-CORE-07,APX-CORE-05,APX-CORE-10 -->

**Given** a BI token carrying only `apx.data:read`, a city token without
`apx.lpr:read`, an expired token, and a dashboard that polls the ledger
every second. **When** each touches the subscription routes. **Then** 403
`insufficient-scope` everywhere; 403 `insufficient-scope` at creation
for a plate-bearing topic the credential could not read synchronously
(Part 8 §8.1, Part 9 §9.6(4)); 401 `unauthenticated`; and 429 with
`Retry-After`.

```http
POST /webhooks
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://bi.city.example/apx",
  "topics": ["apx.data.occupancy.v1"]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /webhooks requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /webhooks?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /webhooks requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /webhooks/{id}/deliveries requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003/deliveries"
}
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/events/stream requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/v1/events/stream"
}
```

```http
POST /webhooks
Authorization: Bearer <apx.subscriptions:manage apx.data:read — no apx.lpr:read>
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.data.observation.created.v1"],
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "apx.data.observation.created.v1 carries plate reads; subscribing requires apx.lpr:read (Part 9 §9.6). Token carries apx.subscriptions:manage apx.data:read.",
  "instance": "/webhooks"
}
```

```http
GET /webhooks
Authorization: Bearer <expired>
```

<!-- apx:request GET /webhooks -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003/deliveries"
}
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/events/stream"
}
```

```http
GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries
→ 429, Retry-After: 5
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Ledger reads for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003/deliveries"
}
```

<!-- apx:request GET /webhooks -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Subscription reads for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Stream reconnects for this subscription exceeded 10/min; retry after 30 seconds.",
  "instance": "/v1/events/stream"
}
```

---

## EVT-13 — The NOC kiosk behind NAT: an SSE subscription

<!-- apx:scenario EVT-13 kind=happy ics=APX-SSE-01,APX-EVT-01,APX-EVT-06 -->

**Given** the garage's NOC kiosk cannot expose an inbound endpoint.
**When** it subscribes with `transport: sse` and opens the stream.
**Then** 201 without an endpoint or a secret, and a `text/event-stream`
whose `id:` is the per-subscription sequence and whose `data:` is the
envelope. The frames are shown as the runner sees them (one JSON string,
the declared response schema) and then the command envelope is checked on
its own.

```http
POST /webhooks
Prefer: return=representation
```

<!-- apx:request POST /webhooks -->
```json
{
  "topics": ["apx.alert.raised.v1", "apx.alert.status.v1", "apx.control.command.status.v1"],
  "transport": "sse",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000005",
  "version": 1,
  "topics": ["apx.alert.raised.v1", "apx.alert.status.v1", "apx.control.command.status.v1"],
  "transport": "sse",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "status": "active"
}
```

```http
GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 HTTP/1.1
Accept: text/event-stream
Authorization: Bearer …

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

id: 1041
data: {"id":"e9000000-0000-4000-8000-000000000012","type":"apx.alert.raised.v1", …}

id: 1042
data: {"id":"e9000000-0000-4000-8000-000000000013","type":"apx.control.command.status.v1", …}
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
```json
"id: 1041\ndata: {\"id\":\"e9000000-0000-4000-8000-000000000012\",\"type\":\"apx.alert.raised.v1\",\"source\":\"https://api.lakeside-garage.example/v1\",\"subject\":{\"id\":\"d3000000-0000-4000-8000-000000000001\",\"className\":\"Alert\"},\"time\":\"2026-09-25T02:10:15Z\",\"data\":{\"id\":\"d3000000-0000-4000-8000-000000000001\",\"version\":1,\"alertType\":\"deviceFault\",\"severity\":\"major\",\"status\":\"raised\",\"detectionTime\":\"2026-09-25T02:10:15Z\",\"source\":{\"device\":{\"id\":\"c1000000-0000-4000-8000-000000000003\",\"className\":\"SupplementalEquipment\"},\"place\":\"b1000000-0000-4000-8000-000000000001\"}}}\n\nid: 1042\ndata: {\"id\":\"e9000000-0000-4000-8000-000000000013\",\"type\":\"apx.control.command.status.v1\",\"source\":\"https://api.lakeside-garage.example/v1\",\"subject\":{\"id\":\"d1000000-0000-4000-8000-000000000101\",\"className\":\"Command\"},\"time\":\"2026-09-25T02:31:05Z\",\"data\":{\"id\":\"d1000000-0000-4000-8000-000000000101\",\"version\":5,\"commandType\":\"vendGate\",\"target\":{\"id\":\"b2000000-0000-4000-8000-000000000002\",\"className\":\"VehicularAccess\"},\"status\":\"succeeded\",\"confirmationLevel\":\"physicallyConfirmed\"}}\n\n"
```

The envelope in frame 1042, decoded:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Command at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000013",
  "type": "apx.control.command.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d1000000-0000-4000-8000-000000000101", "className": "Command" },
  "time": "2026-09-25T02:31:05Z",
  "data": {
    "id": "d1000000-0000-4000-8000-000000000101",
    "version": 5,
    "commandType": "vendGate",
    "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "status": "succeeded",
    "confirmationLevel": "physicallyConfirmed"
  }
}
```

---

## EVT-14 — Reconnect with Last-Event-ID; reconnect too late; wrong subscriptions

<!-- apx:scenario EVT-14 kind=edge ics=APX-SSE-02,APX-SSE-01 -->

**Given** the kiosk's connection drops after frame 1042. **When** it
reconnects with `Last-Event-ID: 1042` two minutes later. **Then** the
stream resumes at 1043 and nothing is repeated. When it reconnects after a
three-hour power cut with the same `Last-Event-ID`, the buffer (1000
events or 15 minutes, whichever the server keeps longer) no longer holds
1043: the server answers 410 `stream-position-expired` rather than
silently skipping 1043–4009 (Part 8 §8.4), and the kiosk re-syncs through
the change feed and reconnects without `Last-Event-ID`. Attaching
to a webhook-transport subscription or an unknown one is 404.

```http
GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 HTTP/1.1
Accept: text/event-stream
Last-Event-ID: 1042
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
```json
"id: 1043\ndata: {\"id\":\"e9000000-0000-4000-8000-000000000014\",\"type\":\"apx.alert.status.v1\",\"source\":\"https://api.lakeside-garage.example/v1\",\"subject\":{\"id\":\"d3000000-0000-4000-8000-000000000001\",\"className\":\"Alert\"},\"time\":\"2026-09-25T02:33:40Z\",\"data\":{\"id\":\"d3000000-0000-4000-8000-000000000001\",\"version\":2,\"alertType\":\"deviceFault\",\"severity\":\"major\",\"status\":\"acknowledged\",\"detectionTime\":\"2026-09-25T02:10:15Z\"}}\n\n"
```

Three hours later, same header:

```http
GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 HTTP/1.1
Accept: text/event-stream
Last-Event-ID: 1042
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 410 -->
```json
{
  "type": "https://apx-standard.org/problems/stream-position-expired",
  "title": "Stream position no longer buffered",
  "status": 410,
  "detail": "Last-Event-ID 1042 is older than the oldest buffered frame (3011); re-sync via the change feed, then reconnect without Last-Event-ID.",
  "instance": "/v1/events/stream"
}
```

Reconnected without `Last-Event-ID` after the re-sync:

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
```json
"id: 4010\ndata: {\"id\":\"e9000000-0000-4000-8000-000000000015\",\"type\":\"apx.alert.raised.v1\",\"source\":\"https://api.lakeside-garage.example/v1\",\"subject\":{\"id\":\"d3000000-0000-4000-8000-000000000002\",\"className\":\"Alert\"},\"time\":\"2026-09-25T05:40:02Z\",\"data\":{\"id\":\"d3000000-0000-4000-8000-000000000002\",\"version\":1,\"alertType\":\"occupancyThresholdExceeded\",\"severity\":\"warning\",\"status\":\"raised\",\"detectionTime\":\"2026-09-25T05:40:02Z\",\"source\":{\"place\":\"b1000000-0000-4000-8000-000000000001\"}}}\n\n"
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Subscription e8000000-0000-4000-8000-000000000003 has transport webhook; the stream serves transport sse only.",
  "instance": "/v1/events/stream"
}
```

<!-- apx:request GET /v1/events/stream?subscription=e8000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No subscription e8000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/events/stream"
}
```

---

## EVT-15 — Update topics and filters; a stale version; an unknown id; a duplicate

<!-- apx:scenario EVT-15 kind=happy ics=APX-EVT-01,APX-CORE-03 -->

**Given** the city wants occupancy events too. **When** it PATCHes the
topic list with the version it last saw. **Then** 200 and `version`
advances. Replaying the same PATCH with the old version is a stale write
— 409 `version-conflict` (Part 4 §4.2a). An unknown id is 404. And a
create retried with the same `Idempotency-Key` after a network blip
returns the first subscription instead of making a second.

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "version": 3,
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 4,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a", "k-2026-09-26-b"],
  "status": "active"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "version": 3,
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "minor"
  }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Stale version",
  "status": 409,
  "detail": "Subscription e8000000-0000-4000-8000-000000000003 is at version 4; the request targets version 3.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-0000000000ff -->
```json
{
  "topics": ["apx.data.occupancy.v1"]
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No subscription e8000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/webhooks/e8000000-0000-4000-8000-0000000000ff"
}
```

The create below was sent twice with the same `Idempotency-Key`; the
first 201 (`e8…0008`, carrying the secret) was lost in transit. The
retry returns the same subscription as it now stands — no second
subscription, and no second disclosure of the secret (Part 8 §8.1), so
the city rotates it with a PATCH. A third request reusing the key with a
different body is refused.

```http
POST /webhooks
Prefer: return=representation
Idempotency-Key: 7d1c9e0a-city-sessions-feed
(retry of a request whose response never arrived)
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/sessions",
  "topics": ["SessionUpdated"],
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000008",
  "version": 1,
  "endpoint": "https://curb.city.example/apx/sessions",
  "topics": ["SessionUpdated"],
  "transport": "webhook",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "activeKeyIds": ["k-2026-09-26-c"],
  "status": "active"
}
```

```http
POST /webhooks
Prefer: return=representation
Idempotency-Key: 7d1c9e0a-city-sessions-feed
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/sessions",
  "topics": ["SessionUpdated", "SessionDeleted"]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency key reused with a different body",
  "status": 409,
  "detail": "Idempotency-Key 7d1c9e0a-city-sessions-feed created subscription e8000000-0000-4000-8000-000000000008 from a different body.",
  "instance": "/webhooks"
}
```

---

## EVT-16 — Pause for maintenance, resume, and a state a client may not set

<!-- apx:scenario EVT-16 kind=lifecycle ics=APX-EVT-03,APX-EVT-01 -->

**Given** the city platform schedules a 20-minute deploy. **When** it
pauses its subscription, deploys, and resumes. **Then** two 200s. Events published during the pause are held (up to 24
hours) and delivered in order on resume, and have no ledger record until
their first attempt (Part 8 §8.1). Setting `failed` from the client side
is 400 `invalid-request`: it is a server-assigned state.

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "status": "paused"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 5,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a", "k-2026-09-26-b"],
  "status": "paused"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "status": "active"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 6,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a", "k-2026-09-26-b"],
  "status": "active"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "status": "failed"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "failed is a server-assigned state (retry schedule exhausted); clients may set active or paused.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003",
  "errors": [{ "pointer": "/status", "detail": "failed is server-assigned" }]
}
```

---

## EVT-17 — Revoke, revoke again, read the ledger of a dead subscription

<!-- apx:scenario EVT-17 kind=lifecycle ics=APX-EVT-01,APX-CORE-02 -->

**Given** the stock APDS places feed (`e8…0002`) is retired. **When** the
city deletes it, a second operator deletes it again, and a dashboard
asks for its ledger. **Then** the native APDS 200 `ResponseStatus`, the
native 404 `ResponseStatus`, and an APX 404 problem. The dashboard then reads a live subscription by id,
and the revoked one, which is 404.

<!-- apx:request DELETE /webhooks/e8000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "status": "ok",
  "code": 200,
  "message": "Subscription e8000000-0000-4000-8000-000000000002 revoked.",
  "ids": ["e8000000-0000-4000-8000-000000000002"]
}
```

<!-- apx:request DELETE /webhooks/e8000000-0000-4000-8000-000000000002 -->
<!-- apx:response 404 -->
```json
{
  "status": "error",
  "code": 404,
  "message": "No subscription e8000000-0000-4000-8000-000000000002.",
  "ids": ["e8000000-0000-4000-8000-000000000002"]
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000002/deliveries -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No subscription e8000000-0000-4000-8000-000000000002 visible to this credential.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000002/deliveries"
}
```

The read by id:

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 6,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-24-a", "k-2026-09-26-b"],
  "status": "active"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000002 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No subscription e8000000-0000-4000-8000-000000000002 visible to this credential.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000002"
}
```

---

## EVT-18 — Unknown extension keys survive the round trip

<!-- apx:scenario EVT-18 kind=edge ics=APX-CORE-04,APX-EVT-01 -->

**Given** the city's integration tags subscriptions with its own routing
metadata. **When** it creates with an `apds-ext:` key Lakeside has never
seen, then PATCHes the topics without mentioning `extensions`. **Then**
the key is echoed at creation and still present after the update. A key
that breaks the §4.3 pattern is refused with 400 `invalid-request`.

```http
POST /webhooks
Prefer: return=representation
```

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://curb.city.example/apx/violations",
  "topics": ["apx.violations.issued.v1"],
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "extensions": {
    "apds-ext:acmecity:routing@1.0": { "queue": "enforcement-prod", "owner": "curb-team" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000010",
  "version": 1,
  "endpoint": "https://curb.city.example/apx/violations",
  "topics": ["apx.violations.issued.v1"],
  "transport": "webhook",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "secret": "whsec_Rt5Yb2Nq9Wm4Ks7Lp0Zx3Cv6Hf1Jg8Dd4Ae2Ui7Oo5Pq",
  "activeKeyIds": ["k-2026-09-26-d"],
  "status": "active",
  "extensions": {
    "apds-ext:acmecity:routing@1.0": { "queue": "enforcement-prod", "owner": "curb-team" }
  }
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000010 -->
```json
{
  "topics": ["apx.violations.issued.v1", "apx.violations.status.v1"]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000010",
  "version": 2,
  "endpoint": "https://curb.city.example/apx/violations",
  "topics": ["apx.violations.issued.v1", "apx.violations.status.v1"],
  "transport": "webhook",
  "filters": { "places": ["b1000000-0000-4000-8000-000000000001"] },
  "activeKeyIds": ["k-2026-09-26-d"],
  "status": "active",
  "extensions": {
    "apds-ext:acmecity:routing@1.0": { "queue": "enforcement-prod", "owner": "curb-team" }
  }
}
```

<!-- apx:request POST /webhooks invalid -->
```json
{
  "endpoint": "https://curb.city.example/apx/violations",
  "topics": ["apx.violations.issued.v1"],
  "extensions": {
    "x-routing": { "queue": "enforcement-prod" }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "extensions key x-routing does not match ^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\\.[0-9]+$ (Part 4 §4.3).",
  "instance": "/webhooks"
}
```

---

## EVT-19 — Night shift: the operations feed, end to end

<!-- apx:scenario EVT-19 kind=happy ics=APX-EVT-06,APX-EVT-05 -->

**Given** the pay-station fault from EVT-10 at 02:10. **When** the
overnight agent acknowledges the alert, a driver stuck at the exit calls,
the resolution context pops on her console, she vends (EVT-13's command),
and the interaction is closed. **Then** ops-monitor receives, in order,
`apx.alert.status.v1`, `apx.resolution.context.created.v1`, and
`apx.support.interaction.recorded.v1`, each bound to Lakeside.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000014",
  "type": "apx.alert.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d3000000-0000-4000-8000-000000000001", "className": "Alert" },
  "time": "2026-09-25T02:33:40Z",
  "data": {
    "id": "d3000000-0000-4000-8000-000000000001",
    "version": 2,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "acknowledged",
    "detectionTime": "2026-09-25T02:10:15Z",
    "source": { "place": "b1000000-0000-4000-8000-000000000001" },
    "statusHistory": [
      { "state": "raised", "time": "2026-09-25T02:10:15Z", "actor": "lakeside-parcs" },
      { "state": "acknowledged", "time": "2026-09-25T02:33:40Z", "actor": "agent:j.okafor", "detail": "tech paged" }
    ]
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ResolutionContext at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000016",
  "type": "apx.resolution.context.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d7000000-0000-4000-8000-000000000001", "className": "ResolutionContext" },
  "time": "2026-09-25T02:30:10Z",
  "data": {
    "id": "d7000000-0000-4000-8000-000000000001",
    "version": 1,
    "computedAt": "2026-09-25T02:30:10Z",
    "status": "full",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
    "issue": { "code": "payStationFault", "display": "Pay station 3 in fault; driver cannot pay at exit" },
    "allowedActions": [
      { "action": "vendGate", "allowed": true },
      { "action": "courtesyExit", "allowed": false, "reason": { "code": "notMonthly" } }
    ]
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate SupportInteraction at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000017",
  "type": "apx.support.interaction.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000001", "className": "SupportInteraction" },
  "time": "2026-09-25T02:35:02Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000001",
    "version": 1,
    "channel": "voice",
    "agentType": "human",
    "agent": "agent:j.okafor",
    "startedAt": "2026-09-25T02:29:50Z",
    "endedAt": "2026-09-25T02:35:00Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "issue": { "code": "payStationFault" },
    "summary": "Pay station 3 faulted; gate vended for driver at exit lane 2.",
    "actions": [{ "id": "d1000000-0000-4000-8000-000000000101", "className": "Command" }],
    "resolution": { "code": "vended" }
  }
}
```

---

## EVT-20 — Money and enforcement: tolling and violation topics

<!-- apx:scenario EVT-20 kind=happy ics=APX-EVT-06,APX-EVT-05 -->

**Given** the city's enforcement subscription (`e8…0010`) and a tolling
subscription on the same endpoint. **When** a gantry read creates a toll
transaction that is later disputed, and an overstay is detected, issued,
and paid. **Then** five envelopes, each carrying the full resource so a
consumer never has to call back for it.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000020",
  "type": "apx.tolling.transaction.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f3000000-0000-4000-8000-000000000001", "className": "TollTransaction" },
  "time": "2026-09-25T07:02:11Z",
  "data": {
    "id": "f3000000-0000-4000-8000-000000000001",
    "version": 1,
    "tollPoint": { "id": "c1000000-0000-4000-8000-000000000021", "className": "SupplementalEquipment" },
    "observations": [{ "id": "f2000000-0000-4000-8000-000000000901", "className": "ObservationElement" }],
    "credential": { "credentialType": "licensePlate", "credentialIdentification": "SYN-1234" },
    "pricing": { "currencyType": "USD", "currencyValue": 4.5 },
    "transactionStatus": "priced"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate TollTransaction at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000021",
  "type": "apx.tolling.transaction.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f3000000-0000-4000-8000-000000000001", "className": "TollTransaction" },
  "time": "2026-09-27T15:40:00Z",
  "data": {
    "id": "f3000000-0000-4000-8000-000000000001",
    "version": 3,
    "tollPoint": { "id": "c1000000-0000-4000-8000-000000000021", "className": "SupplementalEquipment" },
    "pricing": { "currencyType": "USD", "currencyValue": 4.5 },
    "transactionStatus": "disputed",
    "dispute": { "reason": "plate misread; vehicle was not at the gantry", "openedTime": "2026-09-27T15:40:00Z" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000022",
  "type": "apx.violations.detected.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f4000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-25T11:00:05Z",
  "data": {
    "id": "f4000000-0000-4000-8000-000000000001",
    "version": 1,
    "violationType": "overstay",
    "violationStatus": "detected",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-25T11:00:00Z", "detector": { "id": "c1000000-0000-4000-8000-000000000031", "className": "SupplementalEquipment" } },
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-5678" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000023",
  "type": "apx.violations.issued.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f4000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-25T11:20:30Z",
  "data": {
    "id": "f4000000-0000-4000-8000-000000000001",
    "version": 3,
    "violationType": "overstay",
    "violationStatus": "issued",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-25T11:00:00Z" },
    "amount": { "currencyType": "USD", "currencyValue": 45.0 },
    "dueTime": "2026-10-25T11:20:30Z",
    "notice": { "noticeKind": "citation", "noticeNumber": "LG-2026-004411", "issuedTime": "2026-09-25T11:20:30Z", "deliveryMethod": "windshield" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Violation at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000024",
  "type": "apx.violations.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f4000000-0000-4000-8000-000000000001", "className": "Violation" },
  "time": "2026-09-28T09:12:44Z",
  "data": {
    "id": "f4000000-0000-4000-8000-000000000001",
    "version": 4,
    "violationType": "overstay",
    "violationStatus": "paid",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "detection": { "mode": "automated", "detectedTime": "2026-09-25T11:00:00Z" },
    "amount": { "currencyType": "USD", "currencyValue": 45.0 },
    "payment": { "id": "d9000000-0000-4000-8000-000000000044", "className": "PaymentRecord" }
  }
}
```

---

## EVT-21 — Validations, credentials, and a no-show

<!-- apx:scenario EVT-21 kind=happy ics=APX-EVT-06,APX-EVT-05 -->

**Given** ops-monitor holds every APX topic. **When** the cinema's
validation is redeemed at the lane, the cinema program is suspended for
non-payment, a monthly card is suspended and then refused at the entry
lane, and a reservation passes its grace period. **Then** five envelopes.
The no-show topic's data is `ReservationSummary` (Part 8 §8.7).

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationRedemption at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000030",
  "type": "apx.validations.redeemed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f6000000-0000-4000-8000-000000000417", "className": "ValidationRedemption" },
  "time": "2026-09-25T18:14:04Z",
  "data": {
    "id": "f6000000-0000-4000-8000-000000000417",
    "version": 1,
    "program": { "id": "f5000000-0000-4000-8000-000000000011", "className": "ValidationProgram" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "ticketNumber": "T-1001",
    "session": { "id": "c4000000-0000-4000-8000-000000000001", "className": "Session" },
    "appliedTime": "2026-09-25T18:14:03Z",
    "channel": "callCenter",
    "appliedBy": "agent:j.okafor",
    "command": { "id": "d1000000-0000-4000-8000-000000000108", "className": "Command" },
    "validationId": "VAL-2026-0925-00417",
    "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
    "redemptionStatus": "applied"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationProgram at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000031",
  "type": "apx.validations.program.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f5000000-0000-4000-8000-000000000011", "className": "ValidationProgram" },
  "time": "2026-09-26T08:00:00Z",
  "data": {
    "id": "f5000000-0000-4000-8000-000000000011",
    "version": 4,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
    "name": "Lakeside Cinema — two hours comped",
    "validationType": "twoHoursComped",
    "programStatus": "suspended",
    "benefit": { "description": "First two hours comped", "duration": "PT2H" },
    "statusHistory": [
      { "state": "active", "time": "2026-06-01T00:00:00Z", "actor": "ops:m.reyes" },
      { "state": "suspended", "time": "2026-09-26T08:00:00Z", "actor": "billing-job", "detail": "August statement unpaid 30 days" }
    ]
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000032",
  "type": "apx.credentials.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e3000000-0000-4000-8000-000000000001", "className": "CredentialRecord" },
  "time": "2026-09-25T06:00:00Z",
  "data": {
    "id": "e3000000-0000-4000-8000-000000000001",
    "version": 3,
    "credentialType": "rfid",
    "credentialIdentification": "MC-0777",
    "credentialAssignedType": "customer",
    "holder": { "id": "a2000000-0000-4000-8000-000000000077", "className": "RightHolder" },
    "places": [{ "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }],
    "credentialStatus": "suspended",
    "suspension": { "reason": "account past due", "until": "2026-10-25T00:00:00Z" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CredentialAccessEvent at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000033",
  "type": "apx.credentials.access.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e3000000-0000-4000-8000-000000000001", "className": "CredentialRecord" },
  "time": "2026-09-25T08:04:32Z",
  "data": {
    "id": "eb000000-0000-4000-8000-000000000001",
    "credential": { "id": "e3000000-0000-4000-8000-000000000001", "className": "CredentialRecord" },
    "occurredAt": "2026-09-25T08:04:31Z",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
    "direction": "entry",
    "outcome": "denied",
    "denialReason": "credential suspended: account past due"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ReservationSummary at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000034",
  "type": "apx.reservation.noshow.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e2000000-0000-4000-8000-000000000003", "className": "AssignedRight" },
  "time": "2026-09-25T19:30:00Z",
  "data": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000003", "className": "AssignedRight" },
    "reservationState": "noShow",
    "plannedStart": "2026-09-25T18:00:00Z",
    "plannedEnd": "2026-09-26T01:00:00Z"
  }
}
```

---

## EVT-22 — Valet runner boards and the sensor stream

<!-- apx:scenario EVT-22 kind=happy ics=APX-EVT-06,APX-EVT-05,APX-CORE-10 -->

**Given** the valet stand's runner board and the city's LPR analytics
each subscribe. **When** a guest texts for her car, a runner picks it up,
and the entry camera reads a plate. **Then** `apx.valet.retrieval.requested.v1`,
`apx.valet.ticket.status.v1`, and `apx.data.observation.created.v1`. The
observation topic's data is the APDS `ObservationElement`, with
`elementIds` as the element binding §8.5 requires (Part 8 §8.7).
The plate value rides only under `apx.lpr:read` (Part 9 §9.6).

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000040",
  "type": "apx.valet.retrieval.requested.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f8000000-0000-4000-8000-000000000001", "className": "ValetTicket" },
  "time": "2026-09-25T21:40:05Z",
  "data": {
    "id": "f8000000-0000-4000-8000-000000000001",
    "version": 4,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "ticketNumber": "V-0412",
    "dropOff": { "time": "2026-09-25T18:02:00Z", "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" }, "attendant": "valet:r.diaz" },
    "retrieval": { "requestedTime": "2026-09-25T21:40:04Z", "channel": "sms", "etaMinutes": 8, "promisedTime": "2026-09-25T21:48:00Z" },
    "valetStatus": "requested"
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000041",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f8000000-0000-4000-8000-000000000001", "className": "ValetTicket" },
  "time": "2026-09-25T21:41:30Z",
  "data": {
    "id": "f8000000-0000-4000-8000-000000000001",
    "version": 5,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "ticketNumber": "V-0412",
    "dropOff": { "time": "2026-09-25T18:02:00Z" },
    "retrieval": { "requestedTime": "2026-09-25T21:40:04Z", "channel": "sms", "retrievingBy": "valet:k.osei" },
    "valetStatus": "retrieving",
    "statusHistory": [
      { "state": "dropped", "time": "2026-09-25T18:02:00Z", "actor": "valet:r.diaz" },
      { "state": "parked", "time": "2026-09-25T18:09:12Z", "actor": "valet:r.diaz" },
      { "state": "requested", "time": "2026-09-25T21:40:04Z", "actor": "customer:sms" },
      { "state": "retrieving", "time": "2026-09-25T21:41:30Z", "actor": "valet:k.osei" }
    ]
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000042",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f2000000-0000-4000-8000-000000000902", "className": "ObservationElement" },
  "time": "2026-09-25T22:15:01Z",
  "data": {
    "id": "f2000000-0000-4000-8000-000000000902",
    "version": 1,
    "method": "anpr",
    "type": "licensePlate",
    "observedCredentialId": "SYN-1234",
    "observationStartTime": "2026-09-25T22:15:00Z",
    "creationDateTime": "2026-09-25T22:15:01Z",
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "location": { "observerLocation": { "type": "Point", "coordinates": [-122.3321, 47.6062] } },
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
    "vehicleAncillaryIdentification": { "country": "US" }
  }
}
```

---

## EVT-23 — The receiver's clock: the replay window and re-signed retries

<!-- apx:scenario EVT-23 kind=edge ics=APX-EVT-02,APX-EVT-04 -->

**Given** the city endpoint comes back at 02:40 during the EVT-05 outage,
but its clock is nine minutes slow. **When** the 02:42:30 retry arrives.
**Then** the receiver, applying the ±5 minute window, rejects it with
400 and the ledger records that code. Once NTP is fixed, the next retry
carries a fresh `APX-Timestamp` and a signature computed over it — the
same envelope `id`, a new `APX-Delivery-Id` — and is accepted. Part 8
§8.3 makes that re-signing normative: every attempt carries the time of
that attempt in `APX-Timestamp` and a signature over it, with the body
unchanged, so an hourly retry is as verifiable as the first attempt.
A captured delivery replayed by a third party twenty minutes later fails
the same window check and is dropped by the receiver.

```http
POST /apx/events HTTP/1.1                          attempt 6
Host: curb.city.example
APX-Timestamp: 2026-09-25T04:12:30Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000007
APX-Signature: v1=b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c

→ 400 Bad Request   (receiver: "APX-Timestamp outside ±5 min of local time 04:03:30Z")
```

```http
POST /apx/events HTTP/1.1                          attempt 7
Host: curb.city.example
APX-Timestamp: 2026-09-25T05:12:30Z
APX-Delivery-Id: ea000000-0000-4000-8000-000000000008
APX-Signature: v1=c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d

→ 200 OK
```

Both attempts carry the EVT-05 envelope unchanged (`e9…0002`). The ledger
afterwards:

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003/deliveries?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790313600, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000008",
      "eventId": "e9000000-0000-4000-8000-000000000002",
      "attempts": 7,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-25T05:12:31Z",
      "attemptHistory": [
        { "deliveryId": "ea000000-0000-4000-8000-000000000002", "time": "2026-09-25T02:00:00Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000003", "time": "2026-09-25T02:00:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000004", "time": "2026-09-25T02:02:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000005", "time": "2026-09-25T02:12:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000006", "time": "2026-09-25T03:12:30Z", "code": 503 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000007", "time": "2026-09-25T04:12:30Z", "code": 400 },
        { "deliveryId": "ea000000-0000-4000-8000-000000000008", "time": "2026-09-25T05:12:30Z", "code": 200 }
      ]
    },
    {
      "deliveryId": "ea000000-0000-4000-8000-000000000001",
      "eventId": "e9000000-0000-4000-8000-000000000001",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-09-24T22:15:04Z"
    }
  ]
}
```

---

## EVT-24 — Ending the rotation overlap; the write routes under a bad token

<!-- apx:scenario EVT-24 kind=security ics=APX-EVT-07,APX-CORE-07,APX-CORE-05 -->

**Given** every city receiver now verifies with `k-2026-09-26-b`. **When**
the city retires the old key, and then a mis-deployed job hammers the
subscription write routes with an expired token, a read-only token, and
no back-off. **Then** 200 with one `activeKeyIds` entry (the overlap
ended by the client, Part 8 §8.1), and the shared 401
`unauthenticated`, 403 `insufficient-scope`, and 429 `rate-limited`
on `POST /webhooks`, `GET`/`PATCH`/`DELETE /webhooks/{id}`.

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{
  "version": 6,
  "retireKeyIds": ["k-2026-09-24-a"]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000003",
  "version": 7,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["SessionCreated", "apx.alert.raised.v1", "apx.control.device.state.v1", "apx.data.occupancy.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "activeKeyIds": ["k-2026-09-26-b"],
  "status": "active"
}
```

Expired token:

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://jobs.city.example/apx",
  "topics": ["SessionCreated"]
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-27T03:00:00Z.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-27T03:00:00Z.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{ "status": "paused" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-27T03:00:00Z.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-27T03:00:00Z.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

Read-only token (`apx.data:read`):

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /webhooks/{id} requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{ "status": "paused" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PATCH /webhooks/{id} requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /webhooks/{id} requires scope apx.subscriptions:manage; token carries apx.data:read.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

No back-off:

<!-- apx:request POST /webhooks -->
```json
{
  "endpoint": "https://jobs.city.example/apx",
  "topics": ["SessionCreated"]
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Subscription management is limited to 10 requests per minute per credential; retry after 30 s.",
  "instance": "/webhooks"
}
```

<!-- apx:request GET /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Subscription management is limited to 10 requests per minute per credential; retry after 30 s.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PATCH /webhooks/e8000000-0000-4000-8000-000000000003 -->
```json
{ "status": "paused" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Subscription management is limited to 10 requests per minute per credential; retry after 30 s.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /webhooks/e8000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Subscription management is limited to 10 requests per minute per credential; retry after 30 s.",
  "instance": "/webhooks/e8000000-0000-4000-8000-000000000003"
}
```
