# Scenario 28 — A separate pairing service writes what it decided

**The story.** Lakeside Garage runs its LPR cameras into the APX server,
but the work of turning reads into stays is done by a separate pairing
service, which may run on another machine and is maintained by another
team. That service decides which reads make up a visit, which permit
covers it, and why each stay ended, and it has to write those decisions
back. APDS gives it the Session to write; APX adds the decoration
`apds-ext:apx:session-detail@1.0` (Part 5 §5.8) for what the Session has
no member for. This evening shows four Sessions: a permit holder whose
plate was misread by one character, the valet section inside the garage,
a car seen only leaving, and a write that tries to claim a read twice.

**Actors.** The pairing service (`apx.data:write`, `apx.lpr:read`) → the
Lakeside APX server, which also claims `apx-lpr`. The garage is place
`b1…0001`; its valet section is the area `b1…0021` beneath it. Reads are
`f3…`, Sessions `c6…`.

## Step 1 — 18:02: a permit holder's visit

Two cameras read the car at the entry lane: the rear plate cleanly as
`SYN-4O71`, the front plate in one frame. The permit on file says
`SYN-4071`. Folding the look-alike `O` and `0` makes them equal, so the
service links the permit with method `fold`. The vehicle's make and
colour agree, and it scores the evidence `good`. It creates the visit:

<!-- apx:request POST /sessions -->
<!-- apx:validate SessionDetail at /extensions/apds-ext:apx:session-detail@1.0 -->
```json
{
  "id": "c6000000-0000-4000-8000-000000000001",
  "version": 1,
  "actualStart": "2026-10-14T18:02:11Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-4071", "className": "USNumberPlate" } }
  ],
  "segments": [
    {
      "id": "c7000000-0000-4000-8000-000000000001",
      "version": 1,
      "actualStart": "2026-10-14T18:02:11Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000001", "version": 1, "className": "AssignedRight" },
      "validationType": ["licensePlate"]
    }
  ],
  "extensions": {
    "apds-ext:apx:session-detail@1.0": {
      "reads": [
        { "observation": { "id": "f3000000-0000-4000-8000-000000000101", "className": "ObservationElement" }, "role": "entry", "representative": true },
        { "observation": { "id": "f3000000-0000-4000-8000-000000000102", "className": "ObservationElement" }, "role": "duplicate" }
      ],
      "lifecycle": "open",
      "matches": [
        {
          "target": { "id": "e2000000-0000-4000-8000-000000000001", "className": "AssignedRight" },
          "matchType": "right",
          "plate": { "method": "fold", "jurisdiction": "agrees" },
          "vehicle": { "level": "good", "llr": 2.31, "model": "evidence-weights@2026-10-01" },
          "applied": true,
          "decidedBy": "system",
          "decidedTime": "2026-10-14T18:02:12Z"
        }
      ]
    }
  }
}
```

The server publishes `SessionCreated` as for any Session. The match
evidence holds no plate characters, only how the plates compared
(§5.9 rule 4). Because the server holds the reads, it now answers
`GET /v1/lpr/reads?session=c6000000-0000-4000-8000-000000000001` with
both reads, and each read's `LprRead.session` names this visit.

## Step 2 — 18:05: the car goes into the valet section

The permit holder hands the car to valet. The valet section has its own
camera, and the service opens an **area** Session for it, naming the
visit as `parent`. The section is inside the garage, so the parent's
element is an ancestor of the child's, as rule 4 requires:

<!-- apx:request POST /sessions -->
<!-- apx:validate SessionDetail at /extensions/apds-ext:apx:session-detail@1.0 -->
```json
{
  "id": "c6000000-0000-4000-8000-000000000002",
  "version": 1,
  "actualStart": "2026-10-14T18:05:40Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000021", "version": 2, "className": "Area" },
  "identifiedCredentials": [
    { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-4071", "className": "USNumberPlate" } }
  ],
  "segments": [
    {
      "id": "c7000000-0000-4000-8000-000000000002",
      "version": 1,
      "actualStart": "2026-10-14T18:05:40Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000001", "version": 1, "className": "AssignedRight" },
      "validationType": ["licensePlate"]
    }
  ],
  "extensions": {
    "apds-ext:apx:session-detail@1.0": {
      "reads": [
        { "observation": { "id": "f3000000-0000-4000-8000-000000000110", "className": "ObservationElement" }, "role": "entry", "representative": true }
      ],
      "lifecycle": "open",
      "parent": { "id": "c6000000-0000-4000-8000-000000000001", "className": "Session" }
    }
  }
}
```

A dashboard counting tonight's visits counts Sessions without a
`parent`. The valet stay is part of the 18:02 visit, not a second car.

## Step 3 — 21:47: handback, then the exit

At 21:47 the valet hands the car back, and the service closes the area
Session with a change-mode write (Part 5 §5.1):

```http
PUT /sessions/c6000000-0000-4000-8000-000000000002
APX-Update-Mode: change
If-Match: "1"
```

<!-- apx:request PUT /sessions/c6000000-0000-4000-8000-000000000002 -->
<!-- apx:validate SessionDetail at /extensions/apds-ext:apx:session-detail@1.0 -->
```json
{
  "id": "c6000000-0000-4000-8000-000000000002",
  "version": 1,
  "actualEnd": "2026-10-14T21:47:05Z",
  "extensions": {
    "apds-ext:apx:session-detail@1.0": {
      "reads": [
        { "observation": { "id": "f3000000-0000-4000-8000-000000000110", "className": "ObservationElement" }, "role": "entry", "representative": true }
      ],
      "lifecycle": "ended",
      "closure": { "endReason": "valetHandback", "endObserved": false },
      "parent": { "id": "c6000000-0000-4000-8000-000000000001", "className": "Session" }
    }
  }
}
```

The handback has no camera read, so `endObserved` is `false`: the end
time comes from the valet ticket, not from a read. A minute later the
exit camera reads the car leaving, and the visit closes with
`endReason: exitRead` and the exit read bound with `role: exit`.

## Step 4 — 22:10: a car seen only leaving

The exit camera reads `SYN-7730`. No entry read matches it; perhaps the
car came in behind another one. APDS requires `actualStart`, so the
service sets it equal to `actualEnd` and says the start was not
observed. The segment carries the transient right the server opened to
charge the exit (`e2…0150`):

<!-- apx:request POST /sessions -->
<!-- apx:validate SessionDetail at /extensions/apds-ext:apx:session-detail@1.0 -->
```json
{
  "id": "c6000000-0000-4000-8000-000000000003",
  "version": 1,
  "actualStart": "2026-10-14T22:10:31Z",
  "actualEnd": "2026-10-14T22:10:31Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-7730", "className": "USNumberPlate" } }
  ],
  "segments": [
    {
      "id": "c7000000-0000-4000-8000-000000000003",
      "version": 1,
      "actualStart": "2026-10-14T22:10:31Z",
      "actualEnd": "2026-10-14T22:10:31Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000150", "version": 1, "className": "AssignedRight" },
      "validationType": ["licensePlate"]
    }
  ],
  "extensions": {
    "apds-ext:apx:session-detail@1.0": {
      "reads": [
        { "observation": { "id": "f3000000-0000-4000-8000-000000000150", "className": "ObservationElement" }, "role": "exit", "representative": true }
      ],
      "lifecycle": "ended",
      "closure": { "endReason": "exitOnly", "startObserved": false }
    }
  }
}
```

A reporting tool that computes average dwell skips this Session, and an
occupancy count never includes it (§5.8 rule 3). Without the flag, a
zero-minute stay would pull the average down.

## Step 5 — A read claimed twice

A retry from an older build of the service tries to bind the visit's
entry read `f3…0101` to a new Session `c6…0004`. That read already
belongs to visit `c6…0001`, and the new Session is not in that visit's
`parent` chain. The server refuses the write and changes nothing:

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/read-already-bound",
  "title": "Read already bound to another Session",
  "status": 409,
  "detail": "Observation f3000000-0000-4000-8000-000000000101 is bound to Session c6000000-0000-4000-8000-000000000001; remove it there first.",
  "instance": "/sessions"
}
```

To move a read deliberately, the service first writes the Session that
holds it without the read, then binds it to the new one.
