#!/usr/bin/env node
/**
 * apx-sim — the APX standard simulator.
 *
 *   apx-sim serve   [--port 4100] [--world default] [--realtime] [--strict] [--network]
 *   apx-sim replay  [module ...] [--url http://host:port] [--verbose] [--json report.json] [--summary]
 *   apx-sim run     <scenario.json> [--world name] [--url ...] [--verbose]
 *   apx-sim token   [credential] [--world name]
 *   apx-sim worlds | ops | injectors
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args.shift();

function flags(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      if (inline !== undefined) out[k] = inline;
      else if (i + 1 < list.length && !list[i + 1].startsWith('--')) out[k] = list[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

const f = flags(args);

switch (command) {
  case 'serve': {
    const { Simulator } = await import('../src/index.mjs');
    const sim = new Simulator({ world: f.world ?? 'default', realtime: Boolean(f.realtime), strict: Boolean(f.strict), network: Boolean(f.network) });
    const port = Number(f.port ?? 4100);
    const host = f.host ?? '127.0.0.1';
    await sim.listen(port, host);
    console.log(`apx-sim listening on http://${host}:${port}`);
    console.log(`  world: ${sim.world.name}   clock: ${sim.clock.now()} (${sim.clock.realtime ? 'realtime' : 'frozen; move it with POST /sim/clock'})`);
    console.log(`  ${sim.handlers.size} operations implemented; GET /sim for status, GET /sim/ops for the list, POST /sim/token for a bearer token`);
    break;
  }
  case 'replay': {
    const { replay } = await import('../tools/replay.mjs');
    const result = await replay({ modules: f._, url: f.url, verbose: Boolean(f.verbose), json: f.json, summary: Boolean(f.summary) });
    process.exitCode = result.failed > 0 && !f.summary ? 1 : 0;
    break;
  }
  case 'run': {
    const { runScript } = await import('../tools/script.mjs');
    const file = f._[0];
    if (!file) {
      console.error('usage: apx-sim run <scenario.json> [--world name] [--url http://...] [--verbose]');
      process.exit(2);
    }
    const result = await runScript(resolve(file), { world: f.world, url: f.url, verbose: Boolean(f.verbose) });
    process.exitCode = result.failed > 0 ? 1 : 0;
    break;
  }
  case 'token': {
    const { loadWorld, encodeToken } = await import('../src/index.mjs');
    const world = loadWorld(f.world ?? 'default');
    const name = f._[0] ?? 'default';
    const cred = world.credentials[name];
    if (!cred) {
      console.error(`no credential "${name}" in world ${world.name}; known: ${Object.keys(world.credentials).join(', ')}`);
      process.exit(2);
    }
    console.log(encodeToken({ sub: name, ...cred }));
    break;
  }
  case 'worlds': {
    const { listWorlds, loadWorld } = await import('../src/index.mjs');
    for (const name of listWorlds()) {
      const w = loadWorld(name);
      console.log(`${name.padEnd(18)} ${w.description ?? ''}`);
    }
    break;
  }
  case 'ops': {
    const { Simulator } = await import('../src/index.mjs');
    const { OPS } = await import('../src/kernel/spec.mjs');
    const sim = new Simulator({ world: 'default' });
    let done = 0;
    for (const o of OPS) {
      const ok = sim.handlers.has(o.operationId);
      if (ok) done += 1;
      console.log(`${ok ? '+' : '.'} ${o.method.padEnd(6)} ${o.path.padEnd(58)} ${o.scopes.join('|')}`);
    }
    console.log(`\n${done}/${OPS.length} operations implemented`);
    break;
  }
  case 'injectors': {
    const { Simulator } = await import('../src/index.mjs');
    const sim = new Simulator({ world: 'default' });
    console.log([...sim.injectors.keys()].sort().join('\n'));
    break;
  }
  default:
    console.log(`apx-sim — the APX standard simulator (${resolve(HERE, '..')})

  apx-sim serve   [--port 4100] [--world default] [--realtime] [--strict] [--network]
  apx-sim replay  [module ...] [--url http://host:port] [--verbose] [--json report.json] [--summary]
  apx-sim run     <scenario.json> [--world name] [--url ...] [--verbose]
  apx-sim token   [credential] [--world name]
  apx-sim worlds | ops | injectors
`);
    process.exit(command ? 2 : 0);
}
