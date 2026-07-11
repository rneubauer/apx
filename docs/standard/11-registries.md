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

Registries are published at the `locator` URLs and mirrored in
`/.well-known/apx-configuration.registries`. An implementation MUST serve or
link the registry versions it validates against.
