# APX Part 1 — References

## 1.1 Normative

- **APDS API Specification 4.1** — `apds-api-4.1.yaml` (vendored at
  `spec/vendor/apds/4.1/`, MIT, © Alliance for Parking Data Standards);
  source: https://github.com/parkingdata/spec, pinned at upstream commit
  `e10dcfc4cf5e45aaa2f46641a235333fb5585b1b` (2026-03-03). The vendored
  copy is byte-identical to that revision (verified 2026-09-02;
  checksum-guarded by `tools/check-vendor.mjs`). 4.1 is the latest
  published APDS API release as of this edition.
- **APDS Information Model v4.1** and **APDS Data Dictionary v4.1** —
  Alliance for Parking Data Standards (member/request distribution)
- **RFC 2119 / RFC 8174** — Key words for use in RFCs
- **RFC 3339** — Date and Time on the Internet
- **RFC 9562** — Universally Unique IDentifiers (obsoletes RFC 4122;
  mentions of "RFC 4122 UUID" in schema prose denote the same format)
- **RFC 6749** — OAuth 2.0 (client credentials grant)
- **RFC 7240** — Prefer Header for HTTP
- **RFC 8615** — Well-Known URIs
- **RFC 8705** — OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens (class `apx-mtls`, Part 16 §16.3)
- **RFC 9457** — Problem Details for HTTP APIs
- **OpenAPI Specification 3.1.0** and **Overlay Specification 1.0.0**
- **JSON Schema 2020-12**
- **HTML Server-Sent Events** (WHATWG HTML Living Standard, snapshot as of
  this edition's date) — normative for the `apx-events-sse` class only

## 1.2 Informative

- **APDS Overview v4.1**, **APDS Use Case Document v4.1** (esp. §C.1.1.6
  Full/Change updates, §C.2.2 enforcement vocabularies, §C.2.5 extension
  mechanism)
- **ISO/TS 5206-1:2023** — Parking — Part 1: Core data model
- **CloudEvents 1.0** — informative mapping for the APX EventEnvelope
- **CEN/TS 16157-6 (DATEX II parking)** — related European data exchange

## 1.3 Known APDS 4.1 errata

APX vendors the APDS 4.1 OpenAPI document **verbatim** (checksum-guarded),
including its defects. Filing-ready reports for all twelve below, each
with the offending snippet and a minimal suggested fix, are in
[`docs/errata/`](../errata/README.md), which tracks their status upstream. Verified against `parkingdata/spec` at `master` on
2026-09-23: the published document was byte-identical to the vendored copy,
so all of them are live in the current release. Where APX needs a working
shape before APDS ships a fix, the data overlay (Part 5 §5.6) supplies it
in the bundled document, narrowly, citing the erratum; the vendored file
is never touched.

Implementers validating payloads against the raw schemas should be aware
of:

1. **`Reference` is unsatisfiable as written.** The schema declares
   `maxProperties: 1` while requiring *both* `id` and `className` — no
   object can satisfy it. APX follows the schema's stated intent (and every
   APDS example): a reference is `{"id", "className"}`. Validators MUST
   relax the `minProperties`/`maxProperties` constraints on `Reference`
   (see `tools/validate-scenarios.mjs` for the reference treatment). Filed
   upstream as [parkingdata/spec#33](https://github.com/parkingdata/spec/issues/33);
   remove this entry once a corrected release is vendored.
2. **`POST /observations` `single-element` example is invalid against its
   own schema.** The embedded request example omits the required `id` and
   matches no branch of the request `oneOf`. The schema is authoritative;
   the example is defective. Lint tooling scopes an exemption to this path
   (`tools/.spectral.yaml`) rather than editing the vendored file. Filed
   upstream as [parkingdata/spec#34](https://github.com/parkingdata/spec/issues/34);
   remove on a corrected release.
3. **Discriminator mapping typo on `POST /observations`.** The mapping key
   for the observation-set branch is spelled `ObvservationSet` (extra `v`),
   so the legal `ObservationDataType` value `ObservationSet` has no mapping
   entry. Tolerant tooling resolves the subschema by name anyway; strict
   tooling does not. APX needs no workaround for this one. Filed upstream as
   [parkingdata/spec#35](https://github.com/parkingdata/spec/issues/35);
   remove on a corrected release.
4. **`RateTable` requires two members it never defines**
   (`validityStart`, `activeTimes`), so no rate table validates. The data
   overlay drops them from `required`. [Erratum 004](../errata/004-ratetable-phantom-required.md).
5. **`POST /observations` declares no responses.** The overlay declares
   201/400/409 `ResponseStatus`, as on the other native creates.
   [Erratum 005](../errata/005-observations-post-no-responses.md).
6. **`POST /observations`: the wrapper `type` collides with
   `ObservationElement.type`**, so no single observation validates. The
   overlay replaces the request schema with a plain
   `oneOf [ObservationElement, ObservationSet]`.
   [Erratum 006](../errata/006-observations-discriminator-collision.md).
7. **`POST /quotes` declares no request body**, and `GET /quotes` returns
   one object from a list query. The overlay adds an optional request
   body; the `GET` is documented as is (Part 5 §5.7).
   [Erratum 007](../errata/007-quotes-post-no-request-body.md).
8. **`ReferenceToQuote` is a `oneOf` of two identical branches**, so
   booking from a quote reference never validates. No additive
   workaround exists; book with the full `AssignedRight`.
   [Erratum 008](../errata/008-referencetoquote-identical-branches.md).
9. **`Identifiers` requires `rateTableId` but declares `rateTableID`.**
   The overlay declares the required spelling.
   [Erratum 009](../errata/009-identifiers-ratetableid-spelling.md).
10. **No entity schema declares `extensions`** (Use Case §C.2.5). The
    overlay declares it on the eight native entity schemas.
    [Erratum 010](../errata/010-entities-no-extensions.md).
11. **`GeoJsonObject` declares no `coordinates`.** The overlay declares an
    optional array. [Erratum 011](../errata/011-geojsonobject-no-coordinates.md).
12. **Response-code irregularities** on `POST /rates` (200, no 400/409),
    `PUT /rights/assigned/{id}` (201, no 404), and the contact reads
    (only 500s). The overlay adds the missing codes; Part 5 §5.7 records
    the rest. [Erratum 012](../errata/012-native-response-code-irregularities.md).

Remove an entry, and its overlay action, in the same change that vendors a
corrected APDS release.
