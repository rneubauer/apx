# lpr: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### LPR-OPS-001 — The family car belongs to two different monthly customers

Module: apx-lpr

Other modules: accounts, permits, resolution

Kind: edge

Closest existing scenario: LPR-02, LPR-21

Annex A row(s): APX-LPR-01, APX-LPR-06 (candidate mapping)

Given: Two household members share a car but have different permits and balances.

When: The plate is read during a visit with no presented personal credential.

Then: The read records the vehicle; debtor and entitlement attribution requires additional evidence or documented matching policy.

Why it might break the spec: A plate identifies a vehicle observation, not necessarily the financially responsible person.

Severity: high

### LPR-OPS-002 — Rental plate changes hands between visits

Module: apx-lpr

Other modules: reservations, accounts, violations

Kind: lifecycle

Closest existing scenario: LPR-03, LPR-19

Annex A row(s): APX-LPR-01, APX-LPR-06 (candidate mapping)

Given: A rental car is used by Theo Monday and Dana Friday, with separate bookings.

When: Friday's visit is matched and later disputed.

Then: Current entitlement and liability are tied to Friday's visit; Monday's debt is not inherited merely through the plate.

Why it might break the spec: Time-bounded vehicle-to-holder association may be missing from cross-lookups.

Severity: high

### LPR-OPS-003 — A sold vehicle still matches the seller's permit

Module: apx-lpr

Other modules: permits, credentials, resolution

Kind: edge

Closest existing scenario: LPR-02; PRM-12

Annex A row(s): APX-LPR-01, APX-LPR-06 (candidate mapping)

Given: Priya sells her car but its plate remains on her monthly permit.

When: The new owner enters and the system proposes Priya's right.

Then: The operator's verification and stale-association policy governs; plate matching alone does not establish the new driver's entitlement.

Why it might break the spec: The observations surface cannot establish ownership changes or permission to reuse a right.

Severity: high

### LPR-OPS-004 — Trailer and towing vehicle have different plates

Module: apx-lpr

Other modules: tolling, permits, data

Kind: edge

Closest existing scenario: LPR-07, LPR-32

Annex A row(s): APX-LPR-03, APX-LPR-06 (candidate mapping)

Given: A contractor's van has a valid permit and tows a trailer with its own plate.

When: The entry system reads both during one physical passage.

Then: Both observed plates remain factual; passage counting and entitled vehicle selection follow supplied linkage and policy rather than two assumed customers.

Why it might break the spec: Capture grouping may not distinguish vehicle combinations and their financial identity.

Severity: high

### LPR-OPS-005 — A delivery driver turns around without parking

Module: apx-lpr

Other modules: accounts, data, control

Kind: edge

Closest existing scenario: LPR-05, LPR-27

Annex A row(s): APX-LPR-04, APX-LPR-06 (candidate mapping)

Given: A delivery driver enters at 12:00, finds the address wrong, and exits at 12:02; policy grants five minutes free.

When: The source reports both actual movements.

Then: A two-minute visit is recorded and rated under that policy, with no fabricated no-entry or no-charge payment record.

Why it might break the spec: Free turnaround visits must remain distinguishable from absent visits and paid visits.

Severity: medium

### LPR-OPS-006 — Changing a plate must not rewrite the camera's evidence

Module: apx-lpr

Other modules: violations, accounts, resolution

Kind: lifecycle

Closest existing scenario: LPR-11, LPR-14

Annex A row(s): APX-LPR-01, APX-LPR-03; APX-RES-08 (candidate mapping)

Given: A session was assigned to the wrong vehicle and a notice was issued from its original evidence.

When: An authorized agent corrects the session within the allowed window.

Then: The observed read remains intact; the correction and notice review are linked without silently changing the issued notice's evidence.

Why it might break the spec: A session correction may not propagate a review obligation to already-created financial or enforcement records.

Severity: high

### LPR-OPS-007 — Driver swaps tickets with a similar-looking car

Module: apx-lpr

Other modules: control, accounts, resolution

Kind: security

Closest existing scenario: LPR-08, LPR-09

Annex A row(s): APX-LPR-01; APX-CTL-11 (candidate mapping)

Given: Two black sedans arrive hours apart; the long-stay driver presents the newer ticket.

When: The agent reviews plate candidates and entry records.

Then: Available evidence exposes the mismatch; similar vehicle appearance is not treated as proof that the cheap ticket belongs to the caller.

Why it might break the spec: Ranking candidates by recency or appearance can defeat visit-specific billing.

Severity: high

### LPR-OPS-008 — Same plate text from two jurisdictions

Module: apx-lpr

Other modules: accounts, permits, violations

Kind: edge

Closest existing scenario: LPR-02; RSV-22

Annex A row(s): APX-LPR-01, APX-LPR-03 (candidate mapping)

Given: Florida and Georgia cars share plate text ABC123 and are simultaneously parked.

When: One approaches the exit and the lookup includes its supplied jurisdiction.

Then: Records remain distinct; missing jurisdiction yields uncertainty rather than a confident assignment to the other car.

Why it might break the spec: Jurisdiction qualifiers must remain consistent across LPR, account, right, and notice lookups.

Severity: high

### LPR-OPS-009 — A valet runner takes the car through a public exit

Module: apx-lpr

Other modules: valet, accounts, data

Kind: edge

Closest existing scenario: LPR-03, LPR-06

Annex A row(s): APX-LPR-04, APX-LPR-06 (candidate mapping)

Given: A runner moves a guest's car to an overflow area via a public exit and re-entry; valet custody continues.

When: The cameras report the actual passages.

Then: Both movements remain recorded; custody and billing treatment follow the configured transfer rule, not an invented customer handback.

Why it might break the spec: Physical movement and the commercial end of a valet stay are different facts.

Severity: high

### LPR-OPS-010 — A customer returns with a newly fitted permanent plate

Module: apx-lpr

Other modules: permits, credentials, accounts

Kind: lifecycle

Closest existing scenario: LPR-11; PRM-08

Annex A row(s): APX-LPR-01, APX-LPR-06 (candidate mapping)

Given: Maya's permit was registered to a temporary plate; the dealer fits the permanent plate between visits.

When: Maya updates the permit and arrives with the new plate.

Then: Future matching uses the new association; old visit observations retain the temporary plate and prior charges do not migrate incorrectly.

Why it might break the spec: Vehicle continuity across plate changes needs explicit right updates without historical evidence rewriting.

Severity: high


