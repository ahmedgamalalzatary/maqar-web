import { Tabs } from 'expo-router';
import { Calculator, Home, Info } from 'lucide-react-native';
import { useT } from '@/core/i18n';
import { AppProviders } from '@/core/providers/app-providers';
import { fonts, useTheme } from '@/core/theme';

/** Routes of the store build (APP_VARIANT=store): three screens, no server needed. */
export default function StoreLayout() {
  return (
    <AppProviders>
      <StoreTabs />
    </AppProviders>
  );
}

function StoreTabs() {
  const t = useT();
  const { colors } = useTheme();
  const tabs = [
    { name: 'index', label: t('الرئيسية', 'Home'), Icon: Home },
    { name: 'calculator', label: t('الحاسبة', 'Calculator'), Icon: Calculator },
    { name: 'about', label: t('عن مقر', 'About'), Icon: Info },
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentInk,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {tabs.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarAccessibilityLabel: label,
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size - 2} strokeWidth={1.8} />,
          }}
        />
      ))}
    </Tabs>
  );
}
