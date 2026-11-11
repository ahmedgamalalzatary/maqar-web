import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";

/** The tests run in node: a small stand-in for the browser's localStorage. */
const store = new Map<string, string>();
beforeEach(() => {
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  } as Storage;
  store.clear();
});

describe("the local form draft", () => {
  it("round-trips a draft under its key", () => {
    saveDraft("listing:new", { photos: [{ key: "a" }] });
    expect(loadDraft("listing:new")).toEqual({ photos: [{ key: "a" }] });
  });

  it("returns null when there is no draft, or it cannot be read", () => {
    expect(loadDraft("listing:new")).toBeNull();
    localStorage.setItem("maqar-draft:listing:new", "{not json");
    expect(loadDraft("listing:new")).toBeNull();
  });

  it("keeps different drafts apart and clears one without the other", () => {
    saveDraft("listing:1", { a: 1 });
    saveDraft("listing:2", { b: 2 });
    clearDraft("listing:1");
    expect(loadDraft("listing:1")).toBeNull();
    expect(loadDraft("listing:2")).toEqual({ b: 2 });
  });

  it("does not save empty forms", () => {
    saveDraft("listing:new", {});
    expect(loadDraft("listing:new")).toBeNull();
  });
});
