# spec

The machine-readable part of APX: the OpenAPI source, the generated bundles,
the code-list registries and the checks that guard them. The written standard
is in [`docs/standard/`](../docs/standard/README.md).

| Path | What it holds |
|---|---|
| [`openapi/`](openapi/README.md) | The OpenAPI 3.1 source. `apx.yaml` is the root. This is the single source of truth. |
| `dist/` | The bundles built from the source: `apx-v1.yaml`, `apx-v1.json` and `apx-parcs.json` (the PARCS starter profile). |
| `edition.json` | Names exactly what one edition contains: the bundle checksums, registry versions, the APDS release and its checksum. |
| [`vendor/`](vendor/README.md) | APDS 4.1, copied in unchanged and checksum-guarded. |
| [`registries/`](registries/README.md) | The code lists (alert types, command types, topics and others). |
| [`proposals/`](proposals/README.md) | Data elements APX proposes to APDS. |
| [`oasdiff/`](oasdiff/README.md) | The list of accepted breaking-change findings for the CI gate. |

## Generated files

`dist/` and `edition.json` are generated and also committed. Never edit them
by hand. After you change `openapi/` or a registry, run:

```bash
npm run spec:bundle
```

CI rebuilds them and fails if the committed copies are different.
