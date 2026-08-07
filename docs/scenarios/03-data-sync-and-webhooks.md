# Scenario 03 — Data sync & signed webhooks

**The story.** The city's curb-management platform onboards Lakeside Garage.
It needs three things: to discover what the server offers, to pull the data
it's entitled to and stay in sync forever, and to receive push events it can
cryptographically trust.

**Actors.** City platform (`city-platform` credential, scopes
`apx.data:read`, `apx.subscriptions:manage`) → Lakeside Garage APX server.

## Step 1 — Bootstrap: one well-known URL

Everything starts unauthenticated at the standard discovery address:

```http
GET /.well-known/apx-configuration HTTP/1.1
Host: api.lakeside-garage.example
```

<!-- apx:validate ApxConfiguration -->
```json
{
  "apxVersion": "0.1.0",
  "apdsVersion": "4.1",
  "tokenEndpoint": "https://api.lakeside-garage.example/oauth/token",
  "conformanceClasses": ["apx-data", "apx-events", "apx-control", "apx-alerts", "apx-discovery"],
  "registries": {
    "apx-topics": "https://apx-standard.org/registries/apx-topics.json",
    "apx-alert-types": "https://apx-standard.org/registries/apx-alert-types.json"
  }
}
```

The document names the token endpoint and the conformance classes this
server claims — the city platform now knows `apx-data` and `apx-events` are
available before sending a single credential.

## Step 2 — OAuth2 client credentials

```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=city-platform&client_secret=…&scope=apx.data%3Aread+apx.subscriptions%3Amanage
```

```json
{ "access_token": "eyJ…", "token_type": "Bearer", "expires_in": 3600 }
```

All following requests carry `Authorization: Bearer eyJ…`.

## Step 3 — Initial pull: stock APDS 4.1, byte for byte

The data plane **is** APDS. The first sync uses the native routes exactly as
the APDS 4.1 spec defines them (payloads abridged here — they are stock
APDS `Place`/`Session` shapes):

```http
GET /places HTTP/1.1
GET /sessions?modified_since=2026-08-01T00:00:00Z HTTP/1.1
```

A plain APDS 4.1 client could stop here and be fully functional. APX adds
the next part.

## Step 4 — Staying in sync: the change feed

Re-pulling everything nightly doesn't scale. APX adds `mode=change` to the
same native list routes; the response is a `ChangeFeedPage`:

```http
GET /sessions?mode=change&cursor=c%3A00041 HTTP/1.1
```

<!-- apx:validate ChangeFeedPage -->
```json
{
  "publicationTime": "2026-08-06T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "f1000000-0000-4000-8000-000000000001",
      "version": 4,
      "className": "Session",
      "segments": [{ "actualEnd": "2026-08-06T18:14:34Z" }]
    }
  ],
  "deleted": [
    {
      "id": "f1000000-0000-4000-8000-000000000099",
      "className": "Session",
      "deleteTimestamp": "2026-08-06T17:58:12Z"
    }
  ],
  "cursor": "c:00042",
  "next": null
}
```

Three guarantees carry the sync: replaying a cursor yields every change
after it **exactly once**; deletions arrive as explicit **tombstones**
(never silent disappearance); and a cursor older than the server's history
window gets problem `target-not-found`, telling the client to re-sync with
`mode=full`. `next: null` means the feed is drained — poll again later with
`cursor=c:00042`.

## Step 5 — Push: subscribe to events

Polling is for catch-up; webhooks are for now. The subscription is a
superset of the stock APDS `EventSubscription`:

```http
POST /webhooks HTTP/1.1
Content-Type: application/json
```

<!-- apx:validate ApxEventSubscription -->
```json
{
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  }
}
```

`201 Created` returns the subscription with the signing secret —
**disclosed exactly once**:

<!-- apx:validate ApxEventSubscription -->
```json
{
  "id": "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
  "version": 1,
  "endpoint": "https://curb.city.example/apx/events",
  "topics": ["apx.alert.raised.v1", "apx.control.device.state.v1"],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"],
    "severityFloor": "warning"
  },
  "secret": "whsec_9f8e7d6c5b4a39281706f5e4d3c2b1a0",
  "status": "active"
}
```

## Step 6 — A delivery arrives, signed

When the pay station in [Scenario 02](02-call-center-gate-vend.md) faults,
the city platform's endpoint receives:

```http
POST /apx/events HTTP/1.1
Host: curb.city.example
Content-Type: application/json
APX-Timestamp: 2026-08-06T18:17:41Z
APX-Signature: v1=6d1f7e0a8c2b4e9d1a3c5f7b9e0d2c4a6f8b0d1e3a5c7f9b1d3e5a7c9f0b2d4e
```

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "2a3b4c5d-6e7f-4890-9a0b-1c2d3e4f5a6b",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e", "className": "Alert" },
  "time": "2026-08-06T18:17:41Z",
  "data": {
    "id": "7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e",
    "version": 1,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "raised",
    "detectionTime": "2026-08-06T18:17:41Z"
  }
}
```

The receiver verifies before trusting (and rejects anything outside the
±5-minute replay window):

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

const expected = createHmac('sha256', secret)
  .update(`${req.headers['apx-timestamp']}.${rawBody}`)
  .digest('hex');
const received = req.headers['apx-signature'].slice('v1='.length);
const ok = timingSafeEqual(Buffer.from(expected), Buffer.from(received));
```

## Step 7 — Trust, then verify the fabric itself

Did every event actually arrive? The delivery ledger is queryable:

```http
GET /webhooks/3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f/deliveries HTTP/1.1
```

<!-- apx:validate DeliveryRecord at /data/0 -->
<!-- apx:validate DeliveryRecord at /data/1 -->
```json
{
  "data": [
    {
      "deliveryId": "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a",
      "eventId": "2a3b4c5d-6e7f-4890-9a0b-1c2d3e4f5a6b",
      "attempts": 1,
      "status": "delivered",
      "lastCode": 200,
      "time": "2026-08-06T18:17:42Z"
    },
    {
      "deliveryId": "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
      "eventId": "1f2e3d4c-5b6a-4798-8c9d-0e1f2a3b4c5d",
      "attempts": 3,
      "status": "retrying",
      "lastCode": 503,
      "time": "2026-08-06T18:18:10Z"
    }
  ]
}
```

Retries follow the normative backoff schedule; a subscription that keeps
failing flips to `status: failed` and emits `apx.subscription.failed.v1` —
the fabric reports on itself.
