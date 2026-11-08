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

## 4.1b Provider identity and global keying (normative)

§4.1a keeps every id local. Two providers can therefore issue the same
place id, location id, or any other id, and both are right. What makes a
record globally unique is the pair of who supplied it and its local id.

1. **Provider identity.** A provider is an organisation registered in the
   APX provider registry (Part 11 §11.4; registration is required by
   Part 3 §3.1a). Its `providerId` is a UUID that never changes and is
   never reused. A provider names itself in data by that `providerId`:
   in the bootstrap document (`providerId`, Part 16 §16.1), on a record
   (`RecordInfo.provider`, §4.2), and on an event (`EventEnvelope.provider`,
   Part 8 §8.2).
2. **The pairing rule.** An interconnected or aggregating system, meaning
   any system that holds or relays records from more than one provider,
   MUST key each record by the pair (`providerId`, local id), never by the
   local id alone. This holds for APDS entity ids (HierarchyElements and
   every other class) and APX resource ids alike, and for every place a
   key is stored: indexes, caches, warehouse tables, grants it issues,
   and references it follows.
3. **Finding the provider.** The `providerId` of a record is
   `RecordInfo.provider` (or the envelope `provider` for an event) when
   present. When it is absent, the receiver takes it from where the
   record came from: the `providerId` in the source's bootstrap document,
   or the registration it bound to the credential the source used
   (Part 11 §11.4). A receiver that cannot establish a record's provider
   MUST NOT merge that record with records from another source on local
   id alone.
4. **References stay local.** An APDS `Reference` carries `id` and
   `className` only, and APX does not add a member to it (Part 0 §0.2).
   A Reference in a record therefore resolves within the provider of the
   record that carries it: the receiver pairs the referenced id with that
   record's `providerId`.
5. **Re-publishing keeps the source.** A system that re-publishes another
   provider's record (an aggregator, a replicator, a relay) MUST keep the
   original `providerId`: `RecordInfo.provider` and the envelope
   `provider` name the source, never the system re-publishing it (Part 18
   §18.2).
6. **This edition.** Carrying `providerId` in data is OPTIONAL in this
   edition and SHOULD be done, so rule 3's fallback is the common case
   today. The pairing rule in rule 2 is REQUIRED now. A later edition is
   expected to make the data members REQUIRED.

## 4.2 Provenance

Every APX resource SHOULD carry `recordInfo` (`RecordInfo` schema), aligned
with the APDS Information Model's RecordType: `creationTime`, `creator`
(Reference to Organisation/Contact), `creationUser`, `lastUpdate`,
`lastUpdateUser`. It also carries two members of APX's own: `origin`, the
implementation that first created a replicated record (Part 18 §18.6),
and `provider`, the `providerId` of the organisation that supplied the
record (§4.1b). `provider` is OPTIONAL in this edition and SHOULD be set
by the implementation that creates the record; a system that re-publishes
the record keeps it unchanged (§4.1b rule 5). A later edition is expected
to make it REQUIRED. Where a resource has a lifecycle audit (Commands,
Alerts, TollTransactions), the immutable `statusHistory[]` is the
authoritative audit record and MUST NOT be truncated or rewritten.

## 4.3 The extensions container

Every APX resource schema includes an optional `extensions` object — the
official APDS extension mechanism (Use Case §C.2.5):

```json
"extensions": {
  "apds-ext:apx:devicestatus@1.0": {
    "device": { "id": "c1000000-0000-4000-8000-000000000011", "className": "SupplementalEquipment" },
    "deviceState": "fault"
  },
  "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold" }
}
```

- Keys MUST match `^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\.[0-9]+$`.
- The version component is the extension class's own contract version.
- Readers MUST ignore unknown keys; writers MUST preserve them (Part 3 §3.3).
- An **APX decoration key** (`apds-ext:apx:…`) MUST carry a value valid
  against that decoration's schema wherever the container appears — the
  `Extensions` schema binds each one (`devicestatus`, `ratepolicy`,
  `lpr-read`, `lane-cameras`, `reservation`, `permit`, `session-detail`,
  `match-evidence`, `violation-source`, `payment-detail`,
  `credential-digest`, `equipment-detail`, `camera`, `external-ids`,
  `place-operations`, `stay-compliance`), so a validator
  checks them on every payload. `alert-evidence` and `correlation` are
  defined in prose only (Part 7 §7.1, Part 17) and are not yet bound.

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
