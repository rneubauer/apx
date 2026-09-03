# APX Part 17 — Customer Service & Resolution (optional class `apx-resolution`)

The `apx-resolution` conformance class. The problem it solves: when a
customer presses the intercom, the agent (human or AI) should not have to
log into another system, find the facility, find the lane, find the
transaction, and reconstruct what happened. One call assembles the context;
the server — not the agent — decides which actions are permitted.

The architecture is five layers, each already grounded in an existing Part:

| Layer | Where it lives |
|---|---|
| DISCOVERY | Parts 5, 16 — Place hierarchy, `/v1/discovery` |
| CONTEXT | §17.2 — the ResolutionContext aggregation |
| POLICY | §17.3 — AllowedActions, evaluated server-side |
| ACTIONS | Part 6 — the existing command plane (new command types §17.4) |
| EVENTS | Part 8 — two new topics (§17.6) |

**Implementability floor.** This class deliberately adds only SIX endpoints.
All writes reuse the Part 6 command plane an `apx-control` implementation
already has; the context is composed of schemas other classes already
define. A minimal conforming implementation is: the three
`/v1/resolution/*` reads plus policy evaluation over the command types it
already supports. Every context section beyond the required core (id,
version, computedAt, status, place, allowedActions) is optional — include
what you know, omit what you don't.

## 17.1 Identifier resolution

Callers present whatever parking-domain identifiers they have
(`ResolutionResolveRequest`): lane, place, device, plate, ticket number,
credential, reservation code, session, holder. Servers MUST resolve every
relationship they can and MUST NOT fail because some identifiers are
absent.

**Layering rule (normative):** APX resolution accepts NO telephony
identifiers — no SIP URIs, no phone numbers. The intercom is typically a
separate physical device owned by the call platform, not the PARCS; the
platform that terminates the call maps call → lane/device from its own
provisioning BEFORE calling APX. This keeps every PARCS implementation
free of telephony concepts. (Where an intercom happens to be inventoried
as a `SupplementalEquipment` in the Place hierarchy, the caller MAY pass
it as `device`.)

## 17.2 Resolution contexts

- `POST /v1/resolution/contexts` (scope `apx.resolution:read`) — resolve
  now; returns 201 with the `ResolutionContext`.
- `GET /v1/resolution/contexts/{id}` — recompute; `version` increments when
  anything material changed. Contexts MAY expire (RECOMMENDED ≥ 1 hour);
  after expiry, re-resolve.
- **Partial results (normative):** a server MUST NOT delay the whole
  context because one source is slow. It MAY return `status: partial` with
  `pendingSources[]`; the caller re-reads to refresh. Target latencies
  (informative): P50 < 500 ms from local state; P95 < 2 s when upstream
  calls are required.
- **Scope/grant projection (normative):** a context MUST NOT include any
  section the presenting token could not read via the section's own route
  (an account section requires `apx.accounts:read`; everything is bounded
  by `apx_places`). The context is an aggregation convenience, never a
  privilege escalation.
- **Preloading (informative):** implementations SHOULD create the context
  when the triggering event occurs (intercom call, repeated access denial)
  and publish `apx.resolution.context.created.v1`, so the agent's console
  is populated before the call is answered.

## 17.3 Policy and allowed actions

`allowedActions[]` (and `GET …/allowed-actions` for cheap re-evaluation)
is the policy layer's interoperable surface:

1. Decisions are made **server-side**, against operator policy. The
   consuming agent — explicitly including an AI agent — MUST NOT decide
   permissibility itself; it may only classify, summarize, propose, and
   execute what the server has allowed. (The LLM is never the policy
   engine.)
2. Each `AllowedAction` names a command type, whether it is allowed,
   whether approval is required (and by which role), and — whenever
   `allowed=false` or `requiresApproval=true` — a machine-readable
   `reason` with a display string.
3. **Enforcement (normative):** the decisions are binding on the command
   plane. A `POST /v1/commands` for an action the current context
   evaluates as `allowed=false` MUST be rejected
   (`403 action-not-allowed`); one requiring approval MUST be rejected
   without `approval` evidence (`403 approval-required`). Policy content
   (courtesy limits, thresholds, roles) is operator-defined and out of
   APX scope — only the decision format and its enforcement are normative.
4. `recommendedAction` is advisory, never binding, and MUST be one of the
   allowed actions.

## 17.4 Command additions

New `apx-command-types` entries (registry v2) — all executed through the
existing Part 6 plane with its idempotency, perishability, grants, and
audit:

- `resetPassback`, `forceIn`, `forceOut` — anti-passback correction;
  parameters: `credential` (Reference). Read side:
  `GET /v1/credentials/{id}/passback` → `PassbackStatus`.
- `courtesyExit` — a gate vend recorded as a tracked courtesy against the
  account/holder in parameters; servers MUST count it toward courtesy
  policy and surface it in `recentOverrides`.
- `associatePlate` — attach/correct a plate on a session; parameters:
  `session` (Reference), `plate`, optional `observation` (Reference to the
  chosen candidate). Read side: `GET /v1/lpr/candidates`.
- `sendPaymentLink` — hosted payment link via `channel` in parameters
  (sms/email); APX never carries PANs.
- `refundPayment`, `voidPayment`, `capturePayment` — lifecycle verbs on an
  existing `PaymentRecord` (Reference in parameters); refunds SHOULD
  require approval by default operator policy.

Commands gain three optional fields (additive): `resolutionContext`
(Reference), `correlationId`, and `approval` (evidence per §17.3).

## 17.5 Plate candidates and correction

`GET /v1/lpr/candidates?session=|lane=` returns `PlateCandidate[]`
(confidence, capture time, access-controlled imagery links per Part 9
§9.6). The agent picks the right one and executes `associatePlate`. This
closes the reservation/plate-mismatch loop: find reservation → find
session → correct plate → link → retry access, every step audited.

## 17.6 Support interactions and topics

- `POST /v1/support/interactions` / `GET /v1/support/interactions?…`
  (scope `apx.support:manage`) record and query interaction history —
  summaries and command references, never transcripts (Part 9 §9.6).
  Recorded interactions surface in later contexts' `supportHistory`.
- New topics (registry v4): `apx.resolution.context.created.v1`,
  `apx.support.interaction.recorded.v1`. Place binding per Part 8 §8.5
  (the context's/interaction's `place`).

## 17.7 Correlation (normative)

A caller MAY mint a `correlationId` (UUID) at first contact. Every
resolution request, context, command, event envelope (as
`extensions["apds-ext:apx:correlation@1.0"]` or the schema field where one
exists), and support interaction in the same episode SHOULD carry it, so
one id reconstructs: call → context → policy decision → command → gate
event → interaction record.

## 17.8 Conformance

`apx-resolution` requires: §17.2 contexts (including partial semantics and
scope projection), §17.3 allowed-actions evaluation AND its command-plane
enforcement, and §17.6 support interactions. Requires `apx-control`.
Passback (§17.4 read + commands) and plate candidates (§17.5) are REQUIRED
where the implementation tracks passback / stores LPR reads respectively,
and otherwise omitted (discovery then does not list them). The issue
vocabulary is the open `apx-issue-types` registry (v1, 11 entries) —
implementers extend per Part 11.
