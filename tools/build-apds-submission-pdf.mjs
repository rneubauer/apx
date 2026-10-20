#!/usr/bin/env node
/**
 * Renders a document set to print-ready HTML and PDF in site/<set>/ (build
 * output, not committed), for sending to the APDS committee:
 *
 *   apds-submission    docs/apds-submission/0[1-4]-*.md (proposed data elements)
 *   apx-specification  docs/apx-specification/0[1-6]-*.md (the full APX set)
 *
 * Diagrams are drawn by Mermaid in a headless browser, so the first run
 * needs network access to cdn.jsdelivr.net.
 *
 *   node tools/build-apds-submission-pdf.mjs [apds-submission|apx-specification]
 *
 * Uses Edge or Chrome (set BROWSER to override the path). Optional: not
 * part of npm test.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SETS = {
  'apds-submission': { prefix: 'APX-Data-Specification', keepNumber: false },
  'apx-specification': { prefix: 'APX-Specification', keepNumber: true },
};
const SET = process.argv[2] ?? 'apds-submission';
if (!SETS[SET]) throw new Error(`Unknown document set "${SET}"; use one of ${Object.keys(SETS).join(', ')}.`);
const SRC = join(ROOT, 'docs', SET);
const OUT = join(ROOT, 'site', SET);
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
const RENDER_BUDGET_MS = '20000';
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const CSS = `
@page { size: A4; margin: 22mm 18mm 20mm; }
body { font: 10.5pt/1.45 Calibri, "Segoe UI", Arial, sans-serif; color: #1a1a1a; }
h1, h2, h3, h4 { color: #1f3864; line-height: 1.2; break-after: avoid; }
h1 { font-size: 22pt; } h2 { font-size: 16pt; margin-top: 1.6em; border-bottom: 1px solid #c9d3e6; }
h3 { font-size: 13pt; margin-top: 1.3em; } h4 { font-size: 11pt; }
table { border-collapse: collapse; width: 100%; margin: .6em 0 1em; font-size: 8.5pt; break-inside: auto; }
th, td { border: 1px solid #b7c2d6; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #e8edf6; } tr { break-inside: avoid; }
code { font: 8.5pt Consolas, monospace; background: #f3f5f9; padding: 0 2px; }
pre { background: #f3f5f9; padding: 6px; overflow: hidden; white-space: pre-wrap; }
.mermaid { text-align: center; margin: 1em 0; break-inside: avoid; }
.cover { height: 240mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
.cover h1 { font-size: 30pt; margin: 0 0 .3em; } .cover p { font-size: 13pt; color: #44546a; margin: .2em 0; }
`;

function findBrowser() {
  const found = BROWSERS.find((b) => existsSync(b));
  if (!found) throw new Error('No Edge or Chrome found; set BROWSER to its path.');
  return found;
}

function toHtml(md) {
  const body = marked.parse(md.replace(/^<!--.*?-->\s*/s, ''), { mangle: false, headerIds: true })
    .replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => `<div class="mermaid">${code}</div>`);
  const title = (md.match(/^# (.+)$/m) ?? [, 'APX'])[1];
  const edition = (md.match(/^# .+\n+\*(.+)\*$/m) ?? [, ''])[1];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>${CSS}</style></head><body>
<section class="cover"><h1>${title.replace(': ', '<br>')}</h1><p>${edition}</p></section>
${body.replace(/<h1[^>]*>.*?<\/h1>\s*(<p><em>.*?<\/em><\/p>)?/s, '')}
<script src="${MERMAID}"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'strict' });</script>
</body></html>`;
}

function printPdf(browser, htmlPath, pdfPath) {
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    `--virtual-time-budget=${RENDER_BUDGET_MS}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  if (!existsSync(pdfPath)) throw new Error(`browser did not write ${pdfPath}`);
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = findBrowser();
  const docs = readdirSync(SRC).filter((f) => /^0\d-.*\.md$/.test(f)).sort();
  const { prefix, keepNumber } = SETS[SET];
  for (const f of docs) {
    const html = join(OUT, `${basename(f, '.md')}.html`);
    const pdf = join(OUT, `${prefix}-${basename(f, '.md').slice(keepNumber ? 0 : 3)}.pdf`);
    writeFileSync(html, toHtml(readFileSync(join(SRC, f), 'utf8')));
    printPdf(browser, html, pdf);
    console.log(`[pdf] ${pdf}`);
  }
}

main();
