## Data specification permission and security

As with APDS, these proposals do not define security or permission rules.
Access to data remains under the control of the Distributing Party, which
decides what each Receiving Party may see.

Several proposed elements carry personal data: plate reads, access events,
violations, notices, appeals and customer service records. Parties
exchanging them should apply the data protection law of their
jurisdiction, share only what the receiving purpose needs, and agree how
long records are kept. The proposals keep personal attributes optional
wherever the element still makes sense without them.

## Relationship to the APX API

The APX API is the implementation specification that APX maintains on top
of APDS. It defines how the data described here is requested, delivered,
changed and secured: routes, change feeds, signed event delivery,
discovery, scopes, and the workflow for commands such as opening a gate.
It is not part of this proposal.

Until APDS adopts an element, the APX API carries it as an APDS extension
under the generic extension mechanism introduced in APDS 4.1 (Use Case
Document §C.2.5). When APDS adopts an element, the APX API moves to the
APDS form in its next release and retires its own, so the two never
disagree.

## Next steps

We would welcome the working groups' views on:

1. Whether the Tier 1 proposals can be taken into the next APDS release.
2. Whether the two new domains, Enforcement and Operations, are best
   added as new domains or folded into existing ones.
3. The values proposed for each new enumeration, especially where they
   differ by country.

We are glad to prepare UML model changes, data dictionary entries or pull
requests in whatever form the Alliance prefers.

*Contact: rneubauer@umojo.com*
