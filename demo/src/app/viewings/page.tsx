"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CalendarCheck, CalendarClock, MapPin, Video, MessageCircle, Phone, Navigation, CalendarPlus, RefreshCw, XCircle } from "lucide-react";
import { agentById, areaById } from "@/lib/data";
import { useStore, pushNotify, type Viewing } from "@/lib/store";
import { fmtDate, fmtTime, relTime, useLang, useT } from "@/lib/i18n";
import { downloadText, icsFor, useNow, useProperties, viewingDate } from "@/lib/logic";
import { Avatar, Badge, Button, Empty, PageHeader, Segmented, Sheet } from "@/components/ui";

export default function ViewingsPage() {
  const t = useT();
  const viewings = useStore((s) => s.viewings);
  const [tab, setTab] = useState<"up" | "past">("up");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const update = useStore((s) => s.updateViewing);
  const notify = useStore((s) => s.notify);

  const now = useNow();
  const isUp = (v: Viewing) => (v.status === "confirmed" || v.status === "rescheduled") && viewingDate(v.date, v.time).getTime() > now - 3600_000;
  const list = viewings
    .filter((v) => (tab === "up" ? isUp(v) : !isUp(v)))
    .sort((a, b) => (tab === "up" ? 1 : -1) * (viewingDate(a.date, a.time).getTime() - viewingDate(b.date, b.time).getTime()));

  return (
    <div>
      <PageHeader back={false} title={t("معايناتي", "My viewings")} subtitle={t("كل مواعيدك في مكان واحد", "All your appointments in one place")} />
      <div className="px-4">
        <Segmented
          id="vtab"
          value={tab}
          onChange={setTab}
          options={[
            { value: "up", label: t("الجاية", "Upcoming") },
            { value: "past", label: t("السابقة والملغاة", "Past & cancelled") },
          ]}
        />
      </div>
      <div className="mt-4 space-y-4 px-4">
        <AnimatePresence mode="popLayout">
          {list.map((v) => (
            <motion.div key={v.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <ViewingCard v={v} onCancel={() => setCancelId(v.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
        {list.length === 0 && (
          <Empty
            icon={<CalendarCheck className="size-7" />}
            title={tab === "up" ? t("مفيش معاينات جاية", "No upcoming viewings") : t("لسه مفيش معاينات سابقة", "No past viewings yet")}
            body={t("اختار وحدة، حدد اليوم والساعة، وهتعرف مين هيقابلك. من غير مكالمات.", "Pick a home, choose the day and hour, and see who will meet you. No phone calls.")}
            action={<Button href="/explore">{t("استكشف الوحدات", "Explore homes")}</Button>}
          />
        )}
      </div>

      <Sheet
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title={t("إلغاء المعاينة؟", "Cancel this viewing?")}
        footer={
          <div className="flex gap-2">
            <Button variant="soft" full onClick={() => setCancelId(null)}>
              {t("لا، خليها", "Keep it")}
            </Button>
            <Button
              variant="danger"
              full
              onClick={() => {
                update(cancelId!, { status: "cancelled" });
                notify({ kind: "booking", title: { ar: "تم إلغاء المعاينة", en: "Viewing cancelled" }, body: { ar: "تقدر تحجز ميعاد تاني في أي وقت.", en: "You can book another time whenever you like." } });
                pushNotify(t("تم إلغاء المعاينة", "Viewing cancelled"), undefined, undefined, "sage");
                setCancelId(null);
              }}
            >
              {t("إلغاء المعاينة", "Cancel viewing")}
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-[14px] leading-relaxed text-ink-2">{t("لو الميعاد بس مش مناسب، تقدر تغيّره بدل ما تلغيه.", "If the time just doesn’t suit you, you can reschedule instead.")}</p>
      </Sheet>
    </div>
  );
}

function ViewingCard({ v, onCancel }: { v: Viewing; onCancel: () => void }) {
  const t = useT();
  const lang = useLang();
  const all = useProperties();
  const p = all.find((x) => x.id === v.propertyId);
  if (!p) return null;
  const agent = agentById(v.agentId);
  const area = areaById(p.areaId);
  const at = viewingDate(v.date, v.time);
  const active = v.status === "confirmed" || v.status === "rescheduled";
  const statusBadge = {
    confirmed: <Badge tone="success">{t("مؤكدة", "Confirmed")}</Badge>,
    rescheduled: <Badge tone="gold">{t("اتغير موعدها", "Rescheduled")}</Badge>,
    cancelled: <Badge tone="danger">{t("ملغاة", "Cancelled")}</Badge>,
    completed: <Badge tone="sage">{t("تمت", "Completed")}</Badge>,
  }[v.status];

  return (
    <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
      <Link href={`/property/${p.id}`} className="relative block h-32">
        <Image src={p.images[0]} alt="" fill sizes="440px" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute start-3 top-3">{statusBadge}</span>
        <span className="absolute inset-x-3 bottom-3 text-white">
          <span className="block truncate text-[15px] font-semibold">{t(p.title)}</span>
          <span className="flex items-center gap-1 text-[12px] opacity-85">
            <MapPin className="size-3.5" /> {t(p.compound)} | {t(area.name)}
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          {v.mode === "video" ? <Video className="size-5" /> : <CalendarClock className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{fmtDate(v.date, lang, { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="tabular text-[12.5px] text-ink-2">
            {fmtTime(v.time, lang)} | {v.mode === "video" ? t("فيديو لايف", "Live video") : t("في الموقع", "On site")}
            {active && <span className="text-accent-ink"> | {relTime(at.getTime(), lang)}</span>}
          </div>
          {v.rescheduledFrom && <div className="text-[11px] text-ink-3">{t("كانت", "Was")} {v.rescheduledFrom}</div>}
        </div>
      </div>
      <div className="mx-3.5 flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
        <Avatar name={agent.name.en} tone={agent.tone} size={38} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-ink-3">{t("مسؤول المبيعات", "Sales advisor")}</div>
          <div className="truncate text-[13px] font-semibold">{t(agent.name)}</div>
        </div>
        <Link aria-label={t("شات", "Chat")} href={`/chat/${p.id}`} className="grid size-9 place-items-center rounded-full bg-surface text-accent-ink ring-1 ring-line">
          <MessageCircle className="size-4" />
        </Link>
        <button aria-label="Call" onClick={() => pushNotify(t("(ديمو) اتصال", "(Demo) Calling"), agent.phone, undefined, "sage")} className="grid size-9 place-items-center rounded-full bg-surface ring-1 ring-line">
          <Phone className="size-4" />
        </button>
      </div>
      {active ? (
        <div className="grid grid-cols-4 gap-1 p-2">
          <Action href={`/property/${p.id}/book?reschedule=${v.id}`} icon={RefreshCw} label={t("تغيير", "Change")} />
          <Action
            onClick={() =>
              downloadText("maqar-viewing.ics", icsFor(`${t("معاينة", "Viewing")}: ${t(p.title)}`, at, `${t(p.compound)}, ${t(area.name)}`, `${t(agent.name)} ${agent.phone}`))
            }
            icon={CalendarPlus}
            label={t("للتقويم", "Calendar")}
          />
          <Action href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.compound.en} ${area.name.en} Egypt`)}`} icon={Navigation} label={t("الاتجاهات", "Directions")} external />
          <Action onClick={onCancel} icon={XCircle} label={t("إلغاء", "Cancel")} danger />
        </div>
      ) : (
        <div className="p-3">
          <Button variant="soft" full href={`/property/${p.id}/book`}>
            {t("احجز ميعاد جديد", "Book again")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Action({ icon: Icon, label, href, onClick, danger, external }: { icon: typeof RefreshCw; label: string; href?: string; onClick?: () => void; danger?: boolean; external?: boolean }) {
  const cls = `flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11.5px] font-medium transition active:scale-95 active:bg-surface-2 ${danger ? "text-danger" : "text-ink-2"}`;
  const inner = (
    <>
      <Icon className="size-[18px]" /> {label}
    </>
  );
  if (href) {
    if (external)
      return (
        <a href={href} target="_blank" rel="noreferrer" className={cls}>
          {inner}
        </a>
      );
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
