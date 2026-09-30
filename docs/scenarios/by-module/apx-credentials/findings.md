# Findings — apx-credentials (Part 21)

Each entry is something a scenario in `scenarios.md` needed that the public spec (`apx` at v0.10.0) does not define, or defines ambiguously. Scenarios cite them in `gap=F-CRD-NN` markers where the runner can detect the gap; where it cannot (prose ambiguity that still validates), the scenario names the finding in its text.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-CRD-01 | credentials | medium | 422 on issue has no registered problem type | fixed — 422 on issue names `reference-unknown` (registered in 4417f2f) |
| F-CRD-02 | credentials | low | 400 invalid record/request on issue and replace has no registered problem type | fixed — 400 on issue/replace names `invalid-request` with `errors[]` |
| F-CRD-03 | credentials | low | No problem type for 401 (same as F-CTL-07) | fixed — `unauthenticated` registered (4417f2f); CRD-22 prose updated |
| F-CRD-04 | credentials | low | `replace` on `issued`: §21.1 and the operation disagree on the 409 slug | fixed — §21.1 rule 1 and the replace description: `issued` → `credential-transition-illegal`; not-replaceable is terminal-only |
| F-CRD-05 | credentials | medium | Implementation-wide uniqueness vs grant-scoped 409: oracle or duplicate | fixed — uniqueness stays implementation-wide; the 409 `detail` MUST NOT identify record, holder, place, or state (§21.1 rule 2, §21.5) |
| F-CRD-06 | credentials | medium | Auto-activation at `validity.start` used but undefined; POST description self-contradictory | fixed — optional `activateOnStart` on CredentialRecord + §21.1 rule 6; POST description rewritten; scenario 20 sets it |
| F-CRD-07 | credentials | medium | `unknownCredential` access event inexpressible (`credential` required, no presented value) | fixed — new superset schema `AccessEvent` (credential optional) + `PresentedCredential`; optional `presented` added to CredentialAccessEvent. `credential` NOT relaxed on CredentialAccessEvent: oasdiff flags response-property-became-optional as ERR |
| F-CRD-08 | credentials | medium | Access events listable only per credential; no lane/place listing, no `until`/`direction` | fixed — new `GET /v1/access-events` (place list, lane, device, credential, outcome, denialReason, direction, since, until); `until`/`direction` added to the per-credential route |
| F-CRD-09 | credentials | low | `place` filter is a single UUID, not a list | deferred (breaking) — changing `place` from one uuid to an array changes the parameter type; belongs with cross-cutting A9. The new `/v1/access-events` takes a list from the start |
| F-CRD-10 | credentials | low | Predecessor's retained fields after `replace` unspecified | fixed — §21.3: the predecessor retains every field; only status, replacedBy, depositStatus, statusHistory, version, recordInfo change; scenario 20 corrected |
| F-CRD-11 | credentials | low | Past `validity.end` on issue / past `until` on suspend: no defined outcome | fixed — 422 `request-unprocessable` for a past/inverted `validity.end` on issue and a past `until` on suspend (§21.1 rule 7); new 422 on suspend. Not added to replace: it has no validity override, so the case is unreachable |

---

## F-CRD-01 — The 422 on issue has no problem type
**Where it showed up.** CRD-03. `POST /v1/credentials` declares 422 "Unknown holder, account, assigned right, or place"; Part 12 registers `target-not-found` at 404 only and nothing at 422, so no conforming body exists for a declared response.
**Proposed fix.** Register `reference-unknown` (422): "a Reference in the request body names an entity that does not exist or is not visible to the caller", and name it in the 422 description.

## F-CRD-02 — Body-shape errors have no problem type
**Where it showed up.** CRD-03 (missing `credentialType`), CRD-19 (extensions key not matching §4.3). 400 is declared on issue and replace; Part 12 registers only `idempotency-key-required` at 400.
**Proposed fix.** Register a generic `invalid-request` (400) for schema/shape violations, with the offending pointer in `detail` or an `errors[]` extension member.

## F-CRD-03 — No problem type for 401
**Where it showed up.** CRD-22, all ten operations (shared `Unauthorized`, Problem schema, registered `type` required).
**Proposed fix.** Register `unauthenticated` (401): "missing, malformed, expired, or revoked access token". Fixes every module.

## F-CRD-04 — Which 409 does `replace` on `issued` get?
**Where it showed up.** CRD-10. §21.1 rule 1 implies `credential-transition-illegal` for a non-terminal disallowed state; the replace operation says only "allowed from active, suspended, lost; terminal → `credential-not-replaceable`". Both slugs are 409, so the runner cannot see the split.
**Proposed fix.** State in §21.1 and the operation: "`replace` from `issued` is 409 `credential-transition-illegal`; `credential-not-replaceable` is reserved for terminal states" — or allow replace from `issued` and say so.

## F-CRD-05 — Cross-grant identification collisions: oracle or duplicate?
**Where it showed up.** CRD-18. §21.1 rule 2: unique per type "across the implementation"; §21.5: the 409 only "to manage callers within their place grant". Refusing a Lakeside issue that collides with a Harbor Deck card reveals the number exists elsewhere; accepting breaks rule 2.
**Proposed fix.** Scope uniqueness per operator (`apx_org`); or, if implementation-wide, require that the 409 `detail` MUST NOT identify the holding record, holder, or place.

## F-CRD-06 — Automatic activation at `validity.start` is used but not defined
**Where it showed up.** CRD-01, CRD-09. Public scenario 20 shows `active` by actor `system` ("validity.start reached"); the POST description ("`active` when validity.start is past and the request says so via the activate transition afterwards") contradicts itself; §21.1 defines only expiry and timed resume.
**Proposed fix.** Add §21.1 rule 6 (issued → active at `validity.start`, actor `system`, status event published) with an optional `activateOnStart` flag on POST; or remove it from scenario 20 and fix the description.

## F-CRD-07 — An unknown card at the gate has no expressible event
**Where it showed up.** CRD-21. `unknownCredential` is a seeded denial reason, but `credential` is required and there is no record to reference; nothing carries the presented type/identification.
**Proposed fix.** Make `credential` optional ("REQUIRED unless denialReason is unknownCredential") and add optional `presented: { credentialType, credentialIdentification }` under §21.5 minimization.

## F-CRD-08 — Access events cannot be listed by lane or place
**Where it showed up.** CRD-11, CRD-21 (`gap=F-CRD-08`). Only `GET /v1/credentials/{id}/access-events` exists; "every denial at lane 1 tonight" and the unknown-card case have no route. The per-credential list lacks `until` and `direction`.
**Proposed fix.** Additive `GET /v1/access-events` filtered by `place` (subtree), `lane`, `device`, `credential`, `outcome`, `denialReason`, `direction`, `since`, `until`; APDS `{meta,data}`; scope `apx.credentials:read`; grant-scoped. Add `until`/`direction` to the per-credential route.

## F-CRD-09 — `place` filter is a single UUID
**Where it showed up.** CRD-16. `GET /v1/credentials` declares `place` as one uuid; APDS `place_ids` is a comma-separated list.
**Proposed fix.** Declare it as a `style: form, explode: false` array of UUIDs; a single value stays valid.

## F-CRD-10 — What the predecessor keeps after `replace`
**Where it showed up.** CRD-09, CRD-14. Scenario 20 drops holder/account/rights/places/validity from the replaced record; these scenarios keep all but `assignedRights`. Both validate; audits differ by server.
**Proposed fix.** §21.3: the predecessor retains all fields; only `credentialStatus`, `replacedBy`, `media.depositStatus`, `statusHistory` change (or the opposite, stated).

## F-CRD-11 — Validity already over, and `until` already past
**Where it showed up.** CRD-13 (by omission). Issue with past `validity.end`, or suspend with past `until`: refuse (nothing declared) or transition twice in one call?
**Proposed fix.** Refuse synchronously with 422 `validity-invalid` ("validity.end or suspension.until is not in the future"), declared on POST, `/replace`, `/suspend`.

## Runner issues
- `gap=` on `apx:validate` markers was not honoured when this module was written; the runner now supports it, and the CRD-21 `unknownCredential` event carries `gap=F-CRD-07`.
- Stacked validates over one block work. No false passes or crashes.
