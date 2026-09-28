# Scenario 22 — Gateless lot: a shared driveway in the snow

**The story.** Riverside Lot is a gateless surface lot: no barriers, pay
by plate, one driveway with an entry lane and an exit lane side by side
and nothing but paint between them. Each lane has an LPR camera set up
the way most sites do it — to read **rear** plates. On a snowy morning
the entry lane is iced over, so a grey pickup turns in on the **exit**
lane. Both cameras see it: the exit-lane camera reads its front plate as
it comes in, the entry-lane camera its rear plate as it passes. The LPR
system reports both reads as what they were — an **entry** — and a
parking session opens. Nobody drove the wrong way; the driver just
avoided the ice. At 09:12 the pickup leaves on the exit lane, the exit
camera reads its rear plate, and the session closes. APX derives nothing
along the way: the cameras report what they saw, the LPR system says
entry or exit, and the session is the visit between them.

**Actors.** The site's LPR system (`apx.data:write`, native ingest; it
also maintains the lane configuration); the operator's ops console
(`apx.lpr:read`) → Riverside Lot APX server.

## Step 1 — How the cameras are set up

Each lane is an APDS `VehicularAccess`. Its `accessType` says what the
lane is for; the APX decoration `apds-ext:apx:lane-cameras@1.0` says
which cameras are on it and which way each faces (Part 13 §13.3a(5)).
The entry lane:

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000060",
  "version": 3,
  "accessType": "entry",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [ { "cameraId": "riverside/cam-entry-1", "faces": "inward" } ]
    }
  }
}
```

And the exit lane:

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000061",
  "version": 3,
  "accessType": "exit",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [ { "cameraId": "riverside/cam-exit-1", "faces": "outward" } ]
    }
  }
}
```

(Abridged: only the fields this scenario uses.) The entry camera looks
**into** the lot, the way entering cars travel, so it reads their rear
plates; the exit camera looks **out** toward the street, the way leaving
cars travel, so it reads theirs. Camera ids are unique within the place
— many engines number every camera `1`, so the LPR system prefixes the
site.

## Step 2 — 07:41: the pickup comes in on the exit lane

The exit camera sees a front plate coming **toward** it. It reports what
it saw; the LPR system adds what the read was:

```http
POST /observations HTTP/1.1
Content-Type: application/json

{
  "id": "f2000000-0000-4000-8000-000000000741",
  "version": 1,
  "method": "anpr",
  "type": "licensePlate",
  "observedCredentialId": "RVR-8821",
  "observationStartTime": "2026-12-14T07:41:08Z",
  "creationDateTime": "2026-12-14T07:41:09Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess", "version": 3 },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000031", "className": "Organisation", "version": 1 },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Ford", "model": "F-150", "color": "grey" },
  "confidence": { "overallConfidence": 0.91 },
  "images": [ { "id": "img-741-plate", "imageType": "plate", "imageLink": "https://api.riverside-lot.example/lpr/f2000000-741-plate.jpg", "cameraID": "riverside/cam-exit-1" } ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "RVR-8821", "confidence": 0.91 },
      "stateProvince": { "value": "IL", "confidence": 0.88 },
      "make": { "value": "Ford", "confidence": 0.94 },
      "model": { "value": "F-150", "confidence": 0.71 },
      "color": { "value": "grey", "confidence": 0.83 },
      "bodyType": { "value": "pickup", "confidence": 0.96 },
      "frameReads": 4,
      "platesRead": 2,
      "plateFace": "front",
      "plateBox": { "top": 0.52, "left": 0.29, "bottom": 0.59, "right": 0.36 },
      "movement": "toward",
      "accessEvent": "entry",
      "captureGroup": "riverside/20261214T074108/0417",
      "engine": "vendor-x/7.2"
    }
  }
}
```

(Abridged native APDS payload; the APDS route validates it.) The `id`
is the engine's own read id, so if the camera re-sends this read after a
network drop the server answers `409 id-collision` and no second read
appears (Part 13 §13.3a(8)). The location is the camera's configured
position; this camera has no GPS.

A moment later the entry camera catches the pickup's **rear** plate
moving **away** from it as the truck passes the entry lane — a second
Observation, `f2…0742`, in the same `captureGroup`, also
`accessEvent: entry`. How the LPR system decided "entry" is its own
business; here it is plain from the setup:

| Camera | `faces` | `movement` | Plate | So the vehicle was |
|---|---|---|---|---|
| `cam-exit-1` | outward | toward | front | entering |
| `cam-entry-1` | inward | away | rear | entering |

## Step 3 — What the ops console sees

```http
GET /v1/lpr/reads?plate=RVR-8821 HTTP/1.1
```

<!-- apx:validate LprRead at /data/0 -->
<!-- apx:validate LprRead at /data/1 -->
<!-- apx:validate LprReadDetail at /data/0/detail -->
```json
{
  "meta": { "totalCount": 2 },
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
        "frameReads": 4,
        "platesRead": 2,
        "plateFace": "front",
        "plateBox": { "top": 0.52, "left": 0.29, "bottom": 0.59, "right": 0.36 },
        "movement": "toward",
        "accessEvent": "entry",
        "captureGroup": "riverside/20261214T074108/0417",
        "engine": "vendor-x/7.2"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
      "observationDateTime": "2026-12-14T07:41:08Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "riverside/cam-exit-1",
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-741-plate.jpg",
      "recentReservations": []
    },
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.95,
      "detail": {
        "plate": { "value": "RVR-8821", "confidence": 0.95 },
        "stateProvince": { "value": "IL", "confidence": 0.93 },
        "frameReads": 3,
        "platesRead": 2,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "riverside/20261214T074108/0417",
        "engine": "vendor-x/7.2"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000742", "className": "Observation" },
      "observationDateTime": "2026-12-14T07:41:09Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000060", "className": "VehicularAccess" },
      "cameraId": "riverside/cam-entry-1",
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-742-plate.jpg",
      "recentReservations": []
    }
  ]
}
```

Two reads, two cameras, two lanes, one passage (`captureGroup`), one
entry, one session. The read on the exit lane is still an entry: the
lane a car uses doesn't change what it did (Part 13 §13.3a(6)). There is
no wrong-way flag and no alert — on a driveway with nothing but paint,
a car avoiding ice is not an incident. The rear-plate read scored
higher, and a platform that prefers rear plates may lean on it; that
preference is the platform's, not APX's. Session `f1…0741` opened at
07:41:08, the capture time of the passage's first read.

## Step 4 — 09:12: the pickup leaves, and the whole visit

The pickup leaves on the exit lane. The exit camera, facing out, reads
its rear plate moving away — `accessEvent: exit` — and the session
closes. The console asks for everything behind the visit:

```http
GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000741 HTTP/1.1
```

<!-- apx:validate LprRead at /data/2 -->
<!-- apx:validate LprReadDetail at /data/2/detail -->
```json
{
  "meta": { "totalCount": 3 },
  "data": [
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.91,
      "detail": { "plateFace": "front", "movement": "toward", "accessEvent": "entry", "captureGroup": "riverside/20261214T074108/0417" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
      "observationDateTime": "2026-12-14T07:41:08Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "cameraId": "riverside/cam-exit-1"
    },
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.95,
      "detail": { "plateFace": "rear", "movement": "away", "accessEvent": "entry", "captureGroup": "riverside/20261214T074108/0417" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000742", "className": "Observation" },
      "observationDateTime": "2026-12-14T07:41:09Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "cameraId": "riverside/cam-entry-1"
    },
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.97,
      "detail": {
        "plate": { "value": "RVR-8821", "confidence": 0.97 },
        "stateProvince": { "value": "IL", "confidence": 0.95 },
        "alternateReads": [ { "plate": "RVR-8827", "stateProvince": "IL", "confidence": 0.58 } ],
        "frameReads": 5,
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "exit",
        "captureGroup": "riverside/20261214T091202/0418",
        "engine": "vendor-x/7.2"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000912", "className": "Observation" },
      "observationDateTime": "2026-12-14T09:12:02Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "riverside/cam-exit-1",
      "imageLink": "https://api.riverside-lot.example/lpr/f2000000-912-plate.jpg",
      "recentReservations": []
    }
  ]
}
```

(The two entry reads are abridged here; Step 3 shows them in full.) The
exit camera saw one plate only, yet it still reports `movement: away`:
the engine read that plate in five frames, and two are enough to tell
toward from away (Part 13 §13.3a(3)). The engine also kept its
second-choice plate, `RVR-8827`, so a Part 17 correction could offer it
without anyone retyping it. The session runs 07:41:08–09:12:02 and is
billed by plate — its times come from when the cameras saw the truck,
not from when the reads reached the server, which on a bad-signal day
can be hours later (Part 13 §13.3a(8)).
