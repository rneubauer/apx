# Scenario 27 — Reversible lane: two cameras, both directions, and a late correction

**The story.** Harbor Street Garage has three lanes: an entry lane, an
exit lane, and a centre **reversible** lane that runs inbound in the
morning rush and outbound in the evening. The operator wants a rear
plate whichever way the centre lane is running, so it carries two
cameras, one facing each way. The old entry lane is the odd one out:
its camera was mounted years ago to read **front** plates, and nobody
has moved it. APX doesn't care which setup a lane has — it only needs
each camera's facing written down. This morning a van comes in on the
centre lane; one of its two reads is first reported as `unknown` and
then corrected, and the correction reaches billing as an event.

**Actors.** The site's LPR system (`apx.data:write`, native ingest and
lane configuration); the operator's billing platform (a Part 8
subscription to the observation topics, `apx.lpr:read`) → Harbor Street
APX server.

## Step 1 — The lane configuration

The reversible lane, one camera each way:

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000272",
  "version": 1,
  "accessType": "reversible",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [
        { "cameraId": "harbor/cam-centre-in", "faces": "inward" },
        { "cameraId": "harbor/cam-centre-out", "faces": "outward" }
      ]
    }
  }
}
```

The old entry lane, whose camera faces out toward the street and so
reads the **front** plates of arriving cars:

<!-- apx:validate LaneCameras at /extensions/apds-ext:apx:lane-cameras@1.0 -->
```json
{
  "id": "b2000000-0000-4000-8000-000000000270",
  "version": 4,
  "accessType": "entry",
  "extensions": {
    "apds-ext:apx:lane-cameras@1.0": {
      "cameras": [ { "cameraId": "harbor/cam-entry-1", "faces": "outward" } ]
    }
  }
}
```

(Abridged.) Facing is always relative to the garage — `inward` looks
into it, `outward` out of it — so it never changes when the centre lane
flips. What each camera sees in each mode:

| Camera | `faces` | Morning (inbound) | Evening (outbound) |
|---|---|---|---|
| `cam-centre-in` | inward | rear plate, `away` → entry | front plate, `toward` → exit |
| `cam-centre-out` | outward | front plate, `toward` → entry | rear plate, `away` → exit |
| `cam-entry-1` | outward | front plate, `toward` → entry | — |

Whichever way the centre lane runs, one of its cameras gets the rear
plate. The entry-lane camera gets front plates only, and that is fine.

## Step 2 — 08:05: the van comes in on the centre lane

Both centre cameras read the van. `cam-centre-in` reports its rear plate
moving away, and the LPR system marks that read `accessEvent: entry`.
`cam-centre-out` reads the front plate too, but in only one frame — not
enough for the engine to call `movement`. The LPR system doesn't guess,
so that read goes in as `accessEvent: unknown`:

<!-- apx:validate LprReadDetail at /extensions/apds-ext:apx:lpr-read@1.0 -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000805",
  "version": 1,
  "method": "anpr",
  "observedCredentialId": "HBR-3107",
  "observationStartTime": "2026-12-15T08:05:31Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000272", "className": "VehicularAccess", "version": 1 },
  "images": [ { "id": "img-805-plate", "imageType": "plate", "cameraID": "harbor/cam-centre-out" } ],
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "HBR-3107", "confidence": 0.89 },
      "frameReads": 1,
      "platesRead": 2,
      "plateFace": "front",
      "movement": "unknown",
      "accessEvent": "unknown",
      "captureGroup": "harbor/20261215T080531/2211",
      "engine": "vendor-x/7.2"
    }
  }
}
```

(Abridged native Observation.) The server publishes
`apx.data.observation.created.v1` for each read. The billing platform
opens a session from the rear-plate read, which already says `entry`.

## Step 3 — The LPR system corrects the unknown read

A second later the LPR system pairs the two reads by `captureGroup`:
the rear-plate read settled the passage, and the centre lane is in
inbound mode. It revises the front-plate read's access event, naming
the version it last saw:

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000805/access-event HTTP/1.1
Content-Type: application/json
If-Match: "1"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000805/access-event -->
```json
{ "accessEvent": "entry" }
```

The server answers with the Observation's new version:

```json
{
  "observation": { "id": "f2000000-0000-4000-8000-000000000805", "className": "Observation" },
  "accessEvent": "entry",
  "version": 2
}
```

How the LPR system paired them — by group, by
lane mode, or by preferring the rear plate — is its own logic; APX only
carries the result (Part 13 §13.3a(4)).

The server publishes the replacement:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "6d7e8f9a-0b1c-4d2e-8f3a-4b5c6d7e8f9a",
  "type": "apx.data.observation.updated.v1",
  "source": "https://api.harbor-street.example/v1",
  "subject": { "id": "f2000000-0000-4000-8000-000000000805", "className": "ObservationElement" },
  "time": "2026-12-15T08:05:33Z",
  "data": {
    "id": "f2000000-0000-4000-8000-000000000805",
    "version": 2,
    "method": "anpr",
    "observedCredentialId": "HBR-3107",
    "observationStartTime": "2026-12-15T08:05:31Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000272", "className": "VehicularAccess", "version": 1 },
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plateFace": "front",
        "movement": "unknown",
        "accessEvent": "entry",
        "captureGroup": "harbor/20261215T080531/2211"
      }
    }
  }
}
```

(`data` abridged.) The billing platform keys on the Observation id,
keeps version 2, and attaches the read to the session it already opened:
same passage, same entry. Had the rear-plate read been missed entirely,
this event is what would have opened the session — at 08:05:31, the
capture time, not 08:05:33 when the correction arrived.

## Step 4 — 17:40: the lane has flipped

In the evening the centre lane runs outbound. The van leaves on it:
`cam-centre-out` now reads its **rear** plate moving away, and
`cam-centre-in` its front plate moving toward — both `accessEvent:
exit`, one `captureGroup`. The cameras didn't move and their
configuration didn't change; only the traffic did. The session closes
at the capture time of the exit, and
`GET /v1/lpr/reads?session=…` returns all four reads of the visit.
