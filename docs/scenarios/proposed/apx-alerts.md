# alerts: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Ten distinct acceptance questions; exact API contracts remain to be verified.

### ALT-OPS-001 — Repeated unpaid courtesy exits reach management

Module: apx-alerts

Other modules: resolution, accounts, control

Kind: lifecycle

Closest existing scenario: ALT-01, ALT-20; RES-01

Annex A row(s): APX-ALT-01, APX-ALT-02, APX-ALT-03; APX-RES-06 (candidate mapping)

Given: Policy escalates a third balance-related assistance visit in seven days; Smith still owes $185 after two courtesies.

When: Friday's denial is resolved to Smith and the operator rule triggers.

Then: One actionable alert references the account or episode, prior exceptions, current balance evidence, and reason for escalation; authorized management can retrieve it.

Why it might break the spec: Part 7 may accept a custom type without defining a portable repeat-debtor trigger, assignment, or evidence package.

Severity: high

### ALT-OPS-002 — Acknowledging the debt alert does not restore access

Module: apx-alerts

Other modules: accounts, resolution, control

Kind: lifecycle

Closest existing scenario: ALT-20

Annex A row(s): APX-ALT-01; APX-RES-03 (candidate mapping)

Given: A manager acknowledges Smith's unpaid-balance escalation and says they will call him.

When: Smith retries the exit.

Then: The alert is acknowledged, but payment and access facts remain unchanged until an authorized decision occurs.

Why it might break the spec: Alert acknowledgment must not be interpreted as a financial clearance or gate approval.

Severity: high

### ALT-OPS-003 — Payment arrives while a manager works the alert

Module: apx-alerts

Other modules: accounts, resolution, events

Kind: lifecycle

Closest existing scenario: ALT-05

Annex A row(s): APX-ALT-01; APX-ACC-02 (candidate mapping)

Given: Smith's $185 escalation is acknowledged; policy closes that alert after verified full settlement.

When: Smith pays before the manager calls back.

Then: The manager sees the captured payment and current balance; alert resolution records the reason and does not duplicate a courtesy action.

Why it might break the spec: Domain settlement and alert closure lack automatic equivalence unless the operator supplies the rule.

Severity: medium

### ALT-OPS-004 — A small payment leaves the escalation open

Module: apx-alerts

Other modules: accounts, resolution

Kind: edge

Closest existing scenario: ALT-05; ACC-05

Annex A row(s): APX-ALT-01; APX-ACC-02 (candidate mapping)

Given: The configured resolution condition is zero overdue balance; Smith owes $185.

When: He pays $5 after the escalation is raised.

Then: The balance becomes $180 and the alert remains actionable under the configured condition.

Why it might break the spec: Any-payment event handling may incorrectly resolve a continuing business problem.

Severity: high

### ALT-OPS-005 — Broken media must not look like repeated debt abuse

Module: apx-alerts

Other modules: credentials, resolution, control

Kind: edge

Closest existing scenario: ALT-18; RES-20

Annex A row(s): APX-ALT-03; APX-RES-06 (candidate mapping)

Given: Maya has three assistance calls for damaged media but a current account.

When: The repeat-debtor rule evaluates her history.

Then: The calls do not trigger a debt-specific escalation; source reasons remain available for separate service-quality reporting.

Why it might break the spec: Courtesy counts without reasons conflate operator service problems with payment exceptions.

Severity: medium

### ALT-OPS-006 — The same person calls twice about one denial

Module: apx-alerts

Other modules: resolution, events

Kind: edge

Closest existing scenario: ALT-02

Annex A row(s): APX-ALT-02; APX-RES-09 (candidate mapping)

Given: Smith presses the intercom and opens chat about the same unpaid exit; each integration uses its own request key.

When: Both workflows propose a management alert.

Then: The configured episode-level deduplication yields one escalation or explicitly linked duplicates, not two independent debtor incidents.

Why it might break the spec: Idempotency keys do not deduplicate independently created alerts about one business episode.

Severity: medium

### ALT-OPS-007 — A later visit after a resolved alert is a new incident

Module: apx-alerts

Other modules: accounts, resolution

Kind: lifecycle

Closest existing scenario: ALT-07

Annex A row(s): APX-ALT-01, APX-ALT-02 (candidate mapping)

Given: Smith settled last month's debt and its alert is resolved. This month he incurs a new qualifying debt.

When: A new assistance visit reaches the escalation threshold.

Then: A new alert retains the new incident's evidence; the terminal old alert is not reopened or overwritten.

Why it might break the spec: Recurring business conditions need incident identity beyond a stable account reference.

Severity: medium

### ALT-OPS-008 — Site manager receives only the permitted portion

Module: apx-alerts

Other modules: accounts, resolution, discovery

Kind: security

Closest existing scenario: ALT-10, ALT-15

Annex A row(s): APX-ALT-03; APX-CORE-07 (candidate mapping)

Given: A regional review includes Lakeside and Riverside debt; the Lakeside manager is granted only Lakeside.

When: The workflow exposes the Lakeside escalation to that manager.

Then: The alert does not embed restricted Riverside balance or visit history in free text or extensions.

Why it might break the spec: Place-filtered alert delivery can still leak data embedded from another site's records.

Severity: high

### ALT-OPS-009 — Shift handover preserves who must act

Module: apx-alerts

Other modules: resolution, discovery

Kind: lifecycle

Closest existing scenario: ALT-20, ALT-21

Annex A row(s): APX-ALT-01, APX-ALT-03 (candidate mapping)

Given: The evening manager acknowledges a balance escalation but leaves before contacting the employer.

When: The night manager takes over.

Then: The unresolved incident remains visible with prior actions and a clear external assignment record; acknowledgment alone does not remove it from work.

Why it might break the spec: The alert state machine may not provide standardized assignment or reassignment.

Severity: medium

### ALT-OPS-010 — Debt waiver and alert expiry are different outcomes

Module: apx-alerts

Other modules: accounts, resolution, data

Kind: edge

Closest existing scenario: ALT-09

Annex A row(s): APX-ALT-01, APX-ALT-04 (candidate mapping)

Given: A debtor alert expires after 24 hours; no payment or waiver has occurred.

When: Management reviews expired incidents on Monday.

Then: Reporting labels it expired, retains the unresolved financial facts, and does not count it as a debt resolved or approved waiver.

Why it might break the spec: Terminal alert status is not a business-resolution outcome.

Severity: medium


