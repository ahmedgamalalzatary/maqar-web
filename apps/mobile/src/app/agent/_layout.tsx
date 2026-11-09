import { RoleTabs } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';
import { useUnreadCount } from '@/features/notifications/hooks/use-notifications';

export default function AgentTabs() {
  const unread = useUnreadCount();
  return (
    <RoleGate role="agent">
      <RoleTabs role="agent" badges={{ alerts: unread }} />
    </RoleGate>
  );
}
