# API reference

The APX API reference is generated from the OpenAPI source on every push to
`main`. It is never written by hand, so it always matches the API.

## Where to read it

| What | Where |
|---|---|
| Full reference, every operation and schema, searchable | <https://rneubauer.github.io/apx/reference.html> |
| PARCS Starter Profile, the minimum surface for PARCS equipment | <https://rneubauer.github.io/apx/parcs.html> |
| Interface Specification in the APDS document form | [`../apx-specification/05-interface-specification.md`](../apx-specification/05-interface-specification.md) |
| Data Dictionary, every class, attribute and code list | [`../apx-specification/03-data-dictionary.md`](../apx-specification/03-data-dictionary.md) |

## Machine-readable files

Each release attaches these to its GitHub release, and the site serves the
current ones:

| File | What it is |
|---|---|
| `apx-v1.yaml`, `apx-v1.json` | The whole API as one OpenAPI 3.1 document |
| `apx-parcs.json` | The PARCS Starter Profile as its own importable document |
| `edition.json` | The edition: version, APDS release, and checksums of the files above |
| `registries/*.json` | The code lists (alert types, command types, topics, conformance classes and others) |

Import `apx-v1.yaml` into Postman, Insomnia or a code generator to get a
client. `npm run mock` serves schema-valid fake responses from it on port
4010.

## How it is built

1. The source is `spec/openapi/apx.yaml` with one folder per domain under
   `spec/openapi/domains/`.
2. `npm run spec:bundle` resolves it into `spec/dist/apx-v1.yaml` and
   `.json`, applies the overlays in `spec/openapi/overlays/`, and writes
   `spec/edition.json`. These outputs are committed, and CI fails if they
   are stale.
3. `npm run docs:build` renders the reference with Redocly into
   `site/reference.html` and `site/parcs.html`. The Docs workflow
   (`.github/workflows/docs.yml`) runs it and publishes `site/` to GitHub
   Pages.

## Examples

- [Quickstart](../quickstart.md): first calls, step by step.
- [Scenarios](../scenarios/README.md): complete exchanges with real
  request and response bodies, each validated against the bundle in CI.
- The [simulator](https://rneubauer.github.io/apx/simulator/): call any
  operation in the browser and watch the responses and events.
