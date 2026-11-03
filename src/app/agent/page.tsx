"use client";

import Image from "next/image";
import Link from "next/link";
import { Video, MapPin, Flame, TrendingUp, ChevronLeft, Target } from "lucide-react";
import { agentById, areaById, PROPERTIES } from "@/lib/data";
import { fmtDate, fmtNum, fmtTime, useLang, useT } from "@/lib/i18n";
import { toISODate } from "@/lib/logic";
import { STAGES, useLeads, ME_AGENT } from "@/lib/agent";
import { Avatar, Badge, Card, Stat, cx } from "@/components/ui";

export default function AgentToday() {
  const t = useT();
  const lang = useLang();
  const me = agentById(ME_AGENT);
  const leads = useLeads();
  const today = toISODate(new Date());
  const upcoming = leads
    .filter((l) => l.viewing && l.viewing.date >= today && l.stage !== "lost")
    .sort((a, b) => (a.viewing!.date + a.viewing!.time).localeCompare(b.viewing!.date + b.viewing!.time));
  const todays = upcoming.filter((l) => l.viewing!.date === today);
  const later = upcoming.filter((l) => l.viewing!.date !== today);
  const fresh = leads.filter((l) => l.stage === "new");
  const won = leads.filter((l) => l.stage === "won").length;
  const active = leads.filter((l) => l.stage !== "lost" && l.stage !== "won").length;

  return (
    <div className="pt-[calc(14px+env(safe-area-inset-top))]">
      <div className="flex items-center gap-3 px-4">
        <Avatar name={me.name.en} tone={me.tone} size={46} />
        <div className="flex-1">
          <div className="text-[12px] text-ink-2">{fmtDate(new Date(), lang, { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="text-[18px] font-semibold">{t(`يومك يا ${me.name.ar.split(" ")[0]}`, `Your day, ${me.name.en.split(" ")[0]}`)}</div>
        </div>
        <Badge tone="sage">{t("تطبيق المبيعات", "Sales app")}</Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 px-4">
        <Stat label={t("معاينات النهارده", "Today")} value={fmtNum(todays.length, lang)} />
        <Stat label={t("عملاء جداد", "New leads")} value={<span className="text-accent-ink">{fmtNum(fresh.length, lang)}</span>} />
        <Stat label={t("نشطين", "Active")} value={fmtNum(active, lang)} />
      </div>

      {/* Monthly target */}
      <Card className="mx-4 mt-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold">
            <Target className="size-4 text-accent" /> {t("هدف الشهر", "Monthly target")}
          </span>
          <span className="tabular text-[13px] text-ink-2">
            {fmtNum(won + 5, lang)} / {fmtNum(8, lang)} {t("صفقات", "deals")}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gradient-to-r from-sage to-accent rtl:bg-gradient-to-l" style={{ width: `${((won + 5) / 8) * 100}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11.5px] text-success">
          <TrendingUp className="size-3.5" /> {t("أعلى من متوسط الفريق بـ ٢٢٪", "22% above team average")}
        </div>
      </Card>

      <h2 className="mb-3 mt-7 px-4 text-[17px] font-semibold">{t("معاينات النهارده", "Today’s viewings")}</h2>
      <div className="relative space-y-3 px-4">
        {todays.length === 0 && <p className="rounded-2xl bg-surface p-4 text-[13px] text-ink-2 ring-1 ring-line">{t("مفيش معاينات تانية النهارده.", "No more viewings today.")}</p>}
        {todays.map((l) => (
          <ViewingItem key={l.id} l={l} />
        ))}
      </div>

      {later.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 px-4 text-[17px] font-semibold">{t("الجاية", "Coming up")}</h2>
          <div className="space-y-3 px-4">
            {later.map((l) => (
              <ViewingItem key={l.id} l={l} showDate />
            ))}
          </div>
        </>
      )}

      <div className="mb-3 mt-7 flex items-end justify-between px-4">
        <h2 className="text-[17px] font-semibold">{t("حالة العملاء", "Pipeline")}</h2>
        <Link href="/agent/leads" className="text-[13px] font-medium text-accent-ink">
          {t("كل العملاء", "All leads")}
        </Link>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
        {STAGES.map((s) => {
          const n = leads.filter((l) => l.stage === s.k).length;
          return (
            <Link key={s.k} href={`/agent/leads?stage=${s.k}`} className="w-[104px] shrink-0 rounded-2xl bg-surface p-3 ring-1 ring-line active:scale-95">
              <span className="block size-2.5 rounded-full" style={{ background: s.tone }} />
              <span className="tabular mt-2 block text-[22px] font-semibold">{fmtNum(n, lang)}</span>
              <span className="block text-[12px] text-ink-2">{t(s.label)}</span>
            </Link>
          );
        })}
      </div>

      {fresh.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 px-4 text-[17px] font-semibold">{t("محتاجين تتواصل معاهم", "Needs a first call")}</h2>
          <div className="space-y-2 px-4">
            {fresh.map((l) => {
              const p = PROPERTIES.find((x) => x.id === l.propertyId)!;
              return (
                <Link key={l.id} href={`/agent/lead/${l.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line active:scale-[0.99]">
                  <Avatar name={l.name.en} tone="#b38959" size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                      {t(l.name)} {l.hot && <Flame className="size-4 text-[#e0574b]" />}
                    </div>
                    <div className="truncate text-[12px] text-ink-2">
                      {t(p.title)} | {t(l.source)}
                    </div>
                  </div>
                  <ChevronLeft className="size-4 text-ink-3 ltr:rotate-180" />
                </Link>
              );
            })}
          </div>
        </>
      )}
      <div className="h-6" />
    </div>
  );
}

function ViewingItem({ l, showDate }: { l: ReturnType<typeof useLeads>[number]; showDate?: boolean }) {
  const t = useT();
  const lang = useLang();
  const p = PROPERTIES.find((x) => x.id === l.propertyId);
  if (!p || !l.viewing) return null;
  return (
    <Link href={`/agent/lead/${l.id}`} className={cx("flex gap-3 rounded-3xl bg-surface p-3 ring-1 transition active:scale-[0.99]", l.fromApp ? "ring-2 ring-accent" : "ring-line")}>
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-ink py-2 text-bg">
        <span className="tabular text-[13px] font-semibold">{fmtTime(l.viewing.time, lang)}</span>
        <span className="text-[10px] opacity-70">{showDate ? fmtDate(l.viewing.date, lang, { day: "numeric", month: "short" }) : t("النهارده", "Today")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{t(l.name)}</span>
          {l.fromApp && <Badge>{t("جديد من التطبيق", "New from app")}</Badge>}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-ink-2">{t(p.title)}</div>
        <div className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-3">
          {l.viewing.mode === "video" ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
          {l.viewing.mode === "video" ? t("فيديو لايف", "Live video") : `${t(p.compound)} | ${t(areaById(p.areaId).name)}`}
        </div>
      </div>
      <span className="relative size-14 shrink-0 self-center overflow-hidden rounded-2xl">
        <Image src={p.images[0]} alt="" fill sizes="56px" className="object-cover" />
      </span>
    </Link>
  );
}

