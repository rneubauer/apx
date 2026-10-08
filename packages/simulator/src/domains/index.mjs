/**
 * The domain modules, one per conformance class, discovered from this
 * directory: every `*.mjs` here except `index.mjs` and `common.mjs` must
 * default-export `{ name, register(sim) }`. Load order is alphabetical
 * except that `control` and `data` go first, because other domains call
 * into `sim.control` and `sim.data` at registration time.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIRST = ['control', 'data'];

const files = readdirSync(HERE)
  .filter((f) => f.endsWith('.mjs') && !['index.mjs', 'common.mjs'].includes(f) && !f.endsWith('.test.mjs'))
  .map((f) => f.replace(/\.mjs$/, ''))
  .sort((a, b) => {
    const ia = FIRST.indexOf(a);
    const ib = FIRST.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

export const DOMAINS = [];
for (const name of files) {
  const mod = await import(pathToFileURL(join(HERE, `${name}.mjs`)).href);
  const domain = mod.default;
  if (!domain || typeof domain.register !== 'function') throw new Error(`domain module ${name}.mjs must default-export { name, register(sim) }`);
  DOMAINS.push(domain);
}
