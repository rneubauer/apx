# The APX API — A Complete Overview

**Read this and you know APX. No prior knowledge of APDS (or any parking
standard) required.**

This document walks every part of the API in plain language: what each group
of routes does, and *why it was designed that way*. The machine-readable
contract is `spec/dist/apx-v1.yaml` (import it into Postman or view it live
at `/docs` on any APX server).

---

## 1. The five ideas behind everything

Parking systems juggle the same handful of concepts. APX names them once and
uses them everywhere:

| Concept | Plain meaning | Example |
|---|---|---|
| **Place** | Anywhere a vehicle can park — a garage, a surface lot, a curb zone — broken down into levels, **lanes** (entries/exits), and individual **spaces** | "Lakeside Garage", "Entry Lane 1" |
| **Right** | Permission to park. A *Right Specification* is the product ("monthly permit", "transient parking"); an *Assigned Right* is that product granted to a specific person/vehicle — a ticket, a permit, a reservation | "Monthly permit #4711 for plate ABC-123" |
| **Session** | An actual parking stay — a vehicle using an assigned right, with a start and (eventually) an end | "ABC-123 entered at 8:00am" |
| **Rate** | Pricing — hourly tables, flat fees, event rates | "$3/hour, $18 max" |
| **Observation** | Something a sensor saw — a camera plate read, an RFID hit — with a timestamp, confidence score, and photo | "Camera 2 read ABC-123 at 97% confidence" |

Supporting players: an **Organisation/Contact** (an operator, a validation
partner), a **Credential** (the thing presented: plate, ticket, access card),
and a **Device** (gate, pay station, camera — physical equipment at a place).

> **Where these come from (one paragraph, then forget it):** the names and
> data shapes are taken verbatim from APDS 4.1, the parking industry's data
> standard (ISO/TS 5206-1). That's a feature — data that leaves an APX system
> is readable by any APDS-speaking system on earth. But you never need to
> read APDS: everything is fully described in APX's own OpenAPI spec, and
> this document explains all of it.

**Two conventions used everywhere:**

- Every object has an **`id`** (a UUID) and a **`version`** (an integer that
  increments on every change). Objects point at each other with a typed
  reference: `{"id": "…", "className": "Session"}`. *Why:* in a multi-vendor
  world the same object flows through many systems; stable IDs + versions
  make "which copy is newer?" and "what does this refer to?" always
  answerable.
- Timestamps are RFC 3339 UTC (`2026-07-11T08:00:00Z`); money is
  `{"type": "USD", "value": 9.00}`; errors are consistent
  `application/problem+json` objects with a documented `type` URI you can
  program against — never a bare string.

---

## 2. Getting connected

| Route | What it does |
|---|---|
| `GET /.well-known/apx-configuration` | **Start here, no login needed.** Returns where to get a token, which optional features this server supports, and where its vocabularies are published |
| `POST /oauth/token` | Standard OAuth2 client-credentials: trade your client ID + secret for a bearer token |
| `GET /apx/v1/discovery` | **Ask what YOU can do.** Returns exactly the endpoints, commands, event topics, and facilities available to *your* credential |

**Why this way:** onboarding a new integration partner usually means emailed
PDFs and guesswork. In APX a partner needs exactly one thing — a hostname.
Everything else is discoverable. And discovery is *contractual*, not
advertising: everything the document lists will work for you, and anything
it omits will refuse you with a clean 403. Access is bounded two ways:
**scopes** (what kinds of things you may do, e.g. `apx.control:execute`) and
**grants** (which facilities you may do them at). A vendor hired for one
garage physically cannot vend a gate at another.

---

## 3. Reading and writing parking data

The core data lives on eight straightforward REST route groups:

| Route | Holds |
|---|---|
| `/places` | Facilities and their structure (lanes, spaces, characteristics) |
| `/sessions` | Parking stays |
| `/rates` | Rate tables |
| `/rights/specs` | Parking products (permit types, transient parking…) |
| `/rights/assigned` | Issued tickets/permits/reservations |
| `/observations` | Camera/sensor reads (this is also how LPR data is ingested) |
| `/contacts` | Organisations — operators, partners |
| `/quotes` | Ask "what would this parking cost?" (request/response) |

Each supports list (`GET`), create (`POST`), and read/update/delete by id.
Lists are paginated with a consistent envelope (`{meta: {…}, data: […]}`).

**Why this way:** these routes are byte-for-byte the parking industry's
standard API (APDS). Any vendor who has ever built an APDS integration
already speaks them — and any plain-APDS client pointed at an APX server
works unmodified. APX chose *zero* invention here on purpose: data exchange
is the part the industry already agreed on, so APX inherits it rather than
competing with it.

---

## 4. Staying in sync (the data profile)

Polling full lists doesn't scale to live occupancy or thousands of sessions.
APX adds three additive mechanisms to the routes above:

| Mechanism | How | What you get |
|---|---|---|
| **Change feed** | `GET /sessions?mode=change&cursor=…` | Only what changed since your cursor — ordered, gapless, exactly-once. Includes **tombstones** for deletions |
| **Partial writes** | `PUT /rates/{id}` with header `APX-Update-Mode: change` | Send only the fields you're changing. Setting a field to `null` explicitly clears it; omitting it leaves it alone |
| **Coarse catch-up** | `GET /places?modified_since=…` | Everything changed since a timestamp (for clients that lost their cursor) |

**Why this way:** the cursor feed means a partner that goes offline for an
hour replays exactly what it missed — no re-downloading, no gaps, no
duplicates. The `null`-means-clear rule kills the classic integration bug
("did they omit the field, or did they mean to erase it?"). And because all
three are *additive* (optional params/headers on the standard routes), a
client that ignores them still sees perfectly normal behavior.

---

## 5. Push: events, webhooks, and streaming

Instead of polling, subscribe:

| Route | What it does |
|---|---|
| `POST /webhooks` | Subscribe an HTTPS endpoint (or an SSE stream) to named **topics** — e.g. `SessionCreated`, `apx.alert.raised.v1` |
| `GET /webhooks` · `PATCH /webhooks/{id}` · `DELETE /webhooks/{id}` | List, update (pause/resume, rotate secrets, change filters), revoke |
| `GET /webhooks/{id}/deliveries` | The delivery ledger: every attempt, its result, and the response code |
| `GET /apx/v1/events/stream` | Live **Server-Sent Events** stream of the same events, with resume-after-disconnect |

Every delivery is one uniform envelope (`id`, `type`, `time`, `subject` —
which object it's about — and `data`), **cryptographically signed** (HMAC)
so receivers can verify it's genuine, and **retried on a fixed schedule**
(immediately, 30s, 2m, 10m, 1h, then hourly up to 24h) before the
subscription is marked failed — which itself raises an alert.

**Why this way:** webhooks without rules are where integrations go to die —
unsigned payloads, silent drops, mystery duplicates. APX makes the delivery
contract *normative*: signatures, the retry schedule, stable event IDs for
deduplication, and an auditable ledger. Subscriptions can filter by facility
and severity so partners receive only their world. SSE exists because plenty
of parking equipment sits behind NAT and can't accept inbound calls — it
gets the same events over an outbound connection instead.

---

## 6. Control: doing things in the real world

The part no data standard covers — actually operating the facility:

| Route | What it does |
|---|---|
| `POST /apx/v1/commands` | Execute an action: **vendGate**, **lostTicket**, **pushRate**, **applyValidation**, holdGateOpen, closeLane, setDeviceState, displayMessage, restartDevice |
| `GET /apx/v1/commands/{id}` | Follow the command's lifecycle |
| `POST /apx/v1/commands/{id}/cancel` | Cancel before it dispatches |
| `GET /apx/v1/lanes/{id}/current` | **Screen-pop:** the ticket in the machine right now — amount due, applied validations, the plate photo, and (for monthly parkers) whether access was denied and why, with the last 10 events |
| `GET /apx/v1/devices` · `/{id}` | Live device state (available/occupied/fault/…) for every gate, pay station, camera |
| `GET /apx/v1/validations/providers?place=…` | Which businesses may validate tickets at this facility |

Commands are **asynchronous** (you get `202 Accepted`, then follow status:
`received → accepted → dispatched → executing → succeeded/failed`), and three
rules apply to every one:

1. **Idempotent** — the `Idempotency-Key` header is *required*. Networks
   retry; gates must not open twice. Replaying the same key returns the
   original command instead of re-executing.
2. **Perishable** — a command carries an `expiryTime`. A "vend gate" that got
   stuck in a queue for ten minutes must *not* fire when it finally arrives;
   it expires instead. Physical actions late are wrong actions.
3. **Audited** — every state change appends to an immutable `statusHistory`
   (who, what, when). That history *is* the audit trail: every gate vend,
   every rate push, attributable forever.

**Why this way:** these commands map one-to-one to what call-center agents
actually do hundreds of times a day (the requirements came straight from
operating garages: agent gets a call at a lane → screen-pop → apply a
validation → vend the gate). Returning a rich lifecycle instead of a bare
true/false means callers can distinguish "the gate opened" from "the gate is
faulted" from "your command expired" — and prove it later.

---

## 7. Alerts: knowing when something's wrong

| Route | What it does |
|---|---|
| `POST /apx/v1/alerts` | Raise an alert (idempotent — device retry storms can't create duplicates) |
| `GET /apx/v1/alerts` | Filter by status, severity floor, type, facility, time |
| `POST /apx/v1/alerts/{id}/acknowledge` · `/resolve` | Work the alert; every transition is recorded |

An alert has an **open** type (deviceFault, laneBlocked, overstay,
occupiedWithoutCheckIn… — operators can publish their own types) and a
**closed** severity scale (info → warning → minor → major → critical).
Alerts also flow as push events, so a NOC subscribes once and filters by
severity.

**Why this way:** types are open because no standard can enumerate
everything that goes wrong in a garage; severity is closed because *routing*
("page a human at major+") only works if everyone means the same thing by
"major". Device faults raise alerts automatically — the fault you see in
device status and the alert in the queue are the same event, not two systems
disagreeing.

---

## 8. Money: accounts, payments, write-back

| Route | What it does |
|---|---|
| `GET /apx/v1/accounts?name=\|phone=\|card=\|plate=` | Find a (monthly) parker's account and balance by whatever the caller knows |
| `POST /apx/v1/payments` | Take a payment (idempotent). `method: autoAttendant` = a PCI-compliant phone system captures the card out of band |
| `POST /apx/v1/payments/{id}/postings` | Write the payment back to the accounting system (e.g. PARIS) → confirmation number + new balance |
| `GET /apx/v1/payments?ticketLast4=…` | Payment history on a ticket |

**Why this way:** the flow mirrors the real call: *"I can't get out"* →
look up the account by phone number → see the balance → take payment via the
secure IVR → post it back → the gate opens. **APX never carries card
numbers** — the standard deliberately keeps every implementer out of PCI
scope by referencing payments, not processing them. One privacy rule is
baked in: last-4 ticket lookups only reach back 8 hours, so the convenience
feature can't be used to trawl history.

---

## 9. Plates: LPR

| Route | What it does |
|---|---|
| `POST /observations` | How camera reads enter the system (a standard data route — nothing special to build) |
| `GET /apx/v1/lpr/reads?plate=…` or `?ticket=…` | The cross-lookup: plate → ticket/session (with confidence score and the photo), or ticket → plate |

**Why this way:** LPR vendors shouldn't need a bespoke ingestion API — a
plate read *is* an observation, so ingest is the standard route every data
integration already uses. The only genuinely new need is the *join* ("which
ticket goes with this plate?"), so that's the only new endpoint.

---

## 10. Reservations and permits

Reservations deliberately add **almost no new API**. A reservation *is* an
assigned right (see §1) carrying a small reservation marker (state +
planned time window):

- **Quote** it via `/quotes` → **book** it via `POST /rights/assigned` →
  **amend** with a partial update → **check-in happens automatically** when
  a session referencing it starts → a no-show is detected and published as
  an event if the window passes with no session.

Permits add two endpoints for the pooled case ("we sell 300 monthly permits
for a 280-space garage"):

| Route | What it does |
|---|---|
| `GET /apx/v1/permits/pools/{id}/availability` | capacity / issued / available |
| `POST /apx/v1/permits/issue` | Issue a permit — one permit can carry **multiple vehicle plates** (family/fleet), refused cleanly when the pool is exhausted |

**Why this way:** every parallel "booking object" ever invented eventually
disagrees with the ticket system it shadows. By making the reservation *be*
the parking right, there is nothing to reconcile: the reservation, the
permit, and the thing the gate checks are the same object.

---

## 11. Tolling

The one fully new domain — connecting roadside reads to money:

| Route | What it does |
|---|---|
| `POST /apx/v1/tolling/transactions` | Create a toll charge from plate/transponder reads + a price (idempotent — gantries retry) |
| `GET …?plate=&status=` · `GET …/{id}` | Query transactions |
| `POST …/{id}/payment` | Attach the settling payment |
| `POST …/{id}/disputes` · `…/disputes/resolve` | The dispute lifecycle ("that wasn't my car") with a full audit history |

**Why this way:** tolling is evidence-based billing, so a transaction keeps
its chain intact: the camera reads it was built from → the price applied →
the payment that settled it → any dispute and its resolution. Every link is
a reference to an object elsewhere in this same API.

---

## 12. Room to grow: the vendor space

Partner companies extend APX without asking permission and without breaking
anyone:

- **Custom endpoints** live under `/apx/x/<company>/…`
- **Custom fields** ride along inside any object's `extensions` container,
  keyed `apds-ext:<company>:<thing>@<version>` — and every conformant server
  must *preserve* keys it doesn't recognize
- **Custom vocabularies** (new alert types, command types) are published as
  versioned code lists

Extensions that prove themselves have a defined path into the core standard.

**Why this way:** the alternative is what the industry has today — forks and
"almost compatible" dialects. Namespacing makes proprietary innovation and
interoperability coexist: your custom data flows through everyone else's
systems unharmed, and the core API means the same thing everywhere.

---

## 13. Not everything is mandatory: conformance classes

APX is sliced into named, independently claimable feature sets — `apx-data`
and `apx-events` are the base; control, alerts, discovery, accounts,
payment-history, LPR, reservations, permits, and tolling are each optional.
A server advertises its classes in its bootstrap document, and a free
automated **conformance harness** verifies any implementation against
exactly the classes it claims.

**Why this way:** an LPR vendor shouldn't have to build tolling to say
"we support APX." Classes make partial adoption honest — and the harness
makes the claim testable rather than aspirational.

---

## Try it in five minutes

```powershell
npm install && npm run sandbox   # reference server on :4100
```

- Interactive docs: http://localhost:4100/docs
- Postman: import `spec/dist/apx-v1.yaml` (or the URL `/openapi.json`)
- Scripted end-to-end demo: `npm run demo`
- The deep dives: the 17-part written standard in `docs/standard/`
  (each Part covers one section above, normatively)
