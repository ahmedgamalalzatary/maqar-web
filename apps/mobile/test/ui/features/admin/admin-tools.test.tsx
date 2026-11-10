import type { AdminAgentDetail, AdminAgentItem, AdminArea, AdminLeadItem } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { AdminLeadsScreen } from '@/features/admin/screens/admin-leads-screen';
import { AgentFormScreen } from '@/features/admin/screens/agent-form-screen';
import { AgentScreen } from '@/features/admin/screens/agent-screen';
import { AgentsScreen } from '@/features/admin/screens/agents-screen';
import { AreaFormScreen } from '@/features/admin/screens/areas-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const agent = (over: Partial<AdminAgentItem>): AdminAgentItem => ({
  id: 3,
  nameAr: 'عمر حسن',
  nameEn: 'Omar Hassan',
  colour: '#b38959',
  email: 'omar@maqar.app',
  phone: '+201000000001',
  roleTitleAr: 'مستشار مبيعات أول',
  roleTitleEn: 'Senior sales advisor',
  active: true,
  live: 8,
  openLeads: 5,
  monthlyTarget: 6,
  ...over,
});
const OMAR = agent({});
const MARIAM = agent({ id: 4, nameAr: 'مريم عادل', nameEn: 'Mariam Adel', email: 'mariam@maqar.app', colour: '#61766d', live: 3 });
const detail = (over: Partial<AdminAgentDetail> = {}): AdminAgentDetail => ({
  ...OMAR,
  languagesAr: 'العربية',
  languagesEn: 'Arabic',
  years: 7,
  hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, from: weekday === 5 ? 14 : 10, to: 20 })),
  defaultHours: false,
  daysOff: [{ date: '2026-12-25', reason: 'عيد' }],
  ...over,
});
const LEAD: AdminLeadItem = {
  id: 11,
  name: 'كريم محمود',
  phone: '+201014124412',
  stage: 'viewing',
  source: 'booking',
  hot: false,
  fromApp: true,
  budget: null,
  property: { id: 1, titleAr: 'فيلا بحمام سباحة', titleEn: 'Pool villa' },
  lastActivityAt: new Date().toISOString(),
  agent: { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959' },
};

/** A fake API for the admin tools. `fail` answers a write with that status. Returns the writes. */
function serve(opts: { fail?: Record<string, number> } = {}) {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const method = init.method ?? 'GET';
    const key = `${method} ${path}`;
    if (opts.fail?.[key]) return jsonResponse(opts.fail[key]!, { statusCode: opts.fail[key], message: 'No' });
    if (key === 'GET /admin/agents') return jsonResponse(200, [OMAR, MARIAM]);
    if (key === 'GET /admin/agents/3') return jsonResponse(200, detail());
    if (key === 'PATCH /admin/agents/3') return jsonResponse(200, detail(JSON.parse(init.body as string)));
    if (key === 'POST /admin/agents') return jsonResponse(201, detail({ id: 9 }));
    if (key === 'PUT /admin/agents/hours') return new Response(null, { status: 204 });
    if (key === 'POST /admin/agents/days-off') return jsonResponse(201, { days: 1, booked: [{ agentId: 3, viewings: 2 }] });
    if (key === 'GET /admin/leads') return jsonResponse(200, [LEAD]);
    if (key === 'PATCH /admin/leads/11/assign') return jsonResponse(200, { ...LEAD, agent: { id: 4, nameAr: 'مريم عادل', nameEn: 'Mariam Adel', colour: '#61766d' } });
    if (key === 'GET /admin/areas') return jsonResponse(200, [] as AdminArea[]);
    if (key === 'POST /uploads') return jsonResponse(201, { url: '/uploads/listings/area.jpg' });
    if (key === 'POST /admin/areas') return jsonResponse(201, { id: 'new-alamein', listings: 0, ...JSON.parse(init.body as string) });
    return jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init?.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => [`${init.method} ${url.replace(/^.*\/v1/, '').split('?')[0]}`, typeof init.body === 'string' ? JSON.parse(init.body) : undefined]);
}

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

describe('Agents tab', () => {
  it('lists the agents, and sets the same hours for several at once', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<AgentsScreen />));
    expect(await screen.findByText('٨ عقار منشور | ٥ عميل مفتوح')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'اختار كذا مسؤول' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'عمر حسن' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'مريم عادل' }));
    expect(screen.getByText('٢ مختارين')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'المواعيد' }));
    // Friday off for both, then the last viewing an hour earlier on Saturday.
    await fireEvent(screen.getByRole('switch', { name: 'الجمعة' }), 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'آخر معاينة يوم السبت: أبدر ساعة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ المواعيد' }));
    expect(await screen.findByText('المواعيد اتحفظت')).toBeOnTheScreen();
    const [[what, body]] = writes();
    expect(what).toBe('PUT /admin/agents/hours');
    expect(body.agentIds).toEqual([3, 4]);
    expect(body.hours).toContainEqual({ weekday: 6, from: 10, to: 19 });
    expect(body.hours.find((h: { weekday: number }) => h.weekday === 5)).toBeUndefined();
    expect(body.hours).toHaveLength(6);
  });

  it('opens an agent, and adds a new one', async () => {
    serve();
    await renderWithProviders(<AgentsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'عمر حسن' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/agent/3');
    await fireEvent.press(screen.getByRole('button', { name: 'أضف مسؤول' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/agent/new');
  });
});

describe('Agent page', () => {
  it('shows the week and the days off, and adds a day off that already has viewings', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<AgentScreen id={3} />));
    expect(await screen.findByRole('header', { name: 'عمر حسن' })).toBeOnTheScreen();
    expect(screen.getByText('عيد')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'أضف' }));
    const [first] = screen.getAllByRole('radio', { name: /^من يوم: / });
    await fireEvent.press(first!);
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الإجازة' }));
    expect(await screen.findByText('فيه ٢ معاينة محجوزة في الأيام دي، اتفق مع العملاء على ميعاد تاني.')).toBeOnTheScreen();
    expect(writes()[0]![0]).toBe('POST /admin/agents/days-off');
    expect(writes()[0]![1]).toMatchObject({ agentIds: [3] });
  });

  it('says why an advisor with live listings cannot be turned off', async () => {
    serve({ fail: { 'PATCH /admin/agents/3': 409 } });
    await renderWithProviders(withToasts(<AgentScreen id={3} />));
    await fireEvent(await screen.findByRole('switch', { name: 'شغال (يقدر يدخل ويتحطله عقارات)' }), 'valueChange', false);
    expect(await screen.findByText('انقل عقاراته المنشورة لمسؤول تاني الأول')).toBeOnTheScreen();
  });
});

describe('New agent', () => {
  it('needs a password with a letter and a digit, then opens the new agent', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<AgentFormScreen />));
    await fireEvent.changeText(screen.getByLabelText('الاسم (عربي)'), 'نادين سمير');
    await fireEvent.changeText(screen.getByLabelText('الاسم (إنجليزي)'), 'Nadine Samir');
    await fireEvent.changeText(screen.getByLabelText('الإيميل (للدخول)'), 'nadine@maqar.app');
    await fireEvent.changeText(screen.getByLabelText('كلمة سر البداية'), 'short');
    await fireEvent.changeText(screen.getByLabelText('الموبايل'), '٠١٠٠٥٥٥٠١٠١');
    await fireEvent.press(screen.getByRole('button', { name: 'أضف المسؤول' }));
    expect(screen.getByText('٨ حروف على الأقل، فيها حرف ورقم')).toBeOnTheScreen();
    expect(writes()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('كلمة سر البداية'), 'Starting123');
    await fireEvent.press(screen.getByRole('button', { name: 'أضف المسؤول' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/admin/agent/9'));
    expect(writes()[0]![1]).toMatchObject({ nameEn: 'Nadine Samir', email: 'nadine@maqar.app', password: 'Starting123', phone: '01005550101' });
  });
});

describe('Leads tab', () => {
  it('moves a lead to another agent', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<AdminLeadsScreen />));
    await fireEvent.press(await screen.findByRole('button', { name: 'كريم محمود، عمر حسن' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'مريم عادل' }));
    expect(await screen.findByText('العميل اتنقل لـ مريم عادل')).toBeOnTheScreen();
    expect(writes()).toEqual([['PATCH /admin/leads/11/assign', { agentId: 4 }]]);
  });

  it('says so when the client already has a lead with that agent', async () => {
    serve({ fail: { 'PATCH /admin/leads/11/assign': 409 } });
    await renderWithProviders(withToasts(<AdminLeadsScreen />));
    await fireEvent.press(await screen.findByRole('button', { name: 'كريم محمود، عمر حسن' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'مريم عادل' }));
    expect(await screen.findByText('العميل ده عنده ملف مع المسؤول ده بالفعل')).toBeOnTheScreen();
  });
});

describe('New area', () => {
  it('needs a photo and the names, then adds the area', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
    jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ bytes: async () => new Uint8Array([1]) })) }));
    const writes = serve();
    await renderWithProviders(withToasts(<AreaFormScreen />));
    await fireEvent.changeText(screen.getByLabelText('الاسم (عربي)'), 'العلمين الجديدة');
    await fireEvent.changeText(screen.getByLabelText('الاسم (إنجليزي)'), 'New Alamein');
    await fireEvent.changeText(screen.getByLabelText('المدينة (عربي)'), 'مطروح');
    await fireEvent.changeText(screen.getByLabelText('المدينة (إنجليزي)'), 'Matrouh');
    await fireEvent.press(screen.getByRole('button', { name: 'أضف المنطقة' }));
    expect(writes()).toEqual([]);

    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///a.jpg', width: 800, height: 600 }] });
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف صورة' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'غيّر الصورة' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'أضف المنطقة' }));
    expect(await screen.findByText('المنطقة اتضافت وبقت ظاهرة للعملاء')).toBeOnTheScreen();
    expect(writes().find(([w]) => w === 'POST /admin/areas')![1]).toEqual({ nameAr: 'العلمين الجديدة', nameEn: 'New Alamein', cityAr: 'مطروح', cityEn: 'Matrouh', image: '/uploads/listings/area.jpg' });
  });
});
