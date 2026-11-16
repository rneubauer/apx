# ADR-0009: Negotiated rates may push any amount

## Status

Accepted. Supersedes the "no free-form amount" rule in
[ADR-0006](0006-negotiated-rates-and-ticket-matching.md).

## Date

2026-10-08

## Context

[ADR-0006](0006-negotiated-rates-and-ticket-matching.md) allowed an agent to
pick only a flagged table from the rate deck. The requirement changed: the
negotiated rate must be able to push any amount.

## Decision

- Add the optional feature `negotiatedAmounts`, offered only together with
  `negotiatedRates`.
- `pushNegotiatedRate.parameters.amount` (AmountInCurrency) states what the
  current ticket owes. There is no floor or ceiling, and zero is allowed.
- Exactly one of `rateTable` or `amount` is sent.
- `agent` and `reason` are REQUIRED with an amount.
- Both or neither member, a negative value, or the wrong currency is
  `400 invalid-request`. An amount on a host without the feature is
  `422 rate-not-negotiable`.
- The lane inquiry reports it in a new sibling,
  `currentTicket.negotiatedAmount`, so `negotiatedRate` and its required
  `rateTable` stay unchanged.

## Consequences

- Part 6 §6.3 now names this as the one single-ticket price change outside
  validations, attributable to an agent with a reason.
- Guardrails stay with the host: either do not offer the feature, or require
  approval through Part 17 §17.3 `requiresApproval`.

## References

- Part 6 §6.3, §6.6
- Annex A APX-CTL-16
- CHANGELOG 0.14.0 (2026-10-12)
