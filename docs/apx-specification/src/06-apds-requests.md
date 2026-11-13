# APX Requests to APDS

*APX Specification · APX 0.14.0 · built on APDS 4.1 (2026-01-14) · Draft*

## Introduction

Thank you to the Alliance for Parking Data Standards and to everyone who
has worked on APDS. APX is an open parking API built on APDS 4.1, which
ISO has adopted as ISO TS 5206-1. APX exists because APDS gave the
industry a shared model to build on.

**Our request is small.** We leave the root APDS model as it stands and
ask for two things only:

1. **Corrections to APDS 4.1 itself:** the fourteen errata already filed
   on `parkingdata/spec` (Part A), and twelve differences between the
   APDS 4.1 Data Dictionary and the API document, not yet filed (Part B).
2. **Five values for `EquipmentTypeEnum`:** `barrier`, `gate`,
   `ticketDispenser`, `intercom` and `exitVerifier` (Part C). With the
   existing value `paymentMachine`, they let an entry lane and an exit
   lane both be typed with APDS names alone.

Each is offered as a suggestion, for the committee to take up if it
agrees.

**APX works today without any change to APDS.** APX vendors APDS 4.1
byte-for-byte and checksum-guarded (`spec/vendor/apds/4.1/`), and never
edits it. Where APX needs something APDS does not yet have, it works
around the gap in its own overlay
(`spec/openapi/overlays/apx-data-overlay.yaml`), in an `apds-ext`
extension, or in an APX code list. Each workaround is narrow and points
at the request it stands in for.

**Everything else is offered for later.** The other data elements APX
has built, and a few other ideas, are listed in the Appendix at the end
of this document. The Appendix is informative and makes no request. APX
already carries every item in it, as an `apds-ext:apx:*` extension or an
APX resource, so APX does not need any of them in APDS to operate. APX
remains the extension specification, outside ISO.

If APDS ever adopts any item, APX removes its own form in the same
release. Wherever APDS standardizes something APX currently fills in,
the APDS construct wins: the next APX edition adopts it verbatim and
deprecates its own (APX Part 3 §3.3(8)).

Each item says what kind it is:

| Kind | Meaning |
| --- | --- |
| **Correction** | The schema cannot validate what the document describes. |
| **Omission** | Something APDS describes, in the API document or the Data Dictionary, is missing from the API document. |
| **Suggestion** | A consistency or modelling idea. It may well be intentional as it stands. |
| **Addition** | New data APDS does not have today. |

We are glad to prepare pull requests or committee text for any item the
group would like to take up.

## Summary

| Part | What it covers | Correction | Omission | Suggestion | Addition | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| | **What we ask of APDS** | | | | | |
| A | Corrections to the API document (errata 001 to 014, filed) | 7 | 4 | 3 | – | 14 |
| B | Data Dictionary items missing from, or typed differently in, the API document, and one request-body omission (C-015 to C-026, not yet filed; C-025 tentative) | – | 12 | – | – | 12 |
| C | Five values for `EquipmentTypeEnum` | – | – | – | 1 | 1 |
| | **Total requested** | **7** | **16** | **3** | **1** | **27** |
| | **Appendix: offered for later, no request** | | | | | |
| X.1 | New values for three other APDS enumerations | – | – | – | 3 | 3 |
| X.2 | New data elements (classes, attributes, enumerations) | – | – | – | 123 | 123 |
| X.3 | Other suggestions | – | – | 5 | – | 5 |

Notes on the counts:

- Erratum 007 is counted as an Omission; it also carries a small
  consistency question. Erratum 014 is counted as a Suggestion; it is
  phrased as a question.
- Part C and the Appendix entries X.1 and X.2 together are the 127
  proposals in `spec/proposals/apds-additions/`: 49 new classes, 12
  additions to existing APDS classes, 62 new enumerations and 4 sets of
  new values for existing APDS enumerations. Only one of them, the
  `EquipmentTypeEnum` values, is marked `ask: minimal` and requested.
  The X.2 tables below also repeat the three X.1 rows.
- Ready-to-file drafts of the Part B items and of the Part C change
  request are in [errata drafts](../errata/drafts/README.md). Nothing
  there has been filed.

## What we ask of APDS

Parts A to C are the whole request.

## Part A: Corrections to the APDS API document

Fourteen items, all filed on `parkingdata/spec` (#33–#35, #37–#47) with
the relevant snippet and a minimal suggested fix. Each was checked
against `parkingdata/spec` at commit `e10dcfc`, which is byte-identical to
the published 4.1 document. Full reports are in the
[APX errata folder](../errata/README.md); the one-page version for the
working group is [Requested APDS changes](../apds-change-requests.md).

| # | Issue | Kind | Requested change | APX workaround today |
| --- | --- | --- | --- | --- |
| [001](../errata/001-reference-schema-unsatisfiable.md) | [#33](https://github.com/parkingdata/spec/issues/33) `Reference` requires `id` and `className` but allows at most one property | Correction | Remove `minProperties`/`maxProperties` from `Reference` | Validators relax the two constraints |
| [002](../errata/002-observations-example-invalid.md) | [#34](https://github.com/parkingdata/spec/issues/34) `POST /observations` `single-element` example matches neither `oneOf` branch | Correction | Add `id`/`version` to the example, or make them server-assigned | Lint exemption scoped to this one example |
| [003](../errata/003-observation-discriminator-typo.md) | [#35](https://github.com/parkingdata/spec/issues/35) Discriminator key spelled `ObvservationSet` | Correction | Rename to `ObservationSet` (third-party PR [#36](https://github.com/parkingdata/spec/pull/36) is open) | None needed; tolerant tooling resolves it |
| [004](../errata/004-ratetable-phantom-required.md) | [#37](https://github.com/parkingdata/spec/issues/37) `RateTable` requires `validityStart` and `activeTimes`, which it never defines | Correction | Drop the two entries from `required` | Overlay replaces the list |
| [005](../errata/005-observations-post-no-responses.md) | [#38](https://github.com/parkingdata/spec/issues/38) `POST /observations` declares no responses | Omission | Declare 201/400/409 like the other creates | Overlay declares them |
| [006](../errata/006-observations-discriminator-collision.md) | [#39](https://github.com/parkingdata/spec/issues/39) Wrapper `type` collides with `ObservationElement.type` | Correction | Rename the wrapper discriminator, or use a plain `oneOf` | Overlay uses a plain `oneOf` |
| [007](../errata/007-quotes-post-no-request-body.md) | [#40](https://github.com/parkingdata/spec/issues/40) `POST /quotes` has no request body; `GET /quotes` returns one object | Omission (plus a question) | Declare the request body; confirm the `GET` shape | Overlay adds an optional body |
| [008](../errata/008-referencetoquote-identical-branches.md) | [#41](https://github.com/parkingdata/spec/issues/41) `ReferenceToQuote` is a `oneOf` of two identical branches | Correction | Make the branches distinct and non-empty | No workaround; book with the full `AssignedRight` |
| [009](../errata/009-identifiers-ratetableid-spelling.md) | [#42](https://github.com/parkingdata/spec/issues/42) `Identifiers` requires `rateTableId`, declares `rateTableID` | Correction | Align the spelling | Overlay declares `rateTableId` |
| [010](../errata/010-entities-no-extensions.md) | [#43](https://github.com/parkingdata/spec/issues/43) No entity declares the `extensions` container of Use Case §C.2.5 | Suggestion | Declare `Extensions` once on `VersionedIdentity` | Overlay adds it to 9 entities |
| [011](../errata/011-geojsonobject-no-coordinates.md) | [#44](https://github.com/parkingdata/spec/issues/44) `GeoJsonObject` has no `coordinates` | Omission | Declare `coordinates`, ideally with a `GeoJsonPoint` | Overlay adds `coordinates` |
| [012](../errata/012-native-response-code-irregularities.md) | [#45](https://github.com/parkingdata/spec/issues/45) Response codes on `/rates`, `/rights/assigned/{id}`, `/contacts` differ from their siblings | Suggestion | Align codes (201 on create; 400/404/409 declared) | Overlay adds the missing codes |
| [013](../errata/013-hierarchyelement-subtypes-unmapped.md) | [#46](https://github.com/parkingdata/spec/issues/46) `HierarchyElement` maps 3 of 10 types; `VehicularAccess` unreachable | Omission | Restore the 7 commented-out mappings | Lane fields carried unvalidated |
| [014](../errata/014-rightholder-not-identifiable.md) | [#47](https://github.com/parkingdata/spec/issues/47) No identifiable `RightHolder`; `AssignedRightHolder` has no `id` | Suggestion (question) | Add an identifiable `RightHolder`, or an optional `id` | `className: "RightHolder"` with a local id |

APX Part 1 §1.3 ([Known APDS 4.1 errata](../standard/01-normative-references.md))
records how APX treats each one today.

### 001: `Reference` cannot be satisfied

`Reference` requires both `id` and `className` but declares
`maxProperties: 1`. No object meets both rules, so a strict validator
rejects every `Reference`, including those in the APDS examples.
Suggested fix: remove `minProperties` and `maxProperties`.

### 002: `POST /observations` example

The `single-element` request example omits the `id` and `version` that
`ObservationElement` requires through `VersionedIdentity`, and it does not
match `ObservationSet` either. Suggested fix: add `id` and `version` to
the example, or say that the server assigns them.

### 003: Discriminator typo

The `POST /observations` discriminator mapping spells its second key
`ObvservationSet`, with an extra "v", so the value clients send,
`ObservationSet`, has no entry. Suggested fix: correct the spelling. A
third party has already proposed this one-character fix in PR #36.

### 004: `RateTable` required list

`RateTable` lists `validityStart` and `activeTimes` in `required`, but
neither is a property of `RateTable` or anything it inherits. It looks
like the same kind of leftover from an earlier version that a maintainer
confirmed in issue #32. Suggested fix: remove the two entries.

### 005: `POST /observations` responses

As far as we can tell, this is the only APDS 4.1 operation with no
`responses` member. A camera or PARCS vendor cannot tell whether success
is 200, 201 or 202, or what comes back. Suggested fix: declare
201/400/409, as the other native creates do.

### 006: `POST /observations` type collision

The request wrapper types `type` as `ObservationDataType`
(`ObservationElement`, `ObservationSet`), while `ObservationElement`
types the same property as `CredentialTypeEnum`. Both apply, so no single
observation validates. We may be missing something here. Suggested fix:
rename the wrapper discriminator, or use a plain `oneOf`.

### 007: `POST /quotes` request body

`POST /quotes` has no `requestBody`, so the `QuoteRightRequest` and
`QuoteSessionExtensionRequest` schemas are never referenced. Separately,
and only as a question: `GET /quotes` takes list filters but returns one
object. Suggested fix: declare the request body, and confirm the
intended `GET` shape.

### 008: `ReferenceToQuote` branches

`ReferenceToQuote` is a `oneOf` of `ReferenceQuoteExtension` and
`ReferenceQuoteNew`, which have the same properties and no `required`
members. Every instance matches both, so `oneOf` always fails. Suggested
fix: make the branches distinct, or merge them.

### 009: `rateTableId` spelling

`Identifiers` declares `rateTableID` but requires `rateTableId`. JSON
names are case-sensitive, so the required key is undeclared. Suggested
fix: use `rateTableId`, matching the other APDS identifiers.

### 010: The `extensions` container

The Use Case Document (§C.2.5) defines an `extensions` container with
keys of the form `apds-ext:<namespace>:<class>@<major>.<minor>`, but no
schema in the API document declares it. This may be deliberate, since
open `additionalProperties` already lets it through. Suggestion: declare
it once on `VersionedIdentity`, so the key pattern can be checked.

### 011: `GeoJsonObject` coordinates

`GeoJsonObject` declares `type` and `bbox` but not `coordinates`, so a
`Point` with no position still validates. This may be a deliberate
simplification. Suggested fix: declare `coordinates`, and preferably a
`GeoJsonPoint` for the many places that carry only a point.

### 012: Response codes

Three native operations use different codes from their siblings:
`POST /rates` answers 200 with no 400 or 409; `PUT /rights/assigned/{id}`
declares 201 and no 404; the two `/contacts` reads alone declare 500.
Each may be intentional. Suggestion: align them, or add a short note
saying why they differ.

### 013: `HierarchyElement` mapping

`HierarchyElementTypeEnum` has ten values, but the `HierarchyElement`
discriminator maps only `campus`, `place` and `space`; the other seven
are commented out. A `vehicularAccess` (lane) payload is therefore never
checked against `VehicularAccess`. Suggested fix: restore the seven
mappings, if they were not left out on purpose.

### 014: An identifiable `RightHolder` (question)

The Information Model and the Data Dictionary describe `RightHolder` as
an entity in its own right, but the API document has only
`AssignedRightHolder`, embedded in each `AssignedRight` with no `id`.
Two rights issued to the same holder cannot say so. Suggestion: add an
identifiable `RightHolder`, or an optional `id`. See also C-018 below.

## Part B: Differences between the APDS Data Dictionary and the API document

While checking each APX proposal against APDS 4.1, we compared the APDS
4.1 Data Dictionary (Version Release January 14, 2026) with the published
API document. A few elements defined in the Data Dictionary do not yet
appear in `apds-api-4.1.yaml`. APX treats the Data Dictionary as
authoritative and proposes nothing it already defines.

**The request in this Part is to bring the API document in line with the
Data Dictionary.** We do not ask for any change to the Data Dictionary
itself. All of these are **Candidate, not yet filed upstream**. They are
numbered C-015 onward so they can follow errata 001 to 014 if the group
would like them filed. A draft issue for each is ready in
[errata drafts](../errata/drafts/README.md); C-025 is held there until
its intended type is confirmed.

| # | Data Dictionary | API document today | Requested change | APX workaround today |
| --- | --- | --- | --- | --- |
| C-015 | `RefillPointStatusEnum` (A.3.53, Table A.179) and the attribute `RefillPoint.status` (0..1) | Neither appears; `RefillPoint` has no `status` | Add the enumeration and the attribute | Code list `apx-device-states` follows its style and shares four of its values |
| C-016 | `EquipmentTypeEnum` (A.3.23, Table A.149) includes `lprCamera`, `securityCamera`, `occupancySensor`, `occupancyObjectSensingCamera`, `door`, `doorWithAccessCredential`, `doorWithSecurityReview`, `emergencyExitDoor`, `cargoShippingDoor`, `dropOffLocation` | None of these ten values | Add the ten values | Device references point at `SupplementalEquipment` without an equipment type |
| C-017 | `PaymentTypeEnum` (A.3.46, Table A.172): `base`, `refund`, `surcharge`, `validation`, `Vat` | `payment`, `validation` | Add `base`, `refund`, `surcharge` and `Vat` | `PaymentRecord` alongside `Payment`; code list `apx-payment-line-codes` |
| C-018 | `RightHolder` is a class, stereotype `D2VersionedIdentifiable`, with `holderCredential` and `assignedRight` associations | Only `AssignedRightHolder`, with no `id` | Add `RightHolder` as a versioned identifiable class | `className: "RightHolder"` with a local id (see 014) |
| C-019 | `ServiceFacilityTypeEnum` (A.3.59, Table A.185) includes `currencyExchange` and `transportInterchange` | Neither value | Add the two values | None needed |
| C-020 | `RateLineTypeEnum` (A.3.50, Table A.176) includes `perUnit` | `flatRate`, `flatRateTier`, `incrementingRate` | Add `perUnit` | None needed |
| C-021 | `ElementDescriptorEnum` (A.3.20, Table A.146) includes `garage` | `floorOrLevel`, `row`, `street` | Add `garage` | None needed |
| C-022 | `CredentialTypeEnum` (A.3.17, Table A.143) includes `other` | No `other` | Add `other` | None needed |
| C-023 | `UnitOfMeasureEnum` (A.3.70, Table A.194) includes `kilogrammes`, `pounds` and `gpmi` | No `kilogrammes` or `pounds`; has `gpm` where the Data Dictionary has `gpmi` | Add `kilogrammes` and `pounds`; align `gpm`/`gpmi` | None needed |
| C-024 | Accessibility enumeration (A.3.2, `AccessibilityEnum`) has `accessForPersonsWithDisabilities` and `disabledMarked` | `AccessibilityTypeEnum` has `disabledAccessible` and `disabledMarkedThere` instead | Align the two values | None needed |
| C-025 | `RightSpecification.transferableConditions` reads as `PkCommon.MultilingualString` (tentative; see below) | `boolean` | Confirm the type, and align the API document if a statement was intended | None needed |
| C-026 | `ObservationElement` has an `observationElementRecordUpdate` association (Table A.46), so an Observation can be updated | `PUT /observations/{id}` declares no request body and no 400 | Declare an `ObservationElement` request body and a 400, as on the other `PUT` operations | The data overlay declares both |

### C-015: Refill point status

The Data Dictionary's list of changes from 4.0 to 4.1 includes "Bug
correction - Attribute "status" added to the class "RefillPoint"", typed
`RefillPointStatusEnum` (13 values, from `available` to `unknown`). The
API document's `RefillPoint` schema has no `status`, and the enumeration
is absent. The APX energy extensions (Appendix, X.2) reuse this
enumeration as it stands, so having it in the API document would help.

### C-016: Equipment type values

The Data Dictionary already gives camera, sensor and door values for
`EquipmentTypeEnum`. The API document lists the older set only. With
these values in place, the five lane-equipment values APX suggests in
Part C would complete a typical access lane.

### C-017: Payment type values

The API document's `payment` and the Data Dictionary's `base` carry the
same definition ("Indicates financial payment made"), so they may be two
names for one value. The committee will know which name it prefers. The
API document's own `PaymentLine` description already mentions "base fee,
taxes, surcharges".

### C-018: RightHolder

This is the Data Dictionary side of erratum 014. The Data Dictionary
defines `RightHolder` as versioned identifiable; the API document embeds
the holder without an identifier. Bringing the API document in line
would answer 014.

### C-025: Type of `transferableConditions` (tentative)

In the Data Dictionary's `RightSpecification` attribute table,
"Transferable conditions" is defined as a "statement of the conditions
under which a RightSpecification may be transferred", which reads as
`PkCommon.MultilingualString`, while `transferable` is the
`PkCommon.Boolean`. The API document types both `transferable` and
`transferableConditions` as boolean. The columns of that table are
misaligned in the PDF, so we would be grateful if the group could
confirm the intended types before anything is filed.

### C-026: Request body for `PUT /observations/{id}`

Unlike the other candidates, this one comes from the API document alone.
`PUT /observations/{id}` is described as "update the given Observation",
but it declares no request body, so a client cannot tell from the
document what to send. It also declares no 400, which every other `PUT`
does. It is the same kind of omission as erratum 007 (`POST /quotes`).
APX declares an optional `ObservationElement` body and the 400 in its
data overlay, leaving the vendored document untouched.

### C-019 to C-024: Smaller value differences

These were found by a script that compares every enumeration table in
Data Dictionary section A.3 with the `enum` arrays of the API document,
then checked by hand against the Data Dictionary text. In C-024, the Data
Dictionary's own definition of `barrierFreeAccessible` still mentions
`disabledAccessible`, so the intended names may simply need confirming.

### Not requested

- **Values in the API document but not the Data Dictionary.** A few run
  the other way: for example `HierarchyElementTypeEnum` (five more values
  in the API document) and `UnitOfTimeEnum` (`year`, `month`, `week`).
  We do not ask for any of these to be removed.
- **Enumerations under other names.** Several Data Dictionary
  enumerations appear in the API document under a different name (for
  example `EnergySourceEnum` as `FuelTypeEnum`, `RightTypeEnum` as
  `RightSpecificationTypeEnum`). We do not ask for renames.
- **Classes the API document does not carry.** Some Data Dictionary
  enumerations belong to classes absent from the API document (for
  example `SurchargeTypeEnum` and `RefundTypeEnum`, used by `Surcharge`).
  We have not compared these one by one and make no request about them.

## Part C: Five values for `EquipmentTypeEnum`

This is the one data request. Five values would be added to the existing
APDS enumeration `EquipmentTypeEnum`. Each is a new name only; none
repeats or redefines an existing value. Together with `paymentMachine`
and the camera and door values APDS already has, an off-street site
could type every item on a typical entry lane and exit lane in APDS
terms, rather than as `other`:

- **Entry lane:** `ticketDispenser`, `barrier` or `gate`, `lprCamera`,
  `intercom`.
- **Exit lane:** `exitVerifier`, `paymentMachine` (pay in lane),
  `barrier` or `gate`, `lprCamera`, `intercom`.

<!-- generate:minimal-ask -->

The values come from the APX equipment roles code list
(`spec/registries/apx-equipment-roles.json`), which already uses
`ticketDispenser` and `exitVerifier`. This entry is the only proposal
marked `ask: minimal` in `spec/proposals/apds-additions/place.yaml`. Its
committee text, in the APDS Data Dictionary format, is in
[the APX submission](../apds-submission/03-data-dictionary.md).

## Open questions for the committee

1. **Filing the Part B candidates.** Would the group like C-015 to C-026
   filed as issues on `parkingdata/spec`, as one combined issue, or
   handled within the Data Dictionary process?
2. **Payment type names.** In C-017, are `payment` (API document) and
   `base` (Data Dictionary) the same value, and which name should stay?
3. **Batching the errata.** [Requested APDS changes](../apds-change-requests.md)
   suggests an order: first the items that block validation today (001,
   004, 006, 013), then one-line fixes, then missing declarations, then
   modelling questions. Is that order helpful?
4. **Equipment value names.** Do the five names in Part C suit the
   group, or would it prefer others?

## What APX does in the meantime

APX does not wait for any of these requests. It keeps working on APDS
4.1 as published:

- **The vendored file is never edited.** `apds-api-4.1.yaml` is vendored
  byte-identical and checksum-guarded (Part 0 §0.2, Part 1 §1.1).
- **Errata are handled in an overlay.** Each Part A workaround lives in
  `spec/openapi/overlays/apx-data-overlay.yaml` or in APX tooling, narrowly,
  with a comment naming the erratum. Part 1 §1.3 lists them.
- **Missing data rides in extensions.** Where APDS has no member, APX
  uses the APDS `extensions` container with namespaced, versioned keys
  (`apds-ext:apx:<class>@<M.m>`), for example `session-detail@1.0` and
  `payment-detail@1.0` (Part 10 §10.1).
- **Open values live in registries.** APX code lists are published as
  APDS UserDefinedCodeList documents in `spec/registries/`, for example
  `apx-device-states`, `apx-session-end-reasons` and
  `apx-payment-line-codes` (Part 11).
- **New surfaces live in APX modules.** Alerts, lane control, tolling,
  valet and enforcement are APX conformance classes. Their data elements
  are described in the Appendix, for later adoption only; the routes and
  workflows stay in the APX API.

When APDS adopts any request, APX vendors that release and removes the
matching overlay action, extension or registry entry in the same change,
so the two documents never disagree (Part 3 §3.3(8)).

## Appendix: APX extensions available for later adoption (informative)

This Appendix makes no request of APDS. It lists what APX has built
beyond the request above, in case the working groups find any of it
useful in a future edition. APX already carries every item here, as an
`apds-ext:apx:*` extension on an APDS object, as an APX resource or in
an APX code list, so APX does not need any of them in APDS to operate.
Nothing here needs a decision.

### X.1 New values for three other APDS enumerations

Three more existing APDS enumerations could gain new values. Each value
is a new name only; none repeats or redefines an existing value. They
are offered for later, not requested.

| Enumeration | Domain | New values | Tier | Why | APX today |
| --- | --- | --- | --- | --- | --- |
| `ImageTypeEnum` | Observation | `plateExtended`, `context` | 2 | Recognition engines keep a wider crop around the plate and a scene wider than the overview; consumers could ask for the still they need. | Images listed untyped on `Observation.images[]`, typed as strings on `LprRead.images[]` (Part 13 §13.3c) |
| `RightTypeEnum` (API: `RightSpecificationTypeEnum`) | Right | `valet` | 2 | Lets any APDS consumer, such as an enforcement vendor, tell a vehicle in valet custody from a transient parker. | The valet pass is typed `oneTimeUseParking`; clients learn it is valet from `ValetTicket.assignedRight` (Part 22) |
| `PaymentTypeEnum` | Right | `convenienceFee`, `serviceFee`, `discount`, `energy`, `idle` | 2 | Payment lines could tell fees, discounts and charging costs apart without a bilateral code list. | Code list `apx-payment-line-codes` for `PaymentLine.idCode` (Part 13 §13.6a) |

The value definitions:

- **`plateExtended`:** a crop around the plate wider than the plate
  itself, showing the surrounding bodywork.
- **`context`:** a wide view of the scene around the vehicle, wider than
  the overview.
- **`valet`:** intended for a vehicle placed in valet custody, valid from
  drop-off to handback.
- **`convenienceFee`:** a fee for the convenience of the channel used to
  pay. **`serviceFee`:** a fee for a service other than the right itself.
  **`discount`:** a reduction in the amount charged, other than a
  validation. **`energy`:** a charge for energy delivered to the vehicle.
  **`idle`:** a charge for occupying a charging bay after charging ended.

The `PaymentTypeEnum` values would sit beside the Data Dictionary values
`base`, `refund`, `surcharge`, `validation` and `Vat` (see C-017).

### X.2 New data elements

The data elements are grouped in three tiers, so the working groups
could take them in steps should they wish to. **Tier 1, ready to adopt,**
is data every access control, enforcement or LPR system already holds
and shares: access events, equipment status, credential status, how a
session started and ended, plate read attributes, violations and
notices, and validation redemptions. **Tier 2, proven in APX,** covers
shapes that are stable in APX and widely useful, such as plate lists,
validation programmes, payment outcomes, reservations and permits, valet
custody and alerts. **Tier 3, for discussion,** covers areas that are
still settling, such as electric vehicle charging sessions, or that may
sit outside parking data, such as customer service interactions, or the
comms points through which a parker calls for help.

Additions to existing APDS classes are written as Level B extensions:
they add optional content only, so a valid extended instance is always a
valid APDS 4.1 instance. Two APX domains, **Enforcement** and
**Operations**, introduce new root concepts and are marked **Level C**.
The full committee-format text, mirroring the APDS 4.1 Overview,
Information Model, Data Dictionary and Use Case Document, is in
[the APX submission to APDS](../apds-submission/README.md). The tables
below are generated from `spec/proposals/apds-additions/*.yaml`, the same
source the submission is built from.

<!-- generate:proposal-summary -->

### X.3 Other suggestions

These are not errata and not additions to the data model. Each is a
**Suggestion**, offered for later and not requested. Where APDS ever
covers any of them, APX moves to the APDS form and retires its own.

| # | Suggestion | Why it helps | APX today |
| --- | --- | --- | --- |
| E-1 | Make `VehicleAncillaryIdentification.country` optional (`0..1` instead of `1..1`) | A read whose plate country the engine could not place could still carry make, model and colour, often the reads that most need them | The attributes ride in the APX `detail` decoration and the APDS object is omitted (Part 13 §13.3a(1)) |
| E-2 | Agree the names for two equipment states: `faulted` and `closed` | APX and APDS would use the same words for the same state | Code list `apx-device-states` uses `fault` and `inoperative` |
| E-3 | Event types for access and corrections in `EventTypeEnum` | Subscribers could hear a lane denial or a corrected read through APDS events | APX topics `apx.credentials.access.v1` and `apx.data.observation.updated.v1` (Parts 8, 21) |
| E-4 | `application/problem+json` (RFC 9457) as an error option on native routes | One machine-readable error shape across APDS and APX | Offered when the client sends `Accept: application/problem+json` (Part 5 §5.1a, Part 12) |
| E-5 | A member on `Payment` naming the rate sold | A receiver could tell which rate a payment bought | Decoration `apds-ext:apx:payment-detail@1.0` with `rateSold` (Part 13 §13.6a) |

#### E-1: `VehicleAncillaryIdentification.country`

This is the one suggestion that changes an existing multiplicity, so it
is kept apart from the Level B additions in X.2.
Today a read with no country must omit the whole
`VehicleAncillaryIdentification`. The change relaxes a constraint, so
every instance valid today stays valid. See the Observation section of
[the submission's Information Model](../apds-submission/02-information-model.md)
and [Requested APDS changes](../apds-change-requests.md).

#### E-2: Equipment state names

The `EquipmentStatusEnum` offered in X.2 (Place) reuses
`RefillPointStatusEnum` names where the meaning is the same: `available`,
`occupied`, `blocked`, `faulted` and `unknown`. It uses `closed` for
equipment not operating for a planned reason, such as closed hours or a
maintenance window. APX's current code list says `fault` and
`inoperative` for these two states; APX would adopt whatever names APDS
agrees. For reference, `RefillPointStatusEnum` defines `inoperative` as
"not yet active or it is no longer available (deleted)". The committee
may prefer either pair of names.

#### E-3 to E-5: Interface and payment detail

These came from building APX on the APDS routes. E-3 and E-4 concern the
API rather than the data model, so they are not in the submission, which
describes data only. E-5 is the one part of the payment-detail
suggestion in [Requested APDS changes](../apds-change-requests.md) not
already covered by X.1 (`PaymentTypeEnum`) or X.2 (`Payment` outcomes).

### X.4 Questions for later

Only if the group ever takes up the Appendix:

1. **Enumerations or code lists for open vocabularies.** APX's
   enumerations list common values and allow `other`, extendable by an
   external code list, as APDS already does for vehicle types and
   occupancy levels. Where values vary by market (violation types, end
   reasons, device states), would the group prefer a
   `ReferencedCodeListEntry` seeded with the values instead?
2. **Customer service interactions.** `SupportInteraction` (Operations,
   Tier 3) may lie outside the scope APDS sets itself in its guiding
   principles. APX is equally happy to keep it in its own profile.
3. **Tier order.** Would the group rather take a domain at a time?

Thank you again to the APDS committee for considering these requests.
