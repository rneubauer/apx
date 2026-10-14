/** node:path for the browser build: POSIX paths inside the virtual filesystem. */
export const sep = '/';

export function normalize(path) {
  const absolute = path.startsWith('/');
  const out = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return (absolute ? '/' : '') + out.join('/') || (absolute ? '/' : '.');
}

export const join = (...parts) => normalize(parts.filter(Boolean).join('/'));

export function resolve(...parts) {
  let out = '/';
  for (const part of parts.map(String)) out = part.startsWith('/') ? part : `${out}/${part}`;
  return normalize(out);
}

export function dirname(path) {
  const n = normalize(path);
  const i = n.lastIndexOf('/');
  return i <= 0 ? (n.startsWith('/') ? '/' : '.') : n.slice(0, i);
}

export function basename(path, ext) {
  const base = normalize(path).split('/').pop();
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

export function extname(path) {
  const base = basename(path);
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i) : '';
}

export default { sep, normalize, join, resolve, dirname, basename, extname };
