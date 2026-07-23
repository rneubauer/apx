# Extending APX — Partner/Vendor Guide

APX is built to be extended the way it extends APDS. The normative rules are
in the written standard Part 3 §3.3 and Part 10; this is the practical tour.

## Your namespace

Pick a short lowercase namespace (your company): `acmecorp`. Then:

| Surface | Pattern | Example |
|---|---|---|
| Extension keys | `apds-ext:acmecorp:<class>@<M.m>` | `apds-ext:acmecorp:loyalty@1.0` |
| Endpoints | `/apx/x/acmecorp/…` | `/apx/x/acmecorp/loyalty/balances` |
| Event topics | `acmecorp.<domain>.<event>.vN` | `acmecorp.loyalty.tier.changed.v1` |
| Code lists | your own UserDefinedCodeList JSON | published at your locator URL |

## The three extension moves

1. **Decorate** — attach structured data to any APX resource or APDS entity
   via its `extensions` container. Servers MUST preserve your keys on
   round-trip (conformance-tested), so decorations survive intermediaries.
2. **Extend vocabularies** — where a field is code-list-typed (alert types,
   command types, device states), publish your own UserDefinedCodeList and
   reference it via `codeListId`. Never re-mean an `apx` registry value.
3. **Add a domain** — new endpoints under `/apx/x/<ns>/`, topics under
   `<ns>.`, your own conformance class. The sandbox's own
   `/apx/x/sandbox/devices/{id}/state` is a working example.

## What gets you rejected

- Unregistered keys outside `extensions` containers.
- Squatting `apx.` topics, `/v1` paths, or the `apx` namespace.
- Changing semantics of existing fields/values.
- Redefining anything APDS or APX already models (identity, money,
  timestamps, references, place hierarchy).

## The adoption path

Prove a vendor extension in production, propose it to the working group, and
it gets renamed into the `apx` namespace in the next edition — your vendor
key stays valid as a documented alias for one deprecation window
(Part 3 §3.3 rule 7).
