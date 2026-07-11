# APX Part 15 — Tolling (optional class `apx-tolling`)

The one **net-new surface** in APX: APDS has no toll entities. Everything is
still built to APDS conventions — toll points are `SupplementalEquipment`,
reads are native `Observation`s, money is `AmountInCurrency`, settlement
links a Payment reference.

## 15.1 TollTransaction

See schema. Lifecycle: `created → priced → paid`; a dispute moves any
non-voided transaction to `disputed`, resolution to `resolved` (with
`dispute.resolution`: upheld | refunded | adjusted). `voided` is terminal.
`statusHistory[]` is the immutable audit.

## 15.2 Endpoints (scope `apx.tolling:manage`)

- `POST /apx/v1/tolling/transactions` — create from Observation refs +
  credential + pricing. **Idempotency-Key REQUIRED** (gantry retry storms).
- `GET /apx/v1/tolling/transactions?plate=&status=` / `GET …/{id}`.
- `POST /apx/v1/tolling/transactions/{id}/payment` — attach the settling
  Payment reference → `paid`.
- `POST /apx/v1/tolling/transactions/{id}/disputes` — open a dispute
  (`reason`). Re-opening a resolved dispute is `409 dispute-closed`.
- `POST /apx/v1/tolling/transactions/{id}/disputes/resolve` — resolve with
  `resolution`.

## 15.3 Eventing

`apx.tolling.transaction.created.v1` on creation;
`apx.tolling.transaction.status.v1` on every transition (including dispute
open/resolve). Toll reads themselves flow as native Observation data.
