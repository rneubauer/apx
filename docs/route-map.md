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
| `POST /lpr/reads {make, model, color, direction, …}` | Native `POST /observations` with the `apds-ext:apx:lpr-read@1.0` block in `extensions` — per-attribute confidences, alternate reads, `platesRead`, `plateFace`, `movement`; the server derives `laneTravel` (Part 13 §13.3a) |
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
| `GET /vehicles/{plate}/entitlement` | `GET /v1/enforcement/eligibility?credential={plate}&place={id}` — composed from APDS `/rights/assigned` + `/sessions`, which remain authoritative (Part 19 §19.3) |
| `POST /citations` / `/tickets` / `/notices` | `POST /v1/violations` — one resource for all of them; `notice.noticeKind` says which was issued (Part 19) |
| `PATCH /citations/{id} {status: paid}` | `POST /v1/violations/{id}/payment` with the Payment reference — money is taken via `/v1/payments`, never on the violation |
| `POST /citations/{id}/dispute` | `POST /v1/violations/{id}/appeals` · `…/appeals/resolve` |
| `GET /locations/{id}/enforcement-rules` | `GET /v1/enforcement/policies/effective?place={id}` — the jurisdiction's notice, cap, and escalation rules the server itself enforces (Part 19 §19.10) |
| `GET /locations/{id}/signs` | `GET /v1/enforcement/signage/effective?place={id}&at=` — posted text, photo, position, in force at that instant (Part 19 §19.11) |
| `citation.latitude` / `.longitude` | `Violation.location.observedLocation` (GeoJSON Point, **longitude first**) plus `observerLocation` for the officer (Part 19 §19.9) |
| `POST /merchants` / `/validation-partners` | `POST /v1/validations/programs` — a merchant's enrolment at a place, with benefit, rules, and billing (Part 20) |
| `POST /coupons/generate` | `POST /v1/validations/programs/{id}/issuances` — codes returned exactly once |
| `GET /coupons/{code}` | `GET /v1/validations/instruments/{code}` |
| `POST /tickets/{id}/validate` | `POST /v1/validations/redemptions` from devices and merchant apps; `POST /v1/commands` with `applyValidation` from an agent console — same ledger |
| `GET /merchants/{id}/invoice` | `GET /v1/validations/programs/{id}/statement` (preview) · `POST …/statements` (close, immutable) |
| `POST /cards` / `/tags` / `/fobs` | `POST /v1/credentials` — one resource for every read technology; `credentialType` is APDS's enum, `media.form` is the physical form (Part 21) |
| `PATCH /cards/{id} {status: disabled}` | `POST /v1/credentials/{id}/suspend` · `/resume` · `/report-lost` · `/revoke` — each also rewrites the APDS `AssignedRight` so the lane agrees |
| `POST /cards/{id}/reissue` | `POST /v1/credentials/{id}/replace` — successor issued and active, predecessor dead, one call |
| `GET /cards/{id}/log` | `GET /v1/credentials/{id}/access-events` — granted/denied with reason; passback state is `GET …/{id}/passback` (Part 17) |
| `POST /valet/checkin` | `POST /v1/valet/tickets` — custody with the drop-off condition report (notes, damage entries, photos, acknowledgement); the stay itself is the APDS Session (Part 22) |
| `POST /valet/{ticket}/request-car` | `POST /v1/valet/tickets/{id}/retrieve` — channel (sms, app, web, voiceBot, kiosk, attendant, callCenter), returns ETA and promised time; customers use `apx.valet:request` |
| `GET /valet/board` | `GET /v1/valet/queue?place=` — requested, retrieving, staged, in promised-time order |
| `POST /valet/{ticket}/checkout` | `POST …/{id}/stage` then `POST …/{id}/handback` — verified claimant, handback condition report, mileage |
