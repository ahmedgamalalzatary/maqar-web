import type { Bi } from '@maqar/shared';
import { Tabs } from 'expo-router';
import {
  Bell,
  CalendarCheck,
  Heart,
  Home,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  PlusSquare,
  Search,
  Sun,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useT } from '@/core/i18n';
import { fonts, useTheme } from '@/core/theme';

type Tab = { name: string; label: Bi; icon: LucideIcon };
export type TabRole = 'client' | 'owner' | 'agent';

const me: Tab = { name: 'me', label: { ar: 'حسابي', en: 'Me' }, icon: UserRound };
const alerts: Tab = { name: 'alerts', label: { ar: 'التنبيهات', en: 'Alerts' }, icon: Bell };

/** Tab bars per role (contract §12). `name` is the route file inside the role's folder. */
export const TABS: Record<TabRole, Tab[]> = {
  client: [
    { name: 'index', label: { ar: 'الرئيسية', en: 'Home' }, icon: Home },
    { name: 'explore', label: { ar: 'استكشف', en: 'Explore' }, icon: Search },
    { name: 'viewings', label: { ar: 'معايناتي', en: 'Viewings' }, icon: CalendarCheck },
    { name: 'saved', label: { ar: 'المحفوظة', en: 'Saved' }, icon: Heart },
    me,
  ],
  owner: [
    { name: 'index', label: { ar: 'لوحتي', en: 'Portal' }, icon: LayoutDashboard },
    { name: 'new', label: { ar: 'أضف عقار', en: 'Add' }, icon: PlusSquare },
    alerts,
    me,
  ],
  agent: [
    { name: 'index', label: { ar: 'اليوم', en: 'Today' }, icon: Sun },
    { name: 'leads', label: { ar: 'العملاء', en: 'Leads' }, icon: Users },
    { name: 'chats', label: { ar: 'الشات', en: 'Chats' }, icon: MessagesSquare },
    alerts,
    me,
  ],
};

export function RoleTabs({ role }: { role: TabRole }) {
  const t = useT();
  const { colors } = useTheme();
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
      {TABS[role].map(({ name, label, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(label),
            tabBarAccessibilityLabel: t(label),
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size - 2} strokeWidth={1.8} />,
          }}
        />
      ))}
    </Tabs>
  );
}
