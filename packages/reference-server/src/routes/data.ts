/**
 * APDS 4.1 native data routes with the APX data profile (Part 5):
 * - stock behavior by default (PaginatedList shape, modified_since + tombstones)
 * - mode=change&cursor=… gapless change feed (ChangeFeedPage)
 * - APX-Update-Mode: change writes (null clears a field)
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  IdCollisionError,
  NotFoundError,
  VersionConflictError,
  decodeCursor,
  encodeCursor,
  type Store,
} from '../store.js';
import { problem, requireScope } from '../auth.js';

interface RouteSpec {
  path: string;
  className: string;
  idParam: string;
}

export const DATA_ROUTES: RouteSpec[] = [
  { path: '/places', className: 'Place', idParam: 'id' },
  { path: '/observations', className: 'Observation', idParam: 'id' },
  { path: '/contacts', className: 'Contact', idParam: 'contactId' },
  { path: '/rights/specs', className: 'RightSpecification', idParam: 'id' },
  { path: '/rates', className: 'RateTable', idParam: 'id' },
  { path: '/sessions', className: 'Session', idParam: 'id' },
  { path: '/rights/assigned', className: 'AssignedRight', idParam: 'id' },
];

function sendKnownError(reply: FastifyReply, error: unknown): boolean {
  if (error instanceof NotFoundError) {
    problem(reply, 404, 'target-not-found', 'No such object', error.message);
    return true;
  }
  if (error instanceof IdCollisionError) {
    problem(reply, 409, 'id-collision', 'Identifier already exists', error.message);
    return true;
  }
  if (error instanceof VersionConflictError) {
    problem(reply, 409, 'version-conflict', 'Stale object version', error.message);
    return true;
  }
  return false;
}

export function registerDataRoutes(app: FastifyInstance, store: Store): void {
  for (const route of DATA_ROUTES) {
    const entities = () => store.for(route.className);

    app.get(route.path, async (request, reply) => {
      if (!requireScope(request, reply, 'apx.data:read')) return;
      const query = request.query as Record<string, string | undefined>;

      if (query.mode === 'change') {
        const cursor = query.cursor ? decodeCursor(query.cursor) : { c: route.className, s: 0 };
        if (!cursor || cursor.c !== route.className) {
          return problem(reply, 404, 'target-not-found', 'Unknown or foreign cursor');
        }
        const changes = entities().changesAfter(cursor.s);
        const items = changes.filter((c) => c.type === 'upsert').map((c) => c.changed);
        const deleted = changes
          .filter((c) => c.type === 'delete')
          .map((c) => ({ id: c.id, className: route.className, deleteTimestamp: c.time }));
        const lastSeq = changes.length ? changes[changes.length - 1]!.seq : cursor.s;
        return reply.send({
          publicationTime: new Date().toISOString(),
          updateMode: 'change',
          items,
          deleted,
          cursor: encodeCursor(route.className, lastSeq),
          next: null,
        });
      }

      // Stock APDS list: PaginatedList shape (+ modified_since with tombstones).
      let data = entities().list();
      let deletedReferences: unknown[] | undefined;
      if (query.modified_since) {
        const since = query.modified_since;
        const changed = new Set(
          entities()
            .changes.filter((c) => c.time >= since && c.type === 'upsert')
            .map((c) => c.id)
        );
        data = data.filter((e) => changed.has(e.id));
        deletedReferences = entities()
          .changes.filter((c) => c.time >= since && c.type === 'delete')
          .map((c) => ({ id: c.id, className: route.className, deleteTimestamp: c.time }));
      }
      return reply.send({
        meta: {
          referenceInstant: Math.floor(Date.now() / 1000),
          offset: 0,
          pageSize: Math.max(data.length, 100),
          total: data.length,
        },
        data,
        ...(deletedReferences ? { deletedReferences } : {}),
      });
    });

    app.post(route.path, async (request, reply) => {
      if (!requireScope(request, reply, 'apx.data:write')) return;
      try {
        const entity = entities().create(request.body as Record<string, unknown>);
        return await reply.status(201).send(entity);
      } catch (error) {
        if (sendKnownError(reply, error)) return;
        throw error;
      }
    });

    app.get(`${route.path}/:${route.idParam}`, async (request, reply) => {
      if (!requireScope(request, reply, 'apx.data:read')) return;
      const id = (request.params as Record<string, string>)[route.idParam]!;
      try {
        return await reply.send(entities().get(id));
      } catch (error) {
        if (sendKnownError(reply, error)) return;
        throw error;
      }
    });

    app.put(`${route.path}/:${route.idParam}`, async (request, reply) => {
      if (!requireScope(request, reply, 'apx.data:write')) return;
      const id = (request.params as Record<string, string>)[route.idParam]!;
      const mode = (request.headers['apx-update-mode'] as string | undefined) ?? 'full';
      try {
        const body = request.body as Record<string, unknown>;
        const entity =
          mode === 'change' ? entities().applyChange(id, body) : entities().replace(id, body);
        return await reply.send(entity);
      } catch (error) {
        if (sendKnownError(reply, error)) return;
        throw error;
      }
    });

    app.delete(`${route.path}/:${route.idParam}`, async (request, reply) => {
      if (!requireScope(request, reply, 'apx.data:write')) return;
      const id = (request.params as Record<string, string>)[route.idParam]!;
      try {
        entities().delete(id);
        return await reply.send({ status: 'ok', code: 200, message: 'deleted' });
      } catch (error) {
        if (sendKnownError(reply, error)) return;
        throw error;
      }
    });
  }

  // Quotes: request/response pair (APDS's one native interaction). Minimal in M2.
  app.post('/quotes', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.data:read')) return;
    const body = request.body as Record<string, unknown>;
    return reply.send({
      quoteRequestId: body.quoteRequestId ?? null,
      responseTime: new Date().toISOString(),
      options: [],
    });
  });
  app.get('/quotes', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.data:read')) return;
    return reply.send({
      meta: { referenceInstant: Math.floor(Date.now() / 1000), offset: 0, pageSize: 100, total: 0 },
      data: [],
    });
  });
}
