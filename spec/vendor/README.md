# spec/vendor

APDS 4.1 (the Alliance for Parking Data Standards API) copied in unchanged,
in `apds/4.1/`:

- `apds-api-4.1.yaml` is the upstream OpenAPI file.
- `LICENSE` is the upstream licence.
- `CHECKSUM.sha256` records the SHA-256 of the vendored file.

## Why it is vendored verbatim

APX is additive and puts APDS first (Part 0 §0.2). It mounts APDS routes and
`$ref`s APDS schemas as they are, so the copy has to be exactly what APDS
published. Part 1 §1.1 names the upstream commit it matches.

## The guard

`tools/check-vendor.mjs` (`npm run vendor:check`) recomputes the checksum of
each vendored file and compares it with `CHECKSUM.sha256`. CI fails on any
difference.

Never edit these files. Anything APX needs to change about an APDS route is
done in `spec/openapi/overlays/apx-data-overlay.yaml` on the bundle instead.
