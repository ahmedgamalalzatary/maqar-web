import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { Txt } from '@/components/text';
import { useSettings } from '@/core/settings/store';

const alignOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).textAlign;

afterEach(() => jest.restoreAllMocks());

// On phones, left and right mean start and end: inside a right-to-left layout React Native swaps
// them. Asking for "right" in Arabic puts the text on the left. The web does not swap.
describe('Txt alignment', () => {
  it.each([
    ['ar', 'start', 'left'],
    ['ar', 'end', 'right'],
    ['en', 'start', 'left'],
    ['en', 'end', 'right'],
    ['ar', 'center', 'center'],
  ] as const)('on a phone, %s %s text asks for %s', async (lang, align, expected) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    useSettings.setState({ lang });
    await render(<Txt align={align}>x</Txt>);
    expect(alignOf('x')).toBe(expected);
  });

  it.each([
    ['ar', 'start', 'right'],
    ['ar', 'end', 'left'],
    ['en', 'start', 'left'],
    ['en', 'end', 'right'],
  ] as const)('on the web, %s %s text asks for %s', async (lang, align, expected) => {
    jest.replaceProperty(Platform, 'OS', 'web');
    useSettings.setState({ lang });
    await render(<Txt align={align}>x</Txt>);
    expect(alignOf('x')).toBe(expected);
  });
});
