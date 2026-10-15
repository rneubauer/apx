## Introduction

This document describes the data concepts APX proposes for the APDS data
model, and how they relate to the existing APDS 4.1 classes. It follows
the structure of the APDS 4.1 Information Model: for each domain, a
narrative, a class diagram, the enumerations and any external code lists.
The full definition of every class, attribute, association and value is
in the companion Data Dictionary.

The data concepts are modelled in UML in the same form as APDS, which
aligns with Part 1 of the CEN DATEX II 16157 series (EN 16157-1).

### How the proposals are expressed

Each proposal is one of four kinds:

| Kind | Meaning |
| --- | --- |
| New class | A class APDS has nothing for, placed in an existing or new package |
| Additions to an APDS class | New attributes or associations on a class APDS already defines |
| New enumeration | A new list of values |
| New values for an APDS enumeration | Values added to a list APDS already defines |

Additions to existing APDS classes are Level B extensions under the APDS
rules for extending the model: they add optional content only, never
change an existing multiplicity, definition or type, and never make an
existing APDS class the component of a new one. A valid extended instance
is therefore always a valid APDS 4.1 instance. Classes in the two new
domains, Enforcement and Operations, are marked Level C because they
introduce new root concepts.

One suggestion does change an existing multiplicity: making
`VehicleAncillaryIdentification.country` optional. It is not part of
these additions. It is described in the Observation section and offered
separately, with the other suggested changes to APDS 4.1.

In the diagrams, classes that already exist in APDS 4.1 are marked
`<<APDS>>`. Everything else is proposed.

### Tiers

| Tier | Meaning |
| --- | --- |
| 1 | Propose now: data every access control, enforcement or LPR system already holds |
| 2 | Proven in APX and widely useful: propose next |
| 3 | For discussion: still settling, or possibly outside parking data |

### Consistency notes on APDS 4.1

While checking each proposal against APDS 4.1, we compared the
Information Model and Data Dictionary with the published API document
(`apds-api-4.1.yaml`). A few elements defined in the Data Dictionary do
not yet appear in the API document, for example `RefillPointStatusEnum`
with `RefillPoint.status`, and some `EquipmentTypeEnum` values such as
`lprCamera`. These proposals treat the Data Dictionary as authoritative
and do not propose anything it already defines. The differences are
offered to the Alliance separately, as suggestions, alongside the
corrections already filed against the API document.
