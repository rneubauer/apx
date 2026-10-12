# Scenario 31 — Three days offline: catching up by cursor

**The story.** Lakeside Garage's enforcement back office runs on its own
server and keeps a copy of the garage's violations and payments. On
Friday night the site link drops and stays down until Monday morning.
Webhook retries for Friday's events ended on Saturday (Part 8 §8.3), so
push alone cannot fill the gap. The back office catches up from the cursor
it holds (Part 5 §5.2a).

**Actors.** Enforcement back office (`enforcement-office` credential,
scopes `apx.violations:read`, `apx.accounts:read`, grant on Lakeside
Garage) → Lakeside Garage APX server (claims `apx-violations`,
`apx-accounts`, `apx-payment-history`).

## Step 1 — Take the head cursor before the first full list

The office has never synced. It asks for the change feed with no cursor and
gets an empty page holding the feed's current head (§5.2a rule 3):

```http
GET /v1/violations?mode=change&place=b1000000-0000-4000-8000-000000000004 HTTP/1.1
```

<!-- apx:validate ChangeFeedUpdateMode at /updateMode -->
<!-- apx:validate ChangeFeedCursor at /cursor -->
```json
{
  "updateMode": "change",
  "data": [],
  "deleted": [],
  "cursor": "v:7f3a:000918",
  "next": null
}
```

Then it lists everything with `mode=full` (the ordinary paginated list)
and only after that follows the cursor. A violation that changes between
the two calls shows up in both; the office keeps the higher `version`, so
nothing is missed and nothing is counted twice.

## Step 2 — Monday: the link is back

The office presents the cursor from its last page on Friday:

```http
GET /v1/violations?mode=change&place=b1000000-0000-4000-8000-000000000004&cursor=v%3A7f3a%3A001204 HTTP/1.1
```

<!-- apx:validate Violation at /data/0 -->
<!-- apx:validate Violation at /data/1 -->
<!-- apx:validate DeletedReference at /deleted/0 -->
<!-- apx:validate ChangeFeedNext at /next -->
```json
{
  "updateMode": "change",
  "data": [
    {
      "id": "d3000000-0000-4000-8000-000000000031",
      "version": 2,
      "violationType": "expiredRight",
      "violationStatus": "issued",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-10-10T22:14:51Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.97 },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-2208", "jurisdiction": "US-IL" },
      "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-020114", "issuedTime": "2026-10-10T22:14:58Z", "deliveryMethod": "mail" },
      "amount": { "currencyType": "USD", "currencyValue": 35.0 },
      "dueTime": "2026-11-09T23:59:59Z",
      "statusHistory": [
        { "state": "detected", "time": "2026-10-10T22:14:52Z", "actor": "lpr-pipeline-lot-c" },
        { "state": "issued", "time": "2026-10-10T22:14:58Z", "actor": "lpr-pipeline-lot-c" }
      ]
    },
    {
      "id": "d3000000-0000-4000-8000-000000000027",
      "version": 6,
      "violationType": "noValidRight",
      "violationStatus": "paid",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "detection": { "mode": "automated", "detectedTime": "2026-10-08T07:02:13Z", "principal": "lpr-pipeline-lot-c", "confidence": 0.95 },
      "vehicle": { "credentialType": "licensePlate", "credentialIdentification": "SYN-6631", "jurisdiction": "US-IL" },
      "notice": { "noticeKind": "notice", "noticeNumber": "LG-2026-019870", "issuedTime": "2026-10-08T07:02:20Z", "deliveryMethod": "mail" },
      "amount": { "currencyType": "USD", "currencyValue": 50.0 },
      "dueTime": "2026-11-07T23:59:59Z",
      "payment": { "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e51", "className": "PaymentRecord" },
      "statusHistory": [
        { "state": "detected", "time": "2026-10-08T07:02:14Z", "actor": "lpr-pipeline-lot-c" },
        { "state": "issued", "time": "2026-10-08T07:02:20Z", "actor": "lpr-pipeline-lot-c" },
        { "state": "paid", "time": "2026-10-11T16:40:09Z", "actor": "portal" }
      ]
    }
  ],
  "deleted": [
    { "id": "d3000000-0000-4000-8000-000000000003", "className": "Violation", "deleteTimestamp": "2026-10-11T03:00:00Z" }
  ],
  "cursor": "v:7f3a:001377",
  "next": "/v1/violations?mode=change&place=b1000000-0000-4000-8000-000000000004&cursor=v%3A7f3a%3A001377"
}
```

Each item is the whole violation as it stands now (§5.2a rule 2), with its
`statusHistory`, so the office learns that `…-0027` was paid on Saturday
even though it never saw the intermediate events. The tombstone is a
violation the retention schedule purged on Saturday night (Part 9 §9.6).
`next` says more changes are waiting; the office follows it until `next`
is null.

## Step 3 — A filtered feed still sees a violation leave the filter

The office's collections queue keeps only unpaid notices, so it also runs a
narrower feed with `status=issued`. Violation `…-0027` was `issued` before
Saturday's payment and `paid` after it. A change belongs to a filtered
feed when the resource matched before **or** after it (§5.2a rule 4), so
`…-0027` appears in this feed with `violationStatus: paid`, and the
queue drops it. Under an "after only" rule the queue would have chased a
paid notice.

## Step 4 — Payments: the ledger feed, not a lookup

The office reconciles the money with the payment feed. With `mode=change`,
`GET /v1/payments` needs no key and has no 8-hour window (§5.2a rule 6):

```http
GET /v1/payments?mode=change&place=b1000000-0000-4000-8000-000000000004&cursor=p%3A11c0%3A000452 HTTP/1.1
```

<!-- apx:validate PaymentRecord at /data/0 -->
<!-- apx:validate ChangeFeedCursor at /cursor -->
```json
{
  "updateMode": "change",
  "data": [
    {
      "id": "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e51",
      "transactionID": "PORTAL-20261011-00088",
      "place": { "id": "b1000000-0000-4000-8000-000000000004", "className": "Place" },
      "dateCollected": "2026-10-11T16:40:02Z",
      "amount": { "currencyType": "USD", "currencyValue": 50.0 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "postings": []
    }
  ],
  "deleted": [],
  "cursor": "p:11c0:000460",
  "next": null
}
```

These are the same records `apx.accounts.payment.recorded.v1` would have
pushed. A card-fragment search is still a lookup, so the server refuses it
on the feed:

```http
GET /v1/payments?mode=change&cardLast4=0777 HTTP/1.1
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "cardLast4 and ticketLast4 cannot be combined with mode=change; use a keyed lookup without mode.",
  "instance": "/v1/payments"
}
```

## Step 5 — A cursor from last month

A second office server restored from an old backup presents a cursor from
five weeks ago, past the 7-day retention:

```http
GET /v1/violations?mode=change&place=b1000000-0000-4000-8000-000000000004&cursor=v%3A7f3a%3A000102 HTTP/1.1
```

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "The cursor is older than the retention window; re-sync with mode=full.",
  "instance": "/v1/violations"
}
```

It starts over as in Step 1: take the head cursor, then list with
`mode=full`.
