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
| `GET /v1/discovery` | **Ask what YOU can do.** Returns exactly the endpoints, commands, event topics, and facilities available to *your* credential |

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
| **Occupancy snapshot** | `GET /v1/places/{id}/occupancy` | "How full is it right now" for one garage/level/zone — supply, latest demand count, and a derived `available` — without pulling the whole Place hierarchy |

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
| `GET /v1/events/stream` | Live **Server-Sent Events** stream of the same events, with resume-after-disconnect |

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

**For analytics platforms:** one subscription can carry a location's entire
story — session lifecycle (APDS's native topics), every recorded payment
(`apx.accounts.payment.recorded.v1`), every camera/sensor read
(`apx.data.observation.created.v1`), occupancy movement
(`apx.data.occupancy.v1`), plus alerts and command outcomes. Pair that with
the §4 change feed for backfill and a BI engine gets full-fidelity data on
a facility — financial, LPR, utilization — with no bespoke exports.

---

## 6. Control: doing things in the real world

The part no data standard covers — actually operating the facility:

| Route | What it does |
|---|---|
| `POST /v1/commands` | Execute an action: **vendGate**, **lostTicket**, **pushRate**, **applyValidation**, holdGateOpen, closeLane, setDeviceState, displayMessage, restartDevice |
| `GET /v1/commands/{id}` | Follow the command's lifecycle |
| `POST /v1/commands/{id}/cancel` | Cancel before it dispatches |
| `GET /v1/lanes/{id}/current` | **Screen-pop:** the ticket in the machine right now — amount due, applied validations, the plate photo, and (for monthly parkers) whether access was denied and why, with the last 10 events |
| `GET /v1/devices` · `/{id}` | Live device state (available/occupied/fault/…) for every gate, pay station, camera |
| `GET /v1/validations/providers?place=…` | Which businesses may validate tickets at this facility |

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
| `POST /v1/alerts` | Raise an alert (idempotent — device retry storms can't create duplicates) |
| `GET /v1/alerts` | Filter by status, severity floor, type, facility, time |
| `POST /v1/alerts/{id}/acknowledge` · `/resolve` | Work the alert; every transition is recorded |

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
| `GET /v1/accounts?name=\|phone=\|card=\|plate=` | Find a (monthly) parker's account and balance by whatever the caller knows |
| `POST /v1/payments` | Take a payment (idempotent). `method: autoAttendant` = a PCI-compliant phone system captures the card out of band |
| `POST /v1/payments/{id}/postings` | Write the payment back to the accounting system (e.g. PARIS) → confirmation number + new balance |
| `GET /v1/payments?ticketLast4=…` | Payment history on a ticket |

**Why this way:** the flow mirrors the real call: *"I can't get out"* →
look up the account by phone number → see the balance → take payment via the
secure IVR → post it back → the gate opens. **APX never carries card
numbers** — the standard deliberately keeps every implementer out of PCI
scope by referencing payments, not processing them. One privacy rule is
baked in: last-4 ticket lookups only reach back 8 hours, so the convenience
feature can't be used to trawl history. Every recorded payment also
publishes `apx.accounts.payment.recorded.v1`, so finance and BI systems get
the revenue stream in real time instead of scraping reports.

---

## 9. Plates: LPR

| Route | What it does |
|---|---|
| `POST /observations` | How camera reads enter the system (a standard data route — nothing special to build) |
| `GET /v1/lpr/reads?plate=…` or `?ticket=…` | The cross-lookup: plate → ticket/session (with confidence score and the photo), or ticket → plate |
| `detail` on a read | What the camera actually knew: plate, state, make, model, colour **each with its own confidence**, the runner-up plate strings, how many plates it read, which plate face it saw (front or rear), and whether the car was approaching, receding, or stopped |
| `laneTravel` on a read | The server's call from all of that plus the lane's configured direction: with the lane, or **against** it — the gateless "they came in through the exit" signal, which raises a `wrongWayTravel` alert |

**Why this way:** LPR vendors shouldn't need a bespoke ingestion API — a
plate read *is* an observation, so ingest is the standard route every data
integration already uses. The only genuinely new need is the *join* ("which
ticket goes with this plate?"), so that's the only new endpoint. Each
ingested read also publishes `apx.data.observation.created.v1`, so analytics
consumers can stream the raw sensor feed rather than polling. The extra
detail rides *inside* the standard observation as a namespaced block, so a
camera that knows more can say more without breaking a reader that only
speaks plain APDS — and the "which way was it going" answer is computed
once, by the system that knows the lane, rather than by every consumer.

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
| `GET /v1/permits/pools/{id}/availability` | capacity / issued / available |
| `POST /v1/permits/issue` | Issue a permit — one permit can carry **multiple vehicle plates** (family/fleet), refused cleanly when the pool is exhausted |

**Why this way:** every parallel "booking object" ever invented eventually
disagrees with the ticket system it shadows. By making the reservation *be*
the parking right, there is nothing to reconcile: the reservation, the
permit, and the thing the gate checks are the same object.

---

## 11. Tolling

The one fully new domain — connecting roadside reads to money:

| Route | What it does |
|---|---|
| `POST /v1/tolling/transactions` | Create a toll charge from plate/transponder reads + a price (idempotent — gantries retry) |
| `GET …?plate=&status=` · `GET …/{id}` | Query transactions |
| `POST …/{id}/payment` | Attach the settling payment |
| `POST …/{id}/disputes` · `…/disputes/resolve` | The dispute lifecycle ("that wasn't my car") with a full audit history |

**Why this way:** tolling is evidence-based billing, so a transaction keeps
its chain intact: the camera reads it was built from → the price applied →
the payment that settled it → any dispute and its resolution. Every link is
a reference to an object elsewhere in this same API.

---

## 12. Violations: enforcement, from camera to citation to appeal

One resource — a **Violation** — for what operators call tickets, notices,
warnings, or citations. Two ways of finding them are first-class:
**automated** (a camera or sensor pipeline detects and, if policy allows,
issues with no human in the loop) and **guided** (the system flags a
candidate, an officer with a handheld confirms on site).

| Route | What it does |
|---|---|
| `GET /v1/enforcement/eligibility?credential=&place=` | **The handheld screen-pop:** is this vehicle entitled to be here right now, and by what — permit, reservation, pay-by-plate session — with why not (expired, wrong zone) and a suggested violation type |
| `POST /v1/violations` | Record a detection (idempotent — cameras and handhelds retry). The server runs the eligibility check and keeps the answer on the record |
| `GET /v1/violations?plate=&status=&place=` · `GET …/{id}` | Query and read, with evidence links and the full audit trail |
| `POST …/{id}/review` | Guided enforcement: the officer confirms or dismisses the candidate |
| `POST …/{id}/issue` | Issue the notice or citation — amount, due date, how it was delivered |
| `POST …/{id}/payment` | Attach the settling payment (taken through the Money section — nothing new to build) |
| `POST …/{id}/appeals` · `…/appeals/resolve` | "That wasn't my car" — upheld, reduced, or dismissed, with audit |
| `POST …/{id}/void` | Void; the record and its history stay readable |
| `GET /v1/enforcement/policies/effective?place=` · `POST` / `PUT /v1/enforcement/policies` | **The law, machine-readable, per location:** which notice methods are lawful for which detections and by when, the penalty cap over the unpaid fee, the escalation schedule after 30/60 days with a ceiling, the appeal window. The server enforces it at issue and runs the escalation itself |
| `GET /v1/enforcement/signage/effective?place=` · `POST` / `PUT /v1/enforcement/signage` | **What the sign said:** posted text (per language), a photo, where it stands, and when it was in force. Frozen onto every violation at issue, so the appeal sees the sign the officer saw |

Every violation also carries where it happened and from where it was
seen (GeoJSON, in the same shape APDS uses for camera observations).

**Why this way:** APDS already says assigned rights are what enforcement
systems check against — so APX composes that answer rather than inventing
an entitlement model. Every violation keeps its evidence chain (camera
reads → eligibility check → notice → payment → appeal) as references to
objects elsewhere in this same API, and a guided detection can never be
issued without a human's confirmation on the audit trail.

---

## 13. Validations: the merchant side, from enrolment to invoice

Section 6 showed the two pieces a call center needs — *who may validate
here* and *apply one to this ticket*. This section is everything the
operator does around them:

| Route | What it does |
|---|---|
| `POST /v1/validations/programs` · `PUT …/{id}` | Enrol a merchant: what the validation is worth, the rules (per-ticket and per-day caps, expiry, stackable), who pays and how, and how stock is issued. Suspend or end it later |
| `POST …/programs/{id}/issuances` | Hand out a batch of codes, QR codes, or stamp stock — the codes come back exactly once |
| `GET /v1/validations/instruments/{code}` | "Is this code good?" — what a pay station or the restaurant's iPad asks before applying |
| `POST /v1/validations/redemptions` | Record the validation from any channel (pay station, merchant app, lane). The agent's `applyValidation` command lands in the same ledger |
| `GET …/redemptions?program=&ticket=` · `POST …/{id}/reverse` | Query the ledger; reverse a mistake |
| `GET …/programs/{id}/statement` · `POST …/statements` | Preview a billing period, then close it into an immutable statement accounting invoices from |

Merchants get their own scope: a restaurant's app can check codes, issue
its own stock, and record redemptions for its own program, and nothing
else.

**Why this way:** APDS records that a validation happened on a session
but has no notion of a merchant program — so this adds the program and
keeps the APDS record as the thing that actually reduces the amount due.
Every redemption carries the *actual* reduction, not the nominal benefit,
so month-end billing is evidence, not estimate.

---

## 14. Credentials: the card, the fob, the tag, the phone

Monthly parkers get a keycard, a windshield tag, a fob, or a phone
credential — and lose them, lend them, and stop paying for them. APDS
knows a credential only as a line on the parker's assigned right. This
section manages its life:

| Route | What it does |
|---|---|
| `POST /v1/credentials` | Issue one — the read technology (RFID, Bluetooth, plate…), the value the lane reads, the physical form and serial, the deposit, who it belongs to and where it works |
| `GET /v1/credentials?account=&identification=` · `GET …/{id}` | Find it by account, holder, card number, status, or facility |
| `POST …/{id}/suspend` · `/resume` · `/report-lost` · `/revoke` | Change what it can do — every change lands on the parker's assigned right at the same instant, so the gate agrees with the office |
| `POST …/{id}/replace` | "I lost my card" in one call: the new one is issued and active, the old one dead, deposits settled |
| `GET …/{id}/access-events` | Every time it was presented: where, which direction, granted or denied, and why — the "why was I denied?" answer |

**Why this way:** the record and the right are one truth. An active
credential is written onto the APDS assigned right; a suspended or lost
one is taken off it. Any lane that only speaks APDS still refuses the
lost card at 6 PM because the office replaced it at noon — no second
list to keep in sync.

---

## 15. Valet: custody, keys, "bring my car", and the scratch that wasn't there

Hotels, hospitals, restaurants, and event venues hand cars to
attendants all day, and every valet operator has its own app for it.
This section is the shared shape:

| Route | What it does |
|---|---|
| `POST /v1/valet/tickets` | Take custody: the car, the customer (minimized), mileage and fuel, the key tag, and a **condition report** — notes, per-panel damage entries, walk-around photos, customer acknowledgement |
| `POST …/{id}/park` | Where it went and where the keys are |
| `POST …/{id}/retrieve` | "Bring my car" — from a text, the app, a web page, a voice bot, a kiosk, or the stand; comes back with an ETA and a promised time |
| `GET /v1/valet/queue?place=` | The runner board: everything requested, being fetched, or staged, in promised-time order |
| `POST …/{id}/stage` · `/handback` | Car at the staging lane; car handed to a **verified** claimant with a handback condition report and mileage |
| `GET …/{id}` (customer scope) | What the customer's phone shows: status and "ready in 8 minutes" — nothing about where the car or the keys are |

**Why this way:** the stay and the money are the APDS session, untouched.
What APDS has no words for is custody — who has the keys, where the car
is, when it was asked for, who it was handed to — and evidence. The
drop-off condition report, acknowledged by the customer, is what settles
"that scratch wasn't there" a week later; the handback report and
mileage settle the rest.

---

## 16. EV charging (experimental): the free charger, the car that isn't plugged in, and one bill at exit

> On branch `beta/ev-charging`; the class is proposed, not registered.

Chargers have their own protocols — OCPP between a charger and its
network, OCPI between networks — and APX does not replace them. What the
parking system needs is the *parking side*: which chargers are free,
what is physically in the bay, and what a charge did to the parking
bill.

| Route | What it does |
|---|---|
| `GET /v1/charging/points?place=` | Live status per charger and connector: available, occupied, charging, reserved, blocked, out of order — and what the **overhead camera** sees: empty, vehicle plugged in, vehicle **not** plugged in, bay blocked |
| `POST …/points/{id}/bay` | The camera (or a sensor, or an attendant) reports what is in the bay; the server fuses it with the charger's cable state. A car in the EV bay that never plugs in becomes a fact with a photo behind it, not a complaint |
| `POST /v1/charging/sessions` · `POST …/{id}/events` | The bridge opens the charge and reports its timeline — plugged in, charging, meter values, complete, unplugged — the way OCPP already reports it. Idle after complete is the **server's** call, after a grace period the session snapshotted up front |
| `GET …/sessions/{id}` (customer scope) | What the driver's app shows: state of charge, kWh, "10 minutes grace, then $0.40/min", cost so far — no plate, no network ids |
| `settlement.mode` | `parkingSession` — energy and idle are lines on the parking stay, paid once at exit; `directPayment` — its own payment; `chargingNetwork` — the network bills, parking keeps the record |
| `POST /v1/commands` with `unlockConnector` | The cable won't release: the same command plane as the gate, with the same honesty about what was actually confirmed |

**Why this way:** APDS already describes every charger, connector, and
kilowatt-hour statically; it has nothing live and nothing that ties a
charge to a stay. Camera occupancy and charger state each see half the
picture; fusing them in the parking system is what makes "there's an ICE
in the EV bay" enforceable and "your car is done, move it" fair.

---

## 17. Room to grow: the vendor space

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

## 18. Not everything is mandatory: conformance classes

APX is sliced into named, independently claimable feature sets — `apx-data`
and `apx-events` are the base; control, alerts, discovery, accounts,
payment-history, LPR, reservations, permits, tolling, violations,
validations, credentials, and valet are each optional.
A server advertises its classes in its bootstrap document, and the
written standard defines objective conformance requirements for each
class an implementation claims.

**Why this way:** an LPR vendor shouldn't have to build tolling to say
"we support APX." Classes make partial adoption honest — and per-class
conformance requirements make the claim testable rather than aspirational.

---

## Explore it in five minutes

- Postman / Swagger UI: import `spec/dist/apx-v1.yaml`
- PARCS vendors: the slim profile subset `spec/dist/apx-parcs.json`
- The deep dives: the written standard (Parts 0–22 + Annex A) in `docs/standard/`
  (each Part covers one section above, normatively)
