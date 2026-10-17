/**
 * Renders 03 Data Dictionary in the layout of the APDS 4.1 Data
 * Dictionary: A.1 packages (classes, specializations, associations,
 * attributes), A.2 datatypes, A.3 enumerations, A.4 external code lists,
 * then annexes on the APDS classes APX uses and what APX proposes.
 */
import { MODULES } from './model.mjs';
import { table, byName, code, apdsStatus, valueDefinitions } from './md.mjs';

const GENERIC_MARK = ' ‡';

const DATATYPES = [
  ['String', 'A sequence of characters.', 'String'],
  ['Integer', 'A whole number.', 'Integer'],
  ['Decimal', 'A decimal number.', 'Decimal / Real'],
  ['Boolean', 'true or false.', 'Boolean'],
  ['DateTime', 'An instant, written per RFC 3339 with a UTC offset.', 'DateTime'],
  ['Date', 'A calendar date, written per RFC 3339 (full-date).', 'Date'],
  ['Uuid', 'A universally unique identifier per RFC 9562, used as a record id (Part 4).', 'String (identifier)'],
  ['Url', 'A URI per RFC 3986.', 'Url'],
  ['Email', 'An e-mail address.', 'Email'],
  ['Map of T', 'A JSON object whose keys are free text and whose values are of type T.', '—'],
  ['Structure', 'An unnamed group of members. Its members are listed under the owning class as owner.member.', '—'],
  ['Object', 'Any JSON object; its content is set by the referenced specification or by an extension.', '—'],
];

const EDITORIAL_MARK = ' †';
const def = (m) => m.definition + (m.source === 'generic' ? GENERIC_MARK : m.source === 'editorial' ? EDITORIAL_MARK : '');
const notes = (m) => m.notes.join(', ');

function packageSection(mod, classes, num, next) {
  const out = [`### A.1.${num} "${mod.pkg}" package`, '',
    `**A.1.${num}.1 Location of "${mod.pkg}" package.** The location of the "${mod.pkg}" package is:`, '',
    `\`-- APX/${mod.pkg}\` (source: \`spec/openapi/domains/${mod.dir}/schemas.yaml\`; normative text: APX ${mod.part})`, ''];
  const block = (n, title, rows, head) => out.push(`**A.1.${num}.${n} ${title} of the "${mod.pkg}" package**`, '',
    rows.length ? `*Table A.${next()} -- ${title} of the "${mod.pkg}" package*\n\n${table(head, rows)}` : `There are no ${title.toLowerCase()} in the "${mod.pkg}" package.`, '');
  const real = classes.filter((c) => !c.isEnum);
  block(2, 'Classes', real.map((c) => [c.name, c.designation, c.definition, c.kind, apdsStatus(c)]),
    ['Class name', 'Designation', 'Definition', 'Kind', 'APDS status']);
  block(3, 'Specializations', real.filter((c) => c.parents.length).flatMap((c) => c.parents.map((p) => [c.name, p])),
    ['Class name', 'Parent class name']);
  block(4, 'Associations', real.flatMap((c) => c.associations.map((a) => [c.name, a.name, a.designation, def(a), a.multiplicity, a.target, notes(a)])),
    ['Class name', 'Association end', 'Designation', 'Definition', 'Multiplicity', 'Target', 'Notes']);
  block(5, 'Attributes', real.flatMap((c) => c.attributes.map((a) => [c.name, a.name, a.designation, def(a), a.multiplicity, a.type, notes(a)])),
    ['Class name', 'Attribute name', 'Designation', 'Definition', 'Multiplicity', 'Type', 'Notes']);
  return out.join('\n');
}

function enumerationSection(e, num, next, qualify) {
  const editorial = Object.fromEntries(Object.entries(e.editorial ?? {}).map(([k, v]) => [k, `${v}${EDITORIAL_MARK}`]));
  const defs = { ...editorial, ...valueDefinitions(e.description, e.values) };
  const title = e.named ? qualify(e.name) : e.name;
  return [`### A.3.${num} The <<D2Enumeration>> "${title}"`, '',
    e.definition, '',
    e.named ? '' : `Defined inline on \`${e.owner}\`; the API names it by its owner and attribute.`, '',
    `*Table A.${next()} -- Values contained in the enumeration "${title}"*`, '',
    table(['Enumerated value name', 'Designation', 'Definition'], e.values.map((v) => [v, v.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(), defs[v] ?? '—'])), ''].join('\n');
}

function codeListSection(reg, users, proposals, num, next) {
  const used = users.length ? users.map(code).join(', ') : 'Not referenced by a schema description';
  const prop = (proposals.byRegistry.get(reg.name) ?? []).map((p) => `${p.name} (Tier ${p.tier})`).join(', ');
  return [`### A.4.${num} External code list "${reg.name}"`, '',
    `Used by: ${used}.${prop ? ` Seeds the APDS proposal ${prop}.` : ''} Published as an APDS \`UserDefinedCodeList\` at \`spec/registries/${reg.name}.json\` (Part 11).`, '',
    `*Table A.${next()} -- Entries in the code list "${reg.name}"*`, '',
    table(['definedValue', 'Description'], reg.entries.map((e) => [e.definedValue, e.entryDescription])), ''].join('\n');
}

function annexApds(model) {
  const rows = model.apdsUsed.map((u) => {
    const how = !u.changed ? 'Used as published'
      : u.added.length ? `APX overlay adds ${u.added.map(code).join(', ')}`
        : 'Corrected by the APX overlay (see 06, Part A)';
    return [u.name, u.qualified.split('.')[0], how];
  });
  return ['## Annex B (informative) APDS 4.1 classes used by APX', '',
    `APX carries ${model.apdsUsed.length} classes, datatypes and enumerations from the APDS 4.1 API document unchanged in meaning. Their definitions are in the APDS 4.1 Data Dictionary and are not repeated here. Where the APX overlay changes the published schema, the change is named. Additions are optional extension points (Part 10). Corrections work around the errata in 06, Part A.`, '',
    table(['APDS name', 'APDS domain', 'How APX uses it'], rows), ''].join('\n');
}

function annexProposals(model) {
  const rows = model.classes.filter((c) => c.proposedAs.length).sort(byName)
    .flatMap((c) => c.proposedAs.map((p) => [c.name, p.name, p.change === 'new' ? `new ${p.kind === 'enum' ? 'enumeration' : 'class'}` : `extends APDS ${p.name}`, p.domain, p.tier]));
  return ['## Annex C (informative) APX elements proposed to APDS', '',
    'Each row links an APX class to the APDS data element proposed from it. The full proposals, in APDS Data Dictionary format, are in `docs/apds-submission/03-data-dictionary.md`; 06 Requests to APDS summarizes them.', '',
    table(['APX class', 'Proposed APDS element', 'Change', 'APDS domain', 'Tier'], rows), ''].join('\n');
}

export function renderDataDictionary(model, intro, head) {
  let n = 0;
  const next = () => ++n;
  const out = [head, intro, ''];
  out.push('## A.1 Data dictionary of packages for "APX"', '');
  MODULES.forEach((mod, i) => {
    const classes = model.classes.filter((c) => c.dir === mod.dir).sort(byName);
    if (classes.length) out.push(packageSection(mod, classes, i + 1, next), '');
  });
  out.push('## A.2 Data dictionary of datatypes for "APX"', '',
    'APX uses the APDS 4.1 datatypes where a member carries APDS content. The types below are how this dictionary names the JSON types of APX members.', '',
    `*Table A.${next()} -- Datatypes*`, '', table(['Datatype', 'Definition', 'Nearest APDS 4.1 datatype'], DATATYPES), '');
  out.push('## A.3 Data dictionary of <<D2Enumeration>> for "APX"', '');
  [...model.enumerations].sort(byName).forEach((e, i) => out.push(enumerationSection(e, i + 1, next, model.qualify)));
  out.push('## A.4 External code lists for "APX"', '',
    'These lists extend APX string members without changing the schema, in the same way as the APDS user-defined code lists (APDS Use Case Document, Annex D). Implementers may publish further values (Part 11).', '');
  const usersOf = (reg) => model.classes.flatMap((c) => [...c.attributes, ...c.associations].filter((m) => m.registries.includes(reg)).map((m) => `${c.name}.${m.name}`));
  Object.values(model.registries).sort(byName).forEach((r, i) => out.push(codeListSection(r, usersOf(r.name), model.proposals, i + 1, next)));
  out.push(annexApds(model), annexProposals(model));
  return out.join('\n');
}

export function dataDictionaryStats(model) {
  const members = model.classes.flatMap((c) => [...c.attributes, ...c.associations]);
  return {
    classes: model.classes.filter((c) => !c.isEnum).length,
    attributes: members.filter((m) => !m.association).length,
    associations: members.filter((m) => m.association).length,
    enumerations: model.enumerations.length,
    codeLists: Object.keys(model.registries).length,
    undefinedInSpec: members.filter((m) => m.source === 'generic').length,
    editorial: members.filter((m) => m.source === 'editorial').length,
    undefinedValues: model.enumerations.reduce((n, e) => n + e.values.filter((v) => !(e.editorial ?? {})[v] && !valueDefinitions(e.description, [v])[v]).length, 0),
  };
}
