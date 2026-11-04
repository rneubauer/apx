# worlds

Fixtures a run starts from, as JSON. A world names the organisations, the
place hierarchy with lanes and devices, credentials, simulated receivers and
the seed data of each domain. Ids may be written `b1…0001`. Most worlds
`extends` another. Load one with `POST /sim/reset {"world": "<name>"}` or
`apx-sim serve --world <name>`. Loaded by `src/kernel/world.mjs`. Part of the
[simulator](../README.md).

| File | What it is |
|---|---|
| `base-lakeside.json` | The shared cast: Lakeside Parking and Harbor Parking, with their garages and named credentials. |
| `default.json` | Lakeside Garage for ad-hoc play: the control world with every conformance class claimed. |
| `analytics-lakeside.json` | The analytics cast: Lakeside Garage with ten transient visits and their payments. |
| `apx-discovery-wallboard.json` | `apx-discovery` with a read-only wall dashboard as the default credential. |
| `apx-site-config.json` | Lakeside Garage described from APX alone. Extends `apx-resolution`. |
| `apx-ui-launch.json` | A garage whose PARCS vendor has its own console. Extends `apx-site-config`. |
| `apx-plate-lists.json` | Plate lists at Lakeside Garage and Harbor Deck (Part 24). |
| `apx-charging.json` | The cast of the EV charging scenario. |

The other `apx-<module>.json` files each hold the cast of the vetting
scenarios in `docs/scenarios/by-module/apx-<module>`: `accounts`, `alerts`,
`control`, `credentials`, `data`, `discovery`, `events`, `lpr`, `permits`,
`reservations`, `resolution`, `tolling`, `valet`, `validations` and
`violations`.
