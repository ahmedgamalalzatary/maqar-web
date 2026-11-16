import { act, screen, waitFor } from '@testing-library/react-native';
import { switchTheme, ThemeSwitchHost } from '@/components/theme-switch';
import { renderWithProviders } from '../../utils/render';

// 2026-11-16: the new theme's colour spreads from the button, then the theme changes under it.
describe('Switching light and dark', () => {
  it('applies at once when nothing on screen can show the spread', () => {
    const apply = jest.fn();
    switchTheme('dark', { x: 10, y: 10 }, apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('spreads the new colour first, applies under it, then clears', async () => {
    const apply = jest.fn();
    await renderWithProviders(<ThemeSwitchHost />);

    await act(() => switchTheme('dark', { x: 300, y: 80 }, apply));
    expect(screen.getByTestId('theme-switch', { includeHiddenElements: true })).toBeOnTheScreen();

    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('theme-switch', { includeHiddenElements: true })).toBeNull());
  });
});
