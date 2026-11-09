import { DEFAULT_PREFS, fmtMoney, type Prefs } from '@maqar/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { OnboardingScreen } from '@/features/prefs/screens/onboarding-screen';
import { AREAS, jsonResponse, makeMe, mockFetch, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

/** The fetch calls to one path, with their method, query and body. */
const callsTo = (fetchMock: jest.Mock, path: string) =>
  fetchMock.mock.calls
    .map(([url, init]: [string, RequestInit | undefined]) => ({
      path: url.replace(/^.*\/v1/, '').split('?')[0],
      query: Object.fromEntries(new URLSearchParams(url.split('?')[1])),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    }))
    .filter((c) => c.path === path);

function api(count = 7) {
  return routeFetch({
    '/areas': () => AREAS,
    '/properties/match-count': () => ({ count }),
    '/me/prefs': () => ({}),
    '/me': () => makeMe(),
  });
}

const signIn = (prefs: Prefs | null = null) =>
  useSession.setState({ status: 'signedIn', user: makeMe({ name: 'Mona Adel', prefs }), accessToken: 'access' });

const next = () => fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

beforeEach(() => {
  jest.clearAllMocks();
  signIn();
});

describe('Onboarding', () => {
  it('walks the steps and saves exactly what was picked, then opens the picks', async () => {
    const fetchMock = api(7);
    await renderWithProviders(<OnboardingScreen />);

    // 1. Name and purpose. A new purpose goes first, so it sets how the budget reads.
    expect(screen.getByLabelText('اسمك (اختياري)')).toHaveDisplayValue('Mona Adel');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'مشروعات جديدة' }));
    await next();

    // 2. Budget: a purchase budget, picked from a preset.
    expect(screen.getByText('ميزانيتك القصوى؟')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: fmtMoney(8_000_000, 'ar') }));
    await next();

    // 3. Areas.
    expect(screen.getByText('بتدور فين؟')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'الشيخ زايد' }));
    await next();

    // 4. Unit types.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'فيلا' }));
    await next();

    // 5. Bedrooms and must-haves, with the live count.
    await fireEvent.press(screen.getByRole('radio', { name: '٣ غرف أو أكتر' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'حمام سباحة' }));
    expect(await screen.findByText('٧')).toBeOnTheScreen();
    expect(screen.getByText('عقار يناسبك بنسبة ٧٠٪ أو أكتر')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'اعرض ترشيحاتي' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    const [saved] = callsTo(fetchMock, '/me/prefs');
    expect(saved).toMatchObject({ method: 'PUT' });
    expect(saved.body).toEqual({
      purpose: ['project', 'sale'],
      budgetMax: 8_000_000,
      areas: ['zayed'],
      types: ['apartment', 'villa'],
      beds: 3,
      interests: ['pool'],
    });
    // The name did not change, so the profile is not written.
    expect(callsTo(fetchMock, '/me').filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('asks the live count for the preferences being picked', async () => {
    const fetchMock = api(13);
    await renderWithProviders(<OnboardingScreen />);
    for (let i = 0; i < 4; i++) await next();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'جيم' }));
    await waitFor(() => expect(callsTo(fetchMock, '/properties/match-count').at(-1)?.query).toEqual({ purpose: 'sale', budgetMax: '12000000', beds: '0', interest: 'gym' }));
    expect(await screen.findByText('١٣')).toBeOnTheScreen();
  });

  it('a renter sets a monthly budget, typed in Arabic digits', async () => {
    const fetchMock = api();
    await renderWithProviders(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'إيجار' }));
    await next();
    expect(screen.getByText('ميزانيتك الشهرية؟')).toBeOnTheScreen();
    const box = screen.getByLabelText('اكتب الميزانية');
    await fireEvent(box, 'focus');
    await fireEvent.changeText(box, '٤٥٠٠٠');
    await fireEvent(box, 'blur');
    await fireEvent.press(screen.getByRole('button', { name: 'تخطي' }));
    await waitFor(() => expect(callsTo(fetchMock, '/me/prefs')).toHaveLength(1));
    expect(callsTo(fetchMock, '/me/prefs')[0].body).toMatchObject({ purpose: ['rent', 'sale'], budgetMax: 45_000 });
  });

  it('keeps at least one purpose', async () => {
    api();
    await renderWithProviders(<OnboardingScreen />);
    const buy = screen.getByRole('checkbox', { name: 'شراء' });
    await fireEvent.press(buy);
    expect(buy).toBeChecked();
  });

  it('skipping saves the defaults and opens Home', async () => {
    const fetchMock = api();
    await renderWithProviders(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'تخطي' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(callsTo(fetchMock, '/me/prefs')[0].body).toEqual(DEFAULT_PREFS);
  });

  it('saves a new name to the profile', async () => {
    const fetchMock = api();
    await renderWithProviders(<OnboardingScreen />);
    await fireEvent.changeText(screen.getByLabelText('اسمك (اختياري)'), 'Mona A.');
    await fireEvent.press(screen.getByRole('button', { name: 'تخطي' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(callsTo(fetchMock, '/me').find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'Mona A.' });
  });

  it('reopened from Me, starts from the saved preferences and goes back after saving', async () => {
    const saved: Prefs = { purpose: ['rent'], budgetMax: 90_000, areas: ['new-cairo'], types: ['studio'], beds: 2, interests: ['gym'] };
    signIn(saved);
    const fetchMock = api();
    await renderWithProviders(<OnboardingScreen />);
    expect(screen.getByRole('checkbox', { name: 'إيجار' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'شراء' })).not.toBeChecked();
    for (let i = 0; i < 4; i++) await next();
    expect(screen.getByRole('radio', { name: '٢ غرف أو أكتر' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'جيم' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ تفضيلاتك' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(callsTo(fetchMock, '/me/prefs')[0].body).toEqual(saved);
    expect(useSession.getState().user?.prefs).toEqual(saved);
  });

  it('the back button goes to the step before', async () => {
    api();
    await renderWithProviders(<OnboardingScreen />);
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(screen.getByRole('checkbox', { name: 'شراء' })).toBeOnTheScreen();
  });

  it('says so when saving fails, and stays', async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/me/prefs') ? jsonResponse(500, { statusCode: 500, message: 'Server error' }) : jsonResponse(200, url.includes('/areas') ? AREAS : { count: 0 }),
    );
    await renderWithProviders(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'تخطي' }));
    expect(await screen.findByText('معرفناش نحفظ تفضيلاتك. جرّب تاني.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => {});
  });
});
