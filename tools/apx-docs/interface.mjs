/**
 * Renders 05 Interface Specification: every operation and webhook in the
 * APX OpenAPI document, grouped as the API reference groups them
 * (x-tagGroups), with parameters, request body, responses and scopes.
 */
import { table, code } from './md.mjs';
import { firstParagraph } from './model.mjs';

const NATIVE = 'APDS 4.1 native route';

function groups(model) {
  const declared = model.dist['x-tagGroups'] ?? [];
  const seen = new Set(declared.flatMap((g) => g.tags));
  const rest = [...new Set(model.operations.map((o) => o.tag))].filter((t) => !seen.has(t));
  const native = (t) => model.operations.filter((o) => o.tag === t).every((o) => origin(model, o) === NATIVE);
  const webhooks = (t) => model.operations.filter((o) => o.tag === t).every((o) => o.kind === 'webhook');
  return [...declared,
    { name: 'Other APX routes', tags: rest.filter((t) => !native(t) && !webhooks(t)) },
    { name: 'Webhooks (event deliveries)', tags: rest.filter(webhooks) },
    { name: 'APDS 4.1 native routes', tags: rest.filter((t) => native(t) && !webhooks(t)) },
  ].filter((g) => g.tags.length);
}

function origin(model, op) {
  const apdsPaths = model.apdsPaths;
  return apdsPaths.has(`${op.method} ${op.path}`) ? NATIVE : op.kind === 'webhook' ? 'APX webhook' : 'APX';
}

function paramType(p) {
  const s = p.schema ?? {};
  if (s.$ref) return s.$ref.split('/').pop();
  if (s.anyOf || s.oneOf) return (s.anyOf ?? s.oneOf).map((x) => x.type ?? x.$ref?.split('/').pop()).filter((x) => x && x !== 'null').join(' or ');
  if (s.type === 'array') return `array of ${s.items?.type ?? s.items?.$ref?.split('/').pop() ?? 'value'}`;
  return [s.type, s.format].filter(Boolean).join(' ') + (s.enum ? ` (${s.enum.join(', ')})` : '');
}

function operationDetail(model, op, num) {
  const out = [`#### ${num} ${op.method} ${op.path}${op.deprecated ? ' (deprecated)' : ''}`, '',
    `**${op.summary || op.id}.** ${firstParagraph(op.description)}`, '',
    table(['Item', 'Value'], [
      ['Operation id', op.id ? code(op.id) : '—'],
      ['Origin', origin(model, op)],
      ['Scopes', op.scopes.length ? op.scopes.map(code).join(', ') : 'none'],
      ['Request body', op.request || '—'],
    ]), ''];
  if (op.params.length) {
    out.push(table(['Parameter', 'In', 'Required', 'Type', 'Description'],
      op.params.map((p) => [code(p.name), p.in, p.required ? 'yes' : 'no', paramType(p), firstParagraph(p.description)])), '');
  }
  out.push(table(['Response', 'Body', 'Meaning'], op.responses.map((r) => [r.code, r.body || '—', r.description])), '');
  return out.join('\n');
}

export function renderInterface(model, intro, head) {
  const out = [head, intro, ''];
  const all = model.operations;
  out.push('## Operations at a glance', '',
    `The APX OpenAPI document declares ${all.filter((o) => o.kind === 'operation').length} operations and ${all.filter((o) => o.kind === 'webhook').length} webhooks. `
    + `${all.filter((o) => origin(model, o) === NATIVE).length} operations are APDS 4.1 native routes that APX carries; the rest are defined by APX.`, '');
  const gs = groups(model);
  out.push(table(['Group', 'Tag', 'Operations'], gs.flatMap((g) => g.tags.map((t) => [g.name, t, all.filter((o) => o.tag === t).length]))), '');
  gs.forEach((g, gi) => {
    out.push(`## ${gi + 1} ${g.name}`, '');
    g.tags.forEach((t, ti) => {
      const ops = all.filter((o) => o.tag === t);
      if (!ops.length) return;
      const tagDoc = (model.dist.tags ?? []).find((x) => x.name === t);
      out.push(`### ${gi + 1}.${ti + 1} ${t}`, '', firstParagraph(tagDoc?.description), '',
        table(['Method', 'Path', 'Summary', 'Scopes'], ops.map((o) => [o.method, code(o.path), o.summary, o.scopes.map(code).join(' ')])), '');
      ops.forEach((o, oi) => out.push(operationDetail(model, o, `${gi + 1}.${ti + 1}.${oi + 1}`)));
    });
  });
  out.push(securityAnnex(model));
  return out.join('\n');
}

function securityAnnex(model) {
  const schemes = model.dist.components.securitySchemes ?? {};
  const rows = [];
  for (const [name, s] of Object.entries(schemes)) {
    for (const flow of Object.values(s.flows ?? {})) {
      for (const [scope, desc] of Object.entries(flow.scopes ?? {})) rows.push([name, code(scope), desc]);
    }
  }
  return ['## Annex S (informative) Security schemes and scopes', '',
    'Scopes are defined in the OpenAPI security schemes below and explained in APX Part 9. As elsewhere in this document, the OpenAPI document wins where the two differ.', '',
    table(['Scheme', 'Scope', 'Meaning'], rows), ''].join('\n');
}
