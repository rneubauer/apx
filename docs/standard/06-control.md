# APX Part 6 — Control (command plane, lanes, validations, devices)

The `apx-control` conformance class. APDS inventories devices
(`SupplementalEquipment`) and marks access-controlled places, but defines no
actuation. This Part adds it, referencing APDS entities throughout.

## 6.1 Commands

`POST /v1/commands` (scope `apx.control:execute`):

- **`Idempotency-Key` header REQUIRED** — same key + same body returns the
  command as it currently stands (`200`, Part 4 §4.2a), not a snapshot of
  the first response; same key + different body is
  `409 idempotency-conflict`.
- A request that names an unknown `commandType`, omits `target`, or
  carries a parameter that fails its definition below is refused with
  `400 invalid-request` (Part 12 §12.4).
- `commandType` values are OPEN (registry `apx-command-types`): `vendGate`,
  `holdGateOpen`, `closeLane`, `lostTicket`, `pushRate`, `applyValidation`,
  `setDeviceState`, `displayMessage`, `restartDevice`; the Part 17
  passback and courtesy entries (registry v2); `pushNegotiatedRate` and
  `matchTicket` (registry v3, §6.6–6.7).
- Normative parameters per type: `lostTicket.method` (string, operator code
  list); `pushRate.rateTable` (VersionedReference to RateTable);
  `applyValidation.ticket` + `applyValidation.provider` (Reference);
  `displayMessage.message` (MultilingualString); `setDeviceState.state`
  (apx-device-states value); `pushNegotiatedRate.rateTable`
  (VersionedReference to a RateTable flagged negotiable, §6.6);
  `matchTicket.session` (Reference to an open Session) and
  `matchTicket.evidence` (Reference, §6.7); `resetPassback.credential`,
  `forceIn.credential`, and `forceOut.credential` (Reference to a
  Credential); `courtesyExit.holder` (Reference to the RightHolder the
  courtesy is counted against). Part 17 §17.4 defines when those four are
  used; their parameters are the ones named here.
- `agent` / `agentType` (optional on every command; REQUIRED on
  `pushNegotiatedRate` and `matchTicket`) name the human or AI principal
  who initiated the command — distinct from `requestedBy` (the
  organisation) and `approval.approvedBy` (the approver). A command that
  requires `agent` and lacks it is refused with `400 agent-required`.
- `target` is a Reference to a SupplementalEquipment (device) or a
  HierarchyElement (lane/place). Legacy "location id + lane number"
  addressing used by existing PARCS integrations maps to the Place UUID +
  VehicularAccess UUID.
- Commands are **perishable**: a command whose `expiryTime` passes before
  dispatch transitions to `expired` and MUST NOT fire (a gate vend requested
  10 minutes ago must not open the gate now).
- The response is `202` with the Command in state `received`/`accepted` —
  richer than a bare success/failure boolean because execution is
  asynchronous and audited. Refusals the server can decide from its own
  state at POST time (an unknown provider, a missing lost-ticket fee, a
  table not flagged negotiable, a session that is not open) are
  synchronous `4xx` responses and nothing is dispatched; outcomes only the
  device can report arrive as `failed` in `statusHistory`.
- **Hold-open release (normative).** A `holdGateOpen` stays `executing`
  while the gate is held. It is released by its own `expiryTime` (the
  instant the hold ends, as well as the dispatch deadline), by a later
  `closeLane` at the same lane, or by a `setDeviceState` on the held gate
  device; on release it transitions to `succeeded` with the releasing
  cause in `detail`. A hold is never cancelled once dispatched
  (`409 command-not-cancellable`, §6.1); a hold with no `expiryTime` holds
  until one of the two releasing commands.
- `confirmationLevel` distinguishes how far success is physically
  confirmed: `accepted` (command taken), `deviceAcknowledged` (device
  acked), `physicallyConfirmed` (outcome verified, e.g. gate-state
  sensor). Consumers MUST NOT report an outcome stronger than this level —
  an agent may say "the gate is open" only at `physicallyConfirmed`
  (Part 17 §17.4).

**Lifecycle:** `received → accepted | rejected → dispatched → executing →
succeeded | failed | expired | cancelled`. Every transition appends to the
immutable `statusHistory[]` (state, time, actor, detail) — every control
transaction is tracked end to end. Transitions
publish `apx.control.command.status.v1`.

- `GET /v1/commands/{id}` — poll state (scope `apx.control:read`).
- `GET /v1/commands` — the audit query (§6.1b).
- `POST /v1/commands/{id}/cancel` — allowed until `dispatched`;
  afterwards `409 command-not-cancellable`.

**Authorization:** scope `apx.control:execute` AND the token's `apx_places`
grant must cover the target (else `403 insufficient-grant`).

**Lost-ticket fee semantics (normative):** the lost-ticket fee is **part of
the rate deck** — a flat RateLine identified by `description:
"lostTicketFee"` in the place's applicable RateTable, queryable like any
rate via the native `/rates` lookup and updated like any rate (including
via `pushRate`). A successful `lostTicket` command issues a new lost ticket
AT the target lane whose `amountDue` is that fee (in the rate line
collection's currency). A rate deck with no lostTicketFee line makes the
command fail rather than guess: the deck is server-side state, so the
server MUST refuse the `POST` synchronously with
`422 lost-ticket-fee-undefined` and MUST NOT create or dispatch a command.
The command's `result` (§6.1a) names the issued ticket, its session, and
the fee; the lane inquiry (§6.2) then shows it as the current ticket, and
the normal flow applies: take a payment (Part 13), apply a validation
(§6.3), or vend (§6.1). The fee is never silently waived — reducing it is
an explicit validation or payment event on the audit record.

### 6.1a Command result

A command that reaches `succeeded` carries a `result` object
(`CommandResult`) naming what it produced, so a console can continue
without parsing `statusHistory[].detail` or making a second call. The
members are normative per command type:

| commandType | `result` members |
|---|---|
| `lostTicket` | `ticketNumber`, `session` (Reference), `amountDue` (the fee) |
| `matchTicket` | `session` (the matched Session), `amountDue` (priced from its true entry) |
| `pushNegotiatedRate` | `rateTable` (VersionedReference, the version applied), `amountDue` |

Other command types leave `result` absent. `result` is server-assigned and
absent before `succeeded`; it restates, and never contradicts, what the
lane inquiry shows.

### 6.1b Listing commands (the audit query)

`GET /v1/commands` (scope `apx.control:read`) returns the commands the
caller may see, newest first, in the APDS `{meta, data}` envelope, each with
its full `statusHistory`. Filters, all optional and combined with AND:
`target` (the device, lane, or place id), `place` (comma-separated,
subtree-inclusive), `commandType`, `status`, `agent`, and `since` / `until`
(the instant the command was received). Only commands whose target lies
inside the token's `apx_places` grant are returned; naming a `place`
outside it is `403 insufficient-grant` (Part 9 §9.3). This is the route for
"what was vended at lane 2 between 18:00 and 19:00, and by whom" — the same
records `apx.control.command.status.v1` publishes, readable after the fact.

## 6.2 Lane inquiry (screen-pop)

`GET /v1/lanes/{id}/current` (scope `apx.control:read`) returns
`LaneStatus`: the ticket currently in the machine (issued time, amount due,
applied validations, paid-in-full), the latest LPR read (plate, confidence,
screenshot link — an APDS Observation), and monthly-credential context
(access granted/denial reason, last activity, last 10 events).

## 6.3 Validations

- `GET /v1/validations/providers?place={uuid}` — the venues allowed to
  validate tickets at that place (`ValidationProvider[]`).
- Applying a validation = `applyValidation` command with
  `parameters.ticket` and `parameters.provider`. On success the lane's
  `currentTicket.validations[]` gains an entry and `amountDue` is
  recalculated.
- **Enforcement (normative):** servers MUST reject an `applyValidation`
  whose `provider` is not on the place's provider list with
  `422 validation-provider-unknown` — the list is authoritative, not
  advisory.
- **Per-ticket price adjustment (design rule):** validations and discounts
  ARE the sanctioned mechanism for adjusting one ticket's amount due —
  auditable, provider-bound, and policy-gated. APX deliberately defines NO
  raw single-ticket price override: the rate deck stays authoritative
  (corrected, when wrong, via `pushRate`), and every reduction on a
  specific ticket is attributable to a named validation provider or
  discount on the audit record. Revenue integrity by construction, not by
  operator discipline.
- **APDS alignment (informative):** APDS 4.1 records that a validation
  *happened* (`PaymentTypeEnum: validation`, `Segment.validationType/
  validationId`, `RateTable.validation`) but defines no provider registry —
  that registry is exactly what this section adds. Implementations SHOULD
  record an applied validation in APDS-native terms: a Payment of type
  `validation` and the segment's `validationId`, so downstream APDS
  consumers see it without speaking APX.
- **Program management (Part 20):** the merchant side — enrolment,
  instrument stock, the redemption ledger, and billing — is the optional
  class `apx-validations`. When claimed, the provider list above is
  derived from active `ValidationProgram`s (each row carries the additive
  `program` reference) and every `applyValidation` materializes a
  `ValidationRedemption` (Part 20 §20.1–20.3).

## 6.4 Device status

- `GET /v1/devices` / `GET /v1/devices/{id}` (scope
  `apx.control:read`) — `DeviceStatus` overlay keyed by Reference to the
  APDS SupplementalEquipment. States (registry `apx-device-states`) mirror
  the RefillPointStatusEnum style: `available, occupied, inoperative,
  outOfService, fault, unknown`.
- The list takes two optional filters: `place` (comma-separated
  HierarchyElement ids, subtree-inclusive, as the APDS `place` filter) and
  `deviceState` (one `apx-device-states` value, e.g. `fault`). A `place`
  outside the token's grant is `403 insufficient-grant`.
- State changes publish `apx.control.device.state.v1`. A transition to
  `fault` SHOULD auto-raise a `deviceFault` alert (Part 7).
- The same object may decorate APDS payloads as
  `apds-ext:apx:devicestatus@1.0` (Level B).

## 6.5 Conformance

`apx-control` requires: §6.1 command plane with vendGate, lostTicket,
pushRate, applyValidation; §6.2 lane inquiry; §6.3 provider query; §6.4
device status; the grant rule; and command/device event publication.

Negotiated rates (§6.6) and ticket matching (§6.7) are **optional
features** of the class, named `negotiatedRates` and `ticketMatching`. An
implementation that offers either MUST list it in the `features` member of
`/.well-known/apx-configuration` (Part 16 §16.1) and of every discovery
document whose client holds an `apx.control` scope (Part 16 §16.2), and MUST
meet the corresponding section in full (Annex A rows APX-CTL-09 through
12). `commandTypes` in a discovery document remains the permission list:
`pushNegotiatedRate` or `matchTicket` appears there only for a client that
may execute it, and never for a host that does not offer the feature.

## 6.6 Negotiated rates (optional feature)

APDS owns the rate deck: `RateTable`, its collections and lines, served
and mirrored through the native `/rates` route (Part 5 §5.2). APX adds no
rate model. What the deck cannot say is which of its tables an agent may
offer a driver on the phone, and who offered it. This section adds
exactly that.

- **The flag.** A RateTable that MAY be offered as a negotiated rate
  carries the Level B decoration `apds-ext:apx:ratepolicy@1.0`
  (`RatePolicy`: `negotiable`, optional `displayName`, `note`) in its
  `extensions` container (Part 4 §4.3). Because the decoration is inside
  the table, every consumer that syncs `/rates` receives it with the
  deck. The set of negotiable tables at a place is therefore the set of
  tables that apply there and carry `negotiable: true` — no second
  registry, no second query.
- **The command.** `pushNegotiatedRate` with `parameters.rateTable`
  (VersionedReference) and a lane target applies that table to the
  **current ticket at the lane only**. It never changes the lane's deck;
  the next car prices normally. (`pushRate` remains the deck-level
  correction, with its supervisor-grade consequences.) Servers MUST
  refuse a table that is not flagged negotiable for the target's place,
  or that does not apply there, with `422 rate-not-negotiable`, and MUST
  refuse the command at a lane with no transaction in progress with
  `409 lane-no-current-transaction`.
- **Who chose it.** `agent` is REQUIRED (`400 agent-required` otherwise),
  `agentType` SHOULD be given, and `reason` SHOULD be. The lane inquiry
  then shows `currentTicket.negotiatedRate` — the table at the exact
  version applied, the command, and the agent — so a later context at
  the lane, a dispute, or a revenue report sees who chose what, from the
  same audit record every other command has.
- **Selection, not invention (design rule).** The agent selects a table
  from the deck; APX defines no free-form negotiated amount. This keeps
  §6.3's rule intact — every reduction on a ticket is attributable to a
  named deck table, validation, or discount — and keeps revenue integrity
  by construction. A deck that wants a range publishes tables for it.
- **No selection rules, deliberately.** APX does not say when a negotiable
  table may be chosen: no length-of-stay bands, no time windows, no caller
  categories. Such rules multiply fast and differ by operator; the system
  presenting the deck to an agent or a third party applies its own
  guardrails, and Part 17 §17.3's policy layer can gate the action per
  context. The server enforces only the flag.
- **APDS alignment (informative).** The negotiated table is an ordinary
  APDS RateTable, so the resulting Session segment references it exactly
  as any other rate; a stock APDS consumer sees a session priced by a
  named table, which is the truth.

## 6.7 Ticket matching (optional feature)

A driver at the exit lane without a ticket is the garage's most common
revenue leak: the choice today is a lost-ticket fee the driver resents or
a courtesy vend the operator absorbs. The entry usually *was* recorded —
by the camera, by a credential, by a reservation — and this section lets
the agent find it and bind the exit to it, so the open ticket closes at
the real fare.

- **Candidates.** When the lane has no ticket in the machine, or when the
  caller passes `plate`, `phone`, or `credential` on
  `GET /v1/lanes/{id}/current`, the server returns `matchCandidates[]`:
  open sessions at the place that plausibly belong to the vehicle in the
  lane, best first. Sources are the lane's own LPR read against entry
  reads (`plateRead`), a credential presented at the lane (`credential`),
  the account registry by plate or phone (`account`, Part 13 §13.1), and
  a checked-in reservation carrying the plate (`reservation`). Each
  candidate names the session, its entry time and lane, how it was
  matched, the evidence record, a confidence, and SHOULD carry
  `amountDueIfMatched` so the agent can quote the fare before matching.
  Candidates are **advisory**: the server MUST NOT bind one without a
  command.
- **Phone is an account key, not a call identifier.** The `phone`
  parameter resolves a permit holder through the account registry exactly
  as `GET /v1/accounts?phone=` does. It is not a telephony identifier and
  Part 17 §17.1's layering rule is unchanged: the call platform still
  maps call → lane before calling APX.
- **The command.** `matchTicket` with `parameters.session` (Reference to
  the chosen open Session), `parameters.evidence` (Reference, SHOULD be
  given — the Observation, Credential, RightHolder, or AssignedRight that
  justified the match), and `agent` REQUIRED (`400 agent-required`) binds
  the current transaction at the target lane to that session. The exit
  then prices from the session's true entry time under the rate that
  applied to it; `lostTicket` is not involved. Servers MUST refuse a
  session that is closed, already bound to an exit, or at another place
  with `422 session-not-open`, and an empty lane with
  `409 lane-no-current-transaction`.
- **Materialization (normative).** On vend the matched Session MUST close
  in APDS terms — the exit segment, end time, and the exit Observation
  where one exists — and MUST publish `SessionUpdated`, so a plain APDS
  client reading `/sessions/{id}` sees one complete stay. The lane's
  `currentTicket` carries `matchedCommand` until the vehicle leaves. APX
  keeps no parallel matching store: the match *is* the session's exit.
- **Fallback stays explicit.** When no candidate is right, `lostTicket`
  applies as §6.1 defines it. Both paths close the open ticket and both
  are attributable; the difference is the fare, and the audit shows which
  path was taken and by whom.
- **No matching rules, deliberately.** APX does not define how confident
  a candidate must be, whether the driver must read the plate back, or
  what a supervisor must approve. As with §6.6 those are operator policy,
  presented through Part 17 §17.3's allowed actions when a context is in
  play, and applied by the presenting system otherwise.
