/**
 * TOY token issuer and verifier — SANDBOX ONLY, loudly non-production.
 * Real deployments use their own OAuth2 IdP (APX Part 9).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const SANDBOX_SECRET = 'apx-sandbox-not-a-real-secret';

export interface SandboxClient {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  org: { id: string; className: 'Organisation' };
  /** HierarchyElement UUID grants (subtree-inclusive). Absent = all places. */
  places?: string[];
}

export interface Principal {
  clientId: string;
  scopes: string[];
  org: { id: string; className: 'Organisation' };
  places?: string[];
}

export function issueToken(client: SandboxClient): string {
  const payload = Buffer.from(
    JSON.stringify({
      clientId: client.clientId,
      scopes: client.scopes,
      org: client.org,
      places: client.places,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64url');
  const signature = createHmac('sha256', SANDBOX_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyToken(token: string): Principal | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', SANDBOX_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return {
      clientId: parsed.clientId,
      scopes: parsed.scopes ?? [],
      org: parsed.org,
      places: parsed.places,
    };
  } catch {
    return null;
  }
}

export function problem(
  reply: FastifyReply,
  status: number,
  slug: string,
  title: string,
  detail?: string
): FastifyReply {
  return reply
    .status(status)
    .header('content-type', 'application/problem+json')
    .send({ type: `https://apx-standard.org/problems/${slug}`, title, status, detail });
}

export function getPrincipal(request: FastifyRequest): Principal | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}

/** Scope gate. Returns the principal or sends a problem and returns null. */
export function requireScope(
  request: FastifyRequest,
  reply: FastifyReply,
  scope: string
): Principal | null {
  const principal = getPrincipal(request);
  if (!principal) {
    problem(reply, 401, 'unauthenticated', 'Missing or invalid bearer token');
    return null;
  }
  if (!principal.scopes.includes(scope)) {
    problem(reply, 403, 'insufficient-scope', `Requires scope ${scope}`);
    return null;
  }
  return principal;
}

/** Place-grant gate (subtree membership is resolved by the caller). */
export function grantCoversPlace(principal: Principal, placeIds: string[]): boolean {
  if (!principal.places) return true;
  return placeIds.some((id) => principal.places?.includes(id));
}
