#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site into site/ (gitignored):
 *
 *   /                    landing page (from docs/site/index.html)
 *   /reference.html      Redoc reference — full APX standard
 *   /parcs.html          Redoc reference — PARCS starter profile
 *   /apx-v1.yaml, /apx-v1.json, /apx-parcs.json   the bundles
 *   /registries/         the code-list registries, served as JSON, plus an
 *                        index generated from the files themselves
 *
 * Part 11 §11.2 requires the registries an implementation validates against
 * to be served or linked. Publishing them here is what makes that true while
 * the canonical apx-standard.org domain is undelegated.
 *
 * `redocly build-docs` renders the two Redoc pages BEFORE this script runs
 * (see the docs:build script). Written in Node rather than shell on purpose:
 * CI is Ubuntu, development is Windows.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const SRC = join(ROOT, 'docs', 'site');
const DIST = join(ROOT, 'spec', 'dist');
const REG_SRC = join(ROOT, 'spec', 'registries');
const REG_OUT = join(SITE, 'registries');

const BUNDLES = ['apx-v1.yaml', 'apx-v1.json', 'apx-parcs.json'];
const PAGES = ['index.html'];
const RENDERED = ['reference.html', 'parcs.html'];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

mkdirSync(SITE, { recursive: true });
mkdirSync(REG_OUT, { recursive: true });

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

// ----- registries: copy, then index them from their own contents -----------
const registryFiles = readdirSync(REG_SRC)
  .filter((f) => f.startsWith('apx-') && f.endsWith('.json'))
  .sort();

if (registryFiles.length === 0) {
  console.error('[docs:site] FAIL no apx-*.json registries found');
  process.exit(1);
}

const rows = [];
for (const file of registryFiles) {
  const doc = JSON.parse(readFileSync(join(REG_SRC, file), 'utf8'));
  copyFileSync(join(REG_SRC, file), join(REG_OUT, file));
  rows.push({
    file,
    name: doc.name ?? file.replace(/\.json$/, ''),
    version: doc.version ?? '?',
    count: Array.isArray(doc.userDefinedCodeListEntries) ? doc.userDefinedCodeListEntries.length : 0,
  });
}
copyFileSync(join(REG_SRC, 'registry.schema.json'), join(REG_OUT, 'registry.schema.json'));

const registryIndex = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>APX registries</title>
<meta name="description" content="The APX code-list registries, published as APDS UserDefinedCodeList documents.">
<style>
  :root { --bg:#fff; --surface:#f6f7f9; --border:#d9dde3; --text:#15181d; --muted:#5b636e; --accent:#0a5ad6; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f1216; --surface:#171b21; --border:#2a313a; --text:#e8ebef; --muted:#9aa3ae; --accent:#6ea8fe; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:820px; margin:0 auto; padding:56px 16px 72px; }
  h1 { font-size:32px; margin:0 0 12px; letter-spacing:-0.02em; }
  p { color:var(--muted); max-width:66ch; }
  a { color:var(--accent); }
  table { width:100%; border-collapse:collapse; margin:28px 0; font-size:15px; }
  th { text-align:left; font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); border-bottom:1px solid var(--border); padding:8px 10px; }
  td { padding:11px 10px; border-bottom:1px solid var(--border); }
  td.num { text-align:right; color:var(--muted); font-variant-numeric:tabular-nums; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:14px; }
  .back { font-size:14px; }
</style>
</head>
<body>
<div class="wrap">
  <p class="back"><a href="../">&larr; APX v${escapeHtml(version)}</a></p>
  <h1>Registries</h1>
  <p>
    APX open vocabularies, published as APDS <code>UserDefinedCodeList</code>
    documents and validated in CI against
    <a href="registry.schema.json"><code>registry.schema.json</code></a>.
    Entries are add-only: a defined value is never removed or re-meant, and
    every addition increments the list version.
  </p>
  <table>
    <thead><tr><th>Registry</th><th>File</th><th class="num">Version</th><th class="num">Entries</th></tr></thead>
    <tbody>
${rows
  .map(
    (r) =>
      `      <tr><td>${escapeHtml(r.name)}</td><td><a href="${escapeHtml(r.file)}"><code>${escapeHtml(r.file)}</code></a></td><td class="num">${escapeHtml(r.version)}</td><td class="num">${r.count}</td></tr>`
  )
  .join('\n')}
    </tbody>
  </table>
  <p>
    Implementers extend a vocabulary by publishing their own list with their
    own creator and locator, never by modifying these files. See
    <a href="https://github.com/rneubauer/apx/blob/main/docs/standard/11-registries.md">Part 11</a>
    of the written standard, which also describes how to request an entry.
  </p>
</div>
</body>
</html>
`;
writeFileSync(join(REG_OUT, 'index.html'), registryIndex);

// ----- landing page --------------------------------------------------------
for (const page of PAGES) {
  const html = readFileSync(join(SRC, page), 'utf8').replaceAll('{{APX_VERSION}}', version);
  writeFileSync(join(SITE, page), html);
}

// Skip Jekyll: nothing here needs it, and it would strip dotfiles.
writeFileSync(join(SITE, '.nojekyll'), '');

console.log(
  `[docs:site] site/ assembled for v${version}: ${PAGES.length + RENDERED.length} pages, ` +
    `${BUNDLES.length} bundles, ${rows.length} registries`
);
