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

## 5.5 Conformance

`apx-data` requires: the eight native routes; §5.1 modes on writes; §5.2
change feed on `/places`, `/sessions`, `/rates`, `/rights/assigned`; the
stock-APDS compatibility guarantee (a client sending no APX headers/params
observes pure APDS 4.1 behavior).
