# apx-valet — vetting scenarios

<!-- apx:module apx-valet tag=Valet ics=VLT -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-valet`. Gaps the spec cannot express are marked
`gap=F-VLT-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`) runs a valet-only area for the
Lakeside Hotel, the valet stand `b1…0005`, whose drop-off lane is
`b2…0050` and whose staging lane at the front entrance is `b2…0051`.
Level P3 is space-mapped; row D hook 17 is APDS Space `c3…0117`. Harbor
Deck (`b1…0002`, valet stand `b1…0006`, ticket `d8…0902`) belongs to
another operator and is outside the token's grant. The operator
organisation is `a1…0001`. The people: attendant `attendant-0031` with
scanning app `scanner-0031`, runners `runner-0107` and `runner-0112`, the
hotel's voice bot `bot-valet-01`, the call-centre agent `agent-4412`.
The guests: R. Ortega (grey Audi Q5 `SYN-7734`, ticket V-20419 `d8…0419`,
APDS Session `f1…0419`), hotel guest M. Adeyemi on account `e7…0042`
(ticket V-20420 `d8…0420`, claim ticket AssignedRight `e2…0420`, pickup
booked for 07:30), a walk-in who changes their mind (V-20421 `d8…0421`),
an abandoned drop-off (V-20422 `d8…0422`), a second guest in the queue
(V-20423 `d8…0423`), and six more (`d8…0424` – `d8…0429`) who each ask
for their car through a different channel.

Every request carries `Authorization: Bearer …` with scopes
`apx.valet:read apx.valet:manage` and `apx_places` containing Lakeside
Garage unless the scenario says otherwise. The guest's phone, the hotel
PWA, and the voice bot carry `apx.valet:request` bound to one ticket.
Requests that create resources send the create shape; `id`, `version`,
`valetStatus`, `handback`, and `statusHistory` are server-assigned. Money
never appears on a ticket: the stay and the valet fee are the APDS
Session the ticket references.

---

## VLT-01 — Drop-off with a scanned condition report; the stay is a Session

<!-- apx:scenario VLT-01 kind=happy ics=APX-VLT-01,APX-VLT-02,APX-VLT-03,APX-VLT-07,APX-VLT-08 -->

**Given** a guest pulls up at the hotel valet stand and the attendant's
scanning app photographs the car, records a scuff on the rear bumper,
and the guest taps to acknowledge. **When** the app posts the drop-off
with an idempotency key. **Then** 201 with the ticket in `dropped`, the
APDS Session for the stay referenced (never restated), the contact
handle masked, imagery as links, and `apx.valet.ticket.status.v1`
published with the ticket as `data`.

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-183014
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL", "make": "Audi", "model": "Q5", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-24T18:30:14Z",
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
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg"
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  }
}
```

<!-- apx:response 201 -->
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
    "time": "2026-09-24T18:30:14Z",
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
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg"
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "valetStatus": "dropped",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031", "detail": "condition report acknowledged by customer" }
  ],
  "recordInfo": { "creationTime": "2026-09-24T18:30:14Z", "creationUser": "scanner-0031" }
}
```

The event the runner board and the hotel's notification service receive:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d01",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000419", "className": "ValetTicket" },
  "time": "2026-09-24T18:30:14Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000419",
    "version": 1,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
    "ticketNumber": "V-20419",
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
    "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "keyTag": "K-118" },
    "valetStatus": "dropped",
    "statusHistory": [
      { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031", "detail": "condition report acknowledged by customer" }
    ]
  }
}
```

---

## VLT-02 — The scanner retries after a dead spot: same key, same body; then a different body

<!-- apx:scenario VLT-02 kind=edge ics=APX-VLT-01,APX-CORE-05 -->

**Given** the 201 from VLT-01 never reached the handheld in the P3 ramp.
**When** it retries with the identical key and body. **Then** 200 with the
ORIGINAL ticket, no second custody record. A second scanner reusing the
same key for a different car is 409 `idempotency-conflict`.

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-183014
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL", "make": "Audi", "model": "Q5", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-24T18:30:14Z",
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
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg"
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  }
}
```

<!-- apx:response 200 -->
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
    "time": "2026-09-24T18:30:14Z",
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
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg"
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "valetStatus": "dropped",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031", "detail": "condition report acknowledged by customer" }
  ]
}
```

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-183014
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20423",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KLM-2210", "make": "Toyota", "colour": "white" },
  "dropOff": { "time": "2026-09-24T18:31:40Z", "attendant": "attendant-0031", "keyTag": "K-119" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key scan-0031-20260924-183014 was first used at 2026-09-24T18:30:14Z for ticket V-20419 (SYN-7734).",
  "instance": "/v1/valet/tickets"
}
```

---

## VLT-03 — Broken drop-offs: no key, no drop-off time, a place nobody has

<!-- apx:scenario VLT-03 kind=refusal ics=APX-VLT-01,APX-CORE-05 -->

**Given** three misconfigured handhelds. **When** one omits
`Idempotency-Key`, one sends a ticket with no `dropOff`, and one names a
valet stand that does not exist. **Then** 400 `idempotency-key-required`,
400 `invalid-request` with an `errors[]` pointer, and 422
`reference-unknown` (F-VLT-01 and F-VLT-02, fixed: both slugs are now
registered and named in the operation's descriptions).

```http
POST /v1/valet/tickets
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20423",
  "dropOff": { "time": "2026-09-24T18:31:40Z", "attendant": "attendant-0031" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/valet/tickets is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/valet/tickets"
}
```

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-183150
```

<!-- apx:request POST /v1/valet/tickets invalid -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20423",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KLM-2210" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid ticket",
  "status": 400,
  "detail": "dropOff is required; dropOff.time is required.",
  "instance": "/v1/valet/tickets"
}
```

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-183205
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-0000000000ee", "className": "Place" },
  "ticketNumber": "V-20423",
  "dropOff": { "time": "2026-09-24T18:32:05Z", "attendant": "attendant-0031" }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Referenced entity unknown",
  "status": 422,
  "detail": "place b1000000-0000-4000-8000-0000000000ee is not a HierarchyElement at this operator.",
  "instance": "/v1/valet/tickets"
}
```

---

## VLT-04 — Parked: a zone and a hook, then moved to a mapped space

<!-- apx:scenario VLT-04 kind=lifecycle ics=APX-VLT-01 -->

**Given** the runner drives V-20419 down to P3. **When** they record the
row and the key hook, and twenty minutes later move it into a mapped
Space to free the row. **Then** the first `park` transitions `dropped →
parked`, the second updates `storage` while `parked` (legal per §22.1
rule 1), and each appends a history entry. A third runner whose screen
still shows version 2 sends `If-Match: "2"` and is refused 409
`version-conflict` instead of overwriting the move (F-VLT-09, fixed:
§22.1 rule 6). A ticket id that does not exist is 404.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park -->
```json
{ "zone": "P3 row D", "keyLocation": "board-2 hook 17" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-24T18:36:40Z", "parkedBy": "runner-0107" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107", "detail": "P3 row D; keys board-2 hook 17" }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park -->
```json
{
  "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" },
  "keyLocation": "board-2 hook 17",
  "note": "moved into P3-D-17 to clear the row for the 19:00 arrivals"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": {
    "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" },
    "zone": "P3 row D",
    "keyLocation": "board-2 hook 17",
    "parkedTime": "2026-09-24T18:56:10Z",
    "parkedBy": "runner-0112"
  },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107", "detail": "P3 row D; keys board-2 hook 17" },
    { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17; moved into P3-D-17 to clear the row for the 19:00 arrivals" }
  ]
}
```

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park
If-Match: "2"
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park -->
```json
{ "zone": "P3 row D", "keyLocation": "board-2 hook 17", "note": "back to the row" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "If-Match \"2\" is stale; valet ticket V-20419 is at version 3 (storage moved to Space P3-D-17 at 18:56:10). Nothing was written.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/park -->
```json
{ "zone": "P3 row D" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/park"
}
```

---

## VLT-05 — "CAR" texted two minutes after drop-off: nobody knows where it is yet

<!-- apx:scenario VLT-05 kind=refusal ics=APX-VLT-01,APX-VLT-06 -->

**Given** the guest of V-20423 changes plans in the lobby and texts
`CAR` before the runner has parked it. **When** the SMS gateway calls
`retrieve` on the guest's own token. **Then** 409
`valet-vehicle-not-located`, not `valet-transition-illegal`: the ticket
is `dropped`, the car is somewhere on the ramp, and the gateway texts
"give us a moment" rather than an ETA.

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0423>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/retrieve -->
```json
{ "channel": "sms", "note": "reply: CAR" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-vehicle-not-located",
  "title": "Vehicle not yet located",
  "status": 409,
  "detail": "Ticket V-20423 is still dropped; no parked position has been recorded.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/retrieve"
}
```

---

## VLT-06 — "Bring my car" by text: an ETA, a minimized read, two events

<!-- apx:scenario VLT-06 kind=happy ics=APX-VLT-04,APX-VLT-06,APX-VLT-08 -->

**Given** two hours later the guest of V-20419 replies `CAR` to the claim
text. **When** the SMS gateway calls `retrieve` on the guest's
`apx.valet:request` token. **Then** 200 with `etaMinutes` and
`promisedTime` set, in the minimized projection of §22.5 (exactly the
listed members: no `storage`, no key tag, no `statusHistory`, no
`requestedBy`, no condition report — F-VLT-12, fixed), and the server
publishes both `apx.valet.retrieval.requested.v1` and
`apx.valet.ticket.status.v1`. The guest texts `CAR` again a minute later;
the repeat is 200 with the same ticket and nothing is republished
(F-VLT-13, fixed: §22.3 rule 4).

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0419>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/retrieve -->
```json
{ "channel": "sms", "note": "reply: CAR" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 8,
    "promisedTime": "2026-09-24T20:49:03Z"
  },
  "valetStatus": "requested"
}
```

The guest's second `CAR`, a minute later — not an error, and not a
second request: the same version, the recomputed ETA, no new history
entry, no event:

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0419>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/retrieve -->
```json
{ "channel": "sms", "note": "reply: CAR" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 7,
    "promisedTime": "2026-09-24T20:49:03Z"
  },
  "valetStatus": "requested"
}
```

The guest's minimized read a minute after that — the same shape, ETA
recomputed as the queue moved:

```http
GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000419
Authorization: Bearer <apx.valet:request, bound to d8…0419>
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000419 -->
<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 6,
    "promisedTime": "2026-09-24T20:49:03Z"
  },
  "valetStatus": "requested"
}
```

What the runner board receives — the full ticket, keys and all:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d02",
  "type": "apx.valet.retrieval.requested.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000419", "className": "ValetTicket" },
  "time": "2026-09-24T20:41:03Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000419",
    "version": 4,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
    "ticketNumber": "V-20419",
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
    "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "keyTag": "K-118" },
    "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "zone": "P3 row D", "keyLocation": "board-2 hook 17" },
    "retrieval": { "requestedTime": "2026-09-24T20:41:03Z", "channel": "sms", "requestedBy": "customer", "etaMinutes": 8, "promisedTime": "2026-09-24T20:49:03Z" },
    "valetStatus": "requested",
    "statusHistory": [
      { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
      { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107" },
      { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
      { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" }
    ]
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d03",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000419", "className": "ValetTicket" },
  "time": "2026-09-24T20:41:03Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000419",
    "version": 4,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "ticketNumber": "V-20419",
    "dropOff": { "time": "2026-09-24T18:30:14Z" },
    "retrieval": { "requestedTime": "2026-09-24T20:41:03Z", "channel": "sms", "etaMinutes": 8, "promisedTime": "2026-09-24T20:49:03Z" },
    "valetStatus": "requested"
  }
}
```

---

## VLT-07 — The other ways to ask: app, web, voice bot, kiosk, the stand, the call centre

<!-- apx:scenario VLT-07 kind=happy ics=APX-VLT-04,APX-VLT-06 -->

**Given** six parked cars and six guests. **When** one taps the hotel PWA,
one uses the web page from the claim link, one tells the voice bot, one
uses the lobby kiosk, one walks up to the stand, and one calls the
operator's call centre. **Then** the only difference on the wire is
`channel` — and, for the bot and the call centre, an opaque
`interaction` id. The first three use the customer scope; the last three
use `apx.valet:manage`.

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000424/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0424>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000424/retrieve -->
```json
{ "channel": "app" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000424",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20424",
  "vehicle": { "make": "Tesla", "model": "Model 3", "colour": "blue" },
  "dropOff": { "time": "2026-09-24T19:02:33Z" },
  "retrieval": { "requestedTime": "2026-09-24T20:52:10Z", "channel": "app", "etaMinutes": 12, "promisedTime": "2026-09-24T21:04:10Z" },
  "valetStatus": "requested"
}
```

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000425/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0425>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000425/retrieve -->
```json
{ "channel": "web" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000425",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20425",
  "vehicle": { "make": "Honda", "model": "CR-V", "colour": "black" },
  "dropOff": { "time": "2026-09-24T19:10:05Z" },
  "retrieval": { "requestedTime": "2026-09-24T20:53:41Z", "channel": "web", "etaMinutes": 13, "promisedTime": "2026-09-24T21:06:41Z" },
  "valetStatus": "requested"
}
```

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000426/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0426>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000426/retrieve -->
```json
{ "channel": "voiceBot", "interaction": "ivr-2026-09-24-7f3a91", "note": "caller confirmed plate ending 0921" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000426",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20426",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "RTQ-0921" },
  "dropOff": { "time": "2026-09-24T19:15:52Z" },
  "retrieval": { "requestedTime": "2026-09-24T20:55:07Z", "channel": "voiceBot", "etaMinutes": 15, "promisedTime": "2026-09-24T21:10:07Z" },
  "valetStatus": "requested"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/retrieve -->
```json
{ "channel": "kiosk", "note": "lobby kiosk 2; ticket V-20427 scanned" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000427",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20427",
  "vehicle": { "make": "Ford", "model": "Explorer", "colour": "red" },
  "dropOff": { "time": "2026-09-24T19:20:19Z", "attendant": "attendant-0031", "keyTag": "K-124" },
  "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 22" },
  "retrieval": { "requestedTime": "2026-09-24T20:56:30Z", "channel": "kiosk", "requestedBy": "kiosk-lobby-2", "etaMinutes": 16, "promisedTime": "2026-09-24T21:12:30Z" },
  "valetStatus": "requested"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000428/retrieve -->
```json
{ "channel": "attendant", "note": "guest at the stand, ticket presented" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000428",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20428",
  "vehicle": { "make": "BMW", "model": "X3", "colour": "silver" },
  "dropOff": { "time": "2026-09-24T19:25:44Z", "attendant": "attendant-0031", "keyTag": "K-125" },
  "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 23" },
  "retrieval": { "requestedTime": "2026-09-24T20:57:12Z", "channel": "attendant", "requestedBy": "attendant-0031", "etaMinutes": 17, "promisedTime": "2026-09-24T21:14:12Z" },
  "valetStatus": "requested"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000429/retrieve -->
```json
{ "channel": "callCenter", "interaction": "cc-2026-09-24-118204", "note": "guest called the hotel line; wants the car at 21:30" , "requestedFor": "2026-09-24T21:30:00Z" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000429",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20429",
  "vehicle": { "make": "Volvo", "model": "XC60", "colour": "green" },
  "dropOff": { "time": "2026-09-24T19:31:02Z", "attendant": "attendant-0031", "keyTag": "K-126" },
  "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 24" },
  "retrieval": { "requestedTime": "2026-09-24T20:58:40Z", "requestedFor": "2026-09-24T21:30:00Z", "channel": "callCenter", "requestedBy": "agent-4412", "interaction": "cc-2026-09-24-118204", "etaMinutes": 31, "promisedTime": "2026-09-24T21:30:00Z" },
  "valetStatus": "requested"
}
```

---

## VLT-08 — A pickup booked for 07:30, and the runner board's horizon

<!-- apx:scenario VLT-08 kind=happy ics=APX-VLT-02,APX-VLT-04 -->

**Given** hotel guest M. Adeyemi, on an account, with an AssignedRight
as the claim ticket, books the car for 07:30 tomorrow from the PWA at
22:10. **When** the stand reads the queue with the default horizon, then
with a twelve-hour one. **Then** the scheduled pickup is absent from the
first read and present in the second, and the queue is ordered by
`promisedTime`. `etaMinutes` is 559: whole minutes from 22:10:44 until
the promised 07:30, counting down on every read (F-VLT-14, fixed: §22.3
rule 1). The queue for a place that does not exist is 404.

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0420>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve -->
```json
{ "channel": "app", "requestedFor": "2026-09-25T07:30:00Z" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000420",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20420",
  "vehicle": { "make": "Lexus", "model": "RX", "colour": "white" },
  "customer": { "displayName": "M. Adeyemi" },
  "dropOff": { "time": "2026-09-24T17:05:20Z" },
  "retrieval": { "requestedTime": "2026-09-24T22:10:44Z", "requestedFor": "2026-09-25T07:30:00Z", "channel": "app", "etaMinutes": 559, "promisedTime": "2026-09-25T07:30:00Z" },
  "valetStatus": "requested"
}
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287900, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000429",
      "version": 3,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20429",
      "vehicle": { "make": "Volvo", "model": "XC60", "colour": "green" },
      "dropOff": { "time": "2026-09-24T19:31:02Z", "keyTag": "K-126" },
      "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 24" },
      "retrieval": { "requestedTime": "2026-09-24T20:58:40Z", "requestedFor": "2026-09-24T21:30:00Z", "channel": "callCenter", "etaMinutes": 0, "promisedTime": "2026-09-24T21:30:00Z", "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" }, "stagedTime": "2026-09-24T21:26:15Z" },
      "valetStatus": "staged"
    },
    {
      "id": "d8000000-0000-4000-8000-000000000423",
      "version": 4,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20423",
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KLM-2210", "make": "Toyota", "colour": "white" },
      "dropOff": { "time": "2026-09-24T18:31:40Z", "keyTag": "K-119" },
      "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 18" },
      "retrieval": { "requestedTime": "2026-09-24T22:08:02Z", "channel": "sms", "etaMinutes": 7, "promisedTime": "2026-09-24T22:16:02Z", "retrievingBy": "runner-0112" },
      "valetStatus": "retrieving"
    }
  ]
}
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005&horizonMinutes=720 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287900, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000429",
      "version": 3,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20429",
      "dropOff": { "time": "2026-09-24T19:31:02Z", "keyTag": "K-126" },
      "retrieval": { "requestedTime": "2026-09-24T20:58:40Z", "requestedFor": "2026-09-24T21:30:00Z", "channel": "callCenter", "etaMinutes": 0, "promisedTime": "2026-09-24T21:30:00Z" },
      "valetStatus": "staged"
    },
    {
      "id": "d8000000-0000-4000-8000-000000000423",
      "version": 4,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20423",
      "dropOff": { "time": "2026-09-24T18:31:40Z", "keyTag": "K-119" },
      "retrieval": { "requestedTime": "2026-09-24T22:08:02Z", "channel": "sms", "etaMinutes": 7, "promisedTime": "2026-09-24T22:16:02Z", "retrievingBy": "runner-0112" },
      "valetStatus": "retrieving"
    },
    {
      "id": "d8000000-0000-4000-8000-000000000420",
      "version": 3,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "session": { "id": "f1000000-0000-4000-8000-000000000420", "className": "Session" },
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000420", "className": "AssignedRight" },
      "ticketNumber": "V-20420",
      "vehicle": { "make": "Lexus", "model": "RX", "colour": "white" },
      "customer": { "account": { "id": "e7000000-0000-4000-8000-000000000042", "className": "Account" }, "displayName": "M. Adeyemi", "contactChannel": { "type": "app", "handle": "push:9f1c…e2" } },
      "dropOff": { "time": "2026-09-24T17:05:20Z", "keyTag": "K-110" },
      "storage": { "zone": "P2 row A", "keyLocation": "board-1 hook 03" },
      "retrieval": { "requestedTime": "2026-09-24T22:10:44Z", "requestedFor": "2026-09-25T07:30:00Z", "channel": "app", "etaMinutes": 559, "promisedTime": "2026-09-25T07:30:00Z" },
      "valetStatus": "requested"
    }
  ]
}
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-0000000000ee -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-0000000000ee.",
  "instance": "/v1/valet/queue"
}
```

---

## VLT-09 — "Actually, another twenty minutes": cancel-retrieval, twice, then once too many

<!-- apx:scenario VLT-09 kind=lifecycle ics=APX-VLT-01,APX-VLT-06 -->

**Given** the guest of V-20423 texts `WAIT` while the request is queued.
**When** the gateway cancels the retrieval. **Then** the ticket returns to
`parked` with the reason recorded. The runner had already picked it up
the second time the guest asked; cancelling from `retrieving` is also
legal and the car goes back. Cancelling when nothing is requested is 409
`valet-transition-illegal`.

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel-retrieval
Authorization: Bearer <apx.valet:request, bound to d8…0423>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel-retrieval -->
```json
{ "reason": "customerDelayed", "note": "reply: WAIT" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000423",
  "version": 4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20423",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KLM-2210", "make": "Toyota", "colour": "white" },
  "dropOff": { "time": "2026-09-24T18:31:40Z" },
  "retrieval": { "requestedTime": "2026-09-24T21:40:10Z", "channel": "sms", "etaMinutes": 9, "promisedTime": "2026-09-24T21:49:10Z", "cancelledTime": "2026-09-24T21:42:55Z" },
  "valetStatus": "parked"
}
```

Twenty minutes later the guest asks again, the runner picks it up, and
the guest cancels again — from `retrieving` this time (the operator's
view):

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel-retrieval -->
```json
{ "reason": "customerDelayed", "note": "guest called the stand; dinner running late" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000423",
  "version": 7,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20423",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "KLM-2210", "make": "Toyota", "colour": "white" },
  "dropOff": { "time": "2026-09-24T18:31:40Z", "attendant": "attendant-0031", "keyTag": "K-119" },
  "storage": { "zone": "P3 row D", "keyLocation": "board-2 hook 18", "parkedTime": "2026-09-24T22:14:30Z", "parkedBy": "runner-0112" },
  "retrieval": { "requestedTime": "2026-09-24T22:08:02Z", "channel": "sms", "requestedBy": "customer", "etaMinutes": 7, "promisedTime": "2026-09-24T22:16:02Z", "retrievingBy": "runner-0112", "cancelledTime": "2026-09-24T22:12:48Z", "cancelReason": "customerDelayed" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:31:40Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:40:12Z", "actor": "runner-0107" },
    { "state": "requested", "time": "2026-09-24T21:40:10Z", "actor": "customer", "detail": "channel sms; eta 9 min" },
    { "state": "parked", "time": "2026-09-24T21:42:55Z", "actor": "customer", "detail": "retrieval cancelled: customerDelayed" },
    { "state": "requested", "time": "2026-09-24T22:08:02Z", "actor": "customer", "detail": "channel sms; eta 7 min" },
    { "state": "retrieving", "time": "2026-09-24T22:10:30Z", "actor": "runner-0112" },
    { "state": "parked", "time": "2026-09-24T22:14:30Z", "actor": "runner-0112", "detail": "retrieval cancelled: customerDelayed; returned to P3 row D" }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel-retrieval -->
```json
{ "reason": "customerDelayed" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "cancel-retrieval requires requested or retrieving; ticket V-20423 is parked.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel-retrieval"
}
```

---

## VLT-10 — The runner picks it up, stages it at the front entrance

<!-- apx:scenario VLT-10 kind=lifecycle ics=APX-VLT-01,APX-VLT-04,APX-VLT-08 -->

**Given** V-20419 is `requested`. **When** the runner's app records the
pickup with `POST …/pickup` (F-VLT-05, fixed: §22.1 rule 2) and then
stages the car at lane `b2…0051`. **Then** `pickup` answers 200 in
`retrieving` with `retrievingBy`, the status event shows the same,
`stage` answers 200 with `stagingLane` and `stagedTime` set and
`etaMinutes` at 0, and the guest's contact channel is notified. A
pickup on a car nobody asked for is 409; on an id nobody has, 404. A
staged car the guest no longer wants is re-parked with `park` (F-VLT-06,
fixed: §22.1 rule 1); `cancel-retrieval` on it is still 409.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/pickup -->
```json
{ "retrievingBy": "runner-0107" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 5,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-24T18:56:10Z", "parkedBy": "runner-0112" },
  "retrieval": { "requestedTime": "2026-09-24T20:41:03Z", "channel": "sms", "requestedBy": "customer", "etaMinutes": 6, "promisedTime": "2026-09-24T20:49:03Z", "retrievingBy": "runner-0107" },
  "valetStatus": "retrieving",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107" },
    { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
    { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" },
    { "state": "retrieving", "time": "2026-09-24T20:42:10Z", "actor": "runner-0107" }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/pickup -->
```json
{ "retrievingBy": "runner-0112" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "pickup requires requested; ticket V-20423 is parked.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/pickup"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/pickup -->
```json
{}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/pickup"
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d04",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000419", "className": "ValetTicket" },
  "time": "2026-09-24T20:42:10Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000419",
    "version": 5,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "ticketNumber": "V-20419",
    "dropOff": { "time": "2026-09-24T18:30:14Z", "keyTag": "K-118" },
    "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "keyLocation": "board-2 hook 17" },
    "retrieval": { "requestedTime": "2026-09-24T20:41:03Z", "channel": "sms", "etaMinutes": 6, "promisedTime": "2026-09-24T20:49:03Z", "retrievingBy": "runner-0107" },
    "valetStatus": "retrieving",
    "statusHistory": [
      { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
      { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107" },
      { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
      { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" },
      { "state": "retrieving", "time": "2026-09-24T20:42:10Z", "actor": "runner-0107" }
    ]
  }
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" }, "note": "front entrance, bay 2" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 6,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": { "time": "2026-09-24T18:30:14Z", "attendant": "attendant-0031", "mileage": 41208, "keyTag": "K-118" },
  "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-24T18:56:10Z", "parkedBy": "runner-0112" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "requestedBy": "customer",
    "etaMinutes": 0,
    "promisedTime": "2026-09-24T20:49:03Z",
    "retrievingBy": "runner-0107",
    "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" },
    "stagedTime": "2026-09-24T20:48:12Z"
  },
  "valetStatus": "staged",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107" },
    { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
    { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" },
    { "state": "retrieving", "time": "2026-09-24T20:42:10Z", "actor": "runner-0107" },
    { "state": "staged", "time": "2026-09-24T20:48:12Z", "actor": "runner-0107", "detail": "front entrance, bay 2; customer notified via sms" }
  ]
}
```

The guest of V-20429 walks out, sees the car, and says they will be
another half hour. The stand tries to send it back down:

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000429/cancel-retrieval -->
```json
{ "reason": "customerDelayed", "note": "guest will be 30 more minutes; re-park" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "cancel-retrieval requires requested or retrieving; ticket V-20429 is staged. A staged vehicle is re-parked with park.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000429/cancel-retrieval"
}
```

So the runner re-parks it, freeing the staging lane:

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000429/park -->
```json
{ "zone": "P3 row E", "keyLocation": "board-2 hook 24", "note": "guest 30 more minutes; re-parked from the staging lane" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000429",
  "version": 4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20429",
  "vehicle": { "make": "Volvo", "model": "XC60", "colour": "green" },
  "dropOff": { "time": "2026-09-24T19:31:02Z", "attendant": "attendant-0031", "keyTag": "K-126" },
  "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 24", "parkedTime": "2026-09-24T21:33:40Z", "parkedBy": "runner-0112" },
  "retrieval": { "requestedTime": "2026-09-24T20:58:40Z", "requestedFor": "2026-09-24T21:30:00Z", "channel": "callCenter", "etaMinutes": 0, "promisedTime": "2026-09-24T21:30:00Z", "cancelledTime": "2026-09-24T21:33:40Z", "cancelReason": "re-parked" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T19:31:02Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T19:38:15Z", "actor": "runner-0107" },
    { "state": "requested", "time": "2026-09-24T20:58:40Z", "actor": "agent-4412", "detail": "channel callCenter; scheduled 21:30" },
    { "state": "staged", "time": "2026-09-24T21:26:15Z", "actor": "runner-0107" },
    { "state": "parked", "time": "2026-09-24T21:33:40Z", "actor": "runner-0112", "detail": "re-parked from staging: guest 30 more minutes; re-parked from the staging lane" }
  ]
}
```

---

## VLT-11 — Verified by code, handed back, one mile on the clock; closed when the stay settles

<!-- apx:scenario VLT-11 kind=happy ics=APX-VLT-02,APX-VLT-05,APX-VLT-08 -->

**Given** V-20419 is staged and the guest shows the claim code at the
stand. **When** the attendant's app verifies the code and records the
handback condition and mileage. **Then** 200 with the ticket in
`handedBack`, `verificationValue` absent from the record, the handback
report alongside the drop-off one, and `handback.mileage` one mile over
`dropOff.mileage`. The Session is paid at the stand through the ordinary
payment surface; `closed` follows server-side, announced by the status
event.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback -->
```json
{
  "verificationMethod": "code",
  "verificationValue": "7Q2M",
  "handedTo": "claimant presenting code 7Q2M",
  "mileage": 41209,
  "conditionReport": {
    "notes": "As received. Rear bumper scuff unchanged.",
    "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20419/out-rear.jpg" ],
    "recordedTime": "2026-09-24T20:50:30Z",
    "recordedBy": "scanner-0031",
    "customerAcknowledged": true
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 7,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
  "customer": { "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-24T18:30:14Z",
    "attendant": "attendant-0031",
    "mileage": 41208,
    "keyTag": "K-118",
    "conditionReport": {
      "notes": "Scuff on rear bumper, driver side, approx 6 cm. Interior clean.",
      "damage": [
        { "area": "rearBumper", "description": "6 cm scuff, driver side", "severity": "minor", "imageLink": "https://api.lakeside-garage.example/valet/v-20419/in-rear-bumper.jpg" }
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-24T18:56:10Z" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "etaMinutes": 0,
    "promisedTime": "2026-09-24T20:49:03Z",
    "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" },
    "stagedTime": "2026-09-24T20:48:12Z"
  },
  "handback": {
    "time": "2026-09-24T20:50:41Z",
    "handedTo": "claimant presenting code 7Q2M",
    "verificationMethod": "code",
    "attendant": "attendant-0031",
    "mileage": 41209,
    "conditionReport": {
      "notes": "As received. Rear bumper scuff unchanged.",
      "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20419/out-rear.jpg" ],
      "recordedTime": "2026-09-24T20:50:30Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "valetStatus": "handedBack",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107" },
    { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
    { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" },
    { "state": "retrieving", "time": "2026-09-24T20:42:10Z", "actor": "runner-0107" },
    { "state": "staged", "time": "2026-09-24T20:48:12Z", "actor": "runner-0107", "detail": "front entrance, bay 2" },
    { "state": "handedBack", "time": "2026-09-24T20:50:41Z", "actor": "attendant-0031", "detail": "verified by code" }
  ]
}
```

Nine minutes later the Session settles at the pay station and the
server closes the ticket:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d05",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000419", "className": "ValetTicket" },
  "time": "2026-09-24T20:59:58Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000419",
    "version": 8,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
    "ticketNumber": "V-20419",
    "dropOff": { "time": "2026-09-24T18:30:14Z" },
    "handback": { "time": "2026-09-24T20:50:41Z", "verificationMethod": "code" },
    "valetStatus": "closed",
    "statusHistory": [
      { "state": "handedBack", "time": "2026-09-24T20:50:41Z", "actor": "attendant-0031", "detail": "verified by code" },
      { "state": "closed", "time": "2026-09-24T20:59:58Z", "actor": "lakeside-parcs", "detail": "Session f1000000-0000-4000-8000-000000000419 settled (paid at pay station 3)" }
    ]
  }
}
```

---

## VLT-12 — The wrong claimant: verification fails, and the audit keeps it

<!-- apx:scenario VLT-12 kind=refusal ics=APX-VLT-05 -->

**Given** V-20429 is staged and someone presents a code that does not
match. **When** the attendant's app submits the handback. **Then** 403
`valet-verification-failed`, the car stays `staged`, and the attempt —
method, actor, time — is appended to `statusHistory[]` without the value
presented. The guest then produces ID, and the second handback succeeds.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000429/handback -->
```json
{ "verificationMethod": "code", "verificationValue": "7Q2N", "handedTo": "claimant presenting code 7Q2N" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-verification-failed",
  "title": "Claimant verification failed",
  "status": 403,
  "detail": "The code presented does not match ticket V-20429. The attempt has been recorded.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000429/handback"
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000429 -->
<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000429",
  "version": 5,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20429",
  "vehicle": { "make": "Volvo", "model": "XC60", "colour": "green" },
  "dropOff": { "time": "2026-09-24T19:31:02Z", "attendant": "attendant-0031", "keyTag": "K-126" },
  "storage": { "zone": "P3 row E", "keyLocation": "board-2 hook 24" },
  "retrieval": { "requestedTime": "2026-09-24T20:58:40Z", "requestedFor": "2026-09-24T21:30:00Z", "channel": "callCenter", "etaMinutes": 0, "promisedTime": "2026-09-24T21:30:00Z", "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" }, "stagedTime": "2026-09-24T21:26:15Z" },
  "valetStatus": "staged",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T19:31:02Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T19:38:50Z", "actor": "runner-0107" },
    { "state": "requested", "time": "2026-09-24T20:58:40Z", "actor": "agent-4412", "detail": "channel callCenter; scheduled 21:30" },
    { "state": "retrieving", "time": "2026-09-24T21:20:02Z", "actor": "runner-0112" },
    { "state": "staged", "time": "2026-09-24T21:26:15Z", "actor": "runner-0112" },
    { "state": "staged", "time": "2026-09-24T21:33:07Z", "actor": "attendant-0031", "detail": "handback attempted; verification by code FAILED; vehicle retained" }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000429/handback -->
```json
{ "verificationMethod": "id", "handedTo": "driver's licence matched customer.displayName", "mileage": 30412 }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000429",
  "version": 6,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20429",
  "vehicle": { "make": "Volvo", "model": "XC60", "colour": "green" },
  "dropOff": { "time": "2026-09-24T19:31:02Z", "attendant": "attendant-0031", "mileage": 30411, "keyTag": "K-126" },
  "handback": { "time": "2026-09-24T21:35:20Z", "handedTo": "driver's licence matched customer.displayName", "verificationMethod": "id", "attendant": "attendant-0031", "mileage": 30412 },
  "valetStatus": "handedBack",
  "statusHistory": [
    { "state": "staged", "time": "2026-09-24T21:26:15Z", "actor": "runner-0112" },
    { "state": "staged", "time": "2026-09-24T21:33:07Z", "actor": "attendant-0031", "detail": "handback attempted; verification by code FAILED; vehicle retained" },
    { "state": "handedBack", "time": "2026-09-24T21:35:20Z", "actor": "attendant-0031", "detail": "verified by id" }
  ]
}
```

---

## VLT-13 — Changed their mind at the stand: handback before the car moved

<!-- apx:scenario VLT-13 kind=lifecycle ics=APX-VLT-01,APX-VLT-05 -->

**Given** a walk-in drops V-20421, then remembers the parking ticket for
the self-park deck in their pocket. **When** the attendant hands the car
straight back while it is still `dropped`. **Then** 200 with
`dropped → handedBack`, verified by attendant recognition, the drop-off
condition report intact. The Session closes at zero through the
operator's flow.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000421/handback -->
```json
{ "verificationMethod": "attendant", "handedTo": "same driver, never left the stand", "notes": "customer chose self-park" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000421",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000421", "className": "Session" },
  "ticketNumber": "V-20421",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "PLM-3391", "make": "Kia", "colour": "orange" },
  "dropOff": {
    "time": "2026-09-24T19:44:05Z",
    "attendant": "attendant-0031",
    "keyTag": "K-127",
    "conditionReport": { "notes": "No damage noted.", "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20421/in-front.jpg" ], "recordedTime": "2026-09-24T19:43:50Z", "recordedBy": "scanner-0031", "customerAcknowledged": true }
  },
  "handback": { "time": "2026-09-24T19:46:30Z", "handedTo": "same driver, never left the stand", "verificationMethod": "attendant", "attendant": "attendant-0031", "notes": "customer chose self-park" },
  "valetStatus": "handedBack",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T19:44:05Z", "actor": "attendant-0031" },
    { "state": "handedBack", "time": "2026-09-24T19:46:30Z", "actor": "attendant-0031", "detail": "handed back before the vehicle moved; verified by attendant" }
  ]
}
```

---

## VLT-14 — Everything the state machine refuses, and two ids nobody has

<!-- apx:scenario VLT-14 kind=refusal ics=APX-VLT-01,APX-CORE-05 -->

**Given** apps with stale screens. **When** a runner parks a car that is
already requested, a guest asks for a car that is already at the kerb, a
runner stages a car nobody asked for, the stand hands back a car still
in P3, a handheld hands back V-20419 again after it was handed back, and
a runner parks a closed ticket. **Then** every one is 409
`valet-transition-illegal` and nothing changes. (Parking a *staged* car
and texting `CAR` twice are no longer refusals: see VLT-10 and VLT-06.)
A stale QR that decodes to an id the server has never seen is 404 on
`stage` and `handback` alike.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000424/park -->
```json
{ "zone": "P3 row E" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "park requires dropped, parked, or staged; ticket V-20424 is requested.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000424/park"
}
```

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0427>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/retrieve -->
```json
{ "channel": "app" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "retrieve requires parked (or is a no-op while requested or retrieving); ticket V-20427 is staged at the front entrance.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000427/retrieve"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "stage requires requested or retrieving; ticket V-20423 is parked.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/stage"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/handback -->
```json
{ "verificationMethod": "ticket", "verificationValue": "V-20423" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "handback requires staged or dropped; ticket V-20423 is parked.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/handback"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback -->
```json
{ "verificationMethod": "code", "verificationValue": "7Q2M" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "handback requires staged or dropped; ticket V-20419 is closed.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park -->
```json
{ "zone": "P3 row D" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "park requires dropped, parked, or staged; ticket V-20419 is closed.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/stage"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/handback -->
```json
{ "verificationMethod": "ticket", "verificationValue": "V-99999" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/handback"
}
```

---

## VLT-15 — The claim link is not a master key: what the customer scope cannot do

<!-- apx:scenario VLT-15 kind=security ics=APX-VLT-06,APX-CORE-07 -->

**Given** the guest's `apx.valet:request` token, bound to V-20419.
**When** a tampered PWA build tries to list every ticket at the stand,
park, pick up, stage, cancel, amend, and hand back its own car, and then
read and retrieve somebody else's. **Then** the seven operator
operations are 403 `insufficient-scope`, and the other guest's ticket is
404 — the token cannot even learn that it exists (F-VLT-08, fixed: §22.5
and Part 9 §9.3a make it 404 for a `:request` token, while an operator
token outside its grant gets 403 `insufficient-grant`, VLT-16).

```http
GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005
Authorization: Bearer <apx.valet:request, bound to d8…0419>
```

<!-- apx:request GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/valet/tickets requires scope apx.valet:read; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park -->
```json
{ "zone": "P1 row A" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/park requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/park"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/stage requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/stage"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback -->
```json
{ "verificationMethod": "code", "verificationValue": "7Q2M" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/handback requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/handback"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/pickup -->
```json
{}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/pickup requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/pickup"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/cancel -->
```json
{ "reason": "customerLeft" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/cancel requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/cancel"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/condition -->
```json
{ "damage": [ { "area": "hood", "description": "claimed new scratch", "severity": "minor" } ] }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/valet/tickets/{id}/condition requires scope apx.valet:manage; token carries apx.valet:request.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/condition"
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000420 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-000000000420 for this token.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve -->
```json
{ "channel": "app" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-000000000420 for this token.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/cancel-retrieval -->
```json
{ "reason": "customerDelayed" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-000000000420 for this token.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/cancel-retrieval"
}
```

---

## VLT-16 — Harbor Deck's valet is not ours: out of grant everywhere

<!-- apx:scenario VLT-16 kind=security ics=APX-CORE-07,APX-CORE-08 -->

**Given** the Lakeside operator token (`apx_places` = Lakeside Garage).
**When** a misrouted integration drops a car at Harbor Deck's stand, reads
Harbor Deck's queue and one of its tickets, and tries to retrieve and
cancel on it. **Then** 403 `insufficient-grant` each time. A token with no
`apx_places` claim at all fails closed the same way.

```http
POST /v1/valet/tickets
Idempotency-Key: harbor-0001
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000006", "className": "Place" },
  "ticketNumber": "H-0001",
  "dropOff": { "time": "2026-09-24T21:00:00Z" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000006 belongs to b1000000-0000-4000-8000-000000000002 (Harbor Deck), which is not in the token's apx_places grant.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000006 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000006 is not in the token's apx_places grant.",
  "instance": "/v1/valet/queue"
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000902 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Valet ticket d8000000-0000-4000-8000-000000000902 belongs to place b1000000-0000-4000-8000-000000000006, which is not in the token's apx_places grant.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000902"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000902/retrieve -->
```json
{ "channel": "callCenter", "interaction": "cc-2026-09-24-118377" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Valet ticket d8000000-0000-4000-8000-000000000902 belongs to place b1000000-0000-4000-8000-000000000006, which is not in the token's apx_places grant.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000902/retrieve"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000902/cancel-retrieval -->
```json
{ "reason": "misrouted" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Valet ticket d8000000-0000-4000-8000-000000000902 belongs to place b1000000-0000-4000-8000-000000000006, which is not in the token's apx_places grant.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000902/cancel-retrieval"
}
```

```http
GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005
Authorization: Bearer <apx.valet:read, no apx_places claim at all>
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/valet/queue"
}
```

---

## VLT-17 — 2 am: the stand's token expired mid-shift

<!-- apx:scenario VLT-17 kind=security ics=APX-CORE-06 -->

**Given** the overnight attendant's handheld, the runner board, and the
SMS gateway all share a client credential whose token expired at 02:00
and whose refresh silently failed. **When** each next call goes out.
**Then** every Valet operation answers 401 `unauthenticated`, whatever
it was asked (F-VLT-03, fixed: the type is registered in Part 12). The
new routes (`pickup`, `cancel`, `condition`) are exercised in VLT-24.

```http
POST /v1/valet/tickets
Authorization: Bearer <expired>
Idempotency-Key: scan-0044-20260925-020310
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20431",
  "dropOff": { "time": "2026-09-25T02:03:10Z", "attendant": "attendant-0044" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005&status=parked -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/queue"
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000420 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/park -->
```json
{ "zone": "P2 row A", "keyLocation": "board-1 hook 03" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/park"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve -->
```json
{ "channel": "sms" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/retrieve"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/cancel-retrieval -->
```json
{ "reason": "customerDelayed" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/cancel-retrieval"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/stage"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000420/handback -->
```json
{ "verificationMethod": "ticket", "verificationValue": "V-20420" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000420/handback"
}
```

---

## VLT-18 — Throttled: a board polling every 200 ms, a bot in a loop, a handheld in a retry storm

<!-- apx:scenario VLT-18 kind=edge ics=APX-CORE-05 -->

**Given** a lobby display polling the queue five times a second, a voice
bot that retries every call on any non-200, and a handheld with a stuck
button. **When** the per-credential limit is exceeded. **Then** every
Valet operation answers 429 `rate-limited` with `Retry-After`; nothing is
executed; the responses carry no ticket.

```http
GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005
→ 429, Retry-After: 2
```

<!-- apx:request GET /v1/valet/queue?place=b1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 120/min; retry after 2 seconds.",
  "instance": "/v1/valet/queue"
}
```

<!-- apx:request GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005&status=requested -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 120/min; retry after 2 seconds.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000426 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 120/min; retry after 2 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000426"
}
```

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000426/retrieve
Authorization: Bearer <apx.valet:request, bound to d8…0426>
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000426/retrieve -->
```json
{ "channel": "voiceBot", "interaction": "ivr-2026-09-24-7f3a91" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this token exceeded 10/min; retry after 5 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000426/retrieve"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000426/cancel-retrieval -->
```json
{ "reason": "botRetry" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this token exceeded 10/min; retry after 5 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000426/cancel-retrieval"
}
```

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-213900
→ 429, Retry-After: 3
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20432",
  "dropOff": { "time": "2026-09-24T21:39:00Z", "attendant": "attendant-0031" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/valet/tickets"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/park -->
```json
{ "zone": "P3 row E", "keyLocation": "board-2 hook 22" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000427/park"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/stage -->
```json
{ "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" } }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000427/stage"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000427/handback -->
```json
{ "verificationMethod": "ticket", "verificationValue": "V-20427" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 3 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000427/handback"
}
```

---

## VLT-19 — The scanner vendor's extension survives park and read

<!-- apx:scenario VLT-19 kind=edge ics=APX-CORE-04,APX-VLT-01 -->

**Given** the scanning vendor stores its scan-session id and model
version under `apds-ext:lakeside:valet-scan@1.0`. **When** the ticket is
created with it, parked by a runner app that has never heard of it, and
read back. **Then** the extension is on the 201, still on the 200 after
`park`, byte-for-byte, and on the read.

```http
POST /v1/valet/tickets
Idempotency-Key: scan-0031-20260924-214420
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20430",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "WXY-5508", "make": "Subaru", "colour": "blue" },
  "dropOff": { "time": "2026-09-24T21:44:20Z", "attendant": "attendant-0031", "keyTag": "K-128" },
  "extensions": {
    "apds-ext:lakeside:valet-scan@1.0": { "scanSession": "ss-20260924-000731", "modelVersion": "damage-net 4.2", "confidence": 0.93 }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000430",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000430", "className": "Session" },
  "ticketNumber": "V-20430",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "WXY-5508", "make": "Subaru", "colour": "blue" },
  "dropOff": { "time": "2026-09-24T21:44:20Z", "attendant": "attendant-0031", "keyTag": "K-128" },
  "valetStatus": "dropped",
  "statusHistory": [ { "state": "dropped", "time": "2026-09-24T21:44:20Z", "actor": "attendant-0031" } ],
  "extensions": {
    "apds-ext:lakeside:valet-scan@1.0": { "scanSession": "ss-20260924-000731", "modelVersion": "damage-net 4.2", "confidence": 0.93 }
  }
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000430/park -->
```json
{ "zone": "P3 row F", "keyLocation": "board-2 hook 29" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000430",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000430", "className": "Session" },
  "ticketNumber": "V-20430",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "WXY-5508", "make": "Subaru", "colour": "blue" },
  "dropOff": { "time": "2026-09-24T21:44:20Z", "attendant": "attendant-0031", "keyTag": "K-128" },
  "storage": { "zone": "P3 row F", "keyLocation": "board-2 hook 29", "parkedTime": "2026-09-24T21:50:03Z", "parkedBy": "runner-0107" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T21:44:20Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T21:50:03Z", "actor": "runner-0107" }
  ],
  "extensions": {
    "apds-ext:lakeside:valet-scan@1.0": { "scanSession": "ss-20260924-000731", "modelVersion": "damage-net 4.2", "confidence": 0.93 }
  }
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000430 -->
<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000430",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000430", "className": "Session" },
  "ticketNumber": "V-20430",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "WXY-5508", "make": "Subaru", "colour": "blue" },
  "dropOff": { "time": "2026-09-24T21:44:20Z", "attendant": "attendant-0031", "keyTag": "K-128" },
  "storage": { "zone": "P3 row F", "keyLocation": "board-2 hook 29", "parkedTime": "2026-09-24T21:50:03Z", "parkedBy": "runner-0107" },
  "valetStatus": "parked",
  "extensions": {
    "apds-ext:lakeside:valet-scan@1.0": { "scanSession": "ss-20260924-000731", "modelVersion": "damage-net 4.2", "confidence": 0.93 }
  }
}
```

---

## VLT-20 — A week later: "there's a scratch on my bumper"

<!-- apx:scenario VLT-20 kind=happy ics=APX-VLT-02,APX-VLT-03,APX-VLT-07 -->

**Given** the guest of V-20419 calls on 1 October about a scratch on the
rear bumper. **When** the agent lists the plate's tickets since the 17th
and reads the closed one. **Then** the drop-off report shows the 6 cm
scuff photographed at 18:30:02 and acknowledged by the customer, the
handback report at 20:50 says unchanged with a photo, and the claim is
answered from the record. The ticket still carries no money and no raw
phone number; the Session does the first, the contact system the second.

<!-- apx:request GET /v1/valet/tickets?plate=SYN-7734&since=2026-09-17T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790872500, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000419",
      "version": 8,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
      "ticketNumber": "V-20419",
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "make": "Audi", "colour": "grey" },
      "dropOff": { "time": "2026-09-24T18:30:14Z" },
      "handback": { "time": "2026-09-24T20:50:41Z", "verificationMethod": "code" },
      "valetStatus": "closed"
    }
  ]
}
```

<!-- apx:request GET /v1/valet/tickets/d8000000-0000-4000-8000-000000000419 -->
<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000419",
  "version": 8,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "session": { "id": "f1000000-0000-4000-8000-000000000419", "className": "Session" },
  "ticketNumber": "V-20419",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-7734", "jurisdiction": "US-IL", "make": "Audi", "model": "Q5", "colour": "grey" },
  "customer": { "contact": { "id": "e6000000-0000-4000-8000-000000000419", "className": "Contact" }, "displayName": "R. Ortega", "contactChannel": { "type": "sms", "handle": "***-***-4471" } },
  "dropOff": {
    "time": "2026-09-24T18:30:14Z",
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
        "https://api.lakeside-garage.example/valet/v-20419/in-rear.jpg"
      ],
      "recordedTime": "2026-09-24T18:30:02Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "storage": { "space": { "id": "c3000000-0000-4000-8000-000000000117", "className": "Space" }, "zone": "P3 row D", "keyLocation": "board-2 hook 17", "parkedTime": "2026-09-24T18:56:10Z", "parkedBy": "runner-0112" },
  "retrieval": {
    "requestedTime": "2026-09-24T20:41:03Z",
    "channel": "sms",
    "requestedBy": "customer",
    "etaMinutes": 0,
    "promisedTime": "2026-09-24T20:49:03Z",
    "retrievingBy": "runner-0107",
    "stagingLane": { "id": "b2000000-0000-4000-8000-000000000051", "className": "VehicularAccess" },
    "stagedTime": "2026-09-24T20:48:12Z"
  },
  "handback": {
    "time": "2026-09-24T20:50:41Z",
    "handedTo": "claimant presenting code 7Q2M",
    "verificationMethod": "code",
    "attendant": "attendant-0031",
    "mileage": 41209,
    "conditionReport": {
      "notes": "As received. Rear bumper scuff unchanged.",
      "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20419/out-rear.jpg" ],
      "recordedTime": "2026-09-24T20:50:30Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "valetStatus": "closed",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T18:30:14Z", "actor": "attendant-0031", "detail": "condition report acknowledged by customer" },
    { "state": "parked", "time": "2026-09-24T18:36:40Z", "actor": "runner-0107", "detail": "P3 row D; keys board-2 hook 17" },
    { "state": "parked", "time": "2026-09-24T18:56:10Z", "actor": "runner-0112", "detail": "storage updated: Space P3-D-17" },
    { "state": "requested", "time": "2026-09-24T20:41:03Z", "actor": "customer", "detail": "channel sms; eta 8 min" },
    { "state": "retrieving", "time": "2026-09-24T20:42:10Z", "actor": "runner-0107" },
    { "state": "staged", "time": "2026-09-24T20:48:12Z", "actor": "runner-0107", "detail": "front entrance, bay 2" },
    { "state": "handedBack", "time": "2026-09-24T20:50:41Z", "actor": "attendant-0031", "detail": "verified by code" },
    { "state": "closed", "time": "2026-09-24T20:59:58Z", "actor": "lakeside-parcs", "detail": "Session f1000000-0000-4000-8000-000000000419 settled (paid at pay station 3)" }
  ],
  "recordInfo": { "creationTime": "2026-09-24T18:30:14Z", "creationUser": "scanner-0031", "lastUpdate": "2026-09-24T20:59:58Z", "lastUpdateUser": "lakeside-parcs" }
}
```

The same list by ticket number, by account, and page two of the stand's
parked cars — every filter the operation declares:

<!-- apx:request GET /v1/valet/tickets?ticketNumber=V-20420&account=e7000000-0000-4000-8000-000000000042 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790872500, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000420",
      "version": 6,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "session": { "id": "f1000000-0000-4000-8000-000000000420", "className": "Session" },
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000420", "className": "AssignedRight" },
      "ticketNumber": "V-20420",
      "customer": { "account": { "id": "e7000000-0000-4000-8000-000000000042", "className": "Account" }, "displayName": "M. Adeyemi" },
      "dropOff": { "time": "2026-09-24T17:05:20Z" },
      "valetStatus": "closed"
    }
  ]
}
```

<!-- apx:request GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005&status=parked&page=2 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790872500, "offset": 100, "pageSize": 100, "total": 103 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000430",
      "version": 2,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20430",
      "dropOff": { "time": "2026-09-24T21:44:20Z", "keyTag": "K-128" },
      "storage": { "zone": "P3 row F", "keyLocation": "board-2 hook 29" },
      "valetStatus": "parked"
    }
  ]
}
```

---

## VLT-21 — The second scuff found at P3: a dated correction, never an edit

<!-- apx:scenario VLT-21 kind=edge ics=APX-VLT-03 -->

**Given** the runner parking V-20430 notices a door ding the scanner
missed. **When** they add it with `POST …/condition` (F-VLT-07, fixed:
§22.2 rule 3). **Then** the ding is appended to
`dropOff.conditionReport.damage[]` with a server-set `recordedTime` and
`recordedBy`, the photo joins `imageLinks[]`, the original "No damage
noted." and the customer's acknowledgement are untouched, and a
`statusHistory[]` entry records the amendment without changing
`valetStatus`. A correction on a closed ticket is 409; on an id nobody
has, 404. A retry with the same `Idempotency-Key` returns the ticket and
does not append twice.

```http
POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000430/condition
Idempotency-Key: runner-0107-20260924-2152-v20430
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000430/condition -->
```json
{
  "notes": "Driver door ding ~2 cm found at P3; not on the drop-off report.",
  "damage": [ { "area": "driverDoor", "description": "ding ~2 cm, lower edge", "severity": "minor", "imageLink": "https://api.lakeside-garage.example/valet/v-20430/p3-driver-door.jpg" } ],
  "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20430/p3-driver-door-wide.jpg" ],
  "recordedBy": "runner-0107"
}
```

<!-- apx:response 200 -->
<!-- apx:validate ConditionReport at /dropOff/conditionReport -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000430",
  "version":4,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20430",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "WXY-5508", "make": "Subaru", "colour": "blue" },
  "dropOff": {
    "time": "2026-09-24T21:44:20Z",
    "attendant": "attendant-0031",
    "keyTag": "K-128",
    "conditionReport": {
      "notes": "No damage noted.",
      "damage": [ { "area": "driverDoor", "description": "ding ~2 cm, lower edge", "severity": "minor", "imageLink": "https://api.lakeside-garage.example/valet/v-20430/p3-driver-door.jpg", "recordedTime": "2026-09-24T21:52:41Z", "recordedBy": "runner-0107" } ],
      "imageLinks": [ "https://api.lakeside-garage.example/valet/v-20430/p3-driver-door-wide.jpg" ],
      "recordedTime": "2026-09-24T21:44:05Z",
      "recordedBy": "scanner-0031",
      "customerAcknowledged": true
    }
  },
  "storage": { "zone": "P3 row F", "keyLocation": "board-2 hook 29", "parkedTime": "2026-09-24T21:50:03Z", "parkedBy": "runner-0107" },
  "valetStatus": "parked",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T21:44:20Z", "actor": "attendant-0031" },
    { "state": "parked", "time": "2026-09-24T21:50:03Z", "actor": "runner-0107" },
    { "state": "parked", "time": "2026-09-24T21:52:41Z", "actor": "runner-0107", "detail": "condition amended: Driver door ding ~2 cm found at P3; not on the drop-off report." }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000419/condition -->
```json
{ "damage": [ { "area": "rearBumper", "description": "second scratch", "severity": "minor" } ] }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "condition requires a ticket that is not closed or cancelled; ticket V-20419 is closed. Post-closure damage claims are handled outside the custody record.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000419/condition"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/condition -->
```json
{ "notes": "stale QR" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/condition"
}
```

---

## VLT-22 — The car that never came in: cancel the drop-off

<!-- apx:scenario VLT-22 kind=lifecycle ics=APX-VLT-01,APX-VLT-08 -->

**Given** a driver whose ticket V-20422 was created as the attendant
started the walk-around, then drove off to the self-park deck before
handing over the keys. **When** the attendant cancels the drop-off with
`POST …/cancel` (F-VLT-04, fixed: §22.1 rule 3). **Then** 200 in
`cancelled`, the status event is published, and the list read is
consistent. Cancelling a car that is already parked is 409; cancelling
an id nobody has is 404.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000422/cancel -->
```json
{ "reason": "customerLeft", "note": "driver left for self-park before keys were handed over" }
```

<!-- apx:response 200 -->
```json
{
  "id": "d8000000-0000-4000-8000-000000000422",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20422",
  "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "GHT-1180" },
  "dropOff": { "time": "2026-09-24T19:50:12Z", "attendant": "attendant-0031" },
  "valetStatus": "cancelled",
  "statusHistory": [
    { "state": "dropped", "time": "2026-09-24T19:50:12Z", "actor": "attendant-0031" },
    { "state": "cancelled", "time": "2026-09-24T19:52:30Z", "actor": "attendant-0031", "detail": "customerLeft: driver left for self-park before keys were handed over; custody never taken" }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel -->
```json
{ "reason": "duplicateTicket" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/valet-transition-illegal",
  "title": "Transition not allowed from this state",
  "status": 409,
  "detail": "cancel requires dropped; ticket V-20423 is parked — custody was taken.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000423/cancel"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/cancel -->
```json
{ "reason": "duplicateTicket" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No valet ticket d8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-0000000000ff/cancel"
}
```

The status event the cancel published:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValetTicket at /data -->
```json
{
  "id": "3b4c5d6e-7f8a-4b9c-8d0e-1f2a3b4c5d06",
  "type": "apx.valet.ticket.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d8000000-0000-4000-8000-000000000422", "className": "ValetTicket" },
  "time": "2026-09-24T19:52:30Z",
  "data": {
    "id": "d8000000-0000-4000-8000-000000000422",
    "version": 2,
    "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
    "ticketNumber": "V-20422",
    "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "GHT-1180" },
    "dropOff": { "time": "2026-09-24T19:50:12Z", "attendant": "attendant-0031" },
    "valetStatus": "cancelled",
    "statusHistory": [
      { "state": "dropped", "time": "2026-09-24T19:50:12Z", "actor": "attendant-0031" },
      { "state": "cancelled", "time": "2026-09-24T19:52:30Z", "actor": "attendant-0031", "detail": "driver left for self-park before keys were handed over; custody never taken" }
    ]
  }
}
```

<!-- apx:request GET /v1/valet/tickets?place=b1000000-0000-4000-8000-000000000005&status=cancelled&since=2026-09-24T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790287900, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "d8000000-0000-4000-8000-000000000422",
      "version": 2,
      "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
      "ticketNumber": "V-20422",
      "dropOff": { "time": "2026-09-24T19:50:12Z" },
      "valetStatus": "cancelled"
    }
  ]
}
```

---

## VLT-23 — A raw phone number on the ticket

<!-- apx:scenario VLT-23 kind=refusal ics=APX-VLT-07,APX-CORE-10 -->

**Given** a hotel PMS integration that puts the guest's mobile number
straight into `contactChannel.handle`. **When** it posts a drop-off.
**Then** §22.6 says the server MUST NOT carry it and SHOULD refuse: 422
`personal-data-not-permitted`, declared on the drop-off's 422 (F-VLT-10,
fixed). The body is schema-valid; only the policy is broken, which is
why the refusal is 422 rather than a 400.

```http
POST /v1/valet/tickets
Idempotency-Key: pms-20260924-0917
```

<!-- apx:request POST /v1/valet/tickets -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000005", "className": "Place" },
  "ticketNumber": "V-20433",
  "customer": { "displayName": "T. Nakamura", "contactChannel": { "type": "sms", "handle": "+1 312 555 0199" } },
  "dropOff": { "time": "2026-09-24T22:02:15Z", "attendant": "attendant-0031" }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/personal-data-not-permitted",
  "title": "Personal data not permitted on this resource",
  "status": 422,
  "detail": "customer.contactChannel.handle must be an opaque or masked handle (Part 22 §22.6); a telephone number was supplied. Reference the Contact instead.",
  "instance": "/v1/valet/tickets"
}
```


---

## VLT-24 — 2 am again, on the new routes: expired token, throttled runner app

<!-- apx:scenario VLT-24 kind=security ics=APX-CORE-06,APX-CORE-05 -->

**Given** the same expired overnight credential as VLT-17, and a runner
app whose stuck button hammers the new routes. **When** it calls
`pickup`, `cancel`, and `condition`. **Then** 401 `unauthenticated` on
each with the expired token, and 429 `rate-limited` with `Retry-After`
once the fresh token exceeds its write rate; nothing is written either
way.

```http
POST /v1/valet/tickets/d8…0431/pickup
Authorization: Bearer <expired>
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup -->
```json
{ "retrievingBy": "runner-0112" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel -->
```json
{ "reason": "customerLeft" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition -->
```json
{ "damage": [ { "area": "hood", "severity": "minor" } ] }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T02:00:00Z.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition"
}
```

```http
→ 429, Retry-After: 5
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup -->
```json
{ "retrievingBy": "runner-0112" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 30/min; retry after 5 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel -->
```json
{ "reason": "customerLeft" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 30/min; retry after 5 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel"
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition -->
```json
{ "damage": [ { "area": "hood", "severity": "minor" } ] }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 30/min; retry after 5 seconds.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition"
}
```

---

## VLT-25 — Malformed transition bodies: every action route says which field

<!-- apx:scenario VLT-25 kind=refusal ics=APX-VLT-01,APX-CORE-05 -->

**Given** a third-party runner app built against a draft of the API.
**When** it sends each action route a body that fails its schema — a
numeric zone, a channel nobody defined, a cancel with no reason, a stage
with no lane, a handback with no verification method, a numeric runner
id, a cancel with no reason, a damage entry with no area. **Then** 400
`invalid-request` on every one, with an `errors[]` pointer to the
offending member (Part 12 §12.4); nothing changes on V-20431.

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/park invalid -->
```json
{ "zone": 3, "keyLocation": "board-2 hook 30" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/zone must be a string.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/park",
  "errors": [
    {
      "pointer": "/zone",
      "detail": "must be a string"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/retrieve invalid -->
```json
{ "channel": "pigeon" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/channel must be one of sms, app, web, voiceBot, kiosk, attendant, callCenter.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/retrieve",
  "errors": [
    {
      "pointer": "/channel",
      "detail": "must be one of sms, app, web, voiceBot, kiosk, attendant, callCenter"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel-retrieval invalid -->
```json
{ "note": "guest delayed" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel-retrieval",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/stage invalid -->
```json
{ "note": "front entrance" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/stagingLane is required.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/stage",
  "errors": [
    {
      "pointer": "/stagingLane",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/handback invalid -->
```json
{ "verificationValue": "7Q2M" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/verificationMethod is required.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/handback",
  "errors": [
    {
      "pointer": "/verificationMethod",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup invalid -->
```json
{ "retrievingBy": 112 }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/retrievingBy must be a string.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/pickup",
  "errors": [
    {
      "pointer": "/retrievingBy",
      "detail": "must be a string"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel invalid -->
```json
{ "note": "left" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/reason is required.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/cancel",
  "errors": [
    {
      "pointer": "/reason",
      "detail": "is required"
    }
  ]
}
```

<!-- apx:request POST /v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition invalid -->
```json
{ "damage": [ { "description": "scratch", "severity": "minor" } ] }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "/damage/0/area is required.",
  "instance": "/v1/valet/tickets/d8000000-0000-4000-8000-000000000431/condition",
  "errors": [
    {
      "pointer": "/damage/0/area",
      "detail": "is required"
    }
  ]
}
```
