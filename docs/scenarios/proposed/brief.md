# Brief: propose new test scenarios for APX 0.13.0

> **Updated direction — September 29, 2026:** Prioritize realistic people and
> operating relationships across modules: repeated visits, unpaid balances,
> inactive or damaged credentials, shared entitlements, prior courtesy exits,
> server-decided exceptions, and escalation to management. Generic power or
> network outages are not the main driver. The 10–15 scenarios per module
> requested below is no longer a ceiling; 100–150 distinct useful cases per
> module is acceptable. Organize by owning module while testing the complete
> cross-module outcome, including data and analytics. Preserve the plain-English
> format and distinguish operator policy from normative APX requirements.
> The initial expanded catalog is in [`README.md`](README.md) in this folder.

You are helping stress-test **APX (APDS Parking eXtensions)** before it goes
to the Alliance for Parking Data Standards (APDS) technical working group.
We want **realistic scenarios the spec might not handle well**, not more
happy paths. Please play three roles at once: a parking **operator** who has
seen everything go wrong, a **PARCS vendor** who has to implement this, and
a **skeptical standards reviewer**.

## What APX is

APX is an additive companion standard to **APDS 4.1** (the open parking data
standard). APDS defines the data: places, rates, rights, sessions,
observations, payments. APX adds the parts APDS leaves out: real-time events,
lane control (open the gate, lost ticket, validations), alerts, capability
discovery, accounts and payments, LPR, reservations, permits, tolling,
enforcement, validation programs, credentials, valet, and a customer-service
"resolution" layer for call centers and AI agents.

Two rules shape everything:

- **APX never redefines APDS.** Anything APDS already models (money, places,
  references, means of payment, …) is reused as is.
- **APX carries facts, not decisions it cannot see.** The lane or camera
  system reports what happened; APX does not infer it. Policy (what an agent
  may offer a customer) is decided by the server, never by the AI agent.

## Material to read

- The API (normative): `apx-v1.yaml` from
  <https://github.com/rneubauer/apx/releases/tag/v0.13.0>
- The written standard, 23 parts plus Annex A (the numbered, testable
  requirements): <https://rneubauer.github.io/apx/apx-standard.md>
- Browsable reference: <https://rneubauer.github.io/apx/>

## The modules (conformance classes)

| Class | What it covers |
|---|---|
| `apx-data` | APDS's own data routes with change feeds, cursors, tombstones |
| `apx-events` / `apx-events-sse` | Signed webhooks with retries; a live event stream with resume |
| `apx-control` | Commands to lanes (vend gate, lost ticket, push a rate, apply a validation), lane inquiry, device status; optional negotiated rates and ticket matching |
| `apx-alerts` | Alerts and their lifecycle (raised, acknowledged, resolved, expired) |
| `apx-discovery` | What this particular client is allowed to do |
| `apx-accounts` / `apx-payment-history` | Account lookup, taking payments (sale, hold/capture, refund, void), accounting write-back, finding a payment by ticket or last-4 |
| `apx-lpr` | Plate reads, lane cameras, entry/exit access events |
| `apx-reservations` / `apx-permits` | Booking, amending, check-in, no-shows; permits and permit pools |
| `apx-tolling` | Toll transactions and disputes |
| `apx-resolution` | One customer-service "context" per call, server-decided allowed actions, passback, plate candidates, support interaction records |
| `apx-violations` | Enforcement: detection, review, issuance, notices, payment, appeal, void; local law and signage on file |
| `apx-validations` | Merchant validation programs: enrolment, codes, redemption, monthly statements |
| `apx-credentials` | Keycards, fobs, hangtags, mobile credentials: issue, suspend, lost, revoke, replace, access history |
| `apx-valet` | Drop-off with condition report, keys, retrieval queue and ETA, handback |
| `apx-mtls` | Optional mutual TLS |

## Already covered (don't repeat these)

Public end-to-end scenarios:

1. Lane status when a call hits the call center
2. Call-center gate vend: validate, vend, fault, alert
3. Data sync and signed webhooks
4. LPR transient parker with a lost ticket
5. Reservation lifecycle: quote, book, amend, check-in, no-show
6. Reservation for a set time, then extending it
7. The analytics feed: occupancy, payments, plate reads
8. Monthly parker with a balance hold and a courtesy limit
9. Paid ticket, gate vend failed
10. Card declined at the exit lane
11. "The restaurant said parking was validated"
12. "It says $45 but it should be $12"
13. "The system says I'm already inside" (passback)
14. "I prepaid but it wants full price"
15. "The machine won't take my card"
16. Automated LPR overstay: notice by mail, appeal, paid
17. Handheld enforcement: eligibility check, officer confirms, citation
18. Validation program: enrol a restaurant, issue codes, redeem, close the month
19. Local law and signage on file; a mailed notice refused; escalation
20. Lost keycard replaced on the phone; the old card denied later
21. Valet: drop-off, "bring my car" by text, staged, verified handback
22. Gateless lot: a shared driveway in the snow
23. Tolling: a gantry charges twice, and the second one is not your car
24. Negotiated rate at the exit lane, with an audit of who offered it
25. Ticket matching: no ticket at the exit, entry recorded anyway
27. Reversible lane: two cameras, both directions, a late correction

Beyond those, a vetting suite of 377 scenarios covers every module, one
folder per module in
[`docs/scenarios/by-module/`](../by-module/README.md)
(`apx-<module>/scenarios.md`, with the module's findings beside it). Each
file gives the cast (places, lanes, people, ids) and every scenario with
its kind, the Annex A rows it tests, its Given/When/Then, and its
validated JSON. Read the file for a module before proposing scenarios for
it, so you add to it rather than repeat it.

## How to think about scenarios

Every existing module file was built in these six passes. Use the same
passes to find what is missing, and the last one most of all:

1. **Every requirement, both ways.** Each Annex A row gets a scenario where
   it holds and one where it is violated or refused.
2. **Every operation and every response.** Each route appears, and so does
   each status code it declares (201, 200 replay, 400, 403, 404, 409,
   422, 429 …). Ask: what request would produce that code?
3. **Every state machine, legal and illegal.** Walk each lifecycle
   (payment, alert, violation, credential, reservation, valet ticket …)
   through its allowed transitions, then try the forbidden ones.
4. **Every code value.** Each command type, alert type, denial reason,
   topic, and registry entry is used at least once.
5. **The cross-cutting cases, in every module.** Missing scope, a target
   outside the caller's granted places, an idempotency-key replay (same
   body, and a different body), a stale version, unknown extension keys,
   personal data where it is not allowed.
6. **What happens at 2 am.** The real world: broken hardware, people who
   do not follow the script, two systems disagreeing, money half-moved.
   This is where the suite is thinnest and where you can help most.

Each scenario has a **kind**:

- `happy`: the normal path works
- `refusal`: the API correctly says no
- `lifecycle`: a state machine moves over time
- `security`: scopes, grants, privacy
- `edge`: unusual but legitimate situations

The existing mix is 116 happy, 83 refusal, 68 lifecycle, 41 security,
and 69 edge. We want more `edge` and more `lifecycle`.

For each idea, ask yourself:

- What does the operator see, and what does the customer see?
- Which system knows the truth: the lane, the PARCS, the payment
  processor, the camera, or the app?
- What if this step happens twice, or late, or out of order?
- What if the network drops right after the money moves?
- Who is allowed to do this, and at which places?
- What record would an auditor or a court need afterwards?

## Where we most want ideas

**Requirements with no scenario yet** (Annex A rows):

- Vendors keeping their additions in their own namespace (never `apx`),
  and never giving an APX code a different meaning (APX-CORE-13)
- An implementation serving the registry versions it validates against,
  and every advertised registry link actually resolving (APX-CORE-14)
- A place moving from one operator's system to another: the new grant
  names only that place, history keeps its provenance (APX-CORE-15), and
  after cutover the old system stops publishing for it (APX-CORE-16)
- A "webhook delivery failed" alert must never itself be delivered to the
  webhook that is failing (APX-ALT-06)
- Captured payments showing up as native APDS Payments; declined payments
  and uncaptured holds never do (APX-ACC-07)
- Call and chat correlation: an opaque interaction id from the phone or
  chat system, and one correlation id tying the whole episode together
  (APX-RES-09)

**Code values no scenario exercises yet:**

- Device states `occupied` and `inoperative`
- Toll dispute reason `notLiable`
- Event topic `apx.permits.pool.availability.v1`
- Conformance classes being claimed and discovered: accounts,
  reservations, permits, tolling, violations, validations, credentials,
  valet

**Real-world messiness** (the most valuable kind):

- Hardware: a lane offline for hours that then reconnects and replays, a
  gate arm stuck up, a camera misread, two readers firing for one car,
  power loss during a payment
- Partial failures: card charged but gate never opened, a refund that
  times out, a retry after a network drop (duplicate charges?)
- Races: two agents acting on one lane at once, a customer paying on the
  app while an agent vends the gate, a credential revoked while the car
  is in the lane
- Time: daylight-saving changes, midnight and month-end rollovers, time
  zones across a multi-site operator, clock drift between lane and server
- Multi-party: aggregators fronting many garages, an operator changing
  PARCS vendor, a third-party app with a narrow grant
- Money: partial refunds, split payments, currency other than USD,
  validations stacked on negotiated rates, holds that are never captured
- People and privacy: shared vehicles, fleets, a stolen car, a customer
  asking what data is kept about them, a plate that belongs to someone else
- Abuse: passback games, ticket swapping, reused validation codes, social
  engineering the call center or the AI agent into an action policy forbids
- Enforcement: a sign changed after the violation, an appeal after the
  deadline, a rental car, a vehicle with no plate

## What to send back

Work **one module at a time**: read its `apx-<module>/scenarios.md`, then give **10
to 15 new scenarios** for it, strongest first, in this format. Give each a
kind from the list above. **Please write plain English, not JSON**: we write the
payloads against the real schema ourselves, and invented field names cost
more time than they save.

```
### <short title>
Module: <class, e.g. apx-accounts>
Kind: <happy | refusal | lifecycle | security | edge>
Closest existing scenario: <e.g. ACC-07, or "none">
Annex A row(s): <e.g. APX-ACC-05, or "unsure">
Given: <the situation, with concrete actors, times, and amounts>
When: <what happens, step by step>
Then: <what you would expect the API to do: status, event, state change>
Why it might break the spec: <the gap, ambiguity, or conflict you suspect,
  citing the Part/section if you can>
Severity: <high = wrong money or access, medium = wrong record, low = unclear docs>
```

Ground rules:

- If a scenario needs something APX does not have, **say so**: "the spec
  seems to have no way to X". Those are the most useful findings. Don't
  invent a field to make it work.
- Prefer situations a real garage, city lot, or toll road actually meets.
- Don't propose redefining anything APDS already defines.
- One behaviour per scenario. Split a long story into several if needed.
