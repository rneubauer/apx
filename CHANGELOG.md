# Changelog

All notable changes to the APX standard. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions follow the
conformance/versioning rules in Part 3 of the written standard.
The machine-readable spec (`spec/openapi/apx.yaml`, bundled as
`spec/dist/apx-v1.*`) is normative; entries here are informative.

## [0.2.0] — 2026-09-02

Submission-readiness revision: fixes the seven blockers from the
pre-committee review. One breaking change (see below), permitted pre-1.0.

### Added
- **Data-profile overlay** (`spec/openapi/overlays/apx-data-overlay.yaml`,
  OpenAPI Overlay 1.0) — the Part 5 `mode`/`cursor` parameters and
  `ChangeFeedPage` response alternate are now machine-readable on the four
  §5.6 routes. Applied to the dist bundle by `npm run spec:bundle`
  (`tools/apply-overlay.mjs`); declared a normative artifact (Part 0 §0.5,
  Part 3 §3.4). Part 5 documents the native-routes-vs-parallel-route trade.
- **Privacy and data protection** (Part 9 §9.6): minimization,
  access-controlled imagery, published retention with purge capability,
  purpose limitation, and the truncated-key window as a hard control.
- **Event place binding** (Part 8 §8.5): a normative per-topic rule for
  how events bind to a HierarchyElement, and grant-safe `filters.places`
  semantics (drop rather than leak).
- **Site binding on aggregators** (Part 13 §13.5): place-less lookups
  (`/v1/accounts`, `/v1/payments`, `/v1/lpr/reads`) MUST be constrained
  to the caller's `apx_places` grant; optional `place` narrowing.
- Shared `401`/`403` problem responses declared on all APX list/read
  operations (previously only two operations declared them).
- APDS's own `oAuth` security scheme is now included in the bundle —
  vendored operations no longer reference an undefined scheme.

### Changed
- **BREAKING:** `PaymentRecord.place` and `LprRead.place` are now REQUIRED
  (APDS `Reference` to the HierarchyElement) so payments and plate reads
  are always attributable to their site; `Account.places` added
  (optional). Scenario payloads updated.
- `POST /webhooks` now preserves the stock APDS 4.1 response contract
  (`200`/`202` + `ResponseStatus`); the APX-rich `201` (subscription +
  one-time secret) is selected with `Prefer: return=representation`
  (Part 8 §8.1). A plain APDS client observes pure APDS behavior.
- Part 0 §0.5 precedence rule scoped: effective OpenAPI prevails for
  APX-defined paths; the vendored APDS document prevails for native paths.
- Part 3: §3.1 now lists `apx-control` and `apx-alerts` among the optional
  classes; §3.4 names Parts 0–16 (not 0–12) as normative.
- Server URL placeholder no longer uses `example.com`; remaining
  Redocly lint warnings resolved (declared 4XX responses).

### Removed
- All references to the unpublished internal "2018" requirements document;
  the affected requirements now stand on their own text (Parts 6, 13,
  control/accounts/LPR schema descriptions).

## [0.1.1] — 2026-08-25

### Added
- **Occupancy snapshot** (Part 5 §5.5): `GET /v1/places/{id}/occupancy`
  returns an `OccupancySnapshot` — verbatim APDS `Supply` + latest
  `DemandType` plus a derived, clamped `available` count. Required for
  `apx-data` implementations that hold occupancy data. Included in the
  PARCS Starter Profile (now 26 paths).
- **Analytics event topics** (registry `apx-topics` v3, Part 13 §13.4):
  `apx.data.occupancy.v1` (occupancy movement),
  `apx.accounts.payment.recorded.v1` (every recorded payment), and
  `apx.data.observation.created.v1` (every ingested LPR/sensor
  Observation) — closing the APDS `EventTypeEnum` gaps for financial and
  sensor analytics.
- **Route map** (`docs/route-map.md`): maps conventional place-nested REST
  expectations to the actual APDS/APX routes, with curl examples.
- **Tooling**: PR breaking-change gate (oasdiff) in CI; reference docs
  published to GitHub Pages on every push to `main`; `npm run mock`
  (Prism mock server); `npm run docs:build`.
- **Governance**: this changelog and `CONTRIBUTING.md`.

### Fixed
- Part 0 §0.5 documents table now lists Parts 13–16.
- `docs/apx-overview.md` covers the occupancy read and analytics topics.

## [0.1.0] — 2026-08-21

Initial complete v1 draft. All domains specified: data profile (Part 5),
delivery fabric (Part 8), control (Part 6), alerts (Part 7), security
(Part 9), extensibility & registries (Parts 10–11), errors (Part 12),
accounts/payments/LPR (Part 13), reservations & permits (Part 14),
tolling (Part 15), discovery (Part 16). APDS 4.1 vendored verbatim,
checksum-guarded. Six spec-validated end-to-end scenarios. PARCS Starter
Profile subset. CI validation on Ubuntu and Windows.
