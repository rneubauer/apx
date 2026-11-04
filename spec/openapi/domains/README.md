# spec/openapi/domains

One folder per domain. Each holds a single `schemas.yaml`. The paths and the
`$ref`s to these schemas are in [`../apx.yaml`](../apx.yaml).

The conformance class comes from
[`spec/registries/apx-conformance-classes.json`](../../registries/apx-conformance-classes.json).
The Part is the one in [`docs/standard/`](../../../docs/standard/README.md)
that governs the domain, as listed in `tools/apx-docs/model.mjs`.

| Folder | Conformance class | Part |
|---|---|---|
| `accounts` | `apx-accounts`, `apx-payment-history` | [13](../../../docs/standard/13-accounts-payments-lpr.md) |
| `alerts` | `apx-alerts` | [7](../../../docs/standard/07-alerts.md) |
| `charging` | `apx-charging` | [23](../../../docs/standard/23-charging.md) |
| `common` | none (shared conventions) | 4, 5, 10 and 12 |
| `control` | `apx-control` | [6](../../../docs/standard/06-control.md) |
| `credentials` | `apx-credentials` | [21](../../../docs/standard/21-credentials.md) |
| `data` | `apx-data` | 5 and 18 |
| `discovery` | `apx-discovery` | [16](../../../docs/standard/16-discovery.md) |
| `events` | `apx-events`, `apx-events-sse` | [8](../../../docs/standard/08-events.md) |
| `lpr` | `apx-lpr` | [13](../../../docs/standard/13-accounts-payments-lpr.md) |
| `platelists` | `apx-plate-lists` | [24](../../../docs/standard/24-plate-lists.md) |
| `reservations` | `apx-reservations`, `apx-permits` | [14](../../../docs/standard/14-reservations-permits.md) |
| `resolution` | `apx-resolution` | [17](../../../docs/standard/17-resolution.md) |
| `siteconfig` | `apx-site-config` | [26](../../../docs/standard/26-site-configuration.md) |
| `tolling` | `apx-tolling` | [15](../../../docs/standard/15-tolling.md) |
| `ui` | `apx-ui-launch` | [25](../../../docs/standard/25-ui-launch.md) |
| `valet` | `apx-valet` | [22](../../../docs/standard/22-valet.md) |
| `validations` | `apx-validations` | [20](../../../docs/standard/20-validations.md) |
| `violations` | `apx-violations` | [19](../../../docs/standard/19-violations.md) |

The class `apx-mtls` has no domain folder: it is an optional hardening of all
endpoints (Part 9).
