# Findings — apx-ui-launch (Part 25, Annex A APX-UIL)

Each entry is something a scenario in `scenarios.md` needed that the
public spec does not define, or defines ambiguously. IDs are stable;
scenarios cite them in `gap=F-UIL-NN` markers so the runner reports them
as known gaps rather than failures, and reports them as resolved once
the spec is fixed. The 401 shape is not re-registered here: the module's
401 exchanges cite `F-CTL-07` from `findings.md`.

The module was written against the Part 25 design (the UI launch and
field-gap note of 2026-10-17) at the same time as the Part itself, so
these findings record what the scenarios settled rather than what they
could not express. No `gap=` marker is open.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-UIL-01 | ui-launch | medium | Native loopback (a Command recorded from the vendor's screen) and the launch's `actions[]` could be two unrelated records | fixed (prose) — §25.5: a native resource MAY also be listed as a `UiActionRecord` whose `result` references it; `correlationId` and `agent` are the join either way (UIL-01) |
| F-UIL-02 | ui-launch | medium | Signed-token mode creates no record through the API, so the host could not find the launch | fixed — the implementation creates the `UiLaunch` when it accepts the token; `GET /v1/ui/launches?correlationId=` finds it (UIL-03) |
| F-UIL-03 | ui-launch | low | Who may record an action on a launch: the host, the screen, or both | fixed — `apx.ui:record` is the screen's scope; a host console holding only `apx.ui:launch` is 403 `insufficient-scope` (UIL-06) |
| F-UIL-04 | ui-launch | low | Whether the URL's single use is observable through the API | fixed (prose) — the second open is refused by the screen out of band; the record shows one `openedAt` and the url is never re-minted on an idempotent replay (UIL-01, UIL-06) |

---

## F-UIL-01 — Native loopback versus the action list

**Where it showed up.** UIL-01: the lost-ticket fee issued in the
Gatewise lane console is recorded as a `lostTicket` Command carrying the
launch's `correlationId`, which is what Part 25 §25.5 rule 1 requires.
The launch record's `actions[]` would then be empty, and a reviewer
listing launches (UIL-08) would see nothing done.

**Resolution.** The Command is the normative record. The implementation
MAY also append a `UiActionRecord` whose `result` references it, so the
launch reads as a summary of what was done without duplicating the
Command's data. Consumers reconcile by `correlationId`.

## F-UIL-02 — Finding a signed-token launch

**Where it showed up.** UIL-03. In signed-token mode the host never calls
`POST /v1/ui/launches`, so without a rule there would be no `UiLaunch`
to read or to receive `apx.ui.launch.changed.v1` for.

**Resolution.** Accepting a valid token creates the launch (status
`opened`, no `url`); the host finds it by `correlationId` or
`interactionId` on the list route.

## F-UIL-03 — Which scope records

**Where it showed up.** UIL-06. The design note names `apx.ui:launch` and
`apx.ui:read`; the actions and close routes needed a scope of their own
so a host console cannot write the vendor's record from call notes.

**Resolution.** `apx.ui:record`, held by the launched surface's own
client.

## F-UIL-04 — Single use, observed

**Where it showed up.** UIL-06. The runner can only check what the API
returns; the refusal of a reused `url` happens at the vendor's screen.

**Resolution.** Stated in prose: one `openedAt`, no second `url` on an
idempotent replay, and the screen refuses a reused link.
