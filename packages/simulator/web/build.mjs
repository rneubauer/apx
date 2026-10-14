/**
 * Builds the simulator for a static host (GitHub Pages): the kernel and
 * domains bundled for the browser, the files they read packed into a
 * virtual filesystem, and the UI beside them.
 *
 *   node packages/simulator/web/build.mjs [outDir]     (default: site/simulator)
 *
 * The page answers its own requests (web/browser.mjs); there is no server.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(fileURLToPath(import.meta.url));
const SIM = resolve(WEB, '..');
const REPO = resolve(SIM, '..', '..');
const OUT = resolve(REPO, process.argv[2] ?? join('site', 'simulator'));
const VFS_ROOT = '/vfs'; // where the repository sits inside the virtual filesystem
const NODE_SHIMS = ['fs', 'path', 'url', 'crypto', 'http'];
const BOOT = "await import('./sim.js');\nawait import('./js/app.js');\n";
const BANNER =
  '<div class="static-banner" role="note">This simulator runs entirely in your browser: nothing is sent anywhere, and reloading the page starts it over. ' +
  'To run it yourself, see <a href="https://github.com/rneubauer/apx/tree/main/packages/simulator">packages/simulator</a>.</div>';

const posix = (p) => p.split('\\').join('/');
const vfsPath = (file) => `${VFS_ROOT}/${posix(relative(REPO, file))}`;
const jsonIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));

/** Every file the kernel reads at run time (spec.mjs, problems.mjs, world.mjs, scenario.mjs, sim-scenarios.mjs). */
const vfsFiles = () => [
  join(REPO, 'spec', 'dist', 'apx-v1.json'),
  join(REPO, 'spec', 'edition.json'),
  join(REPO, 'docs', 'standard', '12-errors.md'),
  ...jsonIn(join(REPO, 'spec', 'registries')),
  ...jsonIn(join(SIM, 'worlds')),
  ...jsonIn(join(SIM, 'scenarios')),
  ...jsonIn(join(SIM, 'tools', 'directions')),
];

/** domains/index.mjs discovers modules with readdir + dynamic import; the bundle needs them static, in the same order. */
function staticDomainsIndex(source) {
  const first = JSON.parse(source.match(/const FIRST = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const rank = (n) => (first.includes(n) ? first.indexOf(n) : 99);
  const names = readdirSync(join(SIM, 'src', 'domains'))
    .filter((f) => f.endsWith('.mjs') && !['index.mjs', 'common.mjs'].includes(f) && !f.endsWith('.test.mjs'))
    .map((f) => f.replace(/\.mjs$/, ''))
    .sort((a, b) => (rank(a) !== 99 || rank(b) !== 99 ? rank(a) - rank(b) : a.localeCompare(b)));
  const imports = names.map((n, i) => `import d${i} from './${n}.mjs';`).join('\n');
  return `${imports}\nexport const DOMAINS = [${names.map((_, i) => `d${i}`).join(', ')}];\n`;
}

const browserPlugin = {
  name: 'apx-sim-browser',
  setup(b) {
    const shim = new RegExp(`^(node:)?(${NODE_SHIMS.join('|')})$`);
    b.onResolve({ filter: shim }, (args) => ({ path: join(WEB, 'shims', `${args.path.replace(/^node:/, '')}.mjs`) }));
    b.onResolve({ filter: /^apx-vfs$/ }, () => ({ path: 'apx-vfs', namespace: 'apx-vfs' }));
    b.onLoad({ filter: /.*/, namespace: 'apx-vfs' }, () => {
      const files = Object.fromEntries(vfsFiles().map((f) => [vfsPath(f), readFileSync(f, 'utf8')]));
      return { contents: `export default ${JSON.stringify(files)};`, loader: 'js' };
    });
    // Source files find their data relative to import.meta.url: give each its own address in the virtual filesystem.
    b.onLoad({ filter: /[\\/]packages[\\/]simulator[\\/]src[\\/].*\.mjs$/ }, (args) => {
      let source = readFileSync(args.path, 'utf8');
      if (posix(args.path).endsWith('src/domains/index.mjs')) source = staticDomainsIndex(source);
      return { contents: source.replaceAll('import.meta.url', JSON.stringify(`file://${vfsPath(args.path)}`)), loader: 'js', resolveDir: dirname(args.path) };
    });
  },
};

/** The UI page, unchanged except for how it starts (the simulator first, then the app) and a note that it is local. */
function staticPage() {
  const page = readFileSync(join(SIM, 'ui', 'index.html'), 'utf8');
  const out = page
    .replace('<script type="module" src="js/app.js"></script>', '<script type="module" src="boot.js"></script>')
    .replace('Connecting to the simulator…', 'Loading the simulator…')
    .replace('<main>', `${BANNER}\n  <main>`);
  if (!out.includes('src="boot.js"') || !out.includes('static-banner')) throw new Error('ui/index.html changed shape: update web/build.mjs');
  return out;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const result = await build({
  entryPoints: [join(WEB, 'browser.mjs')],
  outfile: join(OUT, 'sim.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: 'linked',
  legalComments: 'none',
  inject: [join(WEB, 'shims', 'buffer.mjs')],
  define: { 'process.env.APX_DIR': 'undefined' },
  plugins: [browserPlugin],
  logLevel: 'warning',
  metafile: true,
});

cpSync(join(SIM, 'ui'), OUT, { recursive: true });
writeFileSync(join(OUT, 'boot.js'), BOOT);
writeFileSync(join(OUT, 'index.html'), staticPage());

const bytes = result.metafile.outputs[posix(relative(process.cwd(), join(OUT, 'sim.js')))]?.bytes ?? 0;
console.log(`[sim:web] ${posix(relative(REPO, OUT))}/: sim.js ${(bytes / 1e6).toFixed(1)} MB, ${vfsFiles().length} bundled files, UI copied`);
