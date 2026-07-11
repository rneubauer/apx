# APX Quickstart

## Try the sandbox (5 minutes)

```powershell
npm install
npm run sandbox        # boots the reference server on :4100 with test credentials
npm run demo           # in another shell: the full call-center flow, end to end
```

The demo walks: bootstrap → OAuth2 token → lane screen-pop → validation →
vend gate (with the full audit trail) → forced device fault → auto-raised
alert.

## Implement APX (the short version)

1. **You already speak APDS 4.1?** Keep everything. APX mounts your routes
   verbatim and adds additive parameters/headers plain APDS clients never see.
2. Pick your **conformance classes** (`apx-data` + `apx-events` are the
   base; control/alerts/discovery/accounts/LPR/reservations/permits/tolling
   are optional). Advertise them at `/.well-known/apx-configuration`.
3. Implement the classes per the written standard (`docs/standard/`), using
   the bundled OpenAPI (`spec/dist/apx-v1.yaml`) as the normative contract.
4. **Self-certify**:

```powershell
npm run conformance -w @apx/conformance -- --base-url https://your-server --client-id you --client-secret secret
```

Green = you may claim the classes you advertise.

## Consume APX (as a client)

1. `GET /.well-known/apx-configuration` → token endpoint + classes.
2. OAuth2 client-credentials → bearer token (scopes `apx.<domain>:<verb>`).
3. `GET /apx/v1/discovery` → exactly what YOUR credential can do.
4. Pull data via the native APDS routes; keep in sync with
   `mode=change&cursor=…`; subscribe at `/webhooks` for push.
