## Overview

The Session data domain documents the actual use of an AssignedRight. APDS
4.1 records when a Session started and ended, its Segments, and the
credentials and vehicle identified. The additions proposed here record
what a Session rests on and what happened at the entry and exit points
of a Place, including attempts that never became a Session.

### Benefits of the Session additions

Two parties that receive the same Sessions should be able to compute the
same dwell times, the same occupancy and the same revenue. Today they
cannot always do so, because a Session does not say whether its end was
observed or set by a rule, or whether its entry was ever seen. A Session
closed after 48 hours with no exit observation and a Session closed by an
exit camera look the same.

Access control systems refuse credentials every day: a lost keycard, an
expired permit, a vehicle already inside. A refusal opens no Session, so
it leaves no trace in APDS today. The help desk that takes the call from
the lane, the issuer of the credential and the operator all need the same
record of what happened.

Merchant validations are already anticipated by APDS through
`Segment.validationId`, but there is no record that the identifier points
to. Adding one lets a merchant, an operator and an auditor see the same
redemption and the actual amount it removed.

Valet operations are mentioned in APDS only as an operating restriction.
A valet ticket records custody of the vehicle, where it is parked, and
how it was returned, while the stay and the money remain on the APDS
Session.

### What the Session additions hold

Session (additions)

- Has the observations it was built from, each with the part it played (entry, exit, duplicate, activity).
- Has a closure: why it ended, whether the end was inferred by rule, and whether the start was observed.
- Has an optional parent Session, for a Session kept for an area inside a wider visit.
- Has, for discussion, a record of each match it rests on (which right, valet ticket or violation it was linked to, and who decided).

Access event

- Has a date/time, a direction (entry or exit) and an outcome (granted or denied).
- Has a denial reason when access was refused.
- Has the assigned credential it matched, or the credential presented when nothing matched.
- Has the Place element, the vehicular access (lane) and the equipment where it occurred.
- Has the Session it opened or closed, when access was granted.

Validation redemption

- Has the Place element where it was applied, the Session it was applied to and, optionally, the validation programme it draws on.
- Has the date/time and channel of application, and whether it stands or was reversed.
- Has the actual amount reduced or time given free, which may be less than the nominal benefit.
- Is the record that `Segment.validationId` identifies.

Valet ticket

- Has the Place that took custody, the Session for the stay and an optional AssignedRight.
- Has a status from drop-off to handback, with the time of each step.
- Has the Space where the vehicle is parked and how the customer asked for it back.
- Has condition reports at drop-off and handback (see Observation).

## Information model

The additions extend the `Session` package
(`D2Payload/Extension/Parking/Session`). Each one is a Level B extension
in the sense of the APDS Information Model clause "Extending the APDS
Model": a valid instance of the extended model is also a valid APDS 4.1
instance, and no core class becomes a component of an extension class.

`Session` gains three optional associations (`sessionRead`,
`sessionClosure`, `matchEvidence`) and three optional attributes
(`parentSessionId`, `lifecycle`, `passThrough`). `SessionRead` points to an
existing `ObservationElement`, so the observation itself is still
exchanged through the Observation domain; the Session only says which
observations it used and how. `MatchEvidence` is kept small and offered
for discussion (tier 3): it records what a Session was matched to, but
not the scoring behind the match, which is left to implementations.

`AccessEvent` is a new identifiable class. It is placed in the Session
package because a granted access opens or closes a Session, but it stands
on its own: a refused attempt has no Session. It references the existing
`CredentialAssigned` when the presented value matched one. When nothing
matched, it carries the value as a `PresentedCredential`, the class
proposed in the Right domain for every credential value that is not an
assigned credential. Its direction reuses the existing APDS
`AccessTypeEnum` with the values `entry` and `exit`; the third value,
`reversible`, describes an area rather than a single attempt and does not
apply.

The anti-passback state of a credential is not proposed as a class of its
own: it follows from the access events of that credential.

`ValidationRedemption` is a new versioned identifiable class. Its
`validationId` attribute is the value placed in the existing
`Segment.validationId`, so a receiver that knows only APDS 4.1 still sees
that a validation was applied. Its optional `validationProgramId`
references the validation programme proposed in the Right domain; that
programme is a tier 2 proposal, so a redemption does not depend on it.
Its channel uses the shared `InteractionChannelEnum` proposed in PkCommon.

`ValetTicket` is a new versioned identifiable class. It references the
APDS `Session`, `AssignedRight` and `Space`, and uses the existing
`VehicleAncillaryIdentification` for the vehicle, a `PresentedCredential`
for its plate, and the proposed `ConditionReport` (Observation domain) for
its condition.

```mermaid
classDiagram
    class Session {
        <<APDS>>
    }
    class SessionAdditions {
        <<proposed>>
        +parentSessionId : VersionedReference [0..1]
        +lifecycle : SessionLifecycleEnum [0..1]
        +passThrough : Boolean [0..1]
    }
    class Segment {
        <<APDS>>
    }
    class ObservationElement {
        <<APDS>>
    }
    class CredentialAssigned {
        <<APDS>>
    }
    class SupplementalEquipment {
        <<APDS>>
    }
    class PresentedCredential {
        <<proposed>>
    }
    class SessionRead {
        <<proposed>>
        +observationId : Reference [1..1]
        +role : SessionReadRoleEnum [1..1]
        +representative : Boolean [0..1]
    }
    class SessionClosure {
        <<proposed>>
        +endReason : SessionEndReasonEnum [0..1]
        +endInferred : Boolean [0..1]
        +startObserved : Boolean [0..1]
        +closureRule : String [0..1]
    }
    class MatchEvidence {
        <<proposed>>
        +targetId : Reference [1..1]
        +matchType : MatchTypeEnum [1..1]
        +applied : Boolean [1..1]
    }
    class AccessEvent {
        <<proposed>>
        +occurredTime : DateTime [1..1]
        +direction : AccessTypeEnum [1..1]
        +outcome : AccessOutcomeEnum [1..1]
        +denialReason : AccessDenialReasonEnum [0..1]
    }
    class ValidationRedemption {
        <<proposed>>
        +elementId : VersionedReference [1..1]
        +appliedTime : DateTime [1..1]
        +channel : InteractionChannelEnum [1..1]
        +redemptionStatus : ValidationRedemptionStatusEnum [1..1]
        +amountReduced : AmountInCurrency [0..1]
    }
    class ValetTicket {
        <<proposed>>
        +valetStatus : ValetStatusEnum [1..1]
        +dropOffTime : DateTime [1..1]
        +handbackTime : DateTime [0..1]
    }
    Session .. SessionAdditions : Level B additions
    Session "1" *-- "0..*" SessionRead
    Session "1" *-- "0..1" SessionClosure
    Session "1" *-- "0..*" MatchEvidence
    Session "1" *-- "1..*" Segment
    SessionRead --> ObservationElement : observationId
    AccessEvent --> CredentialAssigned : credentialId
    AccessEvent "1" *-- "0..1" PresentedCredential : presentedCredential
    AccessEvent --> SupplementalEquipment : equipmentId
    AccessEvent --> Session : sessionId
    ValidationRedemption --> Session : sessionId
    Segment ..> ValidationRedemption : validationId
    ValetTicket --> Session : sessionId
    ValetTicket "1" *-- "0..1" PresentedCredential : vehicleCredential
```

### Enumerations (for Session)

The following enumerations are proposed in the Session package. Their
values are listed in the Data Dictionary.

| Enumeration | Used by | Tier |
| --- | --- | --- |
| SessionReadRoleEnum | SessionRead.role | 1 |
| SessionEndReasonEnum | SessionClosure.endReason | 1 |
| SessionLifecycleEnum | Session.lifecycle | 2 |
| AccessOutcomeEnum | AccessEvent.outcome | 1 |
| AccessDenialReasonEnum | AccessEvent.denialReason | 1 |
| ValidationRedemptionStatusEnum | ValidationRedemption | 1 |
| MatchTypeEnum, MatchDecisionEnum | MatchEvidence | 3 |
| ValetStatusEnum, HandbackVerificationEnum | ValetTicket | 2 |

Two existing or shared enumerations are reused rather than repeated: the
APDS `AccessTypeEnum` for the direction of an access event, and the
`InteractionChannelEnum` proposed in PkCommon for the channel of a
validation or a valet retrieval request.

The end reasons are written in plain terms: `exitObserved`,
`reentryObserved`, `timedOut`, `parentSessionEnded`, `leftArea`,
`notFoundOnCount`, `valetHandback`, `exitWithoutEntry`,
`closedByOperator` and `closedAfterReview`.

### External code lists (for Session)

Two of the lists above are open by nature: new end reasons and denial
reasons appear as products evolve. APX maintains them today as
user-defined code lists in the APDS `UserDefinedCodeList` shape. We have
proposed them as enumerations so the group can see and discuss the
values, but we would be equally glad to see `endReason` and
`denialReason` typed as `PkCommon.ReferencedCodeListEntry`, with these
values published as the recommended initial list. We leave that choice to
the group.

## Use cases

### Gated garage with plate recognition at entry and exit

City Centre Garage has two entry lanes and two exit lanes, each with a
plate recognition camera and a barrier. Monthly parkers hold a keycard;
transient customers are identified by their plate. A third-party
analytics provider receives the garage's Sessions to report occupancy and
average dwell to the city.

On Monday morning a monthly parker presents a keycard that was reported
lost on Friday and replaced. The reader refuses it. Later a transient
vehicle leaves through an exit lane, but its entry was not recorded
because the entry camera was being cleaned. On Wednesday a vehicle that
entered on Saturday has still not been seen leaving.

These specifications support this use case in a number of ways:

**Access events.** The refusal is recorded as an `AccessEvent` with
`direction` entry, `outcome` denied and `denialReason`
`credentialReplaced`, referencing the old `CredentialAssigned` and the
reader as `SupplementalEquipment`. The help desk that answers the
intercom, the card issuer and the operator all see the same record,
although no Session was opened.

**Sessions.** The transient exit produces a Session whose
`SessionClosure` has `endReason` `exitWithoutEntry` and `startObserved`
false; its start time is an estimate. The analytics provider leaves it
out of dwell statistics and occupancy instead of counting a visit of zero
minutes. The Saturday vehicle's Session is closed by the operator's rule
with `endReason` `timedOut`, `endInferred` true and `closureRule` naming
the rule, so it is not mistaken for an observed exit.

**Observations.** Each Session lists its `SessionRead` entries: the entry
and exit observations, and any duplicate frames from a second camera
marked `duplicate`, so a receiver never counts one passage twice.

### Merchant validation at a shopping centre

A cinema validates parking for its customers through a pay station code
and through its own application. The car park operator invoices the
cinema monthly.

These specifications support this use case in a number of ways:

**Validation redemption.** Each validation applied is a
`ValidationRedemption` referencing the Place element, the cinema's
validation programme, the Session, the time, the channel (`payStation` or
`mobileApp`) and the amount actually removed. A customer who stayed 20
minutes and was charged nothing records the 20 minutes' fee, not the
nominal three hours.

**Sessions.** The redemption's `validationId` is written to the Segment's
existing `validationId`, so a receiver that knows only APDS 4.1 still sees
that the Segment was validated.

**Corrections.** A redemption applied in error is not deleted; its
`redemptionStatus` becomes `reversed` with the time and reason, so the
monthly invoice and the audit trail agree.
