# ADR-0005: EV charging as a parking-side module

## Status

Accepted. First marked experimental; registered as a full optional class in
0.14.0.

## Date

2026-09-20 (design). Registered 2026-10-12 (0.14.0).

## Context

APDS 4.1 has only static EV infrastructure: charging equipment, points,
connectors and their enums. Nothing describes a charging session, live point
status or who is parked in an EV bay. OCPP and OCPI already cover the
charger network, and APX must not copy them.

## Decision

- Scope: a bridge plus charger control. APX gives the parking-side view of
  charging, and Part 6 gains the commands `startCharging`, `stopCharging` and
  `unlockConnector`.
- Bay presence: `ChargingBayPresence` (`empty`, `vehiclePluggedIn`,
  `vehicleNotPluggedIn`, `blocked`, `unknown`) from an overhead camera,
  ground sensor, charger, attendant or inference. A normative table fuses it
  with the connector state.
- Three settlement modes: `parkingSession` (one bill at exit),
  `directPayment` and `chargingNetwork`.
- Also included: the customer scope `apx.charging:status`, a cross-link
  `ValetTicket.charging`, the idle-overstay hook (topic
  `apx.charging.idle.started.v1`, violation type `chargingBayIdle`) and
  `OccupancySnapshot.evCharging`.
- On 2026-09-20 the module was marked experimental, with no registry
  entries. In 0.14.0 it was merged and registered as the optional class
  `apx-charging`. It is not experimental, and documents should not call it
  that.

## Consequences

- OCPP and OCPI ids stay opaque under `network`.
- Out of scope: OCPP behaviour, roaming and charge-record clearing, tariffs,
  smart charging, V2G, battery swap and connector-level reservation.
- In the APDS submission, the charging data elements are described as in use
  in APX and optional (0.16.0).

## References

- Part 23 §23.3 (bay presence and fusion), §23.5 (settlement), §23.9
  (charger control), §23.10 (enforcement hook), §23.15 (out of scope)
- Part 6 §6.8, Part 19 §19.12, Part 22 §22.9
- CHANGELOG 0.14.0 (2026-10-12) and 0.16.0 (2026-11-01)
