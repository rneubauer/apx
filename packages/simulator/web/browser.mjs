/**
 * The simulator in a browser page, for the static site: the same kernel and
 * domain modules as `apx-sim serve`, answering the UI's requests in-process.
 * Requests to root-relative paths ('/sim/…', '/v1/…') never leave the page;
 * anything else goes to the network as usual.
 */
import { Simulator } from '../src/index.mjs';

const sim = new Simulator({ world: 'default' });
globalThis.apxSim = sim; // for the curious, from the devtools console

const NO_BODY = new Set([101, 204, 205, 304]);
const isInPage = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');

function headersOf(init) {
  const out = {};
  new Headers(init ?? {}).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? null : input?.url;
  if (!isInPage(url)) return nativeFetch(input, init);
  const out = await sim.dispatch({ method: init.method ?? 'GET', path: url, headers: headersOf(init.headers), body: init.body ?? undefined, transport: 'http' });
  const headers = new Headers();
  for (const [k, v] of Object.entries(out.headers ?? {})) if (v !== undefined) headers.set(k, String(v));
  const body = NO_BODY.has(out.status) || out.body === undefined ? null : typeof out.body === 'string' ? out.body : JSON.stringify(out.body, null, 2);
  if (body !== null && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(body, { status: out.status, headers });
};

/** An EventSource whose stream is the simulator's own (GET /sim/stream), framed as text/event-stream. */
class InPageEventSource extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  #cleanup = null;

  constructor(url) {
    super();
    this.url = url;
    this.readyState = InPageEventSource.CONNECTING;
    this.onopen = this.onmessage = this.onerror = null;
    queueMicrotask(() => this.#open()); // after the caller has attached its listeners
  }

  async #open() {
    const out = await sim.dispatch({ method: 'GET', path: this.url, headers: { accept: 'text/event-stream' }, transport: 'http' });
    if (this.readyState === InPageEventSource.CLOSED) return;
    if (!out.stream) {
      this.readyState = InPageEventSource.CLOSED;
      this.#fire(new Event('error'));
      return;
    }
    this.readyState = InPageEventSource.OPEN;
    this.#fire(new Event('open'));
    let buffered = '';
    out.stream({
      write: (chunk) => {
        buffered += chunk;
        let end;
        while ((end = buffered.indexOf('\n\n')) >= 0) {
          this.#frame(buffered.slice(0, end));
          buffered = buffered.slice(end + 2);
        }
      },
      end: () => this.close(),
      onClose: (fn) => {
        this.#cleanup = fn;
      },
    });
  }

  #frame(frame) {
    let type = 'message';
    let id = '';
    const data = [];
    for (const line of frame.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') type = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
    }
    if (data.length && this.readyState === InPageEventSource.OPEN) this.#fire(new MessageEvent(type, { data: data.join('\n'), lastEventId: id }));
  }

  #fire(event) {
    this.dispatchEvent(event);
    const handler = this[`on${event.type}`];
    if (typeof handler === 'function') handler.call(this, event);
  }

  close() {
    if (this.readyState === InPageEventSource.CLOSED) return;
    this.readyState = InPageEventSource.CLOSED;
    this.#cleanup?.();
  }
}

const NativeEventSource = globalThis.EventSource;
function EventSourceShim(url, options) {
  return isInPage(String(url)) || !NativeEventSource ? new InPageEventSource(String(url)) : new NativeEventSource(url, options);
}
Object.assign(EventSourceShim, { CONNECTING: 0, OPEN: 1, CLOSED: 2 });
globalThis.EventSource = EventSourceShim;
