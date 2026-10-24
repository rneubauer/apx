/**
 * apx-control (Part 6): the command plane with its lifecycle and the
 * simulated PARCS that executes it, device status overlays, lane inquiry
 * with match candidates, validation providers, negotiated rates and
 * ticket matching.
 *
 * World sections read: lanes[].current, devices[].state, rateTables[],
 * placeRates{}, validationProviders[], sessions[] (with `_` hints),
 * accessCredentials[], resolutionPolicies{}, actors{}, control.timing{}.
 */
import { createHash } from 'node:crypto';
import { registryValues } from '../kernel/spec.mjs';
import { fail } from '../kernel/problems.mjs';
import { paginate, entry, refOf, placeOfTarget, requireNode, money, wire, text, shortId, isRef } from './common.mjs';

const COMMAND_TYPES = registryValues('apx-command-types');
const DEVICE_STATES = registryValues('apx-device-states');
const CANCELLABLE = new Set(['received', 'accepted']);
const TERMINAL = new Set(['succeeded', 'failed', 'expired', 'cancelled', 'rejected']);
const GATE_COMMANDS = new Set(['vendGate', 'holdGateOpen', 'closeLane']);
const FAULTED = new Set(['fault', 'inoperative', 'outOfService']);
const CONSUMABLE_KINDS = ['tickets', 'receiptPaper', 'cash', 'coins'];
const CONSUMABLE_LEVELS = ['ok', 'low', 'empty', 'unknown'];

const DEFAULT_TIMING = { dispatch: 1000, execute: 0, succeed: 2000 };

export default {
  name: 'control',
  register(sim) {
    const commands = () => sim.store.collection('commands');
    const devices = () => sim.store.collection('devices');
    const lanes = () => sim.store.collection('lanes');
    const sessions = () => sim.store.collection('sessions');
    const actors = () => ({ received: 'apx-operator', parcs: 'lakeside-parcs', ...(sim.world.actors ?? {}) });
    // world.control.timing: { dispatch, execute, succeed, byType: { holdGateOpen: { dispatch } } } in ms
    const timing = (commandType) => {
      const t = sim.world.control?.timing ?? {};
      return { ...DEFAULT_TIMING, ...t, ...(t.byType?.[commandType] ?? {}) };
    };

    // ---------- seeding ----------

    sim.seed((world) => {
      for (const d of world.devices ?? []) {
        devices().put({
          id: d.id,
          version: 1,
          _place: sim.hierarchy.placeOf(d.id)?.id,
          _lane: d.laneId,
          name: d.name,
          deviceState: d.state ?? 'available',
          lastCommunication: d.lastCommunication ?? world.clock?.start,
          stateChangedTime: d.stateChangedTime ?? world.clock?.start,
          ...(d.fault ? { fault: d.fault } : {}),
          ...(d.consumables ? { consumables: d.consumables } : {}),
          ...(d.maintenanceMode !== undefined ? { maintenanceMode: d.maintenanceMode } : {}),
        });
      }
      for (const l of world.lanes ?? []) {
        lanes().put({ id: l.id, version: 1, _place: l.placeId, name: l.name, accessType: l.accessType, gate: l.gate, current: l.current ?? null, lastRead: l.lastRead ?? null, credential: l.credential ?? null, holds: [] });
      }
      for (const s of world.sessions ?? []) {
        if (!sessions().has(s.id)) sessions().put({ ...s, _place: s._place ?? s.hierarchyElement?.id });
      }
      for (const t of world.rateTables ?? []) {
        if (!sim.store.collection('rateTables').has(t.id)) sim.store.collection('rateTables').put(t);
      }
      for (const c of world.commands ?? []) {
        const node = sim.hierarchy.get(c.target?.id);
        commands().put({ status: 'succeeded', statusHistory: [], ...c, _place: node ? sim.hierarchy.placeOf(node.id)?.id : c._place });
      }
    });

    sim.view('commands', (c) => wire(c));

    // ---------- the simulated PARCS: lifecycle transitions ----------

    const transition = (id, state, actor, detail, extra = {}) => {
      const cmd = commands().get(id);
      if (!cmd || TERMINAL.has(cmd.status)) return cmd;
      const now = sim.clock.now();
      const next = commands().update(id, (c) => ({
        ...c,
        ...extra,
        status: state,
        statusHistory: [...(c.statusHistory ?? []), entry(state, now, actor, detail)],
      }));
      sim.events.publish({ type: 'apx.control.command.status.v1', data: wire(next), subject: refOf(next.id, 'Command'), place: next._place });
      sim.hooks.emit('command.transition', { command: next, state });
      return next;
    };

    const deviceActor = (deviceId, kind = 'gate') => `${kind}-${shortId(deviceId)}`;

    const gateOf = (cmd) => {
      const node = sim.hierarchy.get(cmd.target.id);
      if (!node) return null;
      if (node.kind === 'device') return devices().get(node.id);
      const lane = lanes().get(node.id);
      return lane?.gate ? devices().get(lane.gate) : null;
    };

    const releaseHolds = (pred, detail) => {
      for (const c of commands().find((c) => c.commandType === 'holdGateOpen' && c.status === 'executing' && pred(c))) {
        transition(c.id, 'succeeded', actors().parcs, detail);
      }
    };

    const setDeviceState = (deviceId, state, actor) => {
      const before = devices().get(deviceId);
      if (!before) return null;
      const now = sim.clock.now();
      const after = devices().update(deviceId, (d) => ({ ...d, deviceState: state, lastCommunication: now, ...(d.deviceState !== state ? { stateChangedTime: now } : {}) }));
      if (before.deviceState !== state) {
        sim.events.publish({ type: 'apx.control.device.state.v1', data: deviceStatus(after), subject: refOf(deviceId, 'SupplementalEquipment'), place: after._place });
        sim.hooks.emit('device.state', { device: after, previous: before.deviceState, actor });
        releaseHolds((c) => c.target.id === deviceId || lanes().get(c.target.id)?.gate === deviceId, `hold released by setDeviceState on ${deviceId}`);
      }
      return after;
    };

    /** Walk a freshly accepted command through dispatch → executing → outcome on the sim clock. */
    const runCommand = (id) => {
      const t = timing(commands().get(id)?.commandType);
      sim.clock.schedule({ delay: t.dispatch }, () => {
        const cmd = commands().get(id);
        if (!cmd || cmd.status !== 'accepted') return;
        transition(id, 'dispatched', actors().parcs);
        const gate = gateOf(cmd);
        const actor = gate ? deviceActor(gate.id, cmd.target.className === 'SupplementalEquipment' ? 'device' : 'gate') : `lane-${shortId(cmd.target.id)}`;
        sim.clock.schedule({ delay: t.execute }, () => {
          const c2 = commands().get(id);
          if (!c2 || c2.status !== 'dispatched') return;
          if (cmd.commandType === 'holdGateOpen') {
            transition(id, 'executing', actor, 'barrier held open', { confirmationLevel: 'deviceAcknowledged' });
            if (lanes().has(cmd.target.id)) lanes().update(cmd.target.id, (l) => ({ ...l, holds: [...(l.holds ?? []), id] }), { bump: false });
            if (cmd.expiryTime) sim.clock.schedule(cmd.expiryTime, () => releaseHolds((c) => c.id === id, 'hold released at expiryTime'), `hold expiry ${id}`);
            return;
          }
          if (GATE_COMMANDS.has(cmd.commandType)) transition(id, 'executing', actor, undefined, { confirmationLevel: 'deviceAcknowledged' });
          sim.clock.schedule({ delay: t.succeed }, () => complete(id, actor), `complete ${id}`);
        }, `execute ${id}`);
      }, `dispatch ${id}`);
    };

    /** The outcome of a command, applied to the world. */
    const complete = (id, actor) => {
      const cmd = commands().get(id);
      if (!cmd || TERMINAL.has(cmd.status)) return;
      const forced = cmd._outcome; // set by the commandOutcome injector
      if (forced?.state === 'failed') {
        transition(id, 'failed', actor, forced.detail ?? 'device reported failure', { confirmationLevel: forced.confirmationLevel ?? 'deviceAcknowledged' });
        return;
      }
      const lane = lanes().get(cmd.target.id);
      const p = cmd.parameters ?? {};
      let detail;
      let result;
      let confirmationLevel = 'deviceAcknowledged';
      switch (cmd.commandType) {
        case 'vendGate':
          confirmationLevel = forced?.confirmationLevel ?? 'physicallyConfirmed';
          detail = sim.siteconfig?.roleOf(cmd.target.id) === 'accessDoor' ? 'door released; closed again after 7 s' : 'barrier raised; loop sensor cleared';
          if (lane?.current?.session) closeSession(lane.current.session.id, cmd);
          if (lane && sim.world.control?.clearLaneOnVend) lanes().update(lane.id, (l) => ({ ...l, current: null }), { bump: false });
          break;
        case 'closeLane':
          releaseHolds((c) => c.target.id === cmd.target.id && c.id !== id, `hold released by closeLane ${id}`);
          detail = 'lane closed';
          break;
        case 'lostTicket': {
          const issued = issueLostTicket(cmd, lane);
          result = issued.result;
          detail = issued.detail;
          break;
        }
        case 'applyValidation': {
          detail = applyValidation(cmd, lane).detail;
          break;
        }
        case 'pushRate':
          detail = `rate deck ${p.rateTable?.id} v${p.rateTable?.version} now in force at the lane`;
          if (lane) lanes().update(lane.id, (l) => ({ ...l, rateTable: p.rateTable }), { bump: false });
          sim.hooks.emit('rate.pushed', { command: cmd, rateTable: p.rateTable, place: cmd._place });
          break;
        case 'pushNegotiatedRate': {
          if (p.amount !== undefined) {
            applyNegotiatedAmount(cmd, lane, id, p.amount);
            result = { amountDue: money(p.amount.currencyValue, p.amount.currencyType) };
            detail = `negotiated amount ${p.amount.currencyValue} ${p.amount.currencyType} set on the current ticket by ${cmd.agent}: ${cmd.reason}`;
            break;
          }
          const table = sim.store.collection('rateTables').get(p.rateTable.id);
          const amount = negotiatedAmount(table);
          if (lane?.current) {
            lanes().update(
              lane.id,
              (l) => ({
                ...l,
                current: {
                  ...l.current,
                  amountDue: amount ?? l.current.amountDue,
                  negotiatedAmount: undefined,
                  negotiatedRate: {
                    rateTable: p.rateTable,
                    command: refOf(id, 'Command'),
                    agent: cmd.agent,
                    ...(table?.extensions?.['apds-ext:apx:ratepolicy@1.0'] ? { policy: table.extensions['apds-ext:apx:ratepolicy@1.0'] } : {}),
                  },
                },
              }),
              { bump: false }
            );
          }
          result = { rateTable: p.rateTable, ...(amount ? { amountDue: amount } : {}) };
          detail = `negotiated rate ${p.rateTable.id} v${p.rateTable.version} applied to the current ticket by ${cmd.agent}`;
          break;
        }
        case 'matchTicket': {
          const session = sessions().get(p.session.id);
          const amount = session?._amountDue ? money(session._amountDue.currencyValue, session._amountDue.currencyType) : money(0);
          if (lane) {
            lanes().update(
              lane.id,
              (l) => ({
                ...l,
                current: {
                  ...(session?._ticketNumber ? { ticketNumber: session._ticketNumber } : {}),
                  session: refOf(p.session.id, 'Session'),
                  issuedTime: session?.actualStart ?? l.current?.issuedTime ?? sim.clock.now(),
                  amountDue: amount,
                  paidInFull: amount.currencyValue === 0,
                  validations: l.current?.validations ?? [],
                  ...(l.current?.lpr ? { lpr: l.current.lpr } : {}),
                  matchedCommand: refOf(id, 'Command'),
                },
              }),
              { bump: false }
            );
          }
          if (session) sessions().update(session.id, (s) => ({ ...s, _boundExit: lane?.id ?? cmd.target.id }), { bump: false });
          result = { session: refOf(p.session.id, 'Session'), amountDue: amount };
          detail = `exit bound to session ${p.session.id}; priced from its entry`;
          break;
        }
        case 'setDeviceState':
          setDeviceState(cmd.target.id, p.state, actor);
          detail = `device state set to ${p.state}`;
          break;
        case 'restartDevice':
          if (devices().has(cmd.target.id)) devices().update(cmd.target.id, (d) => ({ ...d, lastCommunication: sim.clock.now() }), { bump: false });
          detail = 'device restarted';
          break;
        case 'displayMessage': {
          // Part 6 §6.1a proof of display: a hash of what was shown, never the text (a §26.9 record names it).
          const shown = text(p.message) ?? '';
          detail = `message displayed: ${shown}`.trim();
          result = { display: { shownTime: sim.clock.now(), contentHash: `sha256:${createHash('sha256').update(shown).digest('hex').slice(0, 12)}`, acknowledgedBy: 'player' } };
          break;
        }
        case 'resetPassback':
        case 'forceIn':
        case 'forceOut':
          sim.hooks.emit('passback', { command: cmd });
          detail = `${cmd.commandType} applied to credential ${p.credential?.id}`;
          break;
        case 'courtesyExit':
          sim.hooks.emit('courtesyExit', { command: cmd });
          detail = `courtesy exit granted for holder ${p.holder?.id ?? p.account?.id}`;
          break;
        case 'ejectTicket': {
          // Part 6 §6.1: give the media back; a jam the device reported is cleared with it.
          const d = devices().get(cmd.target.id);
          const jammed = d?.fault && /jam|stuck/i.test(`${d.fault.code} ${d.fault.displayText ?? ''}`);
          if (jammed) clearFault(cmd.target.id, actor);
          detail = jammed ? `${d.fault.code} cleared; ${/card/i.test(d.fault.displayText ?? '') ? 'card' : 'ticket'} returned to the customer` : 'media ejected';
          break;
        }
        case 'cancelTransaction':
          detail = lane?.current ? `transaction on ticket ${lane.current.ticketNumber ?? '(none)'} cancelled; terminal idle` : 'transaction cancelled; terminal idle';
          break;
        case 'reprintReceipt': {
          const d = devices().get(cmd.target.id);
          const paper = (d?.consumables ?? []).find((c) => c.kind === 'receiptPaper');
          const ticket = lane?.current?.ticketNumber ?? cmd.reason?.match(/\b(T-\d+|LT-\d+)\b/)?.[1];
          detail = `receipt${ticket ? ` for ${ticket}` : ''} printed; paper sensor ${paper?.level ?? 'ok'}`;
          break;
        }
        default:
          detail = `${cmd.commandType} executed`;
      }
      transition(id, 'succeeded', actor, detail, { confirmationLevel, ...(result ? { result } : {}) });
    };

    const closeSession = (sessionId, cmd) => {
      const s = sessions().get(sessionId);
      if (!s || s.actualEnd) return;
      const next = sessions().update(sessionId, (x) => ({ ...x, actualEnd: sim.clock.now(), _exitLane: cmd.target.id }));
      sim.events.publish({ type: 'SessionUpdated', data: wire(next), subject: refOf(sessionId, 'Session'), place: s._place });
    };

    // ---------- the rate deck ----------

    const tablesAtPlace = (placeId) => {
      const coll = sim.store.collection('rateTables');
      const ids = sim.world.placeRates?.[placeId];
      if (ids) return ids.map((id) => coll.get(id)).filter(Boolean);
      return coll.all().filter((t) => !t._places || t._places.includes(placeId));
    };

    const lostTicketLine = (table) => {
      for (const coll of table?.rateLineCollections ?? []) {
        for (const line of coll.rateLines ?? []) {
          const d = Array.isArray(line.description) ? line.description.map((x) => x.string).join(' ') : String(line.description ?? '');
          if (/lostTicketFee/i.test(d)) return { line, currency: coll.applicableCurrency ?? 'USD' };
        }
      }
      return null;
    };

    /** Part 6 §6.6, the negotiatedAmounts feature: any amount, attributed and reasoned. */
    const checkNegotiatedAmount = (b, amount, lane, node) => {
      if (!(sim.world.features ?? []).includes('negotiatedAmounts')) {
        fail('rate-not-negotiable', 'This host does not offer the negotiatedAmounts feature; select a negotiable RateTable instead.');
      }
      const bad = (pointer, detail) => fail('invalid-request', detail, { errors: [{ pointer, detail }] });
      if (!amount || typeof amount !== 'object' || typeof amount.currencyType !== 'string' || typeof amount.currencyValue !== 'number') {
        bad('/parameters/amount', 'amount is an AmountInCurrency: currencyType and a numeric currencyValue');
      }
      if (!Number.isFinite(amount.currencyValue) || amount.currencyValue < 0) bad('/parameters/amount/currencyValue', 'a negotiated amount cannot be negative');
      if (typeof b.reason !== 'string' || !b.reason.trim()) bad('/reason', 'a stated amount requires reason: there is no deck table to explain it');
      if (!lane?.current) fail('lane-no-current-transaction', `VehicularAccess ${node.id} has no vehicle transaction in progress.`);
      const currency = lane.current.amountDue?.currencyType;
      if (currency && amount.currencyType !== currency) bad('/parameters/amount/currencyType', `the ticket is priced in ${currency}, not ${amount.currencyType}`);
    };

    const applyNegotiatedAmount = (cmd, lane, id, amount) => {
      if (!lane?.current) return;
      lanes().update(
        lane.id,
        (l) => ({
          ...l,
          current: {
            ...l.current,
            amountDue: money(amount.currencyValue, amount.currencyType),
            paidInFull: amount.currencyValue === 0,
            // A stated amount is its own member; negotiatedRate (rateTable required) is cleared.
            negotiatedRate: undefined,
            negotiatedAmount: { amount: money(amount.currencyValue, amount.currencyType), reason: cmd.reason, agent: cmd.agent, command: refOf(id, 'Command') },
          },
        }),
        { bump: false }
      );
    };

    const negotiatedAmount = (table) => {
      const coll = table?.rateLineCollections?.[0];
      const line = coll?.rateLines?.find((l) => /flat/i.test(l.rateLineType ?? '')) ?? coll?.rateLines?.[0];
      return line ? money(line.value, coll.applicableCurrency ?? 'USD') : null;
    };

    const issueLostTicket = (cmd, lane) => {
      const placeId = cmd._place;
      const table = tablesAtPlace(placeId).find(lostTicketLine) ?? tablesAtPlace(placeId)[0];
      const fee = lostTicketLine(table);
      const n = sim.store.next('lostTicket', 91);
      const ticketNumber = `T-LT-${String(n).padStart(4, '0')}`;
      const now = sim.clock.now();
      const amount = money(fee.line.value, fee.currency);
      const session = sessions().insert(
        {
          actualStart: now,
          initiator: { id: sim.hierarchy.operatorOf(placeId) ?? sim.world.organisation?.id ?? 'operator', version: 1, className: 'Organisation' },
          hierarchyElement: { id: placeId, version: 1, className: 'Place' },
          identifiedCredentials: [],
          segments: [],
          _place: placeId,
          _ticketNumber: ticketNumber,
          _entryLane: cmd.target.id,
          _amountDue: amount,
          _lostTicket: true,
        },
        { actor: { org: cmd.requestedBy } }
      );
      sim.events.publish({ type: 'SessionCreated', data: wire(session), subject: refOf(session.id, 'Session'), place: placeId });
      if (lane) {
        lanes().update(lane.id, (l) => ({ ...l, current: { ticketNumber, session: refOf(session.id, 'Session'), issuedTime: now, amountDue: amount, paidInFull: false, validations: [] } }), { bump: false });
      }
      return {
        result: { ticketNumber, session: refOf(session.id, 'Session'), amountDue: amount },
        detail: `lost ticket ${ticketNumber} issued; fee ${amount.currencyType} ${amount.currencyValue.toFixed(2)} from RateTable ${table.id} v${table.version} line lostTicketFee`,
      };
    };

    // ---------- validations ----------

    const providersAt = (placeId) => {
      const fromWorld = (sim.world.validationProviders ?? [])
        .filter((p) => p.placeId === placeId || sim.hierarchy.within(placeId, p.placeId))
        .map(({ placeId: _p, ...rest }) => rest);
      const fromPrograms = sim.store
        .collection('validationPrograms')
        .find((p) => p.programStatus === 'active' && (p._place === placeId || (p._place && sim.hierarchy.within(placeId, p._place))))
        .map((p) => ({
          provider: p.merchant ?? p.provider,
          ...(p.name ?? text(p.merchantName) ? { name: p.name ?? text(p.merchantName) } : {}),
          program: refOf(p.id, 'ValidationProgram'),
          ...(p.validationType ?? p.instrumentType ? { validationType: p.validationType ?? p.instrumentType } : {}),
          ...(p.benefit ? { benefit: p.benefit } : {}),
          _programId: p.id,
        }));
      const seen = new Set();
      return [...fromPrograms, ...fromWorld].filter((p) => p.provider?.id && (seen.has(p.provider.id) ? false : seen.add(p.provider.id)));
    };

    const benefitReduction = (benefit, amountDue) => {
      if (!benefit || !amountDue) return 0;
      const due = amountDue.currencyValue;
      if (benefit.amount) return Math.min(due, benefit.amount.currencyValue);
      if (benefit.percentage) return Number(((due * benefit.percentage) / 100).toFixed(2));
      if (benefit.duration) {
        const m = String(benefit.duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        const hours = Number(m?.[1] ?? 0) + Number(m?.[2] ?? 0) / 60;
        return Math.min(due, Number((hours * (sim.world.control?.hourlyRate ?? 3)).toFixed(2)));
      }
      return 0;
    };

    const applyValidation = (cmd, lane) => {
      const p = cmd.parameters;
      const provider = providersAt(cmd._place).find((x) => x.provider.id === p.provider.id);
      const now = sim.clock.now();
      const validationId = `VAL-${now.slice(0, 10)}-${String(sim.store.next('validation', 417)).padStart(5, '0')}`;
      const target = lane?.current?.ticketNumber === p.ticket ? lane : (lanes().first((l) => l.current?.ticketNumber === p.ticket) ?? lane);
      let reduced = 0;
      if (target?.current) {
        reduced = benefitReduction(provider?.benefit, target.current.amountDue);
        lanes().update(
          target.id,
          (l) => {
            const due = l.current.amountDue ? money(l.current.amountDue.currencyValue - reduced, l.current.amountDue.currencyType) : undefined;
            return {
              ...l,
              current: {
                ...l.current,
                ...(due ? { amountDue: due, paidInFull: due.currencyValue === 0 } : {}),
                validations: [
                  ...(l.current.validations ?? []),
                  {
                    provider: p.provider,
                    ...(provider?.name ? { providerName: provider.name } : {}),
                    ...(provider?.validationType ? { validationType: provider.validationType } : {}),
                    validationId,
                    ...(due ? { amountReduced: money(reduced, due.currencyType) } : {}),
                    appliedTime: now,
                  },
                ],
              },
            };
          },
          { bump: false }
        );
      }
      sim.hooks.emit('validation.applied', { command: cmd, provider, ticket: p.ticket, validationId, reduced, place: cmd._place });
      return { detail: `validation ${validationId} by ${provider?.name ?? p.provider.id} applied to ticket ${p.ticket}` };
    };

    // ---------- policy (Part 17 §17.3) ----------

    const policyFor = (contextRef) => {
      if (!isRef(contextRef)) return null;
      const ctxRec = sim.store.collection('resolutionContexts').get(contextRef.id);
      return ctxRec?._policy ?? sim.world.resolutionPolicies?.[contextRef.id] ?? null;
    };

    // ---------- handlers ----------

    sim.on('post-apx-v1-commands', (ctx) => {
      const b = ctx.body;
      if (!COMMAND_TYPES.includes(b.commandType) && !(sim.world.vendorCommandTypes ?? []).includes(b.commandType)) {
        fail('invalid-request', `commandType ${b.commandType} is not in apx-command-types or any registered vendor list.`, { errors: [{ pointer: '/commandType', detail: 'unknown command type' }] });
      }
      const { node, place } = placeOfTarget(ctx, b.target, 'target');
      const p = b.parameters ?? {};
      const now = ctx.now();
      if (b.expiryTime && Date.parse(b.expiryTime) <= ctx.clock.nowMs()) {
        fail('command-expired', `expiryTime ${b.expiryTime} is already in the past (server time ${now}).`);
      }
      // policy gate
      const policy = policyFor(b.resolutionContext);
      if (policy && policy[b.commandType]) {
        const rule = policy[b.commandType];
        if (rule.allowed === false) fail('action-not-allowed', `Context ${b.resolutionContext.id} evaluated ${b.commandType} as allowed=false: ${rule.reason ?? 'not allowed by policy'}.`);
        if (rule.requiresApproval && !b.approval?.approvedBy) {
          fail('approval-required', `Context ${b.resolutionContext.id} allows ${b.commandType} only with approval by role ${rule.requiresApproval}; no approval evidence supplied.`);
        }
      } else if (policy?._default?.allowed === false && !(policy._allowed ?? []).includes(b.commandType)) {
        fail('action-not-allowed', `Context ${b.resolutionContext.id} did not offer ${b.commandType}.`);
      }
      // Part 17 §17.3a: approval evidence that cites a request must cite one that was approved.
      if (isRef(b.approval?.approvalRequest) && sim.approvals) {
        const req = sim.approvals.get(b.approval.approvalRequest.id);
        if (!req) fail('reference-unknown', `approval.approvalRequest ${b.approval.approvalRequest.id} names no approval request known here.`);
        if (req.status !== 'approved') fail('approval-required', `Approval request ${req.id} is ${req.status}; only an approved request is evidence for ${b.commandType}.`);
      }
      // per-type synchronous checks
      const lane = lanes().get(node.id);
      const needsAgent = b.commandType === 'pushNegotiatedRate' || b.commandType === 'matchTicket';
      if (needsAgent && !b.agent) fail('agent-required', `${b.commandType} requires agent: the principal who ${b.commandType === 'matchTicket' ? 'matched the ticket' : 'selected the rate'}.`);
      const requireParam = (name, test = (v) => v !== undefined) => {
        if (!test(p[name])) fail('invalid-request', `${b.commandType} requires parameters.${name}`, { errors: [{ pointer: `/parameters/${name}`, detail: 'required' }] });
      };
      switch (b.commandType) {
        case 'lostTicket': {
          requireParam('method', (v) => typeof v === 'string');
          const tables = tablesAtPlace(place.id);
          if (!tables.find(lostTicketLine)) {
            const t = tables[0];
            fail('lost-ticket-fee-undefined', `RateTable ${t?.id ?? '(none)'} v${t?.version ?? '?'} in force at place ${place.id} has no rate line described lostTicketFee; no lost ticket was issued.`);
          }
          break;
        }
        case 'applyValidation': {
          requireParam('ticket', (v) => typeof v === 'string');
          requireParam('provider', isRef);
          if (!providersAt(place.id).some((x) => x.provider.id === p.provider.id)) {
            fail('validation-provider-unknown', `Organisation ${p.provider.id} is not on the provider list for place ${place.id}.`);
          }
          break;
        }
        case 'pushRate':
          requireParam('rateTable', isRef);
          break;
        case 'setDeviceState':
          requireParam('state', (v) => DEVICE_STATES.includes(v));
          break;
        case 'displayMessage':
          requireParam('message', (v) => Array.isArray(v) && v.length > 0);
          break;
        case 'pushNegotiatedRate': {
          if ((p.rateTable === undefined) === (p.amount === undefined)) {
            fail('invalid-request', 'pushNegotiatedRate takes exactly one of parameters.rateTable and parameters.amount.', { errors: [{ pointer: '/parameters', detail: 'exactly one of rateTable, amount' }] });
          }
          if (p.amount !== undefined) {
            checkNegotiatedAmount(b, p.amount, lane, node);
            break;
          }
          requireParam('rateTable', isRef);
          const table = sim.store.collection('rateTables').get(p.rateTable.id);
          const policyExt = table?.extensions?.['apds-ext:apx:ratepolicy@1.0'];
          const applies = table && tablesAtPlace(place.id).some((t) => t.id === table.id);
          if (!table || !applies || !policyExt?.negotiable) {
            fail('rate-not-negotiable', `RateTable ${p.rateTable.id} v${p.rateTable.version ?? table?.version ?? '?'} carries no apds-ext:apx:ratepolicy@1.0 negotiable flag for place ${place.id}.`);
          }
          if (!lane?.current) fail('lane-no-current-transaction', `VehicularAccess ${node.id} has no vehicle transaction in progress.`);
          break;
        }
        case 'matchTicket': {
          requireParam('session', isRef);
          const s = sessions().get(p.session.id);
          if (!s) fail('session-not-open', `Session ${p.session.id} is not known at this place.`);
          if (s.actualEnd) fail('session-not-open', `Session ${p.session.id} ended ${s.actualEnd}.`);
          if (s._boundExit) fail('session-not-open', `Session ${p.session.id} is already bound to an exit at ${s._boundExit}.`);
          if (s._place && s._place !== place.id && !ctx.hierarchy.within(s._place, place.id)) fail('session-not-open', `Session ${p.session.id} is at place ${s._place}, not ${place.id}.`);
          if (!lane?.current && !lane?.lastRead) fail('lane-no-current-transaction', `VehicularAccess ${node.id} has no vehicle transaction in progress.`);
          break;
        }
        case 'resetPassback':
        case 'forceIn':
        case 'forceOut':
          requireParam('credential', isRef);
          break;
        case 'courtesyExit':
          if (!isRef(p.holder) && !isRef(p.account)) requireParam('holder', isRef);
          break;
        default:
          break;
      }
      // create
      const a = actors();
      const gate = GATE_COMMANDS.has(b.commandType) ? (lane?.gate ? devices().get(lane.gate) : null) : null;
      const gateDown = gate && ['fault', 'outOfService', 'inoperative'].includes(gate.deviceState);
      const cmd = commands().insert(
        {
          ...b,
          requestedBy: b.requestedBy ?? ctx.principal.orgRef,
          status: 'received',
          statusHistory: [entry('received', now, a.received)],
          _place: place.id,
          _credential: ctx.principal.sub,
        },
        { assignedId: ctx.assignId, actor: ctx.actor }
      );
      sim.events.publish({ type: 'apx.control.command.status.v1', data: wire(cmd), subject: refOf(cmd.id, 'Command'), place: place.id });
      if (gateDown) {
        sim.clock.schedule({ delay: 500 }, () => transition(cmd.id, 'rejected', a.parcs, `gate ${shortId(gate.id)} is in state ${gate.deviceState}; ${b.commandType} refused`), `reject ${cmd.id}`);
      } else {
        transition(cmd.id, 'accepted', a.parcs, undefined, { confirmationLevel: 'accepted' });
        if (b.expiryTime) {
          sim.clock.schedule(
            b.expiryTime,
            () => {
              const c = commands().get(cmd.id);
              if (c && (c.status === 'received' || c.status === 'accepted')) transition(cmd.id, 'expired', a.parcs, 'expiryTime passed before dispatch');
            },
            `expire ${cmd.id}`
          );
        }
        runCommand(cmd.id);
      }
      return { status: 202, body: wire(commands().get(cmd.id)), idem: { collection: 'commands', id: cmd.id } };
    });

    const visibleCommand = (ctx, id) => {
      const cmd = commands().get(id);
      if (!cmd) fail('target-not-found', `No command ${id}.`);
      if (cmd._place && (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, cmd._place))) {
        fail('insufficient-grant', `Command ${cmd.id} targets ${cmd.target.className} ${cmd.target.id} at place ${cmd._place}, outside the token's apx_places grant.`);
      }
      return cmd;
    };

    sim.on('get-apx-v1-commands-id', (ctx) => wire(visibleCommand(ctx, ctx.params.id)));

    sim.on('get-apx-v1-commands', (ctx) => {
      const places = ctx.query.list('place');
      for (const id of places) {
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
      }
      const since = ctx.query.get('since');
      const until = ctx.query.get('until');
      const received = (c) => c.statusHistory?.[0]?.time ?? c.recordInfo?.creationTime ?? '';
      const rows = commands()
        .find((c) => {
          if (!ctx.principal.hasGrant) return false;
          if (c._place && !ctx.hierarchy.covers(ctx.principal.places, c._place)) return false;
          if (places.length && !places.some((p) => ctx.hierarchy.within(c.target.id, p) || (c._place && ctx.hierarchy.within(c._place, p)))) return false;
          if (ctx.query.has('target') && c.target.id !== ctx.query.get('target')) return false;
          if (ctx.query.has('commandType') && c.commandType !== ctx.query.get('commandType')) return false;
          if (ctx.query.has('status') && c.status !== ctx.query.get('status')) return false;
          if (ctx.query.has('agent') && c.agent !== ctx.query.get('agent')) return false;
          if (since && received(c) < since) return false;
          if (until && received(c) > until) return false;
          return true;
        })
        .sort((x, y) => (received(y) > received(x) ? 1 : received(y) < received(x) ? -1 : 0));
      return paginate(ctx, rows);
    });

    sim.on(
      'post-apx-v1-commands-id-cancel',
      (ctx) => {
        const cmd = visibleCommand(ctx, ctx.params.id);
        if (!CANCELLABLE.has(cmd.status)) {
          fail('command-not-cancellable', `Command ${cmd.id} is in state ${cmd.status}; cancel is allowed only in received or accepted.`);
        }
        const detail = ctx.body?.detail ?? ctx.body?.reason;
        return wire(transition(cmd.id, 'cancelled', ctx.body?.agent ?? actors().received, detail));
      },
      { allowEmptyBody: true, skipBodyValidation: true }
    );

    // ---- devices ----

    const deviceStatus = (d) => ({
      device: refOf(d.id, 'SupplementalEquipment'),
      deviceState: d.deviceState,
      ...(d.lastCommunication ? { lastCommunication: d.lastCommunication } : {}),
      ...(d.stateChangedTime ? { stateChangedTime: d.stateChangedTime } : {}),
      // Part 6 §6.4: the fault the device reports (while it is in a faulted state), its supply levels, and maintenance mode.
      ...(d.fault && FAULTED.has(d.deviceState) ? { fault: d.fault } : {}),
      ...(d.consumables?.length ? { consumables: d.consumables } : {}),
      ...(typeof d.maintenanceMode === 'boolean' ? { maintenanceMode: d.maintenanceMode } : {}),
      ...(d.extensions ? { extensions: d.extensions } : {}),
    });

    /** The device reports a fault code (Part 6 §6.4); the state moves with it unless the caller pins one. */
    const setFault = (deviceId, { code, displayText, state = 'fault', since }, actor = 'device') => {
      const now = sim.clock.now();
      devices().update(deviceId, (d) => ({ ...d, fault: { code, ...(displayText ? { displayText } : {}), since: since ?? now } }), { bump: false });
      return setDeviceState(deviceId, state, actor) ?? devices().get(deviceId);
    };

    const clearFault = (deviceId, actor = 'device', state = 'available') => {
      devices().update(deviceId, (d) => ({ ...d, fault: undefined }), { bump: false });
      return setDeviceState(deviceId, state, actor) ?? devices().get(deviceId);
    };

    /** A supply level changes; the alerts module raises consumableLow on low/empty and resolves it on ok. */
    const setConsumable = (deviceId, kind, level, actor = 'device') => {
      const before = devices().get(deviceId);
      const previous = (before.consumables ?? []).find((c) => c.kind === kind)?.level ?? 'unknown';
      const after = devices().update(
        deviceId,
        (d) => ({ ...d, lastCommunication: sim.clock.now(), consumables: [...(d.consumables ?? []).filter((c) => c.kind !== kind), { kind, level }] }),
        { bump: false }
      );
      if (previous !== level) sim.hooks.emit('device.consumables', { device: after, kind, level, previous, actor });
      return after;
    };

    const unsupportedAt = (placeId) => {
      const u = sim.world.control?.unsupportedCommandTypes;
      if (Array.isArray(u)) return u;
      if (u && typeof u === 'object') return u[placeId] ?? u['*'] ?? [];
      return [];
    };

    sim.on('get-apx-v1-devices', (ctx) => {
      const places = ctx.query.list('place');
      for (const id of places) {
        if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, id)) fail('insufficient-grant', `Place ${id} is not in the token's apx_places grant.`);
      }
      const state = ctx.query.get('deviceState');
      const rows = devices()
        .find((d) => {
          if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, d.id)) return false;
          if (places.length && !places.some((p) => ctx.hierarchy.within(d.id, p))) return false;
          if (state && d.deviceState !== state) return false;
          return true;
        })
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(deviceStatus);
      return paginate(ctx, rows);
    });

    sim.on('get-apx-v1-devices-id', (ctx) => {
      const d = devices().get(ctx.params.id);
      if (!d) fail('target-not-found', `No SupplementalEquipment ${ctx.params.id} visible to this credential.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, d.id)) {
        fail('insufficient-grant', `SupplementalEquipment ${d.id} is at place ${d._place}, outside the token's apx_places grant.`);
      }
      return deviceStatus(d);
    });

    // ---- lane inquiry ----

    const similarPlate = (a, b) => {
      const norm = (p) => String(p).replace(/[^A-Z0-9]/gi, '').toUpperCase().replace(/5/g, 'S').replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
      return norm(a) === norm(b);
    };

    const candidatesFor = (ctx, lane, { plate, phone, credential }) => {
      const placeId = lane._place;
      const open = sessions().find((s) => !s.actualEnd && !s._boundExit && (s._place === placeId || (s._place && ctx.hierarchy.within(s._place, placeId))));
      const out = [];
      const push = (s, matchedBy, evidence, confidence) => {
        if (out.some((c) => c.session.id === s.id)) return;
        out.push({
          session: refOf(s.id, 'Session'),
          ...(s._ticketNumber && !s._lostTicket ? { ticketNumber: s._ticketNumber } : {}),
          ...(s.actualStart ? { entryTime: s.actualStart } : {}),
          ...(s._entryLane ? { entryLane: refOf(s._entryLane, 'VehicularAccess') } : {}),
          ...(s._plate && matchedBy === 'plateRead' ? { plate: s._plate } : {}),
          matchedBy,
          ...(evidence ? { evidence } : {}),
          confidence,
          amountDueIfMatched: s._amountDue ?? money(0),
          ...(s._imageLink && matchedBy === 'plateRead' ? { imageLink: s._imageLink } : {}),
        });
      };
      const creds = sim.store.collection('accessCredentials');
      if (credential) {
        for (const c of creds.find((c) => c.cardNumber === credential || c.id === credential)) {
          for (const s of open.filter((s) => s._credential === c.id || (c.holder && s._holder === c.holder))) push(s, 'credential', refOf(c.id, 'Credential'), 0.85);
        }
      }
      if (phone) {
        for (const s of open.filter((s) => s._phone === phone)) push(s, 'account', s._holder ? refOf(s._holder, 'RightHolder') : undefined, 0.8);
        for (const acct of sim.store.collection('accounts').find((a) => a._phone === phone || a.phone === phone)) {
          for (const s of open.filter((s) => s._holder === acct.id || s._account === acct.id)) push(s, 'account', refOf(acct.id, 'RightHolder'), 0.8);
        }
      }
      const readPlate = plate ?? lane.lastRead?.plate;
      if (readPlate) {
        for (const s of open.filter((s) => s._plate && (s._plate === readPlate || similarPlate(s._plate, readPlate)))) {
          push(s, 'plateRead', s._entryObservation ? refOf(s._entryObservation, 'Observation') : undefined, s._plate === readPlate ? 0.95 : 0.7);
        }
        for (const s of open.filter((s) => s._reservationPlate === readPlate)) push(s, 'reservation', s._reservation ? refOf(s._reservation, 'AssignedRight') : undefined, 0.9);
      }
      return out.sort((a, b) => b.confidence - a.confidence);
    };

    const currentTicketView = (t) => ({
      ...(t.ticketNumber ? { ticketNumber: t.ticketNumber } : {}),
      ...(t.session ? { session: t.session } : {}),
      ...(t.issuedTime ? { issuedTime: t.issuedTime } : {}),
      ...(t.amountDue ? { amountDue: t.amountDue } : {}),
      ...(t.paidInFull !== undefined ? { paidInFull: t.paidInFull } : {}),
      validations: t.validations ?? [],
      ...(t.lpr ? { lpr: t.lpr } : {}),
      ...(t.negotiatedRate ? { negotiatedRate: t.negotiatedRate } : {}),
      ...(t.negotiatedAmount ? { negotiatedAmount: t.negotiatedAmount } : {}),
      ...(t.matchedCommand ? { matchedCommand: t.matchedCommand } : {}),
    });

    sim.on('get-apx-v1-lanes-id-current', (ctx) => {
      const lane = lanes().get(ctx.params.id);
      if (!lane) fail('target-not-found', `No lane ${ctx.params.id} visible to this credential.`);
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, lane.id)) {
        fail('insufficient-grant', `VehicularAccess ${lane.id} is at place ${lane._place}, outside the token's apx_places grant.`);
      }
      const lookup = { plate: ctx.query.get('plate'), phone: ctx.query.get('phone'), credential: ctx.query.get('credential') };
      const out = { lane: refOf(lane.id, 'VehicularAccess') };
      if (lane.current) out.currentTicket = currentTicketView(lane.current);
      if (!lane.current || lookup.plate || lookup.phone || lookup.credential) out.matchCandidates = candidatesFor(ctx, lane, lookup);
      if (lane.credential) out.monthlyCredential = lane.credential;
      return out;
    });

    // ---- validation providers ----

    sim.on('get-apx-v1-validations-providers', (ctx) => {
      const placeId = ctx.query.get('place');
      if (!ctx.principal.hasGrant || !ctx.hierarchy.covers(ctx.principal.places, placeId)) {
        if (!ctx.hierarchy.has(placeId)) fail('target-not-found', `No place ${placeId} visible to this credential.`);
        fail('insufficient-grant', `Place ${placeId} is not in the token's apx_places grant.`);
      }
      return paginate(ctx, providersAt(placeId).map(wire));
    });

    // ---------- injectors: the world acting on its own ----------

    sim.injector('deviceState', ({ device, state, actor = 'device' }) => {
      if (!devices().has(device)) throw new Error(`no device ${device}`);
      if (!DEVICE_STATES.includes(state)) throw new Error(`state must be one of ${DEVICE_STATES.join(', ')}`);
      return deviceStatus(setDeviceState(device, state, actor));
    });
    sim.injector('deviceFault', ({ device, code, displayText, state = 'fault', clear = false, actor = 'device' }) => {
      if (!devices().has(device)) throw new Error(`no device ${device}`);
      if (clear) return deviceStatus(clearFault(device, actor));
      if (!code) throw new Error('deviceFault needs code (or clear: true)');
      if (!DEVICE_STATES.includes(state)) throw new Error(`state must be one of ${DEVICE_STATES.join(', ')}`);
      return deviceStatus(setFault(device, { code, displayText, state }, actor));
    });
    sim.injector('deviceConsumable', ({ device, kind, level, actor = 'device' }) => {
      if (!devices().has(device)) throw new Error(`no device ${device}`);
      if (!CONSUMABLE_KINDS.includes(kind)) throw new Error(`kind must be one of ${CONSUMABLE_KINDS.join(', ')}`);
      if (!CONSUMABLE_LEVELS.includes(level)) throw new Error(`level must be one of ${CONSUMABLE_LEVELS.join(', ')}`);
      return deviceStatus(setConsumable(device, kind, level, actor));
    });
    sim.injector('deviceMaintenance', ({ device, on = true, state, actor = 'technician' }) => {
      if (!devices().has(device)) throw new Error(`no device ${device}`);
      devices().update(device, (d) => ({ ...d, maintenanceMode: Boolean(on) }), { bump: false });
      const target = state ?? (on ? 'outOfService' : 'available');
      if (!DEVICE_STATES.includes(target)) throw new Error(`state must be one of ${DEVICE_STATES.join(', ')}`);
      return deviceStatus(setDeviceState(device, target, actor));
    });
    sim.injector('deviceHeartbeat', ({ device }) => {
      if (!devices().has(device)) throw new Error(`no device ${device}`);
      return deviceStatus(devices().update(device, (d) => ({ ...d, lastCommunication: sim.clock.now() }), { bump: false }));
    });
    sim.injector('commandOutcome', ({ command, state = 'failed', detail, confirmationLevel }) => {
      const cmd = commands().get(command);
      if (!cmd) throw new Error(`no command ${command}`);
      if (TERMINAL.has(cmd.status)) throw new Error(`command ${command} is already ${cmd.status}`);
      commands().update(command, (c) => ({ ...c, _outcome: { state, detail, confirmationLevel } }), { bump: false });
      const g = gateOf(cmd);
      const actor = g ? deviceActor(g.id) : actors().parcs;
      if (state === 'failed') transition(command, 'failed', actor, detail ?? 'device reported failure', { confirmationLevel: confirmationLevel ?? 'deviceAcknowledged' });
      else if (state === 'succeeded') complete(command, actor);
      else if (state === 'rejected') transition(command, 'rejected', actors().parcs, detail ?? 'refused by the PARCS');
      return wire(commands().get(command));
    });
    sim.injector('vehicleArrives', ({ lane, ticketNumber, session, plate, confidence = 0.95, observation, imageLink, amountDue, issuedTime, credential }) => {
      const l = lanes().get(lane);
      if (!l) throw new Error(`no lane ${lane}`);
      const now = sim.clock.now();
      let sessionRef;
      if (session) sessionRef = refOf(session, 'Session');
      else if (ticketNumber) {
        const s = sessions().first((s) => s._ticketNumber === ticketNumber);
        if (s) sessionRef = refOf(s.id, 'Session');
      }
      const known = sessionRef ? sessions().get(sessionRef.id) : null;
      const due = amountDue ?? known?._amountDue ?? money(0);
      const current =
        ticketNumber || session
          ? {
              ...(ticketNumber ? { ticketNumber } : {}),
              ...(sessionRef ? { session: sessionRef } : {}),
              issuedTime: issuedTime ?? known?.actualStart ?? now,
              amountDue: due,
              paidInFull: due.currencyValue === 0,
              validations: [],
              ...(plate ? { lpr: { plate, confidence, ...(observation ? { observation: refOf(observation, 'Observation') } : {}), ...(imageLink ? { imageLink } : {}) } } : {}),
            }
          : null;
      const next = lanes().update(lane, (x) => ({ ...x, current, lastRead: plate ? { plate, confidence, observation, time: now } : x.lastRead, ...(credential !== undefined ? { credential } : {}) }), { bump: false });
      sim.hooks.emit('lane.vehicleArrives', { lane: next, plate });
      const after = lanes().get(lane); // hook listeners (validations) may add to the ticket
      return { lane: after.id, current: after.current, lastRead: after.lastRead };
    });
    sim.injector('vehicleLeaves', ({ lane }) => {
      if (!lanes().has(lane)) throw new Error(`no lane ${lane}`);
      const next = lanes().update(lane, (x) => ({ ...x, current: null, lastRead: null }), { bump: false });
      sim.hooks.emit('lane.vehicleLeaves', { lane: next });
      return { lane: next.id };
    });
    sim.injector('laneCredential', ({ lane, credential }) => {
      if (!lanes().has(lane)) throw new Error(`no lane ${lane}`);
      const next = lanes().update(lane, (x) => ({ ...x, credential }), { bump: false });
      return { lane: next.id, credential: next.credential };
    });

    // exposed for other domains (resolution, validations, alerts)
    sim.control = { transition, setDeviceState, setFault, clearFault, setConsumable, unsupportedAt, deviceStatus, providersAt, tablesAtPlace, lanes, devices, commands, candidatesFor, TERMINAL };
  },
};

export { requireNode };
