/**
 * APX control domain (Part 6): command plane with lifecycle + audit,
 * lane inquiry (screen-pop), validation providers, device status.
 */
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Dispatcher } from '../events/dispatcher.js';
import type { DeviceSimulator } from '../devices-sim.js';
import type { Store } from '../store.js';
import { grantCoversPlace, problem, requireScope } from '../auth.js';
import { subtreeOf } from './alerts.js';
import { IDS } from '../fixtures.js';

const COMMAND_TYPES = new Set([
  'vendGate',
  'holdGateOpen',
  'closeLane',
  'lostTicket',
  'pushRate',
  'applyValidation',
  'setDeviceState',
  'displayMessage',
  'restartDevice',
]);
const CANCELLABLE = new Set(['received', 'accepted']);
const TERMINAL = new Set(['succeeded', 'failed', 'expired', 'cancelled', 'rejected']);

export function registerControlRoutes(
  app: FastifyInstance,
  store: Store,
  dispatcher: Dispatcher,
  devices: DeviceSimulator,
  dispatchDelayMs = 0
): void {
  const commands = () => store.for('Command');
  const idempotency = new Map<string, { bodyHash: string; commandId: string }>();

  const publishCommand = (command: Record<string, unknown>) => {
    dispatcher.publish(
      dispatcher.makeEnvelope('apx.control.command.status.v1', command, {
        id: String(command.id),
        className: 'Command',
      }),
      [IDS.place]
    );
  };

  const transition = (id: string, state: string, actor: string, detail?: string) => {
    const command = commands().get(id);
    if (TERMINAL.has(String(command.status))) return command; // never leave terminal states
    const history = [...(command.statusHistory as unknown[])];
    history.push({ state, time: new Date().toISOString(), actor, ...(detail ? { detail } : {}) });
    const updated = commands().applyChange(id, { status: state, statusHistory: history });
    publishCommand(updated);
    return updated;
  };

  app.post('/apx/v1/commands', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.control:execute');
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
      return reply.status(200).send(commands().get(seen.commandId));
    }

    const commandType = String(body.commandType ?? '');
    if (!COMMAND_TYPES.has(commandType)) {
      return problem(reply, 400, 'unknown-topic', `Unknown commandType ${commandType}`);
    }
    const target = body.target as { id?: string; className?: string } | undefined;
    if (!target?.id) {
      return problem(reply, 400, 'target-not-found', 'target Reference is required');
    }
    // Grant check: target must be inside the caller's place grant.
    const subtree = subtreeOf(store, IDS.place);
    const targetPlaces = subtree.has(target.id) ? [IDS.place] : [target.id];
    if (!grantCoversPlace(principal, targetPlaces)) {
      return problem(reply, 403, 'insufficient-grant', 'Target outside your place grant');
    }

    const now = new Date().toISOString();
    const expiryTime = typeof body.expiryTime === 'string' ? body.expiryTime : undefined;
    const command = commands().create({
      ...body,
      requestedBy: body.requestedBy ?? principal.org,
      status: 'received',
      statusHistory: [{ state: 'received', time: now, actor: principal.clientId }],
    });
    idempotency.set(key, { bodyHash, commandId: command.id });
    publishCommand(command);

    if (expiryTime && expiryTime <= now) {
      const expired = transition(
        command.id,
        'expired',
        'server',
        'expiryTime passed before dispatch'
      );
      return reply.status(202).send(expired);
    }

    transition(command.id, 'accepted', 'server');
    // Dispatch on the next macrotask: keeps a real cancellation window and
    // lets the 202 return while the facility works.
    setTimeout(() => {
      const current = commands().get(command.id);
      if (current.status !== 'accepted') return; // cancelled/expired meanwhile
      if (expiryTime && expiryTime <= new Date().toISOString()) {
        transition(command.id, 'expired', 'server', 'expiryTime passed before dispatch');
        return;
      }
      transition(command.id, 'dispatched', 'facility');
      transition(command.id, 'executing', 'facility');
      const { promise } = devices.execute(
        commandType,
        target.id!,
        (body.parameters as Record<string, unknown>) ?? {}
      );
      void promise.then((result) => {
        transition(command.id, result.ok ? 'succeeded' : 'failed', 'facility', result.detail);
      });
    }, dispatchDelayMs);

    return reply.status(202).send(commands().get(command.id));
  });

  app.get('/apx/v1/commands/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:read')) return;
    const { id } = request.params as { id: string };
    try {
      return await reply.send(commands().get(id));
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such command');
    }
  });

  app.post('/apx/v1/commands/:id/cancel', async (request, reply) => {
    const principal = requireScope(request, reply, 'apx.control:execute');
    if (!principal) return;
    const { id } = request.params as { id: string };
    let command;
    try {
      command = commands().get(id);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such command');
    }
    if (!CANCELLABLE.has(String(command.status))) {
      return problem(reply, 409, 'command-not-cancellable', `Cannot cancel from ${command.status}`);
    }
    return reply.send(transition(id, 'cancelled', principal.clientId));
  });

  // --- Device status overlay ---
  app.get('/apx/v1/devices', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:read')) return;
    return reply.send({ data: devices.list() });
  });

  app.get('/apx/v1/devices/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:read')) return;
    const { id } = request.params as { id: string };
    const state = devices.get(id);
    if (!state) return problem(reply, 404, 'target-not-found', 'No such device');
    return reply.send(state);
  });

  // --- Lane inquiry (screen-pop) ---
  app.get('/apx/v1/lanes/:id/current', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:read')) return;
    const { id } = request.params as { id: string };
    try {
      const laneState = store.for('LaneState').get(id);
      return await reply.send(laneState);
    } catch {
      return problem(reply, 404, 'target-not-found', 'No such lane or no state available');
    }
  });

  // --- Validation providers ---
  app.get('/apx/v1/validations/providers', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:read')) return;
    const { place } = request.query as { place?: string };
    if (!place) return problem(reply, 400, 'target-not-found', 'place query parameter required');
    const providers = store
      .for('ValidationProvider')
      .list()
      .filter((p) => (p.placeRef as { id?: string } | undefined)?.id === place);
    return reply.send({ data: providers });
  });

  // --- Sandbox-only vendor extension (eats our own /apx/x/<ns> dogfood) ---
  app.post('/apx/x/sandbox/devices/:id/state', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.control:execute')) return;
    const { id } = request.params as { id: string };
    const { state } = (request.body ?? {}) as { state?: string };
    const updated = devices.setState(id, state ?? 'fault');
    if (!updated) return problem(reply, 404, 'target-not-found', 'No such device');
    return reply.send(updated);
  });
}
