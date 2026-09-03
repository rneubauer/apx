# APX Part 3 — Conformance, Versioning, Governance

## 3.1 Conformance classes

APX functionality is partitioned into named conformance classes, registered
in `spec/registries/apx-conformance-classes.json`. An implementation:

1. MUST implement the APDS 4.1 routes required by each class it claims.
2. MUST advertise its supported classes in `/.well-known/apx-configuration`.
3. MUST satisfy every normative requirement (MUST/MUST NOT) that this
   standard maps to those classes.
4. MUST NOT partially implement a claimed class.

`apx-data` and `apx-events` are the **base classes**; every other class
builds on them. `apx-control`, `apx-alerts`, `apx-events-sse`,
`apx-discovery`, `apx-accounts`, `apx-payment-history`, `apx-lpr`,
`apx-reservations`, `apx-permits`, `apx-tolling`, `apx-resolution`
(requires `apx-control`), and `apx-mtls` are optional.

**Dependency table (normative).** A claimed class requires every class in
its row:

| Class | Requires |
|---|---|
| `apx-data`, `apx-events` | — (base; both required by every other class) |
| `apx-events-sse` | `apx-events` |
| `apx-control`, `apx-alerts`, `apx-discovery`, `apx-accounts`, `apx-lpr`, `apx-reservations`, `apx-permits`, `apx-tolling` | base classes |
| `apx-payment-history` | `apx-accounts` |
| `apx-resolution` | `apx-control` |
| `apx-mtls` | — (composable with any set) |

The numbered requirements for each class, and the Implementation
Conformance Statement (ICS) template a certification body or implementer
fills in, are in **Annex A**.

## 3.2 Versioning

- The APX major version is carried in the URL (`/v1`). APDS-native routes
  are versioned by APDS itself.
- Within a major version, all changes are **additive only**: new optional
  fields, new endpoints, new code-list entries, new conformance classes.
  Removing or re-typing anything requires a new major version.
- Event topics carry independent versions (`.v1`, `.v2`); a topic's payload
  contract never changes within its version.
- Each registry (UserDefinedCodeList) versions independently per APDS
  PkCommon rules: any entry addition increments the list version.
- The written standard is published in **editions**; an edition pins the set
  of module and registry versions it comprises.
- Deprecation: a feature marked deprecated remains functional for at least
  one further published edition AND 12 months, whichever is longer.

## 3.3 Rules for partner/vendor extensions (normative)

Companies extending APX (the "extension-of-the-extension" path):

1. Vendors MUST use their own namespace in extension keys:
   `apds-ext:<vendor-ns>:<class>@<M.m>`. The `apx` namespace is reserved for
   this standard.
2. Vendors MUST NOT add unregistered keys outside an `extensions` container.
3. Vendor-specific endpoints MUST live under `/apx/x/<vendor-ns>/…`.
4. Vendor event topics MUST be prefixed `<vendor-ns>.` — never `apx.`.
5. Vendors MAY publish their own UserDefinedCodeLists and MAY reference APX
   lists via `ReferencedCodeListEntry`.
6. Implementations MUST preserve unknown `extensions` keys on round-trip
   (tolerant reader, faithful writer).
7. A vendor extension adopted by the working group is renamed into the `apx`
   namespace in the next edition, with the vendor key kept as a documented
   alias for one deprecation window.
8. **APDS reconciliation (the other direction).** When APDS itself
   standardizes a concept APX occupies (e.g. native payment events or an
   actuation surface in a future APDS release), the APDS construct WINS:
   the next APX edition adopts it verbatim per the prime directive, marks
   the APX construct deprecated per §3.2's deprecation window, and
   documents the migration. APX is a proving ground for APDS, never a
   competitor — this clause is the mechanism.

## 3.4 Publication

The normative artifacts of an APX edition are: the bundled OpenAPI
document, the APX data-profile overlay
(`spec/openapi/overlays/apx-data-overlay.yaml`, whose application to the
bundle produces the effective API description — Part 0 §0.5), the registry
JSON files, Parts 0–18 of this written standard, and Annex A (conformance
requirements and ICS template). The spec tooling in
`tools/` is supporting material, not normative.

## 3.5 APDS version policy

APX pins exactly ONE APDS release per edition — currently 4.1, vendored
byte-identical, checksum-guarded, and commit-pinned in Part 1.

1. **When APDS ships a new release (4.2, 5.0…):** re-vendoring it is a new
   APX edition. The rebase diff runs through the same breaking-change gate
   as any change; APDS-caused breaking changes make the new edition a new
   APX major. §3.3(8) reconciliation applies to any APX construct the new
   APDS release absorbs.
2. **No in-band version negotiation.** A server implements one APDS
   version and advertises it as `apdsVersion` in
   `/.well-known/apx-configuration`; clients check the bootstrap document
   before first use. (OCPI-style `/versions` negotiation was considered
   and rejected: dual-mounting two APDS releases on one host doubles every
   implementation for a transition case better served by running the new
   edition on a new deployment and cutting over per Part 18.)
3. **Support window.** When a new edition ships, the prior edition remains
   published and its registries frozen; implementers get at least the
   §3.2 deprecation window (one edition AND 12 months) before any APX
   feature removed by reconciliation stops being valid to serve.
