/**
 * apx-ui-launch (Part 25): the host opens a vendor's own screen for an
 * agent, signed in, and whatever is done there comes back as APX data.
 *
 * A launch is minted by the handshake (POST /v1/ui/launches → a single-use
 * url that lives ≤ 60 s) or by a signed token the host posts to the
 * surface's launchUrl (out of band; the world seeds such launches). The
 * vendor screen — here the simulator's own mock screen, ui/vendor.html —
 * consumes the url (injector uiLaunchOpen), records what the agent did
 * (POST …/actions) and closes the launch (POST …/close). An action the
 * implementation executes natively (lostTicket, vendGate, …) is recorded
 * as the Command it would have been through the API, carrying the
 * launch's correlationId and agent (§25.4 rule 1); the action record
 * names that Command as its `result`. Anything else stays a
 * UiActionRecord with the requested fields (§25.4 rule 2).
 *
 * Collections: uiLaunches (`_place`, `_org`, `_nonce`, `_surface`).
 * World sections read: uiSurfaces[] (UiSurface entries), uiLaunches[]
 * (seeded launches, wire shape), uiLaunch{ recorder: the credential the
 * loopback Command is created under, launchBase }.
 */
import { createHash, randomUUID } from 'node:crypto';
import { registryValues } from '../kernel/spec.mjs';
import { fail } from '../kernel/problems.mjs';
import { paginate, wire, refOf, getVisible, placeOfTarget, requireNode, isRef, notFound } from './common.mjs';

const SURFACES = registryValues('apx-ui-surfaces');
const COMMAND_TYPES = new Set(registryValues('apx-command-types'));
const COLL = 'uiLaunches';
const TOPIC_LAUNCH = 'apx.ui.launch.changed.v1';
const TOPIC_ACTION = 'apx.ui.action.recorded.v1';
const MAX_TTL_S = 60;
const OPENED_TTL_MS = 3600_000;
const REQUEST_MEMBERS = ['surface', 'subject', 'place', 'lane', 'agent', 'agentType', 'interactionId', 'correlationId', 'displayMode', 'returnFields', 'extensions'];
const ACTION_MEMBERS = ['action', 'outcome', 'occurredAt', 'agent', 'summary', 'result', 'fields', 'unavailable', 'correlationId'];
// Actions the simulated implementation executes natively, with the parameters a screen cannot send.
const NATIVE = { lostTicket: { method: 'fee' }, vendGate: {}, holdGateOpen: {}, closeLane: {}, ejectTicket: {}, cancelTransaction: {}, reprintReceipt: {}, restartDevice: {}, displayMessage: null };
const SUBJECT_COLLECTIONS = {
  Session: 'sessions',
  AssignedRight: 'assignedRights',
  Reservation: 'assignedRights',
  Observation: 'observations',
  Violation: 'violations',
  CredentialRecord: 'credentialRecords',
  Credential: 'credentialRecords',
  TollTransaction: 'tollTransactions',
  ValetTicket: 'valetTickets',
  ChargingSession: 'chargingSessions',
  PaymentRecord: 'payments',
  Account: 'accounts',
};
const HIERARCHY_CLASSES = new Set(['VehicularAccess', 'SupplementalEquipment', 'Place', 'HierarchyElement', 'IdentifiedArea']);

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const hex = (...parts) => createHash('sha256').update(parts.join('|')).digest('hex');
const pick = (body, members) => Object.fromEntries(members.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

export default {
  name: 'uilaunch',
  register(sim) {
    const launches = () => sim.store.collection(COLL);
    let surfaces = [];

    // ---------- seeding ----------

    sim.seed((world) => {
      surfaces = (world.uiSurfaces ?? []).map((s) => ({ ...s }));
      for (const l of world.uiLaunches ?? []) {
        launches().put({ version: 1, status: 'issued', actions: [], ...l, _place: l._place ?? l.place?.id, _nonce: l._nonce ?? hex('seed', l.id) });
      }
    });

    // ---------- surfaces (§25.1) ----------

    const surfaceByName = (name) => surfaces.find((s) => s.surface === name) ?? null;
    const offeredAt = (s, placeId) => !s.places?.length || s.places.some((p) => sim.hierarchy.within(placeId, p.id) || sim.hierarchy.within(p.id, placeId));
    const surfacesAt = (placeId) => surfaces.filter((s) => offeredAt(s, placeId));
    const surfaceFor = (placeId, action) => surfacesAt(placeId).find((s) => (s.actions ?? []).includes(action)) ?? null;
    const surfaceWire = (s) => wire(s);

    // ---------- representation ----------

    /** Requested fields filled from the native result an action produced (§25.4): read-time, so a Command that finishes later still counts. */
    const fieldsFrom = (rec, a) => {
      if (!a.result || a.result.className !== 'Command' || !rec.returnFields?.length) return a.fields;
      const cmd = sim.store.collection('commands').get(a.result.id);
      if (!cmd?.result) return a.fields;
      const fields = { ...(a.fields ?? {}) };
      for (const path of rec.returnFields) {
        if (fields[path] !== undefined) continue;
        const value = path.replace(/^\//, '').split('/').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), cmd.result);
        if (value !== undefined) fields[path] = value;
      }
      return Object.keys(fields).length ? fields : a.fields;
    };

    const actionWire = (rec, a) => {
      const fields = fieldsFrom(rec, a);
      return wire({ ...a, ...(fields ? { fields } : {}) });
    };

    const present = (rec) => ({ ...wire(rec), actions: (rec.actions ?? []).map((a) => actionWire(rec, a)) });

    sim.view(COLL, (r) => present(r));

    const publish = (rec) => sim.events.publish({ type: TOPIC_LAUNCH, data: present(rec), subject: refOf(rec.id, 'UiLaunch'), place: rec._place });

    // ---------- lifecycle (§25.3) ----------

    const expire = (id, why) => {
      const rec = launches().get(id);
      if (!rec || rec.status === 'closed' || rec.status === 'expired') return rec;
      const next = launches().update(id, (r) => ({ ...r, status: 'expired' }), { actor: { user: 'apx-ui-launch' } });
      publish(next);
      sim.hooks.emit('ui.launch', { launch: next, change: why ?? 'expired' });
      return next;
    };

    const armExpiry = (rec) => {
      if (rec.status === 'issued') sim.clock.schedule(rec.expiresAt, () => {
        if (launches().get(rec.id)?.status === 'issued') expire(rec.id, 'url not opened in time');
      }, `launch ${rec.id} expires`);
      if (rec.status === 'opened') sim.clock.schedule({ delay: OPENED_TTL_MS }, () => {
        if (launches().get(rec.id)?.status === 'opened') expire(rec.id, 'screen left open');
      }, `launch ${rec.id} opened too long`);
    };

    /** The screen consumed the single-use url (or the implementation accepted the signed token). */
    const open = (id, { nonce, actor = 'vendor-screen' } = {}) => {
      const rec = launches().get(id);
      if (!rec) throw new Error(`no launch ${id}`);
      if (rec.status === 'opened') throw new Error(`launch ${id} was already opened at ${rec.openedAt}; the url is single-use`);
      if (rec.status === 'expired') throw new Error(`launch ${id} expired at ${rec.expiresAt}`);
      if (rec.status === 'closed') throw new Error(`launch ${id} is closed`);
      if (nonce && rec._nonce && nonce !== rec._nonce) throw new Error(`the url presented does not belong to launch ${id}`);
      const next = launches().update(id, (r) => ({ ...r, status: 'opened', openedAt: sim.clock.now() }), { actor: { user: actor } });
      armExpiry(next);
      publish(next);
      sim.hooks.emit('ui.launch', { launch: next, change: 'opened' });
      return next;
    };

    const refuseIfOver = (rec, route) => {
      if (rec.status === 'expired') {
        fail('ui-launch-expired', `Launch ${rec.id} expired at ${rec.expiresAt}${rec.openedAt ? '' : ' without being opened'}.`);
      }
      if (rec.status === 'closed') {
        fail('ui-launch-closed', route === 'close' ? `Launch ${rec.id} is already closed.` : `Launch ${rec.id} was closed at ${rec.closedAt}; open a new launch to record further actions.`);
      }
    };

    // ---------- the loopback (§25.4) ----------

    const recorderToken = () => sim.world.uiLaunch?.recorder ?? 'lakeside-parcs';

    /** An action the implementation can execute natively is recorded as the Command it would have been through the API. */
    const loopback = async (rec, a, n) => {
      const params = NATIVE[a.action];
      if (params === undefined || params === null || a.outcome !== 'completed' || a.result) return null;
      const target = rec.lane ?? (rec.subject && sim.hierarchy.has(rec.subject.id) ? rec.subject : null);
      if (!target) return null;
      const res = await sim.request('POST', '/v1/commands', {
        token: recorderToken(),
        headers: { 'idempotency-key': `ui-${rec.id}-${n}` },
        body: {
          commandType: a.action,
          target,
          agent: a.agent ?? rec.agent,
          agentType: rec.agentType,
          reason: a.summary,
          correlationId: rec.correlationId,
          ...(Object.keys(params).length ? { parameters: params } : {}),
        },
      });
      if (res.status !== 202 && res.status !== 200) return { refused: res.body?.detail ?? `HTTP ${res.status}` };
      return { command: refOf(res.body.id, 'Command') };
    };

    /** Record what the agent did in the screen (the route and the uiLaunchAction injector share this). */
    const record = async (rec, b, { assignedId, actor } = {}) => {
      const now = sim.clock.now();
      const n = (rec.actions ?? []).length + 1;
      const a = {
        id: assignedId ?? randomUUID(),
        launch: refOf(rec.id, 'UiLaunch'),
        ...pick(b, ACTION_MEMBERS),
        agent: b.agent ?? rec.agent,
        occurredAt: b.occurredAt ?? now,
        correlationId: b.correlationId ?? rec.correlationId,
      };
      const back = await loopback(rec, a, n);
      if (back?.command) a.result = back.command;
      if (back?.refused) a._loopbackRefused = back.refused;
      if (rec.status === 'issued') open(rec.id, { actor: actor ?? 'vendor-screen' });
      const next = launches().update(rec.id, (r) => ({ ...r, actions: [...(r.actions ?? []), a] }), { actor: { user: a.agent } });
      sim.events.publish({ type: TOPIC_ACTION, data: actionWire(next, a), subject: refOf(rec.id, 'UiLaunch'), place: rec._place });
      sim.hooks.emit('ui.action', { launch: next, action: a });
      return actionWire(next, a);
    };

    // ---------- routes ----------

    const visible = (ctx, id) => getVisible(ctx, COLL, id, { what: 'UI launch' });

    /** The subject must exist and, when it is a hierarchy node, lie inside the grant. */
    const checkSubject = (ctx, subject, placeId) => {
      if (!subject) return;
      if (!isRef(subject)) fail('invalid-request', 'subject must be a Reference', { errors: [{ pointer: '/subject', detail: 'Reference required' }] });
      if (HIERARCHY_CLASSES.has(subject.className) || sim.hierarchy.has(subject.id)) {
        const node = requireNode(ctx, subject, 'subject');
        if (!ctx.hierarchy.covers(ctx.principal.places, node.id)) fail('insufficient-grant', `subject ${node.id} is outside the token's apx_places grant.`);
        return;
      }
      const name = SUBJECT_COLLECTIONS[subject.className];
      const coll = name ? sim.store.collection(name) : null;
      const rec = coll?.get(subject.id) ?? (!name ? [...sim.store.collections.values()].map((c) => c.get(subject.id)).find(Boolean) : null);
      if (!rec) fail('reference-unknown', `subject: no ${subject.className} ${subject.id} at this place.`);
      if (rec._place && placeId && rec._place !== placeId && !sim.hierarchy.within(rec._place, placeId)) {
        fail('reference-unknown', `subject: ${subject.className} ${subject.id} is not at place ${placeId}.`);
      }
    };

    sim.on('post-apx-v1-ui-launches', (ctx) => {
      const b = ctx.body;
      const surface = surfaceByName(b.surface);
      if (!surface) {
        fail('ui-surface-unknown', `This implementation offers no ${b.surface} surface; see uiSurfaces in GET /v1/discovery.${SURFACES.includes(b.surface) ? '' : ` ${b.surface} is not a value of apx-ui-surfaces either.`}`);
      }
      const { place } = placeOfTarget(ctx, b.place, 'place');
      if (!offeredAt(surface, place.id)) fail('ui-surface-unknown', `${b.surface} is not offered at place ${place.id}; see uiSurfaces[].places in GET /v1/discovery.`);
      if (!(surface.displayModes ?? []).includes(b.displayMode)) {
        const modes = surface.displayModes ?? [];
        fail('ui-display-mode-unsupported', `${b.surface} offers ${modes.length > 1 ? `${modes.slice(0, -1).join(', ')} and ${modes.at(-1)}` : modes[0] ?? 'no display mode'}${b.displayMode === 'embed' ? "; the host's origin is not registered for embedding" : ''}.`);
      }
      if (!(surface.launchModes ?? ['handshake']).includes('handshake')) fail('request-unprocessable', `${b.surface} accepts only a signed launch token at ${surface.launchUrl}; it has no handshake.`);
      if (b.lane) {
        const lane = requireNode(ctx, b.lane, 'lane');
        if (!ctx.hierarchy.within(lane.id, place.id)) fail('request-unprocessable', `lane ${lane.id} is not inside place ${place.id}.`);
      }
      checkSubject(ctx, b.subject, place.id);
      const ttl = Math.min(Math.max(1, b.expiresIn ?? MAX_TTL_S), MAX_TTL_S);
      const now = ctx.clock.nowMs();
      const n = sim.store.next('uiLaunch', 1);
      const nonce = `${hex(place.id, b.correlationId, n, sim.world.name).slice(0, 8)}-${hex(n, 'launch').slice(0, 4)}-4${hex(n, 'v').slice(0, 3)}-${hex(n, 'x').slice(0, 4)}-${hex(n, 'y').slice(0, 12)}`;
      const base = (surface.launchUrl ?? sim.world.uiLaunch?.launchBase ?? `${sim.world.host}/ui/launch`).replace(/\/$/, '');
      const rec = launches().insert(
        {
          ...pick(b, REQUEST_MEMBERS),
          url: `${base}/${nonce}`,
          expiresAt: iso(now + ttl * 1000),
          status: 'issued',
          actions: [],
          _place: place.id,
          _org: ctx.principal.org?.id,
          _surface: surface.surface,
          _nonce: nonce,
        },
        { assignedId: ctx.assignId, actor: { org: ctx.actor.org, user: b.agent } }
      );
      armExpiry(rec);
      publish(rec);
      sim.hooks.emit('ui.launch', { launch: rec, change: 'issued' });
      return { status: 201, body: present(rec), idem: { collection: COLL, id: rec.id } };
    });

    sim.on('get-apx-v1-ui-launches', (ctx) => {
      const q = (k) => ctx.query.get(k);
      const places = ctx.query.list('place');
      for (const id of places) {
        if (!ctx.hierarchy.has(id)) fail('target-not-found', `No place ${id} visible to this credential.`);
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is outside the token's apx_places grant.`);
      }
      if (!ctx.principal.hasGrant) return paginate(ctx, []);
      const created = (r) => r.recordInfo?.creationTime ?? '';
      const rows = launches()
        .find((r) => {
          if (r._place && !ctx.hierarchy.covers(ctx.principal.places, r._place)) return false;
          if (places.length && !places.some((p) => sim.hierarchy.within(r._place, p))) return false;
          if (q('agent') && r.agent !== q('agent')) return false;
          if (q('status') && r.status !== q('status')) return false;
          if (q('correlationId') && r.correlationId !== q('correlationId')) return false;
          if (q('interactionId') && r.interactionId !== q('interactionId')) return false;
          return true;
        })
        .sort((a, b) => (created(a) < created(b) ? 1 : created(a) > created(b) ? -1 : a.id.localeCompare(b.id)))
        .map(present);
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-ui-launches-id', (ctx) => present(visible(ctx, ctx.params.id)));

    sim.on('post-apx-v1-ui-launches-id-actions', async (ctx) => {
      const rec = visible(ctx, ctx.params.id);
      refuseIfOver(rec, 'actions');
      const b = ctx.body;
      if (b.action !== 'other' && !COMMAND_TYPES.has(b.action) && !/^(get|post|put|patch|delete)-apx-/.test(b.action)) {
        fail('invalid-request', `action must be an apx-command-types value, an operationId, or other; got ${b.action}.`, { errors: [{ pointer: '/action', detail: 'unknown action' }] });
      }
      const a = await record(rec, b, { assignedId: ctx.assignId, actor: ctx.principal.user ?? ctx.principal.sub });
      return { status: 201, body: a };
    });

    sim.on(
      'post-apx-v1-ui-launches-id-close',
      (ctx) => {
        const rec = visible(ctx, ctx.params.id);
        refuseIfOver(rec, 'close');
        const now = ctx.now();
        const next = launches().update(rec.id, (r) => ({ ...r, status: 'closed', closedAt: now, ...(r.openedAt ? {} : { openedAt: now }) }), { actor: { user: ctx.principal.user ?? ctx.principal.sub } });
        publish(next);
        sim.hooks.emit('ui.launch', { launch: next, change: 'closed' });
        return present(next);
      },
      { allowEmptyBody: true, skipBodyValidation: true }
    );

    // ---------- injectors: the vendor screen and the clock ----------

    /** The screen opened the single-use url: { launch, nonce? }. */
    sim.injector('uiLaunchOpen', ({ launch, nonce, url }) => {
      const n = nonce ?? (url ? String(url).split('/').pop() : undefined);
      return present(open(launch, { nonce: n }));
    });

    /** The agent did something in the screen (what POST …/actions records): { launch, action, outcome, summary, agent?, fields?, unavailable? }. */
    sim.injector('uiLaunchAction', async ({ launch, id, ...body }) => {
      const rec = launches().get(launch);
      if (!rec) throw new Error(`no launch ${launch}`);
      if (rec.status === 'expired' || rec.status === 'closed') throw new Error(`launch ${launch} is ${rec.status}`);
      if (!body.action || !body.outcome || !body.summary) throw new Error('uiLaunchAction needs action, outcome and summary');
      return record(rec, body, { assignedId: id });
    });

    /** The screen was closed or the launch timed out: { launch, expire? }. */
    sim.injector('uiLaunchExpire', ({ launch }) => {
      if (!launches().has(launch)) throw new Error(`no launch ${launch}`);
      return present(expire(launch, 'expired by the stage'));
    });

    sim.uilaunch = { surfaces: () => surfaces.map(surfaceWire), surfacesAt: (placeId) => surfacesAt(placeId).map(surfaceWire), surfaceFor, launches, open, record };
  },
};

export { notFound };
