/**
 * Serves the browser UI (packages/simulator/ui) at /ui/, and redirects /
 * there. Only plain GETs of known file types inside the ui directory are
 * served; everything else falls through to the standard's dispatch.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_DIR = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ui'));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

/** Returns true when the request was answered here. */
export function serveUi(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const path = new URL(req.url, 'http://sim.local').pathname;
  if (path === '/' || path === '/ui') {
    res.writeHead(302, { location: '/ui/' });
    res.end();
    return true;
  }
  if (!path.startsWith('/ui/')) return false;
  let rel;
  try {
    rel = decodeURIComponent(path.slice(4)) || 'index.html';
  } catch {
    rel = '';
  }
  const file = resolve(UI_DIR, rel);
  const type = TYPES[extname(file)];
  if (!rel || !file.startsWith(UI_DIR + sep) || !type || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return true;
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
  return true;
}
