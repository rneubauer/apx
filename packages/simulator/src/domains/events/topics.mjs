/**
 * Topics for apx-events: which topics exist (registry apx-topics, APDS
 * EventTypeEnum, the world's vendor list) and the read scope of each
 * (Part 8 §8.1, Part 9 §9.6(4)): the scope of the read route of the
 * topic's data. A credential that could not read the data synchronously
 * cannot subscribe to it.
 */
import { APX_TOPICS, APDS_EVENT_TYPES, ALL_TOPICS, findOp } from '../../kernel/spec.mjs';

/**
 * APX topic → the scopes any one of which reads its data. Prefixes are
 * tried in order, so the observation topics (plate-bearing, apx.lpr:read)
 * come before the rest of apx.data.*.
 */
export const TOPIC_READ_SCOPES = [
  [/^apx\.control\./, ['apx.control:read'], 'GET /v1/commands/{id}, GET /v1/devices/{id}'],
  [/^apx\.alert\./, ['apx.alerts:read'], 'GET /v1/alerts/{id}'],
  [/^apx\.reservation\./, ['apx.reservations:manage'], 'GET /v1/reservations/recent'],
  [/^apx\.tolling\./, ['apx.tolling:manage'], 'GET /v1/tolling/transactions/{id}'],
  [/^apx\.subscription\./, ['apx.subscriptions:manage'], 'GET /webhooks/{id}'],
  [/^apx\.data\.observation\./, ['apx.lpr:read'], 'GET /v1/lpr/reads'],
  [/^apx\.data\./, ['apx.data:read'], 'GET /v1/places/{id}/occupancy'],
  [/^apx\.accounts\./, ['apx.accounts:read'], 'GET /v1/payments'],
  [/^apx\.resolution\./, ['apx.resolution:read'], 'GET /v1/resolution/contexts/{id}'],
  [/^apx\.support\./, ['apx.support:manage', 'apx.resolution:read'], 'GET /v1/support/interactions/{id}'],
  [/^apx\.violations\./, ['apx.violations:read'], 'GET /v1/violations/{id}'],
  [/^apx\.validations\./, ['apx.validations:read'], 'GET /v1/validations/redemptions/{id}, /programs/{id}, /statements/{id}'],
  [/^apx\.credentials\./, ['apx.credentials:read'], 'GET /v1/credentials/{id}, GET /v1/access-events'],
  [/^apx\.valet\./, ['apx.valet:read'], 'GET /v1/valet/tickets/{id}'],
  [/^apx\.permits\./, ['apx.permits:manage'], 'GET /v1/permits/pools/{rightSpecId}/availability'],
  // The customer scope apx.charging:status reads its own session; the
  // per-session restriction rides on the token's binding, not checked here.
  [/^apx\.charging\.(session|idle)\./, ['apx.charging:read', 'apx.charging:status'], 'GET /v1/charging/sessions/{id}'],
  [/^apx\.charging\./, ['apx.charging:read'], 'GET /v1/charging/points/{id}'],
  [/^apx\.(equipment|commspoints|displays)\./, ['apx.siteconfig:read'], 'GET /v1/equipment, /v1/comms-points, /v1/display-records'],
];

/** A registry topic the table does not know yet: apx.<domain>.… → apx.<domain>:read. */
const derivedScope = (topic) => {
  const domain = topic.split('.')[1];
  return domain ? [`apx.${domain}:read`] : ['apx.data:read'];
};

/** Topics whose data carries plate values (Part 9 §9.6(1)). */
const PLATE_TOPICS = /^apx\.data\.observation\./;

// APDS EventTypeEnum entity → the native read route its data comes from.
const APDS_ROUTES = {
  Session: '/sessions',
  Place: '/places',
  Rate: '/rates',
  AssignedRight: '/rights/assigned',
  RightSpecification: '/rights/specs',
  Organisation: '/contacts',
};

/** The APDS roles the native read route of an APDS topic accepts, beside apx.data:read. */
function apdsReadScopes(topic) {
  const entity = topic.replace(/(Created|Updated|Deleted)$/, '');
  const path = APDS_ROUTES[entity];
  const roles = path ? findOp('GET', path)?.op?.apdsRoles ?? [] : [];
  return ['apx.data:read', ...roles];
}

/** The scopes any one of which lets a credential subscribe to `topic`; [] for a vendor topic. */
export function readScopesOf(topic) {
  if (APDS_EVENT_TYPES.includes(topic)) return apdsReadScopes(topic);
  const row = TOPIC_READ_SCOPES.find(([re]) => re.test(topic));
  if (row) return row[1];
  // A registry topic added after this table: never take the simulator down,
  // derive the scope from the topic's domain segment.
  return APX_TOPICS.includes(topic) ? derivedScope(topic) : [];
}

export const isKnownTopic = (topic, vendorTopics = []) => ALL_TOPICS.has(topic) || vendorTopics.includes(topic);

/**
 * The principal's scopes, minus any the descriptive token explicitly
 * negates ("… — no apx.lpr:read"). The kernel's descriptive-token parser
 * collects every scope it sees, negated or not; this keeps a scope the
 * scenario says the token lacks out of the topic check.
 */
export function effectiveScopes(principal) {
  const negated = new Set([...String(principal.sub ?? '').matchAll(/\bno\s+(apx\.[a-z-]+:[a-z-]+)/g)].map((m) => m[1]));
  return new Set([...principal.scopes].filter((s) => !negated.has(s)));
}

/** The first topic the principal could not read synchronously, with the scope it lacks; null when all are readable. */
export function unreadableTopic(principal, topics) {
  const scopes = effectiveScopes(principal);
  for (const topic of topics) {
    const needed = readScopesOf(topic);
    if (needed.length && !needed.some((s) => scopes.has(s))) {
      const carries = [...scopes].join(' ') || 'no scopes';
      const why = PLATE_TOPICS.test(topic) ? `${topic} carries plate reads; subscribing requires ${needed.join(' or ')} (Part 9 §9.6)` : `${topic} requires ${needed.join(' or ')}, the scope of its data's read route (Part 8 §8.1)`;
      return { topic, needed, detail: `${why}. Token carries ${carries}.` };
    }
  }
  return null;
}

/** Expand a world-seed topic list: "apx.*" stands for every registry topic. */
export const expandTopics = (topics = []) => [...new Set(topics.flatMap((t) => (t === 'apx.*' ? APX_TOPICS : [t])))];
