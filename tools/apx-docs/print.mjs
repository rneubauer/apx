/**
 * Page furniture shared by the document renderers: the APX wordmark, the
 * stylesheet, the Mermaid theme, the HTML wrapper, and a minimal Chrome
 * DevTools client that prints a page to PDF with a running header and
 * footer. The look follows the APDS 4.1 technical documents: Arial body
 * text, bold clause headings with bold-italic sub-headings, UML class
 * diagrams drawn as beige «D2Class» boxes, italic figure captions, a mark
 * at the top right of every page, and a footer naming the document and
 * its release beside the page number.
 */
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';

export const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';

// A plain wordmark of APX's own; not the APDS mark.
export const WORDMARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 72" role="img" aria-label="APX">
<rect x="4" y="6" width="82" height="60" rx="9" fill="none" stroke="#1d3a8a" stroke-width="4"/>
<text x="14" y="49" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700" fill="#1d3a8a">APX</text>
<text x="100" y="33" font-family="Arial, Helvetica, sans-serif" font-size="12.5" font-weight="700" fill="#444" letter-spacing="1">APDS PARKING</text>
<text x="100" y="51" font-family="Arial, Helvetica, sans-serif" font-size="12.5" font-weight="700" fill="#444" letter-spacing="1">EXTENSIONS</text>
</svg>`;
export const WORDMARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(WORDMARK).toString('base64')}`;
// Chrome prints a page header hundreds of times slower with an SVG image in
// it than with a raster one, so the header carries this PNG of the mark
// (tools/apx-docs/apx-wordmark.png, rendered from WORDMARK).
const WORDMARK_PNG = new URL('./apx-wordmark.png', import.meta.url);
export const WORDMARK_PNG_DATA_URI = existsSync(WORDMARK_PNG) ? `data:image/png;base64,${readFileSync(WORDMARK_PNG).toString('base64')}` : WORDMARK_DATA_URI;

export const MERMAID_INIT = {
  startOnLoad: true,
  theme: 'base',
  securityLevel: 'strict',
  fontFamily: 'Arial, Helvetica, sans-serif',
  themeVariables: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '12px',
    primaryColor: '#fbf3e4',
    primaryBorderColor: '#8a7b5c',
    primaryTextColor: '#000000',
    secondaryColor: '#f6ecd8',
    tertiaryColor: '#ffffff',
    lineColor: '#4a4a4a',
    textColor: '#000000',
    noteBkgColor: '#fbf3e4',
    noteBorderColor: '#8a7b5c',
    actorBkg: '#fbf3e4',
    actorBorder: '#8a7b5c',
    signalColor: '#333333',
    labelBoxBkgColor: '#f6ecd8',
    labelBoxBorderColor: '#8a7b5c',
  },
  class: { useMaxWidth: true },
  sequence: { useMaxWidth: true },
  state: { useMaxWidth: true },
  flowchart: { useMaxWidth: true, htmlLabels: false },
};

// Print stylesheet. Screen rendering adds SCREEN_CSS on top.
export const CSS = `
@page { size: A4; margin: 24mm 18mm 22mm; }
html { font-size: 10.5pt; }
body { font-family: Arial, Helvetica, "Liberation Sans", sans-serif; font-size: 10.5pt; line-height: 1.42; color: #000; margin: 0; }
h1, h2, h3, h4, h5 { font-family: Arial, Helvetica, sans-serif; color: #000; line-height: 1.25; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 20pt; font-weight: 700; margin: 0 0 .6em; }
h2 { font-size: 13pt; font-weight: 700; margin: 1.8em 0 .6em; }
h3 { font-size: 11.5pt; font-weight: 700; font-style: italic; margin: 1.4em 0 .5em; }
h4 { font-size: 10.5pt; font-weight: 700; margin: 1.2em 0 .4em; }
h5 { font-size: 10.5pt; font-weight: 700; font-style: italic; margin: 1em 0 .3em; }
p { margin: 0 0 .75em; }
/* No orphans/widows rule: with break-after: avoid on headings it makes Chrome's
   print layout of the long Data Dictionary tables take minutes instead of seconds. */
ul, ol { margin: 0 0 .75em 1.4em; padding: 0; }
li { margin: 0 0 .25em; }
a { color: #1d3a8a; text-decoration: none; }
table { border-collapse: collapse; width: 100%; margin: .5em 0 1em; font-size: 8.5pt; line-height: 1.3; break-inside: auto; }
th, td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; text-align: left; }
th { font-weight: 700; background: #f2f2f2; }
tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
code { font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; }
pre { font-family: Consolas, "Courier New", monospace; font-size: 8pt; line-height: 1.3; background: #f6f6f6; border: 1px solid #ddd; padding: 6px 8px; overflow: hidden; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { font-size: inherit; background: none; }
blockquote { margin: 0 0 .75em 1.2em; padding-left: .8em; border-left: 2px solid #999; color: #333; }
hr { border: 0; border-top: 1px solid #999; margin: 1.5em 0; }
img { max-width: 100%; }
.mermaid { text-align: center; margin: .8em 0 .3em; break-inside: avoid; page-break-inside: avoid; }
.mermaid svg { max-width: 100% !important; max-height: 228mm; width: auto !important; height: auto; }
.mermaid .classGroup rect, .mermaid g.classGroup > rect, .mermaid .classGroup .label-container { fill: #fbf3e4 !important; stroke: #8a7b5c !important; }
.mermaid .classGroup .divider { stroke: #8a7b5c !important; }
.mermaid .classTitle { font-weight: 700; }
.mermaid .classGroup text, .mermaid .classLabel .label { font-family: Arial, Helvetica, sans-serif; fill: #000; }
.mermaid .relation { stroke: #4a4a4a !important; }
.mermaid .node rect, .mermaid .node circle, .mermaid .node polygon, .mermaid .node path { fill: #fbf3e4; stroke: #8a7b5c; }
.mermaid .statediagram-state rect, .mermaid .statediagram-state .label-container { fill: #fbf3e4 !important; stroke: #8a7b5c !important; }
p > em:only-child { display: block; text-align: center; font-style: italic; margin: .2em 0 1.2em; }
.cover { height: 236mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; break-after: page; page-break-after: always; }
.cover .mark { width: 78mm; margin-bottom: 26mm; }
.cover h1 { font-size: 24pt; font-weight: 700; margin: 0 0 .4em; }
.cover .set { font-size: 12pt; color: #333; margin: 0 0 1.6em; }
.cover .release { font-size: 12pt; font-weight: 700; margin: 0 0 .3em; }
.cover .updated { font-size: 11.5pt; font-style: italic; margin: 0; }
.cover .edition { font-size: 9.5pt; color: #444; margin-top: 18mm; }
`;

export const SCREEN_CSS = `
@media screen {
  body { background: #f3f3f1; }
  .page { background: #fff; max-width: 190mm; margin: 0 auto; padding: 22mm 18mm 28mm; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
  .shell { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 0; min-height: 100vh; }
  nav.toc { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto; padding: 18px 14px 40px 18px; background: #fff; border-right: 1px solid #ddd; font-size: 9.5pt; }
  nav.toc .brand { width: 150px; display: block; margin: 0 0 12px; }
  nav.toc .set { font-size: 8.5pt; color: #555; margin: 0 0 10px; }
  nav.toc ol { list-style: none; margin: 0 0 10px; padding: 0; }
  nav.toc li { margin: 0 0 3px; }
  nav.toc li.l3 { margin-left: 12px; font-size: 8.8pt; }
  nav.toc li.l4 { margin-left: 24px; font-size: 8.5pt; color: #333; }
  nav.toc a { color: #1d3a8a; }
  nav.toc .docs { border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px; }
  nav.toc .docs a.current { font-weight: 700; }
  .cover { height: auto; padding: 30mm 0 18mm; break-after: auto; border-bottom: 1px solid #ddd; margin-bottom: 14mm; }
  .topbar { display: flex; justify-content: space-between; align-items: center; margin: -12mm 0 10mm; font-size: 8.5pt; color: #555; }
  .topbar img { width: 120px; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } nav.toc { position: static; height: auto; border-right: 0; border-bottom: 1px solid #ddd; } .page { padding: 14mm 16px 24mm; } }
}
@media print { nav.toc, .topbar { display: none; } .page { max-width: none; padding: 0; box-shadow: none; } }
`;

/** Markdown to body HTML, with mermaid fences turned into <div class="mermaid">. */
export function markdownToHtml(md) {
  return marked.parse(md.replace(/^<!--.*?-->\s*/s, ''), { mangle: false, headerIds: true })
    .replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => `<div class="mermaid">${code}</div>`);
}

/** Title and edition line of a document: "# Title" then "*edition*". */
export function documentMeta(md) {
  const title = (md.match(/^# (.+)$/m) ?? [, 'APX'])[1].trim();
  const edition = (md.match(/^# .+\n+\*(.+)\*$/m) ?? [, ''])[1].trim();
  return { title, edition };
}

/** Drop the title and edition line from rendered body HTML (the cover carries them). */
export function stripTitle(body) {
  return body.replace(/<h1[^>]*>.*?<\/h1>\s*(<p><em>.*?<\/em><\/p>)?/s, '');
}

export function coverHtml({ title, set, release, updated, edition }) {
  const [main, sub] = title.includes(': ') ? title.split(': ') : [title.replace(/^APX /, ''), ''];
  return `<section class="cover">
  <img class="mark" src="${WORDMARK_DATA_URI}" alt="APX">
  <h1>${escapeHtml(sub || main)}</h1>
  <p class="set">${escapeHtml(set)}</p>
  <p class="release">${escapeHtml(release)}</p>
  <p class="updated">Updated ${escapeHtml(updated)}</p>
  ${edition ? `<p class="edition">${escapeHtml(edition)}</p>` : ''}
</section>`;
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function mermaidScript() {
  return `<script src="${MERMAID}"></script>
<script>
  mermaid.initialize(${JSON.stringify(MERMAID_INIT)});
  window.__apxDiagrams = document.querySelectorAll('.mermaid').length;
  window.__apxDiagramsDone = () => document.querySelectorAll('.mermaid svg').length >= window.__apxDiagrams;
</script>`;
}

/** Header and footer templates for Chrome's printToPDF. */
export function pageTemplates({ docTitle, release, copyright }) {
  const base = 'font-family: Arial, Helvetica, sans-serif; width: 100%; margin: 0 18mm; -webkit-print-color-adjust: exact;';
  return {
    headerTemplate: `<div style="${base} display:flex; justify-content:flex-end; align-items:flex-start; padding-top:6mm;"><img src="${WORDMARK_PNG_DATA_URI}" style="width:34mm;"></div>`,
    footerTemplate: `<div style="${base} display:flex; justify-content:space-between; align-items:flex-end; font-size:7.5pt; line-height:1.35; color:#000; padding-bottom:6mm;">
      <div style="font-style:italic;">${escapeHtml(copyright)}: ${escapeHtml(docTitle)}<br>${escapeHtml(release)}</div>
      <div><span class="pageNumber"></span></div></div>`,
  };
}

// ---------- Chrome DevTools printing ----------

const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findBrowser() {
  const found = BROWSERS.find((b) => existsSync(b));
  if (!found) throw new Error('No Edge or Chrome found; set BROWSER to its path.');
  return found;
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, attempts = 100) {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`browser did not answer at ${url}`);
}

/** A small DevTools session over one WebSocket. */
class Session {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; ws.addEventListener('message', (m) => this.onMessage(JSON.parse(m.data))); }
  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    else if (msg.method) this.events.push(msg);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async until(method, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) { const i = this.events.findIndex((e) => e.method === method); if (i >= 0) return this.events.splice(i, 1)[0]; await sleep(50); }
    throw new Error(`timed out waiting for ${method}`);
  }
  async evalUntilTrue(expression, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const { result } = await this.send('Runtime.evaluate', { expression, returnByValue: true });
      if (result?.value === true) return;
      await sleep(150);
    }
    throw new Error(`timed out waiting for ${expression}`);
  }
}

/**
 * Opens a browser once and prints each (htmlPath, pdfPath, templates) job
 * with a running header and footer. Diagrams are drawn by Mermaid on the
 * page, so each job waits until every .mermaid holds an svg.
 */
export async function printJobs(jobs, { landscape = false } = {}) {
  const browser = findBrowser();
  const port = await freePort();
  const proc = spawn(browser, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--allow-file-access-from-files', `--user-data-dir=${process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'}/apx-print-${port}`, 'about:blank'], { stdio: 'ignore' });
  try {
    const version = await waitFor(`http://127.0.0.1:${port}/json/version`);
    const browserWs = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { browserWs.addEventListener('open', res); browserWs.addEventListener('error', rej); });
    const browserSession = new Session(browserWs);
    const log = (m) => { if (process.env.APX_PRINT_DEBUG) console.error(`[print] ${new Date().toISOString().slice(11, 19)} ${m}`); };
    for (const job of jobs) {
      log(`open ${job.url}`);
      const { targetId } = await browserSession.send('Target.createTarget', { url: 'about:blank' });
      const targets = await waitFor(`http://127.0.0.1:${port}/json/list`);
      const target = targets.find((t) => t.id === targetId);
      if (!target) throw new Error('the new page did not appear in the browser target list');
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
      const page = new Session(ws);
      await page.send('Page.enable');
      await page.send('Runtime.enable');
      await page.send('Emulation.setEmulatedMedia', { media: 'print' });
      await page.send('Page.navigate', { url: job.url });
      await page.until('Page.loadEventFired', 60000);
      log('loaded; waiting for diagrams');
      await page.evalUntilTrue('typeof window.__apxDiagramsDone === "function" && window.__apxDiagramsDone()', 180000);
      log('diagrams drawn; printing');
      await sleep(300);
      // The PDF comes back as a stream read in chunks: a long document
      // returned in one message is too large for the DevTools socket and
      // the call never completes.
      const { stream } = await page.send('Page.printToPDF', {
        printBackground: true, landscape, preferCSSPageSize: false,
        paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.95, marginBottom: 0.87, marginLeft: 0.71, marginRight: 0.71,
        displayHeaderFooter: !!(job.headerTemplate || job.footerTemplate), headerTemplate: job.headerTemplate ?? '<span></span>', footerTemplate: job.footerTemplate ?? '<span></span>',
        transferMode: 'ReturnAsStream',
      });
      const chunks = [];
      for (;;) {
        const { data, base64Encoded, eof } = await page.send('IO.read', { handle: stream, size: 1 << 20 });
        chunks.push(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
        if (eof) break;
      }
      await page.send('IO.close', { handle: stream });
      writeFileSync(job.pdfPath, Buffer.concat(chunks));
      ws.close();
      await browserSession.send('Target.closeTarget', { targetId });
      job.onDone?.();
    }
    try { await browserSession.send('Browser.close'); } catch { /* already gone */ }
    browserWs.close();
  } finally {
    proc.kill();
  }
}

export function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}
