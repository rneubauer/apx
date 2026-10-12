# Scenario 32 — Payment detail: the fee, the rate sold, and the revenue report

**The story.** Lakeside Garage sells an "Evening Flat Rate" of $12.00
through its online booking channel, which adds a $0.75 convenience fee to
every transaction. The operator's revenue report has to split parking
revenue from fees, group sales by rate, and check each sale against the
published deck. With only a total on each payment, the report would see
$12.75 and nothing else. This evening one booking goes through, one is sent
with lines that don't add up and is refused, and a validated stay in the
garage settles with a merchant validation covering most of the price.

**Actors.** The online booking channel (`apx.payments:write`); the
operator's revenue platform (`apx.accounts:read`, plus a Part 8
subscription to `apx.accounts.payment.recorded.v1`) → Lakeside APX server.

## Step 1 — 17:52: the booking channel takes a payment, itemized

The channel sends the total in `amount` and the itemization in the
`apds-ext:apx:payment-detail@1.0` decoration (Part 13 §13.6a): the price
and the fee as APDS `PaymentLine`s, coded from the
`apx-payment-line-codes` registry, and the rate it sold.

```http
POST /v1/payments HTTP/1.1
Host: api.lakeside-garage.example
Idempotency-Key: 5d1c7a40-6b0e-4f8a-9d2e-1a3b5c7d9e01
Content-Type: application/json
```

<!-- apx:request POST /v1/payments -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "R-40712",
  "amount": { "currencyType": "USD", "currencyValue": 12.75 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "online",
  "extensions": {
    "apds-ext:apx:payment-detail@1.0": {
      "rateSold": {
        "code": "evening-flat",
        "name": "Evening Flat Rate",
        "rateTable": { "id": "c1000000-0000-4000-8000-000000000031", "version": 4, "className": "RateTable" },
        "rightType": "oneTimeUseParking",
        "priceClass": "standard"
      },
      "lines": [
        { "id": "e1000000-0000-4000-8000-000000000101", "version": 1, "paymentType": "payment", "idCode": "base",
          "value": { "currencyType": "USD", "currencyValue": 12.00 } },
        { "id": "e1000000-0000-4000-8000-000000000102", "version": 1, "paymentType": "payment", "idCode": "convenienceFee",
          "value": { "currencyType": "USD", "currencyValue": 0.75 } }
      ]
    }
  }
}
```

The two `payment` lines sum to `amount` ($12.00 + $0.75 = $12.75), so the
server takes the payment and returns the record with the decoration
unchanged:

<!-- apx:validate PaymentRecord -->
<!-- apx:validate PaymentDetail at /extensions/apds-ext:apx:payment-detail@1.0 -->
```json
{
  "id": "6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d",
  "transactionID": "WEB-20261012-00418",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-10-12T17:52:06Z",
  "amount": { "currencyType": "USD", "currencyValue": 12.75 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "online",
  "paymentStatus": "approved",
  "ticketNumber": "R-40712",
  "extensions": {
    "apds-ext:apx:payment-detail@1.0": {
      "rateSold": {
        "code": "evening-flat",
        "name": "Evening Flat Rate",
        "rateTable": { "id": "c1000000-0000-4000-8000-000000000031", "version": 4, "className": "RateTable" },
        "rightType": "oneTimeUseParking",
        "priceClass": "standard"
      },
      "lines": [
        { "id": "e1000000-0000-4000-8000-000000000101", "version": 1, "paymentType": "payment", "idCode": "base",
          "value": { "currencyType": "USD", "currencyValue": 12.00 } },
        { "id": "e1000000-0000-4000-8000-000000000102", "version": 1, "paymentType": "payment", "idCode": "convenienceFee",
          "value": { "currencyType": "USD", "currencyValue": 0.75 } }
      ]
    }
  }
}
```

The same record, decoration included, is what the revenue platform
receives on `apx.accounts.payment.recorded.v1` and finds in
`GET /v1/payments`.

## Step 2 — 18:10: lines that don't add up

A second booking arrives with a total of $12.75 but lines of $12.00 and
$1.25: the channel's fee table and its checkout disagree. Charging it
would leave a record whose parts and total tell different stories, so the
server refuses it before anything is charged:

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request unprocessable",
  "status": 422,
  "detail": "The payment lines of apds-ext:apx:payment-detail@1.0 sum to 13.25 USD; amount is 12.75 USD.",
  "instance": "/v1/payments"
}
```

## Step 3 — 21:30: a validated stay, as plain APDS sees it

A diner parks for three hours at the $18.00 daily rate. The restaurant's
validation covers $15.00 and the driver pays $3.00 at the pay station. The
server persists APDS `Payment`s, so it materializes the captured
PaymentRecord as a native `Payment` on the stay's AssignedRight (Part 13
§13.6). Its own `paymentLines` are the itemization: the $3.00 collected as
a `payment` line coded `base`, and the $15.00 offset as a `validation`
line, whose `idCode` stays the validation program's own code. The
decoration on the native Payment carries `rateSold` only, never `lines`:

<!-- apx:validate Payment -->
<!-- apx:validate RateSold at /extensions/apds-ext:apx:payment-detail@1.0/rateSold -->
```json
{
  "id": "6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c77",
  "version": 1,
  "dateCollected": "2026-10-12T21:30:44Z",
  "serviceProvider": { "id": "a1000000-0000-4000-8000-000000000009", "version": 1, "className": "Organisation" },
  "transactionID": "PS-20261012-02215",
  "paymentLines": [
    { "id": "e1000000-0000-4000-8000-000000000201", "version": 1, "paymentType": "payment", "idCode": "base",
      "value": { "currencyType": "USD", "currencyValue": 3.00 } },
    { "id": "e1000000-0000-4000-8000-000000000202", "version": 1, "paymentType": "validation", "idCode": "DINE-3H",
      "value": { "currencyType": "USD", "currencyValue": 15.00 } }
  ],
  "extensions": {
    "apds-ext:apx:payment-detail@1.0": {
      "rateSold": { "code": "daily", "name": "Daily Rate", "priceClass": "validated" }
    }
  }
}
```

`rightType` is omitted because the Payment sits inside an AssignedRight,
whose RightSpecification already says what was bought. A plain APDS
consumer sees $3.00 collected and $15.00 validated, and ignores the
extension.

## Step 4 — The revenue report

The revenue platform now has what it needs without a side channel:

| Rate sold | Parking (`base`) | Fees (`convenienceFee`) | Validated | Collected |
|---|---|---|---|---|
| `evening-flat` | $12.00 | $0.75 | — | $12.75 |
| `daily` | $3.00 | — | $15.00 | $3.00 |

The evening sale also names the `rateTable` it was priced from (version
4), so the price check compares $12.00 with that table's rate and finds
them equal. A payment without the decoration still counts in "Collected",
and the report shows its split as unknown rather than as a zero fee
(Part 13 §13.6a(5)).
