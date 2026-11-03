"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Check, CalendarCheck, Rotate3d, Sparkles, Languages } from "lucide-react";
import { AREAS, FEATURE_LABEL, type Category, type Feature } from "@/lib/data";
import { useStore, haptic, type Prefs } from "@/lib/store";
import { fmtMoney, fmtNum, useLang, useT } from "@/lib/i18n";
import { matchScore, useProperties } from "@/lib/logic";
import { areaById } from "@/lib/data";
import { Logo } from "./Logo";
import { Button, Chip, cx } from "./ui";

const INTERESTS: Feature[] = ["pool", "garden", "sea", "smart", "gym", "clubhouse", "parking", "roof"];

export function Onboarding() {
  const t = useT();
  const lang = useLang();
  const setS = useStore((s) => s.set);
  const complete = useStore((s) => s.completeOnboarding);
  const all = useProperties();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<Category[]>(["sale"]);
  const isRent = purpose[0] === "rent";
  const [budget, setBudget] = useState(10_000_000);
  const [rentBudget, setRentBudget] = useState(50_000);
  const [areas, setAreas] = useState<string[]>([]);
  const [interests, setInterests] = useState<Feature[]>([]);
  const [beds, setBeds] = useState(2);

  const prefs: Prefs = useMemo(
    () => ({ purpose, budgetMax: isRent ? rentBudget : budget, areas, types: [], beds, interests }),
    [purpose, isRent, rentBudget, budget, areas, beds, interests],
  );
  const matches = useMemo(
    () => all.filter((p) => matchScore(p, prefs, (id) => areaById(id).name).score >= 70).length,
    [all, prefs],
  );

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const next = () => {
    haptic();
    setStep((s) => s + 1);
  };
  const finish = () => complete(name.trim(), prefs);

  const steps = 5;

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[440px] flex-col bg-bg">
      {step === 0 ? (
        <Welcome onStart={next} onSkip={() => complete("", prefs)} />
      ) : (
        <>
          <div className="flex items-center gap-3 px-5 pt-[calc(16px+env(safe-area-inset-top))]">
            <button
              aria-label="Back"
              onClick={() => setStep((s) => s - 1)}
              className="grid size-10 place-items-center rounded-full bg-surface ring-1 ring-line"
            >
              <ArrowLeft className="size-5 rtl:rotate-180" />
            </button>
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: steps - 1 }).map((_, i) => (
                <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    className="h-full bg-accent"
                    initial={false}
                    animate={{ width: i < step ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              ))}
            </div>
            <button onClick={() => complete(name.trim(), prefs)} className="text-[13px] font-medium text-ink-2">
              {t("تخطي", "Skip")}
            </button>
          </div>

          <div className="no-scrollbar relative flex-1 overflow-y-auto px-5 pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: lang === "ar" ? -24 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: lang === "ar" ? 24 : -24 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {step === 1 && (
                  <>
                    <h2 className="text-[26px] font-semibold leading-tight">{t("أهلاً بيك في مقر", "Welcome to Maqar")}</h2>
                    <p className="mt-2 text-sm text-ink-2">{t("٤ أسئلة سريعة ونرشحلك العقارات اللي تناسبك فعلاً.", "Four quick questions and we’ll suggest homes that actually fit you.")}</p>
                    <label className="mt-7 block text-[13px] font-medium text-ink-2">{t("اسمك (اختياري)", "Your name (optional)")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("مثلاً: أحمد", "e.g. Ahmed")}
                      className="mt-2 h-14 w-full rounded-2xl bg-surface px-4 text-base ring-1 ring-line outline-none transition focus:ring-2 focus:ring-accent"
                    />
                    <div className="mt-7 text-[13px] font-medium text-ink-2">{t("بتدور على إيه؟", "What are you looking for?")}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {(
                        [
                          ["sale", t("شراء", "Buy"), t("بيتك الجاي", "Your next home"), "/img/p6.jpg"],
                          ["rent", t("إيجار", "Rent"), t("شهري أو سنوي", "Monthly or yearly"), "/img/p9.jpg"],
                          ["project", t("مشروعات جديدة", "New projects"), t("بالتقسيط", "On installments"), "/img/p21.jpg"],
                          ["stay", t("إقامة قصيرة", "Stays"), t("الساحل والسخنة", "Coast & Sokhna"), "/img/p19.jpg"],
                        ] as [Category, string, string, string][]
                      ).map(([k, l, s, img]) => {
                        const on = purpose.includes(k);
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              haptic(5);
                              setPurpose((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [k, ...p]));
                            }}
                            className={cx(
                              "relative h-32 overflow-hidden rounded-3xl text-start transition active:scale-[0.97]",
                              on ? "ring-[3px] ring-accent" : "ring-1 ring-line",
                            )}
                          >
                            <Image src={img} alt="" fill sizes="200px" className="object-cover" />
                            <span className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent" />
                            <span className="absolute inset-x-3 bottom-3 text-white">
                              <span className="block text-[15px] font-semibold">{l}</span>
                              <span className="block text-[11px] opacity-80">{s}</span>
                            </span>
                            {on && (
                              <span className="absolute end-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-accent text-navy">
                                <Check className="size-4" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="text-[26px] font-semibold leading-tight">{isRent ? t("ميزانيتك الشهرية؟", "Monthly budget?") : t("ميزانيتك القصوى؟", "Your top budget?")}</h2>
                    <p className="mt-2 text-sm text-ink-2">{t("مش هنعرضها لحد. بنستخدمها بس عشان نرتب لك الأنسب.", "Never shown to anyone. We only use it to rank what fits you.")}</p>
                    <div className="mt-10 text-center">
                      <motion.div key={isRent ? rentBudget : budget} initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="tabular text-[40px] font-semibold text-accent-ink">
                        {fmtMoney(isRent ? rentBudget : budget, lang)}
                      </motion.div>
                      <div className="text-xs text-ink-3">{isRent ? t("في الشهر", "per month") : t("إجمالي سعر الوحدة", "total unit price")}</div>
                    </div>
                    <RangeInput
                      min={isRent ? 10_000 : 2_000_000}
                      max={isRent ? 200_000 : 40_000_000}
                      step={isRent ? 5_000 : 250_000}
                      value={isRent ? rentBudget : budget}
                      onChange={isRent ? setRentBudget : setBudget}
                      className="mt-8"
                    />
                    <div className="mt-6 grid grid-cols-4 gap-2">
                      {(isRent ? [25_000, 50_000, 90_000, 150_000] : [5_000_000, 8_000_000, 12_000_000, 20_000_000]).map((v) => (
                        <Chip key={v} active={(isRent ? rentBudget : budget) === v} onClick={() => (isRent ? setRentBudget(v) : setBudget(v))} className="justify-center px-1">
                          {fmtMoney(v, lang).replace(" ج.م", "").replace("EGP ", "")}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2 className="text-[26px] font-semibold leading-tight">{t("بتدور فين؟", "Where are you looking?")}</h2>
                    <p className="mt-2 text-sm text-ink-2">{t("اختار منطقة أو أكتر.", "Pick one or more areas.")}</p>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      {AREAS.map((a) => {
                        const on = areas.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => {
                              haptic(5);
                              setAreas((x) => toggle(x, a.id));
                            }}
                            className={cx(
                              "flex items-center gap-3 rounded-2xl bg-surface p-2 text-start transition active:scale-[0.97]",
                              on ? "ring-2 ring-accent" : "ring-1 ring-line",
                            )}
                          >
                            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                              <Image src={a.img} alt="" fill sizes="48px" className="object-cover" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-semibold">{t(a.name)}</span>
                              <span className="block text-[11px] text-ink-3">{t(a.city)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <h2 className="text-[26px] font-semibold leading-tight">{t("إيه اللي يهمك؟", "What matters to you?")}</h2>
                    <div className="mt-6 text-[13px] font-medium text-ink-2">{t("عدد الغرف", "Bedrooms")}</div>
                    <div className="mt-3 flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Chip key={n} active={beds === n} onClick={() => setBeds(n)} className="flex-1 justify-center">
                          {n === 5 ? "+5" : n}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-7 text-[13px] font-medium text-ink-2">{t("مميزات", "Must-haves")}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INTERESTS.map((f) => (
                        <Chip key={f} active={interests.includes(f)} onClick={() => setInterests((x) => toggle(x, f))}>
                          {interests.includes(f) && <Check className="size-3.5" />}
                          {t(FEATURE_LABEL[f])}
                        </Chip>
                      ))}
                    </div>
                    <motion.div layout className="mt-8 flex items-center gap-3 rounded-3xl bg-ink p-4 text-bg">
                      <Sparkles className="size-6 text-accent" />
                      <div className="text-sm">
                        <span className="tabular text-lg font-semibold text-accent">{fmtNum(matches, lang)}</span>{" "}
                        {t("عقار يناسبك بنسبة ٧٠٪ أو أكتر", "homes match you 70% or more")}
                      </div>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
            <Button size="lg" full onClick={step === steps - 1 ? finish : next}>
              {step === steps - 1 ? t("اعرض ترشيحاتي", "Show my picks") : t("التالي", "Next")}
            </Button>
          </div>
        </>
      )}
      <LangSwitch className="absolute end-5 top-[calc(18px+env(safe-area-inset-top))]" hidden={step !== 0} onToggle={() => setS({ lang: lang === "ar" ? "en" : "ar" })} />
    </div>
  );
}

function LangSwitch({ className, hidden, onToggle }: { className?: string; hidden?: boolean; onToggle: () => void }) {
  const lang = useLang();
  if (hidden) return null;
  return (
    <button onClick={onToggle} className={cx("flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-medium text-cream backdrop-blur", className)}>
      <Languages className="size-4" /> {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}

function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const t = useT();
  const props = [
    { icon: CalendarCheck, title: t("احجز معاينتك بنفسك", "Book your own viewing"), body: t("اختار اليوم والساعة وتعرف مين مسؤول المبيعات اللي هيقابلك.", "Pick the day and hour, and see which sales advisor will meet you.") },
    { icon: Rotate3d, title: t("لف الشقة قبل ما تروح", "Walk through before you go"), body: t("جولة ٣٦٠° في كل أوضة من موبايلك.", "A 360° tour of every room, from your phone.") },
    { icon: Sparkles, title: t("ترشيحات على مقاسك", "Picks that fit you"), body: t("حسب ميزانيتك والمناطق اللي بتحبها، ونبلغك لو السعر نزل.", "Based on your budget and areas, and we tell you when prices drop.") },
  ];
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-navy text-cream">
      <Image src="/img/p6.jpg" alt="" fill priority sizes="440px" className="object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy/60 via-navy/80 to-navy" />
      <div className="relative flex flex-1 flex-col px-6 pt-[calc(80px+env(safe-area-inset-top))]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <Logo width={190} onDark />
        </motion.div>
        <div className="mt-auto space-y-3 pb-6">
          {props.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-3.5 rounded-3xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur-md"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/20 text-gold">
                <p.icon className="size-5" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{p.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-cream/70">{p.body}</span>
              </span>
            </motion.div>
          ))}
        </div>
        <div className="space-y-2 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <button onClick={onStart} className="h-14 w-full rounded-2xl bg-gold text-[15px] font-semibold text-navy transition active:scale-[0.98]">
            {t("ابدأ", "Get started")}
          </button>
          <button onClick={onSkip} className="h-11 w-full text-[13px] font-medium text-cream/70">
            {t("تصفح من غير تسجيل", "Browse without signing up")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RangeInput({
  min,
  max,
  step,
  value,
  onChange,
  className,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className={cx("range", className)}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ["--fill" as string]: `${fill}%` }}
    />
  );
}
