/**
 * apx-credentials (Part 21): CredentialRecord issue, the lifecycle
 * (activate, suspend, resume, report-lost, revoke, replace), the APDS
 * materialization onto AssignedRights, access events at lanes, and the
 * Part 17 passback read.
 *
 * Collections: credentialRecords (hints `_places`, `_place`, `_org`,
 * `_passback`, `_allowedDays`), accessEvents (`_place`), assignedRights
 * (shared; seeded defensively, `_place`).
 *
 * World sections read: credentialRecords[], accessEvents[],
 * assignedRights[], rightHolders[], credentialPolicy.blockedAccounts{}.
 *
 * Helpers live in ./credentials/: lifecycle.mjs (state machine, clock,
 * materialization) and access.mjs (presentations, passback).
 */
import { fail } from '../kernel/problems.mjs';
import { paginate, entry, refOf, wire, parseInstant } from './common.mjs';
import { createLifecycle, COLL, TERMINAL, placesOf } from './credentials/lifecycle.mjs';
import { createAccess, EVENTS } from './credentials/access.mjs';

const SERVER_ASSIGNED = ['id', 'version', 'credentialStatus', 'suspension', 'replacedBy', 'statusHistory', 'recordInfo'];
const OUTCOMES = ['granted', 'denied'];
const DIRECTIONS = ['entry', 'exit'];
const NO_GRANT = 'Token carries no apx_places claim; a token without the claim has no place grant (Part 9 §9.3).';

export default {
  name: 'credentials',
  register(sim) {
    const life = createLifecycle(sim);
    const access = createAccess(sim, life);
    const { recs } = life;

    // ---------- seeding ----------

    sim.seed((world) => {
      const ars = sim.store.collection('assignedRights');
      for (const ar of world.assignedRights ?? []) {
        if (!ars.has(ar.id)) ars.put({ version: 1, rightHolder: { credentials: [] }, ...ar });
      }
      for (const c of world.credentialRecords ?? []) {
        const ids = (c.places ?? []).map((p) => p.id);
        recs().put({ version: 1, statusHistory: [], ...c, _places: c._places ?? ids, _place: c._place ?? ids[0] });
      }
      for (const e of world.accessEvents ?? []) {
        sim.store.collection(EVENTS).put({ ...e, _place: e._place ?? e.place?.id ?? sim.hierarchy.placeOf(e.lane?.id)?.id });
      }
      life.syncRights(recs().all(), { publish: false });
      for (const r of recs().all()) life.scheduleTimers(r);
    });

    sim.view(COLL, (r) => wire(r));

    // ---------- visibility (Part 9 §9.3a) ----------

    const covered = (ctx, placeId) => ctx.principal.hasGrant && ctx.hierarchy.covers(ctx.principal.places, placeId);
    const recVisible = (ctx, r) => ctx.principal.hasGrant && (placesOf(r).length === 0 || placesOf(r).some((p) => covered(ctx, p)));

    const visible = (ctx, id) => {
      const rec = recs().get(id);
      if (!rec) fail('target-not-found', `No credential ${id}.`);
      if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
      if (!recVisible(ctx, rec)) {
        fail('insufficient-grant', `Credential ${id} is valid only at place ${placesOf(rec).join(', ')}, which is not in the token's apx_places grant.`);
      }
      return rec;
    };

    const actorOf = (ctx) => ctx.principal.user ?? ctx.principal.sub;

    const requireGrantedPlaces = (ctx, places, pointer = 'places') => {
      if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
      places.forEach((p, i) => {
        if (!ctx.hierarchy.has(p.id)) fail('reference-unknown', `${pointer}[${i}] ${p.id} names no HierarchyElement.`);
        if (!covered(ctx, p.id)) fail('insufficient-grant', `${pointer}[${i}] ${p.id} is not in the token's apx_places grant.`);
      });
    };

    const holderKnown = (id) =>
      (sim.world.rightHolders ?? []).some((h) => h.id === id) || sim.store.collection('contacts').has(id) || sim.store.collection('accounts').has(id);

    // ---------- issue ----------

    const validateWindow = (validity) => {
      if (!validity) return;
      const start = parseInstant(validity.start, 'validity/start');
      const end = parseInstant(validity.end, 'validity/end');
      if (end !== undefined && end <= sim.clock.nowMs()) {
        fail('request-unprocessable', `validity.end ${validity.end} is not in the future; a credential would be issued already expired (Part 21 §21.1 rule 7).`);
      }
      if (start !== undefined && end !== undefined && end <= start) {
        fail('request-unprocessable', `validity.end ${validity.end} precedes validity.start ${validity.start} (Part 21 §21.1 rule 7).`);
      }
    };

    const issueMedia = (media, time) =>
      media ? { ...media, issuedTime: time, ...(media.deposit ? { depositStatus: 'held' } : {}) } : undefined;

    sim.on('post-apx-v1-credentials', (ctx) => {
      const b = { ...ctx.body };
      for (const k of SERVER_ASSIGNED) delete b[k];
      const defaultPlaces = (ctx.principal.places ?? []).filter((p) => p !== '*');
      requireGrantedPlaces(ctx, b.places ?? []);
      if (b.holder && !holderKnown(b.holder.id)) fail('reference-unknown', `holder ${b.holder.className ?? 'RightHolder'} ${b.holder.id} does not exist.`);
      (b.assignedRights ?? []).forEach((a, i) => {
        if (!sim.store.collection('assignedRights').has(a.id)) fail('reference-unknown', `assignedRights[${i}] AssignedRight ${a.id} does not exist.`);
      });
      validateWindow(b.validity);
      life.assertUnique(b.credentialType, b.credentialIdentification);
      const now = ctx.now();
      const placeIds = (b.places ?? []).map((p) => p.id);
      const places = placeIds.length ? placeIds : defaultPlaces;
      const rec = recs().insert(
        {
          ...b,
          ...(b.media ? { media: issueMedia(b.media, now) } : {}),
          credentialStatus: 'issued',
          statusHistory: [entry('issued', now, actorOf(ctx))],
          _places: places,
          _place: places[0],
          _org: ctx.principal.orgRef,
        },
        { assignedId: ctx.assignId, actor: ctx.actor }
      );
      life.publishStatus(rec);
      // §21.1 rule 6: activateOnStart with no start, or a start already reached, activates at issue.
      const start = rec.validity?.start;
      const final = rec.activateOnStart && (!start || Date.parse(start) <= ctx.clock.nowMs()) ? life.apply(rec.id, 'active', 'system', 'activateOnStart: validity.start already reached at issue') : rec;
      life.scheduleTimers(final);
      return { status: 201, body: wire(final), idem: { collection: COLL, id: final.id } };
    });

    // ---------- reads ----------

    sim.on('get-apx-v1-credentials-id', (ctx) => wire(visible(ctx, ctx.params.id)));

    const createdAt = (r) => r.recordInfo?.creationTime ?? r.statusHistory?.[0]?.time ?? '';
    const desc = (key) => (a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : a.id.localeCompare(b.id));

    sim.on('get-apx-v1-credentials', (ctx) => {
      const q = ctx.query;
      const place = q.get('place');
      if (place && !covered(ctx, place)) fail('insufficient-grant', place ? `Place ${place} is not in the token's apx_places grant.` : NO_GRANT);
      const rows = recs()
        .find((r) => {
          if (!recVisible(ctx, r)) return false;
          if (q.has('holder') && r.holder?.id !== q.get('holder')) return false;
          if (q.has('account') && r.account?.id !== q.get('account')) return false;
          if (q.has('type') && r.credentialType !== q.get('type')) return false;
          if (q.has('identification') && r.credentialIdentification !== q.get('identification')) return false;
          if (q.has('status') && r.credentialStatus !== q.get('status')) return false;
          if (place && !placesOf(r).some((p) => ctx.hierarchy.within(p, place) || ctx.hierarchy.within(place, p))) return false;
          return true;
        })
        .sort(desc(createdAt));
      return paginate(ctx, rows);
    });

    // ---------- transitions ----------

    for (const action of ['activate', 'suspend', 'resume', 'report-lost', 'revoke']) {
      sim.on(`post-apx-v1-credentials-id-${action}`, (ctx) => {
        const rec = visible(ctx, ctx.params.id);
        const { reason, note, until } = ctx.body;
        if (until !== undefined) parseInstant(until, 'until');
        return wire(life.act(rec, action, { actor: actorOf(ctx), reason, note, until }));
      });
    }

    // ---------- replace (§21.3) ----------

    sim.on('post-apx-v1-credentials-id-replace', (ctx) => {
      const old = visible(ctx, ctx.params.id);
      const b = ctx.body;
      const s = old.credentialStatus;
      if (TERMINAL.has(s)) {
        const why =
          s === 'replaced'
            ? `is replaced (successor ${old.replacedBy?.id}); replace the successor instead`
            : s === 'expired'
              ? `expired at ${old.validity?.end ?? [...(old.statusHistory ?? [])].reverse().find((h) => h.state === 'expired')?.time}; issue a new credential for the new season`
              : 'is revoked; issue a new credential instead';
        fail('credential-not-replaceable', `${old.id} ${why}.`);
      }
      if (s === 'issued') fail('credential-transition-illegal', `replace requires credentialStatus active, suspended, or lost; ${old.id} is issued.`);
      const type = b.credentialType ?? old.credentialType;
      const identification = b.credentialIdentification ?? life.mintIdentification(type);
      life.assertUnique(type, identification, old.id);
      const now = ctx.now();
      const actor = actorOf(ctx);
      const succ = recs().insert(
        {
          credentialType: type,
          credentialIdentification: identification,
          ...(old.credentialAssignedType ? { credentialAssignedType: old.credentialAssignedType } : {}),
          ...(old.holder ? { holder: old.holder } : {}),
          ...(old.account ? { account: old.account } : {}),
          ...(old.assignedRights ? { assignedRights: old.assignedRights } : {}),
          ...(old.places ? { places: old.places } : {}),
          ...(old.validity ? { validity: old.validity } : {}),
          media: issueMedia(b.media ?? { form: old.media?.form ?? 'virtual' }, now),
          credentialStatus: 'active',
          replaces: refOf(old.id, 'CredentialRecord'),
          statusHistory: [entry('issued', now, actor, `replacement for ${old.id} (${b.reason})`), entry('active', now, actor)],
          _places: old._places,
          _place: old._place,
          _org: ctx.principal.orgRef ?? old._org,
        },
        { assignedId: ctx.assignId, actor: ctx.actor }
      );
      const pred = recs().update(old.id, (r) => {
        const out = {
          ...r,
          credentialStatus: 'replaced',
          replacedBy: refOf(succ.id, 'CredentialRecord'),
          statusHistory: [...(r.statusHistory ?? []), entry('replaced', now, actor, `successor ${succ.id}${b.oldDepositStatus ? `; deposit ${b.oldDepositStatus}` : ''}`)],
        };
        if (r.media && b.oldDepositStatus) out.media = { ...r.media, depositStatus: b.oldDepositStatus };
        delete out.suspension;
        return out;
      });
      life.syncRights([pred, succ]); // §21.2 rule 3: one AssignedRightUpdated per right
      life.publishStatus(pred);
      life.publishStatus(succ);
      life.scheduleTimers(succ);
      return { status: 201, body: wire(succ), idem: { collection: COLL, id: succ.id } };
    });

    // ---------- access events (§21.4) ----------

    const filterEvents = (ctx, rows) => {
      const q = ctx.query;
      const since = parseInstant(q.get('since'), 'since');
      const until = parseInstant(q.get('until'), 'until');
      return rows
        .filter((e) => {
          const t = Date.parse(e.occurredAt);
          if (since !== undefined && t < since) return false;
          if (until !== undefined && t > until) return false;
          if (q.has('outcome') && e.outcome !== q.get('outcome')) return false;
          if (q.has('direction') && e.direction !== q.get('direction')) return false;
          return true;
        })
        .sort(desc((e) => e.occurredAt));
    };

    sim.on('get-apx-v1-credentials-id-access-events', (ctx) => {
      const rec = visible(ctx, ctx.params.id);
      return paginate(ctx, filterEvents(ctx, access.events().find((e) => e.credential?.id === rec.id)));
    });

    const enumParam = (ctx, name, values) => {
      const v = ctx.query.get(name);
      if (v !== undefined && !values.includes(v)) {
        fail('invalid-request', `${name} must be ${values.join(' or ')}.`, { errors: [{ pointer: `/${name}`, detail: `must be one of ${values.join(', ')}` }] });
      }
    };

    const nodeInGrant = (ctx, id, what) => {
      if (!ctx.principal.hasGrant) fail('insufficient-grant', NO_GRANT);
      if (covered(ctx, id)) return;
      const place = ctx.hierarchy.placeOf(id);
      fail('insufficient-grant', place ? `${what} ${id} belongs to ${place.id}${place.name ? ` (${place.name})` : ''}, which is not in the token's apx_places grant.` : `${what} ${id} is not in the token's apx_places grant.`);
    };

    sim.on('get-apx-v1-access-events', (ctx) => {
      const q = ctx.query;
      enumParam(ctx, 'outcome', OUTCOMES);
      enumParam(ctx, 'direction', DIRECTIONS);
      const places = q.list('place');
      places.forEach((p) => nodeInGrant(ctx, p, 'Place'));
      if (q.has('lane')) nodeInGrant(ctx, q.get('lane'), 'Lane');
      if (q.has('device')) nodeInGrant(ctx, q.get('device'), 'Device');
      if (!ctx.principal.hasGrant) return paginate(ctx, []);
      const rows = access.events().find((e) => {
        if (e._place && !covered(ctx, e._place)) return false;
        if (places.length && !places.some((p) => (e.lane?.id && ctx.hierarchy.within(e.lane.id, p)) || (e._place && ctx.hierarchy.within(e._place, p)))) return false;
        if (q.has('lane') && e.lane?.id !== q.get('lane')) return false;
        if (q.has('device') && e.device?.id !== q.get('device')) return false;
        if (q.has('credential') && e.credential?.id !== q.get('credential')) return false;
        if (q.has('denialReason') && e.denialReason !== q.get('denialReason')) return false;
        return true;
      });
      return paginate(ctx, filterEvents(ctx, rows));
    });

    // ---------- passback read (Part 17 §17.4) ----------

    sim.on('get-apx-v1-credentials-id-passback', (ctx) => {
      const id = ctx.params.id;
      if (recs().has(id)) return access.passbackStatus(visible(ctx, id));
      const card = sim.store.collection('accessCredentials').get(id);
      if (!card) fail('target-not-found', `No credential ${id}.`);
      // Part 17 §17.8: a credential the server knows but does not track answers state unknown.
      return { credential: refOf(id, 'Credential'), state: 'unknown' };
    });

    // ---------- hooks from apx-control ----------

    sim.hooks.on('passback', access.onPassbackCommand);
    sim.hooks.on('courtesyExit', access.onCourtesyExit);

    // ---------- injectors ----------

    sim.injector('credentialPresented', (args) => wire(access.present(args)));

    sim.injector('credentialExpire', ({ credential }) => {
      const r = recs().get(credential);
      if (!r) throw new Error(`no CredentialRecord ${credential}`);
      return wire(life.expire(credential, 'validity.end passed (injected)'));
    });

    // A lifecycle action the world performed off-stage (the desk, billing, a batch), through the same rules.
    sim.injector('credentialTransition', ({ credential, action, actor = 'system', reason, note, until, time }) => {
      const r = recs().get(credential);
      if (!r) throw new Error(`no CredentialRecord ${credential}`);
      return wire(life.act(r, action, { actor, reason, note, until, time }));
    });

    // exposed for other domains (data's /rights/assigned, resolution, accounts)
    sim.credentials = { records: recs, matchPresented: life.matchPresented, present: access.present, passbackStatus: access.passbackStatus };
  },
};
