#!/usr/bin/env node
/**
 * Renders a document set to print-ready HTML and PDF in site/<set>/ (build
 * output, not committed), in the form of the APDS 4.1 technical documents:
 * a centred cover, the mark at the top right of every page, a footer that
 * names the document and its release beside the page number, Arial text,
 * and class diagrams drawn as beige «D2Class» boxes.
 *
 *   apds-submission    docs/apds-submission/0[1-4]-*.md (proposed data elements)
 *   apx-specification  docs/apx-specification/0[1-6]-*.md (the full APX set)
 *
 * Diagrams are drawn by Mermaid in a headless browser, so the first run
 * needs network access to cdn.jsdelivr.net. The header and footer are
 * printed through the DevTools protocol (Page.printToPDF), which the
 * command line cannot do.
 *
 *   node tools/build-apds-submission-pdf.mjs [apds-submission|apx-specification]
 *
 * Uses Edge or Chrome (set BROWSER to override the path). Optional: not
 * part of npm test.
 */
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CSS, coverHtml, documentMeta, markdownToHtml, mermaidScript, pageTemplates, printJobs, stripTitle, escapeHtml, readText } from './apx-docs/print.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETS = {
  'apds-submission': { prefix: 'APX-Data-Specification', keepNumber: false, set: 'APX Data Specification for the APDS committee' },
  'apx-specification': { prefix: 'APX-Specification', keepNumber: true, set: 'APX Specification: technical documentation' },
};
const SET = process.argv[2] ?? 'apds-submission';
if (!SETS[SET]) throw new Error(`Unknown document set "${SET}"; use one of ${Object.keys(SETS).join(', ')}.`);
const SRC = join(ROOT, 'docs', SET);
const OUT = join(ROOT, 'site', SET);
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const COPYRIGHT = '© 2026 Umojo, Inc. and APX contributors (MIT)';
const today = new Date().toISOString().slice(0, 10);

export function releaseLine(edition) {
  const m = edition.match(/APX (\d+\.\d+\.\d+)/);
  return `Edition ${m ? m[1] : version} (draft)`;
}

function toHtml(md) {
  const { title, edition } = documentMeta(md);
  const body = stripTitle(markdownToHtml(md));
  const release = releaseLine(edition);
  return {
    title, edition, release,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${CSS}</style></head><body>
${coverHtml({ title, set: SETS[SET].set, release: `Version ${release.replace(/^Edition /, '')}`, updated: today, edition })}
${body}
${mermaidScript()}
</body></html>`,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const docs = readdirSync(SRC).filter((f) => /^0\d-.*\.md$/.test(f)).sort();
  const { prefix, keepNumber } = SETS[SET];
  const jobs = docs.map((f) => {
    const htmlPath = join(OUT, `${basename(f, '.md')}.html`);
    const pdfPath = join(OUT, `${prefix}-${basename(f, '.md').slice(keepNumber ? 0 : 3)}.pdf`);
    const { title, release, html } = toHtml(readText(join(SRC, f)));
    writeFileSync(htmlPath, html);
    return { url: pathToFileURL(htmlPath).href, pdfPath, ...pageTemplates({ docTitle: title, release: `Version Release ${today}, ${release}`, copyright: COPYRIGHT }), onDone: () => console.log(`[pdf] ${pdfPath}`) };
  });
  await printJobs(jobs);
}

main().catch((e) => { console.error(`[pdf] FAIL ${e.message}`); process.exit(1); });
