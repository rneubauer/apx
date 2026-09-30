# resolution: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Ten distinct acceptance questions; exact API contracts remain to be verified.

### RES-OPS-001 — The third visit after two unpaid courtesy exits

Module: apx-resolution

Other modules: accounts, credentials, control, alerts

Kind: lifecycle

Closest existing scenario: RES-01, RES-20

Annex A row(s): APX-RES-03, APX-RES-06 (candidate mapping)

Given: Smith owes $185 and received balance-related courtesy exits Monday and Wednesday. Policy permits two per holder in seven days.

When: Smith calls Friday from a different exit lane.

Then: The context carries both prior overrides and current debt; another courtesy is refused. An authorized escalation path reaches management with the episode evidence.

Why it might break the spec: Part 17 history must drive policy across visits and lanes; management escalation linkage needs verification.

Severity: high

### RES-OPS-002 — A broken card and a balance hold coexist

Module: apx-resolution

Other modules: credentials, accounts, control

Kind: edge

Closest existing scenario: RES-01, RES-14

Annex A row(s): APX-RES-01, APX-RES-03 (candidate mapping)

Given: Maya has an unreadable card and $185 overdue. Policy waives fees for damaged media but does not waive debt.

When: The agent identifies Maya using an approved alternative.

Then: The context preserves both facts; replacing media does not recommend an unrestricted debt override.

Why it might break the spec: A single issue classification may conceal another independently blocking condition.

Severity: high

### RES-OPS-003 — Paid up but never activated

Module: apx-resolution

Other modules: accounts, credentials, permits

Kind: edge

Closest existing scenario: RES-01; CRD-04

Annex A row(s): APX-RES-01, APX-RES-05 (candidate mapping)

Given: Dana paid October dues, holds a valid permit, but the desk left the collected card issued rather than active.

When: Dana calls at the entry lane on October 2.

Then: The resolution distinguishes activation from money owed and offers only an authorized activation or assistance path; no duplicate payment request.

Why it might break the spec: Part 17 may lack an execution descriptor for the necessary credential-domain action.

Severity: high

### RES-OPS-004 — Family phone does not identify the driver

Module: apx-resolution

Other modules: accounts, credentials, permits

Kind: security

Closest existing scenario: RES-03, RES-18

Annex A row(s): APX-RES-01, APX-RES-02 (candidate mapping)

Given: Two spouses share a phone and car but have separate accounts and courtesy histories.

When: One calls about the car in lane 2.

Then: The verified session and entitlement determine the subject; lookup matches alone disclose no unrelated debt or authorize the other spouse's exception.

Why it might break the spec: Correlation identifiers and shared contact keys are not proof of identity.

Severity: high

### RES-OPS-005 — A chat continues as an intercom call

Module: apx-resolution

Other modules: accounts, control, events

Kind: lifecycle

Closest existing scenario: RES-22, RES-26

Annex A row(s): APX-RES-06, APX-RES-09 (candidate mapping)

Given: Smith starts a payment chat, then presses the intercom during the same unresolved exit.

When: The platform links the two contacts under its episode correlation while retaining each opaque interaction identifier.

Then: The agent sees the payment and prior actions once; recording two contacts does not create two courtesy uses.

Why it might break the spec: Part 17 episode correlation may not define multi-contact history and counting sufficiently.

Severity: medium

### RES-OPS-006 — Supervisor approval is for this car

Module: apx-resolution

Other modules: control, accounts, lpr

Kind: security

Closest existing scenario: RES-07

Annex A row(s): APX-RES-03, APX-RES-04 (candidate mapping)

Given: A supervisor approves one exception for Smith's $185 balance at lane 2.

When: Smith backs away and a different customer occupies the lane before execution.

Then: Execution rechecks the target and refuses reuse of Smith's approval for the new customer.

Why it might break the spec: Approval binding may cover command type but not the current subject or transaction.

Severity: high

### RES-OPS-007 — A promised exception is not an approved exception

Module: apx-resolution

Other modules: control, accounts

Kind: security

Closest existing scenario: RES-07, RES-19

Annex A row(s): APX-RES-03, APX-RES-04, APX-RES-06 (candidate mapping)

Given: A previous agent wrote 'manager will probably let you out' in Smith's support summary.

When: Smith cites that note as approval on the next visit.

Then: The note remains evidence of the conversation, not executable approval; current server policy governs.

Why it might break the spec: Free-text support history could be mistaken for an authorization artifact.

Severity: high

### RES-OPS-008 — A disputed debt is only part of the balance

Module: apx-resolution

Other modules: accounts, alerts

Kind: edge

Closest existing scenario: RES-01

Annex A row(s): APX-RES-01, APX-RES-03 (candidate mapping)

Given: Smith owes $185, including $100 under review. Policy requires payment of the undisputed $85 for an exception.

When: Smith requests assistance without agreeing to the disputed charge.

Then: The server offers the configured $85 path only if authoritative records support that split; otherwise it escalates the ambiguity.

Why it might break the spec: The account overlay may expose a total without an interoperable dispute allocation.

Severity: high

### RES-OPS-009 — Guest at the lane, employer owns the account

Module: apx-resolution

Other modules: accounts, permits, control

Kind: security

Closest existing scenario: RES-18

Annex A row(s): APX-RES-02, APX-RES-03 (candidate mapping)

Given: A courier's valid fleet credential is blocked by the employer's overdue invoice; the driver may not view company finances.

When: The driver asks why entry failed.

Then: The authorized workflow explains the access restriction without disclosing company balances and directs financial resolution to the account authority.

Why it might break the spec: Operational assistance and financial disclosure require distinct permissions within one context.

Severity: high

### RES-OPS-010 — An old exception survives context expiry

Module: apx-resolution

Other modules: control, alerts, data

Kind: lifecycle

Closest existing scenario: RES-16, RES-20

Annex A row(s): APX-RES-03, APX-RES-06 (candidate mapping)

Given: A courtesy exit occurred Monday; its temporary context expired, but the seven-day courtesy policy still applies.

When: The same holder returns Thursday.

Then: A fresh context obtains durable override evidence and counts the prior exception accurately.

Why it might break the spec: Short-lived contexts must not be the only source for longer-lived business policy.

Severity: high


