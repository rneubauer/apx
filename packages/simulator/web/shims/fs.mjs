/**
 * node:fs for the browser build: a read-mostly virtual filesystem holding
 * the files the simulator reads (spec bundle, registries, worlds,
 * scenarios), bundled at build time. Writes (a scenario saved from Build)
 * last until the page reloads.
 */
import BUNDLED from 'apx-vfs';

const files = new Map(Object.entries(BUNDLED));
const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
const missing = (p) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });
const isDir = (p) => {
  const prefix = `${p}/`;
  for (const f of files.keys()) if (f.startsWith(prefix)) return true;
  return false;
};

export function readFileSync(path) {
  const p = norm(path);
  if (!files.has(p)) throw missing(p);
  return files.get(p);
}

export const existsSync = (path) => files.has(norm(path)) || isDir(norm(path));

export function readdirSync(path) {
  const prefix = `${norm(path)}/`;
  const names = new Set();
  for (const f of files.keys()) if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split('/')[0]);
  if (!names.size) throw missing(norm(path));
  return [...names].sort();
}

export function statSync(path) {
  const p = norm(path);
  const file = files.has(p);
  if (!file && !isDir(p)) throw missing(p);
  return { isFile: () => file, isDirectory: () => !file };
}

export function writeFileSync(path, data) {
  files.set(norm(path), String(data));
}

export function mkdirSync() {}

export default { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync };
