"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/ChatView";

export default function ClientChat() {
  const { id } = useParams<{ id: string }>();
  return <ChatView threadId={`c-${id}`} propertyId={id} as="client" />;
}
