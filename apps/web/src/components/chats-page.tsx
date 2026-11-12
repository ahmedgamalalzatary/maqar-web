"use client";

import { type AdminChatDetail, type ChatReport, type ChatReportReason, chatPreview, fmtDate, fmtNum, relTime, type ReportOutcome } from "@maqar/shared";
import { Flag, Lock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { readId } from "@/lib/admin";
import { useLang, useT } from "@/lib/i18n";
import { useAdminChat, useAdminChatMessages, useAdminChats, useResolveReport, useUnblockChat } from "@/lib/people";
import { useNotice } from "./shell";
import { Button, Card, Chip, useErrorText } from "./ui";

const REASON_LABEL: Record<ChatReportReason, { ar: string; en: string }> = {
  spam: { ar: "إزعاج أو سبام", en: "Spam or nuisance" },
  abuse: { ar: "إساءة", en: "Abuse" },
  scam: { ar: "نصب", en: "Scam" },
  other: { ar: "حاجة تانية", en: "Something else" },
};
const OUTCOME_LABEL: Record<ReportOutcome, { ar: string; en: string }> = {
  dismissed: { ar: "اتقفل من غير إجراء", en: "Dismissed" },
  blocked: { ar: "المحادثة اتقفلت", en: "Conversation closed" },
  suspended: { ar: "حساب العميل اتوقف", en: "Client suspended" },
};

/** `/chats/` (phase 24): every conversation, the reported ones first; read-only. */
export function ChatsPage() {
  const t = useT();
  const lang = useLang();
  const [reported, setReported] = useState(true);
  const [page, setPage] = useState(1);
  const chats = useAdminChats({ reported, page });
  const pages = chats.data ? Math.max(1, Math.ceil(chats.data.total / chats.data.limit)) : 1;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("الشاتات", "Chats")}</h1>
        <p className="text-sm text-ink-2">{t("قراية بس: مبتبعتش، وفتحها مش بيعلّم الرسايل اتقرت.", "Read-only: you cannot send, and opening one marks nothing read.")}</p>
      </div>
      <div role="radiogroup" className="flex gap-2">
        {[true, false].map((r) => (
          <Chip
            key={String(r)}
            selected={reported === r}
            onClick={() => {
              setReported(r);
              setPage(1);
            }}
          >
            {r ? t("فيها بلاغات", "With reports") : t("الكل", "All")}
          </Chip>
        ))}
      </div>
      {chats.isPending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
      ) : chats.isError ? (
        <Card>{t("مقدرناش نجيب الشاتات", "We couldn’t load the chats")}</Card>
      ) : !chats.data.items.length ? (
        <Card>{reported ? t("مفيش بلاغات مفتوحة", "No open reports") : t("مفيش شاتات", "No chats")}</Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {chats.data.items.map((c) => (
            <li key={c.id}>
              <Link href={`/chat/?id=${c.id}`} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60">
                <span className="flex items-center gap-2 font-medium">
                  <span className="flex-1">{`${c.client?.name ?? t("حساب اتمسح", "Deleted account")} ↔ ${lang === "ar" ? c.agent.nameAr : c.agent.nameEn}`}</span>
                  {c.openReports ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                      <Flag className="size-3" aria-hidden />
                      {fmtNum(c.openReports, lang)}
                    </span>
                  ) : null}
                  {c.blocked ? <Lock className="size-4 text-ink-3" aria-label={t("مقفولة", "Closed")} /> : null}
                </span>
                <span className="text-sm text-ink-2">{lang === "ar" ? c.property.titleAr : c.property.titleEn}</span>
                {c.last ? <span className="truncate text-xs text-ink-3">{`${chatPreview(c.last.body, lang)} | ${relTime(new Date(c.last.createdAt), lang)}`}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
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

/** `/chat/?id=7` (phase 24): one conversation, read-only, with its reports and what to do about them. */
export function ChatPage() {
  const t = useT();
  const id = readId(useSearchParams().get("id"));
  const chat = useAdminChat(id);
  if (id === undefined) return <Card>{t("الرابط مش صحيح: مفيش رقم محادثة.", "That link is not right: no conversation number.")}</Card>;
  if (chat.isError) return <Card>{t("المحادثة دي مش موجودة أو مقدرناش نجيبها.", "This conversation does not exist, or we couldn’t load it.")}</Card>;
  if (!chat.data) return <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />;
  return <ChatBody c={chat.data} />;
}

function ChatBody({ c }: { c: AdminChatDetail }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const messages = useAdminChatMessages(c.id);
  const unblock = useUnblockChat(c.id);
  const list = (messages.data?.pages.slice().reverse() ?? []).flatMap((p) => p.items);
  const agentName = lang === "ar" ? c.agent.nameAr : c.agent.nameEn;
  const clientName = c.client?.name ?? t("حساب اتمسح", "Deleted account");
  const open = c.reports.filter((r) => !r.resolvedAt);
  const closed = c.reports.filter((r) => r.resolvedAt);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold">{`${clientName} ↔ ${agentName}`}</h1>
          <p className="text-sm text-ink-2">
            {lang === "ar" ? c.property.titleAr : c.property.titleEn}
            {c.client ? (
              <>
                {" | "}
                <Link href={`/client/?id=${c.client.id}`} className="text-accent-ink hover:underline">
                  {t("حساب العميل", "The client’s account")}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {messages.hasNextPage ? (
          <Button variant="ghost" loading={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()}>
            {t("رسايل أقدم", "Older messages")}
          </Button>
        ) : null}
        <ol className="flex flex-col gap-2">
          {list.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-2xl border border-line p-3 text-sm ${m.sender === "agent" ? "self-end bg-surface-2" : "self-start bg-surface"}`}>
              <span className="block text-xs text-ink-3">{`${m.sender === "client" ? clientName : agentName} | ${relTime(new Date(m.createdAt), lang)}`}</span>
              {m.body.kind === "text" ? m.body.text : chatPreview(m.body, lang)}
            </li>
          ))}
        </ol>
      </Card>
      <div className="flex flex-col gap-4 self-start">
        {c.blocked ? (
          <Card className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm">
              <Lock className="size-4 text-ink-2" aria-hidden />
              {c.blocked.by === "admin" ? t("فريق مقر قفل المحادثة.", "The Maqar team closed it.") : c.blocked.by === "agent" ? t("المسؤول قفل المحادثة.", "The advisor closed it.") : t("العميل قفل المحادثة.", "The client closed it.")}
            </p>
            <Button variant="secondary" loading={unblock.isPending} onClick={() => unblock.mutate(undefined, { onSuccess: () => notice({ text: t("المحادثة اتفتحت", "Conversation opened"), tone: "ok" }) })}>
              {t("افتح المحادثة تاني", "Open it again")}
            </Button>
          </Card>
        ) : null}
        {open.map((r) => (
          <ReportCard key={r.id} r={r} blocked={!!c.blocked} />
        ))}
        {closed.length ? (
          <Card className="flex flex-col gap-1 text-sm">
            <h2 className="font-semibold">{t("بلاغات اتقفلت", "Closed reports")}</h2>
            {closed.map((r) => (
              <p key={r.id} className="text-ink-2">
                {`${t(REASON_LABEL[r.reason])} | ${t(OUTCOME_LABEL[r.outcome!])} | ${fmtDate(r.resolvedAt!.slice(0, 10), lang)}${r.resolvedBy ? ` | ${r.resolvedBy.name}` : ""}`}
              </p>
            ))}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ReportCard({ r, blocked }: { r: ChatReport; blocked: boolean }) {
  const t = useT();
  const lang = useLang();
  const notice = useNotice();
  const errorText = useErrorText();
  const resolve = useResolveReport();
  const act = (outcome: ReportOutcome) =>
    resolve.mutate({ id: r.id, outcome }, { onSuccess: () => notice({ text: t(OUTCOME_LABEL[outcome]), tone: "ok" }), onError: (e) => notice({ text: errorText(e), tone: "bad" }) });
  return (
    <Card className="flex flex-col gap-2 border-danger">
      <p className="flex items-center gap-2 font-medium">
        <Flag className="size-4 text-danger" aria-hidden />
        <span className="flex-1">{t(REASON_LABEL[r.reason])}</span>
        <span className="text-xs text-ink-3">{relTime(new Date(r.createdAt), lang)}</span>
      </p>
      <p className="text-sm text-ink-2">{r.by === "agent" ? t(`من المسؤول${r.reporter ? `: ${r.reporter.name}` : ""}`, `By the advisor${r.reporter ? `: ${r.reporter.name}` : ""}`) : t("من العميل", "By the client")}</p>
      {r.note ? <p className="text-sm">{r.note}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={resolve.isPending} onClick={() => act("dismissed")}>
          {t("اقفل البلاغ بس", "Dismiss")}
        </Button>
        {blocked ? null : (
          <Button variant="secondary" loading={resolve.isPending} onClick={() => act("blocked")}>
            {t("اقفل المحادثة", "Close the conversation")}
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-danger"
          loading={resolve.isPending}
          onClick={() => {
            if (window.confirm(t("توقف حساب العميل؟ هيتعمله خروج ومعايناته الجاية هتتلغي.", "Suspend the client? They are signed out and their upcoming viewings are cancelled."))) act("suspended");
          }}
        >
          {t("وقّف حساب العميل", "Suspend the client")}
        </Button>
      </div>
    </Card>
  );
}
