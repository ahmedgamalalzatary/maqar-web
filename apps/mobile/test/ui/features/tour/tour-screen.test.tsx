import type { PropertyDetail } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { TourScreen } from '@/features/tour/screens/tour-screen';
import { makeCard, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
// No GPU, motion sensor or downloads under Jest: the panorama is a plain View.
jest.mock('expo-gl', () => {
  const { View } = require('react-native');
  return { GLView: (props: object) => require('react').createElement(View, props) };
});
jest.mock('expo-asset', () => ({ Asset: { fromURI: () => ({ downloadAsync: async () => ({}) }) } }));
const mockMotion = { available: true, granted: true };
jest.mock('expo-sensors', () => ({
  DeviceMotion: {
    isAvailableAsync: async () => mockMotion.available,
    requestPermissionsAsync: async () => ({ granted: mockMotion.granted }),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const rooms = [
  { id: 1, nameAr: 'المعيشة', nameEn: 'Living room', pano: '/uploads/seed/pano/lebombo.jpg' },
  { id: 2, nameAr: 'المطبخ والسفرة', nameEn: 'Kitchen & dining', pano: '/uploads/seed/pano/kiara_interior.jpg' },
  { id: 3, nameAr: 'الحمام', nameEn: 'Bathroom', pano: '/uploads/seed/pano/modern_bathroom.jpg' },
];
const home = (tourRooms = rooms): PropertyDetail =>
  ({ ...makeCard({ id: 4, compoundAr: 'سيدار هيلز', tour: tourRooms.length > 0 }), tourRooms }) as PropertyDetail;

const header = () => screen.getByRole('header');

beforeEach(() => {
  jest.clearAllMocks();
  mockMotion.available = true;
  mockMotion.granted = true;
});

describe('The 360° tour', () => {
  it('opens on the first room, with the room list and the hint', async () => {
    routeFetch({ '/properties/4': () => home() });
    await renderWithProviders(<TourScreen id={4} />);
    expect(await screen.findByText('سيدار هيلز')).toBeTruthy();
    expect(header()).toHaveTextContent('المعيشة');
    expect(screen.getByRole('button', { name: 'المعيشة', selected: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'الحمام', selected: false })).toBeTruthy();
    expect(screen.getByTestId('pano')).toBeTruthy();
  });

  it('moves to another room from the list and from a dot in the scene', async () => {
    routeFetch({ '/properties/4': () => home() });
    await renderWithProviders(<TourScreen id={4} />, { lang: 'en' });
    await screen.findByRole('button', { name: 'Kitchen & dining' });

    // The list: every room as a thumbnail.
    await fireEvent.press(screen.getByRole('button', { name: 'Bathroom' }));
    expect(header()).toHaveTextContent('Bathroom');

    // The scene: a dot for each other room, never one for the room you are in.
    expect(screen.queryByRole('button', { name: 'Go to Bathroom' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Kitchen & dining' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Living room' }));
    expect(header()).toHaveTextContent('Living room');
  });

  it('turns the gyroscope on and off when the phone has one and it is allowed', async () => {
    routeFetch({ '/properties/4': () => home() });
    await renderWithProviders(<TourScreen id={4} />);
    const gyro = await screen.findByRole('button', { name: 'الجيروسكوب' });
    await fireEvent.press(gyro);
    expect(screen.getByRole('button', { name: 'الجيروسكوب', selected: true })).toBeTruthy();
    await fireEvent.press(gyro);
    expect(screen.getByRole('button', { name: 'الجيروسكوب', selected: false })).toBeTruthy();
  });

  it('stays off when motion is not allowed, and has no button without a sensor', async () => {
    mockMotion.granted = false;
    routeFetch({ '/properties/4': () => home() });
    const view = await renderWithProviders(<TourScreen id={4} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'الجيروسكوب' }));
    expect(screen.getByRole('button', { name: 'الجيروسكوب', selected: false })).toBeTruthy();
    await view.unmount();

    mockMotion.available = false;
    await renderWithProviders(<TourScreen id={4} />);
    await screen.findByText('سيدار هيلز');
    expect(screen.queryByRole('button', { name: 'الجيروسكوب' })).toBeNull();
  });

  it('says so when the home has no tour, and goes back', async () => {
    routeFetch({ '/properties/4': () => home([]) });
    await renderWithProviders(<TourScreen id={4} />);
    expect(await screen.findByText('الوحدة دي مالهاش جولة ٣٦٠°.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
