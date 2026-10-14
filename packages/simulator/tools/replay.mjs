/**
 * Replay the vetting suite (docs/scenarios/by-module/<module>/scenarios.md)
 * against the simulator and report, per exchange, whether the simulator
 * answered with the status the scenario shows, a body that validates
 * against the bundle, and (for refusals) the same problem type.
 *
 * The markdown is read with the same markers tools/vetting-scenarios.mjs
 * uses. The ```http block above a request supplies its headers
 * (Authorization, Idempotency-Key, If-Match, Prefer, Accept,
 * APX-Update-Mode, Last-Event-ID). Three fixtures stand in for what prose
 * alone describes:
 *
 *   X-Sim-Assign-Id  the id the scenario shows for a created resource, so
 *                    later requests in the file address the same record
 *   X-Sim-Now        the latest instant the expected response shows, so
 *                    expiries and windows line up with the scenario clock
 *   X-Sim-Force      only for `rate-limited`: throttling is a server
 *                    condition no request can reach by itself
 *
 * Optional stage directions in tools/directions/<module>.json inject world
 * events (a device fault, a car arriving) before a given exchange.
 */
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findOp, validateResponseBody, fmtErrors } from '../src/kernel/spec.mjs';
import { SUITE_DIR as SUITE, parseScenarios, planScenario, applyDirection, problemSlug, readDirections } from '../src/kernel/vetting.mjs';

export { parseScenarios };

// ---------- transport ----------

function makeTransport({ url, sim }) {
  if (url) {
    const base = url.replace(/\/$/, '');
    return {
      remote: true,
      async send(req) {
        // HTTP header values must be ASCII: expand `xx…NNNN` ids, map the bare `…` token to the default credential.
        const ascii = (v) => String(v).replace(/\b([0-9a-f]{2})…([0-9a-f]{4})\b/g, (_, p, s) => `${p}000000-0000-4000-8000-00000000${s}`).replace(/^Bearer …$/, 'Bearer default').replace(/[^\x20-\x7e]/g, '-');
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, ascii(v)]));
        const res = await fetch(base + req.path, { method: req.method, headers, body: req.body });
        const text = await res.text();
        let body;
        try {
          body = text ? JSON.parse(text) : undefined;
        } catch {
          body = text;
        }
        return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
      },
      async control(method, path, body) {
        const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        return res.json().catch(() => ({}));
      },
    };
  }
  return {
    remote: false,
    send: (req) => sim.dispatch(req),
    control: async (method, path, body) => (await sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).body,
  };
}

// ---------- the run ----------

export async function replay({ modules = [], url, verbose = false, json, summary = false } = {}) {
  const available = readdirSync(SUITE).filter((d) => existsSync(join(SUITE, d, 'scenarios.md')));
  const wanted = modules.length ? modules.map((m) => (m.includes('/') || m.includes('\\') ? m : m.startsWith('apx-') ? m : `apx-${m}`)) : available;
  let sim = null;
  if (!url) {
    const { Simulator } = await import('../src/index.mjs');
    sim = new Simulator({ world: 'default' });
  }
  const transport = makeTransport({ url, sim });
  const report = { modules: [], passed: 0, failed: 0, gaps: 0, contract: 0, exchanges: 0 };

  for (const mod of wanted) {
    const file = mod.endsWith('.md') ? resolve(mod) : join(SUITE, mod, 'scenarios.md');
    if (!existsSync(file)) {
      console.error(`no scenarios at ${file}`);
      continue;
    }
    const { module, scenarios } = parseScenarios(file);
    const name = module?.name ?? mod;
    const worldName = name;
    let reset = await transport.control('POST', '/sim/reset', { world: worldName }).catch(() => null);
    if (!reset || reset.error) reset = await transport.control('POST', '/sim/reset', { world: 'default' });
    const directions = readDirections(name);
    const modReport = { module: name, world: reset?.world ?? 'default', scenarios: scenarios.length, exchanges: 0, passed: 0, failed: 0, gaps: 0, contract: 0, failures: [], contractIssues: [] };

    for (const sc of scenarios) {
      for (const action of planScenario(sc, directions)) {
        if (action.direction) {
          await applyDirection(transport.control, action.direction, worldName);
          continue;
        }
        const { exchange: ex, request: req, expectedSlug } = action;
        const op = findOp(ex.method, ex.path)?.op;
        let res;
        try {
          res = await transport.send(req);
        } catch (e) {
          res = { status: 0, headers: {}, body: { error: e.message } };
        }
        modReport.exchanges += 1;
        const actualSlug = problemSlug(res.body);
        const statusOk = ex.expectedStatus === undefined || res.status === ex.expectedStatus;
        const slugOk = !expectedSlug || expectedSlug === actualSlug;
        let contractNote = res.headers['x-sim-contract'];
        if (transport.remote && op && !contractNote) {
          const found = findOp(ex.method, ex.path);
          const v = validateResponseBody(found.op, res.status, res.body);
          if (v.errors) contractNote = fmtErrors(v.errors).slice(0, 300);
        }
        const entry = {
          scenario: sc.id,
          line: ex.line,
          request: `${ex.method} ${ex.path}`,
          expected: `${ex.expectedStatus ?? '-'}${expectedSlug ? ' ' + expectedSlug : ''}`,
          actual: `${res.status}${actualSlug ? ' ' + actualSlug : ''}`,
          detail: res.body?.detail ?? res.headers['x-sim-exception'] ?? (typeof res.body === 'object' && res.body?.title) ?? '',
        };
        if (statusOk && slugOk) {
          modReport.passed += 1;
          if (verbose) console.log(`  + ${sc.id} ${entry.request} -> ${entry.actual}`);
        } else if (ex.gap || ex.responseGap) {
          modReport.gaps += 1;
          if (verbose) console.log(`  ~ ${sc.id} ${entry.request} expected ${entry.expected} got ${entry.actual} (gap ${ex.gap ?? ex.responseGap})`);
        } else {
          modReport.failed += 1;
          modReport.failures.push(entry);
          if (verbose) console.log(`  x ${sc.id} ${entry.request} expected ${entry.expected} got ${entry.actual} -- ${entry.detail}`);
        }
        if (contractNote) {
          modReport.contract += 1;
          modReport.contractIssues.push({ ...entry, contract: contractNote });
          if (verbose) console.log(`    ! contract: ${contractNote}`);
        }
      }
    }
    report.modules.push(modReport);
    report.passed += modReport.passed;
    report.failed += modReport.failed;
    report.gaps += modReport.gaps;
    report.contract += modReport.contract;
    report.exchanges += modReport.exchanges;
    const pct = modReport.exchanges ? Math.round((modReport.passed / modReport.exchanges) * 100) : 0;
    console.log(`${name.padEnd(18)} world=${String(modReport.world).padEnd(16)} ${String(modReport.passed).padStart(4)}/${String(modReport.exchanges).padEnd(4)} passed (${String(pct).padStart(3)}%)  failed ${String(modReport.failed).padStart(3)}  gaps ${modReport.gaps}  contract ${modReport.contract}`);
    if (!summary && !verbose) {
      for (const fl of modReport.failures.slice(0, 40)) console.log(`   x ${fl.scenario.padEnd(7)} :${String(fl.line).padEnd(5)} ${fl.request.padEnd(70)} expected ${fl.expected.padEnd(32)} got ${fl.actual}  ${String(fl.detail).slice(0, 100)}`);
      if (modReport.failures.length > 40) console.log(`   ... ${modReport.failures.length - 40} more`);
      for (const c of modReport.contractIssues.slice(0, 10)) console.log(`   ! ${c.scenario.padEnd(7)} :${String(c.line).padEnd(5)} ${c.request.padEnd(70)} ${c.contract.slice(0, 120)}`);
      if (modReport.contractIssues.length > 10) console.log(`   ... ${modReport.contractIssues.length - 10} more contract issues`);
    }
  }
  const pct = report.exchanges ? Math.round((report.passed / report.exchanges) * 100) : 0;
  console.log(`\ntotal ${report.passed}/${report.exchanges} exchanges passed (${pct}%), ${report.failed} failed, ${report.gaps} known gaps, ${report.contract} contract issues`);
  if (json) writeFileSync(resolve(json), JSON.stringify(report, null, 2));
  return report;
}
