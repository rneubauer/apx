## Relationship to APDS and DATEX II

### APDS 4.1, reused as published

APX pins exactly one APDS release per edition, currently 4.1 (APX Part 3
§3.5). The APDS 4.1 OpenAPI document is vendored in `spec/vendor/apds/4.1/`
byte-for-byte from the upstream repository, pinned to a named commit and
guarded by a checksum that `tools/check-vendor.mjs` verifies (APX Part 1
§1.1). APX schemas reach APDS classes by `$ref` into that file. Nothing in
it is edited.

While building APX against APDS 4.1, a small number of places were found
where the published API document cannot validate what the APDS documents
describe, for example a `Reference` schema no object can satisfy. Fourteen
such items have been reported to the Alliance, with a suggested fix for
each, and are listed in APX Part 1 §1.3 and `docs/errata/`. We are
grateful for the care that has gone into APDS; these are small points in
a large and useful body of work. Where APX needs a working shape before
an APDS fix is published, the APX data-profile overlay supplies it in the
bundled document, narrowly and citing the item. The vendored file is
never touched, and each workaround is removed in the same change that
vendors a corrected APDS release (APX Part 1 §1.3).

The same overlay carries the APX additions to APDS-native routes: the
update-mode header, the change-feed parameters, and the Problem error
alternative (APX Part 5 §5.1–5.2). A client that sends no APX header or
parameter observes pure APDS 4.1 behaviour (APX Part 5 §5.6).

### Extensions and the Level B / Level C posture

APDS 4.1 introduced a generic extension mechanism (APDS Use Case Document
§C.2.5). APX uses it as its only way into APDS payloads. APX data attached
to an APDS entity rides in that entity's `extensions` container, under a
key `apds-ext:apx:<class>@<M.m>`, and its value is validated against the
APX schema the `Extensions` schema binds to that key (APX Part 4 §4.3).

Measured against the DATEX II extension taxonomy the APDS Information
Model adopts (APX Part 10 §10.3):

- **Level B.** The APX decorations on APDS entities are backward
  compatible. A valid decorated instance is a valid APDS 4.1 instance,
  and a plain APDS consumer ignores the decoration.
- **Level C-adjacent.** The APX companion API (commands, alerts, the
  subscription superset, discovery and the other resources) adds new
  interaction roots that APDS consumers never see. They reference APDS
  entities by Reference only.

APX declares `extensionName: apx` and `extensionVersion` in the
`x-apds-extension` member of the OpenAPI `info` block, following the
extension declaration rule of the APDS Information Model.

The data elements APX proposes to APDS follow the same split. Additions
to existing APDS classes are Level B. Classes in the two new domains
proposed, Enforcement and Operations, are Level C because they add new
root concepts (APX Data Specification, Introduction).

### DATEX II

APDS has substantively adopted the CEN DATEX II modelling approach of EN
16157-1 and describes its model as a Level C model in those terms. APX
does not change that model. APX itself is defined as an OpenAPI 3.1
document with JSON Schema 2020-12 schemas (APX Part 1 §1.1). The class
diagrams in this document are a view generated from those schemas; APX
does not claim to be a platform-independent UML model under the EN
16157-1 rules. The elements proposed to APDS are written in the APDS UML
form, which aligns with EN 16157-1, so that they can sit in the APDS model
unchanged if adopted.

## Extending APX

APX is built to be extended the same way it extends APDS. Three
mechanisms are sanctioned (APX Part 10 §10.1):

1. **The extensions container.** Any APX resource or APDS entity can
   carry namespaced, versioned additions (`apds-ext:<ns>:<class>@<M.m>`).
   Servers preserve unknown keys on round-trip (APX Part 3 §3.3(6)).
2. **User-defined code lists.** Open APX vocabularies are published as
   APDS `UserDefinedCodeList` documents in `spec/registries/` (APX Part
   11). An implementer adds values by publishing its own list and
   referencing its entries; it never changes an APX registry file or
   gives an APX value a new meaning (APX Part 11 §11.1).
3. **New domains.** A new module, conformance class, scope family and
   topic prefix, added without touching existing files. This is how
   reservations, permits and tolling were added to APX itself.

Extension must not change the meaning of an existing field, path, topic
or code; must not add required fields to existing schemas; must not
create parallel constructs for things APDS or APX already model; and must
not use the reserved `apx` namespace or `apx.` topic prefix (APX Part 10
§10.2).

**Registries.** Each registry entry is add-only, and every addition
increments the list version (APX Part 11 §11.1). APX picks the form of
every coded value in a fixed order: an APDS enumeration or code list if
APDS has one; an APX enumeration for a closed set APX fully owns; a
registry for an open set more than one party must interpret; a plain
string for a value meaningful inside one implementation only (APX Part 11
§11.1a). Anyone may request a registry entry; the maintainers decide
within 60 days, and a requester can always publish its own list in the
meantime (APX Part 11 §11.3).

**Partner extensions.** A vendor uses its own namespace on every surface:
extension keys `apds-ext:<vendor-ns>:…`, endpoints under
`/apx/x/<vendor-ns>/`, topics prefixed `<vendor-ns>.`, and conformance
classes named `<vendor-ns>-<class>` (APX Part 3 §3.1, §3.3). A vendor
extension adopted by the working group is renamed into the `apx`
namespace in the next edition, and the vendor key stays valid as an alias
for one deprecation window (APX Part 3 §3.3(7)). The practical guide is
`docs/partner-extension-guide.md`.

## Conformance

APX functionality is divided into named conformance classes, registered
in `spec/registries/apx-conformance-classes.json` (version 8). An
implementation implements the APDS routes each claimed class needs,
advertises its classes in `/.well-known/apx-configuration`, meets every
normative requirement mapped to them, and never implements a claimed class
in part (APX Part 3 §3.1).

| Class | Scope | Requires |
| --- | --- | --- |
| `apx-data` | APDS native routes with the APX data profile (Part 5) | base |
| `apx-events` | Delivery fabric over APDS `/webhooks` (Part 8) | base |
| `apx-events-sse` | Server-Sent Events stream (Part 8 §8.4) | `apx-events` |
| `apx-control` | Commands, lane inquiry, validations, device status (Part 6) | base classes |
| `apx-alerts` | Alert resource and lifecycle (Part 7) | base classes |
| `apx-discovery` | Credential-scoped capability discovery (Part 16) | base classes |
| `apx-accounts` | Accounts, take payment, accounting write-back (Part 13) | base classes |
| `apx-payment-history` | Payment history lookup (Part 13 §13.2) | `apx-accounts` |
| `apx-lpr` | LPR plate and ticket cross-lookup over Observations (Part 13 §13.3) | base classes |
| `apx-reservations` | Reservations over APDS quotes and assigned rights (Part 14) | base classes |
| `apx-permits` | Permits over RightSpecification, RightPool and Credential (Part 14) | base classes |
| `apx-tolling` | Toll transactions and disputes (Part 15) | base classes |
| `apx-resolution` | Customer service and resolution (Part 17) | `apx-control` |
| `apx-violations` | Enforcement (Part 19) | base classes |
| `apx-validations` | Validation program management (Part 20) | base classes |
| `apx-credentials` | Credential lifecycle (Part 21) | base classes |
| `apx-valet` | Valet custody (Part 22) | base classes |
| `apx-charging` | Parking-side view of EV charging (Part 23) | base classes; `apx-control` for charger commands |
| `apx-plate-lists` | Plate lists (Part 24) | base classes |
| `apx-mtls` | Mutual TLS on all routes (Part 16 §16.3) | none; composable with any set |

`apx-data` and `apx-events` are the base classes; every other class except
`apx-mtls` requires both. A claim that is not closed under this
dependency table is non-conforming, and a client treats the dependent
class as not offered (APX Part 3 §3.1). Some classes also have optional
features, such as `negotiatedRates`, `negotiatedAmounts` and
`ticketMatching` of `apx-control`, listed in the `apx-features` registry
and advertised in the bootstrap document (APX Part 6 §6.5, Part 16 §16.1).

Annex A (`docs/standard/annex-a-ics.md`) numbers the testable
requirements of each class as `APX-<CLASS>-<NN>`, citing the defining
section, and provides the Implementation Conformance Statement template
an implementer or certification body fills in. Identifiers never
renumber; new requirements are appended.

Conformance with APX is structural and behavioural. As APDS notes for its
own model, a correctly structured payload is not by that fact a
meaningful one.

## Glossary

Terms defined by APDS 4.1 (Place, IdentifiedArea, Space, RightSpecification,
AssignedRight, RightHolder, Session, Segment, Observation, Credential,
RateTable, Quote, Supply, Demand, Distributing Party, Receiving Party and
others) keep their APDS meanings and are not redefined (APX Part 2).

| Term | Meaning |
| --- | --- |
| Alert | An APX resource describing an operational condition that needs attention (Part 7) |
| APDS | Alliance for Parking Data Standards, and its parking data specification, version 4.1 |
| APDS-first | The APX rule that APDS routes, schemas and conventions are used as published and never re-shaped (Part 0 §0.2) |
| APX | APDS Parking eXtensions: the companion specification described here |
| APX client | A system that consumes an APX implementation under an OAuth2 client registration |
| APX implementation | A server exposing APDS 4.1 routes plus one or more APX conformance classes |
| Aggregating implementation | One APX implementation fronting many locations from many operators (Part 18) |
| Bootstrap document | `/.well-known/apx-configuration`, the unauthenticated starting point for a client (Part 16 §16.1) |
| Change feed | An ordered, gapless stream of changes to one collection, read with `mode=change` and a cursor (Part 5 §5.2) |
| Command | An APX resource requesting an operational action against a lane, device or place (Part 6) |
| Conformance class | A named, testable unit of APX functionality (Part 3) |
| Cursor | An opaque position in a change feed, scoped to class, credential and filter set (Part 5 §5.2) |
| Decoration | APX data carried on an APDS entity or APX resource under an `apds-ext:apx:` key in its `extensions` container (Part 4 §4.3) |
| Device | A physical unit inventoried as an APDS SupplementalEquipment, with APX live state overlaid (Part 6 §6.4) |
| Discovery document | The credential-scoped list of what one client can call (Part 16 §16.2) |
| Edition | A published, checksummed set of APX artifacts named in `spec/edition.json` (Part 3 §3.4) |
| Event | One EventEnvelope delivery (Part 8) |
| Extension key | A key of the form `apds-ext:<ns>:<class>@<M.m>` in an `extensions` container |
| Feature | An optional capability of a conformance class, from the `apx-features` registry (Part 16 §16.1) |
| Grant | The token claims `apx_org` and `apx_places` that bound what a client may see and do (Part 9 §9.3) |
| Lane | The entry or exit position addressed by control commands, modelled as an APDS VehicularAccess (Part 2) |
| Level B extension | A backward-compatible extension: a valid extended instance is a valid core instance |
| Level C extension | An extension that adds new root concepts and is not required to be compatible |
| Overlay | An OpenAPI Overlay 1.0 document applied to the bundle by the build; the data-profile overlay is normative (Part 0 §0.5) |
| Pairing engine | The system that turns reads into Sessions and matches Sessions to rights, tickets and lists (Part 2) |
| Place binding | The rule that attributes each event to a HierarchyElement for filtering and isolation (Part 8 §8.5) |
| Problem | An RFC 9457 error body with a registered APX problem type (Part 12) |
| Read-model | A computed view that is never written directly, such as the occupancy snapshot (Part 5 §5.5) |
| Registry | An APX open vocabulary published as an APDS UserDefinedCodeList (Part 11) |
| Subscription | An APX-extended APDS EventSubscription (Part 8) |
| Tombstone | A record that an entity was deleted, carried as an APDS DeletedReference (Part 5 §5.2) |
| Topic | An event type: an APDS EventTypeEnum value or an APX topic `apx.<domain>.<event>.vN` (Part 2) |

## References

### Normative references

The following are normative references of APX (APX Part 1 §1.1):

- APDS API Specification 4.1, `apds-api-4.1.yaml`, Alliance for Parking
  Data Standards, vendored at `spec/vendor/apds/4.1/`
- APDS Information Model v4.1 and APDS Data Dictionary v4.1, Alliance for
  Parking Data Standards
- RFC 2119 and RFC 8174, key words for use in RFCs
- RFC 3339, Date and Time on the Internet: Timestamps
- RFC 9562, Universally Unique IDentifiers (UUIDs); obsoletes RFC 4122
- RFC 6749, The OAuth 2.0 Authorization Framework (client credentials grant)
- RFC 7240, Prefer Header for HTTP
- RFC 8615, Well-Known Uniform Resource Identifiers
- RFC 8705, OAuth 2.0 Mutual-TLS Client Authentication and
  Certificate-Bound Access Tokens (class `apx-mtls`)
- RFC 9457, Problem Details for HTTP APIs
- OpenAPI Specification 3.1.0 and Overlay Specification 1.0.0
- JSON Schema 2020-12
- HTML Server-Sent Events (WHATWG HTML Living Standard), for the
  `apx-events-sse` class only

### Other references

- APDS Overview v4.1 and APDS Use Case Document v4.1, in particular
  §C.1.1.6 (Full and Change updates), §C.2.2 (enforcement vocabularies)
  and §C.2.5 (extension mechanism) (APX Part 1 §1.2)
- ISO/TS 5206-1:2023, Parking — Part 1: Core data model (APX Part 1 §1.2)
- EN 16157-1:2018, Intelligent transport systems — DATEX II data exchange
  specifications for traffic management and information — Part 1: Context
  and framework (the modelling basis of APDS, and of the Level B / Level C
  terms used here)
- CEN/TS 16157-6, DATEX II parking publications (APX Part 1 §1.2)
- CloudEvents 1.0, informative mapping for the APX EventEnvelope (APX Part
  1 §1.2)
- RFC 7396, JSON Merge Patch, used by `PATCH /webhooks/{id}` (APX Part 8
  §8.1)
- APX Data Specification for the APDS committee, `docs/apds-submission/`
- APX requested changes to APDS 4.1, `docs/apds-change-requests.md`, and
  the errata reports in `docs/errata/`

## Notation

The class diagrams in this document are Mermaid class diagrams generated
from the APX OpenAPI schemas. They are read as follows:

- **Classes.** Each box is a class of the module, listing up to twelve
  of its attributes with their types. 03 Data Dictionary lists every
  member.
- **Stereotype labels.** A box marked «proposed» is an APX class from
  which a data element is proposed to APDS (06, Part D). A box with no
  members is a class from outside the module: «APDS» marks an APDS 4.1
  class, used as published apart from the overlay changes in 03 Annex B,
  and «APX» marks a class from another APX module.
- **Specialization (`<|--`).** The class at the plain end extends the
  class at the open triangle.
- **Association (`-->`).** The class at the tail contains or points to
  the class at the head. The label names the member, and the number at
  the head gives its multiplicity. A member that is an APDS `Reference`
  or `VersionedReference` is shown as an attribute instead, so that the
  diagrams do not all point at the same reference class.
- **Multiplicities.** Written as in UML and APDS: `1..1` exactly one,
  `0..1` optional, `0..*` any number, `1..*` at least one. An attribute
  type ending in `[]` holds a list.
- **Types.** Diagrams show the short class or datatype name. 03 Data
  Dictionary gives the full name, written `Domain.Name` for APDS types
  (for example `PkCommon.DateTime`) and `Package.Name` for APX types.

The UML semantics behind this notation are those of ISO/IEC 19505-1, as
used by DATEX II (EN 16157-1) and the APDS Information Model.
