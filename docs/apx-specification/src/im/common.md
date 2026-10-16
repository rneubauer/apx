## Purpose

The common module holds the conventions every other APX module reuses:
resource identity, provenance, the extensions container, the error body,
the event envelope, open code-list values, and the credential digest. It
plays the role for APX that the PkCommon domain plays for APDS. It is
defined in `spec/openapi/domains/common/schemas.yaml` and specified in
APX Part 4 (identity, provenance, extensions), Part 5 (the change payload
shape it shares with the data module), Part 10 (extensibility) and Part
12 (errors).

Nothing here re-models an APDS concept. Where APDS has a datatype (time,
money, reference, multilingual text), APX uses it by `$ref` and adds no
parallel type (APX Part 4 §4.4).

## Concepts

### Resource identity

`ApxResourceCore` is the identity of every APX-defined resource: an `id`
(a UUID, unique within the resource class) and a `version` (a positive
integer, incremented on every state-changing update), with optional
`recordInfo` and `extensions` (APX Part 4 §4.1). The shape is deliberately
the one APDS uses for `D2VersionedIdentifiable` objects. So an APX
resource can be the target of an APDS `Reference` or `VersionedReference`
with `className` set to the APX class name, for example `{"id": "…",
"className": "Command"}`. APX resources refer to APDS entities in the same
way and never embed them.

A client may supply the id on create, following the APDS convention; a
collision is 409 `id-collision` (APX Part 4 §4.1). Ids are local to the
implementation that issued them (APX Part 4 §4.1a). Writers send the
version they last read as a precondition, and a stale one is 409
`version-conflict` (APX Part 4 §4.2a).

### Provenance

`RecordInfo` is aligned with the APDS RecordType: `creationTime`,
`creator` (a Reference to an Organisation or Contact), `creationUser`,
`lastUpdate` and `lastUpdateUser` (APX Part 4 §4.2). It adds `origin`: the
implementation that first created the record, given as that
implementation's `EventEnvelope.source`, when a record reaches a receiver
through replication (APX Part 18 §18.6). `origin` is absent on records the
serving implementation created itself, and only a replicator holding
`apx.replication:write` may set it.

Where a resource has a lifecycle, its immutable `statusHistory[]`, not
`RecordInfo`, is the authoritative audit record (APX Part 4 §4.2).

### Extensions

`Extensions` is the official APDS extension container (APDS Use Case
§C.2.5). Its keys follow `apds-ext:<namespace>:<class>@<major>.<minor>`;
the version is the extension class's own contract version (APX Part 4
§4.3). Readers ignore unknown keys and writers preserve them (APX Part 3
§3.3(6)).

The `apx` namespace is reserved. Each APX decoration key is bound to its
schema, so a validator checks it wherever the container appears: device
status, rate policy, LPR read detail, lane cameras, reservation, permit
(1.0 and 1.1), session detail, match evidence, violation source, payment
detail and credential digest. Two further keys, `alert-evidence` and
`correlation`, are described in prose only and are not yet bound (APX
Part 4 §4.3). Any other key carries any object.

The container works in both directions. On an APX resource it carries
vendor additions. On an APDS entity it carries APX data as a Level B
decoration, which is the only way APX data appears inside an APDS
payload (APX Part 4 §4.3).

### Open code-list values

`CodeListValue` carries a `value` (the `definedValue` of a code-list
entry) and an optional `codeListId`, a VersionedReference to the APDS
`UserDefinedCodeList` that defines it. It follows the pattern of the APDS
`ReferencedCodeListEntry`. Implementers extend an APX vocabulary by
publishing their own list and pointing to it this way (APX Part 11
§11.1).

### Errors

`Problem` is an RFC 9457 problem details body: `type`, `title`, `status`,
and optional `detail` and `instance`, open to extra members. Every APX
error uses it, with a `type` URI from the APX problem-type registry under
`https://apx-standard.org/problems/` (APX Part 12 §12.1–12.2). A `type` is
a stable identifier; clients match the exact string and do not fetch it.
APDS-native routes keep their APDS `ResponseStatus` shape by default and
return the Problem when the client asks for it (APX Part 5 §5.1a).

### Event envelope

`EventEnvelope` is the single envelope of every asynchronous delivery,
by webhook or SSE (APX Part 8 §8.2). Its attributes follow CloudEvents
1.0: `id` (stable across retries), `type` (the topic), `source` (the
publishing implementation), `time`, optional `dataschema`, and `data`.
`subject` is an APDS Reference, so an event binds natively to the APDS or
APX entity it concerns. For APDS `EventTypeEnum` topics, `data` is the
APDS `EventData` shape. The events module describes delivery.

### Credential digest

`CredentialDigest` is the optional decoration
`apds-ext:apx:credential-digest@1.0` (APX Part 9 §9.6 rule 6). It is a
keyed HMAC-SHA-256 digest of a normalized credential identification,
typically a plate, so a consumer that only needs to know "same plate?"
can match without seeing the plate. The key is named by `keyId` and
served by `GET /v1/digest-keys`; rotation is by key id.

## Lifecycle

No lifecycle.

## Relationship to APDS

APDS classes and datatypes used as they stand: `Reference`,
`VersionedReference`, `DateTime`, `CredentialTypeEnum` (on the digest),
and the `UserDefinedCodeList` pattern from PkCommon. `ApxResourceCore`
mirrors `D2VersionedIdentifiable`, and `RecordInfo` mirrors RecordType.
APX relies on the APDS extension mechanism of Use Case §C.2.5.

The APDS 4.1 API document declares no `extensions` member on its entity
schemas. APX has offered this to APDS as a suggestion (erratum 010,
parkingdata/spec#43: declare `Extensions` once on `VersionedIdentity`).
Until then, the APX data overlay declares it on the eight native entity
schemas and on `Payment` (APX Part 1 §1.3 item 10).

Proposed to APDS (APX Data Specification, PkCommon):

| Element | Change | Tier |
| --- | --- | --- |
| `RecordType` | Addition to an APDS class: optional `origin` | 3 |

`origin` comes from `RecordInfo.origin` and is marked for discussion.

Also offered, as a suggestion rather than a data element: RFC 9457
`application/problem+json` as an error option on APDS-native routes
(`docs/apds-change-requests.md`, Part B).

APX-only: `ApxResourceCore`, `Extensions` (the APX binding of decoration
keys), `CodeListValue`, `Problem`, `EventEnvelope` and `CredentialDigest`.
They describe how the API identifies, extends, reports and delivers data,
not the parking data itself, and the APX Data Specification proposes
data, not interface. `CodeListValue` needs nothing new from APDS, because
`ReferencedCodeListEntry` already provides the pattern.
