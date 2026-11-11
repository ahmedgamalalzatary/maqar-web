/**
 * What the guest was doing when asked to sign in (book, save, follow, chat). Kept aside until the
 * account exists, then run once where the guest left off. A prompt closed without signing in
 * clears it, and taking it clears it, so it can never replay later.
 */
let pending: (() => void) | null = null;

export function setPendingAction(action: (() => void) | null): void {
  pending = action;
}

export function takePendingAction(): (() => void) | null {
  const action = pending;
  pending = null;
  return action;
}
