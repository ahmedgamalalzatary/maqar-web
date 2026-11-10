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

export type RequestOptions = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal };

type Config = {
  /** The API's `/v1` URL. */
  base: string;
  fetch: typeof fetch;
  store: TokenStore;
  /** The session ended (a refresh was refused). */
  onSignedOut?: () => void;
};

/** The dashboard's API client: admin sign-in, access tokens renewed once when they expire. */
export function createApi({ base, fetch, store, onSignedOut }: Config) {
  let refreshing: Promise<boolean> | undefined;

  async function send(path: string, opts: RequestOptions, token: string | undefined): Promise<Response> {
    const headers = new Headers({ accept: "application/json" });
    const form = typeof FormData !== "undefined" && opts.body instanceof FormData;
    if (opts.body !== undefined && !form) headers.set("content-type", "application/json");
    if (token) headers.set("authorization", `Bearer ${token}`);
    try {
      return await fetch(base + path, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body === undefined ? undefined : form ? (opts.body as FormData) : JSON.stringify(opts.body),
        signal: opts.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new ApiError(0, "Network request failed");
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

  /** Requests that fail together share one renewal. */
  function refreshOnce(): Promise<boolean> {
    refreshing ??= (async () => {
      const cur = store.load();
      if (!cur) return false;
      const res = await send("/auth/refresh", { method: "POST", body: { refreshToken: cur.refreshToken } }, undefined).catch(() => null);
      if (!res?.ok) return false;
      store.save(await read<AuthResponse>(res));
      return true;
    })().finally(() => {
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

  return { request, signIn, signOut, session: () => store.load() };
}

export type Api = ReturnType<typeof createApi>;
