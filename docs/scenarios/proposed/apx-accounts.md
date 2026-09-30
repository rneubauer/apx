# accounts: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Ten distinct acceptance questions; exact API contracts remain to be verified.

### ACC-OPS-001 — A partial payment does not reset courtesy history

Module: apx-accounts

Other modules: resolution, control, alerts

Kind: lifecycle

Closest existing scenario: ACC-05; RES-01

Annex A row(s): APX-ACC-02; APX-RES-03 (candidate mapping)

Given: Smith owes $185 and has used both weekly courtesies. Policy requires a zero overdue balance for ordinary access.

When: Smith pays $50 at the exit.

Then: The captured payment reduces the debt to $135; the refreshed decision retains the hold and prior courtesy history.

Why it might break the spec: Part 13 balance updates must not be treated as unconditional restoration of access.

Severity: high

### ACC-OPS-002 — The employer pays a different site account

Module: apx-accounts

Other modules: permits, resolution, control

Kind: edge

Closest existing scenario: ACC-03, ACC-05

Annex A row(s): APX-ACC-01, APX-ACC-03 (candidate mapping)

Given: Smith has separate Lakeside and Riverside accounts; both are visible to an authorized regional desk.

When: Payroll pays Riverside while Smith is blocked at Lakeside.

Then: The payment remains bound to Riverside; Lakeside's debt and access decision change only through a supported allocation.

Why it might break the spec: Shared holder or plate does not establish interchangeable account balances.

Severity: high

### ACC-OPS-003 — A parent pays without becoming the permit holder

Module: apx-accounts

Other modules: permits, credentials, resolution

Kind: security

Closest existing scenario: ACC-11

Annex A row(s): APX-ACC-02, APX-ACC-04 (candidate mapping)

Given: A student owes $90 and sends the approved payment link to a parent.

When: The parent settles the student's account.

Then: The correct balance changes; neither permit ownership nor credential access transfers to the payer.

Why it might break the spec: Payer, account debtor, and right holder are different roles.

Severity: high

### ACC-OPS-004 — Paying a refundable deposit does not pay dues

Module: apx-accounts

Other modules: credentials, permits, resolution

Kind: edge

Closest existing scenario: ACC-05; CRD-01

Annex A row(s): APX-ACC-02, APX-ACC-03 (candidate mapping)

Given: Maya owes $185 dues and $25 for a replacement-card deposit.

When: The desk collects only the $25 deposit.

Then: The receipt identifies its purpose; dues remain $185 and access policy evaluates that debt.

Why it might break the spec: Payment allocation between deposits and parking debt may be unspecified.

Severity: high

### ACC-OPS-005 — Pay station and phone agent collect the same debt

Module: apx-accounts

Other modules: control, resolution

Kind: edge

Closest existing scenario: ACC-06, ACC-11

Annex A row(s): APX-ACC-02, APX-ACC-04 (candidate mapping)

Given: Smith owes $185; the app and the agent independently initiate full settlement with different valid request keys.

When: Both payments are approved nearly simultaneously.

Then: The ledger reveals any overpayment and the configured reconciliation handles it; no false zero-balance arithmetic or hidden second charge.

Why it might break the spec: Request idempotency alone does not prevent distinct-channel overcollection.

Severity: high

### ACC-OPS-006 — Refunding dues after the holder has used access

Module: apx-accounts

Other modules: permits, credentials, resolution

Kind: lifecycle

Closest existing scenario: ACC-14

Annex A row(s): APX-ACC-04, APX-ACC-05 (candidate mapping)

Given: A $185 dues payment restored Smith's access and he entered. Finance later approves a full refund.

When: The refund completes while his vehicle remains inside.

Then: The ledger and current balance agree; policy explicitly determines subsequent access and exit assistance without erasing the entry.

Why it might break the spec: Refund lifecycle does not itself specify entitlement or in-progress-session consequences.

Severity: high

### ACC-OPS-007 — A company remittance covers several drivers

Module: apx-accounts

Other modules: permits, credentials, data

Kind: edge

Closest existing scenario: ACC-09

Annex A row(s): APX-ACC-02, APX-ACC-03 (candidate mapping)

Given: A fleet sends $555 for three named $185 monthly accounts.

When: Finance attempts to allocate the single remittance to all three.

Then: Each allocation is traceable and totals $555; only covered debts are cleared. Unsupported split allocation is recorded as a gap.

Why it might break the spec: Part 13 may not express one external remittance distributed across multiple accounts.

Severity: high

### ACC-OPS-008 — Account credit cannot be silently transferred

Module: apx-accounts

Other modules: resolution, permits

Kind: security

Closest existing scenario: ACC-03, ACC-14

Annex A row(s): APX-ACC-01, APX-ACC-04 (candidate mapping)

Given: Two family members hold separate accounts; one has a $60 credit and the other owes $60.

When: The debtor asks the agent to use the relative's credit.

Then: No transfer occurs merely because surnames and plates match; a supported, authorized transfer is required.

Why it might break the spec: The spec may have no account-credit transfer operation or ownership evidence.

Severity: high

### ACC-OPS-009 — Parking and violation charges are paid together

Module: apx-accounts

Other modules: violations, control, data

Kind: edge

Closest existing scenario: ACC-09; VIO-15

Annex A row(s): APX-ACC-03, APX-ACC-07; APX-VIO-05 (candidate mapping)

Given: A driver owes $18 parking and a separate $35 notice.

When: The cashier collects $53 in one interaction.

Then: Payment allocation proves which obligations settled without applying $53 to each; reports reconcile to $53 total.

Why it might break the spec: A single Payment reference may not express multiple obligation allocations.

Severity: high

### ACC-OPS-010 — A receipt is for yesterday's visit

Module: apx-accounts

Other modules: resolution, lpr, control

Kind: edge

Closest existing scenario: ACC-18, ACC-19

Annex A row(s): APX-PHX-01, APX-ACC-03 (candidate mapping)

Given: A driver has two Lakeside visits today and presents the morning's $12 receipt during the evening exit.

When: The agent finds both payments and sessions.

Then: Only the receipt's original visit is settled; the evening fee remains unless another payment is established.

Why it might break the spec: Human payment matching must bind to a visit, not merely card suffix, date, or plate.

Severity: high


