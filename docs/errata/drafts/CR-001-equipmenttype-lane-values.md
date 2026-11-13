**Suggested title:** Change request: five lane-equipment values for `EquipmentTypeEnum`

---

*Type: change request.*

*Suggested labels: `change request`, `model`, `Data Dictionary`, `api`.*

*Status: draft, not filed. Nothing has been sent upstream.*

## Summary

We would like to suggest five new values for `EquipmentTypeEnum`, so that
an off-street site can type the equipment on its entry and exit lanes
with APDS names. Each is a new name only; none repeats or redefines an
existing value.

| Value | Designation | Definition |
| --- | --- | --- |
| `barrier` | Barrier | A lifting arm or similar barrier that opens and closes a vehicular access lane. |
| `gate` | Gate | A sliding, swinging or rolling gate or door that opens and closes a vehicular access point. |
| `ticketDispenser` | Ticket dispenser | A machine at an entry lane that issues a ticket or other credential to start a Session. |
| `intercom` | Intercom | A call point at a lane or machine that connects a customer with an attendant by voice or video. |
| `exitVerifier` | Exit verifier | A machine at an exit lane that reads the ticket or credential presented and opens the barrier when the stay is paid or valid. |

## Where

- APDS 4.1 Data Dictionary (Version Release January 14, 2026), A.3.23,
  Table A.149 (`EquipmentTypeEnum`).
- `apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`),
  `components.schemas.EquipmentTypeEnum`, line 5044.

## Why it matters

APDS already has `paymentMachine`, `lprCamera` and the door values. With
these five, both kinds of lane can be described in APDS terms alone:

- **Entry lane:** `ticketDispenser`, `barrier` or `gate`, `lprCamera`,
  `intercom`.
- **Exit lane:** `exitVerifier`, `paymentMachine` (pay in lane),
  `barrier` or `gate`, `lprCamera`, `intercom`.

Today the closest fits are `paymentMachine`, `tollTerminal`,
`dsrcReceiver` and `other`, so the most common items on a parking lane
are sent as `other`.

## Suggested change

Add the five values, with the definitions above, to `EquipmentTypeEnum`
in the Data Dictionary and in the API document. This is additive: every
instance valid today stays valid. We would be glad to hear if the group
prefers other names.

## APX today

APX works without this change. Device references point at
`SupplementalEquipment` without an equipment type, and APX describes the
role of each device with its code list `apx-equipment-roles`, which
already uses `ticketDispenser` and `exitVerifier`. If APDS adopts the
values, APX will use them.

## Related

The ten Data Dictionary values not yet in the API document
([C-016](C-016-equipmenttype-dd-values.md)) are a separate, independent
alignment.

This is the only addition to the APDS data model that APX asks for.
Everything else APX has built is offered for later adoption only, in the
Appendix of APX Requests to APDS.

---

*Found while building APX, an open parking API built on APDS 4.1. Thank you for all the work that has gone into APDS. We are happy to help with a fix, or with a pull request, if that is useful.*
