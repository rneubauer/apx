# APX Part 11 — Registries

APX open vocabularies are published as **APDS UserDefinedCodeList documents**
(PkCommon/CodeLists) in `spec/registries/`, validated in CI against
`registry.schema.json`.

| Registry | Purpose | Referenced from |
|---|---|---|
| `apx-command-types` | Command plane verbs | `Command.commandType` |
| `apx-alert-types` | Alert taxonomies (seeded from APDS Use Case C.2.2 exceptions/space statuses) | `Alert.alertType` |
| `apx-device-states` | Device state values (in the style of APDS `RefillPointStatusEnum`, which covers refill points only) | `DeviceStatus.deviceState` |
| `apx-topics` | APX event topics | `EventEnvelope.type`, subscriptions |
| `apx-conformance-classes` | Conformance classes | `.well-known/apx-configuration` |
| `apx-issue-types` | Resolution issue classification | `ResolutionIssue.code` (Part 17) |
| `apx-violation-types` | Enforcement violation classification (open; jurisdictional vocabularies extend it) | `Violation.violationType`, `EligibilityResult.suggestedViolationType` (Part 19) |
| `apx-toll-dispute-reasons` | Toll dispute reasons (open) | `TollTransaction.dispute.reason` (Part 15) |
| `apx-toll-dispute-resolutions` | Toll dispute resolutions (open) | `TollTransaction.dispute.resolution` (Part 15) |
| `apx-access-denial-reasons` | Why a credential was refused at a lane (open) | `CredentialAccessEvent.denialReason`, `AccessEvent.denialReason` (Part 21), lane inquiry `monthlyCredential.denialReason` (Part 6) |
| `apx-features` | Optional features of a conformance class | `features` in `/.well-known/apx-configuration` and discovery documents (Part 6 §6.5, Part 16) |
| `apx-session-end-reasons` | Why and how a Session ended (open) | `SessionDetail.closure.endReason` (Part 5 §5.8) |
| `apx-read-review-reasons` | Why a read was sent to human review (open) | `LprReadDetail.review.reasons` (Part 13 §13.3a(4a)) |
| `apx-payment-line-codes` | The lines a payment total is made of (open) | APDS `PaymentLine.idCode` in `PaymentDetail.lines[]` (Part 13 §13.6a) |
| `apx-plate-list-categories` | Plate list categories (open) | `PlateList.category` (Part 24) |
| `apx-ui-surfaces` | The screens an implementation may offer to staff, named `<module>.<view>`, each naming the subject class it opens (open: modules add surfaces) | `UiSurface.surface`, `UiLaunch.surface`, `AllowedAction.execution.surface` (Part 25) |
| `apx-interaction-outcomes` | How a support interaction ended (open) | `SupportInteraction.resolution.code` (Part 17 §17.6) |
| `apx-refund-reasons` | Why a payment was refunded (open) | Refund request `reasonCode` (Part 13 §13.1a) |
| `apx-equipment-roles` | What a piece of hardware does on a lane or in a place (fixed: implementations use the codes, only the maintainers add) | `EquipmentDetail.role` (Part 26 §26.1) |
| `apx-area-types` | Where an item stands in a location (fixed) | `EquipmentDetail.area` (Part 26 §26.2) |
| `apx-comms-point-types` | How a parker reaches help at a point (fixed) | `CommsPoint.type` (Part 26 §26.4) |
| `apx-escalation-roles` | Whom an agent escalates to, as roles (fixed) | `PlaceOperations.escalationContacts[].role`, `ApprovalRequest.role` (Part 26 §26.5, Part 17 §17.3a) |
| `apx-display-message-kinds` | Which message a sign showed (open: a location's own messages are implementer codes) | `DisplayRecord.messageKind` (Part 26 §26.9) |
| `apx-stay-compliance-statuses` | The outcome of scoring a stay, each with its family (open: other engines add their own) | `StayCompliance.status`, `StayCompliance.pendingStatus` (Part 5 §5.9) |
| `apx-stay-compliance-flags` | Facts behind a stay's compliance status (open) | `StayCompliance.flags[]` (Part 5 §5.9) |

Registries marked **fixed** still follow §11.1: entries are added, never
removed or re-meant. They differ from the open ones in that an
implementer does not extend them with a list of its own; a value that is
missing is requested per §11.3 and used as `other` meanwhile.

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

## 11.1a Choosing the form of a vocabulary (normative)

Every coded value APX defines takes exactly one of four forms, chosen in
this order:

1. **APDS already defines it** → the APDS enum or code list, by `$ref`
   (Part 0 §0.2, Part 4 §4.4). Example: `PaymentRecord.meansOfPayment` is
   APDS `MeansOfPaymentEnum`.
2. **A closed set APX fully owns**, changing only between editions → an
   `enum` in the schema (an `other` value is the escape where one is
   needed). Examples: `Alert.severity`, `PaymentRecord.channel`, validation
   `method`.
3. **An open set that more than one party must interpret** — implementers
   or vendors add values, and clients, dashboards, or agents act on them →
   a registry in this Part, extended per §11.1(4). Examples: alert types,
   access denial reasons, features.
4. **A value meaningful only inside one implementation** → a plain string,
   with no values seeded by APX.

A field in form 3 is typed `string` and names its registry in its
description; the registry, not the schema, lists the values.

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
5. **Provider registrations** (§11.4) are pull requests against
   `spec/providers/apx-providers.json`, not issues. The APX maintainers
   review and merge registration pull requests against published
   criteria: the registrant is a real organisation; its `namespace` is
   unique and is not `apx`, `apds`, or a name that implies another
   organisation; its `contact` is organisational (a role mailbox or a
   URL, never a named person); and the entry impersonates no one. A
   registration that meets the criteria is merged; one that does not is
   answered on the pull request with the criterion it misses. No
   membership, fee, or edition is involved.

## 11.4 The provider registry (normative)

The provider registry lists every organisation that implements APX
(Part 3 §3.1a). It is `spec/providers/apx-providers.json`, validated in CI
against `spec/providers/provider.schema.json` by `npm run providers:check`,
and served from the specification site at
<https://rneubauer.github.io/apx/providers/> on the same terms as §11.2.
It is not an APDS UserDefinedCodeList, because an entry carries more than
a code, and it is not pinned by an edition (Part 3 §3.4).

Each entry has:

| Member | Required | Meaning |
|---|---|---|
| `providerId` | yes | A UUID the registrant generates (version 4), lowercase. The organisation's identity in APX data (Part 4 §4.1b). |
| `name` | yes | The organisation's name. |
| `namespace` | yes | The organisation's vendor namespace (Part 3 §3.3), lowercase, unique in the registry. One registration claims both the `providerId` and the namespace. |
| `url` | no | The organisation's public web site (`https`). |
| `roles` | yes | One or more of `parcs`, `lpr`, `enforcement`, `payments`, `reservations`, `permits`, `callCenter`, `analytics`, `charging`, `valet`, `platform`, `other`. |
| `contact` | yes | An organisational email address or URL. Never a named person. |
| `status` | yes | `active` or `retired`. |
| `registeredDate` | yes | The date the registration was merged. |

Rules:

1. The registry is **add-only**, like the code-list registries (§11.1):
   an entry is never deleted, reordered, or renumbered, and its
   `providerId`, `namespace`, and `registeredDate` never change. The
   organisation may update its own `name`, `url`, `roles`, and `contact`.
   A provider that stops implementing APX, or is merged into another, is
   **retired** (`status` `retired`), and a new organisation gets a new
   entry. A retired `providerId` or `namespace` is never reused, and a
   retired entry is never made active again.
2. The file carries a top-level `version` that increments on every
   change, an addition and a retirement alike.
3. `providerId` and `namespace` are unique across every entry, retired
   entries included.
4. A receiver SHOULD bind a provider's `providerId` to the credentials it
   issues to that provider, and SHOULD check that a `providerId` the
   provider asserts in data (`RecordInfo.provider`, the envelope
   `provider`) is its own or that of a provider whose data it is entitled
   to relay (Part 18 §18.2).
5. The steps to register are in `docs/registering-as-a-provider.md`.
