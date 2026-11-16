// Network guard for the panels' browser side: every web request API
// (fetch, XMLHttpRequest, WebSocket, EventSource, sendBeacon) may only reach
// the hosts a panel explicitly allows. Everything else is refused before a
// connection is opened.
//
// Why: the panels are meant to work without the internet. The only
// connections the product makes on purpose are the optional cloud paths of
// the AI Voice tab — ElevenLabs, OpenAI, Anthropic — and only with the user's
// own key. Bundled libraries know other addresses (Transformers.js defaults
// to downloading models from Hugging Face and its WebAssembly from a CDN;
// this code configures both to local files), and a future update of any of
// them could add one more. The guard turns "configured not to" into "cannot".
//
// Local files are unaffected: file:, blob: and data: URLs, and bare paths,
// never reach the network. Development builds also allow localhost, for
// Vite's dev server and hot reload. Node.js modules (http, https, net) are
// not covered; no code in this project uses them — release.mjs checks that.

const NETWORK_SCHEMES = new Set(["http:", "https:", "ws:", "wss:"]);

let blockedCount = 0;

/** How many requests the guard has refused since the panel started. */
export const getBlockedRequestCount = (): number => blockedCount;

const toUrl = (input: unknown): URL | null => {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as { url?: string })?.url;
    if (typeof raw !== "string") return null;
    return new URL(raw, window.location.href);
  } catch {
    return null;
  }
};

/** Installs the guard. `allowedHosts` are exact host names reachable over
 *  HTTPS/WSS; anything else that would use the network throws. */
export const installNetworkGuard = (allowedHosts: string[]): void => {
  const allowed = new Set(allowedHosts.map((h) => h.toLowerCase()));
  const isAllowed = (input: unknown): boolean => {
    const url = toUrl(input);
    // Not a URL the network stack would open (an unparseable value is left to
    // the API itself, which will reject it).
    if (!url || !NETWORK_SCHEMES.has(url.protocol)) return true;
    const host = url.hostname.toLowerCase();
    if (import.meta.env.DEV && (host === "localhost" || host === "127.0.0.1")) return true;
    return (url.protocol === "https:" || url.protocol === "wss:") && allowed.has(host);
  };
  const refuse = (input: unknown): Error => {
    blockedCount++;
    const url = toUrl(input);
    const where = url ? `${url.protocol}//${url.host}` : String(input);
    console.warn(`[network guard] blocked a request to ${where}`);
    return new TypeError(`AI Voice Master Tool does not connect to ${where}.`);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    isAllowed(input) ? originalFetch(input, init) : Promise.reject(refuse(input));

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (!isAllowed(url)) throw refuse(url);
    return (originalOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    const Guarded = function (url: string | URL, protocols?: string | string[]) {
      if (!isAllowed(url)) throw refuse(url);
      return new OriginalWebSocket(url, protocols);
    } as unknown as typeof WebSocket;
    Guarded.prototype = OriginalWebSocket.prototype;
    // Keeps static members (WebSocket.OPEN, EventSource.CLOSED, …) reachable.
    Object.setPrototypeOf(Guarded, OriginalWebSocket);
    window.WebSocket = Guarded;
  }

  const OriginalEventSource = window.EventSource;
  if (OriginalEventSource) {
    const Guarded = function (url: string | URL, init?: EventSourceInit) {
      if (!isAllowed(url)) throw refuse(url);
      return new OriginalEventSource(url, init);
    } as unknown as typeof EventSource;
    Guarded.prototype = OriginalEventSource.prototype;
    // Keeps static members (WebSocket.OPEN, EventSource.CLOSED, …) reachable.
    Object.setPrototypeOf(Guarded, OriginalEventSource);
    window.EventSource = Guarded;
  }

  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (!isAllowed(url)) {
        refuse(url);
        return false;
      }
      return originalBeacon(url, data);
    };
  }
};

/** Hosts of the AI Voice tab's optional cloud providers, used with the user's
 *  own keys (the SDKs' default endpoints). */
export const AI_PROVIDER_HOSTS = ["api.elevenlabs.io", "api.openai.com", "api.anthropic.com"];
