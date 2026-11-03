"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Plus, X, Search, Crown, Check, Minus, CalendarCheck, Scale, Sparkles, ArrowLeftRight } from "lucide-react";
import { areaById, CAT_LABEL, FEATURE_LABEL, FINISH_LABEL, TYPE_LABEL, type Feature, type Property } from "@/lib/data";
import { useStore, haptic } from "@/lib/store";
import { fmtMoney, fmtNum, fmtPct, useLang, useT } from "@/lib/i18n";
import { installment, matchScore, useProperties } from "@/lib/logic";
import { priceSuffix } from "@/components/PropertyCard";
import { Badge, Button, Card, PageHeader, Sheet, cx } from "@/components/ui";

type Better = "low" | "high" | null;

export default function ComparePage() {
  const t = useT();
  const lang = useLang();
  const ids = useStore((s) => s.compare);
  const favorites = useStore((s) => s.favorites);
  const prefs = useStore((s) => s.prefs);
  const setS = useStore((s) => s.set);
  const all = useProperties();
  const [pickSlot, setPickSlot] = useState<0 | 1 | null>(null);
  const [q, setQ] = useState("");

  const slots = [0, 1].map((i) => all.find((p) => p.id === ids[i]));
  const [a, b] = slots;

  const setSlot = (i: 0 | 1, id: string | null) => {
    const next = [...ids];
    if (id) next[i] = id;
    else next.splice(i, 1);
    setS({ compare: next.filter(Boolean).slice(0, 2) });
  };

  const monthly = (p: Property) => {
    const plan = p.plan ?? { downPct: 20, years: 5 };
    return p.cat === "sale" || p.cat === "project" ? installment(p.price, plan.downPct, plan.years) : null;
  };

  const verdict = useMemo(() => {
    if (!a || !b) return [];
    const out: { who: 0 | 1; text: string }[] = [];
    const ppmA = a.price / a.size,
      ppmB = b.price / b.size;
    if (a.cat === b.cat && Math.abs(ppmA - ppmB) / Math.max(ppmA, ppmB) > 0.03) {
      const w = ppmA < ppmB ? 0 : 1;
      const pct = Math.round((Math.abs(ppmA - ppmB) / Math.max(ppmA, ppmB)) * 100);
      out.push({ who: w, text: t(`أرخص في سعر المتر بـ ${fmtPct(pct, "ar")}`, `${pct}% cheaper per m²`) });
    }
    if (a.size !== b.size) {
      const w = a.size > b.size ? 0 : 1;
      out.push({ who: w, text: t(`أكبر بـ ${fmtNum(Math.abs(a.size - b.size), "ar")} م²`, `${Math.abs(a.size - b.size)} m² bigger`) });
    }
    const ma = monthly(a),
      mb = monthly(b);
    if (ma && mb && Math.round(ma.pay) !== Math.round(mb.pay)) {
      const w = ma.pay < mb.pay ? 0 : 1;
      out.push({ who: w, text: t(`قسط شهري أقل بـ ${fmtMoney(Math.abs(ma.pay - mb.pay), "ar")}`, `${fmtMoney(Math.abs(ma.pay - mb.pay), "en")} less per month`) });
    }
    if ((a.delivery === "ready") !== (b.delivery === "ready")) out.push({ who: a.delivery === "ready" ? 0 : 1, text: t("جاهزة للسكن فوراً", "Ready to move in now") });
    const sa = matchScore(a, prefs, (id) => areaById(id).name).score,
      sb = matchScore(b, prefs, (id) => areaById(id).name).score;
    if (sa !== sb) out.push({ who: sa > sb ? 0 : 1, text: t(`أنسب لتفضيلاتك (${fmtNum(Math.max(sa, sb), "ar")}٪ تطابق)`, `Better fit for you (${Math.max(sa, sb)}% match)`) });
    return out;
  }, [a, b, prefs, t]);

  const pickList = useMemo(() => {
    const other = pickSlot === null ? undefined : slots[pickSlot === 0 ? 1 : 0];
    const needle = q.trim().toLowerCase();
    return all
      .filter((p) => p.id !== other?.id)
      .filter((p) => !needle || [p.title.ar, p.title.en, p.compound.ar, p.compound.en, areaById(p.areaId).name.ar, areaById(p.areaId).name.en].join(" ").toLowerCase().includes(needle))
      .sort((x, y) => {
        const fx = favorites.includes(x.id) ? 0 : 1,
          fy = favorites.includes(y.id) ? 0 : 1;
        if (fx !== fy) return fx - fy;
        const cx_ = other && x.cat === other.cat ? 0 : 1,
          cy = other && y.cat === other.cat ? 0 : 1;
        return cx_ - cy;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, pickSlot, q, favorites, ids]);

  const featuresUnion = a && b ? (Array.from(new Set([...a.features, ...b.features])) as Feature[]) : [];

  return (
    <div className="pb-8">
      <PageHeader title={t("قارن الوحدات", "Compare homes")} subtitle={t("جنب بعض، بالأرقام", "Side by side, in numbers")} fallback="/explore" />

      {/* Column heads */}
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {slots.map((p, i) =>
          p ? (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
              <Link href={`/property/${p.id}`} className="relative block aspect-[4/3.4]">
                <Image src={p.images[0]} alt="" fill sizes="200px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute start-2 top-2">
                  <Badge tone="glass">{i === 0 ? "A" : "B"}</Badge>
                </span>
                <span className="absolute inset-x-2.5 bottom-2 text-white">
                  <span className="tabular block text-[14px] font-semibold">{fmtMoney(p.price, lang)}</span>
                  <span className="block text-[10.5px] opacity-80">{t(CAT_LABEL[p.cat])}</span>
                </span>
              </Link>
              <div className="p-2.5">
                <div className="line-clamp-2 min-h-[2.6em] text-[12.5px] font-medium leading-snug">{t(p.title)}</div>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => setPickSlot(i as 0 | 1)} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-xl bg-surface-2 text-[11.5px] font-medium active:scale-95">
                    <ArrowLeftRight className="size-3.5" /> {t("غيّر", "Change")}
                  </button>
                  <button aria-label={t("شيل", "Remove")} onClick={() => setSlot(i as 0 | 1, null)} className="grid size-8 place-items-center rounded-xl bg-surface-2 text-ink-2 active:scale-95">
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <button
              key={`empty-${i}`}
              onClick={() => setPickSlot(i as 0 | 1)}
              className="flex aspect-[4/5.4] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-2 bg-surface text-ink-2 active:scale-[0.98]"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
                <Plus className="size-6" />
              </span>
              <span className="text-[13px] font-medium">{t("اختار وحدة", "Pick a home")}</span>
            </button>
          ),
        )}
      </div>

      {!(a && b) ? (
        <div className="mx-4 mt-5 flex items-start gap-3 rounded-3xl bg-navy p-4 text-cream ring-1 ring-white/10">
          <Scale className="mt-0.5 size-5 shrink-0 text-gold" />
          <p className="text-[13px] leading-relaxed text-cream/80">
            {t("اختار وحدتين عشان نقارنهم في السعر، سعر المتر، القسط، المساحة والمميزات، ونقولك مين الأحسن في إيه.", "Pick two homes and we’ll compare price, price per m², installment, size and amenities, and tell you which wins where.")}
          </p>
        </div>
      ) : (
        <>
          {/* Verdict */}
          {verdict.length > 0 && (
            <Card className="mx-4 mt-4 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold">
                <Sparkles className="size-4 text-accent" /> {t("الخلاصة", "The short version")}
              </div>
              <div className="space-y-2">
                {verdict.map((v, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[13px]">
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold", v.who === 0 ? "bg-accent text-navy" : "bg-sage text-white")}>{v.who === 0 ? "A" : "B"}</span>
                    {v.text}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sticky mini heads */}
          <div className="sticky top-[calc(64px+env(safe-area-inset-top))] z-20 mt-4 grid grid-cols-2 gap-2.5 bg-bg/90 px-4 py-2 backdrop-blur-xl">
            {[a, b].map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface px-2 py-1.5 ring-1 ring-line">
                <span className={cx("grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold", i === 0 ? "bg-accent text-navy" : "bg-sage text-white")}>{i === 0 ? "A" : "B"}</span>
                <span className="truncate text-[11.5px] font-medium">{t(p.compound)}</span>
              </div>
            ))}
          </div>

          <Group title={t("السعر والتكلفة", "Price & cost")}>
            <Row label={t("السعر", "Price")} better={a.cat === b.cat ? "low" : null} vals={[a.price, b.price]} fmt={(v, i) => `${fmtMoney(v, lang)} ${priceSuffix([a, b][i], t)}`} />
            <Row label={t("سعر المتر", "Price per m²")} better={a.cat === b.cat ? "low" : null} vals={[a.price / a.size, b.price / b.size]} fmt={(v) => fmtMoney(Math.round(v), lang, false)} />
            {(monthly(a) || monthly(b)) && (
              <Row
                label={t("القسط الشهري", "Monthly installment")}
                better="low"
                vals={[monthly(a)?.pay ?? NaN, monthly(b)?.pay ?? NaN]}
                fmt={(v, i) => {
                  const p = [a, b][i];
                  const plan = p.plan ?? { downPct: 20, years: 5 };
                  return Number.isNaN(v) ? "—" : `${fmtMoney(Math.round(v), lang)}\n${t(`مقدم ${fmtPct(plan.downPct, "ar")} على ${fmtNum(plan.years, "ar")} سنين`, `${plan.downPct}% down over ${plan.years}y`)}`;
                }}
              />
            )}
            <Row label={t("الصيانة", "Maintenance")} better="low" vals={[a.maintenance ?? NaN, b.maintenance ?? NaN]} fmt={(v) => (Number.isNaN(v) ? "—" : fmtPct(v, lang))} />
            {a.oldPrice || b.oldPrice ? (
              <Row label={t("نزول السعر", "Price drop")} better="high" vals={[a.oldPrice ? a.oldPrice - a.price : 0, b.oldPrice ? b.oldPrice - b.price : 0]} fmt={(v) => (v ? `-${fmtMoney(v, lang)}` : "—")} />
            ) : null}
          </Group>

          <Group title={t("المساحة والتفاصيل", "Size & details")}>
            <Row label={t("المساحة", "Size")} better="high" vals={[a.size, b.size]} fmt={(v) => `${fmtNum(v, lang)} ${t("م²", "m²")}`} />
            <Row label={t("الغرف", "Bedrooms")} better="high" vals={[a.beds, b.beds]} fmt={(v) => fmtNum(v, lang)} />
            <Row label={t("الحمامات", "Bathrooms")} better="high" vals={[a.baths, b.baths]} fmt={(v) => fmtNum(v, lang)} />
            <TextRow label={t("النوع", "Type")} vals={[t(TYPE_LABEL[a.type]), t(TYPE_LABEL[b.type])]} />
            <TextRow label={t("التشطيب", "Finishing")} vals={[t(FINISH_LABEL[a.finishing]), t(FINISH_LABEL[b.finishing])]} />
            <Row
              label={t("الاستلام", "Delivery")}
              better="low"
              vals={[a.delivery === "ready" ? 0 : a.delivery, b.delivery === "ready" ? 0 : b.delivery]}
              fmt={(v) => (v === 0 ? t("فوري", "Ready") : fmtNum(v, lang, { useGrouping: false }))}
            />
            <TextRow label={t("الدور", "Floor")} vals={[a.floor !== undefined ? fmtNum(a.floor, lang) : "—", b.floor !== undefined ? fmtNum(b.floor, lang) : "—"]} />
          </Group>

          <Group title={t("الموقع", "Location")}>
            <TextRow label={t("المنطقة", "Area")} vals={[t(areaById(a.areaId).name), t(areaById(b.areaId).name)]} />
            <TextRow label={t("الكمبوند", "Compound")} vals={[t(a.compound), t(b.compound)]} />
          </Group>

          <Group title={t("المميزات", "Amenities")}>
            {featuresUnion.map((f) => (
              <div key={f} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-4 py-2.5 last:border-0">
                <Yes on={a.features.includes(f)} />
                <span className="w-24 text-center text-[12px] text-ink-2">{t(FEATURE_LABEL[f])}</span>
                <Yes on={b.features.includes(f)} />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2.5">
              <Yes on={!!a.tour} />
              <span className="w-24 text-center text-[12px] text-ink-2">{t("جولة ٣٦٠°", "360° tour")}</span>
              <Yes on={!!b.tour} />
            </div>
          </Group>

          <Group title={t("الاهتمام", "Demand")}>
            <Row label={t("المشاهدات", "Views")} better={null} vals={[a.views, b.views]} fmt={(v) => fmtNum(v, lang)} />
            <Row label={t("مهتمين", "Interested")} better={null} vals={[a.interested, b.interested]} fmt={(v) => fmtNum(v, lang)} />
          </Group>

          <div className="mt-5 grid grid-cols-2 gap-2.5 px-4">
            {[a, b].map((p) => (
              <Button key={p.id} variant="gold" href={p.cat === "stay" ? `/property/${p.id}` : `/property/${p.id}/book`} className="px-2">
                <CalendarCheck className="size-4" /> {t("احجز معاينة", "Book viewing")}
              </Button>
            ))}
          </div>
        </>
      )}

      <Sheet open={pickSlot !== null} onClose={() => setPickSlot(null)} title={t("اختار وحدة للمقارنة", "Pick a home to compare")}>
        <label className="sticky top-0 z-10 mb-3 flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-3.5 focus-within:ring-2 focus-within:ring-accent">
          <Search className="size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ابحث بالمنطقة أو الكمبوند", "Search by area or compound")} className="h-full flex-1 bg-transparent text-[14px] outline-none" />
        </label>
        <div className="space-y-2 pb-2">
          {pickList.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                haptic(8);
                setSlot(pickSlot!, p.id);
                setPickSlot(null);
                setQ("");
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface p-2 text-start ring-1 ring-line active:scale-[0.99]"
            >
              <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                <Image src={p.images[0]} alt="" fill sizes="56px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{t(p.title)}</span>
                <span className="block truncate text-[11.5px] text-ink-2">
                  {t(p.compound)} | {t(areaById(p.areaId).name)}
                </span>
                <span className="tabular block text-[13px] font-semibold">
                  {fmtMoney(p.price, lang)} <span className="text-[11px] font-normal text-ink-3">{priceSuffix(p, t)}</span>
                </span>
              </span>
              {favorites.includes(p.id) && <Badge>{t("محفوظة", "Saved")}</Badge>}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 mt-4">
      <h2 className="mb-2 px-1 text-[14px] font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">{children}</div>
    </section>
  );
}

function winner(vals: number[], better: Better): number {
  if (!better || vals.some((v) => Number.isNaN(v)) || vals[0] === vals[1]) return -1;
  return better === "low" ? (vals[0] < vals[1] ? 0 : 1) : vals[0] > vals[1] ? 0 : 1;
}

function Row({ label, vals, better, fmt }: { label: string; vals: number[]; better: Better; fmt: (v: number, i: number) => string }) {
  const w = winner(vals, better);
  return (
    <div className="border-b border-line px-3 py-2.5 last:border-0">
      <div className="mb-1.5 text-center text-[11px] font-medium text-ink-3">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {vals.map((v, i) => (
          <div key={i} className={cx("relative whitespace-pre-line rounded-xl px-2 py-2 text-center text-[13px] font-semibold leading-snug tabular", w === i ? "bg-accent-soft text-accent-ink" : "bg-surface-2/60")}>
            {w === i && <Crown className="absolute -top-1.5 end-1.5 size-3.5 fill-accent text-accent" />}
            {fmt(v, i)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextRow({ label, vals }: { label: string; vals: string[] }) {
  const same = vals[0] === vals[1];
  return (
    <div className="border-b border-line px-3 py-2.5 last:border-0">
      <div className="mb-1.5 text-center text-[11px] font-medium text-ink-3">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {vals.map((v, i) => (
          <div key={i} className={cx("rounded-xl bg-surface-2/60 px-2 py-2 text-center text-[13px] font-medium", same && "text-ink-2")}>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function Yes({ on }: { on: boolean }) {
  return (
    <span className="flex justify-center">
      {on ? (
        <span className="grid size-7 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-3">
          <Minus className="size-4" />
        </span>
      )}
    </span>
  );
}
