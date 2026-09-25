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
dropped ──park──▶ parked ──retrieve──▶ requested ──pickup──▶ retrieving ──stage──▶ staged ──handback──▶ handedBack ──▶ closed
   │               ▲  ▲                    │                     │                   │
   │               │  └──cancel-retrieval──┴─────────────────────┘                   │
   │               └──────────────────park (re-park)─────────────────────────────────┘
   │                             requested ──stage──▶ staged   (pickup is optional)
   ├──handback (before the car moved)──▶ handedBack
   └──cancel──▶ cancelled (custody never taken; terminal)
```

1. `park` is valid from `dropped`, MAY be repeated while `parked` to
   update `storage`, and re-parks a `staged` car the customer is not
   collecting yet (`staged → parked`: new `storage`, staging cleared,
   `retrieval.cancelledTime` set with `cancelReason: re-parked`).
   `retrieve` from `parked` — from `dropped` it is 409
   `valet-vehicle-not-located` (nobody knows where the car is yet), and
   a repeat while `requested` or `retrieving` is answered 200 with the
   current ticket (§22.3 rule 4). `pickup` from `requested`;
   `cancel-retrieval` from `requested | retrieving`; `stage` from
   `requested | retrieving`; `handback` from `staged`, or from `dropped`
   for a customer who changes their mind before the car moved; `cancel`
   from `dropped` only. Any other transition is 409
   `valet-transition-illegal`.
2. `requested → retrieving` is the runner picking the car up. The
   operator's app records it with `POST …/{id}/pickup`, which sets
   `retrieval.retrievingBy`; an implementation MAY instead infer it from
   its own runner assignment. The step is optional — `stage` directly
   from `requested` is conforming — but where it is recorded, `pickup`
   is the only API route that records it.
3. `handedBack → closed` is server-side when the APDS Session settles
   (paid, or comped); both are settled states. `cancelled` is terminal:
   `POST …/{id}/cancel` (with a `reason`) ends a drop-off whose custody
   was never taken — the driver left for the self-park deck
   mid-walk-around — and the server SHOULD close the APDS Session it
   opened at no charge.
4. Every transition appends `statusHistory[]` and publishes
   `apx.valet.ticket.status.v1`; `retrieve` additionally publishes
   `apx.valet.retrieval.requested.v1`.
5. **Server-written members (normative).** `ValetTicket` is both the
   create body and the resource. On `POST /v1/valet/tickets` the server
   MUST ignore any `storage`, `retrieval`, `handback`, `statusHistory`,
   or `recordInfo` the client sends — they are written only by `park`,
   `retrieve`, `pickup`, `stage`, `handback`, and the server itself, and
   `statusHistory[]` is the authoritative audit (Part 4 §4.2). `session`
   and `assignedRight` MAY be sent when the operator opened them before
   the drop-off call; otherwise the server opens the Session.
6. **Concurrency.** `park` accepts `If-Match` with the version last read
   (Part 4 §4.2a): two runners moving the same car get one 200 and one
   409 `version-conflict`, rather than a ticket pointing at a space the
   car is not in. Without `If-Match` it is last-writer-wins.

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
   `recordedTime`, never edits. `POST …/{id}/condition` is the route:
   it appends each `damage[]` entry to `dropOff.conditionReport.damage[]`
   with a server-set `recordedTime` and `recordedBy`, appends
   `imageLinks[]`, and records `notes` as a `statusHistory[]` entry
   without changing `valetStatus`. It is legal in every state except
   `closed` and `cancelled`, and never alters the report's original
   entries, `notes`, or `customerAcknowledged`.

## 22.3 Retrieval and the queue

`POST /v1/valet/tickets/{id}/retrieve` asks for the car: `channel` names
where the request came from (`sms`, `app`, `web`, `voiceBot`, `kiosk`,
`attendant`, `callCenter`), `requestedFor` schedules a pickup, and
`interaction` carries an opaque Part 17 §17.6 interaction id when a bot
or support channel raised it — no telephony identifiers in the contract.

1. The server MUST set `retrieval.etaMinutes` and `promisedTime` on
   every request. `promisedTime` is `requestedFor` for a scheduled
   pickup, else `requestedTime` plus the operator's estimate;
   `etaMinutes` is the whole minutes from now until `promisedTime`,
   never negative (`max(0, floor(promisedTime − now))`), recomputed on
   every read and event — so a 07:30 pickup booked at 22:10 reads 560
   and counts down. The customer-facing read (§22.5) is how a text, app,
   or bot shows "your car will be ready in 8 minutes".
2. `GET /v1/valet/queue?place=` returns tickets in `requested`,
   `retrieving`, or `staged` ordered by `promisedTime` — the runner
   board. Scheduled pickups appear once inside `horizonMinutes`.
3. `stage` records the car at the staging lane and SHOULD notify the
   customer's `contactChannel`; how (push, SMS, callback) is the
   implementer's — APX carries the state, not the message.
4. **Repeated requests.** Guests text twice. A `retrieve` while the
   ticket is already `requested` or `retrieving` returns 200 with the
   current ticket and ETA; nothing is appended to `statusHistory[]`,
   `apx.valet.retrieval.requested.v1` is not republished, and a
   `requestedFor` in the repeat is ignored (rescheduling is
   `cancel-retrieval` then `retrieve`). From `staged`, `handedBack`,
   `closed`, or `cancelled` it remains 409 `valet-transition-illegal`.

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
NOT list, park, pick up, stage, cancel, amend the condition report, or
hand back. Every ticket it receives — from `GET …/{id}`, `retrieve`, and
`cancel-retrieval`, and on any event subscription it holds — is
**minimized** to exactly these members:

- `id`, `version`, `place`, `ticketNumber`, `vehicle`, `valetStatus`,
  `extensions`;
- `customer.displayName`;
- `dropOff.time`;
- `retrieval.requestedTime`, `requestedFor`, `channel`, `etaMinutes`,
  `promisedTime`, `stagingLane`, `stagedTime`, `cancelledTime`;
- `handback.time`.

Everything else is omitted — `storage`, `statusHistory[]` (its `actor`
values are attendant principals), every other `dropOff` member
(including `keyTag` and the condition report), `retrieval.requestedBy`,
`retrievingBy`, `interaction`, the rest of `customer` and `handback`,
`session`, `assignedRight`, and `recordInfo`. A bot acting for the
customer uses the same scope and sets `channel: voiceBot` with an
`interaction` id.

**Tickets the caller may not see (normative, Part 9 §9.3a).** An
operator token (`apx.valet:read` or `:manage`) addressing a ticket at a
place outside its `apx_places` grant receives 403 `insufficient-grant`.
An `apx.valet:request` token addressing any ticket it is not bound to —
whether that ticket exists or not — receives 404 `target-not-found`, so
a claim link cannot be used to enumerate tickets.

## 22.6 Privacy

Plates, customer handles, and condition imagery are personal data under
Part 9 §9.6. `customer.contactChannel.handle` is opaque or masked;
implementations MUST NOT carry raw phone numbers or e-mail addresses on
the ticket (the contact system holds them, referenced by `contact`). A
server receiving one SHOULD refuse the request with 422
`personal-data-not-permitted` (`detail` naming the member) rather
than store it or mask it silently, so the integration that sent it
finds out.
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
| `POST /v1/valet/tickets`, `POST …/{id}/park`, `/pickup`, `/stage`, `/handback`, `/cancel`, `/condition` | `apx.valet:manage` |
| `GET /v1/valet/tickets`, `GET /v1/valet/queue` | `apx.valet:read` |
| `GET …/{id}` | `apx.valet:read`, or `apx.valet:request` (own, minimized) |
| `POST …/{id}/retrieve`, `/cancel-retrieval` | `apx.valet:manage`, or `apx.valet:request` (own) |

Every list is paginated in the APDS `PaginatedList` shape and constrained
to the caller's place grant.
