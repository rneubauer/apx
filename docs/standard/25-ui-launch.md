# APX Part 25 — UI Launch (optional class `apx-ui-launch`)

Most remote-assistance actions still happen in a vendor's own web screen,
not through an API: an agent opens the PARCS portal in another window,
issues the lost ticket or applies the validation there, and types a note
into the call record. The two systems never agree afterwards. This Part
lets an implementation offer those screens to an authorised agent with
automatic login, and makes everything done on them come back as APX
data, so the call record and the vendor's record stay in step.

"Screen-pop" already names the lane inquiry (Part 6 §6.2). This Part
uses **UI launch** for opening a vendor's own screen.

**What APDS has.** Nothing. APDS defines no user interface, no agent
identity, and no way to refer a person from one system's screen to
another's.

**What this Part adds.** A registry of **surfaces** (the screens an
implementation may offer, named per module), the `UiLaunch` resource
(one opening of a surface for one agent, with a single-use URL or a
signed token), the `UiActionRecord` (what the agent did there, when no
APX operation covers it), the routes under `/v1/ui/launches`, the
discovery member `uiSurfaces[]`, the Part 17 execution descriptor
`type: ui`, and the topics `apx.ui.launch.changed.v1` and
`apx.ui.action.recorded.v1`. It is defined once and used by every
module: tolling, LPR, reservations or validations get the same launch
and loopback by adding a surface to the registry, not by new design.

## 25.1 Surfaces (normative)

1. A **surface** is a screen an implementation offers to staff. Its name
   is a definedValue of `apx-ui-surfaces` (Part 11), written
   `<module>.<view>`: `lane.console`, `session.detail`,
   `reservation.detail`, `reservation.search`, `lpr.read.review`,
   `violation.detail`, `violation.appeal`, `validation.redeem`,
   `credential.detail`, `toll.transaction`, `toll.dispute`,
   `valet.ticket`, `charging.session`, `place.console`, `module.home`.
   Each registry entry names the **subject class** the surface opens (a
   Session, a Violation, a VehicularAccess); `reservation.search`,
   `place.console` and `module.home` are general surfaces with no
   subject, or with the place as subject.
2. An implementation lists the surfaces it offers as `uiSurfaces[]`
   (`UiSurface`) in `/.well-known/apx-configuration` and in every
   discovery document whose client holds `apx.ui:launch` or `apx.ui:read`
   (Part 16). Each entry gives the surface, its `displayModes` (`embed`,
   `popup`, `tab`), its `launchModes` (`handshake`, `signedToken`), the
   `actions` it can report back (§25.4), its `launchUrl` where the
   signed-token mode is offered, and the `places` where it is offered
   (absent means every granted place). The discovery soundness rule
   applies (Part 16 §16.2): a listed surface MUST be launchable by that
   client for at least one granted place.
3. A launch that names a surface the implementation does not offer, or
   does not offer at that place, is refused with
   `422 ui-surface-unknown`; a `displayMode` the surface does not list is
   `422 ui-display-mode-unsupported`.

## 25.2 Launching (normative)

Both launch modes log the agent in automatically. The agent never sees a
vendor login page and never holds vendor credentials.

1. **Handshake.** The host calls `POST /v1/ui/launches` (scope
   `apx.ui:launch`) with its normal APX token and a `UiLaunchRequest`:
   `surface`, `place`, `agent`, `agentType`, `correlationId` and
   `displayMode`, plus optionally `subject`, `lane`, `interactionId`,
   `returnFields[]` and `expiresIn`. The implementation answers 201 with
   the `UiLaunch`: a `url` that is **single-use** and lives at most 60
   seconds (`expiresAt`), the `displayMode` granted, and `status: issued`.
   The host opens the `url` for the agent. This mode also serves
   implementations that authenticate the host by request header, because
   a browser cannot add headers when it opens a page: the server-to-server
   call carries the header, the one-time `url` carries nothing but its own
   identity.
2. **Signed token.** The host signs a launch token and sends it to the
   surface's `launchUrl`, by HTML form POST or in the URL fragment, never
   in the query string. The token is a JWS (RFC 7515) whose payload
   carries the `UiLaunchRequest` members as claims, with `iss` (the host),
   `aud` (the implementation), `iat`, `exp` at most 60 seconds after
   `iat`, and a unique `jti`. The implementation verifies the signature
   against the host's keys, registered at onboarding, refuses an expired
   or replayed `jti`, creates the `UiLaunch` itself, and opens the surface.
   Accepted algorithms are `ES256` and `RS256`; `none` MUST be refused.
3. **Binding.** A launch is bound to one surface, one subject (where
   given), one agent and one place. The implementation MUST open exactly
   that screen for that agent and MUST NOT let the opened session reach
   another subject outside the agent's grant.
4. `expiresIn` is capped at 60 seconds; a larger value is clamped and the
   effective `expiresAt` returned. `Idempotency-Key` is optional (Part 4
   §4.2a); a replay returns the launch as it currently stands (200).
5. `GET /v1/ui/launches/{id}` and `GET /v1/ui/launches` (scope
   `apx.ui:read`; filters `place`, `agent`, `status`, `correlationId`,
   `interactionId`) return launches whose `place` lies inside the grant.
   The read never returns a usable `url` after the launch has been
   opened, closed or expired.

## 25.3 Lifecycle (normative)

`issued → opened → closed | expired`, and `issued → expired`.

- `issued` on creation. `opened` on the first use of the `url` or token;
  a second use is refused by the surface (the launch is single-use), and
  the implementation SHOULD record the attempt in its audit log.
- `closed` when the surface reports the end of the session with
  `POST /v1/ui/launches/{id}/close` (scope `apx.ui:record`), or when the
  implementation observes the session end.
- `expired` when `expiresAt` passes while `issued`, or when an opened
  launch outlives the implementation's session limit without being
  closed (RECOMMENDED 1 hour after `openedAt`).
- `openedAt` and `closedAt` are set on those transitions. Every
  transition publishes `apx.ui.launch.changed.v1`. Terminal states
  (`closed`, `expired`) never transition again; an action or close on a
  terminal launch is `409 ui-launch-closed`, and one on an `issued` launch
  whose `expiresAt` has passed is `409 ui-launch-expired`.

## 25.4 Loopback (normative)

This is the heart of the Part. Everything an agent does on a launched
surface MUST appear in APX exactly as if it had been done through the
API.

1. **Native first.** An action whose APX operation the implementation
   supports MUST produce that operation's own effect: the Part 6 Command
   (a vend, a lost ticket), the Part 13 refund, the Part 20 redemption,
   the Part 17 plate correction, and so on. The resulting record MUST
   carry the launch's `correlationId` and the launch's `agent` and
   `agentType` (as `Command.agent`, `recordInfo`, or the member the
   operation defines), and MUST publish the events that operation
   publishes. A consumer following `correlationId` then sees the action
   with no knowledge that a screen was involved.
2. **Fallback.** An action with no supported APX operation MUST instead be
   recorded as a `UiActionRecord` on the launch: `action` (an
   `apx-command-types` value, the effective operationId of the nearest
   APX operation, or `other`), `outcome` (`completed`, `failed`,
   `noAction`), `occurredAt`, a short `summary`, and `result` where a
   native resource was nevertheless created. The surface, or its backend,
   records it with `POST /v1/ui/launches/{id}/actions` (scope
   `apx.ui:record`); an implementation whose surface and APX server are
   one system MAY record it internally and MUST then behave as if the
   route had been called. Each record publishes
   `apx.ui.action.recorded.v1`.
3. **Return fields.** The host MAY ask, in `returnFields[]`, for the values
   it needs back, named as JSON Pointers into the APX schema the action
   concerns (`/amountDue`, `/session/id`, `/ticketNumber`). A
   `UiActionRecord` carries them in `fields`, keyed by the pointer. A
   value the implementation cannot supply is listed in `unavailable[]`
   with `reason` `notSupported` (the surface never knows it) or
   `notApplicable` (it does not apply to this action), never silently
   omitted. The host decides what it needs; the implementation says what
   it can give.
4. **Completeness.** A launch that is `closed` with no native effect and
   no `UiActionRecord` means the agent did nothing; the implementation
   MUST NOT infer an action from the screen having been opened.
5. **Summaries, not transcripts.** `summary` and `fields` carry no
   personal data beyond what the referenced APX resources already carry
   under the host's scopes (Part 9 §9.6).

## 25.5 Part 17 link (normative)

1. `AllowedAction.execution.type` gains the value `ui`. With
   `type: ui` the descriptor carries `surface` (REQUIRED) and `subject`
   (OPTIONAL), so an agent's console offers "do it in the vendor's
   screen" when no API operation exists for the action, and the policy
   decision (`allowed`, `requiresApproval`, `reason`) applies to the
   launch exactly as to a command (Part 17 §17.3).
2. A launch created from an allowed action SHOULD carry the context's
   `correlationId`; the `UiLaunch` and its `UiActionRecord`s MAY be
   referenced from `SupportInteraction.actions[]` by className, so a
   support record lists what was done on a screen beside what was done by
   command.

## 25.6 Security (normative)

1. A launch `url` and a launch token are bearer secrets: single-use,
   valid at most 60 seconds, bound per §25.2 rule 3, HTTPS only. They
   MUST NOT appear in a query string, a referrer, or a log line; the
   fragment or a form POST carries the token, and the `url` identifies
   the launch by an unguessable value (at least 128 bits of entropy).
2. Personal data and secrets MUST NOT be carried in a launch URL or
   token; the surface reads what it needs through its own back end.
3. `embed` requires the host's origin to be registered with the
   implementation, which MUST set `Content-Security-Policy:
   frame-ancestors` to exactly the registered origins; an unregistered
   origin is offered `popup` or `tab` instead.
4. The keys a host signs tokens with, and any secret an implementation
   issues for the handshake mode, are rotatable with an overlap window
   (as Part 9 §9.4) and MUST NOT be returned by any read operation
   (Part 9 §9.7).
5. The opened session MUST end when the launch closes or expires; a
   surface MUST NOT leave the agent logged into the vendor system beyond
   the launch.
6. Everything done on a launched surface is attributable: the agent of
   the launch, not a shared vendor account, appears on every record it
   produces (§25.4).

## 25.7 Conformance

`apx-ui-launch` requires the base classes and: §25.1 surfaces listed in
discovery with the soundness rule; §25.2 at least one launch mode, with
automatic login and the 60-second single-use rule; §25.3 the lifecycle
and its topic; §25.4 loopback, native first, `UiActionRecord` otherwise,
with `returnFields` answered or declared unavailable; §25.6 the security
rules. §25.5 applies when `apx-resolution` is also claimed. Annex A.23.

## 25.8 Registry entries

| Registry | Entries |
|---|---|
| `apx-conformance-classes` v9 | `apx-ui-launch` |
| `apx-ui-surfaces` v1 | `lane.console`, `session.detail`, `reservation.detail`, `reservation.search`, `lpr.read.review`, `violation.detail`, `violation.appeal`, `validation.redeem`, `credential.detail`, `toll.transaction`, `toll.dispute`, `valet.ticket`, `charging.session`, `place.console`, `module.home` |
| `apx-topics` v13 | `apx.ui.launch.changed.v1`, `apx.ui.action.recorded.v1` |

Scopes: `apx.ui:launch`, `apx.ui:read`, `apx.ui:record`.
