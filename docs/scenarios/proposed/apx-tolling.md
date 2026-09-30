# tolling: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### TOL-OPS-001 — Monthly parking includes the access-road toll

Module: apx-tolling

Other modules: permits, accounts, credentials

Kind: edge

Closest existing scenario: TOL-01, TOL-07

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: Lakeside's premium monthly product includes one inbound crossing per workday; ordinary permits do not.

When: A premium holder drives to the garage.

Then: The passage is recorded and priced under the applicable included-benefit policy, without a fabricated collected payment.

Why it might break the spec: Toll pricing may not expose the entitlement evidence or consumption of an included crossing.

Severity: high

### TOL-OPS-002 — Parking cancellation does not erase a used crossing

Module: apx-tolling

Other modules: reservations, accounts, resolution

Kind: lifecycle

Closest existing scenario: TOL-05, TOL-14

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: Theo uses the $3 access road and then cancels his $24 parking booking; terms refund parking only.

When: The booking refund completes.

Then: The $3 toll remains correctly owed or paid; the parking refund does not reverse an unrelated passage.

Why it might break the spec: A shared account or episode can cause overbroad refunds across separate obligations.

Severity: high

### TOL-OPS-003 — Sold car produces a not-liable dispute

Module: apx-tolling

Other modules: lpr, accounts, resolution

Kind: lifecycle

Closest existing scenario: TOL-08, TOL-13

Annex A row(s): APX-TOL-02, APX-TOL-03 (candidate mapping)

Given: A former owner is billed for a $3 crossing after a documented sale.

When: The operator opens a dispute using notLiable where supported by the release registry.

Then: Review preserves passage evidence and establishes the authorized liability remedy; any refund is an actual Part 13 transaction.

Why it might break the spec: A reason code does not itself model liable-party transfer or prove that money was returned.

Severity: high

### TOL-OPS-004 — Fleet tag moves to a different vehicle class

Module: apx-tolling

Other modules: credentials, lpr, accounts

Kind: edge

Closest existing scenario: TOL-07, TOL-16

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: A fleet moves a tag from a two-axle van to a three-axle truck without updating its account.

When: The tag and observed vehicle classification disagree at the crossing.

Then: Both facts remain available and pricing uses the configured authoritative source, with a review path for disagreement.

Why it might break the spec: Credential identity may be confused with the vehicle characteristics that determine price.

Severity: high

### TOL-OPS-005 — Trailer changes price for just one journey

Module: apx-tolling

Other modules: lpr, accounts, data

Kind: edge

Closest existing scenario: TOL-07, TOL-13

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: A van tows a trailer outbound and returns without it; policy charges $5 and $3 respectively.

When: Both crossings are priced.

Then: Each passage keeps its own classification and amount; updating the vehicle account does not retroactively reprice both.

Why it might break the spec: Pricing must bind to observed passage facts rather than the latest account vehicle profile.

Severity: high

### TOL-OPS-006 — One fleet remittance pays a batch of crossings

Module: apx-tolling

Other modules: accounts, data

Kind: edge

Closest existing scenario: TOL-05, TOL-06

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: A fleet remits $30 for ten $3 transactions.

When: The billing integration attaches settlement evidence to the ten transactions.

Then: Allocation totals $30 and each crossing is settled once; reporting does not interpret the shared payment as $300.

Why it might break the spec: Payment-reference semantics may not define allocation of one payment across many tolls.

Severity: high

### TOL-OPS-007 — Dispute opened before the scheduled account collection

Module: apx-tolling

Other modules: accounts, resolution, events

Kind: edge

Closest existing scenario: TOL-08, TOL-12

Annex A row(s): APX-TOL-02, APX-TOL-03 (candidate mapping)

Given: A $3 transaction is priced and queued for billing; policy pauses collection during a dispute.

When: The driver disputes before the billing batch executes.

Then: The batch rechecks the current transaction state before charging; it cannot collect first and discover attachment is forbidden later.

Why it might break the spec: Toll state enforcement alone may happen after money has already moved in another module.

Severity: high

### TOL-OPS-008 — Adjusted toll has already been paid

Module: apx-tolling

Other modules: accounts, data, resolution

Kind: lifecycle

Closest existing scenario: TOL-09, TOL-13

Annex A row(s): APX-TOL-02, APX-TOL-03 (candidate mapping)

Given: A driver paid $5; review reduces the correct toll to $3.

When: The reviewer resolves the dispute as adjusted and authorizes the difference back.

Then: Original and adjusted pricing remain traceable and an actual $2 refund reconciles the net $3 collection.

Why it might break the spec: Pricing adjustment is not itself a refund, and paid adjusted-state semantics need verification.

Severity: high

### TOL-OPS-009 — A prepaid parking receipt is offered for an unpaid toll

Module: apx-tolling

Other modules: reservations, accounts, resolution

Kind: edge

Closest existing scenario: TOL-05; ACC-18

Annex A row(s): APX-TOL-01; APX-ACC-03 (candidate mapping)

Given: Theo has a $24 parking receipt and an unpaid $3 road crossing; his product excludes tolls.

When: He asks the call center to use the receipt as toll settlement.

Then: The receipt's obligation binding is checked; a parking payment is not attached as proof of a separately paid toll.

Why it might break the spec: Amount and account matching do not prove that a payment settles the toll.

Severity: high

### TOL-OPS-010 — A contractor exemption expires during a longer parking stay

Module: apx-tolling

Other modules: permits, credentials, accounts

Kind: lifecycle

Closest existing scenario: TOL-07; PRM-10

Annex A row(s): APX-TOL-01, APX-TOL-03 (candidate mapping)

Given: Dana's road exemption ends at 18:00 but parking remains permitted until 22:00; terms charge crossings after 18:00.

When: Dana crosses outbound at 19:00.

Then: The toll is priced from crossing-time entitlement while the parking stay remains valid.

Why it might break the spec: Separate product windows must not collapse into one global active-or-inactive status.

Severity: high


