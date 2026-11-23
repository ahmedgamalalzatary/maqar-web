import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { EASE_OUT } from '@/core/motion/motion';
import { useTheme } from '@/core/theme';

// The colour lock-up from the brand book (assets/mqr-branding.pdf): مقر, MQR in gold, the tagline and the sage square.
const RATIO = 351 / 460;
const gold = require('../../assets/brand/logo-gold.png');
const cream = require('../../assets/brand/logo-cream.png');
const sage = require('../../assets/brand/logo-sage.png');

// 2026-11-16: with `animated`, the gold mark settles in, then the cream word rises, then the sage line.
const GOLD_IN = ZoomIn.duration(420).easing(EASE_OUT).withInitialValues({ transform: [{ scale: 0.9 }] });
const CREAM_IN = FadeInDown.delay(180).duration(380).easing(EASE_OUT);
const SAGE_IN = FadeIn.delay(380).duration(360).easing(EASE_OUT);

/** The مقر lock-up in colour layers, so the cream parts turn navy on light backgrounds. */
export function Logo({ width = 120, onDark = false, animated = false }: { width?: number; onDark?: boolean; animated?: boolean }) {
  const { colors } = useTheme();
  const size = { width, height: width * RATIO };
  const layer = [StyleSheet.absoluteFill, size];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="مقر MQR | لكل طموح مقر" style={size}>
      <Animated.View entering={animated ? GOLD_IN : undefined} style={layer}>
        <Image source={gold} style={size} tintColor={colors.gold} contentFit="fill" />
      </Animated.View>
      <Animated.View entering={animated ? CREAM_IN : undefined} style={layer}>
        <Image source={cream} style={size} tintColor={onDark ? colors.cream : colors.logoCream} contentFit="fill" />
      </Animated.View>
      <Animated.View entering={animated ? SAGE_IN : undefined} style={layer}>
        <Image source={sage} style={size} tintColor={colors.sage} contentFit="fill" />
      </Animated.View>
    </View>
  );
}
