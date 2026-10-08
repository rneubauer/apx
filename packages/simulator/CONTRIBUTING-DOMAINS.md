# Writing a domain module for the APX simulator

The simulator is a kernel plus one domain module per conformance class.
The kernel (`src/kernel/`) owns routing, authentication, scopes, body
validation, idempotency, the clock, the store, the place hierarchy and the
event fabric. A domain module owns the behaviour of its operations: the
state machines, the refusals a Part prescribes, the events it publishes,
the world sections it seeds, and the injectors that let a scenario make
the world act (a device faults, a car arrives, a payment declines).

`src/domains/control.mjs` with `worlds/apx-control.json` and
`tools/directions/apx-control.json` is the reference implementation: it
replays all 88 exchanges of `docs/scenarios/by-module/apx-control` at 100%.
Read it first.

## The contract

A module is `src/domains/<name>.mjs`, discovered automatically, exporting:

```js
export default {
  name: 'alerts',
  register(sim) {
    sim.seed((world, sim) => { /* put rows into collections from world sections */ });
    sim.on('post-apx-v1-alerts', (ctx) => { /* return a body, or { status, body, idem } */ });
    sim.injector('kind', (args, sim) => { /* mutate the world; return something JSON */ });
    sim.hooks.on('device.state', ({ device, previous }) => { /* react to another domain */ });
    sim.view('alerts', (record) => wire(record)); // what an idempotent replay returns
  },
};
```

`sim.on(operationId, handler, opts?)` — operationIds are the bundle's
(`node bin/apx-sim.mjs ops` lists every operation and whether it is
implemented; `spec/dist/apx-v1.json` is the contract). An operationId may
be registered once across all modules. `opts.allowEmptyBody` lets a
required body be absent; `opts.skipBodyValidation` disables the kernel's
schema check (then validate yourself and refuse with `invalid-request`).

A handler returns either a wire body (served as 200) or an envelope
`{ status, body, headers?, idem? }`. A resource that carries its own
`status` member (an Alert) is a body, not an envelope.

### What the kernel has done before your handler runs

401 `unauthenticated`, 403 `insufficient-scope`, JSON parsing, required
query parameters, request-body schema validation (400 `invalid-request`
with `errors[]`), and the `Idempotency-Key` ledger (400
`idempotency-key-required`, 409 `idempotency-conflict`, and the 200 replay
of a stored key — for that, return `idem: { collection, id }` from a create
so the kernel knows which record to re-serve).

The kernel validates your response against the bundle after you return.
A violation is reported in the `X-Sim-Contract` header, in
`GET /sim/contract`, and by the replay runner as a "contract" issue. Zero
contract issues is the bar.

### The handler context

```
ctx.params      path parameters            ctx.query.get/has/list/int(name)
ctx.body        parsed JSON (or undefined) ctx.headers  lower-cased
ctx.principal   { sub, scopes:Set, org, orgRef, places|undefined, hasGrant, bound, has(scope) }
ctx.clock       now(), nowMs(), schedule({delay}|iso, fn, label), advance()
ctx.store       collection(name), next(counter)      ctx.coll(name)  shorthand
ctx.hierarchy   get/has/placeOf/within/covers/subtree/operatorOf
ctx.events      publish({ type, data, subject, place, org })   ctx.publish(...)
ctx.world       the loaded world JSON      ctx.now()     ISO instant
ctx.assignId    X-Sim-Assign-Id hint for a create   → pass as { assignedId } to insert()
ctx.actor       { org, user } for recordInfo        ctx.ifMatch  parsed If-Match version
ctx.fail(slug, detail, extra?, headers?)   throw a Part 12 problem
ctx.grant(id)   403 insufficient-grant unless apx_places covers the node
```

### Refusals

`fail('target-not-found', 'No alert <id> visible to this credential.')` —
the slug must be in Part 12 (`docs/standard/12-errors.md`); the kernel
throws on an unregistered one and renders status, title, type, detail,
instance. Extra members (`errors[]`, `payment`) go in `extra`. Part 9
§9.3a decides between 404 and 403: a path id whose owning place is
outside the grant is 403 `insufficient-grant`; a record outside a
narrower ownership scope (another merchant's program) is 404; a lookup
that names no place returns `200` with empty `data` under no grant.
`common.mjs` has `getVisible`, `visibleRows`, `placeOfTarget`,
`checkPrecondition` (409 `version-conflict` from If-Match or body.version),
`paginate` (the APDS `{meta, data}` envelope), `entry` (statusHistory
rows), `money`, `refOf`, `wire`.

### Records

Collections are plain JSON records with `id` and `version`. `insert()`
mints the id (or honours `assignedId`, or a client-supplied `record.id`
with 409 on collision), sets `version: 1` and `recordInfo`; `update(id,
fn)` returns the new record with `version + 1` (`{ bump: false }` for
simulator-internal changes); `put()` stores verbatim (seeding). Members
starting with `_` are internal and stripped by `wire()`: use `_place`
for the owning HierarchyElement id (the grant check), `_org` for the
owning organisation, and any other hints a state machine needs.

Canonical collection names, shared across modules:

```
places sessions observations contacts rightSpecs assignedRights rateTables quotes
subscriptions deliveries commands devices lanes alerts accounts payments paymentLinks
lprReads tollTransactions violations enforcementPolicies signage validationPrograms
issuances redemptions statements credentialRecords accessEvents valetTickets
resolutionContexts supportInteractions accessCredentials
```

Seed a shared section defensively (`if (!coll.has(id)) coll.put(row)`)
because more than one module may seed `sessions`, `rateTables`,
`observations`, `assignedRights`.

### Events

`ctx.publish({ type, data, subject, place })` with a registry topic
(`spec/registries/apx-topics.json`) or an APDS `EventTypeEnum` value.
`place` is the §8.5 binding (the HierarchyElement id); pass `null` plus
`org` for an organisation-scoped event. The fabric handles subscriptions,
filters, grants, signing, retries, SSE and the ledger; `GET /sim/events`
shows what was published and to whom.

### Time

The clock is frozen. Anything that happens "later" (a command dispatching,
a reservation becoming a no-show, an alert expiring, a statement closing)
is `ctx.clock.schedule({ delay: ms } | isoInstant, fn, label)`; it fires
when the clock passes it (`POST /sim/clock {advance: '5m'}`, or a replay's
`X-Sim-Now`). Never use `Date.now()` or `setTimeout`.

### Worlds and directions

`worlds/<module>.json` is the module's cast, `extends: "base-lakeside"`
(Lakeside Parking a1…0001 at Lakeside Garage b1…0001, Harbor Parking
a1…0002 at Harbor Deck b1…0002, the named credentials). Ids may be written
as `xx…NNNN` and expand to `xx000000-0000-4000-8000-00000000NNNN`. Add
`places[]` (with `parentId` for levels and spaces), `lanes[]`
(`placeId`, `accessType`), `devices[]` (`placeId`/`laneId`), and your own
sections; override `credentials.default` with the scopes and grant the
module's cast paragraph names. Keep the hierarchy honest: the grant check
only works for ids the hierarchy knows.

`tools/directions/<module>.json` holds stage directions for the replay:
world events the prose describes that no request performs. Keys are
scenario ids; each step has `at` (0-based exchange index, or `"start"`)
and one of `inject`, `clock`, `state` (`{collection, id, record}`),
`receiver`, `reset`. Use them for "the gate is in fault", "an hour later",
"the deck was pushed without the line" — not to paper over a behaviour
the module should have.

### The acceptance test

```
node bin/apx-sim.mjs replay <module> --verbose
```

replays every exchange of `docs/scenarios/by-module/<module>/scenarios.md`
against an in-process simulator loaded with `worlds/<module>.json` and
checks the status code, the problem type of a refusal, and the response
schema. The runner derives three fixtures from the scenario text:
`Authorization` from the ```http block (descriptive tokens such as
`<apx.data:read only>` or `<expired>` are understood by the kernel),
`X-Sim-Assign-Id` from the id a 2xx POST response shows, `X-Sim-Now` from
the latest instant the expected response shows. Expected bodies are not
compared field by field — the scenario is a narrative, not a fixture —
but every refusal must come from the right rule, and every success must
produce a body the bundle accepts.

Exchanges in one file run against one world in order, so later scenarios
see the state earlier ones left. When a scenario needs the world to be
different from what the file's own requests produced, that is a
direction, not a reason to reset.

Rules: do not edit `src/kernel/*`, `src/domains/common.mjs`, or another
module's files; if the kernel is missing something, say exactly what in
your report and work around it inside your module. Keep the module under
~800 lines by splitting helpers into `src/domains/<name>/*.mjs` if needed.
No `console.log`. Node 20+, ESM, no new dependencies.
