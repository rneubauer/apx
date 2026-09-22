#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site into site/ (gitignored):
 *
 *   /                 landing page (from docs/site/index.html)
 *   /reference.html   Redoc reference — full APX standard
 *   /parcs.html       Redoc reference — PARCS starter profile
 *   /apx-v1.yaml, /apx-v1.json, /apx-parcs.json   the committed bundles
 *
 * `redocly build-docs` renders the two Redoc pages BEFORE this script runs
 * (see the docs:build script); this copies the landing page and the
 * bundles and stamps the package version in. Written in Node rather than
 * shell on purpose: CI is Ubuntu, development is Windows.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const SRC = join(ROOT, 'docs', 'site');
const DIST = join(ROOT, 'spec', 'dist');

const BUNDLES = ['apx-v1.yaml', 'apx-v1.json', 'apx-parcs.json'];
const PAGES = ['index.html'];
const RENDERED = ['reference.html', 'parcs.html'];

mkdirSync(SITE, { recursive: true });

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

for (const page of RENDERED) {
  if (!existsSync(join(SITE, page))) {
    console.error(`[docs:site] FAIL site/${page} missing — redocly build-docs must run first`);
    process.exit(1);
  }
}

for (const bundle of BUNDLES) {
  copyFileSync(join(DIST, bundle), join(SITE, bundle));
}

for (const page of PAGES) {
  const html = readFileSync(join(SRC, page), 'utf8').replaceAll('{{APX_VERSION}}', version);
  writeFileSync(join(SITE, page), html);
}

// Skip Jekyll: nothing here needs it, and it would strip dotfiles.
writeFileSync(join(SITE, '.nojekyll'), '');

console.log(
  `[docs:site] site/ assembled for v${version}: ${PAGES.length + RENDERED.length} pages, ${BUNDLES.length} bundles`
);
