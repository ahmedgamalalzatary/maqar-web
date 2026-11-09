import type { PropertyDetail } from '@maqar/shared';
import { fmtMoney, installment } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import { PropertyScreen } from '@/features/property/screens/property-screen';
import { jsonResponse, makeCard, mockFetch, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const villa: PropertyDetail = {
  ...makeCard({ id: 1, price: 24_500_000, oldPrice: null, sizeM2: 420 }),
  developerAr: null,
  developerEn: null,
  floor: null,
  maintenanceFee: 8,
  descAr: 'فيلا بتصميم معاصر على زاوية.',
  descEn: 'A contemporary corner villa.',
  features: ['pool', 'garden'],
  images: ['/uploads/seed/p1.jpg', '/uploads/seed/p3.jpg'],
  views: 2141,
  tourRooms: [],
  location: { lat: 30.0074, lng: 31.4913 },
  agent: {
    id: 3,
    nameAr: 'عمر حسن',
    nameEn: 'Omar Hassan',
    roleTitleAr: 'مستشار مبيعات أول',
    roleTitleEn: 'Senior sales advisor',
    rating: 4.9,
    dealsCount: 184,
    years: 7,
    languagesAr: 'العربية، الإنجليزية',
    languagesEn: 'Arabic, English',
    avgReplyMins: 4,
    phone: '+201000000001',
    colour: '#b38959',
  },
};
const duplex = makeCard({ id: 13, titleAr: 'دوبلكس بحديقة في التجمع' });

function api() {
  return routeFetch({ '/properties/1': () => villa, '/properties/1/similar': () => [duplex] });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

describe('PropertyScreen', () => {
  it('shows the listing: price per m², facts, description, amenities and the advisor', async () => {
    api();
    await renderWithProviders(<PropertyScreen id={1} />);

    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(24_500_000, 'ar', false))).toBeOnTheScreen();
    expect(screen.getByText(`${fmtMoney(58_333, 'ar', false)} للمتر`)).toBeOnTheScreen();
    expect(screen.getByText('تشطيب كامل')).toBeOnTheScreen();
    expect(screen.getByText('فيلا بتصميم معاصر على زاوية.')).toBeOnTheScreen();
    expect(screen.getByText('حمام سباحة')).toBeOnTheScreen();
    expect(screen.getByText('حديقة')).toBeOnTheScreen();
    expect(screen.getByText('مصاريف الصيانة: ٨٪ من سعر الوحدة')).toBeOnTheScreen();
    expect(screen.getByText('عمر حسن')).toBeOnTheScreen();
    expect(screen.getByText('مستشار مبيعات أول')).toBeOnTheScreen();
    expect(screen.getByText('٢٬١٤١ مشاهدة')).toBeOnTheScreen();
  });

  it('fills the calculator from the listing’s plan and shows the plan line', async () => {
    routeFetch({ '/properties/1': () => ({ ...villa, plan: { downPct: 25, years: 4 } }), '/properties/1/similar': () => [] });
    await renderWithProviders(<PropertyScreen id={1} />);

    expect(await screen.findByText('خطة الوحدة: مقدم ٢٥٪ على ٤ سنين. غيّرها براحتك.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '٤ سنين', checked: true })).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(Math.round(installment(24_500_000, 25, 4).payment), 'ar', false))).toBeOnTheScreen();
    expect(screen.queryByRole('adjustable', { name: 'سعر الوحدة' })).toBeNull();
  });

  it('starts from 20% over 5 years when a home for sale has no plan', async () => {
    api();
    await renderWithProviders(<PropertyScreen id={1} />);

    expect(await screen.findByText('جرّب مقدم ومدة تناسبك.')).toBeOnTheScreen();
    expect(screen.getByText(fmtMoney(Math.round(installment(24_500_000, 20, 5).payment), 'ar', false))).toBeOnTheScreen();
  });

  it.each(['rent', 'stay'] as const)('has no calculator for a home to %s', async (category) => {
    routeFetch({ '/properties/1': () => ({ ...villa, category }), '/properties/1/similar': () => [] });
    await renderWithProviders(<PropertyScreen id={1} />);

    await screen.findByText('عن الوحدة');
    expect(screen.queryByText('احسب قسطك')).toBeNull();
  });

  it('opens the 360° tour when the home has one, and offers none otherwise', async () => {
    const rooms = [{ id: 7, nameAr: 'المعيشة', nameEn: 'Living room', pano: '/uploads/seed/pano/lebombo.jpg' }];
    routeFetch({ '/properties/1': () => ({ ...villa, tour: true, tourRooms: rooms }), '/properties/1/similar': () => [] });
    const view = await renderWithProviders(<PropertyScreen id={1} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'جولة ٣٦٠°' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/1/tour');
    await view.unmount();

    api();
    await renderWithProviders(<PropertyScreen id={1} />);
    await screen.findByText('فيلا مستقلة بحمام سباحة خاص');
    expect(screen.queryByRole('button', { name: 'جولة ٣٦٠°' })).toBeNull();
  });

  it('calls the advisor', async () => {
    api();
    await renderWithProviders(<PropertyScreen id={1} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'اتصال' }));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+201000000001');
  });

  it('opens directions to the listing in the maps app', async () => {
    api();
    await renderWithProviders(<PropertyScreen id={1} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'الاتجاهات' }));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('30.0074,31.4913'));
  });

  it('shares the listing', async () => {
    api();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<PropertyScreen id={1} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'مشاركة' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('فيلا مستقلة بحمام سباحة خاص') }));
  });

  it('suggests similar homes', async () => {
    api();
    await renderWithProviders(<PropertyScreen id={1} />);
    expect(await screen.findByText('دوبلكس بحديقة في التجمع')).toBeOnTheScreen();
  });

  it('counts one view per visit: opening the page again soon after does not fetch it again', async () => {
    const fetchMock = api();
    const view = await renderWithProviders(<PropertyScreen key="first" id={1} />);
    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();

    // Back from a similar home: the screen mounts again with the same cache.
    await view.rerender(<PropertyScreen key="again" id={1} />);
    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();

    const detailFetches = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/properties/1'));
    expect(detailFetches).toHaveLength(1);
  });

  it('says so when the listing is gone, and goes back', async () => {
    mockFetch().mockResolvedValue(jsonResponse(404, { statusCode: 404, message: 'Listing not found' }));
    await renderWithProviders(<PropertyScreen id={99} />);

    expect(await screen.findByText('الوحدة دي مش متاحة دلوقتي.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
