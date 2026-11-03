"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  SlidersHorizontal,
  KeyRound,
  Building2,
  Palmtree,
  Home as HomeIcon,
  Calculator,
  ArrowUpLeft,
  Rotate3d,
  Sparkles,
  TrendingDown,
  CalendarClock,
  Store,
  MessageCircle,
  Moon,
  Sun,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useChat, unreadFor } from "@/lib/chat";
import { AREAS, agentById, type Category } from "@/lib/data";
import { useStore, haptic } from "@/lib/store";
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtTime, useLang, useT } from "@/lib/i18n";
import { matchScore, useNow, useProperties, viewingDate } from "@/lib/logic";
import { areaById } from "@/lib/data";
import { PropertyCard, PropertyRow, dropPct } from "@/components/PropertyCard";
import { Avatar, Badge, SectionTitle } from "@/components/ui";
import { Mark } from "@/components/Logo";

export default function HomePage() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const name = useStore((s) => s.name);
  const prefs = useStore((s) => s.prefs);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const chatUnread = useChat((s) => unreadFor(s.threads, "client"));
  const viewings = useStore((s) => s.viewings);
  const setS = useStore((s) => s.set);
  const theme = useStore((s) => s.theme);
  const all = useProperties();
  const now = useNow();

  const hour = new Date(now).getHours();
  const greet = hour < 12 ? t("صباح الخير", "Good morning") : hour < 18 ? t("مساء الخير", "Good afternoon") : t("مساء النور", "Good evening");

  const picks = useMemo(
    () =>
      all
        .map((p) => ({ p, m: matchScore(p, prefs, (id) => areaById(id).name) }))
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 6),
    [all, prefs],
  );
  const drops = all.filter((p) => dropPct(p) > 0);
  const tours = all.filter((p) => p.tour && p.featured);
  const projects = all.filter((p) => p.cat === "project");

  const next = viewings
    .filter((v) => (v.status === "confirmed" || v.status === "rescheduled") && viewingDate(v.date, v.time).getTime() > now)
    .sort((a, b) => viewingDate(a.date, a.time).getTime() - viewingDate(b.date, b.time).getTime())[0];
  const nextP = next && all.find((p) => p.id === next.propertyId);

  const cats: { k: Category; icon: typeof KeyRound; label: string }[] = [
    { k: "sale", icon: HomeIcon, label: t("شراء", "Buy") },
    { k: "rent", icon: KeyRound, label: t("إيجار", "Rent") },
    { k: "project", icon: Building2, label: t("مشروعات", "Projects") },
    { k: "stay", icon: Palmtree, label: t("إقامة", "Stays") },
  ];

  return (
    <div className="pt-[calc(14px+env(safe-area-inset-top))]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-navy text-cream">
          <Mark size={24} cream="#fbf6e9" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-2">{greet}</div>
          <div className="truncate text-[18px] font-semibold">{name ? name : t("لكل طموح مقر", "A home for every ambition")}</div>
        </div>
        <button
          onClick={() => {
            haptic(8);
            setS({ theme: theme === "dark" ? "light" : "dark" });
          }}
          aria-label={theme === "dark" ? t("الوضع الفاتح", "Light mode") : t("الوضع الداكن", "Dark mode")}
          className="grid size-11 place-items-center overflow-hidden rounded-full bg-surface ring-1 ring-line shadow-card active:scale-90"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {theme === "dark" ? <Sun className="size-5 text-accent" /> : <Moon className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
        <Link href="/chat" aria-label={t("المحادثات", "Messages")} className="relative grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line shadow-card active:scale-90">
          <MessageCircle className="size-5" />
          {chatUnread > 0 && (
            <span className="tabular absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10.5px] font-semibold text-navy ring-2 ring-bg">
              {fmtNum(chatUnread, lang)}
            </span>
          )}
        </Link>
        <Link href="/notifications" aria-label={t("التنبيهات", "Notifications")} className="relative grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line shadow-card active:scale-90">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute end-2.5 top-2.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" />}
        </Link>
      </div>

      {/* Search */}
      <div className="mt-5 px-4">
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-tight">
          {t("لاقي بيتك،", "Find your home,")}
          <br />
          <span className="text-accent-ink">{t("واحجز معاينته بنفسك.", "book the viewing yourself.")}</span>
        </h1>
        <Link
          href="/explore?focus=1"
          className="mt-4 flex h-14 items-center gap-3 rounded-2xl bg-surface px-4 shadow-card ring-1 ring-line transition active:scale-[0.99]"
        >
          <Search className="size-5 text-ink-3" />
          <span className="flex-1 text-[14px] text-ink-3">{t("منطقة، كمبوند أو نوع الوحدة", "Area, compound or unit type")}</span>
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-bg">
            <SlidersHorizontal className="size-4" />
          </span>
        </Link>
      </div>

      {/* Categories */}
      <div className="mt-4 grid grid-cols-4 gap-2 px-4">
        {cats.map((c) => (
          <Link
            key={c.k}
            href={`/explore?cat=${c.k}`}
            onClick={() => haptic(5)}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface py-3 ring-1 ring-line transition active:scale-95"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <c.icon className="size-5" />
            </span>
            <span className="text-[12px] font-medium">{c.label}</span>
          </Link>
        ))}
      </div>

      {/* Upcoming viewing */}
      {next && nextP && (
        <Link href="/viewings" className="mx-4 mt-5 flex items-center gap-3 overflow-hidden rounded-3xl bg-ink p-3 text-bg shadow-float active:scale-[0.99]">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
            <Image src={nextP.images[0]} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
              <CalendarClock className="size-3.5" /> {t("معاينتك الجاية", "Your next viewing")}
            </span>
            <span className="mt-0.5 block truncate text-[14px] font-semibold">{t(nextP.title)}</span>
            <span className="tabular block text-[12px] opacity-70">
              {fmtDate(next.date, lang, { weekday: "long", day: "numeric", month: "short" })} | {fmtTime(next.time, lang)}
            </span>
          </span>
          <Avatar name={agentById(next.agentId).name.en} tone={agentById(next.agentId).tone} size={36} />
        </Link>
      )}

      {/* Picks for you */}
      <div className="mt-7">
        <SectionTitle
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-[18px] text-accent" /> {t("مختارة ليك", "Picked for you")}
            </span>
          }
          action={t("الكل", "See all")}
          href="/explore?for=you"
        />
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1">
          {picks.map(({ p, m }, i) => (
            <div key={p.id} className="w-[80%] shrink-0 snap-start">
              <PropertyCard p={p} match={m.score} wide priority={i < 2} />
              {m.reasons.length > 0 && (
                <div className="mt-2 flex gap-1.5 px-1">
                  {m.reasons.map((r, j) => (
                    <Badge key={j} tone="sage">
                      {t(r)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Calculator promo */}
      <Link
        href="/calculator"
        className="relative mx-4 mt-8 flex items-center gap-4 overflow-hidden rounded-3xl bg-navy p-5 text-cream ring-1 ring-white/10 active:scale-[0.99]"
      >
        <div className="absolute -end-10 -top-10 size-40 rounded-full bg-gold/15 blur-2xl" />
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-navy">
          <Calculator className="size-6" />
        </span>
        <span className="relative flex-1">
          <span className="block text-[15px] font-semibold">{t("احسب قسطك الشهري", "Work out your monthly installment")}</span>
          <span className="mt-0.5 block text-[12.5px] text-cream/70">{t("المقدم + عدد السنين = القسط في ثانية", "Down payment + years = installment, instantly")}</span>
        </span>
        <ArrowUpLeft className="size-5 text-gold ltr:-scale-x-100" />
      </Link>

      {/* Price drops */}
      {drops.length > 0 && (
        <div className="mt-8">
          <SectionTitle
            title={
              <span className="flex items-center gap-1.5">
                <TrendingDown className="size-[18px] text-[#e0574b]" /> {t("السعر نزل", "Price drops")}
              </span>
            }
          />
          <div className="space-y-2.5 px-4">
            {drops.slice(0, 3).map((p) => (
              <PropertyRow
                key={p.id}
                p={p}
                right={
                  <span className="tabular me-1 rounded-full bg-[#e0574b]/12 px-2.5 py-1 text-[12px] font-semibold text-[#e0574b]">
                    {fmtPct(-dropPct(p), lang)}
                  </span>
                }
                sub={p.oldPrice && <span className="tabular text-[11px] text-ink-3 line-through">{fmtMoney(p.oldPrice, lang)}</span>}
              />
            ))}
          </div>
        </div>
      )}

      {/* 360 tours */}
      <div className="mt-8">
        <SectionTitle
          title={
            <span className="flex items-center gap-1.5">
              <Rotate3d className="size-[18px] text-accent" /> {t("لف الوحدة قبل ما تروح", "Tour it before you go")}
            </span>
          }
        />
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4">
          {tours.map((p) => (
            <Link key={p.id} href={`/property/${p.id}/tour`} className="relative h-44 w-40 shrink-0 snap-start overflow-hidden rounded-3xl active:scale-[0.97]">
              <Image src={p.images[1] ?? p.images[0]} alt="" fill sizes="160px" className="object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
              <span className="absolute start-3 top-3 grid size-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md">
                <Rotate3d className="size-[18px]" />
              </span>
              <span className="absolute inset-x-3 bottom-3 text-white">
                <span className="block truncate text-[13px] font-semibold">{t(p.compound)}</span>
                <span className="block text-[11px] opacity-80">{t(`${fmtNum(p.tour!.length, "ar")} غرف بجولة ٣٦٠°`, `${p.tour!.length} rooms in 360°`)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Areas */}
      <div className="mt-8">
        <SectionTitle title={t("تصفح حسب المنطقة", "Browse by area")} />
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4">
          {AREAS.map((a) => (
            <Link key={a.id} href={`/explore?area=${a.id}`} className="flex shrink-0 items-center gap-2.5 rounded-full bg-surface py-1.5 pe-4 ps-1.5 ring-1 ring-line active:scale-95">
              <span className="relative size-9 overflow-hidden rounded-full">
                <Image src={a.img} alt="" fill sizes="36px" className="object-cover" />
              </span>
              <span className="text-[13px] font-medium">{t(a.name)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="mt-8">
        <SectionTitle title={t("مشروعات جديدة بالتقسيط", "New launches on installments")} action={t("الكل", "See all")} href="/explore?cat=project" />
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4">
          {projects.map((p) => (
            <div key={p.id} className="w-[72%] shrink-0 snap-start">
              <PropertyCard p={p} wide />
            </div>
          ))}
        </div>
      </div>

      {/* Owner CTA */}
      <button
        onClick={() => {
          setS({ role: "owner" });
          router.push("/owner");
        }}
        className="mx-4 mt-8 flex w-[calc(100%-2rem)] items-center gap-4 rounded-3xl bg-surface p-4 text-start ring-1 ring-line active:scale-[0.99]"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage-soft text-sage-ink">
          <Store className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">{t("عندك عقار؟", "Own a property?")}</span>
          <span className="mt-0.5 block text-[12.5px] text-ink-2">{t("اعرضه على مقر وتابع المشاهدات والمهتمين لحظة بلحظة.", "List it on Maqar and follow views and interested buyers live.")}</span>
        </span>
      </button>
      <div className="h-6" />
    </div>
  );
}
