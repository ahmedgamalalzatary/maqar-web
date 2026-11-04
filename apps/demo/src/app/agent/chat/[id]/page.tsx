"use client";

import { useParams } from "next/navigation";
import { useChat } from "@/lib/chat";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { ChatView } from "@/components/ChatView";

export default function AgentChat() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const thread = useChat((s) => s.threads.find((x) => x.id === id));
  if (!thread) return <PageHeader title={t("المحادثة غير موجودة", "Conversation not found")} fallback="/agent/chats" />;
  return <ChatView threadId={id} propertyId={thread.propertyId} as="agent" />;
}
