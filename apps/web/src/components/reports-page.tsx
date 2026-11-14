"use client";

import {
  cairoToday,
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  fmtCell,
  fmtDate,
  fmtNum,
  fmtPct,
  REPORT_GROUP_LABEL,
  REPORT_GROUPS,
  REPORT_IDS,
  REPORT_PRESET_LABEL,
  REPORT_PRESETS,
  type ReportChart,
  type ReportId,
  type ReportKpi,
  type ReportLink,
  type ReportPreset,
  reportPresetRange,
  type ReportQuery,
  reportRangeProblem,
  type ReportResult,
  REPORTS,
  reportSpec,
  type ReportTable,
  tableFilters,
  type TableView,
  viewRows,
  weekdayName,
} from "@maqar/shared";
import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileBarChart, Printer, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAllAgents, useAreas } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { downloadCsv, useReport } from "@/lib/reports";
import { Button, Card, Chip } from "./ui";

const SELECT = "h-10 rounded-xl border border-line-2 bg-surface px-3 text-sm";

/** `/reports/` (phase 27): every standard report, by group. */
export function ReportsPage() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("التقارير", "Reports")}</h1>
        <p className="text-sm text-ink-2">{t("كل تقرير بمدة وفلاتر، ومقارنة بالمدة اللي قبلها، وتقدر تنزّله Excel.", "Each report has a range and filters, compares with the period before, and downloads for Excel.")}</p>
      </div>
      {REPORT_GROUPS.map((g) => (
        <section key={g} className="flex flex-col gap-3" aria-labelledby={`group-${g}`}>
          <h2 id={`group-${g}`} className="text-sm font-semibold uppercase tracking-wide text-ink-3">
            {t(REPORT_GROUP_LABEL[g])}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.filter((r) => r.group === g && !r.needsAgent).map((r) => (
              <li key={r.id}>
                <Link href={`/report/?id=${r.id}`} className="flex h-full gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60">
                  <FileBarChart className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">{t(r.title)}</span>
                    <span className="text-sm text-ink-2">{t(r.description)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Reads the report, range and filters from the address, so a view can be bookmarked or shared. */
function useReportParams() {
  const params = useSearchParams();
  const id = params.get("id") as ReportId | null;
  const preset = (params.get("preset") as ReportPreset | null) ?? undefined;
  const q: ReportQuery = {
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    agentId: params.get("agentId") ? Number(params.get("agentId")) : undefined,
    areaId: params.get("areaId") ?? undefined,
    category: (params.get("category") as Category | null) ?? undefined,
  };
  return { id: id && (REPORT_IDS as readonly string[]).includes(id) ? id : null, preset, q };
}

/** `/report/?id=deals&from=…&to=…`: one report with its range, filters, totals, charts and tables. */
export function ReportPage() {
  const t = useT();
  const { id, preset, q } = useReportParams();
  if (!id)
    return (
      <Card>
        {t("التقرير ده مش موجود.", "There is no such report.")}{" "}
        <Link href="/reports/" className="text-accent-ink hover:underline">
          {t("كل التقارير", "All reports")}
        </Link>
      </Card>
    );
  return <Report key={id} id={id} preset={preset} q={q} />;
}

function Report({ id, preset, q }: { id: ReportId; preset?: ReportPreset; q: ReportQuery }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const spec = reportSpec(id);
  const today = cairoToday();
  // No dates: the preset, or the last 30 days.
  const range = q.from && q.to ? { from: q.from, to: q.to } : reportPresetRange(preset ?? "30d", today);
  const query: ReportQuery = { ...(spec.ranged ? range : {}), agentId: q.agentId, areaId: q.areaId, category: q.category };
  const agents = useAllAgents();
  const advisor = spec.needsAgent ? agents.data?.find((a) => a.id === q.agentId) : undefined;
  const report = useReport(id, query, !spec.needsAgent || q.agentId !== undefined);
  const Back = lang === "ar" ? ChevronRight : ChevronLeft;

  const go = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams({ id });
    const merged = { preset, from: q.from, to: q.to, agentId: q.agentId, areaId: q.areaId, category: q.category, ...next };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") p.set(k, String(v));
    router.replace(`/report/?${p}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <Link href={spec.needsAgent ? "/report/?id=advisors" : "/reports/"} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:underline print:hidden">
            <Back className="size-4" aria-hidden />
            {spec.needsAgent ? t("أداء المسؤولين", "Advisor performance") : t("التقارير", "Reports")}
          </Link>
          <h1 className="text-2xl font-semibold">{advisor ? (lang === "ar" ? advisor.nameAr : advisor.nameEn) : t(spec.title)}</h1>
          <p className="text-sm text-ink-2">
            {t(spec.description)}
            {advisor ? (
              <>
                {" "}
                <Link href={`/agent/?id=${advisor.id}`} className="text-accent-ink hover:underline print:hidden">
                  {t("صفحة المسؤول", "The advisor’s page")}
                </Link>
              </>
            ) : null}
          </p>
          {report.data ? (
            <p className="mt-1 text-sm text-ink-3">
              {report.data.range
                ? t(
                    `${fmtCell(report.data.range.from, "date", "ar")} – ${fmtCell(report.data.range.to, "date", "ar")} | مقارنة بـ ${fmtCell(report.data.previous!.from, "date", "ar")} – ${fmtCell(report.data.previous!.to, "date", "ar")}`,
                    `${fmtCell(report.data.range.from, "date", "en")} – ${fmtCell(report.data.range.to, "date", "en")} | compared with ${fmtCell(report.data.previous!.from, "date", "en")} – ${fmtCell(report.data.previous!.to, "date", "en")}`,
                  )
                : t("الوضع دلوقتي", "As of now")}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-4" aria-hidden />
          {t("اطبع", "Print")}
        </Button>
      </div>

      <Controls id={id} preset={q.from && q.to ? undefined : (preset ?? "30d")} range={range} q={q} today={today} go={go} />

      {spec.needsAgent && q.agentId === undefined ? (
        <Card>{t("اختار المسؤول من فوق.", "Pick the advisor above.")}</Card>
      ) : report.isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      ) : report.isError || !report.data ? (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="flex-1">{t("مقدرناش نجيب التقرير", "We couldn’t load the report")}</span>
          <Button variant="secondary" onClick={() => void report.refetch()}>
            {t("حاول تاني", "Try again")}
          </Button>
        </Card>
      ) : (
        <Body r={report.data} loading={report.isFetching} />
      )}
    </div>
  );
}

function Controls({
  id,
  preset,
  range,
  q,
  today,
  go,
}: {
  id: ReportId;
  preset?: ReportPreset;
  range: { from: string; to: string };
  q: ReportQuery;
  today: string;
  go: (next: Record<string, string | number | undefined>) => void;
}) {
  const t = useT();
  const lang = useLang();
  const spec = reportSpec(id);
  const agents = useAllAgents();
  const areas = useAreas();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const problem = reportRangeProblem(from, to, today);
  const problemText: Record<NonNullable<typeof problem>, string> = {
    format: t("اختار التاريخين", "Pick both dates"),
    order: t("البداية لازم تكون قبل النهاية", "The start must be before the end"),
    future: t("المدة متقدرش تخلص بعد النهارده", "The range cannot end after today"),
    long: t("المدة لحد ٣٦٦ يوم", "A range covers at most 366 days"),
  };

  return (
    <Card className="flex flex-col gap-4 print:hidden">
      {spec.ranged ? (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label={t("المدة", "Range")} className="flex flex-wrap gap-2">
            {REPORT_PRESETS.map((p) => (
              <Chip
                key={p}
                selected={preset === p}
                onClick={() => {
                  const r = reportPresetRange(p, today);
                  setFrom(r.from);
                  setTo(r.to);
                  go({ preset: p, from: undefined, to: undefined });
                }}
              >
                {t(REPORT_PRESET_LABEL[p])}
              </Chip>
            ))}
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!problem) go({ preset: undefined, from, to });
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-2">{t("من", "From")}</span>
              <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={SELECT} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-2">{t("لحد", "To")}</span>
              <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className={SELECT} />
            </label>
            <Button type="submit" variant="secondary" disabled={!!problem}>
              {t("اعرض", "Show")}
            </Button>
            {problem && (from !== range.from || to !== range.to) ? <p className="text-sm text-danger">{problemText[problem]}</p> : null}
          </form>
        </div>
      ) : (
        <p className="text-sm text-ink-2">{t("التقرير ده صورة للوضع دلوقتي، من غير مدة.", "This report is a snapshot of now, with no range.")}</p>
      )}
      {spec.filters.length || spec.needsAgent ? (
        <div className="flex flex-wrap gap-3">
          {spec.filters.includes("agent") || spec.needsAgent ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-2">{t("المسؤول", "Advisor")}</span>
              <select value={q.agentId ?? ""} onChange={(e) => go({ agentId: e.target.value || undefined })} className={SELECT}>
                {spec.needsAgent ? q.agentId === undefined ? <option value="">{t("اختار", "Pick one")}</option> : null : <option value="">{t("الكل", "All")}</option>}
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {lang === "ar" ? a.nameAr : a.nameEn}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {spec.filters.includes("area") ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-2">{t("المنطقة", "Area")}</span>
              <select value={q.areaId ?? ""} onChange={(e) => go({ areaId: e.target.value || undefined })} className={SELECT}>
                <option value="">{t("الكل", "All")}</option>
                {(areas.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {lang === "ar" ? a.nameAr : a.nameEn}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {spec.filters.includes("category") ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-2">{t("الغرض", "Purpose")}</span>
              <select value={q.category ?? ""} onChange={(e) => go({ category: e.target.value || undefined })} className={SELECT}>
                <option value="">{t("الكل", "All")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_LABEL[c])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Body({ r, loading }: { r: ReportResult; loading: boolean }) {
  const t = useT();
  return (
    <div className={`flex flex-col gap-5 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {r.kpis.map((k) => (
          <Kpi key={k.key} k={k} />
        ))}
      </div>
      {r.charts.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {r.charts.map((c) => (
            <Chart key={c.key} c={c} />
          ))}
        </div>
      ) : null}
      {r.tables.map((tb) => (
        <Table key={tb.key} r={r} table={tb} />
      ))}
      {r.notes.length ? (
        <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-ink-3">
          {r.notes.map((n) => (
            <li key={n.en}>{t(n)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A total, and how it moved against the previous period: green when it moved the good way. */
function Kpi({ k }: { k: ReportKpi }) {
  const t = useT();
  const lang = useLang();
  const moved = k.previous !== undefined && k.previous !== null && k.value !== null ? k.value - k.previous : null;
  const good = moved === null || moved === 0 || !k.better ? null : (moved > 0) === (k.better === "up");
  const Arrow = moved !== null && moved > 0 ? ArrowUpRight : ArrowDownRight;
  const change = moved !== null && k.previous ? fmtPct((moved / Math.abs(k.previous)) * 100, lang, 0) : null;
  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <span className="text-sm text-ink-2">{t(k.label)}</span>
      <span className="text-xl font-semibold tabular">{fmtCell(k.value, k.format, lang)}</span>
      {k.previous !== undefined ? (
        <span className={`flex items-center gap-1 text-xs ${good === null ? "text-ink-3" : good ? "text-sage" : "text-danger"}`}>
          {moved ? <Arrow className="size-3.5" aria-hidden /> : null}
          {t(`قبلها: ${fmtCell(k.previous ?? null, k.format, "ar")}`, `Before: ${fmtCell(k.previous ?? null, k.format, "en")}`)}
          {change ? ` (${change})` : ""}
        </span>
      ) : null}
    </Card>
  );
}

function Chart({ c }: { c: ReportChart }) {
  const t = useT();
  const lang = useLang();
  if (c.kind === "daily") {
    const top = Math.max(1, ...c.points.map((p) => p.value));
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t(c.title)}</h2>
        <ol className={`flex h-40 items-end border-b border-line-2 ${c.points.length > 31 ? "gap-px" : "gap-0.5"}`}>
          {c.points.map((p) => {
            const label = `${fmtDate(p.date, lang)}: ${fmtCell(p.value, c.format, lang)}`;
            return (
              <li key={p.date} className="flex h-full flex-1 items-end" title={label} aria-label={label}>
                <span className="block w-full rounded-t bg-accent hover:bg-accent-ink" style={{ height: p.value ? `${Math.max(2, (p.value / top) * 100)}%` : 0 }} />
              </li>
            );
          })}
        </ol>
        <div className="flex text-xs text-ink-3">
          <span className="flex-1">{fmtDate(c.points[0]!.date, lang)}</span>
          <span>{fmtDate(c.points.at(-1)!.date, lang)}</span>
        </div>
      </Card>
    );
  }
  if (c.kind === "bars") {
    const top = Math.max(1e-9, ...c.bars.map((b) => b.value));
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t(c.title)}</h2>
        {c.bars.length ? (
          <ul className="flex flex-col gap-2">
            {c.bars.map((b) => (
              <li key={b.label.en} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate" title={t(b.label)}>
                  {t(b.label)}
                </span>
                <span className="block h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(b.value / top) * 100}%`, background: b.colour ?? "var(--color-accent)" }} />
                </span>
                <span className="font-medium tabular">{fmtCell(b.value, c.format, lang)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">{t("مفيش حاجة في المدة دي", "Nothing in this range")}</p>
        )}
      </Card>
    );
  }
  const top = Math.max(1, ...c.values.flat());
  return (
    <Card className="flex flex-col gap-3 lg:col-span-2">
      <h2 className="font-semibold">{t(c.title)}</h2>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th />
              {c.hours.map((h) => (
                <th key={h} className="font-normal text-ink-3 tabular">
                  {fmtNum(h, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.weekdays.map((d, i) => (
              <tr key={d}>
                <th className="pe-2 text-start font-normal text-ink-2">{weekdayName(d, lang)}</th>
                {c.values[i]!.map((v, j) => (
                  <td
                    key={c.hours[j]}
                    title={`${weekdayName(d, lang)} ${fmtNum(c.hours[j]!, lang)}:00 — ${fmtNum(v, lang)}`}
                    className="size-7 rounded text-center tabular"
                    style={{ background: v ? `color-mix(in srgb, var(--color-accent) ${Math.round(15 + (v / top) * 85)}%, transparent)` : "var(--color-surface-2)" }}
                  >
                    {v ? fmtNum(v, lang) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const href = (l: ReportLink) => ({ listing: `/listing/?id=${l.id}`, agent: `/agent/?id=${l.id}`, client: `/client/?id=${l.id}`, chat: `/chat/?id=${l.id}` })[l.kind];

/** A table with its search box, a filter for each column whose values repeat, and sorting by any column (phase 29). */
function Table({ r, table }: { r: ReportResult; table: ReportTable }) {
  const t = useT();
  const lang = useLang();
  const params = useSearchParams();
  const [view, setView] = useState<TableView>({});
  const filters = useMemo(() => tableFilters(table), [table]);
  const rows = useMemo(() => viewRows(table, view, lang), [table, view, lang]);
  const sort = view.sort ?? null;
  const numeric = (f: string) => f !== "text" && f !== "date";
  const narrowed = rows.length !== table.rows.length;
  // In the advisors report a row opens that advisor's own report, over the same range.
  const linkOf = (l: ReportLink) => {
    if (r.id !== "advisors" || l.kind !== "agent") return href(l);
    const p = new URLSearchParams(params);
    p.set("id", "advisor");
    p.set("agentId", String(l.id));
    return `/report/?${p}`;
  };

  return (
    <Card className="flex flex-col gap-3 p-0">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <h2 className="flex-1 font-semibold">
          {t(table.title)}{" "}
          <span className="text-sm font-normal text-ink-3">
            ({narrowed ? t(`${fmtNum(rows.length, "ar")} من ${fmtNum(table.rows.length, "ar")}`, `${rows.length} of ${table.rows.length}`) : fmtNum(table.rows.length, lang)})
          </span>
        </h2>
        <Button variant="secondary" onClick={() => downloadCsv(r, { ...table, rows }, lang)} disabled={!rows.length} className="print:hidden">
          <Download className="size-4" aria-hidden />
          {t("نزّل CSV", "Download CSV")}
        </Button>
      </div>
      {table.rows.length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 px-5 print:hidden">
          <label className="flex h-10 min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
            <input
              value={view.q ?? ""}
              onChange={(e) => setView((v) => ({ ...v, q: e.target.value }))}
              placeholder={t("ابحث في الجدول", "Search this table")}
              aria-label={t(`ابحث في ${table.title.ar}`, `Search ${table.title.en}`)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          {filters.map((f) => (
            <label key={f.key} className="flex min-w-0 max-w-full flex-col gap-1 text-xs">
              <span className="font-medium text-ink-2">{t(f.label)}</span>
              <select value={view.filters?.[f.key] ?? ""} onChange={(e) => setView((v) => ({ ...v, filters: { ...v.filters, [f.key]: e.target.value } }))} className={`${SELECT} max-w-full`}>
                <option value="">{t("الكل", "All")}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs sm:hidden">
            <span className="font-medium text-ink-2">{t("الترتيب", "Sort by")}</span>
            <select
              value={sort ? `${sort.key}:${sort.up ? "up" : "down"}` : ""}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setView((v) => ({ ...v, sort: key ? { key, up: dir === "up" } : null }));
              }}
              className={SELECT}
            >
              <option value="">{t("زي ما هو", "As it is")}</option>
              {table.columns.flatMap((col) => [
                <option key={`${col.key}:down`} value={`${col.key}:down`}>{`${t(col.label)} ↓`}</option>,
                <option key={`${col.key}:up`} value={`${col.key}:up`}>{`${t(col.label)} ↑`}</option>,
              ])}
            </select>
          </label>
        </div>
      ) : null}
      {rows.length ? (
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line">
                {table.columns.map((col) => {
                  const on = sort?.key === col.key;
                  return (
                    <th key={col.key} scope="col" aria-sort={on ? (sort.up ? "ascending" : "descending") : "none"} className={`whitespace-nowrap px-3 py-2 font-medium text-ink-2 first:ps-5 last:pe-5 ${numeric(col.format) ? "text-end" : "text-start"}`}>
                      <button
                        type="button"
                        onClick={() => setView((v) => ({ ...v, sort: on && !sort.up ? null : { key: col.key, up: on ? true : !numeric(col.format) } }))}
                        className="inline-flex items-center gap-1 hover:text-ink"
                      >
                        {t(col.label)}
                        {on ? sort.up ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-40 print:hidden" aria-hidden />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.link ? `${row.link.kind}-${row.link.id}-${i}` : i} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                  {table.columns.map((col, j) => {
                    const text = fmtCell(row.cells[col.key] ?? null, col.format, lang);
                    return (
                      <td key={col.key} className={`px-3 py-2 first:ps-5 last:pe-5 ${numeric(col.format) ? "text-end tabular" : ""} ${col.format === "text" ? "min-w-32" : "whitespace-nowrap"}`}>
                        {j === 0 && row.link ? (
                          <Link href={linkOf(row.link)} className="font-medium text-accent-ink hover:underline">
                            {text}
                          </Link>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm text-ink-3">{table.rows.length ? t("مفيش حاجة مطابقة للبحث والفلاتر", "Nothing matches the search and filters") : t("مفيش حاجة هنا", "Nothing here")}</p>
      )}
      {table.note ? <p className="px-5 pb-5 text-sm text-ink-3">{t(table.note)}</p> : null}
    </Card>
  );
}
