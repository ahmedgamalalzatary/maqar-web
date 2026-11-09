import { Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useDir } from '@/core/i18n';
import { type Colors, fonts, useTheme } from '@/core/theme';

type Weight = keyof typeof fonts;

export type TxtProps = TextProps & {
  size?: number;
  weight?: Weight;
  color?: keyof Colors;
  align?: 'start' | 'center' | 'end';
};

/** All app text. Uses Readex Pro and aligns to the reading direction. */
export function Txt({ size = 15, weight = 'regular', color = 'ink', align = 'start', style, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const dir = useDir();
  // On phones "left" means start and "right" means end: a right-to-left layout swaps them.
  // Only the web takes them literally.
  const startIsRight = Platform.OS === 'web' && dir === 'rtl';
  const textAlign: TextStyle['textAlign'] =
    align === 'center' ? 'center' : (align === 'start') === startIsRight ? 'right' : 'left';
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.5),
          color: colors[color],
          textAlign,
          writingDirection: dir,
        },
        style,
      ]}
    />
  );
}
