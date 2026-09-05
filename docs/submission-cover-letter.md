# APX — Submission Cover Letter (draft)

*To: Alliance for Parking Data Standards, Technical Working Group*
*From: Umojo, steward of the APX specification*
*Re: APX — APDS Parking eXtensions, proposed for review and adoption*

## What APX is

APX is an **additive companion standard to APDS 4.1**: the interoperable
API surface APDS deliberately leaves out — real-time delivery, operational
control, alerting, discovery, and the customer-service layer built on
them — expressed entirely in APDS's own vocabulary. One machine-readable
OpenAPI 3.1 document, a written standard of 19 parts plus a conformance
annex, six open registries, and fifteen CI-validated end-to-end scenarios.

## Why we believe it belongs with APDS

1. **The non-competition claim is enforced by machine, not promise.** The
   official `apds-api-4.1.yaml` is vendored byte-identical (SHA-256
   checksum-guarded, commit-pinned to your repository), reused only by
   `$ref`. Every pull request runs a breaking-change gate; every wire
   example in the scenario suite is schema-validated in CI. A plain APDS
   4.1 client works against an APX implementation without modification —
   including the shared `/webhooks` route, whose stock response contract
   is preserved.
2. **APX is an existence proof of APDS's extension architecture.**
   Extension identity uses §C.2.5 keys; vocabularies are
   UserDefinedCodeLists versioned per PkCommon rules; reservations are a
   decoration on a native AssignedRight. Adopting APX validates the
   extensibility design APDS already published.
3. **It is written to be governed.** Named conformance classes with
   numbered requirements and an ICS template (Annex A); an open
   registration authority with decision deadlines and an appeal path
   (Part 11 §11.3); an explicit reconciliation clause — anything APDS
   later standardizes natively wins, and APX deprecates in its favor
   (Part 3 §3.3(8)); an APDS-release policy for 4.2 and beyond (Part 3
   §3.5). Our stated end state is transfer of change control to APDS.
4. **It is written to be implemented.** Partial adoption is honest
   (classes, capability discovery with a conformance-tested soundness
   rule); the PARCS Starter Profile is a 26-endpoint minimum; every list
   paginates the APDS way; codegen is exercised in CI. During drafting we
   found and documented two defects in the published APDS artifact
   (Part 1 §1.3) — vendored untouched, reported upstream — which we offer
   as evidence the erratum discipline works.
5. **It answers the industry's next question.** Part 17 standardizes the
   customer-service surface — one aggregated resolution context and
   server-side, policy-decided allowed actions — with a rule we believe
   the committee will value on the record: *the AI agent is never the
   policy engine.*

## What we are candid about

- **Two known upstream errata** in `apds-api-4.1.yaml` (Part 1 §1.3),
  reported to your repository.
- **A deliberate absence:** APX defines no raw single-ticket price
  override. Validations and discounts are the sanctioned, auditable
  per-ticket adjustment mechanism, and the rate deck stays authoritative
  (Part 6 §6.3) — a revenue-integrity position we expect the working
  group to probe, and one we are prepared to defend.
- **Tolling (Part 15) is severable** without touching anything else, if
  the group prefers to defer it to the EFC standards world.
- **The patent position** in CONTRIBUTING.md is a stated intent, not yet a
  licence or covenant. Before formal submission the steward will adopt a
  contributor patent-commitment mechanism (e.g. Apache-2.0 inbound or
  OWFa 1.0) and file the royalty-free (RAND-Z / ISO Option 1) declaration
  for its own essential claims, scoped per conformance class — pending
  legal review.

## What we ask

Technical review by the working group; a decision on adoption, adoption
with changes, or chartering a joint task group; and — independent of that
outcome — acceptance of the two errata reports. The repository, its CI,
browsable reference documentation, and the scenario suite are public;
every wire example is schema-validated against the specification in CI,
and a schema-conformant mock server (`npm run mock`, Prism over the
bundled spec) lets reviewers exercise the API without an implementation.

*Contact: rneubauer@umojo.com*
