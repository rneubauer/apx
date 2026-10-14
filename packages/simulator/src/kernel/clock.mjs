/**
 * The simulated clock. Frozen by default: time moves only when a scenario,
 * the sim API, or an `X-Sim-Now` header moves it, and every timer the
 * domains schedule (command dispatch, webhook retries, reservation no-show,
 * alert expiry) fires in order as the clock passes it. `realtime` mode
 * ticks with the wall clock instead, for live demos: the clock runs from an
 * offset to wall time and an armed setTimeout fires each timer on its own.
 * The mode can switch at runtime (`setRealtime`); either way the simulated
 * instant carries over, and `set`/`advance` keep working in both modes.
 */

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parseDuration(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') throw new Error(`bad duration ${value}`);
  const m = value.match(ISO_DURATION);
  if (m) {
    const [, d, h, mi, s] = m;
    return ((Number(d ?? 0) * 24 + Number(h ?? 0)) * 60 + Number(mi ?? 0)) * 60000 + Number(s ?? 0) * 1000;
  }
  const short = value.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/);
  if (short) {
    const n = Number(short[1]);
    return { ms: n, s: n * 1000, m: n * 60000, h: n * 3600000, d: n * 86400000 }[short[2]];
  }
  throw new Error(`bad duration ${value}`);
}

export class Clock {
  constructor({ start, realtime = false } = {}) {
    this.realtime = realtime;
    this.offset = 0; // sim − wall, in realtime mode
    this.frozenMs = Date.parse(start ?? '2026-09-24T18:00:00Z');
    this.timers = [];
    this.seq = 0;
    this.listeners = new Set();
    this.timerHandle = null;
    if (realtime) this.set(start ?? new Date().toISOString());
  }

  nowMs() {
    return this.realtime ? Date.now() + this.offset : this.frozenMs;
  }
  now() {
    return new Date(this.nowMs()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  /** Precise ISO instant with milliseconds, for ordering. */
  nowPrecise() {
    return new Date(this.nowMs()).toISOString();
  }

  /** Jump to an instant (ISO string or ms). Timers at or before it fire. */
  set(instant) {
    const ms = typeof instant === 'number' ? instant : Date.parse(instant);
    if (Number.isNaN(ms)) throw new Error(`bad instant ${instant}`);
    if (this.realtime) this.offset = ms - Date.now();
    else this.frozenMs = ms;
    this.flush();
    // The jump moved every timer's wall-time distance: re-arm for the new next one.
    if (this.realtime) this.arm();
    return this.now();
  }

  /**
   * Switch between frozen and realtime, keeping the current simulated
   * instant. Going live arms the next timer; freezing pins the instant and
   * disarms. Listeners hear about it at once (the live stream sends `clock`).
   */
  setRealtime(on) {
    const next = Boolean(on);
    if (next === this.realtime) return this.now();
    const ms = this.nowMs();
    if (next) {
      this.realtime = true;
      this.offset = ms - Date.now();
    } else {
      this.disarm();
      this.realtime = false;
      this.frozenMs = ms;
    }
    this.flush();
    if (this.realtime) this.arm();
    return this.now();
  }

  /** Move the clock forward by a duration (ISO 8601, `5m`, or ms). */
  advance(duration) {
    const target = this.nowMs() + parseDuration(duration);
    return this.set(target);
  }

  /** Schedule fn at an instant (ISO/ms) or after a delay ({ delay }). */
  schedule(when, fn, label = '') {
    const at =
      typeof when === 'object' && when !== null
        ? this.nowMs() + parseDuration(when.delay)
        : typeof when === 'number'
          ? when
          : Date.parse(when);
    const timer = { id: ++this.seq, at, fn, label, cancelled: false };
    this.timers.push(timer);
    this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    if (this.realtime) this.arm();
    else if (at <= this.nowMs()) this.flush();
    return timer.id;
  }

  cancel(id) {
    const t = this.timers.find((x) => x.id === id);
    if (t) t.cancelled = true;
    this.timers = this.timers.filter((x) => x.id !== id);
  }

  pending() {
    return this.timers.map((t) => ({ id: t.id, at: new Date(t.at).toISOString(), label: t.label }));
  }

  /** Fire every due timer, in time order, each seeing the clock at its own instant. */
  flush() {
    const limit = this.nowMs();
    let guard = 0;
    while (this.timers.length && this.timers[0].at <= limit && guard++ < 10000) {
      const t = this.timers.shift();
      if (t.cancelled) continue;
      const saved = this.frozenMs;
      if (!this.realtime) this.frozenMs = t.at;
      try {
        t.fn();
      } catch (e) {
        console.error(`[sim clock] timer "${t.label}" threw: ${e.stack ?? e}`);
      } finally {
        if (!this.realtime) this.frozenMs = saved;
      }
    }
    for (const l of this.listeners) {
      try {
        l(this.now());
      } catch (e) {
        console.error(`[sim clock] listener threw: ${e.stack ?? e}`);
      }
    }
  }

  disarm() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.timerHandle = null;
  }

  arm() {
    this.disarm();
    if (!this.realtime || !this.timers.length) return;
    const delay = Math.max(0, this.timers[0].at - this.nowMs());
    this.timerHandle = setTimeout(() => {
      this.timerHandle = null;
      this.flush();
      this.arm();
    }, Math.min(delay, 2 ** 30));
    this.timerHandle.unref?.();
  }

  onTick(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Drop every timer and (optionally) jump to `start`. The mode is kept: a live clock runs on from `start`. */
  reset({ start } = {}) {
    for (const t of this.timers) t.cancelled = true;
    this.timers = [];
    this.disarm();
    if (start) this.set(start);
  }
}
