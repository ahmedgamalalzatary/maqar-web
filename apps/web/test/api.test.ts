import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResponse } from "@maqar/shared";
import { ApiError, createApi, REQUEST_TIMEOUT_MS, type TokenStore } from "@/lib/api";

const auth = (n: number, role: "admin" | "client" = "admin"): AuthResponse => ({
  user: { id: 1, role, name: "Admin", email: "admin@maqar.app", phone: null, lang: "ar", theme: "system", pushEnabled: false, prefs: null } as unknown as AuthResponse["user"],
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresIn: 900,
});
const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function memoryStore(start?: AuthResponse): TokenStore & { saved?: AuthResponse } {
  const s: TokenStore & { saved?: AuthResponse } = {
    saved: start,
    load: () => s.saved ?? null,
    save: (a) => {
      s.saved = a ?? undefined;
    },
  };
  return s;
}

describe("the dashboard's API client", () => {
  it("signs in an admin and sends the access token", async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => (String(url).endsWith("/auth/sign-in") ? json(200, auth(1)) : json(200, { ok: true })));
    const store = memoryStore();
    const api = createApi({ base: "https://api.test/v1", fetch, store });
    await api.signIn("admin@maqar.app", "secret");
    expect(store.saved?.accessToken).toBe("access-1");
    await api.request("/admin/listings");
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v1/admin/listings");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer access-1");
  });

  it("refuses an account that is not an admin, and keeps nothing", async () => {
    const fetch = vi.fn(async () => json(200, auth(1, "client")));
    const store = memoryStore();
    const api = createApi({ base: "/v1", fetch, store });
    await expect(api.signIn("c@test", "x")).rejects.toMatchObject({ status: 403 });
    expect(store.saved).toBeUndefined();
  });

  it("renews an expired access token once and retries; two requests share one renewal", async () => {
    let refreshes = 0;
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/auth/refresh")) {
        refreshes += 1;
        return json(200, auth(2));
      }
      const token = new Headers(init?.headers).get("authorization");
      return token === "Bearer access-2" ? json(200, { ok: true }) : json(401, { statusCode: 401, message: "Unauthorized" });
    });
    const store = memoryStore(auth(1));
    const api = createApi({ base: "/v1", fetch, store });
    await expect(Promise.all([api.request("/a"), api.request("/b")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(store.saved?.refreshToken).toBe("refresh-2");
  });

  it("signs out when the session cannot be renewed", async () => {
    const fetch = vi.fn(async () => json(401, { statusCode: 401, message: "Unauthorized" }));
    const store = memoryStore(auth(1));
    const onSignedOut = vi.fn();
    const api = createApi({ base: "/v1", fetch, store, onSignedOut });
    await expect(api.request("/a")).rejects.toMatchObject({ status: 401 });
    expect(store.saved).toBeUndefined();
    expect(onSignedOut).toHaveBeenCalled();
  });

  it("keeps the session when the refresh request cannot reach the server", async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/auth/refresh")) throw new TypeError("Failed to fetch");
      return json(401, { statusCode: 401, message: "Unauthorized" });
    });
    const store = memoryStore(auth(1));
    const onSignedOut = vi.fn();
    const api = createApi({ base: "/v1", fetch, store, onSignedOut });
    await expect(api.request("/a")).rejects.toMatchObject({ status: 0 });
    expect(store.saved?.refreshToken).toBe("refresh-1");
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("keeps the session when the refresh request fails with a server error", async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith("/auth/refresh") ? json(503, { statusCode: 503, message: "Unavailable" }) : json(401, { statusCode: 401, message: "Unauthorized" }),
    );
    const store = memoryStore(auth(1));
    const onSignedOut = vi.fn();
    const api = createApi({ base: "/v1", fetch, store, onSignedOut });
    await expect(api.request("/a")).rejects.toMatchObject({ status: 503 });
    expect(store.saved?.refreshToken).toBe("refresh-1");
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("renews across two tabs without replaying the same refresh token", async () => {
    // One "browser": the tabs share localStorage; a tab's save becomes the other tab's load.
    const shared: { session: string | null } = { session: null };
    const saved: AuthResponse[] = [];
    const makeStore = (): TokenStore => ({
      load: () => (shared.session ? (JSON.parse(shared.session) as AuthResponse) : null),
      save: (a) => {
        shared.session = a ? JSON.stringify(a) : null;
        if (a) saved.push(a);
      },
    });
    // Each refresh token works exactly once; a replay is refused.
    const rotations = new Map<string, AuthResponse>([["refresh-1", auth(2)]]);
    const refreshCalls: string[] = [];
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/auth/sign-in")) return json(200, auth(1));
      if (String(url).endsWith("/auth/refresh")) {
        const token = (JSON.parse(String(init?.body)) as { refreshToken: string }).refreshToken;
        refreshCalls.push(token);
        const next = rotations.get(token);
        return next ? json(200, next) : json(401, { statusCode: 401, message: "Replay" });
      }
      const token = new Headers(init?.headers).get("authorization");
      // The access token both tabs start with is expired; only the renewed one works.
      return token === "Bearer access-2" ? json(200, { ok: true }) : json(401, { statusCode: 401, message: "Unauthorized" });
    });
    // A tab-level mutex standing in for navigator.locks.
    let chain: Promise<unknown> = Promise.resolve();
    const refreshLock = <T>(fn: () => Promise<T>): Promise<T> => {
      const run = chain.then(fn, fn);
      chain = run.catch(() => undefined);
      return run;
    };
    const tabA = createApi({ base: "/v1", fetch, store: makeStore(), refreshLock });
    const tabB = createApi({ base: "/v1", fetch, store: makeStore(), refreshLock });
    await tabA.signIn("admin@maqar.app", "secret");
    // Tab B sees the session tab A saved (as through a storage event).
    await expect(Promise.all([tabA.request("/a"), tabB.request("/b")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    // Only tab A renewed; tab B found tab A's fresh token in the shared store and never
    // submitted the same rotating token twice.
    expect(refreshCalls).toEqual(["refresh-1"]);
  });

  it("sends JSON bodies as JSON and forms as they are, and reads the server's message", async () => {
    const fetch = vi.fn(async () => json(400, { statusCode: 400, message: ["price must not be less than 1"] }));
    const api = createApi({ base: "/v1", fetch, store: memoryStore(auth(1)) });
    const err = await api.request("/admin/listings", { method: "POST", body: { price: 0 } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: "price must not be less than 1" });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe('{"price":0}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");

    const form = new FormData();
    await api.request("/uploads", { method: "POST", body: form }).catch(() => undefined);
    const [, formInit] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(formInit.body).toBe(form);
    expect(new Headers(formInit.headers).get("content-type")).toBeNull();
  });

  it("is 0 when the server cannot be reached", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const api = createApi({ base: "/v1", fetch, store: memoryStore(auth(1)) });
    await expect(api.request("/a")).rejects.toMatchObject({ status: 0 });
  });

  describe("request deadline", () => {
    const fetch = vi.fn();
    beforeEach(() => fetch.mockReset());

    /**
     * A fetch that answers nothing until its signal is aborted, like a stalled connection. It
     * gives up on its own after 500ms and keeps its rejection handled. Calls without a signal
     * (vitest's runner probes the mock once more) settle at once.
     */
    const stalled = () =>
      fetch.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
        if (!init?.signal) return Promise.resolve(new Response(null, { status: 200 }));
        const p = new Promise<Response>((_resolve, reject) => {
          let done = false;
          const give = () => {
            if (done) return;
            done = true;
            reject(new DOMException("Aborted", "AbortError"));
          };
          init.signal!.addEventListener("abort", give);
          setTimeout(give, 500);
        });
        p.catch(() => undefined);
        return p;
      });

    it("rejects a request that never resolves, instead of hanging forever", async () => {
      stalled();
      const api = createApi({ base: "/v1", fetch, store: memoryStore(auth(1)) });
      await expect(api.request("/a", { timeoutMs: 20 })).rejects.toMatchObject({ name: "ApiError", status: 0, message: "Request timed out" });
    });

    it("bounds every request by default, and lets one that answers in time through", async () => {
      expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
      fetch.mockResolvedValue(json(200, { ok: true }));
      const api = createApi({ base: "/v1", fetch, store: memoryStore(auth(1)) });
      await expect(api.request("/a")).resolves.toEqual({ ok: true });
      const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("still rethrows a caller abort as an AbortError", async () => {
      stalled();
      const caller = new AbortController();
      const api = createApi({ base: "/v1", fetch, store: memoryStore(auth(1)) });
      const pending = api.request("/a", { signal: caller.signal });
      caller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    });
  });
});

describe("uploads with progress (listing videos, phase 26)", () => {
  it("sends the form with the token, reports progress, and renews an expired token once", async () => {
    let refreshes = 0;
    const fetch = vi.fn(async () => {
      refreshes += 1;
      return json(200, auth(2));
    });
    const sent: { url: string; token: string | null }[] = [];
    const upload = vi.fn(async (url: string, _form: FormData, headers: Headers, onProgress?: (f: number) => void) => {
      sent.push({ url, token: headers.get("authorization") });
      onProgress?.(0.5);
      onProgress?.(1);
      return headers.get("authorization") === "Bearer access-2" ? json(201, { url: "/uploads/videos/v.mp4" }) : json(401, { statusCode: 401, message: "Unauthorized" });
    });
    const store = memoryStore(auth(1));
    const api = createApi({ base: "/v1", fetch, store, upload });
    const progress: number[] = [];
    const form = new FormData();
    await expect(api.upload("/uploads/videos", form, (f) => progress.push(f))).resolves.toEqual({ url: "/uploads/videos/v.mp4" });
    expect(sent).toEqual([
      { url: "/v1/uploads/videos", token: "Bearer access-1" },
      { url: "/v1/uploads/videos", token: "Bearer access-2" },
    ]);
    expect(refreshes).toBe(1);
    expect(progress.at(-1)).toBe(1);
  });

  it("reads the server's refusal like any request", async () => {
    const upload = vi.fn(async () => json(400, { statusCode: 400, message: "A video can be at most 3 minutes long" }));
    const api = createApi({ base: "/v1", fetch: vi.fn(), store: memoryStore(auth(1)), upload });
    await expect(api.upload("/uploads/videos", new FormData())).rejects.toMatchObject({ status: 400, message: "A video can be at most 3 minutes long" });
  });
});
