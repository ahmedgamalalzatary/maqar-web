"use client";

import { type AdminListing, fmtDate, fmtNum, INSIGHT_RANGES, type InsightRange, INTEREST_LABEL, insightsSummary, type ListingDay, rangeTotals, relTime } from "@maqar/shared";
import { Copy, Phone } from "lucide-react";
import { useState } from "react";
import { useInterested, useListingStats } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Button, Card } from "./ui";

/** Phase 19: the listing's views chart, its numbers and its interested clients, to pass to the owner. */
export function ListingInsights({ l }: { l: AdminListing }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const [range, setRange] = useState<InsightRange>(30);
  const stats = useListingStats(l.id, range);
  const people = useInterested(l.id);
  const n = (v: number) => fmtNum(v, lang);

  const copy = async () => {
    if (!stats.data || stats.isPlaceholderData) return;
    try {
      await navigator.clipboard.writeText(insightsSummary(stats.data, lang === "ar" ? l.titleAr : l.titleEn, lang));
      notice({ text: t("الأرقام اتنسخت، ابعتها للمالك", "Copied: send it to the owner"), tone: "ok" });
    } catch {
      notice({ text: t("مقدرناش ننسخ", "We couldn’t copy"), tone: "bad" });
    }
  };

  const r = stats.data ? rangeTotals(stats.data.days) : undefined;
  const total = stats.data?.totals;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-lg font-semibold">{t("أرقام العقار", "Listing insights")}</h2>
        <div role="radiogroup" aria-label={t("المدة", "Range")} className="flex rounded-xl border border-line-2 p-0.5 text-sm">
          {INSIGHT_RANGES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={range === d}
              onClick={() => setRange(d)}
              className={`rounded-lg px-3 py-1 ${range === d ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {t(`${n(d)} يوم`, `${d} days`)}
            </button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => void copy()} disabled={!stats.data || stats.isPlaceholderData || stats.isFetching}>
          <Copy className="size-4" aria-hidden />
          {t("انسخ للمالك", "Copy for the owner")}
        </Button>
      </div>

      {stats.isError ? (
        <p className="text-sm text-danger">{t("مقدرناش نجيب الأرقام", "We couldn’t load the numbers")}</p>
      ) : !stats.data || !r || !total ? (
        <div className="h-56 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <Tile label={t("مشاهدات", "Views")} value={n(r.views)} all={t(`${n(total.views)} من الأول`, `${n(total.views)} all time`)} />
            <Tile label={t("حفظوه", "Saves")} value={n(r.saves)} all={t(`${n(total.saves)} حافظينه دلوقتي`, `${n(total.saves)} saved now`)} />
            <Tile label={t("مهتمين جداد", "New interested")} value={n(r.interested)} all={t(`${n(total.interested)} مهتم من الأول`, `${n(total.interested)} all time`)} />
          </dl>
          {(stats.isPlaceholderData || stats.isFetching) && (
            <p className="text-xs text-ink-3">{t('الأرقام بتتحدّث للمدة المختارة…', 'Updating to the selected range…')}</p>
          )}
          <ViewsChart days={stats.data.days} />
          {stats.data.since ? (
            <p className="text-xs text-ink-3">
              {t(
                `الأرقام اليومية بتتسجل من ${fmtDate(stats.data.since, lang)}`,
                `Daily numbers are recorded from ${fmtDate(stats.data.since, lang)}`,
              )}
            </p>
          ) : null}
          <p className="text-xs text-ink-3">
            {t(
              `${n(total.followers)} متابعين السعر | ${n(total.chats)} محادثة | ${n(total.viewings)} معاينة متحجزة`,
              `${n(total.followers)} follow the price | ${n(total.chats)} chats | ${n(total.viewings)} viewings booked`,
            )}
          </p>
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="font-semibold">{t("العملاء المهتمين", "Interested clients")}</h3>
        <p className="text-xs text-ink-3">{t("اللي حفظوه أو تابعوا سعره أو كلّموا المسؤول أو حجزوا معاينة.", "Clients who saved it, follow its price, chatted or booked a viewing.")}</p>
        {people.isPending ? (
          <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
        ) : people.isError ? (
          <p className="text-sm text-danger">{t("مقدرناش نجيب العملاء", "We couldn’t load the clients")}</p>
        ) : !people.data.pages.flat().length ? (
          <p className="text-sm text-ink-2">{t("لسه محدش اهتم بالعقار ده.", "Nobody has shown interest yet.")}</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {people.data.pages.flat().map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-ink-3">{t(`آخر نشاط ${relTime(new Date(c.lastAt), lang)}`, `Last active ${relTime(new Date(c.lastAt), lang)}`)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.kinds.map((k) => (
                      <span key={k} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-2">
                        {t(INTEREST_LABEL[k])}
                      </span>
                    ))}
                  </div>
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} dir="ltr" className="inline-flex items-center gap-1.5 text-sm text-accent-ink hover:underline">
                      <Phone className="size-3.5" aria-hidden />
                      {c.phone}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {people.hasNextPage ? (
              <Button variant="secondary" onClick={() => void people.fetchNextPage()} disabled={people.isFetchingNextPage}>
                {people.isFetchingNextPage ? t("بيجيب…", "Loading…") : t("أظهر المزيد", "Show more")}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

function Tile({ label, value, all }: { label: string; value: string; all: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="text-2xl font-semibold tabular">{value}</dd>
      <dd className="text-xs text-ink-3">{all}</dd>
    </div>
  );
}

/** Views per Cairo day as bars: hover or keyboard-focus a bar to see that day's numbers. */
function ViewsChart({ days }: { days: ListingDay[] }) {
  const t = useT();
  const lang = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, ...days.map((d) => d.views));
  const date = (day: string) => fmtDate(day, lang);
  const h = hover === null ? undefined : days[hover];
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1];

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-xs text-ink-2">{t("المشاهدات في اليوم", "Views per day")}</figcaption>
      <div className="relative">
        <span className="absolute -top-1 start-0 text-[11px] text-ink-3 tabular">{fmtNum(top, lang)}</span>
        <div className="flex h-40 items-end gap-[2px] border-b border-line-2 pt-4" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className="flex h-full min-w-0 flex-1 cursor-default items-end"
              aria-label={t(
                `${date(d.day)}: ${fmtNum(d.views, lang)} مشاهدة، ${fmtNum(d.saves, lang)} حفظ، ${fmtNum(d.interested, lang)} مهتم جديد`,
                `${date(d.day)}: ${d.views} views, ${d.saves} saves, ${d.interested} new interested`,
              )}
              aria-pressed={hover === i}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
            >
              <div
                className={`w-full rounded-t-[4px] ${hover === i ? "bg-accent-ink" : "bg-accent"}`}
                style={{ height: d.views ? `${Math.max(2, (d.views / top) * 100)}%` : 0 }}
              />
            </button>
          ))}
        </div>
        {h && hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg rtl:translate-x-1/2"
            style={{ insetInlineStart: `clamp(7rem, ${((hover + 0.5) / days.length) * 100}%, calc(100% - 7rem))` }}
          >
            <p className="font-semibold">{date(h.day)}</p>
            <p className="tabular">{t(`${fmtNum(h.views, lang)} مشاهدة | ${fmtNum(h.saves, lang)} حفظ | ${fmtNum(h.interested, lang)} مهتم جديد`, `${h.views} views | ${h.saves} saves | ${h.interested} new interested`)}</p>
          </div>
        ) : null}
      </div>
      <div aria-hidden className="flex justify-between text-[11px] text-ink-3">
        {ticks.map((i) => (
          <span key={i}>{date(days[i]!.day)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{t("المشاهدات والحفظ والمهتمين الجداد في اليوم", "Views, saves and new interested clients per day")}</caption>
        <thead>
          <tr>
            <th>{t("اليوم", "Day")}</th>
            <th>{t("مشاهدات", "Views")}</th>
            <th>{t("حفظ", "Saves")}</th>
            <th>{t("مهتمين جداد", "New interested")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{date(d.day)}</td>
              <td>{d.views}</td>
              <td>{d.saves}</td>
              <td>{d.interested}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
