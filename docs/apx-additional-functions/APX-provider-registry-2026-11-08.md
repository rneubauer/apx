# Design note: the APX provider registry

- **Status:** Decided 2026-11-08 by Rick Neubauer (project owner and architect). Implemented on branch
  `feat/provider-registry`, for the next edition after 0.16.0. Amended 2026-11-13 by three recommended options
  that are adopted in the branch but **pending Rick's confirmation** (see "Decisions adopted 2026-11-13" below).
- **Date:** 2026-11-08
- **Checked against:** `rneubauer/apx` main, edition **0.16.0** (Parts 0–26, Annex A).
- **Decision record:** `docs/decisions/` does not exist on `main` yet (the PRs that add it are not merged), so the ADR
  content (context, decision, consequences, alternatives) is in this note. When `docs/decisions/` lands, this note
  becomes ADR 0021 `docs/decisions/0021-provider-registry.md`.

## Context

APX ids are local to the implementation that issued them (Part 4 §4.1a). That is right for a single site, but a
system that brings several providers together, such as an aggregator, a call center or an analytics platform, can
see two providers use the same place id or location id. Nothing in 0.16.0 said whose id it was, so nothing stopped
two records being merged by mistake.

Separately, the project has no way to know who is interested in APX or building on it. The vendor namespace rules
(Part 3 §3.3) say "use your own namespace" but there is no list of whose namespace is whose.

## Decisions

| # | Decision |
|---|---|
| R1 | **Registration is required now.** Every APX implementation, whether a server, a data provider or a client that pushes data, MUST be registered in the provider registry (Part 3 §3.1a, Annex A APX-CORE-21). The goal today is knowing who uses APX, so an entry can be as small as a name, a namespace and a contact. |
| R2 | **Carrying the id in the data is not required yet.** `providerId` in `/.well-known/apx-configuration`, `RecordInfo.provider` and `EventEnvelope.provider` are OPTIONAL, with SHOULD. The prose says a later edition is expected to make them MUSTs, without naming a version. |
| R3 | **Global keying** (amended by D1 below). Local ids stay local. An interconnected or aggregating system MUST key a record by (`providerId`, local id), never the local id alone (Part 4 §4.1b, cross-referenced from Part 18 §18.2; Annex A APX-CORE-22). Aggregators MUST preserve the original provider when they re-publish: `provider` names the source, never the aggregator. |
| R4 | **No APDS schema changes** (Part 0 §0.2). APDS `Reference` gets no new member. The pairing rule lives in prose and in APX-owned schemas only; a Reference in a record resolves within that record's provider (§4.1b rule 4). |
| R5 | **The file** (amended by D2 below). `spec/providers/apx-providers.json`, with its own JSON Schema `spec/providers/provider.schema.json`. Each entry: `providerId` (UUID), `name`, `namespace` (the partner-extension namespace, so one registration claims both), `url`, `roles` (fixed list), `contact` (organisational only), `status` (`active` or `retired`), `registeredDate`. |
| R6 | **Add-only**, like the registries: never delete or renumber, retire instead. Top-level `version` increments on every change. `tools/check-providers.mjs` enforces the schema, uniqueness and add-only behaviour against the base branch, in `npm test` and CI. |
| R7 | **Approval.** The APX maintainers review and merge registration pull requests against published criteria: a real organisation, a unique namespace, an organisational contact, no impersonation (Part 11 §11.3 rule 5). |
| R8 | **Seed entry.** Umojo, Inc., `providerId` `8ddabe04-3d59-415d-a8ce-620d01b1a240`, namespace `umojo`. The simulator's bootstrap document returns it by default. |

## Decisions adopted 2026-11-13 (recommended options, pending Rick's confirmation)

An architecture review of the draft pull request (#60) raised three questions. For each, the recommended option is
adopted in the branch so it can be reviewed as text and code. None of them is Rick's decision until he confirms it;
each can be reverted on its own.

| # | Decision | Amends |
|---|---|---|
| D1 | **Installation id.** The bootstrap document gains an optional `installationId` (UUID). It identifies one installation: one deployment or instance of an implementation. The installation generates it; it is not registered; it never changes for the life of the installation. The global key becomes (`providerId`, `installationId`, local id). The pair (`providerId`, local id) stays acceptable only where the provider guarantees its ids are unique across its whole estate. `RecordInfo.installation` and the envelope `installation` are added beside `provider`, with the same wording: OPTIONAL, SHOULD now, expected to become REQUIRED. When absent, the receiver takes the installation from the source's bootstrap document. Aggregators keep the original installation. Annex A APX-CORE-22 is reworded and APX-CORE-23 added. | R2, R3 |
| D2 | **Per-product entries.** A company registers once. It MAY add further entries, one per product, each with its own `providerId` and a new `parent` member naming the company entry. A product entry shares the company's namespace: namespaces are unique among company entries, and a product entry's namespace MUST equal its parent's. A parent must be a company entry (products do not nest). `parent` is immutable like `providerId`. Part 3 §3.1a rule 2 now reads: the company entry is required; product entries are optional. | R1, R5, R6 |
| D3 | **Discovery `providerId` stays SHOULD.** No change: `providerId` in `/.well-known/apx-configuration` remains OPTIONAL with SHOULD in this edition, like `installationId` and the data members. | R2 |

### Why

- **D1.** The architect found that local ids are often unique per site, not per provider. A PARCS vendor running
  the same product at a hundred garages usually numbers each garage's places, lanes and sessions from its own
  database, so two of that vendor's own sites can issue the same id. The pair (`providerId`, local id) then
  collides inside one vendor, which is the very failure the registry was meant to stop. A per-installation id
  fixes it without asking anyone to register each site: the installation makes the UUID itself and publishes it
  in the bootstrap document, which a receiver reads anyway. Keeping the pair for providers that do guarantee
  estate-wide unique ids (a single hosted platform with one database, for example) avoids forcing a third key
  part on systems that do not need it. `installationId` is separate from `source` and `RecordInfo.origin`
  because those are URLs, which change when a host moves; the installation id does not.
- **D2.** Some companies sell several products that are deployed and integrated separately. A receiver that wants
  to tell them apart could only do it by guessing from host names. A product entry gives each product its own
  `providerId` while the company stays the one accountable registrant and keeps one namespace. Making product
  entries optional keeps registration as cheap as before (R1): a company entry is still all that is required. A
  single `parent` level keeps the check simple and the meaning clear; deeper trees (divisions, product lines)
  have no use case yet.
- **D3.** Making the discovery `providerId` a MUST now would make every existing 0.16.0 implementation
  non-conforming on upgrade for a member that a receiver can already get from the registration bound to the
  credential (§4.1b rule 3). Registration itself is the MUST that serves the immediate goal of knowing who uses
  APX. The data members, discovery included, move to MUST together in a later edition, as R2 already says.

### The architect's other review points

- **Keep `providerId` separate from the customer's tenant id.** A platform's tenant id says whose data it
  is: the customer organisation the data belongs to. A `providerId` says which system produced it. One city
  has several providers, and one vendor serves many cities, so neither can be derived from the other. A
  platform that holds both stores `providerId` on the source side (its feed or connection registry and the
  external references on records) and maps between them itself. Nothing in this change ties them together.
- **Bind `providerId` to the OAuth client, as a receiver-side SHOULD.** Already the chosen option (see
  "Self-asserted id, or bound to the OAuth client" below) and now Part 11 §11.4 rule 5: a receiver SHOULD bind
  the `providerId` to the credentials it issues, and SHOULD check that an asserted `providerId` is the
  provider's own, one of its own product entries, or one it is entitled to relay. It stays a SHOULD on the
  receiver, not a token format rule, so aggregation keeps working.

### What changed in the branch

- Part 2 (term "Installation"), Part 3 §3.1a rules 2 and 4, Part 4 §4.1b rules 1 to 6 and §4.2, Part 8 §8.2,
  Part 11 §11.3 rule 5 and §11.4 (product entries; rules renumbered, the credential binding is now rule 5),
  Part 16 §16.1, Part 18 §18.2 and §18.6, Annex A APX-CORE-21 and APX-CORE-22 reworded, APX-CORE-23 added, and
  an `installationId` line in the ICS template.
- OpenAPI: `ApxConfiguration.installationId`, `RecordInfo.installation`, `EventEnvelope.installation`, all
  optional. Additive only.
- `spec/providers/provider.schema.json`: optional `parent`. `tools/check-providers.mjs`: namespace unique among
  company entries, parent exists and is a company entry, namespace matches the parent's, no active product under
  a retired company, `parent` immutable in the add-only check. Cases in `tools/check-providers.test.mjs`, run by
  `npm run providers:check`.
- Simulator: the bootstrap document carries a fixed `installationId` by default, overridable or removable per
  world or host like `providerId`.
- `docs/registering-as-a-provider.md`: product entries and the installation id.

## Consequences

- An implementation run by an unregistered organisation does not conform to any class. Since registration is a pull
  request with no fee, the cost of the precondition is a few minutes.
- Receivers can key data correctly today even though few providers send `provider` yet: §4.1b rule 3 takes the
  provider from the source's bootstrap `providerId` or from the registration bound to the credential.
- The registry is not pinned by an edition (Part 3 §3.4): it is a live list, and a registration never waits for one.
  It is therefore not in `spec/edition.json`.
- The site publishes the registry under `/providers/` next to `/registries/`.

## Alternatives considered

### Self-asserted id, or bound to the OAuth client

A provider asserts its `providerId` in data. On its own that is self-asserted: a provider could put any id there,
including another provider's. The alternative is to derive the provider only from the OAuth client that sent the
data.

**Chosen:** self-asserted in data, plus a receiver-side practice: a receiver SHOULD bind the `providerId` to the
credentials it issues to that provider, and SHOULD check that an asserted `providerId` is the provider's own or one it
is entitled to relay (Part 11 §11.4 rule 5). Deriving the id only from the client would break aggregation, where one
client legitimately relays many providers' records, and would put identity into the token format, which APX leaves
to the implementer's IdP. A token claim (an `apx_provider` claim beside `apx_org`) may be worth standardising once
there is deployment experience.

### Signed data later

Signing records or envelopes with a provider key would make `provider` verifiable end to end, through any number of
aggregators. Deferred: it needs key distribution (the registry could carry a JWKS URL), a canonicalisation rule for
JSON, and agreement on what is signed. None of that is needed to learn who uses APX or to stop id collisions. The
registry's add-only shape leaves room for an optional `jwksUri` member later.

### CSV like MDS, or JSON

The Mobility Data Specification keeps its provider list as a CSV file. CSV is easy to read and diff, but cannot hold a
list (`roles`) without an ad hoc separator, has no schema that the existing `ajv` tooling can check, and is not how
any other APX artifact is published. **Chosen:** JSON with a JSON Schema, checked by the same tooling as the code-list
registries. It is not an APDS UserDefinedCodeList, because an entry carries more than a code.

### Proposing providerId to APDS later

The pairing problem is not specific to APX: any APDS consumer that merges data from two APDS servers has it. The clean
fix in APDS would be a provider member on `Reference` or on the record type. APX cannot add one (R4). **Chosen:** keep
the rule in APX prose and APX-owned schemas now, prove it in deployment, and propose it to APDS through the APX Data
Specification track (`docs/apds-submission/`) once there is experience to report. If APDS adopts a native construct,
Part 3 §3.3(8) applies and the APDS one wins.

### Other options rejected

- **Namespaces only, no UUID.** A namespace is readable but can be mistyped and is tied to a name that may change;
  a UUID is never reused and survives a rename (the namespace stays as registered).
- **Registration by issue, like code-list entries.** An issue needs a maintainer to edit the file; a pull request lets
  the registrant do it and lets CI check it before review. The issue chooser points registrants at the guide.
- **Composite keys in APDS ids** (prefixing each id with the provider). That re-shapes APDS ids and breaks every plain
  APDS client (Part 0 §0.2).
