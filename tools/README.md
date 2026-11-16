# tools

Build and check scripts for the repository. The
[tools table in the developer guide](../docs/developer/README.md#tools) says
which npm script runs each one and what it does.

Files here:

- `add-change-feed.mjs`: one-off editor that adds the change-feed parameters to list routes in `spec/openapi/apx.yaml`.
- `apply-overlay.mjs`: applies the three overlays to the bundle.
- `build-apds-submission.mjs`, `build-apds-submission-pdf.mjs`: build the APDS submission documents, and print a document set to PDF.
- `build-apx-docs.mjs`, `build-apx-docs-html.mjs`: build the APX Specification document set, and render it to HTML for the site.
- `build-edition.mjs`: writes `spec/edition.json`.
- `build-profile-spec.mjs`: builds the PARCS starter profile bundle.
- `build-reference-input.mjs`: writes the input for the Redoc reference page.
- `build-site.mjs`: assembles the GitHub Pages site into `site/`.
- `build-standard.mjs`: joins `docs/standard/*.md` into one document.
- `change-payloads.mjs`: derives a typed change payload for each native APDS PUT.
- `check-apx-docs-coverage.mjs`: checks the Data Dictionary covers every APX class, member and code-list entry.
- `check-doc-links.mjs`: fails on a relative Markdown link that points at nothing.
- `check-registries.mjs`: validates the registries.
- `check-vendor.mjs`: fails if the vendored APDS files changed.
- `redocly.yaml`: configuration for the bundler.
- `site-icons.mjs`: icons for the module index on the landing page.
- `validate-examples.mjs`: validates the examples in the bundle.
- `validate-scenarios.mjs`: validates the marked payloads in `docs/scenarios/`.
- `vetting-scenarios.mjs`: runs the vetting suite and reports coverage.
- [`apx-docs/`](apx-docs/README.md): shared code for the document sets.
