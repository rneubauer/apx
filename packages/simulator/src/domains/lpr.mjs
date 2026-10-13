/**
 * apx-lpr (Part 13 §13.3–13.5, Part 17 §17.5): the plate/ticket/session
 * cross-lookup over APDS Observations, the LPR system's access-event
 * revision, plate candidates and the plate correction on a Session.
 * Ingest is the data module's native POST /observations; this module
 * listens to its `observation.ingested` hook.
 *
 * World sections read: lanes[] (`extensions` with the
 * `apds-ext:apx:lane-cameras@1.0` decoration, `version`), lpr {
 * pairing: { places: [ids], assignedRight }, retention: { imagery,
 * reads, holds: [ids] }, disputeWindow: 'PT30M', lanePlaces: true }.
 * With an `lpr` section, each world lane is also kept as an APDS
 * VehicularAccess record in `places`, so the native place route can
 * write its camera configuration.
 *
 * Collections: reads `observations` (`_lane`, `_place`, `_purgedImagery`)
 * and `sessions` (`_plate`, `_ticketNumber`, `_entryObservation`,
 * `_exitObservation`, `_observations`, `_entryLane`, `_exitLane`,
 * `_imageLink`, `_plateCorrection`), `assignedRights` (reservations),
 * `lanes` (control's `lastRead` / `current.lpr`), `places` (lane records).
 *
 * Hooks: listens to `observation.ingested` and `places.changed`; emits
 * `lane.vehicleArrives` { lane, plate } (as control's injector does),
 * `lpr.read` { observation, lane, place, session }, `lpr.accessEvent`
 * { observation, previous, accessEvent }, `session.plateCorrected`
 * { session, plate, observation }.
 *
 * Injectors: plateRead, purgeImagery, purgeReads.
 */
import { parseDuration } from '../kernel/clock.mjs';
import { fail } from '../kernel/problems.mjs';
import { paginate, refOf, checkPrecondition, wire } from './common.mjs';
import { createModel, READ_KEY, CAMERAS_KEY } from './lpr/model.mjs';

const PLATE_OP = 'put-apx-v1-sessions-id-plate';
const DEFAULT_DISPUTE_WINDOW = 'PT30M';

export default {
  name: 'lpr',
  register(sim) {
    const m = createModel(sim);

    // ---------- seeding: lanes as APDS VehicularAccess records ----------

    sim.seed((world) => {
      if (!world.lpr || world.lpr.lanePlaces === false) return;
      const places = m.places();
      for (const l of world.lanes ?? []) {
        if (places.has(l.id)) continue;
        const parent = (world.places ?? []).find((p) => p.id === l.placeId);
        places.put({
          id: l.id,
          version: l.version ?? 1,
          type: 'vehicularAccess',
          name: [{ language: 'en', string: l.name ?? l.id }],
          layer: 1,
          parentId: { id: l.placeId, version: parent?.version ?? 1, className: 'Place' },
          hierarchyElementRecord: { creationTime: l.creationTime ?? world.clock?.start, creator: { id: sim.hierarchy.operatorOf(l.placeId) ?? world.organisation?.id, version: 1, className: 'Organisation' } },
          ...(l.accessType ? { accessType: l.accessType } : {}),
          ...(l.extensions ? { extensions: l.extensions } : {}),
          _place: l.id,
          _parent: l.placeId,
          _modified: world.clock?.start,
        });
      }
      m.sweep();
    });

    // A native write to a lane's place record re-files it as a Place in the
    // hierarchy; keep it a lane so its reads still bind to it.
    sim.hooks.on('places.changed', ({ record, deleted }) => {
      if (deleted || !m.isWorldLane(record.id)) return;
      const node = sim.hierarchy.get(record.id) ?? {};
      sim.hierarchy.add({ ...node, id: record.id, kind: 'lane', className: 'VehicularAccess', parentId: record.parentId?.id ?? node.parentId, version: record.version });
    });

    // §13.3a(5): cameraId is unique within the Place. The data module owns the
    // native place routes; the rule is checked in front of its handlers.
    for (const opId of ['update-place', 'create-place']) {
      const inner = sim.handlers.get(opId);
      if (!inner) continue;
      const guarded = (ctx) => {
        checkLaneCameras(ctx);
        return inner(ctx);
      };
      Object.assign(guarded, { allowEmptyBody: inner.allowEmptyBody, skipBodyValidation: inner.skipBodyValidation });
      sim.handlers.set(opId, guarded);
    }

    function checkLaneCameras(ctx) {
      const body = ctx.body;
      const cameras = body?.extensions?.[CAMERAS_KEY]?.cameras;
      if (!Array.isArray(cameras)) return;
      const laneId = ctx.params.id ?? body.id;
      // Outside the grant the data module's own refusal comes first; say nothing about the cameras.
      if (!m.covered(ctx.principal, laneId) && !m.covered(ctx.principal, body.parentId?.id)) return;
      const placeId = body.parentId?.id ?? sim.hierarchy.get(laneId)?.parentId;
      const clash = m.cameraClash(laneId, sim.hierarchy.placeOf(placeId)?.id ?? placeId, cameras.map((c) => c?.cameraId));
      if (!clash) return;
      const where = clash.lane === laneId ? 'twice on this lane' : `already configured on lane ${clash.lane} of this place`;
      fail('request-unprocessable', `cameraId ${clash.cameraId} is ${where}; a cameraId MUST be unique within the Place (Part 13 §13.3a(5)). Nothing was written.`);
    }

    // ---------- ingest: lane integration and pairing ----------

    function arriveAtLane(laneId, o) {
      const lanes = sim.store.collection('lanes');
      if (!lanes.has(laneId)) return;
      const plate = o.observedCredentialId;
      const confidence = o.confidence?.overallConfidence;
      const image = (o.images ?? []).find((i) => i.imageType === 'plate')?.imageLink ?? o.images?.[0]?.imageLink;
      const next = lanes.update(
        laneId,
        (l) => ({
          ...l,
          lastRead: { plate, ...(confidence !== undefined ? { confidence } : {}), observation: o.id, time: m.timeOf(o) },
          ...(l.current ? { current: { ...l.current, lpr: { plate, ...(confidence !== undefined ? { confidence } : {}), observation: refOf(o.id, 'Observation'), ...(image ? { imageLink: image } : {}) } } } : {}),
        }),
        { bump: false }
      );
      sim.hooks.emit('lane.vehicleArrives', { lane: next, plate });
    }

    sim.hooks.on('observation.ingested', ({ element, lane }) => {
      const o = typeof element === 'string' ? m.observations().get(element) : element;
      if (!m.isRead(o)) return;
      const laneId = lane ?? m.laneOf(o);
      if (laneId) arriveAtLane(laneId, o);
      const session = m.pair(o) ?? m.sessionOf(o);
      sim.hooks.emit('lpr.read', { observation: o, lane: laneId ?? null, place: m.placeOf(o) ?? null, session: session ?? null });
    });

    // ---------- GET /v1/lpr/reads ----------

    const requireGrantOn = (ctx, id, what) => {
      if (!m.covered(ctx.principal, id)) fail('insufficient-grant', `${what} is not in the token's apx_places grant.`);
    };

    sim.on('get-apx-v1-lpr-reads', (ctx) => {
      m.sweep();
      const q = ctx.query;
      const [plate, ticket, observation, sessionId, place] = ['plate', 'ticket', 'observation', 'session', 'place'].map((n) => q.get(n));
      if (!plate && !ticket && !observation && !sessionId) {
        fail('invalid-request', 'GET /v1/lpr/reads requires plate, ticket, observation, or session.', { errors: [{ pointer: '?plate', detail: 'one of plate, ticket, observation, session is required' }] });
      }
      if (place) requireGrantOn(ctx, place, `Place ${place}`);
      const session = sessionId ? m.sessions().get(sessionId) : null;
      if (session) requireGrantOn(ctx, session._place, `Session ${session.id} at place ${session._place}`);
      if (!ctx.principal.hasGrant || (sessionId && !session)) return paginate(ctx, []);
      const rows = m
        .reads()
        .filter((o) => {
          if (!m.covered(ctx.principal, m.bindingOf(o))) return false;
          if (observation && o.id !== observation) return false;
          if (plate && !m.plateMatches(o, plate)) return false;
          if (ticket && m.sessionOf(o)?._ticketNumber !== ticket) return false;
          if (session && m.sessionOf(o)?.id !== session.id) return false;
          if (place && !sim.hierarchy.within(m.bindingOf(o), place)) return false;
          return true;
        })
        .sort(m.newestFirst);
      return paginate(ctx, rows.map(m.projectRead));
    });

    // ---------- GET /v1/lpr/candidates ----------

    sim.on('get-apx-v1-lpr-candidates', (ctx) => {
      m.sweep();
      const [sessionId, laneId, since] = ['session', 'lane', 'since'].map((n) => ctx.query.get(n));
      if (!sessionId && !laneId) {
        fail('invalid-request', 'GET /v1/lpr/candidates requires session or lane.', { errors: [{ pointer: '?session', detail: 'one of session, lane is required' }] });
      }
      const laneNode = laneId ? sim.hierarchy.get(laneId) : null;
      if (laneNode && !m.covered(ctx.principal, laneId)) {
        fail('insufficient-grant', `VehicularAccess ${laneId} belongs to place ${sim.hierarchy.placeOf(laneId)?.id}, which is not in the token's apx_places grant.`);
      }
      const session = sessionId ? m.sessions().get(sessionId) : null;
      if (session) requireGrantOn(ctx, session._place, `Session ${session.id} at place ${session._place}`);
      if (!ctx.principal.hasGrant || (laneId && !laneNode) || (sessionId && !session)) return paginate(ctx, []);
      const sinceMs = since ? Date.parse(since) : null;
      if (since && Number.isNaN(sinceMs)) fail('invalid-request', 'since is not an RFC 3339 instant.', { errors: [{ pointer: '?since', detail: 'RFC 3339 expected' }] });
      const pool = session ? m.candidateReadsOfSession(session) : m.reads();
      const rows = pool
        .filter((o) => m.covered(ctx.principal, m.bindingOf(o)))
        .filter((o) => !laneId || m.laneOf(o) === laneId)
        .filter((o) => sinceMs === null || m.msOf(o) >= sinceMs)
        .sort(m.newestFirst)
        .flatMap(m.candidatesOf)
        .map((c, i) => ({ c, i }))
        .sort((a, b) => b.c.confidence - a.c.confidence || a.i - b.i)
        .map(({ c }) => c);
      return paginate(ctx, rows);
    });

    // ---------- PUT /v1/lpr/reads/{observation}/access-event ----------

    sim.on('put-apx-v1-lpr-reads-observation-access-event', (ctx) => {
      m.sweep();
      const id = ctx.params.observation;
      const o = m.observations().get(id);
      if (!m.isRead(o)) fail('target-not-found', `No LPR read with Observation id ${id}.`);
      if (!m.covered(ctx.principal, m.bindingOf(o))) fail('insufficient-grant', `Observation ${id} was read at place ${m.placeOf(o)}, outside the token's apx_places grant.`);
      checkPrecondition(ctx, o);
      const value = ctx.body.accessEvent;
      const detail = m.detailOf(o) ?? {};
      const previous = detail.accessEvent ?? 'unknown';
      const answer = (rec) => ({ observation: refOf(rec.id, 'Observation'), accessEvent: value, version: rec.version });
      if (previous === value) return answer(o);
      const next = sim.data.change('observations', id, { extensions: { ...(o.extensions ?? {}), [READ_KEY]: { ...detail, accessEvent: value } } }, ctx.principal);
      sim.events.publish({ type: 'apx.data.observation.updated.v1', data: wire(next), subject: { id: next.id, className: 'ObservationElement' }, place: next._lane ?? next._place ?? null });
      sim.hooks.emit('lpr.accessEvent', { observation: next, previous, accessEvent: value });
      m.pair(next);
      return answer(next);
    });

    // ---------- PUT /v1/sessions/{id}/plate ----------

    sim.on('put-apx-v1-sessions-id-plate', (ctx) => {
      const s = m.sessions().get(ctx.params.id);
      if (!s) fail('target-not-found', `No session ${ctx.params.id} visible to this credential.`);
      if (!m.covered(ctx.principal, s._place)) fail('insufficient-grant', `Session ${s.id} belongs to place ${s._place}, which is not in the token's apx_places grant.`);
      checkPrecondition(ctx, s);
      const b = ctx.body;
      refuseClosed(ctx, s, b);
      enforceContextDecision(s.id, b.approval);
      const credentials = [m.plateCredential(b.plate), ...(s.identifiedCredentials ?? []).filter((c) => c?.type !== 'licensePlate')];
      const vehicle = b.country || b.stateProvince ? { ...(s.identifiedVehicle ?? {}), ...(b.country ? { country: b.country } : {}), ...(b.stateProvince ? { stateProvince: b.stateProvince } : {}) } : s.identifiedVehicle;
      const cited = b.observation?.id && m.isRead(m.observations().get(b.observation.id)) ? b.observation.id : null;
      const unchanged =
        s._plate === b.plate &&
        JSON.stringify(s.identifiedCredentials ?? []) === JSON.stringify(credentials) &&
        JSON.stringify(s.identifiedVehicle ?? null) === JSON.stringify(vehicle ?? null) &&
        (!cited || m.sessionOf(m.observations().get(cited))?.id === s.id);
      let current = s;
      if (!unchanged) {
        const citedFree = cited && !m.sessionOf(m.observations().get(cited));
        current = sim.data.change(
          'sessions',
          s.id,
          {
            identifiedCredentials: credentials,
            ...(vehicle ? { identifiedVehicle: vehicle } : {}),
            _plate: b.plate,
            _plateCorrection: { previous: s._plate ?? null, observation: cited, reason: b.reason ?? null, approval: b.approval ?? null, by: ctx.principal.sub, time: ctx.now() },
            ...(citedFree ? { _observations: [...(s._observations ?? []), cited] } : {}),
          },
          ctx.principal
        );
        sim.hooks.emit('session.plateCorrected', { session: current, plate: b.plate, observation: cited });
      }
      return {
        session: refOf(s.id, 'Session'),
        plate: b.plate,
        ...(b.country ? { country: b.country } : {}),
        ...(b.stateProvince ? { stateProvince: b.stateProvince } : {}),
        ...(b.observation ? { observation: refOf(b.observation.id, b.observation.className ?? 'Observation') } : {}),
        version: current.version,
      };
    });

    /**
     * Part 17 §17.3 rule 3: the plate body names no resolutionContext, so
     * the newest live context that evaluated the plate action on this
     * session binds the write. allowed=false → 403 action-not-allowed;
     * requiresApproval without approval.approvedBy → 403 approval-required.
     * No such context: no gate.
     */
    function enforceContextDecision(sessionId, approval) {
      const now = sim.clock.nowMs();
      const live = sim.store
        .collection('resolutionContexts')
        .all()
        .filter((rc) => !(rc._expiresAt && now >= Date.parse(rc._expiresAt)));
      for (const rc of [...live].reverse()) {
        const action = (rc.allowedActions ?? []).find((a) => (a.action === PLATE_OP || a.execution?.operationId === PLATE_OP) && a.target?.id === sessionId);
        if (!action) continue;
        if (action.allowed === false) fail('action-not-allowed', `Context ${rc.id} evaluated ${PLATE_OP} as not allowed.`);
        if (action.requiresApproval && !approval?.approvedBy) {
          fail('approval-required', `Context ${rc.id} allows ${PLATE_OP} only with approval by role ${action.approvalRole ?? 'supervisor'}; no approval evidence supplied.`);
        }
        return;
      }
    }

    /** Part 17 §17.5: a closed Session is corrected only inside the dispute window and only with a reason. */
    function refuseClosed(ctx, s, b) {
      const ended = s.actualEnd ?? (s._boundExit ? ctx.now() : null);
      if (!ended) return;
      const window = sim.world.lpr?.disputeWindow ?? DEFAULT_DISPUTE_WINDOW;
      const minutes = Math.round(parseDuration(window) / 60000);
      if (!b.reason) fail('session-not-open', `Session ${s.id} ended ${ended}; a correction on a closed session requires reason.`);
      if (ctx.clock.nowMs() > Date.parse(ended) + parseDuration(window)) {
        fail('session-not-open', `Session ${s.id} ended ${ended}; the ${minutes}-minute correction window has passed. Raise a dispute instead.`);
      }
    }

    // ---------- injectors: the world acting on its own ----------

    sim.injector('plateRead', (args) => {
      const element = buildRead(args);
      const stored = sim.data.ingestObservation(element, { org: sim.world.credentials?.[args.credential ?? 'lakeside-parcs']?.apx_org ?? sim.world.organisation });
      return { observation: stored.id, read: m.projectRead(m.observations().get(stored.id)), session: m.sessionOf(m.observations().get(stored.id))?.id ?? null };
    });

    sim.injector('purgeImagery', ({ observation, observations, before }) => m.sweep({ imageryBefore: before ?? '9999-12-31T00:00:00Z', only: observations ?? (observation ? [observation] : undefined) }));
    sim.injector('purgeReads', ({ observation, observations, before }) => m.sweep({ readsBefore: before ?? '9999-12-31T00:00:00Z', only: observations ?? (observation ? [observation] : undefined) }));

    /** A schema-valid licensePlate ObservationElement with the §13.3a decoration. */
    function buildRead({ lane, camera, plate, accessEvent, confidence = 0.95, time, captureGroup, plateFace, movement, alternateReads, imageLink, id, country, stateProvince, frameReads, platesRead, engine }) {
      if (!plate) throw new Error('plateRead needs plate');
      const laneId = lane ?? (camera ? m.laneOfCamera(camera) : undefined);
      const node = laneId ? sim.hierarchy.get(laneId) : null;
      if (!node) throw new Error(`plateRead needs a known lane (or a configured camera); got lane ${lane} camera ${camera}`);
      const cameraId = camera ?? m.camerasOfLane(laneId)[0]?.cameraId;
      const obsId = id ?? `f2000000-0000-4000-8000-${String(sim.store.next('lprRead', 9001)).padStart(12, '0')}`;
      const at = time ?? sim.clock.now();
      const placeId = sim.hierarchy.placeOf(laneId)?.id;
      const link = imageLink ?? `${sim.world.host}/v1/media/${obsId.slice(0, 8)}-${obsId.slice(-4)}/plate.jpg`;
      const detail = {
        plate: { value: plate, confidence },
        ...(country ? { country: { value: country, confidence } } : {}),
        ...(stateProvince ? { stateProvince: { value: stateProvince, confidence } } : {}),
        ...(alternateReads ? { alternateReads } : {}),
        ...(frameReads !== undefined ? { frameReads } : {}),
        ...(platesRead !== undefined ? { platesRead } : {}),
        ...(plateFace ? { plateFace } : {}),
        ...(movement ? { movement } : {}),
        ...(accessEvent ? { accessEvent } : {}),
        ...(captureGroup ? { captureGroup } : {}),
        ...(engine ? { engine } : {}),
      };
      const coords = sim.hierarchy.get(placeId)?.coordinates ?? [0, 0];
      return {
        id: obsId,
        version: 1,
        type: 'licensePlate',
        method: 'anpr',
        observedCredentialId: plate,
        observationStartTime: at,
        creationDateTime: sim.clock.now(),
        elementIds: { id: laneId, version: node.version ?? 1, className: 'VehicularAccess' },
        observerOrganisation: { id: sim.hierarchy.operatorOf(laneId) ?? sim.world.organisation?.id, version: 1, className: 'Organisation' },
        location: { observerLocation: { type: 'Point', coordinates: coords } },
        ...(country || stateProvince ? { vehicleAncillaryIdentification: { ...(country ? { country } : {}), ...(stateProvince ? { stateProvince } : {}) } } : {}),
        confidence: { overallConfidence: confidence },
        images: [{ id: `img-${obsId.slice(-4)}-plate`, imageType: 'plate', imageLink: link, ...(cameraId ? { cameraID: cameraId } : {}) }],
        extensions: { [READ_KEY]: detail },
      };
    }

    sim.lpr = { model: m, project: m.projectRead, candidatesOf: m.candidatesOf, sessionOf: m.sessionOf, sweep: m.sweep };
  },
};
