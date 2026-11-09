import { fireEvent, screen } from '@testing-library/react-native';
import { useSettings } from '@/core/settings/store';
import { Home } from '@/features/home/screens/home-screen';
import { AREAS, makeCard, page, queryOf, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const launch = makeCard({ id: 9, category: 'project', titleAr: 'شقق بمقدم ١٠٪ وتقسيط ٨ سنوات', plan: { downPct: 10, years: 8 } });

function api() {
  return routeFetch({ '/areas': () => AREAS, '/properties': () => page([launch]) });
}

beforeEach(() => jest.clearAllMocks());

describe('Home', () => {
  it('shows new launches on installments and the areas, from the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<Home />);

    expect(screen.getByText('واحجز معاينته بنفسك.')).toBeOnTheScreen();
    expect(await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات')).toBeOnTheScreen();
    expect(await screen.findByText('الشيخ زايد')).toBeOnTheScreen();
    const launches = fetchMock.mock.calls.findIndex(([url]) => String(url).includes('/properties'));
    expect(queryOf(fetchMock, launches)).toMatchObject({ category: 'project' });
  });

  it.each([
    ['إيجار', 'rent'],
    ['مشروعات', 'project'],
  ])('the %s shortcut opens Explore on that category', async (label, category) => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/explore', params: { category } });
  });

  it('an area opens Explore filtered to it', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(await screen.findByRole('button', { name: 'الشيخ زايد' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/explore', params: { area: 'zayed' } });
  });

  it('the search entry opens Explore', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'منطقة، كمبوند أو نوع الوحدة' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/explore');
  });

  it('switches to dark mode with one tap from the header', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'الوضع الداكن' }));
    expect(useSettings.getState().theme).toBe('dark');
  });
});
