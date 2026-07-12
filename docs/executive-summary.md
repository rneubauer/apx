# APX — APDS Parking eXtensions

### Executive Summary

**One API for parking operations — built on the industry's data standard, adding what it leaves out.**

---

## The problem

The parking industry finally has a shared data language: **APDS 4.1** (Alliance for Parking Data Standards — IPMI, BPA, EPA; published internationally as ISO/TS 5206-1). It defines what a Place, Session, Rate, Right, and Observation *are*, and an API to exchange them.

But APDS deliberately stops at data exchange. It does not define:

- **Real-time operations** — vending a gate, issuing a lost ticket, pushing a rate to a lane, applying a validation
- **Alerting** — device faults, lane blockages, occupancy thresholds, enforcement exceptions
- **Reliable push delivery** — its webhook subscription exists, but signing, retries, and delivery format are left "per-project"
- **Security** — auth and permissions are explicitly the implementer's problem

The result: every PARCS, LPR, tolling, permitting, and reservations vendor still builds one-off integrations for exactly these things. Call centers and management platforms integrate each vendor separately, again and again.

## The solution

**APX** is an open, additive companion standard to APDS 4.1. One API that all vendors implement once:

- **APDS-first by design.** Wherever APDS defines a route, schema, or convention, APX uses it verbatim — the official APDS spec is embedded unmodified and integrity-checked. **A plain APDS 4.1 client works against an APX server without any changes.**
- **APX adds only what APDS lacks**, using APDS's own official extension mechanisms:

| Capability | What APX adds |
|---|---|
| **Data sync** | Full/Change updates, tombstones, gapless cursor change-feeds on APDS's own routes |
| **Push delivery** | Signed webhooks (HMAC), a normative retry schedule, delivery audit ledger, and live streaming (SSE) |
| **Control** | A command plane: vend gate, lost ticket, push rates, apply validations, device state — idempotent, perishable, fully audited |
| **Call-center support** | Lane inquiry "screen-pop": the ticket in the machine, amount due, plate photo, monthly-credential history |
| **Alerts** | Operational alerting with open taxonomies and severity filtering |
| **Discovery** | Each connected credential can ask the API exactly what it may do — and the answer is contractually accurate |
| **Business domains** | Accounts & payments (incl. accounting write-back), LPR plate↔ticket lookup, reservations, pooled permits, tolling with disputes |

## Built for multi-vendor adoption

- **Conformance classes.** Vendors implement only the classes they need (`apx-data` and `apx-events` are the base; control, alerts, tolling, etc. are optional) and advertise them at a standard discovery address. A free, automated **conformance harness** verifies any implementation — "implements APX" has an operational meaning, not a marketing one.
- **A governed extension path.** Every partner gets its own namespace for proprietary fields, endpoints, and events without breaking anyone else. Proven vendor extensions have a defined path into the core standard.
- **Versioning discipline.** Additive-only changes within a major version; published deprecation windows.
- **Open licensing.** MIT — free to implement, no gatekeeper.

## Status

**v1 draft complete and running.** The standard ships as three artifacts, all in one repository:

1. **The specification** — machine-readable OpenAPI 3.1 (imports directly into Postman/Swagger) plus a 17-part written standard
2. **A reference implementation** — a runnable sandbox demonstrating every domain end-to-end, including a scripted call-center demo (screen-pop → validate → vend gate → device fault → automatic alert)
3. **The conformance harness** — the self-certification tool partners run against their own servers

All automated checks pass: the full test suite, spec validation, and 14/14 conformance checks.

> **Want the full picture?** The companion [APX API Overview](apx-overview.md)
> walks every route in plain language with the design rationale — written so
> a reader who has never opened the APDS standard needs nothing else.

## What we're asking of partners

1. **Review** the specification and written standard (a working sandbox is available to try today)
2. **Pilot** one conformance class against your platform — most vendors already have the APDS-shaped data
3. **Join the working group** to shape v1.x: your feature requests enter through the standard's extension process, not one-off integrations

---

*APX is stewarded by **Umojo** (contact: Rick Neubauer, rneubauer@umojo.com) and designed for shared industry governance. The APDS specification is © Alliance for Parking Data Standards, MIT-licensed; APX is an independent companion standard.*
