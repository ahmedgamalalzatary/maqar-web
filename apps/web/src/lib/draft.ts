/**
 * A long form's recoverable draft, in the browser's localStorage. Auto-saved as the admin types,
 * restored when they come back, cleared when the form is saved for real. An empty form is not a
 * draft: nothing lingers after a save or a manual clear.
 */
const PREFIX = "maqar-draft:";

export function saveDraft(key: string, value: unknown): void {
  if (!value || typeof value !== "object" || !Object.keys(value as object).length) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the draft is a convenience, never worth breaking the form over.
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Same as above.
  }
}
