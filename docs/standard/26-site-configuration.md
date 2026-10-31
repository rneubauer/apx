# APX Part 26 — Site Configuration (optional class `apx-site-config`)

A system that joins a location today has to learn its layout from three
places at once: the PARCS vendor's portal for the lanes and devices, the
call platform for which intercom rings where, and a spreadsheet for the
cameras. This Part makes one source enough. From APX alone a consumer can
tell what hardware a location has and where it stands, how a parker at
any point of it reaches help, what each camera looks at and how to see
it, which other systems know the location by which ids, and whom to
escalate to, in that order.

**What APDS has.** The place hierarchy (Campus, Place, VehicularAccess as
the lane, SupplementalEquipment as a device, Space), each with a name, a
location and opening times; `AccessLaneSpecific` for a lane's type and
sequence; `SupplementalFacility.externalIdentifiers` as untyped strings;
`EquipmentTypeEnum` for the kind of equipment, written for rest areas
and general parking: it has `paymentMachine`, `tollTerminal` and
`publicPhone`, and no gate, ticket dispenser, reader, camera, intercom
or door.

**What this Part adds.** Four Level B decorations on APDS elements:
`equipment-detail` (what a device is and does, with a fixed list of
roles), `camera` (what a camera looks at and how it streams),
`external-ids` (typed ids in other systems) and `place-operations` (the
call platform's account for the site and the escalation roles). One new
resource, `CommsPoint`: any way a parker reaches help from a lane or a
location. The routes `GET /v1/equipment`, `/v1/comms-points`,
`POST /v1/identifiers:resolve` and `POST /v1/cameras/{id}/views`, the
change feed on equipment and comms points, and the topics
`apx.equipment.changed.v1` and `apx.commspoints.changed.v1`. Equipment
*type* stays the APDS `EquipmentTypeEnum`; this Part never redefines it.

## 26.1 Equipment detail (normative)

1. Every piece of hardware at a location, cameras, signs, readers, doors
   and servers included, is an APDS `SupplementalEquipment` in the place
   hierarchy, and carries the decoration
   `apds-ext:apx:equipment-detail@1.0` (`EquipmentDetail`, Part 4 §4.3).
2. `role` (REQUIRED) says what the item does on the lane or in the place.
   It is a definedValue of `apx-equipment-roles` (Part 11), a **fixed**
   code list: an implementation uses one of its codes and never free
   text; only the APX maintainers add codes, in a later version. The
   codes, by group:

   | Group | Codes |
   |---|---|
   | Vehicle barriers | `gate`, `overheadDoor`, `bollard`, `trafficSpikes` |
   | Pedestrian barriers | `accessDoor`, `turnstile` |
   | Ticketing and payment | `ticketDispenser`, `exitVerifier`, `exitPayStation`, `payOnFoot`, `cashierBooth`, `validationTerminal`, `paymentTerminal` |
   | Credential readers | `cardReader`, `tagReader`, `barcodeReader` |
   | Vehicle detection | `loopDetector`, `presenceSensor` |
   | Cameras | `camera` (what it looks at is the §26.3 decoration) |
   | Communications | `intercom`, `analogDialer`, `emergencyPhone` |
   | Signs and displays | `laneDisplay`, `laneSignal`, `countSign` |
   | On-site infrastructure | `laneController`, `facilityServer`, `videoRecorder`, `videoGateway` |
   | Fallback | `other` (a code, for hardware nothing above fits) |

   The APDS `equipmentType` is still written, as the nearest APDS value
   (`paymentMachine` for a pay station, `other` for a gate); `role` adds
   to it and never contradicts it.
3. Identity of the item: `manufacturer`, `model`, `serialNumber`, and
   `macAddresses[]`, one per network interface, as twelve lower-case
   hexadecimal digits with no separators. The MAC is carried because it
   is sometimes the serial number, because serial labels come off while a
   MAC can always be read back from the network, and because it is a
   hardware identity, not a way in.
4. `firmwareVersion` and `softwareVersion` are OPTIONAL and RECOMMENDED,
   readable by every client that may read the place. Knowing what runs
   on each device is what makes integration at scale possible; without
   it, the version on a device is very hard to find out any other way. A
   station that runs both carries both.
5. Where the item is: `area` (a definedValue of `apx-area-types`, §26.2),
   `level` (the floor's label as it is signed, `P2`, `Roof`), and `lane`
   (a Reference to the VehicularAccess it serves). `lane` is optional: an
   access door, a pay-on-foot station or a server belongs to the place,
   not to a lane. `installedAt` is the date it went into service.
6. How items relate: `builtInto` names the host equipment of an item
   built into another (an intercom inside an access door's call box, a
   driver camera inside a pay station); `controls[]` names the barriers
   this item opens (an exit verifier that controls gate 2, a card reader
   that controls an access door). A command that targets a reader's
   barrier targets the barrier itself; `controls[]` is description.
7. `serviceProvider` names who services the item: an `organisation`
   Reference and a `supportReference` (the provider's own ticket or
   contract id), never a person.
8. **No IP addresses (non-normative note).** Network addresses are
   deliberately left out of this decoration in the interest of security.
   Together with model and firmware version, an address map of a site's
   devices tells an attacker which unit to reach and which known weakness
   to try, and no APX flow needs one: commands go through the API, camera
   views arrive as short-lived links (§26.3), launches as single-use URLs
   (Part 25). Network setup stays in the vendor's or operator's own tools,
   behind their own access controls. An optional member behind a
   restricted scope could be added in a later edition if a real need
   arises; taking one out after implementations publish it would be far
   harder.
9. `GET /v1/equipment?place=` (scope `apx.siteconfig:read`; `place`
   REQUIRED, optional `role`, `area`, `lane`, `level`) lists the
   SupplementalEquipment of a place subtree with their decorations;
   `GET /v1/equipment/{id}` reads one. The list serves the Part 5 §5.2
   change feed. A `place` outside the grant is `403 insufficient-grant`.
   The native `/places` routes keep serving the same elements with the
   same decorations (Part 5); this route is the filtered view a consumer
   wants when it asks "what is on lane 3" or "every camera on P2".

## 26.2 Areas (normative)

`apx-area-types` names where something stands, for equipment (§26.1
rule 5), cameras and comms points. It is a fixed code list:

| Group | Codes |
|---|---|
| Vehicle areas | `lane`, `entryPlaza`, `exitPlaza`, `ramp`, `parkingLevel`, `roof`, `evChargingArea`, `loadingDock`, `perimeter` |
| Pedestrian and staff areas | `elevator`, `elevatorLobby`, `lobby`, `stairwell`, `pedestrianEntrance`, `paymentArea`, `cashierBooth`, `office`, `equipmentRoom` |
| Fallback | `other` |

`elevator` is the inside of the car; `elevatorLobby` is the landing. An
item on a lane carries `area: lane` and names the `lane`.

## 26.3 Cameras (normative)

1. A camera is equipment with `role: camera` anywhere in the place, not
   only on a lane: the ramps, stairwells, lobbies and elevators have them
   too, and so does the pay station that looks at the driver. It carries
   the decoration `apds-ext:apx:camera@1.0` (`CameraDetail`) beside its
   equipment detail:
   - `mounting`: `builtIn`, `overhead`, `pole`, `wall`, `ceiling` or
     `other`. When `builtIn`, the equipment detail's `builtInto` names the
     host (the pay station with a driver camera; the overhead camera above
     the exit lane that watches the card slot is `overhead` with the pay
     station in view, not built in).
   - `view[]` (REQUIRED, at least one): `plate`, `vehicle`, `driver`,
     `equipmentInteraction` (hands, ticket and card at the machine),
     `pedestrians`, `areaOverview` or `other`. One camera may cover more
     than one.
   - `faces` (`inward`, `outward`), for cameras on lanes, plazas and
     ramps, with the meaning of Part 13 §13.3a(5).
   - `primary` (show this one first for its lane or area), `ptz`,
     `recorder` (the `videoRecorder` equipment and its `channel`), and
     `streams[]` (what it can deliver: `protocol` `webrtc`, `hls`,
     `rtsp`, `mjpeg` or `snapshot`, with `transport` and `resolution`).
   - `retentionDays`: how long its recordings are kept (rule 4).
   - `credentialRef`: a label the receiving system looks up in its own
     vault, for a camera that cannot sit behind a gateway. It is never
     the secret.
   The decoration carries no address, user name or password.
   `apds-ext:apx:lane-cameras@1.0` (Part 13 §13.3a(5)) is unchanged: it
   stays the LPR module's statement of which camera reads which lane.
2. **Views.** `POST /v1/cameras/{id}/views` (scope `apx.cameras:view`)
   with `kind` `live`, `snapshot` or `playback` (`from` and `to`, for a
   dispute: "I entered at 2:14"), `agent`, `correlationId` and optionally
   `interactionId` returns 201 `CameraView`: a `url`, its `protocol`, and
   `expiresAt` at most 5 minutes away. The link is single-use, bound to
   the agent, HTTPS, and requires no further credential. Whoever holds the
   camera answers: the PARCS, the video system, or an on-site gateway
   (`videoGateway`) that holds the camera's password and serves the link.
   The password never leaves the site. A camera that cannot deliver the
   kind asked for, or is offline, is `409 camera-view-unavailable`; a
   playback range outside `retentionDays` is
   `422 playback-range-unavailable`. `live` is the feature `cameraViews`
   and `playback` the feature `cameraPlayback` (`apx-features`); an
   implementation offers neither, one or both and lists what it offers
   (Part 16 §16.1).
3. **No passwords in APX.** Part 9 §9.7 applies: no request, response or
   event carries a camera, PARCS or device password, in any member or in
   nested JSON. The secret behind a `credentialRef` is exchanged once,
   outside APX, at onboarding.
4. **Privacy.** `driver` and `pedestrians` views capture faces, personal
   data in many jurisdictions. Each camera states `retentionDays`; every
   view and playback is logged against the agent and the `correlationId`;
   a view link MUST NOT be reused or shared outside the interaction it was
   issued for (Part 9 §9.6 rule 2 applies to the link).
5. **Reference (informative).** Camera models and stream profiles follow
   ONVIF (Profile S for streaming, Profile T for H.265 and TLS); APX adds
   only what parking needs: the lane, the facing and the view.

## 26.4 Comms points (normative)

A **comms point** is any way a parker reaches help from a lane or a
location. It is not always an intercom: a posted phone number on a sign,
an analog dialer on a phone line, a kiosk, a QR code or an app all
count, and a lane may have one of each.

1. `CommsPoint` carries `type` (a definedValue of `apx-comms-point-types`:
   `intercom`, `analogDialer`, `postedNumber`, `kiosk`, `qrCode`, `app`,
   `other`), `place` (REQUIRED), `lane` (when it serves exactly one),
   `equipment` (when it is inventoried hardware, the `intercom` or
   `analogDialer` item of §26.1), and `serves` (the barrier an agent opens
   for it: a gate, or an access door).
2. Three identifiers, of which at least one MUST be present:
   - `phoneNumber` (E.164): the number that is called when help is
     requested, dialed by the parker for a posted number, or by the
     intercom or dialer itself when its button is pushed;
   - `callerId` (E.164): the number the device calls out as;
   - `commsDeviceId`: the id the call systems use for this comms point
     when they identify it by neither caller id nor dialed number (a voice
     platform's device id).
3. `coverage[]` says when it is answered and in which languages: a
   `period` (APDS `Period`) and `languages[]` (BCP 47 tags). The call
   center itself is not named.
4. **No SIP data.** SIP user names, realms and passwords are deliberately
   left out. A user name with its realm is half of a line's login and
   helps toll-fraud attacks; they exist only for SIP devices, not for
   dialers, posted numbers or kiosks; and the call platform already maps
   its own SIP data to its device and account ids. A SIP password or any
   other credential MUST never appear in any member. The pair could be
   reconsidered if a real need arises.
5. **Site account.** The place carries `apds-ext:apx:place-operations@1.0`
   (`PlaceOperations`), whose `commsAccountId` is the id the call platform
   uses for the whole site. With `commsDeviceId` on the comms points, a
   call maps to a location and a lane from APX alone.
6. **Resolution.** A comms point resolves to its `lane` when it has one,
   and otherwise to its `place` only. A posted number shared by many
   lanes can never name the lane by itself: the agent or the IVR asks
   which lane. Part 17 §17.1 takes `commsPoint`, `callerId`,
   `dialedNumber` and `commsDeviceId` on the resolve request; the server
   that holds the comms points answers, and a server that holds none
   answers `422 comms-point-unknown`.
7. Routes: `GET /v1/comms-points` (scope `apx.siteconfig:read`; filters
   `place`, `lane`, `type`, `callerId`, `dialedNumber` which matches
   `phoneNumber`, `commsDeviceId`; the Part 5 §5.2 change feed),
   `GET /v1/comms-points/{id}`, and, under `apx.siteconfig:manage`,
   `POST /v1/comms-points` (`Idempotency-Key` optional),
   `PUT /v1/comms-points/{id}` (versioned replace with `If-Match` or body
   `version`, 409 `version-conflict`, Part 4 §4.2a) and
   `DELETE /v1/comms-points/{id}` (the feed emits a tombstone). Whoever
   runs the calls writes them: the call center or the voice platform. A
   PARCS implementation never has to hold, return or understand them, and
   one that claims this class without comms points of its own serves the
   routes for the records the call platform writes.

## 26.5 Place operations and escalation (normative)

`PlaceOperations` (rule 26.4(5)) also carries `escalationContacts[]`:
who to ask when the agent cannot settle it, as **roles only**, in calling
order with their hours: `role` (a definedValue of `apx-escalation-roles`:
`siteManager`, `attendant`, `security`, `operatorOnCall`, `maintenance`,
`other`), `order`, and `hours` (APDS `Period`). Names and phone numbers
stay with the call platform, so APX holds no personal contact data. A
Part 17 §17.3a approval request is addressed to a role from this list.

## 26.6 External identifiers (normative)

1. Any HierarchyElement (a place, a lane, a device) MAY carry
   `apds-ext:apx:external-ids@1.0` (`ExternalIdentifiers`): a list of
   `{system, id}`, where `system` is a URI the issuing system owns (its
   own domain, as a rule) and `id` is its value. APDS
   `externalIdentifiers` are untyped strings, so a reader cannot tell
   which system an id belongs to; the decoration adds the system and
   changes nothing else. APX names no products or platforms: the issuer
   names itself.
2. `POST /v1/identifiers:resolve` (scope `apx.siteconfig:read`) with
   `{system, id}` answers 200 with the `target` Reference, its `className`
   and its `place`, so any system finds the APX record for an id it holds
   in one call. An unknown pair, or one whose element lies outside the
   grant, is `404 target-not-found` (Part 9 §9.3a: the answer never
   confirms another party's record).

## 26.7 Change notices (normative)

1. Every create, change or removal of a SupplementalEquipment with an
   equipment detail, or of its decorations, publishes
   `apx.equipment.changed.v1` (data: the element with its extensions;
   subject: the element; place-bound on its place). Every create, change
   or removal of a comms point publishes `apx.commspoints.changed.v1`
   (data: the `CommsPoint`). Removal carries the last representation.
2. `GET /v1/equipment` and `GET /v1/comms-points` serve the Part 5 §5.2
   change feed, so another system keeps a copy of a site's setup current
   without re-reading the whole place, and catches up after an outage.

## 26.8 After-hours access (informative)

Both transient parkers and permit holders may have to authenticate at an
`accessDoor` to reach their car after the lanes close.

- The door is place-level equipment (`role: accessDoor`,
  `area: pedestrianEntrance`, no `lane`). Its reader (`role: cardReader`
  or `barcodeReader`, `controls: [door]`) takes a ticket, receipt, QR
  code, card or PIN; its comms point (`type: intercom`, `equipment` the
  intercom `builtInto` the door, `serves` the door) rings the agent.
- An attempt at the door is recorded like a lane access event: a Part 21
  `AccessEvent` with the door as the device, or an `accessEvent: entry`
  on the read where the door has a camera.
- An agent opens the door with a Part 6 `vendGate` command whose `target`
  is the door; the confirmation level discipline applies as at a lane.
- The scenarios a conformance suite covers: a transient parker with a
  paid ticket after hours; a permit holder with a card; and a refusal for
  an expired permit.

**Worked example.** A door at the Lakeside garage's street entrance,
described from APX alone:

| Element | Role | Detail |
|---|---|---|
| Door | `accessDoor` | `area: pedestrianEntrance`, `level: G` |
| Door intercom | `intercom` | `builtInto: door` |
| Door reader | `cardReader` | `controls: [door]` |
| Door camera | `camera` | `area: pedestrianEntrance`, `mounting: wall`, `view: [pedestrians]` |
| Comms point | `type: intercom` | `equipment: door intercom`, `serves: door`, `commsDeviceId`, `callerId` |

A call from the intercom resolves (Part 17 §17.1) through
`commsDeviceId` to the comms point, from it to the door, and the agent's
allowed actions include `vendGate` on the door, with the door camera's
view a click away.

## 26.9 Conformance

`apx-site-config` requires the base classes and: §26.1 the equipment
detail with a registry `role` on every SupplementalEquipment it serves,
and `GET /v1/equipment` with its filters and feed; §26.2 areas; §26.3
the camera decoration where a camera is inventoried, the view route
where `cameraViews` or `cameraPlayback` is offered, and the privacy
rules; §26.4 comms points, their routes and the resolution rule; §26.5
place operations; §26.6 external identifiers and the resolve route;
§26.7 the two topics and the feeds. The Part 9 §9.7 secrets rule applies
to every read of this Part. Annex A.24.

## 26.10 Registry entries

| Registry | Entries |
|---|---|
| `apx-conformance-classes` v9 | `apx-site-config` |
| `apx-equipment-roles` v1 | the thirty codes of §26.1 rule 2 |
| `apx-area-types` v1 | the nineteen codes of §26.2 |
| `apx-comms-point-types` v1 | `intercom`, `analogDialer`, `postedNumber`, `kiosk`, `qrCode`, `app`, `other` |
| `apx-escalation-roles` v1 | `siteManager`, `attendant`, `security`, `operatorOnCall`, `maintenance`, `other` |
| `apx-features` v3 | `cameraViews`, `cameraPlayback` |
| `apx-topics` v13 | `apx.equipment.changed.v1`, `apx.commspoints.changed.v1` |

Scopes: `apx.siteconfig:read`, `apx.siteconfig:manage`, `apx.cameras:view`.
