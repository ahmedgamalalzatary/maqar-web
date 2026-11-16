import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';

export const TWEEN_MS = 320;

/** Cubic ease-out from `from` to `to`; `t` is 0 to 1 (past 1 stays at `to`). */
export function tweenAt(from: number, to: number, t: number): number {
  if (t >= 1) return to;
  const k = 1 - (1 - Math.max(0, t)) ** 3;
  return from + (to - from) * k;
}

/**
 * A number that counts to its new value instead of jumping (the calculator's payment, the
 * filter's result count; 2026-11-16). It starts on the first value, and a new value mid-count
 * carries on from where the count is. Only the component showing the number re-renders.
 */
export function useTweenedNumber(value: number, ms = TWEEN_MS): number {
  const reduced = useReduceMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (reduced || from === value) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    const step = () => {
      const next = tweenAt(from, value, (Date.now() - start) / ms);
      shownRef.current = next;
      setShown(next);
      if (next !== value) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, ms]);

  // With less motion the new value shows on this very render, not one frame later.
  return reduced ? value : shown;
}
