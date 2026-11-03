"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCheck, Phone, Paperclip, SendHorizontal, Rotate3d, CalendarCheck, CalendarClock, Calculator, MapPin, BadgeCheck, X, ShieldCheck } from "lucide-react";
import { agentById, areaById } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtTime, useLang, useT } from "@/lib/i18n";
import { pushNotify, haptic, useStore } from "@/lib/store";
import { useNow } from "@/lib/logic";
import { useChat, clientSend, agentSend, bookFromChat, propertyOf, planSummary, freeSlots, clientLabel, type Msg, type Side, type MsgBody } from "@/lib/chat";
import { Avatar, BackButton, IconButton, cx } from "./ui";

async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

const EMPTY: Msg[] = [];

export function ChatView({ threadId, propertyId, as }: { threadId: string; propertyId: string; as: Side }) {
  const t = useT();
  const lang = useLang();
  const thread = useChat((s) => s.threads.find((x) => x.id === threadId));
  const messages = thread?.messages ?? EMPTY;
  const typing = useChat((s) => s.typing[threadId]);
  const { setOpen, markRead, ensureThread } = useChat.getState();
  const [draft, setDraft] = useState("");
  const now = useNow(60_000);
  const userName = useStore((s) => s.name);
  const client = thread ? clientLabel(thread, userName) : { ar: "عميل", en: "Client" };
  const [viewer, setViewer] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = propertyOf(propertyId);
  const agent = agentById(thread?.agentId ?? p?.agentId ?? "a1");
  const other: Side = as === "client" ? "agent" : "client";
  const otherTyping = typing === other;

  useEffect(() => {
    if (as === "client") ensureThread(propertyId);
    setOpen({ id: threadId, as });
    return () => setOpen(null);
  }, [threadId, propertyId, as, ensureThread, setOpen]);

  useEffect(() => {
    if (messages.some((m) => m.from !== as && !m.read)) markRead(threadId, as);
  }, [messages, as, threadId, markRead]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages.length, otherTyping]);

  const send = (body: MsgBody) => {
    haptic(8);
    if (as === "client") clientSend(threadId, body);
    else agentSend(threadId, body);
  };
  const sendText = (s: string) => {
    const v = s.trim();
    if (!v) return;
    send({ kind: "text", text: v });
    setDraft("");
  };

  const groups = useMemo(() => {
    const out: { day: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.at).toDateString();
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [m] });
      else out[out.length - 1].items.push(m);
    }
    return out;
  }, [messages]);

  const dayLabel = (d: string) => {
    const today = new Date(now).toDateString();
    const y = new Date(now - 86_400_000).toDateString();
    if (d === today) return t("النهارده", "Today");
    if (d === y) return t("امبارح", "Yesterday");
    return fmtDate(new Date(d), lang, { weekday: "long", day: "numeric", month: "long" });
  };

  const quick =
    as === "client"
      ? [t("لسه متاحة؟", "Still available?"), t("ممكن أعاينها؟", "Can I view it?"), t("خطة السداد إيه؟", "What’s the payment plan?"), t("ابعتلي صور أكتر", "More photos please"), t("فيه خصم كاش؟", "Any cash discount?"), t("فيه جولة ٣٦٠°؟", "Is there a 360° tour?")]
      : [];

  const agentActions: { icon: typeof Rotate3d; label: string; body: () => MsgBody }[] = p
    ? [
        { icon: CalendarClock, label: t("مواعيد متاحة", "Free times"), body: () => ({ kind: "slots", propertyId: p.id, ...freeSlots(p.id) }) },
        { icon: Calculator, label: t("خطة السداد", "Payment plan"), body: () => ({ kind: "plan", propertyId: p.id }) },
        ...(p.tour ? [{ icon: Rotate3d, label: t("جولة ٣٦٠°", "360° tour"), body: () => ({ kind: "tour", propertyId: p.id }) as MsgBody }] : []),
        { icon: MapPin, label: t("تفاصيل الوحدة", "Home card"), body: () => ({ kind: "property", propertyId: p.id }) },
      ]
    : [];

  const otherName = as === "client" ? t(agent.name) : t(client);

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[440px] flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-line bg-surface/90 px-3 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur-xl">
        <BackButton fallback={as === "client" ? "/chat" : "/agent/chats"} />
        <span className="relative">
          <Avatar name={as === "client" ? agent.name.en : thread?.mine ? userName || "Demo Client" : client.en} tone={as === "client" ? agent.tone : "#61766d"} size={42} />
          <span className="absolute bottom-0 end-0 size-3 rounded-full bg-success ring-2 ring-surface" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-[15px] font-semibold">
            {otherName} {as === "client" && <BadgeCheck className="size-4 shrink-0 text-accent" />}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={otherTyping ? "typing" : "status"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className={cx("truncate text-[12px]", otherTyping ? "text-accent-ink" : "text-ink-2")}>
              {otherTyping
                ? t("بيكتب…", "typing…")
                : as === "client"
                  ? t(`متصل الآن | بيرد خلال ${fmtNum(agent.replyMins, "ar")} د`, `Online | replies in ${agent.replyMins} min`)
                  : t("عميل | متصل الآن", "Client | online")}
            </motion.div>
          </AnimatePresence>
        </div>
        <IconButton label={t("اتصال", "Call")} onClick={() => pushNotify(t("(ديمو) اتصال", "(Demo) Calling"), otherName, undefined, "sage")}>
          <Phone className="size-[18px]" />
        </IconButton>
      </header>

      {/* Pinned property */}
      {p && (
        <Link href={`/property/${p.id}`} className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2">
          <span className="relative size-11 shrink-0 overflow-hidden rounded-xl">
            <Image src={p.images[0]} alt="" fill sizes="44px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{t(p.title)}</span>
            <span className="tabular block text-[12px] font-semibold text-accent-ink">{fmtMoney(p.price, lang)}</span>
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-[11.5px] font-medium">{t("عرض", "View")}</span>
        </Link>
      )}

      {/* Messages */}
      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {as === "client" && (
          <div className="mx-auto mb-4 flex max-w-[300px] items-start gap-2 rounded-2xl bg-sage-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-sage-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            {t("محادثتك مع مسؤول مبيعات موثّق من مقر. متشاركش بيانات الدفع في الشات.", "You’re chatting with a verified Maqar advisor. Never share payment details in chat.")}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="my-3 flex justify-center">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-ink-2">{dayLabel(g.day)}</span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((m, i) => {
                const mine = m.from === as;
                const next = g.items[i + 1];
                const tail = !next || next.from !== m.from;
                return (
                  <motion.div
                    key={m.id}
                    layout="position"
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    className={cx("flex", mine ? "justify-end" : "justify-start", tail && "pb-1.5")}
                  >
                    <Bubble m={m} mine={mine} tail={tail} as={as} threadId={threadId} onImage={setViewer} />
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
        <AnimatePresence>
          {otherTyping && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex justify-start">
              <div className="flex items-center gap-1 rounded-[20px] rounded-es-md bg-surface px-4 py-3.5 ring-1 ring-line">
                {[0, 1, 2].map((k) => (
                  <motion.span key={k} className="size-2 rounded-full bg-ink-3" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: k * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick replies / agent actions */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2 pt-1">
        {as === "client"
          ? quick.map((q) => (
              <button key={q} onClick={() => sendText(q)} className="h-9 shrink-0 rounded-full bg-accent-soft px-3.5 text-[12.5px] font-medium text-accent-ink transition active:scale-95">
                {q}
              </button>
            ))
          : agentActions.map((a) => (
              <button key={a.label} onClick={() => send(a.body())} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[12.5px] font-medium text-accent-ink transition active:scale-95">
                <a.icon className="size-4" /> {a.label}
              </button>
            ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendText(draft);
        }}
        className="flex items-end gap-2 border-t border-line bg-surface px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) send({ kind: "images", urls: [await toDataUrl(f)] });
          }}
        />
        <button type="button" aria-label={t("إرفاق صورة", "Attach a photo")} onClick={() => fileRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 active:bg-surface-2">
          <Paperclip className="size-5" />
        </button>
        <label className="flex min-h-11 flex-1 items-center rounded-[22px] bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-accent">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("اكتب رسالة…", "Write a message…")}
            className="h-11 w-full bg-transparent text-[14.5px] outline-none placeholder:text-ink-3"
            enterKeyHint="send"
          />
        </label>
        <motion.button
          type="submit"
          aria-label={t("إرسال", "Send")}
          disabled={!draft.trim()}
          animate={{ scale: draft.trim() ? 1 : 0.85, opacity: draft.trim() ? 1 : 0.45 }}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-navy"
        >
          <SendHorizontal className="size-5 rtl:-scale-x-100" />
        </motion.button>
      </form>

      {/* Image viewer */}
      <AnimatePresence>
        {viewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] mx-auto grid max-w-[440px] place-items-center bg-black/90" onClick={() => setViewer(null)}>
            <button aria-label="Close" className="absolute end-4 top-[calc(14px+env(safe-area-inset-top))] grid size-10 place-items-center rounded-full bg-white/15 text-white">
              <X className="size-5" />
            </button>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="relative h-[70dvh] w-full">
              <Image src={viewer} alt="" fill sizes="440px" className="object-contain" unoptimized={viewer.startsWith("data:")} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bubble({ m, mine, tail, as, threadId, onImage }: { m: Msg; mine: boolean; tail: boolean; as: Side; threadId: string; onImage: (u: string) => void }) {
  const t = useT();
  const lang = useLang();
  const meta = (
    <span className={cx("tabular mt-1 flex items-center justify-end gap-1 text-[10.5px]", mine ? "text-bg/60" : "text-ink-3")}>
      {fmtTime(`${String(new Date(m.at).getHours()).padStart(2, "0")}:${String(new Date(m.at).getMinutes()).padStart(2, "0")}`, lang)}
      {mine && (m.read ? <CheckCheck className="size-3.5 text-accent" /> : <Check className="size-3.5" />)}
    </span>
  );
  const shell = cx(
    "max-w-[80%] rounded-[20px] text-[14.5px] leading-relaxed",
    mine ? "bg-ink text-bg" : "bg-surface text-ink ring-1 ring-line",
    tail && (mine ? "rounded-ee-md" : "rounded-es-md"),
  );
  const p = "propertyId" in m ? propertyOf(m.propertyId) : undefined;

  switch (m.kind) {
    case "text":
      return (
        <div className={cx(shell, "px-3.5 py-2")}>
          <span className="whitespace-pre-wrap break-words">{typeof m.text === "string" ? m.text : m.text[lang]}</span>
          {meta}
        </div>
      );

    case "images":
      return (
        <div className={cx(shell, "p-1.5")}>
          <div className={cx("grid gap-1", m.urls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {m.urls.map((u, i) => (
              <button key={i} onClick={() => onImage(u)} className={cx("relative overflow-hidden rounded-2xl", m.urls.length === 3 && i === 0 ? "col-span-2 aspect-[16/9]" : "aspect-square", m.urls.length === 1 && "aspect-[4/3] w-60")}>
                <Image src={u} alt="" fill sizes="240px" className="object-cover" unoptimized={u.startsWith("data:")} />
              </button>
            ))}
          </div>
          <div className="px-2">{meta}</div>
        </div>
      );

    case "property":
      if (!p) return null;
      return (
        <Link href={`/property/${p.id}`} className={cx(shell, "w-64 overflow-hidden")}>
          <span className="relative block aspect-[16/10]">
            <Image src={p.images[0]} alt="" fill sizes="256px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
          </span>
          <span className="block px-3 pb-2 pt-2.5">
            <span className="tabular block text-[15px] font-semibold">{fmtMoney(p.price, lang)}</span>
            <span className="block truncate text-[13px]">{t(p.title)}</span>
            <span className={cx("block truncate text-[11.5px]", mine ? "text-bg/60" : "text-ink-2")}>
              {t(p.compound)} | {t(areaById(p.areaId).name)}
            </span>
            {meta}
          </span>
        </Link>
      );

    case "plan": {
      if (!p) return null;
      const s = planSummary(p);
      return (
        <div className={cx(shell, "w-64 overflow-hidden")}>
          <div className="bg-navy p-3.5 text-cream">
            <div className="text-[11px] text-cream/60">{t("القسط الشهري", "Monthly installment")}</div>
            <div className="tabular text-[22px] font-semibold text-gold">{fmtMoney(Math.round(s.pay), lang, false)}</div>
          </div>
          <div className="tabular grid grid-cols-2 gap-2 px-3.5 py-3 text-[12px]">
            <div>
              <div className={mine ? "text-bg/60" : "text-ink-3"}>{t("المقدم", "Down payment")}</div>
              <div className="font-semibold">
                {fmtPct(s.downPct, lang)} | {fmtMoney(s.down, lang)}
              </div>
            </div>
            <div>
              <div className={mine ? "text-bg/60" : "text-ink-3"}>{t("المدة", "Period")}</div>
              <div className="font-semibold">{t(`${fmtNum(s.years, "ar")} سنين`, `${s.years} years`)}</div>
            </div>
          </div>
          <Link href={`/property/${p.id}#installments`} className="mx-3.5 mb-1 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-accent-soft text-[12.5px] font-medium text-accent-ink">
            <Calculator className="size-4" /> {t("غيّر المقدم والمدة", "Adjust down payment & period")}
          </Link>
          <div className="px-3.5 pb-2">{meta}</div>
        </div>
      );
    }

    case "slots": {
      const canPick = as === "client" && !m.chosen;
      return (
        <div className={cx(shell, "w-72 px-3.5 py-3")}>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            <CalendarClock className="size-4 text-accent" /> {fmtDate(m.date, lang, { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {m.times.map((tm) => {
              const on = m.chosen === tm;
              return (
                <button
                  key={tm}
                  disabled={!canPick}
                  onClick={() => {
                    haptic(12);
                    bookFromChat(threadId, m.id, m.propertyId, m.date, tm);
                  }}
                  className={cx(
                    "tabular h-10 rounded-xl text-[13px] font-medium transition active:scale-95",
                    on ? "bg-accent text-navy" : mine ? "bg-white/10" : "bg-surface-2",
                    !canPick && !on && "opacity-50",
                  )}
                >
                  {on && <Check className="me-1 inline size-3.5" strokeWidth={3} />}
                  {fmtTime(tm, lang)}
                </button>
              );
            })}
          </div>
          {canPick && <div className={cx("mt-2 text-[11px]", mine ? "text-bg/60" : "text-ink-3")}>{t("دوس على ميعاد وهيتحجز على طول", "Tap a time to book it instantly")}</div>}
          {m.chosen && as === "agent" && <div className="mt-2 text-[11px] text-success">{t("العميل اختار ميعاد", "The client picked a time")}</div>}
          {meta}
        </div>
      );
    }

    case "booking":
      return (
        <div className={cx(shell, "w-64 px-3.5 py-3")}>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-success text-white">
              <CalendarCheck className="size-[18px]" />
            </span>
            <div>
              <div className="text-[13.5px] font-semibold">{t("المعاينة اتأكدت", "Viewing confirmed")}</div>
              <div className={cx("tabular text-[12px]", mine ? "text-bg/70" : "text-ink-2")}>
                {fmtDate(m.date, lang, { weekday: "short", day: "numeric", month: "short" })} | {fmtTime(m.time, lang)}
              </div>
            </div>
          </div>
          {as === "client" && (
            <Link href="/viewings" className="mt-2.5 flex h-9 items-center justify-center rounded-xl bg-surface-2 text-[12.5px] font-medium">
              {t("معايناتي", "My viewings")}
            </Link>
          )}
          {meta}
        </div>
      );

    case "tour":
      if (!p) return null;
      return (
        <Link href={`/property/${p.id}/tour`} className={cx(shell, "w-64 overflow-hidden")}>
          <span className="relative block aspect-[16/9]">
            <Image src={p.images[1] ?? p.images[0]} alt="" fill sizes="256px" className="object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-navy/35">
              <span className="flex h-10 items-center gap-2 rounded-full bg-white/95 pe-4 ps-1.5 text-[13px] font-semibold text-navy">
                <span className="grid size-7 place-items-center rounded-full bg-navy text-gold">
                  <Rotate3d className="size-4" />
                </span>
                {t("ابدأ الجولة ٣٦٠°", "Start 360° tour")}
              </span>
            </span>
          </span>
          <span className="block px-3 pb-2 pt-2 text-[12.5px]">
            {t(`${fmtNum(p.tour?.length ?? 0, "ar")} غرف`, `${p.tour?.length ?? 0} rooms`)} | {t(p.compound)}
            {meta}
          </span>
        </Link>
      );
  }
}
