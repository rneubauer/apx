# APX simulator

A stateful simulator of the APX standard: every APX and APDS-native route
in the bundle, served by one process with a simulated clock, a place
hierarchy with grants, the Part 8 event fabric (signed webhooks on the
normative retry schedule, SSE with `Last-Event-ID`), and one behaviour
module per conformance class. It exists so a scenario can be *run*, not
just read: the by-module vetting suite in `docs/scenarios/by-module`
replays against it, and new scenarios can be scripted as JSON.

Nothing here is normative. The bundle (`spec/dist/apx-v1.json`) is the
contract; the simulator validates every request it accepts and every
response it returns against it, and reports its own violations.

## Quick start

```sh
cd packages/simulator
node bin/apx-sim.mjs serve                 # http://127.0.0.1:4100 (UI at /), world "default"
node bin/apx-sim.mjs token lakeside-parcs  # a bearer token for a named credential
node bin/apx-sim.mjs replay                # replay every module's vetting scenarios in-process
node bin/apx-sim.mjs replay control --verbose
node bin/apx-sim.mjs run scenarios/ev-charging-one-bill.json --verbose
node bin/apx-sim.mjs ops | tail -1         # how many of the bundle's operations are implemented
```

Point a real client at it like any APX server:

```sh
TOKEN=$(node bin/apx-sim.mjs token lakeside-parcs)
curl -s http://127.0.0.1:4100/v1/lanes/b2000000-0000-4000-8000-000000000002/current \
  -H "Authorization: Bearer $TOKEN"
curl -s http://127.0.0.1:4100/.well-known/apx-configuration
curl -s -X POST http://127.0.0.1:4100/oauth/token -d 'grant_type=client_credentials&client_id=lakeside-parcs'
```

## The browser UI

`node bin/apx-sim.mjs serve` also serves a UI at http://127.0.0.1:4100/
(the root redirects to `/ui/`). It has three views:

- **Present** walks an audience through a scenario one step at a time:
  the step's title and narration, who acts and what they send, the
  server's answer, and the events the step published. Next to the answer,
  an "Expected vs actual" checklist shows each assertion the step makes
  (status, problem type, each field of the partial body, event counts) with
  a pass mark, or the value that actually came back when it failed. Arrow
  keys or Space advance, R restarts from the scenario's world. F (or the
  Presenter mode button) goes full screen for a talk or a screen share:
  the app header and step list are hidden, the title and narration are set
  large, the request sits beside the answer, and a small step counter and
  progress bar stay at the top. The same keys work there; Esc or F leaves.
  If the browser refuses full screen, the mode still hides the chrome.
- **Build** creates and edits scenarios: requests (with expected status,
  problem type, partial body, and values saved for later steps), world
  events with worked examples, clock steps, and event checks. Steps run
  one at a time or all at once; Save writes `scenarios/<id>.json`, the
  same file `apx-sim run` reads.
- **Explore** is a request console (any route, as any credential), the
  world-event panel, the event outbox, stored state, the operation list,
  and the request log. The outbox can be filtered by event type. Any
  request or world event can be added to the open scenario with one
  click.

The header carries the APX edition the simulator serves, the world
picker, the clock with its state (frozen, live under `--realtime`,
running while a step runs, offline if the server stops answering), and
a theme button: Auto follows the OS, or pin Light (often better on a
projector) or Dark. The page follows the simulator live over
`GET /sim/stream`, a simulator-internal `text/event-stream` of small
change notices (`clock`, `reset`, `event`, `delivery`, `request`,
`store`; a heartbeat comment every 15 s) that is separate from the APX
SSE subscription transport, so the clock, outbox, log and state update
the moment anything changes them, from this page or any other client; if
the stream is unavailable it falls back to polling `GET /sim` every 2 s. JSON blocks are formatted and tinted; click the line
that opens an object or array to fold it, and use Copy or Expand at the
block's top right. The UI is plain HTML, CSS and JavaScript with no external
assets, so it works offline. Browser zoom (Ctrl/Cmd and +) scales it
for the back of a room; above 1800 px wide it already sets larger type.
`scenarios/` holds seven narrated demos; [DEMO.md](DEMO.md) is the runbook for showing
them on a call (checks to run first, which demos for which slot, talking
points, and what to do if a step fails).

To show it to people on other machines, bind to the network with
`--host 0.0.0.0` and share the address. Anyone who can reach the port
can drive the simulator and save scenario files, so do this only on a
network you trust.

## What makes it a simulator

- **The clock is frozen** unless started with `--realtime`. Anything that
  happens "later" (a command dispatching, a webhook retry, an alert
  expiring, a reservation becoming a no-show, a charging session going
  idle) is scheduled on the simulated clock and fires when the clock
  passes it: `POST /sim/clock {"advance": "PT5M"}` or `{"now": "…"}`.
- **Worlds** are the fixtures a run starts from: `worlds/<name>.json`
  (organisations, places, lanes, devices, credentials, rate tables,
  sessions, and per-domain seed sections). Ids may be written
  `b1…0001`. `POST /sim/reset {"world": "apx-violations"}` loads one.
- **Injectors** make the world act: `POST /sim/inject {"kind":
  "vehicleArrives", "lane": "b2…0002", "plate": "SYN-1234"}`,
  `deviceState`, `commandOutcome`, `plateRead`, `paymentOutcome`,
  `gantryRead`, `lprDetection`, `chargerEvent`, … (`GET /sim/injectors`).
- **Receivers** stand in for webhook endpoints: every subscription
  endpoint gets an inbox and a programmable list of response codes
  (`PUT /sim/receivers {"endpoint": "…", "codes": [500, 500, 200]}`), so
  the retry schedule and the failure cascade can be watched without a
  network. `--network` posts to real endpoints instead.
- **Tokens** can be minted (`POST /sim/token`, `POST /oauth/token`), named
  (`Bearer lakeside-parcs`), or *descriptive*, the way the vetting suite
  writes them: `Bearer <apx.data:read only>`, `Bearer <expired>`,
  `Bearer <no apx_places claim at all>`,
  `Bearer <apx.valet:request, bound to d8…0419>`.
- **Everything is inspectable**: `GET /sim` (status), `/sim/state[/coll]`,
  `/sim/events`, `/sim/deliveries`, `/sim/receivers`, `/sim/log`,
  `/sim/contract` (responses that failed the bundle's own schema).

## Replaying the vetting suite

`node bin/apx-sim.mjs replay [module…]` reads
`docs/scenarios/by-module/<module>/scenarios.md`, loads
`worlds/<module>.json`, and sends every exchange in order. It checks the
status code, the problem type of a refusal, and that the response
validates against the bundle (bodies are narratives, not fixtures, so
they are not compared member by member). Three fixtures are derived from
the scenario text: the `Authorization` header from the ```http block,
`X-Sim-Assign-Id` from the id a 2xx response shows, and `X-Sim-Now` from
the latest instant the expected response shows. World events the prose
describes but no request performs (a gate faulting, a day passing, a
deck pushed without a line) are *stage directions* in
`tools/directions/<module>.json`.

## Scripting a scenario

`node bin/apx-sim.mjs run <file.json>` runs steps against a world:
`clock`, `inject`, `request` with `expect` (`status`, `problem`, a
partial `body`), `save` (`{"cmd": "$.id"}` for later `{cmd}`
substitution), `events` and `deliveries` assertions. See
`scenarios/ev-charging-one-bill.json`, which walks worked scenario 26
end to end, and `tools/script.mjs` for the format.

## Extending it

One module per conformance class in `src/domains/`, auto-discovered;
`CONTRIBUTING-DOMAINS.md` is the contract (handler context, refusals,
records, events, time, worlds, directions, and the acceptance test).
The kernel in `src/kernel/` owns routing, authentication, scopes, body
validation, idempotency, the clock, the store, the hierarchy and the
event fabric; domains own behaviour.
