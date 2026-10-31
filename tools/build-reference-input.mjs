#!/usr/bin/env node
/**
 * Writes the input the Redoc reference page is built from: the bundle
 * (spec/dist/apx-v1.json) plus one sidebar entry per schema, so the
 * reference's search finds data models by name (LprReadDetail,
 * ObservationElement, …), not only operations. Redoc's search indexes
 * operations and tags; a schema that is only ever shown inside an
 * operation has nothing to be found by.
 *
 * Each schema becomes a trait tag (no operations) whose description is
 * Redoc's <SchemaDefinition> block, grouped under two nav groups: every
 * schema APX defines, and the core APDS 4.1 classes it reuses verbatim. Docs
 * only: the output goes to node_modules/.cache/apx-reference-input.json,
 * and the bundle itself is not touched (the contract stays the contract).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'spec', 'dist', 'apx-v1.json');
const APDS = join(ROOT, 'spec', 'vendor', 'apds', '4.1', 'apds-api-4.1.yaml');
const OUT = join(ROOT, 'node_modules', '.cache', 'apx-reference-input.json'); // the docs:build script reads it from here

const APX_GROUP = 'APX data models';
const APDS_GROUP = 'APDS 4.1 core data models';
// Every APDS schema would triple the page (and its load time); these are the
// core classes a reader comparing APX with APDS looks up, by package.
const CORE_APDS = [
  'HierarchyElement', 'Place', 'Campus', 'Space', 'Contact', // place
  'RightSpecification', 'RightPool', 'Eligibility', 'Credential', 'CredentialAssigned', 'AssignedRight', 'AssignedRightHolder', 'Payment', // rights
  'RateTable', 'RateLine', // rates
  'QuoteRightRequest', 'QuoteRightResponse', // quotes
  'Supply', 'DemandTable', 'OccupancyLevel', // occupancy
  'Session', 'Segment', // session
  'ObservationElement', 'VehicleAncillaryIdentification', 'Image', // observation
  'VersionedIdentity', 'Reference', // common
];

const spec = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const apdsNames = new Set(Object.keys(yaml.load(readFileSync(APDS, 'utf8')).components?.schemas ?? {}));

const tagName = (name) => `schema-${name}`;
const schemaTag = (name) => ({
  name: tagName(name),
  'x-displayName': name,
  'x-traitTag': true,
  description: `<SchemaDefinition schemaRef="#/components/schemas/${name}" showReadOnly={true} showWriteOnly={true} />`,
});

const names = Object.keys(spec.components?.schemas ?? {}).sort((a, b) => a.localeCompare(b));
const apx = names.filter((n) => !apdsNames.has(n));
const apds = CORE_APDS.filter((n) => apdsNames.has(n) && spec.components.schemas[n]);

spec.tags = [...(spec.tags ?? []), ...[...apx, ...apds].map(schemaTag)];
spec['x-tagGroups'] = [
  ...(spec['x-tagGroups'] ?? []),
  { name: APX_GROUP, tags: apx.map(tagName) },
  { name: APDS_GROUP, tags: apds.map(tagName) },
];

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(spec));
console.log(`[docs:reference] ${apx.length} APX + ${apds.length} APDS schemas added to the reference nav`);
