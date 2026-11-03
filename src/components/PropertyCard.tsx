"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { BedDouble, Bath, Maximize2, Heart, Rotate3d, TrendingDown, MapPin, Sparkles } from "lucide-react";
import { areaById, CAT_LABEL, type Property } from "@/lib/data";
import { useStore, haptic } from "@/lib/store";
import { fmtMoney, fmtNum, fmtPct, useLang, useT } from "@/lib/i18n";
import { installment } from "@/lib/logic";
import { Badge, cx } from "./ui";

export function priceSuffix(p: Property, t: ReturnType<typeof useT>) {
  return p.cat === "rent" ? t("/ شهر", "/ mo") : p.cat === "stay" ? t("/ ليلة", "/ night") : "";
}

export function dropPct(p: Property) {
  return p.oldPrice ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
}

export function FavButton({ id, className, glass = true }: { id: string; className?: string; glass?: boolean }) {
  const on = useStore((s) => s.favorites.includes(id));
  const toggle = useStore((s) => s.toggleFavorite);
  return (
    <button
      aria-label="Save"
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic(on ? 5 : 14);
        toggle(id);
      }}
      className={cx(
        "grid size-10 place-items-center rounded-full transition active:scale-90",
        glass ? "bg-black/25 text-white backdrop-blur-md" : "bg-surface text-ink ring-1 ring-line shadow-card",
        className,
      )}
    >
      <motion.span key={String(on)} initial={{ scale: on ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 14 }}>
        <Heart className={cx("size-[19px]", on && "fill-[#e0574b] text-[#e0574b]")} strokeWidth={2} />
      </motion.span>
    </button>
  );
}

export function PropertyCard({
  p,
  match,
  wide,
  priority,
}: {
  p: Property;
  match?: number;
  wide?: boolean;
  priority?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const area = areaById(p.areaId);
  const drop = dropPct(p);
  const plan = p.plan ? installment(p.price, p.plan.downPct, p.plan.years) : null;

  return (
    <Link
      href={`/property/${p.id}`}
      onClick={() => haptic(5)}
      className={cx("group block shrink-0 transition-transform duration-200 active:scale-[0.98]", wide ? "w-full" : "w-[78%]")}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[26px] bg-surface-2">
        <Image
          src={p.images[0]}
          alt={t(p.title)}
          fill
          priority={priority}
          sizes="(max-width: 440px) 90vw, 400px"
          className="object-cover transition-transform duration-700 group-active:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {match !== undefined && (
              <Badge tone="glass">
                <Sparkles className="size-3 text-gold" /> {t(`تطابق ${fmtNum(match, "ar")}٪`, `${match}% match`)}
              </Badge>
            )}
            {drop > 0 && (
              <Badge className="bg-[#e0574b] text-white">
                <TrendingDown className="size-3" /> {fmtPct(-drop, lang)}
              </Badge>
            )}
          </div>
          <FavButton id={p.id} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-white">
          <div className="flex gap-1.5">
            <Badge tone="glass">{t(CAT_LABEL[p.cat])}</Badge>
            {p.tour && (
              <Badge tone="glass">
                <Rotate3d className="size-3" /> 360°
              </Badge>
            )}
          </div>
          {p.delivery !== "ready" && <Badge tone="glass">{t(`استلام ${fmtNum(p.delivery, "ar", { useGrouping: false })}`, `Delivery ${p.delivery}`)}</Badge>}
        </div>
      </div>
      <div className="px-1 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="tabular text-[17px] font-semibold">
            {fmtMoney(p.price, lang, p.cat === "sale" || p.cat === "project")}
            <span className="text-[12px] font-normal text-ink-3"> {priceSuffix(p, t)}</span>
          </div>
          {p.oldPrice && <div className="tabular text-xs text-ink-3 line-through">{fmtMoney(p.oldPrice, lang)}</div>}
        </div>
        <div className="mt-0.5 truncate text-[14px] font-medium text-ink">{t(p.title)}</div>
        <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {t(p.compound)} · {t(area.name)}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[12px] text-ink-2">
          <Spec icon={BedDouble} v={fmtNum(p.beds, lang)} />
          <Spec icon={Bath} v={fmtNum(p.baths, lang)} />
          <Spec icon={Maximize2} v={`${fmtNum(p.size, lang)} ${t("م²", "m²")}`} />
          {plan && (
            <span className="ms-auto rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage-ink">
              {t(`${fmtMoney(plan.pay, lang)}/شهر`, `${fmtMoney(plan.pay, lang)}/mo`)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Spec({ icon: Icon, v }: { icon: typeof BedDouble; v: string }) {
  return (
    <span className="tabular inline-flex items-center gap-1">
      <Icon className="size-3.5 text-ink-3" /> {v}
    </span>
  );
}

export function PropertyRow({ p, right, sub }: { p: Property; right?: React.ReactNode; sub?: React.ReactNode }) {
  const t = useT();
  const lang = useLang();
  return (
    <Link href={`/property/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-2.5 ring-1 ring-line transition active:scale-[0.98]">
      <span className="relative size-[76px] shrink-0 overflow-hidden rounded-2xl">
        <Image src={p.images[0]} alt="" fill sizes="76px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{t(p.title)}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-2">
          {t(p.compound)} · {t(areaById(p.areaId).name)}
        </span>
        <span className="tabular mt-1 block text-[14px] font-semibold">
          {fmtMoney(p.price, lang)} <span className="text-[11px] font-normal text-ink-3">{priceSuffix(p, t)}</span>
        </span>
        {sub}
      </span>
      {right}
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <div className="w-full">
      <div className="shimmer aspect-[4/3] rounded-[26px]" />
      <div className="shimmer mt-3 h-4 w-1/3 rounded" />
      <div className="shimmer mt-2 h-3 w-2/3 rounded" />
    </div>
  );
}

export function AnimatedList({ children }: { children: React.ReactNode }) {
  return <AnimatePresence mode="popLayout">{children}</AnimatePresence>;
}
