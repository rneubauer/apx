# ADR-0020: Cameras get their own decoration; lane-cameras stays unchanged

## Status

Accepted

## Date

2026-10-18 (design, with ADR 0014); in the CHANGELOG at 0.15.0
(2026-10-21)

## Context

`apds-ext:apx:lane-cameras@1.0` (added in 0.12.0, ADR 0008) says which
camera reads which lane and which way it faces. Site configuration (ADR
0014) needed more: cameras on ramps, stairwells, lobbies and elevators, or
built into a pay station; what each one looks at; how it streams; and how
long recordings are kept. Widening `lane-cameras@1.0` would have changed a
shape that LPR implementations already use.

## Decision

- A separate decoration, `apds-ext:apx:camera@1.0` (`CameraDetail`), is
  added. It sits on equipment whose `apds-ext:apx:equipment-detail@1.0` role
  is `camera`, anywhere in the place.
- `apds-ext:apx:lane-cameras@1.0` is unchanged. It stays the LPR module's
  statement of which camera reads which lane (Part 13 §13.3a(5)).
- `CameraDetail` requires `view[]` (at least one of `plate`, `vehicle`,
  `driver`, `equipmentInteraction`, `pedestrians`, `areaOverview`, `other`).
  It also carries `mounting`, `faces` (same meaning as in lane-cameras),
  `primary`, `ptz`, `recorder`, `streams[]`, `retentionDays` and
  `credentialRef`.
- The decoration holds no address, user name or password. Views come from
  `POST /v1/cameras/{id}/views` as short-lived links (Part 26 §26.3).

## Consequences

- Two decorations can name the same camera. Where a camera reads a lane,
  `lane-cameras` is the LPR statement and `camera` describes the device.
- Nothing already published changed, so the change is additive.
- Camera models and stream profiles follow ONVIF and are not redefined.

## References

- Part 26 §26.3 (cameras)
- `spec/dist/apx-v1.yaml`: `CameraDetail`, and the note on it that
  `apds-ext:apx:lane-cameras@1.0` is unchanged
- ADR 0008 (lane cameras), ADR 0014 (site configuration)
- CHANGELOG 0.15.0 (2026-10-21)
