/**
 * APX LPR cross-lookup (Part 13 §13.3) — a pure profile over APDS
 * Observations; ingest is the native POST /observations route.
 */
import type { FastifyInstance } from 'fastify';
import type { Store } from '../store.js';
import { problem, requireScope } from '../auth.js';

interface LprRead {
  plate: string;
  confidence?: number;
  observation?: { id: string; className: 'Observation' };
  observationDateTime?: string;
  ticketNumber?: string;
  session?: { id: string; className: 'Session' };
  imageLink?: string;
}

export function registerLprRoutes(app: FastifyInstance, store: Store): void {
  app.get('/apx/v1/lpr/reads', async (request, reply) => {
    if (!requireScope(request, reply, 'apx.lpr:read')) return;
    const { plate, ticket } = request.query as { plate?: string; ticket?: string };
    if (!plate && !ticket) {
      return problem(reply, 400, 'target-not-found', 'plate or ticket query parameter required');
    }

    const laneStates = store.for('LaneState').list();
    const observations = store.for('Observation').list();
    const reads: LprRead[] = [];

    const contextFor = (candidatePlate: string) => {
      const laneState = laneStates.find(
        (l) =>
          (l.currentTicket as { lpr?: { plate?: string } } | undefined)?.lpr?.plate ===
          candidatePlate
      );
      const currentTicket = laneState?.currentTicket as
        | { ticketNumber?: string; session?: { id: string }; lpr?: { imageLink?: string } }
        | undefined;
      return {
        ticketNumber: currentTicket?.ticketNumber,
        session: currentTicket?.session
          ? { id: currentTicket.session.id, className: 'Session' as const }
          : undefined,
        imageLink: currentTicket?.lpr?.imageLink,
      };
    };

    if (plate) {
      for (const observation of observations) {
        const credential = observation.credentialObservation as
          | { credentialIdentification?: string; confidence?: { value?: number } }
          | undefined;
        if (credential?.credentialIdentification !== plate) continue;
        reads.push({
          plate,
          confidence: credential.confidence?.value,
          observation: { id: observation.id, className: 'Observation' },
          observationDateTime: String(observation.observationDateTime ?? ''),
          ...contextFor(plate),
        });
      }
    } else if (ticket) {
      for (const laneState of laneStates) {
        const currentTicket = laneState.currentTicket as
          | {
              ticketNumber?: string;
              session?: { id: string };
              lpr?: {
                plate?: string;
                confidence?: number;
                imageLink?: string;
                observation?: { id: string };
              };
            }
          | undefined;
        if (currentTicket?.ticketNumber !== ticket || !currentTicket.lpr?.plate) continue;
        reads.push({
          plate: currentTicket.lpr.plate,
          confidence: currentTicket.lpr.confidence,
          observation: currentTicket.lpr.observation
            ? { id: currentTicket.lpr.observation.id, className: 'Observation' }
            : undefined,
          ticketNumber: ticket,
          session: currentTicket.session
            ? { id: currentTicket.session.id, className: 'Session' }
            : undefined,
          imageLink: currentTicket.lpr.imageLink,
        });
      }
    }

    return reply.send({ data: reads });
  });
}
