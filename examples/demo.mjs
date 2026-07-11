#!/usr/bin/env node
/**
 * APX flagship demo — boots the sandbox and walks the call-center flow:
 * token → screen-pop → validation → vend gate → command audit →
 * forced device fault → auto-raised alert.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4123;
const BASE = `http://127.0.0.1:${PORT}`;
const LANE_EXIT = 'b2000000-0000-4000-8000-000000000002';
const PLACE = 'b1000000-0000-4000-8000-000000000001';
const PAY_STATION = 'c1000000-0000-4000-8000-000000000003';

const log = (step, detail) => console.log(`\n> ${step}\n  ${detail}`);

const server = spawn('npx', ['tsx', 'packages/reference-server/src/index.ts'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
  shell: process.platform === 'win32',
});

try {
  // Wait for the sandbox to come up.
  let ready = false;
  for (let i = 0; i < 50 && !ready; i += 1) {
    try {
      const r = await fetch(`${BASE}/.well-known/apx-configuration`);
      ready = r.ok;
    } catch {
      await sleep(200);
    }
  }
  if (!ready) throw new Error('sandbox did not start');

  const config = await (await fetch(`${BASE}/.well-known/apx-configuration`)).json();
  log(
    'Bootstrap (.well-known/apx-configuration)',
    `conformance: ${config.conformanceClasses.join(', ')}`
  );

  const token = (
    await (
      await fetch(`${BASE}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: 'apx-operator',
          client_secret: 'operator-secret',
        }),
      })
    ).json()
  ).access_token;
  log('OAuth2 token issued', 'client: apx-operator (sandbox toy issuer)');

  const authed = (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  const lane = await (await authed(`/apx/v1/lanes/${LANE_EXIT}/current`)).json();
  log(
    'Screen-pop (lane inquiry)',
    `ticket ${lane.currentTicket.ticketNumber}, due ${lane.currentTicket.amountDue.value} ${lane.currentTicket.amountDue.type}, plate ${lane.currentTicket.lpr.plate}, monthly access: ${lane.monthlyCredential.accessGranted} (${lane.monthlyCredential.denialReason})`
  );

  const providers = (await (await authed(`/apx/v1/validations/providers?place=${PLACE}`)).json())
    .data;
  log('Validation providers', providers.map((p) => p.name).join(' | '));

  const validation = await (
    await authed('/apx/v1/commands', {
      method: 'POST',
      headers: { 'idempotency-key': `demo-val-${Date.now()}` },
      body: JSON.stringify({
        commandType: 'applyValidation',
        target: { id: LANE_EXIT, className: 'VehicularAccess' },
        parameters: { ticket: lane.currentTicket.ticketNumber, provider: providers[0].provider },
      }),
    })
  ).json();
  log('applyValidation command', `202 accepted, id ${validation.id}`);

  const vend = await (
    await authed('/apx/v1/commands', {
      method: 'POST',
      headers: { 'idempotency-key': `demo-vend-${Date.now()}` },
      body: JSON.stringify({
        commandType: 'vendGate',
        target: { id: LANE_EXIT, className: 'VehicularAccess' },
        reason: 'customer assistance (demo)',
      }),
    })
  ).json();

  let final = vend;
  for (let i = 0; i < 40 && !['succeeded', 'failed'].includes(final.status); i += 1) {
    await sleep(100);
    final = await (await authed(`/apx/v1/commands/${vend.id}`)).json();
  }
  log('vendGate lifecycle (immutable audit)', final.statusHistory.map((h) => h.state).join(' -> '));

  await authed(`/apx/x/sandbox/devices/${PAY_STATION}/state`, {
    method: 'POST',
    body: JSON.stringify({ state: 'fault' }),
  });
  const alerts = (await (await authed('/apx/v1/alerts?type=deviceFault')).json()).data;
  log(
    'Forced pay-station fault -> auto-raised alert',
    alerts.length
      ? `alert ${alerts[0].id} severity=${alerts[0].severity} (${alerts[0].alertType})`
      : 'NO ALERT (unexpected)'
  );

  console.log('\nAPX flagship demo complete.\n');
} finally {
  server.kill();
  process.exit(0);
}
