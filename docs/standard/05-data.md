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
- `mode=change` — returns a `ChangeFeedPage`: changed entities (change-mode
  payloads), `deleted[]` tombstones (APDS `DeletedReference`), and an opaque
  `cursor` resuming strictly after this page.

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
never modified.

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

## 5.6 Conformance

`apx-data` requires: the eight native routes; §5.1 modes on updates and
the §5.1a validation and error-dialect rules; §5.2 change feed on
`/places`, `/sessions`, `/rates`, `/rights/assigned`, and — where the
implementation serves observation ingest — `/observations` (the
exactly-once path Part 13 §13.4 relies on); the stock-APDS compatibility
guarantee (a client sending no APX headers/params observes pure APDS 4.1
behavior). Implementations that hold occupancy data for an element MUST
serve §5.5 for it; implementations with no occupancy data MAY omit the
endpoint entirely (discovery then does not list it).

The session detail (§5.8) and match evidence (§5.9) decorations are
optional. A server that accepts them on writes MUST validate and preserve
them and enforce the §5.8 rules; a server that pairs reads itself SHOULD
write them.

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

## 5.8 Session detail: the reads, the closure, and the visit (normative)

An APDS Session records a stay's times, credentials, segments, and
vehicle. It has no member for the reads behind it, why or how it ended,
or the visit a stay in a nested area belongs to. How reads are paired
into Sessions is implementation-defined (Part 13 §13.3a(6)); when one
server does the pairing nobody else needs to know, but when a separate
client does it, that client has to write what it decided. It does so
with the Level B decoration `apds-ext:apx:session-detail@1.0`
(`SessionDetail`) in the Session's `extensions` container (Part 4 §4.3),
sent with the native Session `POST`/`PUT` (§5.3) under `apx.data:write`.
A plain APDS consumer ignores it. A server that pairs reads itself SHOULD
write the same block on its own Sessions, so consumers see one shape
whoever paired.

1. **Reads.** `reads[]` lists the Observations behind the Session, each
   with a `role`: `entry` (opened the stay), `exit` (closed it),
   `duplicate` (the same passage again: another camera, frame, or plate
   of the vehicle), or `activity` (the vehicle seen inside, for example
   by a patrol sweep). One read MAY carry `representative: true`, the one
   a consumer shows for the Session; two are 422 `request-unprocessable`.
   A read MAY belong to a Session and to the Sessions in its `parent`
   chain (rule 4); binding a read already bound to any other Session is
   409 `read-already-bound`, and nothing is written. To move a read, the
   writer first writes the Session that holds it without it, then binds
   it to the new one. A reference naming no Observation the caller can
   see is 422 `reference-unknown`. Where the server also claims
   `apx-lpr`, `LprRead.session` and `GET /v1/lpr/reads?session=` are
   derived from `reads[]`: `LprRead.session` names the Session without a
   `parent` (the visit) that holds the read, and `?session=` naming an
   area Session lists that Session's reads.
2. **Lifecycle.** `lifecycle` is `open` (no `actualEnd` yet), `ended`
   (`actualEnd` set; the pairing may still revise it), `final` (the
   writer expects no further revision), or `disputed` (the stay or its
   charge is contested). `open` with `actualEnd`, or any other state
   without it, is 422 `request-unprocessable`. `final` is the writer's
   statement, not a lock: a server MUST NOT refuse a later revision on
   that ground.
3. **Closure.** `closure.endReason` says why the Session ended, from the
   registry `apx-session-end-reasons` (Part 11). APDS requires
   `actualStart`, so a Session opened by an exit with no observed entry
   (`exitOnly`) still carries one: the writer sets
   `closure.startObserved: false` and SHOULD set `actualStart` equal to
   `actualEnd`. `closure.endObserved: false` says `actualEnd` was set by
   a rule or inference (a `stale` closure, an `inventorySweep`) rather
   than taken from a read; `closure.rule` then names the
   implementation's rule. Absent, both flags mean true. A consumer MUST
   NOT compute dwell time from a Session whose `startObserved` or
   `endObserved` is false, and MUST NOT count an exit-only Session as
   occupancy.
4. **Nested areas.** A stay in a nested area (a valet section, a gated
   zone inside a garage) is its own Session whose `hierarchyElement` is
   the area. `parent` references the Session of the visit it is part of,
   and the parent's `hierarchyElement` MUST be an ancestor of the
   child's (otherwise 422 `request-unprocessable`). A Session with a
   `parent` is not a visit: a consumer counting visits counts only
   Sessions without one. `passThrough: true` marks an area stay shorter
   than the area's minimum dwell (the vehicle crossed the area rather
   than parked in it); consumers MUST NOT score it for compliance or
   occupancy. When a visit ends, its children still open SHOULD be
   closed no later than the parent's `actualEnd`, with `endReason`
   `parentExit`.
5. **Events and privacy.** Writes publish the native `SessionCreated` /
   `SessionUpdated` as any Session write does; the decoration adds no
   topic. It carries references and codes only, never plate characters,
   so it is visible wherever the Session is; the reads it names stay
   behind `apx.lpr:*` (Part 9 §9.6).

```json
"extensions": {
  "apds-ext:apx:session-detail@1.0": {
    "reads": [
      { "observation": { "id": "f3000000-0000-4000-8000-000000000101", "className": "ObservationElement" }, "role": "entry", "representative": true },
      { "observation": { "id": "f3000000-0000-4000-8000-000000000102", "className": "ObservationElement" }, "role": "duplicate" },
      { "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" }, "role": "exit" }
    ],
    "lifecycle": "ended",
    "closure": { "endReason": "exitRead" }
  }
}
```

## 5.9 Match evidence (normative)

APX links a Session to the AssignedRight that covers it
(`Segment.assignedRight`, Part 14 §14.1b), a Violation to its Session
(`relatedSession`, Part 19), and a ValetTicket to its Session (Part 22),
but never says how the link was made or how sure it is. Plate matching
is rarely exact (misreads, look-alike characters, a second plate on the
account), and a link good enough to let a car through is not always good
enough to fine its owner. `MatchEvidence` records the difference.

1. **Where it goes.** In `SessionDetail.matches[]` (§5.8), one entry per
   link, `target` naming the record at the other end (the AssignedRight,
   ValetTicket, Violation, or the exit Observation). And as the Level B
   decoration `apds-ext:apx:match-evidence@1.0` on a Violation (for
   `relatedSession`) or a ValetTicket (for `session`), `target` naming
   the Session. Where both ends carry evidence for the same link, the
   two MUST agree.
2. **What it says.** `matchType` is the kind of link. `plate.method` is
   how the plates agreed: `exact`; `alias` (a plate the right or account
   lists for the same vehicle); `fold` (equal after folding look-alike
   characters such as O/0, I/1, B/8); `fuzzy` (within the
   implementation's edit-cost threshold, `editCost` carrying the cost);
   `lenient` (a relaxed rule good enough to excuse a stay); or `reviewer`
   (a person judged them to match where no automatic method did).
   `plate.jurisdiction` says whether the issuing state agreed.
   `vehicle.level` is what the vehicle's other attributes said, from
   `mismatch` to `strong`, with `llr` and `model` when the implementation
   scores it. `applied: false` is a shadow match, recorded for evaluation
   and not acted on. `decidedBy` is `system` or `person`.
3. **Excuse, never accuse.** Evidence with `plate.method: lenient`, or
   with `applied: false`, MAY establish that a stay is covered; it MUST
   NOT be the basis for issuing a Violation (Part 19 §19.4 rule 5).
4. **Minimization.** The evidence describes the comparison, not the
   vehicle: it carries no plate characters and no make, model, or colour
   values (Part 9 §9.6).
5. **Candidates are not evidence.** `MatchCandidate.matchedBy` (Part 6
   §6.7) says how a lane inquiry found a candidate; `MatchEvidence`
   records a link once made. A `matchTicket` that binds a candidate
   SHOULD be recorded with `decidedBy: person`.

```json
"apds-ext:apx:session-detail@1.0": {
  "matches": [
    {
      "target": { "id": "4b1c0000-0000-4000-8000-000000000042", "className": "AssignedRight" },
      "matchType": "right",
      "plate": { "method": "fold", "jurisdiction": "agrees" },
      "vehicle": { "level": "good", "llr": 2.31, "model": "evidence-weights@2026-10-01" },
      "applied": true,
      "decidedBy": "system"
    }
  ]
}
```
