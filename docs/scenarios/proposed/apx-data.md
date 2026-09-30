# data: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### DATA-OPS-001 — Three calls, two courtesies, one unpaid balance

Module: apx-data

Other modules: resolution, control, accounts, alerts

Kind: edge

Closest existing scenario: DATA-31; RES-20

Annex A row(s): APX-DATA-03, APX-DATA-04; APX-RES-06 (candidate mapping)

Given: Smith has three support contacts, two actual courtesy commands, and $185 still owed.

When: The operations analyst builds the weekly repeat-debtor report.

Then: It reports three contacts, two qualifying overrides, and one current debt; joins do not multiply money by contact or event count.

Why it might break the spec: The feed may transport facts without enough stable relationships for these separate business measures.

Severity: medium

### DATA-OPS-002 — One payment appears on both APX and APDS surfaces

Module: apx-data

Other modules: accounts, events

Kind: edge

Closest existing scenario: DATA-31; ACC-05

Annex A row(s): APX-DATA-01; APX-ACC-07 (candidate mapping)

Given: A captured $185 payment is represented as a PaymentRecord and bound to a native APDS Payment.

When: Finance imports both supported representations.

Then: Collected revenue is $185, with a traceable identity mapping rather than two independent receipts.

Why it might break the spec: Materialization needs an identifiable relationship to prevent dual-surface double counting.

Severity: high

### DATA-OPS-003 — Month-end refund preserves the original sale period

Module: apx-data

Other modules: accounts, events

Kind: lifecycle

Closest existing scenario: DATA-03; ACC-14

Annex A row(s): APX-DATA-03; APX-ACC-05 (candidate mapping)

Given: A $24 September parking payment is partially refunded by $6 in October.

When: Finance rebuilds September and October activity from the available records.

Then: The original collection and later refund are temporally distinguishable; reports show net $18 without assigning both events to September.

Why it might break the spec: A current cumulative refund total may not be sufficient to reconstruct period-specific cash activity.

Severity: high

### DATA-OPS-004 — Permit sales are not current vehicle occupancy

Module: apx-data

Other modules: permits, lpr, events

Kind: edge

Closest existing scenario: DATA-29; PRM-01

Annex A row(s): APX-DATA-08; APX-PRM-01 (candidate mapping)

Given: Lakeside has 120 issued monthly permits, 80 monthly cars parked, and 40 transient cars parked.

When: The dashboard displays permit availability and physical occupancy.

Then: Issued rights and occupied spaces are separate measures; the agreed occupancy source yields 120 vehicles, not 160 or 240.

Why it might break the spec: Capacity, sold entitlements, and observed demand can be incorrectly combined.

Severity: medium

### DATA-OPS-005 — Valet staging is not an additional occupied parking visit

Module: apx-data

Other modules: valet, lpr, events

Kind: edge

Closest existing scenario: DATA-29; VLT-10

Annex A row(s): APX-DATA-08; APX-VLT-02 (candidate mapping)

Given: One valet car moves from storage to staging under the same custody record.

When: The reporting integration processes both location changes.

Then: The vehicle is counted once at the garage level, with the correct subarea attribution under the published counting method.

Why it might break the spec: Hierarchical occupancy and custody movements may produce duplicate demand.

Severity: medium

### DATA-OPS-006 — A canceled unused permit disappears from current inventory but not sales history

Module: apx-data

Other modules: permits, accounts, events

Kind: lifecycle

Closest existing scenario: DATA-05, DATA-15; PRM-09

Annex A row(s): APX-DATA-03, APX-DATA-05 (candidate mapping)

Given: A permit was sold for $185 and canceled before use with a full refund.

When: The warehouse receives the assigned-right tombstone.

Then: Current availability updates while historical sale and refund remain reconcilable under retention policy.

Why it might break the spec: Deleting entitlement state must not be interpreted as deleting the financial history.

Severity: high

### DATA-OPS-007 — Corrected vehicle association changes attribution without creating revenue

Module: apx-data

Other modules: lpr, accounts, resolution

Kind: lifecycle

Closest existing scenario: DATA-12, DATA-13; LPR-11

Annex A row(s): APX-DATA-02, APX-DATA-03 (candidate mapping)

Given: An $18 paid session is corrected from the wrong plate to the verified plate.

When: The change feed updates the session.

Then: Visit attribution changes with provenance; the same $18 payment remains one collection.

Why it might break the spec: Updating a reporting join key can accidentally create a new sale or lose the existing one.

Severity: medium

### DATA-OPS-008 — Site changes operator while prior refunds remain possible

Module: apx-data

Other modules: accounts, discovery, events

Kind: lifecycle

Closest existing scenario: DATA-16; DSC-12

Annex A row(s): APX-CORE-15, APX-CORE-16; APX-DATA-03 (candidate mapping)

Given: Lakeside changes operator October 1; September payment history retains its original provenance.

When: The new operator imports authorized history and reviews a September refund request.

Then: Historical and new activity remain distinguishable; post-cutover publishing authority is enforced and refund authority is explicitly established.

Why it might break the spec: Migration provenance does not automatically transfer payment-processing authority or historical adjustment ownership.

Severity: high

### DATA-OPS-009 — Courtesy report distinguishes waived fees from deferred debt

Module: apx-data

Other modules: accounts, resolution, control

Kind: edge

Closest existing scenario: DATA-31; CTL-21

Annex A row(s): APX-DATA-03; APX-RES-06 (candidate mapping)

Given: Two $18 exits are allowed: one fee is expressly waived, the other remains collectible.

When: Finance reports concessions and receivables.

Then: The report shows an $18 concession and $18 still owed, based on authoritative adjustment records.

Why it might break the spec: Identical gate commands or generic courtesy labels may not encode their different financial consequences.

Severity: high

### DATA-OPS-010 — Regional reporting survives the same person having local IDs

Module: apx-data

Other modules: accounts, reservations, discovery

Kind: edge

Closest existing scenario: DATA-16; RSV-14

Annex A row(s): APX-CORE-11; APX-DATA-01 (candidate mapping)

Given: A regional report combines Lakeside and Riverside, where one customer has unrelated local holder IDs.

When: The analyst asks for visit totals by site and distinct customers regionally.

Then: Site totals remain correct; unique-person totals require an authorized identity mapping and are otherwise labeled indeterminate.

Why it might break the spec: Plate or name joins can invent person-level identity across implementations.

Severity: medium


