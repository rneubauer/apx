# Scenario 23 — EV charging (EXPERIMENTAL): the camera catches an ICE in the bay, a free-vend charge rolls onto the parking bill, idle after complete, and a cable that won't let go

> Exercises the **experimental** proposed class `apx-charging` (Part 23,
> branch `beta/ev-charging`). Payloads are validated against the bundle
> like every other scenario; the class itself is not yet registered.

**The story.** Lakeside Garage has two chargers on P1. Its chargers
free-vend — anyone who plugs in charges — and the garage attributes the
energy to the parking stay by reading the plate with the overhead bay
camera, so the driver pays once at exit. Monday morning the camera sees
a car in bay E2 that never plugs in; make recognition says it is not an
EV. A driver plugs into E1 at 08:12; the charging-network bridge reports
plug-in, start, and meter values; the driver's app shows "62%, about 40
minutes". Charging completes at 09:20; ten minutes of grace pass; idle
begins and a text goes out. At 09:41 the driver is back but the cable
will not release — the agent console sends an `unlockConnector`
command. Unplugged at 09:43: 24.6 kWh and 13 idle minutes, both lines
on the parking session, paid at the exit pay station.

**Actors.** Charging-network bridge (`apx.charging:manage`); overhead
camera analytics (`apx.charging:manage`); the driver's PWA
(`apx.charging:status`, bound to this session); agent console
(`apx.control:execute`, `apx.charging:read`) → Lakeside Garage APX
server.

## Step 1 — Monday 08:05: what is on P1

```http
GET /v1/charging/points?place=b1000000-0000-4000-8000-000000000005 HTTP/1.1
```

<!-- apx:validate ChargingPointStatus at /data/0 -->
<!-- apx:validate ChargingPointStatus at /data/1 -->
<!-- apx:validate ChargingBayPresence at /data/1/bay -->
```json
{
  "meta": { "totalCount": 2 },
  "data": [
    {
      "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "space": { "id": "b3000000-0000-4000-8000-000000000301", "className": "Space" },
      "refillPointIndex": 1,
      "evseId": "US*LSG*E20419*1",
      "availability": "available",
      "connectors": [
        { "connectorIndex": 1, "connectorType": "iec62196T1", "availability": "available" }
      ],
      "bay": { "presence": "empty", "source": "overheadCamera", "observedTime": "2026-09-21T08:04:50Z", "sinceTime": "2026-09-21T06:12:00Z", "confidence": 0.98 },
      "lastCommunication": "2026-09-21T08:04:58Z",
      "stateChangedTime": "2026-09-21T06:12:00Z"
    },
    {
      "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000002", "className": "ElectricChargingEquipment" },
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "space": { "id": "b3000000-0000-4000-8000-000000000302", "className": "Space" },
      "refillPointIndex": 2,
      "evseId": "US*LSG*E20419*2",
      "availability": "blocked",
      "connectors": [
        { "connectorIndex": 1, "connectorType": "iec62196T1", "availability": "available" }
      ],
      "bay": {
        "presence": "vehicleNotPluggedIn",
        "source": "overheadCamera",
        "observation": { "id": "c1000000-0000-4000-8000-000000000901", "className": "Observation" },
        "observedTime": "2026-09-21T08:04:50Z",
        "sinceTime": "2026-09-21T07:51:20Z",
        "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KRT-2210", "jurisdiction": "US-IL", "evCapable": false },
        "confidence": 0.93,
        "imageLink": "https://api.lakeside-garage.example/charging/e2/2026-09-21T0751-overhead.jpg",
        "detail": "make/model recognition: gasoline SUV"
      },
      "lastCommunication": "2026-09-21T08:04:58Z",
      "stateChangedTime": "2026-09-21T07:51:20Z"
    }
  ]
}
```

E1 is free. E2's charger says its connector is `available` — and the
camera says a car has been sitting in front of it since 07:51 without
plugging in, and it is not an EV. The server fused the two (Part 23
§23.3): `presence: vehicleNotPluggedIn`, point `availability: blocked`.
Thirteen minutes in, past the garage's ten-minute grace, an
`iceInEvSpace` alert (Part 7, seeded) is already open with the camera
Observation as evidence; the enforcement policy decides whether a
`restrictedSpace` violation follows.

The camera's report that produced it looked like this (idempotent —
cameras re-send):

```http
POST /v1/charging/points/b6000000-0000-4000-8000-000000000002/bay HTTP/1.1
Idempotency-Key: cam-p1-e2-20260921T075120
Content-Type: application/json

{
  "presence": "vehicleNotPluggedIn",
  "source": "overheadCamera",
  "observation": { "id": "c1000000-0000-4000-8000-000000000901", "className": "Observation" },
  "observedTime": "2026-09-21T07:51:20Z",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KRT-2210", "jurisdiction": "US-IL", "evCapable": false },
  "confidence": 0.93,
  "imageLink": "https://api.lakeside-garage.example/charging/e2/2026-09-21T0751-overhead.jpg",
  "detail": "make/model recognition: gasoline SUV"
}
```

## Step 2 — 08:12: a plug-in at E1 opens a session on the parking stay

The bridge sees the connector go occupied on E1. The chargers free-vend,
so there is no card or app authorization; the bay camera reads
SYN-7734, which entered at 08:09 and has APDS Session `f1…0777`. The
bridge opens the ChargingSession against that stay:

```http
POST /v1/charging/sessions HTTP/1.1
Idempotency-Key: ocpp-lsg-e1-tx-88213
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "connectorIndex": 1,
  "evseId": "US*LSG*E20419*1",
  "space": { "id": "b3000000-0000-4000-8000-000000000301", "className": "Space" },
  "parkingSession": { "id": "f1000000-0000-4000-8000-000000000777", "className": "Session" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL" },
  "authorization": {
    "method": "unlimitedAccess",
    "methodDetail": "free-vend; attributed to the parking session by bay LPR (SYN-7734)",
    "authorizedTime": "2026-09-21T08:12:04Z",
    "authorizedBy": "bridge-lsg-01"
  },
  "idlePolicy": { "graceMinutes": 10, "idleRate": { "currencyType": "USD", "currencyValue": 0.40 }, "idleRatePer": "minute", "maxIdleMinutes": 60, "appliesToSettlement": true },
  "settlement": { "mode": "parkingSession" },
  "network": { "partyId": "US-LSG", "ocppTransactionId": "tx-88213" }
}
```

<!-- apx:validate ChargingSession -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000042",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "connectorIndex": 1,
  "evseId": "US*LSG*E20419*1",
  "space": { "id": "b3000000-0000-4000-8000-000000000301", "className": "Space" },
  "parkingSession": { "id": "f1000000-0000-4000-8000-000000000777", "className": "Session" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL" },
  "authorization": {
    "method": "unlimitedAccess",
    "methodDetail": "free-vend; attributed to the parking session by bay LPR (SYN-7734)",
    "authorizedTime": "2026-09-21T08:12:04Z",
    "authorizedBy": "bridge-lsg-01"
  },
  "chargingStatus": "authorized",
  "timeline": { "authorizedTime": "2026-09-21T08:12:04Z" },
  "idlePolicy": { "graceMinutes": 10, "idleRate": { "currencyType": "USD", "currencyValue": 0.40 }, "idleRatePer": "minute", "maxIdleMinutes": 60, "appliesToSettlement": true },
  "settlement": { "mode": "parkingSession" },
  "network": { "partyId": "US-LSG", "ocppTransactionId": "tx-88213" },
  "statusHistory": [
    { "state": "authorized", "time": "2026-09-21T08:12:04Z", "actor": "bridge-lsg-01", "detail": "free-vend; parking session f1…0777 by bay LPR" }
  ]
}
```

## Step 3 — The bridge reports the timeline

Each OCPP transaction event becomes one APX `ChargingEvent`:

```http
POST /v1/charging/sessions/e2000000-0000-4000-8000-000000000042/events HTTP/1.1
Idempotency-Key: ocpp-tx-88213-seq-1
Content-Type: application/json

{ "eventType": "pluggedIn", "time": "2026-09-21T08:12:04Z", "connectorIndex": 1, "externalEventId": "tx-88213/1" }
```

```http
POST /v1/charging/sessions/e2000000-0000-4000-8000-000000000042/events HTTP/1.1
Idempotency-Key: ocpp-tx-88213-seq-2
Content-Type: application/json

{ "eventType": "chargingStarted", "time": "2026-09-21T08:12:19Z", "meterWh": 1418320, "powerKw": 7.1, "stateOfChargePercent": 31, "externalEventId": "tx-88213/2" }
```

Meter values follow every few minutes. At 08:55:

```http
POST /v1/charging/sessions/e2000000-0000-4000-8000-000000000042/events HTTP/1.1
Idempotency-Key: ocpp-tx-88213-seq-9
Content-Type: application/json

{ "eventType": "meterValue", "time": "2026-09-21T08:55:00Z", "meterWh": 1423460, "powerKw": 7.2, "stateOfChargePercent": 62, "externalEventId": "tx-88213/9" }
```

## Step 4 — 08:55: the driver's app

The PWA reads on the driver's own token:

```http
GET /v1/charging/sessions/e2000000-0000-4000-8000-000000000042 HTTP/1.1
```

<!-- apx:validate ChargingSession -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000042",
  "version": 10,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "connectorIndex": 1,
  "vehicle": { "credentialType": "licensePlate", "jurisdiction": "US-IL" },
  "authorization": { "method": "unlimitedAccess", "authorizedTime": "2026-09-21T08:12:04Z" },
  "chargingStatus": "charging",
  "timeline": { "authorizedTime": "2026-09-21T08:12:04Z", "pluggedInTime": "2026-09-21T08:12:04Z", "chargingStartedTime": "2026-09-21T08:12:19Z" },
  "energy": { "meterStartWh": 1418320, "deliveredKwh": 5.14, "currentPowerKw": 7.2, "peakPowerKw": 7.3, "stateOfChargePercent": 62, "lastMeterTime": "2026-09-21T08:55:00Z" },
  "idlePolicy": { "graceMinutes": 10, "idleRate": { "currencyType": "USD", "currencyValue": 0.40 }, "idleRatePer": "minute", "maxIdleMinutes": 60, "appliesToSettlement": true },
  "cost": { "energy": { "currencyType": "USD", "currencyValue": 1.80 }, "total": { "currencyType": "USD", "currencyValue": 1.80 }, "pricedAt": "2026-09-21T08:55:00Z" },
  "settlement": { "mode": "parkingSession" }
}
```

This is the **minimized** read (Part 23 §23.6): no plate value, no
credential, no contract id, no network identifiers. The app shows "62%
· 5.1 kWh · $1.80 so far · charged to your parking" and, from
`idlePolicy`, the warning it will need later: "10 minutes grace after
charging completes, then $0.40/min".

## Step 5 — 09:20 complete, 09:30 idle

```http
POST /v1/charging/sessions/e2000000-0000-4000-8000-000000000042/events HTTP/1.1
Idempotency-Key: ocpp-tx-88213-seq-15
Content-Type: application/json

{ "eventType": "chargingEnded", "time": "2026-09-21T09:20:41Z", "meterWh": 1442920, "stopReason": "evFull", "stateOfChargePercent": 100, "externalEventId": "tx-88213/15" }
```

The session is `complete`; the app says "Charging complete — please
move your car by 09:30". Nobody comes. At 09:30:41 the server, not the
bridge, moves it to `idle` and publishes the hand-off event:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ChargingSession at /data -->
```json
{
  "id": "9c000000-0000-4000-8000-000000000930",
  "type": "apx.charging.idle.started.v1",
  "source": "https://api.lakeside-garage.example",
  "time": "2026-09-21T09:30:41Z",
  "subject": { "id": "e2000000-0000-4000-8000-000000000042", "className": "ChargingSession" },
  "data": {
    "id": "e2000000-0000-4000-8000-000000000042",
    "version": 17,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
    "connectorIndex": 1,
    "space": { "id": "b3000000-0000-4000-8000-000000000301", "className": "Space" },
    "parkingSession": { "id": "f1000000-0000-4000-8000-000000000777", "className": "Session" },
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL" },
    "chargingStatus": "idle",
    "timeline": { "authorizedTime": "2026-09-21T08:12:04Z", "pluggedInTime": "2026-09-21T08:12:04Z", "chargingStartedTime": "2026-09-21T08:12:19Z", "chargingEndedTime": "2026-09-21T09:20:41Z", "idleStartedTime": "2026-09-21T09:30:41Z" },
    "energy": { "meterStartWh": 1418320, "meterStopWh": 1442920, "deliveredKwh": 24.6, "peakPowerKw": 7.3, "stateOfChargePercent": 100, "lastMeterTime": "2026-09-21T09:20:41Z" },
    "stopReason": "evFull",
    "idlePolicy": { "graceMinutes": 10, "idleRate": { "currencyType": "USD", "currencyValue": 0.40 }, "idleRatePer": "minute", "maxIdleMinutes": 60, "appliesToSettlement": true },
    "settlement": { "mode": "parkingSession" },
    "statusHistory": [
      { "state": "authorized", "time": "2026-09-21T08:12:04Z", "actor": "bridge-lsg-01" },
      { "state": "pluggedIn", "time": "2026-09-21T08:12:04Z", "actor": "bridge-lsg-01" },
      { "state": "charging", "time": "2026-09-21T08:12:19Z", "actor": "bridge-lsg-01" },
      { "state": "complete", "time": "2026-09-21T09:20:41Z", "actor": "bridge-lsg-01", "detail": "evFull; 24.6 kWh" },
      { "state": "idle", "time": "2026-09-21T09:30:41Z", "actor": "server", "detail": "grace 10 min elapsed" }
    ]
  }
}
```

The notification consumer texts "Your car is occupying a charger —
$0.40/min from now". The enforcement consumer starts a 60-minute clock
(`maxIdleMinutes`) toward a `chargingBayIdle` candidate it will never
need. E1's point status is `occupied`, bay `vehiclePluggedIn`.

## Step 6 — 09:41: "it won't let go of the cable"

The driver is back, the connector is latched. The intercom call lands on
an agent whose Part 17 context shows the session in `idle` at E1 and
offers `unlockConnector` as an allowed action:

```http
POST /v1/commands HTTP/1.1
Idempotency-Key: agent-0219-20260921-094112
Content-Type: application/json

{
  "commandType": "unlockConnector",
  "target": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "parameters": { "connectorIndex": 1, "chargingSession": { "id": "e2000000-0000-4000-8000-000000000042", "className": "ChargingSession" } },
  "reason": "customer at charger, connector latched after complete",
  "expiryTime": "2026-09-21T09:46:12Z"
}
```

<!-- apx:validate Command -->
```json
{
  "id": "a5000000-0000-4000-8000-000000000111",
  "version": 3,
  "commandType": "unlockConnector",
  "target": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "parameters": { "connectorIndex": 1, "chargingSession": { "id": "e2000000-0000-4000-8000-000000000042", "className": "ChargingSession" } },
  "reason": "customer at charger, connector latched after complete",
  "expiryTime": "2026-09-21T09:46:12Z",
  "status": "succeeded",
  "confirmationLevel": "deviceAcknowledged",
  "statusHistory": [
    { "state": "received", "time": "2026-09-21T09:41:12Z", "actor": "agent-0219" },
    { "state": "dispatched", "time": "2026-09-21T09:41:13Z", "actor": "bridge-lsg-01" },
    { "state": "succeeded", "time": "2026-09-21T09:41:15Z", "actor": "bridge-lsg-01", "detail": "UnlockConnector: Unlocked" }
  ]
}
```

`confirmationLevel: deviceAcknowledged` — the charger said it unlocked;
the agent says "the unlock was accepted, try now", not "the cable is
free" (Part 6 §6.1). `unlockConnector` is a proposed command type; until
registered, the operator publishes it in its own code list (Part 11
§11.3 interim path).

## Step 7 — 09:43: unplugged, and the bill

```http
POST /v1/charging/sessions/e2000000-0000-4000-8000-000000000042/events HTTP/1.1
Idempotency-Key: ocpp-tx-88213-seq-16
Content-Type: application/json

{ "eventType": "unplugged", "time": "2026-09-21T09:43:30Z", "externalEventId": "tx-88213/16" }
```

<!-- apx:validate ChargingSession -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000042",
  "version": 18,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "chargingPoint": { "id": "b6000000-0000-4000-8000-000000000001", "className": "ElectricChargingEquipment" },
  "connectorIndex": 1,
  "evseId": "US*LSG*E20419*1",
  "space": { "id": "b3000000-0000-4000-8000-000000000301", "className": "Space" },
  "parkingSession": { "id": "f1000000-0000-4000-8000-000000000777", "className": "Session" },
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL" },
  "authorization": { "method": "unlimitedAccess", "methodDetail": "free-vend; attributed to the parking session by bay LPR (SYN-7734)", "authorizedTime": "2026-09-21T08:12:04Z", "authorizedBy": "bridge-lsg-01" },
  "chargingStatus": "unplugged",
  "timeline": {
    "authorizedTime": "2026-09-21T08:12:04Z",
    "pluggedInTime": "2026-09-21T08:12:04Z",
    "chargingStartedTime": "2026-09-21T08:12:19Z",
    "chargingEndedTime": "2026-09-21T09:20:41Z",
    "idleStartedTime": "2026-09-21T09:30:41Z",
    "unpluggedTime": "2026-09-21T09:43:30Z"
  },
  "energy": { "meterStartWh": 1418320, "meterStopWh": 1442920, "deliveredKwh": 24.6, "peakPowerKw": 7.3, "stateOfChargePercent": 100, "lastMeterTime": "2026-09-21T09:20:41Z" },
  "stopReason": "evFull",
  "idlePolicy": { "graceMinutes": 10, "idleRate": { "currencyType": "USD", "currencyValue": 0.40 }, "idleRatePer": "minute", "maxIdleMinutes": 60, "appliesToSettlement": true },
  "cost": {
    "energy": { "currencyType": "USD", "currencyValue": 8.61 },
    "idle": { "currencyType": "USD", "currencyValue": 5.20 },
    "total": { "currencyType": "USD", "currencyValue": 13.81 },
    "tariffReference": "lsg-l2-std-2026",
    "pricedAt": "2026-09-21T09:43:30Z"
  },
  "settlement": { "mode": "parkingSession" },
  "network": { "partyId": "US-LSG", "ocppTransactionId": "tx-88213" },
  "statusHistory": [
    { "state": "authorized", "time": "2026-09-21T08:12:04Z", "actor": "bridge-lsg-01" },
    { "state": "pluggedIn", "time": "2026-09-21T08:12:04Z", "actor": "bridge-lsg-01" },
    { "state": "charging", "time": "2026-09-21T08:12:19Z", "actor": "bridge-lsg-01" },
    { "state": "complete", "time": "2026-09-21T09:20:41Z", "actor": "bridge-lsg-01", "detail": "evFull; 24.6 kWh" },
    { "state": "idle", "time": "2026-09-21T09:30:41Z", "actor": "server", "detail": "grace 10 min elapsed" },
    { "state": "unplugged", "time": "2026-09-21T09:43:30Z", "actor": "bridge-lsg-01", "detail": "idle 13 min; energy $8.61 + idle $5.20 posted to session f1…0777" }
  ]
}
```

Twenty-four point six kilowatt-hours and thirteen idle minutes are two
lines on APDS Session `f1…0777`, next to the parking. The driver pays
$13.81 plus parking at the exit pay station; when that session settles,
this one becomes `closed` — `POST …/payment` was never called, because
`settlement.mode` is `parkingSession`. Had this been a network-billed
charger (`chargingNetwork`), the garage would hold the same energy and
idle record with no money on it, and the driver's charging app would
have the bill.

E1 is `available` again; E2 is still `blocked`, and that is the
enforcement officer's next stop.
