# reservations: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### RSV-OPS-001 — A monthly permit and prepaid booking cover the same visit

Module: apx-reservations

Other modules: permits, accounts, resolution

Kind: edge

Closest existing scenario: RSV-07, RSV-17

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: Priya has a valid monthly permit and accidentally prepays $24 for the same garage and evening; policy prefers the permit.

When: Her plate matches both at entry.

Then: The chosen right and unused reservation are explicit; no automatic second charge or unsupported automatic refund is inferred.

Why it might break the spec: Part 14 may not specify precedence among overlapping entitlement types.

Severity: high

### RSV-OPS-002 — A guest drives the booker's different car

Module: apx-reservations

Other modules: lpr, resolution, accounts

Kind: edge

Closest existing scenario: RSV-19, RSV-22

Annex A row(s): APX-RSV-02, APX-RSV-03 (candidate mapping)

Given: A parent booked with their own plate but sends an adult child in another car; transfer requires authorization.

When: The child presents the confirmation at exit.

Then: The booking is applied only after the configured transfer evidence; original and substitute vehicle associations remain auditable.

Why it might break the spec: Plate correction is not necessarily an authorized transfer of a reservation.

Severity: high

### RSV-OPS-003 — Hotel moves the guest to another garage

Module: apx-reservations

Other modules: accounts, discovery, control

Kind: lifecycle

Closest existing scenario: RSV-14, RSV-19

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: A hotel relocates a prepaid guest from Lakeside to Riverside; the booking covers Lakeside only.

When: The guest arrives at Riverside with the original confirmation.

Then: A supported exchange or newly authorized right is required; place mismatch is not bypassed because the operator is shared.

Why it might break the spec: Cross-place exchanges may lack a portable booking and payment reconciliation flow.

Severity: high

### RSV-OPS-004 — One booking is shared between two arriving cars

Module: apx-reservations

Other modules: control, lpr, events

Kind: edge

Closest existing scenario: RSV-18, RSV-19

Annex A row(s): APX-RSV-03 (candidate mapping)

Given: Two family cars independently present the same single-use barcode at different entry lanes.

When: Both attempt to link an open session before either console refreshes.

Then: Only one consumes the right; the other receives the documented conflict and a valid alternative path.

Why it might break the spec: Consumed-right checks need atomicity across concurrent lane sessions.

Severity: high

### RSV-OPS-005 — The driver leaves briefly and returns

Module: apx-reservations

Other modules: control, lpr, accounts

Kind: lifecycle

Closest existing scenario: RSV-07, RSV-12

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: A hotel sells an in-and-out booking for 24 hours.

When: The guest exits for dinner and returns two hours later.

Then: The second visit follows the sold product without reusing an incompatible single-session link; unsupported re-entry is an explicit gap.

Why it might break the spec: The reservation lifecycle's single check-in session may not represent multiple permitted visits.

Severity: high

### RSV-OPS-006 — Consecutive reservations form one physical stay

Module: apx-reservations

Other modules: accounts, control, data

Kind: edge

Closest existing scenario: RSV-08, RSV-18

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: Priya books 08:00–12:00 and 12:00–18:00 separately and never leaves at noon.

When: At exit she presents both paid bookings.

Then: The stay is covered exactly once across the two intervals, with no fabricated exit at noon or silent overwrite of the first linked right.

Why it might break the spec: Linking one right to a session may not express sequential coverage by multiple reservations.

Severity: high

### RSV-OPS-007 — Arrival before the booking buys only the early interval

Module: apx-reservations

Other modules: accounts, control, resolution

Kind: edge

Closest existing scenario: RSV-19

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: A $24 booking starts at 18:00; Theo arrives at 17:00. Policy sells the early hour separately for $4.

When: The agent resolves his visit at exit.

Then: The fee is $4 beyond the already-paid booking and the record distinguishes both intervals.

Why it might break the spec: An out-of-window link refusal may leave no standard way to preserve partial reservation coverage.

Severity: high

### RSV-OPS-008 — Customer cancels while the lane checks in

Module: apx-reservations

Other modules: accounts, control, events

Kind: edge

Closest existing scenario: RSV-10, RSV-17

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: Theo cancels on the app just as his partner scans the booking at entry.

When: The cancel and check-in compete.

Then: One authoritative outcome wins: no simultaneously canceled, refunded, and consumed booking; any money correction follows that outcome.

Why it might break the spec: Version checks on separate cancellation and link surfaces may not serialize the shared entitlement.

Severity: high

### RSV-OPS-009 — A parking reservation is mistaken for valet service

Module: apx-reservations

Other modules: valet, accounts, resolution

Kind: edge

Closest existing scenario: RSV-02; VLT-01

Annex A row(s): APX-RSV-01; APX-VLT-02 (candidate mapping)

Given: A guest prepays $24 for self-parking and hands the car to valet, whose service adds $15 under published policy.

When: The stand identifies the reservation.

Then: The booking covers only its purchased service; any accepted upgrade has separately traceable pricing on the session.

Why it might break the spec: Reservation matching may not distinguish service entitlement from parking duration entitlement.

Severity: high

### RSV-OPS-010 — A no-show was actually parked under a transient ticket

Module: apx-reservations

Other modules: lpr, accounts, resolution

Kind: lifecycle

Closest existing scenario: RSV-11, RSV-22

Annex A row(s): APX-RSV-01, APX-RSV-03 (candidate mapping)

Given: Theo arrived on time but took a transient ticket; the reservation became noShow because it was unlinked.

When: At exit he provides credible entry evidence and the booking.

Then: The terminal state is not silently reversed; an authorized financial or entitlement remedy is recorded or reported unsupported.

Why it might break the spec: The no-show terminal rule may obstruct correction of a genuine missed association.

Severity: high


