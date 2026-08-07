# APX Part 1 — References

## 1.1 Normative

- **APDS API Specification 4.1** — `apds-api-4.1.yaml` (vendored at
  `spec/vendor/apds/4.1/`, MIT, © Alliance for Parking Data Standards);
  source: https://github.com/parkingdata/spec
- **APDS Information Model v4.1** and **APDS Data Dictionary v4.1** —
  Alliance for Parking Data Standards (member/request distribution)
- **RFC 2119 / RFC 8174** — Key words for use in RFCs
- **RFC 3339** — Date and Time on the Internet
- **RFC 4122** — UUID URN namespace
- **RFC 6749** — OAuth 2.0 (client credentials grant)
- **RFC 8615** — Well-Known URIs
- **RFC 9457** — Problem Details for HTTP APIs
- **OpenAPI Specification 3.1.0**
- **JSON Schema 2020-12**

## 1.2 Informative

- **APDS Overview v4.1**, **APDS Use Case Document v4.1** (esp. §C.1.1.6
  Full/Change updates, §C.2.2 enforcement vocabularies, §C.2.5 extension
  mechanism)
- **ISO/TS 5206-1:2023** — Parking — Part 1: Core data model
- **CloudEvents 1.0** — informative mapping for the APX EventEnvelope
- **CEN/TS 16157-6 (DATEX II parking)** — related European data exchange
- **HTML Server-Sent Events** (WHATWG) — SSE transport

## 1.3 Known APDS 4.1 errata

APX vendors the APDS 4.1 OpenAPI document **verbatim** (checksum-guarded),
including its defects. Implementers validating payloads against the raw
schemas should be aware of:

1. **`Reference` is unsatisfiable as written.** The schema declares
   `maxProperties: 1` while requiring *both* `id` and `className` — no
   object can satisfy it. APX follows the schema's stated intent (and every
   APDS example): a reference is `{"id", "className"}`. Validators MUST
   relax the `minProperties`/`maxProperties` constraints on `Reference`
   (see `tools/validate-scenarios.mjs` for the reference treatment). This
   erratum should be reported to APDS
   (https://github.com/parkingdata/spec) and this section removed once a
   corrected upstream release is vendored.
