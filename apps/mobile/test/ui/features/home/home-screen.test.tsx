import { fireEvent, screen } from '@testing-library/react-native';
import { useSettings } from '@/core/settings/store';
import { renderWithProviders } from '../../../utils/render';
import { Home } from '@/features/home/screens/home-screen';

beforeEach(() => {
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
});

describe('Home (phase 0)', () => {

  it('switches the language with one tap from the header', async () => {
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(useSettings.getState().lang).toBe('en');
    expect(screen.getByText('Checking the connection…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'العربية' })).toBeOnTheScreen();
  });

  it('switches to dark mode with one tap from the header', async () => {
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'الوضع الداكن' }));
    expect(useSettings.getState().theme).toBe('dark');
    await fireEvent.press(screen.getByRole('button', { name: 'الوضع الفاتح' }));
    expect(useSettings.getState().theme).toBe('light');
  });
});
