# spec/registries

The code lists APX publishes. Each `apx-*.json` file is an APDS
UserDefinedCodeList, checked against `registry.schema.json` by
`npm run registries:check`. Part 11 of the standard
([`docs/standard/11-registries.md`](../../docs/standard/11-registries.md))
defines them all. The Part in the last column says where the values are used.

| File | Purpose | Part |
|---|---|---|
| `apx-access-denial-reasons` | Why a credential was refused at a lane | 21 |
| `apx-alert-types` | Alert taxonomy | 7 |
| `apx-area-types` | Where an item stands in a location | 26 |
| `apx-command-types` | Command plane verbs | 6 |
| `apx-comms-point-types` | How a parker reaches help at a point | 26 |
| `apx-conformance-classes` | The conformance classes | 3 |
| `apx-device-states` | Device state values | 6 |
| `apx-display-message-kinds` | Which message a sign showed | 26 |
| `apx-equipment-roles` | What a piece of hardware does | 26 |
| `apx-escalation-roles` | Whom an agent escalates to | 26, 17 |
| `apx-features` | Optional features of a conformance class | 6, 16 |
| `apx-interaction-outcomes` | How a support interaction ended | 17 |
| `apx-issue-types` | Resolution issue classification | 17 |
| `apx-payment-line-codes` | The lines a payment total is made of | 13 |
| `apx-plate-list-categories` | Plate list categories | 24 |
| `apx-read-review-reasons` | Why a read went to human review | 13 |
| `apx-refund-reasons` | Why a payment was refunded | 13 |
| `apx-session-end-reasons` | Why and how a session ended | 5 |
| `apx-stay-compliance-flags` | Facts behind a stay's compliance status | 5 |
| `apx-stay-compliance-statuses` | The outcome of scoring a stay | 5 |
| `apx-toll-dispute-reasons` | Toll dispute reasons | 15 |
| `apx-toll-dispute-resolutions` | Toll dispute resolutions | 15 |
| `apx-topics` | Event topics | 8 |
| `apx-ui-surfaces` | Screens an implementation may offer to staff | 25 |
| `apx-violation-types` | Enforcement violation classification | 19 |

## The add-only rule

Entries are never removed and never change meaning. To add a value:

1. Append an entry with the next free `entryIndex`.
2. Raise the list's `version`.
3. Run `npm run spec:bundle` so `spec/edition.json` picks up the new version.

`definedValue` and `entryIndex` must each be unique within a list.
