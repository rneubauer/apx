# APX vetting scenarios, by module

The worked scenarios one folder up tell 26 end-to-end stories. This
folder is the test bench underneath them: **377 scenarios**, one set per
conformance class, written to find the places the spec could not say what
a real deployment needs. Every request and response in them is checked
against the bundled spec (`spec/dist/apx-v1.json`), and what the spec
could not express is recorded, module by module, as a finding. Most
findings have since been fixed in the spec; the Status column of each
findings table says how.

## Modules

| Module | Scenarios | Operations | Responses | Annex A rows | Findings |
|---|---|---|---|---|---|
| [`apx-accounts`](apx-accounts/scenarios.md) (incl. `apx-payment-history`) | 26 | 11/11 | 73/73 | 7/8 | [14](apx-accounts/findings.md) |
| [`apx-alerts`](apx-alerts/scenarios.md) | 22 | 5/5 | 30/30 | 5/6 | [9](apx-alerts/findings.md) |
| [`apx-control`](apx-control/scenarios.md) | 25 | 8/8 | 41/41 | 14/14 | [10](apx-control/findings.md) |
| [`apx-credentials`](apx-credentials/scenarios.md) | 26 | 11/11 | 71/71 | 6/6 | [11](apx-credentials/findings.md) |
| [`apx-data`](apx-data/scenarios.md) | 33 | 35/35 | 202/204 | 8/8 | [16](apx-data/findings.md) |
| [`apx-discovery`](apx-discovery/scenarios.md) (incl. `apx-mtls`) | 16 | 2/2 | 6/6 | 7/7 | [14](apx-discovery/findings.md) |
| [`apx-events`](apx-events/scenarios.md) (incl. `apx-events-sse`) | 24 | 7/7 | 41/41 | 9/9 | [17](apx-events/findings.md) |
| [`apx-lpr`](apx-lpr/scenarios.md) | 35 | 4/4 | 25/25 | 6/6 | [19](apx-lpr/findings.md) |
| [`apx-permits`](apx-permits/scenarios.md) | 15 | 2/2 | 13/13 | 2/2 | [12](apx-permits/findings.md) |
| [`apx-reservations`](apx-reservations/scenarios.md) | 24 | 3/3 | 21/21 | 3/3 | [16](apx-reservations/findings.md) |
| [`apx-resolution`](apx-resolution/scenarios.md) | 28 | 12/12 | 73/73 | 8/9 | [13](apx-resolution/findings.md) |
| [`apx-tolling`](apx-tolling/scenarios.md) | 24 | 8/8 | 52/52 | 3/3 | [14](apx-tolling/findings.md) |
| [`apx-valet`](apx-valet/scenarios.md) | 25 | 12/12 | 78/78 | 8/8 | [16](apx-valet/findings.md) |
| [`apx-validations`](apx-validations/scenarios.md) | 25 | 17/17 | 105/105 | 8/8 | [13](apx-validations/findings.md) |
| [`apx-violations`](apx-violations/scenarios.md) | 29 | 20/20 | 125/125 | 12/12 | [17](apx-violations/findings.md) |
| **total** | **377** | | | **118/125** | **221** |

*Operations* and *Responses* count the routes and declared status codes
each module's scenarios exercise. The seven Annex A rows not yet cited
(APX-CORE-13 to 16, APX-ALT-06, APX-ACC-07, APX-RES-09) were added in
0.13.0 and get scenarios in the next round, together with the
[150 proposed operational cases](../proposed/README.md) under triage.
[`findings.md`](findings.md) is the consolidated plan the 0.11.0 fixes
were built from, grouped by fix; [`apx-scenarios.xlsx`](apx-scenarios.xlsx)
is the same suite as a spreadsheet.

## Run it

```sh
npm run vetting                    # every module
npm run vetting -- apx-credentials # one module
```

For every request/response pair the runner checks that the method and
path resolve to one operation; query keys are declared and required ones
present; the request body validates (readOnly members not required); the
status is declared; the response body validates against that status's
schema; a problem body's `status` matches and its `type` is registered in
Part 12 at that status; and a `commandType` is registered. It then reports
per-module coverage: operations, response codes, Annex A rows, command
types, and problem types.

A marker `gap=F-<MOD>-NN` says "this is a known spec gap, see findings":
a failure there is reported as a gap rather than an error, and once the
spec is fixed the runner says the marker can come out. One gap is open
today (F-RSV-02). Findings that mention `run.mjs` refer to this runner
before it moved into the repository as `tools/vetting-scenarios.mjs`.

## How each module was written

Derived from the spec first, then operator stories on top:

1. every Annex A row for the class gets a passing and a refusing scenario;
2. every operation and every response code it declares appears somewhere;
3. every state machine walks its legal transitions and tries the illegal ones;
4. every command type and registry entry appears;
5. the cross-cutting cases repeat: missing scope, out-of-grant target,
   idempotency replay, stale version, unknown extension keys;
6. then the ones that happen at 2 am.

Each scenario has a kind: `happy`, `refusal`, `lifecycle`, `security`, or
`edge`. Findings marked "(upstream APDS)" concern the vendored APDS 4.1
document; they are filed with APDS as errata and worked around in APX's
overlay (Part 1 §1.3).

## Marker grammar

```
<!-- apx:module apx-control tag=Control ics=CTL -->     once, at the top
<!-- apx:scenario CTL-01 kind=happy ics=APX-CTL-01,APX-CTL-03 -->
<!-- apx:request POST /v1/commands?place=… -->          next ```json is the body (optional)
<!-- apx:request POST /v1/commands invalid -->          body is deliberately malformed
<!-- apx:response 202 -->                               next ```json is the response
<!-- apx:validate MatchCandidate at /matchCandidates/0 -->   stackable; also under a response marker
```

All people, companies, plates, cards, and identifiers are synthetic.
