"use client";

import { type DayHours, fmtNum, weekdayName } from "@maqar/shared";
import { useState } from "react";
import { useAddDaysOff, useSetHours } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useNotice } from "./shell";
import { Button, Field, useErrorText } from "./ui";

/** Saturday first, as the week runs in Egypt. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
export const DEFAULT_WEEK: DayHours[] = WEEK_ORDER.map((weekday) => ({ weekday, from: weekday === 5 ? 14 : 10, to: 20 }));
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** One week for one agent or several: each day on or off, with the first and the last viewing hour. */
export function HoursEditor({ agentIds, start, onDone }: { agentIds: number[]; start: DayHours[]; onDone?: () => void }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const save = useSetHours();
  const [week, setWeek] = useState<Record<number, { from: number; to: number } | null>>(() =>
    Object.fromEntries(WEEK_ORDER.map((d) => [d, start.find((w) => w.weekday === d) ?? null])),
  );
  const set = (d: number, v: { from: number; to: number } | null) => setWeek((cur) => ({ ...cur, [d]: v }));
  const days = WEEK_ORDER.flatMap((weekday) => (week[weekday] ? [{ weekday, from: week[weekday]!.from, to: week[weekday]!.to }] : []));
  const select = (label: string, value: number, min: number, max: number, onChange: (h: number) => void) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-3">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9 rounded-lg border border-line-2 bg-surface px-2 tabular">
        {HOURS.filter((h) => h >= min && h <= max).map((h) => (
          <option key={h} value={h}>
            {hh(h)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t("المعاينات ورد الشات الأوتوماتيك بيمشوا على المواعيد دي على طول.", "Viewing slots and the chat’s away reply follow these hours at once.")}</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {WEEK_ORDER.map((d) => {
          const h = week[d];
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 p-3">
              <label className="flex w-32 items-center gap-2 font-medium">
                <input type="checkbox" checked={h !== null} onChange={(e) => set(d, e.target.checked ? { from: 10, to: 20 } : null)} className="size-4 accent-[var(--accent)]" />
                {weekdayName(d, lang)}
              </label>
              {h ? (
                <>
                  {select(t("أول معاينة", "First viewing"), h.from, 0, h.to, (from) => set(d, { ...h, from }))}
                  {select(t("آخر معاينة", "Last viewing"), h.to, h.from, 23, (to) => set(d, { ...h, to }))}
                </>
              ) : (
                <span className="text-sm text-ink-3">{t("إجازة", "Day off")}</span>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        disabled={!days.length || !agentIds.length}
        loading={save.isPending}
        onClick={() =>
          save.mutate(
            { agentIds, hours: days },
            {
              onSuccess: () => {
                notice({ text: t("المواعيد اتحفظت", "Hours saved"), tone: "ok" });
                onDone?.();
              },
              onError: (e) => notice({ text: errorText(e), tone: "bad" }),
            },
          )
        }
      >
        {agentIds.length > 1 ? t(`احفظ المواعيد لـ ${fmtNum(agentIds.length, "ar")} مسؤولين`, `Save hours for ${agentIds.length} agents`) : t("احفظ المواعيد", "Save hours")}
      </Button>
    </div>
  );
}

/** A day off or a holiday (a first and a last day) for one agent or several. */
export function DaysOffForm({ agentIds, onDone }: { agentIds: number[]; onDone?: () => void }) {
  const t = useT();
  const notice = useNotice();
  const errorText = useErrorText();
  const add = useAddDaysOff();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const bad = !from || (to !== "" && to < from);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (bad) return;
        add.mutate(
          { agentIds, from, to: to || undefined, reason: reason.trim() || undefined },
          {
            onSuccess: (res) => {
              const booked = res.booked.reduce((n, b) => n + b.viewings, 0);
              notice({
                text: booked
                  ? t(`اتضاف ${fmtNum(res.days, "ar")} يوم إجازة. فيه ${fmtNum(booked, "ar")} معاينة محجوزة فيهم، اتفق مع العملاء على ميعاد تاني.`, `${res.days} days off added. ${booked} viewings are booked then: agree another time with the clients.`)
                  : t(`اتضاف ${fmtNum(res.days, "ar")} يوم إجازة`, `${res.days} days off added`),
                tone: "ok",
              });
              setFrom("");
              setTo("");
              setReason("");
              onDone?.();
            },
            onError: (e) => notice({ text: errorText(e), tone: "bad" }),
          },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("من يوم", "From")} type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label={t("لحد يوم (اختياري)", "To (optional)")} type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} error={to && from && to < from ? t("قبل أول يوم", "Before the first day") : undefined} />
        <Field label={t("السبب (اختياري)", "Reason (optional)")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} />
      </div>
      <Button type="submit" variant="secondary" disabled={bad || !agentIds.length} loading={add.isPending}>
        {t("احفظ الإجازة", "Save day off")}
      </Button>
    </form>
  );
}
