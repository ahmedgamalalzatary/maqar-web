import { screen } from '@testing-library/react-native';
import { Home } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { TabIcon } from '@/core/navigation/role-tabs';
import { renderWithProviders } from '../../utils/render';

const dot = () => StyleSheet.flatten(screen.getByTestId('tab-dot').props.style);

// 2026-11-16: the picked tab shows a gold dot under its icon; the others don't.
describe('TabIcon', () => {
  it('shows the dot on the picked tab only', async () => {
    const { rerender } = await renderWithProviders(<TabIcon icon={Home} color="#000" size={22} focused={false} dot="#b38959" />);
    expect(dot().opacity).toBe(0);

    await rerender(<TabIcon icon={Home} color="#000" size={22} focused dot="#b38959" />);
    expect(dot().opacity).toBe(1);
    expect(dot().backgroundColor).toBe('#b38959');
  });
});
