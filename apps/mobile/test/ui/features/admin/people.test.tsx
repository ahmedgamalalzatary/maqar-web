import type { AdminAccount, AdminClientDetail, AdminClientItem } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ToastHost } from '@/components/toast';
import { MeScreen } from '@/features/account/screens/me-screen';
import { useSession } from '@/features/auth/store/session.store';
import { AdminsScreen } from '@/features/admin/screens/admins-screen';
import { ClientScreen, ClientsScreen } from '@/features/admin/screens/clients-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const KARIM: AdminClientItem = {
  id: 21,
  name: 'كريم محمود',
  email: 'karim@test.maqar',
  phone: '+201014124412',
  lang: 'ar',
  createdAt: '2026-11-01T10:00:00.000Z',
  suspendedAt: null,
  lastSeenAt: '2026-11-11T10:00:00.000Z',
  saved: 3,
  viewings: 1,
  chats: 2,
  leads: 1,
};
const detail = (over: Partial<AdminClientDetail> = {}): AdminClientDetail => ({
  ...KARIM,
  prefs: null,
  recentViewings: [{ id: 5, startsAt: '2026-11-20T09:00:00.000Z', status: 'confirmed', property: { id: 1, titleAr: 'فيلا بحمام سباحة', titleEn: 'Pool villa' }, agent: { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959' } }],
  threads: [],
  leadsList: [],
  ...over,
});
const ME: AdminAccount = { id: 1, name: 'فريق مقر', email: 'admin@maqar.app', phone: null, createdAt: '2026-11-01T10:00:00.000Z', suspendedAt: null, lastSeenAt: null, you: true };
const OTHER: AdminAccount = { ...ME, id: 2, name: 'سارة', email: 'sara@maqar.app', you: false };

/** A fake API for the people pages. Returns the requests made, as "METHOD path?query" with bodies. */
function serve() {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const [path] = url.replace(/^.*\/v1/, '').split('?');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (method === 'GET' && path === '/admin/clients') return jsonResponse(200, { items: [KARIM], page: 1, limit: 50, total: 1, counts: { active: 1, suspended: 0 } });
    if (method === 'GET' && path === '/admin/clients/21') return jsonResponse(200, detail());
    if (method === 'PATCH' && path === '/admin/clients/21')
      return jsonResponse(200, { ...detail(body.suspended ? { suspendedAt: '2026-11-12T10:00:00.000Z' } : {}), cancelledViewings: body.suspended ? 1 : 0 });
    if (method === 'DELETE' && path === '/admin/clients/21') return new Response(null, { status: 204 });
    if (method === 'GET' && path === '/admin/admins') return jsonResponse(200, [ME, OTHER]);
    if (method === 'POST' && path === '/admin/admins') return jsonResponse(201, { ...OTHER, id: 3, ...body });
    if (method === 'PATCH' && path === '/admin/admins/2') return jsonResponse(200, { ...OTHER, suspendedAt: '2026-11-12T10:00:00.000Z' });
    return jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return () =>
    fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => [`${init?.method ?? 'GET'} ${url.replace(/^.*\/v1/, '')}`, typeof init?.body === 'string' ? JSON.parse(init.body) : undefined]);
}

/** Presses the destructive button of the next confirmation. */
const confirmNext = () =>
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => {
    buttons?.find((b) => b.style === 'destructive')?.onPress?.();
  });

const withToasts = (ui: React.ReactElement) => (
  <>
    {ui}
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

it('More shows the admin’s pages to manage above the settings', async () => {
  serve();
  await renderWithProviders(<MeScreen />);
  expect(screen.getByRole('header', { name: 'المزيد' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'حسابات العملاء' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/clients');
  await fireEvent.press(screen.getByRole('button', { name: 'المناطق' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/areas');
  await fireEvent.press(screen.getByRole('button', { name: 'حسابات الإدارة' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/admins');
});

describe('Client accounts', () => {
  it('lists clients with what they did, searches, filters by status and opens one', async () => {
    const requests = serve();
    await renderWithProviders(<ClientsScreen />);
    expect(await screen.findByText('كريم محمود')).toBeOnTheScreen();
    expect(screen.getByText(/٣ محفوظ \| ١ معاينة \| ٢ شات/)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('ابحث بالاسم أو الإيميل أو الموبايل'), 'karim');
    await waitFor(() => expect(requests().some(([r]) => r!.includes('q=karim'))).toBe(true));
    await fireEvent.press(screen.getByRole('radio', { name: /^موقوف/ }));
    await waitFor(() => expect(requests().some(([r]) => r!.includes('status=suspended'))).toBe(true));
    await fireEvent.press(screen.getByRole('button', { name: 'كريم محمود' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/client/21');
  });

  it('suspends after a confirmation and says how many viewings were cancelled', async () => {
    const requests = serve();
    await renderWithProviders(withToasts(<ClientScreen id={21} />));
    expect(await screen.findByText('فيلا بحمام سباحة')).toBeOnTheScreen();
    confirmNext();
    await fireEvent.press(screen.getByRole('button', { name: 'وقّف الحساب' }));
    expect(await screen.findByText('اتلغت ١ معاينة')).toBeOnTheScreen();
    expect(requests().find(([r]) => r === 'PATCH /admin/clients/21')![1]).toEqual({ suspended: true });
  });

  it('sets a new password only when it has a letter and a digit', async () => {
    const requests = serve();
    await renderWithProviders(withToasts(<ClientScreen id={21} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'كلمة سر جديدة' }));
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'password');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ' }));
    expect(screen.getByText('٨ حروف على الأقل، فيها حرف ورقم')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Password9');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ' }));
    expect(await screen.findByText('كلمة السر اتغيرت')).toBeOnTheScreen();
    expect(requests().filter(([r]) => r === 'PATCH /admin/clients/21').map(([, b]) => b)).toEqual([{ password: 'Password9' }]);
  });

  it('deletes after a confirmation and goes back', async () => {
    const requests = serve();
    await renderWithProviders(withToasts(<ClientScreen id={21} />));
    await screen.findByText('فيلا بحمام سباحة');
    confirmNext();
    await fireEvent.press(screen.getByRole('button', { name: 'امسح الحساب' }));
    expect(await screen.findByText('الحساب اتمسح')).toBeOnTheScreen();
    expect(requests().some(([r]) => r === 'DELETE /admin/clients/21')).toBe(true);
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Admin accounts', () => {
  it('marks your own account without actions, adds an admin and suspends another', async () => {
    const requests = serve();
    await renderWithProviders(withToasts(<AdminsScreen />));
    expect(await screen.findByText('فريق مقر (انت)')).toBeOnTheScreen();
    // Only the other admin has actions.
    expect(screen.getAllByRole('button', { name: 'وقّفه' })).toHaveLength(1);
    confirmNext();
    await fireEvent.press(screen.getByRole('button', { name: 'وقّفه' }));
    expect(await screen.findByText('الحساب اتوقف')).toBeOnTheScreen();
    expect(requests().find(([r]) => r === 'PATCH /admin/admins/2')![1]).toEqual({ suspended: true });

    await fireEvent.press(screen.getByRole('button', { name: 'أضف أدمن' }));
    await fireEvent.changeText(screen.getByLabelText('الاسم'), 'Mona');
    await fireEvent.changeText(screen.getByLabelText('الإيميل'), 'mona@maqar.app');
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Starting123');
    await fireEvent.press(screen.getByRole('button', { name: 'أضف' }));
    expect(await screen.findByText('الأدمن اتضاف')).toBeOnTheScreen();
    expect(requests().find(([r]) => r === 'POST /admin/admins')![1]).toEqual({ name: 'Mona', email: 'mona@maqar.app', password: 'Starting123' });
  });
});
