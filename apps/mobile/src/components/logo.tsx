import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/core/theme';

const RATIO = 269 / 349;
const gold = require('../../assets/brand/logo-gold.png');
const cream = require('../../assets/brand/logo-cream.png');
const sage = require('../../assets/brand/logo-sage.png');

/** The مقر lock-up in colour layers, so the cream parts turn navy on light backgrounds. */
export function Logo({ width = 120, onDark = false }: { width?: number; onDark?: boolean }) {
  const { colors } = useTheme();
  const size = { width, height: width * RATIO };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="مقر MAQAR | لكل طموح مقر" style={size}>
      <Image source={gold} style={[StyleSheet.absoluteFill, size]} tintColor={colors.gold} contentFit="fill" />
      <Image
        source={cream}
        style={[StyleSheet.absoluteFill, size]}
        tintColor={onDark ? colors.cream : colors.logoCream}
        contentFit="fill"
      />
      <Image source={sage} style={[StyleSheet.absoluteFill, size]} tintColor={colors.sage} contentFit="fill" />
    </View>
  );
}
