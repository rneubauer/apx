# spec/openapi

The OpenAPI 3.1 source of APX.

- `apx.yaml` is the root file. It holds the `paths`, the `tags` and the
  `components`. The APDS 4.1 routes are mounted in it from the vendored copy.
- [`domains/`](domains/README.md) has one folder per domain. Each folder
  holds a `schemas.yaml` with that domain's schemas.
- [`overlays/`](overlays/README.md) has three OpenAPI Overlay files that are
  applied to the bundle after it is built.

## How apx.yaml uses a domain

`apx.yaml` does not pull in a whole folder. It points at one schema at a time,
for example under `components.schemas`:

```yaml
LprRead:
  $ref: "./domains/lpr/schemas.yaml#/LprRead"
```

## Add a domain

1. Create `domains/<name>/schemas.yaml` with a bare map of schemas.
2. In `apx.yaml`, add a `$ref` for each schema you want to use, under
   `components.schemas`, in the form shown above.
3. Add the routes under `paths:` in `apx.yaml`, and a tag under `tags:`.
4. Run `npm run spec:bundle` to rebuild `spec/dist/` and `spec/edition.json`.

See the [developer guide](../../docs/developer/README.md) for the full
workflow and [CONTRIBUTING.md](../../CONTRIBUTING.md) for the ground rules.
