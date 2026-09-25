# APX Part 4 — Identity, Provenance, Extensions

## 4.1 Identity

Every APX-defined resource carries the `ApxResourceCore` identity:

- `id` — RFC 4122 UUID, unique within the resource class. Client-supplied
  ids follow APDS convention (server returns HTTP 409 on collision).
- `version` — positive integer, incremented on every state-changing update.

This is deliberately the same shape APDS uses for `D2VersionedIdentifiable`
objects, so **any APX resource can be the target of an APDS
`Reference`/`VersionedReference`** with `className` set to the APX class name
(e.g. `{"id": "…", "className": "Command"}`).

APX resources reference APDS entities the same way — never by embedding or
copying them. Example: a Command targets
`{"id": "<uuid>", "className": "SupplementalEquipment"}`.

## 4.1a Identifier locality and aggregation (normative)

**All identifiers — APX resource ids and APDS entity ids alike — are LOCAL
to the issuing implementation.** Clients MUST NOT assume an id minted by
one implementation resolves at another. (This generalizes Part 14 §14.1a,
which states the rule for RightHolders; it holds for HierarchyElements and
every other class.) APDS entity ids are strings with per-implementation
uniqueness — UUIDs by convention only.

For **aggregating implementations** (one endpoint fronting many locations,
Part 18):

1. On import, an aggregator SHOULD preserve the source implementation's
   HierarchyElement ids. When a collision with an already-hosted id makes
   that impossible, it MUST mint new RFC 9562 UUIDs for the colliding
   subtree.
2. Whenever an imported element's id differs from its source id, the
   aggregator MUST record the source id in the element's APDS
   `operatorDefinedReference` — the designated alias field — so existing
   integrations, grants, and warehouse keys can be migrated by lookup
   rather than guesswork.
3. Re-minting is a new identity: previously issued `apx_places` grants,
   subscription `filters.places`, and stored references DO NOT carry over
   automatically (Part 18 defines the onboarding sequence).

## 4.2 Provenance

Every APX resource SHOULD carry `recordInfo` (`RecordInfo` schema), aligned
with the APDS Information Model's RecordType: `creationTime`, `creator`
(Reference to Organisation/Contact), `creationUser`, `lastUpdate`,
`lastUpdateUser`. Where a resource has a lifecycle audit (Commands, Alerts,
TollTransactions), the immutable `statusHistory[]` is the authoritative
audit record and MUST NOT be truncated or rewritten.

## 4.3 The extensions container

Every APX resource schema includes an optional `extensions` object — the
official APDS extension mechanism (Use Case §C.2.5):

```json
"extensions": {
  "apds-ext:apx:devicestatus@1.0": { "deviceState": "fault" },
  "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold" }
}
```

- Keys MUST match `^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\.[0-9]+$`.
- The version component is the extension class's own contract version.
- Readers MUST ignore unknown keys; writers MUST preserve them (Part 3 §3.3).

APX also uses this container in the **other direction**: attaching APX data
to APDS entities (e.g. `apds-ext:apx:devicestatus@1.0` on a
`SupplementalEquipment` in a Place payload). These Level B decorations are
the only way APX data appears inside APDS payloads.

## 4.2a Optimistic concurrency and idempotent replay (normative)

Every APX write that replaces or amends a versioned resource (a `PUT`, a
`PATCH`, or a state-changing action on a resource that carries `version`)
follows one rule, so a stale writer never silently wins:

1. **The precondition is the version the client last read.** A client
   SHOULD send it as `If-Match: "<version>"` (the version integer as an
   entity tag). A client MAY instead send the resource's `version` member
   in the body, with the same meaning; `version` is marked readOnly because
   the server assigns it, and this is the one place a client echoes it
   back. `version` in a body is never "the next version".
2. **A stale precondition is 409 `version-conflict`**, with the current
   `version` in `detail`. Nothing is written.
3. **No precondition** means last-writer-wins. Servers MAY refuse such a
   write with 428 Precondition Required on resources whose Part says so.
4. On success the response carries the new `version` and SHOULD carry
   `ETag: "<version>"`.

**Idempotent replay.** Where an operation takes `Idempotency-Key`, a
replay of the same key with the same body returns the resource's
**current** representation with the original status code's success class
(200 for a replayed create), not a snapshot taken when it was first
created. The same key with a different body is 409 `idempotency-conflict`.
Keys are scoped to the credential and the operation, and servers MUST
retain them for at least 24 hours.

## 4.4 Datatype conventions

APX reuses APDS datatypes by `$ref`: `DateTime` (RFC 3339), `Duration`
(ISO 8601), `MultilingualString`, `AmountInCurrency` (ISO 4217),
`Reference`, `VersionedReference`, `DeletedReference`, `Url`. APX MUST NOT
introduce parallel datatypes for concepts APDS already models.
