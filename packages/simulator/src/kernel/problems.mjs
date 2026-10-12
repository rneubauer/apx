/**
 * The Part 12 problem-type registry, read from the standard itself so the
 * simulator can never answer with a type the written standard lacks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APX_DIR, PROBLEM_BASE } from './spec.mjs';

const ERRORS = readFileSync(join(APX_DIR, 'docs', 'standard', '12-errors.md'), 'utf8');

export const PROBLEMS = new Map(
  [...ERRORS.matchAll(/^\| `([a-z0-9-]+)` \| (\d{3}) \| (.*?) \|$/gm)].map((m) => [m[1], { status: Number(m[2]), when: m[3] }])
);

const TITLES = {
  'insufficient-scope': 'Insufficient scope',
  'insufficient-grant': 'Insufficient grant',
  'target-not-found': 'Target not found',
  'invalid-request': 'Invalid request',
  unauthenticated: 'Unauthenticated',
  'rate-limited': 'Rate limited',
};

function titleOf(slug) {
  if (TITLES[slug]) return TITLES[slug];
  return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Thrown by handlers; rendered by the kernel. */
export class ProblemError extends Error {
  constructor(slug, detail, extra = {}, headers = {}) {
    super(detail ?? slug);
    const entry = PROBLEMS.get(slug);
    if (!entry) throw new Error(`simulator bug: problem type "${slug}" is not registered in Part 12`);
    this.slug = slug;
    this.status = extra.status ?? entry.status;
    this.detail = detail;
    this.extra = extra;
    this.headers = headers;
  }
  toProblem(instance) {
    const { status: _s, ...members } = this.extra;
    return {
      type: PROBLEM_BASE + this.slug,
      title: titleOf(this.slug),
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      ...(instance ? { instance } : {}),
      ...members,
    };
  }
}

export const fail = (slug, detail, extra, headers) => {
  throw new ProblemError(slug, detail, extra, headers);
};

export const problemStatus = (slug) => PROBLEMS.get(slug)?.status;
