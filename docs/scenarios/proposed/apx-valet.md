# valet: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### VLT-OPS-001 — A spouse requests collection but is not authorized for handback

Module: apx-valet

Other modules: resolution, credentials

Kind: security

Closest existing scenario: VLT-07, VLT-12

Annex A row(s): APX-VLT-05, APX-VLT-06 (candidate mapping)

Given: The registered guest forwards the retrieval link to a spouse; policy requires separate handback authorization.

When: The spouse retrieves the car and arrives at the stand.

Then: A retrieval request does not prove claimant authority; handback follows verified authorization and records the outcome without storing secret codes.

Why it might break the spec: Ticket-scoped retrieval permission and custody-transfer permission are distinct.

Severity: high

### VLT-OPS-002 — Hotel pays parking but the guest owes valet service

Module: apx-valet

Other modules: accounts, reservations, validations

Kind: edge

Closest existing scenario: VLT-08, VLT-11

Annex A row(s): APX-VLT-02 (candidate mapping)

Given: The hotel covers $24 parking while the guest owes a $15 valet supplement.

When: The guest collects the vehicle.

Then: Session accounting allocates both responsibilities and settles $39 once; the valet ticket references the session without duplicating money.

Why it might break the spec: The integration may lack a supported split-payer settlement representation.

Severity: high

### VLT-OPS-003 — Guest changes rooms and the old folio closes

Module: apx-valet

Other modules: accounts, resolution, data

Kind: lifecycle

Closest existing scenario: VLT-08, VLT-20

Annex A row(s): APX-VLT-02 (candidate mapping)

Given: A valet stay is associated with room 412's account; the hotel moves the guest to room 618.

When: The guest checks out and asks for the car.

Then: The same custody record and stay remain traceable; charges go to the authorized current folio without a duplicate stay.

Why it might break the spec: External account reassignment may not have a portable correlation or audit path.

Severity: high

### VLT-OPS-004 — Prepaid self-parker upgrades to valet after entering

Module: apx-valet

Other modules: reservations, accounts, control

Kind: lifecycle

Closest existing scenario: VLT-01, VLT-13

Annex A row(s): APX-VLT-01, APX-VLT-02 (candidate mapping)

Given: A guest entered on a prepaid self-parking booking and later hands the car to valet.

When: The stand accepts custody.

Then: The existing parking visit remains identifiable and only the accepted service increment is charged.

Why it might break the spec: Drop-off may assume a new stay and create duplicate sessions or consume the reservation twice.

Severity: high

### VLT-OPS-005 — Guest collects luggage without ending custody

Module: apx-valet

Other modules: resolution, data

Kind: edge

Closest existing scenario: VLT-10, VLT-11

Annex A row(s): APX-VLT-01, APX-VLT-02, APX-VLT-05 (candidate mapping)

Given: A guest asks to access the boot, then wants the car parked again.

When: The runner stages it, supervises access, and reparks.

Then: Custody is not recorded as handedBack merely because the guest touched the vehicle; no settled departure is invented.

Why it might break the spec: The lifecycle may lack a distinct temporary customer-access purpose.

Severity: medium

### VLT-OPS-006 — Guest takes the car to dinner and returns overnight

Module: apx-valet

Other modules: reservations, accounts, data

Kind: lifecycle

Closest existing scenario: VLT-11, VLT-01

Annex A row(s): APX-VLT-01, APX-VLT-02 (candidate mapping)

Given: A hotel package permits valet in-and-out for one nightly fee.

When: The guest receives the car at 19:00 and drops it again at 22:00.

Then: Separate custody transfers remain auditable while package charging avoids a second nightly fee.

Why it might break the spec: Ticket lifecycle, physical visits, and a multi-visit commercial entitlement may not align.

Severity: high

### VLT-OPS-007 — Two cars on one room account are confused

Module: apx-valet

Other modules: accounts, resolution

Kind: edge

Closest existing scenario: VLT-20

Annex A row(s): APX-VLT-02, APX-VLT-05 (candidate mapping)

Given: A family parks two similar SUVs on one hotel account.

When: The desk searches by account and the guest requests only one car.

Then: Selection and verification identify the particular vehicle and ticket; room number alone does not choose the car.

Why it might break the spec: Account-level lookup is not sufficient custody-transfer evidence.

Severity: high

### VLT-OPS-008 — A friend pays the bill but may not take the car

Module: apx-valet

Other modules: accounts, resolution

Kind: security

Closest existing scenario: VLT-11, VLT-12

Annex A row(s): APX-VLT-02, APX-VLT-05 (candidate mapping)

Given: A friend pays the guest's $39 bill while the guest is elsewhere.

When: The friend requests immediate handback.

Then: Settlement is visible, but handback still requires the configured claimant verification.

Why it might break the spec: Financial settlement must not confer custody rights.

Severity: high

### VLT-OPS-009 — Damage complaint before signing the handback

Module: apx-valet

Other modules: resolution, alerts, accounts

Kind: lifecycle

Closest existing scenario: VLT-20, VLT-21

Annex A row(s): APX-VLT-03, APX-VLT-05 (candidate mapping)

Given: At collection the guest reports a new dent and declines to acknowledge the original condition description.

When: The supervisor documents the complaint before verified handback.

Then: Original evidence remains immutable; new observations and the dispute are dated, and absent acknowledgment is not recorded as consent.

Why it might break the spec: Condition-history and customer-service dispute linkage may not distinguish acknowledgment from agreement.

Severity: medium

### VLT-OPS-010 — A guest leaves without settling the account

Module: apx-valet

Other modules: accounts, alerts, resolution

Kind: lifecycle

Closest existing scenario: VLT-11

Annex A row(s): APX-VLT-01, APX-VLT-02 (candidate mapping)

Given: A verified handback is permitted before payment under hotel policy; the guest subsequently refuses the $39 charge.

When: The billing workflow records the unpaid obligation.

Then: The ticket accurately remains handedBack until the defined settlement condition; management sees debt without the system claiming continued vehicle custody.

Why it might break the spec: Closed-ticket reporting may conflate physical handback with financial settlement.

Severity: high


