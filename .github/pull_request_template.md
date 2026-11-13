## What this changes

<!-- One paragraph. What was wrong or missing, and what the change does. -->

## Which artifacts

- [ ] Written standard (`docs/standard/`)
- [ ] OpenAPI source (`spec/openapi/`)
- [ ] Overlays (`spec/openapi/overlays/`)
- [ ] Registries (`spec/registries/`)
- [ ] Provider registry (`spec/providers/`): fill in the section below
- [ ] Scenarios (`docs/scenarios/`)
- [ ] Tooling or CI (`tools/`, `.github/`)

## Checks

- [ ] `npm test` passes locally
- [ ] `spec/dist/` and `spec/edition.json` are regenerated and committed
      (CI fails the build if they are stale)
- [ ] Any new wire payload carries an `apx:validate` marker, so it is
      checked against the bundle rather than merely plausible
- [ ] Registry changes are **add-only** and bump the list `version`
- [ ] The vendored APDS document under `spec/vendor/` is untouched

## Provider registration (delete if not a registration)

Steps and criteria: `docs/registering-as-a-provider.md` (Part 11 §11.3
rule 5, §11.4).

- [ ] A new entry is appended at the end of `providers`, or an existing
      entry of ours is updated or retired; no other entry is changed
- [ ] `providerId` is a new UUID v4 in lowercase, generated for this entry
- [ ] `namespace` is lowercase, unique, ours, and implies no other organisation
- [ ] `contact` is an organisational mailbox or URL, not a named person
- [ ] Top-level `version` incremented
- [ ] `npm run providers:check` passes
- Organisation, and how a maintainer can confirm it is real (web site,
  registry number, or similar):

## Compatibility

- [ ] Additive only: no route, field, or enum value removed or re-typed
- [ ] If this is breaking, say so here and explain why it is justified
      before 1.0

<!--
The oasdiff gate compares this branch's bundle against the base branch and
refuses a breaking change on its own. That is not a substitute for saying
out loud what you intend.
-->

## Anything the reviewer should push back on

<!-- Judgement calls, alternatives you rejected, parts you are unsure of. -->
