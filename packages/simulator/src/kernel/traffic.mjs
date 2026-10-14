/**
 * The traffic generator, POST /sim/traffic: a background source of world
 * activity, so the delivery fabric has something to deliver while a
 * presenter talks. While it runs and the clock is Live, it fires a mix of
 * world events into whatever world is loaded, through the same injectors
 * a scenario uses, at about `ratePerMinute` ticks a minute (jittered, so the
 * stream looks like traffic rather than a metronome):
 *
 *   vehicles   a plate read at an entry lane and the place's count up one,
 *              or, for a car already parked, a read at an exit lane and the
 *              count down one (plateRead + occupancy)
 *   devices    a lane device faults, and on a later tick recovers
 *              (deviceState; the alerts module raises and clears the alert)
 *   occupancy  a counted occupancy drift at a place with supply (occupancy)
 *   payments   a parked ticket pays at the pay station (the accounts module)
 *
 * A kind the world cannot play (no lanes, no devices, no accounts module)
 * is skipped. A frozen clock pauses the generator without stopping it, so
 * Frozen | Live in the header is the presenter's pause button. The ticks
 * run on wall-clock timers that never hold the process open; `tick()` fires
 * one at once, for tests.
 *
 *   GET  /sim/traffic                                    the generator's status
 *   POST /sim/traffic {running?, ratePerMinute?, mix?}   start, stop, retune
 */
import { notifyLive } from './live.mjs';

export const DEFAULT_RATE = 60;
export const MIN_RATE = 1;
export const MAX_RATE = 600;
export const KINDS = ['vehicles', 'devices', 'occupancy', 'payments'];
export const DEFAULT_MIX = { vehicles: 4, devices: 1, occupancy: 2, payments: 2 };

const JITTER = 0.5; // each gap is the mean gap × (1 ± JITTER)
const MAX_PARKED = 40; // cars the generator remembers as parked
const EXIT_SHARE = 0.45; // chance a vehicles tick is an exit, once cars are parked
const OCCUPANCY_STEP = 6; // largest drift of one occupancy tick
const START_SHARE = 0.4; // an unknown count starts at this share of supply
const FAULT_STATES = ['fault', 'fault', 'outOfService'];
const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const FEES = [4, 6, 8.5, 12, 15, 18, 22.5];

const GENERATORS = new WeakMap();

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const plate = () => `${1 + Math.floor(Math.random() * 9)}${pick(PLATE_LETTERS)}${pick(PLATE_LETTERS)}${pick(PLATE_LETTERS)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

class TrafficGenerator {
  constructor(sim) {
    this.sim = sim;
    this.running = false;
    this.ratePerMinute = DEFAULT_RATE;
    this.mix = { ...DEFAULT_MIX };
    this.timer = null;
    this.inTick = false;
    this.forget();
    // Counts what each tick publishes, cascades included (an alert raised by a fault).
    sim.events.onEvent(() => {
      if (this.inTick) this.published += 1;
    });
  }

  /** Counters and the cars and faults the generator is tracking; dropped with the world they belong to. */
  forget() {
    this.world = this.sim.world;
    this.parked = [];
    this.faulted = [];
    this.ticks = 0;
    this.published = 0;
    this.byKind = Object.fromEntries(KINDS.map((k) => [k, 0]));
    this.errors = 0;
    this.lastError = null;
  }

  // ---- control ----

  configure({ running, ratePerMinute, mix } = {}) {
    const rate = ratePerMinute === undefined ? this.ratePerMinute : clampRate(ratePerMinute);
    const nextMix = mix === undefined ? this.mix : normaliseMix(mix); // both validated before either applies
    this.ratePerMinute = rate;
    this.mix = nextMix;
    if (running === true && !this.running) this.start();
    else if (running === false && this.running) this.stop();
    else if (this.running) this.schedule(); // a new rate takes effect now, not after the old gap
    notifyLive(this.sim, 'traffic');
    return this.status();
  }

  start() {
    if (this.world !== this.sim.world) this.forget();
    this.running = true;
    this.startedAt = new Date().toISOString();
    this.schedule();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = null;
  }

  schedule() {
    clearTimeout(this.timer);
    const mean = 60_000 / this.ratePerMinute;
    const gap = mean * (1 - JITTER + Math.random() * 2 * JITTER);
    this.timer = setTimeout(() => {
      if (this.sim.clock.realtime) this.tick();
      if (this.running) this.schedule();
    }, gap);
    this.timer.unref?.();
  }

  // ---- one tick ----

  /** Fire one world event of a kind drawn from the mix; returns {kind, published} (kind null when the world offers none). */
  tick() {
    if (this.world !== this.sim.world) {
      // A world was (re)loaded under us, by a reset or a scenario: stop rather than mix into its story.
      this.forget();
      this.stop();
      notifyLive(this.sim, 'traffic');
      return { kind: null, published: 0 };
    }
    const kind = this.draw();
    if (!kind) return { kind: null, published: 0 };
    const before = this.published;
    this.inTick = true;
    try {
      PLAY[kind](this);
      this.byKind[kind] += 1;
    } catch (e) {
      this.errors += 1;
      this.lastError = { kind, message: e.message, at: this.sim.clock.now() };
    } finally {
      this.inTick = false;
    }
    this.ticks += 1;
    return { kind, published: this.published - before };
  }

  draw() {
    const can = this.available();
    const weighted = can.flatMap((k) => Array(Math.max(0, Math.round(this.mix[k] ?? 0))).fill(k));
    return weighted.length ? pick(weighted) : null;
  }

  /** The kinds the loaded world can play. */
  available() {
    const { sim } = this;
    const inject = (k) => sim.injectors.has(k);
    const lanes = this.lanes();
    return KINDS.filter((k) => {
      if (k === 'vehicles') return inject('plateRead') && lanes.some((l) => l.accessType === 'entry');
      if (k === 'devices') return inject('deviceState') && this.devices().length > 0;
      if (k === 'occupancy') return inject('occupancy') && this.places().length > 0;
      return Boolean(sim.accounts?.takePayment) && (this.parked.length > 0 || lanes.length > 0);
    });
  }

  lanes() {
    return this.sim.control?.lanes?.().all() ?? [];
  }

  devices() {
    return this.sim.control?.devices?.().all() ?? [];
  }

  /** Places with a supply the occupancy module models. */
  places() {
    const coll = this.sim.store.collection('places');
    return this.sim.hierarchy.all().filter((n) => n.kind === 'place' && n.supplyQuantity > 0 && coll.has(n.id));
  }

  inject(kind, args) {
    return this.sim.injectors.get(kind)(args, this.sim);
  }

  // ---- the kinds ----

  vehicles() {
    const lanes = this.lanes();
    const exits = lanes.filter((l) => l.accessType === 'exit');
    const leaving = this.parked.length > 0 && exits.length > 0 && (Math.random() < EXIT_SHARE || this.parked.length >= MAX_PARKED);
    if (leaving) return this.exit(exits);
    const lane = pick(lanes.filter((l) => l.accessType === 'entry'));
    const car = { plate: plate(), place: lane._place, ticket: `T-${String(this.sim.store.next('trafficTicket', 5001))}`, paid: false };
    this.inject('plateRead', { lane: lane.id, plate: car.plate, accessEvent: 'entry', movement: 'toward' });
    this.parked.push(car);
    this.nudge(car.place, 1);
  }

  exit(exits) {
    const car = this.parked.shift();
    const lane = exits.find((l) => l._place === car.place) ?? pick(exits);
    this.inject('plateRead', { lane: lane.id, plate: car.plate, accessEvent: 'exit', movement: 'away' });
    this.nudge(car.place, -1);
  }

  /** One fault at a time: recover the last one, else break a working device. */
  toggleDevice() {
    const broken = this.faulted.shift();
    if (broken) return this.inject('deviceState', { device: broken, state: 'available', actor: 'field technician' });
    const working = this.devices().filter((d) => d.deviceState === 'available');
    if (!working.length) return null;
    const device = pick(working);
    this.inject('deviceState', { device: device.id, state: pick(FAULT_STATES), actor: 'device self-test' });
    this.faulted.push(device.id);
    return null;
  }

  drift() {
    const place = pick(this.places());
    this.nudge(place.id, Math.round((Math.random() * 2 - 0.8) * OCCUPANCY_STEP), true);
  }

  /** Move a place's counted occupancy by delta, inside 0..supply. `force` publishes even when delta is 0. */
  nudge(placeId, delta, force = false) {
    const node = this.sim.hierarchy.get(placeId);
    if (!node?.supplyQuantity || !this.sim.injectors.has('occupancy') || !this.sim.store.collection('places').has(placeId)) return;
    if (!delta && !force) return;
    const now = this.sim.data?.occupancy?.(placeId)?.demand?.count ?? Math.round(node.supplyQuantity * START_SHARE);
    const count = Math.max(0, Math.min(node.supplyQuantity, now + delta));
    this.inject('occupancy', { place: placeId, count });
  }

  pay() {
    const unpaid = this.parked.filter((c) => !c.paid);
    const car = unpaid.length ? pick(unpaid) : null;
    const place = car?.place ?? this.lanes()[0]?._place;
    if (!place) return;
    const amount = { currencyValue: pick(FEES), currencyType: this.sim.world.currency ?? 'USD' };
    this.sim.accounts.takePayment({ place, ticketNumber: car?.ticket ?? `T-${this.sim.store.next('trafficTicket', 5001)}`, amount, meansOfPayment: 'creditCard', channel: 'payStation' }, { actor: { user: 'traffic' } });
    if (car) car.paid = true;
  }

  status() {
    return {
      running: this.running,
      live: Boolean(this.sim.clock.realtime),
      ratePerMinute: this.ratePerMinute,
      mix: { ...this.mix },
      available: this.available(),
      ticks: this.ticks,
      published: this.published,
      byKind: { ...this.byKind },
      parked: this.parked.length,
      errors: this.errors,
      lastError: this.lastError,
      startedAt: this.running ? this.startedAt : null,
    };
  }
}

/** What one tick of each kind does. */
const PLAY = {
  vehicles: (g) => g.vehicles(),
  devices: (g) => g.toggleDevice(),
  occupancy: (g) => g.drift(),
  payments: (g) => g.pay(),
};

function clampRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('ratePerMinute must be a number');
  return Math.max(MIN_RATE, Math.min(MAX_RATE, Math.round(n)));
}

function normaliseMix(mix) {
  if (!mix || typeof mix !== 'object' || Array.isArray(mix)) throw new Error(`mix must be an object of weights over ${KINDS.join(', ')}`);
  const unknown = Object.keys(mix).find((k) => !KINDS.includes(k));
  if (unknown) throw new Error(`mix: unknown kind "${unknown}"; known: ${KINDS.join(', ')}`);
  const out = { ...DEFAULT_MIX, ...mix };
  for (const k of KINDS) {
    const w = Number(out[k]);
    if (!Number.isFinite(w) || w < 0) throw new Error(`mix.${k} must be a weight of 0 or more`);
    out[k] = w;
  }
  return out;
}

export function trafficOf(sim) {
  if (!GENERATORS.has(sim)) GENERATORS.set(sim, new TrafficGenerator(sim));
  return GENERATORS.get(sim);
}

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body });

/** GET|POST /sim/traffic. */
export function trafficApi(sim, { method, body }) {
  const gen = trafficOf(sim);
  if (method === 'GET') return json(200, gen.status());
  if (method !== 'POST') return json(400, { error: 'bad_request', detail: 'GET or POST' });
  if (body.running !== undefined && typeof body.running !== 'boolean') return json(400, { error: 'bad_request', detail: 'running must be true or false' });
  try {
    return json(200, gen.configure(body));
  } catch (e) {
    return json(400, { error: 'bad_request', detail: e.message });
  }
}
