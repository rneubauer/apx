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
- **Deliberate open items:** no reservation↔session link for barcode-only
  reservations (plate correction covers LPR sites); no single-ticket rate
  override (the rate deck remains authoritative). Both are one small
  addition if the working group wants them in scope.
- **Tolling (Part 15) is severable** without touching anything else, if
  the group prefers to defer it to the EFC standards world.
- **The patent statement** in CONTRIBUTING.md is a stated intent pending
  formal legal declaration, which will accompany the final submission.

## What we ask

Technical review by the working group; a decision on adoption, adoption
with changes, or chartering a joint task group; and — independent of that
outcome — acceptance of the two errata reports. The repository, its CI,
browsable reference documentation, and the scenario suite are public; a
reference implementation (mock provider) exercises the specification
end-to-end.

*Contact: rneubauer@umojo.com*
