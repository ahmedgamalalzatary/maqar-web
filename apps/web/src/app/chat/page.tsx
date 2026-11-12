import { Suspense } from "react";
import { ChatPage } from "@/components/chats-page";

/** `/chat/?id=7`: a query, not a path, because the dashboard is a static export. */
export default function Page() {
  return (
    <Suspense>
      <ChatPage />
    </Suspense>
  );
}
