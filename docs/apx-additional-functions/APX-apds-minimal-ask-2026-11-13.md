# Design note: a minimal request to APDS

- **Status:** Recommended 2026-11-13. Rick confirms the options below before anything is filed.
- **Date:** 2026-11-13
- **Checked against:** `rneubauer/apx` main, edition **0.16.0**.
- **Direction (Rick, 2026-11-13):** leave the root APDS alone and add only what is absolutely necessary, with APX as
  the extension specification outside ISO, because that is easier to get approved.

## Summary

| # | What | Before | After |
|---|---|---|---|
| M1 | Corrections to APDS 4.1 | Part A (errata 001 to 014, filed) and Part B (C-015 to C-026, not filed) | Unchanged, and now the core of the request. Drafts for C-015 to C-026 in `docs/errata/drafts/`; C-025 held |
| M2 | Data model additions | 127 proposals in three tiers, all presented as requests | One request: five `EquipmentTypeEnum` values (`barrier`, `gate`, `ticketDispenser`, `intercom`, new `exitVerifier`) |
| M3 | Everything else | Requested, Tier 1 "propose now" | Informative annex "APX extensions available for later adoption". Makes no request. Tiers kept |
| M4 | How the split is recorded | Nothing in the data | `ask: minimal` on the proposal entry, read by both generators |

## Why

1. **Approval is easier when the ask is small.** APDS is ISO TS 5206-1. A working group can accept corrections and five
   enumeration values in one meeting. A new Enforcement domain, a new Operations domain and 120 other elements need a
   standards cycle each.
2. **APX does not need APDS to change.** APX vendors APDS 4.1 byte-for-byte and carries every extension as an
   `apds-ext:apx:*` block on an APDS object or as an APX resource. Nothing in the annex blocks an APX deployment.
3. **The five values are the exception because there is no good extension point for them.** `EquipmentTypeEnum` is a
   closed APDS enumeration on `SupplementalEquipment`. Today a gate, a ticket dispenser or an exit verifier is sent as
   `other`, so a plain APDS consumer cannot tell what is on a lane. APX's own `apx-equipment-roles` code list fixes this
   only for APX clients.
4. **`exitVerifier` closes the exit lane.** With the existing `paymentMachine`, an entry lane (`ticketDispenser`,
   `barrier` or `gate`, `lprCamera`, `intercom`) and an exit lane (`exitVerifier`, `paymentMachine`, `barrier` or `gate`,
   `lprCamera`, `intercom`) can both be typed with APDS names alone. The value already exists in `apx-equipment-roles`.
   Definition: "a machine at an exit lane that reads the ticket or credential presented and opens the barrier when the
   stay is paid or valid."
5. **Nothing is withdrawn.** The annex keeps the full Data Dictionary text and the tiers, so the working groups can
   take any of it later without APX rewriting it.

## The marker

`ask: minimal` is an optional field on one proposal entry in `spec/proposals/apds-additions/*.yaml`. Today only the
`EquipmentTypeEnum` extend entry in `place.yaml` carries it.

- `tools/build-apds-submission.mjs` validates it (only `minimal`, only on Tier 1). It renders "What we ask of APDS"
  first, in 01 Overview and 02 Information Model: the corrections (prose in `docs/apds-submission/src/_ask-intro.md`)
  and a value table generated from the marked entry. Everything unmarked goes into "Annex A (informative) APX extensions
  available for later adoption" in 01, and into the informative tier tables in 02. A Status column ("Requested" or
  "Offered for later") is added to every summary table, and 03 Data Dictionary marks each heading.
- `tools/build-apx-docs.mjs` fills two markers in `docs/apx-specification/src/06-apds-requests.md`:
  `<!-- generate:minimal-ask -->` (Part C) and `<!-- generate:proposal-summary -->` (the Appendix, unmarked entries
  only). The APX Data Dictionary's "APDS status" column now says "Requested" or "Offered for later".

Why a field on the entry and not a separate list: the request stays next to the definition it requests, the existing
duplicate and vocabulary checks cover it, and widening the request is a one-line, reviewable YAML change.

Alternatives considered:

- **Tier 0.** Rejected: tiers order the annex by readiness. Mixing "requested" into the same scale blurs the line the
  committee most needs to see.
- **Moving the annex proposals out of `spec/proposals/`.** Rejected: the generators, the vocabulary checks and the
  traceability from APX classes would all have to be rebuilt, for no gain.

## What changed in the documents

- `docs/apds-submission/`: new introduction (the ask is small; APX works today; the rest is offered for later), "What
  we ask of APDS" first, the domain overviews moved to Annex A, next steps reduced to the two requests.
- `docs/apx-specification/06-apds-requests.md`: Parts A to C are the request; old Parts C (other enumerations), D (data
  elements) and E (other suggestions) are now Appendix X.1 to X.3; open questions split into those for the request and
  "Questions for later".
- `docs/errata/drafts/`: eleven ticket drafts (C-015 to C-024, C-026), a hold note for C-025, and CR-001 for the five
  values. Files only; nothing filed.
- No change to the OpenAPI spec or `spec/dist`.

## Decisions for Rick

1. Confirm the minimal request: corrections plus five `EquipmentTypeEnum` values.
2. Confirm `exitVerifier` as the name and the definition above.
3. Confirm the annex wording: informative, no request, APX carries everything already.
4. Filing: one issue per draft, one combined issue, or the Data Dictionary process. C-018 as a comment on #47?
5. `docs/apds-change-requests.md` (the 2026-09-30 one-pager) now carries a short update note. Retire it in favour of 06,
   or keep it?
