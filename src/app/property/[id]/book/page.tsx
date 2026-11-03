"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Video, Check, Star, BellRing, CalendarPlus, CalendarCheck, Clock, BadgeCheck, Sunrise, Sun, Moon, Send } from "lucide-react";
import { agentById, areaById } from "@/lib/data";
import { useStore, uid, pushNotify, haptic, type ReminderKey, type ViewingMode } from "@/lib/store";
import { fmtDate, fmtTime, useLang, useT } from "@/lib/i18n";
import { SLOTS, downloadText, icsFor, slotTaken, toISODate, useProperty, viewingDate } from "@/lib/logic";
import { Avatar, Button, Card, PageHeader, Segmented, cx } from "@/components/ui";

export default function BookPage() {
  return (
    <Suspense>
      <Book />
    </Suspense>
  );
}

function Book() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const resId = sp.get("reschedule");
  const p = useProperty(id);
  const t = useT();
  const lang = useLang();
  const existing = useStore((s) => s.viewings.find((v) => v.id === resId));
  const addViewing = useStore((s) => s.addViewing);
  const updateViewing = useStore((s) => s.updateViewing);
  const notify = useStore((s) => s.notify);

  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date();
    for (let i = 0; i < 14; i++) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
    return out;
  }, []);

  const [mode, setMode] = useState<ViewingMode>(existing?.mode ?? "visit");
  const [date, setDate] = useState(existing?.date ?? toISODate(days[new Date().getHours() >= 19 ? 1 : 0]));
  const [time, setTime] = useState<string | null>(existing?.time ?? null);
  const [reminders, setReminders] = useState<ReminderKey[]>(existing?.reminders ?? ["1d", "2h"]);
  const [done, setDone] = useState<string | null>(null);

  if (!p) return null;
  const agent = agentById(p.agentId);
  const area = areaById(p.areaId);

  const isToday = date === toISODate(new Date());
  const nowH = new Date().getHours();
  const slotState = (s: string) => {
    if (isToday && Number(s.slice(0, 2)) <= nowH) return "past";
    const isFri = new Date(date + "T00:00:00").getDay() === 5;
    if (isFri && Number(s.slice(0, 2)) < 14) return "closed";
    if (existing && existing.date === date && existing.time === s) return "free";
    return slotTaken(p.id, date, s) ? "taken" : "free";
  };
  const groups = [
    { icon: Sunrise, label: t("الصبح", "Morning"), slots: SLOTS.filter((s) => +s.slice(0, 2) < 13) },
    { icon: Sun, label: t("بعد الضهر", "Afternoon"), slots: SLOTS.filter((s) => +s.slice(0, 2) >= 13 && +s.slice(0, 2) < 17) },
    { icon: Moon, label: t("بالليل", "Evening"), slots: SLOTS.filter((s) => +s.slice(0, 2) >= 17) },
  ];

  const confirm = () => {
    if (!time) return;
    haptic(20);
    const title = existing ? { ar: "تم تغيير الموعد", en: "Viewing rescheduled" } : { ar: "تم تأكيد المعاينة", en: "Viewing confirmed" };
    const body = {
      ar: `${fmtDate(date, "ar", { weekday: "long", day: "numeric", month: "long" })} الساعة ${fmtTime(time, "ar")} مع ${agent.name.ar}`,
      en: `${fmtDate(date, "en", { weekday: "long", day: "numeric", month: "long" })} at ${fmtTime(time, "en")} with ${agent.name.en}`,
    };
    if (existing) {
      updateViewing(existing.id, { date, time, mode, reminders, status: "rescheduled", rescheduledFrom: `${existing.date} ${existing.time}` });
      setDone(existing.id);
    } else {
      const vid = uid();
      addViewing({ id: vid, propertyId: p.id, date, time, mode, agentId: agent.id, status: "confirmed", reminders });
      setDone(vid);
    }
    notify({ kind: "booking", title, body, href: "/viewings" });
  };

  const addToCalendar = () => {
    if (!time) return;
    downloadText(
      "maqar-viewing.ics",
      icsFor(
        `${lang === "ar" ? "معاينة" : "Viewing"}: ${t(p.title)}`,
        viewingDate(date, time),
        `${t(p.compound)}, ${t(area.name)}`,
        `${t("مسؤول المبيعات", "Sales advisor")}: ${t(agent.name)} ${agent.phone}`,
      ),
    );
  };

  const testReminder = () => {
    setTimeout(() => {
      pushNotify(
        t("تذكير: معاينتك قربت", "Reminder: your viewing is coming up"),
        t(`${p.title.ar} · ${fmtTime(time!, "ar")} · ${agent.name.ar} في انتظارك`, `${p.title.en} · ${fmtTime(time!, "en")} · ${agent.name.en} will meet you`),
        "/viewings",
      );
    }, 2500);
    pushNotify(t("هيوصلك تذكير تجريبي بعد ثانيتين", "A sample reminder arrives in 2 seconds"), undefined, undefined, "sage");
  };

  if (done && time) {
    return (
      <div className="flex min-h-dvh flex-col px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top))]">
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="mx-auto grid size-24 place-items-center rounded-full bg-success-soft">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 12 }} className="grid size-16 place-items-center rounded-full bg-success text-white">
            <Check className="size-9" strokeWidth={3} />
          </motion.span>
        </motion.div>
        <h1 className="mt-6 text-center text-[24px] font-semibold">{existing ? t("اتغير الموعد", "Rescheduled") : t("معاينتك اتأكدت", "You’re booked")}</h1>
        <p className="mt-1.5 text-center text-[14px] text-ink-2">{t(`${agent.name.ar} هيستناك في الميعاد.`, `${agent.name.en} will be there to meet you.`)}</p>

        <Card className="mt-7 overflow-hidden">
          <div className="flex gap-3 p-3">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
              <Image src={p.images[0]} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{t(p.title)}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
                <MapPin className="size-3.5" /> {t(p.compound)} · {t(area.name)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-line">
            <div className="border-e border-line p-3">
              <div className="text-[11px] text-ink-3">{t("اليوم", "Date")}</div>
              <div className="mt-0.5 text-[14px] font-semibold">{fmtDate(date, lang, { weekday: "short", day: "numeric", month: "short" })}</div>
            </div>
            <div className="p-3">
              <div className="text-[11px] text-ink-3">{t("الساعة", "Time")}</div>
              <div className="tabular mt-0.5 text-[14px] font-semibold">{fmtTime(time, lang)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-line p-3">
            <Avatar name={agent.name.en} tone={agent.tone} size={40} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">{t(agent.name)}</div>
              <div className="text-[11.5px] text-ink-2">{t(agent.role)}</div>
            </div>
            <span className="text-[11.5px] text-ink-2">{mode === "visit" ? t("في الموقع", "On site") : t("فيديو", "Video")}</span>
          </div>
        </Card>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-accent-soft p-3.5 text-[12.5px] text-accent-ink">
          <BellRing className="mt-0.5 size-4 shrink-0" />
          {t("هنفكرك ", "We’ll remind you ")}
          {reminders.map((r) => ({ "1d": t("قبلها بيوم", "a day before"), "2h": t("قبلها بساعتين", "2 hours before"), "30m": t("قبلها بنص ساعة", "30 min before") })[r]).join(t("، و", ", and "))}
          {reminders.length === 0 && t("— مفيش تذكير", "— no reminders")}
        </div>

        <div className="mt-auto space-y-2 pt-8">
          <Button full size="lg" variant="outline" onClick={addToCalendar}>
            <CalendarPlus className="size-5" /> {t("أضف للتقويم", "Add to calendar")}
          </Button>
          <Button full size="lg" variant="soft" onClick={testReminder}>
            <Send className="size-4" /> {t("(ديمو) جرّب التذكير الآن", "(Demo) Try the reminder now")}
          </Button>
          <Button full size="lg" href="/viewings">
            {t("معايناتي", "My viewings")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-[calc(110px+env(safe-area-inset-bottom))]">
      <PageHeader title={existing ? t("غيّر الموعد", "Reschedule") : t("احجز معاينة", "Book a viewing")} subtitle={t(p.title)} fallback={`/property/${id}`} />

      <div className="px-4">
        <Link href={`/property/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-2.5 ring-1 ring-line">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl">
            <Image src={p.images[0]} alt="" fill sizes="56px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{t(p.title)}</span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
              <MapPin className="size-3.5" /> {t(p.compound)} · {t(area.name)}
            </span>
          </span>
        </Link>

        <h2 className="mb-3 mt-6 text-[15px] font-semibold">{t("نوع المعاينة", "Viewing type")}</h2>
        <Segmented
          id="mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "visit", label: <><MapPin className="size-4" /> {t("في الموقع", "On site")}</> },
            { value: "video", label: <><Video className="size-4" /> {t("فيديو لايف", "Live video")}</> },
          ]}
        />
        {mode === "video" && <p className="mt-2 text-[12px] text-ink-2">{t("مسؤول المبيعات هيلف بيك الوحدة لايف من موبايله وانت في بيتك.", "Your advisor walks you through the home live from their phone.")}</p>}

        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("اختار اليوم", "Pick a day")}</h2>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d, i) => {
          const iso = toISODate(d);
          const on = iso === date;
          return (
            <button
              key={iso}
              onClick={() => {
                haptic(5);
                setDate(iso);
                setTime(null);
              }}
              className={cx(
                "relative flex h-[84px] w-[62px] shrink-0 flex-col items-center justify-center rounded-2xl transition active:scale-95",
                on ? "bg-ink text-bg shadow-float" : "bg-surface ring-1 ring-line",
              )}
            >
              <span className={cx("text-[11px]", on ? "opacity-70" : "text-ink-3")}>
                {i === 0 ? t("النهارده", "Today") : i === 1 ? t("بكرة", "Tmrw") : fmtDate(d, lang, { weekday: "short" })}
              </span>
              <span className="tabular mt-0.5 text-[22px] font-semibold leading-none">{fmtDate(d, lang, { day: "numeric" })}</span>
              <span className={cx("mt-1 text-[10.5px]", on ? "opacity-70" : "text-ink-3")}>{fmtDate(d, lang, { month: "short" })}</span>
            </button>
          );
        })}
      </div>

      <div className="px-4">
        <h2 className="mb-1 mt-7 text-[15px] font-semibold">{t("اختار الساعة", "Pick a time")}</h2>
        <AnimatePresence mode="wait">
          <motion.div key={date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {groups.map((g) => (
              <div key={g.label} className="mt-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] text-ink-3">
                  <g.icon className="size-3.5" /> {g.label}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {g.slots.map((s) => {
                    const st = slotState(s);
                    const on = time === s;
                    return (
                      <button
                        key={s}
                        disabled={st !== "free"}
                        onClick={() => {
                          haptic(5);
                          setTime(s);
                        }}
                        className={cx(
                          "tabular h-11 rounded-xl text-[13px] font-medium transition active:scale-95",
                          on ? "bg-accent text-navy shadow-card" : st === "free" ? "bg-surface ring-1 ring-line" : "bg-surface-2 text-ink-3 line-through opacity-60",
                        )}
                      >
                        {fmtTime(s, lang)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("هيقابلك", "You’ll meet")}</h2>
        <Card className="flex items-center gap-3 p-3.5">
          <Avatar name={agent.name.en} tone={agent.tone} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[14px] font-semibold">
              {t(agent.name)} <BadgeCheck className="size-4 text-accent" />
            </div>
            <div className="text-[12px] text-ink-2">{t(agent.role)}</div>
            <div className="tabular mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-2">
              <Star className="size-3 fill-accent text-accent" /> {agent.rating} · {t(agent.langs)}
            </div>
          </div>
        </Card>

        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("فكّرني", "Remind me")}</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["1d", t("قبلها بيوم", "1 day before")],
              ["2h", t("قبلها بساعتين", "2 hours before")],
              ["30m", t("قبلها بنص ساعة", "30 min before")],
            ] as [ReminderKey, string][]
          ).map(([k, l]) => {
            const on = reminders.includes(k);
            return (
              <button
                key={k}
                onClick={() => {
                  haptic(5);
                  setReminders((r) => (on ? r.filter((x) => x !== k) : [...r, k]));
                }}
                className={cx(
                  "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition active:scale-95",
                  on ? "bg-ink text-bg" : "bg-surface text-ink-2 ring-1 ring-line",
                )}
              >
                {on ? <Check className="size-4" /> : <Clock className="size-4" />} {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[440px] border-t border-line bg-surface/92 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mb-2 text-center text-[12px] text-ink-2">
          {time ? (
            <span className="tabular">
              {fmtDate(date, lang, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(time, lang)}
            </span>
          ) : (
            t("اختار ساعة عشان تكمل", "Pick a time to continue")
          )}
        </div>
        <Button variant="gold" size="lg" full disabled={!time} onClick={confirm}>
          <CalendarCheck className="size-5" /> {existing ? t("أكّد الموعد الجديد", "Confirm new time") : t("أكّد المعاينة", "Confirm viewing")}
        </Button>
      </div>
    </div>
  );
}
