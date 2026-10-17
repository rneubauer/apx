## Introduction

This data dictionary gives the definitions and characteristics of every
class, attribute, association role, enumeration and external code list
that the APX API defines. It is generated from the normative OpenAPI
document, `spec/dist/apx-v1.yaml`, each time the documents are built, so
it always matches the API.

It follows the layout of the APDS 4.1 Data Dictionary:

- **A.1** is ordered by package. APX has one package per module. Each
  package lists its classes, specializations, associations and
  attributes.
- **A.2** lists the datatypes.
- **A.3** lists the enumerations alphabetically.
- **A.4** lists the external code lists (APX registries) with every entry.
- **Annex B** lists the APDS 4.1 classes APX carries, and says where the
  APX overlay adds to or corrects them.
- **Annex C** links each APX class to the data element proposed from it
  to APDS.

APDS 4.1 classes are not redefined here. Where an APX member uses one,
its type names the APDS domain and class (for example
`Session.Session`), and its definition is in the APDS 4.1 Data
Dictionary.

### How to read the tables

The tables use the columns of the APDS 4.1 Data Dictionary, with three
additions for APX:

1. **Class name:** the symbolic name (UpperCamelCase) of the class, as
   it appears in the OpenAPI document.
2. **Association end / Attribute name:** the symbolic name of the member.
   A member of an unnamed structure is written `owner.member`.
3. **Designation:** the name in natural language.
4. **Definition:** the definition, taken from the OpenAPI document. Where
   the document gives none, the definition of the referenced class is
   used, or the wording APX uses for the same member elsewhere. A
   definition marked ‡ was derived from the member's name because the
   API gives no description. A definition marked † was written by the
   editors from the APX standard text because the API gives none. Both
   marks show where the OpenAPI descriptions should be filled in, so that
   a later edition can drop the marks. An enumeration value shown with
   "—" has no definition yet.
5. **Kind:** `class`, `union` (one of several shapes) or `enumeration`.
6. **Multiplicity:** written m..n, as in APDS. m is 0 for optional and 1
   or more for mandatory; n is a number or `*`.
7. **Target / Type:** the class, datatype or enumeration of the member,
   written `Domain.Name` for APDS 4.1 types and `Package.Name` for APX
   types. "code list" names the APX registry whose values the member
   takes.
8. **Notes (APX):** `read-only` (set by the server), `write-only`
   (accepted on input, never returned), `nullable` (may be sent as null)
   and `deprecated`.
9. **APDS status (APX):** `APX only` when the class stays in the APX
   specification, or the APDS element proposed from it and its tier (see
   06 Requests to APDS).
