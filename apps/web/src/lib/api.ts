import type { ApiErrorBody, AuthResponse } from "@maqar/shared";

/** An HTTP error from the API. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Where the session is kept between visits (the browser's localStorage in the app). */
export type TokenStore = { load: () => AuthResponse | null; save: (auth: AuthResponse | null) => void };

export type RequestOptions = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal; timeoutMs?: number };

/** The application deadline for every request, so nothing waits on a stalled connection. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** One signal for the caller's cancel and the deadline, whichever lands first. */
function boundedSignal(opts: RequestOptions): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const controller = new AbortController();
  let callerAborted = false;
  let timedOutFlag = false;
  const onCallerAbort = () => {
    callerAborted = true;
    controller.abort();
  };
  if (opts.signal) {
    if (opts.signal.aborted) onCallerAbort();
    else opts.signal.addEventListener("abort", onCallerAbort);
  }
  const timer = setTimeout(() => {
    timedOutFlag = true;
    controller.abort();
  }, opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    timedOut: () => timedOutFlag && !callerAborted,
    done: () => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onCallerAbort);
    },
  };
}

type Config = {
  /** The API's `/v1` URL. */
  base: string;
  fetch: typeof fetch;
  store: TokenStore;
  /** The session ended (a refresh was refused). */
  onSignedOut?: () => void;
  /** Serializes token renewal across tabs (navigator.locks in the app). */
  refreshLock?: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Sends a form and reports how much of it went (XMLHttpRequest in the app; fetch has no upload progress). */
  upload?: UploadTransport;
};

/** Posts a form to `url` with these headers, calling `onProgress` with the fraction sent. */
export type UploadTransport = (url: string, form: FormData, headers: Headers, onProgress?: (sent: number) => void) => Promise<Response>;

/** Uploads wait this long: a listing video can take minutes to send and to convert. */
export const UPLOAD_TIMEOUT_MS = 15 * 60_000;

/** The browser's upload with progress. Network failures and the deadline become status-0 errors. */
export const xhrUpload: UploadTransport = (url, form, headers, onProgress) =>
  new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", url);
    headers.forEach((v, k) => x.setRequestHeader(k, v));
    x.timeout = UPLOAD_TIMEOUT_MS;
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    x.onload = () => resolve(new Response(x.responseText || null, { status: x.status, statusText: x.statusText }));
    x.onerror = () => reject(new ApiError(0, "Network request failed"));
    x.ontimeout = () => reject(new ApiError(0, "Request timed out"));
    x.send(form);
  });

/** Renewing one at a time; without lock support (tests) this is just the function itself. */
const withLock = (lock: Config["refreshLock"] | undefined): NonNullable<Config["refreshLock"]> =>
  lock ?? ((fn) => fn());

/** The dashboard's API client: admin sign-in, access tokens renewed once when they expire. */
export function createApi({ base, fetch, store, onSignedOut, refreshLock, upload: transport = xhrUpload }: Config) {
  let refreshing: Promise<boolean> | undefined;
  const lock = withLock(refreshLock);

  async function send(path: string, opts: RequestOptions, token: string | undefined): Promise<Response> {
    const headers = new Headers({ accept: "application/json" });
    const form = typeof FormData !== "undefined" && opts.body instanceof FormData;
    if (opts.body !== undefined && !form) headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    const bound = boundedSignal(opts);
    try {
      return await fetch(base + path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
        signal: bound.signal,
      });
    } catch (e) {
      if (bound.timedOut()) throw new ApiError(0, "Request timed out");
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ApiError(0, "Network request failed");
    } finally {
      bound.done();
    }
  }

  async function read<T>(res: Response): Promise<T> {
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    if (!res.ok) {
      const m = (data as ApiErrorBody | undefined)?.message;
      throw new ApiError(res.status, (Array.isArray(m) ? m[0] : m) ?? res.statusText ?? "Request failed");
    }
    return data as T;
  }

  function end() {
    store.save(null);
    onSignedOut?.();
  }

  /**
   * Requests that fail together share one renewal, and tabs renew one at a time: inside the lock
   * the store is read again, so a tab whose token another tab already rotated uses the fresh one
   * instead of replaying a used refresh token (which would revoke every session of the account).
   * False only when the server refused the token; network failures and server errors propagate.
   */
  function refreshOnce(): Promise<boolean> {
    const captured = store.load();
    refreshing ??= lock(async () => {
      const cur = store.load();
      if (!cur) return false;
      // Another tab renewed while we waited for the lock: its fresh tokens are ours to use.
      if (captured && cur.refreshToken !== captured.refreshToken) return true;
      const res = await send("/auth/refresh", { method: "POST", body: { refreshToken: cur.refreshToken } }, undefined);
      if (res.status === 401 || res.status === 403) {
        // Another tab may have renewed with this token already; then its result is ours to use.
        return store.load()?.refreshToken !== cur.refreshToken;
      }
      store.save(await read<AuthResponse>(res));
      return true;
    }).finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const sentWith = store.load()?.accessToken;
    let res = await send(path, opts, sentWith);
    if (res.status === 401 && sentWith) {
      const now = store.load()?.accessToken;
      if (now && now !== sentWith) res = await send(path, opts, now);
      else if (await refreshOnce()) res = await send(path, opts, store.load()?.accessToken);
      else end();
    }
    return read<T>(res);
  }

  /** A form posted with progress (listing videos), renewing an expired token once like `request`. */
  async function upload<T>(path: string, form: FormData, onProgress?: (sent: number) => void): Promise<T> {
    const go = (token: string | undefined) => {
      const headers = new Headers({ accept: "application/json" });
      if (token) headers.set("authorization", `Bearer ${token}`);
      return transport(base + path, form, headers, onProgress);
    };
    const sentWith = store.load()?.accessToken;
    let res = await go(sentWith);
    if (res.status === 401 && sentWith) {
      const now = store.load()?.accessToken;
      if (now && now !== sentWith) res = await go(now);
      else if (await refreshOnce()) res = await go(store.load()?.accessToken);
      else end();
    }
    return read<T>(res);
  }

  /** Only admins use the dashboard: any other account is signed out again at once. */
  async function signIn(email: string, password: string): Promise<AuthResponse> {
    const auth = await read<AuthResponse>(await send("/auth/sign-in", { method: "POST", body: { email, password } }, undefined));
    if (auth.user.role !== "admin") {
      await send("/auth/sign-out", { method: "POST", body: { refreshToken: auth.refreshToken } }, undefined).catch(() => undefined);
      throw new ApiError(403, "This dashboard is for the Maqar team");
    }
    store.save(auth);
    return auth;
  }

  async function signOut(): Promise<void> {
    const cur = store.load();
    store.save(null);
    if (cur) await send("/auth/sign-out", { method: "POST", body: { refreshToken: cur.refreshToken } }, undefined).catch(() => undefined);
  }

  return { request, upload, signIn, signOut, session: () => store.load() };
}

export type Api = ReturnType<typeof createApi>;
