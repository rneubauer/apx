# APX operational relationship scenarios

> **Status: proposed, not yet verified.** These 150 cases were drafted by
> ChatGPT on 2026-09-29 from [`brief.md`](brief.md), to widen the vetting
> suite with operator-minded situations. Nothing here has been checked
> against the spec yet. Each case is being triaged into one of: not
> realistic or out of scope, operator policy only, already covered, needs
> a scenario, or a spec gap; the results will be published here as
> `SUSPECTS.md` and `TRIAGE.md`. Accepted cases become validated scenarios
> in [`../by-module/`](../by-module/README.md); gaps become findings and,
> where needed, spec changes. The text below is ChatGPT's own.

Working draft for APX 0.13.0. This catalog adds 150 proposed cases, ten owned by each of the 15 supplied module files. It is an initial expansion, not a completeness claim or a per-module limit. Payment history is covered with accounts, SSE with events, and mTLS with discovery, following the supplied file organization.

Browse the [complete 150-case index](INDEX.md) or open a module below.

## Direction agreed September 29, 2026

Think like a parking operations professional. Prioritize people, entitlements, money, repeated visits, exceptions, and relationships between modules. Generic outages, malformed requests, and routine authentication permutations are not the driver. There is no target ceiling: 100–150 useful cases in an individual module would be acceptable. Add cases when the operational behavior differs, not merely when a name or amount differs.

Each case has one primary acceptance question and one owning module. The other modules identify the end-to-end dependencies. Related stories can appear under different modules only when they test a different consequence. The closest-existing reference explains the neighboring coverage; it does not mean the new case replaces it.

## Status and evidence

All 15 local module scenario files and 00-brief.md were reviewed. The online release and written-standard links were attempted but could not be retrieved through the browser tool. Annex A mappings below are candidate traceability links based on the local summaries, not independently verified citations to the release. Suspected gaps require review against the pinned 0.13.0 schema and prose. Some local files describe older findings as open while other files describe their fixes; those notes cannot establish current defects.

Every Then is a proposed acceptance outcome. Where it follows a local requirement, that requirement is named. Where it depends on business policy, the Given supplies the policy. APX does not prescribe debt thresholds, courtesy limits, identity verification procedures, product priority, or enforcement discretion. The policy server decides; the agent communicates and executes only authorized actions. A missing policy configuration or representation is a finding to investigate, not permission to fabricate an endpoint, field, status, or transition.

These are plain-English test designs, not executable tests and not test results. For each case, implementation work must resolve any open contract question, pin the normative references, create real-schema fixtures, exercise the flow, and retain the observations needed to assess Then. Mark unsupported cases as gaps, never as passed. No production systems were changed.

## Shared fixture conventions

Use synthetic people and identifiers. Lakeside is the main garage; Riverside is another site of the same operator. Harbor is a different operator unless explicitly stated otherwise. Amounts are USD unless specified. Times are local to the named garage, with timezone and date fixed in executable fixtures. Cross-site access is authorized only where the case explicitly requires it.

For every executed case, capture the initial authoritative account/right/credential/session records, configured policy, decision and approval evidence, resulting domain records, actual movement evidence where relevant, related events, support history, and relevant downstream reporting. A command acknowledgment is not vehicle passage; a payment authorization is not captured revenue; an alert acknowledgment is not resolution of the customer's debt.

## Reading order

Start with resolution, accounts, credentials, control, and alerts for the repeated monthly-parker story. Continue with permits, reservations, validations, LPR, valet, violations, and tolling for entitlement and service interactions. Data, events, and discovery test whether those workflows remain coherent across integrations and reporting.

The specific repeat-debtor chain is RES-OPS-001 (return visit and policy), ACC-OPS-001 (partial payment), CRD-OPS-001 (replacement does not evade history), CTL-OPS-001 (one courtesy used concurrently), ALT-OPS-001 (management escalation), and DATA-OPS-001 (correct report counts). These are different assertions, not six copies of one test.

## Module files

- [Resolution](apx-resolution.md)
- [Accounts and payment history](apx-accounts.md)
- [Credentials](apx-credentials.md)
- [Control](apx-control.md)
- [Alerts](apx-alerts.md)
- [Permits](apx-permits.md)
- [Reservations](apx-reservations.md)
- [Validations](apx-validations.md)
- [LPR](apx-lpr.md)
- [Valet](apx-valet.md)
- [Violations](apx-violations.md)
- [Tolling](apx-tolling.md)
- [Data and analytics](apx-data.md)
- [Events and SSE](apx-events.md)
- [Discovery and mTLS](apx-discovery.md)
