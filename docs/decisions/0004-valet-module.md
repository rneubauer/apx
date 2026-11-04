# ADR-0004: Valet module with a customer scope and condition reports

## Status

Accepted

## Date

2026-09-20

## Context

APDS has no valet entity. It has only the `valetOnly` operating restriction.
Valet needs a ticket, a record of where the car and keys are, a retrieval
queue and proof of the car's condition. Customers ask for their car by text,
web app or voice bot.

## Decision

- Add the optional class `apx-valet` with the resource `ValetTicket`. It is
  its own resource that references the APDS Session, not an extension on the
  Session. The stay and the money stay on the Session.
- Add a customer scope, `apx.valet:request`, that works for texts, web apps
  and voice bots. Retrieval `channel` includes `sms`, `app`, `web`,
  `voiceBot`, `kiosk`, `attendant` and `callCenter`, with an opaque
  `interaction` id and no telephony data.
- Take condition reports at both ends (drop-off and handback), with notes,
  structured damage entries and image links.

## Consequences

- The customer-scope read is minimized: no storage location, key tag,
  attendant ids or condition images.
- The drop-off condition report cannot change after the ticket reaches
  `dropped`.
- Left out on purpose: gratuities, and `requested → retrieving` as an API
  operation.

## References

- Part 22 §22.1 (lifecycle), §22.2 (condition evidence), §22.5 (customer
  scope)
- CHANGELOG 0.8.0 (2026-09-20)
