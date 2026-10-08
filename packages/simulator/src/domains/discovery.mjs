/**
 * apx-discovery (Part 16): the unauthenticated bootstrap document and the
 * credential-scoped capability document.
 *
 * World sections read: host, tokenEndpoint, apdsVersion, apiBase,
 * discovery{ conformanceClasses, features } (else the top-level members), registries | registryBase, rateLimits,
 * hosts{ <hostname>: { same members } } for the other hosts a scenario
 * reaches by its Host header (an aggregator, a PARCS starter host),
 * vendorClasses[] (Part 3 §3.3 vendor domains), tls.clientCertificate.
 *
 * The documents are computed per request from the bundle's operation
 * index (OPS), the registries, the handlers actually registered, and the
 * presented token, so the soundness rule of §16.2 holds by construction:
 * an endpoint is listed only when its class is claimed, the token holds
 * its scope, the simulator serves it, and (for place-targeting routes)
 * the token has a place grant.
 */
import { OPS, REGISTRIES, EDITION, APX_TOPICS, APDS_EVENT_TYPES, registryValues } from '../kernel/spec.mjs';
import { fail } from '../kernel/problems.mjs';

const BASE = ['apx-data', 'apx-events'];
const KNOWN_CLASSES = registryValues('apx-conformance-classes');
// Part 3 §3.1 dependency table; a class absent here requires the base classes.
const REQUIRES = {
  'apx-data': [],
  'apx-events': [],
  'apx-mtls': [],
  'apx-events-sse': ['apx-events'],
  'apx-payment-history': [...BASE, 'apx-accounts'],
  'apx-resolution': [...BASE, 'apx-control'],
};
const requires = (cls) => REQUIRES[cls] ?? BASE;

// The class an APX scope belongs to (Part 9 §9.2 scope names → Part 3 classes).
const SCOPE_CLASSES = {
  'apx.data': ['apx-data'],
  'apx.subscriptions': ['apx-events', 'apx-events-sse'],
  'apx.control': ['apx-control'],
  'apx.alerts': ['apx-alerts'],
  'apx.accounts': ['apx-accounts', 'apx-payment-history'],
  'apx.payments': ['apx-accounts'],
  'apx.lpr': ['apx-lpr'],
  'apx.reservations': ['apx-reservations'],
  'apx.permits': ['apx-permits'],
  'apx.tolling': ['apx-tolling'],
  'apx.resolution': ['apx-resolution'],
  'apx.support': ['apx-resolution'],
  'apx.violations': ['apx-violations'],
  'apx.validations': ['apx-validations'],
  'apx.credentials': ['apx-credentials'],
  'apx.valet': ['apx-valet'],
};

// Bundle operation tag → conformance class.
const TAG_CLASS = {
  Data: 'apx-data',
  Subscription: 'apx-events',
  Control: 'apx-control',
  Alerts: 'apx-alerts',
  Accounts: 'apx-accounts',
  LPR: 'apx-lpr',
  Reservations: 'apx-reservations',
  Permits: 'apx-permits',
  Tolling: 'apx-tolling',
  Resolution: 'apx-resolution',
  Support: 'apx-resolution',
  Violations: 'apx-violations',
  Validations: 'apx-validations',
  Credentials: 'apx-credentials',
  Valet: 'apx-valet',
  Discovery: 'apx-discovery',
};

// Routes callable without any place grant (Part 9 §9.3a rule 3: org-scoped
// resources, lookups the discovery examples keep for a grant-less token).
const PLACE_FREE = new Set([
  'GET /places',
  'GET /webhooks',
  'POST /webhooks',
  'GET /webhooks/{id}',
  'PATCH /webhooks/{id}',
  'DELETE /webhooks/{id}',
  'GET /webhooks/{id}/deliveries',
  'GET /v1/events/stream',
  'GET /v1/alerts',
  'POST /v1/alerts',
  'GET /v1/alerts/{id}',
  'POST /v1/alerts/{id}/acknowledge',
  'POST /v1/alerts/{id}/resolve',
  'GET /v1/discovery',
]);

// Topic → the scopes of the read route of its data schema (Part 8), and its class.
const TOPIC_RULES = [
  ['apx.control.', ['apx.control:read'], 'apx-control'],
  ['apx.alert.', ['apx.alerts:read'], 'apx-alerts'],
  ['apx.reservation.', ['apx.reservations:manage'], 'apx-reservations'],
  ['apx.tolling.', ['apx.tolling:manage'], 'apx-tolling'],
  ['apx.subscription.', ['apx.subscriptions:manage'], 'apx-events'],
  ['apx.data.occupancy.', ['apx.data:read'], 'apx-data'],
  ['apx.data.observation.', ['apx.lpr:read'], 'apx-lpr'],
  ['apx.accounts.', ['apx.accounts:read'], 'apx-accounts'],
  ['apx.resolution.', ['apx.resolution:read'], 'apx-resolution'],
  ['apx.support.', ['apx.support:manage', 'apx.resolution:read'], 'apx-resolution'],
  ['apx.violations.', ['apx.violations:read'], 'apx-violations'],
  ['apx.validations.', ['apx.validations:read', 'apx.validations:redeem'], 'apx-validations'],
  ['apx.credentials.', ['apx.credentials:read'], 'apx-credentials'],
  ['apx.valet.', ['apx.valet:read', 'apx.valet:request'], 'apx-valet'],
  ['apx.permits.', ['apx.permits:manage'], 'apx-permits'],
];

// Optional features (apx-features) and the class they belong to (Part 6 §6.5).
const FEATURE_CLASS = { negotiatedRates: 'apx-control', negotiatedAmounts: 'apx-control', ticketMatching: 'apx-control' };
const FEATURE_COMMANDS = { negotiatedRates: 'pushNegotiatedRate', ticketMatching: 'matchTicket' };

const DEFAULT_RATE_LIMITS = { requestsPerMinute: 300, commandsPerMinute: 60, burst: 20, subscriptionsMax: 10, streamConnectionsMax: 2 };
const MAX_AGE_S = 300;

/** Close a claimed class list under the Part 3 §3.1 dependency table, keeping registry order. */
export function closeClasses(claimed) {
  const out = new Set();
  claimed = [...new Set(claimed)];
  const visit = (cls) => {
    if (out.has(cls)) return;
    out.add(cls);
    requires(cls).forEach(visit);
  };
  claimed.forEach(visit);
  const known = KNOWN_CLASSES.filter((c) => out.has(c));
  const vendor = [...out].filter((c) => !KNOWN_CLASSES.includes(c));
  return [...known, ...vendor];
}

const opKey = (op) => `${op.method} ${op.path}`;

export function opClasses(op) {
  if (op.native) return ['apx-data'];
  if (op.path === '/v1/events/stream') return ['apx-events-sse'];
  if (op.webhooks) return ['apx-events'];
  if (op.method === 'GET' && op.path === '/v1/payments') return ['apx-payment-history'];
  return op.tags.map((t) => TAG_CLASS[t]).filter(Boolean);
}

const hostnameOf = (headers) => String(headers.host ?? '').split(':')[0].trim().toLowerCase();

export default {
  name: 'discovery',
  register(sim) {
    // Scenario-time overrides of a host's configuration (injector hostConfig), and
    // the simulated TLS connection (injector tlsConnection); both reset with the world.
    let overrides = {};
    let tls = null;
    sim.seed((world) => {
      overrides = {};
      tls = world.tls ? { ...world.tls } : null;
    });

    /** The configuration of the host a request reached, merged with any override. */
    const hostConfig = (headers) => {
      const world = sim.world;
      const name = hostnameOf(headers);
      const own = world.hosts?.[name];
      const key = own ? name : '';
      const base = own
        ? { url: `https://${name}`, ...own }
        : {
            url: world.host,
            tokenEndpoint: world.tokenEndpoint,
            apiBase: world.apiBase,
            apdsVersion: world.apdsVersion,
            // world.discovery.{conformanceClasses,features} win: an `extends` chain concatenates
            // the loader-defaulted arrays of the base world into the top-level members.
            conformanceClasses: world.discovery?.conformanceClasses ?? world.conformanceClasses,
            features: world.discovery?.features ?? world.features,
            registries: world.registries,
            registryBase: world.registryBase,
            rateLimits: world.rateLimits,
            extensions: world.discoveryExtensions,
          };
      return { ...base, ...(overrides[key] ?? {}) };
    };

    const vendorClasses = () => sim.world.vendorClasses ?? [];

    const registriesOf = (cfg) => {
      if (cfg.registries === null || cfg.registries === false) return null;
      if (cfg.registries && typeof cfg.registries === 'object') return { ...cfg.registries };
      const base = (cfg.registryBase ?? `${cfg.apiBase ?? cfg.url}/registries`).replace(/\/$/, '');
      const out = {};
      for (const name of REGISTRIES.keys()) out[name] = `${base}/${name}.json`;
      for (const v of vendorClasses()) Object.assign(out, v.registries ?? {});
      return out;
    };

    const bootstrap = (cfg) => {
      const registries = registriesOf(cfg);
      const versions = registries
        ? Object.fromEntries(Object.keys(registries).filter((n) => REGISTRIES.has(n)).map((n) => [n, REGISTRIES.get(n).version]))
        : null;
      const features = [...new Set(cfg.features ?? [])];
      return {
        apxVersion: EDITION.apiVersion ?? EDITION.edition,
        edition: EDITION.edition,
        apdsVersion: cfg.apdsVersion ?? EDITION.extension?.apdsVersion ?? '4.1',
        tokenEndpoint: cfg.tokenEndpoint ?? `${cfg.url}/oauth2/token`,
        ...(cfg.apiBase ? { apiBase: cfg.apiBase } : {}),
        conformanceClasses: closeClasses(cfg.conformanceClasses ?? BASE),
        ...(features.length ? { features: [...features] } : {}),
        ...(registries ? { registries } : {}),
        ...(versions && Object.keys(versions).length ? { registryVersions: versions } : {}),
        ...(cfg.extensions ? { extensions: cfg.extensions } : {}),
      };
    };

    // ---------- the credential-scoped document ----------

    const clientClasses = (principal, offered) => {
      const scopes = [...principal.scopes];
      const held = new Set(scopes.flatMap((s) => SCOPE_CLASSES[s.split(':')[0]] ?? []));
      for (const v of vendorClasses()) if ((v.scopes ?? []).some((s) => principal.has(s))) held.add(v.name);
      held.add('apx-discovery');
      held.add('apx-mtls'); // nothing credential-scoped about mTLS: listed when claimed
      const usable = offered.filter((c) => held.has(c));
      // drop a class whose (non-base) dependency the client cannot use
      return usable.filter((c) => requires(c).filter((d) => !BASE.includes(d)).every((d) => usable.includes(d)));
    };

    const endpointsFor = (principal, classes) => {
      const hasPlaces = principal.hasGrant && principal.places.length > 0;
      const byPath = new Map();
      for (const op of OPS) {
        if (!op.secured) continue; // the bootstrap document is not a credential capability
        if (!opClasses(op).some((c) => classes.includes(c))) continue;
        if (op.scopes.length && !principal.hasAny(op.scopes)) continue;
        if (!sim.handlers.has(op.operationId)) continue; // never promise what is not served
        if (!hasPlaces && !PLACE_FREE.has(opKey(op))) continue;
        if (!byPath.has(op.path)) byPath.set(op.path, []);
        byPath.get(op.path).push(op.method);
      }
      const out = [...byPath].map(([path, methods]) => ({ path, methods: [...new Set(methods)] }));
      for (const v of vendorClasses()) {
        if (!classes.includes(v.name)) continue;
        for (const e of v.endpoints ?? []) {
          if (e.scopes && !e.scopes.some((s) => principal.has(s))) continue;
          if (!hasPlaces && !e.placeFree) continue;
          out.push({ path: e.path, methods: e.methods.map((m) => m.toUpperCase()) });
        }
      }
      return out;
    };

    const commandTypesFor = (principal, classes, features) => {
      const hasPlaces = principal.hasGrant && principal.places.length > 0;
      if (!classes.includes('apx-control') || !principal.has('apx.control:execute') || !hasPlaces) return [];
      const gated = Object.entries(FEATURE_COMMANDS).filter(([f]) => !features.includes(f)).map(([, c]) => c);
      return [...registryValues('apx-command-types').filter((c) => !gated.includes(c)), ...(sim.world.vendorCommandTypes ?? [])];
    };

    const featuresFor = (classes, features) =>
      features.filter((f) => {
        const cls = FEATURE_CLASS[f];
        if (cls) return classes.includes(cls);
        const ns = f.split('-')[0];
        return classes.some((c) => c.startsWith(`${ns}-`));
      });

    const topicsFor = (principal, classes, offered) => {
      if (!principal.has('apx.subscriptions:manage') || !classes.includes('apx-events')) return [];
      const apx = APX_TOPICS.filter((t) => {
        const rule = TOPIC_RULES.find(([prefix]) => t.startsWith(prefix));
        return rule && offered.includes(rule[2]) && rule[1].some((s) => principal.has(s));
      });
      const native = principal.has('apx.data:read') ? [...APDS_EVENT_TYPES] : [];
      const vendor = vendorClasses()
        .filter((v) => classes.includes(v.name))
        .flatMap((v) => v.topics ?? []);
      return [...apx, ...native, ...vendor];
    };

    const clientId = (principal) => {
      const raw = principal.raw ?? {};
      if (raw.clientId) return raw.clientId;
      return principal.sub === 'default' ? raw.user ?? principal.sub : principal.sub;
    };

    /** RFC 8705 binding (Part 16 §16.3): a cert-bound token over another client's certificate is 401. */
    const checkBinding = (principal) => {
      if (!tls?.clientCertificate) return;
      const raw = principal.raw ?? {};
      const bound = raw.cnf?.['x5t#S256'] ?? (/cnf\.x5t#S256/.test(principal.sub) ? principal.sub.match(/^([A-Za-z0-9-]+)/)?.[1] : null);
      if (bound && bound !== tls.clientCertificate) {
        fail(
          'unauthenticated',
          `Token is bound to a different client certificate (cnf.x5t#S256 of ${bound}; the connection presented ${tls.clientCertificate}; RFC 8705).`,
          {},
          { 'www-authenticate': 'Bearer realm="apx", error="invalid_token"' }
        );
      }
    };

    const maxAge = (principal) => {
      if (!principal.exp) return MAX_AGE_S;
      const remaining = Math.floor((Date.parse(principal.exp) - sim.clock.nowMs()) / 1000);
      return Math.max(0, Math.min(MAX_AGE_S, remaining));
    };

    // ---------- handlers ----------

    sim.on('get-well-known-apx-configuration', (ctx) => bootstrap(hostConfig(ctx.headers)));

    sim.on('get-apx-v1-discovery', (ctx) => {
      const p = ctx.principal;
      const cfg = hostConfig(ctx.headers);
      const offered = closeClasses(cfg.conformanceClasses ?? BASE);
      if (!offered.includes('apx-discovery')) {
        fail('target-not-found', 'This implementation does not claim apx-discovery; /v1/discovery is not served here.');
      }
      const apxScopes = [...p.scopes].filter((s) => s.startsWith('apx.'));
      if (!apxScopes.length) {
        const other = [...p.scopes];
        fail('insufficient-scope', `GET /v1/discovery requires at least one apx.* scope; the token carries ${other.length ? `only ${other.join(', ')}` : 'none'}.`);
      }
      checkBinding(p);
      const classes = clientClasses(p, offered);
      const hostFeatures = [...new Set(cfg.features ?? [])];
      const features = featuresFor(classes, hostFeatures);
      const vendorScopes = [...p.scopes].filter((s) => !s.startsWith('apx.') && vendorClasses().some((v) => (v.scopes ?? []).includes(s)));
      const vendorExt = Object.assign({}, ...vendorClasses().filter((v) => classes.includes(v.name) && v.extensions).map((v) => v.extensions));
      const body = {
        client: clientId(p),
        ...(p.orgRef ? { organisation: p.orgRef } : {}),
        conformanceClasses: classes,
        scopes: [...apxScopes, ...vendorScopes],
        places: p.hasGrant ? [...p.places] : [],
        endpoints: endpointsFor(p, classes),
        commandTypes: commandTypesFor(p, classes, hostFeatures),
        ...(features.length ? { features } : {}),
        topics: topicsFor(p, classes, offered),
        rateLimits: { ...DEFAULT_RATE_LIMITS, ...(cfg.rateLimits ?? {}), ...(p.raw?.rateLimits ?? {}) },
        ...(Object.keys(vendorExt).length ? { extensions: vendorExt } : {}),
      };
      return { status: 200, body, headers: { 'cache-control': `private, max-age=${maxAge(p)}` } };
    });

    // ---------- injectors ----------

    /** Change what a host claims mid-scenario: { host?, set: {...} } or { host?, clear: true }. */
    sim.injector('hostConfig', ({ host, set, clear }) => {
      const key = host && sim.world.hosts?.[host] ? host : '';
      overrides = { ...overrides, [key]: clear ? {} : { ...(overrides[key] ?? {}), ...(set ?? {}) } };
      return bootstrap(hostConfig(key ? { host: key } : {}));
    });

    /** The client certificate the simulated TLS connection presents ({ clientCertificate: null } clears). */
    sim.injector('tlsConnection', ({ clientCertificate = null }) => {
      tls = clientCertificate ? { clientCertificate } : null;
      return { clientCertificate };
    });

    sim.discovery = { closeClasses, opClasses, claimed: (headers = {}) => closeClasses(hostConfig(headers).conformanceClasses ?? BASE), bootstrap: (headers = {}) => bootstrap(hostConfig(headers)) };
  },
};
