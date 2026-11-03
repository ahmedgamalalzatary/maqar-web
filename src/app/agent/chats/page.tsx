"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { ChatList } from "@/components/ChatList";

export default function AgentInbox() {
  const t = useT();
  return (
    <div>
      <PageHeader back={false} title={t("محادثات العملاء", "Client chats")} subtitle={t("رد بسرعة، وابعت مواعيد وخطط سداد بضغطة", "Reply fast; send times and payment plans in one tap")} />
      <ChatList as="agent" />
    </div>
  );
}
