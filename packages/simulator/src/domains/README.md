# src/domains

One behaviour module per conformance class. Each module default-exports
`{ name, register(sim) }`. `index.mjs` loads them all from this folder, except
`index.mjs` and `common.mjs`. `control` and `data` load first, because other
modules call into them. The part of the standard each module follows is named
in its header comment. Part of the [simulator](../../README.md).

| File | What it does |
|---|---|
| `index.mjs` | Discovers and loads the domain modules. |
| `common.mjs` | Helpers every module shares: pagination, status history, visibility checks, reference resolution, and the change feed. |
| `data.mjs` | `apx-data` (Part 5): the APDS native routes, update modes, change feed, occupancy. |
| `control.mjs` | `apx-control` (Part 6): commands, device status, lane inquiry, validation providers, negotiated rates. |
| `events.mjs` | `apx-events` and `apx-events-sse` (Part 8): subscriptions, delivery ledger, SSE stream. |
| `alerts.mjs` | `apx-alerts` (Part 7): alert lifecycle and server-raised alerts. |
| `discovery.mjs` | `apx-discovery` (Part 16): bootstrap and capability documents. |
| `accounts.mjs` | `apx-accounts` and `apx-payment-history` (Part 13). |
| `lpr.mjs` | `apx-lpr` (Parts 13 and 17): plate and ticket cross-lookup, plate correction. |
| `reservations.mjs` | `apx-reservations` and `apx-permits` (Part 14). |
| `tolling.mjs` | `apx-tolling` (Part 15). |
| `resolution.mjs` | `apx-resolution` (Part 17). |
| `violations.mjs` | `apx-violations` (Part 19). |
| `validations.mjs` | `apx-validations` (Part 20). |
| `credentials.mjs` | `apx-credentials` (Part 21). |
| `valet.mjs` | `apx-valet` (Part 22). |
| `charging.mjs` | `apx-charging` (Part 23). |
| `platelists.mjs` | `apx-plate-lists` (Part 24). |
| `uilaunch.mjs` | `apx-ui-launch` (Part 25). |
| `siteconfig.mjs` | `apx-site-config` (Part 26). |
| `digest.mjs` | Credential digest keys (Part 9 §9.6 rule 6). |

A folder with the same name as a module (for example `violations/`) holds the
parts of that module, split by job.
