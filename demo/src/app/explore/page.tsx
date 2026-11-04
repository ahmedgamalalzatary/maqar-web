"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Search, SlidersHorizontal, X, Rotate3d, Sparkles, TrendingDown, KeyRound, ArrowDownUp, Check, SearchX } from "lucide-react";
import { AREAS, CAT_LABEL, FEATURE_LABEL, FINISH_LABEL, TYPE_LABEL, areaById, type Category, type Feature, type Finishing, type PropType } from "@/lib/data";
import { useStore } from "@/lib/store";
import { fmtMoney, fmtNum, useLang, useT } from "@/lib/i18n";
import { matchScore, useProperties } from "@/lib/logic";
import { PropertyCard, dropPct } from "@/components/PropertyCard";
import { Button, Chip, Empty, Sheet, cx } from "@/components/ui";
import { DualRange } from "@/components/DualRange";

type Sort = "match" | "low" | "high" | "new";
type Quick = "tour" | "ready" | "plan" | "drop";
type Delivery = "ready" | "2027" | "2028" | "2029";

const SIZE: [number, number] = [50, 500];

export default function ExplorePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const t = useT();
  const lang = useLang();
  const sp = useSearchParams();
  const prefs = useStore((s) => s.prefs);
  const all = useProperties();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">((sp.get("cat") as Category) ?? "all");
  const [areas, setAreas] = useState<string[]>(sp.get("area") ? [sp.get("area")!] : []);
  const [types, setTypes] = useState<PropType[]>([]);
  const [finish, setFinish] = useState<Finishing[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [beds, setBeds] = useState<number[]>([]);
  const [baths, setBaths] = useState<number[]>([]);
  const [delivery, setDelivery] = useState<Delivery[]>([]);
  const [price, setPrice] = useState<[number, number] | null>(null);
  const [size, setSize] = useState<[number, number] | null>(null);
  const [quick, setQuick] = useState<Quick[]>([]);
  const [sort, setSort] = useState<Sort>("match");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sp.get("focus")) inputRef.current?.focus();
  }, [sp]);

  // Price scale follows the category: monthly rent, nightly stays, or purchase price.
  const scale = cat === "rent" ? { max: 200_000, step: 5_000 } : cat === "stay" ? { max: 15_000, step: 500 } : { max: 30_000_000, step: 250_000 };
  const priceCats: Category[] = cat === "all" ? ["sale", "project"] : [cat];
  const priceSamples = all.filter((p) => priceCats.includes(p.cat)).map((p) => p.price);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all
      .filter((p) => cat === "all" || p.cat === cat)
      .filter((p) => !areas.length || areas.includes(p.areaId))
      .filter((p) => !types.length || types.includes(p.type))
      .filter((p) => !finish.length || finish.includes(p.finishing))
      .filter((p) => features.every((f) => p.features.includes(f)))
      .filter((p) => !beds.length || beds.some((b) => (b === 5 ? p.beds >= 5 : p.beds === b)))
      .filter((p) => !baths.length || baths.some((b) => (b === 4 ? p.baths >= 4 : p.baths === b)))
      .filter((p) => !delivery.length || delivery.includes(p.delivery === "ready" ? "ready" : (String(p.delivery) as Delivery)))
      .filter((p) => !price || (priceCats.includes(p.cat) && p.price >= price[0] && (price[1] >= scale.max || p.price <= price[1])))
      .filter((p) => !size || (p.size >= size[0] && (size[1] >= SIZE[1] || p.size <= size[1])))
      .filter((p) => !quick.includes("tour") || !!p.tour)
      .filter((p) => !quick.includes("ready") || p.delivery === "ready")
      .filter((p) => !quick.includes("plan") || !!p.plan)
      .filter((p) => !quick.includes("drop") || dropPct(p) > 0)
      .filter((p) => {
        if (!needle) return true;
        const a = areaById(p.areaId);
        return [p.title.ar, p.title.en, p.compound.ar, p.compound.en, a.name.ar, a.name.en, TYPE_LABEL[p.type].ar, TYPE_LABEL[p.type].en]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .map((p) => ({ p, m: matchScore(p, prefs, (id) => areaById(id).name).score }));
    const s = {
      match: (a: (typeof list)[0], b: (typeof list)[0]) => b.m - a.m,
      low: (a: (typeof list)[0], b: (typeof list)[0]) => a.p.price - b.p.price,
      high: (a: (typeof list)[0], b: (typeof list)[0]) => b.p.price - a.p.price,
      new: (a: (typeof list)[0], b: (typeof list)[0]) => a.p.listedDays - b.p.listedDays,
    }[sort];
    return list.sort(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, cat, areas, types, finish, features, beds, baths, delivery, price, size, quick, q, sort, prefs]);

  const filterCount =
    areas.length + types.length + finish.length + features.length + beds.length + baths.length + delivery.length + (price ? 1 : 0) + (size ? 1 : 0);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const clearAll = () => {
    setAreas([]);
    setTypes([]);
    setFinish([]);
    setFeatures([]);
    setBeds([]);
    setBaths([]);
    setDelivery([]);
    setPrice(null);
    setSize(null);
    setQuick([]);
  };

  const quicks: { k: Quick; icon: typeof Rotate3d; label: string }[] = [
    { k: "tour", icon: Rotate3d, label: t("جولة ٣٦٠°", "360° tour") },
    { k: "plan", icon: Sparkles, label: t("تقسيط", "Installments") },
    { k: "ready", icon: KeyRound, label: t("استلام فوري", "Ready to move") },
    { k: "drop", icon: TrendingDown, label: t("السعر نزل", "Price dropped") },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 bg-bg/90 pb-2 pt-[calc(12px+env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex gap-2 px-4">
          <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl bg-surface px-3.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
            <Search className="size-[18px] text-ink-3" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("ابحث: التجمع، شاليه، أزور باي…", "Search: New Cairo, chalet, Azure Bay…")}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
              enterKeyHint="search"
            />
            {q && (
              <button aria-label="Clear" onClick={() => setQ("")} className="grid size-6 place-items-center rounded-full bg-surface-2">
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <button
            aria-label={t("الفلاتر", "Filters")}
            onClick={() => setFiltersOpen(true)}
            className="relative grid size-12 place-items-center rounded-2xl bg-ink text-bg active:scale-95"
          >
            <SlidersHorizontal className="size-5" />
            {filterCount > 0 && (
              <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-navy">{filterCount}</span>
            )}
          </button>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          <Chip active={cat === "all"} onClick={() => { setCat("all"); setPrice(null); }}>
            {t("الكل", "All")}
          </Chip>
          {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
            <Chip key={c} active={cat === c} onClick={() => { setCat(c); setPrice(null); }}>
              {t(CAT_LABEL[c])}
            </Chip>
          ))}
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4">
          {quicks.map((x) => (
            <button
              key={x.k}
              onClick={() => setQuick((v) => toggle(v, x.k))}
              className={cx(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition active:scale-95",
                quick.includes(x.k) ? "bg-accent text-navy" : "bg-accent-soft text-accent-ink",
              )}
            >
              <x.icon className="size-3.5" /> {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <div className="text-[13px] text-ink-2">
          <span className="tabular font-semibold text-ink">{fmtNum(results.length, lang)}</span> {t("وحدة", "homes")}
          {filterCount > 0 && (
            <button onClick={clearAll} className="ms-2 text-accent-ink underline-offset-2 hover:underline">
              {t("مسح الفلاتر", "Clear filters")}
            </button>
          )}
        </div>
        <button onClick={() => setSortOpen(true)} className="flex items-center gap-1.5 text-[13px] font-medium">
          <ArrowDownUp className="size-4" />
          {{ match: t("الأنسب ليك", "Best match"), low: t("الأقل سعراً", "Lowest price"), high: t("الأعلى سعراً", "Highest price"), new: t("الأحدث", "Newest") }[sort]}
        </button>
      </div>

      {filterCount > 0 && (
        <div className="no-scrollbar -mt-1 flex gap-1.5 overflow-x-auto px-4 pb-3">
          {price && (
            <ActiveChip onRemove={() => setPrice(null)}>
              {fmtMoney(price[0], lang)} – {price[1] >= scale.max ? t("أي سعر", "any") : fmtMoney(price[1], lang)}
            </ActiveChip>
          )}
          {size && (
            <ActiveChip onRemove={() => setSize(null)}>
              {fmtNum(size[0], lang)}–{size[1] >= SIZE[1] ? "+" : fmtNum(size[1], lang)} {t("م²", "m²")}
            </ActiveChip>
          )}
          {areas.map((a) => (
            <ActiveChip key={a} onRemove={() => setAreas((v) => v.filter((x) => x !== a))}>
              {t(areaById(a).name)}
            </ActiveChip>
          ))}
          {types.map((k) => (
            <ActiveChip key={k} onRemove={() => setTypes((v) => v.filter((x) => x !== k))}>
              {t(TYPE_LABEL[k])}
            </ActiveChip>
          ))}
          {beds.map((n) => (
            <ActiveChip key={`b${n}`} onRemove={() => setBeds((v) => v.filter((x) => x !== n))}>
              {t(`${fmtNum(n, "ar")}${n === 5 ? "+" : ""} غرف`, `${n}${n === 5 ? "+" : ""} bed`)}
            </ActiveChip>
          ))}
          {baths.map((n) => (
            <ActiveChip key={`h${n}`} onRemove={() => setBaths((v) => v.filter((x) => x !== n))}>
              {t(`${fmtNum(n, "ar")}${n === 4 ? "+" : ""} حمام`, `${n}${n === 4 ? "+" : ""} bath`)}
            </ActiveChip>
          ))}
          {delivery.map((d) => (
            <ActiveChip key={d} onRemove={() => setDelivery((v) => v.filter((x) => x !== d))}>
              {d === "ready" ? t("استلام فوري", "Ready") : t(`استلام ${fmtNum(+d, "ar", { useGrouping: false })}`, `Delivery ${d}`)}
            </ActiveChip>
          ))}
          {finish.map((k) => (
            <ActiveChip key={k} onRemove={() => setFinish((v) => v.filter((x) => x !== k))}>
              {t(FINISH_LABEL[k])}
            </ActiveChip>
          ))}
          {features.map((k) => (
            <ActiveChip key={k} onRemove={() => setFeatures((v) => v.filter((x) => x !== k))}>
              {t(FEATURE_LABEL[k])}
            </ActiveChip>
          ))}
        </div>
      )}

      <div className="space-y-6 px-4">
        {results.map(({ p, m }, i) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <PropertyCard p={p} match={sort === "match" ? m : undefined} wide priority={i < 2} />
          </motion.div>
        ))}
        {results.length === 0 && (
          <Empty
            icon={<SearchX className="size-7" />}
            title={t("مفيش نتايج بالفلاتر دي", "No homes match these filters")}
            body={t("وسّع الميزانية أو شيل فلتر، أو سيبنا ننبهك أول ما توصل وحدة مناسبة.", "Widen the budget or remove a filter, or let us alert you when a match arrives.")}
            action={<Button onClick={clearAll}>{t("مسح الفلاتر", "Clear filters")}</Button>}
          />
        )}
      </div>

      {/* Sort */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title={t("ترتيب حسب", "Sort by")}>
        <div className="space-y-1 pb-4">
          {(["match", "low", "high", "new"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSort(s);
                setSortOpen(false);
              }}
              className="flex h-12 w-full items-center justify-between rounded-2xl px-3 text-[15px] active:bg-surface-2"
            >
              {{ match: t("الأنسب ليك", "Best match for you"), low: t("الأقل سعراً", "Lowest price"), high: t("الأعلى سعراً", "Highest price"), new: t("الأحدث", "Newest") }[s]}
              {sort === s && <Check className="size-5 text-accent" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Filters */}
      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("الفلاتر", "Filters")}
        footer={
          <div className="flex gap-2">
            <Button variant="soft" onClick={clearAll}>
              {t("مسح", "Reset")}
            </Button>
            <Button full onClick={() => setFiltersOpen(false)}>
              {t(`اعرض ${fmtNum(results.length, "ar")} وحدة`, `Show ${results.length} homes`)}
            </Button>
          </div>
        }
      >
        <div className="mt-2">
          <div className="flex items-baseline justify-between">
            <h4 className="text-[14px] font-semibold">
              {cat === "rent" ? t("الإيجار الشهري", "Monthly rent") : cat === "stay" ? t("سعر الليلة", "Price per night") : t("نطاق السعر", "Price range")}
            </h4>
            {cat === "all" && <span className="text-[11px] text-ink-3">{t("للبيع والمشروعات", "for sale & projects")}</span>}
          </div>
          <DualRange
            label={t("السعر", "Price")}
            min={0}
            max={scale.max}
            step={scale.step}
            value={price ?? [0, scale.max]}
            onChange={(v) => setPrice(v[0] <= 0 && v[1] >= scale.max ? null : v)}
            samples={priceSamples}
          />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <PriceBox
              label={t("من", "Min")}
              value={price?.[0] ?? 0}
              onChange={(n) => setPrice([Math.min(n, (price?.[1] ?? scale.max) - scale.step), price?.[1] ?? scale.max])}
            />
            <PriceBox
              label={t("إلى", "Max")}
              value={price?.[1] ?? scale.max}
              any={!price || price[1] >= scale.max}
              onChange={(n) => setPrice([price?.[0] ?? 0, Math.max(n, (price?.[0] ?? 0) + scale.step)])}
            />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <h4 className="text-[14px] font-semibold">{t("المساحة", "Size")}</h4>
            <span className="tabular text-[13px] font-semibold text-accent-ink">
              {fmtNum(size?.[0] ?? SIZE[0], lang)} – {size && size[1] < SIZE[1] ? fmtNum(size[1], lang) : `${fmtNum(SIZE[1], lang)}+`} {t("م²", "m²")}
            </span>
          </div>
          <DualRange
            label={t("المساحة", "Size")}
            min={SIZE[0]}
            max={SIZE[1]}
            step={10}
            value={size ?? SIZE}
            onChange={(v) => setSize(v[0] <= SIZE[0] && v[1] >= SIZE[1] ? null : v)}
            samples={all.map((p) => p.size)}
          />
        </div>

        <FilterGroup title={t("نوع الوحدة", "Unit type")} hint={t("اختار أكتر من نوع", "Pick any")}>
          {(Object.keys(TYPE_LABEL) as PropType[]).map((k) => (
            <Chip key={k} active={types.includes(k)} onClick={() => setTypes((v) => toggle(v, k))}>
              {types.includes(k) && <Check className="size-3.5" />} {t(TYPE_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("الغرف", "Bedrooms")} hint={t("اختار أكتر من رقم", "Pick any")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} active={beds.includes(n)} onClick={() => setBeds((v) => toggle(v, n))} className="min-w-12 justify-center">
              {fmtNum(n, lang)}
              {n === 5 ? "+" : ""}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("الحمامات", "Bathrooms")}>
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} active={baths.includes(n)} onClick={() => setBaths((v) => toggle(v, n))} className="min-w-12 justify-center">
              {fmtNum(n, lang)}
              {n === 4 ? "+" : ""}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("المنطقة", "Area")}>
          {AREAS.map((a) => (
            <Chip key={a.id} active={areas.includes(a.id)} onClick={() => setAreas((v) => toggle(v, a.id))}>
              {areas.includes(a.id) && <Check className="size-3.5" />} {t(a.name)}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("الاستلام", "Delivery")}>
          {(["ready", "2027", "2028", "2029"] as Delivery[]).map((d) => (
            <Chip key={d} active={delivery.includes(d)} onClick={() => setDelivery((v) => toggle(v, d))}>
              {d === "ready" ? t("فوري", "Ready now") : fmtNum(+d, lang, { useGrouping: false })}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("التشطيب", "Finishing")}>
          {(Object.keys(FINISH_LABEL) as Finishing[]).map((k) => (
            <Chip key={k} active={finish.includes(k)} onClick={() => setFinish((v) => toggle(v, k))}>
              {finish.includes(k) && <Check className="size-3.5" />} {t(FINISH_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("المميزات", "Amenities")} hint={t("لازم تكون كلها موجودة", "Must have all")}>
          {(Object.keys(FEATURE_LABEL) as Feature[]).map((k) => (
            <Chip key={k} active={features.includes(k)} onClick={() => setFeatures((v) => toggle(v, k))}>
              {features.includes(k) && <Check className="size-3.5" />} {t(FEATURE_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="text-[14px] font-semibold">{title}</h4>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ActiveChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button onClick={onRemove} className="tabular inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink pe-2 ps-3 text-[12px] font-medium text-bg active:scale-95">
      {children}
      <X className="size-3.5 opacity-70" />
    </button>
  );
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Typed price entry; accepts Arabic or Latin digits. */
function PriceBox({ label, value, onChange, any }: { label: string; value: number; onChange: (n: number) => void; any?: boolean }) {
  const lang = useLang();
  const t = useT();
  return (
    <label className="flex h-12 flex-col justify-center rounded-2xl bg-surface-2 px-3 focus-within:ring-2 focus-within:ring-accent">
      <span className="text-[10.5px] text-ink-3">{label}</span>
      <input
        inputMode="numeric"
        className="tabular w-full bg-transparent text-[14px] font-semibold outline-none"
        value={any ? t("أي سعر", "Any") : fmtNum(value, lang)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const digits = e.target.value.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/\D/g, "");
          if (digits) onChange(Number(digits));
        }}
      />
    </label>
  );
}
