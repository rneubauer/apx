# APX Part 15 — Tolling (optional class `apx-tolling`)

The one **net-new surface** in APX: APDS has no toll entities. Everything is
still built to APDS conventions — toll points are `SupplementalEquipment`,
reads are native `Observation`s, money is `AmountInCurrency`, settlement
links a Payment reference.

## 15.1 TollTransaction

See schema. Lifecycle: `created → priced → paid`; a dispute moves a
`priced` or `paid` transaction to `disputed`, resolution to `resolved`
(with `dispute.resolution`). `voided` is terminal. `statusHistory[]` is
the immutable audit.

`credential.credentialType` SHOULD be an APDS `CredentialTypeEnum` value
(`licensePlate`, `rfid`, …) and `credential.credentialIdentification`
carries the plate string or tag id as read.

**Transitions (normative).** Every refusal below is `409
toll-transition-illegal` unless stated, and changes nothing:

| Action | Allowed from | To |
|---|---|---|
| create with `pricing` / without | — | `priced` / `created` |
| `…/price` | `created` | `priced` |
| `…/payment` | `priced`; `resolved` (`upheld` or `adjusted`) with no payment attached | `paid` |
| `…/void` | `created`, `priced` | `voided` |
| `…/disputes` | `priced`, `paid` | `disputed` (from `resolved`: `409 dispute-closed`) |
| `…/disputes/resolve` | `disputed` | `resolved` (from `resolved`: `409 dispute-closed`) |

Attaching the PaymentRecord that is already attached to a `paid`
transaction returns 200 unchanged; a different one is refused. A paid
charge is never voided: it is corrected by a dispute resolved `refunded`
(the refund itself is Part 13 §13.1a), and a `refunded` transaction takes
no further payment.

**Disputes.** Disputes are opened by the operator (`apx.tolling:manage`),
on the holder's behalf or on its own initiative; `disputedBy` references
the party on whose behalf the dispute is raised (`RightHolder`,
`Organisation`, or `Contact`) and MAY be absent for an operator-initiated
dispute. APX v1 defines no customer-channel dispute scope. The base codes
are, for `reason`: `wrongVehicle`, `duplicateCharge`, `wrongClass`,
`notLiable`, `other`; for `resolution`: `upheld` (charge stands),
`refunded` (money returned), `adjusted` (new amount owed), `withdrawn`
(the disputing party abandoned it). The base codes are registered as
`apx-toll-dispute-reasons` and `apx-toll-dispute-resolutions`. Senders SHOULD use
them and MAY add implementer codes (Part 11). A resolution of `adjusted` MUST carry
`adjustedPricing`; the server replaces `pricing` with it and keeps the old
amount in `dispute.originalPricing`, so `pricing` changes after `priced`
only through this path.

## 15.2 Endpoints (scope `apx.tolling:manage`)

- `POST /v1/tolling/transactions` — create from Observation refs +
  credential + pricing. **Idempotency-Key REQUIRED** (gantry retry storms).
  A replay returns the transaction the key created in its current
  representation, so `version` and `transactionStatus` may have advanced
  (Part 4 §4.2a). A body failing the schema is `400 invalid-request`.
- `GET /v1/tolling/transactions?plate=&status=&tollPoint=&place=&credentialType=&credentialIdentification=&since=&until=`
  / `GET …/{id}`. Filters combine with AND; `place` is list-valued and
  subtree-inclusive; `since`/`until` bound `statusHistory[0].time`; a
  `status` outside the `transactionStatus` enum is `400 invalid-request`.
- `POST /v1/tolling/transactions/{id}/price` — price a `created`
  transaction (external pricing engines) → `priced`.
- `POST /v1/tolling/transactions/{id}/payment` — attach the settling
  Payment reference → `paid`. Takes an optional `Idempotency-Key`.
- `POST /v1/tolling/transactions/{id}/void` — void a charge that should
  never have been raised (`reason`) → `voided`.
- `POST /v1/tolling/transactions/{id}/disputes` — open a dispute
  (`reason`). Re-opening a resolved dispute is `409 dispute-closed`;
  disputing a `voided` or `created` transaction, or one already
  `disputed`, is `409 toll-transition-illegal`.
- `POST /v1/tolling/transactions/{id}/disputes/resolve` — resolve with
  `resolution` (and `adjustedPricing` for `adjusted`).

`…/price` and `…/void` also take an optional `Idempotency-Key`.

## 15.3 Eventing

`apx.tolling.transaction.created.v1` on creation;
`apx.tolling.transaction.status.v1` on every transition (including price,
void, and dispute open/resolve). Toll reads themselves flow as native Observation data.
