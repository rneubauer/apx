/**
 * In-memory versioned entity store with a per-class, gapless change feed.
 * Sandbox only — real implementations bring their own persistence.
 */
import { randomUUID } from 'node:crypto';

export interface Entity {
  id: string;
  version: number;
  [key: string]: unknown;
}

export interface ChangeRecord {
  seq: number;
  type: 'upsert' | 'delete';
  id: string;
  time: string;
  /** For upserts: the change-mode payload (identity + changed fields, null = cleared). */
  changed?: Record<string, unknown>;
}

export class VersionConflictError extends Error {}
export class IdCollisionError extends Error {}
export class NotFoundError extends Error {}

export class ClassStore {
  readonly records = new Map<string, Entity>();
  readonly changes: ChangeRecord[] = [];
  private seq = 0;

  constructor(readonly className: string) {}

  private log(type: ChangeRecord['type'], id: string, changed?: Record<string, unknown>): void {
    this.seq += 1;
    this.changes.push({ seq: this.seq, type, id, time: new Date().toISOString(), changed });
  }

  create(body: Record<string, unknown>): Entity {
    const id = typeof body.id === 'string' && body.id ? body.id : randomUUID();
    if (this.records.has(id)) throw new IdCollisionError(id);
    const entity: Entity = { ...body, id, version: 1 };
    this.records.set(id, entity);
    this.log('upsert', id, { ...entity });
    return entity;
  }

  get(id: string): Entity {
    const entity = this.records.get(id);
    if (!entity) throw new NotFoundError(id);
    return entity;
  }

  /** Full replace (stock APDS PUT). */
  replace(id: string, body: Record<string, unknown>): Entity {
    const current = this.get(id);
    const entity: Entity = { ...body, id, version: current.version + 1 };
    this.records.set(id, entity);
    this.log('upsert', id, { ...entity });
    return entity;
  }

  /** APX change-mode merge: explicit null clears a field; absent = unchanged. */
  applyChange(id: string, body: Record<string, unknown>): Entity {
    const current = this.get(id);
    if (typeof body.version === 'number' && body.version !== current.version) {
      throw new VersionConflictError(`expected version ${current.version}`);
    }
    const next: Entity = { ...current, version: current.version + 1 };
    const changed: Record<string, unknown> = { id, version: next.version };
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'version') continue;
      if (value === null) {
        delete next[key];
        changed[key] = null;
      } else {
        next[key] = value;
        changed[key] = value;
      }
    }
    this.records.set(id, next);
    this.log('upsert', id, changed);
    return next;
  }

  delete(id: string): void {
    this.get(id);
    this.records.delete(id);
    this.log('delete', id);
  }

  list(): Entity[] {
    return [...this.records.values()];
  }

  /** Changes strictly after seq. */
  changesAfter(seq: number): ChangeRecord[] {
    return this.changes.filter((c) => c.seq > seq);
  }

  get lastSeq(): number {
    return this.seq;
  }
}

export class Store {
  private readonly classes = new Map<string, ClassStore>();

  for(className: string): ClassStore {
    let store = this.classes.get(className);
    if (!store) {
      store = new ClassStore(className);
      this.classes.set(className, store);
    }
    return store;
  }
}

export function encodeCursor(className: string, seq: number): string {
  return Buffer.from(JSON.stringify({ c: className, s: seq })).toString('base64url');
}

export function decodeCursor(cursor: string): { c: string; s: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed.c === 'string' && typeof parsed.s === 'number') return parsed;
    return null;
  } catch {
    return null;
  }
}
