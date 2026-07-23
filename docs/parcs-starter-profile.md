# APX PARCS Starter Profile

**The minimum APX integration for a PARCS vendor — everything you must
build, nothing you don't.**

You implement three conformance classes: `apx-data`, `apx-events`,
`apx-control`. That's ~25 endpoints, and if your system already speaks
APDS 4.1, more than half are already done. Import the slim spec —
`spec/dist/apx-parcs.json` — into Postman/your codegen; it contains *only*
what this profile needs and is byte-identical to the full standard.

## What you do NOT need

Alerts, accounts/payments, LPR lookup, reservations, permits, tolling,
SSE streaming, credential-scoped discovery — **all optional classes.**
Add any of them later without touching what you build here.

## Build order (five steps, each independently testable)

### Step 1 — Bootstrap + auth (half a day)

| Endpoint | What it is |
|---|---|
| `GET /.well-known/apx-configuration` | One static JSON: your token endpoint + `"conformanceClasses": ["apx-data","apx-events","apx-control"]` |
| OAuth2 client-credentials token endpoint | You almost certainly have one; scopes are strings like `apx.control:execute` |

### Step 2 — The APDS data routes (free if you have APDS)

`GET/POST /places · /sessions · /rates · /rights/specs · /rights/assigned ·
/observations · /contacts · /quotes` (+ `GET/PUT/DELETE` by id).
These are **APDS 4.1 verbatim** — same paths, same schemas, same
`{meta, data}` list envelope. If you've implemented APDS, skip to Step 3.

APX adds two *optional-to-your-clients* behaviors you must serve:
- `?mode=change&cursor=…` on list routes → return only changes since the
  cursor (ordered, gapless), plus tombstones for deletions
- `APX-Update-Mode: change` header on writes → partial update where
  explicit `null` clears a field

### Step 3 — Webhooks (the one genuinely new item)

| Endpoint | What it does |
|---|---|
| `POST /webhooks` | Accept `{endpoint, topics[]}` (+ optional filters); return it with a generated signing `secret` |
| `DELETE /webhooks/{id}` · `GET /webhooks` · `PATCH /webhooks/{id}` | Revoke / list / update |
| `GET /webhooks/{id}/deliveries` | Your delivery attempt log |

When data changes or a command progresses, POST one JSON envelope
(`{id, type, time, subject, data}`) to each matching subscriber with:
`APX-Signature: v1=HMAC-SHA256(secret, timestamp + "." + body)`,
`APX-Timestamp`, `APX-Delivery-Id`. Retry on non-2xx: 0s, 30s, 2m, 10m,
1h, hourly → 24h, then mark the subscription `failed`.

### Step 4 — Commands (thin wrappers over what your PARCS already does)

| Endpoint | Maps to your existing function |
|---|---|
| `POST /v1/commands` — `vendGate` | Open the gate once |
| — `lostTicket` | Issue lost ticket; fee = the `lostTicketFee` flat line in your rate deck |
| — `pushRate` | Apply a rate table to a lane |
| — `applyValidation` | Apply a merchant validation to a ticket (reject unknown providers: 422) |
| `GET /v1/commands/{id}` · `POST …/cancel` | Status polling / cancel before dispatch |

Three rules on every command: **require `Idempotency-Key`** (replay returns
the original, never re-executes), **honor `expiryTime`** (a stale gate-vend
must not fire), **append every state change to `statusHistory`**
(`received → accepted → dispatched → executing → succeeded/failed`).

### Step 5 — Lane + device visibility

| Endpoint | What it returns |
|---|---|
| `GET /v1/lanes/{id}/current` | The ticket in the machine now: amount due, validations, paid-in-full (+ monthly-credential context if presented) |
| `GET /v1/validations/providers?place=` | Who may validate here, and what each validation is worth |
| `GET /v1/devices` · `/{id}` | Live state per device: `available / occupied / inoperative / outOfService / fault / unknown` |

## Prove it

```
npm run conformance -w @apx/conformance -- --base-url https://your-server \
  --client-id <id> --client-secret <secret>
```

Green on the suites for your three classes = you may claim APX conformance.
Run it after every step — it tells you exactly what's missing.

## Conventions cheat-sheet

UUIDs + integer `version` on every object · typed references
`{"id","className"}` · RFC 3339 UTC timestamps · money
`{"type":"USD","value":9.00}` · errors are `application/problem+json` with
a documented `type` URI · unknown `extensions` keys must survive round-trips.
