import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleTabs, TAB_BAR_HEIGHT } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';
import { ChatFab } from '@/features/chat/components/chat-fab';
import { CompareTray } from '@/features/compare/components/compare-tray';
import { useUpcoming } from '@/features/viewings/hooks/use-viewings';

export default function ClientTabs() {
  const insets = useSafeAreaInsets();
  const upcoming = useUpcoming().length;
  return (
    <RoleGate role="client">
      <View style={{ flex: 1 }}>
        <RoleTabs role="client" badges={{ viewings: upcoming }} />
        <ChatFab />
        <CompareTray bottom={TAB_BAR_HEIGHT + insets.bottom} />
      </View>
    </RoleGate>
  );
}
