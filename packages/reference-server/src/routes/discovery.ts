/**
 * APX discovery (Part 16): credential-scoped capability documents.
 * The document reflects the token's scopes + grants exactly.
 */
import type { FastifyInstance } from 'fastify';
import { getPrincipal, problem, type Principal } from '../auth.js';

interface EndpointSpec {
  path: string;
  methods: string[];
  scope: string;
}

/** scope → endpoints (APDS-native + APX). */
const ENDPOINTS: EndpointSpec[] = [
  // apx-data (native APDS routes)
  ...[
    '/places',
    '/observations',
    '/contacts',
    '/rights/specs',
    '/rates',
    '/sessions',
    '/rights/assigned',
    '/quotes',
  ].flatMap((path) => [
    { path, methods: ['GET'], scope: 'apx.data:read' },
    { path, methods: ['POST'], scope: 'apx.data:write' },
  ]),
  { path: '/webhooks', methods: ['GET', 'POST'], scope: 'apx.subscriptions:manage' },
  { path: '/webhooks/{id}', methods: ['PATCH', 'DELETE'], scope: 'apx.subscriptions:manage' },
  { path: '/webhooks/{id}/deliveries', methods: ['GET'], scope: 'apx.subscriptions:manage' },
  { path: '/apx/v1/events/stream', methods: ['GET'], scope: 'apx.subscriptions:manage' },
  { path: '/apx/v1/commands', methods: ['POST'], scope: 'apx.control:execute' },
  { path: '/apx/v1/commands/{id}', methods: ['GET'], scope: 'apx.control:read' },
  { path: '/apx/v1/commands/{id}/cancel', methods: ['POST'], scope: 'apx.control:execute' },
  { path: '/apx/v1/devices', methods: ['GET'], scope: 'apx.control:read' },
  { path: '/apx/v1/devices/{id}', methods: ['GET'], scope: 'apx.control:read' },
  { path: '/apx/v1/lanes/{id}/current', methods: ['GET'], scope: 'apx.control:read' },
  { path: '/apx/v1/validations/providers', methods: ['GET'], scope: 'apx.control:read' },
  { path: '/apx/v1/alerts', methods: ['GET'], scope: 'apx.alerts:read' },
  { path: '/apx/v1/alerts', methods: ['POST'], scope: 'apx.alerts:write' },
  { path: '/apx/v1/alerts/{id}/acknowledge', methods: ['POST'], scope: 'apx.alerts:write' },
  { path: '/apx/v1/alerts/{id}/resolve', methods: ['POST'], scope: 'apx.alerts:write' },
  { path: '/apx/v1/accounts', methods: ['GET'], scope: 'apx.accounts:read' },
  { path: '/apx/v1/accounts/{id}', methods: ['GET'], scope: 'apx.accounts:read' },
  { path: '/apx/v1/payments', methods: ['GET'], scope: 'apx.accounts:read' },
  { path: '/apx/v1/payments', methods: ['POST'], scope: 'apx.payments:write' },
  { path: '/apx/v1/payments/{id}/postings', methods: ['POST'], scope: 'apx.payments:write' },
  { path: '/apx/v1/lpr/reads', methods: ['GET'], scope: 'apx.lpr:read' },
  {
    path: '/apx/v1/permits/pools/{rightSpecId}/availability',
    methods: ['GET'],
    scope: 'apx.permits:manage',
  },
  { path: '/apx/v1/permits/issue', methods: ['POST'], scope: 'apx.permits:manage' },
  { path: '/apx/v1/tolling/transactions', methods: ['GET', 'POST'], scope: 'apx.tolling:manage' },
];

const CLASS_SCOPES: Record<string, string[]> = {
  'apx-data': ['apx.data:read'],
  'apx-events': ['apx.subscriptions:manage'],
  'apx-events-sse': ['apx.subscriptions:manage'],
  'apx-control': ['apx.control:read', 'apx.control:execute'],
  'apx-alerts': ['apx.alerts:read', 'apx.alerts:write'],
  'apx-discovery': [],
  'apx-accounts': ['apx.accounts:read'],
  'apx-payment-history': ['apx.accounts:read'],
  'apx-lpr': ['apx.lpr:read'],
  'apx-reservations': ['apx.reservations:manage'],
  'apx-permits': ['apx.permits:manage'],
  'apx-tolling': ['apx.tolling:manage'],
};

const COMMAND_TYPES = [
  'vendGate',
  'holdGateOpen',
  'closeLane',
  'lostTicket',
  'pushRate',
  'applyValidation',
  'setDeviceState',
  'displayMessage',
  'restartDevice',
];

const APX_TOPICS = [
  'apx.control.command.status.v1',
  'apx.control.device.state.v1',
  'apx.alert.raised.v1',
  'apx.alert.status.v1',
  'apx.reservation.noshow.v1',
  'apx.tolling.transaction.created.v1',
  'apx.tolling.transaction.status.v1',
  'apx.subscription.failed.v1',
];

const APDS_TOPIC_BASES = [
  'AssignedRight',
  'Session',
  'Place',
  'RightSpecification',
  'Rate',
  'Organisation',
];

export function buildDiscoveryDocument(
  principal: Principal,
  serverClasses: string[]
): Record<string, unknown> {
  const scopes = new Set(principal.scopes);
  const endpoints = ENDPOINTS.filter((e) => scopes.has(e.scope));
  // Merge duplicate paths.
  const merged = new Map<string, Set<string>>();
  for (const endpoint of endpoints) {
    const set = merged.get(endpoint.path) ?? new Set<string>();
    for (const method of endpoint.methods) set.add(method);
    merged.set(endpoint.path, set);
  }
  const conformanceClasses = serverClasses.filter(
    (c) =>
      (CLASS_SCOPES[c] ?? []).some((s) => scopes.has(s)) || (CLASS_SCOPES[c] ?? []).length === 0
  );
  const topics = scopes.has('apx.subscriptions:manage')
    ? [
        ...APDS_TOPIC_BASES.flatMap((b) => [`${b}Created`, `${b}Updated`, `${b}Deleted`]),
        ...APX_TOPICS,
      ]
    : [];
  return {
    client: principal.clientId,
    organisation: principal.org,
    conformanceClasses,
    scopes: [...scopes],
    places: principal.places ?? [],
    endpoints: [...merged.entries()].map(([path, methods]) => ({ path, methods: [...methods] })),
    commandTypes: scopes.has('apx.control:execute') ? COMMAND_TYPES : [],
    topics,
    rateLimits: { requestsPerMinute: 600, commandsPerMinute: 60 },
  };
}

export function registerDiscoveryRoutes(app: FastifyInstance, serverClasses: string[]): void {
  app.get('/apx/v1/discovery', async (request, reply) => {
    const principal = getPrincipal(request);
    if (!principal) {
      return problem(reply, 401, 'unauthenticated', 'Missing or invalid bearer token');
    }
    reply.header('cache-control', 'private, max-age=300');
    return reply.send(buildDiscoveryDocument(principal, serverClasses));
  });
}
