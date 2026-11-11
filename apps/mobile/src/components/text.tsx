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

/**
 * The CSS textAlign for an alignment. On phones "left" means start and "right" means end: a
 * right-to-left layout swaps them. Only the web takes them literally. The platform is a parameter
 * so tests can be explicit (jest cannot fake Platform.OS reliably).
 */
export function textAlignFor(os: string, dir: 'ltr' | 'rtl', align: TxtProps['align']): TextStyle['textAlign'] {
  const startIsRight = os === 'web' && dir === 'rtl';
  if (align === 'center') return 'center';
  return (align === 'start') === startIsRight ? 'right' : 'left';
}

/** All app text. Uses Readex Pro and aligns to the reading direction. */
export function Txt({ size = 15, weight = 'regular', color = 'ink', align = 'start', style, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const dir = useDir();
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.5),
          color: colors[color],
          textAlign: textAlignFor(Platform.OS, dir, align),
          writingDirection: dir,
        },
        style,
      ]}
    />
  );
}
