# Scenario 20 — Lost keycard: replaced on the phone at noon, the old card denied at six, the access log says why

**The story.** A monthly parker at Lakeside Garage calls at noon: the
keycard is gone. The agent finds the card on the account, reports it
lost, and issues a replacement from the pre-encoded stock at the front
desk — one call. At 6 PM someone presents the old card at the entry
lane; the lane, which only speaks APDS, refuses it. The next morning the
parker asks "did anyone use my old card?" and the access log answers.

**Actors.** Call-center agent console (`apx.accounts:read`,
`apx.credentials:manage`); entry lane (APDS-native, reads
`/rights/assigned`); the parker's app the next day (`apx.credentials:read`)
→ Lakeside Garage APX server.

## Step 1 — Find the card on the account

```http
GET /v1/credentials?account=7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d&status=active HTTP/1.1
```

<!-- apx:validate CredentialRecord at /data/0 -->
```json
{
  "data": [
    {
      "id": "d6000000-0000-4000-8000-000000000101",
      "version": 4,
      "credentialType": "rfid",
      "credentialIdentification": "C-0048812",
      "credentialAssignedType": "customer",
      "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
      "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
      "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
      "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
      "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
      "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "batch": "2025-Q4-B", "issuedTime": "2025-12-28T15:10:00Z", "deposit": { "currencyType": "USD", "currencyValue": 25.0 }, "depositStatus": "held" },
      "credentialStatus": "active",
      "statusHistory": [
        { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
        { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system", "detail": "validity.start reached" }
      ]
    }
  ]
}
```

An HID proximity card (`credentialType: rfid`, `media.form:
physicalCard`), issued in December with a $25 deposit, active since
January 1, materialized on the parker's monthly AssignedRight.

## Step 2 — Report it lost

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/report-lost HTTP/1.1
Content-Type: application/json

{ "reason": "holderRequest", "note": "Caller reports card missing since yesterday evening." }
```

<!-- apx:validate CredentialRecord -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 5,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "deposit": { "currencyType": "USD", "currencyValue": 25.0 }, "depositStatus": "held" },
  "credentialStatus": "lost",
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system" },
    { "state": "lost", "time": "2026-09-19T12:03:41Z", "actor": "agent-0212", "detail": "Caller reports card missing since yesterday evening." }
  ]
}
```

From 12:03:41 the card's `CredentialAssigned` is gone from AssignedRight
`e1000000-…-0102`. `apx.credentials.status.v1` fires. Nothing else has
to be told.

## Step 3 — Replace it, one call

The front desk holds pre-encoded stock; the agent picks the next card
and settles the old deposit against the new one:

```http
POST /v1/credentials/d6000000-0000-4000-8000-000000000101/replace HTTP/1.1
Idempotency-Key: cc-0212-20260919-1204-replace
Content-Type: application/json

{
  "reason": "lost",
  "credentialIdentification": "C-0051207",
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-006903", "batch": "2026-Q3-A", "deposit": { "currencyType": "USD", "currencyValue": 25.0 } },
  "oldDepositStatus": "forfeited",
  "note": "Replacement issued at front desk; parker to collect."
}
```

<!-- apx:validate CredentialRecord -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000102",
  "version": 1,
  "credentialType": "rfid",
  "credentialIdentification": "C-0051207",
  "credentialAssignedType": "customer",
  "holder": { "id": "c1000000-0000-4000-8000-000000000102", "className": "RightHolder" },
  "account": { "id": "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", "className": "Account" },
  "assignedRights": [ { "id": "e1000000-0000-4000-8000-000000000102", "className": "AssignedRight" } ],
  "places": [ { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" } ],
  "validity": { "start": "2026-01-01T00:00:00Z", "end": "2026-12-31T23:59:59Z" },
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-006903", "batch": "2026-Q3-A", "issuedTime": "2026-09-19T12:04:20Z", "deposit": { "currencyType": "USD", "currencyValue": 25.0 }, "depositStatus": "held" },
  "credentialStatus": "active",
  "replaces": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212", "detail": "replacement for d6000000-…-0101 (lost)" },
    { "state": "active", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212" }
  ]
}
```

The successor inherited the holder, account, assigned right, places, and
validity. In the same instant the AssignedRight's credentials went from
`C-0048812` to `C-0051207` in one `AssignedRightUpdated` event, and the
old record now reads:

<!-- apx:validate CredentialRecord -->
```json
{
  "id": "d6000000-0000-4000-8000-000000000101",
  "version": 6,
  "credentialType": "rfid",
  "credentialIdentification": "C-0048812",
  "credentialStatus": "replaced",
  "media": { "form": "physicalCard", "serialNumber": "HID-77A3-004512", "depositStatus": "forfeited" },
  "replacedBy": { "id": "d6000000-0000-4000-8000-000000000102", "className": "CredentialRecord" },
  "statusHistory": [
    { "state": "issued", "time": "2025-12-28T15:10:00Z", "actor": "frontdesk-mkim" },
    { "state": "active", "time": "2026-01-01T00:00:00Z", "actor": "system" },
    { "state": "lost", "time": "2026-09-19T12:03:41Z", "actor": "agent-0212" },
    { "state": "replaced", "time": "2026-09-19T12:04:20Z", "actor": "agent-0212", "detail": "successor d6000000-…-0102; deposit forfeited" }
  ]
}
```

A second `replace` on the old record now would be refused with 409
`credential-not-replaceable`; a retry of the same call with the same
`Idempotency-Key` returns the same successor.

## Step 4 — 6 PM: the old card at the gate

The entry lane is APDS-native. It looks up the presented card against
the assigned rights (`GET /rights/assigned?credential_type=rfid&credential_id=C-0048812`,
a stock APDS query) and finds nothing — the card was taken off the right
at noon. Access denied. The server records the attempt and publishes
`apx.credentials.access.v1`:

<!-- apx:validate CredentialAccessEvent -->
```json
{
  "id": "d7000000-0000-4000-8000-000000000410",
  "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
  "occurredAt": "2026-09-19T18:02:17Z",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
  "device": { "id": "b2000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
  "direction": "entry",
  "outcome": "denied",
  "denialReason": "credentialReplaced"
}
```

No sync job, no second blacklist: the lane refused the card because the
right no longer carried it.

## Step 5 — Next morning: "did anyone use my old card?"

```http
GET /v1/credentials/d6000000-0000-4000-8000-000000000101/access-events?since=2026-09-18T00:00:00Z HTTP/1.1
```

<!-- apx:validate CredentialAccessEvent at /data/0 -->
<!-- apx:validate CredentialAccessEvent at /data/1 -->
```json
{
  "data": [
    {
      "id": "d7000000-0000-4000-8000-000000000410",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-19T18:02:17Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "direction": "entry",
      "outcome": "denied",
      "denialReason": "credentialReplaced"
    },
    {
      "id": "d7000000-0000-4000-8000-000000000388",
      "credential": { "id": "d6000000-0000-4000-8000-000000000101", "className": "CredentialRecord" },
      "occurredAt": "2026-09-18T17:41:05Z",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "direction": "exit",
      "outcome": "granted",
      "session": { "id": "f1000000-0000-4000-8000-000000000318", "className": "Session" }
    }
  ]
}
```

The last legitimate use was the parker's own exit at 5:41 PM the day
before; the only attempt since was the refused one at 6:02 PM. The
parker's app shows exactly that, and the agent who takes the follow-up
call sees the same list.
