/**
 * APX alerts domain (Part 7): idempotent raise, subtree place filtering,
 * lifecycle with immutable statusHistory, fabric integration.
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Dispatcher } from '../events/dispatcher.js';
import type { Store } from '../store.js';
import { problem, requireScope } from '../auth.js';

const SEVERITIES = ['info', 'warning', 'minor', 'major', 'critical'];
const TERMINAL = new Set(['resolved', 'expired']);

/** place → descendant HierarchyElement ids (sandbox topology). */
export function subtreeOf(store: Store, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  for (const place of store.for('Place').list()) {
    if (place.id !== rootId) continue;
    const children = (place.childElements as Array<{ id: string }> | undefined) ?? [];
    for (const child of children) ids.add(child.id);
  }
  // Devices bound to places/lanes in the subtree count as inside it.
  for (const device of store.for('SupplementalEquipment').list()) {
    const placeRef = device.placeRef as { id?: string } | undefined;
    const laneRef = device.laneRef as { id?: string } | undefined;
    if ((placeRef?.id && ids.has(placeRef.id)) || (laneRef?.id && ids.has(laneRef.id))) {
      ids.add(device.id);
    }
  }
  return ids;
}

export function registerAlertRoutes(
  app: FastifyInstance,
  store: Store,
  dispatcher: Dispatcher
): void {
  const alerts = () => store.for('Alert');
  const idempotency = new Map<string, { bodyHash: string; alertId: string }>();

  const publishStatus = (topic: string, alert: Record<string, unknown>) => {
    const source = alert.source as { place?: string } | undefined;
    dispatcher.publish(
      dispatcher.makeEnvelope(topic, alert, { id: String(alert.id), className: 'Alert' }),
      source?.place ? [source.place] : []
    );
  };

  app.post('/apx/v1/alerts', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.alerts:write');
    if (!principal) return;
    const key = request.headers['idempotency-key'] as string | undefined;
    if (!key) {
      return problem(reply, 400, 'idempotency-key-required', 'Idempotency-Key header is required');
    }
    const body = request.body as Record<string, unknown>;
    const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const seen = idempotency.get(key);
    if (seen) {
      if (seen.bodyHash !== bodyHash) {
        return problem(reply, 409, 'idempotency-conflict', 'Key replayed with a different body');
      }
      return reply.status(200).send(alerts().get(seen.alertId));
    }
    if (!body.alertType || !SEVERITIES.includes(String(body.severity))) {
      return problem(reply, 400, 'unknown-topic', 'alertType and a valid severity are required');
    }
    const now = new Date().toISOString();
    const alert = alerts().create({
      ...body,
      status: 'raised',
      detectionTime: body.detectionTime ?? now,
      statusHistory: [{ state: 'raised', time: now, actor: principal.clientId }],
    });
    idempotency.set(key, { bodyHash, alertId: alert.id });
    publishStatus('apx.alert.raised.v1', alert);
    return reply.status(201).send(alert);
  });

  app.get('/apx/v1/alerts', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.alerts:read')) return;
    const query = request.query as Record<string, string | undefined>;
    let list = alerts().list();
    if (query.status) list = list.filter((a) => a.status === query.status);
    if (query.type) list = list.filter((a) => a.alertType === query.type);
    if (query.severityFloor) {
      const floor = SEVERITIES.indexOf(query.severityFloor);
      list = list.filter((a) => SEVERITIES.indexOf(String(a.severity)) >= floor);
    }
    if (query.place) {
      const subtree = subtreeOf(store, query.place);
      list = list.filter((a) => {
        const source = a.source as { place?: string; device?: { id?: string } } | undefined;
        return (
          (source?.place && subtree.has(source.place)) ||
          (source?.device?.id && subtree.has(source.device.id))
        );
      });
    }
    if (query.since) list = list.filter((a) => String(a.detectionTime) >= query.since!);
    return reply.send({
      meta: {
        referenceInstant: Math.floor(Date.now() / 1000),
        offset: 0,
        pageSize: Math.max(list.length, 100),
        total: list.length,
      },
      data: list,
    });
  });

  app.get('/apx/v1/alerts/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.alerts:read')) return;
    const { id } = request.params as { id: string };
    try {
      return await reply.send(alerts().get(id));
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such alert');
    }
  });

  for (const [action, nextState, allowedFrom] of [
    ['acknowledge', 'acknowledged', ['raised']],
    ['resolve', 'resolved', ['raised', 'acknowledged']],
  ] as const) {
    app.post(`/apx/v1/alerts/:id/${action}`, async (request, reply) => {
      const principal = requireScope(request, reply, 'apx.alerts:write');
      if (!principal) return;
      const { id } = request.params as { id: string };
      let alert;
      try {
        alert = alerts().get(id);
      } catch {
        return problem(reply, 404, 'target-not-found', 'No such alert');
      }
      const current = String(alert.status);
      if (TERMINAL.has(current) || !(allowedFrom as readonly string[]).includes(current)) {
        return problem(reply, 409, 'command-not-cancellable', `Cannot ${action} from ${current}`);
      }
      const body = (request.body ?? {}) as { detail?: string };
      const history = [...(alert.statusHistory as unknown[])];
      history.push({
        state: nextState,
        time: new Date().toISOString(),
        actor: principal.clientId,
        ...(body.detail ? { detail: body.detail } : {}),
      });
      const updated = alerts().applyChange(id, { status: nextState, statusHistory: history });
      publishStatus('apx.alert.status.v1', updated);
      return reply.send(updated);
    });
  }
}
