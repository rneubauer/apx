# APX Part 11 — Registries

APX open vocabularies are published as **APDS UserDefinedCodeList documents**
(PkCommon/CodeLists) in `spec/registries/`, validated in CI against
`registry.schema.json`.

| Registry | Purpose | Referenced from |
|---|---|---|
| `apx-command-types` | Command plane verbs | `Command.commandType` |
| `apx-alert-types` | Alert taxonomies (seeded from APDS Use Case C.2.2 exceptions/space statuses) | `Alert.alertType` |
| `apx-device-states` | Device state values (RefillPointStatusEnum style) | `DeviceStatus.deviceState` |
| `apx-topics` | APX event topics | `EventEnvelope.type`, subscriptions |
| `apx-conformance-classes` | Conformance classes | `.well-known/apx-configuration` |
| `apx-issue-types` | Resolution issue classification | `ResolutionIssue.code` (Part 17) |
| `apx-violation-types` | Enforcement violation classification (open; jurisdictional vocabularies extend it) | `Violation.violationType`, `EligibilityResult.suggestedViolationType` (Part 19) |

## 11.1 Rules

1. Registry entries are **add-only**; a definedValue is never removed or
   re-meant. Corrections happen via new entries + deprecation notes.
2. Every addition increments the list `version` (APDS PkCommon rule).
3. `entryIndex` is stable and unique within a list; `definedValue` is unique
   within a list.
4. Implementers extend vocabularies by publishing their OWN lists (with
   their own `creator` and `locator`) and referencing entries via
   `ReferencedCodeListEntry` / `CodeListValue.codeListId`. Implementers MUST
   NOT modify APX registry files.
5. Where severity/priority semantics matter (alerts), the closed enum in the
   schema governs; registries only carry open taxonomies.

## 11.2 Publication

Each registry declares a `locator` naming its permanent home under
`apx-standard.org`. That domain is **not yet delegated**, so until it is,
the authoritative published copies are served from the specification site:

- <https://rneubauer.github.io/apx/registries/> — an index, the registries
  as JSON, and `registry.schema.json`.

The files there are byte-identical to `spec/registries/` in the repository
and are republished by CI on every push to `main`, so the served copy cannot
drift from the copy CI validates. When the canonical domain is delegated the
`locator` values become live and these become mirrors.

An implementation MUST serve or link the registry versions it validates
against, and MUST advertise those URLs in
`/.well-known/apx-configuration.registries`. Advertising a URL that does not
resolve does not conform.

## 11.3 Registration authority (normative)

1. **Who may request an entry:** anyone — implementer, vendor, or
   operator — by opening an issue against the specification repository
   naming the registry, the proposed `definedValue`, and the use case. No
   membership is required.
2. **Decision:** the maintainers (the working group, once chartered —
   CONTRIBUTING.md) accept, reject with reasons, or defer within **60
   days**. Acceptance appends the entry at the next `entryIndex` and bumps
   the registry version; it never requires a new standard edition.
3. **Interim path:** a requester never has to wait — Part 3 §3.3 lets any
   vendor publish its own UserDefinedCodeList immediately and reference it
   via `CodeListValue.codeListId`; an accepted request migrates the value
   into the APX registry per §3.3(7).
4. **Appeal:** a rejected request may be re-raised with new evidence after
   one edition; should APDS adopt APX, appeals escalate to the APDS change
   process, and any registry value APDS later standardizes is reconciled
   per Part 3 §3.3(8).
