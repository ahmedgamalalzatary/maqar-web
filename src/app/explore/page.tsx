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
import { RangeInput } from "@/components/Onboarding";

type Sort = "match" | "low" | "high" | "new";
type Quick = "tour" | "ready" | "plan" | "drop";

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
  const [beds, setBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [quick, setQuick] = useState<Quick[]>([]);
  const [sort, setSort] = useState<Sort>("match");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sp.get("focus")) inputRef.current?.focus();
  }, [sp]);

  const priceMax = cat === "rent" ? 200_000 : cat === "stay" ? 15_000 : 30_000_000;
  const priceStep = cat === "rent" ? 5_000 : cat === "stay" ? 500 : 500_000;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all
      .filter((p) => cat === "all" || p.cat === cat)
      .filter((p) => !areas.length || areas.includes(p.areaId))
      .filter((p) => !types.length || types.includes(p.type))
      .filter((p) => !finish.length || finish.includes(p.finishing))
      .filter((p) => features.every((f) => p.features.includes(f)))
      .filter((p) => !beds || p.beds >= beds)
      .filter((p) => !maxPrice || cat === "all" || p.price <= maxPrice)
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
  }, [all, cat, areas, types, finish, features, beds, maxPrice, quick, q, sort, prefs]);

  const filterCount = areas.length + types.length + finish.length + features.length + (beds ? 1 : 0) + (maxPrice ? 1 : 0);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const clearAll = () => {
    setAreas([]);
    setTypes([]);
    setFinish([]);
    setFeatures([]);
    setBeds(0);
    setMaxPrice(0);
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
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            {t("الكل", "All")}
          </Chip>
          {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
            <Chip key={c} active={cat === c} onClick={() => { setCat(c); setMaxPrice(0); }}>
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
        <FilterGroup title={t("المنطقة", "Area")}>
          {AREAS.map((a) => (
            <Chip key={a.id} active={areas.includes(a.id)} onClick={() => setAreas((v) => toggle(v, a.id))}>
              {t(a.name)}
            </Chip>
          ))}
        </FilterGroup>
        {cat !== "all" && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-[14px] font-semibold">{t("أقصى سعر", "Max price")}</h4>
              <span className="tabular text-[14px] font-semibold text-accent-ink">{maxPrice ? fmtMoney(maxPrice, lang) : t("أي سعر", "Any")}</span>
            </div>
            <RangeInput min={0} max={priceMax} step={priceStep} value={maxPrice || priceMax} onChange={(v) => setMaxPrice(v >= priceMax ? 0 : v)} className="mt-2" />
          </div>
        )}
        <FilterGroup title={t("نوع الوحدة", "Unit type")}>
          {(Object.keys(TYPE_LABEL) as PropType[]).map((k) => (
            <Chip key={k} active={types.includes(k)} onClick={() => setTypes((v) => toggle(v, k))}>
              {t(TYPE_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("الغرف", "Bedrooms")}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} active={beds === n} onClick={() => setBeds(n)} className="min-w-12 justify-center">
              {n === 0 ? t("أي", "Any") : `+${fmtNum(n, lang)}`}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("التشطيب", "Finishing")}>
          {(Object.keys(FINISH_LABEL) as Finishing[]).map((k) => (
            <Chip key={k} active={finish.includes(k)} onClick={() => setFinish((v) => toggle(v, k))}>
              {t(FINISH_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup title={t("المميزات", "Amenities")}>
          {(Object.keys(FEATURE_LABEL) as Feature[]).map((k) => (
            <Chip key={k} active={features.includes(k)} onClick={() => setFeatures((v) => toggle(v, k))}>
              {t(FEATURE_LABEL[k])}
            </Chip>
          ))}
        </FilterGroup>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-2">
      <h4 className="mb-3 text-[14px] font-semibold">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
