/**
 * apx-violations (Part 19): violations with the §19.1 lifecycle, the
 * §19.3 eligibility check, the §19.10 enforcement policy (binding at
 * issue, escalation on the sim clock) and §19.11 signage.
 *
 * Collections: violations, enforcementPolicies, signage (own); reads the
 * shared assignedRights, sessions, observations, rateTables, payments.
 * Hints: `_place` (place of detection / binding, the grant check),
 * `_org`, `_esc` (escalation clock), `_paidSince`, `_reviewer`,
 * `_appealUploads`, `_refund`, `_mail`; policies keep `_history`
 * (version → snapshot) and `_seeded`.
 *
 * The helpers live in ./violations/*.mjs.
 */
import { wire } from './common.mjs';
import { registerLifecycle } from './violations/lifecycle.mjs';
import { registerEnforcement } from './violations/enforcement.mjs';
import { seedViolations, registerInjectors } from './violations/seed.mjs';

export default {
  name: 'violations',
  register(sim) {
    sim.seed((world) => seedViolations(sim, world));
    sim.view('violations', (v) => wire(v));
    registerLifecycle(sim);
    registerEnforcement(sim);
    registerInjectors(sim);
  },
};
