# Scenario 22 — Gateless lot: the car that came in through the exit lane

**The story.** Riverside Lot is a gateless surface lot: no barriers, pay
by plate, one entry lane and one exit lane side by side with nothing but
paint between them. Each lane has an LPR camera mounted to read the
traffic that lane is meant for. At 07:41 a grey pickup turns in through
the **exit** lane. The exit camera sees a rear plate going away from it —
a car it should only ever see head-on. The server calls it
`laneTravel: againstLane`, raises a `wrongWayTravel` alert, and still
opens the parking session for the plate: the driver owes for parking,
not for the lot's paint. At 09:12 a sedan leaves properly through the
same lane: front plate approaching, both plates read as it passes, make
and colour classified, and a second-ranked plate string the engine kept
in case the first was wrong.

**Actors.** Exit-lane LPR camera (`apx.data:write`, native ingest); the
operator's ops console (`apx.lpr:read`, `apx.alerts:read`) → Riverside
Lot APX server.

## Step 1 — 07:41: the camera reports what it saw

Ingest is the native APDS route. The camera adds the APX detail block in
the Observation's `extensions` container; a plain APDS consumer ignores
it and still sees a valid Observation with the plate, state, make, and
colour in the standard fields.

```http
POST /observations HTTP/1.1
Content-Type: application/json

{
  "id": "f2000000-0000-4000-8000-000000000741",
  "version": 1,
  "method": "anpr",
  "type": "licensePlate",
  "observedCredentialId": "RVR-8821",
  "observationStartTime": "2026-09-21T07:41:08Z",
  "creationDateTime": "2026-09-21T07:41:09Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess", "version": 3 },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000031", "className": "Organisation", "version": 1 },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Ford", "model": "F-150", "color": "grey" },
  "confidence": { "overallConfidence": 0.91 },
  "images": [ { "id": "img-741-plate", "imageType": "plate", "imageLink": "https://api.riverside-lot.example/lpr/f2000000-741-plate.jpg", "cameraID": "cam-exit-1" } ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "RVR-8821", "confidence": 0.91 },
      "stateProvince": { "value": "IL", "confidence": 0.88 },
      "make": { "value": "Ford", "confidence": 0.94 },
      "model": { "value": "F-150", "confidence": 0.71 },
      "color": { "value": "grey", "confidence": 0.83 },
      "bodyType": { "value": "pickup", "confidence": 0.96 },
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "receding",
      "captureGroup": "cam-exit-1/20260921T074108/0417",
      "engine": "vendor-x/7.2"
    }
  }
}
```

(Abridged native APDS payload; the APDS route validates it.)

## Step 2 — What the ops console sees

```http
GET /v1/lpr/reads?plate=RVR-8821 HTTP/1.1
```

<!-- apx:validate LprRead at /data/0 -->
<!-- apx:validate LprReadDetail at /data/0/detail -->
```json
{
  "meta": { "totalCount": 1 },
  "data": [
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.91,
      "detail": {
        "plate": { "value": "RVR-8821", "confidence": 0.91 },
        "stateProvince": { "value": "IL", "confidence": 0.88 },
        "make": { "value": "Ford", "confidence": 0.94 },
        "model": { "value": "F-150", "confidence": 0.71 },
        "color": { "value": "grey", "confidence": 0.83 },
        "bodyType": { "value": "pickup", "confidence": 0.96 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "receding",
        "captureGroup": "cam-exit-1/20260921T074108/0417",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "againstLane",
      "observation": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
      "observationDateTime": "2026-09-21T07:41:08Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-741-plate.jpg",
      "recentReservations": []
    }
  ]
}
```

The camera said only what it could see: a rear plate, moving away, one
plate read. The **server** knows the lane is APDS `accessType: exit`
and that this camera faces the vehicles it is meant to read — so a rear
plate receding is a vehicle driving *into* the lot through the exit:
`laneTravel: againstLane` (Part 13 §13.3a). The session `f1…0741` was
opened anyway; the pickup is parked and will be billed by plate.

## Step 3 — The alert

The read raised a `wrongWayTravel` alert (Part 7) with the Observation
as evidence:

```http
GET /v1/alerts?type=wrongWayTravel&place=b1000000-0000-4000-8000-000000000006&status=raised HTTP/1.1
```

<!-- apx:validate Alert at /data/0 -->
```json
{
  "meta": { "totalCount": 1 },
  "data": [
    {
      "id": "d1000000-0000-4000-8000-000000000741",
      "version": 1,
      "alertType": "wrongWayTravel",
      "severity": "warning",
      "status": "raised",
      "detectionTime": "2026-09-21T07:41:09Z",
      "occurrenceTime": "2026-09-21T07:41:08Z",
      "statusHistory": [
        { "state": "raised", "time": "2026-09-21T07:41:09Z", "actor": "server", "detail": "RVR-8821 rear/receding on exit lane b2…0061; observation f2…0741" }
      ]
    }
  ]
}
```

What the operator does with it — a variable-message sign, a courtesy
text if the plate is on an account, an enforcement candidate under
Part 19 if the signage says so — is policy. What APX guarantees is that
the fact exists, is attributed to a lane, and is backed by the image.

## Step 4 — 09:12: a proper exit, and what a good read looks like

A sedan leaves through the same lane. The camera reads the front plate
as it approaches and the rear plate as it passes under: two plates, one
passage, one `captureGroup`. The engine also kept its second choice for
the plate.

```http
GET /v1/lpr/reads?plate=KLM-4470 HTTP/1.1
```

<!-- apx:validate LprRead at /data/0 -->
```json
{
  "meta": { "totalCount": 2 },
  "data": [
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.97,
      "detail": {
        "plate": { "value": "KLM-4470", "confidence": 0.97 },
        "stateProvince": { "value": "IL", "confidence": 0.95 },
        "make": { "value": "Honda", "confidence": 0.92 },
        "model": { "value": "Accord", "confidence": 0.80 },
        "color": { "value": "blue", "confidence": 0.90 },
        "bodyType": { "value": "sedan", "confidence": 0.98 },
        "alternateReads": [ { "plate": "KLM-4478", "stateProvince": "IL", "confidence": 0.62 } ],
        "platesRead": 2,
        "plateFace": "front",
        "movement": "approaching",
        "captureGroup": "cam-exit-1/20260921T091202/0418",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "withLane",
      "observation": { "id": "f2000000-0000-4000-8000-000000000912", "className": "Observation" },
      "observationDateTime": "2026-09-21T09:12:02Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" },
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-912-front.jpg",
      "recentReservations": []
    },
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.93,
      "detail": {
        "plate": { "value": "KLM-4470", "confidence": 0.93 },
        "platesRead": 2,
        "plateFace": "rear",
        "movement": "receding",
        "captureGroup": "cam-exit-1/20260921T091202/0418",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "withLane",
      "observation": { "id": "f2000000-0000-4000-8000-000000000913", "className": "Observation" },
      "observationDateTime": "2026-09-21T09:12:04Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" },
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-913-rear.jpg",
      "recentReservations": []
    }
  ]
}
```

Two Observations, one `captureGroup`, both `withLane`: the front plate
approaching, then the rear plate receding *after* it passed — which on
an exit lane is exactly right, and is how `platesRead: 2` earns the
engine its confidence in `movement`. The model classification is the
weakest attribute at 0.80, and the console can say so instead of
presenting "Honda Accord" as fact. Had the plate been misread, the
Part 17 correction flow would have offered `KLM-4478` as the second
candidate without anyone retyping it. The session `f1…0655` closes on
this exit and is billed by plate.
