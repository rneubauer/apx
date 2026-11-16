# APX documentation

This folder holds everything written about APX. Use the table to find the
right document for what you need to do.

## Where to start

| You want to | Read |
|---|---|
| Understand APX in five minutes, without technical detail | [Executive summary](executive-summary.md) |
| See every route and why it exists | [API overview](apx-overview.md) and the [route map](route-map.md) |
| Build an implementation | [Quickstart](quickstart.md), then the [PARCS Starter Profile](parcs-starter-profile.md) if you make PARCS equipment |
| Add your own fields or codes without breaking anyone | [Partner extension guide](partner-extension-guide.md) |
| Prove your implementation conforms | [Conformance and testing guide](conformance-and-testing.md) |
| Learn the simulator's browser UI, with screenshots | [Simulator user guide](user-guide/README.md) |
| Look up an operation, schema or field | [API reference](api/README.md) |
| Know why something is the way it is | [Decision records](decisions/README.md) |
| Work on this repository | [Developer guide](developer/README.md) |
| See what changed in each release | [CHANGELOG](../CHANGELOG.md) |

## What each folder holds

| Folder | Audience | What is in it |
|---|---|---|
| `standard/` | Implementers, certifiers | The written standard: Parts 0 to 26 and Annex A. Normative: it uses MUST, SHOULD and MAY in the RFC 2119 sense. |
| `scenarios/` | Implementers | Worked exchanges with real request and response bodies, each checked against the API in CI. `by-module/` holds the vetting suite, one file per conformance class. |
| `apx-specification/` | Standards groups, reviewers | APX written in the form of the APDS 4.1 documents (Overview, Information Model, Data Dictionary, Use Cases, Interface Specification, Requests to APDS). Mostly generated from the API. |
| `apds-submission/` | The APDS committee | Only the data elements APX asks APDS to add, written as additions to the APDS documents. Generated from `spec/proposals/`. |
| `api/` | Integrators | Where the generated API reference lives and how it is built. |
| `decisions/` | Everyone | Architecture decision records (ADRs). |
| `developer/` | People changing this repository | Architecture, code map, build and test, conventions. |
| `errata/` | The APDS maintainers | Corrections APX has filed against APDS 4.1. |
| `apx-additional-functions/` | Reviewers | Design notes for features requested by deployments, written before the change. |
| `site/` | Site builders | Sources for the GitHub Pages landing page. |

## Folders from the lab documentation standard that do not apply

APX is a specification, not an application someone installs, so it has
no `admin-guide/`. A `user-guide/` now exists and covers the simulator's
browser UI, the only runnable part. The nearest equivalents elsewhere are:

- **Using the simulator**: the [user guide](user-guide/README.md), the
  [simulator README](../packages/simulator/README.md) and the
  [demo runbook](../packages/simulator/DEMO.md).
- **Running the docs site**: the "Development" section of the
  [repository README](../README.md#development).

## Keeping docs current

Docs change in the same pull request as the change they describe. The pull
request template has a **Docs** section for this. Much of the
documentation is generated, and CI fails when it is out of date:

- `npm run apxdocs:check` fails if `apx-specification/` no longer matches
  the API.
- `npm run submission:check` fails if `apds-submission/` no longer matches
  `spec/proposals/`.
- `npm run scenarios:check` and `npm run examples:check` fail if a sample
  body no longer matches the API.
- `npm run docs:links` fails if a relative link in any Markdown file points
  at a file that does not exist.
