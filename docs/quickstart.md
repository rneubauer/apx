# APX Quickstart

## Explore the spec (5 minutes)

```powershell
npm install
npm test               # lint, bundle, and validate the full spec
```

Then import `spec/dist/apx-v1.yaml` into Postman, Swagger UI, or any
OpenAPI viewer. PARCS vendors can start from the slim profile subset,
`spec/dist/apx-parcs.json` (~25 endpoints).

## Implement APX (the short version)

1. **You already speak APDS 4.1?** Keep everything. APX mounts your routes
   verbatim and adds additive parameters/headers plain APDS clients never see.
2. Pick your **conformance classes** (`apx-data` + `apx-events` are the
   base; control/alerts/discovery/accounts/LPR/reservations/permits/tolling
   are optional). Advertise them at `/.well-known/apx-configuration`.
3. Implement the classes per the written standard (`docs/standard/`), using
   the bundled OpenAPI (`spec/dist/apx-v1.yaml`) as the normative contract.
4. **Self-certify**: verify your implementation against the conformance
   requirements in Part 3 of the written standard for every class you
   advertise. Only claim the classes you fully satisfy.

Coming from a conventional REST design and can't find the endpoint you
expected? See the [route map](route-map.md) — it maps intuitive routes
(`/places/{id}/sessions`, `POST /devices/{id}/command`, …) to the actual
APDS/APX paths, with curl examples.

## Consume APX (as a client)

1. `GET /.well-known/apx-configuration` → token endpoint + classes.
2. OAuth2 client-credentials → bearer token (scopes `apx.<domain>:<verb>`).
3. `GET /v1/discovery` → exactly what YOUR credential can do.
4. Pull data via the native APDS routes; keep in sync with
   `mode=change&cursor=…`; subscribe at `/webhooks` for push.
