# Scenario 14 — Resolution context: "I prepaid but it wants full price"

**The story.** A visitor prepaid an evening reservation at Lakeside Garage
for plate `SVN-4821`. At the entry lane the LPR camera read `5VN-4B21` at
0.41 confidence — S became 5, 8 became B — so the PARCS never matched the
reservation and opened a plain transient session instead. The visit itself
was uneventful; the surprise comes at Exit 2, where the pay-in-lane
terminal asks for the full drive-up price. The customer presses the
intercom with the confirmation email open on their phone. The fix is not a
discount and not a gate vend — it is correcting the plate, which is the
join key that links session to reservation.

**Actors.** Call-center platform (`apx.resolution:read`, `apx.lpr:read`,
`apx.data:write` scopes) → Lakeside Garage APX server (`apx-resolution` +
`apx-lpr` classes).

## Step 1 — The intercom call resolves to a context

The platform passes the lane its provisioning maps to this intercom, plus
the reservation code the customer reads out:

```http
POST /v1/resolution/contexts HTTP/1.1
Content-Type: application/json
```

```json
{
  "interactionId": "interaction-115502",
  "correlationId": "9d4e2f1a-6b3c-4d8e-9f0a-1b2c3d4e5f14",
  "channel": "intercom",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "reservationCode": "LKG-88214"
}
```

The server finds the session at the lane, finds the reservation behind the
code, and sees they are not linked — and why:

<!-- apx:validate ResolutionContext -->
<!-- apx:validate ReservationSummary at /reservation -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000014",
  "version": 1,
  "computedAt": "2026-09-02T22:41:37Z",
  "status": "full",
  "interactionId": "interaction-115502",
  "correlationId": "9d4e2f1a-6b3c-4d8e-9f0a-1b2c3d4e5f14",
  "issue": {
    "code": "reservationMismatch",
    "display": "Prepaid reservation exists but is not linked to the current session (misread plate)"
  },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "vehicle": { "plate": "5VN-4B21", "country": "US", "stateProvince": "FL", "confidence": 0.41 },
  "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "reservation": {
    "reservation": { "id": "e2000000-0000-4000-8000-000000000014", "className": "AssignedRight" },
    "reservationState": "confirmed",
    "plannedStart": "2026-09-02T17:30:00Z",
    "plannedEnd": "2026-09-02T23:30:00Z"
  },
  "allowedActions": [
    {
      "action": "put-apx-v1-sessions-id-plate",
      "display": "Correct the session's plate",
      "target": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "domain", "operationId": "put-apx-v1-sessions-id-plate" }
    },
    {
      "action": "vendGate",
      "display": "Vend gate",
      "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "allowed": false,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "vendGate" },
      "reason": {
        "code": "sessionUnsettled",
        "display": "The session is unpaid; correcting the plate links the prepaid reservation and settles it.",
        "policy": "no-vend-on-unsettled-session"
      }
    }
  ],
  "recommendedAction": {
    "action": "put-apx-v1-sessions-id-plate",
    "reason": "The entry read is low-confidence and a confirmed reservation exists for tonight; the plate is the link."
  }
}
```

The `vehicle.confidence` of 0.41 is the tell. Note the two `execution`
descriptors: plate correction is a **domain** action (a transactional
write, Part 17 §17.4), the gate vend a **control** command — and policy
has ruled the vend out until the session is settled.

## Step 2 — Pick the right read from the candidates

The read side of plate correction (Part 17 §17.5). The exit camera has
just produced a fresh, clean read of the same vehicle, so the agent
queries the lane's recent candidates:

```http
GET /v1/lpr/candidates?lane=b2000000-0000-4000-8000-000000000002&since=2026-09-02T22:30:00Z HTTP/1.1
```

<!-- apx:validate PlateCandidate at /data/0 -->
```json
{
  "data": [
    {
      "plate": "SVN-4821",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.97,
      "observationDateTime": "2026-09-02T22:39:04Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
      "plateImage": "https://api.lakeside-garage.example/v1/media/f2000000-0014/plate.jpg"
    },
    {
      "plate": "5VN-4B21",
      "country": "US",
      "stateProvince": "FL",
      "confidence": 0.41,
      "observationDateTime": "2026-09-02T17:41:22Z",
      "lane": { "id": "b2000000-0000-4000-8000-000000000001", "className": "VehicularAccess" },
      "observation": { "id": "f2000000-0000-4000-8000-000000000013", "className": "Observation" }
    }
  ]
}
```

Best confidence first: the 0.97 exit read against the 0.41 entry misread.
The customer confirms the plate out loud; the agent (or the AI, which may
classify and propose but never decide policy) picks the top candidate. The
imagery is an access-controlled link (Part 9 §9.6) — the payload carries a
URL, never bytes.

## Step 3 — Correct the plate; the link falls out

Plate correction is a naturally idempotent PUT on the session, citing the
chosen Observation as evidence:

```http
PUT /v1/sessions/f1000000-0000-4000-8000-000000000031/plate HTTP/1.1
Content-Type: application/json

{
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" },
  "reason": "entry LPR misread (0.41); corrected from exit-lane candidate confirmed by customer"
}
```

```json
{
  "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "plate": "SVN-4821",
  "country": "US",
  "stateProvince": "FL",
  "observation": { "id": "f2000000-0000-4000-8000-000000000014", "className": "Observation" }
}
```

(The response is the operation's small inline shape, not a named schema —
shown as-is, unannotated.)

With the plate corrected, the PARCS's own matching does the rest: the
session now carries the plate the reservation was sold against, the
reservation links, and the prepaid rate replaces the drive-up rate. At an
LPR facility the plate **is** the link — no separate call needed. (Where no
plate can carry the association — barcode-only reservations — the explicit
`PUT /v1/sessions/{id}/assigned-right` exists instead, Part 14 §14.1b.) A
context re-read shows the episode resolved:

```http
GET /v1/resolution/contexts/e5000000-0000-4000-8000-000000000014 HTTP/1.1
```

<!-- apx:validate ResolutionContext -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000014",
  "version": 2,
  "computedAt": "2026-09-02T22:43:10Z",
  "status": "full",
  "interactionId": "interaction-115502",
  "correlationId": "9d4e2f1a-6b3c-4d8e-9f0a-1b2c3d4e5f14",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "vehicle": { "plate": "SVN-4821", "country": "US", "stateProvince": "FL", "confidence": 0.97 },
  "session": { "id": "f1000000-0000-4000-8000-000000000031", "className": "Session" },
  "accessDecision": {
    "status": "granted",
    "reasonDisplay": "Prepaid reservation applied; amount due 0.00.",
    "occurredAt": "2026-09-02T22:43:02Z"
  },
  "allowedActions": []
}
```

`version` incremented because something material changed (Part 17 §17.2);
the amount due dropped to zero and the gate opens on the normal exit flow.
No override, no courtesy counted, every step — misread, candidates,
correction, grant — audited under one correlation id (`9d4e…`).
