import type { Bi } from '@mqr/shared';
import { Tabs } from 'expo-router';
import {
  Bell,
  Building2,
  CalendarCheck,
  Heart,
  Home,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  MessagesSquare,
  Search,
  Sun,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { type ColorValue, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { BOUNCE, CSS_EASE_OUT, EASE_OUT } from '@/core/motion/motion';
import { m, useT } from '@/core/i18n';
import { fonts, useTheme } from '@/core/theme';

type Tab = { name: string; label: Bi; icon: LucideIcon };
export type TabRole = 'client' | 'agent' | 'admin';

/** The tab bar's height above the bottom safe area. */
export const TAB_BAR_HEIGHT = 64;

const me: Tab = { name: 'me', label: m.common.me, icon: UserRound };
const alerts: Tab = { name: 'alerts', label: m.common.alerts, icon: Bell };

/** Tab bars per role (contract §12). `name` is the route file inside the role's folder. */
export const TABS: Record<TabRole, Tab[]> = {
  client: [
    { name: 'index', label: m.common.home, icon: Home },
    { name: 'explore', label: m.common.explore, icon: Search },
    { name: 'viewings', label: m.common.tabsViewings, icon: CalendarCheck },
    { name: 'saved', label: m.saved.saved, icon: Heart },
    me,
  ],
  agent: [
    { name: 'index', label: m.common.tabsToday, icon: Sun },
    { name: 'leads', label: m.admin.leads, icon: Users },
    { name: 'chats', label: m.common.tabsChats, icon: MessagesSquare },
    alerts,
    me,
  ],
  // Admins list every home for owners (2026-11-09: there are no owner accounts).
  admin: [
    // Phase 25: the overview opens first; Listings is the second tab.
    { name: 'index', label: m.admin.overview, icon: LayoutDashboard },
    { name: 'listings', label: m.admin.listings, icon: Building2 },
    { name: 'agents', label: m.admin.agents, icon: UserCog },
    { name: 'leads', label: m.admin.leads, icon: Users },
    // Phase 22: clients, areas, admins and the account settings live under More.
    { name: 'more', label: m.account.more, icon: LayoutGrid },
  ],
};

/**
 * A tab's icon (2026-11-16). When the tab is picked, the icon dips and springs back and a gold dot
 * fades in under it; the screens themselves switch with no slide, as tabs are side by side.
 */
export function TabIcon({ icon: Icon, color, size, focused, dot }: { icon: LucideIcon; color: ColorValue; size: number; focused: boolean; dot: string }) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    // Not on the first draw: only a tap that picks the tab bounces it.
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused && !reduced) scale.set(withSequence(withTiming(0.82, { duration: 90, easing: EASE_OUT }), withSpring(1, BOUNCE)));
  }, [focused, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <View style={tabStyles.wrap}>
      <Animated.View style={style}>
        <Icon color={color} size={size} strokeWidth={focused ? 2.1 : 1.8} />
      </Animated.View>
      <Animated.View
        testID="tab-dot"
        style={[tabStyles.dot, { backgroundColor: dot, opacity: focused ? 1 : 0, transform: [{ scale: focused ? 1 : 0.4 }] }]}
      />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  dot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    transitionProperty: ['opacity', 'transform'],
    transitionDuration: 200,
    transitionTimingFunction: CSS_EASE_OUT,
  },
});

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
              tabBarAccessibilityLabel: count ? t(m.common.tabWithNew(label, count)) : t(label),
              tabBarBadge: count ? (count > 9 ? '9+' : count) : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.navy, fontFamily: fonts.semibold, fontSize: 10 },
              tabBarIcon: ({ color, size, focused }) => <TabIcon icon={Icon} color={color} size={size - 2} focused={focused} dot={colors.accent} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
