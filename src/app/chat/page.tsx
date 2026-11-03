"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { ChatList } from "@/components/ChatList";

export default function ChatInbox() {
  const t = useT();
  return (
    <div>
      <PageHeader title={t("المحادثات", "Messages")} subtitle={t("كلّم مسؤول المبيعات مباشرة، من غير وسيط", "Talk to sales advisors directly, no middleman")} />
      <ChatList as="client" />
    </div>
  );
}
