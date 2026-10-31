# UI launch and field gaps (design note, 2026-10-17)

**Status:** proposal for review. Nothing here is normative until it lands in
`docs/standard/` and the OpenAPI.

## Why

We reviewed how remote-assistance call centers work today. The sample was ten
operator call centers on one platform, with 1,503 active locations and 9,664
active lanes. Three things stood out:

1. **Most actions happen in a vendor's own web screen, not through an API.**
   Only 12% of locations have any revenue-control link. Where there is none,
   the agent opens the PARCS vendor's portal in another window. They issue
   the lost-ticket fee, apply the validation or reset the passback there, then
   type a note into the call record.
2. **The two systems never agree afterwards.** In one week's sample, money
   amounts were empty on about 99% of call records. Yet 30–70% of the notes
   for lost-ticket, receipt, refund and validation calls mention a fee, a
   charge or a refund. Gate vends were never confirmed back. Reporting on the
   call side cannot be matched to the vendor's transactions.
3. **Vendors will take years to implement every APX module.** They already
   have good screens. They need a way to offer those screens today without
   breaking the record.

APX already covers the call-center flow well when the vendor has the API. That
flow is the lane inquiry (Part 6 §6.2), resolution contexts with allowed actions
(Part 17), commands with agent, approval, `correlationId` and confirmation
level (Part 6), and support interactions (Part 17). What is missing is the
bridge for vendors that only have a screen. There are also a handful of fields
and codes that real calls need.

## Part A — UI launch (new Part 25, optional class `apx-ui-launch`)

"Screen-pop" already names the lane inquiry (Part 6 §6.2). This Part uses
**UI launch** for opening a vendor's own screen.

**Defined once, used by every module.** Part 25 defines the mechanism. Modules
only add entries to a registry, so tolling, LPR, reservations or validations
get the same launch and loopback without new design.

1. **Surfaces.** The new open registry `apx-ui-surfaces` names the screens a
   vendor may offer. A name is `<module>.<view>`. Examples:
   - `lane.console`, `session.detail`
   - `reservation.detail`, `reservation.search`
   - `lpr.read.review`
   - `violation.detail`, `violation.appeal`
   - `validation.redeem`
   - `credential.detail`
   - `toll.transaction`, `toll.dispute`
   - `valet.ticket`, `charging.session`
   - `place.console`, `module.home` (general screens with no subject)

   Each entry names the subject type it opens (a Session, a Violation, and so
   on). General surfaces have no subject.
2. **Discovery.** The discovery document gains `uiSurfaces[]`. Each entry
   gives the surface, its display modes (`embed`, `popup`, `tab`), its launch
   modes, the actions it can report back, and the places where it is offered.
3. **Two launch modes.** Both log the agent in automatically.
   - **Handshake.** The host calls
     `POST /v1/ui/launches {surface, subject?, place, lane?, agent, agentType,
     interactionId?, correlationId, displayMode, returnFields?}` with its
     normal APX token in the `Authorization` header. The implementation
     answers `201 {id, url, expiresAt, displayMode}`. The `url` is single-use
     and lives at most 60 seconds. This also serves vendors who want
     header-based auth, because browsers cannot add headers when they open a
     page.
   - **Signed token.** The host signs a short-lived launch token, a JWS with
     `aud` = the implementation and `exp` ≤ 60 s. It carries the same members
     as claims. The host sends it to the surface's `launchUrl` by form post or
     in the URL fragment, never in the query string. The implementation checks
     it against the host's keys, which are registered at onboarding.
4. **Launch record.** The `UiLaunch` resource moves through `issued → opened →
   closed | expired`. You read it with `GET /v1/ui/launches/{id}`. Its
   `actions[]` lists what was done.
5. **Loopback (normative, the heart of the Part).** Every change made on a
   launched surface MUST appear exactly as if it had been made through the
   API. That means the module's own resource or Command, carrying the launch's
   `correlationId` and the agent. For an action whose APX operation the
   implementation does not yet support, it MUST instead emit a
   **`UiActionRecord`**:
   - the action code (`<surface>` plus a registered action, or `other`)
   - the outcome (`completed`, `failed` or `noAction`)
   - `occurredAt`
   - a short `summary`
   - `fields{}` keyed by the APX paths the host asked for in `returnFields`.
     A value the implementation cannot supply is `null`, with a reason
     (`notSupported` or `notApplicable`).

   Topics: `apx.ui.launch.changed.v1` and `apx.ui.action.recorded.v1`.
6. **Part 17 link.** `AllowedAction.execution.type` gains `ui`, with `surface`
   and `subject`. An agent then sees "Do it in the vendor's screen" when no API
   operation exists. `SupportInteraction.actions[]` may reference
   `UiLaunch` and `UiActionRecord`.
7. **Security.** Launch URLs and tokens are single-use, last at most 60 s, and
   are bound to one surface, subject and agent. They are HTTPS only, and the
   query string carries no personal data or secrets. Embedding needs the
   host's origin registered (CSP `frame-ancestors`), with `popup` as the
   fallback. Launch secrets are rotatable, and no read operation returns them.
8. **Conformance.** The class `apx-ui-launch` requires the base classes.
   Scopes are `apx.ui:launch` and `apx.ui:read`. The Annex A section is
   `A.23 UIL`.

## Part B — field and code gaps found in real calls

| # | Gap | Where | Change |
|---|---|---|---|
| B1 | Issue codes too coarse (11 codes; real catalogs share ~50) | `apx-issue-types` | Add the codes shared by 5+ operators (list below, from the 6-month sample) |
| B2 | No shared interaction outcomes | Part 17, new open registry `apx-interaction-outcomes` | `resolved`, `vended`, `transferred`, `escalated`, `noActionNeeded`, `abandoned`, `callbackScheduled` for `SupportInteraction.resolution.code` |
| B3 | Device state lacks the fault and the supplies | Part 6 §6.4 `DeviceStatus` | Optional `fault {code, displayText, since}` and `consumables[{kind, level}]` (`tickets`, `receiptPaper`, `cash`, `coins` × `ok`, `low`, `empty`, `unknown`); alert type `consumableLow`; `maintenanceMode` (so test calls are excluded from service figures) and `lastSeenAt` (so agents see "offline since 03:00") |
| B4 | Agent actions with no command | `apx-command-types` | `ejectTicket`, `cancelTransaction`, `reprintReceipt` |
| B5 | Receipt re-send | Part 13 | `POST /v1/payments/{id}/receipt {channel, destination}` (destination in the body, never the URL) |
| B6 | Asking a remote manager | Part 17 | `POST /v1/approvals` (request), `POST /v1/approvals/{id}/decide`, topic `apx.approvals.changed.v1`; `Approval` may cite `approvalRequest` |
| B7 | Reservation codes from several sellers collide | Part 17 / Part 14 | `reservationIssuer` beside `reservationCode`; `ReservationSummary` gains `issuer`, `amountPaid` |
| B8 | Guests without a plate (hotel room, company, tenant employee) | Part 17 | `guestReference {kind, value}` on the resolve request |
| B9 | Site cases from calls (receipt, refund, citation, damage) | `apx-alert-types`, Alert | `receiptRequested`, `refundRequested`, `citationInquiry`, `damageReported`, `customerCallbackRequested`; Alert may cite its `supportInteraction` |
| B10 | Refund reasons free text | new open registry `apx-refund-reasons` | `changeNotDispensed`, `doubleCharge`, `overcharge`, `serviceFailure`, `courtesy` |
| B11 | No typed crosswalk to other systems' ids | Part 4 / Part 10, decoration `apds-ext:apx:external-ids@1.0` | Typed `[{system, id}]` on places, lanes and equipment (APDS `externalIdentifiers` are untyped strings). `system` is a URI owned by whoever issued the id (for example its own domain), so APX names no products or platforms; lookup `POST /v1/identifiers:resolve` |
| B12 | Equipment recorded only per site | decoration `apds-ext:apx:equipment-detail@1.0` on SupplementalEquipment | On every piece of hardware (cameras and signs included): `role` (B18), `manufacturer`, `model`, `firmwareVersion`, `softwareVersion`, `serialNumber`, `macAddresses[]` (the hardware identity when the serial label is missing, or when the MAC is the serial; one per network interface), `installedAt`, `area`, `level`, `lane`, `builtInto` (the host equipment, for example an intercom inside an access door's call box or a camera inside a pay station), `controls[]` (the barriers this device opens, for example an exit verifier that controls gate 2 or a card reader that controls an access door), `serviceProvider {organization, supportReference}` (who services it; an organization, never a person). IP addresses are deliberately left out in the interest of security: together with model and firmware they map a site's network for an attacker, and no APX flow connects to a device directly. They could be added later, as an optional member behind a restricted scope, if a real need arises. `firmwareVersion` and `softwareVersion` are optional but RECOMMENDED, and readable by every client of the place, because knowing what runs on each device is what makes integration at scale possible. Equipment *type* stays APDS `EquipmentTypeEnum` (2026-10-14 decision) |
| B13 | What each site can do, before a call | Part 16 | `places[].capabilities {commandTypes, uiSurfaces, features}` in discovery |
| B14 | Lane camera still or live view (optional, MAY) | Part 6 §6.2 | Folded into B17 camera views (`kind: snapshot`) |
| B15 | Secrets in read payloads | Part 9 | Normative rule that no read returns integration secrets; launch-secret rotation |
| B16 | No way to tell which lane or location a call came from | Part 17, new resource `CommsPoint` | See below |
| B17 | Cameras described only for LPR; passwords passed around | Part 13 decoration `lane-cameras@1.0`, Part 6, Part 9 | See below |
| B18 | APDS equipment types have no gate, ticket dispenser, reader, camera or door | B12 decoration, new registry `apx-equipment-roles` | See below |
| B19 | No notice when a site's setup changes | Part 16 topics | `apx.equipment.changed.v1` and `apx.comms-points.changed.v1` (added, changed, removed), so other systems stay in sync without re-reading the whole place |
| B20 | Nobody to escalate to | Part 17, on the place | `escalationContacts[{role, order, hours}]`: roles only (for example `siteManager`, `attendant`, `security`, `operatorOnCall`), in calling order with their hours. Names and phone numbers stay with the call platform, so APX holds no personal contact data. B6 approval requests are addressed to a role |

All changes are additive: registries are add-only, new members are optional,
and there is one new optional class.

### B16 — comms points

A **comms point** is any way a parker reaches help from a lane or a location.
It is not always an intercom: it may be a posted phone number, an analog
dialer, a kiosk or a QR code.

| Member | Meaning |
|---|---|
| `id` | APX id |
| `type` | `intercom`, `analogDialer`, `postedNumber`, `kiosk`, `qrCode`, `app`, `other` (open registry `apx-comms-point-types`) |
| `place` | The location it serves (required) |
| `lane` | The lane it serves, when it serves exactly one |
| `equipment` | The equipment item, when it is inventoried hardware |
| `serves` | The barrier the agent opens for this comms point (a gate or an access door), when there is one |
| `coverage[{hours, language}]` | When it is answered, and in which languages; the call center itself is not named |
| `phoneNumber` | The number that is called when help is requested (E.164): dialed by the parker for a posted number, or by the intercom or dialer when its button is pushed |
| `callerId` | The number the device calls out as (E.164) |
| `commsDeviceId` | The id the call systems use for this comms point when they identify it by neither caller ID nor dialed number (for example the voice platform's device id) |

At least one of `phoneNumber`, `callerId` or `commsDeviceId` is present.

**Location level.** The place gains `commsAccountId`: the id the call
platform uses for the whole site (its account). With `commsDeviceId` this
maps any call to a location and lane from APX alone.

**No SIP data.** SIP usernames, realms and passwords are deliberately left
out. A username with its realm is half of a line's login and helps toll-fraud
attacks. They exist only for SIP devices, not for dialers, posted numbers or
kiosks. The call platform already maps its own SIP data to its device and
account ids. They could be reconsidered if a real need arises. A SIP password
or any other credential MUST never appear in any member.

**Example: access door with an intercom.**
- The door is equipment with `role: accessDoor` and `area: pedestrianEntrance`.
- The intercom is equipment with `role: intercom` and `builtInto` the door.
- The card reader is equipment with `role: cardReader` and `controls: [door]`.
- The camera has `area: pedestrianEntrance` and `view: [pedestrians]`.
- The comms point has `type: intercom`, `equipment` = the intercom, and
  `serves` = the door.

A call resolves to the comms point, then to the door, then to `vendGate` on
the door, with the door camera available to view.

Routes: `GET /v1/comms-points?place=&lane=` and `GET /v1/comms-points/{id}`.

**Resolution.** The resolve request gains `commsPoint`, `callerId`,
`dialedNumber` and `commsDeviceId`. A comms point resolves to its lane when it has one, and
otherwise to its location only. A posted number shared by many lanes can never
name the lane by itself, so the agent or IVR must ask which lane.

**Part 17 layering rule, amended.** Telephony values (phone numbers, caller
IDs) may appear only on comms points and on the matching resolve members.
Whoever runs the calls supplies them: the call center or the voice platform.
A PARCS implementation never has to hold, return or understand them. A server
that holds no comms points answers these members with
`comms-point-unknown`.

### B17 — cameras

1. **Description.** A camera is equipment (B18 role `camera`) anywhere in the
   place, not only on a lane. The new decoration `apds-ext:apx:camera@1.0` on
   its SupplementalEquipment carries:
   - `area`, from the registry `apx-area-types`. `area`, `level` and `lane`
     live on the B12 equipment detail, so every piece of hardware has them,
     not only cameras. The codes are:
     - Vehicle areas: `lane`, `entryPlaza`, `exitPlaza`, `ramp`,
       `parkingLevel`, `roof`, `evChargingArea`, `loadingDock`, `perimeter`.
     - Pedestrian and staff areas: `elevator`, `elevatorLobby`, `lobby`,
       `stairwell`, `pedestrianEntrance`, `paymentArea`, `cashierBooth`,
       `office`, `equipmentRoom`.
     - Fallback: `other`.
   - `mounting`: `builtIn`, `overhead`, `pole`, `wall`, `ceiling` or `other`.
     When `builtIn`, the B12 `builtInto` names the host equipment, for
     example a pay station's driver camera.
   - `view[]`: `plate`, `vehicle`, `driver`, `equipmentInteraction`,
     `pedestrians`, `areaOverview` or `other`.
   - `faces` (`inward`, `outward`) for lanes, plazas and ramps.
   - `primary`, `ptz` and `recorder {equipment, channel}`.
   - `streams[{protocol, transport, resolution}]`, where `protocol` is one of
     `webrtc`, `hls`, `rtsp`, `mjpeg`, `snapshot`.

   It holds no addresses, usernames or passwords. `apds-ext:apx:lane-cameras@1.0`
   stays unchanged for the LPR module.
2. **Views.** `POST /v1/cameras/{cameraId}/views {kind: live|snapshot|playback,
   from?, to?, agent, correlationId}` → `201 {url, protocol, expiresAt}`.
   `playback` takes `from` and `to`, for disputes such as "I entered at 2:14". The link is
   single-use, lasts at most 5 minutes and is bound to the agent. Whoever holds
   the camera answers: the PARCS, the video system or an on-site gateway. The
   password never leaves the site.
3. **No passwords in APX (normative, with B15).** No APX request, response or
   event carries a camera, PARCS or device password, in any member or in
   nested JSON. A camera that cannot sit behind a gateway is named by
   `credentialRef`, which the receiver looks up in its own vault. The secret
   itself is exchanged once, outside APX, at onboarding.
4. **Reference.** Camera models and stream profiles refer to ONVIF (Profile S,
   Profile T) and are not redefined.
5. **Privacy (normative).** `driver` and `pedestrians` views capture faces,
   which is personal data in many jurisdictions.
   - Each camera states `retentionDays`.
   - Every view and playback is logged against the agent and the
     `correlationId`.
   - A view link MUST NOT be reused or shared outside the interaction it was
     issued for.

### B18 — equipment roles

APDS `EquipmentTypeEnum` has `paymentMachine` and `tollTerminal` but no gate,
ticket dispenser, reader, camera, intercom or door. The equipment type stays
APDS (often `other`). The B12 decoration gains a required `role` taken from the
registry `apx-equipment-roles`. It is a fixed set of codes: no free text, and
only the APX maintainers add codes in a later version.

| Group | Codes |
|---|---|
| Vehicle barriers | `gate`, `overheadDoor`, `bollard`, `trafficSpikes` |
| Pedestrian barriers | `accessDoor` (door a parker authenticates at to enter, for example after hours), `turnstile` |
| Ticketing and payment | `ticketDispenser`, `exitVerifier`, `exitPayStation`, `payOnFoot`, `cashierBooth`, `validationTerminal`, `paymentTerminal` |
| Credential readers | `cardReader`, `tagReader`, `barcodeReader` |
| Vehicle detection | `loopDetector`, `presenceSensor` |
| Cameras | `camera` (what it looks at and where is in the B17 camera decoration) |
| Communications | `intercom`, `analogDialer`, `emergencyPhone` |
| Signs and displays | `laneDisplay`, `laneSignal`, `countSign` |
| On-site infrastructure | `laneController`, `facilityServer`, `videoRecorder`, `videoGateway` |
| Fallback | `other` |

`lane` is optional on the decoration: an access door, a pay-on-foot station
or a server belongs to the place, not to a lane.

**After-hours pedestrian access.** Both transient parkers and permit holders
may need to authenticate at an `accessDoor` to reach their car.

- **Authentication.** They use a ticket, receipt, QR code, card or PIN at the
  door's reader, or they press its comms point.
- **Record.** The attempt is recorded like a lane access event, with
  `accessEvent: entry` on the door.
- **Opening.** An agent opens the door with `vendGate`, targeting the door as
  the device. Its confirmation level applies as usual.
- **Tests.** One scenario per parker type: a transient with a paid ticket
  after hours, a permit holder with a card, and a refusal for an expired
  permit.

### B1 — issue types from the 6-month sample

The sample was one week per month for six months, across ten call centers:
176,860 calls and 367 distinct issue names after normalizing. The codes below
come from issues that at least five call centers share. Shares are of all
sampled calls. Two of the ten keep only recent history, so their counts cover
fewer weeks.

| New code | Real issue names it covers | Share | Note |
|---|---|---|---|
| `noResponse` | no response from caller | 14.3% | |
| `callDropped` | call dropped | 2.5% | |
| `audioFault` | unable to hear parker, parker cannot hear agent | 0.6% | Fault in the lane's call equipment |
| `generalInquiry` | rates, hours, directions | 9.4% | |
| `wrongLocation` | wrong garage, wrong number, oversized vehicle | 0.6% | |
| `facilityFull` | garage full | 0.2% | |
| `ticketUnreadable` | ticket unreadable | 3.0% | |
| `ticketNotAccepted` | machine not accepting ticket, ticket will not return | 0.8% | |
| `noTicketIssued` | no tickets at entrance, out of tickets | 1.8% | Pairs with B3 consumables |
| `paidCannotExit` | ticket paid, but the gate does not open | 2.0% | Payment status lookup (49% of notes) |
| `cardNotReading` | credit card not reading, not accepting cards | 2.3% | Distinct from `paymentDeclined` |
| `paymentMethodUnavailable` | card-only machine, parker has no money, needs change | 1.0% | |
| `mediaJam` | ticket jam, bill acceptor jam, card stuck in machine | 0.4% | |
| `gateStuckOpen` | gate stuck open | <0.1% | |
| `credentialForgotten` | forgot card, transponder or fob | 2.0% | |
| `credentialDisabled` | disabled card | 1.6% | |
| `gracePeriod` | grace period issue | 0.6% | |
| `validationExpired` | validation expired | 0.1% | |
| `authorizedVisitor` | hotel guest, vendor, employee, police or security | 3.7% | Kind goes in B8 `guestReference` |
| `receiptRequest` | customer needs receipt | 0.2% | Pairs with B5 |
| `refundRequest` | parker requesting refund | <0.1% | Pairs with B10 |
| `vehicleIncident` | vehicle damaged, broken into, towed | 0.1% | Pairs with B9 `damageReported` |
| `equipmentTest` | equipment testing | 0.5% | Not a customer call; exclude from service metrics |

Existing codes cover the rest:

| Real issue names | Existing code |
|---|---|
| gate or door won't open, broken gate | `gateVendFailed`, `equipmentFault` |
| pay station down | `equipmentFault` |
| passback | `passbackViolation` |
| lost ticket | `lostTicket` |
| validation error | `validationMissing` |
| online reservation | `reservationMismatch` |
| monthly parker in a rented vehicle | `plateUnresolved` |

Three frequent names are outcomes, not issues, and belong in B2:

| Real issue name | B2 outcome |
|---|---|
| parker needed no assistance | `noActionNeeded` |
| manager or attendant assisted | `escalated` |
| validation remotely applied | `resolved`, with the action recorded |

**What the sample shows:**
- **No money is recorded on the call.** Money fields were filled on about 1%
  of calls, even for lost ticket, receipt and refund calls.
- **Agents open the gate as the fix.** 50–95% of most issue types end in a
  gate vend, with nothing to record why.
- **Agents fall back to notes.** Validation, monthly, reservation and device
  terms dominate the notes, because those are the lookups and actions agents
  cannot do in the call record.

## Overlap check (G1–G21, Nexus Core)

| Gap | Overlap | Note |
|---|---|---|
| B11 | G11 (plate digest) no; Part 24 no | New |
| B12 | PR #42 equipment types | Consistent: no APX type list |
| B3 | PR #42 `DeviceStatus` wording | Edit after #42 merges, or rebase |
| Others | none | — |

## Tests

- **Vetting scenarios.**
  - A new `apx-ui-launch` module covers each surface family:
    launch → act → loopback, refusals (expired, reused, wrong agent), the
    signed-token mode, and the `UiActionRecord` fallback.
  - New cases in control, resolution, accounts, alerts, discovery and data
    cover B1–B14.
- **Simulator.**
  - A `uilaunch` domain with a mock vendor screen that posts its actions back.
  - Approvals, device faults and supplies, and the new commands.
  - A narrated demo: help call → open the PARCS vendor's lane console → issue
    a lost ticket in the vendor screen → the call record syncs.
