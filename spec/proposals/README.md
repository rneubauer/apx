# Proposed additions to the APDS data model

This folder is the single source for the data elements and enumerations
APX asks APDS to add to the APDS data model (ISO TS 5206-1). It contains
data only: no routes, scopes, delivery or command workflow. Those stay in
the APX API, which is the preferred implementation spec built on APDS.

The committee documents in [`docs/apds-submission/`](../../docs/apds-submission/README.md)
are generated from these files by `node tools/build-apds-submission.mjs`.
Run it with `--check` to fail when the generated documents are stale, as
`npm test` does.

## Files

| File | What it holds |
| --- | --- |
| `apds-additions/<domain>.yaml` | The proposed classes, attributes, associations and enumerations for one APDS domain |
| `apds-4.1-vocabulary.json` | Names only (packages, classes, datatypes, enumeration values) from the APDS 4.1 Data Dictionary, used to check that every type resolves and that nothing proposed already exists |
| `../../docs/apds-submission/src/*.md` | Hand-written prose (overview, information-model narrative, use cases) stitched into the generated documents |

## Format

The fields mirror the columns of the APDS 4.1 Data Dictionary, so the
generated tables read like APDS's own.

```yaml
domain: Session            # APDS domain, or a new one (Enforcement, Operations)
order: 6                   # position in the documents
summary: >-                # one paragraph: what this domain adds and why
  ...
packages:
  - name: Session          # APDS UML package (existing) or a new package
    location: D2Payload/Extension/Parking/Session
    status: existing       # existing | new
    classes:
      - name: SessionClosure        # UpperCamelCase
        change: new                 # new | extend (extend = add to an existing APDS class)
        designation: Session closure
        definition: How and why a Session ended.
        stereotype: D2Class         # D2Class | D2Identifiable | D2VersionedIdentifiable
        abstract: false
        parent: null                # specialization parent, e.g. Session.Segment
        level: B                    # DATEX II / APDS extension level: B (compatible) or C
        tier: 1                     # 1 propose now, 2 proven in APX, 3 for discussion
        apx: SessionClosure (APX Part 5 §5.8)
        rationale: One sentence on what this lets two parties exchange.
        attributes:
          - name: endReason         # lowerCamelCase
            designation: End reason
            definition: Why the Session ended.
            multiplicity: 0..1      # m..n, n may be *
            type: Session.SessionEndReasonEnum
        associations:
          - end: closure
            designation: Closure
            definition: Closure for the associated Session
            multiplicity: 0..1
            target: Session.SessionClosure
    enumerations:
      - name: SessionEndReasonEnum
        change: new                 # new | extend (extend = add values to an existing APDS enumeration)
        designation: Session end reason
        definition: Why a Session ended.
        tier: 1
        apx: registry apx-session-end-reasons
        rationale: ...
        values:
          - name: exitObserved
            designation: Exit observed
            definition: An exit observation closed the Session.
```

Rules the generator enforces:

- Every `type` and `target` is `Package.Name`, where `Name` is an APDS 4.1
  datatype, class or enumeration (per the vocabulary) or something proposed
  in this folder. A reference may name its target class in parentheses, as
  APDS does: `PkCommon.VersionedReference (Right.AssignedRight)`.
- `change: new` names must not already exist in APDS 4.1. `change: extend`
  names must exist, and their new attributes or values must not.
- Multiplicities match `m..n`. Names use the APDS casing rules.
- Each proposed name is defined once across all files.
