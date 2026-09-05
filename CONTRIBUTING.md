# Contributing to APX

APX is an open standard, stewarded by Umojo, developed in the open. Changes
of any size — typo fixes to new domains — follow the same path: a pull
request against `main`.

## Ground rules (from the written standard)

1. **APDS-first prime directive** (Part 0 §0.2): never redefine, subset, or
   re-shape anything APDS 4.1 already defines. The vendored
   `spec/vendor/apds/4.1/` tree is checksum-guarded and MUST NOT be edited.
2. **Additive by default** (Part 3): within a major version, changes must
   not break a conforming client or server. The CI breaking-change gate
   (oasdiff) enforces this mechanically on every PR.
3. **The OpenAPI document is normative** (Part 0 §0.5): where prose and
   `spec/openapi/` disagree, the OpenAPI wins and the prose gets fixed.
4. **Registries are add-only** (Part 11): new code-list entries append with
   the next `entryIndex` and bump the registry `version`; entries are never
   removed or renumbered.

## The mechanics

```powershell
npm install
npm test        # the full gate: vendor, registries, lint, bundle, profile,
                # style, schema examples, scenario payloads
```

- Edit the modular source under `spec/openapi/`, never `spec/dist/` by
  hand — then run `npm run spec:bundle && npm run spec:profile` and commit
  the regenerated `spec/dist/*` (CI verifies they match the source).
- Spec changes need matching prose in `docs/standard/` (and vice versa),
  plus a `CHANGELOG.md` entry.
- New wire examples belong in `docs/scenarios/` with `apx:validate`
  markers so CI validates them against the schemas forever.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`,
  `ci:`, `chore:`).

## What a PR needs to merge

1. Green CI (all validators, both OSes, dist freshness, breaking-change
   gate).
2. Review sign-off from a maintainer.
3. For normative changes: a sentence in the PR description on APDS
   alignment — what APDS defines today, why this is additive.

## Governance

- **Today:** Umojo stewards the specification; changes merge per the PR
  gates above. Registry entries follow the registration-authority policy
  in Part 11 §11.3 (open to anyone, 60-day decision, appeal path).
- **Intended end state:** shared industry governance. The submission goal
  is adoption by the Alliance for Parking Data Standards; on adoption,
  change control and the registration authority transfer to the APDS
  process, and Part 3 §3.3(8) governs reconciliation of anything APDS
  standardizes natively in the meantime. Until then, substantial
  proposals from other vendors/operators are decided in the open on the
  issue tracker, with rejections reasoned in writing.
- **Editions:** maintainers cut editions (Part 3 §3.2/§3.5); every
  edition's normative artifacts are tagged in git and immutable once
  published.

## Licensing and IPR

APX is MIT-licensed. By submitting a contribution you agree it is licensed
under the repository's MIT license. Portions reference the APDS API
Specification (MIT, © Alliance for Parking Data Standards); nothing in a
contribution may modify vendored APDS artifacts.

*Patent intent (subject to formal legal review before any standards-body
submission):* the steward intends that implementing APX requires no
royalty — contributions are accepted on the understanding that any
essential claims a contributor holds are made available royalty-free
(RAND-Z) to implementers of the specification. A formal declaration will
accompany the standards-body submission.

## Questions and proposals

Open a GitHub issue for defects and clarification requests. For substantial
proposals (new domains, new conformance classes), open an issue describing
the use case first — design discussion happens before spec text.
