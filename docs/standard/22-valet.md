# APX Part 22 — Valet (optional class `apx-valet`)

Valet custody: taking a vehicle from its owner, knowing where it and its
keys are, bringing it back when asked — from a text, an app, a web page,
a voice bot, a kiosk, or the stand — and handing it to the right person
with the evidence to answer "that scratch wasn't there".

**A net-new surface.** APDS 4.1 has no valet entity; its only mention is
the `valetOnly` operating restriction. Everything is still built to APDS
conventions: the stay is a native `Session` (opened at drop-off, closed
at handback, priced by the place's rates), the claim ticket MAY be an
`AssignedRight`, the parked position is a `Space`, the customer a
`Contact`/`RightHolder` or Part 13 `Account`, money rides on the Session
and the Part 13 payment surface. APX adds only what APDS lacks: custody,
keys, condition evidence, the retrieval queue, staging, and handback, as
a `ValetTicket` that **references** the Session and never restates it.

## 22.1 ValetTicket and lifecycle

See schema. One ticket per custody: `vehicle`, `customer` (minimized),
`dropOff` (time, lane, attendant, mileage, fuel, key tag, items left,
condition report), `storage` (space or zone, key location), `retrieval`
(channel, requested/scheduled time, ETA, promised time, staging),
`handback` (verification, condition report), status, and the immutable
`statusHistory[]`.

**Lifecycle (normative).**

```
dropped ──park──▶ parked ──retrieve──▶ requested ──▶ retrieving ──stage──▶ staged ──handback──▶ handedBack ──▶ closed
   │                 ▲                     │              │
   │                 └──cancel-retrieval───┴──────────────┘
   └──handback (before the car moved)──▶ handedBack
dropped ──▶ cancelled (custody never taken; terminal)
```

1. `park` is valid from `dropped` (and MAY be repeated while `parked` to
   update `storage`); `retrieve` from `parked` only — from `dropped` it
   is 409 `valet-vehicle-not-located` (nobody knows where the car is
   yet); `cancel-retrieval` from `requested | retrieving`; `stage` from
   `requested | retrieving`; `handback` from `staged`, or from `dropped`
   for a customer who changes their mind before the car moved. Any
   other transition is 409 `valet-transition-illegal`.
2. `requested → retrieving` is the runner picking the car up; it is a
   server-recorded step (the operator's app marks it) with no separate
   API operation — implementations MAY expose it via `park`-style
   updates or infer it from the runner's assignment.
3. `handedBack → closed` is server-side when the APDS Session settles
   (paid, or comped); both are settled states. `cancelled` is terminal.
4. Every transition appends `statusHistory[]` and publishes
   `apx.valet.ticket.status.v1`; `retrieve` additionally publishes
   `apx.valet.retrieval.requested.v1`.

## 22.2 Drop-off and condition evidence (normative)

1. A drop-off SHOULD carry a `conditionReport`: free-text `notes`,
   structured `damage[]` entries (area, description, severity, image),
   and `imageLinks[]` for the walk-around or scan captures. Imagery is
   carried as access-controlled links under the same grant as the ticket
   (Part 9 §9.6), never inline.
2. `customerAcknowledged` records that the customer saw the report
   (signature, tap, spoken confirmation via a bot). Implementations
   SHOULD capture it; a damage claim is answered by comparing the
   drop-off and handback reports, and acknowledgement is what makes the
   drop-off report binding.
3. The drop-off condition report is immutable once the ticket leaves
   `dropped`; corrections are new `damage[]` entries with a later
   `recordedTime`, never edits.

## 22.3 Retrieval and the queue

`POST /v1/valet/tickets/{id}/retrieve` asks for the car: `channel` names
where the request came from (`sms`, `app`, `web`, `voiceBot`, `kiosk`,
`attendant`, `callCenter`), `requestedFor` schedules a pickup, and
`interaction` carries an opaque Part 17 §17.6 interaction id when a bot
or support channel raised it — no telephony identifiers in the contract.

1. The server MUST set `retrieval.etaMinutes` and `promisedTime` on
   every request and SHOULD recompute `etaMinutes` as the queue moves;
   the customer-facing read (§22.5) is how a text, app, or bot shows
   "your car will be ready in 8 minutes".
2. `GET /v1/valet/queue?place=` returns tickets in `requested`,
   `retrieving`, or `staged` ordered by `promisedTime` — the runner
   board. Scheduled pickups appear once inside `horizonMinutes`.
3. `stage` records the car at the staging lane and SHOULD notify the
   customer's `contactChannel`; how (push, SMS, callback) is the
   implementer's — APX carries the state, not the message.

## 22.4 Handback (normative)

1. The attendant MUST verify the claimant (`verificationMethod`: ticket,
   phone, one-time code, ID, or attendant recognition). A failed
   verification is 403 `valet-verification-failed` and MUST be recorded
   in `statusHistory[]` (attempted handback, method, actor) — a car
   handed to the wrong person is the incident the audit exists for.
   `verificationValue` is checked and discarded, never stored.
2. The handback `conditionReport` follows §22.2; `mileage` at handback
   against `dropOff.mileage` is the joyride check.
3. Money is not taken here. The APDS Session is closed and paid through
   the place's normal flow (pay station, Part 13 take-payment, a payment
   link, or an account); the valet fee is a rate line on the Session.
   Gratuities are out of scope for this edition.

## 22.5 Customer scope (normative)

`apx.valet:request` is the customer-facing scope for texts, PWAs, web
pages, and voice bots. A token carrying it (and not `:read`/`:manage`)
is confined to the ticket(s) it was minted for (the implementation binds
the token to the ticket at drop-off, e.g. via the claim link or code):
it MAY read those tickets, `retrieve`, and `cancel-retrieval`; it MUST
NOT list, park, stage, or hand back. The read is **minimized**:
`storage`, attendant principals, `dropOff.keyTag`, and condition images
are omitted; status, `retrieval.etaMinutes`, `promisedTime`,
`stagingLane`, `ticketNumber`, and the vehicle summary are returned. A
bot acting for the customer uses the same scope and sets
`channel: voiceBot` with an `interaction` id.

## 22.6 Privacy

Plates, customer handles, and condition imagery are personal data under
Part 9 §9.6. `customer.contactChannel.handle` is opaque or masked;
implementations MUST NOT carry raw phone numbers or e-mail addresses on
the ticket (the contact system holds them, referenced by `contact`).
Retention for condition imagery MUST be published; the drop-off report
SHOULD be retained at least as long as the operator's damage-claim
window.

## 22.7 Eventing

- `apx.valet.ticket.status.v1` — every transition (data: `ValetTicket`).
- `apx.valet.retrieval.requested.v1` — a retrieval was requested, with
  channel, ETA, and promised time (data: `ValetTicket`).

Place binding (Part 8 §8.5) uses `ValetTicket.place`. A
`apx.valet:request` subscription (where offered) receives only its own
ticket's events.

## 22.8 Endpoints (summary)

| Operation | Scope |
|---|---|
| `POST /v1/valet/tickets`, `POST …/{id}/park`, `/stage`, `/handback` | `apx.valet:manage` |
| `GET /v1/valet/tickets`, `GET /v1/valet/queue` | `apx.valet:read` |
| `GET …/{id}` | `apx.valet:read`, or `apx.valet:request` (own, minimized) |
| `POST …/{id}/retrieve`, `/cancel-retrieval` | `apx.valet:manage`, or `apx.valet:request` (own) |

Every list is paginated in the APDS `PaginatedList` shape and constrained
to the caller's place grant.
