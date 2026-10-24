/**
 * apx-data (Part 5): the APDS-native routes (/places, /observations,
 * /contacts, /rights/specs, /rights/assigned, /rates, /sessions, /quotes,
 * and their by-id routes)
 * with client-supplied ids, full vs change update modes, the §5.1a error
 * dialect, the §5.2 change feed, the §5.4 native events, and the §5.5
 * occupancy snapshot at GET /v1/places/{id}/occupancy, and the §5.9
 * stay-compliance decoration on Sessions (data/compliance.mjs).
 *
 * World sections read: places[] (+ apdsPlaces{} — the APDS document of an
 * element, keyed by id), sessions[], rateTables[], rightSpecs[],
 * assignedRights[], observations[], contacts[], quotes[] (rows may carry
 * `_versions: [older snapshots]` and `_` hints), dataFeed { pageSize,
 * history: { <collection>: [ {cursor, credential, filter, issuedAt} |
 * {id, version, time} | {id, deleted: true, time, className, places} ] } },
 * occupancy { thresholds, delta }.
 *
 * Hooks emitted: `<collection>.changed` { collection, record, previous,
 * deleted } on every native write; `observation.ingested` { element,
 * place, lane }; `occupancy.changed` { place, snapshot, previous }.
 */
import { parseDuration } from '../kernel/clock.mjs';
import { fail } from '../kernel/problems.mjs';
import { uuid } from '../kernel/store.mjs';
import { wire } from './common.mjs';
import { CLASSES, plain, classNameOfType, route, refuse, ok } from './data/model.mjs';
import { createEngine } from './data/engine.mjs';
import { createFeed } from './data/feed.mjs';
import { createOccupancy } from './data/occupancy.mjs';
import { priceTable } from './data/pricing.mjs';
import { createRoutes } from './data/routes.mjs';
import { createCompliance } from './data/compliance.mjs';

/** How long a quoted price holds (the RSV-01 option expires thirty minutes after the response). */
const QUOTE_TTL_MS = 30 * 60_000;
const SEED_ORDER = ['rightSpecs', 'rateTables', 'assignedRights', 'sessions', 'observations', 'contacts'];
const HIERARCHY_TYPES = new Set(['campus', 'identifiedArea', 'place', 'space', 'subplaceElement', 'specificArea', 'vehicularAccess', 'electricChargingEquipment', 'supplementalEquipment', 'supplementalServiceFacility']);

/** CRUD operationIds per class: [list, create, read, update, delete]. */
const OPERATIONS = {
  places: ['get-places', 'create-place', 'get-place', 'update-place', 'delete-place'],
  contacts: ['get-contacts', 'post-contact', 'get-single-contact', 'put-contact', 'delete-contact'],
  rightSpecs: ['get-right_specs', 'create-right_specs', 'get-right_spec', 'update-right_spec', 'delete-right_spec'],
  rateTables: ['get-rates', 'create-rate', 'get-rate', 'update-rate', 'delete-rate'],
  sessions: ['get-sessions', 'create-session', 'get-session', 'update-session', 'delete-session'],
  assignedRights: ['get-assigned_rights', 'create-assigned_right', 'get-assigned_right', 'update-assigned_right', 'delete-assigned_right'],
};

export default {
  name: 'data',
  register(sim) {
    const engine = createEngine(sim);
    const feed = createFeed(sim, engine);
    const occupancy = createOccupancy(sim, engine);
    const routes = createRoutes(sim, engine, feed);
    const compliance = createCompliance(sim, engine);
    let directoryDown = false;

    // ---------- seeding ----------

    function depthOf(p, byId) {
      let d = 0;
      for (let cur = p; cur?.parentId && d < 32; cur = byId.get(cur.parentId)) d += 1;
      return d;
    }

    /** The APDS document of a world place: `apdsPlaces[id]` when given, else derived from the cast entry. */
    function apdsPlace(world, p, byId) {
      if (world.apdsPlaces?.[p.id]) return { id: p.id, ...world.apdsPlaces[p.id] };
      const layer = depthOf(p, byId);
      const lowered = typeof p.type === 'string' ? p.type[0].toLowerCase() + p.type.slice(1) : undefined;
      const type = HIERARCHY_TYPES.has(lowered) ? lowered : layer === 0 ? 'place' : 'identifiedArea';
      const operator = sim.hierarchy.operatorOf(p.id);
      const version = p.version ?? 1;
      const parent = p.parentId ? byId.get(p.parentId) : null;
      return {
        id: p.id,
        version,
        type,
        name: [{ language: 'en', string: p.name ?? p.id }],
        layer,
        ...(parent ? { parentId: { id: parent.id, version: parent.version ?? 1, className: layer === 1 ? 'Place' : 'IdentifiedArea' } } : {}),
        hierarchyElementRecord: { creationTime: world.clock?.start ?? sim.clock.now(), ...(operator ? { creator: { id: operator, version: 1, className: 'Organisation' } } : {}) },
        ...(layer === 0 ? { timeZone: p.timeZone ?? 'UTC' } : {}),
        ...(Number.isInteger(p.supplyQuantity)
          ? { hierarchyElementReference: { elementId: { id: p.id, version, className: classNameOfType(type) }, supply: [{ supplyViewType: 'spaceView', supplyQuantity: p.supplyQuantity }] } }
          : {}),
      };
    }

    function replayHistory(world) {
      for (const [collection, entries] of Object.entries(world.dataFeed?.history ?? {})) {
        const cls = CLASSES[collection];
        if (!cls) throw new Error(`dataFeed.history names unknown collection ${collection}`);
        for (const e of entries) {
          if (e.cursor) {
            feed.issueAt({ name: e.cursor, cls, credential: e.credential, filter: e.filter ?? {}, grant: world.credentials?.[e.credential]?.apx_places, issuedAt: e.issuedAt });
          } else engine.logHistory(cls, e);
        }
      }
    }

    sim.seed((world) => {
      engine.reset();
      feed.reset();
      occupancy.reset();
      directoryDown = false;
      const byId = new Map((world.places ?? []).map((p) => [p.id, p]));
      for (const p of world.places ?? []) engine.seed(CLASSES.places, apdsPlace(world, p, byId));
      for (const name of SEED_ORDER) for (const row of world[name] ?? []) engine.seed(CLASSES[name], row);
      for (const q of world.quotes ?? []) if (!sim.store.collection('quotes').has(q.id)) sim.store.collection('quotes').put(q);
      replayHistory(world);
    });

    sim.hooks.on('places.changed', (change) => occupancy.onPlaceChanged(change));

    // ---------- the generic native CRUD routes ----------

    // Sessions carry the §5.9 decoration: its write rules run before the write, its read scope after the read.
    const guarded = (collection) =>
      collection === 'sessions'
        ? { read: compliance.guardRead, create: (fn) => compliance.guardWrite(fn, (ctx) => ctx.body?.id), update: (fn) => compliance.guardWrite(fn, (ctx) => ctx.params.id) }
        : { read: (fn) => fn, create: (fn) => fn, update: (fn) => fn };

    for (const [collection, [listOp, createOp, readOp, updateOp, deleteOp]] of Object.entries(OPERATIONS)) {
      const cls = CLASSES[collection];
      const directory = collection === 'contacts';
      const guard = guarded(collection);
      const down = () => (directory && directoryDown ? { status: 500, body: { status: 'error', code: 500, message: 'internal server error: contact directory unavailable' } } : null);
      sim.on(listOp, route(guard.read((ctx) => down() ?? routes.list(ctx, cls, { predicate: listFilter(collection, ctx) }))));
      sim.on(createOp, route(guard.create((ctx) => routes.create(ctx, cls))));
      sim.on(readOp, route(guard.read((ctx) => down() ?? routes.read(ctx, cls))));
      sim.on(updateOp, route(guard.update((ctx) => routes.update(ctx, cls))), { skipBodyValidation: true });
      sim.on(deleteOp, route((ctx) => routes.remove(ctx, cls, { checkUuid: !directory })));
    }

    // ---------- the native list filters each class declares ----------

    const instantMs = (v) => (v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v));
    const timeWindow = (ctx, start, end) => {
      const [sb, sa, eb, ea] = ['start_before', 'start_after', 'end_before', 'end_after'].map((n) => instantMs(ctx.query.get(n)));
      return (r) => {
        const s = start(r) ? Date.parse(start(r)) : undefined;
        const e = end(r) ? Date.parse(end(r)) : undefined;
        if (sb !== undefined && !(s < sb)) return false;
        if (sa !== undefined && !(s > sa)) return false;
        if (eb !== undefined && !(e < eb)) return false;
        if (ea !== undefined && !(e > ea)) return false;
        return true;
      };
    };
    // §14.2b: credential_id resolves against the identification string the lane reads, whichever
    // identifier form was materialized — the string itself, or a Reference to a CredentialRecord (Part 21).
    const identificationOf = (c) => {
      const ref = c?.identifier;
      if (ref?.className !== 'CredentialRecord') return ref?.id;
      return sim.credentials?.records?.().get(ref.id)?.credentialIdentification ?? ref.id;
    };
    const credentialsOf = (list) => (list ?? []).map((c) => ({ ids: [identificationOf(c), c?.identifier?.id], type: c?.type }));
    const anyIn = (values, wanted) => !wanted.length || values.some((v) => wanted.includes(v));

    function listFilter(collection, ctx) {
      const q = ctx.query;
      const tests = [];
      const has = (n) => q.list(n).length > 0;
      if (collection === 'places') {
        if (has('type')) tests.push((r) => q.list('type').includes(r.type));
        if (q.has('layer')) tests.push((r) => r.layer === q.int('layer'));
        if (q.has('name')) tests.push((r) => (r.name ?? []).some((n) => n.string?.toLowerCase().includes(q.get('name').toLowerCase())));
        if (q.has('operator')) tests.push((r) => sim.hierarchy.operatorOf(r.id) === q.get('operator'));
      }
      if (collection === 'sessions' || collection === 'assignedRights') {
        const creds = (r) => credentialsOf(collection === 'sessions' ? r.identifiedCredentials : r.rightHolder?.credentials);
        if (has('credential_id')) tests.push((r) => anyIn(creds(r).flatMap((c) => c.ids), q.list('credential_id')));
        if (has('credential_type')) tests.push((r) => anyIn(creds(r).map((c) => c.type), q.list('credential_type')));
        const specOf = (r) => (collection === 'assignedRights' ? [r.rightSpecification?.id] : (r.segments ?? []).map((g) => engine.coll('assignedRights').get(g?.assignedRight?.id)?.rightSpecification?.id));
        if (has('right_spec')) tests.push((r) => anyIn(specOf(r), q.list('right_spec')));
        if (has('right_type')) tests.push((r) => anyIn(specOf(r).map((id) => engine.coll('rightSpecs').get(id)?.type), q.list('right_type')));
        tests.push(collection === 'sessions' ? timeWindow(ctx, (r) => r.actualStart, (r) => r.actualEnd) : timeWindow(ctx, (r) => r.issuanceTime, (r) => r.expiry));
      }
      if (collection === 'rightSpecs' && has('type')) tests.push((r) => q.list('type').includes(r.type));
      if ((collection === 'rightSpecs' || collection === 'rateTables') && q.has('issuer')) {
        tests.push((r) => (r.issuer ?? r.rateResponsibleParty)?.id === q.get('issuer'));
      }
      if (collection === 'rateTables' && has('right_spec')) {
        tests.push((r) => q.list('right_spec').some((id) => (engine.coll('rightSpecs').get(id)?.rateEligibility ?? []).some((e) => e?.rateTable?.id === r.id)));
      }
      if (collection === 'contacts' && q.has('type')) tests.push((r) => r.type === q.get('type'));
      if (collection === 'observations') tests.push(timeWindow(ctx, (r) => r.observationStartTime, (r) => r.observationEndTime));
      return tests.length ? (r) => tests.every((t) => t(r)) : undefined;
    }

    // ---------- observations: ingest (element or set) and query ----------

    function ingest(element, principal) {
      const stored = engine.create(CLASSES.observations, element, { principal });
      const lane = stored._lane ?? null;
      const place = stored._place ?? null;
      const data = wire(stored);
      sim.events.publish({ type: 'apx.data.observation.created.v1', data, subject: { id: stored.id, className: 'ObservationElement' }, place: lane ?? place });
      sim.hooks.emit('observation.ingested', { element: stored, place, lane });
      return stored;
    }

    const elementsOf = (body) => (Array.isArray(body?.observationElements) && body.method === undefined ? body.observationElements : [body]);

    sim.on(
      'post-observations',
      route((ctx) => {
        const elements = elementsOf(ctx.body);
        const clashes = elements.map((e) => e.id).filter((id) => id !== undefined && engine.exists('observations', id));
        if (clashes.length) refuse(ctx, 409, 'id-collision', 'Observation can not be created due to conflict: id already exists.', clashes);
        for (const e of elements) {
          const at = e.elementIds?.id;
          if (at && !sim.hierarchy.has(at)) refuse(ctx, 400, 'invalid-request', `Observation ${e.id} names element ${at}, which this server does not hold.`, [at]);
          routes.authorize(ctx, CLASSES.observations, e);
        }
        const ids = elements.map((e) => ingest(e, ctx.principal).id);
        return ok(201, `Observation${ids.length > 1 ? 's' : ''} created successfully.`, ids);
      })
    );
    sim.on('get-observations', route((ctx) => routes.list(ctx, CLASSES.observations, { predicate: listFilter('observations', ctx), flat: true })));
    sim.on('get-observation-id', route((ctx) => routes.read(ctx, CLASSES.observations)));
    sim.on(
      'update-observation-id',
      route((ctx) => {
        const res = routes.update(ctx, CLASSES.observations);
        const rec = engine.coll('observations').get(ctx.params.id);
        sim.events.publish({ type: 'apx.data.observation.updated.v1', data: wire(rec), subject: { id: rec.id, className: 'ObservationElement' }, place: rec._lane ?? rec._place ?? null });
        return res;
      }),
      { skipBodyValidation: true }
    );
    sim.on('delete-observation-id', route((ctx) => routes.remove(ctx, CLASSES.observations, { checkUuid: false })));

    // ---------- quotes (APDS 4.1 as vendored: POST answers a list, GET the single matching quote) ----------

    const quotes = () => sim.store.collection('quotes');
    const quotePlaces = (req) => [
      ...(req.referencedRightSpecifications ?? []).map((r) => r?.elementId?.id),
      engine.coll('sessions').get(req.sessionId?.id)?._place,
    ].filter(Boolean);

    function respond(req) {
      const now = sim.clock.now();
      const requestRef = (className) => ({ id: req.id, version: req.version ?? 1, className });
      if (req.sessionId) {
        return { id: uuid(), version: 1, requestSessionExtensionId: requestRef('QuoteSessionExtensionRequest'), sessionId: req.sessionId, requestTime: req.requestTime ?? now, responseTime: now, revisedEndTime: req.requestedEndTime, _quoteType: 'QuoteSessionExtensionResponse' };
      }
      const start = req.periodStart ?? now;
      const span = req.timePeriods?.[0] ? parseDuration(req.timePeriods[0]) : 3_600_000;
      const end = req.periodEnd ?? new Date(Date.parse(start) + span).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const options = (req.referencedRightSpecifications ?? []).map((ref) => quoteOption(ref, start, end, now)).filter(Boolean);
      return { id: uuid(), version: 1, quoteRequestId: requestRef('QuoteRightRequest'), requestTime: req.requestTime ?? now, responseTime: now, start, end, ...(options.length ? { options } : {}), _quoteType: 'QuoteRightResponse' };
    }

    /** The rate tables that price a referenced spec: its native rateEligibility, else those bound to the element. */
    function tablesFor(ref) {
      const spec = engine.coll('rightSpecs').get(ref?.rightSpecificationId?.id);
      const eligible = (spec?.rateEligibility ?? []).map((e) => engine.coll('rateTables').get(e?.rateTable?.id)).filter(Boolean);
      if (eligible.length) return { spec, tables: eligible };
      const element = ref?.elementId?.id ?? spec?.hierarchyElements?.[0]?.id;
      return { spec, tables: element ? engine.coll('rateTables').find((t) => engine.placesOf('rateTables', t).includes(element)) : [] };
    }

    /** One APDS Option for a referenced spec, priced from its rate tables (§14.1 step 1); null when nothing prices it. */
    function quoteOption(ref, start, end, now) {
      const { spec, tables } = tablesFor(ref);
      for (const table of tables) {
        const price = priceTable(table, start, end);
        if (!price) continue;
        const provider = table.rateResponsibleParty ?? spec?.issuer;
        const expires = new Date(Date.parse(now) + QUOTE_TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
        return {
          id: uuid(),
          version: 1,
          ...(ref?.elementId ? { elementId: ref.elementId } : {}),
          exact: true,
          quoteExpiration: { expiresDateTime: expires, firstComeFirstServe: false },
          financialQuote: {
            ...(provider ? { serviceProvider: { id: provider.id, version: provider.version ?? 1, className: provider.className ?? 'Organisation' } } : {}),
            taxIncluded: price.taxIncluded,
            value: { currencyType: price.currencyType, currencyValue: price.currencyValue },
          },
        };
      }
      return null;
    }

    sim.on(
      'post-quote',
      route((ctx) => {
        routes.requireGrantClaim(ctx);
        const req = { id: uuid(), version: 1, ...(ctx.body ?? {}) };
        const places = quotePlaces(req);
        for (const p of places) if (!sim.hierarchy.covers(ctx.principal.places, p)) fail('insufficient-grant', `Quote names place ${p}, outside the token's apx_places grant.`);
        const _place = places[0];
        const reqType = req.sessionId ? 'QuoteSessionExtensionRequest' : 'QuoteRightRequest';
        if (!quotes().has(req.id)) quotes().insert({ ...plain(req), _quoteType: reqType, _place }, { provenance: false });
        const response = quotes().insert({ ...respond(req), _place, _request: req.id }, { provenance: false });
        return { referenceInstant: Math.floor(sim.clock.nowMs() / 1000), offset: 0, pageSize: 100, total: 1, data: [wire(response)] };
      }),
      { allowEmptyBody: true }
    );

    sim.on(
      'get-quote',
      route((ctx) => {
        routes.requireGrantClaim(ctx);
        const places = routes.placeFilter(ctx);
        const type = ctx.query.get('quote_type') ?? 'QuoteRightResponse';
        const specs = ctx.query.list('right_spec');
        const match = quotes()
          .find((qt) => {
            if (qt._quoteType !== type) return false;
            if (qt._place && !sim.hierarchy.covers(ctx.principal.places, qt._place)) return false;
            if (places.length && !(qt._place && places.some((p) => sim.hierarchy.within(qt._place, p)))) return false;
            if (specs.length) {
              const req = qt._request ? quotes().get(qt._request) : qt;
              if (!(req?.referencedRightSpecifications ?? []).some((r) => specs.includes(r?.rightSpecificationId?.id))) return false;
            }
            return true;
          })
          .at(-1);
        if (!match) fail('target-not-found', `No ${type} matches this query.`);
        return wire(match);
      })
    );

    sim.on(
      'get-quote-id',
      route((ctx) => {
        routes.requireGrantClaim(ctx);
        const qt = quotes().get(ctx.params.id);
        if (!qt) fail('target-not-found', `No quote ${ctx.params.id} on this server.`);
        if (qt._place && !sim.hierarchy.covers(ctx.principal.places, qt._place)) fail('insufficient-grant', `Quote ${qt.id} is at place ${qt._place}, which is not in the token's apx_places grant.`);
        return wire(qt);
      })
    );

    // ---------- §5.5 occupancy ----------

    sim.on(
      'get-apx-v1-places-id-occupancy',
      route((ctx) => {
        const rec = engine.coll('places').get(ctx.params.id);
        if (!rec) fail('target-not-found', `No HierarchyElement ${ctx.params.id} visible to this credential.`);
        if (!ctx.principal.hasGrant || !sim.hierarchy.covers(ctx.principal.places, rec.id)) fail('insufficient-grant', `Place ${rec.id} is not in the token's apx_places grant.`);
        return occupancy.snapshot(rec);
      })
    );

    // ---------- §5.5a occupancy history ----------

    sim.on(
      'get-apx-v1-places-id-occupancy-history',
      route((ctx) => {
        const rec = engine.coll('places').get(ctx.params.id);
        if (!rec) fail('target-not-found', `No HierarchyElement ${ctx.params.id} visible to this credential.`);
        if (!ctx.principal.hasGrant || !sim.hierarchy.covers(ctx.principal.places, rec.id)) fail('insufficient-grant', `Place ${rec.id} is not in the token's apx_places grant.`);
        const q = ctx.query;
        return occupancy.history(rec, { from: q.get('from'), to: q.get('to'), interval: q.get('interval') ?? undefined });
      })
    );

    // ---------- injectors: the world acting on its own ----------

    const actorOf = (credential) => ({ org: sim.world.credentials?.[credential]?.apx_org ?? sim.world.organisation });

    sim.injector('dataWrite', ({ collection, op = 'create', id, record, credential = 'lakeside-parcs' }) => {
      const cls = CLASSES[collection];
      if (!cls) throw new Error(`collection must be one of ${Object.keys(CLASSES).join(', ')}`);
      const principal = actorOf(credential);
      const target = id ?? record?.id;
      if (op === 'create') {
        if (target && engine.exists(collection, target)) throw new Error(`${collection} ${target} already exists`);
        return wire(collection === 'observations' ? ingest(record, principal) : engine.create(cls, record, { principal }));
      }
      if (!engine.coll(collection).has(target)) throw new Error(`no ${collection} ${target}`);
      if (op === 'replace') return wire(engine.replace(cls, target, record, { principal }));
      if (op === 'change') return wire(engine.change(cls, target, record, { principal }));
      if (op === 'delete') return wire(engine.remove(cls, target));
      throw new Error('op must be create, replace, change or delete');
    });

    sim.injector('grant', ({ credential, credentials, add = [], remove = [] }) => {
      const names = credentials ?? [credential];
      for (const name of names) {
        const cred = sim.world.credentials?.[name];
        if (!cred) throw new Error(`no credential ${name}`);
        const current = cred.apx_places ?? [];
        cred.apx_places = [...current.filter((p) => !remove.includes(p)), ...add.filter((p) => !current.includes(p))];
      }
      return Object.fromEntries(names.map((n) => [n, sim.world.credentials[n].apx_places]));
    });

    sim.injector('feedCursor', ({ name, collection, credential, filter = {} }) => {
      const cls = CLASSES[collection];
      if (!cls?.prefix) throw new Error(`collection ${collection} has no change feed`);
      const c = feed.issueAt({ name, cls, credential, filter, grant: sim.world.credentials?.[credential]?.apx_places });
      return { cursor: c.name, position: c.position, issuedAt: c.issuedAt };
    });

    sim.injector('contactDirectory', ({ available = true }) => {
      directoryDown = !available;
      return { available: !directoryDown };
    });

    sim.injector('occupancy', ({ place, count, percentage, occupancyCalculation, recordDateTime, frequency }) => {
      const stored = occupancy.recordDemand(place, { count, percentage, occupancyCalculation, recordDateTime, frequency });
      return occupancy.snapshot(stored);
    });

    sim.injector('observation', ({ element, set, credential = 'lakeside-parcs' }) => {
      const principal = actorOf(credential);
      return elementsOf(set ?? element).map((e) => wire(ingest(e, principal)));
    });

    // ---------- exposed for other domains ----------

    const sessionsAt = (placeId) => engine.coll('sessions').find((s) => s._place && sim.hierarchy.within(s._place, placeId));
    sim.data = {
      classes: CLASSES,
      sessionsAt,
      openSessions: (placeId) => (placeId ? sessionsAt(placeId) : engine.coll('sessions').all()).filter((s) => !s.actualEnd),
      placesOf: engine.placesOf,
      occupancy: (placeId) => {
        const rec = engine.coll('places').get(placeId);
        return rec ? occupancy.snapshot(rec) : null;
      },
      recordDemand: occupancy.recordDemand,
      create: (collection, record, principal) => engine.create(CLASSES[collection], record, { principal }),
      replace: (collection, id, record, principal) => engine.replace(CLASSES[collection], id, record, { principal }),
      change: (collection, id, changes, principal) => engine.change(CLASSES[collection], id, changes, { principal }),
      remove: (collection, id) => engine.remove(CLASSES[collection], id),
      ingestObservation: (element, principal) => ingest(element, principal),
      wireOf: (collection, record) => engine.wireOf(CLASSES[collection], record),
      /** Publish an APDS EventTypeEnum event for a record another module changed itself. */
      publishNative: (type, record, collection) => {
        const cls = collection ? CLASSES[collection] : Object.values(CLASSES).find((c) => c.event && type.startsWith(c.event) && /(Created|Updated|Deleted)$/.test(type.slice(c.event.length)));
        const places = cls ? engine.placesOf(cls.collection, record) : record._place ? [record._place] : [];
        const className = cls?.collection === 'places' ? classNameOfType(record.type) : cls?.className ?? type.replace(/(Created|Updated|Deleted)$/, '');
        return sim.events.publish({ type, data: wire(record), subject: { id: record.id, className }, place: places.find((p) => sim.hierarchy.has(p)) ?? null });
      },
    };
  },
};
