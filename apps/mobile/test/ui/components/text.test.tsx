import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Txt, textAlignFor } from '@/components/text';
import { useSettings } from '@/core/settings/store';

const alignOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).textAlign;

// jest cannot fake Platform.OS for the component (it resolves another instance), so the platform
// behaviors are asserted on the pure helper, and the render test checks the wiring without it.
describe('textAlignFor', () => {
  it.each([
    ['android', 'ar', 'start', 'left'],
    ['android', 'ar', 'end', 'right'],
    ['android', 'en', 'start', 'left'],
    ['android', 'en', 'end', 'right'],
    ['android', 'ar', 'center', 'center'],
  ] as const)('on a phone, %s %s text asks for %s', (_os, lang, align, expected) => {
    expect(textAlignFor('android', lang === 'ar' ? 'rtl' : 'ltr', align)).toBe(expected);
  });

  it.each([
    ['ar', 'start', 'right'],
    ['ar', 'end', 'left'],
    ['en', 'start', 'left'],
    ['en', 'end', 'right'],
  ] as const)('on the web, %s %s text asks for %s', (lang, align, expected) => {
    expect(textAlignFor('web', lang === 'ar' ? 'rtl' : 'ltr', align)).toBe(expected);
  });
});

describe('Txt rendering', () => {
  it('applies the alignment to the text', async () => {
    useSettings.setState({ lang: 'en' });
    await render(<Txt align="center">x</Txt>);
    expect(alignOf('x')).toBe('center');
  });
});
