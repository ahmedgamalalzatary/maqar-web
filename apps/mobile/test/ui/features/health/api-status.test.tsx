import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../utils/render';
import { ApiStatus } from '@/features/health/components/api-status';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const health = () =>
  new Response(JSON.stringify({ status: 'ok', db: 'up', version: '0.0.1', time: '2026-11-08T12:00:00.000Z' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ApiStatus', () => {

  it('says it is connected when the API is healthy', async () => {
    fetchMock.mockResolvedValue(health());
    await renderWithProviders(<ApiStatus />);
    expect(await screen.findByText('متصل بالخادم')).toBeOnTheScreen();
  });

  it('shows an error with a retry button when the API cannot be reached, and retries', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue(health());
    await renderWithProviders(<ApiStatus />);
    expect(await screen.findByText('مش قادرين نوصل للخادم')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByText('متصل بالخادم')).toBeOnTheScreen();
  });
});
