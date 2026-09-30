# validations: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### VAL-OPS-001 — A discount does not clear monthly arrears

Module: apx-validations

Other modules: accounts, permits, resolution

Kind: edge

Closest existing scenario: VAL-04, VAL-10

Annex A row(s): APX-VAL-02, APX-VAL-04 (candidate mapping)

Given: Smith owes $185 monthly dues and holds a restaurant voucher for today's transient parking only.

When: He asks the agent to apply it to regain monthly access.

Then: Only eligible session charges are reduced; the monthly debt remains and policy is reevaluated accordingly.

Why it might break the spec: A parking validation must not be treated as a general account credit.

Severity: high

### VAL-OPS-002 — Voucher presented after full parking payment

Module: apx-validations

Other modules: accounts, control, resolution

Kind: lifecycle

Closest existing scenario: VAL-10, VAL-19

Annex A row(s): APX-VAL-04, APX-VAL-05 (candidate mapping)

Given: A driver pays $18, then finds a $6 voucher before exiting. Policy permits an adjustment.

When: The desk applies the supported validation remedy.

Then: Any $6 customer refund and merchant obligation are separately recorded, with no cash refund merely assumed from a zero amount due.

Why it might break the spec: Redemption on a paid visit may not define the resulting refund coordination.

Severity: high

### VAL-OPS-003 — Two stackable discounts have order-dependent results

Module: apx-validations

Other modules: control, accounts, data

Kind: edge

Closest existing scenario: VAL-13

Annex A row(s): APX-VAL-04 (candidate mapping)

Given: A $20 ticket accepts a $5 fixed discount and a 50-percent discount; policy explicitly applies fixed first.

When: Both merchants validate the same visit.

Then: The final due is $7.50 and actual reductions reconcile; reversed submission order is handled consistently with configured policy.

Why it might break the spec: Stackability alone does not define ordering or the percentage calculation base.

Severity: high

### VAL-OPS-004 — A zero-price monthly visit receives a billable voucher

Module: apx-validations

Other modules: permits, accounts, data

Kind: edge

Closest existing scenario: VAL-10, VAL-17

Annex A row(s): APX-VAL-04, APX-VAL-07 (candidate mapping)

Given: A monthly parker owes $0 for this visit; a restaurant's contract charges $4 per accepted redemption.

When: The restaurant attempts to validate the visit.

Then: The server applies the configured zero-benefit eligibility rule; actual reduction remains $0 and any merchant billing is transparent.

Why it might break the spec: Zero customer benefit and per-redemption merchant fees may create unintended charges.

Severity: high

### VAL-OPS-005 — Restaurant and cashier validate through different channels

Module: apx-validations

Other modules: control, resolution, events

Kind: edge

Closest existing scenario: VAL-04, VAL-15

Annex A row(s): APX-VAL-02, APX-VAL-04 (candidate mapping)

Given: The restaurant already applied its one-per-ticket benefit by POS; the customer's receipt is unclear.

When: The call-center agent applies the same program through lane control using a new key.

Then: The shared ledger enforces the program limit across channels; no second discount or merchant debit occurs.

Why it might break the spec: Domain redemption and command materialization must share business limits, not just request deduplication.

Severity: high

### VAL-OPS-006 — Merchant supplies the wrong guest's ticket

Module: apx-validations

Other modules: accounts, control, resolution

Kind: lifecycle

Closest existing scenario: VAL-16

Annex A row(s): APX-VAL-04, APX-VAL-05 (candidate mapping)

Given: The bistro validates A's ticket, but its intended guest is B; A has already paid and exited.

When: The supervisor corrects the mistake.

Then: Closed-session rules are respected; B's correction and any merchant credit are explicit without reopening or silently debiting A.

Why it might break the spec: Reversal of settled mistakes does not necessarily express compensation across two customers.

Severity: high

### VAL-OPS-007 — Voucher valid when issued but program later suspended

Module: apx-validations

Other modules: resolution, accounts, control

Kind: edge

Closest existing scenario: VAL-05, VAL-14

Annex A row(s): APX-VAL-01, APX-VAL-04 (candidate mapping)

Given: The bistro gives a guest a voucher at 18:00; its program is suspended at 18:10 before the guest leaves.

When: The voucher is presented at 19:00.

Then: The documented suspension rule is enforced and any operator-funded courtesy is separate from a merchant redemption.

Why it might break the spec: Customers may have a prior promise the current-program validation rules cannot represent.

Severity: high

### VAL-OPS-008 — Reversal must not resurrect a stolen voucher

Module: apx-validations

Other modules: resolution, accounts

Kind: edge

Closest existing scenario: VAL-16, VAL-25

Annex A row(s): APX-VAL-03, APX-VAL-05 (candidate mapping)

Given: A voucher is redeemed, then its remaining batch is voided as stolen.

When: The redemption is later reversed for wrong-ticket application.

Then: The effective instrument eligibility reconciles reversal with the batch's void status; it cannot silently become reusable contrary to the void decision.

Why it might break the spec: Instrument restoration and batch voiding can impose conflicting lifecycle outcomes.

Severity: high

### VAL-OPS-009 — Hotel nights and restaurant hours overlap

Module: apx-validations

Other modules: reservations, accounts, control

Kind: edge

Closest existing scenario: VAL-13

Annex A row(s): APX-VAL-04 (candidate mapping)

Given: A guest has prepaid parking until 18:00 and a two-hour restaurant validation; policy applies it to uncovered time only.

When: The guest exits at 20:00.

Then: The validation covers 18:00–20:00 without discounting prepaid time twice; actual reduction reflects only the eligible amount.

Why it might break the spec: Duration benefits may not define allocation across already-covered session segments.

Severity: high

### VAL-OPS-010 — The restaurant changes owner before the credit arrives

Module: apx-validations

Other modules: accounts, discovery, data

Kind: lifecycle

Closest existing scenario: VAL-07, VAL-19

Annex A row(s): APX-VAL-05, APX-VAL-06, APX-VAL-07 (candidate mapping)

Given: September's bistro statement belongs to the old provider; a new organization takes over October 1.

When: A September redemption is reversed October 2.

Then: The credit stays attributable to the original liable provider and does not appear in the new merchant's private ledger.

Why it might break the spec: Post-closure credit rules need a destination when the old program ends or ownership changes.

Severity: high


