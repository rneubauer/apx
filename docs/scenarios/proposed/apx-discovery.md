# discovery: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### DSC-OPS-001 — The agent can see debt but cannot take payment

Module: apx-discovery

Other modules: accounts, resolution, control

Kind: edge

Closest existing scenario: DSC-02, DSC-04

Annex A row(s): APX-DSC-01, APX-DSC-02; APX-RES-05 (candidate mapping)

Given: A receptionist can read account balances and assist at lanes but has no payment-write permission.

When: Smith asks to pay the $185 debt.

Then: Discovery and resolution do not offer a callable payment action to this token; the workflow uses an authorized handoff.

Why it might break the spec: Server capabilities, client permissions, and recommended actions must agree across modules.

Severity: high

### DSC-OPS-002 — New reservation service lacks the permit service

Module: apx-discovery

Other modules: reservations, permits, resolution

Kind: edge

Closest existing scenario: DSC-05, DSC-12

Annex A row(s): APX-DSC-01, APX-DSC-02 (candidate mapping)

Given: A site offers reservations through APX but has not exposed permit management.

When: A monthly parker asks the reservation integration to renew their pass.

Then: The integration recognizes the missing permit capability and does not represent a reservation as a monthly renewal.

Why it might break the spec: Similar products can tempt clients to substitute one domain for an unavailable one.

Severity: high

### DSC-OPS-003 — Merchant can validate but cannot refund the guest

Module: apx-discovery

Other modules: validations, accounts, resolution

Kind: security

Closest existing scenario: DSC-03; VAL-20

Annex A row(s): APX-DSC-01, APX-DSC-02; APX-VAL-06 (candidate mapping)

Given: The bistro's token may redeem its own benefits but has no account refund authority.

When: A guest requests a cash refund for a missed voucher.

Then: Discovery exposes the actual merchant operations; the refund requires a separate authorized operator workflow.

Why it might break the spec: A service relationship with the visit must not imply access to all of its money operations.

Severity: high

### DSC-OPS-004 — Valet request permission is not management permission

Module: apx-discovery

Other modules: valet, accounts, resolution

Kind: security

Closest existing scenario: DSC-03; VLT-15

Annex A row(s): APX-DSC-01, APX-DSC-02; APX-VLT-06 (candidate mapping)

Given: A guest token is bound to one valet ticket and permits retrieval requests.

When: The guest app builds its actions from discovery.

Then: It cannot offer operator handback, other guests' tickets, or account settlement merely because the host advertises valet and accounts.

Why it might break the spec: Host conformance claims are not a user-specific permission list.

Severity: high

### DSC-OPS-005 — Supervisor works at Lakeside but is ordinary staff at Riverside

Module: apx-discovery

Other modules: control, resolution, accounts

Kind: security

Closest existing scenario: DSC-04, DSC-10

Annex A row(s): APX-DSC-01, APX-DSC-02; APX-RES-04 (candidate mapping)

Given: An agent may approve debt overrides at Lakeside but needs another supervisor at Riverside.

When: The same console switches to a Riverside caller.

Then: Per-target resolution and execution enforce the Riverside rule even if discovery lists gate commands callable somewhere in the grant.

Why it might break the spec: Endpoint soundness for one target does not authorize the same action at every target.

Severity: high

### DSC-OPS-006 — Credential replacement is supported only at one site

Module: apx-discovery

Other modules: credentials, permits, resolution

Kind: edge

Closest existing scenario: DSC-04, DSC-12

Annex A row(s): APX-DSC-01, APX-DSC-02 (candidate mapping)

Given: A regional host exposes credentials for Lakeside while Riverside uses a separately managed card service.

When: A Riverside customer requests a replacement.

Then: The console checks the applicable target capability and reports a supported handoff instead of promising replacement from a host-wide claim.

Why it might break the spec: Discovery may not provide per-place class availability on heterogeneous aggregators.

Severity: high

### DSC-OPS-007 — An enforcement reader is not an appeals reviewer

Module: apx-discovery

Other modules: violations, accounts, resolution

Kind: security

Closest existing scenario: DSC-03, DSC-04

Annex A row(s): APX-DSC-01, APX-DSC-02 (candidate mapping)

Given: A patrol contractor can read eligibility and notices but cannot resolve appeals or issue refunds.

When: A driver approaches the contractor with an appeal.

Then: The interface and API preserve those role boundaries while retaining a permitted referral path.

Why it might break the spec: One end-to-end customer request spans permissions that may belong to different organizations.

Severity: high

### DSC-OPS-008 — A toll dispute desk does not automatically control the garage

Module: apx-discovery

Other modules: tolling, control, resolution

Kind: security

Closest existing scenario: DSC-04; TOL-18

Annex A row(s): APX-DSC-01, APX-DSC-02 (candidate mapping)

Given: The road's dispute contractor manages toll cases but has no lane-control scope.

When: A caller asks it to open the adjacent parking gate after a toll refund.

Then: The refund does not expose or authorize a gate operation; discovery remains limited to the contractor's actual capabilities.

Why it might break the spec: Shared place or account context must not bridge separate operational permissions.

Severity: high

### DSC-OPS-009 — Analytics needs financial facts without unrestricted customer identity

Module: apx-discovery

Other modules: data, accounts, lpr, events

Kind: security

Closest existing scenario: DSC-03; LPR-15

Annex A row(s): APX-DSC-01, APX-DSC-02; APX-CORE-10 (candidate mapping)

Given: The owner wants occupancy and revenue totals but does not authorize plate-level customer tracking for its BI vendor.

When: The BI integration discovers available reads and topics.

Then: It consumes only permitted data; if no suitable minimized financial surface exists, the capability gap is explicit.

Why it might break the spec: The desired analytics role may fall between broad domain read scopes and native-data privacy restrictions.

Severity: high

### DSC-OPS-010 — Outsourced support changes organizations at contract renewal

Module: apx-discovery

Other modules: resolution, accounts, events

Kind: lifecycle

Closest existing scenario: DSC-10, DSC-13

Annex A row(s): APX-DSC-01, APX-TLS-03; APX-CORE-07 (candidate mapping)

Given: A new call-center provider receives its own organization, place grant, and certificate-bound token; the old provider's contract ends.

When: The new desk continues an authorized open customer episode.

Then: It obtains fresh discovery and authorized history without reusing the previous provider's token or certificate; old access follows the defined revocation process.

Why it might break the spec: Cross-organization continuity of support history must not depend on credential sharing or blanket authority transfer.

Severity: high


