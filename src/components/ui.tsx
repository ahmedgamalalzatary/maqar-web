"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode, type ButtonHTMLAttributes } from "react";
import { haptic } from "@/lib/store";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "ghost" | "soft" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  href?: string;
};

const variants = {
  primary: "bg-ink text-bg shadow-card",
  gold: "bg-accent text-navy shadow-card",
  ghost: "bg-transparent text-ink",
  soft: "bg-surface-2 text-ink",
  outline: "bg-surface text-ink ring-1 ring-line-2",
  danger: "bg-danger-soft text-danger",
};
const sizes = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl gap-1.5",
  md: "h-11 px-4 text-sm rounded-2xl gap-2",
  lg: "h-14 px-5 text-[15px] rounded-2xl gap-2",
};

export function Button({ variant = "primary", size = "md", full, className, href, children, onClick, ...rest }: BtnProps) {
  const cls = cx(
    "inline-flex items-center justify-center font-medium select-none transition-[transform,opacity,background-color] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100",
    variants[variant],
    sizes[size],
    full && "w-full",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} onClick={() => haptic()}>
        {children}
      </Link>
    );
  return (
    <button
      className={cls}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  className,
  onClick,
  href,
  glass,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  onClick?: () => void;
  href?: string;
  glass?: boolean;
}) {
  const cls = cx(
    "grid size-10 shrink-0 place-items-center rounded-full transition active:scale-90",
    glass ? "bg-black/30 text-white backdrop-blur-md" : "bg-surface text-ink ring-1 ring-line shadow-card",
    className,
  );
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button
      type="button"
      aria-label={label}
      className={cls}
      onClick={() => {
        haptic();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function BackButton({ glass, fallback = "/" }: { glass?: boolean; fallback?: string }) {
  const router = useRouter();
  return (
    <IconButton
      glass={glass}
      label="Back"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <ChevronLeft className="size-5 rtl:rotate-180" />
    </IconButton>
  );
}

export function PageHeader({
  title,
  subtitle,
  back = true,
  right,
  fallback,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  fallback?: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-bg/85 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur-xl">
      {back && <BackButton fallback={fallback} />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-2">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic(5);
        onClick?.();
      }}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-all duration-200 active:scale-95",
        active ? "bg-ink text-bg" : "bg-surface text-ink-2 ring-1 ring-line",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  id: string;
  className?: string;
}) {
  return (
    <div className={cx("relative flex rounded-2xl bg-surface-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => {
            haptic(5);
            onChange(o.value);
          }}
          className={cx(
            "relative z-10 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-medium transition-colors",
            value === o.value ? "text-ink" : "text-ink-2",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-card"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ title, action, href }: { title: ReactNode; action?: ReactNode; href?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between px-4">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {action && href && (
        <Link href={href} className="text-[13px] font-medium text-accent-ink">
          {action}
        </Link>
      )}
    </div>
  );
}

export function Avatar({ name, tone = "var(--gold)", size = 44 }: { name: string; tone?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: tone, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function Badge({ children, tone = "gold", className }: { children: ReactNode; tone?: "gold" | "sage" | "danger" | "success" | "ink" | "glass"; className?: string }) {
  const t = {
    gold: "bg-accent-soft text-accent-ink",
    sage: "bg-sage-soft text-sage-ink",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    ink: "bg-ink text-bg",
    glass: "bg-black/35 text-white backdrop-blur-md",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", t, className)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl bg-surface ring-1 ring-line", className)}>{children}</div>;
}

/** Bottom sheet: drag the handle (or the sheet) down to close. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] mx-auto max-w-[440px]">
          <motion.div
            className="absolute inset-0 bg-navy/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-surface shadow-float"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i: PanInfo) => {
              if (i.offset.y > 110 || i.velocity.y > 500) onClose();
            }}
          >
            <div className="cursor-grab touch-none pb-2 pt-3" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto h-1.5 w-10 rounded-full bg-line-2" />
              {title && (
                <div className="flex items-center justify-between px-5 pt-3">
                  <h3 className="text-[17px] font-semibold">{title}</h3>
                  <button aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink-2">
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
            {footer && <div className="border-t border-line px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        haptic(6);
        onChange(!on);
      }}
      className={cx(
        "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
        on ? "justify-end bg-accent" : "justify-start bg-surface-3",
      )}
    >
      <motion.span layout className="size-6 rounded-full bg-white shadow" transition={{ type: "spring", stiffness: 600, damping: 34 }} />
    </button>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-ink">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-3.5 ring-1 ring-line">
      <div className="text-[11px] text-ink-2">{label}</div>
      <div className="tabular mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
