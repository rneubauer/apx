# permits: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### PRM-OPS-001 — Two cars arrive under a one-car permit

Module: apx-permits

Other modules: credentials, lpr, control, resolution

Kind: edge

Closest existing scenario: PRM-01, PRM-08

Annex A row(s): APX-PRM-01, APX-PRM-02 (candidate mapping)

Given: Priya's permit lists two vehicles but the contract permits only one parked at a time.

When: Her partner brings the second car while the first remains inside.

Then: The configured concurrent-use rule is enforced across both vehicle credentials; one issued pool slot is not mistaken for two usable spaces.

Why it might break the spec: Part 14 pool issuance capacity may not express concurrent vehicle occupancy limits.

Severity: high

### PRM-OPS-002 — Permit canceled while its car is still inside

Module: apx-permits

Other modules: control, accounts, resolution

Kind: lifecycle

Closest existing scenario: PRM-09; DATA-24

Annex A row(s): APX-PRM-02; APX-DATA-02 (candidate mapping)

Given: The bakery closes its contract at noon with one van still parked.

When: The desk attempts cancellation and a new applicant requests the released pool slot.

Then: The implementation reconciles active-session deletion restrictions with cancellation and slot return; it does not report successful cancellation while the right remains usable.

Why it might break the spec: Local permits cancellation and data deletion rules may conflict for an in-use right.

Severity: high

### PRM-OPS-003 — Renewal should not occupy two current slots

Module: apx-permits

Other modules: accounts, data, events

Kind: edge

Closest existing scenario: PRM-07, PRM-14

Annex A row(s): APX-PRM-01, APX-PRM-02 (candidate mapping)

Given: October's pool is full; Priya renews for November before her October permit expires.

When: The portal issues the future renewal.

Then: Availability reflects the correct periods, with no second October slot consumed and no unreserved November entitlement.

Why it might break the spec: Renewal links do not by themselves establish which pool or time interval is debited.

Severity: high

### PRM-OPS-004 — A temporary rental replaces a parked vehicle

Module: apx-permits

Other modules: credentials, lpr, resolution

Kind: lifecycle

Closest existing scenario: PRM-08, PRM-12

Annex A row(s): APX-PRM-02; APX-CRD-02 (candidate mapping)

Given: Priya substitutes a rental for a repaired car on a one-car permit; the original car has already exited.

When: The authorized portal amends the vehicle list for three days.

Then: The rental receives only the intended interval of access and the original linkage is restored with an audit trail through supported updates.

Why it might break the spec: The profile may lack an interoperable effective-dated temporary vehicle substitution.

Severity: high

### PRM-OPS-005 — Employer reallocates a permit between staff

Module: apx-permits

Other modules: credentials, accounts, data

Kind: lifecycle

Closest existing scenario: PRM-08, PRM-09

Annex A row(s): APX-PRM-01, APX-PRM-02 (candidate mapping)

Given: A company owns ten permits; Dana leaves Friday and Lee starts Monday.

When: The administrator reallocates Dana's slot.

Then: Lee gains the authorized entitlement, Dana loses future access, and their histories remain distinct; no duplicate pool consumption.

Why it might break the spec: Native right edits may lack a clear transfer lifecycle preserving holder-specific history.

Severity: high

### PRM-OPS-006 — Night-shift permit crosses midnight

Module: apx-permits

Other modules: credentials, control, resolution

Kind: edge

Closest existing scenario: PRM-10; CRD-26

Annex A row(s): APX-PRM-02 (candidate mapping)

Given: A nurse's permit covers 19:00–08:00, and the shift starts September 30.

When: The nurse exits October 1 at 07:30.

Then: Validity and pricing honor the overnight window; month rollover does not manufacture a debt or deny a covered exit.

Why it might break the spec: Recurring access schedules and monthly expiry may have conflicting precedence.

Severity: high

### PRM-OPS-007 — One corporate bill is overdue but a personal supplement is paid

Module: apx-permits

Other modules: accounts, credentials, resolution

Kind: edge

Closest existing scenario: PRM-01

Annex A row(s): APX-PRM-02; APX-RES-03 (candidate mapping)

Given: Dana's basic permit is employer-funded and blocked for corporate debt; Dana separately paid for weekend access.

When: Dana arrives Saturday.

Then: The server evaluates the applicable independently funded entitlement according to configured policy, not a blanket holder-level debt flag.

Why it might break the spec: Multiple rights linked to different financial responsibilities need explicit decision precedence.

Severity: high

### PRM-OPS-008 — Permit is valid but its reserved bay is occupied

Module: apx-permits

Other modules: alerts, violations, resolution, data

Kind: edge

Closest existing scenario: PRM-01; VIO-01

Annex A row(s): APX-PRM-02; APX-RES-03 (candidate mapping)

Given: Priya owns reserved bay 218; another car occupies it. Policy permits a temporary alternate bay.

When: The attendant assigns an alternate through the supported operator workflow.

Then: Priya's entitlement is retained, the alternate use is evidenced, and enforcement can distinguish it from unauthorized parking.

Why it might break the spec: The permit profile may not represent temporary reassignment of a specific space.

Severity: high

### PRM-OPS-009 — A suspended credential does not release a sold permit

Module: apx-permits

Other modules: credentials, accounts, events

Kind: edge

Closest existing scenario: PRM-09; CRD-06

Annex A row(s): APX-PRM-01, APX-PRM-02 (candidate mapping)

Given: All 120 monthly permits are issued; Ray's credential is suspended for debt but his contract remains active.

When: The sales portal reads pool availability.

Then: Suspension alone does not add a sellable slot unless the permit itself is canceled or expires under the contract.

Why it might break the spec: Credential lifecycle and inventory lifecycle must not be conflated.

Severity: high

### PRM-OPS-010 — A paid upgrade moves a holder to another product

Module: apx-permits

Other modules: accounts, credentials, control

Kind: lifecycle

Closest existing scenario: PRM-07, PRM-09

Annex A row(s): APX-PRM-01, APX-PRM-02 (candidate mapping)

Given: Priya upgrades from general parking to a reserved-level permit; one reserved slot remains.

When: The desk collects the authorized difference and changes entitlements.

Then: The transfer accounts for both pool changes and payment, preserving a usable entitlement if completion fails for business reasons such as a sold-out target.

Why it might break the spec: The spec may have no atomic product-exchange operation across two permits and payment.

Severity: high


