/**
 * The generic native CRUD handlers (Part 5): list (full, `modified_since`
 * with `deletedReferences`, or the §5.2 change feed), read (with
 * `?version=`), create with client-supplied ids, full/change-mode update
 * with the version precondition, and delete with tombstones — each with
 * the Part 9 grant check on the record's place and the §5.1a dialect.
 */
import { fail } from '../../kernel/problems.mjs';
import { validateRequestBranch, fmtErrors, ajvToErrors } from '../../kernel/spec.mjs';
import { paginate } from '../common.mjs';
import { isUuid, refuse, ok, epochParam, filterSet } from './model.mjs';

export function createRoutes(sim, engine, feed) {
  const coll = (cls) => engine.coll(cls.collection);
  const pathId = (ctx) => ctx.params.id ?? ctx.params.contactId;

  function requireGrantClaim(ctx) {
    if (!ctx.principal.hasGrant) fail('insufficient-grant', 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).');
  }

  /** Each `place` filter id the hierarchy knows must lie inside the grant. */
  function placeFilter(ctx) {
    const ids = ctx.query.list('place');
    for (const id of ids) {
      if (sim.hierarchy.has(id) && !sim.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
    }
    return ids;
  }

  /** The grant check on the places a body binds its record to; an unknown place reference is a 400. */
  function authorize(ctx, cls, body) {
    requireGrantClaim(ctx);
    for (const p of engine.boundPlaces(cls.collection, body)) {
      if (!sim.hierarchy.has(p)) refuse(ctx, 400, 'invalid-request', `${cls.label} references element ${p}, which this server does not hold.`, [p]);
      if (!sim.hierarchy.covers(ctx.principal.places, p)) fail('insufficient-grant', `${cls.label} ${body.id ?? ''} is bound to place ${p}, outside the token's apx_places grant.`.replace(/\s+/g, ' '));
    }
  }

  const modifiedMs = (r) => Date.parse(r._modified ?? r.recordInfo?.lastUpdate ?? sim.world.clock?.start);

  function list(ctx, cls, { predicate, flat = false } = {}) {
    requireGrantClaim(ctx);
    const places = placeFilter(ctx);
    const mode = ctx.query.get('mode') ?? 'full';
    if (mode !== 'full' && mode !== 'change') refuse(ctx, 400, 'invalid-request', `mode must be full or change, not ${mode}.`);
    if (mode === 'change' && cls.prefix) return feed.page(ctx, cls, { filter: filterSet(ctx), placeFilter: places, predicate });
    const since = epochParam(ctx, 'modified_since');
    const rows = coll(cls).find((r) => {
      const bound = engine.placesOf(cls.collection, r);
      if (!engine.covered(ctx.principal, bound)) return false;
      if (places.length && !engine.inFilter(bound, places)) return false;
      if (since !== undefined && modifiedMs(r) < since) return false;
      return predicate ? predicate(r) : true;
    });
    const body = paginate(ctx, rows.map((r) => engine.wireOf(cls, r)));
    if (since !== undefined) {
      body.deletedReferences = [...engine.tombstones(cls.collection).values()]
        .filter((t) => Date.parse(t.deleteTimestamp) >= since && engine.covered(ctx.principal, t._places) && (!places.length || engine.inFilter(t._places, places)))
        .map((t) => ({ id: t.id, className: t.className, deleteTimestamp: t.deleteTimestamp }));
    }
    if (!flat) return body;
    const { meta, ...rest } = body;
    return { ...meta, ...rest };
  }

  /** Path-id lookup with §9.3a: missing → 404 (ResponseStatus dialect), outside the grant → 403. */
  function visible(ctx, cls, id, verb) {
    const rec = coll(cls).get(id);
    if (!rec) refuse(ctx, 404, 'target-not-found', verb ? `${cls.label} can not be ${verb} as it has not been found.` : `${cls.label} not found.`, [id]);
    requireGrantClaim(ctx);
    const bound = engine.placesOf(cls.collection, rec);
    if (!engine.covered(ctx.principal, bound)) fail('insufficient-grant', `${cls.label} ${id} is at place ${bound[0]}, which is not in the token's apx_places grant.`);
    return rec;
  }

  function read(ctx, cls) {
    const id = pathId(ctx);
    const rec = visible(ctx, cls, id);
    const v = ctx.query.int('version');
    if (v === undefined || v === rec.version) return engine.wireOf(cls, rec);
    const old = engine.versionOf(cls.collection, id, v);
    if (!old) refuse(ctx, 404, 'target-not-found', `${cls.label} ${id} has no version ${v} on this server.`, [id]);
    return old;
  }

  function create(ctx, cls) {
    const body = ctx.body;
    if (body.id !== undefined && engine.exists(cls.collection, body.id)) {
      refuse(ctx, 409, 'id-collision', `${cls.label} can not be created due to conflict: id already exists.`, [body.id]);
    }
    authorize(ctx, cls, body);
    const rec = engine.create(cls, body, { principal: ctx.principal, assignedId: ctx.assignId });
    return ok(cls.createStatus, `${cls.label} created successfully.`, [rec.id], { etag: `"${rec.version}"` });
  }

  function validateBranch(ctx, cls, body, mode, verb = 'updated') {
    const errors = validateRequestBranch(ctx.op, body, mode === 'change' ? 1 : 0);
    if (errors) {
      refuse(ctx, 400, 'invalid-request', `${cls.label} can not be ${verb} due to invalid data (${mode} mode): ${fmtErrors(errors).slice(0, 300)}`, undefined, { errors: ajvToErrors(errors) });
    }
  }

  function update(ctx, cls) {
    const id = pathId(ctx);
    const mode = String(ctx.headers['apx-update-mode'] ?? 'full').toLowerCase();
    if (mode !== 'full' && mode !== 'change') refuse(ctx, 400, 'invalid-request', `APX-Update-Mode must be full or change, not ${mode}.`);
    const body = ctx.body;
    validateBranch(ctx, cls, body, mode);
    if (body.id !== undefined && body.id !== id) refuse(ctx, 400, 'invalid-request', `Body id ${body.id} does not match the path id ${id}.`, [id]);
    if (!coll(cls).has(id)) {
      if (cls.upsert && mode === 'full' && !engine.exists(cls.collection, id)) {
        authorize(ctx, cls, { ...body, id });
        const rec = engine.create(cls, { ...body, id }, { principal: ctx.principal });
        return ok(201, `${cls.label} created successfully.`, [rec.id], { etag: `"${rec.version}"` });
      }
      refuse(ctx, 404, 'target-not-found', `${cls.label} can not be updated as it has not been found.`, [id]);
    }
    const current = visible(ctx, cls, id, 'updated');
    const expected = ctx.ifMatch ?? (typeof body.version === 'number' ? body.version : undefined);
    if (expected !== undefined && expected !== current.version) {
      refuse(ctx, 409, 'version-conflict', `${cls.label} can not be updated due to conflict: version ${expected} is stale, current version is ${current.version}.`, [id]);
    }
    const next = mode === 'change' ? engine.preview(cls, id, body) : { ...body, id };
    if (mode === 'change') validateBranch(ctx, cls, next, 'full');
    authorize(ctx, cls, next);
    const stored = mode === 'change' ? engine.change(cls, id, body, { principal: ctx.principal }) : engine.replace(cls, id, body, { principal: ctx.principal });
    return ok(200, `${cls.label} updated successfully.`, [id], { etag: `"${stored.version}"` });
  }

  // ---------- delete guards: what keeps a record alive ----------

  const openSessionsWithin = (placeId) => engine.coll('sessions').find((s) => !s.actualEnd && s._place && sim.hierarchy.within(s._place, placeId));

  function referencesContact(record, contactId) {
    if ((record._contacts ?? []).includes(contactId)) return true;
    const walk = (v) => (Array.isArray(v) ? v.some(walk) : v && typeof v === 'object' ? v.contactReference?.id === contactId || Object.values(v).some(walk) : false);
    return walk(record.contacts);
  }

  function blockers(cls, rec) {
    switch (cls.collection) {
      case 'places': {
        const kids = [...engine.coll('places').find((p) => p.parentId?.id === rec.id).map((p) => p.id), ...sim.hierarchy.all().filter((n) => n.kind !== 'place' && n.parentId === rec.id).map((n) => n.id)];
        const open = openSessionsWithin(rec.id).map((s) => s.id);
        return kids.length || open.length ? { why: `element has ${kids.length} child element(s) and ${open.length} open session(s)`, ids: [...kids, ...open] } : null;
      }
      case 'sessions':
        return rec.actualEnd ? null : { why: 'session is still open (no actualEnd)', ids: [rec.id] };
      case 'rateTables': {
        const specs = engine.coll('rightSpecs').find((s) => (s.rateEligibility ?? []).some((e) => e?.rateTable?.id === rec.id)).map((s) => s.id);
        return specs.length ? { why: 'referenced by RightSpecification rateEligibility', ids: specs } : null;
      }
      case 'rightSpecs': {
        const rights = engine.coll('assignedRights').find((a) => a.rightSpecification?.id === rec.id).map((a) => a.id);
        return rights.length ? { why: `${rights.length} assigned right(s) are outstanding against it`, ids: rights } : null;
      }
      case 'assignedRights': {
        const open = engine.coll('sessions').find((s) => !s.actualEnd && (s.segments ?? []).some((g) => g?.assignedRight?.id === rec.id)).map((s) => s.id);
        return open.length ? { why: 'session in progress', ids: open } : null;
      }
      case 'contacts': {
        const places = engine.coll('places').find((p) => referencesContact(p, rec.id)).map((p) => p.id);
        return places.length ? { why: `referenced by ${places.length} hierarchy element(s)`, ids: places } : null;
      }
      default:
        return null;
    }
  }

  function remove(ctx, cls, { checkUuid = true } = {}) {
    const id = pathId(ctx);
    if (checkUuid && !isUuid(id)) refuse(ctx, 400, 'invalid-request', `${cls.label} can not be deleted due to malformed id: ${id} is not a UUID.`);
    const rec = visible(ctx, cls, id, 'deleted');
    const block = blockers(cls, rec);
    // Part 12 registers no 409 type for a delete held back by references; the closest rule is request-unprocessable.
    if (block) refuse(ctx, 409, 'request-unprocessable', `${cls.label} can not be deleted due to conflict: ${block.why}.`, block.ids);
    engine.remove(cls, id);
    return ok(200, `${cls.label} deleted successfully.`, [id]);
  }

  return { list, read, create, update, remove, visible, authorize, requireGrantClaim, placeFilter };
}
