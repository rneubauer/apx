# Findings — apx-site-config (Part 26, Annex A APX-SCF)

Each entry is something a scenario in `scenarios.md` needed that the
public spec does not define, or defines ambiguously. IDs are stable;
scenarios cite them in `gap=F-SCF-NN` markers so the runner reports them
as known gaps rather than failures, and reports them as resolved once
the spec is fixed. The 401 shape is not re-registered here: the module's
401 exchanges cite `F-CTL-07` from `findings.md`.

The module was written against the Part 26 design (the UI launch and
field-gap note of 2026-10-17, items B11–B20) at the same time as the
Part itself, so these findings record what the scenarios settled rather
than what they could not express. No `gap=` marker is open.

| ID | Module | Severity | Summary | Status |
|---|---|---|---|---|
| F-SCF-01 | site-config | medium | APDS `EquipmentTypeEnum` has no gate, dispenser, reader, camera, intercom or door; typing them `other` says nothing | fixed — required `role` from the fixed registry `apx-equipment-roles` on the equipment-detail decoration; the APDS type stays as published (SCF-01, SCF-02) |
| F-SCF-02 | site-config | medium | A posted number cannot name a lane, but a comms point lookup had no way to say "place only" | fixed (prose) — §26.4 rule 3: a comms point without `lane` resolves to its place; the agent or IVR asks which lane (SCF-03) |
| F-SCF-03 | site-config | medium | Which barrier a help point is for, when the comms point is on a door rather than a lane | fixed — `serves` on CommsPoint names the gate or door the agent opens; `vendGate` targets that equipment (SCF-03, SCF-09) |
| F-SCF-04 | site-config | low | A comms point with no number, caller id or device id can never be matched | fixed — schema `anyOf` on the three members; 400 `invalid-request` otherwise (SCF-04) |
| F-SCF-05 | site-config | medium | Camera credentials: a stream address with a password is the only way some legacy cameras can be reached | fixed — `credentialRef` names a vault label; the secret is exchanged once outside APX; no read carries it (SCF-10, Part 9) |
| F-SCF-06 | site-config | low | IP and MAC addresses on equipment | fixed (decision 2026-10-18) — `macAddresses[]` served as a hardware identity; IP addresses deliberately not a member, with the reason recorded in the decoration's description (SCF-01, SCF-10) |
| F-SCF-07 | site-config | low | Escalation contacts would put names and phone numbers in APX | fixed — `escalationContacts[]` carries roles, order and hours only; the call platform keeps the people (SCF-05) |

---

## F-SCF-01 — Lane equipment has no APDS type

**Where it showed up.** SCF-01 and SCF-02: a barrier, a verifier, an
intercom, a camera, a door, a reader, a recorder. APDS 4.1 offers
`paymentMachine`, `tollTerminal`, `publicPhone`, `informationPoint` and
`other`.

**Resolution.** The equipment-detail decoration's `role` is REQUIRED and
is one of a fixed list of codes, extended only by a registry version. The
APDS `equipmentType` is left as APDS defines it, and the addition of lane
equipment to `EquipmentTypeEnum` is asked of APDS separately.

## F-SCF-02 — A sign is not a lane

**Where it showed up.** SCF-03: `+15550100042` is on every sign in the
garage. Resolving the dialed number can only ever say "Lakeside Garage".

**Resolution.** Stated as a rule: a comms point without `lane` resolves
to its place only; the agent asks.

## F-SCF-03 — What does the comms point open?

**Where it showed up.** SCF-09: the lobby door's intercom is not on a
lane. Without `serves`, the agent would have to search the equipment
list for the door nearest the intercom.

**Resolution.** `serves` on the comms point; `vendGate` targets the
door as a `SupplementalEquipment`.

## F-SCF-04 — An unmatchable comms point

**Where it showed up.** SCF-04. A QR code with no url and no number is a
record nothing can ever resolve.

**Resolution.** At least one of `phoneNumber`, `callerId`,
`commsDeviceId` is required by schema.

## F-SCF-05 — Legacy cameras

**Where it showed up.** SCF-10: the P2 ramp camera speaks only RTSP with
a password, and cannot sit behind the video gateway.

**Resolution.** `credentialRef` names the secret; APX never carries it.
Everything that can sit behind a gateway is viewed through the
short-lived links of SCF-06.

## F-SCF-06 — Network identity

**Where it showed up.** SCF-01. Field technicians need a hardware
identity when the serial label has fallen off; a site map of IP
addresses together with model and firmware is what an attacker wants.

**Resolution.** MAC addresses in, IP addresses out, by decision of the
editors on 2026-10-18; reconsiderable behind a restricted scope if a real
need arises.

## F-SCF-07 — Who to call

**Where it showed up.** SCF-05. "Called the manager, no answer" is in
hundreds of call notes a week; the approval requests of Part 17 need a
role to be addressed to.

**Resolution.** Roles in calling order with hours; no people.
