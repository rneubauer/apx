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

// A Reference member says which class it points at only in prose ("a
// Reference to the VehicularAccess it serves"). The first known class
// name in that prose is the association's target, drawn as a dependency
// the way the APDS diagrams draw their reference attributes.
function referenceTarget(member, known) {
  const names = member.definition.match(/\b[A-Z][A-Za-z0-9]+\b/g) ?? [];
  return names.find((n) => known.has(n) && !REFERENCE_TYPES.has(n)) ?? null;
}

const SINGLETONS_PER_FIGURE = 4;
const label = (name) => name.replace(/[^A-Za-z0-9._-]+/g, ' ').trim();

// The class declaration block of one class, with its stereotype. The APDS
// documents stereotype every class «D2Class»; a class APX proposes to APDS
// is marked «proposed» instead.
function classBlock(c) {
  const lines = [];
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
  lines.push(`  <<${c.proposedAs.length ? 'proposed' : 'D2Class'}>> ${c.name}`);
  return lines;
}

// Every relationship a class has: to its parent, to the classes its
// associations target, and to the classes its Reference members name.
function edgesOf(c, known) {
  const out = [];
  for (const p of c.parents) out.push({ from: c.name, to: short(p), line: `  ${short(p)} <|-- ${c.name}` });
  for (const a of c.associations.filter((m) => !m.prefix && m.targetName && !REFERENCE_TYPES.has(m.targetName))) {
    out.push({ from: c.name, to: a.targetName, line: `  ${c.name} --> "${a.multiplicity}" ${a.targetName} : ${label(a.name)}` });
  }
  for (const r of c.associations.filter((m) => !m.prefix && REFERENCE_TYPES.has(m.targetName))) {
    const target = referenceTarget(r, known);
    if (target && target !== c.name) out.push({ from: c.name, to: target, line: `  ${c.name} ..> "${r.multiplicity}" ${target} : ${label(r.name)}` });
  }
  return out;
}

/**
 * The class diagrams of one module, drawn the way the APDS Information
 * Model draws its packages: one small figure per group of related
 * classes, so each fits a page at a readable size, rather than one
 * diagram of the whole package. Classes joined by a relationship share a
 * figure, titled after the class with the most members; classes with no
 * relationship inside the module are shown a few to a figure.
 */
function classDiagrams(classes, isApds, known, title) {
  const real = classes.filter((c) => !c.isEnum);
  if (!real.length) return [];
  const names = new Set(real.map((c) => c.name));
  const edges = real.flatMap((c) => edgesOf(c, known));
  // Union-find over the module's own classes.
  const parent = Object.fromEntries(real.map((c) => [c.name, c.name]));
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of edges) if (names.has(e.from) && names.has(e.to)) parent[find(e.from)] = find(e.to);
  const groups = new Map();
  for (const c of real) (groups.get(find(c.name)) ?? groups.set(find(c.name), []).get(find(c.name))).push(c);
  const size = (c) => c.attributes.length + c.associations.length;
  const connected = [];
  const singletons = [];
  for (const members of groups.values()) {
    const own = edges.filter((e) => members.some((c) => c.name === e.from));
    if (members.length > 1 || own.length) connected.push({ members, own });
    else singletons.push(members[0]);
  }
  connected.sort((a, b) => b.members.length - a.members.length || size(b.members[0]) - size(a.members[0]));
  const figures = [];
  const draw = (members, own, name, direction) => {
    const lines = ['```mermaid', 'classDiagram', `  direction ${direction}`];
    members.forEach((c) => lines.push(...classBlock(c)));
    const external = new Set(own.map((e) => e.to).filter((t) => !members.some((c) => c.name === t)));
    for (const e of own) lines.push(e.line);
    for (const e of external) lines.push(`  class ${e}`, `  <<${isApds(e) ? 'APDS' : 'APX'}>> ${e}`);
    lines.push('```');
    figures.push({ name, diagram: lines.join('\n') });
  };
  for (const g of connected) {
    const main = [...g.members].sort((a, b) => size(b) - size(a) || (a.name < b.name ? -1 : 1))[0];
    draw(g.members, g.own, `${main.name} class diagram`, g.members.length + new Set(g.own.map((e) => e.to)).size > 3 ? 'LR' : 'TB');
  }
  for (let i = 0; i < singletons.length; i += SINGLETONS_PER_FIGURE) {
    const chunk = singletons.slice(i, i + SINGLETONS_PER_FIGURE);
    draw(chunk, [], `${title} classes${i ? ' (continued)' : ''}`, 'TB');
  }
  return figures;
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
  const known = new Set([...Object.keys(model.apds), ...model.classes.map((c) => c.name)]);
  let figure = 0;
  MODULES.forEach((mod, i) => {
    const classes = model.classes.filter((c) => c.dir === mod.dir).sort(byName);
    const f = frags[mod.dir] ?? {};
    out.push(`### ${i + 1} ${mod.title}`, '', `*Normative text: APX ${mod.part}. Package: \`APX/${mod.pkg}\`.*`, '');
    for (const s of IM_SECTIONS) if (f[s]) out.push(`#### ${s}`, '', demote(f[s]).replace(/^#### /gm, '##### '), '');
    const figures = classDiagrams(classes, model.isApds, known, mod.title);
    if (figures.length) {
      const first = figure + 1;
      const last = figure + figures.length;
      out.push(`#### Class diagrams`, '', (figures.length === 1 ? `Figure ${first} provides a UML class diagram` : `Figures ${first} to ${last} provide the UML class diagrams`)
        + ` for the ${mod.title} package. A class marked «proposed» is proposed to APDS (06, Part D); one marked «APDS» is defined in APDS 4.1.`
        + ` Up to ${MAX_DIAGRAM_MEMBERS} attributes are shown per class; 03 Data Dictionary lists them all.`, '');
      for (const fig of figures) out.push(fig.diagram, '', `*Figure ${++figure} - ${fig.name}*`, '');
    }
    out.push(moduleTables(mod, classes, model), '');
  });
  out.push(outro, '');
  return out.join('\n');
}
