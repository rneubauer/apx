# Scenario 32 — Payment detail: the fee, the rate sold, and the revenue report

**The story.** Lakeside Garage sells an "Evening Flat Rate" of $12.00
through its online booking channel, which adds a $0.75 convenience fee to
every transaction. The operator's revenue report has to split parking
revenue from fees, group sales by rate, and check each sale against the
published deck. With only a total on each payment, the report would see
$12.75 and nothing else. This evening one booking goes through, one is sent
with lines that don't add up and is refused, the first booking's fee is
refunded, and a validated stay in the garage settles with a merchant
validation covering most of the price.

**Actors.** The online booking channel (`apx.payments:write`); the
operator's revenue platform (`apx.accounts:read`, plus a Part 8
subscription to `apx.accounts.payment.recorded.v1`) → Lakeside APX server,
which also persists native APDS `Payment`s (Annex A APX-ACC-07).

**Rules exercised.** Part 13 §13.6 (materialization) and §13.6a (payment
detail); registry `apx-payment-line-codes` (Part 11); Annex A APX-ACC-07
and APX-ACC-09.

## Step 1 — 17:52: the booking channel takes a payment, itemized

The channel sends the total in `amount` and the itemization in the
`apds-ext:apx:payment-detail@1.0` decoration (Part 13 §13.6a): the price
and the fee as APDS `PaymentLine`s, each line's code in `idCode` from the
`apx-payment-line-codes` registry, and the rate it sold, named as the
seller names it.

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
        "id": "evening-flat",
        "name": "Evening Flat Rate",
        "rateTable": { "id": "c1000000-0000-4000-8000-000000000031", "version": 4, "className": "RateTable" },
        "product": "standard",
        "class": "standard"
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

Both lines are `paymentType: payment` (only a `validation` line is
`paymentType: validation`, §13.6a(1)), and they sum to `amount`
($12.00 + $0.75 = $12.75), so the server takes the payment and returns the
record with the decoration unchanged:

<!-- apx:validate PaymentRecord -->
<!-- apx:validate PaymentDetail at /extensions/apds-ext:apx:payment-detail@1.0 -->
```json
{
  "id": "6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d",
  "version": 1,
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
        "id": "evening-flat",
        "name": "Evening Flat Rate",
        "rateTable": { "id": "c1000000-0000-4000-8000-000000000031", "version": 4, "className": "RateTable" },
        "product": "standard",
        "class": "standard"
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
`GET /v1/payments` (§13.6a(5)). Because the server persists APDS
Payments, it also materializes this record as a native `Payment` whose
`paymentLines` are these two lines, with the same `id`s, and whose
decoration carries `rateSold` only (§13.6; Step 4 shows the shape).

## Step 2 — 18:10: lines that don't add up

A second booking arrives with a total of $12.75 but lines of $12.00 and
$1.25: the channel's fee table and its checkout disagree. Charging it
would leave a record whose parts and total tell different stories, so the
server refuses it before the payment layer is asked. Nothing is charged
and no PaymentRecord is created (§13.6a(3)):

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
  "detail": "The paymentType payment lines of apds-ext:apx:payment-detail@1.0 sum to 13.25 USD; amount is 12.75 USD.",
  "instance": "/v1/payments"
}
```

The channel fixes its fee table and resends with a new Idempotency-Key.

## Step 3 — 19:05: the fee is refunded, the lines are not rewritten

The first customer complains that the app charged a fee the garage's
website said it would waive. Customer service refunds the $0.75:

```http
POST /v1/payments/6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d/refund HTTP/1.1
Idempotency-Key: 0c4e2a7d-31b9-4f58-a6e2-7d9b1c3e5f10
Content-Type: application/json
```

<!-- apx:request POST /v1/payments/6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d/refund -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 0.75 },
  "reason": "convenience fee waived"
}
```

The record stays `approved` with `refundedAmount` showing what was given
back (§13.1a). The lines still describe the sale as it was made; the
refund does not rewrite or remove the fee line (§13.6a(5)):

<!-- apx:validate PaymentRecord -->
```json
{
  "id": "6a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d",
  "version": 2,
  "transactionID": "WEB-20261012-00418",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-10-12T17:52:06Z",
  "amount": { "currencyType": "USD", "currencyValue": 12.75 },
  "refundedAmount": { "currencyType": "USD", "currencyValue": 0.75 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "online",
  "paymentStatus": "approved",
  "ticketNumber": "R-40712",
  "extensions": {
    "apds-ext:apx:payment-detail@1.0": {
      "rateSold": {
        "id": "evening-flat",
        "name": "Evening Flat Rate",
        "rateTable": { "id": "c1000000-0000-4000-8000-000000000031", "version": 4, "className": "RateTable" },
        "product": "standard",
        "class": "standard"
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

The recorded event is re-published with this state (§13.4), so the
revenue platform nets the refund against the fee line itself.

## Step 4 — 21:30: a validated stay, as plain APDS sees it

A diner parks for three hours at the $18.00 daily rate. The restaurant's
validation (Part 20) covers $15.00 and the driver pays $3.00 at the pay
station. The pay station's PaymentRecord has `amount` $3.00 and two lines:
`base` $3.00 (`paymentType: payment`, the part paid in money) and
`validation` $15.00 (`paymentType: validation`, the value the validation
offset, outside the sum). The `payment` lines sum to $3.00 = `amount`.

The server materializes the captured record as a native `Payment` on the
stay's AssignedRight (§13.6). Its own `paymentLines` are the
itemization, the record's lines unchanged; the `validation` line keeps
the registry code in `idCode` and carries the validation's identifier in
`identifierId`. The decoration on the native Payment carries `rateSold`
only, never `lines`, so the itemization is stored once (§13.6a(4)):

<!-- apx:validate Payment -->
<!-- apx:validate PaymentDetail at /extensions/apds-ext:apx:payment-detail@1.0 -->
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
    { "id": "e1000000-0000-4000-8000-000000000202", "version": 1, "paymentType": "validation", "idCode": "validation",
      "identifierId": "VAL-DINE3H-88172",
      "value": { "currencyType": "USD", "currencyValue": 15.00 } }
  ],
  "extensions": {
    "apds-ext:apx:payment-detail@1.0": {
      "rateSold": { "id": "daily", "name": "Daily Rate", "product": "standard", "class": "validation" }
    }
  }
}
```

A plain APDS consumer sees $3.00 collected and $15.00 validated, and
ignores the extension; the data overlay declares `extensions` on
`Payment` so the decoration validates there (APX erratum 010).

## Step 5 — The revenue report

The revenue platform now has what it needs without a side channel:

| Rate sold | Parking (`base`) | Fees (`convenienceFee`) | Validated | Collected | Refunded |
|---|---|---|---|---|---|
| `evening-flat` | $12.00 | $0.75 | — | $12.75 | $0.75 |
| `daily` | $3.00 | — | $15.00 | $3.00 | — |

The evening sale also names the `rateTable` it was priced from (version
4), so the price check compares $12.00 with that table's rate and finds
them equal. A payment without the decoration still counts in "Collected",
and the report shows its split as unknown rather than as a zero fee: an
absent line is never read as a zero-value one (§13.6a(6)).
