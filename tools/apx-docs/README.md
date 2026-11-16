# tools/apx-docs

Shared code for the generated document sets: `docs/apx-specification/` and
`docs/apds-submission/`. These modules are imported by the scripts in
[`tools/`](../README.md). Nothing here runs on its own.

- `model.mjs`: reads the bundled OpenAPI document and builds the model the documents come from: modules (one per `spec/openapi/domains/` folder), classes, members, enumerations, code lists and operations.
- `data-dictionary.mjs`: renders 03 Data Dictionary in the layout of the APDS 4.1 Data Dictionary.
- `information-model.mjs`: renders 02 Information Model: the hand-written module text, then a class diagram and tables made from the OpenAPI document.
- `interface.mjs`: renders 05 Interface Specification: every operation and webhook, grouped as the API reference groups them.
- `md.mjs`: small Markdown helpers (table cells, rows, tables) used by the renderers.
- `print.mjs`: page furniture shared by the renderers: wordmark, stylesheet, Mermaid theme, HTML wrapper, and a minimal Chrome client that prints a page to PDF.
- `apx-wordmark.png`: the wordmark image used by `print.mjs`.
