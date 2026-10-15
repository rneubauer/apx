## Overview

The Observation data domain documents the observation of an entity in a
Place performing an action. APDS 4.1 already records the method, the
credential observed, the location, images, an overall confidence and a
confidence for each character. The additions proposed here carry what
recognition systems now also report, record the
condition of a vehicle, and tie observations at a toll point into a
charge.

### Benefits of the Observation additions

Enforcement, access control and analytics all act on plate reads, and
each needs to know how far to trust them. A camera can be sure of the
plate characters and unsure of the issuing state, or sure of the plate
and wrong about the colour. One overall confidence cannot say which. A
confidence for each recognised attribute lets every receiver apply its
own thresholds.

When a read is wrong, the right answer is often one of the other
candidates the engine considered. Keeping those alternates lets a
reviewer or a matching system correct the read without a new capture.

On sites without barriers, whether a vehicle entered or left is decided
by the direction it moved past the camera. Recording the movement and
the plate face read tells a receiver which way the vehicle passed.

Some jurisdictions require a person to confirm a plate before a penalty
is issued. Recording the review state and its reasons carries that
evidence with the observation.

Valet operators record a vehicle's condition when they take it and when
they return it; that report is the evidence a damage claim is answered
with. Toll operators assemble a charge from one or more observations at
a toll point and must handle disputes about it.

### What the Observation additions hold

Observation element (additions)

- Has a recognised value and confidence for each attribute read (plate, country, state or province, plate category, make, model, colour, body type).
- Has the alternate plate candidates, best first.
- Has the vehicle's movement relative to the camera, the plate face read, and the direction of passage as the recognition system reports it.
- Has an optional review state, the reasons for review and the original values before correction.

Image (additions)

- Has two more image types: an extended plate crop and a wide context view.
- Has the region of the image that contains the plate.

Condition report

- Has notes, photographs and structured damage findings by area and severity.
- Has when and by whom it was recorded, and whether the customer acknowledged it.

Toll transaction

- Has the toll point, the observations it is built from and the credential read.
- Has the price, the payment that settles it and a status.
- Has an optional dispute with its reason, resolution and the original price.

## Information model

The additions extend the `Observation` package
(`D2Payload/Extension/Parking/Observation`) and add a `Tolling`
sub-package within it (`D2Payload/Extension/Parking/Observation/Tolling`).
All are Level B extensions.

`ObservationElement` gains three optional associations and four
optional attributes. The recognised values themselves stay where APDS
4.1 puts them: the plate in `observedCredentialId`, and country, state,
make, model and colour in the associated `VehicleAncillaryIdentification`.
Each `AttributeRead` repeats one of those values with its own confidence,
so a receiver that knows only APDS 4.1 still reads the winning values.
The existing `Confidence` (overall) and `CharacterConfidence` (per
character) classes are unchanged and remain the place for those
measures.

`accessDirection` reuses the existing APDS `AccessTypeEnum`, using its
values `entry` and `exit` (`reversible` describes an area, not a single
passage). It records what the recognition system reported for this
passage, which may differ from the configured purpose of a reversible
lane (`AccessLaneTypeEnum`).

`Image` gains one optional association, `plateRegion`, to a new
`ImageRegion` that gives the plate's position as fractions of the image,
and `ImageTypeEnum` gains two values.

`ConditionReport` and `DamageItem` are new classes in the Observation
package; the valet ticket in the Session domain references a condition
report at drop-off and at handback.

`TollTransaction` is a new versioned identifiable class in the
`Tolling` sub-package. It references existing `ObservationElement`,
`SupplementalEquipment` (the toll point) and `Payment` instances, and
carries the credential read as a `PresentedCredential` (proposed in the
Right domain).

```mermaid
classDiagram
    class ObservationElement {
        <<APDS>>
    }
    class ObservationElementAdditions {
        <<proposed>>
        +accessDirection : AccessTypeEnum [0..1]
        +movement : VehicleMovementEnum [0..1]
        +plateFace : PlateFaceEnum [0..1]
        +speed : Float [0..1]
    }
    class PresentedCredential {
        <<proposed>>
    }
    class VehicleAncillaryIdentification {
        <<APDS>>
    }
    class Confidence {
        <<APDS>>
    }
    class CharacterConfidence {
        <<APDS>>
    }
    class Image {
        <<APDS>>
    }
    class SupplementalEquipment {
        <<APDS>>
    }
    class Payment {
        <<APDS>>
    }
    class AttributeRead {
        <<proposed>>
        +readAttribute : ReadAttributeEnum [1..1]
        +value : String [1..1]
        +confidence : Decimal [0..1]
    }
    class AlternateRead {
        <<proposed>>
        +plate : String [1..1]
        +stateProvince : String [0..1]
        +confidence : Decimal [0..1]
    }
    class ReadReview {
        <<proposed>>
        +reviewState : ReadReviewStateEnum [1..1]
        +reviewReason : ReadReviewReasonEnum [0..*]
        +decidedTime : DateTime [0..1]
    }
    class ImageRegion {
        <<proposed>>
        +top : Decimal [1..1]
        +left : Decimal [1..1]
        +bottom : Decimal [1..1]
        +right : Decimal [1..1]
    }
    class ConditionReport {
        <<proposed>>
        +notes : MultilingualString [0..1]
        +imageLink : Url [0..*]
        +customerAcknowledged : Boolean [0..1]
    }
    class DamageItem {
        <<proposed>>
        +vehicleArea : String [1..1]
        +severity : DamageSeverityEnum [0..1]
    }
    class TollTransaction {
        <<proposed>>
        +tollPointId : Reference [1..1]
        +transactionStatus : TollTransactionStatusEnum [1..1]
        +pricing : AmountInCurrency [0..1]
    }
    class TollDispute {
        <<proposed>>
        +disputeReason : TollDisputeReasonEnum [1..1]
        +disputeResolution : TollDisputeResolutionEnum [0..1]
    }
    ObservationElement "1" *-- "0..1" VehicleAncillaryIdentification
    ObservationElement "1" *-- "0..1" Confidence
    ObservationElement "1" *-- "0..*" CharacterConfidence
    ObservationElement "1" *-- "0..*" Image
    ObservationElement .. ObservationElementAdditions : Level B additions
    ObservationElement "1" *-- "0..*" AttributeRead
    ObservationElement "1" *-- "0..*" AlternateRead
    ObservationElement "1" *-- "0..1" ReadReview
    ReadReview "1" *-- "0..*" AttributeRead : originalRead
    Image "1" *-- "0..1" ImageRegion : plateRegion
    ConditionReport "1" *-- "0..*" DamageItem
    TollTransaction --> ObservationElement : observationId
    TollTransaction --> SupplementalEquipment : tollPointId
    TollTransaction --> Payment : paymentId
    TollTransaction "1" *-- "0..1" PresentedCredential : vehicleCredential
    TollTransaction "1" *-- "0..1" TollDispute
```

### Suggested change to APDS 4.1 (outside this proposal)

One related suggestion is not an addition and is not part of the Level B
additions above: making `VehicleAncillaryIdentification.country`
optional (`0..1` instead of `1..1`). A read whose plate country the
engine could not place could then still carry make, model and colour,
and those are often the reads that most need them. Today such a read
must omit the whole `VehicleAncillaryIdentification`. The change relaxes
a constraint, so every instance valid today stays valid. It is offered
separately, with the other suggested changes to APDS 4.1.

### Enumerations (for Observation)

| Enumeration | Change | Used by | Tier |
| --- | --- | --- | --- |
| ImageTypeEnum | adds `plateExtended`, `context` | Image.imageType | 2 |
| ReadAttributeEnum | new | AttributeRead.readAttribute | 1 |
| VehicleMovementEnum | new | ObservationElement.movement | 1 |
| PlateFaceEnum | new | ObservationElement.plateFace | 2 |
| ReadReviewStateEnum | new | ReadReview.reviewState | 2 |
| ReadReviewReasonEnum | new | ReadReview.reviewReason | 2 |
| DamageSeverityEnum | new | DamageItem.severity | 2 |
| TollTransactionStatusEnum, TollDisputeReasonEnum, TollDisputeResolutionEnum | new (Tolling) | TollTransaction, TollDispute | 2 |

### External code lists (for Observation)

`ReadReviewReasonEnum`, `TollDisputeReasonEnum` and
`TollDisputeResolutionEnum` are maintained by APX today as user-defined
code lists. As in the Session domain, they could
equally be typed as `PkCommon.ReferencedCodeListEntry` with these values
as the recommended initial list. `DamageItem.vehicleArea` is left as a
string from an operator code list; we do not propose standard values for
it yet.

## Use cases

### Gateless car park with plate recognition and review

A supermarket car park has no barriers. One camera faces the shared
entrance and exit. Customers may stay 90 minutes free; longer stays
receive a parking charge notice, and the national code of practice
requires a person to confirm each plate first.

A vehicle arrives at 10:02 and leaves at 12:10. Its exit read reports
plate `AB12 CDE` with plate confidence 0.97, but colour confidence only
0.41 because of glare.

These specifications support this use case in a number of ways:

**Observations.** Each read carries an `AttributeRead` for the plate, the
country, the make and the colour, each with its own confidence, and
`movement` toward or away from the camera. Because the entrance and exit
share one camera, the movement is what tells the two passages apart; the
recognition system reports `accessDirection` entry or exit accordingly.

**Review.** Because a charge notice will follow, the exit read is sent to
review with `reviewReason` `enforcementHandoff`. The reviewer sees the
`AlternateRead` candidates (`AB12 CDF`, 0.62) and confirms the original.
The read's `ReadReview` records `confirmed`, the time and the reviewer,
and travels with the observation to the enforcement system.

**Sessions.** The Session built from the two reads lists them as its
entry and exit (`SessionRead`), so the 128-minute stay can be checked
against the observations it rests on.

### Valet drop-off and a damage claim

A hotel valet takes a guest's car at 18:30. The attendant photographs the
car and notes a scuff on the rear bumper. At handback the next morning
the guest reports a dent on the driver's door.

These specifications support this use case in a number of ways:

**Condition reports.** The drop-off `ConditionReport` holds the
photographs, a `DamageItem` for the rear bumper with severity `minor`,
and the guest's acknowledgement. The handback report adds a `DamageItem`
for the driver's door. Comparing the two reports, item by item, is the
evidence the claim is answered with.

**Sessions.** The valet ticket (Session domain) references both reports,
the APDS Session for the stay and the Space where the car was parked, so
the operator can see who parked it, where, and when.
