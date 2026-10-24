/**
 * apx-site-config (Part 26): a location described from APX alone — the
 * equipment with its APX decorations (role, make, model, versions, serial,
 * MAC, area, level, what is built into what, which barrier a reader
 * opens), the cameras and their short-lived views, the comms points a
 * call reaches help through, the place's external identifiers and
 * escalation roles, and the change notices that keep another system's
 * copy of the site current.
 *
 * Collections: equipment (APDS SupplementalEquipment + extensions;
 * `_place`, `_lane`), commsPoints (`_place`), cameraViews (the audit log
 * of every view issued; `_agent`, `_correlationId`), placeDecorations
 * (`_target`: the external-ids and place-operations decorations of a
 * place or lane), displayRecords (§26.9, immutable; `_place`).
 *
 * World sections read: equipment[] ({ id, placeId, laneId?, name,
 * equipmentType, version?, installed?, detail{}, camera{}, externalIds[] }),
 * commsPoints[] (wire shape), placeDecorations[] ({ target, className,
 * externalIds[], operations{} }), displayRecords[] (wire shape; `place`
 * derived from the display when absent), video{ base, viewTtlSeconds }.
 *
 * Never holds an IP address, a username or a password: Part 26 §26.1 and
 * Part 9 §9.7.
 */
import { createHash } from 'node:crypto';
import { registryValues } from '../kernel/spec.mjs';
import { fail } from '../kernel/problems.mjs';
import { paginate, wire, refOf, getVisible, placeOfTarget, requireNode, checkPrecondition, parseInstant, mls, isRef, isChangeMode, notFound } from './common.mjs';
import { createApxFeed } from './platelists/feed.mjs';

const ROLES = registryValues('apx-equipment-roles');
const AREAS = registryValues('apx-area-types');
const CP_TYPES = registryValues('apx-comms-point-types');

export const DETAIL = 'apds-ext:apx:equipment-detail@1.0';
export const CAMERA = 'apds-ext:apx:camera@1.0';
export const EXT_IDS = 'apds-ext:apx:external-ids@1.0';
export const PLACE_OPS = 'apds-ext:apx:place-operations@1.0';

const EQUIPMENT = 'equipment';
const COMMS = 'commsPoints';
const VIEWS = 'cameraViews';
const DECOR = 'placeDecorations';
const DISPLAYS = 'displayRecords';
const TOPIC_EQUIPMENT = 'apx.equipment.changed.v1';
const TOPIC_COMMS = 'apx.commspoints.changed.v1';
const TOPIC_DISPLAY = 'apx.displays.shown.v1';

const SIGN_ROLES = new Set(['laneDisplay', 'countSign', 'other']);
const DISPLAY_FILTERS = ['place', 'display', 'messageKind', 'session', 'observation', 'since', 'until'];
// The members a DisplayRecord keeps: never message text, never a plate (§26.9 rule 3, Part 9 §9.6 rule 8).
const DISPLAY_MEMBERS = ['display', 'messageKind', 'observation', 'session', 'command', 'shownTime', 'contentHash', 'wordingVersion', 'screenshot', 'acknowledgedBy', 'extensions'];

const BARRIER_ROLES = new Set(['gate', 'overheadDoor', 'bollard', 'trafficSpikes', 'accessDoor', 'turnstile']);
const OFFLINE = new Set(['fault', 'inoperative', 'outOfService', 'unknown']);
const DAY_MS = 86_400_000;
const DEFAULT_VIEW_TTL_S = 300;
const DEFAULT_RETENTION_DAYS = 30;
const LIVE_PROTOCOLS = ['webrtc', 'hls', 'rtsp', 'mjpeg'];
const EQUIPMENT_FILTERS = ['place', 'role', 'area', 'lane', 'level'];
const COMMS_FILTERS = ['place', 'lane', 'type', 'callerId', 'dialedNumber', 'commsDeviceId'];
const COMMS_MEMBERS = ['type', 'place', 'lane', 'equipment', 'serves', 'phoneNumber', 'callerId', 'commsDeviceId', 'coverage', 'extensions'];

const classOf = (node) => (node?.kind === 'place' ? 'Place' : node?.kind === 'lane' ? 'VehicularAccess' : 'SupplementalEquipment');
const asRef = (v, className) => (v == null ? undefined : isRef(v) ? v : refOf(v, className));
const hex = (...parts) => createHash('sha256').update(parts.join('|')).digest('hex');
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The filter object of a list request, keys in a fixed order so a cursor's filter key is stable. */
const filterOf = (q, keys) => Object.fromEntries(keys.filter((k) => q.has(k)).map((k) => [k, q.get(k)]));

export default {
  name: 'siteconfig',
  register(sim) {
    const equipment = () => sim.store.collection(EQUIPMENT);
    const comms = () => sim.store.collection(COMMS);
    const views = () => sim.store.collection(VIEWS);
    const decorations = () => sim.store.collection(DECOR);
    const displays = () => sim.store.collection(DISPLAYS);
    const equipmentFeed = createApxFeed(sim, { collection: EQUIPMENT, prefix: 'eq', className: 'SupplementalEquipment' });
    const commsFeed = createApxFeed(sim, { collection: COMMS, prefix: 'cp', className: 'CommsPoint' });

    // ---------- seeding ----------

    /** A world equipment entry → the APDS SupplementalEquipment record with its APX decorations. */
    const equipmentRecord = (e, clockStart) => {
      const parent = e.laneId ?? e.placeId;
      const parentNode = sim.hierarchy.get(parent);
      const d = e.detail ?? {};
      const detail = {
        ...d,
        ...(e.laneId && !d.lane ? { lane: refOf(e.laneId, 'VehicularAccess') } : {}),
        ...(d.lane ? { lane: asRef(d.lane, 'VehicularAccess') } : {}),
        ...(d.builtInto ? { builtInto: asRef(d.builtInto, 'SupplementalEquipment') } : {}),
        ...(d.controls ? { controls: d.controls.map((c) => asRef(c, 'SupplementalEquipment')) } : {}),
        ...(d.serviceProvider ? { serviceProvider: { ...d.serviceProvider, ...(d.serviceProvider.organisation ? { organisation: asRef(d.serviceProvider.organisation, 'Organisation') } : {}) } } : {}),
      };
      const camera = e.camera ? { ...e.camera, ...(e.camera.recorder ? { recorder: { ...e.camera.recorder, equipment: asRef(e.camera.recorder.equipment, 'SupplementalEquipment') } } : {}) } : null;
      return {
        id: e.id,
        version: e.version ?? 1,
        type: 'supplementalEquipment',
        name: typeof e.name === 'string' ? mls(e.name) : e.name,
        layer: e.layer ?? (e.laneId ? 3 : 2),
        parentId: { id: parent, version: parentNode?.version ?? 1, className: classOf(parentNode) },
        hierarchyElementRecord: { creationTime: e.installed ?? clockStart },
        supplementalFacilityIndex: e.supplementalFacilityIndex ?? 1,
        equipmentType: e.equipmentType ?? 'other',
        extensions: {
          [DETAIL]: detail,
          ...(camera ? { [CAMERA]: camera } : {}),
          ...(e.externalIds?.length ? { [EXT_IDS]: { identifiers: e.externalIds } } : {}),
          ...(e.extensions ?? {}),
        },
        _place: e.placeId ?? sim.hierarchy.placeOf(parent)?.id,
        _lane: e.laneId ?? null,
      };
    };

    sim.seed((world) => {
      equipmentFeed.reset();
      commsFeed.reset();
      for (const e of world.equipment ?? []) {
        if (!sim.hierarchy.has(e.id)) {
          sim.hierarchy.add({ id: e.id, parentId: e.laneId ?? e.placeId, kind: 'device', className: 'SupplementalEquipment', name: typeof e.name === 'string' ? e.name : e.name?.[0]?.string, equipmentType: e.equipmentType, laneId: e.laneId, placeId: e.placeId });
        }
        equipment().put(equipmentRecord(e, world.clock?.start));
      }
      for (const c of world.commsPoints ?? []) {
        comms().put({ version: 1, ...c, _place: c._place ?? c.place?.id });
      }
      for (const d of world.placeDecorations ?? []) {
        decorations().put({
          id: d.target,
          version: 1,
          className: d.className ?? classOf(sim.hierarchy.get(d.target)),
          extensions: {
            ...(d.externalIds?.length ? { [EXT_IDS]: { identifiers: d.externalIds } } : {}),
            ...(d.operations ? { [PLACE_OPS]: d.operations } : {}),
          },
          _target: d.target,
        });
      }
      for (const r of world.displayRecords ?? []) {
        const place = r.place?.id ?? equipment().get(r.display?.id)?._place ?? sim.hierarchy.placeOf(r.display?.id)?.id;
        displays().put({ version: 1, ...r, ...(place ? { place: refOf(place, 'Place') } : {}), _place: place });
      }
    });

    sim.view(COMMS, (c) => wire(c));
    sim.view(DISPLAYS, (r) => wire(r));

    // ---------- lookups other domains use ----------

    const detailOf = (id) => equipment().get(id)?.extensions?.[DETAIL] ?? null;
    const roleOf = (id) => detailOf(id)?.role ?? null;
    const isBarrier = (id) => BARRIER_ROLES.has(roleOf(id));
    const placeName = (placeId) => sim.hierarchy.get(placeId)?.name ?? placeId;

    /** The comms point a call identifies itself by: its id, the device's caller id, the number dialed, or the call platform's device id. */
    const commsPointBy = ({ id, callerId, dialedNumber, commsDeviceId }) => {
      if (id) return comms().get(id) ?? null;
      if (callerId) return comms().first((c) => c.callerId === callerId) ?? null;
      if (dialedNumber) return comms().first((c) => c.phoneNumber === dialedNumber) ?? null;
      if (commsDeviceId) return comms().first((c) => c.commsDeviceId === commsDeviceId) ?? null;
      return null;
    };

    const decorationsOf = (targetId) => decorations().get(targetId)?.extensions ?? null;

    // ---------- grant helpers ----------

    const requirePlace = (ctx, placeId) => {
      if (!ctx.hierarchy.has(placeId)) fail('target-not-found', `No place ${placeId} visible to this credential.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, placeId)) fail('insufficient-grant', `Place ${placeId} is outside the token's apx_places grant.`);
    };
    const covered = (ctx, id) => ctx.principal.hasGrant && ctx.hierarchy.covers(ctx.principal.places, id);

    // ---------- equipment (§26.1) ----------

    const equipmentMatches = (rec, f) => {
      const d = rec.extensions?.[DETAIL] ?? {};
      if (f.place && !sim.hierarchy.within(rec.id, f.place)) return false;
      if (f.role && d.role !== f.role) return false;
      if (f.area && d.area !== f.area) return false;
      if (f.level && d.level !== f.level) return false;
      if (f.lane && rec._lane !== f.lane && d.lane?.id !== f.lane) return false;
      return true;
    };

    sim.on(
      'get-apx-v1-equipment',
      (ctx) => {
        const f = filterOf(ctx.query, EQUIPMENT_FILTERS);
        requirePlace(ctx, f.place);
        if (f.role && !ROLES.includes(f.role)) fail('invalid-request', `role must be a value of apx-equipment-roles; ${f.role} is not.`, { errors: [{ pointer: '?role', detail: 'unknown role' }] });
        if (f.area && !AREAS.includes(f.area)) fail('invalid-request', `area must be a value of apx-area-types; ${f.area} is not.`, { errors: [{ pointer: '?area', detail: 'unknown area' }] });
        const belongs = (rec) => equipmentMatches(rec, f) && covered(ctx, rec.id);
        if (isChangeMode(ctx)) return equipmentFeed.page(ctx, { scope: 'equipment', filter: f, belongs, visible: (rec) => covered(ctx, rec.id), toWire: wire, route: '/v1/equipment' });
        const rows = equipment()
          .find(belongs)
          .sort((a, b) => a.id.localeCompare(b.id));
        return paginate(ctx, rows);
      },
      { changeFeed: true }
    );

    sim.on('get-apx-v1-equipment-id', (ctx) => wire(getVisible(ctx, EQUIPMENT, ctx.params.id, { what: 'equipment', placeOf: (r) => r.id })));

    /** The world changes a piece of equipment (a swap, a firmware update, a new camera): the record moves on and subscribers are told. */
    const changeEquipment = ({ equipment: id, detail, camera, name, equipmentType, externalIds, actor = 'site-maintenance' }) => {
      const before = equipment().get(id);
      if (!before) throw new Error(`no equipment ${id}`);
      const next = equipment().update(
        id,
        (r) => ({
          ...r,
          ...(name ? { name: typeof name === 'string' ? mls(name) : name } : {}),
          ...(equipmentType ? { equipmentType } : {}),
          extensions: {
            ...r.extensions,
            ...(detail ? { [DETAIL]: { ...r.extensions[DETAIL], ...detail } } : {}),
            ...(camera ? { [CAMERA]: { ...(r.extensions[CAMERA] ?? {}), ...camera } } : {}),
            ...(externalIds ? { [EXT_IDS]: { identifiers: externalIds } } : {}),
          },
        }),
        { actor: { user: actor } }
      );
      equipmentFeed.track(next, before);
      sim.events.publish({ type: TOPIC_EQUIPMENT, data: wire(next), subject: refOf(id, 'SupplementalEquipment'), place: next._place });
      sim.hooks.emit('equipment.changed', { equipment: next, previous: before });
      return wire(next);
    };

    // ---------- comms points (§26.4) ----------

    const commsMatches = (rec, f) => {
      if (f.place && !(rec._place === f.place || sim.hierarchy.within(rec._place, f.place))) return false;
      if (f.lane && rec.lane?.id !== f.lane) return false;
      if (f.type && rec.type !== f.type) return false;
      if (f.callerId && rec.callerId !== f.callerId) return false;
      if (f.dialedNumber && rec.phoneNumber !== f.dialedNumber) return false;
      if (f.commsDeviceId && rec.commsDeviceId !== f.commsDeviceId) return false;
      return true;
    };

    sim.on(
      'get-apx-v1-comms-points',
      (ctx) => {
        const f = filterOf(ctx.query, COMMS_FILTERS);
        if (f.place) requirePlace(ctx, f.place);
        const visible = (rec) => !rec._place || covered(ctx, rec._place);
        const belongs = (rec) => commsMatches(rec, f) && visible(rec);
        if (isChangeMode(ctx)) return commsFeed.page(ctx, { scope: 'commsPoints', filter: f, belongs, visible, toWire: wire, route: '/v1/comms-points' });
        const rows = comms()
          .find(belongs)
          .sort((a, b) => a.id.localeCompare(b.id));
        return paginate(ctx, rows);
      },
      { changeFeed: true }
    );

    const visibleComms = (ctx, id) => getVisible(ctx, COMMS, id, { what: 'comms point' });

    sim.on('get-apx-v1-comms-points-id', (ctx) => wire(visibleComms(ctx, ctx.params.id)));

    /** The members a client writes; the server's (id on create aside) are dropped, never trusted. */
    const content = (b) => Object.fromEntries(COMMS_MEMBERS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

    const checkCommsBody = (ctx, b) => {
      if (!CP_TYPES.includes(b.type)) fail('reference-unknown', `type ${b.type} is not a value of apx-comms-point-types.`);
      const { place } = placeOfTarget(ctx, b.place, 'place');
      for (const k of ['lane', 'equipment', 'serves']) {
        if (!b[k]) continue;
        const node = requireNode(ctx, b[k], k);
        if (!sim.hierarchy.within(node.id, place.id)) fail('request-unprocessable', `${k} ${node.id} is not inside place ${place.id}.`);
      }
      if (b.phoneNumber === undefined && b.callerId === undefined && b.commsDeviceId === undefined) {
        fail('invalid-request', 'A comms point needs at least one of phoneNumber, callerId or commsDeviceId.', { errors: [{ pointer: '/', detail: 'anyOf: phoneNumber, callerId, commsDeviceId' }] });
      }
      return place;
    };

    const publishComms = (rec) => sim.events.publish({ type: TOPIC_COMMS, data: wire(rec), subject: refOf(rec.id, 'CommsPoint'), place: rec._place });

    sim.on('post-apx-v1-comms-points', (ctx) => {
      const b = ctx.body;
      const place = checkCommsBody(ctx, b);
      const rec = comms().insert({ ...content(b), ...(b.id ? { id: b.id } : {}), _place: place.id }, { assignedId: ctx.assignId, actor: ctx.actor });
      commsFeed.track(rec);
      publishComms(rec);
      return { status: 201, body: wire(rec), idem: { collection: COMMS, id: rec.id } };
    });

    sim.on('put-apx-v1-comms-points-id', (ctx) => {
      const cur = visibleComms(ctx, ctx.params.id);
      checkPrecondition(ctx, cur);
      const place = checkCommsBody(ctx, ctx.body);
      const next = comms().update(cur.id, (r) => ({ ...content(ctx.body), id: r.id, recordInfo: r.recordInfo, _place: place.id }), { actor: ctx.actor });
      commsFeed.track(next, cur);
      publishComms(next);
      return wire(next);
    });

    sim.on('delete-apx-v1-comms-points-id', (ctx) => {
      const cur = visibleComms(ctx, ctx.params.id);
      comms().delete(cur.id);
      commsFeed.bury(cur);
      publishComms(cur);
      return undefined;
    });

    // ---------- identifiers (§26.6) ----------

    const identifiersOf = (rec) => rec.extensions?.[EXT_IDS]?.identifiers ?? [];

    sim.on('post-apx-v1-identifiers-resolve', (ctx) => {
      const { system, id } = ctx.body;
      const match = (rec) => identifiersOf(rec).some((x) => x.system === system && x.id === id);
      const target = decorations().first(match) ?? equipment().first(match);
      const targetId = target?._target ?? target?.id;
      if (!targetId || !covered(ctx, targetId)) {
        fail('target-not-found', `No record visible to this credential carries id ${id} for system ${system}.`);
      }
      const node = sim.hierarchy.get(targetId);
      const className = target?.className ?? classOf(node);
      const place = sim.hierarchy.placeOf(targetId);
      return { target: refOf(targetId, className), className, ...(place ? { place: refOf(place.id, 'Place') } : {}) };
    });

    // ---------- camera views (§26.3) ----------

    const videoBase = () => (sim.world.video?.base ?? 'https://video.lakeside-garage.example').replace(/\/$/, '');
    const viewTtlMs = () => (sim.world.video?.viewTtlSeconds ?? DEFAULT_VIEW_TTL_S) * 1000;

    sim.on('post-apx-v1-cameras-id-views', (ctx) => {
      const id = ctx.params.id;
      const cam = equipment().get(id);
      if (!cam) notFound('camera', id);
      if (!covered(ctx, id)) fail('insufficient-grant', `Camera ${id} is at ${placeName(cam._place)}, outside the token's apx_places grant.`);
      const detail = cam.extensions?.[DETAIL] ?? {};
      if (detail.role !== 'camera') fail('request-unprocessable', `Equipment ${id} is a ${detail.role ?? 'device'}, not a camera.`);
      const spec = cam.extensions?.[CAMERA] ?? {};
      const b = ctx.body;
      const now = ctx.clock.nowMs();
      let from;
      let to;
      if (b.kind === 'playback') {
        if (!b.from || !b.to) {
          fail('invalid-request', 'kind playback requires from and to.', { errors: [...(b.from ? [] : [{ pointer: '/from', detail: 'required' }]), ...(b.to ? [] : [{ pointer: '/to', detail: 'required' }])] });
        }
        from = parseInstant(b.from, 'from');
        to = parseInstant(b.to, 'to');
        if (to <= from) fail('invalid-request', 'to must be after from.', { errors: [{ pointer: '/to', detail: 'after from' }] });
        if (!spec.recorder) fail('camera-view-unavailable', `Camera ${id} is not recorded; there is no playback.`);
        const retention = spec.retentionDays ?? DEFAULT_RETENTION_DAYS;
        const earliest = now - retention * DAY_MS;
        if (from < earliest) fail('playback-range-unavailable', `Camera ${id} retains ${retention} days; recordings before ${iso(earliest).slice(0, 10)} are gone.`);
      } else if (b.from || b.to) {
        fail('invalid-request', `from and to apply to kind playback only, not ${b.kind}.`, { errors: [{ pointer: '/from', detail: 'playback only' }] });
      }
      const device = sim.control?.devices().get(id);
      if (device && OFFLINE.has(device.deviceState)) {
        fail('camera-view-unavailable', `Camera ${id} has not reported since ${device.lastCommunication ?? device.stateChangedTime ?? 'its last state change'}.`);
      }
      const protocols = (spec.streams ?? []).map((s) => s.protocol);
      const protocol = b.kind === 'snapshot' ? 'snapshot' : b.kind === 'playback' ? 'hls' : (LIVE_PROTOCOLS.find((p) => protocols.includes(p)) ?? 'webrtc');
      const n = sim.store.next('cameraView', 1);
      const token = hex(id, b.kind, n, sim.world.name).slice(0, 32);
      const path = b.kind === 'live' ? `v/${token}` : b.kind === 'snapshot' ? `s/${token}` : `p/${token}/index.m3u8`;
      const rec = views().insert(
        {
          camera: refOf(id, 'SupplementalEquipment'),
          kind: b.kind,
          url: `${videoBase()}/${path}`,
          protocol,
          expiresAt: iso(now + viewTtlMs()),
          issuedTo: b.agent,
          ...(b.kind === 'playback' ? { from: b.from, to: b.to } : {}),
          _place: cam._place,
          _agent: b.agent,
          _agentType: b.agentType,
          _correlationId: b.correlationId,
          _interactionId: b.interactionId,
          _issuedAt: ctx.now(),
        },
        { assignedId: ctx.assignId, actor: { org: ctx.actor.org, user: b.agent } }
      );
      const { version: _v, recordInfo: _r, ...body } = wire(rec);
      sim.hooks.emit('camera.viewed', { view: rec });
      return { status: 201, body };
    });

    // ---------- display records (§26.9) ----------

    /** A body reference that must name something the caller can see (rule 4): 422 reference-unknown otherwise. */
    const requireVisible = (ctx, reference, collection, what) => {
      if (!reference) return;
      const rec = sim.store.collection(collection).get(reference.id);
      const place = rec?._lane ?? rec?._place ?? rec?.hierarchyElement?.id;
      if (!rec || (place && !covered(ctx, place))) fail('reference-unknown', `${what} ${reference.id} names nothing visible to this credential.`);
    };

    /** Rule 5: a record naming a displayMessage command agrees with that command's CommandResult.display. */
    const checkCommand = (ctx, b) => {
      if (!b.command) return;
      const cmd = sim.store.collection('commands').get(b.command.id);
      if (!cmd || (cmd._place && !covered(ctx, cmd._place))) fail('reference-unknown', `command ${b.command.id} names no Command visible to this credential.`);
      if (cmd.commandType !== 'displayMessage') fail('request-unprocessable', `Command ${cmd.id} is a ${cmd.commandType}, not a displayMessage.`);
      const shown = cmd.result?.display;
      if (!shown) return;
      const timeDiffers = shown.shownTime && Date.parse(shown.shownTime) !== Date.parse(b.shownTime);
      const hashDiffers = shown.contentHash && shown.contentHash !== b.contentHash;
      if (timeDiffers || hashDiffers) {
        fail('request-unprocessable', `Command ${cmd.id} recorded shownTime ${shown.shownTime ?? '(none)'} and contentHash ${shown.contentHash ?? '(none)'}; the record disagrees.`);
      }
    };

    /** The sign a record names (rule 2): a SupplementalEquipment of §26.1 whose role is a sign; its place. */
    const checkDisplayBody = (ctx, b) => {
      const sign = equipment().get(b.display.id);
      if (!sign) fail('reference-unknown', `display ${b.display.id} names no SupplementalEquipment visible to this credential.`);
      if (!covered(ctx, sign.id)) fail('insufficient-grant', `display ${sign.id} is at ${placeName(sign._place)}, outside the token's apx_places grant.`);
      const role = sign.extensions?.[DETAIL]?.role;
      if (!SIGN_ROLES.has(role)) fail('reference-unknown', `display ${sign.id} is a ${role ?? 'device with no role'}, not a sign (role laneDisplay or countSign).`);
      if (b.place && b.place.id !== sign._place) fail('request-unprocessable', `place ${b.place.id} is not the place of display ${sign.id} (${sign._place}).`);
      requireVisible(ctx, b.observation, 'observations', 'observation');
      requireVisible(ctx, b.session, 'sessions', 'session');
      checkCommand(ctx, b);
      return sign._place;
    };

    /** Store a record and publish its notice (rule 7). Immutable once written: there is no update path. */
    const recordDisplay = (b, place, { assignedId, actor }) => {
      const content = Object.fromEntries(DISPLAY_MEMBERS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));
      const rec = displays().insert({ ...(b.id ? { id: b.id } : {}), ...content, place: refOf(place, 'Place'), _place: place }, { assignedId, actor });
      sim.events.publish({ type: TOPIC_DISPLAY, data: wire(rec), subject: refOf(rec.display.id, 'SupplementalEquipment'), place });
      sim.hooks.emit('display.shown', { record: rec });
      return rec;
    };

    sim.on('post-apx-v1-display-records', (ctx) => {
      const place = checkDisplayBody(ctx, ctx.body);
      const rec = recordDisplay(ctx.body, place, { assignedId: ctx.assignId, actor: ctx.actor });
      return { status: 201, body: wire(rec), idem: { collection: DISPLAYS, id: rec.id } };
    });

    const displayMatches = (rec, f) => {
      if (f.place && !(rec._place === f.place || sim.hierarchy.within(rec._place, f.place))) return false;
      if (f.display && rec.display?.id !== f.display) return false;
      if (f.messageKind && rec.messageKind !== f.messageKind) return false;
      if (f.session && rec.session?.id !== f.session) return false;
      if (f.observation && rec.observation?.id !== f.observation) return false;
      const shown = Date.parse(rec.shownTime);
      if (f.since !== undefined && shown < f.since) return false;
      if (f.until !== undefined && shown >= f.until) return false;
      return true;
    };

    // The §5.2 change feed on this route is the shared one (common.mjs installChangeFeeds).
    sim.on('get-apx-v1-display-records', (ctx) => {
      const f = filterOf(ctx.query, DISPLAY_FILTERS);
      if (f.place) requirePlace(ctx, f.place);
      const bounds = { ...f, since: parseInstant(f.since, 'since'), until: parseInstant(f.until, 'until') };
      const rows = displays()
        .find((rec) => covered(ctx, rec._place) && displayMatches(rec, bounds))
        .sort((a, b) => b.shownTime.localeCompare(a.shownTime) || a.id.localeCompare(b.id));
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-display-records-id', (ctx) => wire(getVisible(ctx, DISPLAYS, ctx.params.id, { what: 'display record' })));

    // ---------- injectors ----------

    sim.injector('equipmentChanged', (args) => changeEquipment(args));

    /**
     * The edge that drives a sign records a message it showed, off-API
     * (a stage direction standing in for the edge's own POST): { display,
     * messageKind, shownTime?, session?, observation?, contentHash?,
     * wordingVersion?, acknowledgedBy? }.
     */
    sim.injector('displayShown', ({ display, ...rest }) => {
      const sign = equipment().get(display);
      if (!sign) throw new Error(`no equipment ${display}`);
      const b = { display: refOf(display, 'SupplementalEquipment'), shownTime: sim.clock.now(), ...rest };
      for (const [k, className] of [['session', 'Session'], ['observation', 'ObservationElement'], ['command', 'Command']]) if (typeof b[k] === 'string') b[k] = refOf(b[k], className);
      return wire(recordDisplay(b, sign._place, { actor: { user: 'edge-controller' } }));
    });

    /** A call platform's comms point changes off-API (a line re-provisioned). */
    sim.injector('commsPointChanged', ({ commsPoint, ...patch }) => {
      const before = comms().get(commsPoint);
      if (!before) throw new Error(`no comms point ${commsPoint}`);
      const next = comms().update(commsPoint, (r) => ({ ...r, ...content(patch) }), { actor: { user: 'callplatform' } });
      commsFeed.track(next, before);
      publishComms(next);
      return wire(next);
    });

    /**
     * Pre-issue a change-feed cursor at the collection's current position
     * (a stage direction standing in for an earlier sync): { feed:
     * 'equipment' | 'commsPoints', name, credential?, filters? }.
     */
    sim.injector('siteFeedCursor', ({ feed, name, credential = 'default', filters = {} }) => {
      const which = feed === 'equipment' ? { f: equipmentFeed, scope: 'equipment', keys: EQUIPMENT_FILTERS } : feed === 'commsPoints' ? { f: commsFeed, scope: 'commsPoints', keys: COMMS_FILTERS } : null;
      if (!which) throw new Error(`feed must be equipment or commsPoints, not ${feed}`);
      if (!name) throw new Error('siteFeedCursor needs name');
      const filter = Object.fromEntries(which.keys.filter((k) => filters[k] !== undefined).map((k) => [k, filters[k]]));
      const grant = sim.world.credentials?.[credential]?.apx_places ?? null;
      which.f.issueAt({ name, scope: which.scope, credential, filterKey: JSON.stringify(filter), position: sim.store.changeSeq, grant });
      return { feed, cursor: name, position: sim.store.changeSeq };
    });

    sim.siteconfig = { commsPointBy, detailOf, roleOf, isBarrier, decorationsOf, changeEquipment, equipment, comms, displays, DETAIL, CAMERA, EXT_IDS, PLACE_OPS };
  },
};
