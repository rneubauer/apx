# spec/openapi/overlays

Three OpenAPI Overlay 1.0 files. `tools/apply-overlay.mjs` applies them to the
bundled `spec/dist/apx-v1.yaml` and `.json`, as the last bundling step of
`npm run spec:bundle`. The result is the effective API description.

They are applied in this order:

| Order | File | What it changes |
|---|---|---|
| 1 | `apx-data-overlay.yaml` | The Part 5 data profile. Adds the `mode` and `cursor` parameters and the change-feed responses to the routes. This cannot live in the source, because the vendored APDS path items must not be edited. This overlay is normative. |
| 2 | `apx-docs-overlay.yaml` | The reading layer for the reference: the orientation text in `info.description`, a description on each tag, and the `x-tagGroups` navigation. |
| 3 | `apx-examples-overlay.yaml` | One worked payload per resource schema. Each is copied from `docs/scenarios/` and checked again by `npm run examples:check`. |

After the three overlays, `tools/change-payloads.mjs` derives a typed change
payload for each of the native APDS PUT routes (Part 5 §5.1a).

The script skips itself if the overlays were already applied, so running it
twice does no harm.
