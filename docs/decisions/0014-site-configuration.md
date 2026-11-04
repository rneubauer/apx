# ADR-0014: Site configuration from APX alone

## Status

Accepted

## Date

2026-10-18 (comms point naming 2026-10-17)

## Context

A system joining a location had to learn its layout from the PARCS vendor's
portal, the call platform and a spreadsheet. The goal: APX alone describes a
location's full configuration (lanes, equipment, comms points, capabilities)
with no data from any third-party system, and APX names no products.

## Decision

- **Comms points.** Any way a parker reaches help (intercom, analog dialer,
  posted number, kiosk, QR code, app) is a `CommsPoint`, not an "intercom".
  It has `type`, `phoneNumber` (the number called when help is requested),
  `callerId` (the number the device calls out as) and `commsDeviceId` (the
  id call systems use otherwise). The Part 17 rule against telephony data is
  relaxed for comms points only.
- **Equipment detail.** Every piece of hardware gets `manufacturer`, `model`,
  `firmwareVersion`, `softwareVersion`, `serialNumber`, `macAddresses[]`,
  `area`, `level`, `lane` and `role`.
- **MAC included.** A MAC is sometimes the serial number, labels fall off,
  and a MAC can be read back from the network.
- **No IP addresses**, for security. No APX flow connects to a device
  directly.
- **No SIP data.** SIP user names, realms and passwords are left out.
- **Fixed roles.** `role` comes from `apx-equipment-roles`, a fixed code
  list with no free text. A door is `accessDoor`. All cameras use the single
  role `camera` plus a camera decoration.
- **No passwords in APX.** Camera views are short-lived links. A camera that
  cannot sit behind a gateway is named by `credentialRef`; the secret is
  exchanged once, outside APX.
- **External ids** are `{system, id}` pairs, where `system` is a URI the
  issuer owns. There is no named-system registry.

## Consequences

- A PARCS implementation never has to hold telephony values.
- An IP member could be added later behind a restricted scope if a real need
  arises.

## References

- Part 26 §26.1 (equipment), §26.3 (cameras), §26.4 (comms points), §26.6
  (external ids); Part 17 §17.1 (layering rule)
- `docs/apx-additional-functions/APX-ui-launch-and-field-gaps-2026-10-17.md`,
  B11, B12, B16–B18
- CHANGELOG 0.15.0 (2026-10-21)
