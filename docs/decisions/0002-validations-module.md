# ADR-0002: Validations module with a merchant scope

## Status

Accepted

## Date

2026-09-19

## Context

Part 6 §6.3 already had the call-center side of validations: a provider
lookup and the `applyValidation` command. Operators also need merchant
enrolment, stock of validation codes, a redemption ledger and month-end
billing. APDS records only that a validation happened
(`Segment.validationId`).

## Decision

- Add the optional class `apx-validations` with the full lifecycle:
  programs, issuance of codes, redemption and billing statements, under
  `/v1/validations`.
- Add a merchant-confined scope, `apx.validations:redeem`, bound to the
  caller's organization (`apx_org`).
- Statements can be previewed for any period and closed into immutable,
  non-overlapping records. Preview is `GET …/statement`; closing is
  `POST …/statements`.
- Use a small closed rule set: `maxPerTicket`, `maxPerDay`, `validityWindow`,
  `stackable`, `applicableRateTables`. Anything else goes in `extensions`.
- Program edits use a versioned `PUT` (409 `version-conflict`).
- `ValidationRedemption` is the record that reduces the amount due. Every
  channel writes it, including `applyValidation` from the call center.

## Consequences

- The Part 6 provider lookup now derives from active programs, and
  `ValidationProvider` gained an additive `program` field.
- No new registry was needed.
- Left out on purpose: invoicing or money movement for statements,
  multi-currency programs, and day-of-week or minimum-spend rules.

## References

- Part 20 §20.1–20.8, in particular §20.3 (rule set), §20.5 (merchant scope)
  and §20.6 (billing statements)
- Part 6 §6.3
- CHANGELOG 0.5.0 (2026-09-19)
