"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { installment } from "@/lib/logic";
import { fmtMoney, fmtNum, fmtPct, useLang, useT } from "@/lib/i18n";
import { RangeInput } from "./Onboarding";
import { Chip, Segmented, cx } from "./ui";

export function useAnimatedNumber(value: number, ms = 450) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return v;
}

export function InstallmentCalculator({
  price: initialPrice,
  defaultDown = 10,
  defaultYears = 6,
  editablePrice = false,
  compact = false,
}: {
  price: number;
  defaultDown?: number;
  defaultYears?: number;
  editablePrice?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [price, setPrice] = useState(initialPrice);
  const [down, setDown] = useState(defaultDown);
  const [years, setYears] = useState(defaultYears);
  const [freq, setFreq] = useState<"m" | "q">("m");
  const [mode, setMode] = useState<"dev" | "bank">("dev");
  const [rate, setRate] = useState(18);

  const r = installment(price, down, years, mode === "bank" ? rate : 0, freq === "q");
  const pay = useAnimatedNumber(r.pay);
  const downPart = (r.down / r.total) * 100;

  return (
    <div className={cx(!compact && "space-y-5")}>
      {editablePrice && (
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-ink-2">{t("سعر الوحدة", "Unit price")}</label>
            <span className="tabular text-[15px] font-semibold">{fmtMoney(price, lang, false)}</span>
          </div>
          <RangeInput min={1_000_000} max={40_000_000} step={100_000} value={price} onChange={setPrice} className="mt-1" />
        </div>
      )}

      <Segmented
        id="calc-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "dev", label: t("خطة المطوّر (بدون فوايد)", "Developer plan (0%)") },
          { value: "bank", label: t("تمويل بنكي", "Bank finance") },
        ]}
      />

      {/* Result */}
      <div className={cx("relative overflow-hidden rounded-3xl bg-navy p-5 text-cream ring-1 ring-white/10", compact && "mt-4")}>
        <div className="absolute -start-12 -top-16 size-44 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative text-[12px] text-cream/70">{freq === "m" ? t("القسط الشهري", "Monthly installment") : t("القسط الربع سنوي", "Quarterly installment")}</div>
        <div className="tabular relative mt-1 text-[34px] font-semibold leading-none text-gold">{fmtMoney(Math.round(pay), lang, false)}</div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-gold" animate={{ width: `${downPart}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
        </div>
        <div className="tabular relative mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <div className="text-cream/60">{t("المقدم", "Down payment")}</div>
            <div className="mt-0.5 text-[13px] font-semibold">{fmtMoney(r.down, lang)}</div>
          </div>
          <div>
            <div className="text-cream/60">{t("عدد الأقساط", "Installments")}</div>
            <div className="mt-0.5 text-[13px] font-semibold">{fmtNum(r.n, lang)}</div>
          </div>
          <div>
            <div className="text-cream/60">{t("الإجمالي", "Total")}</div>
            <div className="mt-0.5 text-[13px] font-semibold">{fmtMoney(r.total, lang)}</div>
          </div>
        </div>
      </div>

      <div className={cx(compact && "mt-5")}>
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-ink-2">{t("المقدم", "Down payment")}</label>
          <span className="tabular text-[15px] font-semibold">
            {fmtPct(down, lang)} <span className="text-[12px] font-normal text-ink-3">· {fmtMoney(r.down, lang)}</span>
          </span>
        </div>
        <RangeInput min={0} max={60} step={5} value={down} onChange={setDown} className="mt-1" />
      </div>

      <div className={cx(compact && "mt-4")}>
        <label className="text-[13px] font-medium text-ink-2">{t("مدة التقسيط", "Payment period")}</label>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((y) => (
            <Chip key={y} active={years === y} onClick={() => setYears(y)} className="min-w-[52px] justify-center">
              {t(`${fmtNum(y, "ar")} ${y === 1 ? "سنة" : y <= 10 && y > 2 ? "سنين" : "سنة"}`, `${y}y`)}
            </Chip>
          ))}
        </div>
      </div>

      <div className={cx("flex items-center gap-3", compact && "mt-4")}>
        <Segmented
          id="calc-freq"
          className="flex-1"
          value={freq}
          onChange={setFreq}
          options={[
            { value: "m", label: t("شهري", "Monthly") },
            { value: "q", label: t("ربع سنوي", "Quarterly") },
          ]}
        />
        {mode === "bank" && (
          <label className="flex h-11 items-center gap-1 rounded-2xl bg-surface-2 px-3 text-[13px] focus-within:ring-2 focus-within:ring-accent">
            <input
              type="number"
              inputMode="decimal"
              value={rate}
              min={0}
              max={40}
              onChange={(e) => setRate(Math.max(0, Math.min(40, Number(e.target.value))))}
              className="tabular w-10 bg-transparent text-center font-semibold outline-none"
              aria-label={t("نسبة الفائدة", "Interest rate")}
            />
            <span className="text-ink-2">{t("٪ سنوي", "% / yr")}</span>
          </label>
        )}
      </div>

      <p className={cx("flex gap-1.5 text-[11.5px] leading-relaxed text-ink-3", compact && "mt-4")}>
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {t(
          "أرقام تقديرية للتوضيح. مسؤول المبيعات بيأكد الخطة النهائية معاك وقت المعاينة.",
          "Estimates for guidance. Your sales advisor confirms the final plan with you at the viewing.",
        )}
      </p>
    </div>
  );
}
