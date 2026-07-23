# APX Part 3 — Conformance, Versioning, Governance

## 3.1 Conformance classes

APX functionality is partitioned into named conformance classes, registered
in `spec/registries/apx-conformance-classes.json`. An implementation:

1. MUST implement the APDS 4.1 routes required by each class it claims.
2. MUST advertise its supported classes in `/.well-known/apx-configuration`.
3. MUST pass the APX conformance harness suites mapped to those classes.
4. MUST NOT partially implement a claimed class.

`apx-data` and `apx-events` are the **base classes**; every other class
builds on them. `apx-events-sse`, `apx-discovery`, `apx-accounts`,
`apx-payment-history`, `apx-lpr`, `apx-reservations`, `apx-permits`,
`apx-tolling`, and `apx-mtls` are optional.

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
   (tolerant reader, faithful writer). The conformance harness tests this.
7. A vendor extension adopted by the working group is renamed into the `apx`
   namespace in the next edition, with the vendor key kept as a documented
   alias for one deprecation window.

## 3.4 Publication

The normative artifacts of an APX edition are: the bundled OpenAPI document,
the registry JSON files, and Parts 0–12 of this written standard. The
reference server and conformance harness are supporting tools, not normative.
