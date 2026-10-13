/**
 * The decorations a Violation carries from other systems, and the two
 * issuance gates they drive (Part 19 §19.4 rules 5 and 6):
 *
 * - `apds-ext:apx:violation-source@1.0` (§19.13): the import key.
 * - `apds-ext:apx:match-evidence@1.0` (Part 5 §5.8): how `relatedSession`
 *   was linked. Lenient or unapplied evidence, here or in the related
 *   Session's `session-detail` `matches[]` entry for this Violation, may
 *   excuse a stay but never accuse one.
 * - The `apds-ext:apx:lpr-read@1.0` decoration of each read in
 *   `observations[]`: a plate review `pending` or `rejected` blocks issue.
 */
import { fail } from '../../kernel/problems.mjs';

export const SOURCE_KEY = 'apds-ext:apx:violation-source@1.0';
export const MATCH_KEY = 'apds-ext:apx:match-evidence@1.0';
const SESSION_DETAIL_KEY = 'apds-ext:apx:session-detail@1.0';
const READ_KEY = 'apds-ext:apx:lpr-read@1.0';
const BLOCKING_REVIEW = new Set(['pending', 'rejected']);

export const sourceOf = (v) => v?.extensions?.[SOURCE_KEY] ?? null;
export const matchEvidenceOf = (v) => v?.extensions?.[MATCH_KEY] ?? null;

const accuses = (ev) => Boolean(ev) && (ev.plate?.method === 'lenient' || ev.applied === false);
const why = (ev) => (ev.applied === false ? 'an unapplied (shadow) match' : 'a lenient plate match');

/** The related Session's own evidence for this Violation (`session-detail` `matches[]`), if any. */
function sessionSideEvidence(sim, v) {
  const s = v.relatedSession?.id ? sim.store.collection('sessions').get(v.relatedSession.id) : null;
  const matches = s?.extensions?.[SESSION_DETAIL_KEY]?.matches ?? [];
  return matches.find((m) => m?.target?.id === v.id) ?? null;
}

/** §19.4 rule 5, then rule 6: refuse `issue` with 409 violation-not-issuable. Any detection mode. */
export function checkIssuanceEvidence(sim, v) {
  const rule5 = ' may excuse a stay but never accuse one (Part 19 §19.4 rule 5).';
  const own = matchEvidenceOf(v);
  if (accuses(own)) {
    const sessionId = own.target?.id ?? v.relatedSession?.id;
    fail('violation-not-issuable', `The link to session ${sessionId} rests on ${why(own)}; lenient or unapplied evidence${rule5}`);
  }
  const theirs = sessionSideEvidence(sim, v);
  if (accuses(theirs)) {
    fail('violation-not-issuable', `Session ${v.relatedSession.id} records its match to this violation as ${why(theirs)} (session-detail matches[]); lenient or unapplied evidence${rule5}`);
  }
  const observations = sim.store.collection('observations');
  for (const ref of v.observations ?? []) {
    const state = observations.get(ref.id)?.extensions?.[READ_KEY]?.review?.state;
    if (BLOCKING_REVIEW.has(state)) {
      const what = state === 'pending' ? 'its plate review is not done' : 'a reviewer rejected it as plate evidence';
      fail('violation-not-issuable', `LPR read ${ref.id} has review state ${state}: ${what} (Part 19 §19.4 rule 6; Part 13 §13.3a(4a)).`);
    }
  }
}
