import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { IconButton } from '@/components/icon-button';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { m, useT } from '@/core/i18n';
import { EASE_IN_OUT, EASE_OUT } from '@/core/motion/motion';
import { useTheme } from '@/core/theme';
import { useUnreadCount } from '../hooks/use-notifications';

/** The swing, in degrees: out, back past the middle, and smaller each time until it hangs still. */
export const SWING = [16, -13, 9, -5, 2, 0];
const DOT_IN = ZoomIn.duration(220).easing(EASE_OUT);

/**
 * The bell on Home (contract §8.2): opens the inbox, with a dot while something is unread.
 * 2026-11-16: when the unread count goes up, the bell swings once from its top and the dot pops in.
 */
export function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const unread = useUnreadCount();
  const label = unread > 0 ? t(m.notifications.bellNew(unread)) : t(m.common.notifications);
  const last = useRef(unread);
  const angle = useSharedValue(0);

  useEffect(() => {
    const up = unread > last.current;
    last.current = unread;
    if (!up || reduced) return;
    angle.set(withSequence(...SWING.map((deg) => withTiming(deg, { duration: 110, easing: EASE_IN_OUT }))));
  }, [unread, reduced, angle]);

  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <View>
      <IconButton
        label={label}
        onPress={() => router.push('/notifications')}
        icon={
          <Animated.View testID="bell" style={[styles.hang, swing]}>
            <Bell color={colors.ink} size={20} strokeWidth={1.8} />
          </Animated.View>
        }
      />
      {unread > 0 ? (
        <Animated.View entering={DOT_IN} testID="bell-dot" pointerEvents="none" style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.surface }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // A bell hangs from its top.
  hang: { transformOrigin: 'center top' },
  dot: { position: 'absolute', top: 10, end: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
