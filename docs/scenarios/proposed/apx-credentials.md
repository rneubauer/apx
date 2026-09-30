# credentials: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Ten distinct acceptance questions; exact API contracts remain to be verified.

### CRD-OPS-001 — Replacing the card does not create a fresh courtesy allowance

Module: apx-credentials

Other modules: accounts, resolution, control

Kind: lifecycle

Closest existing scenario: CRD-09; RES-01

Annex A row(s): APX-CRD-03; APX-RES-03 (candidate mapping)

Given: Smith used two weekly courtesy exits on his old card and still owes $185.

When: He obtains a replacement and requests another courtesy.

Then: The successor links to the same holder and account; the history and configured limit remain effective.

Why it might break the spec: Credential replacement changes identification, not the identity to which courtesy policy applies.

Severity: high

### CRD-OPS-002 — Replacing a suspended card must not cure the debt

Module: apx-credentials

Other modules: accounts, permits, resolution

Kind: edge

Closest existing scenario: CRD-09, CRD-10

Annex A row(s): APX-CRD-02, APX-CRD-03 (candidate mapping)

Given: Ray's card is suspended for unpaid dues and is also physically damaged.

When: The desk replaces it using the supported replacement operation.

Then: The account restriction still governs access even if the successor lifecycle is active; the customer is not told the debt is cleared.

Why it might break the spec: Replacement semantics may activate media without preserving an independent financial restriction.

Severity: high

### CRD-OPS-003 — Employer terminates one employee while the fleet stays paid

Module: apx-credentials

Other modules: accounts, permits, control

Kind: lifecycle

Closest existing scenario: CRD-12, CRD-15

Annex A row(s): APX-CRD-02, APX-CRD-04 (candidate mapping)

Given: A company account is current and carries ten employees; Dana leaves the company.

When: The authorized administrator revokes Dana's credential.

Then: Dana's subsequent access is denied, while the other nine retain their entitlements.

Why it might break the spec: A shared account's financial status must not override individual credential revocation.

Severity: high

### CRD-OPS-004 — One holder has two valid cards but one-car entitlement

Module: apx-credentials

Other modules: permits, resolution, lpr

Kind: edge

Closest existing scenario: CRD-20

Annex A row(s): APX-CRD-02, APX-CRD-04 (candidate mapping)

Given: Maya has an active card and mobile credential under one permit limited to one concurrent vehicle.

When: A second car presents the mobile credential while her first car is parked.

Then: The policy evaluates the shared entitlement; a different credential does not create a second authorized space.

Why it might break the spec: Passback tracked only per credential may not enforce concurrent use of one right.

Severity: high

### CRD-OPS-005 — Returned stock card is issued to a new person

Module: apx-credentials

Other modules: accounts, resolution, data

Kind: lifecycle

Closest existing scenario: CRD-18

Annex A row(s): APX-CRD-01, APX-CRD-04 (candidate mapping)

Given: A terminal credential's physical card number is reissued to a new employee next month.

When: The new employee first uses the card and the desk reviews history.

Then: Current access maps to the new record; the previous person's debt and courtesy history do not transfer with the reused number.

Why it might break the spec: Historical lookups keyed solely by identification can merge unrelated holders.

Severity: high

### CRD-OPS-006 — Credential valid at two sites loses only one entitlement

Module: apx-credentials

Other modules: permits, data, control

Kind: lifecycle

Closest existing scenario: CRD-04, CRD-17

Annex A row(s): APX-CRD-02 (candidate mapping)

Given: Maya's card opens Lakeside and Riverside through separate assigned rights.

When: Her Lakeside contract ends while Riverside remains paid and valid.

Then: Lakeside access ends without disabling Riverside; materialized rights reflect the split.

Why it might break the spec: Whole-credential transitions may be too coarse for site-specific entitlement removal.

Severity: high

### CRD-OPS-007 — Mobile and physical cards remain after a loss report

Module: apx-credentials

Other modules: permits, resolution

Kind: edge

Closest existing scenario: CRD-08, CRD-14

Annex A row(s): APX-CRD-02, APX-CRD-04 (candidate mapping)

Given: Ray reports only his physical fob stolen; he retains an independently issued mobile credential.

When: The desk marks the fob lost.

Then: The fob is denied; mobile use follows its own status and the shared right's policy, with no accidental blanket revoke.

Why it might break the spec: Loss of media must be distinguished from compromise of the whole entitlement.

Severity: high

### CRD-OPS-008 — A replacement is collected by a coworker

Module: apx-credentials

Other modules: accounts, resolution

Kind: security

Closest existing scenario: CRD-09

Annex A row(s): APX-CRD-03, APX-CRD-05 (candidate mapping)

Given: A coworker knows Maya's card number and requests collection of her active replacement.

When: The desk attempts issuance and handover under an authorization-required policy.

Then: No knowledge-only handover is treated as verified authority; the approved representative evidence is retained by the responsible system.

Why it might break the spec: The credential API may model holder linkage without a standardized collection-authorization record.

Severity: high

### CRD-OPS-009 — Temporary loan card outlives the repair

Module: apx-credentials

Other modules: permits, resolution, control

Kind: lifecycle

Closest existing scenario: CRD-13, CRD-14

Annex A row(s): APX-CRD-01, APX-CRD-02 (candidate mapping)

Given: Maya receives a separate two-day loan card while her permanent media is repaired.

When: The permanent card is returned on day one and the loan card is later presented.

Then: The configured early termination of the loan card is enforced without ending the permanent entitlement.

Why it might break the spec: Separate temporary media require a supported linkage and termination workflow; replacement alone may not model both.

Severity: high

### CRD-OPS-010 — A usable card is mistaken for a failed reader

Module: apx-credentials

Other modules: control, resolution, permits

Kind: edge

Closest existing scenario: CRD-26; CTL-18

Annex A row(s): APX-CRD-04; APX-RES-01 (candidate mapping)

Given: Dana's card is successfully read but her weekend-only right is invalid on Monday.

When: She tells the agent the card is broken.

Then: The access evidence identifies the validity denial; replacement or device-fault assistance does not erase it.

Why it might break the spec: Customer wording must not override the source's specific denial reason.

Severity: high


