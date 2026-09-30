# events: proposed operational scenarios

Read [README](README.md) for fixture, policy, evidence, and draft-status rules. Exact API contracts remain to be verified.

### EVT-OPS-001 — The same courtesy is observed through SSE and a webhook

Module: apx-events

Other modules: control, resolution, data

Kind: edge

Closest existing scenario: EVT-04, EVT-13

Annex A row(s): APX-EVT-04, APX-SSE-01; APX-RES-06 (candidate mapping)

Given: The operations integration consumes both transports and receives the same command status event through each.

When: It updates Smith's courtesy count.

Then: The event is deduplicated by stable envelope identity; one command does not become two courtesy uses.

Why it might break the spec: Transport sequence or delivery IDs are not a substitute for business-event identity.

Severity: medium

### EVT-OPS-002 — An old balance-related denial arrives after payment

Module: apx-events

Other modules: accounts, credentials, resolution

Kind: edge

Closest existing scenario: EVT-05, EVT-21

Annex A row(s): APX-EVT-04, APX-EVT-06 (candidate mapping)

Given: Smith is denied at 18:00 and pays in full at 18:01; the payment event is processed first.

When: The earlier denial is delivered later.

Then: The denial remains historical evidence; it does not reinstate the settled debt or a superseded access decision.

Why it might break the spec: Cross-topic delivery order is not an authoritative ordering of current business state.

Severity: high

### EVT-OPS-003 — Payment and credential activation are independent events

Module: apx-events

Other modules: accounts, credentials, resolution

Kind: edge

Closest existing scenario: EVT-21

Annex A row(s): APX-EVT-06 (candidate mapping)

Given: Dana pays but the collected card still requires authorized manual activation.

When: The payment event reaches the console.

Then: The console displays payment success without claiming activation; the credential state is separately checked.

Why it might break the spec: Subscribers may incorrectly infer cross-module transitions from one successful event.

Severity: high

### EVT-OPS-004 — Permit pool changes before the right's create event is processed

Module: apx-events

Other modules: permits, data, discovery

Kind: edge

Closest existing scenario: EVT-21; PRM-13

Annex A row(s): APX-EVT-06; APX-PRM-01 (candidate mapping)

Given: One permit is issued and the implementation publishes both its native right event and pool availability.

When: The availability event reaches the portal first.

Then: The portal can reconcile authoritative availability and the eventual right without counting the issuance twice.

Why it might break the spec: Independent topics may lack a transaction boundary or shared version for a coherent projection.

Severity: medium

### EVT-OPS-005 — Refund update is processed before the original payment event

Module: apx-events

Other modules: accounts, data

Kind: edge

Closest existing scenario: EVT-09

Annex A row(s): APX-EVT-04, APX-EVT-06; APX-ACC-05 (candidate mapping)

Given: A $24 captured payment is fully refunded quickly; finance receives the newer record before the original event.

When: Both envelopes are processed.

Then: Finance keeps the newer state and preserves $24 collected and $24 refunded as available evidence; the older event cannot restore revenue.

Why it might break the spec: A mutable full-resource event stream requires version-aware application and adequate money-history detail.

Severity: high

### EVT-OPS-006 — Merchant receives only its own part of the visit

Module: apx-events

Other modules: validations, accounts, resolution

Kind: security

Closest existing scenario: EVT-11, EVT-12

Annex A row(s): APX-EVT-05; APX-VAL-06 (candidate mapping)

Given: Two merchants validated the same session; the bistro subscribes using its provider-scoped credentials.

When: Related redemption and support events are published.

Then: Only authorized bistro data reaches its subscription; shared session correlation does not reveal the cinema's private ledger or customer debt.

Why it might break the spec: Place-level authorization alone does not enforce provider-level ownership on related events.

Severity: high

### EVT-OPS-007 — A delayed retrieval event refers to a canceled request

Module: apx-events

Other modules: valet, resolution

Kind: edge

Closest existing scenario: EVT-22; VLT-09

Annex A row(s): APX-EVT-04, APX-EVT-06; APX-VLT-04 (candidate mapping)

Given: A guest requests the car and then cancels; the runner board processes cancellation before the earlier request.

When: The old retrieval event is processed.

Then: The board checks current state before dispatching work and does not revive canceled retrieval.

Why it might break the spec: Delivery of a historical request event is not continuing authority to perform the action.

Severity: medium

### EVT-OPS-008 — A link payment and its support summary are not two collections

Module: apx-events

Other modules: accounts, resolution, data

Kind: edge

Closest existing scenario: EVT-19; RES-22

Annex A row(s): APX-EVT-06; APX-RES-09 (candidate mapping)

Given: Smith pays $185 through a link and the closed support interaction mentions the same payment.

When: Both event types enter the warehouse.

Then: Only the payment record contributes to money totals; the interaction contributes to service metrics and links to the payment.

Why it might break the spec: Correlation joins can duplicate facts when both domain and summary events describe them.

Severity: high

### EVT-OPS-009 — Former operator's subscriber remains after site cutover

Module: apx-events

Other modules: discovery, data, accounts

Kind: security

Closest existing scenario: EVT-11; DSC-12

Annex A row(s): APX-EVT-05; APX-CORE-15, APX-CORE-16 (candidate mapping)

Given: Lakeside moves to a new operator and the old integration still has a prior subscription configuration.

When: A new post-cutover payment and access event are published.

Then: Delivery follows current authorized publication and grants; the old subscription does not continue receiving customer activity merely because it exists.

Why it might break the spec: Cutover must reconcile subscription authority with changed place ownership and publisher authority.

Severity: high

### EVT-OPS-010 — Business state must be recovered after a long pause

Module: apx-events

Other modules: valet, accounts, alerts, data

Kind: lifecycle

Closest existing scenario: EVT-14, EVT-16

Annex A row(s): APX-SSE-02; APX-EVT-06 (candidate mapping)

Given: A seasonal valet board is intentionally closed longer than stream retention while other authorized staff continue operations.

When: It reconnects after its saved stream position expires.

Then: It handles the expired position and reconstructs current valet, payment, and alert state through their supported reads before acting.

Why it might break the spec: Native data change feeds may not cover every APX domain advertised in the event stream.

Severity: medium


