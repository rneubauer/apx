/**
 * apx-alerts (Part 7): the Alert resource, its lifecycle
 * (raised → acknowledged → resolved | expired), the alert topics, and the
 * server-raised alerts other domains cause: device faults and silences
 * from Control, subscription failures from the delivery fabric, occupancy
 * threshold crossings from Data.
 *
 * World sections read: alerts[] (seeded, `_place`/`_org` derived),
 * alertPolicy.expiry{ <alertType>: ISO duration } (default expiryTime),
 * actors{ parcs, deliveryMonitor }, subscriptions[] (seeded here only
 * when no events module serves /webhooks).
 */
import { fail } from '../kernel/problems.mjs';
import { parseDuration } from '../kernel/clock.mjs';
import { paginate, entry, refOf, wire, mls, shortId } from './common.mjs';

const SEVERITIES = ['info', 'warning', 'minor', 'major', 'critical'];
const OPEN = new Set(['raised', 'acknowledged']);
const TERMINAL = new Set(['resolved', 'expired']);
const FROM = { acknowledge: ['raised'], resolve: ['raised', 'acknowledged'] };
const STATE_OF = { acknowledge: 'acknowledged', resolve: 'resolved' };

// Control device states that raise an alert, and the alert they raise.
const DEVICE_ALERTS = {
  fault: { alertType: 'deviceFault', severity: 'major' },
  unknown: { alertType: 'deviceOffline', severity: 'minor' },
};
const RECOVERED = new Set(['available', 'occupied']);

const byDetectionDesc = (a, b) => (a.detectionTime === b.detectionTime ? a.id.localeCompare(b.id) : a.detectionTime < b.detectionTime ? 1 : -1);

export default {
  name: 'alerts',
  register(sim) {
    const alerts = () => sim.store.collection('alerts');
    const actors = () => ({ parcs: 'lakeside-parcs', deliveryMonitor: 'delivery-monitor', ...(sim.world.actors ?? {}) });
    let nextIds = []; // ids for the next server-raised alerts (injector nextAlertId), like X-Sim-Assign-Id

    // ---------- binding: the place an alert belongs to, or its organisation ----------

    /** The hierarchy node an alert is bound to: source.place, else the device's parent. */
    const bindingOf = (source) => {
      if (source?.place) return source.place;
      const device = source?.device?.id ? sim.hierarchy.get(source.device.id) : null;
      return device?.parentId ?? null;
    };

    const visibleTo = (principal, a) => {
      if (a._place) return principal.hasGrant && sim.hierarchy.covers(principal.places, a._place);
      return Boolean(a._org) && a._org === principal.org?.id;
    };

    /** §9.3a: missing → 404; place outside the grant → 403; another organisation's place-less alert → 404. */
    const visibleAlert = (ctx, id) => {
      const a = alerts().get(id);
      if (!a) fail('target-not-found', `No alert ${id}.`);
      if (a._place && !visibleTo(ctx.principal, a)) {
        fail('insufficient-grant', `Alert ${id} is bound to place ${sim.hierarchy.placeOf(a._place)?.id ?? a._place}, which is not in the token's apx_places grant.`);
      }
      if (!a._place && !visibleTo(ctx.principal, a)) fail('target-not-found', `No alert ${id}.`);
      return a;
    };

    // ---------- lifecycle ----------

    const publish = (type, a) =>
      sim.events.publish({ type, data: wire(a), subject: refOf(a.id, 'Alert'), place: a._place ?? null, ...(a._place ? {} : { org: a._org ?? null }) });

    const scheduleExpiry = (a) => {
      if (!a.expiryTime || !OPEN.has(a.status)) return;
      sim.clock.schedule(a.expiryTime, () => expire(a.id, 'expiryTime reached unacknowledged'), `alert expiry ${a.id}`);
    };

    const transition = (id, state, actor, detail) => {
      const next = alerts().update(id, (a) => ({ ...a, status: state, statusHistory: [...(a.statusHistory ?? []), entry(state, sim.clock.now(), actor, detail)] }));
      publish('apx.alert.status.v1', next);
      sim.hooks.emit('alert.status', { alert: next, state });
      return next;
    };

    const expire = (id, detail) => {
      const a = alerts().get(id);
      if (!a || !OPEN.has(a.status) || !a.expiryTime || Date.parse(a.expiryTime) > sim.clock.nowMs()) return null;
      return transition(id, 'expired', actors().parcs, detail);
    };

    const defaultExpiry = (alertType, detectionTime) => {
      const d = sim.world.alertPolicy?.expiry?.[alertType];
      if (!d) return undefined;
      const from = Date.parse(detectionTime) || sim.clock.nowMs();
      return new Date(from + parseDuration(d)).toISOString().replace(/\.\d{3}Z$/, 'Z');
    };

    /** Store a new alert, publish apx.alert.raised.v1, arm its expiry. */
    const create = (fields, { actor, detail, assignedId, recordActor }) => {
      const { id, version: _v, status: _s, statusHistory: _h, recordInfo: _r, ...body } = fields;
      const place = bindingOf(body.source);
      const org = place ? sim.hierarchy.operatorOf(place) : fields._org ?? null;
      const expiryTime = body.expiryTime ?? defaultExpiry(body.alertType, body.detectionTime);
      const a = alerts().insert(
        {
          ...(id ? { id } : {}),
          ...body,
          ...(expiryTime ? { expiryTime } : {}),
          status: 'raised',
          statusHistory: [entry('raised', sim.clock.now(), actor, detail)],
          _place: place ?? undefined,
          _org: place ? org ?? undefined : fields._org ?? undefined,
        },
        { assignedId, actor: recordActor }
      );
      publish('apx.alert.raised.v1', a);
      sim.hooks.emit('alert.raised', { alert: a });
      scheduleExpiry(a);
      return a;
    };

    /** A server-raised alert (hooks, injectors): ids come from nextAlertId when one is queued. */
    const raise = (fields, actor, detail) => {
      const assignedId = fields.id ? undefined : nextIds.shift();
      const place = bindingOf(fields.source);
      const org = place ? sim.hierarchy.operatorOf(place) : fields._org;
      return create(fields, { actor, detail, assignedId, recordActor: { org: org ? refOf(org, 'Organisation') : undefined, user: actor } });
    };

    // ---------- seeding ----------

    sim.seed((world) => {
      nextIds = [];
      for (const a of world.alerts ?? []) {
        if (alerts().has(a.id)) continue;
        const place = bindingOf(a.source);
        const row = { status: 'raised', statusHistory: [], version: 1, ...a, _place: place ?? undefined, _org: a._org ?? (place ? sim.hierarchy.operatorOf(place) : undefined) };
        alerts().put(row);
        scheduleExpiry(row);
      }
      // Without an events module the fabric still needs the subscriptions the world names.
      if (!sim.handlers.has('post-webhooks')) {
        const subs = sim.store.collection('subscriptions');
        for (const s of world.subscriptions ?? []) {
          if (subs.has(s.id)) continue;
          const cred = world.credentials?.[s.credential] ?? {};
          subs.put({
            id: s.id,
            version: 1,
            endpoint: s.endpoint,
            topics: s.topics,
            transport: s.transport ?? 'webhook',
            ...(s.filters ? { filters: s.filters } : {}),
            status: s.status ?? 'active',
            _grant: cred.apx_places ? [...cred.apx_places] : undefined,
            _scopes: [...(cred.scopes ?? [])],
            _org: cred.apx_org?.id ?? null,
            _keys: [{ keyId: 'k1', secret: s.secret ?? 'simulated-secret-of-at-least-32-bytes!!' }],
          });
        }
      }
    });

    sim.view('alerts', (a) => wire(a));

    // ---------- handlers ----------

    sim.on('post-apx-v1-alerts', (ctx) => {
      const b = ctx.body;
      if (!SEVERITIES.includes(b.severity)) {
        fail('invalid-request', `severity must be one of ${SEVERITIES.join(', ')}; got "${b.severity}".`, { errors: [{ pointer: '/severity', detail: 'not an allowed value' }] });
      }
      const place = b.source?.place;
      const device = b.source?.device?.id;
      if (place && !ctx.hierarchy.has(place)) fail('reference-unknown', `source.place ${place} names no HierarchyElement visible to the caller.`);
      const binding = bindingOf(b.source);
      if (binding) {
        if (!ctx.principal.hasGrant) fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');
        if (!ctx.hierarchy.covers(ctx.principal.places, binding)) {
          const what = place ? `source.place ${place}` : `source.device ${device}`;
          fail('insufficient-grant', `${what} belongs to place ${ctx.hierarchy.placeOf(binding)?.id ?? binding}, which is not in the token's apx_places grant.`);
        }
      }
      if (device && ctx.hierarchy.has(device) && !ctx.hierarchy.covers(ctx.principal.places, device)) {
        fail('insufficient-grant', `source.device ${device} is outside the token's apx_places grant.`);
      }
      const actor = ctx.principal.user ?? ctx.principal.sub;
      // No place binding: the alert belongs to the raising token's organisation (Part 7 §7.1).
      const fields = binding ? b : { ...b, _org: ctx.principal.org?.id ?? null };
      const a = create(fields, { actor, assignedId: ctx.assignId, recordActor: ctx.actor });
      return { status: 201, body: wire(a), idem: { collection: 'alerts', id: a.id } };
    });

    sim.on('get-apx-v1-alerts', (ctx) => {
      const q = ctx.query;
      const place = q.get('place');
      if (place && (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, place))) {
        fail('insufficient-grant', `place ${place} is not in the token's apx_places grant.`);
      }
      const floor = q.get('severityFloor');
      const since = q.get('since');
      const sinceMs = since ? Date.parse(since) : undefined;
      const rows = alerts()
        .find((a) => {
          if (!visibleTo(ctx.principal, a)) return false;
          if (place && (!a._place || !ctx.hierarchy.within(a._place, place))) return false;
          if (q.has('status') && a.status !== q.get('status')) return false;
          if (floor && SEVERITIES.indexOf(a.severity) < SEVERITIES.indexOf(floor)) return false;
          if (q.has('type') && a.alertType !== q.get('type')) return false;
          if (q.has('device') && a.source?.device?.id !== q.get('device')) return false;
          if (q.has('relatedEntity') && a.relatedEntity?.id !== q.get('relatedEntity')) return false;
          if (sinceMs !== undefined && Date.parse(a.detectionTime) < sinceMs) return false;
          return true;
        })
        .sort(byDetectionDesc);
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-alerts-id', (ctx) => wire(visibleAlert(ctx, ctx.params.id)));

    const transitionRoute = (verb) => (ctx) => {
      const a = visibleAlert(ctx, ctx.params.id);
      if (TERMINAL.has(a.status)) fail('alert-transition-illegal', `Alert ${a.id} is ${a.status}, a terminal state.`);
      if (!FROM[verb].includes(a.status)) {
        fail('alert-transition-illegal', `Alert ${a.id} is ${a.status}; ${verb} is allowed only from ${FROM[verb].join(' or ')}.`);
      }
      const actor = ctx.body?.agent ?? ctx.principal.user ?? ctx.principal.sub;
      return wire(transition(a.id, STATE_OF[verb], actor, ctx.body?.detail));
    };
    sim.on('post-apx-v1-alerts-id-acknowledge', transitionRoute('acknowledge'), { allowEmptyBody: true });
    sim.on('post-apx-v1-alerts-id-resolve', transitionRoute('resolve'), { allowEmptyBody: true });

    // ---------- hooks: alerts other domains cause ----------

    // Control (Part 6 §6.4): a device entering fault (or going silent) raises; recovery resolves.
    sim.hooks.on('device.state', ({ device, previous, actor }) => {
      const node = sim.hierarchy.get(device.id);
      const name = node?.name ?? `device ${shortId(device.id)}`;
      const parcs = actors().parcs;
      const change = `device state ${previous} → ${device.deviceState}${actor ? ` (${actor})` : ''}`;
      const raises = DEVICE_ALERTS[device.deviceState];
      if (raises) {
        const already = alerts().first((a) => a.alertType === raises.alertType && a.source?.device?.id === device.id && OPEN.has(a.status));
        if (already) return;
        raise(
          {
            alertType: raises.alertType,
            severity: raises.severity,
            source: { device: refOf(device.id, 'SupplementalEquipment'), ...(node?.parentId ? { place: node.parentId } : {}) },
            occurrenceTime: device.stateChangedTime ?? sim.clock.now(),
            detectionTime: sim.clock.now(),
            description: mls(`${name}: ${raises.alertType === 'deviceFault' ? 'device reports a fault' : 'device stopped communicating'}`),
          },
          parcs,
          change
        );
        return;
      }
      if (!RECOVERED.has(device.deviceState)) return;
      for (const a of alerts().find((x) => x.source?.device?.id === device.id && OPEN.has(x.status) && ['deviceFault', 'deviceOffline'].includes(x.alertType))) {
        transition(a.id, 'resolved', parcs, change);
      }
    });

    // Control (Part 6 §6.4): a supply crossing its low mark raises consumableLow; a refill resolves it.
    sim.hooks.on('device.consumables', ({ device, kind, level, actor }) => {
      const node = sim.hierarchy.get(device.id);
      const name = node?.name ?? `device ${shortId(device.id)}`;
      const who = actor === 'device' ? `${(node?.equipmentType ?? 'device').replace(/Station$/, '')}-${shortId(device.id)}` : actor ?? actors().parcs;
      const open = alerts().find((a) => a.alertType === 'consumableLow' && a.source?.device?.id === device.id && a._kind === kind && OPEN.has(a.status));
      if (level === 'low' || level === 'empty') {
        if (open.length) return;
        raise(
          {
            alertType: 'consumableLow',
            severity: level === 'empty' ? 'major' : 'minor',
            source: { device: refOf(device.id, 'SupplementalEquipment'), ...(node?.parentId ? { place: node.parentId } : {}) },
            occurrenceTime: device.lastCommunication ?? sim.clock.now(),
            detectionTime: sim.clock.now(),
            description: mls(`${kind} ${level} at ${name} (DeviceStatus.consumables)`),
            _kind: kind,
          },
          who,
          `${kind} ${level}`
        );
        return;
      }
      if (level === 'ok') for (const a of open) transition(a.id, 'resolved', who, `${kind} refilled`);
    });

    // The fabric (Part 8 §8.3): a subscription exhausted its retries. The alert is
    // bound to the subscription's organisation; the fabric already excludes the
    // failed subscription from every delivery (§7.4 self-referential rule).
    sim.hooks.on('subscription.failed', ({ subscription, failure }) => {
      raise(
        {
          alertType: 'webhookDeliveryFailed',
          severity: 'major',
          relatedEntity: refOf(subscription.id, 'Subscription'),
          occurrenceTime: failure?.failedTime ?? sim.clock.now(),
          detectionTime: sim.clock.now(),
          description: mls(
            `Subscription ${subscription.id} (${subscription.endpoint ?? 'sse'}) failed after ${failure?.attempts ?? '?'} attempts over 24 h of retries; last response ${failure?.lastCode ?? 'none'}`
          ),
          _org: subscription._org ?? null,
        },
        actors().deliveryMonitor,
        'retry schedule exhausted; subscription state failed'
      );
    });

    // Data (Part 5): occupancy crossed a configured threshold. Payload:
    // { place, occupancy?, threshold?, direction?: 'above' | 'below', expiryTime? }.
    sim.hooks.on('occupancy.threshold', ({ place, occupancy, threshold, direction = 'above', expiryTime, actor }) => {
      if (direction !== 'above' || !place || !sim.hierarchy.has(place)) return;
      const pct = (v) => (typeof v === 'number' ? `${Math.round(v <= 1 ? v * 100 : v)}%` : '?');
      raise(
        {
          alertType: 'occupancyThresholdExceeded',
          severity: 'warning',
          source: { place },
          detectionTime: sim.clock.now(),
          ...(expiryTime ? { expiryTime } : {}),
          description: mls(`Occupancy ${pct(occupancy)} (threshold ${pct(threshold)})`),
        },
        actor ?? 'occupancy-engine'
      );
    });

    // ---------- injectors ----------

    /** A server-raised alert: { alert: {...create shape, id?}, actor?, detail? }. */
    sim.injector('raiseAlert', ({ alert, actor, detail }) => {
      if (!alert?.alertType || !SEVERITIES.includes(alert.severity)) throw new Error('alert needs alertType and a severity from the closed list');
      if (alert.source?.place && !sim.hierarchy.has(alert.source.place)) throw new Error(`no hierarchy element ${alert.source.place}`);
      const fields = { detectionTime: sim.clock.now(), ...alert };
      return wire(raise(fields, actor ?? actors().parcs, detail));
    });

    /** Queue the ids the next server-raised alerts take: { id } or { ids: [] }. */
    sim.injector('nextAlertId', ({ id, ids }) => {
      nextIds = [...nextIds, ...(ids ?? [id])].filter(Boolean);
      return { queued: nextIds };
    });

    /** A server-side transition: { id, state: 'acknowledged' | 'resolved', actor?, detail? }. */
    sim.injector('alertTransition', ({ id, state = 'resolved', actor, detail }) => {
      const a = alerts().get(id);
      if (!a) throw new Error(`no alert ${id}`);
      if (TERMINAL.has(a.status)) throw new Error(`alert ${id} is already ${a.status}`);
      return wire(transition(id, state, actor ?? actors().parcs, detail));
    });

    /** Expire every open alert whose expiryTime has passed (or just { ids }). */
    sim.injector('expireAlerts', ({ ids, detail = 'expiryTime reached unacknowledged' } = {}) => {
      const targets = ids ?? alerts().find((a) => OPEN.has(a.status) && a.expiryTime).map((a) => a.id);
      return { expired: targets.map((id) => expire(id, detail)).filter(Boolean).map((a) => a.id) };
    });

    sim.alerts = { raise, transition, alerts };
  },
};
