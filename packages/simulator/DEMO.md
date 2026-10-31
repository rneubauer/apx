# Demo runbook

How to show APX with the simulator on a screen-shared call. Each demo is
a narrated scenario in `scenarios/`, played in the UI's **Present** view
one step at a time. Every answer on screen comes from the simulator and
is checked against the APX bundle; nothing is canned.

## Before the call

Run these from `packages/simulator`, the night before and again an hour
before the call:

```sh
node bin/apx-sim.mjs replay --summary          # expect 1559/1560, 0 failed (F-RSV-02 is the known gap)
for f in scenarios/*.json; do node bin/apx-sim.mjs run "$f" | tail -1; done   # every demo: N/N steps passed
```

Then start the server and open the UI:

```sh
node bin/apx-sim.mjs serve                      # http://127.0.0.1:4100/
```

Or present from the hosted copy, https://rneubauer.github.io/apx/simulator/
(press Ctrl+Shift+R first so it is the latest build). It is the same
simulator in the browser and cannot be stopped by the laptop; a reload
starts it over, so do not reload mid-story.

- Use one browser window, sized to the screen you share. Close other tabs.
- Pick the theme: **Light** reads better over most screen shares and
  projectors. Use the theme button in the header.
- Zoom the browser to 125–150% (Ctrl and +) if the audience will be on
  laptops.
- Open **Present**, pick the first scenario, and press R once so it
  starts from its world.
- Do not use `--host 0.0.0.0` on a call. Nobody else needs to reach it.

## Driving Present

| Key | What it does |
|---|---|
| → or Space | next step |
| ← | previous step |
| R | restart the scenario from its world |
| F | presenter full-screen mode (Esc leaves it) |

Each request step shows what it expected next to the server's answer,
with a tick per check. Say this once at the start: "the green ticks are
the simulator checking its own answer against what the standard
requires."

A few steps call `/sim/...` routes (`/sim/events`, `/sim/receivers`).
Those are the simulator's inspection windows, not APX routes. Say so
when one comes up.

## The demos

Each runs in 4–7 minutes if you read the narration and add a sentence.
Pick the world in Present (or the header) and its demos are listed first.

### The core story

| # | File | World | What it shows | Steps |
|---|---|---|---|---|
| 1 | `exit-lane-help-call.json` | apx-control | Part 6 control: a remote gate vend as a tracked command, a barrier fault, a refusal with its reason, scopes | 13 |
| 2 | `lpr-entry-and-exit.json` | apx-lpr | LPR: two camera vendors, one visit; lane cameras, movement and `accessEvent`; the server infers nothing | 14 |
| 3 | `validation-and-negotiated-rate.json` | apx-validations | Part 20 merchant validation, then a Part 6 negotiated amount at the exit, with the audit trail | 13 |
| 4 | `reservation-no-show.json` | apx-reservations | Reservations on the simulated clock: a no-show happens on its own, subscribers are told | 14 |
| 5 | `violation-appeal-and-payment.json` | apx-violations | Part 19 (0.14.0): notice issued, the §19.4 safety gate refusing a weak case, appeal, reduction, payment | 13 |
| 6 | `webhook-retry.json` | apx-events | Part 8 event delivery: an endpoint that is down, the retry schedule, pause and resume, nothing lost | 13 |
| 7 | `ev-charging-one-bill.json` | apx-charging | Part 23 EV charging end to end. Long (45 steps); use only if asked | 45 |

### Everyday operations

| # | File | World | What it shows | Steps |
|---|---|---|---|---|
| 8 | `card-in-card-out.json` | apx-accounts | §13.1a ticketless transient: a hold at entry, capture at exit, refusals for over-capture, void-after-capture and an unapproved refund | 11 |
| 9 | `monthly-parker-keycard.json` | apx-credentials | Part 21: a fob issued and activated, in and out, passback refused, reported lost, replaced in one call, the old fob refused | 14 |
| 10 | `monthly-permit-pool.json` | apx-permits | §14.2 pooled permits: a two-plate sale read back as stock APDS, an idempotent retry, renewal, sell-out (`pool-exhausted`), a slot coming back | 13 |
| 11 | `find-book-and-extend.json` | apx-reservations | §14.1 search to overstay: quote, book, move the booking, plate check-in, extend while parked, call-centre lookup by plate | 13 |
| 12 | `lost-ticket-found-by-plate.json` | apx-resolution | Part 17: the session found by plate, a payment link for the true fare, no lost-ticket fee | 8 |
| 13 | `valet-drop-off-and-retrieval.json` | apx-valet | Part 22: drop-off with condition report, "bring my car" by text, a wrong claim code refused, verified handback | 11 |
| 14 | `toll-passage-and-dispute.json` | apx-tolling | Part 15: transponder and plate-fallback passages, nightly billing, a wrong-vehicle dispute refunded | 11 |
| 20 | `plate-lists-watch-and-allow.json` | apx-plate-lists | Part 24: watch, scofflaw, allow and enforcement-fleet lists; an idempotent re-add; per-place flags; an edge camera keeping its copy current by change feed (a removal arrives as a tombstone); a listed car's arrival raising the alert | 14 |

### UI launch and site configuration (Parts 25 and 26)

| # | File | World | What it shows | Steps |
|---|---|---|---|---|
| 21 | `help-call-vendor-screen.json` | apx-ui-launch | Part 25: the PARCS has no `lostTicket` through APX, so Part 17 offers the vendor's screen (`execution.type: ui`); the host launches it signed in with a single-use url; what the agent does there comes back as the Command it would have been, carrying the call's `correlationId`; the launch record, the Command and the support interaction agree. Click "Open the vendor screen" on the launch step to drive the mock vendor console yourself | 14 |
| 22 | `after-hours-access-door.json` | apx-site-config | Part 26 §26.4 and §26.8: the lobby-door intercom is a comms point that serves the door; a paid parker is let in with `vendGate` on the door after a camera still; a permit holder's card opens it with no call; an expired permit puts the on-call supervisor behind the door, asked and answered through `POST /v1/approvals` (Part 17 §17.3a) | 12 |
| 23 | `site-configuration-tour.json` | apx-site-config | Part 26: a garage described from APX alone: equipment by lane, area and role with make, model, versions, serial and MAC; cameras and where they look; comms points by caller id and dialed number; another system's id resolved; a live view; per-place capabilities in discovery; a swapped terminal arriving as a change notice and through the change feed | 13 |

### Analytics (world `analytics-lakeside`)

A Tuesday evening at Lakeside with a day of data already in it: ten
transient visits and their payments, a Tower B monthly pool with six
permits sold, a day of plate reads at Riverside, and an outside BI vendor
(CityPark Analytics) that last synced at 17:00.

| # | File | What it shows | Steps |
|---|---|---|---|
| 15 | `analytics-transient-day.json` | A day of transient transactions: sessions and payments by date, a declined attempt kept, a live payment and a refund that is never counted twice (§13.4) | 13 |
| 16 | `analytics-monthly-parkers.json` | Pool uptake, who holds a permit, who parked today, an unused permit, a new sale reaching the warehouse by change feed | 11 |
| 17 | `analytics-plates.json` | Plate reads and privacy: refused without `apx.lpr:read`, refused without a key, repeat visits, two cameras counted once, a retention purge as a tombstone (§13.3b) | 14 |
| 18 | `analytics-occupancy-evening.json` | Occupancy over a concert night: unknown is reported as unknown, events only on material change, a missed evening recovered | 12 |
| 19 | `analytics-change-feed-sync.json` | An outside vendor's warehouse: APDS `modified_since`, then the §5.2 cursor feed with a deletion, retries, a refused cursor, a new grant backfilled, an expired cursor | 13 |

### The Fabric view (live delivery)

Not a scenario: a live view of Part 8, for when you want the room to see
events flowing rather than read them step by step. See
[The Fabric view](#the-fabric-view) below.

### A 20-minute slot

1, 2, 3. They start from what APDS already covers (lanes, sessions,
payments) and show what APX adds on top: commands with outcomes,
vendor-neutral plate reads, and validations and negotiated amounts that
stay attributable. Finish with two minutes of the Fabric view.

### A 45-minute slot

1, 2, 3, then the Fabric view (5 minutes), then one analytics demo (15
or 19), then 5 or 6. Keep 7 in reserve for EV charging, and 8–14 and 20
for whichever module a vendor in the room cares about. For a call-center
or PARCS-vendor audience, swap 5 for 21 (the vendor screen) and add 23
(a site from APX alone): together they are the answer to "we have a
portal, not an API".

## The Fabric view

The **Fabric** tab shows the Part 8 delivery fabric live: every event as
it is published, every subscriber, and each delivery attempt with its
status code and a countdown to the next retry on the §8.3 schedule (0 s,
30 s, 2 min, 10 min, 1 h, then hourly up to 24 h).

1. Open **Fabric**. If the world has no subscribers it offers **Load
   apx-events**: two webhook subscribers, ops-monitor (every `apx.*`
   topic) and regional-auditor (four topics).
2. **▶ Start traffic.** The clock switches to Live and a mix of vehicles,
   device states, occupancy and payments starts flowing. The coloured dots
   on each event show which subscribers it went to. Set the rate (6–240 a
   minute) and the mix with the controls.
3. **+ SSE subscriber** or **+ Webhook subscriber** adds a real
   subscription through `POST /webhooks`.
4. On ops-monitor, **Make endpoint fail**. Its deliveries turn amber:
   `#1 503`, `retry #2 in 0:29`. Then **Recover endpoint**: the retries
   land on schedule and every event is delivered. Use +1m / +5m in the
   header rather than waiting.
5. On an SSE card, **Drop client**, wait, then **Reconnect**: it catches
   up from `Last-Event-ID` (§8.4) and says how many frames it caught up.

Grey "no match" events are expected: APDS-native `PlaceUpdated` and
anything at Harbor Deck match nobody's topics or places. That is §8.5
place binding working; say so. **Frozen** in the header pauses the
traffic; Reset clears it.

## Talking points

**1. Exit lane help call.** A vend is a command with a record, not a
fire-and-forget. The Idempotency-Key means a double-click cannot open the
gate twice. When the barrier is faulted the PARCS still takes the request
(202) and then refuses it on the command, with the reason. That is the
PARCS's call, not the caller's. The wallboard's read-only token is
refused before anything reaches the lane.

**2. LPR entry and exit.** The cameras post plain APDS Observations.
APX adds which way a lane camera faces, the vehicle's movement, and
whether the read was an entry or an exit. Step 10 is the point to stop
on: the server does not guess an exit from a read it cannot place. The
LPR system revises it, and the visit closes at the capture time, not
at the time of the revision.

**3. Validation and negotiated amount.** The operator owns the program
and its rules; the merchant only redeems. The server returns the actual
effect on the ticket, not the nominal benefit. A negotiated amount needs
an agent and a reason, and both end up on the ticket and the command
record.

**4. Reservation no-show.** `noShowAfter` is set by the server and
visible from the start, so nobody argues about when the grace ended. The
lapse happens when the clock passes it, with no request from anyone. A
late driver gets an ordinary session; the expired reservation cannot be
attached to it.

**5. Violation appeal and payment.** The policy version, the posted
sign and the amount cap are frozen onto the notice when it is issued.
Step 6 shows a 0.14.0 rule: a case resting on a lenient plate match
cannot be issued. Then appeal, reduction to the parking fee, and
payment, each one published.

**6. Webhook retry.** The same envelope is delivered on every attempt,
re-signed each time, on the Part 8 schedule. A paused subscription holds
events and delivers them on resume. The delivery ledger is a normal APX
route the subscriber can read.

**Analytics (15–19).** APX gives an analytics consumer the records, kept
in sync without gaps, not totals. Every count on screen is the consumer
adding up records it pulled, and the change feed is how it stays current
without re-downloading. Plates are behind their own scope and a lookup
key, so a BI tool cannot turn the LPR route into an export. Expect the
question "where are the reports?": APX has no aggregate endpoints today.
That is a fair item for the committee to decide on purpose.

**Plate lists (20).** The list owner (the operator, or the city for
scofflaws) maintains the lists centrally; the lane decides locally from a
copy it keeps current with the change feed, so a plate check at the gate
never waits on the network. A plate added twice is updated, not
duplicated, so a nightly reload is safe to repeat. Good moment to raise the
scale question: today entries are added one request at a time.

**Fabric view.** Make the endpoint fail while traffic is running and let
the room watch the retries count down, then recover it and watch every
event arrive. The point is that a subscriber that goes down for a deploy
loses nothing, and the schedule is the same for every vendor.

## If something goes wrong

- **A step fails on screen.** Press R and run the scenario again from its
  world. If it fails again, move to the next demo and say you will
  follow up. Do not debug live.
- **The laptop or the local server misbehaves.** Open the hosted copy,
  https://rneubauer.github.io/apx/simulator/. It is the same simulator
  running in the browser, with the same demos.
- **The page stops updating.** The header clock shows *offline* if the
  server stopped. Restart `node bin/apx-sim.mjs serve` and reload the
  page.
- **Someone asks for something off-script.** Use **Explore**: any route,
  as any credential, against the same world. Press R in Present
  afterwards to get back to a clean world.
- **Someone asks about their own module.** Click that world's chip in
  Present (apx-lpr, apx-tolling, …). Under its narrated demo, if it has
  one, are the vetting cases the standard was tested against, grouped as
  happy path, lifecycle, edge, refusal and security. Any of them runs
  step by step like a demo.
- **Someone asks what happens if nobody presses anything.** Switch the
  header to **Live** and use Explore: commands complete, retries go out
  and reservations lapse on their own. Switch back to **Frozen** before
  presenting again.

## Known limits

Say these if they come up; none of them affects the demos above. In the
hosted copy, traffic in the Fabric view runs only while the tab is open,
and SSE subscribers are simulated (a real SSE client cannot connect to a
page).

- The simulator implements every operation in the bundle (185 of 185;
  `node bin/apx-sim.mjs ops`). Where the standard leaves a choice open
  (how a rate table prices a quote, which place a multi-place plate list's
  event is bound to), the simulator makes one and it is not normative.
- Plate lists hold the lists and raise the arrival alert (§24.4); refusing
  service at the lane stays with the implementation, as the standard says,
  so the simulator does not gate on it.
- New violation cases get random ids, so those paths look long on screen.
- The violation demo's payment record is a reference only; it does not
  run the Part 13 payment flow.
