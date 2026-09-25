# Scenario 21 — Valet: drop-off with a scanned condition report, "bring my car" by text, staged, verified handback, and the scratch that was already there

**The story.** A guest pulls up to the Lakeside Hotel valet stand
(a valet-only area of Lakeside Garage). The attendant's scanning app
photographs the car, records a scuff on the rear bumper, and the guest
taps to acknowledge. Two hours later the guest texts "bring my car"; the
reply says eight minutes. The runner stages it, the attendant verifies
the claim code, hands it back, and records the handback condition. A
week later the guest disputes "a scratch on the bumper" — and the
acknowledged drop-off report answers it.

**Actors.** Attendant scanning app (`apx.valet:manage`); the guest's
phone via SMS gateway (`apx.valet:request`, token minted for this ticket
at drop-off); runner board (`apx.valet:read`) → Lakeside Garage APX
server.

## Step 1 — Drop-off: custody and the condition report

```http
POST /v1/valet/tickets HTTP/1.1
Idempotency-Key: scan-0031-20260920-183014
Content-Type: application/json

{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL", "make": "Audi", "model": "Q5", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-20T18:30:14Z",
    "lane": { "id": "b2000000-0000-4000-8000-000000000050", "className": "VehicularAccess" },
    "attendant": "attendant-0031",
    "mileage": 41208,
    "fuelLevelPercent": 60,
    "keyTag": "K-118",
    "itemsLeft": "child seat, rear",
    "conditionReport": {
      "notes": "Scuff on rear bumper, driver side, approx 6 cm. Interior clean.",
      "damage": [
        { "area": "rearBumper", "description": "6 cm scuff, driver side", "severity": "minor", "imageLink": "https://api.lakeside-garage.example/valet/v-20419/in-rear-bumper.jpg" }
      ],
      "imageLinks": [
        "https://api.lakeside-garage.example/valet/v-20419/in-front.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-driver.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-passenger.jpg"
      ],
      "recordedTime": "2026-09-20T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  }
}
```

<!-- apx:validate ValetTicket -->
<!-- apx:validate ConditionReport at /dropOff/conditionReport -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL", "make": "Audi", "model": "Q5", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-20T18:30:14Z",
    "lane": { "id": "b2000000-0000-4000-8000-000000000050", "className": "VehicularAccess" },
    "attendant": "attendant-0031",
    "mileage": 41208,
    "fuelLevelPercent": 60,
    "keyTag": "K-118",
    "itemsLeft": "child seat, rear",
    "conditionReport": {
      "notes": "Scuff on rear bumper, driver side, approx 6 cm. Interior clean.",
      "damage": [
        { "area": "rearBumper", "description": "6 cm scuff, driver side", "severity": "minor", "imageLink": "https://api.lakeside-garage.example/valet/v-20419/in-rear-bumper.jpg" }
      ],
      "imageLinks": [
        "https://api.lakeside-garage.example/valet/v-20419/in-front.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-driver.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg",
        "https://api.lakeside-garage.example/valet/v-20419/in-passenger.jpg"
      ],
      "recordedTime": "2026-09-20T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "valetStatus": "dropped",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-20T18:30:14Z", "actor": "attendant-0031", "detail": "condition report acknowledged by customer" }
  ]
}
```

The server opened the APDS Session for the stay and referenced it; the
valet rate is a line on that session, not on this ticket. The guest's
phone gets a text with the claim link — the token behind it is
`apx.valet:request`, bound to this ticket.

## Step 2 — Parked

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park HTTP/1.1
Content-Type: application/json

{ "zone": "P3 row D", "keyLocation": "board-2 hook 17" }
```

<!-- apx:validate ValetTicket -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-20T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-20T18:36:40Z", "parkedBy": "runner-0107" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-20T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-20T18:36:40Z", "actor": "runner-0107", "detail": "P3 row D; keys board-2 hook 17" }
  ]
}
```

## Step 3 — "Bring my car": a text, an ETA

The guest replies to the claim text. The SMS gateway calls on the
guest's own token:

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/retrieve HTTP/1.1
Content-Type: application/json

{ "channel": "sms", "note": "reply: CAR" }
```

<!-- apx:validate ValetTicket -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "customer": { "displayName": "R. Ortega" },
  "dropOff": { "time": "2026-09-20T18:30:14Z" },
  "retrieval": {
    "requestedTime": "2026-09-20T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 8,
    "promisedTime": "2026-09-20T20:49:03Z"
  },
  "valetStatus": "requested"
}
```

This is the **minimized** read the customer scope gets — exactly the
Part 22 §22.5 member list: no `storage`, no key tag, no
`statusHistory` (its actors are attendant ids), no condition report —
status and ETA. Had the guest texted "CAR" again a minute later, the
same call would return this same ticket with a 200 and nothing new on
the runner board (§22.3 rule 4). The
gateway texts back "Your car will be ready in about 8 minutes at the
front entrance." `apx.valet.retrieval.requested.v1` lands on the runner
board. Had the guest used the hotel's PWA or the voice bot instead, the
only difference is `channel` — and for the bot, an opaque `interaction`
id.

## Step 4 — The runner board

```http
GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005 HTTP/1.1
```

<!-- apx:validate ValetTicket at /data/0 -->
```json
{
  "meta": { "referenceInstant": 1789936920, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000419",
      "version": 3,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20419",
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
      "dropOff": { "time": "2026-09-20T18:30:14Z", "keyTag": "K-118" },
      "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 17" },
      "retrieval": { "requestedTime": "2026-09-20T20:41:03Z", "channel": "sms", "etaMinutes": 8, "promisedTime": "2026-09-20T20:49:03Z" },
      "valetStatus": "requested"
    }
  ]
}
```

(Two later entries elided.) The runner sees the zone and the key hook;
the customer never does.

## Step 5 — Staged, then handed back to a verified claimant

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/stage HTTP/1.1
Content-Type: application/json

{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

The guest's phone gets "Your car is at the front entrance." At the stand
the guest shows the claim code; the attendant's app verifies it and
records the handback condition:

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback HTTP/1.1
Content-Type: application/json

{
  "verificationMethod": "code",
  "verificationValue": "7Q2M",
  "handedTo": "claimant presenting code 7Q2M",
  "mileage": 41209,
  "conditionReport": {
    "notes": "As received. Rear bumper scuff unchanged.",
    "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20419/out-rear.jpg" ],
    "recordedTime": "2026-09-20T20:50:30Z",
    "recordedBy": "scanner-0031"
  }
}
```

<!-- apx:validate ValetTicket -->
<!-- apx:validate ConditionReport at /handback/conditionReport -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 5,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-20T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-20T18:36:40Z" },
  "retrieval": {
    "requestedTime": "2026-09-20T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 0,
    "promisedTime": "2026-09-20T20:49:03Z",
    "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" },
    "stagedTime": "2026-09-20T20:48:12Z"
  },
  "handback": {
    "time": "2026-09-20T20:50:41Z",
    "handedTo": "claimant presenting code 7Q2M",
    "verificationMethod": "code",
    "attendant": "attendant-0031",
    "mileage": 41209,
    "conditionReport": {
      "notes": "As received. Rear bumper scuff unchanged.",
      "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20419/out-rear.jpg" ],
      "recordedTime": "2026-09-20T20:50:30Z",
      "recordedBy": "scanner-0031"
    }
  },
  "valetStatus": "handedBack",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-20T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-20T18:36:40Z", "actor": "runner-0107" },
    { "state": "requested", "time": "2026-09-20T20:41:03Z", "actor": "customer" },
    { "state": "retrieving", "time": "2026-09-20T20:42:10Z", "actor": "runner-0107" },
    { "state": "staged", "time": "2026-09-20T20:48:12Z", "actor": "runner-0107", "detail": "front entrance lane" },
    { "state": "handedBack", "time": "2026-09-20T20:50:41Z", "actor": "attendant-0031", "detail": "verified by code" }
  ]
}
```

One mile on the clock — from P3 to the front entrance. Had the code not
matched, the call would have returned 403 `valet-verification-failed`
and that attempt would sit in `statusHistory` too. The session is paid
at the stand through the ordinary payment surface; `closed` follows.

## Step 6 — A week later: "there's a scratch on my bumper"

The guest calls. The agent pulls the ticket and reads the drop-off
report: rear bumper, driver side, 6 cm scuff, photographed at 18:30:02,
**acknowledged by the customer** at drop-off; handback report at 20:50
says unchanged, with a photo. The claim is answered from the record,
not from memory — which is what the condition report, the
acknowledgement, and the two photos were for.
