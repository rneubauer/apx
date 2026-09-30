# apx-alerts — vetting scenarios

<!-- apx:module apx-alerts tag=Alerts ics=ALT -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-alerts`. Gaps the spec cannot express are marked
`gap=F-ALT-NN` and explained in `findings.md`; a gap first logged by
another module keeps that module's id (`F-CTL-07` for the 401 slug).

**Cast.** Lakeside Garage (place `b1…0001`), entry lane `b2…0001`, exit
lane 2 `b2…0002`, exit gate `c1…0002`, pay station 3 `c1…0003`, lane
display `c1…0004`, exit-lane intercom `c1…0005`; level 2 spaces
`b3…0021` (EV charging bay) through `b3…0024`. Riverside Lot (`b1…0006`,
exit lane `b2…0061`) is the same operator's gateless surface lot. Harbor
Deck (`b1…0002`, exit lane `b2…0003`) is a different operator's garage the
token has no grant for. The operator organisation is `a1…0001`; its
webhook subscription is `f5…0031`. Alerts are `e7…07NN`, events `9e…09NN`.

Every request carries `Authorization: Bearer …` with scopes
`apx.alerts:read apx.alerts:write` and an `apx_places` grant of Lakeside
Garage and Riverside Lot unless the scenario says otherwise. Requests that
raise an alert send the create shape; `id`, `version`, `status`, and
`statusHistory` are server-assigned. Server-raised alerts (device faults,
LPR, the delivery monitor) are shown as the `apx.alert.raised.v1` events
subscribers receive, since no client ever POSTs them.

---

## ALT-01 — The intercom is pressed at exit lane 2

<!-- apx:scenario ALT-01 kind=happy ics=APX-ALT-02,APX-ALT-03 -->

**Given** a driver presses the intercom at exit lane 2 and the lane
controller integrates with the alert plane. **When** it raises an
`intercomRequest` with an idempotency key, the intercom as `source.device`
and the lane as `source.place`. **Then** 201 with the full alert in
`raised`, one history entry, provenance in `recordInfo`; subscribers
receive `apx.alert.raised.v1` with the same alert as `data`; and a read by
id returns it unchanged.

```http
POST /v1/alerts
Idempotency-Key: ic-c1000005-20260924T181402
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 1,
  "alertType": "intercomRequest",
  "severity": "minor",
  "status": "raised",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" }
  ],
  "recordInfo": {
    "creationTime": "2026-09-24T18:14:02Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "lane-b2000000-0002"
  }
}
```

The call-center's subscription receives the raise:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000901",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T18:14:02Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000701", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000701",
    "version": 1,
    "alertType": "intercomRequest",
    "severity": "minor",
    "status": "raised",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
      "place": "b2000000-0000-4000-8000-000000000002"
    },
    "occurrenceTime": "2026-09-24T18:14:02Z",
    "detectionTime": "2026-09-24T18:14:02Z",
    "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" }
    ]
  }
}
```

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000701 -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 1,
  "alertType": "intercomRequest",
  "severity": "minor",
  "status": "raised",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" }
  ],
  "recordInfo": {
    "creationTime": "2026-09-24T18:14:02Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "lane-b2000000-0002"
  }
}
```

---

## ALT-02 — The lane controller retries: same key, same body, before and after acknowledgement

<!-- apx:scenario ALT-02 kind=edge ics=APX-ALT-02,APX-ALT-01 -->

**Given** the 201 from ALT-01 never reached the lane controller. **When**
it replays the identical key and body; the agent then picks up the
intercom and acknowledges; and a late duplicate arrives after that.
**Then** the first replay is 200 with the original alert, the
acknowledgement is 200 at version 2, and the late replay is 200 again — no
second alert exists. The late replay returns the alert as it now stands,
`acknowledged` at version 2 (Part 4 §4.2a, Part 7 §7.2; F-ALT-09 fixed).

```http
POST /v1/alerts
Idempotency-Key: ic-c1000005-20260924T181402
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 1,
  "alertType": "intercomRequest",
  "severity": "minor",
  "status": "raised",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" }
  ]
}
```

The agent answers the intercom and acknowledges:

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000701/acknowledge -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 2,
  "alertType": "intercomRequest",
  "severity": "minor",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" },
    { "state": "acknowledged", "time": "2026-09-24T18:14:30Z", "actor": "agent:j.okafor" }
  ]
}
```

The lane controller's queued duplicate lands after that:

```http
POST /v1/alerts
Idempotency-Key: ic-c1000005-20260924T181402
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000701",
  "version": 2,
  "alertType": "intercomRequest",
  "severity": "minor",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:14:02Z",
  "detectionTime": "2026-09-24T18:14:02Z",
  "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" },
    { "state": "acknowledged", "time": "2026-09-24T18:14:30Z", "actor": "agent:j.okafor" }
  ]
}
```

---

## ALT-03 — Same key, different body; and no key at all

<!-- apx:scenario ALT-03 kind=refusal ics=APX-ALT-02,APX-CORE-05 -->

**Given** a firmware bug reuses the intercom key for a second press on the
entry lane, and a second device omits the header entirely. **When** both
POST. **Then** 409 `idempotency-conflict` for the reused key and 400
`idempotency-key-required` for the missing one; neither raises anything.

```http
POST /v1/alerts
Idempotency-Key: ic-c1000005-20260924T181402
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T18:20:11Z"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key ic-c1000005-20260924T181402 was first used at 2026-09-24T18:14:02Z for an intercomRequest at place b2000000-0000-4000-8000-000000000002.",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T18:20:11Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/alerts is a mutating operation and requires an Idempotency-Key header (Part 7 §7.2).",
  "instance": "/v1/alerts"
}
```

---

## ALT-04 — Alerts the schema refuses: a made-up severity, no detection time

<!-- apx:scenario ALT-04 kind=refusal ics=APX-ALT-03,APX-CORE-05 -->

**Given** two integrators reading the schema loosely. **When** one sends
`severity: urgent` (severity is CLOSED) and one omits `detectionTime`.
**Then** both are 400 `invalid-request`, with `errors[]` naming the field
(Part 12 §12.4; F-ALT-05 fixed).

```http
POST /v1/alerts
Idempotency-Key: pgs-20260924T183000-a
```

<!-- apx:request POST /v1/alerts invalid -->
```json
{
  "alertType": "laneBlocked",
  "severity": "urgent",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "detectionTime": "2026-09-24T18:30:00Z"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid alert",
  "status": 400,
  "detail": "severity must be one of info, warning, minor, major, critical; got \"urgent\".",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts
Idempotency-Key: pgs-20260924T183000-b
```

<!-- apx:request POST /v1/alerts invalid -->
```json
{
  "alertType": "laneBlocked",
  "severity": "critical",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid alert",
  "status": 400,
  "detail": "detectionTime is required.",
  "instance": "/v1/alerts"
}
```

---

## ALT-05 — Pay station 3 faults: auto-raised, acknowledged, resolved

<!-- apx:scenario ALT-05 kind=lifecycle ics=APX-ALT-01,APX-ALT-03 -->

**Given** pay station 3 transitions to `fault` on the Control plane
(Part 6 §6.4 says that SHOULD auto-raise a `deviceFault`). **When** the
server raises it, the agent acknowledges it, and the field tech resolves
it two hours later. **Then** subscribers see one `apx.alert.raised.v1`
and two `apx.alert.status.v1` events, `version` climbs 1 → 2 → 3, and the
history is only ever appended to. No client POSTed the raise.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000902",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T18:17:41Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000702", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000702",
    "version": 1,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "raised",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "place": "b1000000-0000-4000-8000-000000000001"
    },
    "occurrenceTime": "2026-09-24T18:17:40Z",
    "detectionTime": "2026-09-24T18:17:41Z",
    "description": [{ "language": "en", "string": "Pay station 3 not responding" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T18:17:41Z", "actor": "lakeside-parcs", "detail": "device state available → fault (barrier arm sensor)" }
    ]
  }
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000702/acknowledge -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000702",
  "version": 2,
  "alertType": "deviceFault",
  "severity": "major",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "occurrenceTime": "2026-09-24T18:17:40Z",
  "detectionTime": "2026-09-24T18:17:41Z",
  "description": [{ "language": "en", "string": "Pay station 3 not responding" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:17:41Z", "actor": "lakeside-parcs", "detail": "device state available → fault (barrier arm sensor)" },
    { "state": "acknowledged", "time": "2026-09-24T18:19:05Z", "actor": "agent:j.okafor" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000903",
  "type": "apx.alert.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T18:19:05Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000702", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000702",
    "version": 2,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "acknowledged",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "place": "b1000000-0000-4000-8000-000000000001"
    },
    "occurrenceTime": "2026-09-24T18:17:40Z",
    "detectionTime": "2026-09-24T18:17:41Z",
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T18:17:41Z", "actor": "lakeside-parcs", "detail": "device state available → fault (barrier arm sensor)" },
      { "state": "acknowledged", "time": "2026-09-24T18:19:05Z", "actor": "agent:j.okafor" }
    ]
  }
}
```

Two hours later the tech has replaced the card reader:

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000702/resolve -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000702",
  "version": 3,
  "alertType": "deviceFault",
  "severity": "major",
  "status": "resolved",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "occurrenceTime": "2026-09-24T18:17:40Z",
  "detectionTime": "2026-09-24T18:17:41Z",
  "description": [{ "language": "en", "string": "Pay station 3 not responding" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:17:41Z", "actor": "lakeside-parcs", "detail": "device state available → fault (barrier arm sensor)" },
    { "state": "acknowledged", "time": "2026-09-24T18:19:05Z", "actor": "agent:j.okafor" },
    { "state": "resolved", "time": "2026-09-24T20:24:10Z", "actor": "tech:r.alvarez" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000904",
  "type": "apx.alert.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T20:24:10Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000702", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000702",
    "version": 3,
    "alertType": "deviceFault",
    "severity": "major",
    "status": "resolved",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
      "place": "b1000000-0000-4000-8000-000000000001"
    },
    "occurrenceTime": "2026-09-24T18:17:40Z",
    "detectionTime": "2026-09-24T18:17:41Z",
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T18:17:41Z", "actor": "lakeside-parcs", "detail": "device state available → fault (barrier arm sensor)" },
      { "state": "acknowledged", "time": "2026-09-24T18:19:05Z", "actor": "agent:j.okafor" },
      { "state": "resolved", "time": "2026-09-24T20:24:10Z", "actor": "tech:r.alvarez" }
    ]
  }
}
```

---

## ALT-06 — Lane blocked and cleared on the spot: raised straight to resolved

<!-- apx:scenario ALT-06 kind=lifecycle ics=APX-ALT-01 -->

**Given** a stalled car in exit lane 2 and an attendant already walking
over. **When** the lane raises `laneBlocked` at `critical` and, four
minutes later, the attendant resolves it without anyone having
acknowledged. **Then** 201, then 200 in `resolved` at version 2 with a
two-entry history. Part 7 §7.3 permits `raised → resolved` directly; no
acknowledgement is required.

```http
POST /v1/alerts
Idempotency-Key: lane-b2000002-20260924T184505
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "laneBlocked",
  "severity": "critical",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "occurrenceTime": "2026-09-24T18:44:50Z",
  "detectionTime": "2026-09-24T18:45:05Z",
  "description": [{ "language": "en", "string": "Vehicle stationary in exit lane 2 for 15 s after the barrier closed" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000703",
  "version": 1,
  "alertType": "laneBlocked",
  "severity": "critical",
  "status": "raised",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "occurrenceTime": "2026-09-24T18:44:50Z",
  "detectionTime": "2026-09-24T18:45:05Z",
  "description": [{ "language": "en", "string": "Vehicle stationary in exit lane 2 for 15 s after the barrier closed" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:45:05Z", "actor": "lane-b2000000-0002" }
  ]
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000703/resolve -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000703",
  "version": 2,
  "alertType": "laneBlocked",
  "severity": "critical",
  "status": "resolved",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "occurrenceTime": "2026-09-24T18:44:50Z",
  "detectionTime": "2026-09-24T18:45:05Z",
  "description": [{ "language": "en", "string": "Vehicle stationary in exit lane 2 for 15 s after the barrier closed" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:45:05Z", "actor": "lane-b2000000-0002" },
    { "state": "resolved", "time": "2026-09-24T18:49:12Z", "actor": "attendant:p.singh" }
  ]
}
```

---

## ALT-07 — Transitions the state machine forbids

<!-- apx:scenario ALT-07 kind=refusal ics=APX-ALT-01,APX-CORE-05 -->

**Given** the intercom alert is `acknowledged` (ALT-02) and the pay-station
alert is `resolved` (ALT-05). **When** a console acknowledges the
acknowledged one, acknowledges the resolved one, and resolves the resolved
one. **Then** each is 409 `alert-transition-illegal` and nothing changes
— terminal states never transition (F-ALT-01 fixed).

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000701/acknowledge -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/alert-transition-illegal",
  "title": "Alert transition not allowed",
  "status": 409,
  "detail": "Alert e7000000-0000-4000-8000-000000000701 is acknowledged; acknowledge is allowed only from raised.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000701/acknowledge"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000702/acknowledge -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/alert-transition-illegal",
  "title": "Alert transition not allowed",
  "status": 409,
  "detail": "Alert e7000000-0000-4000-8000-000000000702 is resolved, a terminal state.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000702/acknowledge"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000702/resolve -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/alert-transition-illegal",
  "title": "Alert transition not allowed",
  "status": 409,
  "detail": "Alert e7000000-0000-4000-8000-000000000702 is resolved, a terminal state.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000702/resolve"
}
```

---

## ALT-08 — An id that does not exist

<!-- apx:scenario ALT-08 kind=refusal ics=APX-ALT-01 -->

**Given** a console holding a stale id from a purged alert. **When** it
reads, acknowledges, and resolves that id. **Then** 404
`target-not-found` on all three; every Alerts route declares 404 (F-ALT-02
fixed).

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000fff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No alert e7000000-0000-4000-8000-000000000fff.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000fff"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000fff/acknowledge -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No alert e7000000-0000-4000-8000-000000000fff.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000fff/acknowledge"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000fff/resolve -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No alert e7000000-0000-4000-8000-000000000fff.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000fff/resolve"
}
```

---

## ALT-09 — An occupancy alert nobody touched expires on its own

<!-- apx:scenario ALT-09 kind=lifecycle ics=APX-ALT-01,APX-ALT-03,APX-ALT-04 -->

**Given** the occupancy engine raises `occupancyThresholdExceeded` when
Lakeside crosses 95 percent, asking for a sixty-minute window with
`expiryTime`. **When** nobody acknowledges it and occupancy falls back.
**Then** at `expiryTime` the server moves it to `expired`, publishes
`apx.alert.status.v1`, and a late acknowledge is 409. Every reader sees
when the alert will lapse (Part 7 §7.3; F-ALT-03 fixed).

```http
POST /v1/alerts
Idempotency-Key: occ-b1000001-20260924T173000
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "occupancyThresholdExceeded",
  "severity": "warning",
  "source": { "place": "b1000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T17:30:00Z",
  "expiryTime": "2026-09-24T18:30:00Z",
  "description": [{ "language": "en", "string": "Occupancy 96% (threshold 95%)" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000704",
  "version": 1,
  "alertType": "occupancyThresholdExceeded",
  "severity": "warning",
  "status": "raised",
  "source": { "place": "b1000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T17:30:00Z",
  "expiryTime": "2026-09-24T18:30:00Z",
  "description": [{ "language": "en", "string": "Occupancy 96% (threshold 95%)" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T17:30:00Z", "actor": "occupancy-engine" }
  ]
}
```

Sixty minutes later:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000905",
  "type": "apx.alert.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T18:30:00Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000704", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000704",
    "version": 2,
    "alertType": "occupancyThresholdExceeded",
    "severity": "warning",
    "status": "expired",
    "source": { "place": "b1000000-0000-4000-8000-000000000001" },
    "detectionTime": "2026-09-24T17:30:00Z",
    "expiryTime": "2026-09-24T18:30:00Z",
    "description": [{ "language": "en", "string": "Occupancy 96% (threshold 95%)" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T17:30:00Z", "actor": "occupancy-engine" },
      { "state": "expired", "time": "2026-09-24T18:30:00Z", "actor": "lakeside-parcs", "detail": "expiryTime reached unacknowledged; occupancy now 82%" }
    ]
  }
}
```

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000704 -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000704",
  "version": 2,
  "alertType": "occupancyThresholdExceeded",
  "severity": "warning",
  "status": "expired",
  "source": { "place": "b1000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T17:30:00Z",
  "expiryTime": "2026-09-24T18:30:00Z",
  "description": [{ "language": "en", "string": "Occupancy 96% (threshold 95%)" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T17:30:00Z", "actor": "occupancy-engine" },
    { "state": "expired", "time": "2026-09-24T18:30:00Z", "actor": "lakeside-parcs", "detail": "expiryTime reached unacknowledged; occupancy now 82%" }
  ]
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000704/acknowledge -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/alert-transition-illegal",
  "title": "Alert transition not allowed",
  "status": 409,
  "detail": "Alert e7000000-0000-4000-8000-000000000704 is expired, a terminal state.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000704/acknowledge"
}
```

---

## ALT-10 — The ops board: what is open, what is serious, and the subtree rule

<!-- apx:scenario ALT-10 kind=happy ics=APX-ALT-03 -->

**Given** at 19:00 two alerts are open at Lakeside, both sourced on lanes:
a `major` `deviceFault` on the exit gate (lane `b2…0002`) and a `critical`
`laneBlocked` on the entry lane (`b2…0001`). **When** the board asks for
raised alerts of `major` or worse at the *garage*, then at one lane, then
only `critical`. **Then** the garage query returns both (a lane is inside
its Place: subtree-inclusive), the lane query returns one, and the
`severityFloor` query returns only the critical one.

<!-- apx:request GET /v1/alerts?status=raised&severityFloor=major&place=b1000000-0000-4000-8000-000000000001&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790276400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000707",
      "version": 1,
      "alertType": "laneBlocked",
      "severity": "critical",
      "status": "raised",
      "source": { "place": "b2000000-0000-4000-8000-000000000001" },
      "occurrenceTime": "2026-09-24T18:58:20Z",
      "detectionTime": "2026-09-24T18:58:35Z",
      "description": [{ "language": "en", "string": "Barrier obstruction at entry lane 1" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T18:58:35Z", "actor": "lane-b2000000-0001" }
      ]
    },
    {
      "id": "e7000000-0000-4000-8000-000000000706",
      "version": 1,
      "alertType": "deviceFault",
      "severity": "major",
      "status": "raised",
      "source": {
        "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
        "place": "b2000000-0000-4000-8000-000000000002"
      },
      "occurrenceTime": "2026-09-24T18:52:03Z",
      "detectionTime": "2026-09-24T18:52:04Z",
      "description": [{ "language": "en", "string": "Exit gate arm sensor fault" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T18:52:04Z", "actor": "lakeside-parcs" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/alerts?status=raised&place=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790276400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000706",
      "version": 1,
      "alertType": "deviceFault",
      "severity": "major",
      "status": "raised",
      "source": {
        "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
        "place": "b2000000-0000-4000-8000-000000000002"
      },
      "occurrenceTime": "2026-09-24T18:52:03Z",
      "detectionTime": "2026-09-24T18:52:04Z",
      "description": [{ "language": "en", "string": "Exit gate arm sensor fault" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T18:52:04Z", "actor": "lakeside-parcs" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/alerts?status=raised&severityFloor=critical&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790276400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000707",
      "version": 1,
      "alertType": "laneBlocked",
      "severity": "critical",
      "status": "raised",
      "source": { "place": "b2000000-0000-4000-8000-000000000001" },
      "occurrenceTime": "2026-09-24T18:58:20Z",
      "detectionTime": "2026-09-24T18:58:35Z",
      "description": [{ "language": "en", "string": "Barrier obstruction at entry lane 1" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T18:58:35Z", "actor": "lane-b2000000-0001" }
      ]
    }
  ]
}
```

---

## ALT-11 — Wrong way at Riverside Lot: raised by the operator's own rule

<!-- apx:scenario ALT-11 kind=happy ics=APX-ALT-03 -->

**Given** a pickup enters Riverside Lot through the exit lane; the LPR
system reports the read as `accessEvent: entry` on lane `b2…0061`. APX
itself defines no wrong-way travel and never raises this alert (Part 13
§13.3a(6)), but `wrongWayTravel` stays in the registry as an
operator-defined type. **When** the operator's own rules engine, which
does care about lanes at this lot, raises `wrongWayTravel` with the
Observation as `relatedEntity`, and the ops console lists today's
wrong-way alerts for the lot and acknowledges the one it finds. **Then** the raise event carries the
evidence reference, the `type` + `place` + `since` query finds it under
the lot (the lane is in the subtree), and the acknowledge is 200.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000906",
  "type": "apx.alert.raised.v1",
  "source": "https://api.riverside-lot.example/v1",
  "time": "2026-09-24T07:41:09Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000741", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000741",
    "version": 1,
    "alertType": "wrongWayTravel",
    "severity": "warning",
    "status": "raised",
    "source": { "place": "b2000000-0000-4000-8000-000000000061" },
    "relatedEntity": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
    "occurrenceTime": "2026-09-24T07:41:08Z",
    "detectionTime": "2026-09-24T07:41:09Z",
    "description": [{ "language": "en", "string": "RVR-8821 read as an entry on the exit lane (operator rule R-7)" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T07:41:09Z", "actor": "riverside-ops-rules", "detail": "rule R-7: accessEvent=entry on exit lane; session f1000000-0000-4000-8000-000000000741 opened anyway" }
    ]
  }
}
```

<!-- apx:request GET /v1/alerts?type=wrongWayTravel&place=b1000000-0000-4000-8000-000000000006&since=2026-09-24T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790240400, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000741",
      "version": 1,
      "alertType": "wrongWayTravel",
      "severity": "warning",
      "status": "raised",
      "source": { "place": "b2000000-0000-4000-8000-000000000061" },
      "relatedEntity": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
      "occurrenceTime": "2026-09-24T07:41:08Z",
      "detectionTime": "2026-09-24T07:41:09Z",
      "description": [{ "language": "en", "string": "RVR-8821 read as an entry on the exit lane (operator rule R-7)" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T07:41:09Z", "actor": "riverside-ops-rules", "detail": "rule R-7: accessEvent=entry on exit lane; session f1000000-0000-4000-8000-000000000741 opened anyway" }
      ]
    }
  ]
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000741/acknowledge -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000741",
  "version": 2,
  "alertType": "wrongWayTravel",
  "severity": "warning",
  "status": "acknowledged",
  "source": { "place": "b2000000-0000-4000-8000-000000000061" },
  "relatedEntity": { "id": "f2000000-0000-4000-8000-000000000741", "className": "Observation" },
  "occurrenceTime": "2026-09-24T07:41:08Z",
  "detectionTime": "2026-09-24T07:41:09Z",
  "description": [{ "language": "en", "string": "RVR-8821 read as an entry on the exit lane (operator rule R-7)" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T07:41:09Z", "actor": "riverside-ops-rules", "detail": "rule R-7: accessEvent=entry on exit lane; session f1000000-0000-4000-8000-000000000741 opened anyway" },
    { "state": "acknowledged", "time": "2026-09-24T08:02:44Z", "actor": "ops:d.chen" }
  ]
}
```

---

## ALT-12 — The guidance system sweeps level 2: the space-status family

<!-- apx:scenario ALT-12 kind=happy ics=APX-ALT-03 -->

**Given** the parking guidance system reconciles bay sensors against
sessions every five minutes. **When** it finds a petrol car in the EV bay
and raises `iceInEvSpace` with the Session as `relatedEntity`, and the
board then lists everything raised at Lakeside since the sweep. **Then**
201, and a list holding the whole seeded space-status family:
`iceInEvSpace`, `occupiedWithoutCheckIn`, `wrongSpace`, `noCheckOut`,
`overstay`, each sourced on its Space, all `info`/`warning`.

```http
POST /v1/alerts
Idempotency-Key: pgs-b3000021-20260924T190500
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "iceInEvSpace",
  "severity": "warning",
  "source": { "place": "b3000000-0000-4000-8000-000000000021" },
  "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000321", "className": "Session" },
  "occurrenceTime": "2026-09-24T19:03:10Z",
  "detectionTime": "2026-09-24T19:05:00Z",
  "description": [{ "language": "en", "string": "Non-EV vehicle in EV charging bay L2-21" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000721",
  "version": 1,
  "alertType": "iceInEvSpace",
  "severity": "warning",
  "status": "raised",
  "source": { "place": "b3000000-0000-4000-8000-000000000021" },
  "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000321", "className": "Session" },
  "occurrenceTime": "2026-09-24T19:03:10Z",
  "detectionTime": "2026-09-24T19:05:00Z",
  "description": [{ "language": "en", "string": "Non-EV vehicle in EV charging bay L2-21" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
  ]
}
```

<!-- apx:request GET /v1/alerts?status=raised&place=b1000000-0000-4000-8000-000000000001&since=2026-09-24T19:05:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790276760, "offset": 0, "pageSize": 100, "total": 5 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000721",
      "version": 1,
      "alertType": "iceInEvSpace",
      "severity": "warning",
      "status": "raised",
      "source": { "place": "b3000000-0000-4000-8000-000000000021" },
      "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000321", "className": "Session" },
      "occurrenceTime": "2026-09-24T19:03:10Z",
      "detectionTime": "2026-09-24T19:05:00Z",
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
      ]
    },
    {
      "id": "e7000000-0000-4000-8000-000000000722",
      "version": 1,
      "alertType": "occupiedWithoutCheckIn",
      "severity": "warning",
      "status": "raised",
      "source": { "place": "b3000000-0000-4000-8000-000000000022" },
      "detectionTime": "2026-09-24T19:05:00Z",
      "description": [{ "language": "en", "string": "Bay L2-22 occupied; no session or reservation matches" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
      ]
    },
    {
      "id": "e7000000-0000-4000-8000-000000000723",
      "version": 1,
      "alertType": "wrongSpace",
      "severity": "info",
      "status": "raised",
      "source": { "place": "b3000000-0000-4000-8000-000000000023" },
      "relatedEntity": { "id": "e2000000-0000-4000-8000-000000000023", "className": "AssignedRight" },
      "detectionTime": "2026-09-24T19:05:00Z",
      "description": [{ "language": "en", "string": "Reservation holder parked in L2-23; reserved L2-30" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
      ]
    },
    {
      "id": "e7000000-0000-4000-8000-000000000724",
      "version": 1,
      "alertType": "noCheckOut",
      "severity": "info",
      "status": "raised",
      "source": { "place": "b3000000-0000-4000-8000-000000000024" },
      "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000324", "className": "Session" },
      "detectionTime": "2026-09-24T19:05:00Z",
      "description": [{ "language": "en", "string": "Bay L2-24 empty; session f1…0324 still open" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
      ]
    },
    {
      "id": "e7000000-0000-4000-8000-000000000725",
      "version": 1,
      "alertType": "overstay",
      "severity": "info",
      "status": "raised",
      "source": { "place": "b1000000-0000-4000-8000-000000000001" },
      "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000325", "className": "Session" },
      "detectionTime": "2026-09-24T19:05:00Z",
      "description": [{ "language": "en", "string": "Session f1…0325 exceeded the 12 h maximum stay by 40 min" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T19:05:00Z", "actor": "guidance-l2" }
      ]
    }
  ]
}
```

---

## ALT-13 — The lane display goes quiet, then comes back

<!-- apx:scenario ALT-13 kind=lifecycle ics=APX-ALT-01,APX-ALT-03 -->

**Given** the heartbeat monitor raises `deviceOffline` when a device's
`lastCommunication` is older than five minutes. **When** the lane display
stops answering, and twenty minutes later starts again. **Then** the
server raises the alert and, on recovery, resolves it itself — the actor
in the history is the server, not a person — and publishes
`apx.alert.status.v1`.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000907",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T21:05:00Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000708", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000708",
    "version": 1,
    "alertType": "deviceOffline",
    "severity": "minor",
    "status": "raised",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
      "place": "b2000000-0000-4000-8000-000000000002"
    },
    "occurrenceTime": "2026-09-24T20:59:59Z",
    "detectionTime": "2026-09-24T21:05:00Z",
    "description": [{ "language": "en", "string": "Lane display: no heartbeat since 20:59:59Z" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T21:05:00Z", "actor": "heartbeat-monitor" }
    ]
  }
}
```

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000708 -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000708",
  "version": 2,
  "alertType": "deviceOffline",
  "severity": "minor",
  "status": "resolved",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T20:59:59Z",
  "detectionTime": "2026-09-24T21:05:00Z",
  "description": [{ "language": "en", "string": "Lane display: no heartbeat since 20:59:59Z" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T21:05:00Z", "actor": "heartbeat-monitor" },
    { "state": "resolved", "time": "2026-09-24T21:25:12Z", "actor": "heartbeat-monitor", "detail": "device resumed communication at 21:25:11Z" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000908",
  "type": "apx.alert.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T21:25:12Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000708", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000708",
    "version": 2,
    "alertType": "deviceOffline",
    "severity": "minor",
    "status": "resolved",
    "source": {
      "device": { "id": "c1000000-0000-4000-8000-000000000004", "className": "SupplementalEquipment" },
      "place": "b2000000-0000-4000-8000-000000000002"
    },
    "occurrenceTime": "2026-09-24T20:59:59Z",
    "detectionTime": "2026-09-24T21:05:00Z",
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T21:05:00Z", "actor": "heartbeat-monitor" },
      { "state": "resolved", "time": "2026-09-24T21:25:12Z", "actor": "heartbeat-monitor", "detail": "device resumed communication at 21:25:11Z" }
    ]
  }
}
```

---

## ALT-14 — The webhook that died, and the alert that must not chase it

<!-- apx:scenario ALT-14 kind=edge ics=APX-ALT-03,APX-ALT-05 -->

**Given** subscription `f5…0031` exhausted its 24-hour retry schedule
(Part 8 §8.3) and moved to `failed`. **When** the server raises
`webhookDeliveryFailed` with the Subscription as `relatedEntity` and no
`source.place` — a subscription has none — and the ops console lists
open delivery failures. **Then** the raise is delivered to every *other*
subscriber and never to `f5…0031` (§7.4). The alert has no place binding,
so it is bound to the organisation that owns the subscription: the ops
console sees it whatever its `apx_places`, a `place`-filtered list leaves
it out, and a token of another organisation never sees it (Part 7 §7.1,
Part 9 §9.3a; F-ALT-08 fixed).

<!-- apx:validate EventEnvelope -->
<!-- apx:validate Alert at /data -->
```json
{
  "id": "9e000000-0000-4000-8000-000000000909",
  "type": "apx.alert.raised.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "time": "2026-09-24T22:00:03Z",
  "subject": { "id": "e7000000-0000-4000-8000-000000000709", "className": "Alert" },
  "data": {
    "id": "e7000000-0000-4000-8000-000000000709",
    "version": 1,
    "alertType": "webhookDeliveryFailed",
    "severity": "major",
    "status": "raised",
    "relatedEntity": { "id": "f5000000-0000-4000-8000-000000000031", "className": "Subscription" },
    "occurrenceTime": "2026-09-24T22:00:02Z",
    "detectionTime": "2026-09-24T22:00:03Z",
    "description": [{ "language": "en", "string": "Subscription f5…0031 (https://hooks.callcenter.example/apx) failed after 24 h of retries; last response 503" }],
    "statusHistory": [
      { "state": "raised", "time": "2026-09-24T22:00:03Z", "actor": "delivery-monitor", "detail": "retry schedule exhausted; subscription state failed" }
    ]
  }
}
```

<!-- apx:request GET /v1/alerts?type=webhookDeliveryFailed&status=raised -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287260, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000709",
      "version": 1,
      "alertType": "webhookDeliveryFailed",
      "severity": "major",
      "status": "raised",
      "relatedEntity": { "id": "f5000000-0000-4000-8000-000000000031", "className": "Subscription" },
      "occurrenceTime": "2026-09-24T22:00:02Z",
      "detectionTime": "2026-09-24T22:00:03Z",
      "description": [{ "language": "en", "string": "Subscription f5…0031 (https://hooks.callcenter.example/apx) failed after 24 h of retries; last response 503" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T22:00:03Z", "actor": "delivery-monitor", "detail": "retry schedule exhausted; subscription state failed" }
      ]
    }
  ]
}
```

The same console asks for open alerts at Lakeside only; the place-less
alert is excluded, since it is bound to no place:

<!-- apx:request GET /v1/alerts?type=webhookDeliveryFailed&status=raised&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287260, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

CityPark Analytics (a different organisation, granted Lakeside for its
occupancy feed) runs the unfiltered query and gets nothing either:

<!-- apx:request GET /v1/alerts?type=webhookDeliveryFailed -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287260, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## ALT-15 — Wrong scope, wrong grant, no grant

<!-- apx:scenario ALT-15 kind=security ics=APX-CORE-07,APX-CORE-08,APX-ALT-01 -->

**Given** five tokens. **When** a read-only token raises an alert; a
write-only token lists them; a Lakeside token raises one on Harbor Deck's
exit lane; the same token lists Harbor Deck's alerts; a token with no
`apx_places` claim raises one at Lakeside; and the read-only token
acknowledges. **Then** 403 `insufficient-scope`, 403 `insufficient-scope`,
403 `insufficient-grant`, 403 `insufficient-grant`, 403
`insufficient-grant` (fail-closed), and 403 `insufficient-scope` on the
acknowledge (F-ALT-02 fixed).

```http
POST /v1/alerts
Authorization: Bearer <apx.alerts:read only>
Idempotency-Key: ro-0001
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "detectionTime": "2026-09-24T19:10:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/alerts requires scope apx.alerts:write; token carries apx.alerts:read.",
  "instance": "/v1/alerts"
}
```

```http
GET /v1/alerts?status=raised
Authorization: Bearer <apx.alerts:write only>
```

<!-- apx:request GET /v1/alerts?status=raised -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/alerts requires scope apx.alerts:read; token carries apx.alerts:write.",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
Idempotency-Key: harbor-0001
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "laneBlocked",
  "severity": "critical",
  "source": { "place": "b2000000-0000-4000-8000-000000000003" },
  "detectionTime": "2026-09-24T19:11:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "source.place b2000000-0000-4000-8000-000000000003 belongs to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/alerts"
}
```

<!-- apx:request GET /v1/alerts?place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts
Authorization: Bearer <no apx_places claim at all>
Idempotency-Key: noclaim-0001
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "detectionTime": "2026-09-24T19:12:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge
Authorization: Bearer <apx.alerts:read only>
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/alerts/{id}/acknowledge requires scope apx.alerts:write; token carries apx.alerts:read.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge"
}
```

---

## ALT-16 — Harbor Deck's alert, by id

<!-- apx:scenario ALT-16 kind=security ics=APX-CORE-07 -->

**Given** a Lakeside token somehow holds the id of an alert raised at
Harbor Deck. **When** it reads that id. **Then** 403 `insufficient-grant`
(Part 9 §9.3a rule 1), now declared on the route (F-ALT-02 fixed).

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000799 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Alert e7000000-0000-4000-8000-000000000799 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000799"
}
```

---

## ALT-17 — A dashboard polls too fast, then its token dies

<!-- apx:scenario ALT-17 kind=edge ics=APX-CORE-05 -->

**Given** a wallboard polling the alert list every 200 ms while a lane
controller floods raises during a retry storm. **When** both exceed the
rate limit, and later both keep going on an expired token. **Then** 429
with `Retry-After` on the raise and the list, and 401 `unauthenticated`
on both (F-CTL-07 fixed).

```http
POST /v1/alerts
Idempotency-Key: ic-c1000005-20260924T191500
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "detectionTime": "2026-09-24T19:15:00Z"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 120/min; retry after 5 seconds.",
  "instance": "/v1/alerts"
}
```

<!-- apx:request GET /v1/alerts?status=raised&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/alerts"
}
```

```http
POST /v1/alerts
Authorization: Bearer <expired>
Idempotency-Key: ic-c1000005-20260924T230100
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "intercomRequest",
  "severity": "minor",
  "source": { "place": "b2000000-0000-4000-8000-000000000002" },
  "detectionTime": "2026-09-24T23:01:00Z"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/alerts"
}
```

<!-- apx:request GET /v1/alerts?status=raised -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/alerts"
}
```

---

## ALT-18 — A vendor extension and an implementer alert type survive the round-trip

<!-- apx:scenario ALT-18 kind=edge ics=APX-CORE-04,APX-ALT-03 -->

**Given** the POS vendor decorates a `paymentException` with its own
`apds-ext:acmepos:reversal@1.0` block, and the operator's own code list
defines `elevatorEntrapment`, which is in nobody's registry. **When** the
first is raised and acknowledged, and the second is raised. **Then** the
extension key comes back byte-for-byte on the 201 and again after the
acknowledge (tolerant reader, faithful writer), and the open taxonomy
accepts the implementer type with 201.

```http
POST /v1/alerts
Idempotency-Key: pos-c1000003-20260924T192240
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "paymentException",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000330", "className": "Session" },
  "detectionTime": "2026-09-24T19:22:40Z",
  "description": [{ "language": "en", "string": "Card reversal posted after ticket was marked paid" }],
  "extensions": {
    "apds-ext:acmepos:reversal@1.0": { "terminalRef": "PS3-778102", "reasonCode": "R07", "amount": { "currencyType": "USD", "currencyValue": 9.0 } }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000710",
  "version": 1,
  "alertType": "paymentException",
  "severity": "minor",
  "status": "raised",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000330", "className": "Session" },
  "detectionTime": "2026-09-24T19:22:40Z",
  "description": [{ "language": "en", "string": "Card reversal posted after ticket was marked paid" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T19:22:40Z", "actor": "pos-c1000000-0003" }
  ],
  "extensions": {
    "apds-ext:acmepos:reversal@1.0": { "terminalRef": "PS3-778102", "reasonCode": "R07", "amount": { "currencyType": "USD", "currencyValue": 9.0 } }
  }
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000710/acknowledge -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000710",
  "version": 2,
  "alertType": "paymentException",
  "severity": "minor",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "relatedEntity": { "id": "f1000000-0000-4000-8000-000000000330", "className": "Session" },
  "detectionTime": "2026-09-24T19:22:40Z",
  "description": [{ "language": "en", "string": "Card reversal posted after ticket was marked paid" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T19:22:40Z", "actor": "pos-c1000000-0003" },
    { "state": "acknowledged", "time": "2026-09-24T19:30:02Z", "actor": "finance:l.moreau" }
  ],
  "extensions": {
    "apds-ext:acmepos:reversal@1.0": { "terminalRef": "PS3-778102", "reasonCode": "R07", "amount": { "currencyType": "USD", "currencyValue": 9.0 } }
  }
}
```

```http
POST /v1/alerts
Idempotency-Key: bms-elev2-20260924T193310
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "alertType": "elevatorEntrapment",
  "severity": "critical",
  "source": { "place": "b1000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T19:33:10Z",
  "description": [{ "language": "en", "string": "Elevator 2 stopped between L2 and L3 with occupants; BMS call button pressed" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000711",
  "version": 1,
  "alertType": "elevatorEntrapment",
  "severity": "critical",
  "status": "raised",
  "source": { "place": "b1000000-0000-4000-8000-000000000001" },
  "detectionTime": "2026-09-24T19:33:10Z",
  "description": [{ "language": "en", "string": "Elevator 2 stopped between L2 and L3 with occupants; BMS call button pressed" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T19:33:10Z", "actor": "bms-lakeside" }
  ]
}
```

---

## ALT-19 — A client-supplied id, and the collision

<!-- apx:scenario ALT-19 kind=edge ics=APX-CORE-03,APX-ALT-02 -->

**Given** a building-management system mints its own UUIDs (APDS
convention, Part 4 §4.1). **When** it raises with `id` set, and a second
integration later reuses that id under a fresh idempotency key for a
different alert. **Then** 201 echoing the supplied id, then 409
`id-collision` — not `idempotency-conflict`, because the key is new. Part 7
§7.1 and the `Alert.id` description now say a client MAY supply the id on
raise, and the 409 on `POST /v1/alerts` names `id-collision` (F-ALT-07
fixed in prose; `readOnly` stays, as the server's authority over the
value).

```http
POST /v1/alerts
Idempotency-Key: bms-hvac-20260924T194000
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000712",
  "alertType": "deviceFault",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000041", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "detectionTime": "2026-09-24T19:40:00Z",
  "description": [{ "language": "en", "string": "Jet fan L3-East: motor overtemperature" }]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000712",
  "version": 1,
  "alertType": "deviceFault",
  "severity": "minor",
  "status": "raised",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000041", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "detectionTime": "2026-09-24T19:40:00Z",
  "description": [{ "language": "en", "string": "Jet fan L3-East: motor overtemperature" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T19:40:00Z", "actor": "bms-lakeside" }
  ]
}
```

```http
POST /v1/alerts
Idempotency-Key: bms-hvac-20260924T194130
```

<!-- apx:request POST /v1/alerts -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000712",
  "alertType": "deviceFault",
  "severity": "minor",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000042", "className": "SupplementalEquipment" },
    "place": "b1000000-0000-4000-8000-000000000001"
  },
  "detectionTime": "2026-09-24T19:41:30Z",
  "description": [{ "language": "en", "string": "Jet fan L3-West: motor overtemperature" }]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/id-collision",
  "title": "Identifier already exists",
  "status": 409,
  "detail": "Alert e7000000-0000-4000-8000-000000000712 already exists (raised 2026-09-24T19:40:00Z); supply a new UUID or omit id.",
  "instance": "/v1/alerts"
}
```

---

## ALT-20 — Acknowledge with a note, on behalf of a named agent

<!-- apx:scenario ALT-20 kind=edge ics=APX-ALT-01 -->

**Given** the agent acknowledging the exit-gate fault wants the audit
trail to say a tech is on the way — exactly what the public scenario 02
shows as `detail: "field tech dispatched"`. **When** the shared console
sends an `AlertTransition` body with that note and the agent's principal.
**Then** the appended history entry carries both (Part 7 §7.2; F-ALT-04
fixed). A body the schema refuses is 400 `invalid-request`.

```http
POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge
Content-Type: application/json
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge -->
```json
{
  "detail": "field tech dispatched, ETA 40 min",
  "agent": "agent:j.okafor"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000706",
  "version": 2,
  "alertType": "deviceFault",
  "severity": "major",
  "status": "acknowledged",
  "source": {
    "device": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
    "place": "b2000000-0000-4000-8000-000000000002"
  },
  "occurrenceTime": "2026-09-24T18:52:03Z",
  "detectionTime": "2026-09-24T18:52:04Z",
  "description": [{ "language": "en", "string": "Exit gate arm sensor fault" }],
  "statusHistory": [
    { "state": "raised", "time": "2026-09-24T18:52:04Z", "actor": "lakeside-parcs" },
    { "state": "acknowledged", "time": "2026-09-24T19:02:15Z", "actor": "agent:j.okafor", "detail": "field tech dispatched, ETA 40 min" }
  ]
}
```

---

## ALT-21 — Everything about one device, everything about one subscription

<!-- apx:scenario ALT-21 kind=happy ics=APX-ALT-03 -->

**Given** a technician standing at the exit-lane intercom, and an
integrations engineer chasing the dead webhook from ALT-14. **When** the
technician lists the alerts whose `source.device` is the intercom, and
the engineer lists the alerts whose `relatedEntity` is the subscription.
**Then** each gets exactly its own alerts, without paging the whole place
(Part 7 §7.2; F-ALT-06 fixed).

<!-- apx:request GET /v1/alerts?device=c1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287260, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000701",
      "version": 2,
      "alertType": "intercomRequest",
      "severity": "minor",
      "status": "acknowledged",
      "source": {
        "device": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
        "place": "b2000000-0000-4000-8000-000000000002"
      },
      "occurrenceTime": "2026-09-24T18:14:02Z",
      "detectionTime": "2026-09-24T18:14:02Z",
      "description": [{ "language": "en", "string": "Intercom pressed at exit lane 2" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T18:14:02Z", "actor": "lane-b2000000-0002" },
        { "state": "acknowledged", "time": "2026-09-24T18:14:30Z", "actor": "agent:j.okafor" }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/alerts?relatedEntity=f5000000-0000-4000-8000-000000000031&status=raised -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287260, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000709",
      "version": 1,
      "alertType": "webhookDeliveryFailed",
      "severity": "major",
      "status": "raised",
      "relatedEntity": { "id": "f5000000-0000-4000-8000-000000000031", "className": "Subscription" },
      "occurrenceTime": "2026-09-24T22:00:02Z",
      "detectionTime": "2026-09-24T22:00:03Z",
      "description": [{ "language": "en", "string": "Subscription f5…0031 (https://hooks.callcenter.example/apx) failed after 24 h of retries; last response 503" }],
      "statusHistory": [
        { "state": "raised", "time": "2026-09-24T22:00:03Z", "actor": "delivery-monitor", "detail": "retry schedule exhausted; subscription state failed" }
      ]
    }
  ]
}
```

---

## ALT-22 — The shared refusals on the id-addressed Alerts routes

<!-- apx:scenario ALT-22 kind=security ics=APX-CORE-05,APX-CORE-07,APX-ALT-01 -->

**Given** a console with a transition body bug, a read-only wallboard, a
tight polling loop, and an expired token. **When** each hits the read and
transition routes. **Then** 400 `invalid-request` with `errors[]`, 403
`insufficient-scope`, 429 `rate-limited`, and 401 `unauthenticated`, each
declared on the route (Part 12 §12.3).

A console sends `detail` as an object rather than a string:

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000702/acknowledge invalid -->
```json
{
  "detail": { "note": "tech dispatched" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "The AlertTransition body does not match its schema.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000702/acknowledge",
  "errors": [{ "pointer": "/detail", "detail": "must be a string" }]
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000703/resolve invalid -->
```json
{
  "agent": 42
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "The AlertTransition body does not match its schema.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000703/resolve",
  "errors": [{ "pointer": "/agent", "detail": "must be a string" }]
}
```

```http
POST /v1/alerts/e7000000-0000-4000-8000-000000000706/resolve
Authorization: Bearer <apx.alerts:read only>
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/resolve -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/alerts/{id}/resolve requires scope apx.alerts:write; token carries apx.alerts:read.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/resolve"
}
```

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000706 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/resolve -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/resolve"
}
```

<!-- apx:request GET /v1/alerts/e7000000-0000-4000-8000-000000000706 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/acknowledge"
}
```

<!-- apx:request POST /v1/alerts/e7000000-0000-4000-8000-000000000706/resolve -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/alerts/e7000000-0000-4000-8000-000000000706/resolve"
}
```
