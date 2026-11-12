"use client";

import { type AdminOverview, fmtDate, fmtNum, OVERVIEW_RANGES, type OverviewRange } from "@maqar/shared";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import { useOverview } from "@/lib/people";
import { Card, Chip } from "./ui";

type Metric = "clients" | "leads" | "viewings";
const METRIC_LABEL: Record<Metric, { ar: string; en: string }> = {
  clients: { ar: "عملاء جداد", en: "New clients" },
  leads: { ar: "عملاء محتملين", en: "New leads" },
  viewings: { ar: "معاينات اتحجزت", en: "Viewings booked" },
};

/** `/` (phase 25): the dashboard's home: what happened in the last 7, 30 or 90 days, and each advisor against the target. */
export function OverviewPage() {
  const t = useT();
  const [days, setDays] = useState<OverviewRange>(30);
  const overview = useOverview(days);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{t("نظرة عامة", "Overview")}</h1>
          {overview.data ? <Range o={overview.data} /> : null}
        </div>
        <div role="radiogroup" aria-label={t("المدة", "Range")} className="flex gap-2">
          {OVERVIEW_RANGES.map((d) => (
            <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
              {t(`${fmtNum(d, "ar")} يوم`, `${d} days`)}
            </Chip>
          ))}
        </div>
      </div>
      {overview.isPending ? <div className="h-64 animate-pulse rounded-2xl bg-surface-2" /> : overview.isError || !overview.data ? <Card>{t("مقدرناش نجيب الأرقام", "We couldn’t load the numbers")}</Card> : <Body o={overview.data} />}
    </div>
  );
}

function Range({ o }: { o: AdminOverview }) {
  const lang = useLang();
  return <p className="text-sm text-ink-2">{`${fmtDate(o.from, lang)} – ${fmtDate(o.to, lang)}`}</p>;
}

function Body({ o }: { o: AdminOverview }) {
  const t = useT();
  const lang = useLang();
  const n = (v: number) => fmtNum(v, lang);
  return (
    <>
      {o.chats.openReports ? (
        <Link href="/chats/" className="flex w-fit items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger hover:underline">
          <Flag className="size-4" aria-hidden />
          {t(`${fmtNum(o.chats.openReports, "ar")} بلاغ مفتوح على الشات`, `${o.chats.openReports} open chat reports`)}
        </Link>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t("عملاء جداد", "New clients")} value={n(o.clients.new)} sub={t(`${fmtNum(o.clients.total, "ar")} عميل في الكل`, `${o.clients.total} in all`)} />
        <Tile label={t("عملاء محتملين جداد", "New leads")} value={n(o.leads.new)} sub={t(`${fmtNum(o.leads.won, "ar")} اتقفلوا بيع`, `${o.leads.won} won`)} />
        <Tile label={t("معاينات اتحجزت", "Viewings booked")} value={n(o.viewings.booked)} sub={t(`${fmtNum(o.viewings.completed, "ar")} خلصت | ${fmtNum(o.viewings.cancelled, "ar")} اتلغت`, `${o.viewings.completed} done | ${o.viewings.cancelled} cancelled`)} />
        <Tile label={t("معاينات الأسبوع الجاي", "Next 7 days")} value={n(o.viewings.next7Days)} sub={t("معاينة مؤكدة", "confirmed viewings")} />
        <Tile label={t("عقارات منشورة", "Live listings")} value={n(o.listings.byStatus.approved)} sub={t(`${fmtNum(o.listings.published, "ar")} اتنشر | ${fmtNum(o.listings.closed, "ar")} اتقفل`, `${o.listings.published} published | ${o.listings.closed} closed`)} />
        <Tile label={t("شاتات جديدة", "New chats")} value={n(o.chats.new)} sub={t(`${fmtNum(o.chats.messages, "ar")} رسالة`, `${o.chats.messages} messages`)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <DailyChart o={o} />
        <Card className="flex flex-col gap-3 self-start">
          <h2 className="font-semibold">{t("المسؤولين", "Advisors")}</h2>
          <ul className="flex flex-col gap-4">
            {o.agents.map((a) => {
              const pct = a.monthlyTarget ? Math.min(1, a.wonThisMonth / a.monthlyTarget) : 0;
              return (
                <li key={a.id} className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: a.colour }} aria-hidden />
                    <Link href={`/agent/?id=${a.id}`} className="flex-1 font-medium hover:underline">
                      {lang === "ar" ? a.nameAr : a.nameEn}
                    </Link>
                    <span className="font-semibold tabular">{a.monthlyTarget ? `${n(a.wonThisMonth)} / ${n(a.monthlyTarget)}` : n(a.wonThisMonth)}</span>
                  </span>
                  {a.monthlyTarget ? (
                    <span
                      role="meter"
                      aria-valuenow={a.wonThisMonth}
                      aria-valuemin={0}
                      aria-valuemax={a.monthlyTarget}
                      aria-label={t("المقفول من هدف الشهر", "Won of this month’s target")}
                      className="block h-1.5 overflow-hidden rounded-full bg-surface-2"
                    >
                      <span className={`block h-full rounded-full ${pct >= 1 ? "bg-sage" : "bg-accent"}`} style={{ width: `${pct * 100}%` }} />
                    </span>
                  ) : null}
                  <span className="text-xs text-ink-2">
                    {t(`${fmtNum(a.live, "ar")} عقار منشور | ${fmtNum(a.openLeads, "ar")} عميل مفتوح | ${fmtNum(a.viewings, "ar")} معاينة اتحجزت`, `${a.live} live | ${a.openLeads} open leads | ${a.viewings} viewings booked`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-2xl font-semibold tabular">{value}</span>
      <span className="text-xs text-ink-3">{sub}</span>
    </Card>
  );
}

/** One metric per Cairo day; each bar has its day and number on hover and for screen readers. */
function DailyChart({ o }: { o: AdminOverview }) {
  const t = useT();
  const lang = useLang();
  const [metric, setMetric] = useState<Metric>("clients");
  const top = Math.max(1, ...o.daily.map((d) => d[metric]));
  return (
    <Card className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("الرقم", "Metric")} className="flex flex-wrap gap-2">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <Chip key={m} selected={metric === m} onClick={() => setMetric(m)}>
            {t(METRIC_LABEL[m])}
          </Chip>
        ))}
      </div>
      <ol className={`flex h-40 items-end border-b border-line-2 ${o.daily.length > 31 ? "gap-px" : "gap-0.5"}`}>
        {o.daily.map((d) => {
          const label = `${fmtDate(d.date, lang)}: ${fmtNum(d[metric], lang)}`;
          return (
            <li key={d.date} className="flex h-full flex-1 items-end" title={label} aria-label={label}>
              <span className="block w-full rounded-t bg-accent hover:bg-accent-ink" style={{ height: d[metric] ? `${Math.max(2, (d[metric] / top) * 100)}%` : 0 }} />
            </li>
          );
        })}
      </ol>
      <div className="flex text-xs text-ink-3">
        <span className="flex-1">{fmtDate(o.from, lang)}</span>
        <span>{fmtDate(o.to, lang)}</span>
      </div>
    </Card>
  );
}
