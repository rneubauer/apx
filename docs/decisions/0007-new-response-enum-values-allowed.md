# ADR-0007: New values in response enums are allowed before 1.0

## Status

Accepted

## Date

2026-09-28

## Context

Pull request CI runs an oasdiff breaking-change gate. oasdiff flags a new
value in a response enum as breaking (`response-property-enum-value-added`),
because an old client may not know the value. APX keeps adding values to
enums as modules grow.

## Decision

Adding a value to a response enum is acceptable. The reason given: there are
no existing clients, and this is a brand new unpublished spec. When the gate
fails for this reason, explain the finding. Do not design around it.

## Consequences

- When a release adds such a value, the findings are listed with the reason
  in `spec/oasdiff/err-ignore.txt`, and the file is emptied after the release
  ships. 0.15.0 did this for the new `ui` value in
  `AllowedAction.execution.type`.
- Clients are told to cope: Part 17 §17.3 rule 6 says a client MUST skip an
  execution type it does not recognise, so the value set can keep growing.
- All other changes stay additive.

## References

- Part 17 §17.3 rule 6
- Part 3 (conformance and versioning)
- CHANGELOG 0.15.0 (2026-10-21), "Compatibility"
