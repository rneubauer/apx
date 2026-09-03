# APX Part 18 — Aggregation and Onboarding

This Part specifies the lifecycle transition every multi-operator
deployment eventually faces: a
location served by its own standalone APX implementation joins an
**aggregating implementation** — one endpoint fronting many locations from
many operators. It defines what survives the move, what must be re-created,
and in what order. It applies to any implementation hosting places imported
from another implementation; no separate conformance class exists — these
are obligations of whichever classes the aggregator claims.

## 18.1 What an aggregator is

An aggregating implementation is an ordinary APX implementation. Nothing in
this standard distinguishes it on the wire except scale: the same bootstrap
(`/.well-known/apx-configuration`), the same grants, the same discovery
soundness rule. A client onboarding against an aggregator runs exactly the
single-site flow — that uniformity is the design.

## 18.2 Identity across the move (normative)

Per Part 4 §4.1a: HierarchyElement ids SHOULD be preserved on import; on
collision the aggregator MUST mint fresh UUIDs and MUST record each source
id in the element's APDS `operatorDefinedReference`. Consumers migrating
stored keys resolve old → new by querying `/places` and matching
`operatorDefinedReference`. APX resource ids (Commands, Alerts,
subscriptions, contexts) are NEVER migrated — they are historical records
of the source implementation.

## 18.3 The onboarding sequence (normative)

When a place moves from implementation A to aggregator B, the third-party
consumer re-runs onboarding at B. Nothing from A transfers implicitly:

1. **Bootstrap** — `GET /.well-known/apx-configuration` at B's host: token
   endpoint, conformance classes. B's classes MAY differ from A's;
   consumers MUST NOT assume feature parity.
2. **Credential** — a new client registration at B's IdP. B MUST issue the
   grant fail-closed (Part 9 §9.3): `apx_places` naming exactly the
   migrated subtree root(s) — never the wildcard — attributed to the same
   consumer `apx_org`.
3. **Discovery** — `GET /v1/discovery` at B proves the boundary before any
   traffic flows.
4. **Data resync** — cursors are server-local (Part 5 §5.2 rule 5) and DO
   NOT survive the move. The consumer runs `mode=full` per class at B,
   takes fresh cursors, and treats A's history as closed. B is NOT
   required to serve A's pre-import history; where it imports historical
   entities it MUST preserve their `recordInfo` provenance.
5. **Subscriptions** — subscriptions are server-local resources with
   server-held secrets; they MUST be re-created at B (`POST /webhooks`),
   yielding new ids and new signing secrets. A's subscriptions for the
   moved place SHOULD be deleted or filtered by A's operator.
6. **Event source** — `EventEnvelope.source` identifies the publishing
   implementation and therefore CHANGES at cutover. Consumers MUST key
   dedup/attribution on the event's place binding (Part 8 §8.5) plus
   envelope `id`, never on `source` alone.

## 18.4 Cutover (normative where stated)

- There is one moment when A stops being authoritative for the place and B
  starts. The operators of A and B MUST agree on it and SHOULD schedule it
  in a low-traffic window; APX does not coordinate it on the wire.
- After cutover, A MUST stop publishing events bound to the moved place;
  its change feeds emit tombstones for entities it no longer hosts, so
  consumers still cursored at A converge on "this place left".
- In-flight state (open sessions, unsettled payments) is migrated or
  drained by operator agreement — out of APX scope. Whatever B imports, it
  imports as valid APDS entities under §18.2 identity rules.

## 18.5 Isolation obligations recap (informative)

At platform scale the guarantees a consumer relies on are defined
elsewhere and only *matter* here: subtree grants and fail-closed defaults
(Part 9 §9.3), event place binding and filter semantics (Part 8 §8.5),
grant-constrained place-less lookups (Part 13 §13.5), per-filter gapless
feeds and grant-expansion signaling (Part 5 §5.2), and site-bound payments
and plate reads (Part 13). An aggregator conforming to those Parts gives
each tenant exactly the single-site experience — which is this Part's
acceptance test.
