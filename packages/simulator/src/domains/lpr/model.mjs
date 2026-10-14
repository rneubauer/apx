/**
 * apx-lpr model: the LprRead / PlateCandidate projections of an APDS
 * Observation (Part 13 §13.3, §13.3a; Part 17 §17.5), the joins to the
 * shared `sessions` and `assignedRights` collections, the lane camera
 * configuration (§13.3a(5)), the pay-by-plate pairing of entry and exit
 * reads into Sessions, and the §13.3b retention sweep.
 *
 * Session hints read and written: `_plate`, `_ticketNumber`,
 * `_entryObservation`, `_exitObservation`, `_observations` (every other
 * read linked to the visit), `_entryLane`, `_exitLane`, `_imageLink`.
 * Observation hint written: `_purgedImagery`.
 */
import { parseDuration } from '../../kernel/clock.mjs';
import { refOf } from '../common.mjs';

export const READ_KEY = 'apds-ext:apx:lpr-read@1.0';
export const CAMERAS_KEY = 'apds-ext:apx:lane-cameras@1.0';
export const RESERVATION_KEY = 'apds-ext:apx:reservation@1.0';
const MAX_RESERVATIONS = 10;

/** Plate strings an engine confuses (5/S, 0/O, 1/I, 8/B) normalise to one key. */
export const plateKey = (p) =>
  String(p ?? '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .replace(/5/g, 'S')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/8/g, 'B');

const timeOf = (o) => o.observationStartTime ?? o.creationDateTime;
const msOf = (o) => Date.parse(timeOf(o) ?? '') || 0;
const newestFirst = (a, b) => msOf(b) - msOf(a) || String(b.id).localeCompare(String(a.id));

/** `f2…NNNN` → `f1…NNNN`: the visit a pay-by-plate pairing opens is named after its entry read. */
export const derivedId = (id, prefix) => (typeof id === 'string' && /^[0-9a-f]{2}/.test(id) ? `${prefix}${id.slice(2)}` : undefined);

export function createModel(sim) {
  const observations = () => sim.store.collection('observations');
  const sessions = () => sim.store.collection('sessions');
  const places = () => sim.store.collection('places');
  const cfg = () => sim.world.lpr ?? {};
  const worldLanes = () => sim.world.lanes ?? [];
  const isWorldLane = (id) => worldLanes().some((l) => l.id === id);

  // ---------- reads ----------

  const isRead = (o) => !!o && typeof o.observedCredentialId === 'string' && (o.type === 'licensePlate' || !!o.extensions?.[READ_KEY]);
  const reads = () => observations().find(isRead);
  const detailOf = (o) => o?.extensions?.[READ_KEY];
  const groupOf = (o) => detailOf(o)?.captureGroup;

  function laneOf(o) {
    if (o._lane) return o._lane;
    const at = o.elementIds?.id;
    const node = at ? sim.hierarchy.get(at) : null;
    return node && (node.kind === 'lane' || isWorldLane(at)) ? at : undefined;
  }

  function placeOf(o) {
    const lane = laneOf(o);
    if (lane) return sim.hierarchy.placeOf(sim.hierarchy.get(lane)?.parentId ?? lane)?.id ?? o._place;
    return o._place ?? sim.hierarchy.placeOf(o.elementIds?.id)?.id;
  }

  /** The node a grant check runs against: the lane when there is one, else the place. */
  const bindingOf = (o) => laneOf(o) ?? placeOf(o);
  const covered = (principal, id) => !!id && principal.hasGrant && sim.hierarchy.covers(principal.places, id);

  // ---------- session joins ----------

  const linked = (s) => new Set([s._entryObservation, s._exitObservation, ...(s._observations ?? [])].filter(Boolean));

  function sessionOf(o) {
    const all = sessions().all();
    const direct = all.find((s) => linked(s).has(o.id));
    if (direct) return direct;
    const group = groupOf(o);
    if (!group) return null;
    return all.find((s) => [...linked(s)].some((id) => groupOf(observations().get(id)) === group)) ?? null;
  }

  const readsOfSession = (s) => reads().filter((o) => sessionOf(o)?.id === s.id);

  /** A read matches a plate by its own string, or by the plate its visit now carries (a correction, §17.5). */
  const plateMatches = (o, plate) => o.observedCredentialId === plate || sessionOf(o)?._plate === plate;

  // ---------- reservations (recentReservations) ----------

  function reservationsFor(plate) {
    const credsOf = (r) => r.rightHolder?.credentials ?? [];
    return sim.store
      .collection('assignedRights')
      .find((r) => r.extensions?.[RESERVATION_KEY] && (r._plate === plate || credsOf(r).some((c) => c?.identifier?.id === plate)))
      .map((r) => {
        const ext = r.extensions[RESERVATION_KEY];
        const use = r.plannedUses?.[0] ?? {};
        const start = ext.plannedStart ?? use.startTime;
        const end = ext.plannedEnd ?? use.endTime;
        return {
          reservation: refOf(r.id, 'AssignedRight'),
          reservationState: ext.reservationState,
          ...(start ? { plannedStart: start } : {}),
          ...(end ? { plannedEnd: end } : {}),
          ...(ext.noShowAfter ? { noShowAfter: ext.noShowAfter } : {}),
        };
      })
      .sort((a, b) => String(b.plannedStart ?? '').localeCompare(String(a.plannedStart ?? '')))
      .slice(0, MAX_RESERVATIONS);
  }

  // ---------- projections ----------

  const plateImageOf = (o) => (o.images ?? []).find((i) => i.imageType === 'plate')?.imageLink ?? (o.images ?? [])[0]?.imageLink;
  const vehicleImageOf = (o) => (o.images ?? []).find((i) => i.imageType && i.imageType !== 'plate')?.imageLink;
  const cameraOf = (o) => (o.images ?? []).find((i) => i.cameraID)?.cameraID;

  function otherExtensions(o) {
    const rest = Object.fromEntries(Object.entries(o.extensions ?? {}).filter(([k]) => k !== READ_KEY));
    return Object.keys(rest).length ? rest : undefined;
  }

  /** LprRead (Part 13 §13.3). */
  function projectRead(o) {
    const lane = laneOf(o);
    const camera = cameraOf(o);
    const detail = detailOf(o);
    const session = sessionOf(o);
    const image = plateImageOf(o);
    const ext = otherExtensions(o);
    const confidence = o.confidence?.overallConfidence;
    return {
      plate: o.observedCredentialId,
      place: refOf(placeOf(o), 'Place'),
      ...(lane ? { lane: refOf(lane, 'VehicularAccess') } : {}),
      ...(camera ? { cameraId: camera } : {}),
      ...(ext ? { extensions: ext } : {}),
      ...(typeof confidence === 'number' ? { confidence } : {}),
      ...(detail ? { detail } : {}),
      laneTravel: 'unknown',
      observation: refOf(o.id, 'Observation'),
      ...(timeOf(o) ? { observationDateTime: timeOf(o) } : {}),
      ...(session?._ticketNumber ? { ticketNumber: session._ticketNumber } : {}),
      ...(session ? { session: refOf(session.id, 'Session') } : {}),
      ...(image ? { imageLink: image } : {}),
      ...(o._purgedImagery ? { purgedImagery: true } : {}),
      recentReservations: reservationsFor(o.observedCredentialId),
    };
  }

  /** PlateCandidate rows of one read: the read, then each of the engine's alternate strings (§17.5). */
  function candidatesOf(o) {
    const detail = detailOf(o);
    const vai = o.vehicleAncillaryIdentification ?? {};
    const country = vai.country ?? detail?.country?.value;
    const state = vai.stateProvince ?? detail?.stateProvince?.value;
    const lane = laneOf(o);
    const plateImage = plateImageOf(o);
    const vehicleImage = vehicleImageOf(o);
    const ext = otherExtensions(o);
    const common = {
      observationDateTime: timeOf(o),
      ...(lane ? { lane: refOf(lane, 'VehicularAccess') } : {}),
      observation: refOf(o.id, 'Observation'),
      ...(plateImage ? { plateImage } : {}),
      ...(o._purgedImagery ? { purgedImagery: true } : {}),
    };
    const main = {
      plate: o.observedCredentialId,
      ...(country ? { country } : {}),
      ...(state ? { stateProvince: state } : {}),
      confidence: o.confidence?.overallConfidence ?? detail?.plate?.confidence ?? 0,
      ...(detail ? { detail } : {}),
      ...common,
      ...(vehicleImage ? { vehicleImage } : {}),
      ...(ext ? { extensions: ext } : {}),
    };
    const alternates = (detail?.alternateReads ?? []).map((alt) => ({
      plate: alt.plate,
      ...(country ? { country } : {}),
      ...(alt.stateProvince ?? state ? { stateProvince: alt.stateProvince ?? state } : {}),
      confidence: alt.confidence ?? 0,
      ...common,
    }));
    return [main, ...alternates];
  }

  /** Every plate string tied to a visit: its own, its reads', and their alternates. */
  function platesOfVisit(s, visitReads) {
    const keys = new Set();
    if (s._plate) keys.add(plateKey(s._plate));
    for (const c of s.identifiedCredentials ?? []) if (c?.type === 'licensePlate' && c.identifier?.id) keys.add(plateKey(c.identifier.id));
    for (const o of visitReads) {
      keys.add(plateKey(o.observedCredentialId));
      for (const alt of detailOf(o)?.alternateReads ?? []) keys.add(plateKey(alt.plate));
    }
    return keys;
  }

  /** The reads a correction for a visit should consider: its own, and unpaired reads of a look-alike plate at its place since it began. */
  function candidateReadsOfSession(s) {
    const own = readsOfSession(s);
    const keys = platesOfVisit(s, own);
    const since = Date.parse(s.actualStart ?? '') || 0;
    const nearby = reads().filter((o) => {
      if (own.includes(o) || sessionOf(o)) return false;
      const p = placeOf(o);
      if (!p || !(p === s._place || sim.hierarchy.within(p, s._place))) return false;
      return msOf(o) >= since && keys.has(plateKey(o.observedCredentialId));
    });
    return [...own, ...nearby];
  }

  // ---------- lane cameras (§13.3a(5)) ----------

  function camerasOfLane(laneId) {
    const rec = places().get(laneId);
    const ext = rec?.extensions?.[CAMERAS_KEY] ?? worldLanes().find((l) => l.id === laneId)?.extensions?.[CAMERAS_KEY];
    return ext?.cameras ?? [];
  }

  const lanesOfPlace = (placeId) => sim.hierarchy.all('lane').filter((n) => sim.hierarchy.placeOf(n.parentId ?? n.id)?.id === placeId).map((n) => n.id);

  /** The lane a camera is configured on: its lane-cameras entry, else a device named after it. */
  function laneOfCamera(cameraId) {
    for (const l of sim.hierarchy.all('lane')) if (camerasOfLane(l.id).some((c) => c.cameraId === cameraId)) return l.id;
    return sim.hierarchy.all('device').find((d) => d.name === cameraId || d.cameraId === cameraId)?.laneId;
  }

  /** The other lane of the same place that already claims one of `cameraIds`, or null. */
  function cameraClash(laneId, placeId, cameraIds) {
    const seen = new Set();
    for (const id of cameraIds) {
      if (seen.has(id)) return { cameraId: id, lane: laneId };
      seen.add(id);
    }
    for (const other of lanesOfPlace(placeId)) {
      if (other === laneId) continue;
      const hit = camerasOfLane(other).find((c) => cameraIds.includes(c.cameraId));
      if (hit) return { cameraId: hit.cameraId, lane: other };
    }
    return null;
  }

  // ---------- pay-by-plate pairing ----------

  /** world.lpr.pairing: { places: [ids] } — gateless pay-by-plate places whose entry and exit reads make Sessions. */
  const pairingAt = (placeId) => !!placeId && (cfg().pairing?.places ?? []).some((p) => p === placeId || sim.hierarchy.within(placeId, p));

  const principalFor = (placeId) => ({ org: { id: sim.hierarchy.operatorOf(placeId) ?? sim.world.organisation?.id, className: 'Organisation' } });

  const plateCredential = (plate) => ({ type: 'licensePlate', credentialAssignedType: 'other', identifier: { id: plate, className: 'Credential' } });

  function link(s, o) {
    if (linked(s).has(o.id)) return s;
    return sessions().update(s.id, (x) => ({ ...x, _observations: [...(x._observations ?? []), o.id] }), { bump: false });
  }

  function openVisit(o, placeId) {
    const id = derivedId(o.id, 'f1');
    const free = id && !sessions().has(id);
    const start = timeOf(o);
    const node = sim.hierarchy.get(placeId);
    const assignedRight = cfg().pairing?.assignedRight ?? derivedId(o.id, 'e2');
    const record = {
      ...(free ? { id } : {}),
      actualStart: start,
      hierarchyElement: { id: placeId, version: node?.version ?? 1, className: 'Place' },
      identifiedCredentials: [plateCredential(o.observedCredentialId)],
      segments: [
        {
          id: derivedId(o.id, 'f3') ?? `${o.id}-segment`,
          version: 1,
          actualStart: start,
          assignedRight: { id: assignedRight, version: 1, className: 'AssignedRight' },
          validationType: ['licensePlate'],
        },
      ],
      ...(o.vehicleAncillaryIdentification ? { identifiedVehicle: o.vehicleAncillaryIdentification } : {}),
    };
    // The data engine keeps no `_` members from a create body; the hints go on afterwards.
    const created = sim.data.create('sessions', record, principalFor(placeId));
    const hints = { _plate: o.observedCredentialId, _entryObservation: o.id, _entryLane: laneOf(o), ...(plateImageOf(o) ? { _imageLink: plateImageOf(o) } : {}) };
    return sessions().update(created.id, (x) => ({ ...x, ...hints }), { bump: false });
  }

  function closeVisit(s, o, placeId) {
    const end = timeOf(o);
    const segments = (s.segments ?? []).map((g, i, all) => (i === all.length - 1 && !g.actualEnd ? { ...g, actualEnd: end } : g));
    return sim.data.change('sessions', s.id, { actualEnd: end, segments, _exitObservation: o.id, _exitLane: laneOf(o) }, principalFor(placeId));
  }

  /**
   * Pair a read into a visit at a pay-by-plate place: a read of a capture
   * group already behind a visit joins it; an `entry` opens one; an `exit`
   * closes the open visit for the plate, at the capture time (§13.3a(8)).
   * `unknown` (or no decoration) pairs nothing: the server infers nothing.
   */
  function pair(o) {
    const placeId = placeOf(o);
    // §13.3a(4a): a read a reviewer rejected is unusable for pairing.
    if (!pairingAt(placeId) || sessionOf(o) || detailOf(o)?.review?.state === 'rejected') return null;
    const event = detailOf(o)?.accessEvent;
    if (event === 'entry') return openVisit(o, placeId);
    if (event !== 'exit') return null;
    const open = sessions()
      .find((s) => !s.actualEnd && s._place && (s._place === placeId || sim.hierarchy.within(s._place, placeId)) && s._plate && plateKey(s._plate) === plateKey(o.observedCredentialId))
      .sort((a, b) => String(b.actualStart).localeCompare(String(a.actualStart)))[0];
    return open ? closeVisit(open, o, placeId) : null;
  }

  // ---------- retention (§13.3b) ----------

  /**
   * world.lpr.retention: { imagery: 'P30D', reads: 'P90D', holds: [observation ids] }.
   * Evaluated against the simulated clock: imagery past its period is
   * removed (`purgedImagery`), a read past its period is deleted through
   * the data module so the change feed carries the deletion.
   */
  function sweep({ imageryBefore, readsBefore, only } = {}) {
    const r = cfg().retention ?? {};
    const now = sim.clock.nowMs();
    const holds = new Set(r.holds ?? []);
    const readLimit = readsBefore ? Date.parse(readsBefore) : r.reads ? now - parseDuration(r.reads) : null;
    const imageLimit = imageryBefore ? Date.parse(imageryBefore) : r.imagery ? now - parseDuration(r.imagery) : null;
    const out = { purgedReads: [], purgedImagery: [] };
    if (readLimit === null && imageLimit === null) return out;
    for (const o of reads()) {
      if (holds.has(o.id) || (only && !only.includes(o.id))) continue;
      const t = msOf(o);
      if (readLimit !== null && t <= readLimit) {
        sim.data.remove('observations', o.id);
        out.purgedReads.push(o.id);
      } else if (imageLimit !== null && t <= imageLimit && (o.images ?? []).length) {
        sim.data.change('observations', o.id, { images: null, _purgedImagery: true });
        out.purgedImagery.push(o.id);
      }
    }
    return out;
  }

  return {
    observations,
    sessions,
    places,
    isRead,
    reads,
    detailOf,
    groupOf,
    laneOf,
    placeOf,
    bindingOf,
    covered,
    sessionOf,
    readsOfSession,
    plateMatches,
    projectRead,
    candidatesOf,
    candidateReadsOfSession,
    camerasOfLane,
    laneOfCamera,
    cameraClash,
    isWorldLane,
    pairingAt,
    pair,
    link,
    plateCredential,
    sweep,
    timeOf,
    msOf,
    newestFirst,
  };
}
