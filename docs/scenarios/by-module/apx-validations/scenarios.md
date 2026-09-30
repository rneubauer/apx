# apx-validations — vetting scenarios

<!-- apx:module apx-validations tag=Validations ics=VAL -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-validations`. Gaps the spec cannot express are
marked `gap=F-VAL-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`, exit lane 2 `b2…0002`, pay
station 3 `c1…0003`) is run by operator organisation `a1…0001`. Harbor
Deck (`b1…0002`) is another operator's garage the token has no grant
for. Merchants: Harbor Bistro `a2…0077` (program `e5…0001`, QR codes,
two hours comped, billed $4.00 per redemption monthly — the cast of
public scenario 18), Lakeside Cinema `a2…0011` (program `e5…0002`,
stamps and a POS integration, two hours comped, split 50/50, restricted
to the standard deck), Lakeside Fitness `a2…0014` (program `e5…0004`,
25 percent off, operator absorbs), and Harbor Deck's hotel `a2…0013`
(program `e5…0003` at Harbor Deck). Rate tables: standard deck
`d5…0001`, concert-night event rate `d5…0003`. Issuances are `e6…`,
redemptions `e7…`, statements `e8…`, sessions `f1…`, commands `d1…`.

Every request carries `Authorization: Bearer …` with scopes
`apx.validations:read apx.validations:manage` and an `apx_places` grant
of `["b1000000-0000-4000-8000-000000000001"]` unless the scenario says
otherwise. Requests that create resources send the create shape; `id`,
`version`, `programStatus` history, `issuanceStatus`, `codes`,
`validationId`, `redemptionStatus`, `reversal`, `statementStatus`, and
`statusHistory` are server-assigned. Events are shown as the
`EventEnvelope` a webhook subscriber receives.

---

## VAL-01 — Enrol two merchants; the cinema brings an extension

<!-- apx:scenario VAL-01 kind=happy ics=APX-VAL-01,APX-VAL-08,APX-CORE-04 -->

**Given** the back office signs Harbor Bistro and Lakeside Cinema for
Lakeside Garage on the first of the month. **When** it enrols each with
an idempotency key — the cinema's contract carries a happy-hour clause
the closed rule set cannot express, so it rides in `extensions`. **Then**
both come back 201 in `active` with `version: 1` and one history entry,
`apx.validations.program.status.v1` fires for each, and a later read of
the cinema returns the extension key untouched.

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "validationType": "twoHourComp",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": { "maxPerTicket": 1, "maxPerDay": 200, "validityWindow": "P1D", "stackable": false },
  "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "monthly" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "validationType": "twoHourComp",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": { "maxPerTicket": 1, "maxPerDay": 200, "validityWindow": "P1D", "stackable": false },
  "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "monthly" },
  "issuanceMethods": [ "qrCode" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:02:11Z", "actor": "backoffice-jlee", "detail": "enrolled" }
  ],
  "recordInfo": {
    "creationTime": "2026-09-01T15:02:11Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "backoffice-jlee"
  }
}
```

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-lakeside-cinema-2026-09
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" }
  ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

The enrolment event, as the accounting integration receives it:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationProgram at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000001",
  "type": "apx.validations.program.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "time": "2026-09-01T15:10:00Z",
  "data": {
    "id": "e5000000-0000-4000-8000-000000000002",
    "version": 1,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
    "name": "Lakeside Cinema",
    "programStatus": "active",
    "benefit": { "description": "First two hours comped", "duration": "PT2H" },
    "statusHistory": [
      { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" }
    ]
  }
}
```

A week later the back office reads the cinema back; the extension survived:

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" }
  ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

---

## VAL-02 — The back office retries the enrolment, then reuses the key by mistake

<!-- apx:scenario VAL-02 kind=edge ics=APX-VAL-01,APX-CORE-05 -->

**Given** the 201 for Harbor Bistro never reached the back-office
client. **When** it retries with the identical key and body, then a
copy-paste error sends the cinema's body under the bistro's key, and a
third client forgets the header altogether. **Then** 200 with the
program's current representation (Part 4 §4.2a; no second enrolment),
409 `idempotency-conflict`, and
400 `idempotency-key-required`.

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "validationType": "twoHourComp",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": { "maxPerTicket": 1, "maxPerDay": 200, "validityWindow": "P1D", "stackable": false },
  "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "monthly" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "validationType": "twoHourComp",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": { "maxPerTicket": 1, "maxPerDay": 200, "validityWindow": "P1D", "stackable": false },
  "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "monthly" },
  "issuanceMethods": [ "qrCode" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:02:11Z", "actor": "backoffice-jlee", "detail": "enrolled" }
  ]
}
```

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key bo-enrol-harbor-bistro-2026-09 was first used at 2026-09-01T15:02:11Z to enrol provider a2000000-0000-4000-8000-000000000077.",
  "instance": "/v1/validations/programs"
}
```

```http
POST /v1/validations/programs
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "programStatus": "active",
  "benefit": { "description": "25% off", "percentage": 25 }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/validations/programs is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/validations/programs"
}
```

---

## VAL-03 — Enrolment refused: a benefit that is two things, and a merchant nobody knows

<!-- apx:scenario VAL-03 kind=refusal ics=APX-VAL-01 -->

**Given** a gym contract typed up in a hurry. **When** the back office
sends a benefit with both `amount` and `duration`, and then one whose
`provider` is an organisation the server has never heard of. **Then**
422 `request-unprocessable` and 422 `reference-unknown`, the two types
the route's 422 description now names (F-VAL-02 fixed). The
`ValidationBenefit` schema still accepts the two-headed benefit: adding
a `oneOf` would narrow a request body clients already send, so the
"exactly one" rule is stated in the schema description and §20.1 and
enforced as the 422 instead.

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-lakeside-fitness-2026-09-a
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "programStatus": "active",
  "benefit": { "description": "$3.00 off or one hour", "amount": { "currencyType": "USD", "currencyValue": 3.0 }, "duration": "PT1H" },
  "issuanceMethods": [ "digital" ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Benefit must be exactly one of amount, duration, percentage",
  "status": 422,
  "detail": "benefit carries both amount and duration.",
  "instance": "/v1/validations/programs"
}
```

```http
POST /v1/validations/programs
Idempotency-Key: bo-enrol-lakeside-fitness-2026-09-b
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-0000000000ff", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "programStatus": "active",
  "benefit": { "description": "25% off", "percentage": 25 },
  "issuanceMethods": [ "digital" ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Referenced entity does not exist",
  "status": 422,
  "detail": "No Organisation a2000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs"
}
```

---

## VAL-04 — The provider list is the program list, and the agent's validation lands in the ledger

<!-- apx:scenario VAL-04 kind=happy ics=APX-VAL-02,APX-VAL-04 -->

**Given** three active programs at Lakeside (the fitness program was
enrolled correctly after VAL-03). **When** a call-center agent asks Part
6 for the place's providers and applies the cinema's validation to
ticket T-1001 at exit lane 2 with `applyValidation`. **Then** the
provider list is exactly the active programs, each row carrying
`program`; the command is accepted; and the ledger holds a
`ValidationRedemption` with `channel: callCenter` and `command` set,
findable from the command's id with `?command=` (F-VAL-09 fixed on the
redemption side; the reverse link on `Command` waits on F-CTL-02). The
fitness row's `percentage` still has no home in
`ValidationProvider.benefit`, which the control class owns (F-VAL-10,
open for the control group).

```http
GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.control:read apx.control:execute>
```

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790273642, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
      "name": "Harbor Bistro",
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "validationType": "twoHourComp",
      "benefit": { "description": "First two hours comped", "duration": "PT2H" }
    },
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
      "name": "Lakeside Cinema",
      "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
      "validationType": "twoHoursComped",
      "benefit": { "description": "First two hours comped", "duration": "PT2H" }
    },
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
      "name": "Lakeside Fitness",
      "program": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ValidationProgram" },
      "validationType": "percentOff",
      "benefit": { "description": "25% off", "percentage": 25 }
    }
  ]
}
```

```http
POST /v1/commands
Authorization: Bearer <apx.control:read apx.control:execute>
Idempotency-Key: cc-7750-val
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "driver has cinema stub; not stamped"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000201",
  "version": 2,
  "commandType": "applyValidation",
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "parameters": {
    "ticket": "T-1001",
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" }
  },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "driver has cinema stub; not stamped",
  "status": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-09-24T18:14:02Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-09-24T18:14:02Z", "actor": "lakeside-parcs" }
  ]
}
```

The command succeeds a second later; the ledger now has the redemption
it materialized:

<!-- apx:request GET /v1/validations/redemptions?command=d1000000-0000-4000-8000-000000000201 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790273700, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000042",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "ticketNumber": "T-1001",
      "session": { "id": "c4000000-0000-4000-8000-000000000001", "className": "Session" },
      "appliedTime": "2026-09-24T18:14:03Z",
      "channel": "callCenter",
      "appliedBy": "agent:j.okafor",
      "command": { "id": "d1000000-0000-4000-8000-000000000201", "className": "Command" },
      "validationId": "VAL-2026-0924-00417",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "durationComped": "PT2H",
      "redemptionStatus": "applied",
      "statusHistory": [
        { "state": "applied", "time": "2026-09-24T18:14:03Z", "actor": "lakeside-apx", "detail": "materialized from command d1000000-0000-4000-8000-000000000201; T-1001 amount due 9.00 → 3.00" }
      ]
    }
  ]
}
```

---

## VAL-05 — Projector fault: suspend the cinema for two days, then resume

<!-- apx:scenario VAL-05 kind=lifecycle ics=APX-VAL-01,APX-VAL-02,APX-VAL-08 -->

**Given** the cinema closes for a projector repair and does not want
stamps honoured meanwhile. **When** the back office PUTs the program to
`suspended` with `version: 1`, checks the Part 6 provider list, and two
days later PUTs it back to `active` with `version: 2`. **Then** each PUT
returns the next version with a new history entry, the extension rides
along untouched, the provider list omits the cinema while suspended,
and `apx.validations.program.status.v1` fires on both transitions.

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "suspended",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "suspended",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" },
    { "state": "suspended", "time": "2026-09-14T09:00:00Z", "actor": "backoffice-jlee", "detail": "projector repair; cinema closed until the 16th" }
  ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationProgram at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000002",
  "type": "apx.validations.program.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "time": "2026-09-14T09:00:00Z",
  "data": {
    "id": "e5000000-0000-4000-8000-000000000002",
    "version": 2,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
    "name": "Lakeside Cinema",
    "programStatus": "suspended",
    "benefit": { "description": "First two hours comped", "duration": "PT2H" },
    "statusHistory": [
      { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" },
      { "state": "suspended", "time": "2026-09-14T09:00:00Z", "actor": "backoffice-jlee", "detail": "projector repair; cinema closed until the 16th" }
    ]
  }
}
```

While suspended, the Part 6 lookup no longer offers the cinema:

```http
GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.control:read>
```

<!-- apx:request GET /v1/validations/providers?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789376400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
      "name": "Harbor Bistro",
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "validationType": "twoHourComp",
      "benefit": { "description": "First two hours comped", "duration": "PT2H" }
    },
    {
      "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
      "name": "Lakeside Fitness",
      "program": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ValidationProgram" },
      "validationType": "percentOff",
      "benefit": { "description": "25% off", "percentage": 25 }
    }
  ]
}
```

Two days later, resume:

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000002",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000011", "className": "Organisation" },
  "name": "Lakeside Cinema",
  "validationType": "twoHoursComped",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": {
    "maxPerTicket": 1,
    "maxPerDay": 500,
    "stackable": false,
    "applicableRateTables": [ { "id": "d5000000-0000-4000-8000-000000000001", "className": "RateTable" } ]
  },
  "billing": { "model": "split", "merchantShare": 50, "billingCycle": "monthly" },
  "issuanceMethods": [ "stamp", "api" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-01T15:10:00Z", "actor": "backoffice-jlee", "detail": "enrolled" },
    { "state": "suspended", "time": "2026-09-14T09:00:00Z", "actor": "backoffice-jlee", "detail": "projector repair; cinema closed until the 16th" },
    { "state": "active", "time": "2026-09-16T09:00:00Z", "actor": "backoffice-jlee", "detail": "repair complete; resumed" }
  ],
  "extensions": {
    "apds-ext:lakeside:happy-hour@1.0": { "weekdaysOnly": true, "windowStart": "16:00", "windowEnd": "18:00" }
  }
}
```

---

## VAL-06 — Two back-office users edit the bistro at once

<!-- apx:scenario VAL-06 kind=refusal ics=APX-VAL-01,APX-CORE-03 -->

**Given** two users both read the bistro program at `version: 1`; the
first raises `maxPerDay` and wins. **When** the second sends a PUT with
`If-Match: "1"` (and the same `version: 1` echoed in the body) to change
the billing cycle, and then a script PUTs a body with no `benefit`.
**Then** 409 `version-conflict` — nothing is written, and the loser
re-reads before retrying — and 400 `invalid-request`. The route declares
the shared `IfMatch` parameter and Part 4 §4.2a makes the readOnly body
`version` the equivalent precondition, so both carriers are conformant
(F-VAL-11 fixed; the PUT's 400 closes the F-VAL-12 part for this route).

```http
PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001
If-Match: "1"
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "validationType": "twoHourComp",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "rules": { "maxPerTicket": 1, "maxPerDay": 200, "validityWindow": "P1D", "stackable": false },
  "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "weekly" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Stale version",
  "status": 409,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000001 is at version 2 (maxPerDay raised to 250 at 2026-09-10T08:30:00Z by backoffice-mreyes); the request carried version 1.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001 invalid -->
```json
{
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "programStatus": "active"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "benefit is required (full-update semantics, Part 5 §5.1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001",
  "errors": [ { "pointer": "/benefit", "detail": "required" } ]
}
```

---

## VAL-07 — The gym leaves: ended is terminal

<!-- apx:scenario VAL-07 kind=lifecycle ics=APX-VAL-01,APX-VAL-08 -->

**Given** Lakeside Fitness closes at the end of September. **When** the
back office ends the program, and a month later someone tries to
resume it, and the gym's app tries to issue digital codes against it.
**Then** the end transition returns 200 in `ended` and publishes
`apx.validations.program.status.v1`; the resume is 422
`program-not-active`; and the issuance is 422 `program-not-active`.

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000004 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000004",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "validationType": "percentOff",
  "programStatus": "ended",
  "benefit": { "description": "25% off", "percentage": 25 },
  "billing": { "model": "operatorAbsorbs" },
  "issuanceMethods": [ "digital" ]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000004",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "validationType": "percentOff",
  "programStatus": "ended",
  "benefit": { "description": "25% off", "percentage": 25 },
  "billing": { "model": "operatorAbsorbs" },
  "issuanceMethods": [ "digital" ],
  "statusHistory": [
    { "state": "active", "time": "2026-09-02T10:00:00Z", "actor": "backoffice-jlee", "detail": "enrolled" },
    { "state": "ended", "time": "2026-09-30T17:00:00Z", "actor": "backoffice-jlee", "detail": "tenant vacated unit 3" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationProgram at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000003",
  "type": "apx.validations.program.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ValidationProgram" },
  "time": "2026-09-30T17:00:00Z",
  "data": {
    "id": "e5000000-0000-4000-8000-000000000004",
    "version": 2,
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
    "name": "Lakeside Fitness",
    "programStatus": "ended",
    "benefit": { "description": "25% off", "percentage": 25 },
    "statusHistory": [
      { "state": "active", "time": "2026-09-02T10:00:00Z", "actor": "backoffice-jlee", "detail": "enrolled" },
      { "state": "ended", "time": "2026-09-30T17:00:00Z", "actor": "backoffice-jlee", "detail": "tenant vacated unit 3" }
    ]
  }
}
```

A month later a new tenant with the same name asks to be "switched back on":

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000004 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000004",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000014", "className": "Organisation" },
  "name": "Lakeside Fitness",
  "validationType": "percentOff",
  "programStatus": "active",
  "benefit": { "description": "25% off", "percentage": 25 },
  "billing": { "model": "operatorAbsorbs" },
  "issuanceMethods": [ "digital" ]
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/program-not-active",
  "title": "Program is ended",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000004 is ended; ended is terminal. Enrol a new program.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000004"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000004/issuances
Idempotency-Key: gym-app-2026-11-02-batch-1
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000004/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000004", "className": "ValidationProgram" }, "quantity": 100, "method": "digital", "issuedTo": "gym-app" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/program-not-active",
  "title": "Program is not active",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000004 is ended; instruments can only be issued to an active program.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000004/issuances"
}
```

---

## VAL-08 — The bistro prints a sheet of QR codes, and the print job retries

<!-- apx:scenario VAL-08 kind=happy ics=APX-VAL-03 -->

**Given** Harbor Bistro's iPad on the merchant scope
(`apx.validations:redeem`, `apx_org` = `a2…0077`). **When** it issues 50
QR codes, the print spooler retries with the same key, and the back
office later lists the program's batches. **Then** 201 with `codes[]`
(abridged here to three) and `validTo` defaulted from the one-day
`validityWindow`; the replay is 200 with the batch's current
representation and no codes; the list never shows codes. A reused key
with a different quantity is 409, and a batch without a key is 400. The
first two bodies are the public scenario 18 shape, which now validates:
the create body is `ValidationIssuanceRequest`, where `program` is
optional because the path names it (F-VAL-04 fixed). The later bodies
repeat it, which is still allowed when it matches the path.

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Authorization: Bearer <apx.validations:redeem; apx_org a2…0077>
Idempotency-Key: hb-ipad-2026-09-12-sheet-3
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "quantity": 50, "method": "qrCode", "issuedTo": "front-of-house" }
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000003",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "quantity": 50,
  "method": "qrCode",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "issuedTo": "front-of-house",
  "codes": [ "HB-7Q2M-K9X4-3TPD", "HB-A1C8-ZR5N-W6LJ", "HB-P0V3-E7HS-M2QY" ],
  "issuanceStatus": "issued"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Idempotency-Key: hb-ipad-2026-09-12-sheet-3
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "quantity": 50, "method": "qrCode", "issuedTo": "front-of-house" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000003",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "quantity": 50,
  "method": "qrCode",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "issuedTo": "front-of-house",
  "issuanceStatus": "issued"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Idempotency-Key: hb-ipad-2026-09-12-sheet-3
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" }, "quantity": 100, "method": "qrCode", "issuedTo": "front-of-house" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key hb-ipad-2026-09-12-sheet-3 was first used at 2026-09-12T17:00:00Z for a batch of 50 qrCode instruments.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" }, "quantity": 50, "method": "qrCode" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "A retried print job must not double the stock: POST …/issuances requires an Idempotency-Key header.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

The back office lists the bistro's batches, newest first, codes never included:

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1789232400, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "e6000000-0000-4000-8000-000000000003",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "quantity": 50,
      "method": "qrCode",
      "validFrom": "2026-09-12T17:00:00Z",
      "validTo": "2026-09-13T17:00:00Z",
      "issuedTo": "front-of-house",
      "issuanceStatus": "issued"
    },
    {
      "id": "e6000000-0000-4000-8000-000000000002",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "quantity": 50,
      "method": "qrCode",
      "validFrom": "2026-09-05T17:00:00Z",
      "validTo": "2026-09-06T17:00:00Z",
      "issuedTo": "front-of-house",
      "issuanceStatus": "issued"
    }
  ]
}
```

---

## VAL-09 — A method the program never agreed to, and stamps for the cinema

<!-- apx:scenario VAL-09 kind=refusal ics=APX-VAL-03 -->

**Given** the bistro's program allows `qrCode` only. **When** its iPad
asks for a `stamp` batch. **Then** 422 `request-unprocessable`, which
the route's 422 description now names for "method not in
issuanceMethods" (F-VAL-03 fixed).
The cinema, whose program does allow stamps, orders 500: 201 with no
`codes[]`, because stamps are physical stock counted for billing.

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Idempotency-Key: hb-ipad-2026-09-12-stamps
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" }, "quantity": 200, "method": "stamp", "issuedTo": "front-of-house" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Issuance method not permitted for this program",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000001 permits issuanceMethods [qrCode]; stamp requested.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances
Idempotency-Key: bo-cinema-stamps-2026-09-03
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" }, "quantity": 500, "method": "stamp", "issuedTo": "cinema box office", "note": "roll of 500, blue ink" }
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000004",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "quantity": 500,
  "method": "stamp",
  "validFrom": "2026-09-03T14:00:00Z",
  "issuedTo": "cinema box office",
  "issuanceStatus": "issued",
  "note": "roll of 500, blue ink"
}
```

---

## VAL-10 — A guest scans a code at the pay station

<!-- apx:scenario VAL-10 kind=happy ics=APX-VAL-03,APX-VAL-04,APX-VAL-08 -->

**Given** ticket T-2210 owes $9.00 and the guest has a bistro QR code.
**When** pay station 3 (operator token) checks the code, then redeems
it with an idempotency key, then checks it again. **Then** the first
check is 200 `valid` with the benefit to display; the redemption is 201
with `validationId` materialized on the APDS session and
`amountReduced` at the actual $6.00 the two hours were worth;
`apx.validations.redeemed.v1` fires; and the second check shows
`redeemed` pointing at the redemption.

<!-- apx:request GET /v1/validations/instruments/HB-7Q2M-K9X4-3TPD -->
<!-- apx:response 200 -->
```json
{
  "code": "HB-7Q2M-K9X4-3TPD",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000003", "className": "ValidationIssuance" },
  "instrumentStatus": "valid",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" }
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-213305
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000041",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003",
  "validationId": "VAL-20260912-000318",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-12T21:33:05Z", "actor": "paystation-c1000000-0003", "detail": "T-2210 amount due 9.00 → 3.00" }
  ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationRedemption at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000004",
  "type": "apx.validations.redeemed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
  "time": "2026-09-12T21:33:05Z",
  "data": {
    "id": "e7000000-0000-4000-8000-000000000041",
    "version": 1,
    "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "instrumentCode": "HB-7Q2M-K9X4-3TPD",
    "ticketNumber": "T-2210",
    "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
    "appliedTime": "2026-09-12T21:33:05Z",
    "channel": "payStation",
    "validationId": "VAL-20260912-000318",
    "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
    "durationComped": "PT2H",
    "redemptionStatus": "applied"
  }
}
```

<!-- apx:request GET /v1/validations/instruments/HB-7Q2M-K9X4-3TPD -->
<!-- apx:response 200 -->
```json
{
  "code": "HB-7Q2M-K9X4-3TPD",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000003", "className": "ValidationIssuance" },
  "instrumentStatus": "redeemed",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" }
}
```

---

## VAL-11 — The pay station's network hiccups mid-redemption

<!-- apx:scenario VAL-11 kind=edge ics=APX-VAL-04,APX-CORE-05 -->

**Given** the 201 from VAL-10 was lost on the wire. **When** the pay
station retries with the same key and body; then a firmware bug reuses
that key for the next guest; then a third redemption arrives with no
key. **Then** 200 with the redemption's current representation (the code is not
consumed twice, the ticket not reduced twice), 409
`idempotency-conflict`, and 400 `idempotency-key-required`.

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-213305
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000041",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003",
  "validationId": "VAL-20260912-000318",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-12T21:33:05Z", "actor": "paystation-c1000000-0003", "detail": "T-2210 amount due 9.00 → 3.00" }
  ]
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-213305
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-P0V3-E7HS-M2QY",
  "ticketNumber": "T-2214",
  "session": { "id": "f1000000-0000-4000-8000-000000000214", "className": "Session" },
  "appliedTime": "2026-09-12T21:41:10Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key ps-c1000000-0003-20260912-213305 was first used at 2026-09-12T21:33:05Z for code HB-7Q2M-K9X4-3TPD on ticket T-2210.",
  "instance": "/v1/validations/redemptions"
}
```

```http
POST /v1/validations/redemptions
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-P0V3-E7HS-M2QY",
  "ticketNumber": "T-2214",
  "appliedTime": "2026-09-12T21:41:10Z",
  "channel": "payStation"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/validations/redemptions is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/validations/redemptions"
}
```

---

## VAL-12 — Codes that are not good: unknown, expired, used, void, and missing

<!-- apx:scenario VAL-12 kind=refusal ics=APX-VAL-03,APX-VAL-04 -->

**Given** five guests at pay station 3 over one evening. **When** one
presents a code that was never issued, one a code from last week's
sheet, one the code already used on T-2210, one a code from a sheet
the bistro reported stolen, and one a bistro validation with no code at
all. **Then** the unknown code is 404 on lookup and 422
`instrument-invalid` on redemption; the others are 200 on lookup with
their status, and 422 `instrument-invalid` on redemption. The stolen
sheet was voided through `POST …/issuances/{issuanceId}/void` earlier
that evening (VAL-25; F-VAL-05 fixed).

<!-- apx:request GET /v1/validations/instruments/HB-ZZZZ-ZZZZ-ZZZZ -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Unknown code",
  "status": 404,
  "detail": "No instrument HB-ZZZZ-ZZZZ-ZZZZ.",
  "instance": "/v1/validations/instruments/HB-ZZZZ-ZZZZ-ZZZZ"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-220102
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-ZZZZ-ZZZZ-ZZZZ",
  "ticketNumber": "T-2215",
  "appliedTime": "2026-09-12T22:01:02Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument invalid",
  "status": 422,
  "detail": "Code HB-ZZZZ-ZZZZ-ZZZZ is unknown.",
  "instance": "/v1/validations/redemptions"
}
```

Last week's sheet expired on the 6th:

<!-- apx:request GET /v1/validations/instruments/HB-E1X9-P4RD-0OLD -->
<!-- apx:response 200 -->
```json
{
  "code": "HB-E1X9-P4RD-0OLD",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000002", "className": "ValidationIssuance" },
  "instrumentStatus": "expired",
  "validFrom": "2026-09-05T17:00:00Z",
  "validTo": "2026-09-06T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" }
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-220340
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-E1X9-P4RD-0OLD",
  "ticketNumber": "T-2216",
  "appliedTime": "2026-09-12T22:03:40Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument invalid",
  "status": 422,
  "detail": "Code HB-E1X9-P4RD-0OLD expired at 2026-09-06T17:00:00Z.",
  "instance": "/v1/validations/redemptions"
}
```

The code from VAL-10, tried again on a different ticket:

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-221500
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2217",
  "appliedTime": "2026-09-12T22:15:00Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument invalid",
  "status": 422,
  "detail": "Code HB-7Q2M-K9X4-3TPD was redeemed at 2026-09-12T21:33:05Z on ticket T-2210 (redemption e7000000-0000-4000-8000-000000000041).",
  "instance": "/v1/validations/redemptions"
}
```

A code from the sheet the bistro reported stolen and voided (VAL-25):

<!-- apx:request GET /v1/validations/instruments/HB-S7K2-QW4N-8HGV -->
<!-- apx:response 200 -->
```json
{
  "code": "HB-S7K2-QW4N-8HGV",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000005", "className": "ValidationIssuance" },
  "instrumentStatus": "void",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "voidDetail": { "reason": "stolen", "time": "2026-09-12T19:40:00Z", "actor": "hb-ipad-foh" }
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-222210
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-S7K2-QW4N-8HGV",
  "ticketNumber": "T-2218",
  "appliedTime": "2026-09-12T22:22:10Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument invalid",
  "status": 422,
  "detail": "Code HB-S7K2-QW4N-8HGV is void (issuance e6000000-0000-4000-8000-000000000005 voided 2026-09-12T19:40:00Z: sheet reported stolen).",
  "instance": "/v1/validations/redemptions"
}
```

The bistro's app tries to validate a regular's ticket without any code;
the program issues `qrCode` only, so an instrument is required:

```http
POST /v1/validations/redemptions
Authorization: Bearer <apx.validations:redeem; apx_org a2…0077>
Idempotency-Key: hb-ipad-20260912-2230
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2219",
  "appliedTime": "2026-09-12T22:30:00Z",
  "channel": "merchantApp",
  "appliedBy": "hb-ipad-foh"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument required",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000001 has no api issuance method; a redemption must name an instrumentCode.",
  "instance": "/v1/validations/redemptions"
}
```

---

## VAL-13 — The closed rule set says no: per ticket, stacking, rate table, per day

<!-- apx:scenario VAL-13 kind=refusal ics=APX-VAL-04 -->

**Given** the programs from VAL-01. **When** a second bistro code is
tried on T-2210; the cinema's POS tries to add its validation to that
same ticket; the cinema's POS validates a concert-night ticket priced
from the event rate; and the bistro's 201st guest of a Saturday scans.
**Then** each is 422 `redemption-limit-exceeded` with the rule named in
`detail`: `maxPerTicket`, `stackable`, `applicableRateTables`,
`maxPerDay`. Both programs here are non-stackable, so either reading
refuses the cinema; §20.3 rule 3 now evaluates `stackable` both ways
(the incoming program's flag, and every already-applied program's), so
a stackable program arriving on a ticket that carries the bistro is
refused too, and two servers agree (F-VAL-08 fixed).

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260912-213348
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-A1C8-ZR5N-W6LJ",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:48Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-limit-exceeded",
  "title": "Redemption limit exceeded",
  "status": 422,
  "detail": "Program rule maxPerTicket=1: ticket T-2210 already carries redemption e7000000-0000-4000-8000-000000000041.",
  "instance": "/v1/validations/redemptions"
}
```

```http
POST /v1/validations/redemptions
Authorization: Bearer <apx.validations:redeem; apx_org a2…0011>
Idempotency-Key: cinema-pos-01-20260912-2140
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:40:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-limit-exceeded",
  "title": "Redemption limit exceeded",
  "status": 422,
  "detail": "Program rule stackable=false: ticket T-2210 already carries a redemption of program e5000000-0000-4000-8000-000000000001 (Harbor Bistro).",
  "instance": "/v1/validations/redemptions"
}
```

Concert night; the session prices from the event rate `d5…0003`, and
the cinema's program is restricted to the standard deck:

```http
POST /v1/validations/redemptions
Authorization: Bearer <apx.validations:redeem; apx_org a2…0011>
Idempotency-Key: cinema-pos-01-20260926-2210
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2212",
  "session": { "id": "f1000000-0000-4000-8000-000000000212", "className": "Session" },
  "appliedTime": "2026-09-26T22:10:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-limit-exceeded",
  "title": "Redemption limit exceeded",
  "status": 422,
  "detail": "Program rule applicableRateTables: session f1000000-0000-4000-8000-000000000212 is priced from RateTable d5000000-0000-4000-8000-000000000003 (event rate), which the program does not cover.",
  "instance": "/v1/validations/redemptions"
}
```

Saturday the 27th, the bistro's 201st guest:

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260927-234455
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-M3N8-C2VT-5RKQ",
  "ticketNumber": "T-2601",
  "appliedTime": "2026-09-27T23:44:55Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-limit-exceeded",
  "title": "Redemption limit exceeded",
  "status": 422,
  "detail": "Program rule maxPerDay=200: 200 redemptions already applied at place b1000000-0000-4000-8000-000000000001 on 2026-09-27.",
  "instance": "/v1/validations/redemptions"
}
```

---

## VAL-14 — The cinema is dark, and a Harbor Deck voucher turns up at Lakeside

<!-- apx:scenario VAL-14 kind=refusal ics=APX-VAL-04,APX-VAL-03 -->

**Given** the cinema is `suspended` (VAL-05) and a guest at Lakeside
holds a voucher from Harbor Deck's hotel. **When** the cinema's POS
records a redemption anyway, and pay station 3 looks up the hotel's
code and then tries to redeem the hotel's program at Lakeside. **Then**
422 `program-not-active` for the suspended program; the hotel's code is
404 (outside the caller's grant — never 403, so nobody can probe for
codes); and the redemption is 422 `request-unprocessable` with `detail`
naming the program's place — §20.3 rule 1 now separates "wrong place"
from "program suspended", so the pay station can tell them apart
(F-VAL-13 fixed without a new slug).

```http
POST /v1/validations/redemptions
Authorization: Bearer <apx.validations:redeem; apx_org a2…0011>
Idempotency-Key: cinema-pos-01-20260915-2000
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2350",
  "appliedTime": "2026-09-15T20:00:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/program-not-active",
  "title": "Program is not active",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000002 is suspended since 2026-09-14T09:00:00Z.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/instruments/HD-4RT7-NM2Q-9XCB -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Unknown code",
  "status": 404,
  "detail": "No instrument HD-4RT7-NM2Q-9XCB.",
  "instance": "/v1/validations/instruments/HD-4RT7-NM2Q-9XCB"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: ps-c1000000-0003-20260915-201500
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000003", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HD-4RT7-NM2Q-9XCB",
  "ticketNumber": "T-2351",
  "appliedTime": "2026-09-15T20:15:00Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Program does not cover this place",
  "status": 422,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 validates parking at place b1000000-0000-4000-8000-000000000002, not b1000000-0000-4000-8000-000000000001.",
  "instance": "/v1/validations/redemptions"
}
```

---

## VAL-15 — The cinema validates from its POS and from the lane, and the back office reads the ledger

<!-- apx:scenario VAL-15 kind=happy ics=APX-VAL-04 -->

**Given** the cinema is active again and its program allows `api`, so
no code is needed. **When** its POS records a redemption for T-2211,
the exit lane's reader accepts a stamped ticket T-2220, and the back
office lists the cinema's API redemptions since the resume and reads
one by id. **Then** both are 201 with `durationComped: PT2H` and the
actual `amountReduced`; the list carries the filter results; the read
returns the full resource with history.

```http
POST /v1/validations/redemptions
Authorization: Bearer <apx.validations:redeem; apx_org a2…0011>
Idempotency-Key: cinema-pos-01-20260919-200500
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2211",
  "session": { "id": "f1000000-0000-4000-8000-000000000211", "className": "Session" },
  "appliedTime": "2026-09-19T20:05:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000043",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2211",
  "session": { "id": "f1000000-0000-4000-8000-000000000211", "className": "Session" },
  "appliedTime": "2026-09-19T20:05:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01",
  "validationId": "VAL-20260919-000402",
  "amountReduced": { "currencyType": "USD", "currencyValue": 5.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-19T20:05:00Z", "actor": "cinema-pos-01", "detail": "T-2211 amount due 5.00 → 0.00 (two hours at the evening rate)" }
  ]
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: lane-b2000000-0002-20260919-224012
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2220",
  "session": { "id": "f1000000-0000-4000-8000-000000000220", "className": "Session" },
  "appliedTime": "2026-09-19T22:40:12Z",
  "channel": "lane",
  "appliedBy": "lane-b2000000-0002"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000046",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2220",
  "session": { "id": "f1000000-0000-4000-8000-000000000220", "className": "Session" },
  "appliedTime": "2026-09-19T22:40:12Z",
  "channel": "lane",
  "appliedBy": "lane-b2000000-0002",
  "validationId": "VAL-20260919-000411",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-19T22:40:12Z", "actor": "lane-b2000000-0002", "detail": "stamp read on ticket T-2220; amount due 12.00 → 6.00" }
  ]
}
```

<!-- apx:request GET /v1/validations/redemptions?program=e5000000-0000-4000-8000-000000000002&channel=api&status=applied&since=2026-09-16T09:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790200000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000043",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "ticketNumber": "T-2211",
      "session": { "id": "f1000000-0000-4000-8000-000000000211", "className": "Session" },
      "appliedTime": "2026-09-19T20:05:00Z",
      "channel": "api",
      "appliedBy": "cinema-pos-01",
      "validationId": "VAL-20260919-000402",
      "amountReduced": { "currencyType": "USD", "currencyValue": 5.0 },
      "durationComped": "PT2H",
      "redemptionStatus": "applied"
    }
  ]
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-000000000043 -->
<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000043",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2211",
  "session": { "id": "f1000000-0000-4000-8000-000000000211", "className": "Session" },
  "appliedTime": "2026-09-19T20:05:00Z",
  "channel": "api",
  "appliedBy": "cinema-pos-01",
  "validationId": "VAL-20260919-000402",
  "amountReduced": { "currencyType": "USD", "currencyValue": 5.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-19T20:05:00Z", "actor": "cinema-pos-01", "detail": "T-2211 amount due 5.00 → 0.00 (two hours at the evening rate)" }
  ]
}
```

---

## VAL-16 — Wrong ticket at 2 am: reverse it, the code comes back, reverse it again

<!-- apx:scenario VAL-16 kind=lifecycle ics=APX-VAL-05,APX-VAL-08 -->

**Given** at 02:00 the pay station applied bistro code `HB-A1C8…` to
T-2213, the ticket of the car behind. **When** the night supervisor
reverses it ten minutes later with reason `wrongTicket`, the guest
rescans the code on the right ticket, and a second supervisor reverses
the same redemption again. **Then** the reversal is 200 in `reversed`
with the `reversal` block and a new history entry; the instrument reads
`valid` again (still inside its window); `apx.validations.redeemed.v1`
fires with `redemptionStatus: reversed`; and the repeat is 409
`redemption-reversed`.

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000044/reverse -->
```json
{ "reason": "wrongTicket", "note": "applied to T-2213, the car behind; guest's ticket is T-2216" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000044",
  "version": 2,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-A1C8-ZR5N-W6LJ",
  "ticketNumber": "T-2213",
  "session": { "id": "f1000000-0000-4000-8000-000000000213", "className": "Session" },
  "appliedTime": "2026-09-13T02:00:14Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003",
  "validationId": "VAL-20260913-000002",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "reversed",
  "reversal": { "reason": "wrongTicket", "note": "applied to T-2213, the car behind; guest's ticket is T-2216", "time": "2026-09-13T02:10:30Z", "actor": "sup:m.reyes" },
  "statusHistory": [
    { "state": "applied", "time": "2026-09-13T02:00:14Z", "actor": "paystation-c1000000-0003", "detail": "T-2213 amount due 9.00 → 3.00" },
    { "state": "reversed", "time": "2026-09-13T02:10:30Z", "actor": "sup:m.reyes", "detail": "wrongTicket; T-2213 amount due restored to 9.00; code HB-A1C8-ZR5N-W6LJ returned to valid" }
  ]
}
```

<!-- apx:request GET /v1/validations/instruments/HB-A1C8-ZR5N-W6LJ -->
<!-- apx:response 200 -->
```json
{
  "code": "HB-A1C8-ZR5N-W6LJ",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000003", "className": "ValidationIssuance" },
  "instrumentStatus": "valid",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationRedemption at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000005",
  "type": "apx.validations.redeemed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e7000000-0000-4000-8000-000000000044", "className": "ValidationRedemption" },
  "time": "2026-09-13T02:10:30Z",
  "data": {
    "id": "e7000000-0000-4000-8000-000000000044",
    "version": 2,
    "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "instrumentCode": "HB-A1C8-ZR5N-W6LJ",
    "ticketNumber": "T-2213",
    "appliedTime": "2026-09-13T02:00:14Z",
    "channel": "payStation",
    "redemptionStatus": "reversed",
    "reversal": { "reason": "wrongTicket", "time": "2026-09-13T02:10:30Z", "actor": "sup:m.reyes" }
  }
}
```

The day-shift supervisor, reading the overnight log, reverses it again:

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000044/reverse -->
```json
{ "reason": "wrongTicket" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-reversed",
  "title": "Redemption already reversed",
  "status": 409,
  "detail": "Redemption e7000000-0000-4000-8000-000000000044 was reversed at 2026-09-13T02:10:30Z by sup:m.reyes.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000044/reverse"
}
```

A console bug then sends a reversal with no reason at all:

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000045/reverse invalid -->
```json
{ "note": "oops" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000045/reverse",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

---

## VAL-17 — Month end: preview September, close it, and read it back

<!-- apx:scenario VAL-17 kind=happy ics=APX-VAL-07,APX-VAL-08 -->

**Given** it is the first of October. **When** the back office previews
the bistro's September, closes it with an idempotency key, the
accounting job retries the close, and then lists and reads the closed
statement. **Then** the preview is 200 with `statementStatus: preview`
and no `id`; the close is 201 `closed` with `id`, `lines[]`,
`closedTime`, `closedBy`; `apx.validations.statement.closed.v1` fires
without lines; the retry is 200 with the (immutable) statement; the list
omits `lines[]`; the read carries them. 412 redemptions at $4.00 bill
the bistro $1,648.00; the $2,418.00 actually comped is the operator's
number.

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "periodStart": "2026-09-01T00:00:00Z",
  "periodEnd": "2026-10-01T00:00:00Z",
  "statementStatus": "preview",
  "billingModel": "merchantPays",
  "redemptionCount": 412,
  "reversedCount": 3,
  "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
  "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
  "lines": [
    {
      "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
      "appliedTime": "2026-09-12T21:33:05Z",
      "ticketNumber": "T-2210",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "billable": { "currencyType": "USD", "currencyValue": 4.0 }
    }
  ]
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: bo-close-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-09-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z", "note": "September 2026" }
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000009",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "periodStart": "2026-09-01T00:00:00Z",
  "periodEnd": "2026-10-01T00:00:00Z",
  "statementStatus": "closed",
  "billingModel": "merchantPays",
  "redemptionCount": 412,
  "reversedCount": 3,
  "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
  "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
  "lines": [
    {
      "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
      "appliedTime": "2026-09-12T21:33:05Z",
      "ticketNumber": "T-2210",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "billable": { "currencyType": "USD", "currencyValue": 4.0 }
    }
  ],
  "closedTime": "2026-10-01T09:00:12Z",
  "closedBy": "backoffice-jlee",
  "note": "September 2026"
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate ValidationStatement at /data -->
```json
{
  "id": "9a000000-0000-4000-8000-000000000006",
  "type": "apx.validations.statement.closed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000009", "className": "ValidationStatement" },
  "time": "2026-10-01T09:00:12Z",
  "data": {
    "id": "e8000000-0000-4000-8000-000000000009",
    "version": 1,
    "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "periodStart": "2026-09-01T00:00:00Z",
    "periodEnd": "2026-10-01T00:00:00Z",
    "statementStatus": "closed",
    "billingModel": "merchantPays",
    "redemptionCount": 412,
    "reversedCount": 3,
    "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
    "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
    "closedTime": "2026-10-01T09:00:12Z",
    "closedBy": "backoffice-jlee"
  }
}
```

The accounting job's retry:

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: bo-close-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-09-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z", "note": "September 2026" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000009",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "periodStart": "2026-09-01T00:00:00Z",
  "periodEnd": "2026-10-01T00:00:00Z",
  "statementStatus": "closed",
  "billingModel": "merchantPays",
  "redemptionCount": 412,
  "reversedCount": 3,
  "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
  "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
  "lines": [
    {
      "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
      "appliedTime": "2026-09-12T21:33:05Z",
      "ticketNumber": "T-2210",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "billable": { "currencyType": "USD", "currencyValue": 4.0 }
    }
  ],
  "closedTime": "2026-10-01T09:00:12Z",
  "closedBy": "backoffice-jlee",
  "note": "September 2026"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790931612, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000009",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "periodStart": "2026-09-01T00:00:00Z",
      "periodEnd": "2026-10-01T00:00:00Z",
      "statementStatus": "closed",
      "billingModel": "merchantPays",
      "redemptionCount": 412,
      "reversedCount": 3,
      "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
      "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
      "closedTime": "2026-10-01T09:00:12Z",
      "closedBy": "backoffice-jlee",
      "note": "September 2026"
    }
  ]
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-000000000009 -->
<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000009",
  "version": 1,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "periodStart": "2026-09-01T00:00:00Z",
  "periodEnd": "2026-10-01T00:00:00Z",
  "statementStatus": "closed",
  "billingModel": "merchantPays",
  "redemptionCount": 412,
  "reversedCount": 3,
  "totalReduced": { "currencyType": "USD", "currencyValue": 2418.0 },
  "billableAmount": { "currencyType": "USD", "currencyValue": 1648.0 },
  "lines": [
    {
      "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
      "appliedTime": "2026-09-12T21:33:05Z",
      "ticketNumber": "T-2210",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "billable": { "currencyType": "USD", "currencyValue": 4.0 }
    }
  ],
  "closedTime": "2026-10-01T09:00:12Z",
  "closedBy": "backoffice-jlee",
  "note": "September 2026"
}
```

---

## VAL-18 — Closing a period twice, sideways, and backwards

<!-- apx:scenario VAL-18 kind=refusal ics=APX-VAL-07,APX-CORE-05 -->

**Given** September is closed (VAL-17). **When** a new accountant closes
"the 15th to the 15th"; then reuses September's key for October; then
sends a close with no key; then one whose `periodEnd` precedes its
`periodStart`; then previews a backwards window. **Then** 409
`statement-overlap`, 409 `idempotency-conflict`, 400
`idempotency-key-required`, and 400 `invalid-request` twice — the close
route names the type, and the preview now declares the 400 (F-VAL-12
fixed).

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: bo-close-harbor-bistro-mid-oct
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-09-15T00:00:00Z", "periodEnd": "2026-10-15T00:00:00Z" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/statement-overlap",
  "title": "Period overlaps a closed statement",
  "status": 409,
  "detail": "2026-09-15T00:00:00Z..2026-10-15T00:00:00Z overlaps closed statement e8000000-0000-4000-8000-000000000009 (2026-09-01T00:00:00Z..2026-10-01T00:00:00Z).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: bo-close-harbor-bistro-2026-09
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-10-01T00:00:00Z", "periodEnd": "2026-11-01T00:00:00Z" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key bo-close-harbor-bistro-2026-09 was first used at 2026-10-01T09:00:12Z to close 2026-09-01T00:00:00Z..2026-10-01T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-10-01T00:00:00Z", "periodEnd": "2026-11-01T00:00:00Z" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST …/statements is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: bo-close-harbor-bistro-2026-10-typo
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-11-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid period",
  "status": 400,
  "detail": "periodEnd 2026-10-01T00:00:00Z is not after periodStart 2026-11-01T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-11-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid period",
  "status": 400,
  "detail": "from 2026-11-01T00:00:00Z is not before to 2026-10-01T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement",
  "errors": [ { "pointer": "/query/from", "detail": "must be before to" } ]
}
```

---

## VAL-19 — A September redemption is disputed after the invoice went out

<!-- apx:scenario VAL-19 kind=lifecycle ics=APX-VAL-05,APX-VAL-07 -->

**Given** the bistro disputes the T-2210 redemption on 2 October, after
September was closed. **When** a supervisor reverses it, and the back
office previews October. **Then** the reversal is 200 `reversed` with
`reversal.closedStatement` naming September's statement, which is not
edited; the ticket's session closed long ago, so nothing is reopened;
and October's preview carries a `credit` line (`lineKind: credit`,
negative `billable`, `originalStatement` = September) netted into
`billableAmount`. When October closes, the reversal's
`reversal.creditedOn` names it. §20.4 and §20.6 now agree: one ledger,
no separate credit operation, and `statement-closed` is no longer
returned by `reverse` (F-VAL-06 fixed).

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse -->
```json
{ "reason": "merchantDispute", "note": "bistro says the guest never dined" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e7000000-0000-4000-8000-000000000041",
  "version": 2,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "validationId": "VAL-20260912-000318",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "redemptionStatus": "reversed",
  "reversal": {
    "reason": "merchantDispute",
    "note": "bistro says the guest never dined",
    "time": "2026-10-02T10:00:00Z",
    "actor": "sup:m.reyes",
    "closedStatement": { "id": "e8000000-0000-4000-8000-000000000009", "className": "ValidationStatement" }
  },
  "statusHistory": [
    { "state": "applied", "time": "2026-09-12T21:33:05Z", "actor": "paystation-b2000000-0007" },
    { "state": "reversed", "time": "2026-10-02T10:00:00Z", "actor": "sup:m.reyes", "detail": "merchantDispute; billed on closed statement e8…0009, credit due on the next statement; session closed, amount due not reopened; code past its window, stays redeemed" }
  ]
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "periodStart": "2026-10-01T00:00:00Z",
  "periodEnd": "2026-11-01T00:00:00Z",
  "statementStatus": "preview",
  "billingModel": "merchantPays",
  "redemptionCount": 37,
  "reversedCount": 0,
  "creditCount": 1,
  "totalReduced": { "currencyType": "USD", "currencyValue": 222.0 },
  "billableAmount": { "currencyType": "USD", "currencyValue": 144.0 },
  "lines": [
    {
      "lineKind": "credit",
      "redemption": { "id": "e7000000-0000-4000-8000-000000000041", "className": "ValidationRedemption" },
      "originalStatement": { "id": "e8000000-0000-4000-8000-000000000009", "className": "ValidationStatement" },
      "appliedTime": "2026-09-12T21:33:05Z",
      "ticketNumber": "T-2210",
      "amountReduced": { "currencyType": "USD", "currencyValue": -6.0 },
      "billable": { "currencyType": "USD", "currencyValue": -4.0 }
    }
  ]
}
```

---

## VAL-20 — What the bistro's iPad can and cannot do

<!-- apx:scenario VAL-20 kind=security ics=APX-VAL-06,APX-VAL-03,APX-CORE-07 -->

**Given** Harbor Bistro's token: `apx.validations:redeem` only,
`apx_org` = `a2…0077`. **When** it lists programs at Lakeside and its
own redemptions; then tries to enrol, update, reverse, and close; then
reads the cinema's program, batches, a cinema redemption, the cinema's
statements, issues cinema stock, redeems against the cinema, and looks
up a cinema code. **Then** the lists show only the bistro; the four
operator actions are 403 `insufficient-scope`; the cinema resources by
id, and every `…/programs/{id}/…` sub-route on the cinema's program, are
404 `target-not-found`, exactly as for records that do not exist (Part 9
§9.3a rule 2, cited in §20.5: F-VAL-07 fixed); the redemption naming the
cinema's program in its body is 422 `reference-unknown`; and the cinema
code is 404, never 403.

```http
GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.validations:redeem; apx_org a2…0077>
```

<!-- apx:request GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001&status=active&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790300000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e5000000-0000-4000-8000-000000000001",
      "version": 2,
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
      "name": "Harbor Bistro",
      "validationType": "twoHourComp",
      "programStatus": "active",
      "benefit": { "description": "First two hours comped", "duration": "PT2H" },
      "rules": { "maxPerTicket": 1, "maxPerDay": 250, "validityWindow": "P1D", "stackable": false },
      "billing": { "model": "merchantPays", "unitPrice": { "currencyType": "USD", "currencyValue": 4.0 }, "billingCycle": "monthly" },
      "issuanceMethods": [ "qrCode" ]
    }
  ]
}
```

<!-- apx:request GET /v1/validations/redemptions?program=e5000000-0000-4000-8000-000000000001&since=2026-09-12T00:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790300000, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "e7000000-0000-4000-8000-000000000044",
      "version": 2,
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "instrumentCode": "HB-A1C8-ZR5N-W6LJ",
      "ticketNumber": "T-2213",
      "appliedTime": "2026-09-13T02:00:14Z",
      "channel": "payStation",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "redemptionStatus": "reversed",
      "reversal": { "reason": "wrongTicket", "time": "2026-09-13T02:10:30Z", "actor": "sup:m.reyes" }
    },
    {
      "id": "e7000000-0000-4000-8000-000000000041",
      "version": 1,
      "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "instrumentCode": "HB-7Q2M-K9X4-3TPD",
      "ticketNumber": "T-2210",
      "appliedTime": "2026-09-12T21:33:05Z",
      "channel": "payStation",
      "validationId": "VAL-20260912-000318",
      "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
      "durationComped": "PT2H",
      "redemptionStatus": "applied"
    }
  ]
}
```

The four things a merchant may never do:

```http
POST /v1/validations/programs
Idempotency-Key: hb-ipad-self-enrol
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro — brunch",
  "programStatus": "active",
  "benefit": { "description": "One hour comped", "duration": "PT1H" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/validations/programs requires scope apx.validations:manage; token carries apx.validations:redeem.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "programStatus": "active",
  "benefit": { "description": "First three hours comped", "duration": "PT3H" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /v1/validations/programs/{id} requires scope apx.validations:manage; token carries apx.validations:redeem.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse -->
```json
{ "reason": "merchantDispute" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST …/reverse requires scope apx.validations:manage; token carries apx.validations:redeem.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: hb-ipad-close-sep
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-09-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST …/statements requires scope apx.validations:manage; token carries apx.validations:redeem.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

Another merchant's resources, by id:

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000002 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances
Idempotency-Key: hb-ipad-cinema-stamps
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" }, "quantity": 100, "method": "stamp" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances"
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-000000000043 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000043"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: hb-ipad-20260920-cinema
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000002", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-2400",
  "appliedTime": "2026-09-20T19:00:00Z",
  "channel": "merchantApp",
  "appliedBy": "hb-ipad-foh"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Reference unknown",
  "status": 422,
  "detail": "program names no ValidationProgram visible to this credential.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000002/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002/statement"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000002/statements -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002/statements"
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-000000000010 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/statements/e8000000-0000-4000-8000-000000000010"
}
```

And a cinema code, which must not be distinguishable from a code that does not exist:

<!-- apx:request GET /v1/validations/instruments/LC-9F3K-TT8W-2QAZ -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Unknown code",
  "status": 404,
  "detail": "No instrument LC-9F3K-TT8W-2QAZ.",
  "instance": "/v1/validations/instruments/LC-9F3K-TT8W-2QAZ"
}
```

---

## VAL-21 — A BI token, the other garage, and a token with no places

<!-- apx:scenario VAL-21 kind=security ics=APX-CORE-07,APX-CORE-08,APX-VAL-06 -->

**Given** three more tokens. **When** a BI token with only
`apx.data:read` lists programs, lists redemptions, and checks a code;
the operator's manage token (Lakeside grant) enrols the hotel at Harbor
Deck; and a manage token minted without an `apx_places` claim lists
Lakeside's programs. **Then** three 403 `insufficient-scope`, one 403
`insufficient-grant`, and one 403 `insufficient-grant` because a token
without the claim has no places (fail-closed). Then the same Lakeside
token reads, stocks, redeems against, and bills Harbor Deck's hotel
program by id: 403 `insufficient-grant` on each, because the place is
outside the grant (Part 9 §9.3a rule 1) — the contrast with VAL-20,
where a merchant's own-provider scope inside a granted place answers
404 (F-VAL-07).

```http
GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.data:read only>
```

<!-- apx:request GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/validations/programs requires apx.validations:read or apx.validations:redeem; token carries apx.data:read.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request GET /v1/validations/redemptions?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/validations/redemptions requires apx.validations:read or apx.validations:redeem; token carries apx.data:read.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/instruments/HB-P0V3-E7HS-M2QY -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/validations/instruments/{code} requires apx.validations:read or apx.validations:redeem; token carries apx.data:read.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY"
}
```

```http
POST /v1/validations/programs
Authorization: Bearer <apx.validations:manage; apx_places ["b1000000-0000-4000-8000-000000000001"]>
Idempotency-Key: bo-enrol-harbor-hotel-2026-09
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000013", "className": "Organisation" },
  "name": "Harbor Deck Hotel",
  "programStatus": "active",
  "benefit": { "description": "Overnight guests park free", "amount": { "currencyType": "USD", "currencyValue": 28.0 } }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/validations/programs"
}
```

```http
GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001
Authorization: Bearer <apx.validations:manage; no apx_places claim>
```

<!-- apx:request GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/v1/validations/programs"
}
```

The same Lakeside manage token, addressing Harbor Deck's hotel program and its records by id. These are outside the **place** grant, not a narrower ownership scope, so they are 403 `insufficient-grant` (Part 9 §9.3a rule 1), unlike the merchant cases in VAL-20:

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000003/issuances -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000003/issuances"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000003/issuances
Idempotency-Key: bo-hd-hotel-codes
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000003/issuances -->
```json
{ "quantity": 20, "method": "code" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000003/issuances"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: bo-hd-redeem-5501
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000003", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "ticketNumber": "HD-5501",
  "appliedTime": "2026-09-20T21:00:00Z",
  "channel": "api",
  "appliedBy": "backoffice-jlee"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-000000000090 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Redemption e7000000-0000-4000-8000-000000000090 is at place b1000000-0000-4000-8000-000000000002, outside the token's apx_places grant.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000090"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000003/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000003/statement"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000003/statements -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "ValidationProgram e5000000-0000-4000-8000-000000000003 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant (Part 9 §9.3a rule 1).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000003/statements"
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-000000000090 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Statement e8000000-0000-4000-8000-000000000090 is for a program at place b1000000-0000-4000-8000-000000000002, outside the token's apx_places grant.",
  "instance": "/v1/validations/statements/e8000000-0000-4000-8000-000000000090"
}
```


---

## VAL-22 — Ids that were never there

<!-- apx:scenario VAL-22 kind=edge ics=APX-CORE-05 -->

**Given** a console that pastes ids from the wrong environment. **When**
it reads, updates, issues to, lists batches for, previews, closes, and
lists statements for program `…00ff`; reads and reverses redemption
`…00ff`; and reads statement `…00ff`. **Then** every one is 404
`target-not-found`; nothing is created or changed.

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff -->
```json
{
  "id": "e5000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "programStatus": "suspended",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" }
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/issuances
Idempotency-Key: console-ff-issue
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-0000000000ff", "className": "ValidationProgram" }, "quantity": 10, "method": "code" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/issuances"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/issuances -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/issuances"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statement"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statements
Idempotency-Key: console-ff-close
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statements -->
```json
{ "periodStart": "2026-09-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statements"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statements -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationProgram e5000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-0000000000ff/statements"
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationRedemption e7000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-0000000000ff/reverse -->
```json
{ "reason": "wrongTicket" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationRedemption e7000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-0000000000ff/reverse"
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No ValidationStatement e8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/validations/statements/e8000000-0000-4000-8000-0000000000ff"
}
```

---

## VAL-23 — A reconciliation job hammers every route at once

<!-- apx:scenario VAL-23 kind=edge ics=APX-CORE-05 -->

**Given** a new reconciliation job that fans out one request per
resource with no back-off. **When** it crosses the per-credential read
and write limits. **Then** every Validations operation answers 429
`rate-limited` with `Retry-After: 2`; nothing is written. One exchange
per operation, so every declared 429 has an example.

```http
→ 429, Retry-After: 2 on each of the following
```

```http
POST /v1/validations/programs
Idempotency-Key: sweep-enrol
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro — brunch",
  "programStatus": "active",
  "benefit": { "description": "One hour comped", "duration": "PT1H" }
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Idempotency-Key: sweep-issue
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" }, "quantity": 50, "method": "qrCode" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

<!-- apx:request GET /v1/validations/instruments/HB-P0V3-E7HS-M2QY -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: sweep-redeem
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-P0V3-E7HS-M2QY",
  "ticketNumber": "T-2700",
  "appliedTime": "2026-09-28T20:00:00Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/redemptions?program=e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000041"
}
```

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse -->
```json
{ "reason": "wrongTicket" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: sweep-close
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-10-01T00:00:00Z", "periodEnd": "2026-11-01T00:00:00Z" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-000000000009 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Request rate for this credential exceeded 300/min; retry after 2 seconds.",
  "instance": "/v1/validations/statements/e8000000-0000-4000-8000-000000000009"
}
```

---


## VAL-24 — The job's token expires at midnight and nobody notices until morning

<!-- apx:scenario VAL-24 kind=security ics=APX-CORE-06 -->

**Given** the same job, still running on a client-credentials token
that expired at 00:00. **When** it touches every Validations operation.
**Then** every one is 401 with the `unauthenticated` type Part 12 now
registers (F-VAL-01 fixed, with F-CTL-07). The two void routes added
for F-VAL-05 are exercised for 401 in VAL-25.

```http
Authorization: Bearer <expired at 2026-09-28T00:00:00Z> on each of the following
```

```http
POST /v1/validations/programs
Idempotency-Key: sweep-enrol
```

<!-- apx:request POST /v1/validations/programs -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro — brunch",
  "programStatus": "active",
  "benefit": { "description": "One hour comped", "duration": "PT1H" }
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request GET /v1/validations/programs?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /v1/validations/programs/e5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000001",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "provider": { "id": "a2000000-0000-4000-8000-000000000077", "className": "Organisation" },
  "name": "Harbor Bistro",
  "programStatus": "active",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "issuanceMethods": [ "qrCode" ]
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances
Idempotency-Key: sweep-issue
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
```json
{ "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" }, "quantity": 50, "method": "qrCode" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances"
}
```

<!-- apx:request GET /v1/validations/instruments/HB-P0V3-E7HS-M2QY -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY"
}
```

```http
POST /v1/validations/redemptions
Idempotency-Key: sweep-redeem
```

<!-- apx:request POST /v1/validations/redemptions -->
```json
{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-P0V3-E7HS-M2QY",
  "ticketNumber": "T-2700",
  "appliedTime": "2026-09-28T20:00:00Z",
  "channel": "payStation",
  "appliedBy": "paystation-c1000000-0003"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/redemptions?program=e5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/redemptions"
}
```

<!-- apx:request GET /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000041"
}
```

<!-- apx:request POST /v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse -->
```json
{ "reason": "wrongTicket" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/redemptions/e7000000-0000-4000-8000-000000000041/reverse"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement"
}
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements
Idempotency-Key: sweep-close
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
```json
{ "periodStart": "2026-10-01T00:00:00Z", "periodEnd": "2026-11-01T00:00:00Z" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

<!-- apx:request GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements"
}
```

<!-- apx:request GET /v1/validations/statements/e8000000-0000-4000-8000-000000000009 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/statements/e8000000-0000-4000-8000-000000000009"
}
```

## VAL-25 — The stolen sheet: void a batch, then one leaked code

<!-- apx:scenario VAL-25 kind=lifecycle ics=APX-VAL-03,APX-VAL-06 -->

**Given** at 19:30 on 12 September a server at Harbor Bistro reports the
second sheet of the evening (`e6…0005`, 50 QR codes, two already
redeemed) stolen from the host stand, and a photo of one code from
sheet 3 (`HB-L3AK-ED01-QR7Z`) turns up on social media. **When** the
bistro's iPad voids the batch, its retry voids it again, the back office
voids the leaked code, tries to void the code already redeemed on
T-2210 and one that was never issued, the iPad tries to void the
cinema's stamp roll, two scripts send voids with no reason, a BI token
tries both routes, and an expired token and a flooding job hit them.
**Then** 200 `void` with `voidDetail.voidedCount: 48` (the two redeemed
codes stand); 200 unchanged; 200 on the single code; 422
`instrument-invalid` for the redeemed one; 404 for the unknown code and
for another provider's batch (§20.5); 400 `invalid-request` twice; 403
`insufficient-scope` twice; 401 twice; 429 twice. VAL-12 then shows a
code from the voided sheet refused at the pay station (F-VAL-05 fixed).

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000005/void
Authorization: Bearer <apx.validations:redeem; apx_org a2…0077>
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000005/void -->
```json
{ "reason": "stolen", "note": "Sheet 2 taken from the host stand around 19:15." }
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000005",
  "version": 2,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "quantity": 50,
  "method": "qrCode",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "issuedTo": "front-of-house",
  "issuanceStatus": "void",
  "voidDetail": { "reason": "stolen", "note": "Sheet 2 taken from the host stand around 19:15.", "time": "2026-09-12T19:40:00Z", "actor": "hb-ipad-foh", "voidedCount": 48 }
}
```

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000005/void -->
```json
{ "reason": "stolen" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000005",
  "version": 2,
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "quantity": 50,
  "method": "qrCode",
  "issuanceStatus": "void",
  "voidDetail": { "reason": "stolen", "time": "2026-09-12T19:40:00Z", "actor": "hb-ipad-foh", "voidedCount": 48 }
}
```

The leaked code, voided on its own by the back office:

<!-- apx:request POST /v1/validations/instruments/HB-L3AK-ED01-QR7Z/void -->
```json
{ "reason": "leaked", "note": "posted publicly 2026-09-12 20:05" }
```

<!-- apx:response 200 -->
```json
{
  "code": "HB-L3AK-ED01-QR7Z",
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "issuance": { "id": "e6000000-0000-4000-8000-000000000003", "className": "ValidationIssuance" },
  "instrumentStatus": "void",
  "validFrom": "2026-09-12T17:00:00Z",
  "validTo": "2026-09-13T17:00:00Z",
  "benefit": { "description": "First two hours comped", "duration": "PT2H" },
  "voidDetail": { "reason": "leaked", "note": "posted publicly 2026-09-12 20:05", "time": "2026-09-12T20:10:00Z", "actor": "backoffice-jlee" }
}
```

<!-- apx:request POST /v1/validations/instruments/HB-7Q2M-K9X4-3TPD/void -->
```json
{ "reason": "leaked" }
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/instrument-invalid",
  "title": "Instrument already redeemed",
  "status": 422,
  "detail": "Code HB-7Q2M-K9X4-3TPD was redeemed by e7000000-0000-4000-8000-000000000041; reverse that redemption first.",
  "instance": "/v1/validations/instruments/HB-7Q2M-K9X4-3TPD/void"
}
```

<!-- apx:request POST /v1/validations/instruments/HB-ZZZZ-ZZZZ-ZZZZ/void -->
```json
{ "reason": "leaked" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Unknown code",
  "status": 404,
  "detail": "No instrument HB-ZZZZ-ZZZZ-ZZZZ.",
  "instance": "/v1/validations/instruments/HB-ZZZZ-ZZZZ-ZZZZ/void"
}
```

The bistro's iPad, on the cinema's stamp roll:

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances/e6000000-0000-4000-8000-000000000004/void -->
```json
{ "reason": "misprint" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No such resource visible to this credential (Part 9 §9.3a rule 2).",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000002/issuances/e6000000-0000-4000-8000-000000000004/void"
}
```

Two scripts that forgot the reason:

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void invalid -->
```json
{ "note": "void it" }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

<!-- apx:request POST /v1/validations/instruments/HB-P0V3-E7HS-M2QY/void invalid -->
```json
{}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request body",
  "status": 400,
  "detail": "reason is required.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY/void",
  "errors": [ { "pointer": "/reason", "detail": "required" } ]
}
```

A BI token (`apx.validations:read` only):

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void -->
```json
{ "reason": "misprint" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST …/issuances/{issuanceId}/void requires apx.validations:manage or apx.validations:redeem; token carries apx.validations:read.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void"
}
```

<!-- apx:request POST /v1/validations/instruments/HB-P0V3-E7HS-M2QY/void -->
```json
{ "reason": "leaked" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/validations/instruments/{code}/void requires apx.validations:manage or apx.validations:redeem; token carries apx.validations:read.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY/void"
}
```

An expired token:

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void -->
```json
{ "reason": "misprint" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Unauthenticated",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void"
}
```

<!-- apx:request POST /v1/validations/instruments/HB-P0V3-E7HS-M2QY/void -->
```json
{ "reason": "leaked" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Unauthenticated",
  "status": 401,
  "detail": "Access token expired at 2026-09-28T00:00:00Z.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY/void"
}
```

A job voiding codes in a tight loop:

<!-- apx:request POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void -->
```json
{ "reason": "programEnded" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 60/min; retry after 2 seconds.",
  "instance": "/v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances/e6000000-0000-4000-8000-000000000003/void"
}
```

<!-- apx:request POST /v1/validations/instruments/HB-P0V3-E7HS-M2QY/void -->
```json
{ "reason": "programEnded" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Rate for this credential exceeded 60/min; retry after 2 seconds.",
  "instance": "/v1/validations/instruments/HB-P0V3-E7HS-M2QY/void"
}
```

---
