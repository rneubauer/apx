# APX Part 5 — Data Profile (over APDS native routes)

The `apx-data` conformance class. APX defines **no parallel data routes**:
pull and push use APDS 4.1's own endpoints (`/places`, `/observations`,
`/contacts`, `/rights/specs`, `/rights/assigned`, `/rates`, `/sessions`,
`/quotes`, and the by-id routes APDS defines under them, such as
`/observations/{id}` and `/quotes/{id}`), mounted verbatim. This Part defines the additive behavior APDS
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

Updates (`PUT` on native routes) declare their mode with the request
header `APX-Update-Mode: full|change` (default `full`, preserving stock
APDS behavior). A create (`POST`) has no prior state to merge into, so it
always carries the complete state; a server receiving
`APX-Update-Mode: change` on a `POST` treats the body as full. Servers
MUST reject a change-mode write targeting a stale `version` with problem
`version-conflict`.

## 5.1a Validating writes, and the error dialect (normative)

The native request schemas describe complete objects, so a change-mode
body cannot validate against them. The data overlay therefore declares
each native `PUT` body as `anyOf [<native schema>, <Class>ChangePayload]`,
where `<Class>ChangePayload` (for example `RateTableChangePayload`) is
derived from the class at build time:

- With `APX-Update-Mode: full` (or no header) the body MUST validate
  against the native schema. A validator that knows the header MUST
  apply that branch alone: a body that is a valid change payload but an
  incomplete object (an `AssignedRight` without `rightSpecification`) is
  valid only in change mode.
- With `APX-Update-Mode: change` the body MUST validate against the
  class's change payload: `id` present, `version` optional (the
  precondition when present, Part 4 §4.2a), and every other member
  optional and MAY be `null` ("clear"). Each scalar member present is
  checked against the class's own property schema, `extensions` against
  the APX `Extensions` container (Part 4 §4.3), and a member the class
  does not define is refused with 400. Nested objects, and array items
  that are objects, are left open in the schema because those that carry
  their own `id` (a Session segment) follow the same change rule; the
  server MUST validate them against the class's native property schema.
  The generic `ChangePayload` is the shape of every `ChangeFeedPage` item,
  so what a writer sends and what a reader receives are the same thing.
  (Until 0.12.2 the native `PUT`s used the generic `ChangePayload`, which
  requires only `id`, so a full-mode body carrying an `id` was never
  checked.)

Native routes keep their APDS error shape (`ResponseStatus`) by default.
The overlay adds `application/problem+json` (`Problem`) as a second
media type on every native 400, 404, and 409; a client that sends
`Accept: application/problem+json` MUST receive the Problem, with the
registered type: `invalid-request` for a 400, `target-not-found` for a
404, `id-collision` for a 409 on a create and `version-conflict` for a
409 on an update. The overlay also declares the shared 401, 403, and 429
(`unauthenticated`, `insufficient-scope`/`insufficient-grant`,
`rate-limited`) on every native operation; these have no APDS
equivalent and are always Problems. A cursor refusal (§5.2) is always a
Problem too, because the cursor is an APX parameter.

## 5.2 Change feed (pull deltas)

APDS natively provides `modified_since` on list routes, returning changed
entities plus `deletedReferences` tombstones in the `PaginatedList` shape —
APX designates that as the **coarse fallback**. For gapless incremental
sync, APX adds the parameters `mode` and `cursor`:

- `mode=full` (or absent) — stock APDS list behavior, byte-compatible.
- `mode=change` — on a native route, returns a `ChangeFeedPage`: changed
  entities (change-mode payloads), `deleted[]` tombstones (APDS
  `DeletedReference`), and an opaque `cursor` resuming strictly after this
  page. On an APX list route the same members ride in the route's own
  list envelope (rule 8).

Rules:

1. The feed is **ordered and gapless** per class: replaying from any issued
   cursor yields every change after it exactly once.
2. Cursors are opaque; clients MUST NOT parse them. Servers MUST retain
   enough history to honor cursors at least 7 days old; older cursors get
   404 with problem `target-not-found` (always a Problem, §5.1a) and the
   client re-syncs with `mode=full`.
3. When no cursor is held, clients use the NATIVE `modified_since`
   parameter (stock APDS) and then switch to cursors. Note the type:
   APDS declares `modified_since` as a **Unix epoch integer** (seconds),
   not an RFC 3339 string like every APX time — `modified_since=1785542400`,
   not `modified_since=2026-08-01T00:00:00Z`.
4. Tombstones MUST be emitted for deletes and retained for the same window.
5. **Cursor scope.** A cursor is scoped to (entity class, credential,
   filter set). Presenting a cursor with a different filter set or from a
   different credential yields problem `target-not-found`; the client
   re-syncs. Cursors are server-local: they never survive a move to a
   different implementation (Part 18).
6. **Filtered feeds.** `mode=change` composes with the native APDS filters
   (e.g. `place_ids`): the resulting feed MUST be ordered and gapless
   *within that filter set* — every change to an entity matching the
   filter appears exactly once. Grants compose the same way: the feed a
   credential sees is gapless within its `apx_places` world.
7. **Grant expansion.** When a credential's `apx_places` grant later gains
   a subtree, existing cursors DO NOT retroactively include the new
   subtree's history. Servers MUST signal this by including the new
   subtree roots in `ChangeFeedPage.grantAdditions` on the first page
   served after the change; the client then runs `mode=full` for those
   subtrees before relying on the feed for them, selecting each with the
   native `place` filter (subtree-inclusive; the data overlay adds it to
   `/places`, which APDS 4.1 omits).
8. **APX resources.** A module that runs apart from the implementation
   it reads from — a pairing engine, an enforcement back office, a site
   server that replicates to an aggregator — catches up after an outage
   by cursor. Webhook retries end after 24 hours and an SSE stream keeps
   as little as 1000 events or 15 minutes (Part 8 §8.3–8.4), so without a
   feed a link loss longer than that loses violations, alerts, or tickets
   for good. Every APX list route of a stateful resource in the table
   below therefore MUST accept `mode=change&cursor=` (`ModeParam` and
   `CursorParam` on the operation). The obligation belongs to the class
   that owns the route, not to `apx-data`. Rules 1, 2 and 4–7 apply
   unchanged: ordered and gapless per (route, credential, filter set),
   cursors opaque and honoured for at least 7 days, a refused cursor is
   404 `target-not-found` (always a Problem), tombstones retained for the
   same window, grant additions signalled. The differences:
   1. **Envelope.** The change page is the route's own list envelope, not
      a `ChangeFeedPage`: `data` holds the changed resources, and the
      optional members `updateMode`, `cursor`, `deleted`,
      `grantAdditions`, and `next` carry what the `ChangeFeedPage`
      members of the same name carry. A change page MUST carry
      `updateMode: change` and `cursor`, and an ordinary (`mode=full`)
      page MUST NOT carry `updateMode`, so a client tells the two kinds
      of page apart by `updateMode`. `meta` is absent on a change page.
      (Swapping the response for a `ChangeFeedPage` would re-type a
      response that already exists, which Part 3 §3.2 forbids within a
      major version.)
   2. **Items are whole.** Each item in `data` is the resource's complete
      current representation, never a change payload: APX resources
      change by domain operations, not by change-mode writes, and each
      keeps its own history (`statusHistory[]`, `amountHistory[]`). A
      server MAY deliver only the latest state of a resource that changed
      several times after the cursor; it MUST NOT deliver an older state
      after a newer one. Consumers key on `id` and keep the highest
      `version` where the resource has one.
   3. **Starting the feed.** These routes have no `modified_since`
      (rule 3). `mode=change` without a `cursor` returns a page with no
      items whose `cursor` is the feed's current head. A client starting
      from nothing takes the head cursor first, then lists with
      `mode=full`, then follows the cursor; a change that lands between
      the two is seen twice, never missed, and difference 2 resolves it.
   4. **Filters.** `mode=change` composes with the route's own filters
      (rule 6). A change belongs to a filtered feed when the resource
      matched the filter set before the change **or** after it, so a
      consumer filtering on `status` sees the change that takes a
      resource out of its view. The `page` parameter is not used with
      `mode=change`; a page ends where the server chooses, and `next`
      (or the `cursor`) continues it.
   5. **Tombstones.** APX resources are rarely deleted (a void is a
      state). `deleted[]` carries the resources a retention purge removed
      (Part 9 §9.6), those released with a moved place (Part 18 §18.4),
      and entries removed from a plate list (Part 24 §24.2 rule 4), with the
      resource's schema name (`Violation`, `ValetTicket`, …) as
      `className`.
   6. **Payments.** `GET /v1/payments` serves keyed lookups only (Part 13
      §13.2). Its feed is the catch-up path for the same records
      `apx.accounts.payment.recorded.v1` already delivers to the
      credential (Part 13 §13.4), so `mode=change` needs no key and has no
      8-hour window, and follows that topic's rules: a hold appears at
      capture, never before, and a voided hold never appears. The
      truncated keys `ticketLast4` and `cardLast4` are refused with
      `mode=change` (400 `invalid-request`), so the feed is never a way
      round the §13.2 window.

| Route | Resource | Required by |
|---|---|---|
| `GET /v1/commands` | Command | `apx-control` |
| `GET /v1/alerts` | Alert | `apx-alerts` |
| `GET /v1/accounts` | Account | `apx-accounts` |
| `GET /v1/payments` | PaymentRecord | `apx-payment-history` |
| `GET /v1/tolling/transactions` | TollTransaction | `apx-tolling` |
| `GET /v1/violations` | Violation | `apx-violations` |
| `GET /v1/enforcement/policies` | EnforcementPolicy | `apx-violations` |
| `GET /v1/enforcement/signage` | Signage | `apx-violations` |
| `GET /v1/validations/programs` | ValidationProgram | `apx-validations` |
| `GET /v1/validations/programs/{id}/issuances` | ValidationIssuance | `apx-validations` |
| `GET /v1/validations/redemptions` | ValidationRedemption | `apx-validations` |
| `GET /v1/validations/programs/{id}/statements` | ValidationStatement | `apx-validations` |
| `GET /v1/credentials` | CredentialRecord | `apx-credentials` |
| `GET /v1/access-events` | AccessEvent | `apx-credentials` |
| `GET /v1/valet/tickets` | ValetTicket | `apx-valet` |
| `GET /v1/charging/sessions` | ChargingSession | `apx-charging` |
| `GET /v1/plate-lists` | PlateList | `apx-plate-lists` |
| `GET /v1/plate-lists/{id}/entries` | PlateListEntry | `apx-plate-lists` |

**Not feeds (informative).** Routes that compute a view rather than list
stored resources take no cursor: `/v1/valet/queue`,
`/v1/enforcement/policies/effective`, `/v1/enforcement/signage/effective`,
`/v1/reservations/recent`, `/v1/validations/providers`,
`/v1/devices` (a status snapshot), `/v1/lpr/reads` and
`/v1/lpr/candidates` (projections of Observations, whose feed is
`/observations`), and `/v1/resolution/contexts/{id}/allowed-actions`.
`GET /v1/credentials/{id}/access-events` is a slice of
`/v1/access-events`; a client feeds the latter with `credential=`.
`/v1/support/interactions` stays a lookup (Part 17 §17.6) in this edition.

**Rate deck mirroring (informative).** A third-party system that needs the
operator's rate deck — a call platform, a reservation channel, a revenue
system — mirrors it exactly this way: `GET /rates?place_ids=…&mode=full`
once, then `mode=change` with the cursor. APDS `RateTable` is the rate
model; APX adds none. What APX does add rides *inside* each table: the
`apds-ext:apx:ratepolicy@1.0` decoration (Part 6 §6.6) says which tables
an agent may offer as a negotiated rate, so the mirror carries that flag
without a second query.

**Machine-readability (normative).** The `mode`/`cursor` parameters and the
`ChangeFeedPage` response alternate are declared by the APX data-profile
overlay (`spec/openapi/overlays/apx-data-overlay.yaml`, OpenAPI Overlay
1.0), applied to the bundled document by the build (Part 0 §0.5, Part 3
§3.4). The overlay decorates exactly the five §5.6 feed routes, declares
the §5.1 header and body on the native `PUT`s and the §5.1a responses on
every native operation, and carries the narrow workarounds for the APDS
4.1 errata listed in Part 1 §1.3; the vendored APDS document itself is
never modified. The APX list routes of rule 8 are APX's own, so their
`ModeParam`, `CursorParam`, change-page members (`ChangeFeedUpdateMode`,
`ChangeFeedCursor`, `ChangeFeedTombstones`, `ChangeFeedGrantAdditions`,
`ChangeFeedNext`), and `CursorRefused` 404 are declared directly in
`spec/openapi/apx.yaml`.

**Design note (informative) — why the feed rides the native routes.** A
separate APX route family (`/v1/changes?class=…`) would have been fully
expressible in plain OpenAPI, but it would duplicate every native list
route's filter surface and create exactly the "parallel construct" Part 10
§10.2 forbids. Keeping the feed on APDS's own routes means cursors,
filters, and grants compose per-collection, and a stock APDS client on the
same route sees stock behavior — at the cost of needing the overlay to
express the additions, which is the trade this standard accepts.

## 5.3 Push (client→server ingest)

Data flows INTO an APX implementation through the same native `POST`/`PUT`
routes under `apx.data:write`, with §5.1 semantics. Occupancy data flows
through the Place hierarchy (APDS model); high-frequency demand publishing
SHOULD use change-mode writes.

## 5.4 Push (server→client)

Change events are delivered over the fabric (Part 8) using APDS's own
`EventTypeEnum` topics (`SessionCreated`, `PlaceUpdated`, …). The event
`data` is the APDS `EventData` shape; `subject` references the entity.
Both schemas are in the bundle through the `apx-native-event` webhook
entry (Part 8 §8.7), so a validator can check an envelope against them. A
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
- Part 23 §23.7: the snapshot MAY carry an `evCharging`
  block — charging points total, available, charging, occupied but not
  charging, blocked, inoperative — derived from `ChargingPointStatus`, so
  "is there a free charger" is the same read as "is there a free space".

## 5.5a Occupancy history

`GET /v1/places/{id}/occupancy/history?from=&to=&interval=` (scope
`apx.data:read`; the grant must cover the element) returns an
`OccupancyHistoryPage`: one bucket per `interval` (ISO 8601 duration,
default `PT1H`) between `from` and `to`, each with `maxCount`, the
time-weighted `avgCount`, the `supplyQuantity` in force, and how many
demand records it is computed from.

- Buckets align to interval boundaries in the place's time zone.
- Like §5.5, the history is a read-model derived from the APDS
  `DemandTable` records the implementation holds; it is never written
  directly. A bucket with no record carries no counts — never a guess.
- An element the implementation holds no occupancy for is 404
  `target-not-found`. A server MAY refuse an interval shorter than its
  sampling with 400 `invalid-request`.

## 5.6 Conformance

`apx-data` requires: the eight native routes; §5.1 modes on updates and
the §5.1a validation and error-dialect rules; §5.2 change feed on
`/places`, `/sessions`, `/rates`, `/rights/assigned`, and — where the
implementation serves observation ingest — `/observations` (the
exactly-once path Part 13 §13.4 relies on); the stock-APDS compatibility
guarantee (a client sending no APX headers/params observes pure APDS 4.1
behavior). Implementations that hold occupancy data for an element MUST
serve §5.5 for it; implementations with no occupancy data MAY omit the
endpoint entirely (discovery then does not list it); the same holds for
§5.5a. Every `apx-data` implementation accepts and preserves the §5.8
decoration on Sessions (Part 4 §4.3) and refuses a write that breaks
its rules 1, 3, or 6 with the 422 they name; one that also claims `apx-lpr`
enforces its `read-already-bound` rule and answers
`GET /v1/lpr/reads?session=` from it. Rule 8 of §5.2 is an obligation of
the class that owns each route.

## 5.7 Known APDS 4.1 behaviour on the native routes (informative)

Some native routes differ from their siblings in ways a client written
against one will misread on the next. They are APDS 4.1 as published
(Part 1 §1.3, errata 005, 007, 012); servers MUST NOT "fix" them in a
way that breaks a stock client:

- `POST /rates` answers **200**, not 201, on success (the data overlay
  adds the missing 400 and 409 for parity).
- `PUT /rights/assigned/{id}` declares **201** — a server MAY upsert
  there; one that does not answers 404 (added by the overlay).
- Only `GET /contacts` and `GET /contacts/{contactId}` declare 500.
- `POST /observations` declares no responses in APDS; the overlay
  declares 201/400/409 in the `ResponseStatus` shape of the other native
  creates, and replaces the self-contradictory request wrapper with a
  plain `oneOf [ObservationElement, ObservationSet]` (an element's `type`
  is its `CredentialTypeEnum` value).
- `POST /quotes` declares no request body in APDS; the overlay declares
  an optional `QuoteRightRequest | QuoteSessionExtensionRequest`.
  `GET /quotes` returns the single matching quote object, not a list.
- `PUT /observations/{id}` declares no request body and no 400 in APDS;
  the overlay declares an optional `anyOf [ObservationElement,
  <Class>ChangePayload]` with the §5.1 header, and the 400, as on the
  other native `PUT`s (candidate C-026, not yet filed).

## 5.8 Session detail written by a pairing engine (normative)

APDS describes a Session's money and rights but not how the visit was
assembled: which reads it rests on, why it ended, how sure each match
behind it is, and which visit an area stay belongs to. Where the system
that pairs reads into Sessions is a separate client of the APX server,
it has to write what it decided. It does so with the Level B decoration
`apds-ext:apx:session-detail@1.0` (`SessionDetail`) on the APDS Session,
through the native `POST /sessions` and `PUT /sessions/{id}` (§5.1). A
plain APDS client ignores it. A server that pairs reads itself SHOULD
write the same block on its own Sessions, so consumers see one shape
whoever paired. A write that breaks a rule below is refused with the
problem type the rule names, and nothing is written.

1. **Reads (`reads[]`).** Each entry binds one ObservationElement to the
   Session with a `role`: `entry` and `exit` (the passages that opened
   and closed the visit), `duplicate` (the same passage seen by another
   camera or frame), `activity` (the vehicle seen inside). At most one
   entry is `representative`; two are 422 `request-unprocessable`. A
   reference naming no Observation visible to the caller is 422
   `reference-unknown`. The server derives `LprRead.session` from these
   bindings — naming the Session without a `parent` (the visit) that
   holds the read — and answers `GET /v1/lpr/reads?session=` from them
   (Part 13 §13.3a(6)).
2. **One visit per read.** A read already bound as `entry` or `exit` to
   another Session of the same place MUST be refused with 409
   `read-already-bound`, unless the write names that Session in
   `supersedes` — a re-pairing, which removes the binding from the
   superseded Session in the same write.
3. **Lifecycle and closure.** `lifecycle` is `open` (no `actualEnd`
   yet), `ended` (`actualEnd` set; the pairing may still revise it),
   `final` (no further revision expected), or `disputed`. `lifecycle`
   and `actualEnd` MUST agree: `open` with an `actualEnd`, or any other
   state without one, is 422 `request-unprocessable`. `final` is the
   writer's statement, never a lock: a server MUST NOT refuse a later
   revision on that ground. `closure.endReason` is a definedValue of
   `apx-session-end-reasons` (Part 11) or an implementer code;
   `closure.endInferred` is true when `actualEnd` was set by a rule
   rather than observed, and `closure.rule` names the rule that closed a
   `stale` Session.
4. **Exit-only Sessions.** APDS requires `actualStart`. A Session closed
   from an exit read with no observed entry carries a synthetic
   `actualStart`, which the writer SHOULD set equal to `actualEnd`, and
   `closure.startObserved: false`. Consumers MUST exclude such Sessions
   from dwell statistics and from occupancy derived from Sessions.
5. **Matches (`matches[]`).** Each `MatchEvidence` records how a link
   was established: the `target` (an AssignedRight, a ValetTicket, a
   Violation, a PlateListEntry, an Observation), the `matchType`
   (`right | valet | violation | list | exitPairing | sweep | other`),
   how the plates agreed (`plate.method` `exact | alias | fold | fuzzy |
   lenient | reviewer`, the edit cost, whether the jurisdiction agreed),
   the vehicle evidence as a `level` and a score, whether it was
   `applied` or only a shadow match, and whether a `system` or a
   `person` decided it (`decidedBy`). `target`, `matchType` and
   `applied` are required, and so are `plate.method` and
   `vehicle.level` when those blocks are present. It carries no plate
   characters and no make, model, or colour values (Part 9 §9.6). The
   same object is the decoration `apds-ext:apx:match-evidence@1.0` on a
   Violation (for `relatedSession`, Part 19 §19.13) and a ValetTicket
   (for `session`, Part 22), with the Session as `target`; where both
   ends carry evidence for the same link, the two MUST agree. Evidence
   with `plate.method: lenient` or `applied: false` may excuse a stay
   but never accuse one: a Violation resting on it is not issuable (Part
   19 §19.4 rule 5). `MatchCandidate.matchedBy` (Part 6 §6.7) says how a
   lane inquiry found a candidate; a `matchTicket` that binds one SHOULD
   be recorded with `decidedBy: person`.
6. **Area Sessions.** A Session that is part of a larger visit (a gated
   area inside a garage, a valet stay) names that visit as `parent`. The
   parent's `hierarchyElement` MUST be an ancestor of the child's; a
   `parent` that is not is 422 `request-unprocessable`. An area stay
   shorter than the area's minimum dwell is `passThrough` and is never
   scored or billed. When a visit ends, its children still open SHOULD
   be closed no later than the parent's `actualEnd`, with `endReason`
   `parentExit`. Consumers count visits by Sessions without `parent`.
7. **Events and privacy.** Writes publish the native `SessionCreated` /
   `SessionUpdated` as any Session write does; the decoration adds no
   event topic. It carries references and codes only, never plate
   characters, so it is visible wherever the Session is; the reads it
   names stay behind `apx.lpr:*` (Part 9 §9.6).

```json
"extensions": {
  "apds-ext:apx:session-detail@1.0": {
    "reads": [
      { "observation": { "id": "f3000000-0000-4000-8000-000000000101", "className": "ObservationElement" }, "role": "entry", "representative": true },
      { "observation": { "id": "f3000000-0000-4000-8000-000000000102", "className": "ObservationElement" }, "role": "duplicate" },
      { "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" }, "role": "exit" }
    ],
    "lifecycle": "ended",
    "closure": { "endReason": "exitRead" },
    "matches": [
      {
        "target": { "id": "4b1c0000-0000-4000-8000-000000000042", "className": "AssignedRight" },
        "matchType": "right",
        "plate": { "method": "fold", "editCost": null, "jurisdiction": "agrees" },
        "vehicle": { "level": "good", "llr": 2.31, "model": "evidence-weights@2026-10-01" },
        "applied": true,
        "decidedBy": "system",
        "decidedTime": "2026-10-08T14:02:11Z"
      }
    ]
  }
}
```

The same evidence on a Violation that cites this stay, as the decoration
`apds-ext:apx:match-evidence@1.0`, names the Session as its `target`:

```json
"extensions": {
  "apds-ext:apx:match-evidence@1.0": {
    "target": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
    "matchType": "violation",
    "plate": { "method": "exact", "jurisdiction": "agrees" },
    "vehicle": { "level": "strong" },
    "applied": true,
    "decidedBy": "person"
  }
}
```
