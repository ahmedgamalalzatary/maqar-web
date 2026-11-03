"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCheck, MessagesSquare } from "lucide-react";
import { agentById } from "@/lib/data";
import { relTime, useLang, useT, fmtNum } from "@/lib/i18n";
import { useChat, previewOf, propertyOf, clientLabel, type Side } from "@/lib/chat";
import { useStore } from "@/lib/store";
import { Avatar, Button, Empty, cx } from "./ui";

export function ChatList({ as }: { as: Side }) {
  const t = useT();
  const lang = useLang();
  const threads = useChat((s) => s.threads);
  const typing = useChat((s) => s.typing);
  const userName = useStore((s) => s.name);
  const list = threads
    .filter((th) => (as === "client" ? th.mine : true))
    .filter((th) => th.messages.length > 0)
    .sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));

  if (!list.length)
    return (
      <Empty
        icon={<MessagesSquare className="size-7" />}
        title={t("مفيش محادثات لسه", "No conversations yet")}
        body={t("افتح أي وحدة واضغط «شات» عشان تكلم مسؤول المبيعات بتاعها مباشرة.", "Open any home and tap “Chat” to talk to its sales advisor directly.")}
        action={<Button href="/explore">{t("استكشف الوحدات", "Explore homes")}</Button>}
      />
    );

  return (
    <div className="space-y-2 px-4 pt-1">
      {list.map((th) => {
        const p = propertyOf(th.propertyId);
        const agent = agentById(th.agentId);
        const last = th.messages.at(-1);
        const unread = th.messages.filter((m) => m.from !== as && !m.read).length;
        const isTyping = typing[th.id] && typing[th.id] !== as;
        const client = clientLabel(th, userName);
        const name = as === "client" ? t(agent.name) : t(client);
        const href = as === "client" ? `/chat/${th.propertyId}` : `/agent/chat/${th.id}`;
        return (
          <Link key={th.id} href={href} className={cx("flex items-center gap-3 rounded-3xl p-3 ring-1 transition active:scale-[0.99]", unread ? "bg-accent-soft ring-accent/25" : "bg-surface ring-line")}>
            <span className="relative shrink-0">
              <Avatar name={as === "client" ? agent.name.en : th.mine ? userName || "Demo Client" : th.client.en} tone={as === "client" ? agent.tone : "#61766d"} size={50} />
              {p && (
                <span className={cx("absolute -bottom-1 -end-1 size-6 overflow-hidden rounded-lg ring-2", unread ? "ring-bg" : "ring-surface")}>
                  <Image src={p.images[0]} alt="" fill sizes="24px" className="object-cover" unoptimized={p.images[0].startsWith("data:")} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[14.5px] font-semibold">{name}</span>
                <span className={cx("shrink-0 text-[11px]", unread ? "font-semibold text-accent-ink" : "text-ink-3")}>{last && relTime(last.at, lang)}</span>
              </span>
              <span className="block truncate text-[11.5px] text-ink-3">{p ? t(p.title) : ""}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {last?.from === as && <CheckCheck className={cx("size-3.5 shrink-0", last.read ? "text-accent" : "text-ink-3")} />}
                <span className={cx("min-w-0 flex-1 truncate text-[13px]", isTyping ? "text-accent-ink" : unread ? "font-medium text-ink" : "text-ink-2")}>
                  {isTyping ? t("بيكتب…", "typing…") : previewOf(last, lang)}
                </span>
                {unread > 0 && <span className="tabular grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-navy">{fmtNum(unread, lang)}</span>}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
