import { fmtMoney, installment } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { PropertyCardView } from '@/features/listings/components/property-card';
import { makeCard } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(() => jest.clearAllMocks());

describe('PropertyCardView', () => {
  it('shows the price, place and size, and opens the listing', async () => {
    await renderWithProviders(<PropertyCardView card={makeCard({ id: 7 })} />);

    expect(screen.getByText(fmtMoney(24_500_000, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText('سيدار هيلز | التجمع الخامس')).toBeOnTheScreen();
    expect(screen.getByText('٤٢٠ م²')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'فيلا مستقلة بحمام سباحة خاص' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/7');
  });

  it('marks rent as per month and stays as per night', async () => {
    await renderWithProviders(<PropertyCardView card={makeCard({ category: 'rent', price: 45_000 })} />);
    expect(screen.getByText('/ شهر')).toBeOnTheScreen();

    await renderWithProviders(<PropertyCardView card={makeCard({ category: 'stay', price: 9_500 })} />);
    expect(screen.getByText('/ ليلة')).toBeOnTheScreen();
  });

  it('shows the old price and the drop when the price fell', async () => {
    await renderWithProviders(<PropertyCardView card={makeCard({ oldPrice: 26_000_000 })} />);
    expect(screen.getByText(fmtMoney(26_000_000, 'ar'))).toBeOnTheScreen();
    expect(screen.getByText('٦٪-')).toBeOnTheScreen();
  });

  it('shows the monthly installment of the plan and the delivery year', async () => {
    const card = makeCard({ category: 'project', price: 5_400_000, plan: { downPct: 10, years: 8 }, delivery: 2028 });
    await renderWithProviders(<PropertyCardView card={card} />, { lang: 'en' });

    const monthly = Math.round(installment(5_400_000, 10, 8).payment);
    expect(screen.getByText(`${fmtMoney(monthly, 'en')}/mo`)).toBeOnTheScreen();
    expect(screen.getByText('Delivery 2028')).toBeOnTheScreen();
  });
});
