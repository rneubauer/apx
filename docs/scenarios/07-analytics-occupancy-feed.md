# Scenario 07 — The analytics feed: occupancy, payments, plate reads

**The story.** Lakeside Garage's owner runs a data analytics engine and
wants *everything* about the location in their own warehouse — utilization,
revenue, sensor traffic — without bespoke exports. One subscription plus
the change feed gives them full fidelity; the new occupancy read answers
"how full right now" on demand.

**Actors.** Analytics platform (`owner-bi` credential, scopes
`apx.data:read`, `apx.accounts:read`, `apx.subscriptions:manage`) →
Lakeside Garage APX server.

## Step 1 — One subscription, the whole story

The platform subscribes to APDS's native session lifecycle topics *and*
the APX analytics topics — payments, observations, occupancy — in a single
subscription (topics mix freely, Part 8):

```http
POST /webhooks HTTP/1.1
Content-Type: application/json
```

<!-- apx:validate ApxEventSubscription -->
```json
{
  "endpoint": "https://bi.lakeside-owner.example/apx/ingest",
  "topics": [
    "SessionCreated",
    "SessionUpdated",
    "apx.accounts.payment.recorded.v1",
    "apx.data.observation.created.v1",
    "apx.data.occupancy.v1"
  ],
  "transport": "webhook",
  "filters": {
    "places": ["b1000000-0000-4000-8000-000000000001"]
  }
}
```

APDS `EventTypeEnum` alone couldn't do this — it has no payment or
observation events. The `apx.*` topics exist precisely to close those two
gaps (Part 13 §13.4).

## Step 2 — Point-in-time: how full is it right now?

Dashboards don't want the whole Place hierarchy; they want one number:

```http
GET /v1/places/b1000000-0000-4000-8000-000000000001/occupancy HTTP/1.1
```

<!-- apx:validate OccupancySnapshot -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "computedAt": "2026-08-25T17:45:00Z",
  "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
  "demand": {
    "count": 361,
    "percentage": 85.9,
    "occupancyCalculation": "counted",
    "recordDateTime": "2026-08-25T17:44:30Z"
  },
  "available": 59
}
```

Verbatim APDS occupancy classes (`Supply`, `DemandType`) plus one derived
convenience: `available = supplyQuantity − count`, clamped at zero. The
Place hierarchy stays the source of truth (Part 5 §5.5).

## Step 3 — Evening peak: occupancy moves, the feed says so

At 17:52 the garage crosses its configured 90% threshold. The platform's
endpoint receives a signed delivery (signature mechanics in
[Scenario 03](03-data-sync-and-webhooks.md)):

<!-- apx:validate EventEnvelope -->
<!-- apx:validate OccupancySnapshot at /data -->
```json
{
  "id": "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  "type": "apx.data.occupancy.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "time": "2026-08-25T17:52:11Z",
  "data": {
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "computedAt": "2026-08-25T17:52:11Z",
    "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
    "demand": {
      "count": 379,
      "percentage": 90.2,
      "occupancyCalculation": "counted",
      "recordDateTime": "2026-08-25T17:52:00Z"
    },
    "available": 41
  }
}
```

Where the operator also runs `apx-alerts`, the same crossing raises an
`occupancyThresholdExceeded` alert for the ops team — the BI feed and the
ops workflow are fed by one fact, not two integrations.

## Step 4 — Money in real time

A transient parker pays at the exit lane. The revenue stream arrives as it
happens — no nightly report scraping:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "0b1c2d3e-4f5a-4b6c-8d7e-8f9a0b1c2d3e",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d1000000-0000-4000-8000-000000000042", "className": "PaymentRecord" },
  "time": "2026-08-25T18:03:27Z",
  "data": {
    "id": "d1000000-0000-4000-8000-000000000042",
    "transactionID": "TXN-2026-081547",
    "dateCollected": "2026-08-25T18:03:26Z",
    "amount": { "currencyType": "USD", "currencyValue": 18.00 },
    "method": "card",
    "paymentStatus": "approved",
    "ticketNumber": "T-100417",
    "cardLast4": "4242"
  }
}
```

`apx.data.observation.created.v1` deliveries look the same and carry the
APDS Observation — every camera read and RFID hit, streamed.

## Step 5 — Backfill and audit: the change feed

Events are for *now*; history and recovery use the Part 5 change feed on
the native routes — ordered, gapless, exactly-once, with tombstones:

```http
GET /sessions?mode=change&cursor=c%3A00812 HTTP/1.1
GET /observations?mode=change&cursor=c%3A00344 HTTP/1.1
```

A warehouse that goes offline for a night replays exactly what it missed.
Between the change feed (bulk history), the subscription (real time), and
the occupancy read (point-in-time), nothing about the location that APX
models is unreachable — which is the whole point.
