import { describe, expect, it, vi } from "vitest";
import type { AuthResponse } from "@mqr/shared";
import { createApi, type TokenStore } from "@/lib/api";

const auth = (n: number, role: "admin" | "client" = "admin"): AuthResponse => ({
  user: { id: 1, role, name: "Admin", email: "admin@mqr.app" } as unknown as AuthResponse["user"],
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresIn: 900,
});
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

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
const sent = (fetch: ReturnType<typeof vi.fn>, call = 0) => {
  const [url, init] = fetch.mock.calls[call] as unknown as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined, auth: new Headers(init.headers).get("authorization") };
};

// Phase 31 (2026-11-15): an admin changes their password, or sets a forgotten one with an emailed code.
describe("passwords on the dashboard", () => {
  it("changing it keeps this tab signed in with the new session", async () => {
    const fetch = vi.fn(async () => json(200, auth(2)));
    const store = memoryStore(auth(1));
    const api = createApi({ base: "/v1", fetch, store });
    await api.changePassword("Secret123", "Newpass456");
    expect(sent(fetch)).toEqual({ url: "/v1/me/password", method: "PUT", body: { currentPassword: "Secret123", newPassword: "Newpass456" }, auth: "Bearer access-1" });
    expect(store.saved?.refreshToken).toBe("refresh-2");
  });

  it("a wrong current password is refused without ending the session", async () => {
    const fetch = vi.fn(async () => json(403, { statusCode: 403, message: "Wrong current password" }));
    const store = memoryStore(auth(1));
    const api = createApi({ base: "/v1", fetch, store });
    await expect(api.changePassword("Wrong1234", "Newpass456")).rejects.toMatchObject({ status: 403 });
    expect(store.saved?.refreshToken).toBe("refresh-1");
  });

  it("asks for a code without a session", async () => {
    const fetch = vi.fn(async () => json(204));
    const api = createApi({ base: "/v1", fetch, store: memoryStore() });
    await api.forgotPassword("admin@mqr.app");
    expect(sent(fetch)).toEqual({ url: "/v1/auth/forgot-password", method: "POST", body: { email: "admin@mqr.app" }, auth: null });
  });

  it("the code and a new password sign an admin in", async () => {
    const fetch = vi.fn(async () => json(200, auth(3)));
    const store = memoryStore();
    const api = createApi({ base: "/v1", fetch, store });
    await api.resetPassword("admin@mqr.app", "123456", "Fresh4567");
    expect(sent(fetch).body).toEqual({ email: "admin@mqr.app", code: "123456", newPassword: "Fresh4567" });
    expect(store.saved?.accessToken).toBe("access-3");
  });

  it("a client who resets here gets the new password but is not signed into the dashboard", async () => {
    const fetch = vi.fn(async () => json(200, auth(4, "client")));
    const store = memoryStore();
    const api = createApi({ base: "/v1", fetch, store });
    await expect(api.resetPassword("c@test.mqr", "123456", "Fresh4567")).rejects.toMatchObject({ status: 403 });
    expect(store.saved).toBeUndefined();
    expect(sent(fetch, 1)).toMatchObject({ url: "/v1/auth/sign-out", body: { refreshToken: "refresh-4" } });
  });
});
