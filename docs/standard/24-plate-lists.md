# APX Part 24 — Plate Lists (optional class `apx-plate-lists`)

Lists about a plate that someone other than the vehicle's keeper
maintains: a city's scofflaw list, an operator's watch list, the plates
allowed to park without a right of their own, the enforcement and
service vehicles whose visits are recorded but never enforced. A list
says what to do when a listed plate is seen at a place.

**What APDS has.** Nothing. A plate list is not a credential (Part 21
models the media a customer holds) and not a right (Part 14 models what
a holder is entitled to). The vehicle credential itself is the APDS
`CredentialTypeEnum` pair a lane reads, reused by `$ref`.

**What this Part adds.** `PlateList` (the policy: category, owner,
places with per-place flags), `PlateListEntry` (one credential on a
list), the routes under `/v1/plate-lists`, the Part 5 change feed on
both, and the topic `apx.platelists.changed.v1`. Screening — matching a
read against the lists and deciding what happens — stays with the
implementation and its operator; Part 7 alerts and Part 6 commands carry
the outcome.

## 24.1 Lists (normative)

1. A list's `category` is a definedValue of `apx-plate-list-categories`
   (Part 11) or an implementer category: `allow`, `watch`, `scofflaw`,
   `enforcementVehicle`.
2. `places[]` says where the list applies and what it does there.
   `enforced` — a match counts at this place (`allow`: as compliant;
   `scofflaw`, `watch`: as enforceable). `alertOnArrival` — a match
   raises the category's arrival alert (§24.4). `refuseService` — a
   match refuses service at a lane (§24.4). A list with no `places`
   applies nowhere; its entries are still kept.
3. A list belongs to the `apx_org` that created it (`owner`). Visibility
   follows Part 9 §9.3a: a list is visible to a token whose grant covers
   any of its `places`, and to tokens of its owner. Every
   `places[].place` written MUST lie inside the writer's grant (403
   `insufficient-grant`).
4. `status` `suspended` or `retired` stops the list applying anywhere;
   its entries remain readable for audit.
5. `PUT /v1/plate-lists/{id}` replaces the policy with the version last
   read as `If-Match` or body `version` (409 `version-conflict`, Part 4
   §4.2a). Entries are not part of that body.

## 24.2 Entries (normative)

1. An entry's credential is an APDS `CredentialTypeEnum` value and its
   identification, with an optional `jurisdiction`. `validity` bounds
   when the entry is in force; an absent bound is open.
2. Adding an entry whose credential is already on the list with an
   overlapping validity updates that entry (200) instead of creating a
   second one, so a nightly load is naturally idempotent.
3. `details` records why the plate is listed, as the list owner says
   (amount owed, notice count, the owner's reference). It carries no
   personal data beyond the plate.
4. Removing an entry is `DELETE …/entries/{entryId}`; the entry feed
   emits a tombstone.
5. **Privacy.** Plate values appear only under `apx.platelists:read` or
   `:manage` (Part 9 §9.6). A consumer that only screens MAY hold the
   `apds-ext:apx:credential-digest@1.0` decoration of each entry instead
   and match by digest (Part 9 §9.6 rule 6). The list owner publishes the
   retention of its entries.

## 24.3 Change feed and eventing (normative)

1. `GET /v1/plate-lists` and `GET /v1/plate-lists/{id}/entries` serve
   the Part 5 §5.2 change feed (`mode=change&cursor=`), so a site or an
   edge implementation keeps a local copy current and catches up after a
   link outage.
2. Every create, change, or removal of a list or an entry publishes
   `apx.platelists.changed.v1` (data: the `PlateList` with its
   `entryCount`; subject: the list). The event carries no plate values;
   consumers resync entries through the feed.

## 24.4 Screening (informative)

A lane, an LPR system, or an enforcement handheld screens each read
against the lists that apply at its place. APX defines the facts, not the
decision:

- A match on a list with `alertOnArrival` raises the Part 7 alert of its
  category — `watchListArrival`, `scofflawArrival` — with `relatedEntity`
  the `PlateListEntry` and the read as evidence (Part 7 §7.6).
- A match on a list with `refuseService` at a gated lane withholds the
  vend and shows the refused-service message through a Part 6
  `displayMessage` command, whose `result.display` is the proof of what
  was shown (Part 6 §6.1a); the alert is `refusedServiceArrival`.
- A match on an `allow` list with `enforced` satisfies the Part 19 §19.3
  eligibility check at that place; the eligibility result names the list
  entry as its basis.
- A match on an `enforcementVehicle` list is recorded and never screened
  further.

Whether a match refuses service, raises an alert, or both is the list's
place flags; how a match is made (exact, alias, fold) is the
implementation's, and where a Session results it is recorded as
`MatchEvidence` with `matchType: list` (Part 5 §5.8).

## 24.5 Conformance

`apx-plate-lists` requires the base classes and: §24.1 lists with
per-place flags, ownership, and the visibility and grant rules; §24.2
entries with the upsert rule and the plate-value scope rule; §24.3 the
change feed on both routes and `apx.platelists.changed.v1`. Raising the
§24.4 alerts is conditional on `apx-alerts` (Annex A.22).

## 24.6 Registry entries

| Registry | Entries |
|---|---|
| `apx-conformance-classes` v8 | `apx-plate-lists` |
| `apx-plate-list-categories` v1 | `allow`, `watch`, `scofflaw`, `enforcementVehicle` |
| `apx-topics` v12 | `apx.platelists.changed.v1` |
| `apx-alert-types` v5 | `watchListArrival`, `scofflawArrival`, `refusedServiceArrival` |

Scopes: `apx.platelists:read`, `apx.platelists:manage`.
