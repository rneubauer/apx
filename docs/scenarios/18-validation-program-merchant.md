# Scenario 18 — Validation program: enrol a restaurant, issue codes, redeem at the pay station, close the month

**The story.** Harbor Bistro, on the ground floor of Lakeside Garage,
wants to validate two hours for its dinner guests. The operator enrols
the restaurant, the restaurant prints QR codes from its own iPad, a guest
scans one at the pay station, a second guest's code is refused because
the ticket already carries a validation, and at month end the operator
closes the period into a statement that bills the restaurant.

**Actors.** Operator back office (`apx.validations:manage`); Harbor
Bistro's app (`apx.validations:redeem`, `apx_org` = the restaurant —
confined to its own program, §20.5); the operator's pay station
(`apx.validations:manage`, since an operator device redeems for every
merchant at the place and the merchant-confined scope cannot) → Lakeside
Garage APX server.

## Step 1 — The operator enrols the program

```http
POST /v1/validations/programs HTTP/1.1
Idempotency-Key: bo-enrol-harbor-bistro-2026-09
Content-Type: application/json

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

<!-- apx:validate ValidationProgram -->
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

From this moment `GET /v1/validations/providers?place=b1000000-…-0001`
(Part 6) lists Harbor Bistro with `program` pointing here — the call
center's provider lookup and the merchant program are one thing.

## Step 2 — The restaurant issues its own codes

Harbor Bistro's iPad, on the merchant scope, prints a sheet of 50 QR
codes. The codes come back **once**:

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/issuances HTTP/1.1
Idempotency-Key: hb-ipad-2026-09-12-sheet-3
Content-Type: application/json

{ "quantity": 50, "method": "qrCode", "issuedTo": "front-of-house" }
```

<!-- apx:validate ValidationIssuance -->
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

(Abridged to three codes.) `validTo` came from the program's one-day
`validityWindow`. A retry with the same key returns the same issuance
without the codes.

## Step 3 — A guest scans a code at the pay station

The pay station reads the QR and asks whether it is good before applying:

```http
GET /v1/validations/instruments/HB-7Q2M-K9X4-3TPD HTTP/1.1
```

<!-- apx:validate ValidationInstrument -->
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

It shows "Harbor Bistro — 2 hours" and applies it to the guest's ticket:

```http
POST /v1/validations/redemptions HTTP/1.1
Idempotency-Key: ps-b2000000-0007-20260912-213305
Content-Type: application/json

{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-7Q2M-K9X4-3TPD",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:05Z",
  "channel": "payStation",
  "appliedBy": "paystation-b2000000-0007"
}
```

<!-- apx:validate ValidationRedemption -->
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
  "appliedBy": "paystation-b2000000-0007",
  "validationId": "VAL-20260912-000318",
  "amountReduced": { "currencyType": "USD", "currencyValue": 6.0 },
  "durationComped": "PT2H",
  "redemptionStatus": "applied",
  "statusHistory": [
    { "state": "applied", "time": "2026-09-12T21:33:05Z", "actor": "paystation-b2000000-0007", "detail": "T-2210 amount due 9.00 → 3.00" }
  ]
}
```

Two hours at the evening rate were worth $6.00 — `amountReduced` is
what actually came off the ticket, not the nominal benefit. The APDS
Session now carries `validationId: VAL-20260912-000318` on its segment
and a Payment of type `validation`, so an APDS-only consumer sees it too.
`apx.validations.redeemed.v1` fires.

## Step 4 — A second code on the same ticket: refused

The guest's companion tries a second code on the same ticket:

```http
POST /v1/validations/redemptions HTTP/1.1
Idempotency-Key: ps-b2000000-0007-20260912-213348
Content-Type: application/json

{
  "program": { "id": "e5000000-0000-4000-8000-000000000001", "className": "ValidationProgram" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "instrumentCode": "HB-A1C8-ZR5N-W6LJ",
  "ticketNumber": "T-2210",
  "session": { "id": "f1000000-0000-4000-8000-000000000210", "className": "Session" },
  "appliedTime": "2026-09-12T21:33:48Z",
  "channel": "payStation",
  "appliedBy": "paystation-b2000000-0007"
}
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/redemption-limit-exceeded",
  "title": "Redemption limit exceeded",
  "status": 422,
  "detail": "Program rule maxPerTicket=1: ticket T-2210 already carries redemption e7000000-…-0041.",
  "instance": "/v1/validations/redemptions"
}
```

The code stays `valid` for another ticket. The rule set is closed and
evaluated the same way by every implementation — the restaurant knows
exactly what it is paying for.

## Step 5 — Month end: close the period

The back office previews September, then closes it:

```http
GET /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statement?from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z HTTP/1.1
```

```http
POST /v1/validations/programs/e5000000-0000-4000-8000-000000000001/statements HTTP/1.1
Idempotency-Key: bo-close-harbor-bistro-2026-09
Content-Type: application/json

{ "periodStart": "2026-09-01T00:00:00Z", "periodEnd": "2026-10-01T00:00:00Z" }
```

<!-- apx:validate ValidationStatement -->
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
  "closedBy": "backoffice-jlee"
}
```

(Lines abridged.) 412 redemptions at the $4.00 unit price: the
restaurant is invoiced $1,648.00 from this statement's `id`; the $2,418
of parking actually comped is the operator's number for the P&L. The
statement is now immutable — a reversal on any of these redemptions from
here on is refused with 409 `statement-closed` and lands instead as a
credit line on October's statement. `apx.validations.statement.closed.v1`
tells the accounting integration the invoice can go out.
