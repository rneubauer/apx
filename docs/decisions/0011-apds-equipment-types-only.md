# ADR-0011: Devices use APDS EquipmentTypeEnum only

## Status

Accepted

## Date

2026-10-14

## Context

APX refers to site devices in many places (`DeviceStatus.device`,
`Command.target`, `Alert.source.device`). APDS `EquipmentTypeEnum` was
written for rest areas and general parking. It has `paymentMachine`,
`tollTerminal`, `dsrcReceiver`, `electricChargingStation` and `other`, and
in the Data Dictionary also `lprCamera`, `securityCamera` and
`occupancySensor`. It has no gate, barrier, ticket dispenser or intercom.

## Decision

- Devices use the APDS `EquipmentTypeEnum` names only. APX does not create a
  device-type registry (no `apx-device-types`).
- Rather than type lane devices as `other` for good, APX asks APDS to add
  the missing values to `EquipmentTypeEnum` itself.
- Device state is separate and stays in APX (`apx-device-states`). On
  2026-10-15 it was aligned with the style of APDS `RefillPointStatusEnum`,
  sharing four values: `available`, `occupied`, `inoperative`, `unknown`.

## Consequences

- Until APDS adds the values, APX device fields reference
  `SupplementalEquipment` without setting an equipment type.
- What a device does on the lane is carried by a separate `role` in Part 26,
  beside the untouched APDS `equipmentType` (see
  [ADR-0014](0014-site-configuration.md)).

## References

- `docs/data-model-by-domain.md`, "Decided"
- `docs/apds-change-requests.md`, Part B (lane equipment in
  `EquipmentTypeEnum`)
- Part 6 §6.4 (device status), Part 26 §26.1
