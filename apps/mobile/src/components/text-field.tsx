import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { useDir } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { Txt } from './text';

type Props = Omit<TextInputProps, 'style'> & { label: string; error?: string };

/** A labelled input. The label is also what screen readers announce. */
export function TextField({ label, error, ...input }: Props) {
  const { colors } = useTheme();
  const dir = useDir();
  return (
    <View style={styles.wrap}>
      <Txt size={13} weight="medium" color="ink2">
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.ink3}
        {...input}
        style={[
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.line2,
            textAlign: dir === 'rtl' ? 'right' : 'left',
          },
        ]}
      />
      {error ? (
        <Txt size={12.5} color="danger">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
