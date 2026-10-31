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
   APX's own decorations (Part 4 §4.3) show the pattern: `devicestatus`,
   `lane-cameras`, `session-detail`, `payment-detail`, and the Part 26 set
   that describes a site — `equipment-detail`, `camera`, `external-ids`,
   `place-operations`. Decorate beside them; never redefine them.
2. **Extend vocabularies** — where a field is code-list-typed (alert types,
   command types, device states), publish your own UserDefinedCodeList and
   reference it via `codeListId`. Never re-mean an `apx` registry value.
3. **Add a domain** — new endpoints under `/apx/x/<ns>/`, topics under
   `<ns>.`, your own conformance class. A vendor `acme` adding device
   control would publish e.g. `/apx/x/acme/devices/{id}/state`.

## Your own screens (UI launch)

You do not need an extension to put your own web screens in front of an
agent. Part 25 lets any implementation offer them as **surfaces**, so a
call-center or operations console can open your screen beside its own:

- **List them.** Name each screen by an `apx-ui-surfaces` value
  (`lane.console`, `violation.appeal`, `place.console`, …) and list it in
  `uiSurfaces[]` in discovery, with its display modes, launch modes, the
  places it covers and the actions it reports back (Part 25 §25.1).
- **Log the agent in for them.** The host launches the screen by a
  single-use handshake URL or a signed token; the agent never sees your
  login page or holds your credentials (§25.2, §25.6).
- **Report back what happened.** An action with an APX operation behind
  it (open a gate, issue a lost ticket, refund) MUST produce that
  operation's own record and events, tied to the launch's
  `correlationId`. Anything else is recorded as a `UiActionRecord` on
  the launch (§25.4). An action done only inside your screen, and never
  reported, is the one thing UI launch rules out.

A screen that fits no listed surface is a new `apx-ui-surfaces` entry:
propose it through the adoption path below rather than inventing a name.
The mock vendor screen in the simulator (`packages/simulator/ui/vendor.html`)
shows the whole round trip.

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
