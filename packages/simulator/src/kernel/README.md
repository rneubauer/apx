# src/kernel

The core of the simulator. It has no knowledge of any one conformance class;
those are in [`../domains/`](../domains/README.md). Part of the
[simulator](../../README.md).

- `http.mjs`: request dispatch. One pure function that the HTTP server, the replay runner and the tests all use: sim control, token endpoint, route match, authentication, scope, body and schema checks, idempotency, the domain handler, then a response-schema check.
- `auth.mjs`: authentication and the Part 9 claims model; the bearer-token forms the simulator accepts.
- `spec.mjs`: the bundle indexed: operations by method and path, request and response validators, scopes, and the registries.
- `problems.mjs`: the Part 12 problem types, read from `docs/standard/12-errors.md`.
- `store.mjs`: in-memory collections with the `ApxResourceCore` conventions: ids, versions, provenance, tombstones and the idempotency ledger.
- `places.mjs`: the place hierarchy and the Part 9 §9.3 grant rule.
- `world.mjs`: loads worlds, the fixtures a run starts from.
- `clock.mjs`: the simulated clock, frozen by default, with the timers the domains schedule.
- `events.mjs`: the Part 8 delivery fabric: envelopes, subscription matching, signed webhooks, retries, the ledger, SSE buffers and the failure cascade.
- `fabric.mjs`: the delivery fabric at a glance for the UI's Fabric view.
- `traffic.mjs`: the traffic generator behind `POST /sim/traffic`.
- `live.mjs`: the UI's live stream, `GET /sim/stream`.
- `sim-api.mjs`: the simulator's own control routes under `/sim`.
- `sim-scenarios.mjs`: the `/sim` routes behind the scenario builder and presenter.
- `scenario.mjs`: scenario steps, shared by the CLI runner and the browser UI.
- `vetting.mjs`: the vetting suite (`docs/scenarios/by-module`) as the simulator reads it.
- `ui.mjs`: serves the browser UI from [`../../ui/`](../../ui/README.md).
