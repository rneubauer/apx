## Data specification permission and security

As with APDS, this document set does not define security or permission rules.
Access to data remains under the control of the Distributing Party, which
decides what each Receiving Party may see.

Several of the APX extensions in Annex A carry personal data: plate reads, access events,
violations, notices, appeals and customer service records. Parties
exchanging them should apply the data protection law of their
jurisdiction, share only what the receiving purpose needs, and agree how
long records are kept. APX keeps personal attributes optional
wherever the element still makes sense without them.

## Relationship to the APX API

The APX API is the extension specification that APX maintains on top of
APDS, outside ISO. It defines the APX data elements and how they are
requested, delivered, changed and secured: routes, change feeds, signed
event delivery, discovery, scopes, and the workflow for commands such as
opening a gate. It is not part of the request.

APX carries every extension in Annex A today as an APDS extension under
the generic extension mechanism introduced in APDS 4.1 (Use Case Document
§C.2.5), or as an APX resource. If APDS ever adopts an element, the APX
API moves to the APDS form in its next release and retires its own, so
the two never disagree.

## Next steps

We would be grateful for the working groups' views on:

1. The corrections: whether the filed errata can be taken into the next
   APDS release, and whether the group would like the C-015 to C-026
   drafts filed as issues, as one combined issue, or through the Data
   Dictionary process.
2. The five `EquipmentTypeEnum` values: whether they suit the group, and
   whether any name should change.

Annex A needs no decision. We would simply welcome hearing if any
extension there looks useful for a later edition.

We are glad to prepare UML model changes, data dictionary entries or pull
requests in whatever form the Alliance prefers.

*Contact: rneubauer@umojo.com*
