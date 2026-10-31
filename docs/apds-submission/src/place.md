## Overview

The Place data specification already describes where a Place is, how it
is organised, and the equipment and services it offers. These proposals
add three things operators share every day but cannot yet express in
APDS terms: whether the equipment is working, which way the licence plate
cameras on a lane face, and what the signs at a Place say.

### Benefits of the Place additions

A parking operation runs on its equipment. When a barrier fails, a pay
machine runs out of paper or a camera goes offline, the operator, its
monitoring service, its customer-service centre and its enforcement
partner all need to know, and they need to know in the same words. Today
each pair of systems agrees its own list of states.

Licence plate cameras at a lane read the plates of vehicles travelling in
one direction. A receiving system can only tell an entry from an exit if
it knows which way each camera faces.

Signs set the terms of use of a Place. When a customer appeals a parking
charge, the operator must be able to show what the sign said on that day,
even if the sign has since been replaced.

### Equipment status

An Equipment Status record:

- Has a reference to one item of supplemental equipment in the Place.
- Has the state of that equipment (e.g., available, occupied, faulted).
- Has the time the equipment entered that state.
- Has the time the reporting system last heard from the equipment.

Equipment status is kept in its own record rather than as an attribute of
the equipment. This follows the approach APDS takes for occupancy, where
Supply (which changes rarely) is kept apart from Demand (which changes
often). The equipment description is sent once; its status is sent
whenever it changes.

### Lane equipment types

APDS 4.1 EquipmentTypeEnum already includes lprCamera, occupancySensor,
paymentMachine and several door types. Four values would complete a
typical off-street access lane: barrier, gate, ticketDispenser and
intercom. We suggest adding them so that lane equipment need not be typed
as 'other'.

### Lane cameras

A Lane Camera:

- Has a camera identification that matches the cameraID on the images of
  its observations.
- Has a facing: inward (into the Place) or outward (out of the Place).
- Is associated to a Vehicular Access.

### Equipment detail, cameras and comms points

A system that joins a Place today learns its layout from three places at
once: the parking vendor's portal for the lanes and devices, the call
platform for which intercom rings where, and a spreadsheet for the
cameras. A second group of additions lets the Place data say it all:

- Supplemental equipment gains its **role** (what the item does on the
  lane or in the building, from a fixed list: gate, access door, ticket
  dispenser, exit verifier, pay-on-foot machine, card reader, camera,
  intercom, count sign, video recorder and so on), its identity
  (manufacturer, model, serial number, MAC addresses), the firmware and
  software it runs, the date it went into service, the kind of area and
  the level it stands in, the lane it serves, the item it is built into,
  the barriers it opens, and who services it. The equipment type stays
  what it is; the role adds to it. Network addresses are deliberately not
  proposed, in the interest of security.
- A **Camera** is equipment anywhere in the Place, with its mounting,
  what it looks at (the plate, the vehicle, the driver, the hands at the
  machine, pedestrians, an area), which way it faces on a lane, whether
  it is the one to show first, whether it pans and zooms, which recorder
  keeps it and for how long. No stream address and no credential.
- A **Comms point** is any way a parker reaches help from a lane or the
  Place: an intercom, an analog dialer, a posted telephone number, a
  kiosk, a QR code or an app, with the number that is called when help
  is requested, the number the device calls out as, or the identifier the
  call systems use, the lane it serves and the gate or door an agent
  opens for it. No SIP data is proposed.

### Signage

A Signage record:

- Has a unique identification and version.
- Has a reference to the element of the Place hierarchy it governs, and
  applies to the elements below it.
- Has the wording of the sign, in each language shown.
- Has an APDS Validity giving the period it was in force and whether it is
  active, planned or suspended, and an end reason once it is superseded or
  retired.
- May have a sign type, a location and a photo.

A replaced sign is never edited. Its Validity is closed with end reason
superseded, and a new record, or a new version, carries the new wording,
so the history is kept.

## Information model

The Place additions sit in two existing packages, SupplementalFacility and
VehicularAccess, and one new package, Signage, beneath the Place
hierarchy.

```mermaid
classDiagram
    class SupplementalEquipment {
        <<APDS>>
    }
    class RefillPoint {
        <<APDS>>
        +status : RefillPointStatusEnum [0..1]
    }
    class EquipmentStatus {
        <<proposed>>
        +equipmentId : Reference [1..1]
        +equipmentStatus : EquipmentStatusEnum [1..1]
        +otherEquipmentStatus : ReferencedCodeListEntry [0..1]
        +statusChangeTime : DateTime [0..1]
        +lastCommunicationTime : DateTime [0..1]
    }
    class VehicularAccess {
        <<APDS>>
    }
    class LaneCamera {
        <<proposed>>
        +cameraId : String [1..1]
        +facing : CameraFacingEnum [1..1]
    }
    class HierarchyElementGeneral {
        <<APDS>>
    }
    class Signage {
        <<proposed>>
        +elementId : VersionedReference [1..1]
        +signText : MultilingualString [1..1]
        +endReason : RecordEndReasonEnum [0..1]
        +signType : SignTypeEnum [0..1]
        +photoUrl : Url [0..1]
    }
    class Validity {
        <<APDS>>
    }
    class PointLocation {
        <<APDS>>
    }
    class RecordType {
        <<APDS>>
    }
    SupplementalEquipment "1" <.. "0..*" EquipmentStatus : equipmentId
    SupplementalEquipment "1" o-- "0..*" RefillPoint : refillPoint
    VehicularAccess "1" o-- "0..*" LaneCamera : laneCamera
    HierarchyElementGeneral "1" <.. "0..*" Signage : elementId
    Signage o-- "1" Validity : validity
    Signage o-- "0..1" PointLocation : location
    EquipmentStatus o-- "0..1" RecordType : recordType
    Signage o-- "0..1" RecordType : recordType
```

### How equipment status attaches

EquipmentStatus refers to a SupplementalEquipment by reference, in the
same way that DemandTable refers to a hierarchy element through
elementId. A plain reference is used because SupplementalEquipment is a
component of a versioned SupplementalFacility rather than versioned on
its own. EquipmentStatus adds nothing to the equipment description
itself.

APDS 4.1 already gives refill points a status (RefillPoint.status, typed
RefillPointStatusEnum). EquipmentStatusEnum carries the same idea to all
supplemental equipment, and reuses RefillPointStatusEnum literals where
the meaning is the same: available, occupied, blocked, faulted and
unknown. Refill-point states that only make sense for energy (charging,
outOfStock, reserved) are not repeated. Where an item is a refill point,
RefillPoint.status continues to apply; EquipmentStatus covers the barrier,
camera, pay machine or intercom beside it.

APX's current code list uses 'fault' and 'inoperative' for what this
proposal calls faulted and closed. APX would adopt the APDS names once
agreed.

### How lane cameras attach

LaneCamera is a component of VehicularAccess. It does not repeat the
camera's equipment description, which can be given as SupplementalEquipment
with equipmentType lprCamera. Facing is stated relative to the Place, not
to the lane's flow, so it remains correct on a reversible lane. The
association could equally be placed on AccessLaneSpecific where lanes are
described one by one; we would welcome the group's view.

### How equipment detail, cameras and comms points attach

```mermaid
classDiagram
    class SupplementalEquipment {
        <<APDS, extended>>
        +equipmentRole : EquipmentRoleEnum [0..1]
        +manufacturer : String [0..1]
        +model : String [0..1]
        +serialNumber : String [0..1]
        +macAddress : String [0..*]
        +firmwareVersion : String [0..1]
        +softwareVersion : String [0..1]
        +installationDate : Date [0..1]
        +areaType : AreaTypeEnum [0..1]
        +levelName : String [0..1]
    }
    class Camera {
        <<proposed>>
        +mounting : CameraMountingEnum [0..1]
        +view : CameraViewEnum [1..*]
        +facing : CameraFacingEnum [0..1]
        +primary : Boolean [0..1]
        +panTiltZoom : Boolean [0..1]
        +retentionDays : NonNegativeInteger [0..1]
    }
    class CommsPoint {
        <<proposed>>
        +commsPointType : CommsPointTypeEnum [1..1]
        +phoneNumber : String [0..1]
        +callerId : String [0..1]
        +commsDeviceId : String [0..1]
        +language : LanguageCode [0..*]
    }
    class VehicularAccess {
        <<APDS>>
    }
    class Place {
        <<APDS>>
    }
    class Organisation {
        <<APDS>>
    }
    class Period {
        <<APDS>>
    }
    SupplementalEquipment <|-- Camera
    SupplementalEquipment "0..1" <.. "0..*" SupplementalEquipment : builtInto
    SupplementalEquipment "0..*" <.. "0..*" SupplementalEquipment : controls
    VehicularAccess "0..1" <.. "0..*" SupplementalEquipment : servesAccess
    Organisation "0..1" <.. "0..*" SupplementalEquipment : serviceProvider
    SupplementalEquipment "0..1" <.. "0..*" Camera : recorder
    Place "1" <.. "0..*" CommsPoint : placeId
    VehicularAccess "0..1" <.. "0..*" CommsPoint : servesAccess
    SupplementalEquipment "0..1" <.. "0..*" CommsPoint : equipmentId
    SupplementalEquipment "0..1" <.. "0..*" CommsPoint : opensBarrier
    CommsPoint o-- "0..*" Period : coverage
```

The equipment attributes are added to SupplementalEquipment itself,
because they describe the item and change as rarely as the rest of the
Place description. Camera is a specialisation of SupplementalEquipment,
so a camera is still typed by EquipmentTypeEnum and carries the role
`camera`; the Camera attributes say what it looks at. CommsPoint is a
versioned record of its own in a new package beneath Place: it refers to
the Place, the lane, the hardware and the barrier by reference, so that a
posted number with no hardware is as valid as an intercom.

### How signage is modelled

Signage is versioned identifiable so a receiver can hold every version
of a sign. Its period and state use the APDS Validity class, with the
shared RecordEndReasonEnum (PkCommon) for why it ended. Its location
uses PointLocation and its photo follows the photoUrl convention of
SupplementalFacility. Signage does not refer to the Enforcement domain:
the EnforcementPolicy proposed there points to the signs that give
notice of it, so these Level B additions stand on their own.

### Enumerations (for Place)

| Enumeration | Change | Values |
| --- | --- | --- |
| EquipmentStatusEnum | New | available, occupied, blocked, closed, outOfService, faulted, unknown, other |
| EquipmentTypeEnum | Add values | barrier, gate, ticketDispenser, intercom |
| CameraFacingEnum | New | inward, outward |
| SignTypeEnum | New | entrance, paymentMachine, perSpace, ratesBoard, towAway, other |

Signage also uses the shared RecordEndReasonEnum proposed in PkCommon.

### External code lists (for Place)

States beyond EquipmentStatusEnum are carried in otherEquipmentStatus as a
ReferencedCodeListEntry, pointing to a UserDefinedCodeList published by
the operator or by APX. No new code list mechanism is needed.

## Use cases

### Lane equipment status at a city-centre garage

A 600-space garage has two entry and two exit lanes. Each lane has an LPR
camera, a barrier, an intercom and, at the entry lanes, a ticket
dispenser. The operator uses a remote monitoring centre to answer
intercom calls after hours, and the city's parking guidance system shows
the garage on its signs.

At 22:10 the barrier on exit lane 2 fails to close. A queue forms at
lane 1. The monitoring centre must see the fault, take calls from lane 1,
and the guidance system should stop sending vehicles while the exit is
congested.

These specifications support this use case in a number of ways:

**Place.** The garage, its vehicular accesses and its lane equipment are
described once as a Place hierarchy. Each barrier, intercom and ticket
dispenser is a SupplementalEquipment with an equipment type from
EquipmentTypeEnum, using the new values barrier, intercom and
ticketDispenser, and each camera uses the existing value lprCamera. Each
VehicularAccess lists its LaneCameras with their facing.

**Equipment status.** When the barrier fails, the site system sends one
EquipmentStatus record: the barrier's reference, equipmentStatus
'faulted' and the statusChangeTime. The monitoring centre and the guidance
system receive the same record and understand it the same way. When the
barrier is repaired, a second record with 'available' closes the episode.
Neither party needs the Place hierarchy resent.

**Observation.** Plate reads from each lane carry the cameraID on their
images. Because each LaneCamera states which way it faces, a receiver can
tell entering from exiting vehicles without knowing the camera vendor's
own configuration.

### A monitoring service learns a garage from the Place data

A monitoring service takes on a 400-space garage. It reads the Place
hierarchy and, for each SupplementalEquipment, the role, manufacturer,
model, firmware version and serial number, the lane it serves and the
barriers it opens. It knows at once that exit lane 2 has a gate, an exit
verifier that opens it, an intercom and two cameras, one reading plates
outward and one overhead watching the card slot; that the pay-on-foot
machine on level G has a camera built in that looks at the driver; and
that the street door is opened by a card reader and has an intercom in
its call box. The comms points tell it which number each intercom calls
out as and which gate or door an agent opens for it, and that the number
posted on the pay-on-foot sign serves the whole Place and no single
lane. Nothing was read from the vendor's portal, and no address or
password reached the service.

### Which lane is calling

A parker presses the intercom at exit lane 2. The call platform hands
the answering agent the caller id. The agent's console matches it to the
comms point, and from the comms point to the lane and the gate it
serves. A second parker dials the number posted on the pay-on-foot sign
from a mobile phone; that comms point serves the Place and no lane, so
the agent asks which machine the parker is at. A third presses the
intercom at the street door after hours; the comms point names the door
it opens, and the agent, having checked the parker's permit, opens the
door.

### Showing the sign at appeal

A surface lot changes its maximum stay from 3 hours to 2 hours on
1 March. The entrance sign is replaced that morning. On 4 March a
customer receives a parking charge notice and appeals, saying the sign
allowed 3 hours.

These specifications support this use case in a number of ways:

**Place and Signage.** The lot holds two Signage records for the
entrance. The first, valid from the previous year, says 3 hours; its
Validity ends on 1 March 08:00 and its end reason is 'superseded'. The
second says 2 hours, and its Validity is active from 1 March 08:00. Each
has a photo and a location.

**Enforcement.** The violation record refers to the Place and the time of
the event. The appeals body selects the Signage record in force at that
time and sees the wording and photo of the sign as it stood, which here
shows the 2-hour limit.
