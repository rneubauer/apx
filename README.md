# APX — APDS Parking eXtensions

**APX** is an open, additive companion standard to
[APDS 4.1](https://github.com/parkingdata/spec) (Alliance for Parking Data
Standards / ISO TS 5206-1). One API that PARCS, LPR, tolling, permitting, and
reservations vendors implement — adding what APDS deliberately leaves out,
while reusing everything it defines.

## Prime directive: APDS-first

Wherever APDS 4.1 already defines a route, schema, or convention, APX uses it
**verbatim** — the official `apds-api-4.1.yaml` is vendored unmodified (MIT,
checksum-guarded) and reused by `$ref`. A plain APDS 4.1 client works against
an APX implementation without changes. APX adds only what APDS lacks:

| Domain | What APX adds | Anchored on |
|---|---|---|
| Data profile | Full/Change updates, tombstones, cursor change feed | APDS native routes (`/places`, `/sessions`, `/rates`, `/rights/*`, `/observations`, `/quotes`) |
| Delivery fabric | HMAC-signed webhooks, normative retries, delivery ledger, SSE | APDS `/webhooks` + `EventSubscription` (superset-compatible) |
| Control | Command plane (vend gate, lost ticket, rate push, validations…), lane inquiry, device status | `SupplementalEquipment`, `HierarchyElementReference` |
| Alerts | Alert lifecycle + open taxonomies | `UserDefinedCodeList`, Use Case C.2.2 exception vocabulary |
| Discovery | Credential-scoped capability documents | OAuth2 scopes + place grants |
| Accounts & payments | Balance lookup, take-payment, accounting write-back, payment history | `RightHolder`, `Payment` |
| LPR | Plate↔ticket cross-lookup with confidence + imagery | `Observation`, `Confidence`, `Image` (4.1) |
| Reservations | Quote→book→amend→check-in conventions | `Quote*`, `AssignedRight`, `PlannedUse` |
| Permits | Pooled issuance, multi-vehicle credentials | `RightSpecification`, `RightPool`, `Credential` |
| Tolling | TollTransaction + dispute lifecycle (net-new) | `Observation` → pricing → `Payment` |

Extension identity follows the official APDS convention (Use Case §C.2.5):
`apds-ext:apx:<class>@<version>`.

## Repository

| Path | Contents |
|---|---|
| `spec/openapi/` | **The standard** — modular OpenAPI 3.1 (`apx.yaml` root; one directory per domain) |
| `spec/vendor/apds/4.1/` | APDS 4.1 vendored verbatim (MIT) — never edited, checksum-guarded |
| `spec/registries/` | UserDefinedCodeList registries (alert types, command types, device states, topics, conformance classes) |
| `docs/standard/` | The written standard (normative, RFC 2119) |
| `packages/types` | TypeScript types generated from the bundled spec |
| `packages/reference-server` | Runnable reference implementation (Fastify sandbox) |
| `packages/conformance` | Conformance harness — partner self-certification against any base URL |

## Development

```powershell
npm install
npm run vendor:check   # verify vendored APDS artifacts are untouched
npm run spec:lint      # Redocly lint (modular source)
npm run spec:bundle    # produce spec/dist/apx-v1.{yaml,json}
npm run spec:style     # Spectral APX conventions (bundled artifact)
npm test               # all of the above + workspace test suites
```

Requires Node 20+. No Docker, no native modules.

## Status

**v0.1.0 — complete v1 draft.** All domains specified and implemented:
data profile, delivery fabric, control, alerts, discovery, accounts &
payments, LPR, reservations, permits, tolling. 37 passing tests; the
conformance harness passes 14/14 checks against the reference server and
fails against a deliberately broken implementation.

```powershell
npm run demo           # flagship call-center flow, end to end
npm run conformance -w @apx/conformance -- --base-url http://localhost:4100
```

## License

MIT. Portions reference the APDS API Specification (MIT, © Alliance for
Parking Data Standards).
