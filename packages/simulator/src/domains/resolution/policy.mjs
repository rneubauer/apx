/**
 * The Part 17 §17.3 policy layer: operator policy (world.resolutionPolicy,
 * merged over DEFAULT_POLICY) evaluated against the facts of one context
 * into AllowedAction[] and the `_policy` map apx-control enforces on
 * POST /v1/commands.
 *
 * The decisions are made here, server-side, never by the consuming agent.
 * Policy content (limits, thresholds, roles, reason codes) is operator
 * configuration; only the decision format is normative.
 */
import { registryValues } from '../../kernel/spec.mjs';
import { refOf } from '../common.mjs';

const COMMAND_TYPES = new Set(registryValues('apx-command-types'));

export const LINK = 'post-apx-v1-payment-links';
export const PLATE = 'put-apx-v1-sessions-id-plate';
export const LINK_RIGHT = 'put-apx-v1-sessions-id-assigned-right';

export const DEFAULT_POLICY = {
  contextTtl: 'PT1H',
  plateThreshold: 0.8,
  supportHistoryHours: 36,
  eventMode: false,
  balanceHold: { threshold: 0, approvalRole: 'supervisor', policy: 'balance-hold-vend-supervisor' },
  courtesy: { max: 2, windowHours: 48, nightFrom: '22:00', nightUntil: '06:00', approvalRole: 'supervisor' },
  rateApprovalRole: 'supervisor',
  restartApprovalRole: 'maintenance',
  paymentDeviceTypes: ['payStation', 'payTerminal', 'terminal'],
  plateApprovalRole: 'supervisor',
  offers: {
    accountBalanceDenied: [LINK, 'courtesyExit', 'vendGate'],
    passbackViolation: ['resetPassback', 'vendGate'],
    gateVendFailed: ['vendGate', 'holdGateOpen'],
    paymentDeclined: [LINK, 'vendGate'],
    validationMissing: ['applyValidation', 'vendGate'],
    rateDispute: ['pushRate', 'holdGateOpen', LINK],
    lostTicket: [LINK],
    reservationMismatch: [PLATE, LINK_RIGHT, 'vendGate'],
    plateUnresolved: [PLATE],
    equipmentFault: ['vendGate', 'restartDevice'],
    unknown: [],
  },
  rules: [],
};

const DISPLAY = {
  [LINK]: 'Send payment link',
  [PLATE]: "Correct the session's plate",
  [LINK_RIGHT]: 'Link the reservation to this session',
  courtesyExit: 'Courtesy exit',
  vendGate: 'Vend gate',
  holdGateOpen: 'Hold gate open',
  applyValidation: 'Apply merchant validation',
  pushRate: 'Push corrected rate table',
  restartDevice: 'Restart device',
  resetPassback: 'Reset anti-passback state',
};

const RECOMMEND_REASON = {
  accountBalanceDenied: 'A balance payment clears the hold immediately.',
  passbackViolation: 'Recorded presence contradicts the vehicle physically at the lane; a reset fixes the cause.',
  gateVendFailed: 'The ticket is paid in full and the gate reports available; one vend clears the lane.',
  paymentDeclined: 'A hosted link accepts another card without holding the lane.',
  validationMissing: "The ticket carries no validation; if the claimed provider is on the place's list, apply it and requote.",
  rateDispute: 'The active table does not match the schedule; correcting it reprices this ticket.',
  lostTicket: 'The entry read matched the plate; the session prices from its true entry, no lost-ticket fee.',
  reservationMismatch: 'A confirmed reservation exists for this visit; linking it settles the session.',
  plateUnresolved: 'The entry read is below the association threshold; review the candidates and confirm with the customer.',
  equipmentFault: 'Operator policy grants exit on equipment fault rather than holding the lane.',
};

/** The operator policy in force: world.resolutionPolicy over the defaults (objects merge one level deep). */
export function policyConfig(world) {
  const w = world.resolutionPolicy ?? {};
  const out = { ...DEFAULT_POLICY, ...w };
  for (const k of ['balanceHold', 'courtesy', 'offers']) out[k] = { ...DEFAULT_POLICY[k], ...(w[k] ?? {}) };
  return out;
}

const reason = (code, display, policy) => ({ code, ...(display ? { display } : {}), ...(policy ? { policy } : {}) });
const allow = () => ({ allowed: true, requiresApproval: false });
const deny = (r) => ({ allowed: false, reason: r });
const gate = (role, r) => ({ allowed: true, requiresApproval: true, approvalRole: role, reason: r });

/** "22:00".."06:00" in UTC, wrapping midnight. */
function inWindow(nowIso, from, until) {
  if (!from || !until) return false;
  const hm = nowIso.slice(11, 16);
  return from <= until ? hm >= from && hm < until : hm >= from || hm < until;
}

const laneRef = (f) => (f.lane ? refOf(f.lane.id, 'VehicularAccess') : null);

/** One decision function per action: returns null when the action is not offered for these facts. */
function decide(action, f, cfg) {
  const balanceHeld = f.account && f.balance > cfg.balanceHold.threshold;
  const settled = f.account && f.balance <= cfg.balanceHold.threshold;
  switch (action) {
    case LINK: {
      if (balanceHeld) return { target: refOf(f.account.id, 'Account'), ...allow() };
      if (f.session && f.amountDue > 0) return { target: refOf(f.session.id, 'Session'), ...allow(), display: 'Send payment link for the open session' };
      return null;
    }
    case 'courtesyExit': {
      if (!f.holder || !f.lane) return null;
      const c = cfg.courtesy;
      const target = laneRef(f);
      if (settled) return { target, ...deny(reason('balanceSettled', 'The balance has been paid; a courtesy exit is no longer the right tool.', 'courtesy-only-while-blocked')) };
      if (f.courtesyCount >= c.max) {
        return { target, ...deny(reason('courtesyLimitReached', `${f.courtesyCount} courtesy exits have already been provided within the previous ${c.windowHours} hours.`, c.policy ?? `max-${c.max}-courtesy-exits-${c.windowHours}h`)) };
      }
      if (inWindow(f.now, c.nightFrom, c.nightUntil)) {
        return { target, ...gate(c.approvalRole, reason('courtesyRequiresApproval', `Courtesy exit ${f.courtesyCount + 1} of ${c.max} in ${c.windowHours} hours; ${c.approvalRole} sign-off required after ${c.nightFrom}.`, 'courtesy-night-supervisor')) };
      }
      return { target, ...allow() };
    }
    case 'vendGate': {
      if (!f.lane) return null;
      const target = laneRef(f);
      if (f.passbackViolation) return { target, ...deny(reason('passbackUncorrected', 'A blind vend would leave the credential in violation and strand it again tomorrow.', 'correct-state-before-vend')) };
      if (f.faults.length) return { target, ...allow(), display: 'Vend gate (equipment fault)' };
      if (balanceHeld) return { target, ...gate(cfg.balanceHold.approvalRole, reason('balanceHoldVendGated', `Vending for an account on balance hold needs a ${cfg.balanceHold.approvalRole}.`, cfg.balanceHold.policy)) };
      if (settled) return { target, ...allow() };
      if (f.reservation && !f.reservationLinked) {
        if (!f.plateRead) return null;
        return { target, ...deny(reason('sessionUnsettled', 'The session is unpaid; correcting the plate links the prepaid reservation and settles it.', 'no-vend-on-unsettled-session')) };
      }
      if (f.session && f.amountDue > 0) {
        const display = f.issue === 'validationMissing' ? 'A validation adjusts the amount due; it does not waive the remainder.' : 'The session has an outstanding amount due; free vends for unpaid sessions are not permitted.';
        return { target, ...deny(reason('sessionUnpaid', display, 'no-vend-while-unpaid')) };
      }
      if (f.session && f.amountDue === 0) return { target, ...allow() };
      return null;
    }
    case 'holdGateOpen':
      if (!f.lane) return null;
      if (cfg.eventMode) return { target: laneRef(f), ...allow() };
      return { target: laneRef(f), ...deny(reason('holdOpenRestricted', 'Hold-open is reserved for supervised event-egress mode.', 'hold-open-event-mode-only')) };
    case 'applyValidation':
      if (!f.lane || !f.ticketNumber || !f.providers) return null;
      return { target: laneRef(f), ...allow() };
    case 'pushRate':
      if (!f.lane) return null;
      return { target: laneRef(f), ...gate(cfg.rateApprovalRole, reason('rateChangeRequiresApproval', `A rate-table push reprices every transaction at the target; ${cfg.rateApprovalRole} approval is required.`, 'rate-push-supervisor-approval')) };
    case 'restartDevice': {
      const d = f.faults[0];
      if (!d) return null;
      const target = refOf(d.id, 'SupplementalEquipment');
      const display = `Restart ${d.name ?? 'device'}`;
      if (cfg.paymentDeviceTypes.includes(d.equipmentType)) {
        return { target, display, ...gate(cfg.restartApprovalRole, reason('maintenanceApprovalRequired', `Remote restarts of payment devices require ${cfg.restartApprovalRole} approval.`, 'payment-device-restart-gated')) };
      }
      return { target, display, ...allow() };
    }
    case 'resetPassback':
      if (!f.passbackViolation || !f.credential) return null;
      return { target: refOf(f.credential.id, 'Credential'), ...allow() };
    case PLATE: {
      if (!f.session) return null;
      if (f.issue === 'reservationMismatch' && (f.reservationLinked || !f.plateRead)) return null;
      if (f.issue === 'plateUnresolved' && f.plateConfidence >= cfg.plateThreshold) return null;
      const target = refOf(f.session.id, 'Session');
      if (f.sessionPaid) return { target, ...gate(cfg.plateApprovalRole, reason('plateChangeAfterPayment', 'The session already has a payment posted; a plate change moves that charge and needs approval.', 'plate-change-after-payment')) };
      return { target, ...allow() };
    }
    case LINK_RIGHT:
      if (!f.session || !f.reservation || f.reservationLinked || f.plateRead) return null;
      return { target: refOf(f.session.id, 'Session'), ...allow() };
    default:
      return null;
  }
}

/** Operator rules and per-context overrides (policyRule injector) applied over a computed decision. */
function applyRule(decision, rule, action, f) {
  const base = decision ?? { target: f.lane ? laneRef(f) : f.session ? refOf(f.session.id, 'Session') : refOf(f.place.id, 'Place') };
  const out = { ...base };
  if (rule.allowed !== undefined) out.allowed = rule.allowed;
  if (rule.requiresApproval !== undefined) {
    out.requiresApproval = Boolean(rule.requiresApproval);
    if (typeof rule.requiresApproval === 'string') out.approvalRole = rule.requiresApproval;
    else if (rule.approvalRole) out.approvalRole = rule.approvalRole;
    if (!out.requiresApproval) delete out.approvalRole;
  }
  if (rule.reason) out.reason = typeof rule.reason === 'string' ? reason(rule.reason, rule.display) : rule.reason;
  if (out.allowed && !out.requiresApproval) delete out.reason;
  if ((!out.allowed || out.requiresApproval) && !out.reason) out.reason = reason('operatorRule', `Operator rule on ${action}.`);
  return out;
}

function toAllowedAction(action, d) {
  const control = COMMAND_TYPES.has(action);
  return {
    action,
    display: d.display ?? DISPLAY[action] ?? action,
    target: d.target,
    allowed: d.allowed,
    ...(d.allowed === false ? {} : { requiresApproval: Boolean(d.requiresApproval) }),
    ...(d.requiresApproval && d.approvalRole ? { approvalRole: d.approvalRole } : {}),
    execution: control ? { type: 'control', command: action } : { type: 'domain', operationId: action },
    ...(d.reason && (d.allowed === false || d.requiresApproval) ? { reason: d.reason } : {}),
  };
}

/**
 * Evaluate the policy for one context's facts. Returns { allowedActions,
 * recommendedAction, policy } where `policy` is the map apx-control reads
 * (`{ <action>: { allowed, requiresApproval: role, reason }, _default }`):
 * anything the context did not offer is not allowed.
 */
export function evaluate(f, cfg, overrides = []) {
  const offered = [...(cfg.offers[f.issue] ?? [])];
  const rules = [...(cfg.rules ?? []), ...overrides].filter((r) => (!r.issue || r.issue === f.issue) && (r.action ?? r.commandType));
  for (const r of rules) if (!offered.includes(r.action ?? r.commandType)) offered.push(r.action ?? r.commandType);
  const actions = [];
  for (const action of offered) {
    let d = decide(action, f, cfg);
    for (const r of rules.filter((x) => (x.action ?? x.commandType) === action)) d = applyRule(d, r, action, f);
    if (d && d.target) actions.push(toAllowedAction(action, d));
  }
  const policy = { _default: { allowed: false } };
  for (const a of actions) {
    policy[a.action] = { allowed: a.allowed, ...(a.requiresApproval ? { requiresApproval: a.approvalRole ?? 'supervisor' } : {}), ...(a.reason ? { reason: a.reason.code } : {}) };
  }
  const allowed = actions.filter((a) => a.allowed);
  const preferred = allowed.find((a) => !a.requiresApproval) ?? allowed[0];
  const recommendedAction = preferred ? { action: preferred.action, ...(RECOMMEND_REASON[f.issue] ? { reason: RECOMMEND_REASON[f.issue] } : {}) } : undefined;
  return { allowedActions: actions, recommendedAction, policy };
}
