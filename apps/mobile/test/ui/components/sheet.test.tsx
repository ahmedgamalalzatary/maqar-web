import { screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { Sheet } from '@/components/sheet';
import { renderWithProviders } from '../../utils/render';

// The top inset is 47 in tests (test/utils/render.tsx).
describe('Sheet', () => {
  // Found on the phone: the agent's 14-day list grew under the status bar and hid the title.
  it('never grows under the status bar, and scrolls a long list inside', async () => {
    await renderWithProviders(
      <Sheet open onClose={() => {}} title="Pick a day" scroll>
        {Array.from({ length: 30 }, (_, i) => (
          <Text key={i}>day {i}</Text>
        ))}
      </Sheet>,
    );
    const sheet = StyleSheet.flatten(screen.getByTestId('sheet').props.style);
    expect(sheet.maxHeight).toBeLessThanOrEqual(Dimensions.get('window').height - 47);
    expect(screen.getByText('Pick a day')).toBeOnTheScreen();
    expect(screen.getByTestId('sheet-body')).toBeOnTheScreen();
  });
});
