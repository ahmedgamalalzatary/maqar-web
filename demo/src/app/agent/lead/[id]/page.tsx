"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Phone, MessageCircle, CalendarClock, Video, MapPin, Send, StickyNote, Wallet, Radio } from "lucide-react";
import { PROPERTIES, areaById } from "@/lib/data";
import { useStore, pushNotify } from "@/lib/store";
import { fmtDate, fmtMoney, fmtNum, fmtTime, relTime, useLang, useT } from "@/lib/i18n";
import { STAGES, useLeads } from "@/lib/agent";
import { useChat } from "@/lib/chat";
import { Avatar, Button, Card, PageHeader, cx } from "@/components/ui";

const NO_NOTES: string[] = [];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const lang = useLang();
  const lead = useLeads().find((l) => l.id === id);
  const setStage = useStore((s) => s.setLeadStage);
  const addNote = useStore((s) => s.addLeadNote);
  const notes = useStore((s) => s.leadNotes[id]) ?? NO_NOTES;
  const [note, setNote] = useState("");
  const threads = useChat((s) => s.threads);

  if (!lead) return <PageHeader title={t("العميل غير موجود", "Lead not found")} fallback="/agent/leads" />;
  const p = PROPERTIES.find((x) => x.id === lead.propertyId)!;
  const idx = STAGES.findIndex((s) => s.k === lead.stage);
  const st = STAGES[idx];
  const thread = threads.find((th) => (lead.fromApp ? th.id === `c-${lead.propertyId}` : th.leadId === lead.id));

  return (
    <div className="pb-10">
      <PageHeader title={t(lead.name)} subtitle={t(lead.source)} fallback="/agent/leads" />
      <div className="px-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar name={lead.name.en} tone={st.tone} size={54} />
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{t(lead.name)}</div>
            <div className="tabular text-[12.5px] text-ink-2" dir="ltr">
              {lead.phone}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
              <Wallet className="size-3.5" /> {fmtMoney(lead.budget, lang)}
            </div>
          </div>
        </Card>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="soft" onClick={() => pushNotify(t("(ديمو) اتصال", "(Demo) Calling"), t(lead.name), undefined, "sage")}>
            <Phone className="size-4" /> {t("اتصال", "Call")}
          </Button>
          {thread ? (
            <Button href={`/agent/chat/${thread.id}`}>
              <MessageCircle className="size-4" /> {t("الشات", "Chat")}
            </Button>
          ) : (
            <Button variant="soft" onClick={() => pushNotify(t("(ديمو) واتساب", "(Demo) WhatsApp"), t(lead.name), undefined, "sage")}>
              <MessageCircle className="size-4" /> {t("واتساب", "WhatsApp")}
            </Button>
          )}
        </div>

        {/* Stage */}
        <h2 className="mb-3 mt-7 text-[15px] font-semibold">{t("حالة العميل", "Lead status")}</h2>
        <div className="relative">
          <div className="absolute inset-x-4 top-4 h-0.5 bg-surface-3" />
          <motion.div
            className="absolute start-4 top-4 h-0.5 bg-accent"
            animate={{ width: `calc(${(Math.min(idx, 4) / 4) * 100}% - ${(Math.min(idx, 4) / 4) * 32}px)` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
          <div className="relative flex justify-between">
            {STAGES.slice(0, 5).map((s, i) => (
              <button
                key={s.k}
                onClick={() => {
                  setStage(lead.id, s.k);
                  pushNotify(t(`الحالة: ${s.label.ar}`, `Status: ${s.label.en}`), t(lead.name), undefined, "sage");
                }}
                className="flex w-14 flex-col items-center gap-1.5"
              >
                <span className={cx("grid size-8 place-items-center rounded-full text-[12px] font-semibold transition", i <= idx && lead.stage !== "lost" ? "bg-accent text-navy" : "bg-surface text-ink-3 ring-1 ring-line")}>{fmtNum(i + 1, lang)}</span>
                <span className={cx("text-center text-[10.5px] leading-tight", i === idx ? "font-semibold text-ink" : "text-ink-3")}>{t(s.label)}</span>
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setStage(lead.id, "lost")} className={cx("mt-3 text-[12px] font-medium", lead.stage === "lost" ? "text-danger" : "text-ink-3")}>
          {lead.stage === "lost" ? t("العميل مغلق", "Marked as lost") : t("علّم كمغلق", "Mark as lost")}
        </button>

        {/* Property */}
        <h2 className="mb-3 mt-6 text-[15px] font-semibold">{t("الوحدة المهتم بيها", "Interested in")}</h2>
        <Link href={`/property/${p.id}`} className="flex items-center gap-3 rounded-3xl bg-surface p-2.5 ring-1 ring-line">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
            <Image src={p.images[0]} alt="" fill sizes="64px" className="object-cover" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold">{t(p.title)}</span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-2">
              <MapPin className="size-3.5" /> {t(p.compound)} | {t(areaById(p.areaId).name)}
            </span>
            <span className="tabular mt-0.5 block text-[13px] font-semibold">{fmtMoney(p.price, lang)}</span>
          </span>
        </Link>

        {lead.viewing && (
          <>
            <h2 className="mb-3 mt-6 text-[15px] font-semibold">{t("المعاينة", "Viewing")}</h2>
            <div className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-bg">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent/20 text-accent">{lead.viewing.mode === "video" ? <Video className="size-5" /> : <CalendarClock className="size-5" />}</span>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{fmtDate(lead.viewing.date, lang, { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="tabular text-[12.5px] opacity-70">
                  {fmtTime(lead.viewing.time, lang)} | {lead.viewing.mode === "video" ? t("فيديو لايف", "Live video") : t("في الموقع", "On site")}
                </div>
              </div>
              {lead.viewing.mode === "video" && (
                <Button size="sm" variant="gold" onClick={() => pushNotify(t("(ديمو) بدء البث", "(Demo) Going live"), t("العميل هيوصله لينك الفيديو.", "The client receives the video link."), undefined, "sage")}>
                  <Radio className="size-4" /> {t("ابدأ", "Start")}
                </Button>
              )}
            </div>
          </>
        )}

        {/* Notes */}
        <h2 className="mb-3 mt-6 text-[15px] font-semibold">{t("ملاحظات", "Notes")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            addNote(lead.id, note.trim());
            setNote("");
          }}
          className="flex gap-2"
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("اكتب ملاحظة عن المكالمة…", "Add a note about the call…")} className="h-11 flex-1 rounded-2xl bg-surface px-3.5 text-[14px] ring-1 ring-line outline-none focus:ring-2 focus:ring-accent" />
          <button aria-label="Add" className="grid size-11 place-items-center rounded-2xl bg-ink text-bg active:scale-95">
            <Send className="size-4 rtl:-scale-x-100" />
          </button>
        </form>
        <div className="mt-3 space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-2.5 rounded-2xl bg-surface p-3 text-[13px] ring-1 ring-line">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-accent" /> {n}
            </div>
          ))}
          <div className="flex gap-2.5 rounded-2xl bg-surface-2 p-3 text-[12.5px] text-ink-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0" />
            {t(`أول تواصل ${relTime(lead.lastAt, "ar")} من خلال: ${lead.source.ar}`, `First touch ${relTime(lead.lastAt, "en")} via ${lead.source.en}`)}
          </div>
        </div>
      </div>
    </div>
  );
}
