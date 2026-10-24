# APX Specification documents

This folder documents APX in the same form as the APDS 4.1 technical
documentation, which the standards group asked for. It covers two
things:

- **What APX has:** every data element and operation in the APX API.
- **What APX needs from APDS:** every addition to, or change in, APDS 4.1
  that APX asks for.

| Document | Modelled on | What it holds | How it is made |
| --- | --- | --- | --- |
| [01 Overview](01-overview.md) | APDS Overview 4.1 | Mission, principles, relationship to APDS, each module and its benefits, security, conformance | Written by hand |
| [02 Information Model](02-information-model.md) | APDS Information Model 4.1 | Each module's concepts, lifecycles and relationship to APDS, with class diagrams in the APDS form (one figure per group of related classes) and summary tables | Prose in `src/im/`, plus diagrams and tables generated from the API |
| [03 Data Dictionary](03-data-dictionary.md) | APDS Data Dictionary 4.1 | Every class, attribute, association, enumeration and code list in the API, in the APDS table format | Generated from `spec/dist/apx-v1.yaml` |
| [04 Use Case Document](04-use-cases.md) | APDS Use Case Document 4.1 | 40 use cases (the 32 worked scenarios, and eight drawn from the module suites for UI launch, site configuration, approvals, receipts, display records with stay compliance, and the stay grace), the module scenario suites, and the code lists | Prose in `src/uc-part*.md` |
| [05 Interface Specification](05-interface-specification.md) | `apds-api-4.1.yaml` | Every operation and webhook, with parameters, bodies, responses and scopes | Generated from `spec/dist/apx-v1.yaml` |
| [06 Requests to APDS](06-apds-requests.md) | APX change requests | Corrections, Data Dictionary differences, new enumeration values, new data elements and other suggestions | Prose in `src/06-apds-requests.md`, plus proposal tables generated from `spec/proposals/` |

The narrower package in [`docs/apds-submission/`](../apds-submission/README.md)
holds only the proposed data elements, written as additions to the APDS
documents. 06 summarizes it and links to it.

## Building

- `npm run apxdocs:build` rebuilds 02 to 06 from the API and the sources.
- `npm run apxdocs:check` fails when a generated document is out of date.
  `npm test` and CI run it, so a change to the API that is not reflected
  here fails the build.
- `npm run apxdocs:html` renders the six documents to `site/specification/`
  for the GitHub Pages site, each with a table of contents, in the same
  style as the print edition. `npm run docs:build` runs it.
- `npm run apxdocs:pdf` renders all six documents to print-ready PDFs in
  `site/apx-specification/`, in the form of the APDS 4.1 documents: a
  centred cover, the APX mark on every page, a footer naming the document
  and its release beside the page number, Arial text, and class diagrams
  drawn as beige «D2Class» boxes. It needs Edge or Chrome and network
  access for the diagrams, and is not part of `npm test`.

The page furniture (stylesheet, cover, header and footer, diagram theme)
is `tools/apx-docs/print.mjs`, shared by both renderers.

## Sources

| Path | Holds |
| --- | --- |
| `src/_im-intro.md`, `src/_im-outro.md` | The Information Model's opening and closing sections |
| `src/im/<module>.md` | One narrative per module, with the headings Purpose, Concepts, Lifecycle and Relationship to APDS |
| `src/_dd-intro.md` | The Data Dictionary introduction |
| `src/definitions.yaml` | Definitions written from the standard text for members and enumeration values that the API leaves undescribed; marked † in 03 |
| `src/uc-part1.md`, `src/uc-part2.md` | The use cases |
| `src/_if-intro.md` | The Interface Specification introduction |
| `src/06-apds-requests.md` | The requests to APDS; the marker `<!-- generate:proposal-summary -->` is replaced with the proposal tables |

The generator is `tools/build-apx-docs.mjs`, with its modules in
`tools/apx-docs/`.
