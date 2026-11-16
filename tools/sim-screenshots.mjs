// Regenerates the screenshots in docs/user-guide/images/ from the APX simulator's browser UI.
//
// How to run (from the repository root, Node 22 or later, no packages to install):
//   1. In one terminal:  npm run sim          (serves http://127.0.0.1:4100)
//   2. In another:       npm run docs:screenshots
//
// It drives a headless Chromium over the DevTools protocol, using Node's built-in
// WebSocket and fetch. It only uses the built-in sample worlds and demos.
//
// Environment variables:
//   CHROME   path to a Chromium or Chrome binary (default: the newest Playwright
//            Chromium under ~/.cache/ms-playwright)
//   SIM_URL  where the simulator is (default http://127.0.0.1:4100/ui/)
//   OUT_DIR  where the PNG files go (default docs/user-guide/images)
//
// The script resets the simulator's world as it goes, so run it against a
// simulator you started for this purpose.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM_URL = process.env.SIM_URL ?? 'http://127.0.0.1:4100/ui/';
const OUT_DIR = process.env.OUT_DIR ?? join(root, 'docs/user-guide/images');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), '.cache/ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse() : [];
  for (const d of dirs) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(base, d, sub);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('No Chromium found. Set CHROME to a browser binary.');
}

mkdirSync(OUT_DIR, { recursive: true });
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--hide-scrollbars',
  '--window-size=1400,900', '--user-data-dir=/tmp/apx-sim-shots-profile', 'about:blank',
], { stdio: 'ignore' });

let ws; let nextId = 1; const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        ws.onmessage = (m) => {
          const d = JSON.parse(m.data);
          if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
        };
        return;
      }
    } catch { /* browser still starting */ }
    await sleep(200);
  }
  throw new Error('Could not reach Chromium');
}
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'script error');
  return r.result.value;
};
// Click the first visible button (or element) whose text matches.
const clickText = (text, sel = 'button') => js(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.trim().includes(${JSON.stringify(text)}) && !e.disabled);
  if (!el) return false; el.click(); return true; })()`).then((ok) => { if (!ok) throw new Error(`No "${text}" ${sel}`); });
const setValue = (selector, value) => js(`(() => { const e = document.querySelector(${JSON.stringify(selector)});
  e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
async function shot(name) {
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false });
  const file = join(OUT_DIR, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('wrote', file);
}
const go = async (hash) => { await js(`location.hash = ${JSON.stringify(hash)}`); await sleep(600); };

try {
  await connect();
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: SIM_URL });
  await sleep(2500);
  await js(`localStorage.setItem('apx-sim-theme', 'light'); document.documentElement.dataset.theme = 'light'`);

  // Present: picker, then a narrated demo.
  await go('present'); await shot('present-picker');
  await clickText('Exit lane help call', '.scenario-card').catch(() => clickText('help call', '.scenario-card'));
  await sleep(1500); await shot('present-start');
  for (let i = 0; i < 3; i++) { await js(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}))`); await sleep(1200); }
  await shot('present-step');
  await clickText('Presenter mode'); await sleep(800); await shot('present-presenter');
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}))`); await sleep(500);

  // Explore: console with a request, then each tab.
  await go('explore');
  await clickText('Send'); await sleep(1000); await shot('explore-console');
  for (const [tab, name] of [['World events', 'explore-world-events'], ['Events', 'explore-events'], ['State', 'explore-state'], ['Operations', 'explore-operations'], ['Log', 'explore-log']]) {
    await clickText(tab, '.subtabs button'); await sleep(700);
    if (tab === 'State') await js(`document.querySelector('.item')?.click()`);
    await shot(name);
  }

  // Build: a new scenario with one request step.
  await go('build');
  await shot('build-empty');
  await clickText('New scenario').catch(() => clickText('+ New'));
  await sleep(500);
  await clickText('+ Request'); await sleep(500);
  await shot('build-scenario');

  // Fabric: empty, load the events world, start traffic.
  await go('fabric'); await shot('fabric-start');
  await clickText('Load apx-events').catch(() => {});
  await sleep(1000);
  await clickText('Start traffic'); await sleep(6000);
  await shot('fabric-traffic');
  await clickText('Make endpoint fail').catch(() => {});
  await sleep(4000); await shot('fabric-failing');
  await clickText('Stop traffic').catch(() => {});

  // Header: dark theme, for the theme section.
  await js(`localStorage.setItem('apx-sim-theme', 'dark'); document.documentElement.dataset.theme = 'dark'`);
  await go('explore'); await shot('theme-dark');
  await js(`localStorage.setItem('apx-sim-theme', 'light'); document.documentElement.dataset.theme = 'light'`);

  // Mock vendor screen.
  await send('Page.navigate', { url: new URL('vendor.html', SIM_URL).href });
  await sleep(1200); await shot('vendor-screen');
} finally {
  try { ws?.close(); } catch { /* already closed */ }
  chrome.kill();
}
