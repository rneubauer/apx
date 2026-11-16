# ADR-0008: LPR reads record what happened; no derivation logic in APX

## Status

Accepted

## Date

2026-09-28

## Context

In 0.9.0 the server derived `LprRead.laneTravel` from plate face, movement,
camera orientation and lane type. An implementer with rear-reading cameras,
which is how almost every site is set up, got every result inverted because
camera facing was not visible. A proposal to add more lane-travel logic was
rejected. APX should describe the setup and record events, and leave the
logic to implementations.

## Decision

- Lanes describe their cameras with the decoration
  `apds-ext:apx:lane-cameras@1.0`: `cameras[]` with `cameraId` (equal to APDS
  `Image.cameraID`) and `faces` (`inward` or `outward`). Facing is relative
  to the facility, so reversible lanes work.
- A read carries `accessEvent` (`entry`, `exit`, `unknown`). The LPR system
  reports it and may revise it later through
  `PUT /v1/lpr/reads/{observation}/access-event` (added in 0.12.1; 0.12.0
  pointed at a native APDS route that does not exist). The server MUST NOT
  infer it. The name
  pairs with APDS `accessType` and avoids a clash with APDS `EventTypeEnum`.
- `movement` gains `toward` and `away`. `approaching` and `receding` are
  deprecated synonyms until 1.0.
- `laneTravel` is deprecated; servers SHOULD return `unknown`. `plateFace` is
  kept for engines that report front or rear.
- APX has no wrong-way concept: no flag and no alert raised by APX. Shared
  driveways and snow make "wrong lane" normal. `wrongWayTravel` stays in the
  alert registry as an operator-defined alert.
- The model is reads (entry or exit) → passage (`captureGroup`) → APDS
  Session. Pairing and rear-plate precedence are platform logic.
- Also added: `frameReads`, `plateBox`, `speed` (km/h, no `-1` sentinel),
  `plateCategory`, and `GET /v1/lpr/reads?session=`.

## Consequences

- Every wire change was additive; nothing was removed or renamed.
- Deferred: a standard `vehicleType`, and a freight-identifiers module (USDOT
  numbers, containers).

## References

- Part 13 §13.3a (read detail, access events, lane cameras)
- CHANGELOG 0.12.0 (2026-09-28)
