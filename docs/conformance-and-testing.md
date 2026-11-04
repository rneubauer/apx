# Conformance and testing guide

This guide is for implementers and buyers. It explains what "conforms to
APX" means and how to check an implementation. The rules themselves are in
[Part 3](standard/03-conformance.md) and [Annex A](standard/annex-a-ics.md);
if this guide and the standard disagree, the standard wins.

## 1. Choose your conformance classes

APX is divided into named conformance classes, such as `apx-control`,
`apx-lpr` and `apx-violations`. They are registered in
`spec/registries/apx-conformance-classes.json`.

1. Every implementation claims the two base classes, `apx-data` and
   `apx-events`.
2. Add the optional classes for what your product does. Part 3 §3.1 lists
   which classes require which others. For example, `apx-resolution`
   requires `apx-control`.
3. You must implement a claimed class completely. A partial class is not
   conformance.
4. Advertise what you claim at `GET /.well-known/apx-configuration`
   ([Part 16](standard/16-discovery.md)).

PARCS vendors can start with the [PARCS Starter Profile](parcs-starter-profile.md),
the smallest useful set.

## 2. Build your test matrix from Annex A

[Annex A](standard/annex-a-ics.md) numbers every testable requirement,
for example `APX-CORE-03` or `APX-CTL-01`. The numbers never change, and new
requirements are added at the end of a table.

1. Copy the rows for the cross-cutting requirements (A.1) and for each
   class you claim.
2. For each row, record "supported", "not supported" or, for a row marked
   **C**, "not applicable" because you lack that capability.
3. The completed table is your Implementation Conformance Statement (ICS).
   Give it to buyers and certifiers.

## 3. Test against the vetting suite

Each conformance class has a vetting suite in
[`scenarios/by-module/`](scenarios/by-module/README.md): a set of exchanges
covering the happy path, refusals, lifecycles, security and edge cases. Each
scenario is tagged with the Annex A rows it exercises.

- **Read them** as the expected behaviour of your implementation.
- **Measure coverage**: `npm run vetting` reports, per module, the
  operations, response codes, Annex A rows, command types and problem types
  the suite covers. `npm run vetting -- apx-control` checks one module.
- **Validate bodies**: `npm run scenarios:check` validates every sample
  body against the API.

## 4. Compare with the reference simulator

The [simulator](https://rneubauer.github.io/apx/simulator/) implements
every class. It is a reference for behaviour, not a product.

1. Open it in a browser, or run it locally with `npm run sim`, which serves
   it on <http://127.0.0.1:4100>.
2. Send your client's requests to it and compare what you get with what
   your own server returns.
3. To replay the whole vetting suite, run
   `node packages/simulator/bin/apx-sim.mjs replay` (or name one module).
   It checks every status code, every refusal's problem type, and that
   every response validates against the API.

See the [simulator README](../packages/simulator/README.md) for scripting
your own scenarios.

## 5. Check your payloads

- Responses and events must validate against `spec/dist/apx-v1.json`. Any
  JSON Schema 2020-12 validator works; this repository uses Ajv.
- Errors must be RFC 9457 `application/problem+json` with a registered
  `type` ([Part 12](standard/12-errors.md)).
- Unknown `extensions` keys must survive a round trip
  ([Part 4](standard/04-identity.md)).

## 6. Versions

APX follows the versioning rules in Part 3 §3.2. Within a major version
(`/v1`), every change is additive: new optional fields, endpoints, code-list
entries or classes. An oasdiff breaking-change gate checks every pull
request, so an implementation that conforms to one edition keeps conforming
to the next within `/v1`. A deprecated feature keeps working for at least
one more edition and 12 months, whichever is longer. Each release's
`edition.json` pins by checksum exactly which files it contains.
