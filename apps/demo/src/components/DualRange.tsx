"use client";

import { useMemo } from "react";
import { cx } from "./ui";

/**
 * Two-thumb range slider. Optional `samples` draws a small histogram above the
 * track, with the bars inside the selected range highlighted.
 */
export function DualRange({
  min,
  max,
  step,
  value,
  onChange,
  samples,
  label,
}: {
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  samples?: number[];
  label: string;
}) {
  const [lo, hi] = value;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const bars = useMemo(() => {
    if (!samples?.length) return null;
    const n = 28;
    const counts = Array.from({ length: n }, () => 0);
    for (const s of samples) {
      const i = Math.min(n - 1, Math.max(0, Math.floor(((s - min) / (max - min)) * n)));
      counts[i]++;
    }
    const top = Math.max(...counts, 1);
    return counts.map((c, i) => ({ h: c ? 18 + (c / top) * 82 : 6, from: min + ((max - min) * i) / n, to: min + ((max - min) * (i + 1)) / n }));
  }, [samples, min, max]);

  return (
    <div className="pt-1">
      {bars && (
        <div className="flex h-12 items-end gap-[3px] px-[13px]" aria-hidden>
          {bars.map((b, i) => (
            <span
              key={i}
              className={cx("flex-1 rounded-t-[3px] transition-colors duration-200", b.to > lo && b.from < hi ? "bg-accent" : "bg-surface-3")}
              style={{ height: `${b.h}%` }}
            />
          ))}
        </div>
      )}
      <div className="relative h-8">
        <div className="absolute inset-x-[13px] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3">
          <div className="absolute inset-y-0 rounded-full bg-accent" style={{ insetInlineStart: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        </div>
        <input
          type="range"
          aria-label={`${label} min`}
          className="range-dual"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi - step), hi])}
          style={{ zIndex: lo > max - step * 2 ? 5 : 3 }}
        />
        <input
          type="range"
          aria-label={`${label} max`}
          className="range-dual"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + step)])}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}
