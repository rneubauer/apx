/**
 * In-memory resource collections with the ApxResourceCore conventions:
 * UUID ids (client-supplied when APDS convention allows, else minted),
 * `version` incremented on every state change, `recordInfo` provenance,
 * tombstones for the change feed, and the idempotency ledger.
 *
 * Records are plain JSON. Updates return new objects; nothing is mutated
 * in place, so a handler can keep the "before" state for its events.
 */
import { randomUUID, createHash } from 'node:crypto';

export const uuid = () => randomUUID();

export const hashBody = (body) => createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');

export const ref = (id, className) => ({ id, className });

export class Collection {
  constructor(name, store) {
    this.name = name;
    this.store = store;
    this.rows = new Map();
    this.changes = []; // [{ seq, id, version, time, deleted }]
  }

  has(id) {
    return this.rows.has(id);
  }
  get(id) {
    return this.rows.get(id);
  }
  all() {
    return [...this.rows.values()];
  }
  find(pred) {
    return this.all().filter(pred);
  }
  first(pred) {
    return this.all().find(pred);
  }
  size() {
    return this.rows.size;
  }

  /**
   * Insert a new record. `id` comes from the record, from `assignedId`
   * (the replay runner's X-Sim-Assign-Id), or is minted. Returns the stored
   * record. Throws { collision: true } when the id already exists.
   */
  insert(record, { assignedId, actor, version = 1, provenance = true } = {}) {
    // `assignedId` is a hint (the replay runner's X-Sim-Assign-Id): honoured
    // when free, otherwise a fresh id is minted. A client-supplied record.id
    // is a claim and collides.
    const hinted = assignedId && !this.rows.has(assignedId) ? assignedId : undefined;
    const id = record.id ?? hinted ?? uuid();
    if (this.rows.has(id)) {
      const e = new Error(`id ${id} already exists in ${this.name}`);
      e.collision = true;
      throw e;
    }
    const now = this.store.clock.now();
    const stored = { ...record, id, version: record.version ?? version };
    if (provenance && !stored.recordInfo) {
      stored.recordInfo = {
        creationTime: now,
        ...(actor?.org ? { creator: actor.org } : {}),
        ...(actor?.user ? { creationUser: actor.user } : {}),
        lastUpdate: now,
        ...(actor?.user ? { lastUpdateUser: actor.user } : {}),
      };
    }
    this.rows.set(id, stored);
    this.logChange(id, stored.version, now, false);
    this.store.changed(this.name, id);
    return stored;
  }

  /** Replace a record with the result of fn(current); bumps version unless told not to. */
  update(id, fn, { actor, bump = true } = {}) {
    const current = this.rows.get(id);
    if (!current) throw new Error(`no ${this.name} ${id}`);
    const now = this.store.clock.now();
    const next = fn(structuredClone(current));
    if (!next) return current;
    const stored = { ...next, id, version: bump ? current.version + 1 : current.version };
    if (stored.recordInfo) {
      stored.recordInfo = { ...stored.recordInfo, lastUpdate: now, ...(actor?.user ? { lastUpdateUser: actor.user } : {}) };
    }
    this.rows.set(id, stored);
    if (bump) this.logChange(id, stored.version, now, false);
    this.store.changed(this.name, id);
    return stored;
  }

  /** Store a record verbatim (seeding, god mode). */
  put(record) {
    this.rows.set(record.id, record);
    this.store.changed(this.name, record.id);
    return record;
  }

  delete(id) {
    const current = this.rows.get(id);
    if (!current) return null;
    this.rows.delete(id);
    this.logChange(id, current.version, this.store.clock.now(), true);
    this.store.changed(this.name, id);
    return current;
  }

  logChange(id, version, time, deleted) {
    this.changes.push({ seq: ++this.store.changeSeq, id, version, time, deleted });
  }

  /** Changes strictly after `seq` (the cursor), oldest first. */
  changesAfter(seq, pred = () => true) {
    return this.changes.filter((c) => c.seq > seq && pred(c));
  }

  clear() {
    this.rows.clear();
    this.changes = [];
  }
}

export class Store {
  constructor(clock) {
    this.clock = clock;
    this.collections = new Map();
    this.changeSeq = 0;
    this.idempotency = new Map();
    this.counters = new Map();
    this.listeners = new Set(); // observers of any change (the UI's live stream); none in replay
  }

  /** Observe every change: fn(collection, id), or fn(null, null) when the store is reset. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(collection, id) {
    for (const l of this.listeners) {
      try {
        l(collection, id);
      } catch (e) {
        console.error(`[sim store] change listener threw: ${e.stack ?? e}`);
      }
    }
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Collection(name, this));
    return this.collections.get(name);
  }

  /** A monotonically increasing counter per name, for ticket numbers and the like. */
  next(name, start = 1) {
    const n = this.counters.get(name) ?? start;
    this.counters.set(name, n + 1);
    return n;
  }

  // ---- idempotency (Part 4 §4.2a): key scoped to credential + operation ----

  idemKey(credential, operationId, key) {
    return `${credential}|${operationId}|${key}`;
  }
  idemGet(credential, operationId, key) {
    return this.idempotency.get(this.idemKey(credential, operationId, key));
  }
  idemPut(credential, operationId, key, entry) {
    this.idempotency.set(this.idemKey(credential, operationId, key), { ...entry, time: this.clock.now() });
  }

  reset() {
    for (const c of this.collections.values()) c.clear();
    this.changeSeq = 0;
    this.idempotency.clear();
    this.counters.clear();
    this.changed(null, null);
  }

  snapshot() {
    const out = {};
    for (const [name, c] of this.collections) out[name] = c.all();
    return out;
  }
}
