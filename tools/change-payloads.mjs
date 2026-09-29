/**
 * Derives one typed change payload per native APDS class (Part 5 §5.1a)
 * and puts it in place of the generic ChangePayload on that class's native
 * PUT. Called by apply-overlay.mjs after the overlays, so it sees the
 * effective document (errata workarounds included).
 *
 * Why: a native PUT body is `anyOf [<Class>, ChangePayload]`, because the
 * APX-Update-Mode header picks the shape and OpenAPI cannot key a schema
 * on a header. The generic ChangePayload requires only `id`, so any body
 * with an `id` validated and full-mode writes were never checked. A typed
 * change payload keeps change mode possible (every member optional, `null`
 * clears it) while checking every member it carries:
 *
 *  - scalar members keep the class's own schema (or `null`);
 *  - `extensions` is the APX Extensions container (or `null`), so APX
 *    decorations stay bound (Part 4 §4.3);
 *  - object members, and array items that are objects, are left open,
 *    because nested objects with their own `id` follow the change rule
 *    themselves (Part 5 §5.1);
 *  - a member the class does not define is refused
 *    (`additionalProperties: false`, Part 5 §5.1a).
 *
 * The generic ChangePayload stays as the shape of ChangeFeedPage items.
 */

const PREFIX = '#/components/schemas/';

/** Native PUT → the class whose members its change payload may carry. */
export const NATIVE_PUTS = {
  '/places/{id}': 'HierarchyElement',
  '/contacts/{contactId}': 'ContactPoint',
  '/rights/specs/{id}': 'RightSpecification',
  '/rates/{id}': 'RateTable',
  '/sessions/{id}': 'Session',
  '/rights/assigned/{id}': 'AssignedRight',
};

function deref(schemas, node) {
  let n = node;
  const seen = new Set();
  while (n && n.$ref && n.$ref.startsWith(PREFIX)) {
    const name = n.$ref.slice(PREFIX.length);
    if (seen.has(name)) break;
    seen.add(name);
    n = schemas[name];
  }
  return n ?? {};
}

/** Collect the members of a class: its own properties plus every allOf part. */
function collect(schemas, node, out, seen = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (node.$ref && node.$ref.startsWith(PREFIX)) {
    const name = node.$ref.slice(PREFIX.length);
    if (seen.has(name)) return out;
    seen.add(name);
    return collect(schemas, schemas[name], out, seen);
  }
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (!(key in out)) out[key] = value;
  }
  for (const part of node.allOf ?? []) collect(schemas, part, out, seen);
  return out;
}

/** HierarchyElement is polymorphic: its change payload may carry any mapped subtype's members. */
function membersOf(schemas, className) {
  const base = schemas[className];
  const out = collect(schemas, base, {});
  for (const target of Object.values(base?.discriminator?.mapping ?? {})) {
    collect(schemas, { $ref: target }, out);
  }
  return out;
}

function isObjectish(s) {
  return s.type === 'object' || s.properties || s.allOf || s.oneOf || s.anyOf || s.discriminator;
}

function changeMember(schemas, key, schema) {
  if (key === 'extensions') {
    return { anyOf: [{ $ref: `${PREFIX}Extensions` }, { type: 'null' }] };
  }
  const resolved = deref(schemas, schema);
  if (resolved.type === 'array') {
    const items = deref(schemas, resolved.items ?? {});
    const out = { type: ['array', 'null'] };
    if (resolved.minItems !== undefined) out.minItems = resolved.minItems;
    if (resolved.maxItems !== undefined) out.maxItems = resolved.maxItems;
    out.items = isObjectish(items) ? { type: 'object' } : resolved.items ?? {};
    return out;
  }
  if (isObjectish(resolved)) return { type: ['object', 'null'] };
  return { anyOf: [schema, { type: 'null' }] };
}

export function deriveChangePayloads(doc) {
  const schemas = doc.components.schemas;
  const made = [];
  for (const [path, className] of Object.entries(NATIVE_PUTS)) {
    const content = doc.paths[path]?.put?.requestBody?.content?.['application/json'];
    const branches = content?.schema?.anyOf;
    const generic = branches ? branches.findIndex((b) => b.$ref === `${PREFIX}ChangePayload`) : -1;
    if (generic < 0) {
      throw new Error(`${path}: expected anyOf [${className}, ChangePayload]`);
    }
    const members = membersOf(schemas, className);
    const properties = {};
    for (const [key, schema] of Object.entries(members)) {
      properties[key] = key === 'id'
        ? { type: 'string', minLength: 1, description: 'The entity identifier (APDS VersionedIdentity.id).' }
        : changeMember(schemas, key, schema);
    }
    const name = `${className}ChangePayload`;
    schemas[name] = {
      title: name,
      description:
        `A change-mode body for native \`PUT ${path}\` (Part 5 §5.1a): \`id\` plus only ` +
        `the ${className} members that changed; an absent member is unchanged and an ` +
        'explicit `null` clears it. Every member present is checked against the class, ' +
        'and a member the class does not define is refused. Generated at build time ' +
        '(tools/change-payloads.mjs); the generic ChangePayload remains the shape of ' +
        'change-feed items.',
      type: 'object',
      required: ['id'],
      properties,
      additionalProperties: false,
    };
    branches[generic] = { $ref: `${PREFIX}${name}` };
    made.push(name);
  }
  return made;
}
