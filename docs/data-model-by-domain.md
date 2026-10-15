# APX Data Elements by APDS Domain

*Working draft · As of 2026-10-14 · APX 0.14.0 · Contact: rneubauer@umojo.com*

## Purpose

APDS is published as ISO TS 5206-1, and anything added there is hard to
change. So we are splitting APX in two:

- **To ISO:** a short list of new *data elements*. Each one is small,
  stable, vendor-neutral and mostly optional, with code lists left open
  so the values can live in a registry.
- **Stays in APX:** the API (routes, change feeds, delivery fabric,
  command workflow, scopes, discovery), the request and response bodies,
  and use-case documents that describe how we implement it.

This document places every APX schema on the APDS high-level data map
(Place, Rights, Rates, Quote, Occupancy/Utilization, PkCommon, Energy
Infrastructure, Session, Observation). For each one it says whether the
element is already in APDS, is an APX extension of an APDS entity, is a
new element, or is API plumbing that should never go to ISO. It ends
with a proposed ISO shortlist that marks each attribute as required or
optional.

Source of truth: `spec/openapi/domains/*/schemas.yaml`,
`spec/openapi/overlays/apx-data-overlay.yaml`, `spec/registries/*.json`,
and the vendored `spec/vendor/apds/4.1/apds-api-4.1.yaml`.

### Kinds

| Kind | Meaning | Goes to ISO? |
| --- | --- | --- |
| **APDS** | Existing APDS entity, used as-is | Already there |
| **Ext** | Fields APX adds to an APDS entity (an `apds-ext:apx:*` block in `extensions`) | Candidate: propose the fields onto the APDS entity |
| **New** | A data element APDS has nothing for | Candidate if small and stable |
| **API** | Envelope, command, request body, search, or computed view | No; stays in APX |

### Required vs optional: the short answer

**In APX: yes.** Every APX schema states its `required:` list, and the
tables below quote those lists exactly. Everything not listed is
optional.

**For ISO: not yet.** The "Required" and "Optional" columns in the
[ISO shortlist](#proposed-iso-shortlist) are a proposal. They follow
three rules:

1. Required means identity plus the one or two attributes without which
   the element means nothing. Everything else is optional.
2. Any code list (types, reasons, states) is required as an attribute,
   but its *values* point to an open registry and are not fixed in ISO.
3. Lifecycle, audit and workflow detail (`statusHistory`, approvals,
   amount histories) stays in the APX profile.

## Place (On-street / Off-street)

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `extensions` on `HierarchyElement` | Ext (erratum 010) | Hierarchy | — | container only |
| `LaneCameras` (`lane-cameras@1.0` on `VehicularAccess`) | Ext | Layout/Structure/Equipment | `cameras[]` → `cameraId`, `faces` | — |
| `DeviceStatus` (`devicestatus@1.0`) | New (keyed overlay on equipment) | Layout/Structure/Equipment | `device`, `deviceState` | `lastCommunication`, `stateChangedTime` |
| `Signage` | New | Layout/Structure/Equipment | `id`, `version`, `place`, `text`, `signageStatus`, `effectiveFrom` | `effectiveTo`, `location`, `imageLink`, `signType`, `policy` |
| `PlateListPlaceFlags` | New | Hierarchy (scope) | `place` | `enforced`, `alertOnArrival`, `refuseService` |
| `extensions` on `ContactPoint` | Ext | Contact | — | container only |

Devices use only APDS equipment names. APDS has no gate, barrier,
camera, ticket dispenser or intercom value, so we are asking for those to
be added to `EquipmentTypeEnum` (see [Decided](#decided)).

## Rights Data

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `CredentialRecord` → materializes into APDS `CredentialAssigned` | New | Credential | `id`, `version`, `credentialType`, `credentialIdentification`, `credentialStatus` | `holder`, `validity`, `places`, `media{form, serialNumber, deposit…}`, `suspension`, `replaces`/`replacedBy` |
| `PresentedCredential` | New (value object) | Credential | `credentialType`, `credentialIdentification` | — |
| `CredentialDigest` (`credential-digest@1.0`) | Ext | Credential | `alg`, `keyId`, `value` | `credentialType` |
| `ReservationExtension` (`reservation@1.0` on `AssignedRight`) | Ext | Assigned Right | `reservationState` | `checkInSession`, `noShowAfter` |
| `PermitExtension` (`permit@1.1` on `AssignedRight`) | Ext | Assigned Right | — | `renews`, `renewedBy`, `maxConcurrentVehicles`, `overageBilling` |
| `PlateList` | New | Eligibility | `id`, `version`, `name`, `category`, `status` | `owner`, `places[]`, `description` |
| `PlateListEntry` | New | Eligibility / Credential | `id`, `version`, `credential{credentialType, credentialIdentification}` | `jurisdiction`, `validity`, `details` |
| `ValidationProgram` | New | Eligibility (with Rates) | `id`, `version`, `place`, `provider`, `programStatus`, `benefit` | `validationType`, `rules`, `billing`, `issuanceMethods` |
| `ValidationIssuance`, `ValidationInstrument` | New | Credential (instrument stock) | `id`, `version`, `program`, `quantity`, `method`, `issuanceStatus` / `code`, `program`, `instrumentStatus` | validity, redemption |
| `Account` | New (anchored on a RightHolder) | Assigned Right (holder) | `id`, `version`, `accountStatus` | `holder`, `plates`, `credentials`, `balance` |
| `PaymentRecord` → materializes into APDS `Payment` | New | Basic Financial | `id`, `transactionID`, `dateCollected`, `amount`, `paymentStatus`, `place` | `meansOfPayment`, `channel`, `captureStatus`, `refundedAmount`, `cardLast4` |
| `PaymentDetail` (`payment-detail@1.0`) | Ext | Basic Financial | at least one member | `rateSold`, `lines[]` (APDS `PaymentLine`) |
| `Posting`, `ValidationStatement` | New (operator accounting) | Basic Financial | see schemas | — |
| `extensions` on `RightSpecification`, `AssignedRight`, `Payment` | Ext (erratum 010) | — | — | container only |

## Rates Data

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `RateTable` `required` fix | Ext (erratum 004) | Rate Table | `rateTableName`, `availability`, `rateLineCollections` | — |
| `RatePolicy` (`ratepolicy@1.0`) | Ext | Rate Table | `negotiable` | `displayName`, `note` |
| `ValidationBenefit` | New | Rate Table (discount) | `description` + exactly one of `amount` / `duration` / `percentage` | — |

## Quote Data

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `Identifiers.rateTableId` | Ext (erratum 009) | Quote Right Request | — | spelling fix |

APX adds no other quote data. The quote work is the errata (007, 008).

## Occupancy / Utilization Data

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `OccupancySnapshot` | New (built from APDS `Supply` + `DemandType`) | Supply / Demand | `place`, `computedAt` | `available`, `evCharging{…}` |
| `OccupancyHistoryPage` buckets | New | Demand (Use) | `place`, `interval`, `from`, `to`, `buckets[].start` | `maxCount`, `avgCount`, `supplyQuantity`, `samples` |

## Session Data

| APX element | Kind | APDS sub-box | Required | Notable optional |
| --- | --- | --- | --- | --- |
| `SessionDetail` (`session-detail@1.0`) | Ext | Start and End | — | `lifecycle`, `reads[]`, `closure`, `matches[]`, `parent`, `passThrough` |
| `SessionReadBinding` | New (inside Ext) | Start and End | `observation`, `role` | `representative` |
| `SessionClosure` | New (inside Ext) | Start and End | — | `endReason`, `endInferred`, `startObserved`, `rule` |
| `MatchEvidence` (`match-evidence@1.0`) | Ext | Start and End ↔ Rights | `target`, `matchType`, `applied` | `plate{method, editCost}`, `vehicle{level}`, `decidedBy`, `decidedTime` |
| `AccessEvent` / `CredentialAccessEvent` | New | Start and End | `occurredAt`, `direction`, `outcome` (+ `credential` for the strict form) | `presented`, `place`, `lane`, `device`, `denialReason`, `session` |
| `PassbackStatus` | Ext (on a Credential) | Start and End | `credential`, `state` | `expectedPresence`, `recordedPresence`, `lastAccess` |
| `ValidationRedemption` → APDS `Segment.validationId` | New | Start and End (Segment) | `id`, `version`, `program`, `place`, `appliedTime`, `channel`, `redemptionStatus` | `session`, `instrumentCode`, `amountReduced`, `durationComped` |
| `ValetTicket` | New | Start and End (custody) | `id`, `version`, `place`, `valetStatus`, `dropOff.time` | `session`, `ticketNumber`, `vehicle`, `storage`, `retrieval`, `handback` |
| `extensions` on `Session` | Ext (erratum 010) | — | — | container only |

## Observation Data

| APX element | Kind | Required | Notable optional |
| --- | --- | --- | --- |
| `LprReadDetail` (`lpr-read@1.0`) | Ext | — | `plate`, `country`, `stateProvince`, `make`, `model`, `color`, `alternateReads`, `plateFace`, `movement`, `accessEvent`, `captureGroup`, `review` |
| `AttributeRead` | New (value + confidence) | `value` | `confidence` |
| `ConditionReport` | New | — (a damage item requires `area`) | `damage[]{area, severity, imageLink}`, `imageLinks`, `recordedTime`, `customerAcknowledged` |
| `TollTransaction` | New (Observation + Basic Financial) | `id`, `version`, `tollPoint`, `transactionStatus` | `observations`, `credential`, `pricing`, `payment`, `dispute` |
| `extensions` on `ObservationElement`, `ObservationSet` | Ext (erratum 010) | — | container only |

## Energy Infrastructure Data

| APX element | Kind | Required | Notable optional |
| --- | --- | --- | --- |
| `ChargingPointStatus` (keyed overlay on `ElectricChargingEquipment`) | New | `chargingPoint`, `availability` | `refillPointIndex`, `connectors[]`, `space`, `reservedFor` |
| `ChargingBayPresence` | New | `presence` | `source`, `observedTime`, `sinceTime`, `confidence` |
| `ChargingSession` | New (+ Session link) | `id`, `version`, `place`, `chargingPoint`, `chargingStatus` | `parkingSession`, `connectorIndex`, `energy`, `stopReason`, `idlePolicy`, `cost`, `settlement` |

Charging is experimental (Part 23, `beta/ev-charging`), so none of it is
proposed to ISO yet.

## PkCommon Data

| APX element | Kind | Required | Notes |
| --- | --- | --- | --- |
| `GeoJsonObject.coordinates` | Ext (erratum 011) | — | RFC 7946 array |
| `Extensions` | Ext (erratum 010) | — | The `apds-ext:` container |
| `RecordInfo` | New (mirrors APDS RecordType) | — | `origin` carries aggregation provenance |
| `CodeListValue` | New | `value` | `codeListId`: the registry anchor pattern |

## New boxes APDS does not have

### Enforcement (Part 19 violations, Part 17 resolution)

APDS 4.1 has no violation, notice, citation or enforcement-policy
entity. Our violation shapes reuse APDS types throughout: `Reference`,
`AmountInCurrency`, `CredentialTypeEnum`, `ImageTypeEnum`, `PointLocation`.

| APX element | Kind | Required | Notable optional |
| --- | --- | --- | --- |
| `Violation` | New | `id`, `version`, `violationType`, `violationStatus`, `place`, `detection` | `space`, `vehicle`, `observations`, `evidence`, `location`, `relatedSession`, `relatedRight`, `notice`, `amount`, `dueTime`, `appeal`, `payments` |
| `ViolationDetection` | New | `mode`, `detectedTime` | `detector`, `principal`, `confidence`, `rule` |
| `Violation.notice` (inline) | New | — (on import: `noticeNumber`, `issuedTime`) | `noticeKind`, `issuedBy`, `deliveryMethod` |
| `Violation.appeal` (inline) | New | — | `reason`, `openedFrom`, `resolution`, `refund` |
| `ViolationVehicle` | Ext (an APDS credential shape) | `credentialType`, `credentialIdentification` | `jurisdiction`, `description` |
| `ViolationEvidence[]` | Ext (APDS Image) | `imageLink` | `imageType`, `capturedTime`, `device` |
| `ViolationLocation` | Ext (modelled on Observation `Location`) | — | `observedLocation`, `observerLocation`, `accuracyMetres` |
| `EnforcementPolicy` | New | `id`, `version`, `place`, `policyStatus`, `effectiveFrom` | `authority`, `deliveryRules`, `penaltyCap`, `escalation`, `appealWindowDays`, `paymentGraceDays`, `signageRequired` |

### Operational condition (Part 7 alerts)

| APX element | Kind | Required | Notable optional |
| --- | --- | --- | --- |
| `Alert` | New | `id`, `version`, `alertType`, `severity`, `status`, `detectionTime` | `source{device, place}`, `relatedEntity`, `occurrenceTime`, `expiryTime` |

### Customer service (Part 17)

| APX element | Kind | Required | Notable optional |
| --- | --- | --- | --- |
| `SupportInteraction` | New | `id`, `version`, `channel`, `agentType`, `startedAt`, `place` | `issue`, `summary`, `subjects`, `resolution` |

This is arguably outside parking data. It is listed for completeness and
not proposed.

## Not data elements (stay in APX)

These are API shapes. None of them goes to ISO.

- **Transport:** `Problem`, `EventEnvelope`, `ChangeFeedPage` and its
  parts, `ApxResourceCore`, subscriptions, `DeliveryRecord`,
  `DiscoveryDocument`, `ApxConfiguration`.
- **Commands and workflow:** `Command`, `CommandResult`, `Approval`,
  `AlertTransition`, `PaymentLink`, `ChargingEvent`, and every request
  body (`ViolationReview`, `ViolationIssue`, `TollDisputeOpen`,
  `Valet*Request`, `PermitIssueRequest`, `CredentialTransition`, …).
- **Computed views:** `LprRead`, `LaneStatus`, `MatchCandidate`,
  `EligibilityResult`, `ResolutionContext`, `AllowedAction`,
  `PlateCandidate`, `OverrideRecord`, `PoolAvailability`,
  `ReservationSummary`, searches.

## Proposed ISO shortlist

Tier 1 is a first, minimal submission: things every PARCS, enforcement
or LPR system already has. Tier 2 waits until implementations have
proven the shape, and meanwhile stays an `apds-ext:apx:*` extension.
"Code list" means the attribute is in ISO and its values come from an
open registry.

### Tier 1: propose now

| # | Element | APDS box | Required | Optional |
| --- | --- | --- | --- | --- |
| 1 | **AccessEvent**: one credential presentation at an entry or exit and its result | Session | `occurredAt`, `direction` (entry \| exit), `outcome` (granted \| denied) | `credential` or `presented`, `place`, `lane`, `device`, `denialReason` (code list), `session` |
| 2 | **DeviceStatus**: live operational state of a piece of site equipment | Place › Equipment | `device`, `deviceState` (code list) | `lastCommunication`, `stateChangedTime` |
| 3 | **Credential lifecycle**: status and medium on an assigned credential | Rights › Credential | `credentialType`, `credentialIdentification`, `credentialStatus` (code list) | `validity`, `media.form` (code list), `replaces`, `replacedBy` |
| 4 | **Session reads and closure**: which observations a session rests on and how it ended | Session | `reads[].observation`, `reads[].role` (entry \| exit \| duplicate \| activity) | `endReason` (code list), `endInferred`, `startObserved`, `parent` |
| 5 | **Plate read attributes**: a value and confidence for each recognised attribute | Observation | `plate` (`value`) | `plate.confidence`, `country`, `stateProvince`, `make`, `model`, `color`, `movement`, `alternateReads` |
| 6 | **Violation (core)**: a finding that a vehicle at a place had no valid right | Enforcement (new) | `id`, `version`, `violationType` (code list), `violationStatus` (code list), `place`, `detectedTime` | `detectionMode`, `vehicle`, `observations`, `evidence`, `relatedSession`, `relatedRight`, `amount` |
| 7 | **Notice**: the warning, notice or citation issued for a violation | Enforcement (new) | `noticeNumber`, `issuedTime` | `noticeKind` (code list), `issuedBy`, `deliveryMethod` (code list), `dueTime` |
| 8 | **Validation (redemption)**: a merchant validation applied to a session | Session › Segment / Basic Financial | `program`, `appliedTime`, `redemptionStatus` | `amountReduced`, `durationComped`, `instrumentCode` |

### Tier 2: keep as APX extensions for now

`ReservationExtension`, `PermitExtension`, `PaymentDetail` and the
`PaymentRecord` deltas on `Payment` (`channel`, `captureStatus`,
`refundedAmount`), `ValidationProgram`/`ValidationBenefit`,
`PlateList`/`PlateListEntry`, `MatchEvidence`, `PassbackStatus`,
`LaneCameras`, `EnforcementPolicy`, `Signage`, `Appeal`, `Alert`,
`OccupancyHistoryPage` buckets, `TollTransaction`,
`ValetTicket`/`ConditionReport`, `CredentialDigest`, and all of
charging (experimental).

### Code lists needing a registry anchor in ISO

| Code list | APX registry today | Used by |
| --- | --- | --- |
| Access denial reasons | `apx-access-denial-reasons` | AccessEvent |
| Device states | `apx-device-states` | DeviceStatus |
| Credential status, media form | inline enums | Credential lifecycle |
| Session end reasons | `apx-session-end-reasons` | Session closure |
| Violation types | `apx-violation-types` | Violation |
| Violation status | inline enum | Violation |
| Notice kind, delivery method | implementer code lists (no registry yet) | Notice |

## Open questions

### Decided

- **Equipment types (2026-10-14).** Devices use APDS
  `EquipmentTypeEnum` names only, and we do not create an APX device-type
  registry. That enum has no gate, barrier, LPR camera, ticket dispenser
  or intercom; its only lane-relevant values are `paymentMachine`,
  `tollTerminal`, `dsrcReceiver`, `electricChargingStation` and `other`.
  So rather than typing lane devices as `other`, we will ask for the
  missing values to be added to `EquipmentTypeEnum` itself. This is
  [Part B of the APDS change requests](apds-change-requests.md#part-b--additions-apds-could-consider).
  Until then, APX device fields keep referencing `SupplementalEquipment`
  without setting an equipment type.
- **Device-state source (2026-10-15).** APDS 4.1 defines
  `RefillPointStatusEnum` (Data Dictionary A.3.53, on `RefillPoint.status`)
  for refill points only, and neither appears in `apds-api-4.1.yaml`.
  APDS has no general equipment status list. `apx-device-states` follows
  that enumeration's style and shares four of its values (`available`,
  `occupied`, `inoperative`, `unknown`); the spec, Parts 6 and 11 say so.
  The values are proposed to ISO as a code list (above).

- **Signage sits in Place (2026-10-14),** under Layout/Structure/Equipment,
  not in Enforcement. It stays in Tier 2.

### Still open

1. **Proposed-only required attributes.** In the Violation core, the
   shortlist flattens `detection.detectedTime` to the top level and makes
   `noticeNumber` and `issuedTime` required on every notice. APX itself
   requires them only on import. That is fine for ISO, but APX would
   need a matching tightening.
