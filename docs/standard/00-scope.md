# APX Part 0 — Scope and Overview

**Status:** Draft v0.1 · **Normative unless marked otherwise.** The key words
MUST, MUST NOT, REQUIRED, SHALL, SHOULD, MAY are to be interpreted as
described in RFC 2119 / RFC 8174.

## 0.1 What APX is

APX (APDS Parking eXtensions) is an **additive companion standard** to the
APDS 4.1 API specification (Alliance for Parking Data Standards; core data
model published as ISO/TS 5206-1). APX defines the interoperable API surface
that APDS deliberately leaves out: real-time delivery, operational control,
alerting, discovery, and the operational domains built on them (accounts &
payments, LPR, reservations, permits, tolling).

## 0.2 Prime directive: APDS-first

1. Wherever APDS 4.1 defines a route, schema, or convention, an APX
   implementation MUST use it verbatim. The APDS 4.1 OpenAPI document is
   vendored unmodified in this repository and reused by `$ref`.
2. APX MUST NOT redefine, subset, or re-shape any APDS entity. APX resources
   reference APDS entities via `Reference` / `VersionedReference`.
3. A plain APDS 4.1 client MUST work against an APX implementation without
   modification (for the routes/features it uses).

## 0.3 In scope

- A normative **data profile** over APDS's native routes (Part 5): Full vs
  Change update semantics, tombstones, cursor-based change feeds.
- A normative **delivery fabric** (Part 8): a superset-compatible profile of
  APDS `/webhooks` adding signed delivery, retry policy, ledger, and SSE.
- A **command plane** for devices/lanes (Part 6), an **alert domain**
  (Part 7), **credential-scoped discovery**, and the operational domains.
- **Security profile** (Part 9): OAuth2 client-credentials, APX scopes, and
  grant claims.
- **Extensibility and governance** (Parts 3, 10, 11) for multi-vendor
  adoption.

## 0.4 Out of scope

- Everything APDS itself declares out of scope that APX does not explicitly
  add (data storage/aggregation policy, business logic, general geolocation).
- Physical/electrical device protocols (OSDP, vendor PLC protocols). APX
  defines the *API* that fronts such systems, not the wire protocol to the
  hardware.
- Payment card processing (PCI) mechanics. APX carries payment *records* and
  orchestration references; card capture stays in the implementer's PCI scope.

## 0.5 Documents

| Part | File | Contents |
|---|---|---|
| 0 | 00-scope.md | This document |
| 1 | 01-normative-references.md | Normative and informative references |
| 2 | 02-terms.md | Terms, definitions, notation |
| 3 | 03-conformance.md | Conformance classes, versioning, partner rules |
| 4 | 04-identity.md | Identity, provenance, extensions container |
| 5 | 05-data.md | Data profile over APDS native routes |
| 6 | 06-control.md | Command plane, lanes, validations, devices |
| 7 | 07-alerts.md | Alerts |
| 8 | 08-events.md | Delivery fabric (webhooks + SSE) |
| 9 | 09-security.md | Security profile |
| 10 | 10-extensibility.md | Extension rules for implementers and vendors |
| 11 | 11-registries.md | Code-list registries |
| 12 | 12-errors.md | Error model |

The machine-readable OpenAPI 3.1 document (`spec/openapi/apx.yaml`, bundled
as `spec/dist/apx-v1.*`) is **normative**. Where prose and OpenAPI disagree,
the OpenAPI document prevails and the prose defect MUST be corrected.
