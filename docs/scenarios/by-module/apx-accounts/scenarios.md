# apx-accounts — vetting scenarios

<!-- apx:module apx-accounts tag=Accounts ics=ACC,PHX -->

Covers the two optional classes `apx-accounts` (Part 13 §13.1,
§13.1a, §13.4, §13.5) and `apx-payment-history` (§13.2, Part 9 §9.6).
Every exchange below is validated against the public bundle by
`npm run vetting -- apx-accounts`. Gaps the spec cannot express are marked
`gap=F-ACC-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`); Harbor Deck (`b1…0002`) is a
different operator's garage the token has no grant for. The operator
organisation is `a1…0001`. J. Smith (RightHolder `c1…0003`) is a monthly
parker at Lakeside on account `c2…0004` (plate `SYN-1234`, access card
`MP-00417`, phone `+15550104567`, $185.00 owing, as in public scenario
08); J. Smith also holds account `c2…0006` at Harbor Deck under the same
plate. Smithfield Couriers LLC (`c2…0005`) is a fleet account at Lakeside
with plates `SYN-7788` and `SYN-7789`, $240.00 overdue and disabled.
Ticket `T-61077` (session `c4…0022`, resolution context `e5…0012`,
correlation `8d2b…6c80`) is the transient parker whose card was declined
at exit lane 2 in public scenario 10; ticket `T-1001` is the lost-ticket
parker from scenario 04. Payments are `e8…02NN`, payment links `e6…03NN`,
events `e9…04NN`. The AR system is PARIS.

Every request carries `Authorization: Bearer …` with scopes
`apx.accounts:read apx.payments:write` and
`apx_places: ["b1000000-0000-4000-8000-000000000001"]` unless the
scenario says otherwise. Requests that create resources send the create
shape; `id`, `version`, `transactionID`, `dateCollected`,
`paymentStatus`, and `status` are server-assigned. All times are UTC on
the evening of 2026-09-24.

---

## ACC-01 — A monthly parker calls in: lookup by phone

<!-- apx:scenario ACC-01 kind=happy ics=APX-ACC-01 -->

**Given** J. Smith calls the operator's number from the phone on file.
**When** the console looks the caller up by phone before the agent
answers. **Then** 200 with one account, its balance and status, and the
place it is valid at, so the greeting can be "Hi J., I see $185 owing at
Lakeside".

<!-- apx:request GET /v1/accounts?phone=%2B15550104567 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790284800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
      "name": "J. Smith",
      "phone": "+15550104567",
      "cardNumber": "MP-00417",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

---

## ACC-02 — Every other key: plate, card, name, a combination, by id, and the ones that are not there

<!-- apx:scenario ACC-02 kind=happy ics=APX-ACC-01 -->

**Given** callers who know only their plate, only their access card, or
only their name. **When** the console tries each filter, then narrows a
common surname with a plate, then fetches by id. **Then** each lookup
returns the matching accounts, an unknown plate returns an empty list,
and an unknown id is 404. The `email` key and the §13.5(3) `place`
narrowing are declared (F-ACC-09, F-ACC-08 fixed), and `Account.email`
comes back under `apx.accounts:read`.

<!-- apx:request GET /v1/accounts?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
      "name": "J. Smith",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

<!-- apx:request GET /v1/accounts?card=MP-00417 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "cardNumber": "MP-00417",
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

<!-- apx:request GET /v1/accounts?name=Smith&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790284800, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    },
    {
      "id": "c2000000-0000-4000-8000-000000000005",
      "version": 12,
      "name": "Smithfield Couriers LLC",
      "plates": ["SYN-7788", "SYN-7789"],
      "balance": { "currencyType": "USD", "currencyValue": 240.00 },
      "accountStatus": "disabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

<!-- apx:request GET /v1/accounts?name=Smith&plate=SYN-7788 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000005",
      "version": 12,
      "holder": { "id": "c1000000-0000-4000-8000-000000000005", "className": "RightHolder" },
      "name": "Smithfield Couriers LLC",
      "phone": "+15550109900",
      "cardNumber": "MP-00522",
      "plates": ["SYN-7788", "SYN-7789"],
      "balance": { "currencyType": "USD", "currencyValue": 240.00 },
      "accountStatus": "disabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "id": "c2000000-0000-4000-8000-000000000004",
  "version": 7,
  "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
  "name": "J. Smith",
  "phone": "+15550104567",
  "cardNumber": "MP-00417",
  "plates": ["SYN-1234"],
  "balance": { "currencyType": "USD", "currencyValue": 185.00 },
  "accountStatus": "enabled",
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "recordInfo": { "creationTime": "2024-02-01T09:00:00Z", "lastUpdate": "2026-09-01T00:05:00Z", "lastUpdateUser": "paris-nightly" }
}
```

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No account c2000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/accounts/c2000000-0000-4000-8000-0000000000ff"
}
```

A transient parker with no account:

<!-- apx:request GET /v1/accounts?plate=SYN-9999 -->
<!-- apx:response 200 -->
```json
{ "data": [] }
```

The caller only remembers the e-mail they signed up with:

<!-- apx:request GET /v1/accounts?email=j.smith%40example.com -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "email": "j.smith@example.com",
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

An aggregator token granted forty garages narrows "Smith" to Lakeside with
the §13.5(3) `place` parameter:

<!-- apx:request GET /v1/accounts?name=Smith&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    },
    {
      "id": "c2000000-0000-4000-8000-000000000005",
      "version": 12,
      "name": "Smithfield Couriers LLC",
      "balance": { "currencyType": "USD", "currencyValue": 240.00 },
      "accountStatus": "disabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

---

## ACC-03 — The grant, not the scope, bounds a place-less lookup

<!-- apx:scenario ACC-03 kind=security ics=APX-ACC-01,APX-CORE-07,APX-CORE-08 -->

**Given** J. Smith holds accounts at both Lakeside and Harbor Deck under
the same plate. **When** a token granted only Lakeside searches the plate,
an all-places token searches it, and a token with no `apx_places` claim
searches it. **Then** the first sees only the Lakeside account, the second
sees both, and the third sees nothing (fail-closed; whether that is an
empty 200 or a 403 is F-ACC-13). Fetching the Harbor account by id with
the Lakeside token is 403 `insufficient-grant`, which the operation does
not declare (F-ACC-02).

```http
GET /v1/accounts?plate=SYN-1234
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/accounts?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    }
  ]
}
```

```http
GET /v1/accounts?plate=SYN-1234
Authorization: Bearer <apx_places: ["*"]>
```

<!-- apx:request GET /v1/accounts?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "c2000000-0000-4000-8000-000000000004",
      "version": 7,
      "name": "J. Smith",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 185.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ]
    },
    {
      "id": "c2000000-0000-4000-8000-000000000006",
      "version": 3,
      "name": "J. Smith",
      "plates": ["SYN-1234"],
      "balance": { "currencyType": "USD", "currencyValue": 0.00 },
      "accountStatus": "enabled",
      "places": [ { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" } ]
    }
  ]
}
```

```http
GET /v1/accounts?plate=SYN-1234
Authorization: Bearer <no apx_places claim at all>
```

<!-- apx:request GET /v1/accounts?plate=SYN-1234 -->
<!-- apx:response 200 -->
```json
{ "data": [] }
```

```http
GET /v1/accounts/c2000000-0000-4000-8000-000000000006
Authorization: Bearer <apx_places: ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-000000000006 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Account c2000000-0000-4000-8000-000000000006 is valid only at place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/accounts/c2000000-0000-4000-8000-000000000006"
}
```

---

## ACC-04 — The wrong scope on every route

<!-- apx:scenario ACC-04 kind=refusal ics=APX-CORE-07 -->

**Given** a payments-only token (`apx.payments:write`) and a read-only
token (`apx.accounts:read`). **When** the payments token reads accounts
and payment history, and the read token takes a payment and voids one.
**Then** each is 403 `insufficient-scope`; nothing is read or moved.

```http
GET /v1/accounts?phone=%2B15550104567
Authorization: Bearer <apx.payments:write only>
```

<!-- apx:request GET /v1/accounts?phone=%2B15550104567 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/accounts requires scope apx.accounts:read; token carries apx.payments:write.",
  "instance": "/v1/accounts"
}
```

<!-- apx:request GET /v1/payments?ticketLast4=1077 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/payments requires scope apx.accounts:read; token carries apx.payments:write.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
Authorization: Bearer <apx.accounts:read only>
Idempotency-Key: ro-8001-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/payments requires scope apx.payments:write; token carries apx.accounts:read.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000205/void
Authorization: Bearer <apx.accounts:read only>
Idempotency-Key: ro-8002-void
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/void -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/payments/{id}/void requires scope apx.payments:write; token carries apx.accounts:read.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/void"
}
```

---

## ACC-05 — Pay the balance over the IVR; the balance drops; the event lands

<!-- apx:scenario ACC-05 kind=happy ics=APX-ACC-02,APX-ACC-03 -->

**Given** J. Smith agrees to pay the $185.00 and is transferred to the
PCI-compliant IVR, which captures the card out of band. **When** the
console records the payment with `channel: autoAttendant` and an
idempotency key. **Then** 201 with a PaymentRecord bound to Lakeside,
carrying a `transactionID` and only the last four digits; the account
re-read shows a zero balance and a bumped version; and
`apx.accounts.payment.recorded.v1` is published with the record as
`data`.

```http
POST /v1/payments
Idempotency-Key: cc-8101-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000201",
  "transactionID": "PARIS-20260924-01188",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T21:16:40Z",
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant",
  "paymentStatus": "approved",
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "cardLast4": "8812"
}
```

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "id": "c2000000-0000-4000-8000-000000000004",
  "version": 8,
  "holder": { "id": "c1000000-0000-4000-8000-000000000003", "className": "RightHolder" },
  "name": "J. Smith",
  "phone": "+15550104567",
  "cardNumber": "MP-00417",
  "plates": ["SYN-1234"],
  "balance": { "currencyType": "USD", "currencyValue": 0.00 },
  "accountStatus": "enabled",
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "recordInfo": { "creationTime": "2024-02-01T09:00:00Z", "lastUpdate": "2026-09-24T21:16:40Z", "lastUpdateUser": "apx-payments" }
}
```

The event, as delivered to the operator's finance subscription:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000401",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000201", "className": "PaymentRecord" },
  "time": "2026-09-24T21:16:41Z",
  "data": {
    "id": "e8000000-0000-4000-8000-000000000201",
    "transactionID": "PARIS-20260924-01188",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "dateCollected": "2026-09-24T21:16:40Z",
    "amount": { "currencyType": "USD", "currencyValue": 185.00 },
    "meansOfPayment": "paymentCreditCard",
    "channel": "autoAttendant",
    "paymentStatus": "approved",
    "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
    "cardLast4": "8812"
  }
}
```

---

## ACC-06 — The IVR bridge retries: same key, same body

<!-- apx:scenario ACC-06 kind=edge ics=APX-ACC-02 -->

**Given** the 201 from ACC-05 was lost between the IVR bridge and the
console. **When** the bridge retries with the identical key and body.
**Then** 200 with the ORIGINAL record; J. Smith is not charged twice and
the balance stays at zero.

```http
POST /v1/payments
Idempotency-Key: cc-8101-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000201",
  "transactionID": "PARIS-20260924-01188",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T21:16:40Z",
  "amount": { "currencyType": "USD", "currencyValue": 185.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant",
  "paymentStatus": "approved",
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "cardLast4": "8812"
}
```

---

## ACC-07 — Same key with a different amount; no key; nothing to settle

<!-- apx:scenario ACC-07 kind=refusal ics=APX-ACC-02,APX-CORE-05 -->

**Given** three broken clients. **When** one reuses `cc-8101-pay` for a
different amount, one omits `Idempotency-Key`, and one sends a place and
an amount with neither `account` nor `ticketNumber`. **Then** 409
`idempotency-conflict`, 400 `idempotency-key-required`, and a 400 the
operation describes ("no account/ticket to settle") but Part 12 has no
slug for (F-ACC-03).

```http
POST /v1/payments
Idempotency-Key: cc-8101-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 85.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key cc-8101-pay was first used at 2026-09-24T21:16:40Z for a 185.00 USD payment on account c2000000-0000-4000-8000-000000000004.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61077",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "meansOfPayment": "paymentCreditCard"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/payments is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
Idempotency-Key: cc-8102-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "meansOfPayment": "paymentCreditCard"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Nothing to settle",
  "status": 400,
  "detail": "A payment needs an account reference or a ticketNumber; the body carries neither.",
  "instance": "/v1/payments"
}
```

---

## ACC-08 — Declined at the exit lane, and the decline is a record too

<!-- apx:scenario ACC-08 kind=refusal ics=APX-ACC-02,APX-ACC-03 -->

**Given** the transient parker on ticket `T-61077` reads a card to the
agent after the lane terminal declined it twice. **When** the agent takes
$18.00 by card. **Then** 422 `payment-declined`; the declined attempt is
nonetheless recorded (it is what the resolution context's `payments[]`
overlay shows) and published on `apx.accounts.payment.recorded.v1` with
`paymentStatus: declined`. The problem body points at that record through
the `payment` extension member §13.1 now names (F-ACC-11 fixed).

```http
POST /v1/payments
Idempotency-Key: cc-8103-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61077",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "meansOfPayment": "paymentCreditCard",
  "cardLast4": "4242"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-declined",
  "title": "Payment declined",
  "status": 422,
  "detail": "Issuer declined (do not honour). No funds were taken.",
  "instance": "/v1/payments",
  "payment": { "id": "e8000000-0000-4000-8000-000000000203", "className": "PaymentRecord" }
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000403",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000203", "className": "PaymentRecord" },
  "time": "2026-09-24T21:41:12Z",
  "data": {
    "id": "e8000000-0000-4000-8000-000000000203",
    "transactionID": "TXN-2026-090151",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "dateCollected": "2026-09-24T21:41:11Z",
    "amount": { "currencyType": "USD", "currencyValue": 18.00 },
    "meansOfPayment": "paymentCreditCard",
    "paymentStatus": "declined",
    "ticketNumber": "T-61077",
    "cardLast4": "4242"
  }
}
```

---

## ACC-09 — A ticket payment with the accounting write-back

<!-- apx:scenario ACC-09 kind=happy ics=APX-ACC-02,APX-ACC-03 -->

**Given** the lost-ticket parker from scenario 04 owes $4.50 more on
`T-1001`. **When** the agent takes it by card and then posts the payment
to PARIS. **Then** 201 with the PaymentRecord, 201 with the Posting (a
ticket payment updates no account, so `accountUpdated` is false), and a
posting against a payment id that never existed is 404.

```http
POST /v1/payments
Idempotency-Key: cc-4412-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-1001",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 4.50 },
  "meansOfPayment": "paymentCreditCard",
  "cardLast4": "0777"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000202",
  "transactionID": "PARIS-20260924-01191",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T18:26:40Z",
  "amount": { "currencyType": "USD", "currencyValue": 4.50 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "approved",
  "ticketNumber": "T-1001",
  "cardLast4": "0777",
  "postings": []
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000202/postings -->
```json
{
  "postedTo": "paris",
  "note": "remainder on T-1001 taken by phone"
}
```

<!-- apx:response 201 -->
```json
{
  "confirmationNumber": "CONF-88214",
  "accountUpdated": false,
  "postedTo": "paris",
  "time": "2026-09-24T18:26:41Z"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/postings -->
```json
{ "postedTo": "paris" }
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment e8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-0000000000ff/postings"
}
```

The account payment from ACC-05 is posted too; this time the balance
moves, and the body is omitted because the server default (PARIS)
applies:

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000201/postings -->
<!-- apx:response 201 -->
```json
{
  "confirmationNumber": "CONF-88215",
  "accountUpdated": true,
  "newBalance": { "currencyType": "USD", "currencyValue": 0.00 },
  "postedTo": "paris",
  "time": "2026-09-24T21:16:44Z"
}
```

---

## ACC-10 — Posting a declined payment

<!-- apx:scenario ACC-10 kind=refusal ics=APX-ACC-02,APX-ACC-05 -->

**Given** a reconciliation script that posts every PaymentRecord it sees.
**When** it posts the declined attempt from ACC-08. **Then** 409
`payment-state-illegal`: nothing was collected, and only an `approved`
payment can be posted (§13.1a; F-ACC-04 fixed).

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000203/postings -->
```json
{ "postedTo": "paris" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment e8000000-0000-4000-8000-000000000203 is declined; only approved payments can be posted.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000203/postings"
}
```

---

## ACC-11 — Declined at the exit: the payment link of first resort

<!-- apx:scenario ACC-11 kind=happy ics=APX-ACC-04,APX-ACC-03 -->

**Given** the resolution context for `T-61077` lists "send payment link"
as the allowed action and vending the gate as not allowed. **When** the
agent sends an SMS link with no `amount` (charge the current amount due).
**Then** 201 with the link in `sent`; `GET /v1/payment-links/{id}` shows
it `opened`; a replay of the same key returns the link in its current
representation (Part 4 §4.2a); the driver pays with a different card and
the payment arrives on `apx.accounts.payment.recorded.v1` (F-ACC-06
fixed).

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5000000-0012-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000052",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "sent",
  "expiresAt": "2026-09-24T22:42:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

Thirty seconds later the console polls the link (F-ACC-06 fixed) and can
tell the agent "opened, not yet paid":

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000052 -->
<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000052",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "opened",
  "expiresAt": "2026-09-24T22:42:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

Ninety seconds later the console retries the same call to refresh:

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5000000-0012-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000052",
  "version": 3,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "session": { "id": "c4000000-0000-4000-8000-000000000022", "className": "Session" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "channel": "sms",
  "sentTo": "+1•••••••8812",
  "status": "paid",
  "payment": { "id": "e8000000-0000-4000-8000-000000000204", "className": "PaymentRecord" },
  "expiresAt": "2026-09-24T22:42:31Z",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000012", "className": "ResolutionContext" },
  "correlationId": "8d2b3c4e-5f6a-4b70-9c1d-2e3f4a5b6c80"
}
```

The link-initiated payment publishes like any other; the lane
recalculates to paid and the ticket vends the gate on re-insert:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000404",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000204", "className": "PaymentRecord" },
  "time": "2026-09-24T21:44:03Z",
  "data": {
    "id": "e8000000-0000-4000-8000-000000000204",
    "transactionID": "TXN-2026-090152",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "dateCollected": "2026-09-24T21:44:02Z",
    "amount": { "currencyType": "USD", "currencyValue": 18.00 },
    "meansOfPayment": "paymentCreditCard",
    "paymentStatus": "approved",
    "ticketNumber": "T-61077",
    "cardLast4": "7731"
  }
}
```

---

## ACC-12 — Payment-link refusals

<!-- apx:scenario ACC-12 kind=refusal ics=APX-ACC-04,APX-CORE-05 -->

**Given** three more broken clients. **When** one sends a link with no
account, ticket, or session; one asks for channel `fax`; and one reuses
`ctx-e5000000-0012-paylink` for a different ticket. **Then** 400
`invalid-request` for nothing to settle, 422 `request-unprocessable` for
the channel (§13.1a; F-ACC-03 fixed), and 409 `idempotency-conflict`.

```http
POST /v1/payment-links
Idempotency-Key: cc-8104-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "channel": "sms"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Nothing to settle",
  "status": 400,
  "detail": "A payment link needs an account, a ticketNumber, or a session; the body carries none.",
  "instance": "/v1/payment-links"
}
```

```http
POST /v1/payment-links
Idempotency-Key: cc-8105-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "fax"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Delivery channel not supported",
  "status": 422,
  "detail": "Channel fax is not offered at this place; supported channels are sms and email.",
  "instance": "/v1/payment-links"
}
```

```http
POST /v1/payment-links
Idempotency-Key: ctx-e5000000-0012-paylink
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61078",
  "channel": "sms"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key ctx-e5000000-0012-paylink was first used at 2026-09-24T21:42:31Z for a link on ticket T-61077.",
  "instance": "/v1/payment-links"
}
```

---

## ACC-13 — The link expires; the agent sends a fresh one

<!-- apx:scenario ACC-13 kind=lifecycle ics=APX-ACC-04 -->

**Given** Smithfield Couriers' dispatcher asks for an e-mail link to clear
the $240.00 that disabled the fleet account, and the agent gives it 15
minutes. **When** nobody opens it and the dispatcher calls back forty
minutes later. **Then** the replay of the original key and the read route
both show the link `expired`, cancelling the expired link is 409
`payment-state-illegal`, and a new key produces a new link (F-ACC-06
fixed; `cancelled` is reached in ACC-25).

```http
POST /v1/payment-links
Idempotency-Key: cc-8106-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "expiresAt": "2026-09-24T22:05:00Z"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000301",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "sentTo": "d•••••••@smithfield-couriers.example",
  "status": "sent",
  "expiresAt": "2026-09-24T22:05:00Z"
}
```

Forty minutes later:

```http
POST /v1/payment-links
Idempotency-Key: cc-8106-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "expiresAt": "2026-09-24T22:05:00Z"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000301",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "sentTo": "d•••••••@smithfield-couriers.example",
  "status": "expired",
  "expiresAt": "2026-09-24T22:05:00Z"
}
```

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000301 -->
<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000301",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "sentTo": "d•••••••@smithfield-couriers.example",
  "status": "expired",
  "expiresAt": "2026-09-24T22:05:00Z"
}
```

The agent tidies up by cancelling it anyway:

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000301/cancel -->
```json
{ "reason": "superseded" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment link e6000000-0000-4000-8000-000000000301 expired at 2026-09-24T22:05:00Z; only a sent or opened link can be cancelled.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000301/cancel"
}
```

```http
POST /v1/payment-links
Idempotency-Key: cc-8107-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "expiresAt": "2026-09-25T22:30:00Z"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000302",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "channel": "email",
  "sentTo": "d•••••••@smithfield-couriers.example",
  "status": "sent",
  "expiresAt": "2026-09-25T22:30:00Z"
}
```

---

## ACC-14 — A refund needs a supervisor

<!-- apx:scenario ACC-14 kind=lifecycle ics=APX-ACC-04,APX-ACC-03,APX-ACC-05 -->

**Given** a driver was charged the $32.00 lost-ticket fee (payment
`e8…0207`) and the ticket turned up in the car ten minutes later; the
resolution context lists the refund with `requiresApproval: true`,
role `supervisor`. **When** the agent refunds without approval evidence,
then with it. **Then** 403 `approval-required`, then 200 with the record
in `reversed` and `refundedAmount` 32.00. A second driver overpaid $24.00
instead of $12.00 (`e8…0208`) and gets a partial refund: 200, still
`approved`, `refundedAmount` 12.00 (F-ACC-07 fixed); a second agent who
tries to refund $24.00 more is 422 because only $12.00 remains. The
reversal re-publishes the recorded event with the full current record
(§13.4; F-ACC-12 fixed).

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund
Idempotency-Key: cc-8108-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund -->
```json
{
  "reason": "ticket found after lost-ticket fee was charged"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/approval-required",
  "title": "Approval required",
  "status": 403,
  "detail": "Refunds at this place require supervisor approval; the request carries no approval evidence.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000207/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund
Idempotency-Key: cc-8109-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund -->
```json
{
  "reason": "ticket found after lost-ticket fee was charged",
  "approval": { "approvedBy": "supervisor:m.okafor", "approvedAt": "2026-09-24T19:02:10Z", "note": "ticket T-1001 presented at lane 2" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000207",
  "transactionID": "PARIS-20260924-01177",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T18:24:12Z",
  "amount": { "currencyType": "USD", "currencyValue": 32.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "reversed",
  "refundedAmount": { "currencyType": "USD", "currencyValue": 32.00 },
  "ticketNumber": "LT-0007",
  "cardLast4": "0777"
}
```

The partial refund:

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund
Idempotency-Key: cc-8110-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 12.00 },
  "reason": "cinema validation was not applied at the pay station",
  "approval": { "approvedBy": "supervisor:m.okafor", "approvedAt": "2026-09-24T19:40:00Z" }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000208",
  "transactionID": "PARIS-20260924-01183",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T19:21:55Z",
  "amount": { "currencyType": "USD", "currencyValue": 24.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "approved",
  "refundedAmount": { "currencyType": "USD", "currencyValue": 12.00 },
  "ticketNumber": "T-61040",
  "cardLast4": "5510"
}
```

A second agent, not seeing the first refund on an old screen, tries to
refund the whole $24.00:

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund
Idempotency-Key: cc-8114-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 24.00 },
  "reason": "customer says overcharged",
  "approval": { "approvedBy": "supervisor:m.okafor", "approvedAt": "2026-09-24T20:10:00Z" }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request cannot be processed",
  "status": 422,
  "detail": "Refund of 24.00 USD exceeds the 12.00 USD still refundable (amount 24.00, refundedAmount 12.00).",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000208/refund"
}
```

The full reversal, as published:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate PaymentRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000407",
  "type": "apx.accounts.payment.recorded.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "e8000000-0000-4000-8000-000000000207", "className": "PaymentRecord" },
  "time": "2026-09-24T19:02:31Z",
  "data": {
    "id": "e8000000-0000-4000-8000-000000000207",
    "transactionID": "PARIS-20260924-01177",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "dateCollected": "2026-09-24T18:24:12Z",
    "amount": { "currencyType": "USD", "currencyValue": 32.00 },
    "meansOfPayment": "paymentCreditCard",
    "paymentStatus": "reversed",
    "refundedAmount": { "currencyType": "USD", "currencyValue": 32.00 },
    "ticketNumber": "LT-0007",
    "cardLast4": "0777"
  }
}
```

---

## ACC-15 — Refund refusals

<!-- apx:scenario ACC-15 kind=refusal ics=APX-ACC-04,APX-CORE-05 -->

**Given** the reversed payment from ACC-14. **When** a second agent
refunds it again, refunds an id that never existed, refunds without an
`Idempotency-Key`, and replays `cc-8110-refund` with a different amount.
**Then** a 409 for the wrong state that Part 12 cannot name (F-ACC-04),
404, a 400 `idempotency-key-required` the operation does not declare
although the key is REQUIRED (F-ACC-02), and 409 `idempotency-conflict`.

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund
Idempotency-Key: cc-8111-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000207/refund -->
```json
{
  "reason": "customer says refund not received",
  "approval": { "approvedBy": "supervisor:m.okafor" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment e8000000-0000-4000-8000-000000000207 is already reversed (refunded in full at 2026-09-24T19:02:30Z).",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000207/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/refund
Idempotency-Key: cc-8112-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/refund -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment e8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-0000000000ff/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund
(no Idempotency-Key header)
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 12.00 },
  "approval": { "approvedBy": "supervisor:m.okafor" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/payments/{id}/refund is a mutating operation and requires an Idempotency-Key header.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000208/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund
Idempotency-Key: cc-8110-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 24.00 },
  "reason": "cinema validation was not applied at the pay station",
  "approval": { "approvedBy": "supervisor:m.okafor", "approvedAt": "2026-09-24T19:40:00Z" }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key cc-8110-refund was first used at 2026-09-24T19:40:02Z for a 12.00 USD refund.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000208/refund"
}
```

---

## ACC-16 — Card-in/card-out: authorize at entry, capture at exit

<!-- apx:scenario ACC-16 kind=lifecycle ics=APX-ACC-04,APX-ACC-02,APX-ACC-05 -->

**Given** Lakeside runs ticketless credit-card-in/out on lane 1: the card
tapped at entry is authorized for $50.00 and captured for the real fee at
exit. **When** the lane controller records the authorization with
`captureLater: true`, the night supervisor lists open holds, a plain
ticket lookup runs, the exit first tries to capture more than was
authorized, then captures $12.50, and a script then tries to void the
captured payment. **Then** 201 with a hold (`paymentStatus: approved`,
`captureStatus: authorized`: approved by the payment layer, funds held,
nothing collected); the hold appears only when `captureStatus=authorized`
is asked for and is absent from the plain lookup; 422 for the
over-capture; 200 with `captureStatus: captured` and the amount settled
(the first `payment.recorded` event is published now); and 409
`payment-state-illegal` for the void (§13.1a; F-ACC-05, F-ACC-04 fixed).
No event is published for the hold itself.

```http
POST /v1/payments
Idempotency-Key: lane1-entry-20260924-151002-2201
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61200",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 50.00 },
  "meansOfPayment": "paymentCreditCard",
  "cardLast4": "2201",
  "captureLater": true
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000205",
  "transactionID": "TXN-2026-090140",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T15:10:02Z",
  "amount": { "currencyType": "USD", "currencyValue": 50.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "approved",
  "captureStatus": "authorized",
  "captureLater": true,
  "ticketNumber": "T-61200",
  "cardLast4": "2201"
}
```

At 18:00 the supervisor lists the open holds at Lakeside:

<!-- apx:request GET /v1/payments?ticketNumber=T-61200&captureStatus=authorized -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000205",
      "transactionID": "TXN-2026-090140",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T15:10:02Z",
      "amount": { "currencyType": "USD", "currencyValue": 50.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "captureStatus": "authorized",
      "ticketNumber": "T-61200",
      "cardLast4": "2201"
    }
  ]
}
```

A console that predates `captureStatus` looks the same ticket up and
sees nothing collected, which is the truth:

<!-- apx:request GET /v1/payments?ticketNumber=T-61200 -->
<!-- apx:response 200 -->
```json
{ "data": [] }
```

At the exit, six hours later, a mis-keyed fee:

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture
Idempotency-Key: lane2-exit-20260924-211511-2201
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 125.00 }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request cannot be processed",
  "status": 422,
  "detail": "Capture amount 125.00 USD exceeds the authorized 50.00 USD.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/capture"
}
```

The corrected fee:

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture
Idempotency-Key: lane2-exit-20260924-211530-2201
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 12.50 }
}
```

<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000205",
  "transactionID": "TXN-2026-090140",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T21:15:30Z",
  "amount": { "currencyType": "USD", "currencyValue": 12.50 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "approved",
  "captureStatus": "captured",
  "ticketNumber": "T-61200",
  "cardLast4": "2201"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000205/void
Idempotency-Key: cleanup-20260924-0205
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/void -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment e8000000-0000-4000-8000-000000000205 was captured at 2026-09-24T21:15:30Z; a captured payment is refunded, not voided.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/void"
}
```

---

## ACC-17 — The car never came back: void the authorization

<!-- apx:scenario ACC-17 kind=lifecycle ics=APX-ACC-04 -->

**Given** an authorization `e8…0206` (the twin of ACC-16's) whose vehicle
left through a lane with no reader; at close of day the controller
releases the hold. **When** it voids the hold (no event is published: nothing was collected), the retry replays the
same key, a later script tries to capture it, and two calls target an id
that never existed. **Then** 200 with the record in `reversed`, 200
again (the current representation), 409 `payment-state-illegal` for the
capture (§13.1a table), and 404 twice.

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000206/void
Idempotency-Key: eod-20260924-0206
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/void -->
<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000206",
  "transactionID": "TXN-2026-090141",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T15:12:48Z",
  "amount": { "currencyType": "USD", "currencyValue": 50.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "reversed",
  "captureStatus": "authorized",
  "ticketNumber": "T-61201",
  "cardLast4": "9034"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000206/void
Idempotency-Key: eod-20260924-0206
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/void -->
<!-- apx:response 200 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000206",
  "transactionID": "TXN-2026-090141",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T15:12:48Z",
  "amount": { "currencyType": "USD", "currencyValue": 50.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "reversed",
  "captureStatus": "authorized",
  "ticketNumber": "T-61201",
  "cardLast4": "9034"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000206/capture
Idempotency-Key: late-capture-0206
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/capture -->
```json
{
  "amount": { "currencyType": "USD", "currencyValue": 8.00 }
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment e8000000-0000-4000-8000-000000000206 was voided at 2026-09-24T23:30:00Z; nothing remains to capture.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000206/capture"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/capture
Idempotency-Key: late-capture-00ff
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/capture -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment e8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-0000000000ff/capture"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/void
Idempotency-Key: eod-20260924-00ff
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-0000000000ff/void -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment e8000000-0000-4000-8000-0000000000ff.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-0000000000ff/void"
}
```

---

## ACC-18 — "I paid at the pay station": the last four of the ticket

<!-- apx:scenario ACC-18 kind=happy ics=APX-PHX-01,APX-ACC-03 -->

**Given** a driver at the exit at 21:40 whose ticket reads "unpaid"; they
paid at pay station 3 at 19:02 and the grace period ran out. They can
read only the last four digits, `8214`. **When** the agent searches
without a date, then with yesterday's date, then by the card's last four.
**Then** the first returns only today's payment (yesterday's `T-48214`,
same last four, is outside the 8-hour window and is not returned), the
second returns yesterday's, and the card lookup finds the same record.
Every record names its place.

<!-- apx:request GET /v1/payments?ticketLast4=8214 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790286000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000211",
      "transactionID": "PS3-20260924-00622",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T19:02:17Z",
      "amount": { "currencyType": "USD", "currencyValue": 14.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-58214",
      "cardLast4": "3310"
    }
  ]
}
```

<!-- apx:request GET /v1/payments?ticketLast4=8214&date=2026-09-23 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790286000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000212",
      "transactionID": "PS3-20260923-00588",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-23T20:15:40Z",
      "amount": { "currencyType": "USD", "currencyValue": 9.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-48214",
      "cardLast4": "6120"
    }
  ]
}
```

The lookup of last resort, no ticket at all:

<!-- apx:request GET /v1/payments?cardLast4=3310 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000211",
      "transactionID": "PS3-20260924-00622",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T19:02:17Z",
      "amount": { "currencyType": "USD", "currencyValue": 14.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-58214",
      "cardLast4": "3310"
    }
  ]
}
```

---

## ACC-19 — Paid this morning, calling tonight

<!-- apx:scenario ACC-19 kind=edge ics=APX-PHX-01 -->

**Given** a driver who paid at 09:15 and calls at 21:40 with the card's
last four, `1881`. **When** the agent searches without a date. **Then**
the empty list is correct: twelve hours is outside the privacy window
and the window MUST NOT be widened by configuration. With today's date
the record appears. Older records are found by the full ticket number or
an account-scoped query, both exempt from the window, and a bare query
with no key is 400 `invalid-request` (§13.2; F-ACC-10 fixed).

<!-- apx:request GET /v1/payments?cardLast4=1881 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790286000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

<!-- apx:request GET /v1/payments?cardLast4=1881&date=2026-09-24 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000214",
      "transactionID": "PS3-20260924-00301",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T09:15:03Z",
      "amount": { "currencyType": "USD", "currencyValue": 6.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-60932",
      "cardLast4": "1881"
    }
  ]
}
```

<!-- apx:request GET /v1/payments?ticketNumber=T-60932 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000214",
      "transactionID": "PS3-20260924-00301",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T09:15:03Z",
      "amount": { "currencyType": "USD", "currencyValue": 6.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-60932",
      "cardLast4": "1881"
    }
  ]
}
```

J. Smith asks for this month's statement:

<!-- apx:request GET /v1/payments?account=c2000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000201",
      "transactionID": "PARIS-20260924-01188",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T21:16:40Z",
      "amount": { "currencyType": "USD", "currencyValue": 185.00 },
      "meansOfPayment": "paymentCreditCard",
      "channel": "autoAttendant",
      "paymentStatus": "approved",
      "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
      "cardLast4": "8812"
    }
  ]
}
```

An empty console form fires the query with nothing in it:

<!-- apx:request GET /v1/payments -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "GET /v1/payments needs at least one key: ticketLast4, cardLast4, ticketNumber, or account; an unfiltered payment history is not served.",
  "instance": "/v1/payments",
  "errors": [ { "pointer": "/query", "detail": "no key parameter given" } ]
}
```

A `date` alone is not a key either (Part 13 §13.2):

<!-- apx:request GET /v1/payments?date=2026-09-24&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "date and place only narrow a keyed query; give ticketLast4, cardLast4, ticketNumber, or account.",
  "instance": "/v1/payments"
}
```

The statement view narrowed to one garage with `place`:

<!-- apx:request GET /v1/payments?account=c2000000-0000-4000-8000-000000000004&place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000201",
      "transactionID": "PARIS-20260924-01188",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T21:16:40Z",
      "amount": { "currencyType": "USD", "currencyValue": 185.00 },
      "meansOfPayment": "paymentCreditCard",
      "channel": "autoAttendant",
      "paymentStatus": "approved",
      "account": { "id": "c2000000-0000-4000-8000-000000000004", "className": "Account" },
      "cardLast4": "8812"
    }
  ]
}
```

---

## ACC-20 — A full PAN never rides the API

<!-- apx:scenario ACC-20 kind=security ics=APX-CORE-10,APX-ACC-02,APX-ACC-06 -->

**Given** a console vendor whose first build sends the whole card number.
**When** it puts 16 digits in `cardLast4`, then in a made-up
`cardNumber` member, then in the `cardLast4` query of the history
lookup, then in a payment-link body. **Then** each is refused with 422
`personal-data-not-permitted` before anything is stored or logged
(§13.1; F-ACC-03, F-ACC-14 fixed). The query parameter keeps no
`pattern` — adding one would break existing clients — so the refusal is
a declared rule, not a schema failure.

```http
POST /v1/payments
Idempotency-Key: vendor-build-1-0001
```

<!-- apx:request POST /v1/payments invalid -->
```json
{
  "ticketNumber": "T-61077",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "meansOfPayment": "paymentCreditCard",
  "cardLast4": "4242424242424242"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/personal-data-not-permitted",
  "title": "Card data not accepted",
  "status": 422,
  "detail": "cardLast4 must be 2 to 4 digits; APX never carries a primary account number (Part 9 §9.6). The request was not stored.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
Idempotency-Key: vendor-build-1-0002
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61077",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 18.00 },
  "meansOfPayment": "paymentCreditCard",
  "cardNumber": "4242424242424242",
  "expiry": "12/28"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/personal-data-not-permitted",
  "title": "Card data not accepted",
  "status": 422,
  "detail": "The body carries members that look like card data (cardNumber, expiry). Card capture happens in the implementer's PCI scope, never on this API. The request was not stored.",
  "instance": "/v1/payments"
}
```

<!-- apx:request GET /v1/payments?cardLast4=4242424242424242 -->
<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/personal-data-not-permitted",
  "title": "Card data not accepted",
  "status": 422,
  "detail": "cardLast4 must be 2 to 4 digits. The query was not logged.",
  "instance": "/v1/payments"
}
```

The same build pastes the card into a payment-link note:

```http
POST /v1/payment-links
Idempotency-Key: vendor-build-1-0003
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61077",
  "channel": "sms",
  "extensions": { "apds-ext:vendor:note@1.0": { "text": "card 4242424242424242 exp 12/28" } }
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/personal-data-not-permitted",
  "title": "Card data not accepted",
  "status": 422,
  "detail": "The body carries a card number. Card capture happens on the hosted page, never on this API. The request was not stored.",
  "instance": "/v1/payment-links"
}
```

---

## ACC-21 — Harbor Deck is not in the grant

<!-- apx:scenario ACC-21 kind=security ics=APX-CORE-07,APX-ACC-03 -->

**Given** the Lakeside token. **When** it takes a payment bound to Harbor
Deck, sends a link for a Harbor account, refunds a Harbor payment, and
captures one. **Then** four 403 `insufficient-grant`; the place binding
on every payment is what makes the check possible.

```http
POST /v1/payments
Idempotency-Key: harbor-8001-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000006", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 60.00 },
  "meansOfPayment": "paymentCreditCard",
  "channel": "autoAttendant"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payment-links
Idempotency-Key: harbor-8002-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000006", "className": "Account" },
  "channel": "sms"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/payment-links"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000301/refund
Idempotency-Key: harbor-8003-refund
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000301/refund -->
```json
{
  "reason": "customer request",
  "approval": { "approvedBy": "supervisor:m.okafor" }
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Payment e8000000-0000-4000-8000-000000000301 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000301/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000301/capture
Idempotency-Key: harbor-8004-capture
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000301/capture -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Payment e8000000-0000-4000-8000-000000000301 is bound to place b1000000-0000-4000-8000-000000000002, which is not in the token's apx_places grant.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000301/capture"
}
```

---

## ACC-22 — Unknown extension keys survive the round-trip

<!-- apx:scenario ACC-22 kind=edge ics=APX-CORE-04 -->

**Given** the operator's receipting add-on tags every payment and link
with `apds-ext:acme:receipt@1.0`, which this server has never heard of.
**When** a payment is taken with the key, read back from history, and a
link is sent with it. **Then** the container comes back byte-for-byte on
the 201 and on the history row, and on the link; the server neither
strips nor rewrites it.

```http
POST /v1/payments
Idempotency-Key: cc-8113-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61302",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 7.00 },
  "meansOfPayment": "paymentCreditCard",
  "cardLast4": "0093",
  "extensions": {
    "apds-ext:acme:receipt@1.0": { "receiptNumber": "R-2026-0924-117", "emailed": true }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e8000000-0000-4000-8000-000000000215",
  "transactionID": "TXN-2026-090160",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "dateCollected": "2026-09-24T21:50:12Z",
  "amount": { "currencyType": "USD", "currencyValue": 7.00 },
  "meansOfPayment": "paymentCreditCard",
  "paymentStatus": "approved",
  "ticketNumber": "T-61302",
  "cardLast4": "0093",
  "extensions": {
    "apds-ext:acme:receipt@1.0": { "receiptNumber": "R-2026-0924-117", "emailed": true }
  }
}
```

<!-- apx:request GET /v1/payments?ticketLast4=1302 -->
<!-- apx:response 200 -->
```json
{
  "data": [
    {
      "id": "e8000000-0000-4000-8000-000000000215",
      "transactionID": "TXN-2026-090160",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-09-24T21:50:12Z",
      "amount": { "currencyType": "USD", "currencyValue": 7.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-61302",
      "cardLast4": "0093",
      "extensions": {
        "apds-ext:acme:receipt@1.0": { "receiptNumber": "R-2026-0924-117", "emailed": true }
      }
    }
  ]
}
```

```http
POST /v1/payment-links
Idempotency-Key: cc-8114-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61303",
  "channel": "sms",
  "extensions": {
    "apds-ext:acme:receipt@1.0": { "receiptNumber": "R-2026-0924-118" }
  }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000303",
  "version": 1,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61303",
  "amount": { "currencyType": "USD", "currencyValue": 11.00 },
  "channel": "sms",
  "sentTo": "+1•••••••2210",
  "status": "sent",
  "expiresAt": "2026-09-24T22:52:00Z",
  "extensions": {
    "apds-ext:acme:receipt@1.0": { "receiptNumber": "R-2026-0924-118" }
  }
}
```

---

## ACC-23 — Month-end: the reconciliation job trips the rate limit

<!-- apx:scenario ACC-23 kind=edge ics=APX-CORE-05 -->

**Given** a month-end job that walks every account, re-reads every
payment, and replays its unposted refunds, voids, captures, and links in
a tight loop. **When** it exceeds the credential's limit. **Then** 429
`rate-limited` with `Retry-After` on every route it touches, and the
job backs off.

```http
GET /v1/accounts?name=Smith
→ 429, Retry-After: 5
```

<!-- apx:request GET /v1/accounts?name=Smith -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 5 seconds.",
  "instance": "/v1/accounts"
}
```

<!-- apx:request GET /v1/payments?date=2026-09-24 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Read rate for this credential exceeded 300/min; retry after 5 seconds.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
Idempotency-Key: recon-20260924-0001
```

<!-- apx:request POST /v1/payments -->
```json
{
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 240.00 },
  "meansOfPayment": "unknown"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund
Idempotency-Key: recon-20260924-0002
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{ "amount": { "currencyType": "USD", "currencyValue": 12.00 }, "approval": { "approvedBy": "supervisor:m.okafor" } }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000208/refund"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000206/void
Idempotency-Key: recon-20260924-0003
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/void -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000206/void"
}
```

```http
POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture
Idempotency-Key: recon-20260924-0004
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/capture"
}
```

```http
POST /v1/payment-links
Idempotency-Key: recon-20260924-0005
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "account": { "id": "c2000000-0000-4000-8000-000000000005", "className": "Account" },
  "channel": "email"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Write rate for this credential exceeded 60/min; retry after 5 seconds.",
  "instance": "/v1/payment-links"
}
```

---

## ACC-24 — The token expired mid-shift

<!-- apx:scenario ACC-24 kind=edge ics=APX-CORE-06 -->

**Given** the console's token expired at 23:00 and the refresh has not
run yet. **When** the agent keeps working. **Then** 401 on every route
until the refresh lands, each with problem type `unauthenticated` (Part
12; F-ACC-01 fixed).

```http
GET /v1/accounts?phone=%2B15550104567
Authorization: Bearer <expired>
```

<!-- apx:request GET /v1/accounts?phone=%2B15550104567 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/accounts"
}
```

<!-- apx:request GET /v1/payments?ticketLast4=8214 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments"
}
```

```http
POST /v1/payments
Authorization: Bearer <expired>
Idempotency-Key: cc-8115-pay
```

<!-- apx:request POST /v1/payments -->
```json
{
  "ticketNumber": "T-61310",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "amount": { "currencyType": "USD", "currencyValue": 9.00 },
  "meansOfPayment": "paymentCreditCard"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000208/refund -->
```json
{ "reason": "duplicate charge", "approval": { "approvedBy": "supervisor:m.okafor" } }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000208/refund"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/void -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000206/void"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/capture"
}
```

```http
POST /v1/payment-links
Authorization: Bearer <expired>
Idempotency-Key: cc-8116-link
```

<!-- apx:request POST /v1/payment-links -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61310",
  "channel": "sms"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payment-links"
}
```

---

## ACC-25 — Sent to the wrong number: cancel the link

<!-- apx:scenario ACC-25 kind=lifecycle ics=APX-ACC-04,APX-ACC-05 -->

**Given** the agent typed the caller's number wrong and the SMS link
`e6…0303` went to a stranger. **When** the agent cancels it, the console
retries the cancel with the same key, reads it back, and then a second
agent tries to cancel the link that was already paid in ACC-11. **Then**
200 `cancelled`, 200 again with the current representation, 200 on the
read, and 409 `payment-state-illegal` for the paid link (§13.1a;
F-ACC-06 fixed). Ids that do not exist are 404, a malformed body is 400,
and a Harbor Deck link is 403 `insufficient-grant`.

```http
POST /v1/payment-links/e6000000-0000-4000-8000-000000000303/cancel
Idempotency-Key: cc-8120-cancel
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000303/cancel -->
```json
{ "reason": "wrongRecipient", "note": "agent mistyped the last digit" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000303",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61330",
  "amount": { "currencyType": "USD", "currencyValue": 14.00 },
  "channel": "sms",
  "sentTo": "+1•••••••4568",
  "status": "cancelled",
  "expiresAt": "2026-09-24T23:10:00Z"
}
```

```http
POST /v1/payment-links/e6000000-0000-4000-8000-000000000303/cancel
Idempotency-Key: cc-8120-cancel
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000303/cancel -->
```json
{ "reason": "wrongRecipient", "note": "agent mistyped the last digit" }
```

<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000303",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61330",
  "amount": { "currencyType": "USD", "currencyValue": 14.00 },
  "channel": "sms",
  "sentTo": "+1•••••••4568",
  "status": "cancelled",
  "expiresAt": "2026-09-24T23:10:00Z"
}
```

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000303 -->
<!-- apx:response 200 -->
```json
{
  "id": "e6000000-0000-4000-8000-000000000303",
  "version": 2,
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "ticketNumber": "T-61330",
  "amount": { "currencyType": "USD", "currencyValue": 14.00 },
  "channel": "sms",
  "sentTo": "+1•••••••4568",
  "status": "cancelled",
  "expiresAt": "2026-09-24T23:10:00Z"
}
```

The same key reused to cancel a different link:

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel -->
```json
{ "reason": "wrongRecipient" }
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-conflict",
  "title": "Idempotency-Key replayed with a different body",
  "status": 409,
  "detail": "Idempotency-Key cc-8120-cancel was first used for link e6000000-0000-4000-8000-000000000303.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel"
}
```

The already-paid link from ACC-11:

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000052/cancel -->
<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/payment-state-illegal",
  "title": "Payment state does not allow this action",
  "status": 409,
  "detail": "Payment link e6000000-0000-4000-8000-000000000052 is paid (payment e8000000-0000-4000-8000-000000000204); refund the payment instead.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000052/cancel"
}
```

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-0000000003ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment link e6000000-0000-4000-8000-0000000003ff.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-0000000003ff"
}
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-0000000003ff/cancel -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No payment link e6000000-0000-4000-8000-0000000003ff.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-0000000003ff/cancel"
}
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000305/cancel invalid -->
```json
{ "reason": 7 }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "reason must be a string.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000305/cancel",
  "errors": [ { "pointer": "/reason", "detail": "must be string" } ]
}
```

A Harbor Deck link, read and cancelled with the Lakeside token:

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000390 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside the caller's grant",
  "status": 403,
  "detail": "Payment link e6000000-0000-4000-8000-000000000390 belongs to a place outside apx_places.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000390"
}
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000390/cancel -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside the caller's grant",
  "status": 403,
  "detail": "Payment link e6000000-0000-4000-8000-000000000390 belongs to a place outside apx_places.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000390/cancel"
}
```

---

## ACC-26 — The shared responses on the remaining routes

<!-- apx:scenario ACC-26 kind=edge ics=APX-CORE-05,APX-CORE-06,APX-CORE-07 -->

**Given** the console from ACC-23 (rate-limited), ACC-24 (expired
token), and a read-only reporting token (`apx.accounts:read` only).
**When** each hits the routes the earlier scenarios did not. **Then**
the shared 401, 403, 429, and 400 responses every secured operation
declares (Part 12 §12.3).

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-000000000004 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/accounts/c2000000-0000-4000-8000-000000000004"
}
```

<!-- apx:request GET /v1/accounts/c2000000-0000-4000-8000-000000000004 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 30 seconds.",
  "instance": "/v1/accounts/c2000000-0000-4000-8000-000000000004"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000201/postings -->
```json
{ "postedTo": "paris" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000201/postings"
}
```

The reporting token has no `apx.payments:write`:

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000201/postings -->
```json
{ "postedTo": "paris" }
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/payments/{id}/postings requires apx.payments:write.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000201/postings"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000201/postings -->
```json
{ "postedTo": "paris" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 30 seconds.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000201/postings"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000201/postings invalid -->
```json
{ "postedTo": 12 }
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "postedTo must be a string.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000201/postings",
  "errors": [ { "pointer": "/postedTo", "detail": "must be string" } ]
}
```

A void and a capture sent without the REQUIRED `Idempotency-Key`:

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000206/void -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/payments/{id}/void requires an Idempotency-Key header.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000206/void"
}
```

<!-- apx:request POST /v1/payments/e8000000-0000-4000-8000-000000000205/capture -->
<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/idempotency-key-required",
  "title": "Idempotency-Key required",
  "status": 400,
  "detail": "POST /v1/payments/{id}/capture requires an Idempotency-Key header.",
  "instance": "/v1/payments/e8000000-0000-4000-8000-000000000205/capture"
}
```

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000303 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000303"
}
```

<!-- apx:request GET /v1/payment-links/e6000000-0000-4000-8000-000000000303 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 30 seconds.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000303"
}
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-24T23:00:00Z.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel"
}
```

<!-- apx:request POST /v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "Retry after 30 seconds.",
  "instance": "/v1/payment-links/e6000000-0000-4000-8000-000000000304/cancel"
}
```
