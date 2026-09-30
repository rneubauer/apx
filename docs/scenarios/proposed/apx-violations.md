# violations: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### VIO-OPS-001 — Permit canceled after the observation but before review

Module: apx-violations

Other modules: permits, credentials, data

Kind: lifecycle

Closest existing scenario: VIO-01, VIO-06

Annex A row(s): APX-VIO-01, APX-VIO-06 (candidate mapping)

Given: Priya had a valid permit at 10:00 when observed; it was canceled at noon.

When: The reviewer processes the 10:00 detection at 14:00.

Then: Eligibility uses the relevant historical instant, so a later cancellation does not make earlier entitled parking unauthorized.

Why it might break the spec: Current-right lookups may not retain enough temporal evidence for retrospective eligibility.

Severity: high

### VIO-OPS-002 — A courtesy exit is not proof that the parking debt was waived

Module: apx-violations

Other modules: control, accounts, resolution

Kind: edge

Closest existing scenario: VIO-03, VIO-10; CTL-21

Annex A row(s): APX-VIO-01, APX-VIO-06; APX-RES-06 (candidate mapping)

Given: An agent permits an exit while leaving $18 owed under policy; enforcement requires review of such exceptions.

When: The unpaid visit becomes an enforcement candidate.

Then: The reviewer sees the actual exception terms; neither automatic dismissal nor automatic issuance is inferred solely from the vend.

Why it might break the spec: A courtesy command may not express whether it waived fees, deferred payment, or only allowed movement.

Severity: high

### VIO-OPS-003 — App purchase occurs during an officer's inspection

Module: apx-violations

Other modules: accounts, data, resolution

Kind: edge

Closest existing scenario: VIO-03, VIO-07

Annex A row(s): APX-VIO-01, APX-VIO-03, APX-VIO-06 (candidate mapping)

Given: At 10:00 an officer starts inspection; at 10:01 the driver buys parking. Fixture policy begins coverage at purchase without backdating.

When: The officer records a 10:00 detection at 10:02.

Then: The eligibility record distinguishes the unpaid 10:00 instant from the later purchase and applies configured grace rules.

Why it might break the spec: Creation-time and detection-time eligibility may disagree unless the evaluation instant is explicit.

Severity: high

### VIO-OPS-004 — Rental company names a different responsible driver

Module: apx-violations

Other modules: lpr, accounts, resolution

Kind: lifecycle

Closest existing scenario: VIO-16, VIO-21

Annex A row(s): APX-VIO-04, APX-VIO-07 (candidate mapping)

Given: A notice was sent to a rental company; it provides documented rental times identifying the driver.

When: The operator reviews the liability dispute.

Then: Original notice, evidence, and party history remain auditable; any permitted reassignment or reissue follows an explicit supported process.

Why it might break the spec: The violation lifecycle may lack a liable-party transfer workflow.

Severity: high

### VIO-OPS-005 — A plate correction clears one notice but not another

Module: apx-violations

Other modules: lpr, resolution, accounts

Kind: edge

Closest existing scenario: VIO-09, VIO-20

Annex A row(s): APX-VIO-02, APX-VIO-07 (candidate mapping)

Given: Two notices contain plate ABC123 on different days; evidence proves only Tuesday's read was wrong.

When: The supervisor corrects Tuesday's case.

Then: Only Tuesday's record follows the authorized void or appeal outcome; Wednesday's evidence and balance remain intact.

Why it might break the spec: Bulk plate-based corrections can mistakenly treat an identifier correction as a universal liability decision.

Severity: high

### VIO-OPS-006 — Permit holder uses a restricted bay

Module: apx-violations

Other modules: permits, data, resolution

Kind: edge

Closest existing scenario: VIO-01, VIO-07

Annex A row(s): APX-VIO-01, APX-VIO-06 (candidate mapping)

Given: A garage-wide monthly permit permits ordinary bays but excludes a marked delivery bay; fixture policy defines that restriction.

When: The holder parks in the delivery bay and is observed.

Then: Eligibility considers the specific use restriction; the parent-level permit does not automatically dismiss every violation type.

Why it might break the spec: Ancestor-bound entitlement may be applied too broadly to a restricted use.

Severity: high

### VIO-OPS-007 — Customer pays the old amount after a penalty increase

Module: apx-violations

Other modules: accounts, resolution, events

Kind: edge

Closest existing scenario: VIO-15, VIO-19

Annex A row(s): APX-VIO-05, APX-VIO-11 (candidate mapping)

Given: A notice increases from $35 to $43.75 under the configured schedule; the customer follows an older $35 payment request.

When: The $35 payment is captured and submitted as settlement.

Then: Money is retained accurately but full paid status requires the applicable settlement rule; any $8.75 residual is explicit.

Why it might break the spec: Payment-reference attachment may not validate the amount against the current obligation.

Severity: high

### VIO-OPS-008 — One receipt is offered to settle two notices

Module: apx-violations

Other modules: accounts, resolution, data

Kind: security

Closest existing scenario: VIO-15

Annex A row(s): APX-VIO-05; APX-ACC-03 (candidate mapping)

Given: A driver has two $35 notices and only one captured $35 payment allocated to the first.

When: The same payment reference is attached to the second.

Then: The system does not claim $70 settled from $35 without a legitimate allocation mechanism.

Why it might break the spec: Reference-only settlement may not define uniqueness or remaining payment allocation.

Severity: high

### VIO-OPS-009 — Employer buys a retroactive permit after the ticket

Module: apx-violations

Other modules: permits, accounts, resolution

Kind: edge

Closest existing scenario: VIO-01, VIO-16

Annex A row(s): APX-VIO-01, APX-VIO-04, APX-VIO-06 (candidate mapping)

Given: Dana was cited at 09:00; the employer buys a permit at noon and requests a start of 08:00.

When: The operator reviews the request and appeal.

Then: Actual issuance time remains visible; configured policy determines retrospective entitlement and any appeal outcome.

Why it might break the spec: Effective time and knowledge at detection must remain distinct; backdating cannot silently erase history.

Severity: high

### VIO-OPS-010 — A vehicle leaves and returns between enforcement rounds

Module: apx-violations

Other modules: lpr, data, accounts

Kind: edge

Closest existing scenario: VIO-03, VIO-20

Annex A row(s): APX-VIO-01, APX-VIO-06 (candidate mapping)

Given: A delivery van parks 09:00–09:20 and 15:00–15:20; each visit meets a 30-minute maximum.

When: An enforcement review sees observations at 09:10 and 15:10 plus the intervening passages.

Then: It evaluates two visits rather than inferring six continuous hours from plate-only observations.

Why it might break the spec: Enforcement can overstate duration if it ignores visit boundaries supplied by other modules.

Severity: high


