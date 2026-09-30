# control: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Ten distinct acceptance questions; exact API contracts remain to be verified.

### CTL-OPS-001 — Two agents spend the last courtesy exit

Module: apx-control

Other modules: resolution, accounts, alerts

Kind: edge

Closest existing scenario: CTL-15, CTL-21

Annex A row(s): APX-CTL-01; APX-RES-03, APX-RES-04 (candidate mapping)

Given: Smith has one courtesy left; an intercom agent and a chat agent both see it.

When: Each sends a distinct courtesy command for the same holder's episode.

Then: Execution enforces one authorized consumption; the second action cannot independently spend the same allowance.

Why it might break the spec: Different idempotency keys and separately evaluated contexts require business-level concurrency control.

Severity: high

### CTL-OPS-002 — The customer changes lanes during a negotiated offer

Module: apx-control

Other modules: resolution, lpr, accounts

Kind: edge

Closest existing scenario: CTL-19

Annex A row(s): APX-CTL-09, APX-CTL-10 (candidate mapping)

Given: An agent offers ticket A a $20 negotiated rate at lane 2.

When: A backs out and ticket B becomes current before the command is applied.

Then: B does not receive A's discount; A requires refreshed targeting at the new lane.

Why it might break the spec: Current-ticket targeting may lack a precondition tying an offer to the intended transaction.

Severity: high

### CTL-OPS-003 — A paid ticket is handed to the car behind

Module: apx-control

Other modules: lpr, accounts, resolution

Kind: edge

Closest existing scenario: CTL-20

Annex A row(s): APX-CTL-11, APX-CTL-12 (candidate mapping)

Given: Policy requires a ticket to match its vehicle; driver A has paid and hands the ticket to driver B.

When: B presents it at the exit while A remains parked.

Then: The system uses available evidence and the configured mismatch policy; no silently reassigned settled visit.

Why it might break the spec: Payment validity alone does not establish which vehicle is entitled to use the exit.

Severity: high

### CTL-OPS-004 — A monthly parker took a transient ticket

Module: apx-control

Other modules: permits, credentials, accounts

Kind: edge

Closest existing scenario: CTL-20

Annex A row(s): APX-CTL-11, APX-CTL-12 (candidate mapping)

Given: A valid monthly parker forgot the card and took a ticket at 08:00.

When: At 17:00 the agent verifies the monthly entitlement and matches the visit.

Then: The original session is retained with an auditable entitlement resolution; no second visit or unnecessary lost-ticket charge.

Why it might break the spec: Ticket matching may locate the visit without specifying how its monthly pricing association changes.

Severity: high

### CTL-OPS-005 — A courtesy vend succeeds but the driver stays

Module: apx-control

Other modules: resolution, lpr, data

Kind: lifecycle

Closest existing scenario: CTL-01, CTL-21

Annex A row(s): APX-CTL-03, APX-CTL-05 (candidate mapping)

Given: Smith receives an authorized courtesy vend but stops to retrieve a dropped wallet and never passes the barrier.

When: He calls again after the gate closes.

Then: The record distinguishes command confirmation from actual passage; policy explicitly governs whether assistance consumes another courtesy.

Why it might break the spec: An executed command may be counted as an exit without supporting movement evidence.

Severity: high

### CTL-OPS-006 — Negotiated price followed by merchant validation

Module: apx-control

Other modules: validations, accounts, resolution

Kind: edge

Closest existing scenario: CTL-11, CTL-19

Annex A row(s): APX-CTL-09; APX-VAL-04 (candidate mapping)

Given: Policy allows a $20 negotiated rate followed by a $5 merchant discount.

When: The agent applies both to the same visit.

Then: The lane shows $15 due and preserves both sources and their order; unsupported composition is surfaced.

Why it might break the spec: Negotiated-rate and validation rules may disagree about which rate is applicable.

Severity: high

### CTL-OPS-007 — Canceling a lane action does not refund its payment

Module: apx-control

Other modules: accounts, resolution

Kind: lifecycle

Closest existing scenario: CTL-06, CTL-07

Annex A row(s): APX-CTL-04; APX-ACC-04 (candidate mapping)

Given: A driver pays $18, then decides to remain parked before the requested vend is dispatched.

When: The agent successfully cancels the command.

Then: Payment remains accounted for; any refund is a separate authorized action and the session's current amount is reevaluated.

Why it might break the spec: Control cancellation and payment reversal are different domain operations.

Severity: high

### CTL-OPS-008 — Attendant redirects a car to an entry-only lane

Module: apx-control

Other modules: lpr, resolution, data

Kind: edge

Closest existing scenario: CTL-18, CTL-22

Annex A row(s): APX-CTL-05, APX-CTL-06; APX-LPR-04 (candidate mapping)

Given: An attendant directs an exiting customer to a lane normally used for entry during an event.

When: An authorized exit vend is issued there.

Then: The command targets the actual lane, and the source reports actual movement; the visit is not counted as a new entry from lane configuration alone.

Why it might break the spec: Command intention, configured lane role, and observed passage may conflict.

Severity: high

### CTL-OPS-009 — Staff opens a gate for a pedestrian delivery

Module: apx-control

Other modules: data, events

Kind: edge

Closest existing scenario: CTL-01, CTL-24

Annex A row(s): APX-CTL-03, APX-CTL-05 (candidate mapping)

Given: An attendant opens a vehicle barrier for a pedestrian moving a cart; no vehicle crosses.

When: The action reaches physical confirmation.

Then: The audit records the command but no vehicle session or occupancy change is invented.

Why it might break the spec: Gate-open counts must not be reused as vehicle counts.

Severity: medium

### CTL-OPS-010 — A borrowed credential identifies the wrong entitlement

Module: apx-control

Other modules: credentials, permits, resolution

Kind: security

Closest existing scenario: CTL-20

Annex A row(s): APX-CTL-11, APX-CTL-12; APX-RES-04 (candidate mapping)

Given: A driver without a ticket quotes a coworker's active card number; the coworker's car is already inside.

When: The agent receives that card's session as a match candidate.

Then: The candidate remains advisory; matching requires the configured evidence and cannot silently close the coworker's stay.

Why it might break the spec: An advisory credential match can be misused as proof that the caller owns the visit.

Severity: high


