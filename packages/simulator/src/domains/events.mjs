/**
 * apx-events / apx-events-sse (Part 8): the subscription routes at APDS's
 * own `/webhooks`, the delivery ledger, and the SSE stream. Delivery itself
 * (matching, signing, the retry schedule, the failure cascade, SSE
 * buffers) is the kernel's EventFabric; this module owns the subscription
 * records it reads: the wire members of ApxEventSubscription plus `_grant`
 * (the creating token's apx_places), `_org`, `_keys`, `_held`, `_sseSeq`,
 * `_sseBuffer`.
 *
 * World sections read: subscriptions[] (seeded, with `credential` naming
 * the creating token), events.approval ('auto' | 'operator'),
 * events.vault { secretRef: material }, events.vendorTopics[], receivers{}.
 */
import { EventFabric } from '../kernel/events.mjs';
import { fail } from '../kernel/problems.mjs';
import { paginate, wire, checkPrecondition, parseInstant, notFound } from './common.mjs';
import { isKnownTopic, unreadableTopic, expandTopics } from './events/topics.mjs';
import { newKey, addKey, retireKeys, retireSuperseded, activeKeyIds, ROTATION_OVERLAP_MS } from './events/keys.mjs';
import { registerInjectors } from './events/injectors.mjs';

const CLIENT_STATES = new Set(['active', 'paused']);
const READ_ONLY = ['id', 'version', 'activeKeyIds', 'recordInfo'];
const WRITE_ONLY = ['secret', 'secretRef', 'keyId', 'retireKeyIds'];

const invalid = (detail, pointer, why = detail) => fail('invalid-request', detail, { errors: [{ pointer, detail: why }] });

/** The wire view: internal members stripped, write-only members never returned. */
export function subscriptionView(rec) {
  const out = wire(rec);
  for (const k of WRITE_ONLY) delete out[k];
  if (out.transport === 'sse' || !out.activeKeyIds?.length) delete out.activeKeyIds;
  return out;
}

export default {
  name: 'events',
  register(sim) {
    const subs = () => sim.store.collection('subscriptions');
    const ledger = () => sim.store.collection('deliveries');
    const state = { approval: 'auto' };
    const vendorTopics = () => sim.world.events?.vendorTopics ?? [];
    const orgOf = (principal) => principal?.org?.id ?? null;

    workAroundFabric(sim);

    // ---------- seeding ----------

    sim.seed((world) => {
      state.approval = world.events?.approval ?? 'auto';
      for (const s of world.subscriptions ?? []) {
        if (subs().has(s.id)) continue;
        const cred = world.credentials?.[s.credential] ?? {};
        const transport = s.transport ?? 'webhook';
        const since = world.clock?.start ?? sim.clock.now();
        const keys = transport === 'webhook' ? (s.keys ?? [{ keyId: s.keyId ?? `k-${s.credential ?? 'seed'}`, secret: s.secret ?? EventFabric.mintSecret() }]).map((k) => ({ since, ...k })) : [];
        subs().put({
          id: s.id,
          version: s.version ?? 1,
          ...(s.endpoint ? { endpoint: s.endpoint } : {}),
          topics: expandTopics(s.topics),
          transport,
          ...(s.filters ? { filters: s.filters } : {}),
          ...(transport === 'webhook' ? { activeKeyIds: activeKeyIds(keys) } : {}),
          status: s.status ?? 'active',
          recordInfo: { creationTime: since, ...(cred.apx_org ? { creator: cred.apx_org } : {}), creationUser: cred.user ?? s.credential ?? 'seed', lastUpdate: since },
          ...(s.extensions ? { extensions: s.extensions } : {}),
          _grant: cred.apx_places ? [...cred.apx_places] : undefined,
          _org: cred.apx_org?.id ?? null,
          _keys: keys,
          _held: [],
          _sseSeq: s.sseSeq ?? 0,
          _sseBuffer: [],
        });
      }
    });

    // The kernel re-serves an idempotent POST /webhooks replay as 200, whose
    // declared body is the stock ResponseStatus; the subscription as it now
    // stands is one GET away, and the secret is never disclosed again (§8.1).
    sim.view('subscriptions', (rec) => ({
      status: 'ok',
      code: 200,
      message: `Idempotent replay: subscription ${rec.id} already exists (GET /webhooks/${rec.id}); its secret is not disclosed again.`,
      ids: [rec.id],
    }));

    // ---------- shared checks ----------

    /** A subscription of the caller's organisation, else 404 (another org's subscription is invisible). */
    const visible = (ctx, id) => {
      const rec = subs().get(id);
      if (!rec || (rec._org ?? null) !== orgOf(ctx.principal)) notFound('subscription', id);
      return rec;
    };

    const checkTopics = (ctx, topics) => {
      const unknown = topics.find((t) => !isKnownTopic(t, vendorTopics()));
      if (unknown) fail('unknown-topic', `${unknown} is not in registry apx-topics, not an APDS EventTypeEnum value, and not in this server's vendor list.`);
    };

    const checkTopicScopes = (ctx, topics) => {
      const bad = unreadableTopic(ctx.principal, topics);
      if (bad) fail('insufficient-scope', bad.detail);
    };

    /** filters.places must lie inside the token's grant; a token without apx_places cannot place-filter (§8.5(4)). */
    const checkFilterPlaces = (ctx, filters) => {
      const places = filters?.places ?? [];
      if (!places.length) return;
      if (!ctx.principal.hasGrant) fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');
      places.forEach((p, i) => {
        if (!ctx.hierarchy.covers(ctx.principal.places, p)) fail('insufficient-grant', `filters.places names ${p}, which is not in the token's apx_places grant.`);
        if (!ctx.hierarchy.has(p)) invalid(`filters.places names ${p}, which is not a known HierarchyElement.`, `/filters/places/${i}`, 'unknown HierarchyElement');
      });
    };

    const checkTransport = (transport, endpoint) => {
      if (transport === 'webhook' && !endpoint) invalid('transport webhook requires endpoint.', '/endpoint', 'required for transport webhook');
    };

    // ---------- POST /webhooks ----------

    sim.on('post-webhooks', (ctx) => {
      const body = ctx.body;
      const transport = body.transport ?? 'webhook';
      checkTopics(ctx, body.topics);
      checkTransport(transport, body.endpoint);
      if (body.status === 'failed') invalid('failed is a server-assigned state (retry schedule exhausted); clients may set active or paused.', '/status', 'failed is server-assigned');
      if (transport === 'sse' && (body.secret !== undefined || body.secretRef !== undefined || body.keyId !== undefined)) {
        invalid('An SSE subscription has nothing to sign and takes no secret (Part 8 §8.1).', body.secret !== undefined ? '/secret' : body.secretRef !== undefined ? '/secretRef' : '/keyId', 'not applicable to transport sse');
      }
      if (body.retireKeyIds !== undefined) invalid('retireKeyIds applies to PATCH only.', '/retireKeyIds', 'PATCH only');
      // A stock APDS create (no Prefer) never sees a secret, so none is minted for it;
      // the client can rotate one in later. An APX create gets one, disclosed once.
      const representation = /return=representation/.test(ctx.headers.prefer ?? '');
      const issued = transport === 'webhook' ? newKey(sim, body, { mintIfAbsent: representation }) : null;
      checkTopicScopes(ctx, body.topics);
      checkFilterPlaces(ctx, body.filters);

      const pending = state.approval === 'operator';
      const fields = { ...body };
      for (const k of [...READ_ONLY, ...WRITE_ONLY]) delete fields[k];
      const keys = issued ? [issued.key] : [];
      const rec = subs().insert(
        {
          ...fields,
          topics: [...new Set(body.topics)],
          transport,
          ...(transport === 'webhook' ? { activeKeyIds: activeKeyIds(keys) } : {}),
          status: pending ? 'paused' : body.status ?? 'active',
          _grant: ctx.principal.hasGrant ? [...ctx.principal.places] : undefined,
          _org: orgOf(ctx.principal),
          _keys: keys,
          _held: [],
          _sseSeq: 0,
          _sseBuffer: [],
          ...(pending ? { _pending: true } : {}),
        },
        { assignedId: ctx.assignId ?? mintSubscriptionId(sim), actor: ctx.actor }
      );
      const idem = { collection: 'subscriptions', id: rec.id };
      if (representation) {
        return { status: 201, body: { ...subscriptionView(rec), ...(issued?.disclosed ? { secret: issued.disclosed } : {}) }, idem };
      }
      const code = pending ? 202 : 200;
      const message = pending ? 'Subscription request received; pending operator approval.' : 'Subscription approved and activated.';
      return { status: code, body: { status: 'ok', code, message, ids: [rec.id] }, idem };
    });

    // ---------- GET /webhooks, GET /webhooks/{id} ----------

    sim.on('get-webhooks', (ctx) => {
      const rows = subs().find((s) => (s._org ?? null) === orgOf(ctx.principal));
      return paginate(ctx, rows.map(subscriptionView));
    });

    sim.on('get-webhooks-id', (ctx) => subscriptionView(visible(ctx, ctx.params.id)));

    // ---------- PATCH /webhooks/{id} ----------

    sim.on('patch-webhooks-id', (ctx) => {
      const current = visible(ctx, ctx.params.id);
      const body = ctx.body ?? {};
      if (current.status === 'failed' && body.status !== 'active') {
        fail('subscription-failed', `Subscription ${current.id} exhausted its retry schedule at ${current._failedAt ?? 'an earlier attempt'}; PATCH status=active to resume before changing it.`);
      }
      checkPrecondition(ctx, current);
      if (body.status === 'failed') invalid('failed is a server-assigned state (retry schedule exhausted); clients may set active or paused.', '/status', 'failed is server-assigned');
      for (const k of READ_ONLY.filter((k) => k !== 'version')) if (body[k] !== undefined) invalid(`${k} is server-managed and cannot be patched.`, `/${k}`, 'server-managed');

      const next = mergePatch(current, body);
      checkTransport(next.transport, next.endpoint);
      if (body.topics) {
        checkTopics(ctx, body.topics);
        checkTopicScopes(ctx, body.topics);
      }
      if (body.filters) checkFilterPlaces(ctx, body.filters);

      const now = ctx.now();
      let keys = current._keys ?? [];
      if (next.transport === 'sse' && (body.secret !== undefined || body.secretRef !== undefined)) invalid('An SSE subscription has nothing to sign and takes no secret (Part 8 §8.1).', '/secret', 'not applicable to transport sse');
      const rotation = next.transport === 'webhook' ? newKey(sim, body, { mintIfAbsent: false }) : null;
      if (rotation) keys = addKey(keys, rotation.key);
      if (body.retireKeyIds?.length) keys = retireKeys(keys, body.retireKeyIds, now);
      if (next.transport === 'sse') keys = [];
      if (next.transport === 'webhook' && current.transport !== 'webhook' && !activeKeyIds(keys).length) invalid('transport webhook needs a signing key; send secret or secretRef with the change.', '/secret', 'required when switching to transport webhook');
      const { activeKeyIds: _drop, ...rest } = next;

      const resuming = body.status === 'active' && current.status !== 'active';
      const overlapEnded = Boolean(current._overlapTimer) && activeKeyIds(keys).length <= 1;
      if (overlapEnded) sim.clock.cancel(current._overlapTimer);
      subs().update(
        current.id,
        () => ({
          ...rest,
          ...(next.transport === 'webhook' ? { activeKeyIds: activeKeyIds(keys) } : {}),
          _keys: keys,
          ...(overlapEnded ? { _overlapTimer: undefined } : {}),
          ...(resuming ? { _pending: undefined, _failedAt: undefined, _failure: undefined } : {}),
        }),
        { actor: ctx.actor }
      );
      if (rotation && activeKeyIds(keys).length > 1) scheduleOverlapEnd(sim, current.id, rotation.key.keyId);
      if (resuming && current.status === 'paused') sim.events.resume(current.id);
      return subscriptionView(subs().get(current.id));
    });

    // ---------- DELETE /webhooks/{id} (native APDS ResponseStatus both ways) ----------

    sim.on('delete-webhooks-id', (ctx) => {
      const id = ctx.params.id;
      const rec = subs().get(id);
      if (!rec || (rec._org ?? null) !== orgOf(ctx.principal)) {
        return { status: 404, body: { status: 'error', code: 404, message: `No subscription ${id}.`, ids: [id] } };
      }
      for (const r of ledger().find((d) => d.subscription === id && d.nextTimer)) sim.clock.cancel(r.nextTimer);
      if (rec._overlapTimer) sim.clock.cancel(rec._overlapTimer);
      subs().delete(id);
      return { status: 200, body: { status: 'ok', code: 200, message: `Subscription ${id} revoked.`, ids: [id] } };
    });

    // ---------- GET /webhooks/{id}/deliveries ----------

    sim.on('get-webhooks-id-deliveries', (ctx) => {
      const sub = visible(ctx, ctx.params.id);
      const status = ctx.query.get('status');
      const eventId = ctx.query.get('eventId');
      const since = parseInstant(ctx.query.get('since'), 'since');
      const rows = ledger()
        .find((r) => r.subscription === sub.id && r.attempts > 0)
        .filter((r) => (!status || r.status === status) && (!eventId || r.eventId === eventId) && (since === undefined || Date.parse(r.time) >= since))
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
        .map((r) => sim.events.deliveryRecord(r));
      return paginate(ctx, rows);
    });

    // ---------- GET /v1/events/stream ----------

    sim.on('get-apx-v1-events-stream', (ctx) => {
      const id = ctx.query.get('subscription');
      const sub = subs().get(id);
      if (!sub || (sub._org ?? null) !== orgOf(ctx.principal)) notFound('subscription', id);
      if (sub.transport !== 'sse') fail('target-not-found', `Subscription ${id} has transport ${sub.transport}; the stream serves transport sse only.`);
      if (sub.status === 'failed') fail('subscription-failed', `Subscription ${id} is in state failed.`);
      const lastEventId = ctx.headers['last-event-id'];
      const pos = sim.events.sseFrames(id, lastEventId);
      if (pos.expired) {
        fail('stream-position-expired', `Last-Event-ID ${lastEventId} is older than the oldest buffered frame (${pos.oldest}); re-sync via the change feed, then reconnect without Last-Event-ID.`);
      }
      const headers = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' };
      // In-process callers (the replay runner) cannot read a stream: an
      // explicit Accept: text/event-stream gets the buffered frames as text.
      if (/text\/event-stream/.test(ctx.headers.accept ?? '')) return { status: 200, headers, body: pos.frames.map((f) => EventFabric.frame(f)).join('') };
      return {
        status: 200,
        headers,
        stream: ({ write, onClose }) => {
          for (const f of pos.frames) write(EventFabric.frame(f));
          onClose(sim.events.attachSse(id, (f) => write(EventFabric.frame(f))));
        },
      };
    });

    // ---------- hooks ----------

    // §8.1: `failed` is server-assigned. The fabric's transition bumps the
    // version; the suite treats server transitions as version-neutral (a
    // client's precondition stays valid), so restore it.
    sim.hooks.on('subscription.failed', ({ subscription }) => {
      const rec = subs().get(subscription.id);
      if (rec && rec.version > 1) subs().put({ ...rec, version: rec.version - 1 });
    });

    registerInjectors(sim, { state, subs });
  },
};

/**
 * A minted subscription id. With world.events.idPrefix (e.g. "e8") the
 * world numbers its subscriptions the way its cast does — the lowest free
 * `<prefix>000000-0000-4000-8000-0000000000NN` — else a random UUID.
 */
function mintSubscriptionId(sim) {
  const prefix = sim.world.events?.idPrefix;
  if (!prefix) return undefined;
  const subs = sim.store.collection('subscriptions');
  for (let n = 1; n <= subs.size() + 1; n += 1) {
    const id = `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    if (!subs.has(id)) return id;
  }
  return undefined;
}

/** RFC 7396 over the stored subscription; `filters` replaces wholesale (`{}` removes every filter), per ApxEventSubscriptionPatch. */
function mergePatch(current, body) {
  const next = { ...current };
  for (const [k, v] of Object.entries(body)) {
    if (k === 'version' || WRITE_ONLY.includes(k)) continue;
    if (v === null) delete next[k];
    else if (k === 'filters') {
      if (Object.keys(v).length) next.filters = v;
      else delete next.filters;
    } else if (k === 'extensions') next.extensions = mergeObject(current.extensions ?? {}, v);
    else if (k === 'topics') next.topics = [...new Set(v)];
    else next[k] = v;
  }
  return next;
}

function mergeObject(target, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...(target && typeof target === 'object' && !Array.isArray(target) ? target : {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergeObject(out[k], v);
  }
  return out;
}

/** End a rotation overlap 24 h after it began unless the client retires the old key first (Part 9 §9.4). */
function scheduleOverlapEnd(sim, id, keyId) {
  const subs = sim.store.collection('subscriptions');
  const prior = subs.get(id)?._overlapTimer;
  if (prior) sim.clock.cancel(prior);
  const timer = sim.clock.schedule(
    { delay: ROTATION_OVERLAP_MS },
    () => {
      const rec = subs.get(id);
      if (!rec) return;
      const keys = retireSuperseded(rec._keys ?? [], keyId, sim.clock.now());
      subs.update(id, (s) => ({ ...s, _keys: keys, activeKeyIds: activeKeyIds(keys), _overlapTimer: undefined }), { bump: false });
    },
    `rotation overlap end ${id}`
  );
  subs.update(id, (s) => ({ ...s, _overlapTimer: timer }), { bump: false });
}

/**
 * §8.5(3) / Part 9 §9.3: an event with no place binding and no owning
 * organisation may reach only a subscription whose grant is the wildcard
 * — "when in doubt, drop rather than leak". The fabric's matcher lets such
 * an event through to every unfiltered subscription; tighten it here.
 */
function workAroundFabric(sim) {
  const fabric = sim.events;
  if (fabric._eventsModuleMatcher) return;
  const base = fabric.matches.bind(fabric);
  fabric.matches = (sub, envelope, place, org) => {
    if (!base(sub, envelope, place, org)) return false;
    if (!place && !org) return Array.isArray(sub._grant) && sub._grant.includes('*');
    return true;
  };
  fabric._eventsModuleMatcher = true;
}
