# Scenario 29 — Plate review: a doubtful read held back, corrected by a person, then used as evidence

**The story.** Glenwood Street Lot is a gateless pay-by-plate lot in a
city whose rules say no notice may be mailed on a camera read a person
has not checked when the read is below 0.8 confidence. At 22:14 a rear
camera reads a hatchback as `GLN-8B03` at 0.52 — the plate is half in
shadow, and the engine's second choice is `GLN-8803`. The LPR system
marks the read for review. Overnight the enforcement pipeline finds no
paid session for the plate and records an overstay, but the server will
not let it issue on an unchecked read. In the morning a reviewer looks
at the image and corrects the 8; the pipeline re-runs its rule on the
corrected plate and dismisses the overstay. A second read, of a bike
rack's reflector, is rejected outright.

**Actors.** The site's LPR system (`apx.data:write`, native ingest); the
operator's review desk (`apx.lpr:read` to see reads, `apx.data:write` to
record decisions); the enforcement pipeline (`apx.violations:manage`) →
Glenwood Street APX server.

**Rules exercised.** Part 13 §13.3a(4a) (read review), §13.3b
(retention), §13.4 (`apx.data.observation.updated.v1`); Part 19 §19.4
rule 6 (reviewed reads); Annex A APX-LPR-08 and APX-VIO-16.

## Step 1 — 22:14: the read arrives marked for review

The LPR system ingests through native `POST /observations`. Its policy
sends low-confidence reads to review, so the decoration carries
`review.state: pending` and why:

<!-- apx:validate LprReadDetail at /extensions/apds-ext:apx:lpr-read@1.0 -->
```json
{
  "id": "f2000000-0000-4000-8000-000000000281",
  "version": 1,
  "method": "anpr",
  "type": "licensePlate",
  "observedCredentialId": "GLN-8B03",
  "observationStartTime": "2026-12-16T22:14:07Z",
  "elementIds": { "id": "b2000000-0000-4000-8000-000000000281", "className": "VehicularAccess", "version": 1 },
  "vehicleAncillaryIdentification": { "country": "US", "stateProvince": "OR" },
  "confidence": { "overallConfidence": 0.52 },
  "extensions": {
    "apds-ext:apx:lpr-read@1.0": {
      "plate": { "value": "GLN-8B03", "confidence": 0.52 },
      "stateProvince": { "value": "OR", "confidence": 0.9 },
      "alternateReads": [ { "plate": "GLN-8803", "confidence": 0.47 } ],
      "plateFace": "rear",
      "accessEvent": "entry",
      "captureGroup": "glenwood/20261216T221407/0093",
      "review": { "state": "pending", "reasons": ["lowConfidence", "ambiguousCharacters"] }
    }
  }
}
```

(Abridged native APDS payload.) `lowConfidence` and
`ambiguousCharacters` (the alternate differs only in an 8/B) come from
the `apx-read-review-reasons` registry (Part 11). Which reads go to
review, and who works the queue, is the operator's business; APX
carries only the state (§13.3a(4a)).

## Step 2 — 06:00: the pipeline cannot issue yet

The pipeline finds no paid session for `GLN-8B03` and records an
automated overstay citing the read in its `observations[]`
(`POST /v1/violations`, as in scenario 16). Lot policy allows
unreviewed issuance for automated detections, so it tries to issue:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000281/issue HTTP/1.1
Content-Type: application/json
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000281/issue -->
```json
{
  "noticeKind": "notice",
  "amount": { "currencyType": "USD", "currencyValue": 40.0 },
  "dueTime": "2027-01-16T23:59:59Z",
  "deliveryMethod": "mail"
}
```

The evidence read's review is still `pending`, so the server refuses,
whatever the lot's unreviewed-issuance policy says (Part 19 §19.4
rule 6; APX-VIO-16):

```json
{
  "type": "https://apx-standard.org/problems/violation-not-issuable",
  "title": "Violation not issuable",
  "status": 409,
  "detail": "Evidence read f2000000-0000-4000-8000-000000000281 has plate review 'pending'.",
  "instance": "/v1/violations/d3000000-0000-4000-8000-000000000281/issue"
}
```

## Step 3 — 08:20: the reviewer corrects the plate

The review desk lists the read (`GET /v1/lpr/reads?observation=…`,
under `apx.lpr:read`), opens the image, and sees the fifth character is
an 8 in shadow, not a B — the engine's second choice was right. It
records the decision against the version it saw:

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000281/plate HTTP/1.1
Content-Type: application/json
If-Match: "1"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000281/plate -->
```json
{
  "decision": "corrected",
  "plate": "GLN-8803",
  "stateProvince": "OR",
  "reason": "Shadow across the fifth character; frame shows an 8.",
  "reviewer": "glenwood-desk-04"
}
```

The desk holds `apx.lpr:read`, so the 200 is the read as it now stands
— the same Observation the event below carries. (A caller with
`apx.data:write` alone would get only the minimal echo:
`observation`, `version`, `review.state`, and the plate values it sent,
Part 9 §9.6.)

The server writes `GLN-8803` into `observedCredentialId` and
`vehicleAncillaryIdentification`, so a plain APDS client sees it, sets
`review.state`, `decidedTime`, and `decidedBy`, increments the
Observation `version`, and publishes the replacement. The engine's
original values, with their confidences, stay in `review.original`,
never to change again:

<!-- apx:validate EventEnvelope -->
<!-- apx:validate LprReadDetail at /data/extensions/apds-ext:apx:lpr-read@1.0 -->
```json
{
  "id": "7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b",
  "type": "apx.data.observation.updated.v1",
  "source": "https://api.glenwood-lot.example/v1",
  "subject": { "id": "f2000000-0000-4000-8000-000000000281", "className": "ObservationElement" },
  "time": "2026-12-17T08:20:41Z",
  "data": {
    "id": "f2000000-0000-4000-8000-000000000281",
    "version": 2,
    "method": "anpr",
    "observedCredentialId": "GLN-8803",
    "observationStartTime": "2026-12-16T22:14:07Z",
    "elementIds": { "id": "b2000000-0000-4000-8000-000000000281", "className": "VehicularAccess", "version": 1 },
    "extensions": {
      "apds-ext:apx:lpr-read@1.0": {
        "plate": { "value": "GLN-8803" },
        "stateProvince": { "value": "OR" },
        "alternateReads": [ { "plate": "GLN-8803", "confidence": 0.47 } ],
        "plateFace": "rear",
        "accessEvent": "entry",
        "captureGroup": "glenwood/20261216T221407/0093",
        "review": {
          "state": "corrected",
          "reasons": ["lowConfidence", "ambiguousCharacters"],
          "decidedTime": "2026-12-17T08:20:41Z",
          "decidedBy": "glenwood-desk-04",
          "original": {
            "plate": { "value": "GLN-8B03", "confidence": 0.52 },
            "stateProvince": { "value": "OR", "confidence": 0.9 }
          }
        }
      }
    }
  }
}
```

(`data` abridged.) The corrected plate carries no confidence: a person
decided it, not the engine. The correction is per read: it changes no
Session, and every Session the read feeds sees it. Had the desk resent
the same decision and plate, the server would have answered 200 with
version 2 and published nothing; had another reviewer decided first, the
`If-Match: "1"` would have been 409 `version-conflict`.

## Step 4 — The pipeline re-evaluates and dismisses

The correction changed the read, not the violation. The pipeline
receives the event, keys on the Observation id, keeps version 2, and
re-runs its rule against `GLN-8803`. That plate paid until 23:00, so the
pipeline **dismisses** the overstay recorded on the misread plate
instead of issuing it:

```http
POST /v1/violations/d3000000-0000-4000-8000-000000000281/review HTTP/1.1
Content-Type: application/json
```

<!-- apx:request POST /v1/violations/d3000000-0000-4000-8000-000000000281/review -->
```json
{
  "decision": "dismiss",
  "reason": "plateMisread",
  "note": "Read f2000000-…0281 corrected to GLN-8803 on review; that plate was paid until 23:00."
}
```

Had the plate been unpaid, the same `issue` call from Step 2 would now
succeed: the evidence read is `corrected`, which no longer blocks
issuance (§19.4 rule 6). Either way, nothing went out on a read nobody
checked.

## Step 5 — The reflector

At 23:02 the same camera read a bike rack's reflector strip as `L1-11`,
also marked `pending`. The reviewer rejects it:

```http
PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000282/plate HTTP/1.1
Content-Type: application/json
If-Match: "1"
```

<!-- apx:request PUT /v1/lpr/reads/f2000000-0000-4000-8000-000000000282/plate -->
```json
{ "decision": "rejected", "reason": "Not a vehicle: reflector on the bike rack.", "reviewer": "glenwood-desk-04" }
```

A `plate` sent with `rejected` would have been 422
`request-unprocessable`. The read stays on file until its retention
ends (Part 13 §13.3b), but it is unusable for pairing and enforcement:
a violation citing it can never be issued (§19.4 rule 6).
