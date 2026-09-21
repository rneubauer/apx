# APX Part 23 — EV Charging (EXPERIMENTAL; proposed optional class `apx-charging`)

> **Status: experimental.** This Part lives on branch `beta/ev-charging`.
> The class `apx-charging`, its scopes, topics, command types, alert
> types, violation type, and problem types are **proposed**: none is
> registered (Part 11), the class is not claimable in an ICS (Annex A),
> and any of it may change incompatibly until the Part is merged.
> Implementations MAY prototype against it and MUST NOT advertise
> `apx-charging` in `/.well-known/apx-configuration` before registration.
> §23.14 lists what merging requires.

The parking side of charging: which chargers are free, what is actually
in the bay in front of each one, the charge a vehicle took during its
stay — energy, state, the idle time after it finished, what it cost, and
how that cost is collected — and the control an operator needs when a
cable will not release.

**What APDS already has.** APDS 4.1 describes the static infrastructure
completely: `ElectricChargingEquipment` is a `HierarchyElement` (a
`SupplementalFacility` carrying an `ElectricChargingPoint`), whose
`Connector`s carry IEC connector type, format, charging mode, and power;
`RefillPoint` carries accepted `AuthenticationAndIdentificationEnum`
methods, `reservability`, `deliveryUnit` (`kWh`), and a `refillPointIndex`
that exists "to link static and dynamic publications"; `PlaceInformation`
counts `evChargingPoints`; `electricVehicleOnly` is an operating
restriction; a `Space` is the bay. APX references all of it and redefines
none of it.

**What APDS does not have, and what this Part adds.** Nothing dynamic: no
charger availability, no charging session or energy record, no idle
handling, and no link from a charge to the parking `Session`. This Part
adds a `ChargingPointStatus` overlay (the dynamic half of APDS's
static/dynamic pair), a `ChargingSession` that references the APDS
Session, the bridge's event ingest, settlement, a customer scope, and the
bay-presence fusion that lets the parking system say "there is a car in
the EV bay and it is not plugged in".

**What this Part is not.** It is not a charger protocol and not a roaming
protocol. OCPP (charger ↔ charging-network back end) and OCPI (network ↔
network) already exist and are used by the charging industry; the
operator's *bridge* — its integration with its charging network — speaks
them. APX carries their identifiers (`evseId`, `ocppTransactionId`,
`ocpiSessionId`, the CDR id) **opaquely** so records reconcile, and
borrows their vocabulary where a parking consumer must understand it
(`chargingStatus` maps to OCPP 2.0.1 `chargingState`; `availability`
follows the OCPI EVSE status list). Smart charging and load management,
tariff publication, and roaming clearing stay with the charging network.

## 23.1 Charging points and live status

`GET /v1/charging/points?place=&availability=` and `GET …/{id}` return
`ChargingPointStatus`, keyed by Reference to the APDS
`ElectricChargingEquipment` — the same pattern as Part 6 `DeviceStatus`.
It carries `refillPointIndex` and `evseId` so consumers can join it to
the static APDS record and to the charging network's record, point-level
and per-connector `availability`, `currentSession`, `reservedFor` (a
Part 14 AssignedRight), and `bay` (§23.3).

1. `availability` (closed): `available`; `occupied` — cable connected,
   no energy flowing (plugged in, suspended, complete, or idle);
   `charging`; `reserved`; `blocked` — the bay holds a vehicle that is
   not plugged in, or is obstructed (derived from `bay.presence`, §23.3);
   `inoperative` (planned); `outOfOrder` (fault); `unknown`. The point's
   value is the busiest of its connectors, except that a `blocked` bay
   (§23.3) overrides `available` and `unknown` — never a connected cable:
   a point that is `occupied` or `charging` stays so whatever the camera
   sees around it.
2. The bridge writes availability with `PUT …/{id}/status`
   (`apx.charging:manage`), replacing the connector states,
   `currentSession`, `reservedFor`, and `lastCommunication`. It MUST NOT
   write `bay`; a `bay` in the body is ignored. `connectorIndex` is the
   1-based position in the static APDS `connectors[]`.
3. A change of point-level `availability` or of `bay.presence` publishes
   `apx.charging.point.status.v1` (data: `ChargingPointStatus`).
4. Static descriptive fields (connector type, rated power, usage type)
   are NOT repeated here; `connectors[].connectorType` is an optional
   echo for consumers that do not hold the hierarchy. `outOfOrder` SHOULD
   also raise a Part 7 `deviceFault` alert where `apx-alerts` is
   implemented.

## 23.2 ChargingSession and lifecycle

See schema. One session per charge: the point and connector, the
parking `Session` it happened inside, the `AssignedRight` (a charging
reservation or the permit that entitles charging), `vehicle` (minimized),
`authorization`, the `timeline`, `energy`, `stopReason`, the
`idlePolicy` snapshot, `cost`, `settlement`, `network` identifiers, and
the immutable `statusHistory[]`.

**Lifecycle (normative).**

```
authorized ──pluggedIn──▶ pluggedIn ──chargingStarted──▶ charging ◀──resumed──┐
    │                         │                              │ ──suspended──▶ suspended
    │                         │                              │                    │
    │                         ├────────chargingEnded─────────┴────────────────────┴──▶ complete
    │                         │                                                          │
    │                         │            (grace elapses, server-side) ◀────────────────┤
    │                         │                        │                                 │
    │                         │                        ▼                                 │
    │                         │                       idle ──unplugged──▶ unplugged ◀──unplugged
    │                         └────unplugged (no energy)───────────────────▶  │
    │                                                                          └──settled (server-side)──▶ closed
    └──cancelled──▶ cancelled

any state from authorized to idle ──fault──▶ faulted ──unplugged──▶ unplugged
                                              faulted ──cancelled──▶ cancelled   (only if never plugged in)
```

Transition table (normative; the diagram is a rendering of it):

| Event / cause | From | To |
|---|---|---|
| `pluggedIn` | `authorized` | `pluggedIn` |
| `chargingStarted` | `pluggedIn` | `charging` |
| `suspended` (`suspendedBy`) | `charging` | `suspended` |
| `resumed` | `suspended` | `charging` |
| `chargingEnded` (`stopReason`) | `pluggedIn`, `charging`, `suspended` | `complete` |
| grace elapsed (server) | `complete` | `idle` |
| `unplugged` | `pluggedIn` (no energy flowed), `complete`, `idle`, `faulted` | `unplugged` |
| `fault` | `authorized` … `idle` | `faulted` |
| `cancelled` | `authorized`; `faulted` with no `pluggedInTime` | `cancelled` |
| settled (server) | `unplugged` | `closed` |

1. Transitions are driven by `POST …/{id}/events` (`ChargingEvent`, the
   APX counterpart of an OCPP 2.0.1 `TransactionEvent`) exactly as the
   table says. `meterValue` updates `energy` without a transition and is
   valid in `pluggedIn`, `charging`, `suspended`, `complete`, and `idle`.
   Anything not in the table is 409 `charging-transition-illegal`. Events
   MUST be applied in `time` order.
2. `complete → idle` is **server-side**: when `idlePolicy.graceMinutes`
   has elapsed since `timeline.chargingEndedTime` and the cable is still
   connected, the server sets `timeline.idleStartedTime`, transitions,
   and publishes `apx.charging.idle.started.v1` in addition to the
   status topic. A `graceMinutes` of 0 means idle begins at `complete`;
   an absent `idlePolicy` means the operator does not track idle and the
   session stays `complete` until unplugged.
3. `unplugged → closed` is server-side on settlement (§23.5). `closed`
   and `cancelled` are terminal; `faulted` exits via `unplugged`, or via
   `cancelled` when the vehicle was never plugged in.
4. Every transition appends `statusHistory[]` (state, time, actor,
   detail) and publishes `apx.charging.session.status.v1`.
5. `chargingStatus` maps to OCPP 2.0.1 `chargingState` as follows
   (informative, for bridge authors): `pluggedIn` = EVConnected;
   `charging` = Charging; `suspended` = SuspendedEV / SuspendedEVSE;
   `complete` and `idle` = EVConnected after energy delivery ended;
   `unplugged` = Idle. The split of EVConnected into three APX states is
   the point: the parking side cares whether the car is waiting, done, or
   overstaying.

`POST /v1/charging/sessions` opens the session (`Idempotency-Key`
REQUIRED). It is 409 `charging-point-unavailable` when the point or
connector is `inoperative`, `outOfOrder`, `reserved` for a different
right, or already serving an active session; 422 when `settlement.mode`
is `parkingSession` and no `parkingSession` reference is given.

## 23.3 Bay presence and fusion (normative)

The charger knows whether a cable is connected. It does not know whether
a vehicle is in the bay. An overhead camera (computer-vision occupancy),
a ground sensor, or an attendant knows whether something is in the bay,
but not whether it is charging. The parking system is where the two
meet, and the questions that matter — *is an ICE vehicle blocking the
charger?* *is an EV parked there without plugging in?* *is the bay
coned off?* — are only answerable by fusing them.

1. Presence sources report with `POST …/points/{id}/bay`
   (`ChargingBayPresence`, `Idempotency-Key` REQUIRED): `presence`,
   `source`, the APDS `Observation` carrying the evidence,
   `observedTime`, the minimized `vehicle` seen (plate when the camera
   has LPR; `evCapable` when make/model or badge recognition can tell),
   `confidence`, and an access-controlled `imageLink`.
2. The server MUST fuse the latest presence report with the charger's
   connector state into `ChargingPointStatus.bay.presence` and the
   point's `availability`:

   | Camera / sensor says | Charger says cable | `bay.presence` | `availability` |
   |---|---|---|---|
   | nothing in bay | not connected | `empty` | connector state (`available`…) |
   | nothing in bay | connected | `unknown` (sources disagree) | connector state |
   | vehicle | connected | `vehiclePluggedIn` | connector state (`occupied`/`charging`) |
   | vehicle | not connected | `vehicleNotPluggedIn` | `blocked` |
   | obstruction / straddling | not connected | `blocked` | `blocked` |
   | obstruction / straddling | connected | `blocked` | connector state (a connected cable wins) |
   | no report | any | `unknown` | connector state |

   `source` names the report that decided the row; `sinceTime` is when
   the current `presence` began and is the dwell clock.
3. A `vehicleNotPluggedIn` presence that persists beyond the place's
   grace (operator configuration) SHOULD raise the proposed
   `evBayNotCharging` alert (Part 7); with `vehicle.evCapable: false` the
   existing seeded `iceInEvSpace` alert applies instead. A `blocked` bay
   SHOULD raise the proposed `evBayBlocked` alert. A `vehicleNotPluggedIn`
   condition MAY be handed to Part 19 as a `restrictedSpace` violation
   candidate under the place's enforcement policy (a `blocked` bay has no
   vehicle to cite); the Observation referenced in `bay` is the evidence.
4. Presence with a plate is personal data (Part 9 §9.6): `bay.vehicle`
   and `bay.imageLink` appear only under `apx.charging:read` /
   `:manage`; the customer scope (§23.6) receives `presence` alone.
5. Where the bay camera reads a plate and the charging point free-vends
   (authorization `unlimitedAccess`), the server MAY use that plate to
   attribute the ChargingSession to the parking Session the plate
   entered on (`authorization.methodDetail` records that this was
   done). This is how "one bill at exit" works in a garage whose
   chargers have no authentication of their own.

## 23.4 Energy and meter values

`energy` carries the charger's cumulative meter at start and stop (Wh,
as chargers report them), `deliveredKwh` (APDS `DeliveryUnitEnum`
`kWh`), current and peak power, and the vehicle's state of charge when
the vehicle reports it (ISO 15118). `meterValue` events update
`deliveredKwh`, `currentPowerKw`, `peakPowerKw`, `stateOfChargePercent`,
and `lastMeterTime`; `chargingEnded` fixes `meterStopWh` and the final
`deliveredKwh`. Servers MUST NOT invent `deliveredKwh` from time and
rated power — an absent value means the bridge did not report it.
`energy.targetStateOfChargePercent` is the customer's or valet's request
(§23.8) and, where the charger supports it, the `targetReached` stop
reason.

## 23.5 Cost and settlement (normative)

`cost` is what the parking system knows: `energy`, `time`, `idle`,
`fees`, `total` as APDS `AmountInCurrency`, `tariffReference` (opaque),
`pricedAt`. Absent components are unknown, not zero.

`settlement.mode` says how the money is collected:

1. **`parkingSession`** — the charge is a line on the APDS `Session`
   (priced by the place's rates like any other segment) and is paid with
   the parking through the operator's normal flow (pay station, Part 13
   take-payment, a payment link, an account). `parkingSession` is
   REQUIRED. The ChargingSession `closed` follows the APDS Session's
   settlement; `POST …/{id}/payment` is 409
   `charging-settlement-conflict`.
2. **`directPayment`** — the charge is settled on its own by a Part 13
   payment. `POST …/{id}/payment` attaches the `payment` Reference and
   moves an `unplugged` session to `closed`. Attaching before `unplugged`
   (the final cost is not known) or to a `closed` session is 409
   `charging-settlement-conflict`.
3. **`chargingNetwork`** — the charging network (or its roaming partner)
   bills the driver. The parking side records energy, state, and idle,
   and `cost` where the network shares it; `POST …/{id}/payment` MAY
   record the network's charge detail record id in
   `settlement.externalReference`; `closed` follows `unplugged` once the
   record is final.

**Idle charges.** `idlePolicy` is snapshotted at authorization and is
never re-priced retroactively. `cost.idle` accrues from
`timeline.idleStartedTime` at `idleRate` per `idleRatePer` while the
session is `idle`, billed per started unit (a 12 min 49 s idle at a
per-minute rate is 13 minutes); where `appliesToSettlement` is false the operator
records idle time but the charging network bills it. The customer read
(§23.6) MUST expose `idlePolicy` so an app or text can say "10 minutes
grace, then $0.40 per minute" before the fact.

## 23.6 Customer scope (normative)

`apx.charging:status` is the customer-facing scope for apps, texts, web
pages, and voice bots. A token carrying it (and not `:read`/`:manage`)
is confined to the session(s) it was minted for (bound at authorization,
e.g. via the app account or a claim link) and to the place's charger
availability. It MAY read its own `ChargingSession` and the place's
`ChargingPointStatus` list; it MUST NOT list sessions, write status,
report events, or attach payments. The reads are **minimized** by an
omit-list; every field not listed is returned as for operator scopes:

- On `ChargingSession`, servers MUST omit `vehicle.credentialIdentification`,
  `authorization.credential`, `authorization.contractId`,
  `authorization.methodDetail`, `authorization.authorizedBy`, `network`,
  `statusHistory`, `parkingSession`, `space`, and `evseId`.
- On `ChargingPointStatus`, servers MUST omit `bay.vehicle`,
  `bay.imageLink`, `bay.observation`, `currentSession`, and
  `connectors[].currentSession`.

What remains is what an app needs: status, `energy` and state of
charge, `timeline`, `idlePolicy`, `cost`, `settlement.mode`, the point
and connector, and each point's `availability` and `bay.presence`.

## 23.7 Occupancy and discovery integration

1. Part 5 `OccupancySnapshot` gains an optional `evCharging` block
   (`pointsTotal`, `available`, `charging`, `occupiedNotCharging`,
   `blocked`, `inoperative`), derived from `ChargingPointStatus` under
   the element. Implementations claiming `apx-charging` MUST populate it
   where they hold point status; others omit it. "Is there a free
   charger" is thereby answered by the same read as "is there a free
   space", and `apx.data.occupancy.v1` carries it.
2. Part 16 discovery lists `apx-charging` in `conformanceClasses` and the
   `/v1/charging/*` endpoints once the class is registered — not before
   (see the status banner).

## 23.8 Valet cross-link

Part 22 `ValetTicket` gains an optional `charging` block: `requested`,
`targetStateOfChargePercent`, `instructions`, and `session` (the
ChargingSession the valet opened when they plugged the car in). The
ChargingSession's `valetTicket` points back. Valet charging is
`settlement.mode: parkingSession` by default — it rides on the valet
stay's APDS Session. The valet-scope customer read (Part 22 §22.5)
exposes `charging.requested` and `charging.session`; the customer then
reads the session under `apx.charging:status`.

## 23.9 Charger control via Part 6

Physical actions on a charger are Part 6 commands, never Part 23
writes (Part 17 §17.4 rule 1). Proposed `apx-command-types` entries:

| Command type | Target | Parameters | What it does |
|---|---|---|---|
| `startCharging` | `ElectricChargingEquipment` | `connectorIndex`; `chargingSession` (Reference), or an `authorization` object (the `ChargingSession.authorization` shape) for the server to open one | Remote start for a plugged-in vehicle whose own authorization failed |
| `stopCharging` | `ElectricChargingEquipment` | `connectorIndex`; `chargingSession` | Remote stop; the bridge reports `chargingEnded` with `stopReason: remote` |
| `unlockConnector` | `ElectricChargingEquipment` | `connectorIndex` | Release a cable the charger will not let go of |

The bridge translates them to the charger protocol. `confirmationLevel`
applies as in Part 6 §6.1: an agent may say "the cable is released" only
at `physicallyConfirmed` (the charger reported the connector unlocked or
the bay camera saw the cable move); at `deviceAcknowledged` it may say
"the unlock was accepted". Part 17 resolution contexts SHOULD offer these
as allowed actions when the lane or place has a charging session in
`faulted`, `idle`, or `complete`.

## 23.10 Enforcement hook

`apx.charging.idle.started.v1` is the hand-off: an enforcement or
notification consumer starts the clock at `idleStartedTime` and, when
`idlePolicy.maxIdleMinutes` elapses, MAY record a Part 19 violation
candidate under the proposed `apx-violation-types` entry
`chargingBayIdle` ("a vehicle remained connected in a charging bay after
charging completed beyond the posted idle limit"), evidenced by the
ChargingSession and the bay Observation. An ICE vehicle or an unplugged
EV in the bay (§23.3) is the existing `restrictedSpace` type. Whether
idle is a fee (§23.5), a violation, or both is the place's enforcement
policy (Part 19 §19.10) and posted signage (§19.11) — APX carries the
facts, the policy decides.

## 23.11 Privacy

Plates, contract ids, and bay imagery are personal data under Part 9
§9.6. `authorization.contractId` is masked or opaque; raw payment
credentials never appear. `bay.vehicle` and `bay.imageLink` are limited
to operator scopes and their retention MUST be published; the
customer scope receives no plate, credential, contract, or network
identifiers. Bay observations are Observations and follow Part 13 §13.3.

## 23.12 Eventing

Proposed `apx-topics` entries:

- `apx.charging.session.status.v1` — every ChargingSession transition
  (data: `ChargingSession`).
- `apx.charging.idle.started.v1` — a session entered `idle`; carries the
  idle policy and the vehicle summary (data: `ChargingSession`) — drives
  the customer's "move your car" text and enforcement.
- `apx.charging.point.status.v1` — a point's availability or bay
  presence changed (data: `ChargingPointStatus`).

Place binding (Part 8 §8.5) uses `ChargingSession.place` and
`ChargingPointStatus.place`. A `apx.charging:status` subscription (where
offered) receives only its own session's events.

## 23.13 Endpoints (summary)

| Operation | Scope |
|---|---|
| `GET /v1/charging/points?place=`, `GET …/points/{id}` | `apx.charging:read`, or `apx.charging:status` (minimized) |
| `PUT …/points/{id}/status`, `POST …/points/{id}/bay` | `apx.charging:manage` |
| `POST /v1/charging/sessions`, `POST …/{id}/events`, `POST …/{id}/payment` | `apx.charging:manage` |
| `GET /v1/charging/sessions` | `apx.charging:read` |
| `GET …/sessions/{id}` | `apx.charging:read`, or `apx.charging:status` (own, minimized) |
| `startCharging`, `stopCharging`, `unlockConnector` | Part 6 `POST /v1/commands`, `apx.control:execute` |

Every list is paginated in the APDS `PaginatedList` shape and constrained
to the caller's place grant.

## 23.14 Proposed registry entries (pending merge)

Nothing in this table is registered. Merging this Part requires adding,
in one registry bump each:

| Registry | Proposed entries |
|---|---|
| `apx-conformance-classes` | `apx-charging` — "Implements the parking-side view of EV charging: live charging-point status with bay presence fusion, the ChargingSession referencing the APDS Session, idle after complete, three settlement modes, the customer status scope." Requires the base classes; §23.9 requires `apx-control`. |
| `apx-topics` | `apx.charging.session.status.v1`, `apx.charging.idle.started.v1`, `apx.charging.point.status.v1` (§23.12) |
| `apx-command-types` | `startCharging`, `stopCharging`, `unlockConnector` (§23.9) |
| `apx-alert-types` | `evBayNotCharging`, `evBayBlocked` (§23.3) |
| `apx-violation-types` | `chargingBayIdle` (§23.10) |
| Part 12 problem types | `charging-transition-illegal` (409), `charging-point-unavailable` (409), `charging-settlement-conflict` (409) |

Also on merge: the Annex A rows (A.21) become claimable, Part 16
discovery lists the class, the package version is bumped, and this
banner is removed.

## 23.15 Out of scope (this edition)

Charger-to-network protocol behaviour (OCPP), roaming and clearing
(OCPI/OICP), tariff publication, smart charging and load management,
reservation of a specific connector beyond the Part 14 AssignedRight
reference, vehicle-to-grid, and battery swap. Fleet depot charging
schedules are a candidate for a later Part.
