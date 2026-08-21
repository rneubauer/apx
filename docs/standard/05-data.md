# APX Part 5 — Data Profile (over APDS native routes)

The `apx-data` conformance class. APX defines **no parallel data routes**:
pull and push use APDS 4.1's own endpoints (`/places`, `/observations`,
`/contacts`, `/rights/specs`, `/rights/assigned`, `/rates`, `/sessions`,
`/quotes`), mounted verbatim. This Part defines the additive behavior APDS
leaves open.

## 5.1 Update modes (generalizing APDS Use Case C.1.1.6)

APDS defines "Full" vs "Change" updates for Place information. APX
generalizes this to **all** the entity classes above, in both directions:

- **Full** — the payload is the complete current state of the object.
  Fields absent from the payload have no defined value.
- **Change** — the payload carries identity (`id`, `version`) plus only the
  changed fields. **Explicit `null` clears a field; an absent field is
  unchanged.** This is the APDS null-out sentinel rule, made normative for
  every class.

Writes (`POST`, `PUT` on native routes) declare their mode with the request
header `APX-Update-Mode: full|change` (default `full`, preserving stock
APDS behavior). Servers MUST reject a change-mode write targeting a stale
`version` with problem `version-conflict`.

## 5.2 Change feed (pull deltas)

APDS natively provides `modified_since` on list routes, returning changed
entities plus `deletedReferences` tombstones in the `PaginatedList` shape —
APX designates that as the **coarse fallback**. For gapless incremental
sync, APX adds the parameters `mode` and `cursor`:

- `mode=full` (or absent) — stock APDS list behavior, byte-compatible.
- `mode=change` — returns a `ChangeFeedPage`: changed entities (change-mode
  payloads), `deleted[]` tombstones (APDS `DeletedReference`), and an opaque
  `cursor` resuming strictly after this page.

Rules:

1. The feed is **ordered and gapless** per class: replaying from any issued
   cursor yields every change after it exactly once.
2. Cursors are opaque; clients MUST NOT parse them. Servers MUST retain
   enough history to honor cursors at least 7 days old; older cursors get
   problem `target-not-found` and the client re-syncs with `mode=full`.
3. When no cursor is held, clients use the NATIVE `modified_since`
   parameter (stock APDS) and then switch to cursors.
4. Tombstones MUST be emitted for deletes and retained for the same window.

## 5.3 Push (client→server ingest)

Data flows INTO an APX implementation through the same native `POST`/`PUT`
routes under `apx.data:write`, with §5.1 semantics. Occupancy data flows
through the Place hierarchy (APDS model); high-frequency demand publishing
SHOULD use change-mode writes.

## 5.4 Push (server→client)

Change events are delivered over the fabric (Part 8) using APDS's own
`EventTypeEnum` topics (`SessionCreated`, `PlaceUpdated`, …). The event
`data` is the APDS `EventData` shape; `subject` references the entity. A
subscriber holding a cursor MAY treat events as wake-ups and pull via
`mode=change` (recommended for exactly-once processing).

## 5.5 Occupancy snapshot (convenience read)

Occupancy natively lives inside the Place hierarchy (APDS `Supply` +
`DemandTable`), which makes "how full is this garage right now" an
expensive question — pull the hierarchy, walk to the element, read the
demand table. APX adds one convenience read:

- `GET /v1/places/{id}/occupancy` (scope `apx.data:read`; the `apx_places`
  grant must cover the element) returns an `OccupancySnapshot`: the
  element Reference, `computedAt`, the verbatim APDS `Supply` and latest
  `DemandType` record, and a derived `available` count
  (`supplyQuantity − count`, clamped at 0, `null` when either side is
  unknown).
- The snapshot is a **read-model, not a resource**: it has no id/version,
  is never written directly, and MUST be derivable from the Place
  hierarchy — the hierarchy stays the source of truth (§5.3). Fields the
  implementation does not know are absent, never guessed.
- Material occupancy changes (threshold crossings or publisher-defined
  deltas) publish `apx.data.occupancy.v1` (data: OccupancySnapshot) over
  the Part 8 fabric. Where `apx-alerts` is implemented, a configured
  threshold crossing SHOULD also raise an `occupancyThresholdExceeded`
  alert (Part 7).

## 5.6 Conformance

`apx-data` requires: the eight native routes; §5.1 modes on writes; §5.2
change feed on `/places`, `/sessions`, `/rates`, `/rights/assigned`; the
stock-APDS compatibility guarantee (a client sending no APX headers/params
observes pure APDS 4.1 behavior). Implementations that hold occupancy data
for an element MUST serve §5.5 for it; implementations with no occupancy
data MAY omit the endpoint entirely (discovery then does not list it).
