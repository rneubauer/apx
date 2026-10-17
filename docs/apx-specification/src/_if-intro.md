## Introduction

The APDS 4.1 set gives its interface as an OpenAPI document,
`apds-api-4.1.yaml`, alongside the Overview, Information Model, Data
Dictionary and Use Case Document. APX does the same: the normative
interface is `spec/dist/apx-v1.yaml` (OpenAPI 3.1). This document is a
readable listing of that file, generated from it each time the documents
are built. Where the two differ, the OpenAPI document wins.

The data elements the operations carry are defined in 03 Data
Dictionary. The rules for using them are in the APX standard text, Parts
0 to 24 (`docs/standard/`).

### Two surfaces on one host

One host serves both surfaces:

- **APDS 4.1 native routes** at their published paths (`/places`,
  `/sessions`, `/webhooks` and so on). APX carries them unchanged, apart
  from the corrections listed in 06, Part A, and adds only optional
  parameters such as the change-feed `mode` and `cursor` (Part 5 §5.2).
- **APX routes** under the `/v1` prefix.

The "Origin" row in each operation says which surface it belongs to.

### Conventions that apply to every operation

| Topic | Rule | APX reference |
| --- | --- | --- |
| Authentication | OAuth 2.0 client credentials. APDS native routes use the APDS `oAuth` scheme and scopes (`po`, `sp`, `ep`, `ad`). APX routes use `apxOAuth` scopes. | Part 9 §9.1, §9.2 |
| Grants | A token carries place grants. A request outside its grant is refused with `insufficient-grant`. | Part 9 §9.3, §9.3a |
| Identity and versions | Every APX record has an `id` and a `version`. Writes use optimistic concurrency; replays with the same idempotency key return the first result. | Part 4 §4.1, §4.2a |
| Extensions | Implementer data goes in the `extensions` container under a namespaced key. | Part 4 §4.3, Part 10 |
| Errors | Errors are RFC 9457 problem details with an APX problem type. | Part 12 |
| Lists and change feeds | Lists are paginated. `mode=change` with a `cursor` returns only what changed. | Part 5 §5.2 |
| Events | Subscribers receive signed webhook deliveries in a common event envelope. | Part 8, Part 9 §9.4 |
| Commands | Device commands are requested, may need approval, and report a result. | Part 6 |

### How to read an operation

Each operation has a summary table (operation id, origin, scopes and
request body), a parameter table and a response table. Body types name
the class in 03 Data Dictionary. Responses that every operation shares,
such as 401, 403 and 429, are listed each time so that each operation
can be read on its own.
