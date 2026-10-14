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

| # | File | What it shows | Steps |
|---|---|---|---|
| 1 | `exit-lane-help-call.json` | Part 6 control: a remote gate vend as a tracked command, a barrier fault, a refusal with its reason, scopes | 13 |
| 2 | `lpr-entry-and-exit.json` | LPR: two camera vendors, one visit; lane cameras, movement and `accessEvent`; the server infers nothing | 14 |
| 3 | `validation-and-negotiated-rate.json` | Part 20 merchant validation, then a Part 6 negotiated amount at the exit, with the audit trail | 13 |
| 4 | `reservation-no-show.json` | Reservations on the simulated clock: a no-show happens on its own, subscribers are told | 14 |
| 5 | `violation-appeal-and-payment.json` | Part 19 (0.14.0): notice issued, the §19.4 safety gate refusing a weak case, appeal, reduction, payment | 13 |
| 6 | `webhook-retry.json` | Part 8 event delivery: an endpoint that is down, the retry schedule, pause and resume, nothing lost | 13 |
| 7 | `ev-charging-one-bill.json` | Part 23 EV charging end to end. Long (45 steps); use only if asked | 45 |

### A 20-minute slot

1, 2, 3. They start from what APDS already covers (lanes, sessions,
payments) and show what APX adds on top: commands with outcomes,
vendor-neutral plate reads, and validations and negotiated amounts that
stay attributable.

### A 45-minute slot

1, 2, 3, 5, 6, then 4 if there is time. Keep 7 in reserve for questions
about EV charging.

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

Say these if they come up; none of them affects the demos above.

- The simulator implements 165 of the bundle's operations.
  `node bin/apx-sim.mjs ops` lists the rest. Three LPR read routes are
  among them (`GET /v1/lpr/reads/{observation}`, `POST
  /v1/lpr/reads:search`, `PUT /v1/lpr/reads/{observation}/plate`).
- New violation cases get random ids, so those paths look long on screen.
- The violation demo's payment record is a reference only; it does not
  run the Part 13 payment flow.
