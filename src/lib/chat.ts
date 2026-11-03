"use client";

// Front-end demo of live chat between a client and a property's sales advisor.
// There is no server: the advisor's replies come from a small rule-based
// responder with realistic typing delays, and both sides of every
// conversation are stored in this browser.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PROPERTIES, agentById, type Bi, type Property } from "./data";
import { useStore, uid, pushNotify } from "./store";
import { fmtDate, fmtMoney, fmtTime } from "./i18n";
import { SLOTS, installment, slotTaken, toISODate } from "./logic";

export type Side = "client" | "agent";

export type MsgBody =
  | { kind: "text"; text: string | Bi }
  | { kind: "property"; propertyId: string }
  | { kind: "plan"; propertyId: string }
  | { kind: "slots"; propertyId: string; date: string; times: string[]; chosen?: string }
  | { kind: "booking"; propertyId: string; date: string; time: string }
  | { kind: "images"; urls: string[] }
  | { kind: "tour"; propertyId: string };

export type Msg = MsgBody & { id: string; from: Side; at: number; read: boolean };

export type Thread = {
  id: string;
  propertyId: string;
  agentId: string;
  /** Threads the demo client takes part in. Other threads belong to sample leads. */
  mine: boolean;
  client: Bi;
  leadId?: string;
  messages: Msg[];
};

type ChatState = {
  threads: Thread[];
  typing: Record<string, Side | undefined>;
  open: { id: string; as: Side } | null;
  ensureThread: (propertyId: string) => string;
  post: (threadId: string, from: Side, body: MsgBody) => void;
  patchMsg: (threadId: string, msgId: string, patch: Partial<Msg>) => void;
  markRead: (threadId: string, reader: Side) => void;
  setTyping: (threadId: string, who?: Side) => void;
  setOpen: (o: ChatState["open"]) => void;
  reset: () => void;
};

const H = 3600_000;
const m = (from: Side, body: MsgBody, agoH: number, read = true): Msg => ({ ...body, id: uid(), from, at: Date.now() - agoH * H, read });
const text = (ar: string, en: string): MsgBody => ({ kind: "text", text: { ar, en } });

const seed = (): Thread[] => [
  {
    id: "c-m104",
    propertyId: "m104",
    agentId: "a3",
    mine: true,
    client: { ar: "أنت", en: "You" },
    messages: [
      m("client", { kind: "text", text: { ar: "مساء الخير، الشاليه ده لسه متاح؟", en: "Good evening, is this chalet still available?" } }, 26),
      m("agent", text("مساء النور! أيوه متاح، وكمان سعره نزل ٦٪ امبارح.", "Good evening! Yes it is, and its price dropped 6% yesterday."), 25.9),
      m("agent", { kind: "property", propertyId: "m104" }, 25.9),
      m("agent", text("تحب أبعتلك مواعيد معاينة الأسبوع ده؟", "Would you like viewing times for this week?"), 25.8, false),
    ],
  },
  {
    id: "l2",
    propertyId: "m102",
    agentId: "a1",
    mine: false,
    leadId: "l2",
    client: { ar: "نهى السيد", en: "Noha El Sayed" },
    messages: [
      m("client", { kind: "text", text: { ar: "شفت الجولة ٣٦٠°، الشقة حلوة جداً. المقدم كام؟", en: "I watched the 360° tour, lovely flat. What’s the down payment?" } }, 0.5, false),
      m("client", { kind: "text", text: { ar: "وهل فيه جراج؟", en: "And is there parking?" } }, 0.45, false),
    ],
  },
  {
    id: "l1",
    propertyId: "m101",
    agentId: "a1",
    mine: false,
    leadId: "l1",
    client: { ar: "كريم محمود", en: "Karim Mahmoud" },
    messages: [
      m("client", { kind: "text", text: { ar: "أنا جاي المعاينة الساعة ٤، ممكن أجيب المهندس بتاعي؟", en: "I’m coming to the 4 pm viewing, can I bring my engineer?" } }, 3),
      m("agent", text("طبعاً أهلاً بيكم، هستناكم عند البوابة الرئيسية.", "Of course, you’re both welcome. I’ll meet you at the main gate."), 2.9),
      m("client", { kind: "text", text: { ar: "تمام شكراً 🙏", en: "Great, thanks 🙏" } }, 2.8),
    ],
  },
  {
    id: "l4",
    propertyId: "m109",
    agentId: "a1",
    mine: false,
    leadId: "l4",
    client: { ar: "دينا رأفت", en: "Dina Raafat" },
    messages: [
      m("agent", text("أهلاً يا دينا، بعتلك لينك المعاينة بالفيديو بكرة الساعة ١٢.", "Hi Dina, I’ve sent the video viewing link for tomorrow at 12."), 5),
      m("client", { kind: "text", text: { ar: "تمام، هل التراس عليه تندة؟", en: "Great. Does the terrace have a pergola?" } }, 4.5, false),
    ],
  },
];

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      threads: seed(),
      typing: {},
      open: null,
      ensureThread: (propertyId) => {
        const id = `c-${propertyId}`;
        if (!get().threads.some((t) => t.id === id)) {
          const p = propertyOf(propertyId);
          set({
            threads: [
              { id, propertyId, agentId: p?.agentId ?? "a1", mine: true, client: { ar: "أنت", en: "You" }, messages: [] },
              ...get().threads,
            ],
          });
        }
        return id;
      },
      post: (threadId, from, body) => {
        const open = get().open;
        // A message is read at once when its recipient has the conversation open.
        const read = !!open && open.id === threadId && open.as !== from;
        const msg: Msg = { ...body, id: uid(), from, at: Date.now(), read } as Msg;
        set({
          threads: get()
            .threads.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t))
            .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0)),
        });
      },
      patchMsg: (threadId, msgId, patch) =>
        set({
          threads: get().threads.map((t) =>
            t.id === threadId ? { ...t, messages: t.messages.map((x) => (x.id === msgId ? ({ ...x, ...patch } as Msg) : x)) } : t,
          ),
        }),
      markRead: (threadId, reader) =>
        set({
          threads: get().threads.map((t) =>
            t.id === threadId ? { ...t, messages: t.messages.map((x) => (x.from !== reader && !x.read ? { ...x, read: true } : x)) } : t,
          ),
        }),
      setTyping: (threadId, who) => set({ typing: { ...get().typing, [threadId]: who } }),
      setOpen: (o) => set({ open: o }),
      reset: () => set({ threads: seed(), typing: {}, open: null }),
    }),
    {
      name: "maqar-chat",
      version: 1,
      partialize: (s) => ({ threads: s.threads }),
    },
  ),
);

export const unreadFor = (threads: Thread[], reader: Side) =>
  threads
    .filter((t) => (reader === "client" ? t.mine : true))
    .reduce((n, t) => n + t.messages.filter((x) => x.from !== reader && !x.read).length, 0);

export const previewOf = (msg: Msg | undefined, lang: "ar" | "en"): string => {
  if (!msg) return lang === "ar" ? "ابدأ المحادثة" : "Start the conversation";
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  switch (msg.kind) {
    case "text":
      return typeof msg.text === "string" ? msg.text : msg.text[lang];
    case "property":
      return L("🏠 تفاصيل الوحدة", "🏠 Home details");
    case "plan":
      return L("💳 خطة السداد", "💳 Payment plan");
    case "slots":
      return L("📅 مواعيد معاينة متاحة", "📅 Available viewing times");
    case "booking":
      return L("✅ تم حجز المعاينة", "✅ Viewing booked");
    case "images":
      return L("📷 صور", "📷 Photos");
    case "tour":
      return L("🔄 جولة ٣٦٠°", "🔄 360° tour");
  }
};

/** Next free viewing times for a property, starting tomorrow. */
export function freeSlots(propertyId: string, count = 4) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 5) d.setDate(d.getDate() + 1);
  const date = toISODate(d);
  return { date, times: SLOTS.filter((s) => !slotTaken(propertyId, date, s)).slice(0, count) };
}

const has = (s: string, words: string[]) => words.some((w) => s.includes(w));

/** Rule-based advisor reply: understands common Egyptian-Arabic and English questions. */
function replyFor(raw: string, p: Property): MsgBody[] {
  const s = raw.toLowerCase();
  const price = (l: "ar" | "en") => fmtMoney(p.price, l, false);

  if (has(s, ["معاين", "اعاين", "أعاين", "اشوف", "أشوف", "اجي", "أجي", "ميعاد", "موعد", "visit", "view", "viewing", "see it", "appointment", "today", "النهارده", "بكرة"])) {
    const { date, times } = freeSlots(p.id);
    return [text("أكيد! دي أقرب مواعيد فاضية، اختار اللي يناسبك وهأكدها فوراً:", "Sure! Here are the nearest free times. Pick one and I’ll confirm it right away:"), { kind: "slots", propertyId: p.id, date, times }];
  }
  if (has(s, ["قسط", "تقسيط", "مقدم", "خطة", "سنين", "plan", "installment", "down", "payment", "monthly"])) {
    if (!p.plan) return [text(`الوحدة دي كاش بسعر ${price("ar")}، بس ممكن أساعدك في تمويل بنكي لحد ٨٠٪.`, `This one is cash at ${price("en")}, but I can help with bank finance up to 80%.`), { kind: "plan", propertyId: p.id }];
    return [text("دي خطة السداد المتاحة للوحدة:", "Here’s the payment plan for this home:"), { kind: "plan", propertyId: p.id }];
  }
  if (has(s, ["صور", "صورة", "photo", "picture", "pics", "image"])) {
    return [text("اتفضل صور أكتر للوحدة 👇", "Here are more photos 👇"), { kind: "images", urls: p.images.slice(1, 4).length ? p.images.slice(1, 4) : p.images }];
  }
  if (has(s, ["٣٦٠", "360", "جولة", "tour", "فيديو", "video"])) {
    if (p.tour) return [text("تقدر تلف الوحدة كلها من موبايلك دلوقتي:", "You can walk through the whole home from your phone now:"), { kind: "tour", propertyId: p.id }];
    return [text("الوحدة دي مفيهاش جولة ٣٦٠° لسه، بس أقدر أعملك معاينة فيديو لايف.", "No 360° tour for this one yet, but I can do a live video viewing.")];
  }
  if (has(s, ["خصم", "كاش", "تفاوض", "اقل", "أقل", "discount", "cash", "negotiat", "lower", "best price"])) {
    return [text("في حالة الكاش ممكن أكلم المالك على خصم لحد ٥٪. نتكلم فيها في المعاينة؟", "For cash I can ask the owner for up to 5% off. Shall we discuss it at the viewing?")];
  }
  if (has(s, ["سعر", "بكام", "كام", "price", "cost", "how much"])) {
    return [text(`السعر الحالي ${price("ar")}${p.oldPrice ? "، وكان نازل من فترة قريبة" : ""}.`, `The current price is ${price("en")}${p.oldPrice ? ", recently reduced" : ""}.`), { kind: "property", propertyId: p.id }];
  }
  if (has(s, ["متاح", "متاحة", "موجود", "لسه", "available", "still"])) {
    return [text("أيوه لسه متاحة 👌 وعليها اهتمام كبير الأسبوع ده، فلو حابب تعاين يبقى أحسن بدري.", "Yes, still available 👌 and there’s a lot of interest this week, so an early viewing is a good idea."), { kind: "property", propertyId: p.id }];
  }
  if (has(s, ["جراج", "باركنج", "parking", "garage"])) {
    return [text(p.features.includes("parking") ? "أيوه فيه جراج خاص للوحدة." : "مفيش جراج خاص، بس فيه باركنج للسكان.", p.features.includes("parking") ? "Yes, there’s a private parking spot." : "No private garage, but there’s resident parking.")];
  }
  if (has(s, ["استلام", "تسليم", "delivery", "handover", "ready"])) {
    return [text(p.delivery === "ready" ? "الوحدة جاهزة للاستلام فوراً." : `الاستلام ${p.delivery}.`, p.delivery === "ready" ? "It’s ready to move in now." : `Handover is in ${p.delivery}.`)];
  }
  if (has(s, ["شكرا", "شكراً", "تمام", "ماشي", "thanks", "thank", "ok", "great"])) {
    return [text("العفو! أنا موجود لو احتجت أي حاجة 🙌", "You’re welcome! I’m here if you need anything 🙌")];
  }
  if (has(s, ["اهلا", "أهلا", "السلام", "مرحبا", "صباح", "مساء", "hi", "hello", "hey", "good"])) {
    return [text("أهلاً بيك! أنا هنا عشان أساعدك في أي سؤال عن الوحدة.", "Hi! I’m here to help with any question about this home.")];
  }
  return [text("سؤال حلو، هتأكد من التفاصيل وأرد عليك. على فكرة تقدر تسألني عن السعر، التقسيط، أو تحجز معاينة من هنا على طول.", "Good question, let me confirm the details. You can also ask me about price, installments, or book a viewing right here.")];
}

const allProps = () => {
  const own = useStore.getState().ownerListings;
  return [...PROPERTIES, ...own.map((o) => ({ ...PROPERTIES[0], ...o, id: o.id, title: { ar: o.title, en: o.title }, agentId: "a1", tour: undefined, plan: undefined, oldPrice: undefined }) as Property)];
};
export const propertyOf = (id: string) => allProps().find((p) => p.id === id);

/** Client sends a message; the advisor reads it, types, and answers. */
export function clientSend(threadId: string, body: MsgBody) {
  const chat = useChat.getState();
  chat.post(threadId, "client", body);
  const t = chat.threads.find((x) => x.id === threadId);
  const p = t && propertyOf(t.propertyId);
  if (!t || !p) return;
  const replies = body.kind === "text" ? replyFor(typeof body.text === "string" ? body.text : body.text.ar, p) : [text("وصلت، شكراً! هراجعها وأرد عليك.", "Got it, thanks! I’ll take a look.")];

  setTimeout(() => {
    useChat.getState().markRead(threadId, "agent");
    useChat.getState().setTyping(threadId, "agent");
  }, 700);
  // Read after ~0.7 s, then "typing…" for a human-feeling moment.
  let delay = 1900 + Math.round(Math.random() * 900);
  replies.forEach((r, i) => {
    setTimeout(() => {
      const c = useChat.getState();
      c.post(threadId, "agent", r);
      if (i === replies.length - 1) c.setTyping(threadId, undefined);
      else c.setTyping(threadId, "agent");
      if (i === 0) notifyIncoming(threadId, "agent", r);
    }, delay);
    delay += 900;
  });
}

/** Advisor sends from the sales app; the demo client "reads" it shortly after. */
export function agentSend(threadId: string, body: MsgBody) {
  useChat.getState().post(threadId, "agent", body);
  const t = useChat.getState().threads.find((x) => x.id === threadId);
  if (t?.mine) notifyIncoming(threadId, "agent", body);
  else setTimeout(() => useChat.getState().markRead(threadId, "client"), 1800);
}

function notifyIncoming(threadId: string, from: Side, body: MsgBody) {
  const open = useChat.getState().open;
  if (open && open.id === threadId) return;
  const t = useChat.getState().threads.find((x) => x.id === threadId);
  if (!t || !t.mine || from !== "agent") return;
  const { lang, notify } = useStore.getState();
  const agent = agentById(t.agentId);
  const preview = { ar: previewOf({ ...body, id: "", from, at: 0, read: false } as Msg, "ar"), en: previewOf({ ...body, id: "", from, at: 0, read: false } as Msg, "en") };
  notify({ kind: "chat", title: { ar: `رسالة من ${agent.name.ar}`, en: `Message from ${agent.name.en}` }, body: preview, href: `/chat/${t.propertyId}` });
  pushNotify(lang === "ar" ? agent.name.ar : agent.name.en, preview[lang], `/chat/${t.propertyId}`);
}

/** Client picks a time from a slots card: books the viewing and confirms it in the chat. */
export function bookFromChat(threadId: string, msgId: string, propertyId: string, date: string, time: string) {
  const chat = useChat.getState();
  chat.patchMsg(threadId, msgId, { chosen: time } as Partial<Msg>);
  const p = propertyOf(propertyId);
  if (!p) return;
  const st = useStore.getState();
  st.addViewing({ id: uid(), propertyId, date, time, mode: "visit", agentId: p.agentId, status: "confirmed", reminders: ["1d", "2h"] });
  st.notify({
    kind: "booking",
    title: { ar: "تم تأكيد المعاينة", en: "Viewing confirmed" },
    body: { ar: `${fmtDate(date, "ar", { weekday: "long", day: "numeric", month: "long" })} الساعة ${fmtTime(time, "ar")}`, en: `${fmtDate(date, "en", { weekday: "long", day: "numeric", month: "long" })} at ${fmtTime(time, "en")}` },
    href: "/viewings",
  });
  chat.post(threadId, "client", { kind: "text", text: { ar: `${fmtTime(time, "ar")} مناسب ليا`, en: `${fmtTime(time, "en")} works for me` } });
  useChat.getState().setTyping(threadId, "agent");
  setTimeout(() => {
    const c = useChat.getState();
    c.markRead(threadId, "agent");
    c.post(threadId, "agent", { kind: "booking", propertyId, date, time });
    c.post(threadId, "agent", text("تمام اتأكدت ✅ هبعتلك تذكير قبلها، ولو حبيت تغير الميعاد من «معايناتي».", "Done, confirmed ✅ I’ll remind you beforehand; you can change it anytime from “My viewings”."));
    c.setTyping(threadId, undefined);
  }, 1600);
}

export function planSummary(p: Property) {
  const plan = p.plan ?? { downPct: 20, years: 5 };
  return { ...plan, ...installment(p.price, plan.downPct, plan.years) };
}

/** Name of the client as the advisor sees it; the demo client's own threads use their name. */
export function clientLabel(th: Thread, userName: string): Bi {
  if (!th.mine) return th.client;
  return userName ? { ar: `${userName} (عميل الديمو)`, en: `${userName} (demo client)` } : { ar: "عميل الديمو", en: "Demo client" };
}
