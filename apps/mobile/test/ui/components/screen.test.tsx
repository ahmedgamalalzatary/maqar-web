import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { COMPARE_TRAY_SPACE } from '@/features/compare/components/compare-tray';
import { useCompare } from '@/features/compare/store/compare.store';
import { renderWithProviders } from '../../utils/render';

const bottomPad = () => StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle).paddingBottom;

beforeEach(() => useCompare.setState({ homes: [] }));

// The compare bar floats over the tab screens: while it shows, a page keeps room under its last
// line, so the end of the page (the account footer, 2026-11-12 phone check) is never hidden.
it('leaves room under the page while homes wait to be compared', async () => {
  const { rerender } = await renderWithProviders(
    <Screen>
      <Txt>Last line</Txt>
    </Screen>,
  );
  const base = bottomPad();

  useCompare.setState({ homes: [{ id: 4, title: { ar: 'شقة', en: 'Flat' }, cover: null } as never] });
  await rerender(
    <Screen>
      <Txt>Last line</Txt>
    </Screen>,
  );
  expect(bottomPad()).toBe(base + COMPARE_TRAY_SPACE);
});
