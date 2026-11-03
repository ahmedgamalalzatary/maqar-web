/* The chosen MAQAR lock-up (Kufic مقر + square mark + tagline), split into
   colour layers so the cream parts turn navy on light backgrounds. */

const RATIO = 269 / 349;

function Layer({ src, color }: { src: string; color: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    />
  );
}

export function Logo({
  width = 120,
  tagline = true,
  onDark = false,
}: {
  width?: number;
  tagline?: boolean;
  onDark?: boolean;
}) {
  const h = width * RATIO;
  return (
    <span
      role="img"
      aria-label="مقر MAQAR — لكل طموح مقر"
      className="relative inline-block shrink-0"
      style={{ width, height: tagline ? h : h * 0.79, overflow: "hidden" }}
    >
      <span className="absolute inset-x-0 top-0" style={{ height: h }}>
        <Layer src="/brand/logo-gold.png" color="var(--gold)" />
        <Layer src="/brand/logo-cream.png" color={onDark ? "var(--cream)" : "var(--logo-cream)"} />
        <Layer src="/brand/logo-sage.png" color="var(--sage)" />
      </span>
    </span>
  );
}

/** The square mark on its own, drawn as vectors. */
export function Mark({ size = 28, cream = "currentColor" }: { size?: number; cream?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 152 156" aria-hidden>
      <g fill={cream}>
        <rect x="3" y="12" width="108" height="17" />
        <rect x="3" y="12" width="17" height="144" />
        <rect x="3" y="138" width="141" height="18" />
        <rect x="127" y="44" width="17" height="112" />
        <rect x="33" y="44" width="84" height="17" />
        <rect x="33" y="44" width="16" height="80" />
        <rect x="101" y="44" width="16" height="80" />
      </g>
      <rect x="117" y="0" width="35" height="36" fill="var(--sage)" />
    </svg>
  );
}
