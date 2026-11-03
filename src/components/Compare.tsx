"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Scale, X } from "lucide-react";
import { useStore, haptic, pushNotify } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useProperties } from "@/lib/logic";
import { cx } from "./ui";

export function CompareButton({ id, glass = true, className }: { id: string; glass?: boolean; className?: string }) {
  const on = useStore((s) => s.compare.includes(id));
  const toggle = useStore((s) => s.toggleCompare);
  const t = useT();
  return (
    <button
      aria-label={t("قارن", "Compare")}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic(10);
        const r = toggle(id);
        const n = useStore.getState().compare.length;
        if (r === "removed") return;
        pushNotify(
          n === 2 ? t("جاهزين للمقارنة", "Ready to compare") : t("اتضافت للمقارنة", "Added to compare"),
          n === 2
            ? r === "replaced"
              ? t("استبدلنا أقدم وحدة. دوس هنا عشان تقارن.", "We swapped out the oldest one. Tap to compare.")
              : t("دوس هنا عشان تشوفهم جنب بعض.", "Tap to see them side by side.")
            : t("اختار وحدة تانية عشان تقارن.", "Pick one more home to compare."),
          n === 2 ? "/compare" : undefined,
          "sage",
        );
      }}
      className={cx(
        "grid size-10 place-items-center rounded-full transition active:scale-90",
        on ? "bg-accent text-navy" : glass ? "bg-black/25 text-white backdrop-blur-md" : "bg-surface text-ink ring-1 ring-line shadow-card",
        className,
      )}
    >
      <Scale className="size-[18px]" />
    </button>
  );
}

/** Floating bar above the tab bar while homes are picked for comparison. */
export function CompareTray() {
  const ids = useStore((s) => s.compare);
  const set = useStore((s) => s.set);
  const all = useProperties();
  const path = usePathname();
  const t = useT();
  const picked = ids.map((id) => all.find((p) => p.id === id)).filter(Boolean) as typeof all;
  const show = picked.length > 0 && path !== "/compare";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed inset-x-0 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[440px] px-4"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-ink p-2 text-bg shadow-float">
            <div className="flex -space-x-3 rtl:space-x-reverse ps-1">
              {picked.map((p) => (
                <span key={p.id} className="relative size-10 overflow-hidden rounded-xl ring-2 ring-ink">
                  <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
                </span>
              ))}
              {picked.length < 2 && <span className="grid size-10 place-items-center rounded-xl border-2 border-dashed border-bg/30 text-[18px] text-bg/50">+</span>}
            </div>
            <div className="min-w-0 flex-1 px-1 text-[12.5px] leading-tight">
              <div className="font-semibold">{picked.length === 2 ? t("وحدتين جاهزين", "2 homes picked") : t("اختار وحدة كمان", "Pick one more")}</div>
              <div className="opacity-60">{t("للمقارنة جنب بعض", "to compare side by side")}</div>
            </div>
            <Link href="/compare" className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-navy active:scale-95">
              <Scale className="size-4" /> {t("قارن", "Compare")}
            </Link>
            <button aria-label={t("مسح", "Clear")} onClick={() => set({ compare: [] })} className="grid size-9 place-items-center rounded-full text-bg/60 active:bg-white/10">
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
