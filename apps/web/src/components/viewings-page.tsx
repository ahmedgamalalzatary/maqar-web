"use client";

import { type AdminViewingItem, fmtDate, fmtNum, isActiveViewing, fmtTime, type SlotsResponse, VIEWING_WHENS, type ViewingWhen } from "@maqar/shared";
import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { ApiError } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { useAdminViewings, useSlots, useUpdateAdminViewing } from "@/lib/people";
import { useNotice } from "./shell";
import { Button, Card, Chip, Field, useErrorText } from "./ui";

const WHEN_LABEL = { upcoming: { ar: "الجاية", en: "Upcoming" }, past: { ar: "اللي فاتت", en: "Past" } } as const;
const STATUS_LABEL = {
  confirmed: { ar: "مؤكدة", en: "Confirmed" },
  rescheduled: { ar: "اتغير ميعادها", en: "Rescheduled" },
  cancelled: { ar: "اتلغت", en: "Cancelled" },
  completed: { ar: "خلصت", en: "Completed" },
  pending: { ar: "مستنية التأكيد", en: "Awaiting confirmation" },
} as const;
const isActive = (v: AdminViewingItem) => isActiveViewing(v) && Date.parse(v.startsAt) > Date.now();

/** `/viewings/` (phase 23): every viewing; an upcoming one can be moved or cancelled. */
export function ViewingsPage() {
  const t = useT();
  const lang = useLang();
  const [when, setWhen] = useState<ViewingWhen>("upcoming");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const words = useDeferredValue(q);
  const list = useAdminViewings({ when, q: words, page });
  const [open, setOpen] = useState<number | null>(null);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("المعاينات", "Viewings")}</h1>
        <p className="text-sm text-ink-2">{t("تقدر تغيّر ميعاد معاينة جاية مع نفس المسؤول، أو تلغيها. العميل والمسؤول بيوصلهم إشعار.", "Move an upcoming viewing to another time with the same advisor, or cancel it. The client and the advisor are notified.")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" className="flex gap-2">
          {VIEWING_WHENS.map((w) => (
            <Chip
              key={w}
              selected={when === w}
              onClick={() => {
                setWhen(w);
                setPage(1);
              }}
            >
              {t(WHEN_LABEL[w])}
            </Chip>
          ))}
        </div>
        <label className="flex h-11 min-w-64 flex-1 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3">
          <Search className="size-4 text-ink-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={t("ابحث بالعميل أو العقار", "Search by client or home")}
            aria-label={t("ابحث بالعميل أو العقار", "Search by client or home")}
            className="flex-1 bg-transparent outline-none"
          />
        </label>
      </div>
      {list.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : list.isError ? (
        <Card>{t("مقدرناش نجيب المعاينات", "We couldn’t load the viewings")}</Card>
      ) : !list.data.items.length ? (
        <Card>{t("مفيش معاينات هنا", "No viewings here")}</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                <th className="p-3 text-start font-medium">{t("الميعاد", "When")}</th>
                <th className="p-3 text-start font-medium">{t("العميل", "Client")}</th>
                <th className="p-3 text-start font-medium">{t("العقار", "Home")}</th>
                <th className="p-3 text-start font-medium">{t("المسؤول", "Advisor")}</th>
                <th className="p-3 text-start font-medium">{t("الحالة", "Status")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((v) => (
                <Row key={v.id} v={v} open={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("السابق", "Previous")}
          </Button>
          <span className="text-sm text-ink-2 tabular">{t(`صفحة ${fmtNum(page, "ar")} من ${fmtNum(pages, "ar")}`, `Page ${page} of ${pages}`)}</span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t("التالي", "Next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ v, open, onToggle }: { v: AdminViewingItem; open: boolean; onToggle: () => void }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <tr className="border-t border-line">
        <td className="p-3 whitespace-nowrap">
          {fmtDate(v.date, lang, "weekday")} <span className="text-ink-2">{fmtTime(v.time, lang)}</span>
        </td>
        <td className="p-3">
          {v.client ? (
            <Link href={`/client/?id=${v.client.id}`} className="font-medium text-accent-ink hover:underline">
              {v.client.name}
            </Link>
          ) : (
            <span className="text-ink-3">{t("حساب اتمسح", "Deleted account")}</span>
          )}
          {v.client?.phone ? (
            <span className="block text-xs text-ink-2" dir="ltr">
              {v.client.phone}
            </span>
          ) : null}
        </td>
        <td className="p-3 text-ink-2">{lang === "ar" ? v.property.titleAr : v.property.titleEn}</td>
        <td className="p-3 text-ink-2">{lang === "ar" ? v.agent.nameAr : v.agent.nameEn}</td>
        <td className="p-3 text-ink-2">{t(STATUS_LABEL[v.status])}</td>
        <td className="p-3 text-end">
          {isActive(v) ? (
            <Button variant="secondary" onClick={onToggle} aria-expanded={open}>
              {open ? t("اقفل", "Close") : t("غيّر أو الغي", "Move or cancel")}
            </Button>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr className="bg-surface-2/50">
          <td colSpan={6} className="p-4">
            <Manage v={v} onDone={onToggle} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Manage({ v, onDone }: { v: AdminViewingItem; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const update = useUpdateAdminViewing(v.id);
  const slots = useSlots(v.property.id, v.id);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const days = (slots.data as SlotsResponse | undefined)?.days.filter((d) => d.slots.some((s) => s.state === "free")) ?? [];
  const day = days.find((d) => d.date === date);
  const note = reason.trim() ? { reason: reason.trim() } : {};
  const opts = (text: string) => ({
    onSuccess: () => {
      notice({ text: `${text} ${t("العميل والمسؤول وصلهم إشعار.", "The client and the advisor were notified.")}`, tone: "ok" as const });
      onDone();
    },
    onError: (e: unknown) =>
      notice({ text: e instanceof ApiError && e.status === 409 ? t("الميعاد ده مبقاش متاح، اختار تاني", "That time is no longer free; pick another") : errorText(e), tone: "bad" as const }),
  });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-2">{t("يوم جديد", "New day")}</span>
        <select
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTime("");
          }}
          className="h-11 rounded-xl border border-line-2 bg-surface px-3"
        >
          <option value="">{slots.isPending ? t("بنحمّل…", "Loading…") : t("اختار يوم", "Pick a day")}</option>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {fmtDate(d.date, lang, "weekday")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink-2">{t("الساعة", "Time")}</span>
        <select value={time} onChange={(e) => setTime(e.target.value)} disabled={!day} className="h-11 rounded-xl border border-line-2 bg-surface px-3">
          <option value="">{t("اختار ساعة", "Pick a time")}</option>
          {(day?.slots ?? [])
            .filter((s) => s.state === "free")
            .map((s) => (
              <option key={s.time} value={s.time}>
                {fmtTime(s.time, lang)}
              </option>
            ))}
        </select>
      </label>
      <Field className="min-w-64 flex-1" label={t("السبب (العميل والمسؤول هيشوفوه)", "Reason (the client and the advisor see it)")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <Button disabled={!date || !time} loading={update.isPending} onClick={() => update.mutate({ action: "reschedule", date, time, ...note }, opts(t("الميعاد اتغير.", "Viewing moved.")))}>
        {t("احفظ الميعاد", "Save the time")}
      </Button>
      <Button
        variant="secondary"
        loading={update.isPending}
        onClick={() => {
          if (window.confirm(t("تلغي المعاينة؟", "Cancel the viewing?"))) update.mutate({ action: "cancel", ...note }, opts(t("المعاينة اتلغت.", "Viewing cancelled.")));
        }}
      >
        {t("الغي المعاينة", "Cancel the viewing")}
      </Button>
    </div>
  );
}
