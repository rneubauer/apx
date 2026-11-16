## Introduction

Thank you to the Alliance for Parking Data Standards and to everyone who
has worked on APDS. APX (APDS Parking eXtensions) is an open parking API
built on APDS 4.1, which ISO has adopted as ISO TS 5206-1. APX exists
because APDS gave the industry a shared model to build on.

**Our request is small.** We ask for the corrections to APDS 4.1 that we
have already reported or drafted, and for five new values in
`EquipmentTypeEnum`. Both are set out in the next section, as
suggestions for the working groups to consider.

**APX works today without any change to APDS.** APX uses APDS 4.1 exactly
as published. Where it needs data APDS does not have, it carries that
data in the APDS extension container (`apds-ext:apx:*`) or in its own
resources, under the APDS rules for extending the model. None of the
requests here blocks APX.

**Everything else is offered for later.** The other data elements APX
has built are described in an informative annex, in the APDS document
format, in case the working groups find any of them useful in a future
edition. The annex makes no request. APX remains the extension
specification, outside ISO, and it moves to the APDS form of any element
APDS later adopts.

### Purpose

To give the APDS working groups, in the same form as the APDS 4.1
documents, a short request they can review quickly, and, separately, a
complete description of the APX extensions should they ever wish to
adopt any of them.

### Background

APX began as an open, additive companion to APDS 4.1. It reuses every
APDS construct as published and adds only what APDS leaves out. APX has
been shared with the APDS committee. Following discussion, the work is
arranged so that the root APDS model is left alone:

- **The request (this document set, first section).** Corrections to
  APDS 4.1 and five `EquipmentTypeEnum` values. If adopted, the values
  would sit in the APDS data model, and so in a future revision of
  ISO TS 5206-1.
- **APX, kept outside ISO.** The APX data elements, routes, message
  flows, delivery, security and command workflow stay in the APX
  extension specification built on APDS. The data elements are described
  in the annex for information only.

Every element in this document set is already exercised in the APX
reference implementation and its published test scenarios.

### Guiding principles

The request and the annex follow the APDS guiding principles and these
additional rules:

1. **APDS first.** Where APDS 4.1 already defines a class, attribute or
   value, it is used as it is. A proposal is made only where nothing in
   the APDS 4.1 Information Model or Data Dictionary fits.
2. **Data, not interface.** Only what is exchanged is proposed. How it is
   requested, delivered or secured stays out of the data model.
3. **Small and mostly optional.** Each new class carries its identity and
   the one or two attributes without which it means nothing. Everything
   else is optional, so a Distributing Party sends only what it has.
4. **Open code lists.** Where values vary by market (reasons, types,
   states), the enumeration lists common values and allows `other`, and
   an external code list may extend it, as APDS already does for vehicle
   types and occupancy levels.
5. **Compatible extensions.** Additions to existing APDS classes are
   written as Level B extensions under the APDS rules for extending the
   model (Information Model, "Extending the APDS Model"), so a valid
   extended instance is always a valid APDS 4.1 instance.
6. **Vendor neutral.** Nothing proposed favours one supplier, technology
   or business model.
7. **Ask for the minimum.** Only corrections, and the few values a lane
   needs to be typed in APDS terms, are requested. Everything else stays
   in APX.

### Technical documentation

This document set mirrors the APDS 4.1 technical documentation:

- **Overview (this document):** what we ask of APDS, then, in Annex A,
  what each APX extension is for and the benefit of sharing it.
- **Information Model:** the request, then the APX extensions by domain,
  with diagrams showing where they attach to the existing APDS model.
- **Data Dictionary:** the definition of every value requested and of
  every APX extension, in the table format of the APDS 4.1 Data
  Dictionary. Each entry says whether it is requested or offered for
  later.
- **Use Case Document:** worked examples showing the data in use,
  continuing the numbering of the APDS 4.1 Use Case Document.
