# Design note: Nexus Core needs for APX 0.16

- **Status:** Decided 2026-10-22 (see "Decisions" at the end). Not in the spec yet; lands in one 0.16 PR.
- **Date:** 2026-10-22
- **Checked against:** `rneubauer/apx` main, edition **0.15.0** (Parts 0–26, Annex A).
- **Source:** the Nexus Core project, after the 211 Commerce sign go-live (2026-10-21). Nexus references: ADR 0018
  (lane-travel basis), ADR 0023 (compliance status), ADR 0043 (proof of display), `Docs/Enforcement/Compliance-Rules-v1.md`.

## Summary

| # | Need | Already in APX? | Proposal | Decision needed |
|---|---|---|---|---|
| N1 | Separate entry grace and exit grace | No stay grace at all (only `EligibilityResult.graceUntil`, Part 19 §19.3, with no source) | Two fields on `EnforcementPolicy` | D1, D2 |
| N2 | "This message was shown for this read or stay" | Only for commanded messages (`CommandResult.display`, Part 6 §6.1a) | `DisplayRecord` written by the system that drove the sign | D3, D4 |
| N3 | Lane or device from any system's own id | **Yes**: Part 26 §26.6 `external-ids` + `POST /v1/identifiers:resolve` | None | — |
| N4 | Stay compliance status on the Session | No | `stay-compliance` decoration written by the compliance engine | D5, D6 |
| N5 | `laneTravelBasis` | — | **Withdrawn** by Nexus Core | — |

N3: a Vaxtor `readerId`, another vendor's channel id, or any other key is an `{system, id}` pair on the lane
(VehicularAccess) or the device (SupplementalEquipment). `system` is a URI the issuer owns, and APX names no product.
A reader with no camera is SupplementalEquipment with role `cardReader`, `tagReader` or `barcodeReader` and a `lane`.
Confirmed back to Nexus Core on 2026-10-21; no `readerId` field.

N5: Nexus ADR 0018 keeps the lane-travel basis inside Nexus, as provenance for how it decided `accessEvent`.
`accessEvent`, lane-camera facing and `captureGroup` cover the wire (the 2026-09-28 ruling: APX records what happened
and holds no derivation logic).

The same principle shapes N1, N2 and N4: APX carries the **configured policy** and the **recorded outcome**. It never
holds the rule that turns one into the other.

## N1 Entry and exit grace

**Need.** At 211 Commerce the ruling is 15 minutes of grace on entry and 15 minutes on exit, kept apart. A stay's
compliance has to be explainable the same way on both sides: "you entered at 9:02, paid at 9:14, inside the 15-minute
entry grace". One `grace` number cannot say that.

**Today.** APDS 4.1 has no grace concept (no match in the vendored spec). APX has `EligibilityResult.graceUntil`
(Part 19 §19.3, "when operator policy grants a grace period") but no place to configure that policy. Charging has its
own `idlePolicy.graceMinutes` (Part 23), and reservations a no-show grace (Part 14 §14.1), both unrelated.

**Proposal.** Add to `EnforcementPolicy` (Part 19 §19.10), which already binds to a HierarchyElement with subtree
inheritance and versioned `PUT`:

```yaml
stayGrace:
  entryMinutes: 15   # time after entry before a right must cover the stay
  exitMinutes: 15    # time after the paid or permitted end before the stay is over
```

- Both optional and independent; absent means no grace on that side; `0` means explicitly none.
- `EligibilityResult.graceUntil` is then defined as derived from `stayGrace` at `checkedTime`.
- APX states the minutes. How they combine with rights (LATE_START versus OVERSTAY) stays engine logic.

**Alternative.** Put it in Part 26 `PlaceOperations`. That is simpler, but it splits enforcement policy across two
objects and loses the versioned history an appeal needs ("what grace applied that day").

## N2 Display record (proof a sign showed a message)

**Need.** The exit screen shows a car "Payment not found". Nexus needs a record of that (which sign, which message, when,
for which read or stay) for two reasons:
1. To measure whether the signs raise compliance (before and after), which drives sales.
2. As the proof of display for a refused-service message (ADR 0043; APX Part 24 §24.4).

**Today.** Part 6 §6.1a already records exactly this shape, but only as `CommandResult.display` on a `displayMessage`
command. At 211 Commerce no command exists. NexPark Edge decides locally from its rights cache and triggers the sign
over the LAN, so the message is unsolicited from APX's point of view. Part 19 §19.11 Signage is the *posted*, static
sign text, not a per-vehicle dynamic message.

**Proposal.** A new `DisplayRecord`, written by whichever system drove the display:

| Member | Type | Note |
|---|---|---|
| `id`, `version` | | server-assigned |
| `display` | Reference (SupplementalEquipment) | the sign, a Part 26 device with role `laneDisplay` / `countSign` |
| `shownTime`, `contentHash`, `wordingVersion`, `screenshot`, `acknowledgedBy` | | the §6.1a `display` shape, reused as is |
| `messageKind` | definedValue of new registry `apx-display-message-kinds`, or an implementer code | seeded from the NexPark Edge scenario registry (below) |
| `observation` | Reference (Observation), optional | the read that triggered it |
| `session` | Reference (Session), optional | the stay it was for |
| `command` | Reference (Command), optional | when an APX command drove it; then it MUST agree with `CommandResult.display` |
| `place` | Reference | derived from the device |

- Seed for `apx-display-message-kinds`: the nine built-in NexPark Edge sign scenarios, ids kept as they are:

  | Sign | Kinds |
  |---|---|
  | Entrance | `transientEntrance`, `monthlyEntrance`, `entranceRefused` (the refused-service message, Part 24 §24.4) |
  | Exit | `transientExitPaid`, `transientExitUnpaid`, `monthlyExit`, `monthlyExitBalanceDue` |
  | Either | `idle`, `fallback` |

  A location's custom scenarios are implementer codes. Reservation kinds come later, added to the registry (add-only).
  Separate overstay and late-start exit messages are held for Rick's ruling. Until then the edge knows only
  paid/unpaid/balanceDue/unknown, and both cases show as `transientExitUnpaid`.
- Routes: `POST /v1/display-records` and `GET /v1/display-records` with filters `place`, `display`, `messageKind`,
  `session` and `since`/`until`, plus the Part 5 change feed. Topic: `apx.display.shown.v1`.
- No message text is stored, only its hash and wording version. The plate is never stored even when the sign shows it
  (Part 9 §9.6); `screenshot` is an access-controlled link.
- APX records that the message was shown. Whether showing it changed behaviour is analysis, outside APX.

**Placement.** Part 26 (the sign is site equipment, and the record is about the device) is recommended. Part 19 is the
alternative: it sits next to Signage, but there it would read as enforcement-only, and the sign also shows welcome and
idle messages.

## N4 Stay compliance status

**Need.** Nexus scores every stay and wants the result on the Session, so another system (reporting, the city, a
call-centre console) sees the same answer without re-running Nexus rules.

**Nexus model (ADR 0023).** Each evaluation produces exactly **one** status, plus:
- `phase`: open or closed.
- `pendingStatus`: the would-be status, set only when status is REVIEW_REQUIRED.
- `flags[]`: facts such as `paidAfterExit`, `matchedFuzzy`, `endInferred`, `onList`.

A stay is re-evaluated over time (a sequence number) and is final 72 hours after exit. The statuses fall into four
families:

| Family | Statuses |
|---|---|
| Compliant | GRACE, PAID, PERMIT, RESERVATION, FROM_LIST, VALET |
| Violation family | LATE_START, UNPAID, OVERSTAY, EARLY_ARRIVAL, RESERVATION_OVERSTAY, POLICY_OVERSTAY |
| Other outcome | PAID_LATE (paid, but not compliant) |
| Not scored | UNSCORED, REVIEW_REQUIRED, STALE |

**Proposal.** A Level B decoration `apds-ext:apx:stay-compliance@1.0` on the APDS Session, written through the native
Session routes by the compliance engine. It is the same pattern as `session-detail` (Part 5 §5.8), and a server that
scores stays itself SHOULD write the same block.

```yaml
status: overstay            # definedValue of new registry apx-stay-compliance-statuses
family: violation           # compliant | violation | other | unscored
pendingStatus: null         # only with reviewRequired
flags: [paidAfterExit]      # definedValues of apx-stay-compliance-flags, or implementer codes
evaluatedTime: 2026-10-21T14:05:00Z
sequence: 3
final: false
policy: {id: ..., version: 4}   # the EnforcementPolicy (with N1 stayGrace) the evaluation used
```

- The registry ships the Nexus values in camelCase. It is add-only (Part 11), so other engines add their own.
- **A compliance status is not a Violation.** A `violation`-family status never issues anything; issuance stays
  Part 19, with its own evidence rules. A Violation MAY reference the Session, whose status explains it.
- `final` is the writer's statement, never a lock (as with `lifecycle: final` in §5.8).
- The status is personal data only through the Session; it carries no plate.

## Decisions for Rick

- **D1.** N1: two fields on `EnforcementPolicy` (recommended), or on Part 26 `PlaceOperations`?
- **D2.** N1: should `EligibilityResult.graceUntil` be redefined as derived from `stayGrace`? (Recommended: yes.)
- **D3.** N2: `DisplayRecord` in Part 26 (recommended) or Part 19?
- **D4.** N2: seed the registry with the nine NexPark Edge scenario ids (recommended), or keep implementer codes only,
  until a second deployment shows which kinds are shared? And should overstay and late-start get their own exit
  messages (new kinds such as `transientExitOverstay` and `transientExitLateStart`)? The edge would then need those
  standings from the N4 compliance status.
- **D5.** N4: adopt the full Nexus status list as the registry seed, or only the compliant and violation families, with
  REVIEW_REQUIRED/STALE/UNSCORED left to implementer codes?
- **D6.** N4: any concern about publishing per-stay compliance to parties beyond the operator (a city)? If so, gate it
  behind its own scope (`apx.compliance:read`).

Once decided, each item lands the usual way: prose, OpenAPI, registries, scenarios, simulator, Annex A rows and both
document sets, in one 0.16 PR.

## Decisions (Rick, 2026-10-22)

| # | Decision |
|---|---|
| D1 | `stayGrace {entryMinutes, exitMinutes}` goes on `EnforcementPolicy` (Part 19 §19.10). |
| D2 | Yes. `EligibilityResult.graceUntil` is derived from `stayGrace`. |
| D3 | `DisplayRecord` goes in Part 26 Site configuration. |
| D4 | Seed `apx-display-message-kinds` with the nine NexPark Edge scenario ids. **Not yet** for separate overstay or late-start exit messages: they stay `transientExitUnpaid`. Revisit when 211 Commerce data shows whether it matters. |
| D5 | Seed `apx-stay-compliance-statuses` with the full Nexus list (all 16, including UNSCORED, REVIEW_REQUIRED, STALE and PAID_LATE). Check each definition against Nexus `Docs/Enforcement/Compliance-Rules-v1.md` before writing normative text. |
| D6 | Yes. Per-stay compliance is read under its own scope `apx.compliance:read`. |
