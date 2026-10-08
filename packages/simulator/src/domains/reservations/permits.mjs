/**
 * apx-permits (Part 14 §14.2) — pooled RightSpecifications: pool selection
 * and PoolAvailability, the §14.2a issue refusals in order, the §14.2b
 * materialization onto a native AssignedRight (through `sim.data`, with
 * CredentialRecords via `sim.credentials` when the server claims
 * apx-credentials), renewals via `apds-ext:apx:permit@1.0`, and the §14.2c
 * pool accounting: a slot is taken when a right is created against a
 * pooled spec (issue or native POST) and returned on native DELETE or at
 * `expiry`, each change published as `apx.permits.pool.availability.v1`.
 *
 * Pool counters live in the RightSpecification's own `rightPools[]`
 * (`distributedAssignedRights` / `availableAssignedRights`); they are
 * server-maintained counters, so moving them does not version the spec.
 * Right hints: `_pool` (the RightPool the right holds a slot in),
 * `_released` (the slot went back).
 */
import { fail } from '../../kernel/problems.mjs';
import { parseInstant, wire, entry } from '../common.mjs';
import { PERMIT_EXT, iso, refOf, identificationsOf, holderOf, stateOf, TERMINAL } from './model.mjs';

const CREDENTIAL_TYPES = ['barcode', 'bluetooth', 'eticket', 'hangtag', 'licensePlate', 'permit', 'qrCode', 'rfid', 'ticket', 'electronicID', 'ticketcoupon', 'vehicleplate'];
const LIVE_RECORD = new Set(['issued', 'active', 'suspended', 'lost']);
const NO_GRANT = 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).';
const PASSED_MS = 1000; // an inclusive end instant "passes" one second later

export function createPermits(sim) {
  const specs = () => sim.store.collection('rightSpecs');
  const rights = () => sim.store.collection('assignedRights');
  const records = () => sim.credentials?.records?.() ?? null;
  let pending = null; // the pool an issue in progress selected, for the create hook
  let timers = new Map();

  const poolsOf = (spec) => (Array.isArray(spec?.rightPools) ? spec.rightPools : []);
  const isPooled = (spec) => poolsOf(spec).length > 0;
  const spanOf = (pool) => {
    const v = pool?.validity?.validityTimeSpecification;
    return { start: v?.overallStartTime ? Date.parse(v.overallStartTime) : -Infinity, end: v?.overallEndTime ? Date.parse(v.overallEndTime) : Infinity };
  };

  /** §14.2: `pool` by id, else the pool whose validity contains `at` (default now), else the earliest future pool. */
  function selectPool(spec, { pool, atMs } = {}) {
    const pools = poolsOf(spec);
    if (pool) return pools.find((p) => p.id === pool) ?? null;
    const t = atMs ?? sim.clock.nowMs();
    const containing = pools.find((p) => t >= spanOf(p).start && t <= spanOf(p).end);
    if (containing) return containing;
    return pools.filter((p) => spanOf(p).start > t).sort((a, b) => spanOf(a).start - spanOf(b).start)[0] ?? null;
  }

  const spaces = (poolId) => sim.world.permits?.spaces?.[poolId];

  function availability(spec, pool) {
    const issued = pool.distributedAssignedRights ?? 0;
    const available = pool.availableAssignedRights ?? 0;
    return {
      rightSpecification: { id: spec.id, version: spec.version, className: 'RightSpecification' },
      pool: { id: pool.id, version: pool.version ?? 1, className: 'RightPool' },
      ...(pool.validity ? { validity: pool.validity } : {}),
      capacity: issued + available,
      issued,
      available,
      ...(Number.isInteger(spaces(pool.id)) ? { spaces: spaces(pool.id) } : {}),
    };
  }

  /** Move `delta` slots from available to issued (negative: back), and say so (§14.2c). */
  function adjust(specId, poolId, delta) {
    const next = specs().update(
      specId,
      (s) => ({
        ...s,
        rightPools: poolsOf(s).map((p) =>
          p.id === poolId ? { ...p, distributedAssignedRights: Math.max(0, (p.distributedAssignedRights ?? 0) + delta), availableAssignedRights: Math.max(0, (p.availableAssignedRights ?? 0) - delta) } : p
        ),
      }),
      { bump: false }
    );
    const pool = poolsOf(next).find((p) => p.id === poolId);
    sim.events.publish({ type: 'apx.permits.pool.availability.v1', data: availability(next, pool), subject: refOf(next.id, 'RightSpecification'), place: next._place ?? null });
  }

  const hint = (id, patch) => rights().update(id, (r) => ({ ...r, ...patch }), { bump: false });

  /** Return a right's slot to its pool, once. */
  function release(id, record = rights().get(id)) {
    if (!record?._pool || record._released) return;
    if (specs().has(record.rightSpecification?.id)) adjust(record.rightSpecification.id, record._pool, -1);
    if (rights().has(id)) hint(id, { _released: true });
  }

  function scheduleExpiry(r) {
    if (timers.has(r.id)) sim.clock.cancel(timers.get(r.id));
    timers.delete(r.id);
    if (!r._pool || r._released || !r.expiry) return;
    const expiry = r.expiry;
    const at = Date.parse(expiry) + PASSED_MS;
    timers.set(
      r.id,
      sim.clock.schedule(
        at,
        () => {
          const x = rights().get(r.id);
          if (x?.expiry === expiry) release(r.id, x);
        },
        `permit ${r.id} expiry`
      )
    );
  }

  const startMs = (r) => {
    const s = r.plannedUses?.[0]?.startTime;
    return s ? Date.parse(s) : undefined;
  };

  /** Seed: rights already counted in the world's pool counters get their `_pool`, and their expiry armed. */
  function seed() {
    timers = new Map();
    pending = null;
    for (const r of rights().all()) {
      const spec = specs().get(r.rightSpecification?.id);
      if (!isPooled(spec)) continue;
      const pool = r._pool ? { id: r._pool } : selectPool(spec, { atMs: startMs(r) });
      if (!pool) continue;
      const expired = r.expiry && Date.parse(r.expiry) + PASSED_MS <= sim.clock.nowMs();
      hint(r.id, { _pool: pool.id, ...(expired ? { _released: true } : {}) });
      scheduleExpiry(rights().get(r.id));
    }
  }

  /** `assignedRights.changed`: take a slot on create, give it back on delete or when expiry passes. */
  function onRightChanged({ record, previous, deleted }) {
    if (deleted) {
      if (timers.has(record.id)) sim.clock.cancel(timers.get(record.id));
      release(record.id, record);
      return;
    }
    const spec = specs().get(record.rightSpecification?.id);
    if (!isPooled(spec)) return;
    if (!previous && !record._pool) {
      const pool = pending?.pool ?? selectPool(spec, { atMs: startMs(record) });
      if (!pool || (pool.availableAssignedRights ?? 0) <= 0) return;
      adjust(spec.id, pool.id, +1);
      hint(record.id, { _pool: pool.id });
    }
    const now = rights().get(record.id);
    if (now?.expiry && Date.parse(now.expiry) <= sim.clock.nowMs()) release(now.id, now);
    else if (now && previous?.expiry !== now.expiry) scheduleExpiry(now);
    else if (now && !previous) scheduleExpiry(now);
  }

  // ---------- reads ----------

  function visibleSpec(ctx, id, { body = false } = {}) {
    const spec = specs().get(id);
    if (!spec) fail(body ? 'reference-unknown' : 'target-not-found', `No RightSpecification ${id} visible to this credential.`);
    if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
    if (spec._place && !ctx.hierarchy.covers(ctx.principal.places, spec._place)) {
      fail('insufficient-grant', `RightSpecification ${id} is available at place ${spec._place}, which is not in the token's apx_places grant.`);
    }
    return spec;
  }

  /** GET /v1/permits/pools/{rightSpecId}/availability */
  function getAvailability(ctx) {
    const spec = visibleSpec(ctx, ctx.params.rightSpecId);
    if (!isPooled(spec)) fail('target-not-found', `RightSpecification ${spec.id} has no RightPool; it is not a pooled permit specification.`);
    const atMs = parseInstant(ctx.query.get('at'), 'at');
    const poolId = ctx.query.get('pool');
    const pool = selectPool(spec, { pool: poolId, atMs });
    if (!pool) fail('target-not-found', poolId ? `RightSpecification ${spec.id} has no RightPool ${poolId}.` : `RightSpecification ${spec.id} has no RightPool current at ${ctx.query.get('at') ?? ctx.now()} or later.`);
    return availability(spec, pool);
  }

  // ---------- issue ----------

  const holderKnown = (id) =>
    (sim.world.rightHolders ?? []).some((h) => h.id === id) || sim.store.collection('contacts').has(id) || sim.store.collection('accounts').has(id);

  const active = (r) => !r._released && !TERMINAL.has(stateOf(r)) && (!r.expiry || Date.parse(r.expiry) > sim.clock.nowMs());

  /** §14.2a(6): the active right at the same place that already carries the identification, for another holder. */
  function inUse(type, value, place, holder) {
    const recs = records();
    const right = rights().first(
      (r) => active(r) && holderOf(r) !== holder && r._place && place && (sim.hierarchy.within(r._place, place) || sim.hierarchy.within(place, r._place)) && identificationsOf(r, recs).some((c) => c.type === type && c.value === value)
    );
    if (right) return `${type} ${value} is an active credential on AssignedRight ${right.id}${holderOf(right) ? ` (holder ${holderOf(right)})` : ''}${right.expiry ? ` until ${right.expiry}` : ''}.`;
    const rec = recs?.first((r) => r.credentialType === type && r.credentialIdentification === value && LIVE_RECORD.has(r.credentialStatus) && r.holder?.id && r.holder.id !== holder);
    return rec ? `${type} ${value} is held by a non-terminal credential record.` : null;
  }

  /** One calendar month from `ms`, inclusive end (the default term when neither the request nor the pool gives a window). */
  const monthFrom = (ms) => {
    const d = new Date(ms);
    d.setUTCMonth(d.getUTCMonth() + (sim.world.permits?.defaultTermMonths ?? 1));
    return d.getTime() - 1000;
  };

  function windowFor(validity, pool, nowMs) {
    if (validity?.start || validity?.end) {
      const start = validity.start ?? iso(nowMs);
      return { start, end: validity.end ?? iso(monthFrom(Date.parse(start))) };
    }
    const v = pool.validity?.validityTimeSpecification;
    if (v?.overallStartTime && v?.overallEndTime) return { start: v.overallStartTime, end: v.overallEndTime };
    return { start: iso(nowMs), end: iso(monthFrom(nowMs)) };
  }

  /** §14.2b rule 3: the identifier of a vehicle credential — a CredentialRecord when the server claims apx-credentials. */
  function vehicleIdentifier(c, { rightId, holder, place, window, ctx }) {
    const recs = records();
    if (!recs) return { id: c.credentialIdentification, className: c.credentialType };
    const rightRef = refOf(rightId, 'AssignedRight');
    const existing = recs.first((r) => r.credentialType === c.credentialType && r.credentialIdentification === c.credentialIdentification && LIVE_RECORD.has(r.credentialStatus));
    if (existing) {
      recs.update(existing.id, (r) => ({ ...r, assignedRights: [...(r.assignedRights ?? []).filter((a) => a.id !== rightId), rightRef] }), { bump: false });
      return refOf(existing.id, 'CredentialRecord');
    }
    const now = ctx.now();
    const actor = ctx.principal.user ?? ctx.principal.sub;
    const rec = recs.insert(
      {
        credentialType: c.credentialType,
        credentialIdentification: c.credentialIdentification,
        credentialAssignedType: 'vehicle',
        holder,
        assignedRights: [rightRef],
        places: [{ id: place, className: 'Place' }],
        validity: { start: window.start, end: window.end },
        media: { form: 'virtual' },
        credentialStatus: 'active',
        statusHistory: [entry('issued', now, actor, `permit ${rightId}`), entry('active', now, actor)],
        _places: [place],
        _place: place,
        _org: ctx.principal.orgRef,
      },
      { actor: ctx.actor }
    );
    sim.events.publish({ type: 'apx.credentials.status.v1', data: wire(rec), subject: refOf(rec.id, 'CredentialRecord'), place, org: ctx.principal.orgRef?.id ?? null });
    return refOf(rec.id, 'CredentialRecord');
  }

  /** The §14.2a checks, in the order the Part lists them; returns what the issue needs. */
  function check(ctx) {
    const b = ctx.body;
    const creds = b.credentials ?? [];
    creds.forEach((c, i) => {
      if (c.credentialType !== undefined && !CREDENTIAL_TYPES.includes(c.credentialType)) {
        fail('invalid-request', `credentialType ${c.credentialType} is not an APDS CredentialTypeEnum value.`, { errors: [{ pointer: `/credentials/${i}/credentialType`, detail: 'not a CredentialTypeEnum value' }] });
      }
      if (!c.credentialType || !c.credentialIdentification) {
        fail('invalid-request', `credentials[${i}] needs credentialType and credentialIdentification.`, { errors: [{ pointer: `/credentials/${i}`, detail: 'credentialType and credentialIdentification required' }] });
      }
    });
    const start = parseInstant(b.validity?.start, 'validity/start');
    const end = parseInstant(b.validity?.end, 'validity/end');
    if (start !== undefined && end !== undefined && end <= start) {
      fail('invalid-request', `validity.end ${b.validity.end} does not follow validity.start ${b.validity.start}.`, { errors: [{ pointer: '/validity/end', detail: 'must follow start' }] });
    }
    const spec = visibleSpec(ctx, b.rightSpecification.id, { body: true });
    if (!holderKnown(b.holder.id)) fail('reference-unknown', `No RightHolder ${b.holder.id} at this implementation (holder ids are local, Part 14 §14.1a).`);
    if (b.rightSpecification.version !== spec.version) {
      fail('version-conflict', `RightSpecification ${spec.id} is at version ${spec.version}; the request names version ${b.rightSpecification.version}.`, { currentVersion: spec.version });
    }
    if (!isPooled(spec)) fail('request-unprocessable', `RightSpecification ${spec.id} v${spec.version} has no RightPool; not a pooled RightSpecification, and permits are issued only from pooled specifications (Part 14 §14.2).`);
    const allowed = Array.isArray(spec.credentials) ? spec.credentials : null;
    for (const c of creds) {
      if (allowed && !allowed.includes(c.credentialType)) {
        fail('request-unprocessable', `RightSpecification ${spec.id} v${spec.version} allows credentials [${allowed.join(', ')}]; ${c.credentialType} is not among them.`);
      }
    }
    for (const c of creds) {
      const why = inUse(c.credentialType, c.credentialIdentification, spec._place, b.holder.id);
      if (why) fail('credential-identification-in-use', why);
    }
    const pool = selectPool(spec, { atMs: start });
    if (!pool) fail('request-unprocessable', `RightSpecification ${spec.id} v${spec.version} has no RightPool covering ${b.validity?.start ?? ctx.now()} or later.`);
    if ((pool.availableAssignedRights ?? 0) <= 0) {
      const total = (pool.distributedAssignedRights ?? 0) + (pool.availableAssignedRights ?? 0);
      fail('pool-exhausted', `RightSpecification ${spec.id} v${spec.version}: ${pool.distributedAssignedRights ?? 0} of ${total} assigned rights issued; none available.`);
    }
    return { spec, pool };
  }

  /** POST /v1/permits/issue */
  function issue(ctx) {
    const b = ctx.body;
    const { spec, pool } = check(ctx);
    const id = ctx.assignId && !rights().has(ctx.assignId) ? ctx.assignId : crypto.randomUUID();
    const nowMs = ctx.clock.nowMs();
    const window = windowFor(b.validity, pool, nowMs);
    const holder = { id: b.holder.id, className: b.holder.className ?? 'RightHolder' };
    const vehicles = (b.credentials ?? []).map((c) => ({
      credentialAssignedType: 'vehicle',
      type: c.credentialType,
      identifier: vehicleIdentifier(c, { rightId: id, holder, place: spec._place, window, ctx }),
    }));
    const record = {
      id,
      version: 1,
      rightSpecification: { id: spec.id, version: spec.version, className: 'RightSpecification' },
      rightHolder: { credentials: [{ credentialAssignedType: 'customer', type: 'permit', identifier: holder }, ...vehicles] },
      issueMethod: 'permit',
      issuanceTime: ctx.now(),
      plannedUses: [{ startTime: window.start, endTime: window.end }],
      expiry: window.end,
      ...(b.extensions ? { extensions: b.extensions } : {}),
    };
    pending = { pool };
    let created;
    try {
      created = sim.data.create('assignedRights', record, ctx.principal);
    } finally {
      pending = null;
    }
    const renews = b.extensions?.[PERMIT_EXT]?.renews;
    const old = renews?.id ? rights().get(renews.id) : null;
    if (old) {
      const ext = { ...(old.extensions?.[PERMIT_EXT] ?? {}), renewedBy: refOf(created.id, 'AssignedRight') };
      sim.data.change('assignedRights', old.id, { extensions: { ...(old.extensions ?? {}), [PERMIT_EXT]: ext } }, ctx.principal);
    }
    const stored = rights().get(created.id);
    return { status: 201, body: sim.data.wireOf('assignedRights', stored), idem: { collection: 'assignedRights', id: stored.id } };
  }

  /** Injector: a permit ends now (or at `time`) and its slot goes back (§14.2c). */
  function expire({ permit, time }) {
    const r = rights().get(permit);
    if (!r) throw new Error(`no AssignedRight ${permit}`);
    const at = time ?? sim.clock.now();
    const uses = (r.plannedUses ?? []).map((u, i) => (i === 0 ? { ...u, expiryTime: at } : u));
    sim.data.change('assignedRights', permit, { expiry: at, ...(uses.length ? { plannedUses: uses } : {}) });
    release(permit);
    return sim.data.wireOf('assignedRights', rights().get(permit));
  }

  return { seed, onRightChanged, getAvailability, issue, expire, selectPool, availability, isPooled };
}
