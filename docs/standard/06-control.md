# APX Part 6 — Control (command plane, lanes, validations, devices)

The `apx-control` conformance class. APDS inventories devices
(`SupplementalEquipment`) and marks access-controlled places, but defines no
actuation. This Part adds it, referencing APDS entities throughout.

## 6.1 Commands

`POST /apx/v1/commands` (scope `apx.control:execute`):

- **`Idempotency-Key` header REQUIRED** — same key + same body returns the
  original command; same key + different body is `409`.
- `commandType` values are OPEN (registry `apx-command-types`): `vendGate`,
  `holdGateOpen`, `closeLane`, `lostTicket`, `pushRate`, `applyValidation`,
  `setDeviceState`, `displayMessage`, `restartDevice`.
- Normative parameters per type: `lostTicket.method` (string, operator code
  list); `pushRate.rateTable` (VersionedReference to RateTable);
  `applyValidation.ticket` + `applyValidation.provider` (Reference);
  `displayMessage.message` (MultilingualString); `setDeviceState.state`
  (apx-device-states value).
- `target` is a Reference to a SupplementalEquipment (device) or a
  HierarchyElement (lane/place). The 2018 "Location ID + Lane Number"
  convention maps to the Place UUID + VehicularAccess UUID.
- Commands are **perishable**: a command whose `expiryTime` passes before
  dispatch transitions to `expired` and MUST NOT fire (a gate vend requested
  10 minutes ago must not open the gate now).
- The response is `202` with the Command in state `received`/`accepted` —
  the richer replacement for the 2018 doc's True/False returns.

**Lifecycle:** `received → accepted | rejected → dispatched → executing →
succeeded | failed | expired | cancelled`. Every transition appends to the
immutable `statusHistory[]` (state, time, actor, detail) — this satisfies
the 2018 "all transactions are tracked" audit requirement. Transitions
publish `apx.control.command.status.v1`.

- `GET /apx/v1/commands/{id}` — poll state (scope `apx.control:read`).
- `POST /apx/v1/commands/{id}/cancel` — allowed until `dispatched`;
  afterwards `409 command-not-cancellable`.

**Authorization:** scope `apx.control:execute` AND the token's `apx_places`
grant must cover the target (else `403 insufficient-grant`).

**Lost-ticket fee semantics (normative):** the lost-ticket fee is **part of
the rate deck** — a flat RateLine identified by `description:
"lostTicketFee"` in the place's applicable RateTable, queryable like any
rate via the native `/rates` lookup and updated like any rate (including
via `pushRate`). A successful `lostTicket` command issues a new lost ticket
AT the target lane whose `amountDue` is that fee (in the rate line
collection's currency); a rate deck with no lostTicketFee line makes the
command fail rather than guess. The command result names the issued ticket
and fee; the lane inquiry (§6.2) then shows it as the current ticket, and
the normal flow applies: take a payment (Part 13), apply a validation
(§6.3), or vend (§6.1). The fee is never silently waived — reducing it is
an explicit validation or payment event on the audit record.

## 6.2 Lane inquiry (2018 requirement ① — screen-pop)

`GET /apx/v1/lanes/{id}/current` (scope `apx.control:read`) returns
`LaneStatus`: the ticket currently in the machine (issued time, amount due,
applied validations, paid-in-full), the latest LPR read (plate, confidence,
screenshot link — an APDS Observation), and monthly-credential context
(access granted/denial reason, last activity, last 10 events).

## 6.3 Validations (2018 requirement ⑤)

- `GET /apx/v1/validations/providers?place={uuid}` — the venues allowed to
  validate tickets at that place (`ValidationProvider[]`).
- Applying a validation = `applyValidation` command with
  `parameters.ticket` and `parameters.provider`. On success the lane's
  `currentTicket.validations[]` gains an entry and `amountDue` is
  recalculated.
- **Enforcement (normative):** servers MUST reject an `applyValidation`
  whose `provider` is not on the place's provider list with
  `422 validation-provider-unknown` — the list is authoritative, not
  advisory.
- **APDS alignment (informative):** APDS 4.1 records that a validation
  *happened* (`PaymentTypeEnum: validation`, `Segment.validationType/
  validationId`, `RateTable.validation`) but defines no provider registry —
  that registry is exactly what this section adds. Implementations SHOULD
  record an applied validation in APDS-native terms: a Payment of type
  `validation` and the segment's `validationId`, so downstream APDS
  consumers see it without speaking APX.

## 6.4 Device status

- `GET /apx/v1/devices` / `GET /apx/v1/devices/{id}` (scope
  `apx.control:read`) — `DeviceStatus` overlay keyed by Reference to the
  APDS SupplementalEquipment. States (registry `apx-device-states`) mirror
  the RefillPointStatusEnum style: `available, occupied, inoperative,
  outOfService, fault, unknown`.
- State changes publish `apx.control.device.state.v1`. A transition to
  `fault` SHOULD auto-raise a `deviceFault` alert (Part 7).
- The same object may decorate APDS payloads as
  `apds-ext:apx:devicestatus@1.0` (Level B).

## 6.5 Conformance

`apx-control` requires: §6.1 command plane with vendGate, lostTicket,
pushRate, applyValidation; §6.2 lane inquiry; §6.3 provider query; §6.4
device status; the grant rule; and command/device event publication.
