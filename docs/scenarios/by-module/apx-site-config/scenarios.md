# apx-site-config — vetting scenarios

<!-- apx:module apx-site-config tag=Site_configuration ics=SCF -->

Every exchange below is validated against the public bundle by
`npm run vetting -- apx-site-config`. Gaps the spec cannot express are
marked `gap=F-SCF-NN` and explained in `findings.md`; the 401 shape
reuses `F-CTL-07` from `findings.md`.

**Cast.** Lakeside Garage (place `b1…0001`), entry lane `b2…0001`, exit
lane 2 `b2…0002`. Equipment at exit lane 2: barrier `c1…0002`, pay-in-lane
terminal with exit verifier `c1…0003`, the intercom built into it
`c1…0005`, the overhead lane camera `c1…0007`. The after-hours pedestrian
door on the ground floor: door `c1…0010`, its card reader `c1…0011`, the
intercom in its call box `c1…0012`, the lobby camera `c1…0013`. The exit-lane sign at lane 2 is `c1…0040` (role `laneDisplay`). The
pay-on-foot station in the P1 payment area `c1…0020`, the recorder in the
equipment room `c1…0030`. Harbor Deck (`b1…0002`, exit lane `b2…0003`)
belongs to another operator and is outside the token's grant. Operator
organisation `a1…0001`; Gatewise, the PARCS vendor, is `a2…0021`; the
camera service company is `a2…0022`. The call platform's ids are
synthetic: account `acct-7f3a9`, devices `dev-…`. Comms points are
`cc…0CNN`, camera views `cd…0DNN`, events `e9…0ENN`. The posted number
at Lakeside is `+15550100042`; the exit-lane intercom calls out as
`+15550100201`.

Every request carries `Authorization: Bearer …` with scopes
`apx.siteconfig:read apx.siteconfig:manage apx.cameras:view
apx.control:execute apx.resolution:read` and `apx_places` =
`["b1000000-0000-4000-8000-000000000001"]` unless the scenario says
otherwise. Equipment is read as APDS `SupplementalEquipment` with the APX
decorations in `extensions`; the APDS members not needed by a scenario
are abridged. All timestamps are RFC 3339 UTC on 2026-10-18.

---

## SCF-01 — Everything on exit lane 2, from APX alone

<!-- apx:scenario SCF-01 kind=happy ics=APX-SCF-01,APX-SCF-02,APX-SCF-03,APX-SCF-04,APX-CORE-01 -->

**Given** a call-center console onboarding Lakeside Garage with nothing
but APX. **When** it lists the equipment on exit lane 2. **Then** four
APDS `SupplementalEquipment` records, each with the
`apds-ext:apx:equipment-detail@1.0` decoration: the role from
`apx-equipment-roles`, make, model, firmware and software versions,
serial number and MAC address, the area and lane, what is built into
what, and which barrier the verifier opens (§26.1). The camera carries
`apds-ext:apx:camera@1.0` as well: overhead, looking at the vehicle and
at the hands on the terminal, recorded on channel 4 of the recorder
(§26.3). No IP address, no username, no password anywhere.

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001&lane=b2000000-0000-4000-8000-000000000002 -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /data/0/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate EquipmentDetail at /data/1/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate EquipmentDetail at /data/2/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate EquipmentDetail at /data/3/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate CameraDetail at /data/3/extensions/apds-ext:apx:camera@1.0 -->
```json
{
  "meta": { "referenceInstant": 1792332000, "offset": 0, "pageSize": 100, "total": 4 },
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000002",
      "version": 3,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Exit lane 2 barrier" }],
      "layer": 3,
      "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "gate",
          "manufacturer": "Gatewise",
          "model": "GW-B40",
          "firmwareVersion": "4.2.1",
          "serialNumber": "GWB40-002211",
          "macAddresses": ["3c7a1e00b2a1"],
          "installedAt": "2024-03-01",
          "area": "lane",
          "level": "G",
          "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
          "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000021", "className": "Organisation" }, "supportReference": "LAKESIDE-EXIT2" }
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000003",
      "version": 5,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Exit lane 2 pay-in-lane terminal" }],
      "layer": 3,
      "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "paymentMachine",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "exitVerifier",
          "manufacturer": "Gatewise",
          "model": "GW-X200",
          "firmwareVersion": "7.0.3",
          "softwareVersion": "LaneOS 2026.3",
          "serialNumber": "GWX200-010884",
          "macAddresses": ["3c7a1e00b2a2", "3c7a1e00b2a3"],
          "installedAt": "2024-03-01",
          "area": "lane",
          "level": "G",
          "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
          "controls": [ { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" } ],
          "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000021", "className": "Organisation" }, "supportReference": "LAKESIDE-EXIT2" }
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000005",
      "version": 2,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Exit lane 2 intercom" }],
      "layer": 3,
      "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "intercom",
          "manufacturer": "Talkpoint",
          "model": "TP-SIP2",
          "firmwareVersion": "2.14.0",
          "serialNumber": "TPS2-77120",
          "macAddresses": ["b827eb44c1d0"],
          "installedAt": "2024-03-01",
          "area": "lane",
          "level": "G",
          "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
          "builtInto": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" }
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000007",
      "version": 2,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Exit lane 2 overhead camera" }],
      "layer": 3,
      "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
      "hierarchyElementRecord": { "creationTime": "2025-06-12T09:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "camera",
          "manufacturer": "Viewline",
          "model": "VL-D4",
          "firmwareVersion": "5.80.2",
          "serialNumber": "VLD4-331902",
          "macAddresses": ["00e0ac10f0a7"],
          "installedAt": "2025-06-12",
          "area": "lane",
          "level": "G",
          "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
          "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000022", "className": "Organisation" } }
        },
        "apds-ext:apx:camera@1.0": {
          "mounting": "overhead",
          "view": ["vehicle", "equipmentInteraction"],
          "faces": "outward",
          "primary": true,
          "ptz": false,
          "recorder": { "equipment": { "id": "c1000000-0000-4000-8000-000000000030", "className": "SupplementalEquipment" }, "channel": "4" },
          "streams": [
            { "protocol": "webrtc" },
            { "protocol": "snapshot", "resolution": "1920x1080" }
          ],
          "retentionDays": 30
        }
      }
    }
  ]
}
```

The APDS equipment *type* stays what APDS defines: `paymentMachine` for
the terminal, `other` for the rest until APDS adds lane equipment to
`EquipmentTypeEnum`. The `role` says what each one is.

One item by id:

<!-- apx:request GET /v1/equipment/c1000000-0000-4000-8000-000000000005 -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /extensions/apds-ext:apx:equipment-detail@1.0 -->
```json
{
  "id": "c1000000-0000-4000-8000-000000000005",
  "version": 2,
  "type": "supplementalEquipment",
  "name": [{ "language": "en", "string": "Exit lane 2 intercom" }],
  "layer": 3,
  "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
  "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
  "supplementalFacilityIndex": 1,
      "equipmentType": "other",
  "extensions": {
    "apds-ext:apx:equipment-detail@1.0": {
      "role": "intercom",
      "manufacturer": "Talkpoint",
      "model": "TP-SIP2",
      "firmwareVersion": "2.14.0",
      "serialNumber": "TPS2-77120",
      "macAddresses": ["b827eb44c1d0"],
      "area": "lane",
      "level": "G",
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "builtInto": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" }
    }
  }
}
```

---

## SCF-02 — Beyond the lanes: the pedestrian door, the pay-on-foot, the recorder

<!-- apx:scenario SCF-02 kind=happy ics=APX-SCF-02,APX-SCF-03,APX-SCF-04 -->

**Given** the same console wants the rest of the building. **When** it
filters by area and by role. **Then** the ground-floor pedestrian
entrance has an `accessDoor`, the `cardReader` that controls it, the
intercom built into its call box and a ceiling camera looking at
pedestrians; the `payOnFoot` station belongs to the P1 payment area and
to no lane; the `videoRecorder` in the equipment room is what the
cameras' `recorder` members point at. Place-level equipment carries no
`lane` (§26.1 rule 4).

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001&area=pedestrianEntrance -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /data/0/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate EquipmentDetail at /data/1/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate EquipmentDetail at /data/2/extensions/apds-ext:apx:equipment-detail@1.0 -->
<!-- apx:validate CameraDetail at /data/3/extensions/apds-ext:apx:camera@1.0 -->
```json
{
  "meta": { "referenceInstant": 1792332060, "offset": 0, "pageSize": 100, "total": 4 },
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000010",
      "version": 1,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Lobby pedestrian door" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "accessDoor",
          "manufacturer": "Doorsafe",
          "model": "DS-E1",
          "firmwareVersion": "1.9.4",
          "serialNumber": "DSE1-40021",
          "area": "pedestrianEntrance",
          "level": "G"
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000011",
      "version": 1,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Lobby door card reader" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "cardReader",
          "manufacturer": "Doorsafe",
          "model": "DS-R10",
          "firmwareVersion": "1.9.4",
          "serialNumber": "DSR10-40022",
          "macAddresses": ["b827eb44c1e4"],
          "area": "pedestrianEntrance",
          "level": "G",
          "controls": [ { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" } ]
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000012",
      "version": 1,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Lobby door intercom" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "intercom",
          "manufacturer": "Talkpoint",
          "model": "TP-SIP2",
          "firmwareVersion": "2.14.0",
          "serialNumber": "TPS2-77131",
          "macAddresses": ["b827eb44c1e5"],
          "area": "pedestrianEntrance",
          "level": "G",
          "builtInto": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" }
        }
      }
    },
    {
      "id": "c1000000-0000-4000-8000-000000000013",
      "version": 1,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Lobby camera" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2025-06-12T09:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "camera",
          "manufacturer": "Viewline",
          "model": "VL-C2",
          "firmwareVersion": "5.80.2",
          "serialNumber": "VLC2-331950",
          "area": "pedestrianEntrance",
          "level": "G"
        },
        "apds-ext:apx:camera@1.0": {
          "mounting": "ceiling",
          "view": ["pedestrians"],
          "primary": true,
          "recorder": { "equipment": { "id": "c1000000-0000-4000-8000-000000000030", "className": "SupplementalEquipment" }, "channel": "9" },
          "streams": [ { "protocol": "hls" }, { "protocol": "snapshot" } ],
          "retentionDays": 14
        }
      }
    }
  ]
}
```

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001&role=payOnFoot -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /data/0/extensions/apds-ext:apx:equipment-detail@1.0 -->
```json
{
  "meta": { "referenceInstant": 1792332070, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000020",
      "version": 4,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "P1 pay-on-foot station" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "paymentMachine",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "payOnFoot",
          "manufacturer": "Gatewise",
          "model": "GW-P500",
          "firmwareVersion": "7.0.3",
          "softwareVersion": "LaneOS 2026.3",
          "serialNumber": "GWP500-020417",
          "macAddresses": ["3c7a1e00b2c9"],
          "installedAt": "2024-03-01",
          "area": "paymentArea",
          "level": "P1",
          "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000021", "className": "Organisation" }, "supportReference": "LAKESIDE-POF1" }
        }
      }
    }
  ]
}
```

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001&role=videoRecorder -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /data/0/extensions/apds-ext:apx:equipment-detail@1.0 -->
```json
{
  "meta": { "referenceInstant": 1792332080, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000030",
      "version": 2,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Equipment room NVR" }],
      "layer": 2,
      "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
      "hierarchyElementRecord": { "creationTime": "2025-06-12T09:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "other",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "videoRecorder",
          "manufacturer": "Viewline",
          "model": "VL-NVR16",
          "firmwareVersion": "3.2.0",
          "softwareVersion": "ViewStore 11.4",
          "serialNumber": "VLN16-88201",
          "macAddresses": ["00e0ac10f1b0"],
          "installedAt": "2025-06-12",
          "area": "equipmentRoom",
          "level": "G",
          "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000022", "className": "Organisation" }, "supportReference": "SVC-LKS-NVR" }
        }
      }
    }
  ]
}
```

A lane in another operator's garage is refused, not hidden:

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is outside the token's apx_places grant.",
  "instance": "/v1/equipment"
}
```

---

## SCF-03 — Which lane is calling: by caller id, by the number dialed, by the device id

<!-- apx:scenario SCF-03 kind=happy ics=APX-SCF-06,APX-SCF-07 -->

**Given** three ways a call reaches the call center. **When** the call
platform looks up the comms point by the intercom's caller id, by the
posted number a parker dialed from their own phone, and by the device
id it holds for the door. **Then** the intercom resolves to exit lane 2
and the barrier it serves; the posted number resolves to the place and
to no lane, because a sign cannot know where the caller stands (§26.4
rule 3); the door's comms point resolves to the door it serves. No SIP
user, realm or password is anywhere in a comms point (§26.4 rule 5).

<!-- apx:request GET /v1/comms-points?callerId=%2B15550100201 -->
<!-- apx:response 200 -->
<!-- apx:validate CommsPoint at /data/0 -->
```json
{
  "meta": { "referenceInstant": 1792332100, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "cc000000-0000-4000-8000-000000000c01",
      "version": 2,
      "type": "intercom",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "equipment": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
      "serves": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "phoneNumber": "+15550100900",
      "callerId": "+15550100201",
      "commsDeviceId": "dev-51ccae16",
      "coverage": [
        { "period": { "periodName": [{ "language": "en", "string": "Always" }] }, "languages": ["en", "es"] }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/comms-points?dialedNumber=%2B15550100042 -->
<!-- apx:response 200 -->
<!-- apx:validate CommsPoint at /data/0 -->
```json
{
  "meta": { "referenceInstant": 1792332110, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "cc000000-0000-4000-8000-000000000c02",
      "version": 1,
      "type": "postedNumber",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "phoneNumber": "+15550100042",
      "coverage": [
        {
          "period": {
            "periodName": [{ "language": "en", "string": "Staffed hours" }],
            "recurringTimePeriodOfDay": [ { "startTimeOfPeriod": "06:00", "endTimeOfPeriod": "22:00" } ]
          },
          "languages": ["en"]
        },
        {
          "period": {
            "periodName": [{ "language": "en", "string": "Overnight, answered remotely" }],
            "recurringTimePeriodOfDay": [ { "startTimeOfPeriod": "22:00", "endTimeOfPeriod": "06:00" } ]
          },
          "languages": ["en", "es"]
        }
      ]
    }
  ]
}
```

<!-- apx:request GET /v1/comms-points?commsDeviceId=dev-a0b1c2d3 -->
<!-- apx:response 200 -->
<!-- apx:validate CommsPoint at /data/0 -->
```json
{
  "meta": { "referenceInstant": 1792332120, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "cc000000-0000-4000-8000-000000000c03",
      "version": 1,
      "type": "intercom",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "equipment": { "id": "c1000000-0000-4000-8000-000000000012", "className": "SupplementalEquipment" },
      "serves": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
      "phoneNumber": "+15550100900",
      "callerId": "+15550100210",
      "commsDeviceId": "dev-a0b1c2d3"
    }
  ]
}
```

Every comms point of the place, for the console's setup screen:

<!-- apx:request GET /v1/comms-points?place=b1000000-0000-4000-8000-000000000001&type=intercom -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792332130, "offset": 0, "pageSize": 100, "total": 2 },
  "data": [
    {
      "id": "cc000000-0000-4000-8000-000000000c01",
      "version": 2,
      "type": "intercom",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
      "equipment": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
      "serves": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
      "phoneNumber": "+15550100900",
      "callerId": "+15550100201",
      "commsDeviceId": "dev-51ccae16"
    },
    {
      "id": "cc000000-0000-4000-8000-000000000c03",
      "version": 1,
      "type": "intercom",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "equipment": { "id": "c1000000-0000-4000-8000-000000000012", "className": "SupplementalEquipment" },
      "serves": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
      "phoneNumber": "+15550100900",
      "callerId": "+15550100210",
      "commsDeviceId": "dev-a0b1c2d3"
    }
  ]
}
```

A number nobody holds is an empty list, not an error:

<!-- apx:request GET /v1/comms-points?callerId=%2B15550109999 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792332140, "offset": 0, "pageSize": 100, "total": 0 },
  "data": []
}
```

---

## SCF-04 — The call platform owns the comms points: create, replace, remove

<!-- apx:scenario SCF-04 kind=lifecycle ics=APX-SCF-07,APX-SCF-10,APX-CORE-03 -->

**Given** Lakeside installs an analog dialer at the P2 elevator lobby,
answered by the call center. **When** the call platform creates the
comms point, later changes its caller id with a stale version, then
with the current one, and finally removes it. **Then** 201, 409
`version-conflict`, 200, 204; the change feed carries the tombstone and
`apx.commspoints.changed.v1` is published on each change (§26.4 rule 6,
§26.6). The PARCS never has to hold a phone number.

```http
POST /v1/comms-points
Idempotency-Key: cp-p2-elevator-dialer
```

<!-- apx:request POST /v1/comms-points -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c04",
  "version": 1,
  "type": "analogDialer",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100233",
  "coverage": [ { "languages": ["en"] } ]
}
```

<!-- apx:response 201 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c04",
  "version": 1,
  "type": "analogDialer",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100233",
  "coverage": [ { "languages": ["en"] } ],
  "recordInfo": {
    "creationTime": "2026-10-18T09:12:00Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "svc:callplatform"
  }
}
```

The line is re-provisioned and the caller id changes; a stale screen
sends version 1 after another admin already bumped it:

```http
PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c04
If-Match: "1"
```

<!-- apx:request PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c04 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c04",
  "version": 1,
  "type": "analogDialer",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100234",
  "coverage": [ { "languages": ["en"] } ]
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/version-conflict",
  "title": "Version conflict",
  "status": 409,
  "detail": "Comms point cc000000-0000-4000-8000-000000000c04 is at version 2; If-Match named 1.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c04"
}
```

```http
PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c04
If-Match: "2"
```

<!-- apx:request PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c04 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c04",
  "version": 2,
  "type": "analogDialer",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100234",
  "coverage": [ { "languages": ["en"] } ]
}
```

<!-- apx:response 200 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c04",
  "version": 3,
  "type": "analogDialer",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100234",
  "coverage": [ { "languages": ["en"] } ]
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate CommsPoint at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e04",
  "type": "apx.commspoints.changed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "cc000000-0000-4000-8000-000000000c04", "className": "CommsPoint" },
  "time": "2026-10-18T09:20:31Z",
  "data": {
    "id": "cc000000-0000-4000-8000-000000000c04",
    "version": 3,
    "type": "analogDialer",
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "phoneNumber": "+15550100900",
    "callerId": "+15550100234"
  }
}
```

The dialer is decommissioned (`DELETE`, 204, no body):

<!-- apx:request DELETE /v1/comms-points/cc000000-0000-4000-8000-000000000c04 -->

A console keeping a local copy catches up through the feed and sees
the removal as a tombstone (Part 5 §5.2):

<!-- apx:request GET /v1/comms-points?mode=change&cursor=cp-00000000000000000417 -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792333000, "offset": 0, "pageSize": 100, "total": 0 },
  "data": [],
  "updateMode": "change",
  "cursor": "cp-00000000000000000419",
  "deleted": [
    { "id": "cc000000-0000-4000-8000-000000000c04", "className": "CommsPoint", "deleteTimestamp": "2026-10-18T09:30:00Z" }
  ]
}
```

A comms point with neither a number, a caller id nor a device id has
no way to be matched to a call and is refused:

<!-- apx:request POST /v1/comms-points invalid -->
```json
{
  "type": "qrCode",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" }
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "A comms point needs at least one of phoneNumber, callerId or commsDeviceId.",
  "instance": "/v1/comms-points",
  "errors": [ { "pointer": "/", "message": "anyOf: phoneNumber, callerId, commsDeviceId" } ]
}
```

---

## SCF-05 — Their id, our record: the PARCS lot number, the call platform's account

<!-- apx:scenario SCF-05 kind=happy ics=APX-SCF-09,APX-SCF-08 -->

**Given** every system around the garage keeps its own id for it: the
PARCS calls it `LOT-0042`, the call platform `acct-7f3a9`. **When** a
support tool holding only the PARCS lot number asks APX what it is.
**Then** the place, with the typed external ids each system owns on
the record itself (§26.5), and the place-operations decoration saying
which account the call platform uses for the site and whom to escalate
to, by role only (§26.7). An id nobody registered is 404.

<!-- apx:request POST /v1/identifiers:resolve -->
```json
{
  "system": "https://parcs.gatewise.example",
  "id": "LOT-0042"
}
```

<!-- apx:response 200 -->
```json
{
  "target": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "className": "Place"
}
```

The place record, as the APDS route returns it, carries both
decorations:

<!-- apx:validate ExternalIdentifiers at /extensions/apds-ext:apx:external-ids@1.0 -->
<!-- apx:validate PlaceOperations at /extensions/apds-ext:apx:place-operations@1.0 -->
```json
{
  "id": "b1000000-0000-4000-8000-000000000001",
  "version": 3,
  "type": "place",
  "name": [{ "language": "en", "string": "Lakeside Garage" }],
  "layer": 0,
  "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
  "extensions": {
    "apds-ext:apx:external-ids@1.0": {
      "identifiers": [
        { "system": "https://parcs.gatewise.example", "id": "LOT-0042" },
        { "system": "https://calls.lakeside-oncall.example", "id": "acct-7f3a9" },
        { "system": "https://assets.lakeside-parking.example", "id": "LKS-G-001" }
      ]
    },
    "apds-ext:apx:place-operations@1.0": {
      "commsAccountId": "acct-7f3a9",
      "escalationContacts": [
        { "role": "attendant", "order": 1, "hours": { "recurringTimePeriodOfDay": [ { "startTimeOfPeriod": "06:00", "endTimeOfPeriod": "22:00" } ] } },
        { "role": "siteManager", "order": 2 },
        { "role": "operatorOnCall", "order": 3, "hours": { "recurringTimePeriodOfDay": [ { "startTimeOfPeriod": "22:00", "endTimeOfPeriod": "06:00" } ] } },
        { "role": "security", "order": 4 }
      ]
    }
  }
}
```

The names and numbers behind those roles stay with the call platform;
APX holds no personal contact data. A lane's id in the PARCS resolves
the same way:

<!-- apx:request POST /v1/identifiers:resolve -->
```json
{
  "system": "https://parcs.gatewise.example",
  "id": "60601b08-3f1f-4b9c-9500-c9889e0d1a2b"
}
```

<!-- apx:response 200 -->
```json
{
  "target": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "className": "VehicularAccess"
}
```

<!-- apx:request POST /v1/identifiers:resolve -->
```json
{
  "system": "https://parcs.gatewise.example",
  "id": "LOT-9999"
}
```

<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No record visible to this credential carries id LOT-9999 for system https://parcs.gatewise.example.",
  "instance": "/v1/identifiers:resolve"
}
```

---

## SCF-06 — A look at the lane: live, a still, and last Tuesday

<!-- apx:scenario SCF-06 kind=happy ics=APX-SCF-05 -->

**Given** an agent on a call about exit lane 2, with `apx.cameras:view`.
**When** the console asks for a live view, then a still, then playback
of the minute the parker says they paid. **Then** 201 each with a
single-use link that lives at most five minutes and is bound to the
agent; the password never leaves the site (§26.3 rules 2–3). Every view
is logged against the agent and the call's `correlationId` (§26.3 rule
5).

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{
  "kind": "live",
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000011",
  "interactionId": "interaction-951011"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "cd000000-0000-4000-8000-000000000d01",
  "camera": { "id": "c1000000-0000-4000-8000-000000000007", "className": "SupplementalEquipment" },
  "kind": "live",
  "url": "https://video.lakeside-garage.example/v/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  "protocol": "webrtc",
  "expiresAt": "2026-10-18T14:07:00Z",
  "issuedTo": "agent:j.okafor"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{
  "kind": "snapshot",
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000011"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "cd000000-0000-4000-8000-000000000d02",
  "camera": { "id": "c1000000-0000-4000-8000-000000000007", "className": "SupplementalEquipment" },
  "kind": "snapshot",
  "url": "https://video.lakeside-garage.example/s/9c0d1e2f3a4b5c6d1a2b3c4d5e6f7a8b",
  "protocol": "snapshot",
  "expiresAt": "2026-10-18T14:07:30Z",
  "issuedTo": "agent:j.okafor"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{
  "kind": "playback",
  "from": "2026-10-13T18:13:00Z",
  "to": "2026-10-13T18:15:00Z",
  "agent": "agent:j.okafor",
  "agentType": "human",
  "correlationId": "ca000000-0000-4000-8000-000000000011"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "cd000000-0000-4000-8000-000000000d03",
  "camera": { "id": "c1000000-0000-4000-8000-000000000007", "className": "SupplementalEquipment" },
  "kind": "playback",
  "url": "https://video.lakeside-garage.example/p/3a4b5c6d1a2b3c4d5e6f7a8b9c0d1e2f/index.m3u8",
  "protocol": "hls",
  "expiresAt": "2026-10-18T14:08:00Z",
  "issuedTo": "agent:j.okafor"
}
```

---

## SCF-07 — No picture: outside retention, camera down, no scope

<!-- apx:scenario SCF-07 kind=refusal ics=APX-SCF-05,APX-CORE-07 -->

**Given** the lobby camera keeps 14 days and the exit-lane camera is
offline. **When** the console asks for playback from six weeks ago, a
live view of the offline camera, and a wallboard without
`apx.cameras:view` asks for anything. **Then** 422
`playback-range-unavailable`, 409 `camera-view-unavailable`, 403
`insufficient-scope`. A playback request without a range is 400.

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000013/views -->
```json
{
  "kind": "playback",
  "from": "2026-09-01T20:00:00Z",
  "to": "2026-09-01T20:05:00Z",
  "agent": "agent:j.okafor",
  "correlationId": "ca000000-0000-4000-8000-000000000012"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/playback-range-unavailable",
  "title": "Playback range unavailable",
  "status": 422,
  "detail": "Camera c1000000-0000-4000-8000-000000000013 retains 14 days; recordings before 2026-10-04 are gone.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000013/views"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{
  "kind": "live",
  "agent": "agent:j.okafor",
  "correlationId": "ca000000-0000-4000-8000-000000000012"
}
```

<!-- apx:response 409 -->
```json
{
  "type": "https://apx-standard.org/problems/camera-view-unavailable",
  "title": "Camera view unavailable",
  "status": 409,
  "detail": "Camera c1000000-0000-4000-8000-000000000007 has not reported since 2026-10-18T03:12:00Z.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000007/views"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views invalid -->
```json
{
  "kind": "playback",
  "agent": "agent:j.okafor",
  "correlationId": "ca000000-0000-4000-8000-000000000012"
}
```

<!-- apx:response 400 -->
```json
{
  "type": "https://apx-standard.org/problems/invalid-request",
  "title": "Invalid request",
  "status": 400,
  "detail": "kind playback requires from and to.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000007/views",
  "errors": [ { "pointer": "/from", "message": "required" }, { "pointer": "/to", "message": "required" } ]
}
```

The wallboard, `apx.siteconfig:read` only:

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{
  "kind": "snapshot",
  "agent": "wall:lakeside",
  "correlationId": "ca000000-0000-4000-8000-000000000012"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/cameras/{id}/views requires apx.cameras:view; token holds apx.siteconfig:read.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000007/views"
}
```

A camera at Harbor Deck:

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000097/views -->
```json
{
  "kind": "live",
  "agent": "agent:j.okafor",
  "correlationId": "ca000000-0000-4000-8000-000000000012"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Camera c1000000-0000-4000-8000-000000000097 is at Harbor Deck, outside the token's apx_places grant.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000097/views"
}
```

---

## SCF-08 — A terminal is swapped overnight: the change arrives by event, not by re-reading the garage

<!-- apx:scenario SCF-08 kind=lifecycle ics=APX-SCF-10,APX-SCF-01 -->

**Given** Gatewise replaces the exit-lane terminal and the new unit has
a new serial, MAC and firmware. **When** the implementation updates the
equipment record. **Then** `apx.equipment.changed.v1` carries the
record with its decorations, so the call center's copy of the site is
current before the first call of the morning; a console that was
offline catches up through the change feed (§26.6).

<!-- apx:validate EventEnvelope -->
<!-- apx:validate EquipmentDetail at /data/extensions/apds-ext:apx:equipment-detail@1.0 -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e08",
  "type": "apx.equipment.changed.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "c1000000-0000-4000-8000-000000000003", "className": "SupplementalEquipment" },
  "time": "2026-10-18T03:40:00Z",
  "data": {
    "id": "c1000000-0000-4000-8000-000000000003",
    "version": 6,
    "type": "supplementalEquipment",
    "name": [{ "language": "en", "string": "Exit lane 2 pay-in-lane terminal" }],
    "layer": 3,
    "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
    "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
    "supplementalFacilityIndex": 1,
      "equipmentType": "paymentMachine",
    "extensions": {
      "apds-ext:apx:equipment-detail@1.0": {
        "role": "exitVerifier",
        "manufacturer": "Gatewise",
        "model": "GW-X200",
        "firmwareVersion": "7.1.0",
        "softwareVersion": "LaneOS 2026.3",
        "serialNumber": "GWX200-011207",
        "macAddresses": ["3c7a1e00c4e1", "3c7a1e00c4e2"],
        "installedAt": "2026-10-18",
        "area": "lane",
        "level": "G",
        "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
        "controls": [ { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" } ],
        "serviceProvider": { "organisation": { "id": "a2000000-0000-4000-8000-000000000021", "className": "Organisation" }, "supportReference": "LAKESIDE-EXIT2" }
      }
    }
  }
}
```

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001&mode=change&cursor=eq-00000000000000000880 -->
<!-- apx:response 200 -->
<!-- apx:validate EquipmentDetail at /data/0/extensions/apds-ext:apx:equipment-detail@1.0 -->
```json
{
  "meta": { "referenceInstant": 1792340000, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c1000000-0000-4000-8000-000000000003",
      "version": 6,
      "type": "supplementalEquipment",
      "name": [{ "language": "en", "string": "Exit lane 2 pay-in-lane terminal" }],
      "layer": 3,
      "parentId": { "id": "b2000000-0000-4000-8000-000000000002", "version": 2, "className": "VehicularAccess" },
      "hierarchyElementRecord": { "creationTime": "2024-03-01T10:00:00Z" },
      "supplementalFacilityIndex": 1,
      "equipmentType": "paymentMachine",
      "extensions": {
        "apds-ext:apx:equipment-detail@1.0": {
          "role": "exitVerifier",
          "manufacturer": "Gatewise",
          "model": "GW-X200",
          "firmwareVersion": "7.1.0",
          "softwareVersion": "LaneOS 2026.3",
          "serialNumber": "GWX200-011207",
          "macAddresses": ["3c7a1e00c4e1", "3c7a1e00c4e2"],
          "installedAt": "2026-10-18",
          "area": "lane",
          "level": "G",
          "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
          "controls": [ { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" } ]
        }
      }
    }
  ],
  "updateMode": "change",
  "cursor": "eq-00000000000000000881",
  "deleted": []
}
```

---

## SCF-09 — After hours at the lobby door: a paid ticket, a permit, an expired permit

<!-- apx:scenario SCF-09 kind=happy ics=APX-SCF-06,APX-SCF-07,APX-RES-11,APX-CTL-06 -->

**Given** the garage is locked at 23:30 and a parker must get back to
their car through the lobby door. **When** (a) a transient parker who
paid at the pay-on-foot has no card and presses the door's intercom,
(b) a permit holder presents their card at the reader, and (c) a
permit holder whose permit expired yesterday presents theirs. **Then**
(a) the comms point resolves to the door it serves, the agent confirms
the ticket is paid and opens the door with `vendGate` targeting the
door, exactly as a gate (§26.8); (b) the reader opens the door and the
entry is recorded against the door like a lane access; (c) the reader
refuses, the parker presses the intercom, and the context shows the
denial and the gated action for the agent.

(a) The call platform matches the intercom's device id and resolves the
context (Part 17 §17.1 as amended by §26.4):

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-951031",
  "correlationId": "ca000000-0000-4000-8000-000000000031",
  "channel": "intercom",
  "commsDeviceId": "dev-a0b1c2d3",
  "ticketNumber": "T-61120"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000031",
  "version": 1,
  "computedAt": "2026-10-18T23:31:05Z",
  "status": "full",
  "interactionId": "interaction-951031",
  "correlationId": "ca000000-0000-4000-8000-000000000031",
  "issue": { "code": "authorizedVisitor", "display": "After-hours pedestrian access" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "session": { "id": "c4000000-0000-4000-8000-000000000120", "className": "Session" },
  "payments": [
    {
      "id": "e8000000-0000-4000-8000-000000000231",
      "transactionID": "PARIS-20261018-00912",
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "dateCollected": "2026-10-18T23:27:40Z",
      "amount": { "currencyType": "USD", "currencyValue": 14.00 },
      "meansOfPayment": "paymentCreditCard",
      "paymentStatus": "approved",
      "ticketNumber": "T-61120",
      "cardLast4": "2210"
    }
  ],
  "devices": [
    {
      "device": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
      "deviceState": "available",
      "lastCommunication": "2026-10-18T23:31:00Z"
    }
  ],
  "allowedActions": [
    {
      "action": "vendGate",
      "display": "Open the lobby door",
      "target": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
      "allowed": true,
      "requiresApproval": false,
      "execution": { "type": "control", "command": "vendGate" }
    }
  ],
  "recommendedAction": { "action": "vendGate", "reason": "Ticket T-61120 paid 3 minutes ago; parker is at the lobby door." }
}
```

```http
POST /v1/commands
Idempotency-Key: cc-9031-door
```

<!-- apx:request POST /v1/commands -->
```json
{
  "commandType": "vendGate",
  "target": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "after-hours pedestrian access; ticket T-61120 paid",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000031", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000031",
  "expiryTime": "2026-10-18T23:33:00Z"
}
```

<!-- apx:response 202 -->
```json
{
  "id": "d1000000-0000-4000-8000-000000000331",
  "version": 2,
  "commandType": "vendGate",
  "target": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
  "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
  "agent": "agent:j.okafor",
  "agentType": "human",
  "reason": "after-hours pedestrian access; ticket T-61120 paid",
  "resolutionContext": { "id": "e5000000-0000-4000-8000-000000000031", "className": "ResolutionContext" },
  "correlationId": "ca000000-0000-4000-8000-000000000031",
  "expiryTime": "2026-10-18T23:33:00Z",
  "priority": "normal",
  "status": "accepted",
  "confirmationLevel": "accepted",
  "statusHistory": [
    { "state": "received", "time": "2026-10-18T23:31:40Z", "actor": "apx-operator" },
    { "state": "accepted", "time": "2026-10-18T23:31:40Z", "actor": "lakeside-parcs" }
  ]
}
```

(b) A permit holder's card at the reader opens the door; nothing is
asked of an agent. The implementation records the entry against the
door the way it records a lane access, with the reader as the device
and the door as the barrier that opened:

<!-- apx:validate EventEnvelope -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e32",
  "type": "apx.control.command.status.v1",
  "source": "https://api.lakeside-garage.example/v1",
  "subject": { "id": "d1000000-0000-4000-8000-000000000332", "className": "Command" },
  "time": "2026-10-18T23:40:12Z",
  "data": {
    "id": "d1000000-0000-4000-8000-000000000332",
    "version": 3,
    "commandType": "vendGate",
    "target": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
    "requestedBy": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "reason": "credential accepted at reader c1000000-0000-4000-8000-000000000011",
    "status": "succeeded",
    "confirmationLevel": "physicallyConfirmed",
    "statusHistory": [
      { "state": "received", "time": "2026-10-18T23:40:10Z", "actor": "reader-c1000000-0011" },
      { "state": "succeeded", "time": "2026-10-18T23:40:12Z", "actor": "door-c1000000-0010", "detail": "door released; closed again at 23:40:19" }
    ]
  }
}
```

(c) The expired permit is refused at the reader; the parker presses
the intercom. The context carries the denial and gates the door behind
the on-call supervisor:

<!-- apx:request POST /v1/resolution/contexts -->
```json
{
  "interactionId": "interaction-951033",
  "correlationId": "ca000000-0000-4000-8000-000000000033",
  "channel": "intercom",
  "commsDeviceId": "dev-a0b1c2d3",
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" }
}
```

<!-- apx:response 201 -->
```json
{
  "id": "e5000000-0000-4000-8000-000000000033",
  "version": 1,
  "computedAt": "2026-10-18T23:52:10Z",
  "status": "full",
  "interactionId": "interaction-951033",
  "correlationId": "ca000000-0000-4000-8000-000000000033",
  "issue": { "code": "credentialDisabled", "display": "Permit expired" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "placeDisplay": "Lakeside Garage",
  "holder": { "id": "a3000000-0000-4000-8000-000000000002", "className": "RightHolder" },
  "holderDisplay": "M. Rivera",
  "credential": { "id": "c3000000-0000-4000-8000-000000000002", "className": "Credential" },
  "accessDecision": {
    "status": "denied",
    "reasonCode": "permitExpired",
    "reasonDisplay": "Monthly permit ended 2026-10-17.",
    "occurredAt": "2026-10-18T23:51:58Z"
  },
  "allowedActions": [
    {
      "action": "vendGate",
      "display": "Open the lobby door",
      "target": { "id": "c1000000-0000-4000-8000-000000000010", "className": "SupplementalEquipment" },
      "allowed": true,
      "requiresApproval": true,
      "approvalRole": "supervisor",
      "reason": { "code": "permitExpired", "display": "Permit expired; after-hours pedestrian access needs a supervisor." },
      "execution": { "type": "control", "command": "vendGate" }
    }
  ]
}
```

---

## SCF-10 — Scopes, grants, and no secrets in any read

<!-- apx:scenario SCF-10 kind=security ics=APX-SCF-11,APX-SCF-01,APX-SCF-06,APX-CORE-07,APX-CORE-10 -->

**Given** a read-only wallboard (`apx.siteconfig:read`), the call
platform's client (`apx.siteconfig:manage`), and the PARCS vendor's own
monitoring client. **When** the wallboard tries to create a comms
point, the call platform names Harbor Deck, and anyone reads a camera.
**Then** 403 `insufficient-scope`, 403 `insufficient-grant`, and the
camera read carries a `credentialRef` label at most, never a stream
address with a password in it (§26.3 rule 3, Part 9 §9.7). A MAC
address is a hardware identity and is served; an IP address is not a
member at all.

<!-- apx:request POST /v1/comms-points -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c05",
  "version": 1,
  "type": "postedNumber",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100043"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/comms-points requires apx.siteconfig:manage; token holds apx.siteconfig:read.",
  "instance": "/v1/comms-points"
}
```

<!-- apx:request POST /v1/comms-points -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c06",
  "version": 1,
  "type": "intercom",
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000003", "className": "VehicularAccess" },
  "callerId": "+15550100301"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is outside the token's apx_places grant.",
  "instance": "/v1/comms-points"
}
```

A legacy camera that cannot sit behind the video gateway is named by a
vault label; the stream address and its password are exchanged once at
onboarding, outside APX:

<!-- apx:request GET /v1/equipment/c1000000-0000-4000-8000-000000000014 -->
<!-- apx:response 200 -->
<!-- apx:validate CameraDetail at /extensions/apds-ext:apx:camera@1.0 -->
```json
{
  "id": "c1000000-0000-4000-8000-000000000014",
  "version": 1,
  "type": "supplementalEquipment",
  "name": [{ "language": "en", "string": "P2 ramp camera" }],
  "layer": 2,
  "parentId": { "id": "b1000000-0000-4000-8000-000000000001", "version": 3, "className": "Place" },
  "hierarchyElementRecord": { "creationTime": "2021-11-02T09:00:00Z" },
  "supplementalFacilityIndex": 1,
      "equipmentType": "other",
  "extensions": {
    "apds-ext:apx:equipment-detail@1.0": {
      "role": "camera",
      "manufacturer": "Viewline",
      "model": "VL-A1",
      "firmwareVersion": "2.0.9",
      "serialNumber": "VLA1-100233",
      "macAddresses": ["00e0ac0a1b2c"],
      "area": "ramp",
      "level": "P2"
    },
    "apds-ext:apx:camera@1.0": {
      "mounting": "wall",
      "view": ["areaOverview"],
      "faces": "inward",
      "recorder": { "equipment": { "id": "c1000000-0000-4000-8000-000000000030", "className": "SupplementalEquipment" }, "channel": "12" },
      "streams": [ { "protocol": "rtsp", "transport": "tcp", "resolution": "1280x720" } ],
      "retentionDays": 30,
      "credentialRef": "site-0042/cam-p2-ramp"
    }
  }
}
```

The wallboard with no `apx.siteconfig:read` at all:

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "GET /v1/equipment requires apx.siteconfig:read; token holds apx.control:read.",
  "instance": "/v1/equipment"
}
```

---

## SCF-11 — Throttled, and expired tokens: every route answers the same way

<!-- apx:scenario SCF-11 kind=edge ics=APX-CORE-05,APX-CORE-06 -->

**Given** a console in a retry storm, then the same console after its
token expired. **When** it hits each route. **Then** 429 `rate-limited`
with `Retry-After`, then 401 `unauthenticated`. An equipment id nobody
has is 404.

<!-- apx:request GET /v1/equipment/c1000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No equipment c1000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/equipment/c1000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request GET /v1/comms-points/cc000000-0000-4000-8000-0000000000ff -->
<!-- apx:response 404 -->
```json
{
  "type": "https://apx-standard.org/problems/target-not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No comms point cc000000-0000-4000-8000-0000000000ff visible to this credential.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-0000000000ff"
}
```

<!-- apx:request GET /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
<!-- apx:response 200 -->
<!-- apx:validate CommsPoint -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c01",
  "version": 2,
  "type": "intercom",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "equipment": { "id": "c1000000-0000-4000-8000-000000000005", "className": "SupplementalEquipment" },
  "serves": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "phoneNumber": "+15550100900",
  "callerId": "+15550100201",
  "commsDeviceId": "dev-51ccae16"
}
```

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/equipment"
}
```

<!-- apx:request GET /v1/equipment/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/equipment/c1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/comms-points?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/comms-points"
}
```

<!-- apx:request GET /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request POST /v1/comms-points -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c07",
  "version": 1,
  "type": "postedNumber",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100044"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/comms-points"
}
```

<!-- apx:request PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c01",
  "version": 2,
  "type": "intercom",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "callerId": "+15550100201"
}
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request DELETE /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request POST /v1/identifiers:resolve -->
```json
{ "system": "https://parcs.gatewise.example", "id": "LOT-0042" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/identifiers:resolve"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{ "kind": "live", "agent": "agent:j.okafor", "correlationId": "ca000000-0000-4000-8000-000000000041" }
```

<!-- apx:response 429 -->
```json
{
  "type": "https://apx-standard.org/problems/rate-limited",
  "title": "Rate limited",
  "status": 429,
  "detail": "requestsPerMinute 300 exceeded for this credential; retry after 2 seconds.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000007/views"
}
```

After the token expires:

<!-- apx:request GET /v1/equipment?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/equipment"
}
```

<!-- apx:request GET /v1/equipment/c1000000-0000-4000-8000-000000000003 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/equipment/c1000000-0000-4000-8000-000000000003"
}
```

<!-- apx:request GET /v1/comms-points?place=b1000000-0000-4000-8000-000000000001 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/comms-points"
}
```

<!-- apx:request GET /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request POST /v1/comms-points -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c07",
  "version": 1,
  "type": "postedNumber",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "phoneNumber": "+15550100044"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/comms-points"
}
```

<!-- apx:request PUT /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
```json
{
  "id": "cc000000-0000-4000-8000-000000000c01",
  "version": 2,
  "type": "intercom",
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "lane": { "id": "b2000000-0000-4000-8000-000000000002", "className": "VehicularAccess" },
  "callerId": "+15550100201"
}
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request DELETE /v1/comms-points/cc000000-0000-4000-8000-000000000c01 -->
<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/comms-points/cc000000-0000-4000-8000-000000000c01"
}
```

<!-- apx:request POST /v1/identifiers:resolve -->
```json
{ "system": "https://parcs.gatewise.example", "id": "LOT-0042" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/identifiers:resolve"
}
```

<!-- apx:request POST /v1/cameras/c1000000-0000-4000-8000-000000000007/views -->
```json
{ "kind": "live", "agent": "agent:j.okafor", "correlationId": "ca000000-0000-4000-8000-000000000041" }
```

<!-- apx:response 401 -->
```json
{
  "type": "https://apx-standard.org/problems/unauthenticated",
  "title": "Missing or invalid access token",
  "status": 401,
  "detail": "Access token expired at 2026-10-18T23:00:00Z.",
  "instance": "/v1/cameras/c1000000-0000-4000-8000-000000000007/views"
}
```

---

## SCF-12 — "Payment not found": the exit sign's message, recorded by the edge that showed it

<!-- apx:scenario SCF-12 kind=lifecycle ics=APX-SCF-12,APX-SCF-13 -->

**Given** the exit-lane sign at Lakeside lane 2 (`c1…0040`, role
`laneDisplay`) is driven by the edge controller on site, which decides
from its own copy of the rights. No APX command is involved. The edge
holds `edge-controller` (`apx.displays:record`, same grant). **When**
read `f3…0140` of a car with no payment arrives at 14:03 and the sign
shows the unpaid message; the edge records it, and retries the same POST
after a network blip; the operator's analyst later lists the day's
unpaid exits; and an appeal reads the record. **Then** 201, 200 on the
replay (same record), the list and the read return it, and
`apx.displays.shown.v1` is published once (Part 26 §26.9 rules 1–4, 6–7).
Nothing in the record holds the message text or the plate.

```http
POST /v1/display-records
Authorization: Bearer <edge-controller>
Idempotency-Key: sign-c1-0040-2026-10-21T14:03:12Z
```

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000012",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "messageKind": "transientExitUnpaid",
  "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
  "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
  "shownTime": "2026-10-21T14:03:12Z",
  "contentHash": "sha256:9f2c1e0b7a4d",
  "wordingVersion": "exit-2026-10",
  "acknowledgedBy": "player"
}
```

<!-- apx:response 201 -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000012",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "messageKind": "transientExitUnpaid",
  "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
  "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
  "shownTime": "2026-10-21T14:03:12Z",
  "contentHash": "sha256:9f2c1e0b7a4d",
  "wordingVersion": "exit-2026-10",
  "acknowledgedBy": "player",
  "recordInfo": {
    "creationTime": "2026-10-21T14:03:13Z",
    "creator": { "id": "a1000000-0000-4000-8000-000000000001", "className": "Organisation" },
    "creationUser": "svc:edge-lakeside"
  }
}
```

The same POST again, after the edge lost the first answer:

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000012",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "messageKind": "transientExitUnpaid",
  "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
  "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
  "shownTime": "2026-10-21T14:03:12Z",
  "contentHash": "sha256:9f2c1e0b7a4d",
  "wordingVersion": "exit-2026-10",
  "acknowledgedBy": "player"
}
```

<!-- apx:response 200 -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000012",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "messageKind": "transientExitUnpaid",
  "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
  "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
  "shownTime": "2026-10-21T14:03:12Z",
  "contentHash": "sha256:9f2c1e0b7a4d",
  "wordingVersion": "exit-2026-10",
  "acknowledgedBy": "player"
}
```

<!-- apx:validate EventEnvelope -->
<!-- apx:validate DisplayRecord at /data -->
```json
{
  "id": "e9000000-0000-4000-8000-000000000e12",
  "type": "apx.displays.shown.v1",
  "source": "https://api.lakeside-garage.example",
  "subject": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "time": "2026-10-21T14:03:13Z",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "id": "c5000000-0000-4000-8000-000000000012",
    "version": 1,
    "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
    "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
    "messageKind": "transientExitUnpaid",
    "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
    "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
    "shownTime": "2026-10-21T14:03:12Z",
    "contentHash": "sha256:9f2c1e0b7a4d",
    "wordingVersion": "exit-2026-10",
    "acknowledgedBy": "player"
  }
}
```

The analyst counts the day's unpaid exits at Lakeside:

<!-- apx:request GET /v1/display-records?place=b1000000-0000-4000-8000-000000000001&messageKind=transientExitUnpaid&since=2026-10-21T00:00:00Z&until=2026-10-22T00:00:00Z -->
<!-- apx:response 200 -->
```json
{
  "meta": { "referenceInstant": 1792627200, "offset": 0, "pageSize": 100, "total": 1 },
  "data": [
    {
      "id": "c5000000-0000-4000-8000-000000000012",
      "version": 1,
      "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
      "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
      "messageKind": "transientExitUnpaid",
      "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
      "shownTime": "2026-10-21T14:03:12Z",
      "contentHash": "sha256:9f2c1e0b7a4d",
      "wordingVersion": "exit-2026-10",
      "acknowledgedBy": "player"
    }
  ]
}
```

An appeal of the stay finds what the sign told the driver:

<!-- apx:request GET /v1/display-records/c5000000-0000-4000-8000-000000000012 -->
<!-- apx:response 200 -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000012",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "place": { "id": "b1000000-0000-4000-8000-000000000001", "className": "Place" },
  "messageKind": "transientExitUnpaid",
  "observation": { "id": "f3000000-0000-4000-8000-000000000140", "className": "ObservationElement" },
  "session": { "id": "c4000000-0000-4000-8000-000000000077", "className": "Session" },
  "shownTime": "2026-10-21T14:03:12Z",
  "contentHash": "sha256:9f2c1e0b7a4d",
  "wordingVersion": "exit-2026-10",
  "acknowledgedBy": "player"
}
```

---

## SCF-13 — Display records refused: not a sign, the wrong place, a command that disagrees, no scope

<!-- apx:scenario SCF-13 kind=refusal ics=APX-SCF-12,APX-SCF-13 -->

**Given** the edge of SCF-12. **When** it names the lane's barrier
`c1…0002` as if it were a sign; names the sign but claims Harbor Deck as
the place; names the `displayMessage` command `cb…0031`, whose result
says the sign showed different content at 14:20:05; and the city
platform (`apx.siteconfig:read` only) tries to write a record; and the
city then lists records for Harbor Deck, outside its grant. **Then** 422
`reference-unknown`, 422 `request-unprocessable` twice, 403
`insufficient-scope`, and 403 `insufficient-grant` (Part 26 §26.9 rules
1, 2, 5, 6).

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000013",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000002", "className": "SupplementalEquipment" },
  "messageKind": "idle",
  "shownTime": "2026-10-21T14:10:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/reference-unknown",
  "title": "Reference unknown",
  "status": 422,
  "detail": "display c1000000-0000-4000-8000-000000000002 is a gate, not a sign (role laneDisplay or countSign).",
  "instance": "/v1/display-records"
}
```

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000014",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "place": { "id": "b1000000-0000-4000-8000-000000000002", "className": "Place" },
  "messageKind": "idle",
  "shownTime": "2026-10-21T14:10:00Z"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request unprocessable",
  "status": 422,
  "detail": "place b1000000-0000-4000-8000-000000000002 is not the place of display c1000000-0000-4000-8000-000000000040 (b1000000-0000-4000-8000-000000000001).",
  "instance": "/v1/display-records"
}
```

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000015",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "messageKind": "entranceRefused",
  "command": { "id": "cb000000-0000-4000-8000-000000000031", "className": "Command" },
  "shownTime": "2026-10-21T14:20:00Z",
  "contentHash": "sha256:1b7e42aa90c3"
}
```

<!-- apx:response 422 -->
```json
{
  "type": "https://apx-standard.org/problems/request-unprocessable",
  "title": "Request unprocessable",
  "status": 422,
  "detail": "Command cb000000-0000-4000-8000-000000000031 recorded shownTime 2026-10-21T14:20:05Z and contentHash sha256:77d0c5e1f2a8; the record disagrees.",
  "instance": "/v1/display-records"
}
```

```http
POST /v1/display-records
Authorization: Bearer <city-platform>
```

<!-- apx:request POST /v1/display-records -->
```json
{
  "id": "c5000000-0000-4000-8000-000000000016",
  "version": 1,
  "display": { "id": "c1000000-0000-4000-8000-000000000040", "className": "SupplementalEquipment" },
  "messageKind": "idle",
  "shownTime": "2026-10-21T14:30:00Z"
}
```

<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "POST /v1/display-records requires apx.displays:record.",
  "instance": "/v1/display-records"
}
```

<!-- apx:request GET /v1/display-records?place=b1000000-0000-4000-8000-000000000002 -->
<!-- apx:response 403 -->
```json
{
  "type": "https://apx-standard.org/problems/insufficient-grant",
  "title": "Insufficient grant",
  "status": 403,
  "detail": "Place b1000000-0000-4000-8000-000000000002 is outside this token's apx_places.",
  "instance": "/v1/display-records"
}
```
