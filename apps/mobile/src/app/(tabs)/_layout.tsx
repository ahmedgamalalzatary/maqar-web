import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleTabs, TAB_BAR_HEIGHT } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';
import { CompareTray } from '@/features/compare/components/compare-tray';

export default function ClientTabs() {
  const insets = useSafeAreaInsets();
  return (
    <RoleGate role="client">
      <View style={{ flex: 1 }}>
        <RoleTabs role="client" />
        <CompareTray bottom={TAB_BAR_HEIGHT + insets.bottom} />
      </View>
    </RoleGate>
  );
}
