# apx-lpr — vetting scenarios

<!-- apx:module apx-lpr tag=LPR ics=LPR -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-lpr`. Gaps the spec cannot express are marked
`gap=F-LPR-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), entry lane 1 `b2…0001`
(APDS `accessType: entry`), exit lane 2 `b2…0002` (`accessType: exit`),
entry camera `cam-entry-1` (`c1…0011`), exit camera `cam-exit-2`
(`c1…0012`). Both read **rear** plates, as almost every real site does:
the entry camera faces `inward` and the exit camera `outward`, so a
vehicle using either lane normally moves `away` from its camera.
Riverside Lot (`b1…0006`) is the same operator's gateless surface lot,
pay by plate: entry lane `b2…0060` (camera `cam-in-1`, faces `inward`;
and an old front-plate camera `cam-in-1f`, faces `outward`) and exit lane
`b2…0061` (`cam-exit-1`, faces `outward`; `cam-exit-1f`, faces `inward`)
share one unseparated driveway, so in snow cars use whichever side is
clear. Lakeside's reversible centre lane `b2…0004` carries `cam-rev-in`
and `cam-rev-out`. Harbor Deck
(`b1…0002`, exit lane `b2…0003`, session `f1…0203`, plate `HBR-5510`)
is a different operator's garage the token has no grant for. The
operator organisation is `a1…0001`. Observations are `f2…09NN`,
sessions `f1…`, event ids `e9…`. Plates: `SYN-1234` (ticket `T-1001`,
session `f1…0001`), `SVN-4821` misread at entry as `5VN-4B21` (session
`f1…0031`, reservation `e2…0014`), `RVR-8821` and `KLM-4470` at
Riverside, and `PXQ-2200`, a car that came in through a lane with no
camera.

Every request carries `Authorization: Bearer …` with scopes
`apx.lpr:read apx.data:write` and `apx_places` =
`["b1…0001", "b1…0006"]` unless the scenario says otherwise. LPR cameras
ingest with `apx.data:write` on the native APDS route. Ingest sends the Observation as the LPR system knows it, including
`accessEvent` (entry or exit), which the LPR system decides and the
server never infers (§13.3a(4)); `ticketNumber`, `session`, and
`recentReservations` are server-side joins that appear only on
`LprRead`. `laneTravel` is deprecated since 0.12.0 and always `unknown`
here.

The native ingest validates through the data overlay since 0.11.0,
which works around the upstream APDS issues F-LPR-01 and F-LPR-02
(errata 005 and 006). The 0.12.0 gaps found on 2026-09-28 (F-LPR-16, -18, -19) are fixed in
0.12.1; the upstream half of F-LPR-17 (erratum 013) is described in
LPR-23.

---

## LPR-01 — Entry camera ingests a read with the APX detail block; the event follows

<!-- apx:scenario LPR-01 kind=happy ics=APX-LPR-01,APX-LPR-02,APX-LPR-03 -->

**Given** `SYN-1234` drives into entry lane 1 at 08:02 and the camera's
engine classifies plate, state, make, model, and colour, each with its
own confidence. **When** the camera posts the native APDS Observation
with the `apds-ext:apx:lpr-read@1.0` decoration in `extensions`, the
winning values mirrored into `observedCredentialId` and
`vehicleAncillaryIdentification`, and the still as an `Image` link.
**Then** the server stores it as a plain Observation (an APDS-only reader
sees a valid one), binds it to the lane, and publishes
`apx.data.observation.created.v1` with the Observation as `data` and
`subject` referencing it. The APDS schema declares no `extensions`
member on `ObservationElement`, so the decoration rides as an undeclared
additional property (F-LPR-03).

```http
POST /observations
Authorization: Bearer <cam-entry-1: apx.data:write>
Content-Type: application/json
```

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000901",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "SYN-1234",
  "observationStartTime": "2026-09-24T08:02:02Z",
  "creationDateTime": "2026-09-24T08:02:03Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Toyota", "model": "Camry", "color": "silver" },
  "confidence": { "overallConfidence": 0.97 },
  "images": [
    { "id": "img-0901-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg", "cameraID": "cam-entry-1" },
    { "id": "img-0901-overview", "imageType": "overview", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/overview.jpg", "cameraID": "cam-entry-1" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "SYN-1234", "confidence": 0.97 },
      "country": { "value": "US", "confidence": 0.99 },
      "stateProvince": { "value": "IL", "confidence": 0.93 },
      "make": { "value": "Toyota", "confidence": 0.95 },
      "model": { "value": "Camry", "confidence": 0.78 },
      "color": { "value": "silver", "confidence": 0.86 },
      "bodyType": { "value": "sedan", "confidence": 0.97 },
      "alternateReads": [ { "plate": "SYN-1284", "stateProvince": "IL", "confidence": 0.44 } ],
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "away",
      "accessEvent": "entry",
      "captureGroup": "cam-entry-1/20260924T080202/0117",
      "engine": "vendor-x/7.2"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "ids": [
    "f2000000-0000-4000-8000-000000000901"
  ]
}
```

The stored observation, as a later read or the
`apx.data.observation.created.v1` event carries it:

<!-- apx:validate ObservationElement -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000901",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "SYN-1234",
  "observationStartTime": "2026-09-24T08:02:02Z",
  "creationDateTime": "2026-09-24T08:02:03Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Toyota", "model": "Camry", "color": "silver" },
  "confidence": { "overallConfidence": 0.97 },
  "images": [
    { "id": "img-0901-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg", "cameraID": "cam-entry-1" },
    { "id": "img-0901-overview", "imageType": "overview", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/overview.jpg", "cameraID": "cam-entry-1" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "SYN-1234", "confidence": 0.97 },
      "country": { "value": "US", "confidence": 0.99 },
      "stateProvince": { "value": "IL", "confidence": 0.93 },
      "make": { "value": "Toyota", "confidence": 0.95 },
      "model": { "value": "Camry", "confidence": 0.78 },
      "color": { "value": "silver", "confidence": 0.86 },
      "bodyType": { "value": "sedan", "confidence": 0.97 },
      "alternateReads": [ { "plate": "SYN-1284", "stateProvince": "IL", "confidence": 0.44 } ],
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "away",
      "accessEvent": "entry",
      "captureGroup": "cam-entry-1/20260924T080202/0117",
      "engine": "vendor-x/7.2"
    }
  }
}
```

The event, delivered to every subscription whose `apx_places` grant
covers Lakeside and whose credential could read the topic synchronously
(Part 9 §9.6(4)); the Observation's `elementIds` is its place binding
(Part 8 §8.5):

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000901",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T08:02:03Z",
  "subject": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
  "data": {
    "id": "f2000000-0000-4000-8000-000000000901",
    "version": 1,
    "type": "licensePlate",
    "method": "anpr",
    "observedCredentialId": "SYN-1234",
    "observationStartTime": "2026-09-24T08:02:02Z",
    "creationDateTime": "2026-09-24T08:02:03Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
    "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Toyota", "model": "Camry", "color": "silver" },
    "confidence": { "overallConfidence": 0.97 },
    "images": [
      { "id": "img-0901-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg", "cameraID": "cam-entry-1" }
    ],
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plate": { "value": "SYN-1234", "confidence": 0.97 },
        "stateProvince": { "value": "IL", "confidence": 0.93 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "cam-entry-1/20260924T080202/0117",
        "engine": "vendor-x/7.2"
      }
    }
  }
}
```

---

## LPR-02 — Plate to ticket: the lost ticket is found

<!-- apx:scenario LPR-02 kind=happy ics=APX-LPR-01,APX-LPR-03,APX-LPR-04,APX-CORE-10 -->

**Given** a transient parker at exit lane 2 with no ticket, and the
plate the entry camera read at 08:02. **When** the agent looks the plate
up. **Then** one `LprRead` joins the Observation to ticket `T-1001` and
its session, carries the projected `detail` with every per-attribute
confidence the engine supplied, the `accessEvent: entry` the LPR system reported, and the still as
an access-controlled link. The read names its `place` and, since the fix for F-LPR-04, the `lane` and the capturing `cameraId`.

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790275500, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "cameraId": "cam-entry-1",
      "confidence": 0.97,
      "detail": {
        "plate": { "value": "SYN-1234", "confidence": 0.97 },
        "country": { "value": "US", "confidence": 0.99 },
        "stateProvince": { "value": "IL", "confidence": 0.93 },
        "make": { "value": "Toyota", "confidence": 0.95 },
        "model": { "value": "Camry", "confidence": 0.78 },
        "color": { "value": "silver", "confidence": 0.86 },
        "bodyType": { "value": "sedan", "confidence": 0.97 },
        "alternateReads": [ { "plate": "SYN-1284", "stateProvince": "IL", "confidence": 0.44 } ],
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "cam-entry-1/20260924T080202/0117",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "observationDateTime": "2026-09-24T08:02:02Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

---

## LPR-03 — Ticket to plate: both reads of one visit, and a ticket no camera saw

<!-- apx:scenario LPR-03 kind=happy ics=APX-LPR-01,APX-LPR-02 -->

**Given** ticket `T-1001` and, later, a ticket `T-1077` issued at a lane
with no camera. **When** the console asks for each ticket's reads.
**Then** `T-1001` returns the entry read and the exit read taken at
18:40, both bound to the same session and place, in one page, each
naming its `lane` so the console can say which was entry and which exit
(F-LPR-04); `T-1077` returns an empty page, not an error.

<!-- apx:request GET /v1/lpr/reads?ticket=T-1001&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790277900, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "cameraId": "cam-exit-2",
      "confidence": 0.95,
      "detail": {
        "plate": { "value": "SYN-1234", "confidence": 0.95 },
        "stateProvince": { "value": "IL", "confidence": 0.90 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "exit",
        "captureGroup": "cam-exit-2/20260924T184009/0388",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000902", "className": "Observation" },
      "observationDateTime": "2026-09-24T18:40:09Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0902/plate.jpg",
      "recentReservations": []
    },
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "cameraId": "cam-entry-1",
      "confidence": 0.97,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "observationDateTime": "2026-09-24T08:02:02Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

<!-- apx:request GET /v1/lpr/reads?ticket=T-1077 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790277900, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## LPR-04 — An older camera with no detail block: nothing is guessed

<!-- apx:scenario LPR-04 kind=edge ics=APX-LPR-03,APX-LPR-04 -->

**Given** the ramp camera at Riverside is a first-generation unit that
reports a plate string and one overall score, nothing else. **When** it
ingests a read without the decoration. **Then** the `LprRead` has no
`detail` at all, so no `accessEvent` either: the read is simply
`unknown`, and pairing it into a session is the platform's job. The
server fills nothing in, and the APDS-native vehicle fields stay
empty rather than being filled with defaults.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000903",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "PXQ-2200",
  "observationStartTime": "2026-09-24T10:15:40Z",
  "creationDateTime": "2026-09-24T10:15:41Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
  "confidence": { "overallConfidence": 0.88 },
  "images": [
    { "id": "img-0903-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0903/plate.jpg", "cameraID": "cam-ramp-1" }
  ]
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "ids": [
    "f2000000-0000-4000-8000-000000000903"
  ]
}
```

The stored observation, as a later read or the
`apx.data.observation.created.v1` event carries it:

<!-- apx:validate ObservationElement -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000903",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "PXQ-2200",
  "observationStartTime": "2026-09-24T10:15:40Z",
  "creationDateTime": "2026-09-24T10:15:41Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
  "confidence": { "overallConfidence": 0.88 },
  "images": [
    { "id": "img-0903-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0903/plate.jpg", "cameraID": "cam-ramp-1" }
  ]
}
```

<!-- apx:request GET /v1/lpr/reads?plate=PXQ-2200 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790245800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "PXQ-2200",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.88,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000903", "className": "Observation" },
      "observationDateTime": "2026-09-24T10:15:40Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000903", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0903/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

---

## LPR-05 — One frame: the engine cannot call movement, the LPR system still reports the event

<!-- apx:scenario LPR-05 kind=edge ics=APX-LPR-03,APX-LPR-04 -->

**Given** a single-frame capture at exit lane 2: the engine saw a rear
plate in one frame only (`frameReads: 1`), so it cannot call motion, and
it could not classify colour. The site's LPR system still knows the read
came from its exit camera and reports it as an exit. **When** the
console reads it. **Then** `detail.movement` is `unknown`,
`detail.frameReads` is `1`, `color` is absent, and `accessEvent` is
`exit` exactly as the LPR system reported it. The server infers nothing
from the missing geometry and adds nothing to it; `laneTravel` is the
deprecated field's `unknown`.

<!-- apx:request GET /v1/lpr/reads?plate=WHT-0406 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790263200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "WHT-0406",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "cameraId": "cam-exit-2",
      "confidence": 0.81,
      "detail": {
        "plate": { "value": "WHT-0406", "confidence": 0.81 },
        "stateProvince": { "value": "WI", "confidence": 0.55 },
        "make": { "value": "Subaru", "confidence": 0.90 },
        "frameReads": 1,
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "unknown",
        "accessEvent": "exit",
        "captureGroup": "cam-exit-2/20260924T151500/0350",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000904", "className": "Observation" },
      "observationDateTime": "2026-09-24T15:15:00Z",
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0904/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

---

## LPR-06 — Shared driveway in the snow: in through the exit lane, and nothing is flagged

<!-- apx:scenario LPR-06 kind=lifecycle ics=APX-LPR-02,APX-LPR-04,APX-LPR-06 -->

**Given** Riverside's entry and exit lanes share one unseparated
driveway, and at 07:41 snow covers the lane markings. A grey pickup
turns in on the exit side. The exit camera `cam-exit-1` faces
`outward`, so a car coming in drives **toward** it and shows its
**front** plate. **When** the LPR system reports the read as
`accessEvent: entry` — its own call; APX does not care which lane it
was. **Then** the server stores the read as reported, the platform opens
session `f1…0741` for the plate, and **no alert is raised**: APX defines
no wrong-way travel (Part 13 §13.3a(6)), so `wrongWayTravel` is never
raised by the server. The observation event carries the reported
`accessEvent`.

```http
POST /observations
Authorization: Bearer <cam-exit-1: apx.data:write>
```

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000741",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "RVR-8821",
  "observationStartTime": "2026-09-24T07:41:08Z",
  "creationDateTime": "2026-09-24T07:41:09Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Ford", "model": "F-150", "color": "grey" },
  "confidence": { "overallConfidence": 0.91 },
  "images": [
    { "id": "img-0741-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0741/plate.jpg", "cameraID": "cam-exit-1" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "RVR-8821", "confidence": 0.91 },
      "stateProvince": { "value": "IL", "confidence": 0.88 },
      "make": { "value": "Ford", "confidence": 0.94 },
      "model": { "value": "F-150", "confidence": 0.71 },
      "color": { "value": "grey", "confidence": 0.83 },
      "bodyType": { "value": "pickup", "confidence": 0.96 },
      "frameReads": 4,
      "platesRead": 1,
      "plateFace": "front",
      "movement": "toward",
      "accessEvent": "entry",
      "captureGroup": "cam-exit-1/20260924T074108/0417",
      "engine": "vendor-x/7.2"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "ids": [
    "f2000000-0000-4000-8000-000000000741"
  ]
}
```

The ops console reads it back. The read says entry, and entry is what
the console shows — the lane it happened on is recorded (`lane`), not
judged:

<!-- apx:request GET /v1/lpr/reads?plate=RVR-8821 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790236200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "RVR-8821",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1",
      "confidence": 0.91,
      "detail": {
        "plate": { "value": "RVR-8821", "confidence": 0.91 },
        "stateProvince": { "value": "IL", "confidence": 0.88 },
        "make": { "value": "Ford", "confidence": 0.94 },
        "model": { "value": "F-150", "confidence": 0.71 },
        "color": { "value": "grey", "confidence": 0.83 },
        "bodyType": { "value": "pickup", "confidence": 0.96 },
        "frameReads": 4,
        "platesRead": 1,
        "plateFace": "front",
        "movement": "toward",
        "accessEvent": "entry",
        "captureGroup": "cam-exit-1/20260924T074108/0417",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
      "observationDateTime": "2026-09-24T07:41:08Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000741", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0741/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

No alert exists for it. The registry still lists `wrongWayTravel` (as
an operator-defined type), but the APX server never raises it; the token
also holds `apx.alerts:read` for this call:

<!-- apx:request GET /v1/alerts?type=wrongWayTravel&place=b1000000-0000-4000-8000-000000000006&status=raised -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790236200, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

The observation event carries exactly what was reported:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000741",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T07:41:09Z",
  "subject": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
  "data": {
    "id": "f2000000-0000-4000-8000-000000000741",
    "version": 1,
    "type": "licensePlate",
    "method": "anpr",
    "observedCredentialId": "RVR-8821",
    "observationStartTime": "2026-09-24T07:41:08Z",
    "creationDateTime": "2026-09-24T07:41:09Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "version": 2, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
    "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL", "make": "Ford", "model": "F-150", "color": "grey" },
    "confidence": { "overallConfidence": 0.91 },
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plate": { "value": "RVR-8821", "confidence": 0.91 },
        "platesRead": 1,
        "plateFace": "front",
        "movement": "toward",
        "accessEvent": "entry",
        "captureGroup": "cam-exit-1/20260924T074108/0417"
      }
    }
  }
}
```

---

## LPR-07 — A proper exit: two cameras, front and rear, one passage

<!-- apx:scenario LPR-07 kind=happy ics=APX-LPR-03,APX-LPR-04,APX-LPR-06 -->

**Given** Riverside's exit lane carries two cameras: `cam-exit-1` faces
`outward` and reads the rear plates of leaving cars, and `cam-exit-1f`
faces `inward` and reads their front plates. A sedan leaves at 09:12.
**When** both cameras read it; the LPR system gives both reads the same
`captureGroup` and `accessEvent: exit`, and the front read keeps its
second-ranked plate string. **Then** two `LprRead` rows come back — one
per Observation — sharing a `captureGroup`, so a consumer counting
vehicles counts one exit (§13.3a(6)). `alternateReads` holds `KLM-4478`
for the correction flow. Which of the two reads the platform prefers
(rear-plate first, at this operator) is the platform's choice, not APX's.

<!-- apx:request GET /v1/lpr/reads?plate=KLM-4470 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790241600, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1",
      "confidence": 0.97,
      "detail": {
        "plate": { "value": "KLM-4470", "confidence": 0.97 },
        "stateProvince": { "value": "IL", "confidence": 0.95 },
        "make": { "value": "Honda", "confidence": 0.92 },
        "model": { "value": "Accord", "confidence": 0.80 },
        "color": { "value": "blue", "confidence": 0.90 },
        "bodyType": { "value": "sedan", "confidence": 0.98 },
        "frameReads": 5,
        "platesRead": 2,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "exit",
        "captureGroup": "exit-1/20260924T091202/0418",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000912", "className": "Observation" },
      "observationDateTime": "2026-09-24T09:12:03Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0912/rear.jpg",
      "recentReservations": []
    },
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1f",
      "confidence": 0.93,
      "detail": {
        "plate": { "value": "KLM-4470", "confidence": 0.93 },
        "alternateReads": [ { "plate": "KLM-4478", "stateProvince": "IL", "confidence": 0.62 } ],
        "frameReads": 3,
        "platesRead": 2,
        "plateFace": "front",
        "movement": "toward",
        "accessEvent": "exit",
        "captureGroup": "exit-1/20260924T091202/0418",
        "engine": "vendor-x/7.2"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000913", "className": "Observation" },
      "observationDateTime": "2026-09-24T09:12:02Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0913/front.jpg",
      "recentReservations": []
    }
  ]
}
```

The same two reads, asked for by the visit rather than the plate
(§13.3a(6), APX-LPR-06):

<!-- apx:request GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000655 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790241600, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1",
      "confidence": 0.97,
      "detail": { "plate": { "value": "KLM-4470", "confidence": 0.97 }, "platesRead": 2, "plateFace": "rear", "movement": "away", "accessEvent": "exit", "captureGroup": "exit-1/20260924T091202/0418" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000912", "className": "Observation" },
      "observationDateTime": "2026-09-24T09:12:03Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" }
    },
    {
      "plate": "KLM-4470",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1f",
      "confidence": 0.93,
      "detail": { "plate": { "value": "KLM-4470", "confidence": 0.93 }, "platesRead": 2, "plateFace": "front", "movement": "toward", "accessEvent": "exit", "captureGroup": "exit-1/20260924T091202/0418" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000913", "className": "Observation" },
      "observationDateTime": "2026-09-24T09:12:02Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000655", "className": "Session" }
    }
  ]
}
```

---

## LPR-08 — Candidates for a session, best first, with the engine's second choice

<!-- apx:scenario LPR-08 kind=happy ics=APX-LPR-01,APX-LPR-03,APX-CORE-10 -->

**Given** session `f1…0031` was opened on a 0.41 entry read of
`5VN-4B21`, and the customer at exit lane 2 says the plate is
`SVN-4821`. **When** the agent asks for the session's candidates.
**Then** the fresh 0.97 exit read comes first, then the entry misread
with its `detail`, then the entry engine's own second choice offered as
a candidate in its own right (Part 17 §17.5), sharing the entry
Observation. Imagery is links that demand the caller's credentials.

<!-- apx:request GET /v1/lpr/candidates?session=f1000000-0000-4000-8000-000000000031 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287200, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "plate": "SVN-4821",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.97,
      "observationDateTime": "2026-09-24T22:39:04Z",
      "detail": {
        "plate": { "value": "SVN-4821", "confidence": 0.97 },
        "stateProvince": { "value": "FL", "confidence": 0.94 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "exit",
        "captureGroup": "cam-exit-2/20260924T223904/0512",
        "engine": "vendor-x/7.2"
      },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/plate.jpg",
      "vehicleImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/overview.jpg"
    },
    {
      "plate": "5VN-4B21",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.41,
      "observationDateTime": "2026-09-24T17:41:22Z",
      "detail": {
        "plate": { "value": "5VN-4B21", "confidence": 0.41 },
        "stateProvince": { "value": "FL", "confidence": 0.70 },
        "alternateReads": [ { "plate": "SVN-4821", "stateProvince": "FL", "confidence": 0.38 } ],
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "cam-entry-1/20260924T174122/0301",
        "engine": "vendor-x/7.2"
      },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0013/plate.jpg"
    },
    {
      "plate": "SVN-4821",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.38,
      "observationDateTime": "2026-09-24T17:41:22Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0013/plate.jpg"
    }
  ]
}
```

---

## LPR-09 — Candidates for a lane since a time, and a session with no reads

<!-- apx:scenario LPR-09 kind=happy ics=APX-LPR-01 -->

**Given** the agent does not yet know the session, only the lane the
intercom belongs to. **When** they ask for exit lane 2's candidates
since 22:30, and separately for the candidates of a session opened at
a camera-less lane. **Then** the lane query returns the one read taken
there in the window, and the camera-less session returns an empty
`data` array with `meta.total: 0`.

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002&since=2026-09-24T22:30:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "SVN-4821",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.97,
      "observationDateTime": "2026-09-24T22:39:04Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/plate.jpg"
    }
  ]
}
```

<!-- apx:request GET /v1/lpr/candidates?session=f1000000-0000-4000-8000-000000000077&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287200, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## LPR-10 — No lookup key at all

<!-- apx:scenario LPR-10 kind=refusal ics=APX-LPR-01,APX-CORE-05 -->

**Given** a console that forgot to fill in the search field. **When** it
calls the candidates route with neither `session` nor `lane`, and the
reads route with neither `plate` nor `ticket`. **Then** both are refused
with 400 `invalid-request`: a plate-keyed surface must never turn into
"list every read I can see". (Was F-LPR-05: the reads route declared no
400; it now does, and §13.3 makes one key REQUIRED.)

<!-- apx:request GET /v1/lpr/candidates -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Lookup key required",
  "status": 400,
  "detail": "GET /v1/lpr/candidates requires session or lane.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request GET /v1/lpr/reads -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Lookup key required",
  "status": 400,
  "detail": "GET /v1/lpr/reads requires plate, ticket, or observation.",
  "instance": "/v1/lpr/reads"
}
```

---

## LPR-11 — Correct the plate; the reservation links; APDS sees it

<!-- apx:scenario LPR-11 kind=lifecycle ics=APX-LPR-01,APX-LPR-03 -->

**Given** the candidates from LPR-08 and a customer who read the plate
out loud. **When** the agent writes `SVN-4821` onto session `f1…0031`
citing the exit Observation. **Then** 200 with the corrected
association; the cross-lookup by the corrected plate now joins the entry
Observation (still `5VN-4B21` as observed, never rewritten) to the
session, and `SessionUpdated` is published so a plain APDS client
reading `/sessions/{id}` sees the plate in `identifiedCredentials`.

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate
Authorization: Bearer <apx.lpr:read apx.data:write>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
  "reason": "entry LPR misread (0.41); corrected from exit-lane candidate confirmed by customer"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" }
}
```

<!-- apx:request GET /v1/lpr/reads?plate=SVN-4821 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "SVN-4821",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.97,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
      "observationDateTime": "2026-09-24T22:39:04Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0014/plate.jpg",
      "recentReservations": [
        {
          "reservation": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
          "reservationState": "checkedIn",
          "plannedStart": "2026-09-24T17:30:00Z",
          "plannedEnd": "2026-09-24T23:30:00Z"
        }
      ]
    },
    {
      "plate": "5VN-4B21",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.41,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" },
      "observationDateTime": "2026-09-24T17:41:22Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0013/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

The APDS lifecycle event the correction MUST publish (Part 17 §17.5);
`data` is the APDS `EventData` shape, which the bundle does not carry as
a named schema, so only the envelope is checked:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000031",
  "type": "SessionUpdated",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T22:43:02Z",
  "subject": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "data": {
    "eventType": "SessionUpdated",
    "entity": { "id": "f1000000-0000-4000-8000-000000000031", "version": 4, "className": "Session" },
    "occurredAt": "2026-09-24T22:43:02Z"
  }
}
```

---

## LPR-12 — The same correction twice, and two agents at once

<!-- apx:scenario LPR-12 kind=edge ics=APX-LPR-01,APX-CORE-05 -->

**Given** the console's 200 from LPR-11 was lost to a network blip.
**When** it sends the identical PUT again. **Then** 200 with the same
association and no second `SessionUpdated` for an unchanged value: PUT
is naturally idempotent. Meanwhile a second agent, working from a stale
screen, tries to write the old misread back citing the Session version
it read (`If-Match: "3"`); the Session is at version 4, so the write is
refused with 409 `version-conflict` and nothing changes (Part 4 §4.2a,
Part 17 §17.5; was F-LPR-08).

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
  "reason": "entry LPR misread (0.41); corrected from exit-lane candidate confirmed by customer"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" }
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate
If-Match: "3"
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "5VN-4B21",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" },
  "reason": "re-applying entry read"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Session f1000000-0000-4000-8000-000000000031 is at version 4; the request was made against version 3.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000031/plate"
}
```

---

## LPR-13 — Correction refused: unknown session, and no plate in the body

<!-- apx:scenario LPR-13 kind=refusal ics=APX-LPR-01,APX-CORE-05 -->

**Given** a console with a stale session id, and one that sends the
reason but forgets the plate. **When** each PUTs. **Then** 404
`target-not-found` for the id, and 400 for the body, which the route
does not declare and Part 12 has no slug for (F-LPR-09).

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-0000000000ff/plate -->
```json
{
  "plate": "SVN-4821",
  "reason": "customer read plate aloud"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No session f1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-0000000000ff/plate"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate invalid -->
```json
{
  "country": "US",
  "stateProvince": "FL",
  "reason": "customer read plate aloud"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "plate is required.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000031/plate"
}
```

---

## LPR-14 — Correcting a session that already closed

<!-- apx:scenario LPR-14 kind=refusal ics=APX-LPR-01 -->

**Given** session `f1…0049` ended at 19:40 and was billed by plate.
**When** an agent, an hour later, tries to change its plate. **Then**
the server refuses: the plate on a settled session is the billing key,
and this operator's dispute window for plate corrections is 30 minutes
after exit. Part 17 §17.5 now allows a closed-session correction only
inside the dispute window and only with `reason`; outside it the route's
declared 422 `session-not-open` applies (was F-LPR-10).

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000049/plate -->
```json
{
  "plate": "MNO-3301",
  "reason": "customer says the plate on the receipt is wrong"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/session-not-open",
  "title": "Session is not open at this place",
  "status": 422,
  "detail": "Session f1000000-0000-4000-8000-000000000049 ended 2026-09-24T19:40:05Z and was settled by plate; the 30-minute correction window has passed. Raise a dispute instead.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000049/plate"
}
```

---

## LPR-15 — Wrong scope: plate values stay behind apx.lpr

<!-- apx:scenario LPR-15 kind=security ics=APX-CORE-07,APX-CORE-10 -->

**Given** a BI token with `apx.data:read` only, and a console token with
`apx.lpr:read` but no write scope. **When** the BI token reads plates
and candidates, and the console token tries to correct a plate. **Then**
403 `insufficient-scope` every time. A token without an `apx.lpr` scope
never sees a plate value through this class (Part 9 §9.6(1)).

```http
GET /v1/lpr/reads?plate=SYN-1234
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/lpr/reads requires scope apx.lpr:read; token carries apx.data:read.",
  "instance": "/v1/lpr/reads"
}
```

<!-- apx:request GET /v1/lpr/candidates?session=f1000000-0000-4000-8000-000000000031 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/lpr/candidates requires scope apx.lpr:read; token carries apx.data:read.",
  "instance": "/v1/lpr/candidates"
}
```

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate
Authorization: Bearer <apx.lpr:read only>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821",
  "reason": "customer read plate aloud"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/sessions/{id}/plate requires scope apx.data:write; token carries apx.lpr:read.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000031/plate"
}
```

---

## LPR-16 — Out of grant: the other garage's plates do not exist for this token

<!-- apx:scenario LPR-16 kind=security ics=APX-CORE-07,APX-CORE-08,APX-LPR-02 -->

**Given** `HBR-5510` has been read only at Harbor Deck. **When** the
Lakeside token searches that plate, asks for Harbor Deck's lane
candidates, corrects a Harbor Deck session, and a token with no
`apx_places` claim searches `SYN-1234`. **Then** the plate search is an
empty 200 (the place-less lookup is constrained to the grant, Part 13
§13.5(2), and leaks nothing about whether the plate exists elsewhere),
the lane and session targets are 403 `insufficient-grant`, and the
claim-less token sees nothing (fail-closed). Part 9 §9.3a and Part 13
§13.5(4) now fix exactly this split: value-keyed lookups are an empty
200, entity-keyed ones outside the grant are 403 (was F-LPR-14). The
same applies to `place=` naming Harbor Deck:

<!-- apx:request GET /v1/lpr/reads?plate=HBR-5510&place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/lpr/reads"
}
```

<!-- apx:request GET /v1/lpr/reads?plate=HBR-5510 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "VehicularAccess b2000000-0000-4000-8000-000000000003 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000203/plate -->
```json
{
  "plate": "HBR-5510",
  "reason": "customer read plate aloud"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Session f1000000-0000-4000-8000-000000000203 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000203/plate"
}
```

```http
GET /v1/lpr/reads?plate=SYN-1234
Authorization: Bearer <apx.lpr:read, no apx_places claim>
```

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## LPR-17 — The image link demands the same credentials as the call

<!-- apx:scenario LPR-17 kind=security ics=APX-CORE-10 -->

**Given** the `imageLink` from a read of `SYN-1234`. **When** it is
opened with no token, with a token whose grant excludes Lakeside, and
with the token that produced it. **Then** 401, 403, and the JPEG. The
link is not an APX operation, so those three fetches are shown without
markers; the read that produced the link is validated.

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790275500, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.97,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "observationDateTime": "2026-09-24T08:02:02Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0901/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

```http
GET /v1/media/f2000000-0901/plate.jpg
(no Authorization header)
→ 401
```

```http
GET /v1/media/f2000000-0901/plate.jpg
Authorization: Bearer <apx.lpr:read, apx_places: ["b1000000-0000-4000-8000-000000000002"]>
→ 403 insufficient-grant
```

```http
GET /v1/media/f2000000-0901/plate.jpg
Authorization: Bearer <apx.lpr:read, apx_places: ["b1000000-0000-4000-8000-000000000001", "b1000000-0000-4000-8000-000000000006"]>
→ 200 image/jpeg
```

An unauthenticated, long-lived URL, or a signed URL that outlives the
token's grant, does not conform (Part 9 §9.6(2)).

---

## LPR-18 — A dashboard on an expired token, then polling too fast

<!-- apx:scenario LPR-18 kind=edge ics=APX-CORE-05 -->

**Given** a plate-watch dashboard whose token expired at 23:00, and
which, once re-issued, polls the candidates route every 200 ms.
**When** it calls all three routes expired, then exceeds the read
limit. **Then** 401 on each (Part 12 registers no problem type for 401,
F-LPR-06) and 429 with `Retry-After` on each.

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/lpr/reads"
}
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000031/plate"
}
```

```http
→ 429, Retry-After: 2
```

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/lpr/candidates"
}
```

<!-- apx:request GET /v1/lpr/reads?plate=SYN-1234 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/lpr/reads"
}
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate -->
```json
{
  "plate": "SVN-4821"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 2 seconds.",
  "instance": "/v1/sessions/f1000000-0000-4000-8000-000000000031/plate"
}
```

---

## LPR-19 — Retention: the picture goes first, then the read

<!-- apx:scenario LPR-19 kind=edge ics=APX-CORE-10,APX-LPR-01 -->

**Given** Lakeside's published retention: plate imagery 30 days, plate
reads 90 days, and a subpoena hold on nothing. **When** an auditor looks
up a plate read on 2026-07-10 (76 days ago) and one from 2026-05-02
(145 days ago). **Then** the July read is returned without `imageLink`
and with `purgedImagery: true` (the still was purged on schedule; the
row survives until day 90), and the May read is gone from every lookup:
an empty page, with its deletion already emitted on the change feed.
Part 13 §13.3b now fixes both wire shapes (was F-LPR-13).

<!-- apx:request GET /v1/lpr/reads?plate=JKL-7710 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "JKL-7710",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.94,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000710", "className": "Observation" },
      "observationDateTime": "2026-07-10T13:20:11Z",
      "ticketNumber": "T-0412",
      "session": { "id": "f1000000-0000-4000-8000-000000000710", "className": "Session" },
      "purgedImagery": true,
      "recentReservations": []
    }
  ]
}
```

<!-- apx:request GET /v1/lpr/reads?plate=ABC-0502 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

Candidates are subject to the same schedule; a `since` older than the
read retention simply finds nothing older than 90 days:

<!-- apx:request GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000001&since=2026-05-01T00:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "JKL-7710",
      "confidence": 0.94,
      "observationDateTime": "2026-07-10T13:20:11Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000710", "className": "Observation" },
      "purgedImagery": true
    }
  ]
}
```

---

## LPR-20 — A vendor's own extension rides along, and where it can be seen

<!-- apx:scenario LPR-20 kind=edge ics=APX-LPR-01,APX-LPR-03 -->

**Given** a camera vendor that attaches its raw-engine block as
`apds-ext:vendor-x:lpr-raw@1.0` next to the APX decoration. **When** it
ingests. **Then** the server preserves both keys on the Observation
(tolerant reader, faithful writer, Part 4 §4.3), the event carries
both, and the APX cross-lookup projects the APX block as `detail` and
the vendor key in `LprRead.extensions` (Part 13 §13.3). APDS has no
`GET /observations/{id}`, so the read-back by id is
`GET /v1/lpr/reads?observation=` (was F-LPR-12).

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000905",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "QRS-8080",
  "observationStartTime": "2026-09-24T11:05:30Z",
  "creationDateTime": "2026-09-24T11:05:31Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL" },
  "confidence": { "overallConfidence": 0.92 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "QRS-8080", "confidence": 0.92 },
      "stateProvince": { "value": "IL", "confidence": 0.90 },
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "away",
      "accessEvent": "entry",
      "captureGroup": "cam-entry-1/20260924T110530/0142"
    },
    "apds-ext:vendor-x:lpr-raw@1.0": { "frameId": 48812, "exposureMs": 4, "ocrPath": "fast" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "status": "ok",
  "code": 201,
  "ids": [
    "f2000000-0000-4000-8000-000000000905"
  ]
}
```

The stored observation, as a later read or the
`apx.data.observation.created.v1` event carries it:

<!-- apx:validate ObservationElement -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000905",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "QRS-8080",
  "observationStartTime": "2026-09-24T11:05:30Z",
  "creationDateTime": "2026-09-24T11:05:31Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL" },
  "confidence": { "overallConfidence": 0.92 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "QRS-8080", "confidence": 0.92 },
      "stateProvince": { "value": "IL", "confidence": 0.90 },
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "away",
      "accessEvent": "entry",
      "captureGroup": "cam-entry-1/20260924T110530/0142"
    },
    "apds-ext:vendor-x:lpr-raw@1.0": { "frameId": 48812, "exposureMs": 4, "ocrPath": "fast" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000905",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T11:05:31Z",
  "subject": { "id": "f2000000-0000-4000-8000-000000000905", "className": "Observation" },
  "data": {
    "id": "f2000000-0000-4000-8000-000000000905",
    "version": 1,
    "type": "licensePlate",
    "method": "anpr",
    "observedCredentialId": "QRS-8080",
    "observationStartTime": "2026-09-24T11:05:30Z",
    "creationDateTime": "2026-09-24T11:05:31Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
    "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IL" },
    "confidence": { "overallConfidence": 0.92 },
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plate": { "value": "QRS-8080", "confidence": 0.92 },
        "stateProvince": { "value": "IL", "confidence": 0.90 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "cam-entry-1/20260924T110530/0142"
      },
      "apds-ext:vendor-x:lpr-raw@1.0": { "frameId": 48812, "exposureMs": 4, "ocrPath": "fast" }
    }
  }
}
```

The read back by Observation id, with the vendor key projected:

<!-- apx:request GET /v1/lpr/reads?observation=f2000000-0000-4000-8000-000000000905 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790248800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "QRS-8080",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "cameraId": "cam-entry-1",
      "extensions": {
        "apds-ext:vendor-x:lpr-raw@1.0": { "frameId": 48812, "exposureMs": 4, "ocrPath": "fast" }
      },
      "confidence": 0.92,
      "detail": {
        "plate": { "value": "QRS-8080", "confidence": 0.92 },
        "stateProvince": { "value": "IL", "confidence": 0.90 },
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "cam-entry-1/20260924T110530/0142"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000905", "className": "Observation" },
      "observationDateTime": "2026-09-24T11:05:30Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000905", "className": "Session" },
      "recentReservations": []
    }
  ]
}
```

---

## LPR-21 — Narrowing a forty-garage grant to one place

<!-- apx:scenario LPR-21 kind=edge ics=APX-LPR-02 -->

**Given** a regional token granted both Lakeside and Riverside, and a
fleet plate seen at both today. **When** the console asks for the plate
at Lakeside only, using the `place` parameter Part 13 §13.5(3–4) now
declares on the operation (was F-LPR-07). **Then** the Lakeside read
alone.

<!-- apx:request GET /v1/lpr/reads?plate=FLT-0092&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "FLT-0092",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.96,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000906", "className": "Observation" },
      "observationDateTime": "2026-09-24T14:02:50Z",
      "ticketNumber": "T-1090",
      "session": { "id": "f1000000-0000-4000-8000-000000000906", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0906/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

Without the parameter, the same token gets both reads:

<!-- apx:request GET /v1/lpr/reads?plate=FLT-0092 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790280000, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "FLT-0092",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "confidence": 0.90,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000907", "className": "Observation" },
      "observationDateTime": "2026-09-24T16:30:12Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000907", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0907/plate.jpg",
      "recentReservations": []
    },
    {
      "plate": "FLT-0092",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "confidence": 0.96,
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000906", "className": "Observation" },
      "observationDateTime": "2026-09-24T14:02:50Z",
      "ticketNumber": "T-1090",
      "session": { "id": "f1000000-0000-4000-8000-000000000906", "className": "Session" },
      "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0906/plate.jpg",
      "recentReservations": []
    }
  ]
}
```

---

## LPR-22 — A write scope that sees a plate

<!-- apx:scenario LPR-22 kind=security ics=APX-CORE-10,APX-LPR-01 -->

**Given** a PARCS integration token with `apx.data:write` and no
`apx.lpr` scope at all. **When** it corrects a plate, as the route's
security requirement allows. **Then** 200, and the response echoes the
plate value the caller itself supplied — and nothing else. Part 17 §17.5
now says the write's 200 echoes only the caller's own values and MUST NOT
disclose other plate-bearing data, which stays under `apx.lpr:read`
(was F-LPR-11; the matching note in Part 9 §9.6(1) is with the
integrator). The response carries the Session's new `version`.

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000905/plate
Authorization: Bearer <apx.data:write only>
```

<!-- apx:request PUT /v1/sessions/f1000000-0000-4000-8000-000000000905/plate -->
```json
{
  "plate": "QRS-8088",
  "country": "US",
  "stateProvince": "IL",
  "reason": "PARCS operator corrected at the lane terminal"
}
```

<!-- apx:response 200 -->
```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000905", "className": "Session" },
  "plate": "QRS-8088",
  "country": "US",
  "stateProvince": "IL",
  "version": 3
}
```

---

## LPR-23 — Writing down the lane cameras

<!-- apx:scenario LPR-23 kind=happy ics=APX-LPR-05 -->

**Given** Riverside's exit lane `b2…0061` has two cameras: `cam-exit-1`
looks out of the lot (reading the rear plates of leaving cars) and
`cam-exit-1f` looks into it (reading their front plates). **When** the
LPR system records that on the lane with the
`apds-ext:apx:lane-cameras@1.0` decoration, through the native place
route. **Then** the server stores and returns it unchanged. Each
`cameraId` is the string the camera puts in `Image.cameraID` on its
reads, so a consumer can tell which way any read's camera faced. APX
derives nothing from it.

APDS 4.1 lists `vehicularAccess` as a `HierarchyElementTypeEnum` value but
its discriminator mapping entry is commented out, so a lane body
validates only as a bare `HierarchyElement`, so `accessType` is not
checked (F-LPR-17, erratum 013). Since 0.12.1 the decoration itself is
bound to `LaneCameras` wherever `extensions` appears, so the camera
configuration is checked.

```http
PUT /places/b2000000-0000-4000-8000-000000000061
Authorization: Bearer <riverside-lpr-system: apx.data:write>
```

<!-- apx:request PUT /places/b2000000-0000-4000-8000-000000000061 -->
<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000061",
  "version": 3,
  "type": "vehicularAccess",
  "name": [{ "language": "en", "string": "Riverside — exit lane" }],
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000006", "version": 2, "className": "Place" },
  "hierarchyElementRecord": {
    "creationTime": "2026-09-01T12:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "accessType": "exit",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [
        { "cameraId": "cam-exit-1", "faces": "outward" },
        { "cameraId": "cam-exit-1f", "faces": "inward" }
      ]
    }
  }
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Place updated successfully." }
```

And the entry lane beside it, one camera looking in:

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000060",
  "version": 2,
  "type": "vehicularAccess",
  "accessType": "entry",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [ { "cameraId": "cam-in-1", "faces": "inward" } ]
    }
  }
}
```

---

## LPR-24 — Two lanes claim the same camera

<!-- apx:scenario LPR-24 kind=refusal ics=APX-LPR-05 -->

**Given** LPR-23's configuration. **When** an installer copies the exit
lane's block onto the entry lane, so `cam-exit-1` is now claimed by two
lanes of the same Place. `cameraId` MUST be unique within the Place
(§13.3a(5)), because otherwise a read's camera no longer says which way
it faced. **Then** 422 `request-unprocessable` and nothing is written
(§13.3a(5); declared on the native place writes since 0.12.1, which
fixed F-LPR-18).

<!-- apx:request PUT /places/b2000000-0000-4000-8000-000000000060 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000060",
  "version": 3,
  "type": "vehicularAccess",
  "name": [{ "language": "en", "string": "Riverside — entry lane" }],
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000006", "version": 2, "className": "Place" },
  "hierarchyElementRecord": {
    "creationTime": "2026-09-01T12:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "accessType": "entry",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [ { "cameraId": "cam-exit-1", "faces": "outward" } ]
    }
  }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request cannot be processed",
  "status": 422,
  "detail": "cameraId cam-exit-1 is already configured on lane b2000000-0000-4000-8000-000000000061 of this place.",
  "instance": "/places/b2000000-0000-4000-8000-000000000060"
}
```

---

## LPR-25 — Reversible lane, evening: one camera each way, a rear plate either way

<!-- apx:scenario LPR-25 kind=happy ics=APX-LPR-04,APX-LPR-05,APX-LPR-06 -->

**Given** Lakeside's centre lane `b2…0004` is `reversible`: inbound in
the morning, outbound from 16:00. It carries `cam-rev-in` (faces
`inward`) and `cam-rev-out` (faces `outward`), so whichever way it runs
one camera gets a rear plate. Facing is relative to the garage, so the
configuration never changes when the lane flips. **When** at 17:20 a van
leaves on the centre lane: `cam-rev-out` reads its rear plate moving
`away`, `cam-rev-in` its front plate moving `toward`, and the LPR system
marks both `exit` in one `captureGroup`. **Then** both reads close
session `f1…0610`, and the reads behind that session are the morning
entry and the two evening exit reads.

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000004",
  "version": 5,
  "type": "vehicularAccess",
  "accessType": "reversible",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [
        { "cameraId": "cam-rev-in", "faces": "inward" },
        { "cameraId": "cam-rev-out", "faces": "outward" }
      ]
    }
  }
}
```

<!-- apx:request GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000610 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790270400, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "plate": "LKS-7710",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000004", "className": "VehicularAccess" },
      "cameraId": "cam-rev-out",
      "confidence": 0.96,
      "detail": {
        "plate": { "value": "LKS-7710", "confidence": 0.96 },
        "bodyType": { "value": "van", "confidence": 0.94 },
        "frameReads": 6,
        "platesRead": 2,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "exit",
        "captureGroup": "rev/20260924T172011/0081"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000952", "className": "Observation" },
      "observationDateTime": "2026-09-24T17:20:12Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000610", "className": "Session" }
    },
    {
      "plate": "LKS-7710",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000004", "className": "VehicularAccess" },
      "cameraId": "cam-rev-in",
      "confidence": 0.89,
      "detail": {
        "plate": { "value": "LKS-7710", "confidence": 0.89 },
        "frameReads": 3,
        "platesRead": 2,
        "plateFace": "front",
        "movement": "toward",
        "accessEvent": "exit",
        "captureGroup": "rev/20260924T172011/0081"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000951", "className": "Observation" },
      "observationDateTime": "2026-09-24T17:20:11Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000610", "className": "Session" }
    },
    {
      "plate": "LKS-7710",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000004", "className": "VehicularAccess" },
      "cameraId": "cam-rev-in",
      "confidence": 0.95,
      "detail": {
        "plate": { "value": "LKS-7710", "confidence": 0.95 },
        "frameReads": 5,
        "platesRead": 1,
        "plateFace": "rear",
        "movement": "away",
        "accessEvent": "entry",
        "captureGroup": "rev/20260924T074402/0012"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000950", "className": "Observation" },
      "observationDateTime": "2026-09-24T07:44:02Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000610", "className": "Session" }
    }
  ]
}
```

---

## LPR-26 — The one front-plate camera

<!-- apx:scenario LPR-26 kind=edge ics=APX-LPR-03,APX-LPR-04 -->

**Given** Riverside's second entry camera `cam-in-1f` was mounted years
ago looking out at the street, so it reads the **front** plates of
arriving cars (the rare setup; almost every site reads rear plates).
**When** it reads a hatchback coming in: front plate, moving `toward`
it; the LPR system reports `entry`. **Then** the read is stored and
served exactly as reported. Nothing in APX prefers rear plates or needs
the camera moved; a front-plate site is described by its `faces` value
and works unchanged.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000960",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "HTB-3308",
  "observationStartTime": "2026-09-24T11:05:31Z",
  "creationDateTime": "2026-09-24T11:05:32Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000060", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6190, 41.8826] } },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "IN" },
  "confidence": { "overallConfidence": 0.9 },
  "images": [
    { "id": "img-0960-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0960/plate.jpg", "cameraID": "cam-in-1f" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "HTB-3308", "confidence": 0.9 },
      "stateProvince": { "value": "IN", "confidence": 0.84 },
      "frameReads": 3,
      "platesRead": 1,
      "plateFace": "front",
      "movement": "toward",
      "accessEvent": "entry",
      "captureGroup": "cam-in-1f/20260924T110531/0203",
      "engine": "vendor-x/7.2"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "ids": ["f2000000-0000-4000-8000-000000000960"] }
```

---

## LPR-27 — Stopped in the snow: `unknown` first, then the LPR system revises it

<!-- apx:scenario LPR-27 kind=lifecycle ics=APX-LPR-02,APX-LPR-04 -->

**Given** at 07:55 a car stops on Riverside's shared driveway with its
wheels spinning in the snow; the exit camera reads its plate for six
frames with the car `stopped`, and the LPR system cannot yet tell entry
from exit, so it posts the read with `accessEvent: unknown`. **When** at
08:03 the car's exit read turns up at the other end of the lot's
one-way loop, and the LPR system pairs the two and decides the
driveway read was an entry. It revises the read's access event
through `PUT /v1/lpr/reads/{observation}/access-event`, naming the
version it last saw (§13.3a(4)). **Then** `apx.data.observation.updated.v1` is
published with the Observation as it now stands, and the read shows
`entry`.

Until 0.12.1 the spec named native `PUT /observations/{id}` here, a
route APDS 4.1 does not have (F-LPR-16, fixed in 0.12.1).

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event
Authorization: Bearer <riverside-lpr-system: apx.data:write>
If-Match: "1"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "entry" }
```

<!-- apx:response 200 -->
```json
{
  "observation": { "id": "f2000000-0000-4000-8000-000000000931", "className": "Observation" },
  "accessEvent": "entry",
  "version": 2
}
```

What billing receives, whichever route the fix settles on:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000932",
  "type": "apx.data.observation.updated.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T08:03:30Z",
  "subject": { "id": "f2000000-0000-4000-8000-000000000931", "className": "Observation" },
  "data": {
    "id": "f2000000-0000-4000-8000-000000000931",
    "version": 2,
    "type": "licensePlate",
    "method": "anpr",
    "observedCredentialId": "SNW-1102",
    "observationStartTime": "2026-09-24T07:55:40Z",
    "creationDateTime": "2026-09-24T08:03:30Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000061", "version": 3, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6188, 41.8827] } },
    "confidence": { "overallConfidence": 0.88 },
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plate": { "value": "SNW-1102", "confidence": 0.88 },
        "movement": "stopped",
        "accessEvent": "entry",
        "captureGroup": "cam-exit-1/20260924T075540/0433"
      }
    }
  }
}
```

<!-- apx:request GET /v1/lpr/reads?observation=f2000000-0000-4000-8000-000000000931 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790237100, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "SNW-1102",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000061", "className": "VehicularAccess" },
      "cameraId": "cam-exit-1",
      "confidence": 0.88,
      "detail": {
        "plate": { "value": "SNW-1102", "confidence": 0.88 },
        "frameReads": 6,
        "platesRead": 1,
        "plateFace": "front",
        "movement": "stopped",
        "accessEvent": "entry",
        "captureGroup": "cam-exit-1/20260924T075540/0433"
      },
      "observation": { "id": "f2000000-0000-4000-8000-000000000931", "className": "Observation" },
      "observationDateTime": "2026-09-24T07:55:40Z",
      "session": { "id": "f1000000-0000-4000-8000-000000000931", "className": "Session" }
    }
  ]
}
```

---

## LPR-28 — The same revision sent twice

<!-- apx:scenario LPR-28 kind=refusal ics=APX-LPR-04,APX-CORE-08 -->

**Given** LPR-27's revision landed; the Observation is now at `version:
2`. **When** the LPR system's retry queue sends the same revision again
after a timeout, still with `If-Match: "1"`; and a second, healthy
retry reads the current version first and sends `If-Match: "2"`.
**Then** the stale one is 409 `version-conflict` and nothing is written;
the fresh one is a no-op — 200 with `version: 2` unchanged and no second
`observation.updated.v1` — because the value is already `entry`.

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event
If-Match: "1"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "entry" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Stale version",
  "status": 409,
  "detail": "Observation f2000000-0000-4000-8000-000000000931 is at version 2; If-Match named 1. Nothing was written.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event"
}
```

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event
If-Match: "2"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "entry" }
```

<!-- apx:response 200 -->
```json
{
  "observation": { "id": "f2000000-0000-4000-8000-000000000931", "className": "Observation" },
  "accessEvent": "entry",
  "version": 2
}
```

---

## LPR-29 — The camera re-sends a read it already delivered

<!-- apx:scenario LPR-29 kind=edge ics=APX-LPR-03,APX-CORE-03 -->

**Given** LPR-01's entry read `f2…0901` was stored, but the camera's
link dropped before the 201 arrived. **When** its buffer re-sends the
same read with the same id — the engine's own read UUID, used as the
Observation `id` (§13.3a(8)). **Then** 409 `id-collision`, no second
read, no second `observation.created.v1`; the LPR system treats the 409
as delivered and clears the read from its buffer.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000901",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "SYN-1234",
  "observationStartTime": "2026-09-24T08:02:02Z",
  "creationDateTime": "2026-09-24T08:02:03Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "confidence": { "overallConfidence": 0.97 }
}
```

<!-- apx:response 409 -->
```json
{
  "status": "error",
  "code": 409,
  "message": "Observation already exists.",
  "ids": ["f2000000-0000-4000-8000-000000000901"]
}
```

With `Accept: application/problem+json`:

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/id-collision",
  "title": "Client-supplied id already exists",
  "status": 409,
  "detail": "Observation f2000000-0000-4000-8000-000000000901 already exists at version 1.",
  "instance": "/observations"
}
```

---

## LPR-30 — The camera was offline all night: reads arrive hours late

<!-- apx:scenario LPR-30 kind=edge ics=APX-LPR-06 -->

**Given** Riverside's network dropped at 01:50 and came back at 05:30.
The entry camera kept reading and buffered everything. **When** at 05:31
it delivers a read captured at 02:14:07 (`observationStartTime`), and the
exit read of the same car captured at 04:40:52. **Then** the session the
platform builds from them starts at **02:14:07** and ends at **04:40:52**
— the capture times — not 05:31, when the reads arrived (§13.3a(8)).
Billing a 2 h 27 min visit as a few seconds long is what this rule
prevents.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000970",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "NGT-0214",
  "observationStartTime": "2026-09-24T02:14:07Z",
  "creationDateTime": "2026-09-24T02:14:08Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000060", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6190, 41.8826] } },
  "confidence": { "overallConfidence": 0.94 },
  "images": [
    { "id": "img-0970-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0970/plate.jpg", "cameraID": "cam-in-1" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "NGT-0214", "confidence": 0.94 },
      "frameReads": 4,
      "platesRead": 1,
      "plateFace": "rear",
      "movement": "away",
      "accessEvent": "entry",
      "captureGroup": "cam-in-1/20260924T021407/0007",
      "engine": "vendor-x/7.2"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "ids": ["f2000000-0000-4000-8000-000000000970"] }
```

The session, read back on the native route after both late reads:

<!-- apx:request GET /sessions/f1000000-0000-4000-8000-000000000970 -->
<!-- apx:response 200 -->
```json
{
  "id": "f1000000-0000-4000-8000-000000000970",
  "version": 2,
  "actualStart": "2026-09-24T02:14:07Z",
  "actualEnd": "2026-09-24T04:40:52Z",
  "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000006", "version": 2, "className": "Place" },
  "identifiedCredentials": [
    { "type": "licensePlate", "credentialAssignedType": "other", "identifier": { "id": "NGT-0214", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "f3000000-0000-4000-8000-000000000970",
      "version": 1,
      "actualStart": "2026-09-24T02:14:07Z",
      "actualEnd": "2026-09-24T04:40:52Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000970", "version": 1, "className": "AssignedRight" },
      "validationType": ["licensePlate"]
    }
  ]
}
```

---

## LPR-31 — All the reads behind one visit, and a visit that is not yours

<!-- apx:scenario LPR-31 kind=security ics=APX-LPR-06,APX-LPR-01 -->

**Given** session `f1…0001` (SYN-1234 at Lakeside, LPR-01..03) and
Harbor Deck's session `f1…0203`, outside the token's grant. **When** the
console asks for each session's reads, and then for `f1…0001`'s reads
of a different plate. **Then** `f1…0001` returns its entry and exit
reads; `f1…0203` is 403 `insufficient-grant`, because a session is an
entity key (§13.5(4)) — unlike a plate, whose out-of-grant lookup is an
empty 200; and session plus plate intersect to an empty page.

<!-- apx:request GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790277900, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "cameraId": "cam-exit-2",
      "confidence": 0.95,
      "detail": { "plate": { "value": "SYN-1234", "confidence": 0.95 }, "platesRead": 1, "plateFace": "rear", "movement": "away", "accessEvent": "exit", "captureGroup": "cam-exit-2/20260924T184009/0388" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000902", "className": "Observation" },
      "observationDateTime": "2026-09-24T18:40:09Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" }
    },
    {
      "plate": "SYN-1234",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "cameraId": "cam-entry-1",
      "confidence": 0.97,
      "detail": { "plate": { "value": "SYN-1234", "confidence": 0.97 }, "platesRead": 1, "plateFace": "rear", "movement": "away", "accessEvent": "entry", "captureGroup": "cam-entry-1/20260924T080202/0117" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000901", "className": "Observation" },
      "observationDateTime": "2026-09-24T08:02:02Z",
      "ticketNumber": "T-1001",
      "session": { "id": "f1000000-0000-4000-8000-000000000001", "className": "Session" }
    }
  ]
}
```

<!-- apx:request GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000203 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside the caller's place grant",
  "status": 403,
  "detail": "Session f1000000-0000-4000-8000-000000000203 is at a place outside this credential's grant.",
  "instance": "/v1/lpr/reads"
}
```

<!-- apx:request GET /v1/lpr/reads?session=f1000000-0000-4000-8000-000000000001&plate=KLM-4470 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790277900, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## LPR-32 — A multi-plate engine: frames, plate box, speed, and a plate category

<!-- apx:scenario LPR-32 kind=happy ics=APX-LPR-03 -->

**Given** a newer engine at Lakeside's entry that reports everything it
has: how many frames read the plate, where the plate sat in the frame
(as fractions, so the box survives resizing), measured speed, the
vehicle class in its own words, and — for a visitor with a Dubai plate
— the plate's category letter. Its native confidences are 0–100; the
LPR system scales them to 0–1 (§13.3a(8)). **When** it ingests the read.
**Then** every field is accepted as given; `bodyType` is the engine's
own label, not mapped to any list.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000980",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "12345",
  "observationStartTime": "2026-09-24T13:22:10Z",
  "creationDateTime": "2026-09-24T13:22:11Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "vehicleAncillaryIdentification": { "country": "AE", "stateProvince": "DU", "make": "Nissan", "model": "Patrol", "color": "white" },
  "confidence": { "overallConfidence": 0.96 },
  "images": [
    { "id": "img-0980-plate", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/v1/media/f2000000-0980/plate.jpg", "cameraID": "cam-entry-1" }
  ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "12345", "confidence": 0.96 },
      "country": { "value": "AE", "confidence": 0.99 },
      "stateProvince": { "value": "DU", "confidence": 0.97 },
      "plateCategory": { "value": "A", "confidence": 0.93 },
      "make": { "value": "Nissan", "confidence": 0.9 },
      "model": { "value": "Patrol", "confidence": 0.74 },
      "color": { "value": "white", "confidence": 0.95 },
      "bodyType": { "value": "SUV", "confidence": 0.91 },
      "frameReads": 7,
      "platesRead": 1,
      "plateFace": "rear",
      "plateBox": { "top": 0.61, "left": 0.42, "bottom": 0.67, "right": 0.55 },
      "movement": "away",
      "speed": 11.5,
      "accessEvent": "entry",
      "captureGroup": "cam-entry-1/20260924T132210/0342",
      "engine": "vendor-y/5.1"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "ids": ["f2000000-0000-4000-8000-000000000980"] }
```

---

## LPR-33 — Engine values that were not mapped: 0–100 confidences and a -1 speed

<!-- apx:scenario LPR-33 kind=refusal ics=APX-LPR-03 -->

**Given** a second site's LPR system forwards an engine's raw output
without the §13.3a(8) mapping: a confidence of `97` and `speed: -1`, the
engine's "not measured" sentinel. **When** it posts the reads. **Then**
each is 400: confidences are 0–1 and `speed` has a floor of 0 — absent
is how "not measured" is said.

<!-- apx:request POST /observations invalid -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000981",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "SYN-7777",
  "observationStartTime": "2026-09-24T13:30:00Z",
  "creationDateTime": "2026-09-24T13:30:01Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "confidence": { "overallConfidence": 97 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "SYN-7777", "confidence": 97 },
      "accessEvent": "entry"
    }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "status": "error",
  "code": 400,
  "message": "confidence must be between 0 and 1."
}
```

<!-- apx:request POST /observations invalid -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000982",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "SYN-7778",
  "observationStartTime": "2026-09-24T13:30:05Z",
  "creationDateTime": "2026-09-24T13:30:06Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000001", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8819] } },
  "confidence": { "overallConfidence": 0.91 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "SYN-7778", "confidence": 0.91 },
      "speed": -1,
      "accessEvent": "entry"
    }
  }
}
```

<!-- apx:response 400 -->
```json
{
  "status": "error",
  "code": 400,
  "message": "speed must be 0 or more; omit it when not measured."
}
```

---

## LPR-34 — An engine that still says `approaching`

<!-- apx:scenario LPR-34 kind=edge ics=APX-LPR-04 -->

**Given** a camera on firmware from before 0.12.0 still sends the
deprecated `movement` values. **When** it ingests a read with
`movement: approaching`. **Then** it is accepted — servers MUST accept
`approaching`/`receding` as synonyms of `toward`/`away` until 1.0
(§13.3a(3)) — and the read is served as it was sent; nothing is lost
while the site waits for a firmware update. `laneTravel`, where a server
still returns it, is `unknown`.

<!-- apx:request POST /observations -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000990",
  "version": 1,
  "type": "licensePlate",
  "method": "anpr",
  "observedCredentialId": "OLD-0034",
  "observationStartTime": "2026-09-24T14:00:10Z",
  "creationDateTime": "2026-09-24T14:00:11Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000060", "version": 2, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6190, 41.8826] } },
  "confidence": { "overallConfidence": 0.87 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "OLD-0034", "confidence": 0.87 },
      "plateFace": "front",
      "movement": "approaching",
      "accessEvent": "entry",
      "engine": "vendor-x/6.0"
    }
  }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "ids": ["f2000000-0000-4000-8000-000000000990"] }
```

<!-- apx:request GET /v1/lpr/reads?observation=f2000000-0000-4000-8000-000000000990 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790258400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "plate": "OLD-0034",
      "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000060", "className": "VehicularAccess" },
      "confidence": 0.87,
      "detail": {
        "plate": { "value": "OLD-0034", "confidence": 0.87 },
        "plateFace": "front",
        "movement": "approaching",
        "accessEvent": "entry",
        "engine": "vendor-x/6.0"
      },
      "laneTravel": "unknown",
      "observation": { "id": "f2000000-0000-4000-8000-000000000990", "className": "Observation" },
      "observationDateTime": "2026-09-24T14:00:10Z"
    }
  ]
}
```

---

## LPR-35 — Revisions that are refused

<!-- apx:scenario LPR-35 kind=security ics=APX-LPR-04 -->

**Given** the revision route of LPR-27. **When** it is called five wrong
ways: a value outside the enum; with an expired token; by the ops
console, whose token reads plates but cannot write (`apx.lpr:read`
only); for an Observation id nobody ingested; and by a misbehaving LPR
system replaying revisions in a tight loop. **Then** 400, 401, 403, 404,
and 429 in turn, each a registered problem, and nothing is written.

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event invalid -->
```json
{ "accessEvent": "sideways" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Request body is invalid",
  "status": 400,
  "detail": "accessEvent must be one of entry, exit, unknown.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event"
}
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "exit" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event"
}
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "exit" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Token lacks a required scope",
  "status": 403,
  "detail": "PUT access-event requires apx.data:write; this token has apx.lpr:read.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event"
}
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000fff/access-event -->
```json
{ "accessEvent": "exit" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No LPR read with Observation id f2000000-0000-4000-8000-000000000fff.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000fff/access-event"
}
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event -->
```json
{ "accessEvent": "exit" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/lpr/reads/f2000000-0000-4000-8000-000000000931/access-event"
}
```
