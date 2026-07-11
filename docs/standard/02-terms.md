# APX Part 2 — Terms, Definitions, Notation

Terms defined by APDS 4.1 (Place, Campus, SubplaceElement, IdentifiedArea,
Space, RightSpecification, AssignedRight, RightHolder, RightPool, PlannedUse,
Session, Segment, Observation, Credential, RateTable, Quote, Supply, Demand,
Distributing Party, Receiving Party) are used with their APDS meanings and
are NOT redefined here.

## 2.1 APX-defined terms

- **APX implementation (server)** — a system exposing APDS 4.1 routes plus
  one or more APX conformance classes.
- **APX client** — a system consuming an APX implementation under an OAuth2
  client registration.
- **Lane** — the operational entry/exit position addressed by control
  commands; modeled as an APDS `VehicularAccess` IdentifiedArea, optionally
  narrowed to a `SupplementalEquipment` device.
- **Device** — a physical unit inventoried as APDS `SupplementalEquipment`;
  APX overlays live state on it (Part 6).
- **Command** — an APX resource requesting an operational action against a
  target lane/device/place (Part 6).
- **Alert** — an APX resource describing an operational condition requiring
  attention (Part 7).
- **Subscription** — an APX-extended APDS `EventSubscription` (Part 8).
- **Event** — one `EventEnvelope` delivery (Part 8).
- **Topic** — the event type string; either an APDS `EventTypeEnum` value or
  an APX topic `apx.<domain>.<event>.vN`.
- **Conformance class** — a named, testable unit of APX functionality
  (Part 3), registered in `apx-conformance-classes`.
- **Grant** — the pair of token claims (`apx_org`, `apx_places`) bounding
  what a client may see/do (Part 9).

## 2.2 Notation

- All timestamps are RFC 3339 in UTC unless a Place-local time is explicitly
  indicated (APDS convention). Intervals are start-inclusive, end-exclusive.
- Identifiers are RFC 4122 UUIDs. Cross-object references use APDS
  `Reference` / `VersionedReference` and are typed by `className`.
- JSON field names are camelCase. Paths are lowercase kebab-case.
- `apx.<domain>:<verb>` denotes an OAuth scope; `apx.<domain>.<event>.vN`
  denotes a topic; `apds-ext:<ns>:<class>@<M.m>` denotes an extension key.
