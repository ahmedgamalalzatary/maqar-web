import { RoleTabs } from '@/core/navigation/role-tabs';
import { useChatUnread } from '@/features/chat/hooks/use-chat';
import { useUnreadCount } from '@/features/notifications/hooks/use-notifications';

/** The agent's tabs (contract §12). The role check is in the agent layout above. */
export default function AgentTabs() {
  const unread = useUnreadCount();
  const chats = useChatUnread();
  return <RoleTabs role="agent" badges={{ alerts: unread, chats }} />;
}
