#!/usr/bin/env node
/**
 * Renders the APX Specification document set (docs/apx-specification/0*.md)
 * to site/specification/ for GitHub Pages: one HTML page per document, with
 * a table of contents down the left, the same stylesheet and diagram theme
 * as the print edition, and an index page. Diagrams are drawn by Mermaid in
 * the reader's browser, so the pages need no browser at build time.
 *
 *   node tools/build-apx-docs-html.mjs
 *
 * Runs as part of `npm run docs:build`. PDFs, when `npm run apxdocs:pdf`
 * has produced them in site/apx-specification/, are linked from the index.
 */
import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSS, SCREEN_CSS, WORDMARK_DATA_URI, coverHtml, documentMeta, markdownToHtml, mermaidScript, stripTitle, escapeHtml, readText } from './apx-docs/print.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'docs', 'apx-specification');
const OUT = join(ROOT, 'site', 'specification');
const PDF_DIR = join(ROOT, 'site', 'apx-specification');
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const SET = 'APX Specification: technical documentation';
const today = new Date().toISOString().slice(0, 10);

const DESCRIPTIONS = {
  '01-overview': 'What APX is, why it exists, how it relates to APDS, each module and its benefits, security, conformance.',
  '02-information-model': 'The modules, their classes and relationships, enumerations and code lists, with a class diagram for each.',
  '03-data-dictionary': 'Every class, attribute, association, enumeration and code list, in the APDS table format.',
  '04-use-cases': 'Worked use cases showing how the data and the API are applied, and the module scenario suites.',
  '05-interface-specification': 'Every operation and webhook, with parameters, bodies, responses and scopes.',
  '06-apds-requests': 'Corrections, Data Dictionary differences, new enumeration values and data elements offered to APDS.',
};

function headings(body) {
  const out = [];
  for (const m of body.matchAll(/<h([2-4]) id="([^"]+)">(.*?)<\/h\1>/g)) out.push({ level: Number(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, '') });
  return out;
}

function toc(docs, current, body) {
  const items = headings(body).map((h) => `<li class="l${h.level}"><a href="#${h.id}">${h.text}</a></li>`).join('\n');
  const list = docs.map((d) => `<li><a class="${d.slug === current ? 'current' : ''}" href="${d.slug}.html">${escapeHtml(d.title.replace(/^APX /, ''))}</a></li>`).join('\n');
  return `<nav class="toc"><a href="index.html"><img class="brand" src="${WORDMARK_DATA_URI}" alt="APX"></a>
<p class="set">${escapeHtml(SET)}</p>
<ol>${items}</ol>
<div class="docs"><p class="set">Documents</p><ol>${list}</ol><p class="set"><a href="../index.html">APX site</a> · <a href="../reference.html">API reference</a></p></div></nav>`;
}

function page(docs, d) {
  const topbar = `<div class="topbar"><span>${escapeHtml(d.title)} · ${escapeHtml(d.edition)}</span><img src="${WORDMARK_DATA_URI}" alt="APX"></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(d.title)}</title>
<style>${CSS}${SCREEN_CSS}</style></head><body><div class="shell">
${toc(docs, d.slug, d.body)}
<main class="page">${topbar}
${coverHtml({ title: d.title, set: SET, release: `Version ${version} (draft)`, updated: today, edition: d.edition })}
${d.body}
</main></div>
${mermaidScript()}
</body></html>`;
}

function index(docs) {
  const pdfs = existsSync(PDF_DIR) ? readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf')) : [];
  const rows = docs.map((d) => {
    const pdf = pdfs.find((f) => f.includes(d.slug));
    return `<tr><td><a href="${d.slug}.html">${escapeHtml(d.title.replace(/^APX /, ''))}</a></td><td>${escapeHtml(DESCRIPTIONS[d.slug] ?? '')}</td><td>${pdf ? `<a href="../apx-specification/${pdf}">PDF</a>` : '—'}</td></tr>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>APX Specification documents</title>
<style>${CSS}${SCREEN_CSS}</style></head><body><div class="shell">
<nav class="toc"><a href="../index.html"><img class="brand" src="${WORDMARK_DATA_URI}" alt="APX"></a><p class="set">${escapeHtml(SET)}</p>
<ol>${docs.map((d) => `<li><a href="${d.slug}.html">${escapeHtml(d.title.replace(/^APX /, ''))}</a></li>`).join('')}</ol>
<div class="docs"><p class="set"><a href="../index.html">APX site</a> · <a href="../reference.html">API reference</a></p></div></nav>
<main class="page">
${coverHtml({ title: 'APX Specification', set: SET, release: `Version ${version} (draft)`, updated: today, edition: 'Six documents in the form of the APDS 4.1 technical documentation' })}
<h2>The documents</h2>
<p>APX is documented the way APDS 4.1 is: an Overview, an Information Model, a Data Dictionary, a Use Case Document, and, because APX is an API as well as a data model, an Interface Specification and the requests APX makes of APDS. The Information Model, Data Dictionary and Interface Specification are generated from the OpenAPI document, so they can never disagree with it.</p>
<table><thead><tr><th>Document</th><th>What it holds</th><th>Print</th></tr></thead><tbody>${rows}</tbody></table>
<p>The sources are in <code>docs/apx-specification/</code> of the APX repository. The narrower <a href="../apds-submission/01-overview.html">APX Data Specification</a> holds only the data elements proposed to APDS.</p>
</main></div></body></html>`;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const docs = readdirSync(SRC).filter((f) => /^0\d-.*\.md$/.test(f)).sort().map((f) => {
    const md = readText(join(SRC, f));
    const { title, edition } = documentMeta(md);
    return { slug: basename(f, '.md'), title, edition, body: stripTitle(markdownToHtml(md)) };
  });
  for (const d of docs) writeFileSync(join(OUT, `${d.slug}.html`), page(docs, d));
  writeFileSync(join(OUT, 'index.html'), index(docs));
  console.log(`[apxdocs:html] site/specification/ — ${docs.length} documents and an index`);
}

main();
