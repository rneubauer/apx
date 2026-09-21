# APX Part 21 — Credentials (optional class `apx-credentials`)

The lifecycle of access credentials — keycards, fobs, RFID tags and
transponders, mobile credentials, hangtags, and plates used as the
credential: issue, activate, suspend, resume, report lost, revoke,
replace, and the access-event history behind "why was I denied at the
gate?".

**APDS alignment.** APDS 4.1 models a credential as a `CredentialAssigned`
on an `AssignedRight` (`type: CredentialTypeEnum`, `identifier:
Reference`, `issuer`) and lets clients filter `/rights/assigned` by
`credential_type`/`credential_id`. It has no status, no replacement, no
physical media, and no access events. APX adds those as a
**CredentialRecord** (APDS owns the name `Credential`) and keeps APDS
authoritative for *what the credential entitles*: the record is
materialized onto the AssignedRight (§21.2), so a plain APDS lane or
enforcement client always sees the current credential. `credentialType`
is APDS's own enum; where a technology has no APDS value (magstripe,
NFC), implementations map to the nearest (`ticket`, `electronicID`) and
carry the exact technology in `extensions` — a Part 3 §3.3(8)
reconciliation item for the APDS committee, not something APX extends
on its own.

## 21.1 CredentialRecord and lifecycle

See schema. One record per physical or virtual credential: `credentialType`
(read technology), `credentialIdentification` (what the lane reads),
`credentialAssignedType`, `holder`/`account`, `assignedRights[]`,
`places[]`, `validity`, `media` (form, serial, batch, deposit), status,
`replaces`/`replacedBy`, and the immutable `statusHistory[]`.

**Lifecycle (normative).**

```
issued ──activate──▶ active ◀──resume── suspended
                       │  ▲                 │
                       │  └───suspend───────┘
   active | suspended ──report-lost──▶ lost ──replace──▶ replaced (+ successor active)
   active | suspended | lost ──replace──▶ replaced (+ successor active)
   issued | active | suspended | lost ──revoke──▶ revoked
   validity.end passes ──▶ expired (server-side)
```

1. `revoked`, `expired`, and `replaced` are terminal. Any other
   transition request is 409 `credential-transition-illegal`; `replace`
   from a terminal state is 409 `credential-not-replaceable`.
2. `credentialIdentification` MUST be unique per `credentialType` across
   the implementation among non-terminal records (409
   `credential-identification-in-use`). A terminal record's
   identification MAY be reissued; the new record `replaces` nothing.
3. `suspend` MAY carry `until`; the server resumes automatically at that
   instant and records the transition with actor `system`.
4. `expired` is applied server-side when `validity.end` passes and
   publishes `apx.credentials.status.v1` like any other transition.
5. Every transition appends `statusHistory[]` and publishes
   `apx.credentials.status.v1`.

## 21.2 APDS materialization (normative)

1. While a record is `active`, the server MUST present it as a
   `CredentialAssigned` on each AssignedRight in `assignedRights[]`, with
   `type` = `credentialType` and `identifier` = a Reference to the
   CredentialRecord (`className: CredentialRecord`). A stock APDS client
   reading `/rights/assigned` — or filtering by
   `credential_type`/`credential_id` — therefore sees exactly the
   credentials that will open the gate.
2. On `suspend`, `report-lost`, `revoke`, and `expired`, the server MUST
   remove (or end) that `CredentialAssigned` so the AssignedRight no
   longer validates the credential; on `resume` it is restored. The lane
   MUST deny a credential that is not `active` from the instant of the
   transition — this is the security property the whole Part exists for.
3. `replace` is atomic from the AssignedRight's point of view: the
   successor's `CredentialAssigned` appears and the predecessor's
   disappears in one update (one `AssignedRightUpdated` event).
4. Part 13 `Account.cardNumber` and `Account.plates` remain the
   APDS-only summary; `Account.credentials[]` (additive) references the
   records when this class is claimed.

## 21.3 Replacement

`POST /v1/credentials/{id}/replace` issues the successor in one call:
inherits `holder`, `account`, `assignedRights`, `places`, and `validity`
unless the request overrides them; `credentialIdentification` is
server-assigned from pre-encoded stock when absent; `media` describes the
new item and `oldDepositStatus` settles the old deposit. The predecessor
becomes `replaced` with `replacedBy` set; the successor carries
`replaces`. **Idempotency-Key REQUIRED** — a retried "issue me a new card"
must not issue two.

## 21.4 Access events

Every presentation of a credential at a lane produces a
`CredentialAccessEvent` — `direction`, `outcome`, and when denied a
`denialReason` (seeded values: `credentialSuspended`, `credentialLost`,
`credentialRevoked`, `credentialReplaced`, `credentialExpired` — one per
non-active lifecycle state — plus `unknownCredential`, `passback`,
`accountBalance`, `outsidePlace`, `outsideValidity`).
`GET /v1/credentials/{id}/access-events` returns the history;
`apx.credentials.access.v1` publishes each event (APDS EventTypeEnum has
no access events — this fills the gap the same way
`apx.data.observation.created.v1` does for sensors). Passback state
itself stays in Part 17 (`GET /v1/credentials/{id}/passback` and the
`resetPassback`/`forceIn`/`forceOut` commands); an access denied for
passback carries `denialReason: passback` here and the corrective
action lives there.

## 21.5 Privacy

`credentialIdentification`, `media.serialNumber`, and access events are
personal data when joined to a holder; Part 9 §9.6 applies (scope
minimization — identification values only under `apx.credentials:*`,
retention published and purgeable). Implementations MUST NOT expose an
"is this identification in use" oracle: `POST /v1/credentials` returns
409 `credential-identification-in-use` only to `apx.credentials:manage`
callers within their place grant.

## 21.6 Eventing

- `apx.credentials.status.v1` — any lifecycle transition (data:
  `CredentialRecord`).
- `apx.credentials.access.v1` — a lane access attempt (data:
  `CredentialAccessEvent`).

Place binding (Part 8 §8.5): `places[]` for status events; the event's
`place` for access events.

## 21.7 Endpoints (summary)

| Operation | Scope |
|---|---|
| `POST /v1/credentials`, `POST …/{id}/activate`, `/suspend`, `/resume`, `/report-lost`, `/revoke`, `/replace` | `apx.credentials:manage` |
| `GET /v1/credentials`, `GET …/{id}`, `GET …/{id}/access-events` | `apx.credentials:read` |
| `GET …/{id}/passback` (Part 17) | `apx.control:read` (unchanged) |

Every list is paginated in the APDS `PaginatedList` shape and constrained
to the caller's place grant.
