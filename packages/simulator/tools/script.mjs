/**
 * Scripted scenarios: a JSON file of steps run against the simulator
 * (in-process, or a running server with --url). The step format lives in
 * src/kernel/scenario.mjs and is shared with the browser UI.
 *
 * {
 *   "name": "Gate vend with a faulting barrier",
 *   "world": "default",
 *   "token": "lakeside-parcs",                 // credential name, or a literal "Bearer …"
 *   "steps": [
 *     { "clock": { "now": "2026-09-24T18:14:00Z" } },
 *     { "inject": { "kind": "vehicleArrives", "lane": "b2…0002", "ticketNumber": "T-1001", "plate": "SYN-1234" } },
 *     { "request": { "method": "POST", "path": "/v1/commands", "headers": { "Idempotency-Key": "k1" },
 *                    "body": { "commandType": "vendGate", "target": { "id": "b2…0002", "className": "VehicularAccess" } } },
 *       "expect": { "status": 202, "body": { "status": "accepted" } }, "save": { "cmd": "$.id" } },
 *     { "clock": { "advance": "5s" } },
 *     { "request": { "method": "GET", "path": "/v1/commands/{cmd}" }, "expect": { "status": 200, "body": { "status": "succeeded" } } },
 *     { "events": { "type": "apx.control.command.status.v1", "min": 4 } }
 *   ]
 * }
 *
 * `{name}` in a path or body string substitutes a saved value; `$.a.b` in
 * `save` is a dotted path into the response body. `expect.body` is a
 * partial match (every listed member must equal). `expect.problem` names a
 * Part 12 slug. Ids may use the `xx…NNNN` shorthand. `narration` is prose
 * the UI's presenter mode shows; the runner ignores it.
 */
import { readFileSync } from 'node:fs';
import { runStep, tokenOf } from '../src/kernel/scenario.mjs';

function remoteIo(url) {
  const base = url.replace(/\/$/, '');
  const send = async (req) => {
    const res = await fetch(base + req.path, { method: req.method, headers: req.headers, body: req.body });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
  };
  const control = (method, path, body) => send({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.body);
  return { send, control };
}

export function localIo(sim) {
  const send = (req) => sim.dispatch(req);
  const control = (method, path, body) => sim.dispatch({ method, path, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.body);
  return { send, control };
}

export async function runScript(file, { world, url, verbose = false } = {}) {
  const script = JSON.parse(readFileSync(file, 'utf8'));
  const worldName = world ?? script.world ?? 'default';
  let io;
  if (url) io = remoteIo(url);
  else {
    const { Simulator } = await import('../src/index.mjs');
    io = localIo(new Simulator({ world: worldName }));
  }
  await io.control('POST', '/sim/reset', { world: worldName });
  let vars = { ...(script.vars ?? {}) };
  const defaultToken = tokenOf(script.token);
  const result = { name: script.name ?? file, steps: 0, passed: 0, failed: 0, failures: [] };

  for (const [i, raw] of (script.steps ?? []).entries()) {
    result.steps += 1;
    const label = raw.name ?? `step ${i + 1}`;
    const r = await runStep(raw, { io, vars, defaultToken, defaultWorld: worldName });
    vars = r.vars;
    if (verbose && r.clock) console.log(`  clock -> ${r.clock.now}`);
    if (verbose && r.response) console.log(`  ${r.request.method} ${r.request.path} -> ${r.response.status}${r.response.problem ? ' ' + r.response.problem : ''}`);
    if (r.ok) {
      result.passed += 1;
      console.log(`+ ${label}`);
      continue;
    }
    result.failed += 1;
    result.failures.push({ step: label, error: r.error });
    console.log(`x ${label}: ${r.error}`);
    if (raw.continueOnFailure !== true && script.stopOnFailure !== false) break;
  }
  console.log(`\n${result.name}: ${result.passed}/${result.steps} steps passed${result.failed ? `, ${result.failed} failed` : ''}`);
  return result;
}
