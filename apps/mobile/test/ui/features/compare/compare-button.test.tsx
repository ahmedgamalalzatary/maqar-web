import { fireEvent, screen } from '@testing-library/react-native';
import { ToastHost, toast } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { CompareTray } from '@/features/compare/components/compare-tray';
import { useCompare } from '@/features/compare/store/compare.store';
import { PropertyCardView } from '@/features/listings/components/property-card';
import { makeCard, makeMe, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const cards = [1, 2, 3].map((id) => makeCard({ id, titleAr: `وحدة ${id}`, cover: `/uploads/seed/p${id}.jpg` }));

function Cards() {
  return (
    <>
      {cards.map((c) => (
        <PropertyCardView key={c.id} card={c} />
      ))}
      <CompareTray bottom={64} />
      <ToastHost />
    </>
  );
}

const scales = () => screen.getAllByRole('button', { name: /^(قارن|شيل من المقارنة)$/ }).filter((b) => b.props.accessibilityState);
const ids = () => useCompare.getState().homes.map((h) => h.id);

beforeEach(async () => {
  jest.clearAllMocks();
  mockFetch();
  await useSession.getState().clear();
  useCompare.setState({ homes: [] });
  toast.clear();
});

describe('Compare on cards', () => {
  it('adds a home, for a guest too, and asks for one more', async () => {
    await renderWithProviders(<Cards />);
    await fireEvent.press(scales()[0]);
    expect(ids()).toEqual([1]);
    expect(screen.getByText('اتضافت للمقارنة')).toBeTruthy();
    expect(screen.getByText('اختار وحدة كمان')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'شيل من المقارنة' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('is ready with two, and the toast opens the compare screen', async () => {
    await renderWithProviders(<Cards />);
    await fireEvent.press(scales()[0]);
    await fireEvent.press(scales()[1]);
    expect(screen.getByText('وحدتين جاهزين')).toBeTruthy();
    await fireEvent.press(screen.getByText('دوس هنا عشان تشوفهم جنب بعض.'));
    expect(mockRouter.push).toHaveBeenCalledWith('/compare');
  });

  it('replaces the oldest home with a third, and says so', async () => {
    await renderWithProviders(<Cards />);
    await fireEvent.press(scales()[0]);
    await fireEvent.press(scales()[1]);
    await fireEvent.press(scales()[2]);
    expect(ids()).toEqual([2, 3]);
    expect(screen.getByText('استبدلنا أقدم وحدة. دوس هنا عشان تقارن.')).toBeTruthy();
  });

  it('takes a home out when pressed again', async () => {
    await renderWithProviders(<Cards />);
    await fireEvent.press(scales()[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'شيل من المقارنة' }));
    expect(ids()).toEqual([]);
    expect(screen.queryByText('اختار وحدة كمان')).toBeNull();
  });

  it('is not offered to owners', async () => {
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'owner' }), accessToken: 'a' });
    await renderWithProviders(<Cards />);
    expect(screen.queryAllByRole('button', { name: 'قارن' })).toHaveLength(0);
  });
});

describe('The compare tray', () => {
  it('opens the compare screen, and clears the list', async () => {
    useCompare.setState({ homes: [{ id: 1, cover: null }, { id: 2, cover: null }] });
    await renderWithProviders(<CompareTray bottom={64} />);
    await fireEvent.press(screen.getByRole('button', { name: 'قارن' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/compare');
    await fireEvent.press(screen.getByRole('button', { name: 'مسح' }));
    expect(ids()).toEqual([]);
    expect(screen.queryByText('وحدتين جاهزين')).toBeNull();
  });

  it('is hidden with nothing picked', async () => {
    await renderWithProviders(<CompareTray bottom={64} />);
    expect(screen.queryByRole('button', { name: 'قارن' })).toBeNull();
  });
});
