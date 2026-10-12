/**
 * The place hierarchy and the Part 9 §9.3 grant rule.
 *
 * A world lists HierarchyElements (places, levels, spaces), lanes
 * (APDS VehicularAccess, children of a place) and devices
 * (SupplementalEquipment inventoried at a place or lane). A grant on an
 * element covers its whole subtree; the wildcard "*" covers everything.
 */
import { fail } from './problems.mjs';

export class Hierarchy {
  constructor() {
    this.nodes = new Map(); // id → { id, parentId, className, kind, name, operator, ... }
  }

  load(world) {
    this.nodes.clear();
    for (const p of world.places ?? []) {
      this.nodes.set(p.id, { kind: 'place', className: 'HierarchyElement', ...p });
    }
    for (const l of world.lanes ?? []) {
      this.nodes.set(l.id, { kind: 'lane', className: 'VehicularAccess', parentId: l.placeId, ...l });
    }
    for (const d of world.devices ?? []) {
      this.nodes.set(d.id, { kind: 'device', className: 'SupplementalEquipment', parentId: d.laneId ?? d.placeId, ...d });
    }
  }

  add(node) {
    this.nodes.set(node.id, node);
  }
  get(id) {
    return this.nodes.get(id);
  }
  has(id) {
    return this.nodes.has(id);
  }
  all(kind) {
    return [...this.nodes.values()].filter((n) => !kind || n.kind === kind);
  }

  /** Ancestors from the node up to the root, inclusive. */
  chain(id) {
    const out = [];
    let cur = this.nodes.get(id);
    let guard = 0;
    while (cur && guard++ < 64) {
      out.push(cur);
      cur = cur.parentId ? this.nodes.get(cur.parentId) : null;
    }
    return out;
  }

  /** The nearest HierarchyElement (place) that holds this node; a device's or lane's place. */
  placeOf(id) {
    const chain = this.chain(id);
    return chain.find((n) => n.kind === 'place') ?? null;
  }

  root(id) {
    const chain = this.chain(id);
    return chain.length ? chain[chain.length - 1] : null;
  }

  /** The operator organisation id for a node, inherited down the tree. */
  operatorOf(id) {
    return this.chain(id).find((n) => n.operator)?.operator ?? null;
  }

  /** Whether `id` is `ancestorId` or lies beneath it. */
  within(id, ancestorId) {
    if (ancestorId === '*') return true;
    return this.chain(id).some((n) => n.id === ancestorId);
  }

  /** Every node id in the subtree rooted at id, inclusive. */
  subtree(id) {
    if (id === '*') return [...this.nodes.keys()];
    return [...this.nodes.values()].filter((n) => this.within(n.id, id)).map((n) => n.id);
  }

  /** Whether a grant (array of ids or "*") covers a node. Unknown nodes are not covered. */
  covers(places, id) {
    if (!Array.isArray(places)) return false;
    if (places.includes('*')) return true;
    if (!this.nodes.has(id)) return false;
    return places.some((g) => this.within(id, g));
  }

  /** Whether a grant covers anything inside a subtree (for lists filtered by place). */
  intersects(places, id) {
    if (!Array.isArray(places)) return false;
    if (places.includes('*')) return true;
    return places.some((g) => this.within(id, g) || this.within(g, id));
  }
}

/**
 * Grant guard: throws 403 insufficient-grant when the principal's
 * apx_places does not cover the target. Fail-closed: no claim, no grant.
 */
export function requireGrant(hierarchy, principal, targetId, what = 'target') {
  if (!principal.hasGrant) fail('insufficient-grant', `token carries no apx_places claim; ${what} ${targetId} is outside the grant`);
  if (!hierarchy.covers(principal.places, targetId)) {
    fail('insufficient-grant', `${what} ${targetId} is outside the token's apx_places grant`);
  }
}

/** Filter a comma-separated `place` query parameter: each named element must be inside the grant. */
export function requireGrantForPlaces(hierarchy, principal, placeParam) {
  const ids = String(placeParam ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of ids) requireGrant(hierarchy, principal, id, 'place');
  return ids;
}

/** The set of granted subtree roots as the discovery document reports them. */
export function grantedRoots(principal) {
  return principal.hasGrant ? [...principal.places] : [];
}
