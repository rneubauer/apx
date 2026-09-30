# apx-data — vetting scenarios

<!-- apx:module apx-data tag=Data,Places,Sessions,Rate_Tables,Assigned_Rights,Right_Specifications,Observation,Organisations,Quote ics=DATA -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-data`. Gaps the spec cannot express are marked
`gap=F-DATA-NN` and explained in `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`, version 7, 420 spaces), its
Level 2 `b1…0011`, space L2-017 `b1…0117`, exit lane 2 `b2…0002`. Harbor
Deck (`b1…0002`) is another operator's garage the token has no grant for;
Marina Lot (`b1…0003`) is a surface lot the operator later adds to the
city's grant. The operator organisation is `a1…0001`. Rate tables:
standard deck `d5…0001` (v7 → v8), customer-service flat $20 `d5…0002`
(flagged negotiable), a one-night event table `d5…0004`. Right
specifications: monthly permit `e1…0001`, transient parking `e1…0003`.
Assigned rights: monthly holder `e2…0001` (card MC-0777), the transient
right behind ticket T-1044 `e2…0099`. Sessions: T-1001 `c4…0001`, T-1044
`c4…0044`, the monthly holder's `c4…0052`, and `c4…0099`, which gets
deleted. Observations `f2…0901`, `f2…0902` are plate reads at lane 2.

Three credentials: `city-platform` (scopes `apx.data:read`, grant
`apx_places: ["b1…0001"]`), `lakeside-parcs` (the operator's own PARCS,
`apx.data:read apx.data:write`, same grant), and `owner-bi` (read only).
Every request carries `Authorization: Bearer …` for `city-platform`
unless the scenario says otherwise. APDS-native creates carry a
client-supplied `id` and `version: 1` (APDS convention, Part 4 §4.1);
`initiator`, `issuer`, `assignedRightIssuer`, `rateResponsibleParty`, and
`childIds` are server-assigned. `hierarchyElementRecord` is readOnly but a
full-mode write is "the complete current state", so place bodies carry it
back unchanged. Query filter `place` is APDS's `place_ids` parameter
(wire name `place`, comma-separated). `modified_since` is a Unix epoch
integer as APDS declares it, not RFC 3339 (Part 5 §5.2 rule 3).

---

## DATA-01 — A plain APDS client pulls the hierarchy, no APX anywhere

<!-- apx:scenario DATA-01 kind=happy ics=APX-DATA-01,APX-DATA-07,APX-CORE-01,APX-CORE-02 -->

**Given** the city platform's first integration is a stock APDS 4.1
client that has never heard of APX. **When** it lists places, reads the
garage, and reads the garage at an older version. **Then** it observes
pure APDS 4.1: a `HierarchyElementList`, a `Place` whose
`hierarchyElementReference` carries the native `Supply` and
`DemandTable`, and version 6 of the same element. No APX header, no APX
parameter, no APX field in the response.

<!-- apx:request GET /places?page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "b1000000-0000-4000-8000-000000000001",
      "version": 7,
      "type": "place",
      "name": [{ "language": "en", "string": "Lakeside Garage" }],
      "layer": 0,
      "hierarchyElementRecord": {
        "creationTime": "2024-03-01T00:00:00Z",
        "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
      },
      "childIds": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }],
      "timeZone": "America/Chicago"
    },
    {
      "id": "b1000000-0000-4000-8000-000000000011",
      "version": 2,
      "type": "identifiedArea",
      "name": [{ "language": "en", "string": "Level 2" }],
      "layer": 1,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
      "hierarchyElementRecord": {
        "creationTime": "2024-03-01T00:00:00Z",
        "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
      }
    }
  ]
}
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 7,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage" }],
  "layer": 0,
  "hierarchyElementRecord": {
    "creationTime": "2024-03-01T00:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "childIds": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }],
  "timeZone": "America/Chicago",
  "hierarchyElementReference": {
    "elementId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
    "supply": [{ "supplyViewType": "spaceView", "supplyQuantity": 420 }],
    "demandTable": [
      {
        "timestamp": "2026-09-24T17:44:30Z",
        "frequency": "PT1M",
        "demandType": [
          { "count": 361, "percentage": 85.9, "occupancyCalculation": "counted", "recordDateTime": "2026-09-24T17:44:30Z" }
        ]
      }
    ]
  }
}
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000001?version=6 -->
<!-- apx:response 200 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 6,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Parking Garage" }],
  "layer": 0,
  "hierarchyElementRecord": {
    "creationTime": "2024-03-01T00:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "timeZone": "America/Chicago"
}
```

---

## DATA-02 — First sync with the coarse fallback: `modified_since` and tombstones

<!-- apx:scenario DATA-02 kind=happy ics=APX-DATA-05,APX-DATA-07,APX-CORE-02 -->

**Given** the city platform holds no cursor yet. **When** it pulls
sessions changed since 17 September with the native `modified_since`
(Part 5 §5.2 rule 3). **Then** a stock `SessionList` whose
`deletedReferences` names the session purged on the 20th — APDS's own
tombstone shape, before any APX parameter is used.

<!-- apx:request GET /sessions?place=b1000000-0000-4000-8000-000000000001&modified_since=1789603200&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c4000000-0000-4000-8000-000000000001",
      "version": 3,
      "actualStart": "2026-09-24T15:02:11Z",
      "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
      "identifiedCredentials": [
        { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1001", "className": "Credential" } }
      ],
      "segments": [
        {
          "id": "c5000000-0000-4000-8000-000000000001",
          "version": 1,
          "actualStart": "2026-09-24T15:02:11Z",
          "assignedRight": { "id": "e2000000-0000-4000-8000-000000000098", "version": 1, "className": "AssignedRight" },
          "validationType": ["ticket"]
        }
      ]
    }
  ],
  "deletedReferences": [
    { "id": "c4000000-0000-4000-8000-000000000097", "className": "Session", "deleteTimestamp": "2026-09-20T03:10:00Z" }
  ]
}
```

---

## DATA-03 — Switch to the cursor feed and drain it

<!-- apx:scenario DATA-03 kind=happy ics=APX-DATA-03,APX-DATA-04,APX-DATA-01 -->

**Given** the platform has finished its full pull and been handed cursor
`c:00041`. **When** it asks `/sessions` for changes after that cursor.
**Then** a `ChangeFeedPage`: change-mode items carrying identity plus
only the changed fields, a tombstone, a new cursor, and `next` pointing
at the immediately available second page; the second page ends with
`next: null`, so the platform polls later with `c:00043`.

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00041 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "c4000000-0000-4000-8000-000000000001",
      "version": 4,
      "className": "Session",
      "actualEnd": "2026-09-24T18:14:34Z",
      "segments": [{ "id": "c5000000-0000-4000-8000-000000000001", "version": 2, "actualEnd": "2026-09-24T18:14:34Z" }]
    }
  ],
  "deleted": [
    { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session", "deleteTimestamp": "2026-09-24T17:58:12Z" }
  ],
  "cursor": "c:00042",
  "next": "/sessions?mode=change&cursor=c%3A00042"
}
```

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00042 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "c4000000-0000-4000-8000-000000000044",
      "version": 1,
      "className": "Session",
      "actualStart": "2026-09-24T09:15:00Z",
      "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
      "identifiedCredentials": [
        { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1044", "className": "Credential" } }
      ],
      "segments": [
        {
          "id": "c5000000-0000-4000-8000-000000000044",
          "version": 1,
          "actualStart": "2026-09-24T09:15:00Z",
          "assignedRight": { "id": "e2000000-0000-4000-8000-000000000099", "version": 1, "className": "AssignedRight" },
          "validationType": ["ticket"]
        }
      ]
    }
  ],
  "cursor": "c:00043",
  "next": null
}
```

---

## DATA-04 — Mirroring the rate deck, with the negotiable flag riding inside

<!-- apx:scenario DATA-04 kind=happy ics=APX-DATA-03,APX-DATA-01,APX-CORE-04 -->

**Given** the operator's call platform needs the deck. **When** it pulls
`/rates` for the garage in `mode=full` once, then in `mode=change` with
the cursor. **Then** the full list carries the standard deck and the flat
$20 table with its `apds-ext:apx:ratepolicy@1.0` decoration, and the
change page carries only the corrected line on v8. The full-mode
`RateTable` validates once the data overlay drops the two phantom
required members (erratum 004), and the decoration lives in the
`extensions` member the overlay declares on every APDS entity (erratum 010).

<!-- apx:request GET /rates?place=b1000000-0000-4000-8000-000000000001&mode=full&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "d5000000-0000-4000-8000-000000000001",
      "version": 7,
      "rateTableName": [{ "language": "en", "string": "Standard deck" }],
      "availability": "public",
      "rateType": "hourly",
      "rateResponsibleParty": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "rateLineCollections": [
        {
          "id": "d6000000-0000-4000-8000-000000000001",
          "version": 7,
          "collectionSequence": 1,
          "applicableCurrency": "USD",
          "resetTime": "00:00",
          "validStart": "2026-01-01T00:00:00Z",
          "relativeTimes": true,
          "taxIncluded": true,
          "rateLines": [
            { "id": "d7000000-0000-4000-8000-000000000001", "version": 7, "sequence": 1, "rateLineType": "incrementingRate", "incrementPeriod": "PT1H", "value": 3.0, "description": [{ "language": "en", "string": "per hour" }] },
            { "id": "d7000000-0000-4000-8000-000000000002", "version": 7, "sequence": 2, "rateLineType": "flatRate", "value": 24.0, "description": [{ "language": "en", "string": "daily maximum" }] },
            { "id": "d7000000-0000-4000-8000-000000000003", "version": 7, "sequence": 3, "rateLineType": "flatRate", "value": 32.0, "description": [{ "language": "en", "string": "lostTicketFee" }] }
          ]
        }
      ]
    },
    {
      "id": "d5000000-0000-4000-8000-000000000002",
      "version": 3,
      "rateTableName": [{ "language": "en", "string": "Customer-service flat $20" }],
      "availability": "restricted",
      "rateType": "daily",
      "rateResponsibleParty": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "rateLineCollections": [
        {
          "id": "d6000000-0000-4000-8000-000000000002",
          "version": 3,
          "collectionSequence": 1,
          "applicableCurrency": "USD",
          "resetTime": "00:00",
          "validStart": "2026-01-01T00:00:00Z",
          "relativeTimes": true,
          "taxIncluded": true,
          "rateLines": [
            { "id": "d7000000-0000-4000-8000-000000000021", "version": 3, "sequence": 1, "rateLineType": "flatRate", "value": 20.0 }
          ]
        }
      ],
      "extensions": {
        "apds-ext:apx:ratepolicy@1.0": { "negotiable": true, "displayName": "Customer-service flat $20", "note": "Use for service failures only" }
      }
    }
  ]
}
```

<!-- apx:request GET /rates?place=b1000000-0000-4000-8000-000000000001&mode=change&cursor=r%3A00031 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T20:02:05Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "d5000000-0000-4000-8000-000000000001",
      "version": 8,
      "className": "RateTable",
      "rateLineCollections": [
        {
          "id": "d6000000-0000-4000-8000-000000000001",
          "version": 8,
          "rateLines": [
            { "id": "d7000000-0000-4000-8000-000000000004", "version": 8, "sequence": 4, "rateLineType": "flatRate", "value": 12.0, "description": [{ "language": "en", "string": "evening flat after 18:00" }] }
          ]
        }
      ]
    }
  ],
  "cursor": "r:00032",
  "next": null
}
```

---

## DATA-05 — The other two feed routes: places and assigned rights

<!-- apx:scenario DATA-05 kind=happy ics=APX-DATA-03,APX-DATA-04 -->

**Given** the owner's BI platform holds cursors for `/places` and
`/rights/assigned`. **When** it polls both in `mode=change`. **Then** the
places page carries one item — the garage with only its demand table
changed — and the assigned-rights page carries the monthly holder's
renewed expiry plus a tombstone for a cancelled permit. Each feed is its
own class, its own cursor, its own ordering.

<!-- apx:request GET /places?mode=change&cursor=p%3A00120 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T17:52:11Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "b1000000-0000-4000-8000-000000000001",
      "version": 7,
      "className": "Place",
      "hierarchyElementReference": {
        "elementId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
        "demandTable": [
          {
            "timestamp": "2026-09-24T17:52:00Z",
            "demandType": [
              { "count": 379, "percentage": 90.2, "occupancyCalculation": "counted", "recordDateTime": "2026-09-24T17:52:00Z" }
            ]
          }
        ]
      }
    }
  ],
  "cursor": "p:00121",
  "next": null
}
```

<!-- apx:request GET /rights/assigned?place=b1000000-0000-4000-8000-000000000001&mode=change&cursor=a%3A00058 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "e2000000-0000-4000-8000-000000000001",
      "version": 13,
      "className": "AssignedRight",
      "expiry": "2026-10-31T23:59:59Z"
    }
  ],
  "deleted": [
    { "id": "e2000000-0000-4000-8000-000000000050", "className": "AssignedRight", "deleteTimestamp": "2026-09-24T16:40:00Z" }
  ],
  "cursor": "a:00059",
  "next": null
}
```

---

## DATA-06 — The warehouse crashed mid-load: replay from the old cursor

<!-- apx:scenario DATA-06 kind=lifecycle ics=APX-DATA-04 -->

**Given** the BI loader wrote cursor `c:00042` to disk only after
committing the page — and died between the two. **When** it restarts and
replays from the cursor it last persisted, `c:00041`. **Then** the server
returns exactly the page it returned in DATA-03: same item, same
tombstone, same next cursor. Replaying an issued cursor yields every
change after it exactly once; the loader's idempotent upsert makes the
duplicate harmless.

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00041 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "c4000000-0000-4000-8000-000000000001",
      "version": 4,
      "className": "Session",
      "actualEnd": "2026-09-24T18:14:34Z",
      "segments": [{ "id": "c5000000-0000-4000-8000-000000000001", "version": 2, "actualEnd": "2026-09-24T18:14:34Z" }]
    }
  ],
  "deleted": [
    { "id": "c4000000-0000-4000-8000-000000000099", "className": "Session", "deleteTimestamp": "2026-09-24T17:58:12Z" }
  ],
  "cursor": "c:00042",
  "next": "/sessions?mode=change&cursor=c%3A00042"
}
```

---

## DATA-07 — Back from a two-week outage: the cursor is too old

<!-- apx:scenario DATA-07 kind=refusal ics=APX-DATA-05,APX-DATA-03 -->

**Given** the city platform was down from 8 to 24 September and still
holds cursor `c:00007`, issued on the 8th. **When** it presents it.
**Then** 404 `target-not-found` — the server retains seven days, the
cursor is sixteen days old — and the platform re-syncs with `mode=full`
before taking a fresh cursor. The cursor is an APX parameter, so the 404 the
data overlay declares on the feed routes is always a `Problem` (Part 5
§5.2).

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00007 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Cursor not found",
  "status": 404,
  "detail": "Cursor c:00007 was issued 2026-09-08T06:00:00Z; this server retains 7 days of change history. Re-sync with mode=full.",
  "instance": "/sessions"
}
```

<!-- apx:request GET /sessions?place=b1000000-0000-4000-8000-000000000001&mode=full&start_after=2026-09-24T00:00:00Z&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c4000000-0000-4000-8000-000000000044",
      "version": 1,
      "actualStart": "2026-09-24T09:15:00Z",
      "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
      "identifiedCredentials": [
        { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1044", "className": "Credential" } }
      ],
      "segments": [
        {
          "id": "c5000000-0000-4000-8000-000000000044",
          "version": 1,
          "actualStart": "2026-09-24T09:15:00Z",
          "assignedRight": { "id": "e2000000-0000-4000-8000-000000000099", "version": 1, "className": "AssignedRight" },
          "validationType": ["ticket"]
        }
      ]
    }
  ]
}
```

---

## DATA-08 — A cursor from another filter set, and from another credential

<!-- apx:scenario DATA-08 kind=refusal ics=APX-DATA-04,APX-DATA-05 -->

**Given** cursor `c:00043` was issued to `city-platform` for the
unfiltered sessions feed. **When** the same credential presents it with a
`place` filter added, and then `owner-bi` presents it verbatim. **Then**
both are 404 `target-not-found`: a cursor is scoped to (class,
credential, filter set) and never composes across them (§5.2 rule 5).
Same 404 as DATA-07.

<!-- apx:request GET /sessions?place=b1000000-0000-4000-8000-000000000011&mode=change&cursor=c%3A00043 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Cursor not found",
  "status": 404,
  "detail": "Cursor c:00043 was issued for the unfiltered Session feed; it cannot be resumed with filter place=b1000000-0000-4000-8000-000000000011. Re-sync that filter set with mode=full.",
  "instance": "/sessions"
}
```

```http
GET /sessions?mode=change&cursor=c%3A00043
Authorization: Bearer <owner-bi>
```

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00043 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Cursor not found",
  "status": 404,
  "detail": "Cursor c:00043 is not known for this credential.",
  "instance": "/sessions"
}
```

---

## DATA-09 — The city's grant grows: Marina Lot arrives as a grantAddition

<!-- apx:scenario DATA-09 kind=edge ics=APX-DATA-06,APX-DATA-03,APX-DATA-04 -->

**Given** the operator adds Marina Lot to the city platform's
`apx_places` grant overnight. **When** the platform polls `/places` with
its existing cursor. **Then** the first page after the change carries
`grantAdditions` naming the new subtree root — the cursor does not
retroactively cover its history — and the platform runs a `mode=full`
pull for that subtree before trusting the feed for it. The next page has
no `grantAdditions`. The subtree pull uses the native `place` filter the
data overlay adds to `/places` (subtree-inclusive, as on `/sessions`).

<!-- apx:request GET /places?mode=change&cursor=p%3A00121 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-25T06:00:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [],
  "cursor": "p:00122",
  "grantAdditions": ["b1000000-0000-4000-8000-000000000003"],
  "next": null
}
```

<!-- apx:request GET /places?place=b1000000-0000-4000-8000-000000000003&mode=full&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790316000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "b1000000-0000-4000-8000-000000000003",
      "version": 2,
      "type": "place",
      "name": [{ "language": "en", "string": "Marina Lot" }],
      "layer": 0,
      "hierarchyElementRecord": {
        "creationTime": "2025-11-12T00:00:00Z",
        "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
      },
      "timeZone": "America/Chicago",
      "hierarchyElementReference": {
        "elementId": { "id": "b1000000-0000-4000-8000-000000000003", "version": 2, "className": "Place" },
        "supply": [{ "supplyViewType": "spaceView", "supplyQuantity": 80 }]
      }
    }
  ]
}
```

<!-- apx:request GET /places?mode=change&cursor=p%3A00122 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-25T06:05:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [],
  "cursor": "p:00122",
  "next": null
}
```

---

## DATA-10 — The PARCS pushes a new session in full mode

<!-- apx:scenario DATA-10 kind=happy ics=APX-DATA-01,APX-DATA-02,APX-CORE-03 -->

**Given** a car takes ticket T-1101 at the entry lane. **When**
`lakeside-parcs` posts the session with a client-supplied id and no
`APX-Update-Mode` header (so `full`, stock APDS behaviour). **Then** 201
with APDS's `ResponseStatus`, and a read shows the server-assigned
`initiator`. The header is declared on the native PUTs only; a create
always carries full state (Part 5 §5.1).

```http
POST /sessions
Authorization: Bearer <lakeside-parcs>
Content-Type: application/json
```

<!-- apx:request POST /sessions -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualStart": "2026-09-24T18:31:04Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 1,
      "actualStart": "2026-09-24T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ],
  "identifiedVehicle": { "country": "US", "stateProvince": "IL", "color": "blue" }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "Session created successfully." }
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualStart": "2026-09-24T18:31:04Z",
  "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 1,
      "actualStart": "2026-09-24T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ],
  "identifiedVehicle": { "country": "US", "stateProvince": "IL", "color": "blue" }
}
```

---

## DATA-11 — The PARCS retries the same POST, and posts a broken one

<!-- apx:scenario DATA-11 kind=refusal ics=APX-CORE-03,APX-DATA-01 -->

**Given** the PARCS never saw the 201 from DATA-10 and retries. **When**
it re-posts the same client-supplied id, and separately posts a session
with no `actualStart`. **Then** 409 with the conflicting id listed in
`ids` (APDS convention; APX-CORE-03), and 400. Both keep the APDS
`ResponseStatus` shape; with `Accept: application/problem+json` the same
409 is the registered `id-collision` problem (Part 5 §5.1a).

```http
POST /sessions
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /sessions -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualStart": "2026-09-24T18:31:04Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 1,
      "actualStart": "2026-09-24T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ]
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Session can not be created due to conflict: id already exists.", "ids": ["c4000000-0000-4000-8000-000000000101"] }
```

```http
POST /sessions
Authorization: Bearer <lakeside-parcs>
Accept: application/problem+json
```

<!-- apx:request POST /sessions -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualStart": "2026-09-24T18:31:04Z",
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 1,
      "actualStart": "2026-09-24T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ]
}
```

The 409 now declares `application/problem+json` beside `ResponseStatus`
(data overlay, Part 5 §5.1a). The runner validates a response against its
`application/json` alternative whenever one exists, so the problem body
is checked on its own:

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/id-collision",
  "title": "Client-supplied id already exists",
  "status": 409,
  "detail": "Session c4000000-0000-4000-8000-000000000101 already exists at version 1.",
  "instance": "/sessions"
}
```

<!-- apx:request POST /sessions invalid -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000102",
  "version": 1,
  "identifiedCredentials": [
    { "type": "ticket", "identifier": { "id": "T-1102", "className": "Credential" } }
  ]
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Session can not be created due to missing data: actualStart, segments." }
```

---

## DATA-12 — Close the session with a change-mode PUT: absent means unchanged

<!-- apx:scenario DATA-12 kind=happy ics=APX-DATA-02,APX-DATA-01 -->

**Given** T-1101 exits at 21:40. **When** the PARCS sends
`APX-Update-Mode: change` with identity, `actualEnd`, and the closed
segment — nothing else. **Then** 200, and a read shows version 2 with the
credentials and vehicle exactly as before: absent meant unchanged. The
change-mode body validates as a `ChangePayload` (Part 5 §5.1a), not as
the full native `Session`.

```http
PUT /sessions/c4000000-0000-4000-8000-000000000101
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: change
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualEnd": "2026-09-24T21:40:12Z",
  "segments": [
    { "id": "c5000000-0000-4000-8000-000000000101", "version": 1, "actualEnd": "2026-09-24T21:40:12Z" }
  ]
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Session updated successfully." }
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 2,
  "actualStart": "2026-09-24T18:31:04Z",
  "actualEnd": "2026-09-24T21:40:12Z",
  "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 2,
      "actualStart": "2026-09-24T18:31:04Z",
      "actualEnd": "2026-09-24T21:40:12Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ],
  "identifiedVehicle": { "country": "US", "stateProvince": "IL", "color": "blue" }
}
```

---

## DATA-13 — Explicit null clears the vehicle description

<!-- apx:scenario DATA-13 kind=happy ics=APX-DATA-02 -->

**Given** the attendant recorded the wrong car's colour on T-1101.
**When** the PARCS sends a change-mode PUT with `identifiedVehicle: null`.
**Then** 200, and the read shows version 3 with `identifiedVehicle`
gone and every other field untouched. The body is a `ChangePayload`, whose
members may be null (Part 5 §5.1a).

```http
PUT /sessions/c4000000-0000-4000-8000-000000000101
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: change
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 2,
  "identifiedVehicle": null
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Session updated successfully." }
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 200 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 3,
  "actualStart": "2026-09-24T18:31:04Z",
  "actualEnd": "2026-09-24T21:40:12Z",
  "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 7, "className": "Place" },
  "identifiedCredentials": [
    { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1101", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000101",
      "version": 2,
      "actualStart": "2026-09-24T18:31:04Z",
      "actualEnd": "2026-09-24T21:40:12Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ]
}
```

---

## DATA-14 — A stale version, in both error dialects

<!-- apx:scenario DATA-14 kind=refusal ics=APX-DATA-02,APX-CORE-05 -->

**Given** a second PARCS node still believes T-1101 is at version 1.
**When** it sends a change-mode PUT against version 1, first as a plain
APDS client, then with `Accept: application/problem+json`. **Then** 409
both times: the APDS `ResponseStatus`, and the registered
`version-conflict` problem. Both are declared on the native route: the
problem is a second media type selected by `Accept` (Part 5 §5.1a). A PUT to an id that does not exist is 404, and
a body with no identity is 400.

```http
PUT /sessions/c4000000-0000-4000-8000-000000000101
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: change
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualEnd": "2026-09-24T21:41:00Z"
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Session can not be updated due to conflict: version 1 is stale, current version is 3.", "ids": ["c4000000-0000-4000-8000-000000000101"] }
```

```http
PUT /sessions/c4000000-0000-4000-8000-000000000101
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: change
Accept: application/problem+json
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000101",
  "version": 1,
  "actualEnd": "2026-09-24T21:41:00Z"
}
```

The problem-dialect 409 (declared as a second media type; checked on its
own, as in DATA-11):

<!-- apx:validate Problem -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Stale version",
  "status": 409,
  "detail": "Session c4000000-0000-4000-8000-000000000101 is at version 3; the update targeted version 1.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

```http
PUT /sessions/c4000000-0000-4000-8000-0000000000ff
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-0000000000ff -->
```json
{
  "id": "c4000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "actualStart": "2026-09-24T18:31:04Z",
  "identifiedCredentials": [
    { "type": "ticket", "identifier": { "id": "T-1199", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-0000000000ff",
      "version": 1,
      "actualStart": "2026-09-24T18:31:04Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000101", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ]
}
```

<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Session can not be updated as it has not been found.", "ids": ["c4000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 invalid -->
```json
{ "actualEnd": "2026-09-24T21:41:00Z" }
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Session can not be updated due to missing data: id, version." }
```

---

## DATA-15 — Delete a duplicate session; the tombstone reaches every consumer

<!-- apx:scenario DATA-15 kind=lifecycle ics=APX-DATA-05,APX-DATA-01,APX-DATA-03 -->

**Given** T-1101 was double-posted by a second PARCS node as
`c4…0102`. **When** the operator deletes it, deletes it again, reads it,
tries to delete the still-open `c4…0044`, and sends a malformed id.
**Then** 200, then 404, then 404 on the read, then 409 (an open session
cannot be deleted), then 400. The city's next change page carries the
tombstone, retained for the same window as cursors.

```http
DELETE /sessions/c4000000-0000-4000-8000-000000000102
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000102 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Session deleted successfully." }
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000102 -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Session can not be deleted as it has not been found.", "ids": ["c4000000-0000-4000-8000-000000000102"] }
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000102 -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Session not found." }
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000044 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Session can not be deleted due to conflict: session is still open (no actualEnd).", "ids": ["c4000000-0000-4000-8000-000000000044"] }
```

<!-- apx:request DELETE /sessions/T-1101 -->
<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Session can not be deleted due to malformed id: T-1101 is not a UUID." }
```

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00043 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T21:45:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "c4000000-0000-4000-8000-000000000101",
      "version": 3,
      "className": "Session",
      "identifiedVehicle": null
    }
  ],
  "deleted": [
    { "id": "c4000000-0000-4000-8000-000000000102", "className": "Session", "deleteTimestamp": "2026-09-24T21:44:10Z" }
  ],
  "cursor": "c:00046",
  "next": null
}
```

---

## DATA-16 — An aggregator imports Harbor Deck's level and keeps the source id

<!-- apx:scenario DATA-16 kind=happy ics=APX-CORE-11,APX-DATA-01 -->

**Given** a regional aggregator onboards Harbor Deck, and the source
implementation's id for its Level 1 collides with an element the
aggregator already hosts. **When** the aggregator mints a fresh UUID and
posts the element with the source id in `operatorDefinedReference`.
**Then** 201, and the element reads back with the alias, so the city's
stored keys can be migrated by lookup (Part 4 §4.1a, Part 18 §18.2).

```http
POST /places
Authorization: Bearer <aggregator, apx.data:write>
```

<!-- apx:request POST /places -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000021",
  "version": 1,
  "type": "identifiedArea",
  "name": [{ "language": "en", "string": "Harbor Deck — Level 1" }],
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000002", "version": 1, "className": "Place" },
  "operatorDefinedReference": { "id": "7d2f1c0e-3b4a-4c5d-9e6f-0a1b2c3d4e5f", "version": 4, "className": "IdentifiedArea" },
  "hierarchyElementRecord": {
    "creationTime": "2026-09-24T22:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000009", "version": 1, "className": "Organisation" }
  }
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "Place created successfully." }
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000021 -->
<!-- apx:response 200 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000021",
  "version": 1,
  "type": "identifiedArea",
  "name": [{ "language": "en", "string": "Harbor Deck — Level 1" }],
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000002", "version": 1, "className": "Place" },
  "operatorDefinedReference": { "id": "7d2f1c0e-3b4a-4c5d-9e6f-0a1b2c3d4e5f", "version": 4, "className": "IdentifiedArea" },
  "hierarchyElementRecord": {
    "creationTime": "2026-09-24T22:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000009", "version": 1, "className": "Organisation" }
  }
}
```

---

## DATA-17 — A vendor extension survives a full-mode PUT

<!-- apx:scenario DATA-17 kind=happy ics=APX-CORE-04,APX-DATA-02 -->

**Given** the operator's loyalty vendor decorated the garage with
`apds-ext:acmecorp:loyalty@2.1`, which the PARCS knows nothing about.
**When** the PARCS updates the garage's name with a full-mode PUT that
carries the container back verbatim, then reads it. **Then** 200, and
the read shows version 8 with both the vendor key and the APX
`devicestatus` decoration intact (tolerant reader, faithful writer). A
key that breaks the §4.3 pattern is refused with 400. The data overlay declares
`extensions` on the entity, so the pattern refusal has a schema behind it.

```http
PUT /places/b1000000-0000-4000-8000-000000000001
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: full
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 7,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage (Main)" }],
  "layer": 0,
  "hierarchyElementRecord": {
    "creationTime": "2024-03-01T00:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "timeZone": "America/Chicago",
  "extensions": {
    "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold", "partnerCode": "LKS-01" },
    "apds-ext:apx:devicestatus@1.0": { "device": { "id": "c1000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" }, "deviceState": "available" }
  }
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Place updated successfully." }
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 200 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 8,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage (Main)" }],
  "layer": 0,
  "hierarchyElementRecord": {
    "creationTime": "2024-03-01T00:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "childIds": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }],
  "timeZone": "America/Chicago",
  "extensions": {
    "apds-ext:acmecorp:loyalty@2.1": { "tier": "gold", "partnerCode": "LKS-01" },
    "apds-ext:apx:devicestatus@1.0": { "device": { "id": "c1000000-0000-4000-8000-000000000001", "className": "SupplementalEquipment" }, "deviceState": "available" }
  }
}
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000001 invalid -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 8,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage (Main)" }],
  "layer": 0,
  "timeZone": "America/Chicago",
  "extensions": { "acme-loyalty": { "tier": "gold" } }
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Place can not be updated due to invalid data: extensions key \"acme-loyalty\" does not match ^apds-ext:[a-z0-9-]+:[a-z0-9-]+@[0-9]+\\.[0-9]+$." }
```

---

## DATA-18 — Place writes the server turns away

<!-- apx:scenario DATA-18 kind=refusal ics=APX-CORE-03,APX-DATA-01 -->

**Given** a PARCS release with a bad hierarchy sync. **When** it posts a
place without a name, re-posts the garage's id, updates an id that does
not exist, updates with a stale version, deletes the garage (which has
children and open sessions), deletes a leaf space, deletes an unknown
id, and deletes a malformed one. **Then** 400, 409, 404, 409, 409, 200,
404, and 400 — every code the three place operations declare.

<!-- apx:request POST /places invalid -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000012",
  "version": 1,
  "type": "identifiedArea",
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Place can not be created due to missing data: name." }
```

<!-- apx:request POST /places -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 1,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage" }],
  "layer": 0,
  "hierarchyElementRecord": {
    "creationTime": "2026-09-24T22:10:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  },
  "timeZone": "America/Chicago"
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Place can not be created due to conflict: id already exists.", "ids": ["b1000000-0000-4000-8000-000000000001"] }
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-0000000000ff -->
```json
{
  "id": "b1000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "type": "identifiedArea",
  "name": [{ "language": "en", "string": "Level 9" }],
  "layer": 1,
  "hierarchyElementRecord": {
    "creationTime": "2026-09-24T22:10:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  }
}
```

<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Place can not be updated as it has not been found.", "ids": ["b1000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000011 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000011",
  "version": 1,
  "type": "identifiedArea",
  "name": [{ "language": "en", "string": "Level 2 — Reserved" }],
  "layer": 1,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" },
  "hierarchyElementRecord": {
    "creationTime": "2024-03-01T00:00:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" }
  }
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Place can not be updated due to conflict: version 1 is stale, current version is 2.", "ids": ["b1000000-0000-4000-8000-000000000011"] }
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Place can not be deleted due to conflict: element has 1 child element and 2 open sessions.", "ids": ["b1000000-0000-4000-8000-000000000011"] }
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000117 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Place deleted successfully." }
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000117 -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Place can not be deleted as it has not been found.", "ids": ["b1000000-0000-4000-8000-000000000117"] }
```

<!-- apx:request DELETE /places/L2-017 -->
<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Place can not be deleted due to malformed id: L2-017 is not a UUID." }
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000117 -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Place not found." }
```

---

## DATA-19 — Publish a one-night event table, correct it, retire it

<!-- apx:scenario DATA-19 kind=lifecycle ics=APX-DATA-01,APX-DATA-02 -->

**Given** a concert on the 26th needs a flat $40 event rate. **When**
the revenue manager posts the table, reads it, raises the value with a
full-mode PUT, and deletes it the morning after. **Then** 200 (APDS
declares 200, not 201, on this create — known APDS 4.1 behaviour, Part 5
§5.7), the table, 200, and 200.

```http
POST /rates
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /rates -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000004",
  "version": 1,
  "rateTableName": [{ "language": "en", "string": "Concert flat — 26 Sep" }],
  "availability": "public",
  "rateType": "event",
  "validity": {
    "validityStatus": "planned",
    "validityTimeSpecification": { "overallStartTime": "2026-09-26T16:00:00Z", "overallEndTime": "2026-09-27T04:00:00Z" }
  },
  "rateLineCollections": [
    {
      "id": "d6000000-0000-4000-8000-000000000004",
      "version": 1,
      "collectionSequence": 1,
      "applicableCurrency": "USD",
      "resetTime": "04:00",
      "validStart": "2026-09-26T16:00:00Z",
      "validEnd": "2026-09-27T04:00:00Z",
      "relativeTimes": false,
      "taxIncluded": true,
      "rateLines": [
        { "id": "d7000000-0000-4000-8000-000000000041", "version": 1, "sequence": 1, "rateLineType": "flatRate", "value": 40.0, "usageCondition": "once" }
      ]
    }
  ]
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Rate table created successfully." }
```

<!-- apx:request GET /rates/d5000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000004",
  "version": 1,
  "rateTableName": [{ "language": "en", "string": "Concert flat — 26 Sep" }],
  "availability": "public",
  "rateType": "event",
  "rateResponsibleParty": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "validity": {
    "validityStatus": "planned",
    "validityTimeSpecification": { "overallStartTime": "2026-09-26T16:00:00Z", "overallEndTime": "2026-09-27T04:00:00Z" }
  },
  "rateLineCollections": [
    {
      "id": "d6000000-0000-4000-8000-000000000004",
      "version": 1,
      "collectionSequence": 1,
      "applicableCurrency": "USD",
      "resetTime": "04:00",
      "validStart": "2026-09-26T16:00:00Z",
      "validEnd": "2026-09-27T04:00:00Z",
      "relativeTimes": false,
      "taxIncluded": true,
      "rateLines": [
        { "id": "d7000000-0000-4000-8000-000000000041", "version": 1, "sequence": 1, "rateLineType": "flatRate", "value": 40.0, "usageCondition": "once" }
      ]
    }
  ]
}
```

```http
PUT /rates/d5000000-0000-4000-8000-000000000004
Authorization: Bearer <lakeside-parcs>
APX-Update-Mode: full
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000004 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000004",
  "version": 1,
  "rateTableName": [{ "language": "en", "string": "Concert flat — 26 Sep" }],
  "availability": "public",
  "rateType": "event",
  "validity": {
    "validityStatus": "planned",
    "validityTimeSpecification": { "overallStartTime": "2026-09-26T16:00:00Z", "overallEndTime": "2026-09-27T04:00:00Z" }
  },
  "rateLineCollections": [
    {
      "id": "d6000000-0000-4000-8000-000000000004",
      "version": 1,
      "collectionSequence": 1,
      "applicableCurrency": "USD",
      "resetTime": "04:00",
      "validStart": "2026-09-26T16:00:00Z",
      "validEnd": "2026-09-27T04:00:00Z",
      "relativeTimes": false,
      "taxIncluded": true,
      "rateLines": [
        { "id": "d7000000-0000-4000-8000-000000000041", "version": 1, "sequence": 1, "rateLineType": "flatRate", "value": 45.0, "usageCondition": "once" }
      ]
    }
  ]
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Rate table updated successfully." }
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-000000000004 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Rate table deleted successfully." }
```

---

## DATA-20 — Rate writes the server turns away

<!-- apx:scenario DATA-20 kind=refusal ics=APX-DATA-02,APX-DATA-01 -->

**Given** the revenue tool is one version behind on the standard deck.
**When** it updates v7 (current is v8), updates an unknown id, sends a
table with no rate lines, deletes the standard deck (referenced by the
transient right specification), deletes an unknown id, and deletes a
malformed id. **Then** 409, 404, 400, 409, 404, 400, and the unknown
read is 404.

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 7,
  "rateTableName": [{ "language": "en", "string": "Standard deck" }],
  "availability": "public",
  "rateLineCollections": [
    {
      "id": "d6000000-0000-4000-8000-000000000001",
      "version": 7,
      "collectionSequence": 1,
      "applicableCurrency": "USD",
      "resetTime": "00:00",
      "validStart": "2026-01-01T00:00:00Z",
      "relativeTimes": true,
      "taxIncluded": true,
      "rateLines": [
        { "id": "d7000000-0000-4000-8000-000000000001", "version": 7, "sequence": 1, "rateLineType": "incrementingRate", "incrementPeriod": "PT1H", "value": 3.5 }
      ]
    }
  ]
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Rate table can not be updated due to conflict: version 7 is stale, current version is 8.", "ids": ["d5000000-0000-4000-8000-000000000001"] }
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-0000000000ff -->
```json
{
  "id": "d5000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "rateTableName": [{ "language": "en", "string": "Ghost deck" }],
  "availability": "private",
  "rateLineCollections": [
    {
      "id": "d6000000-0000-4000-8000-0000000000ff",
      "version": 1,
      "collectionSequence": 1,
      "applicableCurrency": "USD",
      "resetTime": "00:00",
      "validStart": "2026-01-01T00:00:00Z",
      "relativeTimes": true,
      "taxIncluded": true,
      "rateLines": [
        { "id": "d7000000-0000-4000-8000-0000000000ff", "version": 1, "sequence": 1, "rateLineType": "flatRate", "value": 1.0 }
      ]
    }
  ]
}
```

<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Rate table can not be updated as it has not been found.", "ids": ["d5000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000001 invalid -->
```json
{
  "id": "d5000000-0000-4000-8000-000000000001",
  "version": 8,
  "rateTableName": [{ "language": "en", "string": "Standard deck" }],
  "availability": "public",
  "rateLineCollections": []
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Rate table can not be updated due to missing data: rateLineCollections must contain at least one collection." }
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Rate table can not be deleted due to conflict: referenced by RightSpecification rateEligibility.", "ids": ["e1000000-0000-4000-8000-000000000003"] }
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Rate table can not be deleted as it has not been found.", "ids": ["d5000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request DELETE /rates/standard-deck -->
<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Rate table can not be deleted due to malformed id: standard-deck is not a UUID." }
```

<!-- apx:request GET /rates/d5000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Rate table not found." }
```

---

## DATA-21 — A new monthly-permit product: right specification lifecycle

<!-- apx:scenario DATA-21 kind=lifecycle ics=APX-DATA-01,APX-DATA-02 -->

**Given** the operator launches an "EV monthly" product on Level 2.
**When** the PARCS posts the specification, lists specifications at the
garage, reads it, extends its validity with a full-mode PUT, and — the
product having flopped — deletes it. **Then** 201, a
`RightSpecificationList`, the specification with its server-assigned
`issuer`, 200, and 200.

```http
POST /rights/specs
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /rights/specs -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000002",
  "version": 1,
  "type": "permitParking",
  "description": [{ "language": "en", "string": "EV monthly — Level 2 chargers" }],
  "transferable": false,
  "credentials": ["licensePlate", "rfid"],
  "validity": {
    "validityStatus": "active",
    "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-12-31T23:59:59Z" }
  },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }]
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "RightSpecification created successfully." }
```

<!-- apx:request GET /rights/specs?place=b1000000-0000-4000-8000-000000000001&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 3 },
  "data": [
    {
      "id": "e1000000-0000-4000-8000-000000000001",
      "version": 4,
      "type": "permitParking",
      "description": [{ "language": "en", "string": "Monthly permit" }],
      "transferable": false,
      "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2024-03-01T00:00:00Z" } },
      "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }]
    },
    {
      "id": "e1000000-0000-4000-8000-000000000003",
      "version": 2,
      "type": "oneTimeUseParking",
      "description": [{ "language": "en", "string": "Transient parking" }],
      "transferable": false,
      "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2024-03-01T00:00:00Z" } },
      "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }],
      "rateEligibility": [
        { "id": "e4000000-0000-4000-8000-000000000001", "version": 2, "priority": 1, "rateTable": { "id": "d5000000-0000-4000-8000-000000000001", "version": 8, "className": "RateTable" } }
      ]
    },
    {
      "id": "e1000000-0000-4000-8000-000000000002",
      "version": 1,
      "type": "permitParking",
      "description": [{ "language": "en", "string": "EV monthly — Level 2 chargers" }],
      "transferable": false,
      "credentials": ["licensePlate", "rfid"],
      "validity": {
        "validityStatus": "active",
        "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-12-31T23:59:59Z" }
      },
      "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }]
    }
  ]
}
```

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000002",
  "version": 1,
  "type": "permitParking",
  "description": [{ "language": "en", "string": "EV monthly — Level 2 chargers" }],
  "transferable": false,
  "credentials": ["licensePlate", "rfid"],
  "validity": {
    "validityStatus": "active",
    "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2026-12-31T23:59:59Z" }
  },
  "issuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }]
}
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000002",
  "version": 1,
  "type": "permitParking",
  "description": [{ "language": "en", "string": "EV monthly — Level 2 chargers" }],
  "transferable": false,
  "credentials": ["licensePlate", "rfid"],
  "validity": {
    "validityStatus": "active",
    "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z", "overallEndTime": "2027-03-31T23:59:59Z" }
  },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000011", "version": 2, "className": "IdentifiedArea" }]
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "RightSpecification updated successfully." }
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "RightSpecification deleted successfully." }
```

---

## DATA-22 — Right-specification writes the server turns away

<!-- apx:scenario DATA-22 kind=refusal ics=APX-DATA-02,APX-CORE-03 -->

**Given** the same PARCS release. **When** it posts a specification with
no `hierarchyElements`, re-posts the monthly permit's id, updates an
unknown id, updates the monthly permit at a stale version, deletes the
monthly permit (which has 212 assigned rights outstanding), deletes an
unknown id, and deletes a malformed id. **Then** 400, 409, 404, 409,
409, 404, 400, and an unknown read is 404.

<!-- apx:request POST /rights/specs invalid -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000005",
  "version": 1,
  "type": "permitParking",
  "transferable": false,
  "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z" } }
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "RightSpecification can not be created due to missing data: hierarchyElements." }
```

<!-- apx:request POST /rights/specs -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000001",
  "version": 1,
  "type": "permitParking",
  "transferable": false,
  "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z" } },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }]
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "RightSpecification can not be created due to conflict: id already exists.", "ids": ["e1000000-0000-4000-8000-000000000001"] }
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-0000000000ff -->
```json
{
  "id": "e1000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "type": "permitParking",
  "transferable": false,
  "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2026-10-01T00:00:00Z" } },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }]
}
```

<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "RightSpecification can not be updated as it has not been found.", "ids": ["e1000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000001 -->
```json
{
  "id": "e1000000-0000-4000-8000-000000000001",
  "version": 3,
  "type": "permitParking",
  "description": [{ "language": "en", "string": "Monthly permit" }],
  "transferable": true,
  "validity": { "validityStatus": "active", "validityTimeSpecification": { "overallStartTime": "2024-03-01T00:00:00Z" } },
  "hierarchyElements": [{ "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" }]
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "RightSpecification can not be updated due to conflict: version 3 is stale, current version is 4.", "ids": ["e1000000-0000-4000-8000-000000000001"] }
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000001 invalid -->
```json
{ "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "transferable": "no" }
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "RightSpecification can not be updated due to invalid data: transferable must be boolean; validity, hierarchyElements missing." }
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "RightSpecification can not be deleted due to conflict: 212 assigned rights are outstanding against it." }
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "RightSpecification can not be deleted as it has not been found.", "ids": ["e1000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request DELETE /rights/specs/monthly -->
<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "RightSpecification can not be deleted due to malformed id: monthly is not a UUID." }
```

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "RightSpecification not found." }
```

---

## DATA-23 — Issue a monthly permit, renew it, and the upsert PUT

<!-- apx:scenario DATA-23 kind=lifecycle ics=APX-DATA-01,APX-DATA-02,APX-DATA-03 -->

**Given** a new tenant signs up for the monthly permit on plate
SYN-5510. **When** the PARCS posts the assigned right, lists the
garage's rights in `mode=full`, reads it, renews its expiry with a
full-mode PUT, PUTs a right at an id the server has never seen (APDS
declares 201 on this PUT: create-on-put, Part 5 §5.7), and finally deletes
the never-used one. **Then** 201, an `AssignedRightList`, the right with
its server-assigned `assignedRightIssuer`, 200, 201, and 200.

```http
POST /rights/assigned
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /rights/assigned -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
    ]
  },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T22:30:00Z",
  "expiry": "2026-10-31T23:59:59Z"
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "Assigned right created successfully." }
```

<!-- apx:request GET /rights/assigned?place=b1000000-0000-4000-8000-000000000001&right_spec=e1000000-0000-4000-8000-000000000001&mode=full&page=1 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790289000, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "e2000000-0000-4000-8000-000000000001",
      "version": 13,
      "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
      "rightHolder": {
        "credentials": [
          { "type": "rfid", "credentialAssignedType": "customer", "identifier": { "id": "MC-0777", "className": "Credential" } }
        ]
      },
      "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "issueMethod": "permit",
      "expiry": "2026-10-31T23:59:59Z"
    },
    {
      "id": "e2000000-0000-4000-8000-000000000002",
      "version": 1,
      "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
      "rightHolder": {
        "credentials": [
          { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
        ]
      },
      "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "issueMethod": "electronic",
      "issuanceTime": "2026-09-24T22:30:00Z",
      "expiry": "2026-10-31T23:59:59Z"
    }
  ]
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
    ]
  },
  "assignedRightIssuer": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T22:30:00Z",
  "expiry": "2026-10-31T23:59:59Z"
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
    ]
  },
  "issueMethod": "electronic",
  "issuanceTime": "2026-09-24T22:30:00Z",
  "expiry": "2026-11-30T23:59:59Z"
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Assigned right updated successfully." }
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000003 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000003",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5511", "className": "Credential" } }
    ]
  },
  "issueMethod": "electronic",
  "expiry": "2026-10-31T23:59:59Z"
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "Assigned right created successfully." }
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "Assigned right deleted successfully." }
```

---

## DATA-24 — Assigned-right writes the server turns away

<!-- apx:scenario DATA-24 kind=refusal ics=APX-DATA-02,APX-CORE-03 -->

**Given** the same PARCS release. **When** it posts a right without a
holder, re-posts `e2…0002`, updates a right whose body carries no
specification, updates `e2…0002` at a stale version, deletes the monthly
holder's right while their session `c4…0052` is in progress, deletes an
unknown id, and deletes a malformed id. **Then** 400, 409, 400, 409, 409,
404, 400, and an unknown read is 404.

<!-- apx:request POST /rights/assigned invalid -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000004",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" }
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Assigned right can not be created due to missing data: rightHolder." }
```

<!-- apx:request POST /rights/assigned -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
    ]
  }
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Assigned right can not be created due to conflict: id already exists.", "ids": ["e2000000-0000-4000-8000-000000000002"] }
```

Sent without `APX-Update-Mode`, so in full mode. The same body would be a
valid change-mode update (only `rightHolder` changing); a validator that
knows the header applies the full-mode branch alone and refuses it (Part 5
§5.1a, since 0.12.2).

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 invalid -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 2,
  "rightHolder": { "credentials": [] }
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Assigned right can not be created due to missing data: rightSpecification." }
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
```json
{
  "id": "e2000000-0000-4000-8000-000000000002",
  "version": 1,
  "rightSpecification": { "id": "e1000000-0000-4000-8000-000000000001", "version": 4, "className": "RightSpecification" },
  "rightHolder": {
    "credentials": [
      { "type": "licensePlate", "credentialAssignedType": "vehicle", "identifier": { "id": "SYN-5510", "className": "Credential" } }
    ]
  },
  "expiry": "2026-12-31T23:59:59Z"
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Assigned right can not be created due to conflict: version 1 is stale, current version is 2.", "ids": ["e2000000-0000-4000-8000-000000000002"] }
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000001 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "Assigned right can not be deleted due to conflict: session in progress.", "ids": ["c4000000-0000-4000-8000-000000000052"] }
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Assigned right can not be deleted as it has not been found.", "ids": ["e2000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request DELETE /rights/assigned/MC-0777 -->
<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "Assigned right can not be deleted due to malformed id: MC-0777 is not a UUID." }
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "Assigned right not found." }
```

---

## DATA-25 — The contact directory: who to call about the garage

<!-- apx:scenario DATA-25 kind=lifecycle ics=APX-DATA-01,APX-DATA-02 -->

**Given** the city's platform shows a "contact operator" button. **When**
it lists operator contacts, the operator adds a 24-hour customer-service
contact, the city reads it, the operator corrects the number with a
full-mode PUT, and later retires it. **Then** a paginated list, 201, the
`ContactPoint`, 200, and 200.

<!-- apx:request GET /contacts?type=operator -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1790272800, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "contactType": "contactPoint",
      "id": "a1000000-0000-4000-8000-000000000001",
      "version": 2,
      "type": "operator",
      "organisationName": [{ "language": "en", "string": "Lakeside Parking LLC" }],
      "eMailCommonData": [{ "primaryFlag": true, "emailAddress": "ops@lakeside-garage.example" }]
    }
  ]
}
```

```http
POST /contacts
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /contacts -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-000000000003",
  "version": 1,
  "type": "customerService",
  "organisationName": [{ "language": "en", "string": "Lakeside Customer Service" }],
  "shareWithPublic": true,
  "contactDetails": [{ "available24hours": true, "contactPersonName": "Duty desk" }],
  "telephoneContacts": [{ "ituCountryCode": "1", "areaCode": "312", "localNumbers": ["5550142"] }]
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "contact a1000000-0000-4000-8000-000000000003 created" }
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-000000000003",
  "version": 1,
  "type": "customerService",
  "organisationName": [{ "language": "en", "string": "Lakeside Customer Service" }],
  "shareWithPublic": true,
  "contactDetails": [{ "available24hours": true, "contactPersonName": "Duty desk" }],
  "telephoneContacts": [{ "ituCountryCode": "1", "areaCode": "312", "localNumbers": ["5550142"] }]
}
```

<!-- apx:request PUT /contacts/a1000000-0000-4000-8000-000000000003 -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-000000000003",
  "version": 1,
  "type": "customerService",
  "organisationName": [{ "language": "en", "string": "Lakeside Customer Service" }],
  "shareWithPublic": true,
  "contactDetails": [{ "available24hours": true, "contactPersonName": "Duty desk" }],
  "telephoneContacts": [{ "ituCountryCode": "1", "areaCode": "312", "localNumbers": ["5550143"] }]
}
```

<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "contact a1000000-0000-4000-8000-000000000003 updated" }
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 200 -->
```json
{ "status": "ok", "code": 200, "message": "contact a1000000-0000-4000-8000-000000000003 deleted" }
```

---

## DATA-26 — Contact writes refused, and the directory database down at 2 am

<!-- apx:scenario DATA-26 kind=edge ics=APX-DATA-01 -->

**Given** the operator's CRM sync misbehaves during a maintenance window.
**When** it posts a contact without a `type`, re-posts the operator's
own id, updates and deletes an unknown id, deletes the operator contact
(referenced by every place), and then the directory database goes away.
**Then** 400, 409, 404, 404, 409 — and 500 from both contact reads, the
only APDS operations in this class that declare it (Part 5 §5.7).

<!-- apx:request POST /contacts invalid -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-000000000004",
  "version": 1,
  "organisationName": [{ "language": "en", "string": "Nameless" }]
}
```

<!-- apx:response 400 -->
```json
{ "status": "error", "code": 400, "message": "missing require fields" }
```

<!-- apx:request POST /contacts -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-000000000001",
  "version": 1,
  "type": "operator",
  "organisationName": [{ "language": "en", "string": "Lakeside Parking LLC" }]
}
```

<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "a contact point with this id already exists", "ids": ["a1000000-0000-4000-8000-000000000001"] }
```

<!-- apx:request PUT /contacts/a1000000-0000-4000-8000-0000000000ff -->
```json
{
  "contactType": "contactPoint",
  "id": "a1000000-0000-4000-8000-0000000000ff",
  "version": 1,
  "type": "serviceProvider",
  "organisationName": [{ "language": "en", "string": "Ghost Towing" }]
}
```

<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "a contact point with this id does not exist", "ids": ["a1000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "a contact point with this id does not exist", "ids": ["a1000000-0000-4000-8000-0000000000ff"] }
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 409 -->
```json
{ "status": "error", "code": 409, "message": "contact point cannot be deleted: referenced by 3 hierarchy elements", "ids": ["b1000000-0000-4000-8000-000000000001", "b1000000-0000-4000-8000-000000000003", "b1000000-0000-4000-8000-000000000011"] }
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{ "status": "error", "code": 404, "message": "contact not found" }
```

<!-- apx:request GET /contacts -->
<!-- apx:response 500 -->
```json
{ "status": "error", "code": 500, "message": "internal server error: contact directory unavailable" }
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 500 -->
```json
{ "status": "error", "code": 500, "message": "internal server error: contact directory unavailable" }
```

---

## DATA-27 — Plate reads: ingest, query, and stream

<!-- apx:scenario DATA-27 kind=happy ics=APX-DATA-01,APX-DATA-03 -->

**Given** the LPR camera at exit lane 2 reads SYN-1234. **When** the
PARCS posts the observation, the BI platform queries the lane's reads
since 18:00, the same read is delivered as
`apx.data.observation.created.v1`, and the BI platform then asks the
observations route for a change feed as Scenario 07 and Part 13 §13.4
promise. **Then** 201 `ResponseStatus` (declared by the data overlay,
erratum 005; the element's `type` is its credential type, since the
overlay drops the colliding wrapper discriminator, erratum 006), a
paginated list, a signed envelope whose `data` is the
`ObservationElement`, and a `ChangeFeedPage` (Part 5 §5.2 now covers
`/observations`).

```http
POST /observations
Authorization: Bearer <lakeside-parcs>
```

<!-- apx:request POST /observations -->
```json
{
  "type": "licensePlate",
  "id": "f2000000-0000-4000-8000-000000000902",
  "version": 1,
  "method": "anpr",
  "observedCredentialId": "SYN-1234",
  "observationStartTime": "2026-09-24T18:14:01Z",
  "creationDateTime": "2026-09-24T18:14:02Z",
  "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8812] } },
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" },
  "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
  "confidence": { "overallConfidence": 0.97 },
  "images": [{ "id": "f3000000-0000-4000-8000-000000000902", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0902.jpg" }]
}
```

<!-- apx:response 201 -->
```json
{ "status": "ok", "code": 201, "message": "Observation created successfully." }
```

<!-- apx:request GET /observations?place=b2000000-0000-4000-8000-000000000002&start_after=2026-09-24T18:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "referenceInstant": 1790274000,
  "offset": 0,
  "pageSize": 100,
  "total": 2,
  "data": [
    {
      "id": "f2000000-0000-4000-8000-000000000901",
      "version": 1,
      "method": "anpr",
      "type": "licensePlate",
      "observedCredentialId": "SYN-1234",
      "observationStartTime": "2026-09-24T18:13:58Z",
      "creationDateTime": "2026-09-24T18:13:59Z",
      "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8812] } },
      "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" },
      "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "confidence": { "overallConfidence": 0.91 }
    },
    {
      "id": "f2000000-0000-4000-8000-000000000902",
      "version": 1,
      "method": "anpr",
      "type": "licensePlate",
      "observedCredentialId": "SYN-1234",
      "observationStartTime": "2026-09-24T18:14:01Z",
      "creationDateTime": "2026-09-24T18:14:02Z",
      "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8812] } },
      "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" },
      "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "confidence": { "overallConfidence": 0.97 },
      "images": [{ "id": "f3000000-0000-4000-8000-000000000902", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0902.jpg" }]
    }
  ]
}
```

Delivered to the BI platform's endpoint (signature mechanics per Part 8):

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f2000000-0000-4000-8000-000000000902", "className": "Observation" },
  "time": "2026-09-24T18:14:02Z",
  "data": {
    "id": "f2000000-0000-4000-8000-000000000902",
    "version": 1,
    "method": "anpr",
    "type": "licensePlate",
    "observedCredentialId": "SYN-1234",
    "observationStartTime": "2026-09-24T18:14:01Z",
    "creationDateTime": "2026-09-24T18:14:02Z",
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8812] } },
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "confidence": { "overallConfidence": 0.97 },
    "images": [{ "id": "f3000000-0000-4000-8000-000000000902", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0902.jpg" }]
  }
}
```

The same delivery, checked against the data schema:

<!-- apx:validate ObservationElement at /data -->
```json
{
  "id": "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  "type": "apx.data.observation.created.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "f2000000-0000-4000-8000-000000000902", "className": "Observation" },
  "time": "2026-09-24T18:14:02Z",
  "data": {
    "id": "f2000000-0000-4000-8000-000000000902",
    "version": 1,
    "method": "anpr",
    "type": "licensePlate",
    "observedCredentialId": "SYN-1234",
    "observationStartTime": "2026-09-24T18:14:01Z",
    "creationDateTime": "2026-09-24T18:14:02Z",
    "location": { "observerLocation": { "type": "Point", "coordinates": [-87.6244, 41.8812] } },
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" },
    "observerOrganisation": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "confidence": { "overallConfidence": 0.97 },
    "images": [{ "id": "f3000000-0000-4000-8000-000000000902", "imageType": "plate", "imageLink": "https://api.lakeside-garage.example/lpr/f2000000-0902.jpg" }]
  }
}
```

<!-- apx:request GET /observations?mode=change&cursor=o%3A00344 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T18:20:00Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "f2000000-0000-4000-8000-000000000902",
      "version": 1,
      "className": "Observation",
      "method": "anpr",
      "observedCredentialId": "SYN-1234",
      "observationStartTime": "2026-09-24T18:14:01Z",
      "creationDateTime": "2026-09-24T18:14:02Z",
      "elementIds": { "id": "b2000000-0000-4000-8000-000000000002", "version": 3, "className": "VehicularAccess" }
    }
  ],
  "cursor": "o:00345",
  "next": null
}
```

---

## DATA-28 — A reservation channel asks for a quote

<!-- apx:scenario DATA-28 kind=happy ics=APX-DATA-01 -->

**Given** a booking site wants the price of a Saturday stay on the
transient product. **When** it posts a `QuoteRightRequest` and later
reads the quote response back by type. **Then** a paginated list with
one `QuoteRightResponse`, and the same response as a single object. The data
overlay declares the request body APDS omits (erratum 007); `GET
/quotes` returns the single matching quote, as vendored (Part 5 §5.7).

<!-- apx:request POST /quotes -->
```json
{
  "id": "f4000000-0000-4000-8000-000000000001",
  "version": 1,
  "requestTime": "2026-09-24T22:40:00Z",
  "periodStart": "2026-09-26T16:00:00Z",
  "periodEnd": "2026-09-27T02:00:00Z",
  "referencedRightSpecifications": [
    {
      "elementId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" },
      "rightSpecificationId": { "id": "e1000000-0000-4000-8000-000000000003", "version": 2, "className": "RightSpecification" }
    }
  ]
}
```

<!-- apx:response 200 -->
```json
{
  "referenceInstant": 1790289600,
  "offset": 0,
  "pageSize": 100,
  "total": 1,
  "data": [
    {
      "id": "f4000000-0000-4000-8000-000000000002",
      "version": 1,
      "quoteRequestId": { "id": "f4000000-0000-4000-8000-000000000001", "version": 1, "className": "QuoteRightRequest" },
      "requestTime": "2026-09-24T22:40:00Z",
      "responseTime": "2026-09-24T22:40:01Z",
      "start": "2026-09-26T16:00:00Z",
      "end": "2026-09-27T02:00:00Z"
    }
  ]
}
```

<!-- apx:request GET /quotes?place=b1000000-0000-4000-8000-000000000001&quote_type=QuoteRightResponse -->
<!-- apx:response 200 -->
```json
{
  "id": "f4000000-0000-4000-8000-000000000002",
  "version": 1,
  "quoteRequestId": { "id": "f4000000-0000-4000-8000-000000000001", "version": 1, "className": "QuoteRightRequest" },
  "requestTime": "2026-09-24T22:40:00Z",
  "responseTime": "2026-09-24T22:40:01Z",
  "start": "2026-09-26T16:00:00Z",
  "end": "2026-09-27T02:00:00Z"
}
```

---

## DATA-29 — How full is it right now

<!-- apx:scenario DATA-29 kind=happy ics=APX-DATA-08,APX-DATA-01 -->

**Given** the owner's dashboard wants one number, not the hierarchy.
**When** it reads the garage's occupancy, then Level 2's (where the
implementation counts supply but has no sensor demand), then an element
that does not exist. **Then** a snapshot with `available` derived from
the same `Supply` and `DemandType` the Place payload in DATA-01 carries,
a snapshot with `available: null` and no `demand`, and 404. At 17:52 the
garage crosses 90 percent and `apx.data.occupancy.v1` is published.

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-000000000001/occupancy -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "computedAt": "2026-09-24T17:45:00Z",
  "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
  "demand": { "count": 361, "percentage": 85.9, "occupancyCalculation": "counted", "recordDateTime": "2026-09-24T17:44:30Z" },
  "available": 59
}
```

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-000000000011/occupancy -->
<!-- apx:response 200 -->
```json
{
  "place": { "id": "b1000000-0000-4000-8000-000000000011", "className": "IdentifiedArea" },
  "computedAt": "2026-09-24T17:45:00Z",
  "supply": { "supplyViewType": "spaceView", "supplyQuantity": 140 },
  "available": null
}
```

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-0000000000ff/occupancy -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "No HierarchyElement b1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/places/b1000000-0000-4000-8000-0000000000ff/occupancy"
}
```

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  "type": "apx.data.occupancy.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "time": "2026-09-24T17:52:11Z",
  "data": {
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "computedAt": "2026-09-24T17:52:11Z",
    "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
    "demand": { "count": 379, "percentage": 90.2, "occupancyCalculation": "counted", "recordDateTime": "2026-09-24T17:52:00Z" },
    "available": 41
  }
}
```

The same delivery, checked against the data schema:

<!-- apx:validate OccupancySnapshot at /data -->
```json
{
  "id": "9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  "type": "apx.data.occupancy.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "time": "2026-09-24T17:52:11Z",
  "data": {
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "computedAt": "2026-09-24T17:52:11Z",
    "supply": { "supplyViewType": "spaceView", "supplyQuantity": 420 },
    "demand": { "count": 379, "percentage": 90.2, "occupancyCalculation": "counted", "recordDateTime": "2026-09-24T17:52:00Z" },
    "available": 41
  }
}
```

---

## DATA-30 — Wrong scope, wrong grant, no grant

<!-- apx:scenario DATA-30 kind=security ics=APX-CORE-07,APX-CORE-08,APX-CORE-05,APX-DATA-08 -->

**Given** three tokens. **When** the read-only `city-platform` posts a
session; `lakeside-parcs` (granted Lakeside only) reads Harbor Deck and
its occupancy; and a token with no `apx_places` claim lists places.
**Then** 403 `insufficient-scope`, 403 `insufficient-grant` twice, and
403 `insufficient-grant` (fail-closed: no claim, no places). Every native
route now declares the shared 403 through the data overlay.

```http
POST /sessions
Authorization: Bearer <city-platform: apx.data:read only>
```

<!-- apx:request POST /sessions -->
```json
{
  "id": "c4000000-0000-4000-8000-000000000103",
  "version": 1,
  "actualStart": "2026-09-24T23:00:00Z",
  "identifiedCredentials": [
    { "type": "ticket", "identifier": { "id": "T-1103", "className": "Credential" } }
  ],
  "segments": [
    {
      "id": "c5000000-0000-4000-8000-000000000103",
      "version": 1,
      "actualStart": "2026-09-24T23:00:00Z",
      "assignedRight": { "id": "e2000000-0000-4000-8000-000000000103", "version": 1, "className": "AssignedRight" },
      "validationType": ["ticket"]
    }
  ]
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /sessions requires scope apx.data:write; token carries apx.data:read.",
  "instance": "/sessions"
}
```

```http
GET /places/b1000000-0000-4000-8000-000000000002
Authorization: Bearer <lakeside-parcs: apx_places ["b1000000-0000-4000-8000-000000000001"]>
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/places/b1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-000000000002/occupancy -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is not in the token's apx_places grant.",
  "instance": "/v1/places/b1000000-0000-4000-8000-000000000002/occupancy"
}
```

```http
GET /places?page=1
Authorization: Bearer <no apx_places claim at all>
```

<!-- apx:request GET /places?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Target outside place grant",
  "status": 403,
  "detail": "Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).",
  "instance": "/places"
}
```

---

## DATA-31 — Push wakes the puller: SessionCreated, then the cursor

<!-- apx:scenario DATA-31 kind=happy ics=APX-DATA-03,APX-DATA-04,APX-CORE-01 -->

**Given** the city platform subscribed to the APDS `SessionCreated`
topic and holds cursor `c:00046`. **When** T-1104 enters and the
envelope arrives with the APDS `EventData` (here a `Session`) in `data`.
**Then** the platform treats the delivery as a wake-up and pulls
`mode=change`, which is the exactly-once path (§5.4); the page carries
the same session. `EventData` and `EventTypeEnum` are in the bundle (the
`apx-native-event` webhook references them), so `data` is validated as
`EventData`.

<!-- apx:validate EventEnvelope -->
<!-- apx:validate EventData at /data -->
```json
{
  "id": "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
  "type": "SessionCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c4000000-0000-4000-8000-000000000104", "className": "Session" },
  "time": "2026-09-24T23:05:30Z",
  "data": {
    "id": "c4000000-0000-4000-8000-000000000104",
    "version": 1,
    "actualStart": "2026-09-24T23:05:29Z",
    "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" },
    "identifiedCredentials": [
      { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1104", "className": "Credential" } }
    ],
    "segments": [
      {
        "id": "c5000000-0000-4000-8000-000000000104",
        "version": 1,
        "actualStart": "2026-09-24T23:05:29Z",
        "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "version": 1, "className": "AssignedRight" },
        "validationType": ["ticket"]
      }
    ]
  }
}
```

The same delivery, checked against the data schema:

<!-- apx:validate Session at /data -->
```json
{
  "id": "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a",
  "type": "SessionCreated",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c4000000-0000-4000-8000-000000000104", "className": "Session" },
  "time": "2026-09-24T23:05:30Z",
  "data": {
    "id": "c4000000-0000-4000-8000-000000000104",
    "version": 1,
    "actualStart": "2026-09-24T23:05:29Z",
    "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
    "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" },
    "identifiedCredentials": [
      { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1104", "className": "Credential" } }
    ],
    "segments": [
      {
        "id": "c5000000-0000-4000-8000-000000000104",
        "version": 1,
        "actualStart": "2026-09-24T23:05:29Z",
        "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "version": 1, "className": "AssignedRight" },
        "validationType": ["ticket"]
      }
    ]
  }
}
```

<!-- apx:request GET /sessions?mode=change&cursor=c%3A00046 -->
<!-- apx:response 200 -->
```json
{
  "publicationTime": "2026-09-24T23:05:35Z",
  "publisher": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "updateMode": "change",
  "items": [
    {
      "id": "c4000000-0000-4000-8000-000000000104",
      "version": 1,
      "className": "Session",
      "actualStart": "2026-09-24T23:05:29Z",
      "initiator": { "id": "a1000000-0000-4000-8000-000000000001", "version": 1, "className": "Organisation" },
      "hierarchyElement": { "id": "b1000000-0000-4000-8000-000000000001", "version": 8, "className": "Place" },
      "identifiedCredentials": [
        { "type": "ticket", "credentialAssignedType": "other", "identifier": { "id": "T-1104", "className": "Credential" } }
      ],
      "segments": [
        {
          "id": "c5000000-0000-4000-8000-000000000104",
          "version": 1,
          "actualStart": "2026-09-24T23:05:29Z",
          "assignedRight": { "id": "e2000000-0000-4000-8000-000000000104", "version": 1, "className": "AssignedRight" },
          "validationType": ["ticket"]
        }
      ]
    }
  ],
  "cursor": "c:00047",
  "next": null
}
```

---

## DATA-32 — Every native route answers a bad token, a thin token, and a flood

<!-- apx:scenario DATA-32 kind=security ics=APX-DATA-01,APX-CORE-07,APX-CORE-05 -->

**Given** the data overlay now declares the shared 401, 403, and 429 on
every native APDS operation (Part 5 §5.6, Part 12 §12.3). **When** a
warehouse loader runs with an expired token, then with a token that
carries only `apx.alerts:read`, then without back-off. **Then** every
route answers `unauthenticated`, `insufficient-scope`, and
`rate-limited` problems — the APX error dialect, since none of these has
an APDS `ResponseStatus` equivalent. Write bodies are the ones used
earlier in this file (compacted); a PUT carries the smallest change
payload, identity only.

Expired token (`Authorization: Bearer <expired>`):

<!-- apx:request GET /places?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/places"
}
```

<!-- apx:request POST /places -->
```json
{"id":"b1000000-0000-4000-8000-000000000021","version":1,"type":"identifiedArea","name":[{"language":"en","string":"Harbor Deck — Level 1"}],"layer":1,"parentId":{"id":"b1000000-0000-4000-8000-000000000002","version":1,"className":"Place"},"operatorDefinedReference":{"id":"7d2f1c0e-3b4a-4c5d-9e6f-0a1b2c3d4e5f","version":4,"className":"IdentifiedArea"},"hierarchyElementRecord":{"creationTime":"2026-09-24T22:00:00Z","creator":{"id":"a1000000-0000-4000-8000-000000000009","version":1,"className":"Organisation"}}}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/places"
}
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000001 -->
```json
{"id":"b1000000-0000-4000-8000-000000000001","version":8}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /observations?place=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/observations"
}
```

<!-- apx:request POST /observations -->
```json
{"type":"licensePlate","id":"f2000000-0000-4000-8000-000000000902","version":1,"method":"anpr","observedCredentialId":"SYN-1234","observationStartTime":"2026-09-24T18:14:01Z","creationDateTime":"2026-09-24T18:14:02Z","location":{"observerLocation":{"type":"Point","coordinates":[-87.6244,41.8812]}},"elementIds":{"id":"b2000000-0000-4000-8000-000000000002","version":3,"className":"VehicularAccess"},"observerOrganisation":{"id":"a1000000-0000-4000-8000-000000000001","version":1,"className":"Organisation"},"confidence":{"overallConfidence":0.97},"images":[{"id":"f3000000-0000-4000-8000-000000000902","imageType":"plate","imageLink":"https://api.lakeside-garage.example/lpr/f2000000-0902.jpg"}]}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/observations"
}
```

<!-- apx:request GET /contacts -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/contacts"
}
```

<!-- apx:request POST /contacts -->
```json
{"contactType":"contactPoint","id":"a1000000-0000-4000-8000-000000000003","version":1,"type":"customerService","organisationName":[{"language":"en","string":"Lakeside Customer Service"}],"shareWithPublic":true,"contactDetails":[{"available24hours":true,"contactPersonName":"Duty desk"}],"telephoneContacts":[{"ituCountryCode":"1","areaCode":"312","localNumbers":["5550142"]}]}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/contacts"
}
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PUT /contacts/a1000000-0000-4000-8000-000000000003 -->
```json
{"id":"a1000000-0000-4000-8000-000000000003","version":1}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /rights/specs?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/specs"
}
```

<!-- apx:request POST /rights/specs -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1,"type":"permitParking","description":[{"language":"en","string":"EV monthly — Level 2 chargers"}],"transferable":false,"credentials":["licensePlate","rfid"],"validity":{"validityStatus":"active","validityTimeSpecification":{"overallStartTime":"2026-10-01T00:00:00Z","overallEndTime":"2026-12-31T23:59:59Z"}},"hierarchyElements":[{"id":"b1000000-0000-4000-8000-000000000011","version":2,"className":"IdentifiedArea"}]}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/specs"
}
```

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000002 -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /rates?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rates"
}
```

<!-- apx:request POST /rates -->
```json
{"id":"d5000000-0000-4000-8000-000000000004","version":1,"rateTableName":[{"language":"en","string":"Concert flat — 26 Sep"}],"availability":"public","rateType":"event","validity":{"validityStatus":"planned","validityTimeSpecification":{"overallStartTime":"2026-09-26T16:00:00Z","overallEndTime":"2026-09-27T04:00:00Z"}},"rateLineCollections":[{"id":"d6000000-0000-4000-8000-000000000004","version":1,"collectionSequence":1,"applicableCurrency":"USD","resetTime":"04:00","validStart":"2026-09-26T16:00:00Z","validEnd":"2026-09-27T04:00:00Z","relativeTimes":false,"taxIncluded":true,"rateLines":[{"id":"d7000000-0000-4000-8000-000000000041","version":1,"sequence":1,"rateLineType":"flatRate","value":40,"usageCondition":"once"}]}]}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rates"
}
```

<!-- apx:request GET /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000001 -->
```json
{"id":"d5000000-0000-4000-8000-000000000001","version":3}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /sessions?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/sessions"
}
```

<!-- apx:request POST /sessions -->
```json
{"id":"c4000000-0000-4000-8000-000000000101","version":1,"actualStart":"2026-09-24T18:31:04Z","hierarchyElement":{"id":"b1000000-0000-4000-8000-000000000001","version":7,"className":"Place"},"identifiedCredentials":[{"type":"ticket","credentialAssignedType":"other","identifier":{"id":"T-1101","className":"Credential"}}],"segments":[{"id":"c5000000-0000-4000-8000-000000000101","version":1,"actualStart":"2026-09-24T18:31:04Z","assignedRight":{"id":"e2000000-0000-4000-8000-000000000101","version":1,"className":"AssignedRight"},"validationType":["ticket"]}],"identifiedVehicle":{"country":"US","stateProvince":"IL","color":"blue"}}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/sessions"
}
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{"id":"c4000000-0000-4000-8000-000000000101","version":3}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request GET /rights/assigned?page=1 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request POST /rights/assigned -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":1,"rightSpecification":{"id":"e1000000-0000-4000-8000-000000000001","version":4,"className":"RightSpecification"},"rightHolder":{"credentials":[{"type":"licensePlate","credentialAssignedType":"vehicle","identifier":{"id":"SYN-5510","className":"Credential"}}]},"issueMethod":"electronic","issuanceTime":"2026-09-24T22:30:00Z","expiry":"2026-10-31T23:59:59Z"}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":2}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /quotes?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/quotes"
}
```

<!-- apx:request POST /quotes -->
```json
{"id":"f4000000-0000-4000-8000-000000000001","version":1,"requestTime":"2026-09-24T22:40:00Z","periodStart":"2026-09-26T16:00:00Z","periodEnd":"2026-09-27T02:00:00Z","referencedRightSpecifications":[{"elementId":{"id":"b1000000-0000-4000-8000-000000000001","version":8,"className":"Place"},"rightSpecificationId":{"id":"e1000000-0000-4000-8000-000000000003","version":2,"className":"RightSpecification"}}]}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/quotes"
}
```

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-000000000001/occupancy -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-09-25T06:00:00Z.",
  "instance": "/v1/places/b1000000-0000-4000-8000-000000000001/occupancy"
}
```

A token with only `apx.alerts:read`:

<!-- apx:request POST /places -->
```json
{"id":"b1000000-0000-4000-8000-000000000021","version":1,"type":"identifiedArea","name":[{"language":"en","string":"Harbor Deck — Level 1"}],"layer":1,"parentId":{"id":"b1000000-0000-4000-8000-000000000002","version":1,"className":"Place"},"operatorDefinedReference":{"id":"7d2f1c0e-3b4a-4c5d-9e6f-0a1b2c3d4e5f","version":4,"className":"IdentifiedArea"},"hierarchyElementRecord":{"creationTime":"2026-09-24T22:00:00Z","creator":{"id":"a1000000-0000-4000-8000-000000000009","version":1,"className":"Organisation"}}}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /places requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/places"
}
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000001 -->
```json
{"id":"b1000000-0000-4000-8000-000000000001","version":8}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /places/b1000000-0000-4000-8000-000000000001 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /places/b1000000-0000-4000-8000-000000000001 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /observations?place=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /observations requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/observations"
}
```

<!-- apx:request POST /observations -->
```json
{"type":"licensePlate","id":"f2000000-0000-4000-8000-000000000902","version":1,"method":"anpr","observedCredentialId":"SYN-1234","observationStartTime":"2026-09-24T18:14:01Z","creationDateTime":"2026-09-24T18:14:02Z","location":{"observerLocation":{"type":"Point","coordinates":[-87.6244,41.8812]}},"elementIds":{"id":"b2000000-0000-4000-8000-000000000002","version":3,"className":"VehicularAccess"},"observerOrganisation":{"id":"a1000000-0000-4000-8000-000000000001","version":1,"className":"Organisation"},"confidence":{"overallConfidence":0.97},"images":[{"id":"f3000000-0000-4000-8000-000000000902","imageType":"plate","imageLink":"https://api.lakeside-garage.example/lpr/f2000000-0902.jpg"}]}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /observations requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/observations"
}
```

<!-- apx:request GET /contacts -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /contacts requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/contacts"
}
```

<!-- apx:request POST /contacts -->
```json
{"contactType":"contactPoint","id":"a1000000-0000-4000-8000-000000000003","version":1,"type":"customerService","organisationName":[{"language":"en","string":"Lakeside Customer Service"}],"shareWithPublic":true,"contactDetails":[{"available24hours":true,"contactPersonName":"Duty desk"}],"telephoneContacts":[{"ituCountryCode":"1","areaCode":"312","localNumbers":["5550142"]}]}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /contacts requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/contacts"
}
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /contacts/a1000000-0000-4000-8000-000000000003 requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PUT /contacts/a1000000-0000-4000-8000-000000000003 -->
```json
{"id":"a1000000-0000-4000-8000-000000000003","version":1}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /contacts/a1000000-0000-4000-8000-000000000003 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /contacts/a1000000-0000-4000-8000-000000000003 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /rights/specs?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rights/specs requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rights/specs"
}
```

<!-- apx:request POST /rights/specs -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1,"type":"permitParking","description":[{"language":"en","string":"EV monthly — Level 2 chargers"}],"transferable":false,"credentials":["licensePlate","rfid"],"validity":{"validityStatus":"active","validityTimeSpecification":{"overallStartTime":"2026-10-01T00:00:00Z","overallEndTime":"2026-12-31T23:59:59Z"}},"hierarchyElements":[{"id":"b1000000-0000-4000-8000-000000000011","version":2,"className":"IdentifiedArea"}]}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /rights/specs requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/specs"
}
```

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rights/specs/e1000000-0000-4000-8000-000000000002 requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000002 -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /rights/specs/e1000000-0000-4000-8000-000000000002 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /rights/specs/e1000000-0000-4000-8000-000000000002 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /rates?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rates requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rates"
}
```

<!-- apx:request POST /rates -->
```json
{"id":"d5000000-0000-4000-8000-000000000004","version":1,"rateTableName":[{"language":"en","string":"Concert flat — 26 Sep"}],"availability":"public","rateType":"event","validity":{"validityStatus":"planned","validityTimeSpecification":{"overallStartTime":"2026-09-26T16:00:00Z","overallEndTime":"2026-09-27T04:00:00Z"}},"rateLineCollections":[{"id":"d6000000-0000-4000-8000-000000000004","version":1,"collectionSequence":1,"applicableCurrency":"USD","resetTime":"04:00","validStart":"2026-09-26T16:00:00Z","validEnd":"2026-09-27T04:00:00Z","relativeTimes":false,"taxIncluded":true,"rateLines":[{"id":"d7000000-0000-4000-8000-000000000041","version":1,"sequence":1,"rateLineType":"flatRate","value":40,"usageCondition":"once"}]}]}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /rates requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rates"
}
```

<!-- apx:request GET /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rates/d5000000-0000-4000-8000-000000000001 requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000001 -->
```json
{"id":"d5000000-0000-4000-8000-000000000001","version":3}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /rates/d5000000-0000-4000-8000-000000000001 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /rates/d5000000-0000-4000-8000-000000000001 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /sessions?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /sessions requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/sessions"
}
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /sessions/c4000000-0000-4000-8000-000000000101 requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{"id":"c4000000-0000-4000-8000-000000000101","version":3}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /sessions/c4000000-0000-4000-8000-000000000101 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /sessions/c4000000-0000-4000-8000-000000000101 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request GET /rights/assigned?page=1 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rights/assigned requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request POST /rights/assigned -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":1,"rightSpecification":{"id":"e1000000-0000-4000-8000-000000000001","version":4,"className":"RightSpecification"},"rightHolder":{"credentials":[{"type":"licensePlate","credentialAssignedType":"vehicle","identifier":{"id":"SYN-5510","className":"Credential"}}]},"issueMethod":"electronic","issuanceTime":"2026-09-24T22:30:00Z","expiry":"2026-10-31T23:59:59Z"}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /rights/assigned requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /rights/assigned/e2000000-0000-4000-8000-000000000002 requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":2}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "DELETE /rights/assigned/e2000000-0000-4000-8000-000000000002 requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /quotes?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /quotes requires scope apx.data:read; token carries apx.alerts:read.",
  "instance": "/quotes"
}
```

<!-- apx:request POST /quotes -->
```json
{"id":"f4000000-0000-4000-8000-000000000001","version":1,"requestTime":"2026-09-24T22:40:00Z","periodStart":"2026-09-26T16:00:00Z","periodEnd":"2026-09-27T02:00:00Z","referencedRightSpecifications":[{"elementId":{"id":"b1000000-0000-4000-8000-000000000001","version":8,"className":"Place"},"rightSpecificationId":{"id":"e1000000-0000-4000-8000-000000000003","version":2,"className":"RightSpecification"}}]}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /quotes requires scope apx.data:write; token carries apx.alerts:read.",
  "instance": "/quotes"
}
```

The same loader with no back-off:

<!-- apx:request GET /places?page=1 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/places"
}
```

<!-- apx:request POST /places -->
```json
{"id":"b1000000-0000-4000-8000-000000000021","version":1,"type":"identifiedArea","name":[{"language":"en","string":"Harbor Deck — Level 1"}],"layer":1,"parentId":{"id":"b1000000-0000-4000-8000-000000000002","version":1,"className":"Place"},"operatorDefinedReference":{"id":"7d2f1c0e-3b4a-4c5d-9e6f-0a1b2c3d4e5f","version":4,"className":"IdentifiedArea"},"hierarchyElementRecord":{"creationTime":"2026-09-24T22:00:00Z","creator":{"id":"a1000000-0000-4000-8000-000000000009","version":1,"className":"Organisation"}}}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/places"
}
```

<!-- apx:request GET /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /places/b1000000-0000-4000-8000-000000000001 -->
```json
{"id":"b1000000-0000-4000-8000-000000000001","version":8}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /places/b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/places/b1000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /observations?place=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/observations"
}
```

<!-- apx:request POST /observations -->
```json
{"type":"licensePlate","id":"f2000000-0000-4000-8000-000000000902","version":1,"method":"anpr","observedCredentialId":"SYN-1234","observationStartTime":"2026-09-24T18:14:01Z","creationDateTime":"2026-09-24T18:14:02Z","location":{"observerLocation":{"type":"Point","coordinates":[-87.6244,41.8812]}},"elementIds":{"id":"b2000000-0000-4000-8000-000000000002","version":3,"className":"VehicularAccess"},"observerOrganisation":{"id":"a1000000-0000-4000-8000-000000000001","version":1,"className":"Organisation"},"confidence":{"overallConfidence":0.97},"images":[{"id":"f3000000-0000-4000-8000-000000000902","imageType":"plate","imageLink":"https://api.lakeside-garage.example/lpr/f2000000-0902.jpg"}]}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/observations"
}
```

<!-- apx:request GET /contacts -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/contacts"
}
```

<!-- apx:request POST /contacts -->
```json
{"contactType":"contactPoint","id":"a1000000-0000-4000-8000-000000000003","version":1,"type":"customerService","organisationName":[{"language":"en","string":"Lakeside Customer Service"}],"shareWithPublic":true,"contactDetails":[{"available24hours":true,"contactPersonName":"Duty desk"}],"telephoneContacts":[{"ituCountryCode":"1","areaCode":"312","localNumbers":["5550142"]}]}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/contacts"
}
```

<!-- apx:request GET /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request PUT /contacts/a1000000-0000-4000-8000-000000000003 -->
```json
{"id":"a1000000-0000-4000-8000-000000000003","version":1}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request DELETE /contacts/a1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/contacts/a1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /rights/specs?page=1 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/specs"
}
```

<!-- apx:request POST /rights/specs -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1,"type":"permitParking","description":[{"language":"en","string":"EV monthly — Level 2 chargers"}],"transferable":false,"credentials":["licensePlate","rfid"],"validity":{"validityStatus":"active","validityTimeSpecification":{"overallStartTime":"2026-10-01T00:00:00Z","overallEndTime":"2026-12-31T23:59:59Z"}},"hierarchyElements":[{"id":"b1000000-0000-4000-8000-000000000011","version":2,"className":"IdentifiedArea"}]}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/specs"
}
```

<!-- apx:request GET /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/specs/e1000000-0000-4000-8000-000000000002 -->
```json
{"id":"e1000000-0000-4000-8000-000000000002","version":1}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/specs/e1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/specs/e1000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /rates?page=1 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rates"
}
```

<!-- apx:request POST /rates -->
```json
{"id":"d5000000-0000-4000-8000-000000000004","version":1,"rateTableName":[{"language":"en","string":"Concert flat — 26 Sep"}],"availability":"public","rateType":"event","validity":{"validityStatus":"planned","validityTimeSpecification":{"overallStartTime":"2026-09-26T16:00:00Z","overallEndTime":"2026-09-27T04:00:00Z"}},"rateLineCollections":[{"id":"d6000000-0000-4000-8000-000000000004","version":1,"collectionSequence":1,"applicableCurrency":"USD","resetTime":"04:00","validStart":"2026-09-26T16:00:00Z","validEnd":"2026-09-27T04:00:00Z","relativeTimes":false,"taxIncluded":true,"rateLines":[{"id":"d7000000-0000-4000-8000-000000000041","version":1,"sequence":1,"rateLineType":"flatRate","value":40,"usageCondition":"once"}]}]}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rates"
}
```

<!-- apx:request GET /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request PUT /rates/d5000000-0000-4000-8000-000000000001 -->
```json
{"id":"d5000000-0000-4000-8000-000000000001","version":3}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request DELETE /rates/d5000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rates/d5000000-0000-4000-8000-000000000001"
}
```

<!-- apx:request GET /sessions?page=1 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/sessions"
}
```

<!-- apx:request POST /sessions -->
```json
{"id":"c4000000-0000-4000-8000-000000000101","version":1,"actualStart":"2026-09-24T18:31:04Z","hierarchyElement":{"id":"b1000000-0000-4000-8000-000000000001","version":7,"className":"Place"},"identifiedCredentials":[{"type":"ticket","credentialAssignedType":"other","identifier":{"id":"T-1101","className":"Credential"}}],"segments":[{"id":"c5000000-0000-4000-8000-000000000101","version":1,"actualStart":"2026-09-24T18:31:04Z","assignedRight":{"id":"e2000000-0000-4000-8000-000000000101","version":1,"className":"AssignedRight"},"validationType":["ticket"]}],"identifiedVehicle":{"country":"US","stateProvince":"IL","color":"blue"}}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/sessions"
}
```

<!-- apx:request GET /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request PUT /sessions/c4000000-0000-4000-8000-000000000101 -->
```json
{"id":"c4000000-0000-4000-8000-000000000101","version":3}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request DELETE /sessions/c4000000-0000-4000-8000-000000000101 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/sessions/c4000000-0000-4000-8000-000000000101"
}
```

<!-- apx:request GET /rights/assigned?page=1 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request POST /rights/assigned -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":1,"rightSpecification":{"id":"e1000000-0000-4000-8000-000000000001","version":4,"className":"RightSpecification"},"rightHolder":{"credentials":[{"type":"licensePlate","credentialAssignedType":"vehicle","identifier":{"id":"SYN-5510","className":"Credential"}}]},"issueMethod":"electronic","issuanceTime":"2026-09-24T22:30:00Z","expiry":"2026-10-31T23:59:59Z"}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request GET /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
```json
{"id":"e2000000-0000-4000-8000-000000000002","version":2}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request DELETE /rights/assigned/e2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/rights/assigned/e2000000-0000-4000-8000-000000000002"
}
```

<!-- apx:request GET /quotes?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/quotes"
}
```

<!-- apx:request POST /quotes -->
```json
{"id":"f4000000-0000-4000-8000-000000000001","version":1,"requestTime":"2026-09-24T22:40:00Z","periodStart":"2026-09-26T16:00:00Z","periodEnd":"2026-09-27T02:00:00Z","referencedRightSpecifications":[{"elementId":{"id":"b1000000-0000-4000-8000-000000000001","version":8,"className":"Place"},"rightSpecificationId":{"id":"e1000000-0000-4000-8000-000000000003","version":2,"className":"RightSpecification"}}]}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/quotes"
}
```

<!-- apx:request GET /v1/places/b1000000-0000-4000-8000-000000000001/occupancy -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Too many requests",
  "status": 429,
  "detail": "Native data routes are limited to 50 requests per second per credential; retry after 2 s.",
  "instance": "/v1/places/b1000000-0000-4000-8000-000000000001/occupancy"
}
```


---

## DATA-33 — Stale cursors on every feed, and the refusals APDS forgot to declare

<!-- apx:scenario DATA-33 kind=refusal ics=APX-DATA-05,APX-DATA-03,APX-DATA-01 -->

**Given** the BI platform's cursors for places, rates, assigned rights,
and observations all predate the 7-day window, and a PARCS that sends a
broken observation, a duplicate observation, a broken rate table, a
duplicate rate table, and an update to an assigned right that does not
exist. **Then** 404 `target-not-found` on each feed (Part 5 §5.2 rule 2),
and the APDS `ResponseStatus` 400/409/404 that the data overlay now
declares on `POST /observations`, `POST /rates`, and
`PUT /rights/assigned/{id}` (APX errata 005 and 012).

<!-- apx:request GET /places?mode=change&cursor=p%3A00007 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Cursor p:00007 is older than the 7-day retention window; re-sync with mode=full.",
  "instance": "/places"
}
```

<!-- apx:request GET /rates?mode=change&cursor=r%3A00002 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Cursor r:00002 is older than the 7-day retention window; re-sync with mode=full.",
  "instance": "/rates"
}
```

<!-- apx:request GET /rights/assigned?mode=change&cursor=a%3A00004 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Cursor a:00004 is older than the 7-day retention window; re-sync with mode=full.",
  "instance": "/rights/assigned"
}
```

<!-- apx:request GET /observations?mode=change&cursor=o%3A00011 -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Target not found",
  "status": 404,
  "detail": "Cursor o:00011 is older than the 7-day retention window; re-sync with mode=full.",
  "instance": "/observations"
}
```

<!-- apx:request POST /observations invalid -->
```json
{"id":"f2000000-0000-4000-8000-000000000903","version":1,"type":"licensePlate","observedCredentialId":"SYN-9999"}
```

<!-- apx:response 400 -->
```json
{"status":"error","code":400,"message":"Observation can not be created due to missing data: method, observationStartTime, creationDateTime, location, observerOrganisation."}
```

<!-- apx:request POST /observations -->
```json
{"type":"licensePlate","id":"f2000000-0000-4000-8000-000000000902","version":1,"method":"anpr","observedCredentialId":"SYN-1234","observationStartTime":"2026-09-24T18:14:01Z","creationDateTime":"2026-09-24T18:14:02Z","location":{"observerLocation":{"type":"Point","coordinates":[-87.6244,41.8812]}},"elementIds":{"id":"b2000000-0000-4000-8000-000000000002","version":3,"className":"VehicularAccess"},"observerOrganisation":{"id":"a1000000-0000-4000-8000-000000000001","version":1,"className":"Organisation"},"confidence":{"overallConfidence":0.97},"images":[{"id":"f3000000-0000-4000-8000-000000000902","imageType":"plate","imageLink":"https://api.lakeside-garage.example/lpr/f2000000-0902.jpg"}]}
```

<!-- apx:response 409 -->
```json
{"status":"error","code":409,"message":"Observation can not be created due to conflict: id already exists.","ids":["f2000000-0000-4000-8000-000000000902"]}
```

<!-- apx:request POST /rates invalid -->
```json
{"id":"d5000000-0000-4000-8000-000000000005","version":1,"availability":"public"}
```

<!-- apx:response 400 -->
```json
{"status":"error","code":400,"message":"RateTable can not be created due to missing data: rateTableName, rateLineCollections."}
```

<!-- apx:request POST /rates -->
```json
{"id":"d5000000-0000-4000-8000-000000000004","version":1,"rateTableName":[{"language":"en","string":"Concert flat — 26 Sep"}],"availability":"public","rateType":"event","validity":{"validityStatus":"planned","validityTimeSpecification":{"overallStartTime":"2026-09-26T16:00:00Z","overallEndTime":"2026-09-27T04:00:00Z"}},"rateLineCollections":[{"id":"d6000000-0000-4000-8000-000000000004","version":1,"collectionSequence":1,"applicableCurrency":"USD","resetTime":"04:00","validStart":"2026-09-26T16:00:00Z","validEnd":"2026-09-27T04:00:00Z","relativeTimes":false,"taxIncluded":true,"rateLines":[{"id":"d7000000-0000-4000-8000-000000000041","version":1,"sequence":1,"rateLineType":"flatRate","value":40,"usageCondition":"once"}]}]}
```

<!-- apx:response 409 -->
```json
{"status":"error","code":409,"message":"RateTable can not be created due to conflict: id already exists.","ids":["d5000000-0000-4000-8000-000000000004"]}
```

```http
PUT /rights/assigned/e2000000-0000-4000-8000-0000000000fe
APX-Update-Mode: change
```

<!-- apx:request PUT /rights/assigned/e2000000-0000-4000-8000-0000000000fe -->
```json
{"id":"e2000000-0000-4000-8000-0000000000fe","version":1}
```

<!-- apx:response 404 -->
```json
{"status":"error","code":404,"message":"AssignedRight can not be updated as it has not been found.","ids":["e2000000-0000-4000-8000-0000000000fe"]}
```
