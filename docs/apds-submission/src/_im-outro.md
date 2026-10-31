## Conformance with the APDS extension rules

The proposals have been checked against the requirements in "Extending
the APDS Model" in the APDS 4.1 Information Model:

- Additions to existing APDS classes and enumerations add optional
  content only and do not alter any existing multiplicity, type,
  definition or ordering (requirements 2, 5, 7 and 8).
- No APDS 4.1 class or enumeration is made a component or subclass of a
  proposed one in a way that would break existing instances
  (requirements 5, 7, 8 and 11).
- Values proposed for existing enumerations are new names only; none
  repeats or redefines an existing value (requirement 10).
- New domains introduce new root concepts and are marked Level C.
- The one suggested change to an existing multiplicity
  (`VehicleAncillaryIdentification.country`) sits outside these additions
  and is offered separately.

Each proposed type resolves either to an existing APDS 4.1 datatype,
class or enumeration, or to another proposed element. This is checked
automatically against the names in the APDS 4.1 Data Dictionary each
time the documents are built.

## Glossary

| Term | Meaning |
| --- | --- |
| APX | APDS Parking eXtensions: the companion specification whose data needs are proposed here |
| APX API | The APX implementation specification (routes, delivery, security); informative, not proposed |
| Distributing Party | The party that holds and sends the data (as in APDS) |
| Receiving Party | The party that receives the data (as in APDS) |
| External code list | A list of values published outside the model that extends an enumeration for a market or deployment |
| Level B extension | A compatible extension: every valid extended instance is a valid core instance |
| Level C extension | An extension that adds new root concepts and is not required to be compatible |
| Tier | The suggested order in which the working groups might take the proposals |

## References

- APDS Overview, Information Model, Data Dictionary and Use Case Document,
  version 4.1 (14 January 2026), Alliance for Parking Data Standards
- APDS API Specification 4.1 (`apds-api-4.1.yaml`)
- ISO/TS 5206-1:2023, Parking — Part 1: Core data model
- EN 16157-1:2018, Intelligent transport systems — DATEX II data exchange
  specifications for traffic management and information — Part 1: Context
  and framework
- APX specification and test scenarios: <https://github.com/rneubauer/apx>
