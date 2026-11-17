// Optional update notice: asks GitHub which release of this project is the
// newest and compares it with the installed version. It only tells; nothing
// is downloaded or installed (a signed CEP package can't replace itself, and
// a plugin that downloads and launches files would be a far bigger promise).
// The user installs an update by hand from the release page.
//
// One GET to a fixed address, with no cookie, token or identifier and nothing
// about the user or the project in it; a second fixed address only when the
// first refuses for its request limit (see FALLBACK_URL). The requests go
// through the browser's fetch, so the network guard (networkGuard.ts) applies;
// both hosts are in its list for this check only. Both answer with CORS
// headers, so the plugin can read the answer.

export const REPO = "ominousopera/AIVoiceMasterTool";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
// The project's package.json on its default branch. Its "version" is the
// newest release's: the version is raised in the commit that is released.
// Read only when the API refuses for its limit of 60 requests per hour per
// address, which people behind a shared address (VPN, provider NAT) reach;
// raw.githubusercontent.com is not subject to this API limit.
const FALLBACK_URL = `https://raw.githubusercontent.com/${REPO}/main/package.json`;
/** Always shows the newest release; used whenever GitHub's own link can't be. */
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const PAGE_PREFIX = `https://github.com/${REPO}/`;

/** Background checks run when the plugin opens, at most once per interval. */
export const CHECK_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
export const TIMEOUT_MS = 10_000;
// The real answer is a few kilobytes; anything far larger is not it.
const MAX_ANSWER_CHARS = 1024 * 1024;

export type Release = { version: string; url: string };

/** Why a check gave no version:
 *  - offline: the computer reports no network connection;
 *  - unreachable: the request failed without an HTTP answer;
 *  - limit: GitHub refused for its hourly limit of requests per address
 *    (403 / 429), which people behind a shared address can reach;
 *  - timeout: no answer within TIMEOUT_MS;
 *  - status: any other HTTP status than 200 (`status` holds it);
 *  - answer: the answer could not be read as a release with a version. */
export type UpdateFailure = "offline" | "unreachable" | "limit" | "timeout" | "status" | "answer";

export class UpdateCheckError extends Error {
  readonly kind: UpdateFailure;
  readonly status?: number;
  constructor(message: string, kind: UpdateFailure, status?: number) {
    super(message);
    this.name = "UpdateCheckError";
    this.kind = kind;
    this.status = status;
  }
}

/** `1.2.3` or `v1.2.3` only. A pre-release suffix or a missing part is not a
 *  version, so a test tag or a broken answer never shows as an update. */
export const parseVersion = (text: unknown): number[] | null => {
  if (typeof text !== "string") return null;
  const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** Part by part as numbers (1.10.0 is newer than 1.9.9). False when either
 *  side is not a version. */
export const isNewer = (latest: string, current: string): boolean => {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** Due with no earlier good check, once the interval has passed, or when the
 *  clock went backwards since the saved time. */
export const isDue = (lastCheckMs: unknown, now: number): boolean =>
  typeof lastCheckMs !== "number" || !Number.isFinite(lastCheckMs) || now < lastCheckMs || now - lastCheckMs >= CHECK_INTERVAL_MS;

/** GitHub's link to the release, only if it is a page of this project. */
export const releasePageFor = (htmlUrl: unknown): string =>
  typeof htmlUrl === "string" && htmlUrl.startsWith(PAGE_PREFIX) ? htmlUrl : RELEASES_URL;

const timeoutError = () => new UpdateCheckError(`no answer from GitHub within ${TIMEOUT_MS / 1000} s`, "timeout");

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

/** One GET of `url`, read as JSON. Throws UpdateCheckError when there is no
 *  usable answer. */
const getJson = async (url: string, headers: Record<string, string>, fetchImpl: FetchImpl, isOnline: () => boolean): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "GET",
        headers,
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw timeoutError();
      if (!isOnline()) throw new UpdateCheckError("no internet connection", "offline");
      throw new UpdateCheckError("GitHub could not be reached", "unreachable");
    }
    if (res.status === 403 || res.status === 429) throw new UpdateCheckError(`GitHub answered ${res.status}`, "limit", res.status);
    if (res.status !== 200) throw new UpdateCheckError(`GitHub answered ${res.status}`, "status", res.status);
    const text = await res.text();
    if (text.length > MAX_ANSWER_CHARS) throw new UpdateCheckError("the answer was too large", "answer");
    try {
      return JSON.parse(text);
    } catch {
      throw new UpdateCheckError("the answer is not JSON", "answer");
    }
  } catch (e) {
    if (e instanceof UpdateCheckError) throw e;
    if (controller.signal.aborted) throw timeoutError();
    throw new UpdateCheckError("the answer could not be read", "answer");
  } finally {
    clearTimeout(timer);
  }
};

/** Asks GitHub for the newest release (drafts and pre-releases are never
 *  returned by this address). When the API refuses for its request limit, the
 *  version comes from FALLBACK_URL and the page is the fixed releases page; if
 *  that fails too, the limit error is reported. Throws UpdateCheckError when
 *  there is no usable answer. `fetchImpl` and `isOnline` are for the dev-only
 *  check script. */
export const fetchLatestRelease = async (
  fetchImpl: FetchImpl = (input, init) => window.fetch(input, init),
  isOnline: () => boolean = () => navigator.onLine !== false,
): Promise<Release> => {
  let record: unknown;
  try {
    record = await getJson(API_URL, { Accept: "application/vnd.github+json" }, fetchImpl, isOnline);
  } catch (e) {
    if (!(e instanceof UpdateCheckError) || e.kind !== "limit") throw e;
    let pkg: unknown;
    try {
      pkg = await getJson(FALLBACK_URL, {}, fetchImpl, isOnline);
    } catch {
      throw e;
    }
    const version = pkg && typeof pkg === "object" ? (pkg as { version?: unknown }).version : undefined;
    if (typeof version !== "string" || !parseVersion(version)) throw e;
    return { version: version.trim().replace(/^v/, ""), url: RELEASES_URL };
  }
  const fields = record && typeof record === "object" ? (record as { tag_name?: unknown; html_url?: unknown }) : {};
  const tag = fields.tag_name;
  if (typeof tag !== "string" || !parseVersion(tag)) throw new UpdateCheckError("no version number in the answer", "answer");
  return { version: tag.trim().replace(/^v/, ""), url: releasePageFor(fields.html_url) };
};
