import { fireEvent, screen } from '@testing-library/react-native';
import { Gallery } from '@/features/property/components/gallery';
import { renderWithProviders } from '../../../utils/render';

const IMAGES = ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg'];
const WIDTH = 390;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

const scrollTo = (x: number) => fireEvent.scroll(screen.getByTestId('gallery'), { nativeEvent: { contentOffset: { x, y: 0 } } });

describe('The gallery counter', () => {
  it('starts on the first photo', async () => {
    await renderWithProviders(<Gallery images={IMAGES} label="home" />, { lang: 'en' });
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
  });

  it('follows the photos as they scroll, counting from the left', async () => {
    await renderWithProviders(<Gallery images={IMAGES} label="home" />, { lang: 'en' });
    await scrollTo(10);
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
    await scrollTo(WIDTH);
    expect(screen.getByText('2 / 4')).toBeOnTheScreen();
    await scrollTo(WIDTH * 3);
    expect(screen.getByText('4 / 4')).toBeOnTheScreen();
    await scrollTo(0);
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
  });

  it('follows them in Arabic on the web, where the position is negative', async () => {
    await renderWithProviders(<Gallery images={IMAGES} label="home" />);
    await scrollTo(-10);
    await scrollTo(-WIDTH * 2);
    expect(screen.getByText('٣ / ٤')).toBeOnTheScreen();
  });

  it('follows them in Arabic on a phone, where the first photo is at the far end', async () => {
    await renderWithProviders(<Gallery images={IMAGES} label="home" />);
    await scrollTo(WIDTH * 3 - 10);
    expect(screen.getByText('١ / ٤')).toBeOnTheScreen();
    await scrollTo(WIDTH * 2);
    expect(screen.getByText('٢ / ٤')).toBeOnTheScreen();
    await scrollTo(0);
    expect(screen.getByText('٤ / ٤')).toBeOnTheScreen();
    await scrollTo(WIDTH * 3);
    expect(screen.getByText('١ / ٤')).toBeOnTheScreen();
  });

  it('handles two photos, the closest case to tell apart', async () => {
    await renderWithProviders(<Gallery images={['/a.jpg', '/b.jpg']} label="home" />);
    await scrollTo(WIDTH - 12);
    expect(screen.getByText('١ / ٢')).toBeOnTheScreen();
    await scrollTo(0);
    expect(screen.getByText('٢ / ٢')).toBeOnTheScreen();
  });
});
