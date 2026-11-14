import { DEFAULT_APP_SETTINGS, type SplashSettings } from '@maqar/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { useAppConfig } from '@/core/app-config/store';
import { OpeningHost, OpeningScreen } from '@/features/splash/components/opening-screen';
import { jsonResponse, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

const image: SplashSettings = { kind: 'image', media: '/uploads/listings/a.jpg', poster: null, textAr: 'بيتك الجاي هنا', textEn: 'Your next home is here' };
const video: SplashSettings = { kind: 'video', media: '/uploads/videos/v.mp4', poster: '/uploads/videos/v.jpg', textAr: '', textEn: '' };

beforeEach(() => {
  jest.useFakeTimers();
  useAppConfig.setState({ config: DEFAULT_APP_SETTINGS });
  mockFetch().mockResolvedValue(jsonResponse(200, DEFAULT_APP_SETTINGS));
});
afterEach(() => jest.useRealTimers());

// Phase 29: the opening screen an admin sets: a picture, a video of at most 3 seconds, text.
describe('The opening screen', () => {
  it('shows the picture with the text in the app’s language, then goes away by itself', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<OpeningScreen splash={image} onDone={onDone} />);
    expect(screen.getByText('بيتك الجاي هنا')).toBeOnTheScreen();
    expect(JSON.stringify(screen.getByTestId('opening-image').props.source)).toContain('/uploads/listings/a.jpg');
    await act(async () => jest.advanceTimersByTime(1900));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(200));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('uses the other language’s text when one is empty', async () => {
    await renderWithProviders(<OpeningScreen splash={{ ...image, textEn: '' }} onDone={jest.fn()} />, { lang: 'en' });
    expect(screen.getByText('بيتك الجاي هنا')).toBeOnTheScreen();
  });

  it('plays the video without sound, and never stays longer than the video may be', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<OpeningScreen splash={video} onDone={onDone} />);
    expect(screen.getByTestId('video-view').props.accessibilityLabel).toContain('/uploads/videos/v.mp4');
    await act(async () => jest.advanceTimersByTime(4600));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be skipped', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<OpeningScreen splash={image} onDone={onDone} />);
    await fireEvent.press(screen.getByRole('button', { name: 'تخطي' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is not shown at all when the admin set nothing, and asks the server for the latest settings', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(200, { ...DEFAULT_APP_SETTINGS, splash: image }));
    await renderWithProviders(<OpeningHost />);
    expect(screen.queryByRole('button', { name: 'تخطي' })).toBeNull();
    await act(async () => jest.runOnlyPendingTimers());
    expect(fetchMock).toHaveBeenCalled();
    // What arrives is for the next start: nothing pops up in the middle of this one.
    expect(screen.queryByText('بيتك الجاي هنا')).toBeNull();
  });

  it('shows what was saved from the last start, once', async () => {
    useAppConfig.setState({ config: { ...DEFAULT_APP_SETTINGS, splash: { ...DEFAULT_APP_SETTINGS.splash, textAr: 'أهلا بيك في مقر' } } });
    await renderWithProviders(<OpeningHost />);
    expect(screen.getByText('أهلا بيك في مقر')).toBeOnTheScreen();
    await act(async () => jest.advanceTimersByTime(2100));
    expect(screen.queryByText('أهلا بيك في مقر')).toBeNull();
  });
});
