import { describe, expect, it, vi } from "vitest";
import type { AuthResponse } from "@maqar/shared";
import { ApiError, createApi, type TokenStore } from "@/lib/api";

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
});
