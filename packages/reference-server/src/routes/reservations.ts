/**
 * APX reservations & permits (Part 14) — thin profiles over native routes.
 * Reservations live as extensions on AssignedRights; permits are pooled
 * RightSpecifications with multi-vehicle credentials.
 */
import type { FastifyInstance } from 'fastify';
import type { Dispatcher } from '../events/dispatcher.js';
import type { Store } from '../store.js';
import { problem, requireScope } from '../auth.js';
import { IDS } from '../fixtures.js';

export const RESERVATION_EXT = 'apds-ext:apx:reservation@1.0';

type Ext = { reservationState?: string; plannedStart?: string; checkInSession?: unknown };

function reservationExt(entity: Record<string, unknown>): Ext | undefined {
  const extensions = entity.extensions as Record<string, Ext> | undefined;
  return extensions?.[RESERVATION_EXT];
}

/** Called from the data routes' write hook: Session creation = check-in. */
export function makeCheckInHook(store: Store) {
  return (
    verb: 'Created' | 'Updated' | 'Deleted',
    className: string,
    entity: Record<string, unknown>
  ): void => {
    if (className !== 'Session' || verb !== 'Created') return;
    const segments = entity.segments as Array<{ assignedRight?: { id?: string } }> | undefined;
    const assignedRightId = segments?.[0]?.assignedRight?.id;
    if (!assignedRightId) return;
    let right;
    try {
      right = store.for('AssignedRight').get(assignedRightId);
    } catch {
      return;
    }
    const ext = reservationExt(right);
    if (!ext || ['cancelled', 'checkedIn'].includes(String(ext.reservationState))) return;
    const extensions = { ...(right.extensions as Record<string, unknown>) };
    extensions[RESERVATION_EXT] = {
      ...ext,
      reservationState: 'checkedIn',
      checkInSession: { id: entity.id, className: 'Session' },
    };
    store.for('AssignedRight').applyChange(assignedRightId, { extensions });
  };
}

export interface ReservationSummary {
  reservation: { id: string; className: 'AssignedRight' };
  reservationState?: string;
  plannedStart?: string;
  plannedEnd?: string;
}

/**
 * The customer's most recent reservations (default: last 10, newest planned
 * start first). "Same customer" = same RightHolder — resolved from an
 * explicit holder id, or from a plate via the Account registry / the
 * reservation's own vehicle credentials.
 */
export function recentReservationsFor(
  store: Store,
  query: { plate?: string; holderId?: string; placeId?: string },
  limit = 10
): ReservationSummary[] {
  // Optional per-location scoping: reservation → RightSpecification → place.
  const specsAtPlace = query.placeId
    ? new Set(
        store
          .for('RightSpecification')
          .list()
          .filter((s) => (s.placeRef as { id?: string } | undefined)?.id === query.placeId)
          .map((s) => s.id)
      )
    : undefined;
  let holderId = query.holderId;
  if (!holderId && query.plate) {
    const account = store
      .for('Account')
      .list()
      .find((a) => (a.plates as string[] | undefined)?.includes(query.plate!));
    holderId = (account?.holder as { id?: string } | undefined)?.id;
  }
  return store
    .for('AssignedRight')
    .list()
    .filter((right) => {
      const ext = reservationExt(right);
      if (!ext) return false;
      if (specsAtPlace) {
        const specId = (right.rightSpecification as { id?: string } | undefined)?.id;
        if (!specId || !specsAtPlace.has(specId)) return false;
      }
      const rightHolder = (right.assignedRightHolder as { id?: string } | undefined)?.id;
      const holderMatch = Boolean(holderId && rightHolder === holderId);
      const plateMatch = Boolean(
        query.plate &&
          (right.credentials as Array<{ credentialIdentification?: string }> | undefined)?.some(
            (c) => c.credentialIdentification === query.plate
          )
      );
      return holderMatch || plateMatch;
    })
    .map((right) => {
      const ext = reservationExt(right) as Ext & { plannedEnd?: string };
      return {
        reservation: { id: right.id, className: 'AssignedRight' as const },
        reservationState: ext.reservationState,
        plannedStart: ext.plannedStart,
        plannedEnd: ext.plannedEnd,
      };
    })
    .sort((a, b) => String(b.plannedStart ?? '').localeCompare(String(a.plannedStart ?? '')))
    .slice(0, limit);
}

export function registerReservationRoutes(
  app: FastifyInstance,
  store: Store,
  dispatcher: Dispatcher
): void {
  // --- Permits: pool availability + issuance ---
  const poolFor = (rightSpecId: string) =>
    store
      .for('RightPool')
      .list()
      .find((p) => (p.rightSpecification as { id?: string } | undefined)?.id === rightSpecId);

  const issuedCount = (rightSpecId: string) =>
    store
      .for('AssignedRight')
      .list()
      .filter((r) => (r.rightSpecification as { id?: string } | undefined)?.id === rightSpecId)
      .length;

  app.get('/v1/permits/pools/:rightSpecId/availability', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.permits:manage')) return;
    const { rightSpecId } = request.params as { rightSpecId: string };
    const pool = poolFor(rightSpecId);
    if (!pool) {
      return problem(reply, 404, 'target-not-found', 'No pool for this RightSpecification');
    }
    const capacity = Number(pool.capacity);
    const issued = issuedCount(rightSpecId);
    return reply.send({
      rightSpecification: { id: rightSpecId, version: 1, className: 'RightSpecification' },
      capacity,
      issued,
      available: Math.max(0, capacity - issued),
    });
  });

  app.post('/v1/permits/issue', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.permits:manage');
    if (!principal) return;
    const body = request.body as Record<string, unknown>;
    const rightSpec = body.rightSpecification as { id?: string } | undefined;
    if (!rightSpec?.id) {
      return problem(reply, 400, 'target-not-found', 'rightSpecification is required');
    }
    const pool = poolFor(rightSpec.id);
    if (pool) {
      const capacity = Number(pool.capacity);
      if (issuedCount(rightSpec.id) >= capacity) {
        return reply
          .status(409)
          .header('content-type', 'application/problem+json')
          .send({
            type: 'https://apx-standard.org/problems/pool-exhausted',
            title: 'Permit pool exhausted',
            status: 409,
            detail: `capacity ${capacity} fully issued`,
          });
      }
    }
    const permit = store.for('AssignedRight').create({
      rightSpecification: body.rightSpecification,
      issuer: principal.org,
      assignedRightHolder: body.holder,
      credentials: body.credentials ?? [],
      validity: body.validity,
    });
    dispatcher.publish(
      dispatcher.makeEnvelope('AssignedRightCreated', permit, {
        id: permit.id,
        className: 'AssignedRight',
      }),
      [IDS.place]
    );
    return reply.status(201).send(permit);
  });

  // --- Customer reservation history (last 10, newest first) ---
  app.get('/v1/reservations/recent', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.reservations:manage')) return;
    const { plate, holder, place } = request.query as {
      plate?: string;
      holder?: string;
      place?: string;
    };
    if (!plate && !holder) {
      return problem(reply, 400, 'target-not-found', 'plate or holder query parameter required');
    }
    return reply.send({
      data: recentReservationsFor(store, { plate, holderId: holder, placeId: place }),
    });
  });

  // --- Reservations: sandbox no-show sweep (grace period = plannedStart passed) ---
  app.post('/apx/x/sandbox/reservations/sweep', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.reservations:manage')) return;
    const now = new Date().toISOString();
    const swept: string[] = [];
    for (const right of store.for('AssignedRight').list()) {
      const ext = reservationExt(right);
      if (!ext?.reservationState || ext.reservationState !== 'confirmed') continue;
      if (!ext.plannedStart || ext.plannedStart > now) continue;
      const extensions = { ...(right.extensions as Record<string, unknown>) };
      extensions[RESERVATION_EXT] = { ...ext, reservationState: 'noShow' };
      const updated = store.for('AssignedRight').applyChange(right.id, { extensions });
      dispatcher.publish(
        dispatcher.makeEnvelope('apx.reservation.noshow.v1', updated, {
          id: right.id,
          className: 'AssignedRight',
        }),
        [IDS.place]
      );
      swept.push(right.id);
    }
    return reply.send({ sweptCount: swept.length, swept });
  });
}
