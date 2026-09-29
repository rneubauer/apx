**Suggested title:** Question: is an identifiable `RightHolder` class intended? `AssignedRightHolder` has no identifier

---

*Type: question / suggestion — this may well be a deliberate modelling choice.*

## Summary

The APDS Information Model describes the RightHolder as an entity in its
own right: "a specific entity [e.g., individual, corporation, and
vehicle] that is issued a RightSpecification … via an AssignedRight",
which "may have multiple vehicles" and "multiple users associated to one
or more credentials". In the OpenAPI document the holder appears only as
`AssignedRightHolder`, an object embedded in each AssignedRight whose one
property is `credentials`. It has no `id`, so nothing can reference a
holder: two AssignedRights issued to the same company cannot say they
share a holder, and `Eligibility.rightHolders` can only list credentials,
not the holders themselves. We may be missing how APDS intends holders to
be identified, and raise it in case a class was meant to be added.

## Where

APDS Information Model 4.0 (June 7, 2022), Right domain, p. 42, item 6
("RightHolder: this is a specific entity …").

`apds-api-4.1.yaml` (at `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b`):

- `components.schemas.AssignedRightHolder`, line 6806 — properties:
  `credentials` only; no `id`.
- `components.schemas.AssignedRight`, line 6750 — `rightHolder:
  $ref AssignedRightHolder` (embedded, required).
- `components.schemas.Eligibility`, lines 6299–6303 — `rightHolders`,
  described as "a list of RightHolders that are automatically eligible
  for the specific RateTable", items `AssignedRightHolder`.

No schema named `RightHolder` exists, and no route serves holders.

## Why it matters

Permits, monthly accounts, fleets, and validations all need to point at
"the customer" across several AssignedRights and Sessions. With no
identifier, each system invents its own, and a `Reference` to a holder
has no APDS `className` to carry.

## Impact

Low for single-right use; moderate for anything that groups rights,
payments, or sessions by customer.

## Suggested fix

Two options, either of which would work for us:

1. Add an identifiable `RightHolder` (with `id`, and optionally
   `version`) and let `AssignedRight.rightHolder` and
   `Eligibility.rightHolders` be a `Reference` to it, keeping the embedded
   credentials where they are today; or
2. Add an optional `id` to `AssignedRightHolder`, so the same holder can
   be recognised across AssignedRights.

## APX workaround

APX references the holder as `{"id": "<local id>", "className":
"RightHolder"}`, using the Information Model's class name, and treats the
id as local to the issuing implementation (APX Part 14 §14.1a). APX
defines no schema for the holder itself, so an APDS definition, when one
exists, replaces the convention with no change to the wire format beyond
the class it points at.

---

*Found while building APX, an additive companion standard to APDS 4.1. Thank you for all the work that has gone into APDS — happy to help with a fix if that is useful.*
