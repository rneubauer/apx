# APX Route Map — "where's the endpoint I expected?"

APX mounts the APDS 4.1 routes **verbatim** and adds its own surface under
`/v1`. If you arrive expecting a conventional place-nested REST API, every
route you'd reach for exists — it just lives at the APDS-compatible path.
This page maps the intuitive route to the actual one.

Why the flat shape? The prime directive (Part 0 §0.2): a stock APDS 4.1
client must work against an APX server unmodified. APDS defines the flat
routes, so APX keeps them and filters by place with query parameters.

## Getting in

| You'd expect | Actually | Notes |
|---|---|---|
| `POST /auth` → JWT | OAuth2 client-credentials at your IdP's token endpoint | Find it at `GET /.well-known/apx-configuration` (unauthenticated). Then `Authorization: Bearer <token>` everywhere. |
| API key docs | `GET /v1/discovery` | Returns exactly what *your* credential can call — endpoints, command types, topics, places. |

```bash
curl https://api.example.com/.well-known/apx-configuration
curl -X POST https://auth.example.com/oauth2/token \
  -d grant_type=client_credentials -d client_id=… -d client_secret=… \
  -d scope="apx.data:read apx.control:execute"
```

## Reading data (APDS-native routes, place filter as query param)

| You'd expect | Actually |
|---|---|
| `GET /places` | `GET /places` ✓ (APDS verbatim) |
| `GET /places/{id}` | `GET /places/{id}` ✓ |
| `GET /places/{id}/sessions` | `GET /sessions?place={id}` |
| `GET /places/{id}/rates` | `GET /rates?place={id}` |
| `GET /places/{id}/reservations` | `GET /rights/assigned?place={id}` (a reservation is an APDS AssignedRight carrying the `apds-ext:apx:reservation@1.0` extension; see Part 14) |
| `GET /places/{id}/rights` | `GET /rights/assigned?place={id}` (tickets, monthlies); `GET /rights/specs` for the product definitions |
| `GET /places/{id}/observations` | `GET /observations?place={id}`; LPR cross-lookup at `GET /v1/lpr/reads?plate=…` |
| `GET /places/{id}/transactions` | `GET /v1/payments?ticketLast4=…` (payment history); payment records also ride on APDS Sessions |
| `GET /places/{id}/occupancy` | `GET /v1/places/{id}/occupancy` ✓ (APX convenience read — supply, latest demand, derived `available`; Part 5 §5.5) |

```bash
curl -H "Authorization: Bearer $T" "https://api.example.com/sessions?place=$PLACE"
curl -H "Authorization: Bearer $T" "https://api.example.com/v1/places/$PLACE/occupancy"
```

The `place` filter is APDS's native parameter and accepts a comma-separated
list of HierarchyElement UUIDs. Every list is paginated in the APDS
`{meta, data}` envelope (`meta.totalCount` included). For incremental sync,
add `?mode=change&cursor=…` (Part 5 §5.2).

## Devices and control

| You'd expect | Actually |
|---|---|
| `GET /places/{id}/devices` | `GET /v1/devices` (grant-scoped; live state per device) |
| `GET /devices/{id}` | `GET /v1/devices/{id}` ✓ |
| `PATCH /devices/{id}` enable/disable | `POST /v1/commands` with `commandType: setDeviceState` — a command, not a PATCH, because actuating hardware is async and must be audited |
| `POST /devices/{id}/command {type: vend}` | `POST /v1/commands` with `commandType: vendGate`, `target: {id, className}` |
| `{type: openGate}` / `{type: closeGate}` | `commandType: holdGateOpen` / `closeLane` |
| `{type: setRate}` | `commandType: pushRate` (`parameters.rateTable` = VersionedReference) |
| `{type: validate}` | `commandType: applyValidation` (`parameters.ticket` + `parameters.provider`) |
| `{type: restartDevice}` | `commandType: restartDevice` ✓ |

```bash
curl -X POST https://api.example.com/v1/commands \
  -H "Authorization: Bearer $T" -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"commandType":"vendGate","target":{"id":"'$LANE'","className":"VehicularAccess"}}'
```

Three non-negotiables on every command (Part 6): `Idempotency-Key` header
(a retry must not vend the gate twice), `expiryTime` honored (a stale vend
must not fire late), and the immutable `statusHistory[]` audit trail. The
response is `202` — poll `GET /v1/commands/{id}` or subscribe to
`apx.control.command.status.v1`.

## Everything else you'd go looking for

| You'd expect | Actually |
|---|---|
| Pagination `offset`/`pageSize` + total | APDS `PaginatedList` (`{meta, data}`) on every list |
| Errors `{type, message}` | RFC 9457 `application/problem+json` — `type` (registered URI) + `detail` (Part 12) |
| `/api/v4.1/...` versioning | APX surface is `/v1/…`; APDS routes are unversioned-verbatim. The APDS version served is advertised in `/.well-known/apx-configuration`, never in the path. |
| Webhooks / events | `POST /webhooks` (APDS-compatible superset: signed deliveries, retries, ledger, SSE — Part 8) |
| Alerts | `GET/POST /v1/alerts` (Part 7) |
