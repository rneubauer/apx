/**
 * Reads the bundled APX OpenAPI document and turns it into the model the
 * APX Specification documents are generated from: modules (one per
 * spec/openapi/domains/<dir>), classes, members (attributes and
 * associations), enumerations, code lists, operations, and the link from
 * each APX element to what APX proposes to APDS.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

export const MODULES = [
  { dir: 'common', pkg: 'Common', title: 'Common elements', part: 'Parts 4, 5, 10 and 12' },
  { dir: 'discovery', pkg: 'Discovery', title: 'Discovery', part: 'Part 16' },
  { dir: 'data', pkg: 'Data', title: 'Data exchange', part: 'Parts 5 and 18' },
  { dir: 'events', pkg: 'Events', title: 'Subscriptions and events', part: 'Part 8' },
  { dir: 'control', pkg: 'Control', title: 'Control', part: 'Part 6' },
  { dir: 'alerts', pkg: 'Alerts', title: 'Alerts', part: 'Part 7' },
  { dir: 'accounts', pkg: 'Accounts', title: 'Accounts and payments', part: 'Part 13' },
  { dir: 'lpr', pkg: 'Lpr', title: 'License plate recognition', part: 'Part 13' },
  { dir: 'reservations', pkg: 'Reservations', title: 'Reservations and permits', part: 'Part 14' },
  { dir: 'tolling', pkg: 'Tolling', title: 'Tolling', part: 'Part 15' },
  { dir: 'violations', pkg: 'Violations', title: 'Violations and enforcement', part: 'Part 19' },
  { dir: 'validations', pkg: 'Validations', title: 'Validations', part: 'Part 20' },
  { dir: 'credentials', pkg: 'Credentials', title: 'Credentials', part: 'Part 21' },
  { dir: 'valet', pkg: 'Valet', title: 'Valet', part: 'Part 22' },
  { dir: 'platelists', pkg: 'PlateLists', title: 'Plate lists', part: 'Part 24' },
  { dir: 'resolution', pkg: 'Resolution', title: 'Resolution and customer support', part: 'Part 17' },
  { dir: 'charging', pkg: 'Charging', title: 'EV charging', part: 'Part 23' },
];

// APDS x-package (or, where APDS sets none, the class name) to the domain
// prefix the APDS Data Dictionary uses.
const APDS_DOMAIN = [
  [/^place\.occupancy/, 'Occupancy'], [/^place\.service/, 'EnergyInfrastructure'], [/^place/, 'Place'],
  [/^rate/, 'Rates'], [/^(right_specification|assigned_right)/, 'Right'], [/^session/, 'Session'],
  [/^Quotes/, 'Quote'], [/^(common|contact|time|api)/, 'PkCommon'],
];
const OBSERVATION_CLASSES = /^(Observation|Image|Location|Confidence|CharacterConfidence)/;

const PRIMITIVE_FORMATS = { 'date-time': 'DateTime', date: 'Date', uuid: 'Uuid', uri: 'Url', email: 'Email', duration: 'Duration' };
const PRIMITIVES = { string: 'String', integer: 'Integer', number: 'Decimal', boolean: 'Boolean' };
const REGISTRY_REF = /`(apx-[a-z-]+)`/g;

const load = (path) => yaml.load(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
const refName = (ref) => ref.split('/').pop();

export function humanize(name) {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[\s_.]+/);
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : /^[A-Z]{2,}/.test(w) ? w : w.toLowerCase())).join(' ');
}

export function firstParagraph(text) {
  return String(text ?? '').trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
}

function moduleOfSchema(root) {
  const owner = new Map();
  for (const m of MODULES) {
    const doc = load(join(root, 'spec', 'openapi', 'domains', m.dir, 'schemas.yaml')) ?? {};
    Object.keys(doc).forEach((name) => owner.set(name, m.dir));
  }
  return (name) => owner.get(name) ?? (/ChangePayload$/.test(name) ? 'data' : 'common');
}

function apdsDomain(name, schema) {
  const pkg = schema['x-package'];
  if (pkg) return (APDS_DOMAIN.find(([re]) => re.test(pkg)) ?? [, 'PkCommon'])[1];
  return OBSERVATION_CLASSES.test(name) ? 'Observation' : 'PkCommon';
}

function loadRegistries(root) {
  const dir = join(root, 'spec', 'registries');
  return Object.fromEntries(readdirSync(dir).filter((f) => f.startsWith('apx-') && f.endsWith('.json')).map((f) => {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return [basename(f, '.json'), { name: basename(f, '.json'), entries: r.userDefinedCodeListEntries ?? [] }];
  }));
}

// Proposals name the APX element they come from in their `apx` field.
function loadProposals(root, classNames, registryNames) {
  const dir = join(root, 'spec', 'proposals', 'apds-additions');
  const bySchema = new Map();
  const byRegistry = new Map();
  const all = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
    const d = load(join(dir, f));
    for (const p of d.packages ?? []) {
      for (const [kind, items] of [['class', p.classes ?? []], ['enum', p.enumerations ?? []]]) {
        for (const item of items) {
          const entry = { name: item.name, change: item.change, tier: item.tier, kind, domain: d.domain, pkg: p.name, apx: item.apx };
          all.push(entry);
          const text = String(item.apx ?? '');
          const words = text.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? [];
          for (const w of new Set(words)) {
            if (classNames.has(w)) (bySchema.get(w) ?? bySchema.set(w, []).get(w)).push(entry);
          }
          // Registries are named by id (apx-violation-types) or in prose (violation types).
          for (const r of registryNames) {
            const phrase = r.slice(4).replace(/-/g, ' ');
            if (text.includes(r) || text.toLowerCase().includes(phrase)) (byRegistry.get(r) ?? byRegistry.set(r, []).get(r)).push(entry);
          }
        }
      }
    }
  }
  return { all, bySchema, byRegistry };
}

export function loadModel(root) {
  const dist = load(join(root, 'spec', 'dist', 'apx-v1.yaml'));
  const apdsDoc = load(join(root, 'spec', 'vendor', 'apds', '4.1', 'apds-api-4.1.yaml'));
  const apds = apdsDoc.components.schemas;
  const apdsPaths = new Set(Object.entries(apdsDoc.paths ?? {}).flatMap(([path, item]) => METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`)));
  const schemas = dist.components.schemas;
  const owner = moduleOfSchema(root);
  const registries = loadRegistries(root);
  const isApds = (name) => Object.hasOwn(apds, name);
  const pkgOf = Object.fromEntries(MODULES.map((m) => [m.dir, m.pkg]));
  const qualify = (name) => (isApds(name) ? `${apdsDomain(name, apds[name])}.${name}` : `${pkgOf[owner(name)]}.${name}`);
  const apxNames = Object.keys(schemas).filter((n) => !isApds(n));
  const proposals = loadProposals(root, new Set(apxNames), new Set(Object.keys(registries)));
  const ctx = { schemas, isApds, qualify, registries };

  const classes = apxNames.map((name) => buildClass(name, schemas[name], owner(name), ctx, proposals));
  const supplement = loadSupplement(root);
  fillDefinitions(classes, schemas, supplement.members ?? {});
  for (const c of classes) for (const e of c.enumerations) e.editorial = supplement.enumValues?.[e.name] ?? {};
  const enumerations = classes.flatMap((c) => c.enumerations);
  return {
    dist, apds, schemas, registries, proposals, classes, enumerations, qualify, isApds,
    apdsUsed: apdsUsage(apds, schemas, qualify),
    operations: buildOperations(dist),
    apdsPaths,
    version: dist.info?.version,
  };
}

// ---------- classes and members ----------

function buildClass(name, schema, dir, ctx, proposals) {
  const isEnum = Array.isArray(schema.enum);
  const parents = (schema.allOf ?? []).filter((p) => p.$ref).map((p) => ctx.qualify(refName(p.$ref)));
  const parts = [schema, ...(schema.allOf ?? []).filter((p) => !p.$ref)];
  const required = new Set(parts.flatMap((p) => p.required ?? []));
  const cls = {
    name, dir, schema, isEnum,
    kind: isEnum ? 'enumeration' : schema.oneOf || schema.anyOf ? 'union' : schema.type === 'array' ? 'list' : schema.type && schema.type !== 'object' ? 'datatype' : 'class',
    designation: humanize(name),
    definition: firstParagraph(schema.description) || humanize(name),
    description: String(schema.description ?? '').trim(),
    parents,
    proposedAs: proposals.bySchema.get(name) ?? [],
    attributes: [], associations: [], enumerations: [], registries: new Set(),
  };
  if (isEnum) {
    cls.enumerations.push({ name, owner: name, dir, definition: cls.definition, description: cls.description, values: schema.enum.map(String), named: true });
    return cls;
  }
  for (const p of parts) addMembers(cls, '', p.properties ?? {}, p.required ? new Set(p.required) : required, ctx);
  // A list schema: its items are the members (inline) or one association ($ref).
  if (schema.type === 'array' && schema.items) {
    if (schema.items.properties) addMembers(cls, 'item.', schema.items.properties, new Set(schema.items.required ?? []), ctx);
    else cls.associations.push(member('item', { type: 'array', items: schema.items, description: schema.description }, false, ctx, cls, ''));
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !parts.some((p) => p.properties)) {
    cls.attributes.push(member('(any key)', schema.additionalProperties, false, ctx, cls, ''));
  }
  return cls;
}

function addMembers(cls, prefix, props, required, ctx) {
  for (const [key, prop] of Object.entries(props)) {
    const m = member(prefix + key, prop, required.has(key), ctx, cls, prefix);
    (m.association ? cls.associations : cls.attributes).push(m);
    const inner = unwrap(prop);
    const obj = inner.items && !inner.items.$ref ? inner.items : inner;
    if (!obj.$ref && obj.properties) addMembers(cls, `${prefix}${key}.`, obj.properties, new Set(obj.required ?? []), ctx);
    if (inner.refinedProperties && Object.keys(inner.refinedProperties).length) {
      addMembers(cls, `${prefix}${key}.`, inner.refinedProperties, new Set(inner.refinedRequired), ctx);
    }
  }
}

// Strip nullable wrappers: anyOf/oneOf of one schema plus null.
function unwrap(prop) {
  const alts = prop.anyOf ?? prop.oneOf;
  if (alts) {
    const real = alts.filter((a) => a.type !== 'null');
    if (real.length === 1) return { ...prop, ...real[0], anyOf: undefined, oneOf: undefined, nullable: true };
  }
  if (prop.allOf?.length === 1) return { ...prop, ...prop.allOf[0], allOf: undefined };
  if (prop.allOf?.length > 1) {
    // A $ref plus local refinements: the $ref gives the type; the extra
    // properties are listed as members of the referencing class.
    const ref = prop.allOf.find((p) => p.$ref);
    const properties = Object.assign({}, ...prop.allOf.map((p) => p.properties ?? {}));
    const required = prop.allOf.flatMap((p) => p.required ?? []);
    return { ...prop, ...(ref ?? {}), allOf: undefined, refinedProperties: properties, refinedRequired: required };
  }
  return prop;
}

function member(name, raw, isRequired, ctx, cls, prefix) {
  const prop = unwrap(raw);
  const types = Array.isArray(prop.type) ? prop.type : [prop.type];
  const many = types.includes('array');
  const target = many ? unwrap(prop.items ?? {}) : prop;
  const { type, association } = typeOf(target, ctx, cls, name);
  const lower = !isRequired ? 0 : many ? (prop.minItems ?? 0) : 1;
  const upper = many ? (prop.maxItems ?? '*') : 1;
  const description = String(raw.description ?? prop.description ?? target.description ?? '').trim();
  const regs = [...description.matchAll(REGISTRY_REF)].map((m) => m[1]).filter((r) => ctx.registries[r]);
  regs.forEach((r) => cls.registries.add(r));
  const notes = [
    prop.readOnly && 'read-only', prop.writeOnly && 'write-only', prop.deprecated && 'deprecated',
    (prop.nullable || types.includes('null')) && 'nullable',
  ].filter(Boolean);
  return {
    name, prefix, designation: humanize(name.split('.').pop()),
    definition: firstParagraph(description),
    targetName: refTarget(target),
    multiplicity: `${lower}..${upper}`,
    type: regs.length ? `${type} (code list ${regs.join(', ')})` : type,
    target: association ? type : null, association, notes, registries: regs,
  };
}

function refTarget(t) {
  const ref = t.$ref ?? (t.anyOf ?? t.oneOf ?? []).find((a) => a.$ref)?.$ref;
  return ref ? refName(ref) : null;
}

// A reference to a class is an association; one to a datatype or an
// enumeration (a string, number or similar) is an attribute, as in APDS.
function isStructured(s) {
  if (Array.isArray(s.enum)) return false;
  return s.type === 'object' || !!(s.properties || s.allOf || s.oneOf || s.anyOf || s.$ref) || (!s.type && !s.format);
}

function typeOf(t, ctx, cls, name) {
  if (t.$ref) {
    const n = refName(t.$ref);
    const s = ctx.schemas[n] ?? {};
    return { type: ctx.qualify(n), association: isStructured(s) };
  }
  const alts = t.anyOf ?? t.oneOf;
  if (alts) {
    const parts = alts.filter((a) => a.type !== 'null').map((a) => typeOf(a, ctx, cls, name));
    return { type: parts.map((p) => p.type).join(' or '), association: parts.some((p) => p.association) };
  }
  if (Array.isArray(t.enum)) {
    const enumName = `${cls.name}.${name}`;
    cls.enumerations.push({ name: enumName, owner: cls.name, dir: cls.dir, definition: firstParagraph(t.description) || `Values of ${name} on ${cls.name}.`, description: String(t.description ?? ''), values: t.enum.filter((v) => v !== null).map(String), named: false });
    return { type: `${enumName} (enumeration)`, association: false };
  }
  if (t.const !== undefined) return { type: `String (fixed value "${t.const}")`, association: false };
  const types = (Array.isArray(t.type) ? t.type : [t.type]).filter((x) => x && x !== 'null');
  const base = types[0];
  if (base === 'object') {
    if (t.properties) return { type: 'Structure (members below)', association: false };
    if (t.additionalProperties && typeof t.additionalProperties === 'object') {
      return { type: `Map of ${typeOf(unwrap(t.additionalProperties), ctx, cls, name).type}`, association: false };
    }
    return { type: 'Object', association: false };
  }
  if (base === 'string' && PRIMITIVE_FORMATS[t.format]) return { type: PRIMITIVE_FORMATS[t.format], association: false };
  return { type: PRIMITIVES[base] ?? (base ? humanize(base) : 'Any'), association: false };
}

// ---------- definitions for members the OpenAPI document leaves bare ----------

// Wording for members that recur across APX resources (Part 4 identity
// and record conventions), used only when a member has no description.
const COMMON_DEFINITIONS = {
  id: 'Unique identifier of the record (Part 4).',
  version: 'Version number of the record; increases by one on each change (Part 4).',
  extensions: 'Implementer extensions, keyed by a namespaced name (Part 10).',
  note: 'Free-text note from the actor.',
  notes: 'Free-text notes.',
  description: 'Free-text description.',
  name: 'Name in natural language.',
  actor: 'The person or system that performed the action.',
  reason: 'Why the action was taken.',
  detail: 'Further detail, in free text.',
  page: 'Pagination information for this page of results.',
  correlationId: 'Identifier that links related requests and records.',
  confidence: 'Confidence in the value, from 0 to 1.',
  plate: 'Vehicle license plate text as read or entered.',
  jurisdiction: 'Issuing jurisdiction of the plate (state, province or country).',
  stateProvince: 'State or province that issued the plate.',
  make: 'Vehicle make.',
  model: 'Vehicle model.',
  mileage: 'Odometer reading.',
  ticketNumber: 'Number printed on, or encoded in, the parking ticket.',
};

// Editorial definitions, written from the APX standard text, for members
// and enumeration values the OpenAPI document leaves undescribed.
function loadSupplement(root) {
  const path = join(root, 'docs', 'apx-specification', 'src', 'definitions.yaml');
  return existsSync(path) ? load(path) ?? {} : {};
}

function fillDefinitions(classes, schemas, editorial) {
  for (const c of classes) {
    for (const m of [...c.attributes, ...c.associations]) {
      if (m.definition) { m.source = 'spec'; continue; }
      const leaf = m.name.split('.').pop();
      const target = m.targetName && firstParagraph(schemas[m.targetName]?.description);
      const pick = [[Object.hasOwn(editorial, `${c.name}.${m.name}`) && editorial[`${c.name}.${m.name}`], 'editorial'], [Object.hasOwn(COMMON_DEFINITIONS, leaf) && COMMON_DEFINITIONS[leaf], 'common'], [target, 'target']].find(([d]) => d);
      const generic = /(Status|State)$|^state$/.test(leaf)
        ? `Current state of the ${c.designation.toLowerCase()}; the values are listed in A.3.`
        : `${humanize(leaf)} of the ${c.designation.toLowerCase()}.`;
      m.definition = pick ? pick[0] : generic;
      m.source = pick ? pick[1] : 'generic';
    }
  }
}

// ---------- APDS classes as APX uses them ----------

function propNames(s) {
  return new Set([s, ...(s.allOf ?? [])].flatMap((p) => Object.keys(p.properties ?? {})));
}

function apdsUsage(apds, schemas, qualify) {
  return Object.keys(apds).filter((n) => schemas[n]).sort().map((name) => {
    const before = apds[name];
    const after = schemas[name];
    const same = JSON.stringify(before) === JSON.stringify(after);
    const added = [...propNames(after)].filter((p) => !propNames(before).has(p));
    return { name, qualified: qualify(name), changed: !same, added, definition: firstParagraph(after.description) };
  });
}

// ---------- operations ----------

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function bodyType(content) {
  const media = content && (content['application/json'] ?? Object.values(content)[0]);
  const s = media?.schema;
  if (!s) return content ? Object.keys(content).join(', ') : '';
  if (s.$ref) return refName(s.$ref);
  if (s.type === 'array' && s.items?.$ref) return `array of ${refName(s.items.$ref)}`;
  if (s.allOf || s.oneOf || s.anyOf) return (s.allOf ?? s.oneOf ?? s.anyOf).map((x) => (x.$ref ? refName(x.$ref) : x.type ?? 'object')).join(' / ');
  return s.type ?? 'object';
}

function resolveParam(dist, p) {
  return p.$ref ? dist.components.parameters[refName(p.$ref)] : p;
}

function buildOperations(dist) {
  const ops = [];
  const add = (path, method, op, shared, kind) => ops.push({
    kind, path, method: method.toUpperCase(), id: op.operationId, tag: op.tags?.[0] ?? (kind === 'webhook' ? 'Webhooks' : 'Other'),
    summary: op.summary ?? '', description: String(op.description ?? '').trim(),
    params: [...(shared ?? []), ...(op.parameters ?? [])].map((p) => resolveParam(dist, p)).filter(Boolean),
    request: op.requestBody ? bodyType((op.requestBody.$ref ? dist.components.requestBodies?.[refName(op.requestBody.$ref)] : op.requestBody)?.content) : '',
    responses: Object.entries(op.responses ?? {}).map(([code, r]) => {
      const res = r.$ref ? dist.components.responses[refName(r.$ref)] : r;
      return { code, description: firstParagraph(res?.description), body: bodyType(res?.content) };
    }),
    scopes: [...new Set((op.security ?? dist.security ?? []).flatMap((s) => Object.values(s).flat()))],
    deprecated: !!op.deprecated,
  });
  for (const [path, item] of Object.entries(dist.paths ?? {})) {
    for (const m of METHODS) if (item[m]) add(path, m, item[m], item.parameters, 'operation');
  }
  for (const [name, item] of Object.entries(dist.webhooks ?? {})) {
    for (const m of METHODS) if (item[m]) add(name, m, item[m], item.parameters, 'webhook');
  }
  return ops;
}
