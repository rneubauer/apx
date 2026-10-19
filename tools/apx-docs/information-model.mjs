/**
 * Renders 02 Information Model: the hand-written module narratives in
 * docs/apx-specification/src/im/<module>.md, each followed by a class
 * diagram and summary tables generated from the OpenAPI document.
 */
import { MODULES } from './model.mjs';
import { table, byName, code, apdsStatus } from './md.mjs';

export const IM_SECTIONS = ['Purpose', 'Concepts', 'Lifecycle', 'Relationship to APDS'];
const MAX_DIAGRAM_MEMBERS = 12;
const REFERENCE_TYPES = new Set(['Reference', 'VersionedReference']);

const short = (qualified) => qualified.split(' ')[0].split('.').pop();
const mermaidType = (m) => {
  if (m.type.includes('(enumeration)')) return m.multiplicity.endsWith('*') ? 'Enum[]' : 'Enum';
  const t = m.type.startsWith('Structure') ? 'Structure' : m.type.replace(/\s*\(.*$/, '').replace(/^Map of .*/, 'Map').split(' or ')[0];
  return short(t).replace(/[^A-Za-z0-9]/g, '') + (m.multiplicity.endsWith('*') ? '[]' : '');
};

function classDiagram(classes, isApds) {
  const real = classes.filter((c) => !c.isEnum);
  if (!real.length) return '';
  const lines = ['```mermaid', 'classDiagram', '  direction LR'];
  const external = new Set();
  for (const c of real) {
    const members = [...c.attributes, ...c.associations].filter((m) => !m.prefix && (!m.association || REFERENCE_TYPES.has(m.targetName)));
    // Mermaid 10 rejects an empty member block, so a class without
    // attributes is declared bare.
    if (!members.length) lines.push(`  class ${c.name}`);
    else {
      lines.push(`  class ${c.name} {`);
      members.slice(0, MAX_DIAGRAM_MEMBERS).forEach((m) => lines.push(`    +${mermaidType(m)} ${m.name.replace(/[^A-Za-z0-9]/g, '')}`));
      if (members.length > MAX_DIAGRAM_MEMBERS) lines.push(`    +${members.length - MAX_DIAGRAM_MEMBERS} more in 03`);
      lines.push('  }');
    }
    if (c.proposedAs.length) lines.push(`  <<proposed>> ${c.name}`);
  }
  const names = new Set(real.map((c) => c.name));
  for (const c of real) {
    for (const p of c.parents) { const t = short(p); external.add(t); lines.push(`  ${t} <|-- ${c.name}`); }
    for (const a of c.associations.filter((m) => !m.prefix && m.targetName && !REFERENCE_TYPES.has(m.targetName))) {
      if (!names.has(a.targetName)) external.add(a.targetName);
      lines.push(`  ${c.name} --> "${a.multiplicity}" ${a.targetName} : ${a.name.replace(/[^A-Za-z0-9._-]+/g, ' ').trim()}`);
    }
  }
  for (const e of external) if (!names.has(e)) lines.push(`  class ${e}`, `  <<${isApds(e) ? 'APDS' : 'APX'}>> ${e}`);
  lines.push('```');
  return lines.join('\n');
}

function moduleTables(mod, classes, model) {
  const real = classes.filter((c) => !c.isEnum);
  const enums = model.enumerations.filter((e) => e.dir === mod.dir).sort(byName);
  const regs = [...new Set(classes.flatMap((c) => [...c.registries]))].sort();
  const out = [`#### Classes in ${mod.title}`, '',
    table(['Class', 'Definition', 'Members', 'APDS status'], real.map((c) => [code(c.name), c.definition, c.attributes.length + c.associations.length, apdsStatus(c)])), ''];
  out.push(`#### Enumerations in ${mod.title}`, '', enums.length
    ? table(['Enumeration', 'Values'], enums.map((e) => [code(e.named ? e.name : e.name), e.values.map(code).join(', ')])) : 'None.', '');
  out.push(`#### External code lists used in ${mod.title}`, '', regs.length
    ? table(['Code list', 'Entries', 'Examples'], regs.map((r) => [code(r), model.registries[r].entries.length, model.registries[r].entries.slice(0, 4).map((e) => code(e.definedValue)).join(', ')])) : 'None.', '');
  return out.join('\n');
}

const demote = (md) => md.replace(/^(#{1,4}) /gm, '##$1 ');

export function renderInformationModel(model, frags, intro, outro, head) {
  const out = [head, intro, '', '## Data model', ''];
  MODULES.forEach((mod, i) => {
    const classes = model.classes.filter((c) => c.dir === mod.dir).sort(byName);
    const f = frags[mod.dir] ?? {};
    out.push(`### ${i + 1} ${mod.title}`, '', `*Normative text: APX ${mod.part}. Package: \`APX/${mod.pkg}\`.*`, '');
    for (const s of IM_SECTIONS) if (f[s]) out.push(`#### ${s}`, '', demote(f[s]).replace(/^#### /gm, '##### '), '');
    const diagram = classDiagram(classes, model.isApds);
    if (diagram) out.push(`#### Class diagram`, '', diagram, '',
      `*Figure ${i + 1} -- ${mod.title}. Members of a «proposed» class are proposed to APDS (06, Part D). Classes marked «APDS» are defined in APDS 4.1. Up to ${MAX_DIAGRAM_MEMBERS} attributes are shown per class; 03 Data Dictionary lists them all.*`, '');
    out.push(moduleTables(mod, classes, model), '');
  });
  out.push(outro, '');
  return out.join('\n');
}
