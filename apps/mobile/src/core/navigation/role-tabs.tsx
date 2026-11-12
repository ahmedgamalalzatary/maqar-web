import type { Bi } from '@maqar/shared';
import { Tabs } from 'expo-router';
import {
  Bell,
  Building2,
  CalendarCheck,
  Heart,
  Home,
  LayoutGrid,
  type LucideIcon,
  MessagesSquare,
  Search,
  Sun,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/core/i18n';
import { fonts, useTheme } from '@/core/theme';

type Tab = { name: string; label: Bi; icon: LucideIcon };
export type TabRole = 'client' | 'agent' | 'admin';

/** The tab bar's height above the bottom safe area. */
export const TAB_BAR_HEIGHT = 64;

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
  agent: [
    { name: 'index', label: { ar: 'اليوم', en: 'Today' }, icon: Sun },
    { name: 'leads', label: { ar: 'العملاء', en: 'Leads' }, icon: Users },
    { name: 'chats', label: { ar: 'الشات', en: 'Chats' }, icon: MessagesSquare },
    alerts,
    me,
  ],
  // Admins list every home for owners (2026-11-09: there are no owner accounts).
  admin: [
    { name: 'index', label: { ar: 'العقارات', en: 'Listings' }, icon: Building2 },
    { name: 'agents', label: { ar: 'المسؤولين', en: 'Agents' }, icon: UserCog },
    { name: 'leads', label: { ar: 'العملاء', en: 'Leads' }, icon: Users },
    // Phase 22: clients, areas, admins and the account settings live under More.
    { name: 'more', label: { ar: 'المزيد', en: 'More' }, icon: LayoutGrid },
  ],
};

/** `badges`: a count to show on a tab, by the tab's `name` (the role's layout passes them in). */
export function RoleTabs({ role, badges = {} }: { role: TabRole; badges?: Record<string, number> }) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentInk,
        tabBarInactiveTintColor: colors.ink3,
        // Arabic glyphs in Readex Pro sit lower than Latin ones: give the label a real line
        // height and the bar room for it, or the bottom of the words gets cut off.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        // When the label sits under the icon (narrow screens) it must not be squeezed.
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, flexShrink: 0 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS[role].map(({ name, label, icon: Icon }) => {
        const count = badges[name] ?? 0;
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: t(label),
              tabBarAccessibilityLabel: count ? t(`${label.ar}، ${count} جديد`, `${label.en}, ${count} new`) : t(label),
              tabBarBadge: count ? (count > 9 ? '9+' : count) : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.navy, fontFamily: fonts.semibold, fontSize: 10 },
              tabBarIcon: ({ color, size }) => <Icon color={color} size={size - 2} strokeWidth={1.8} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
