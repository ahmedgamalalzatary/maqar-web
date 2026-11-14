import { type AppSettings, DEFAULT_APP_SETTINGS } from '@maqar/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastHost } from '@/components/toast';
import { useAppConfig } from '@/core/app-config/store';
import { useSession } from '@/features/auth/store/session.store';
import { AppSettingsScreen } from '@/features/admin/screens/app-settings-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

/** Answers the settings as saved so far, and returns the bodies of the saves. */
function serve(saved: AppSettings = DEFAULT_APP_SETTINGS) {
  let now = saved;
  const puts: Record<string, unknown>[] = [];
  mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const key = `${init.method ?? 'GET'} ${path}`;
    if (key === 'GET /settings') return jsonResponse(200, now);
    if (key === 'POST /uploads') return jsonResponse(201, { url: '/uploads/listings/opening.jpg' });
    if (key === 'PUT /admin/settings') {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      puts.push(body);
      now = { ...now, ...body, splash: body.splash ? { ...(body.splash as AppSettings['splash']), poster: null } : now.splash } as AppSettings;
      return jsonResponse(200, now);
    }
    return jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return puts;
}
let client: QueryClient;
/** Hands the test the screen's query client, to refetch as a later visit would. */
function GrabClient() {
  client = useQueryClient();
  return null;
}
const ui = (
  <>
    <AppSettingsScreen />
    <ToastHost />
    <GrabClient />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

// Phase 29: an admin sets the opening screen, the calculator's limits and the Home order from the app too.
describe('App settings (admin)', () => {
  it('sets the calculator’s limits, and refuses years that make no sense', async () => {
    const puts = serve();
    await renderWithProviders(ui);
    expect((await screen.findByLabelText('أقل سنين')).props.value).toBe('١');
    // Typed by hand, any whole percent from 0 to 50 (owner, 2026-11-14).
    expect(screen.getByLabelText('أقل مقدم (٪)').props.value).toBe('٠');
    await fireEvent.changeText(screen.getByLabelText('أقل مقدم (٪)'), '55');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    expect(screen.getByText('أقل مقدم من ٠ لـ ٥٠٪.')).toBeOnTheScreen();
    expect(puts).toEqual([]);
    await fireEvent.changeText(screen.getByLabelText('أقل مقدم (٪)'), '١١');
    await fireEvent.changeText(screen.getByLabelText('أقل سنين'), '9');
    await fireEvent.changeText(screen.getByLabelText('أكتر سنين'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    expect(screen.getByText('السنين من ١ لـ ٣٠، والأقل ميزيدش عن الأكتر.')).toBeOnTheScreen();
    expect(puts).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('أقل سنين'), '٢');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    await waitFor(() => expect(puts).toEqual([{ calculator: { minDownPct: 11, minYears: 2, maxYears: 8 } }]));
    expect(await screen.findByText('اتحفظ، وهيظهر في التطبيق مع أول فتح')).toBeOnTheScreen();
  });

  it('sets the Contact us details; one filled in wrong is named before anything is sent (2026-11-14)', async () => {
    const puts = serve();
    await renderWithProviders(ui);
    expect((await screen.findByLabelText('الإيميل')).props.value).toBe('maqarcompany@gmail.com');
    await fireEvent.changeText(screen.getByLabelText('واتساب'), '٠١٠١٢٣٤٥٦٧٨');
    await fireEvent.changeText(screen.getByLabelText('فيسبوك (رابط)'), 'facebook.com/maqar');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ بيانات التواصل' }));
    expect(screen.getByText('رابط فيسبوك لازم يكون كامل ويبدأ بـ https://')).toBeOnTheScreen();
    expect(puts).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('فيسبوك (رابط)'), 'https://facebook.com/maqar');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ بيانات التواصل' }));
    await waitFor(() =>
      expect(puts).toEqual([
        { contact: { email: 'maqarcompany@gmail.com', phone: '', whatsapp: '01012345678', facebook: 'https://facebook.com/maqar', instagram: '', tiktok: '' } },
      ]),
    );
    expect(await screen.findByText('اتحفظ، وهيظهر في التطبيق مع أول فتح')).toBeOnTheScreen();
  });

  it('moves a Home section up or down, then saves the order', async () => {
    const puts = serve();
    await renderWithProviders(ui);
    await fireEvent.press(await screen.findByRole('button', { name: 'نزّل «المعاينة الجاية» لتحت' }));
    await fireEvent.press(screen.getByRole('button', { name: 'طلّع «مشروعات جديدة بالتقسيط» لفوق' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الترتيب' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    const { sections } = puts[0]!.home as { sections: string[] };
    expect(sections.slice(0, 3)).toEqual(['shortcuts', 'featured', 'nextViewing']);
    expect(sections.slice(-2)).toEqual(['launches', 'drops']);
    expect(sections).toHaveLength(DEFAULT_APP_SETTINGS.home.sections.length);
  });

  it('sets a picture and text for the opening screen; a picture kind needs its picture first', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
    jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ bytes: async () => new Uint8Array([1]) })) }));
    const puts = serve();
    await renderWithProviders(ui);
    await fireEvent.press(await screen.findByRole('radio', { name: 'صورة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ شاشة الفتح' }));
    expect(screen.getByText('ارفع الصورة الأول')).toBeOnTheScreen();
    expect(puts).toEqual([]);

    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///a.jpg', width: 900, height: 1600 }] });
    await fireEvent.press(screen.getByRole('button', { name: 'ارفع صورة' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'غيّر الملف' })).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByLabelText('النص (عربي، اختياري)'), 'بيتك الجاي هنا');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ شاشة الفتح' }));
    await waitFor(() => expect(puts).toEqual([{ splash: { kind: 'image', media: '/uploads/listings/opening.jpg', textAr: 'بيتك الجاي هنا', textEn: '' } }]));
  });

  it('refuses a video longer than 3 seconds before sending it', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
    const puts = serve();
    await renderWithProviders(ui);
    await fireEvent.press(await screen.findByRole('radio', { name: 'فيديو (٣ ثواني)' }));
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///long.mp4', mimeType: 'video/mp4', duration: 8000, fileSize: 1000 }] });
    await fireEvent.press(screen.getByRole('button', { name: 'ارفع فيديو' }));
    expect(await screen.findByText('الفيديو لازم يكون ٣ ثواني أو أقل')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'غيّر الملف' })).toBeNull();
    expect(puts).toEqual([]);
  });

  it('shows what is saved, and goes back to the logo only', async () => {
    const puts = serve({ ...DEFAULT_APP_SETTINGS, splash: { kind: 'image', media: '/uploads/listings/old.jpg', poster: null, textAr: 'أهلا', textEn: 'Hi' } });
    await renderWithProviders(ui);
    expect(await screen.findByRole('radio', { name: 'صورة', checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('النص (عربي، اختياري)').props.value).toBe('أهلا');
    await fireEvent.press(screen.getByRole('radio', { name: 'اللوجو بس' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ شاشة الفتح' }));
    await waitFor(() => expect(puts).toEqual([{ splash: { kind: 'none', media: null, textAr: 'أهلا', textEn: 'Hi' } }]));
  });

  // Phase 29 review.
  it('forgets a video the server deleted once the opening screen went back to the logo', async () => {
    const puts = serve({ ...DEFAULT_APP_SETTINGS, splash: { kind: 'video', media: '/uploads/videos/old.mp4', poster: '/uploads/videos/old.jpg', textAr: '', textEn: '' } });
    await renderWithProviders(ui);
    await fireEvent.press(await screen.findByRole('radio', { name: 'اللوجو بس' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ شاشة الفتح' }));
    await waitFor(() => expect(puts).toHaveLength(1));
    await fireEvent.press(await screen.findByRole('radio', { name: 'فيديو (٣ ثواني)' }));
    expect(screen.getByRole('button', { name: 'ارفع فيديو' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ شاشة الفتح' }));
    expect(screen.getByText('ارفع الفيديو الأول')).toBeOnTheScreen();
    expect(puts).toHaveLength(1);
  });

  it('keeps the newer part when an older save answers last', async () => {
    let now: AppSettings = DEFAULT_APP_SETTINGS;
    let releaseCalculator!: () => void;
    mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${url.replace(/^.*\/v1/, '').split('?')[0]}`;
      if (key === 'GET /settings') return jsonResponse(200, now);
      const body = JSON.parse(init.body as string) as Partial<AppSettings>;
      if (body.calculator) {
        // The server saved the calculator before the order came in, but its answer is slow.
        const answer = { ...now, calculator: body.calculator };
        await new Promise<void>((r) => (releaseCalculator = r));
        return jsonResponse(200, answer);
      }
      now = { ...now, ...body };
      return jsonResponse(200, now);
    });
    await renderWithProviders(ui);
    await fireEvent.changeText(await screen.findByLabelText('أقل مقدم (٪)'), '5');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'نزّل «المعاينة الجاية» لتحت' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الترتيب' }));
    await waitFor(() => expect(useAppConfig.getState().config.home.sections[1]).toBe('featured'));
    await act(async () => releaseCalculator());
    await waitFor(() => expect(useAppConfig.getState().config.calculator.minDownPct).toBe(5));
    expect(useAppConfig.getState().config.home.sections[1]).toBe('featured');
  });

  it('shows what the server holds when the settings come back changed', async () => {
    let now: AppSettings = DEFAULT_APP_SETTINGS;
    mockFetch().mockImplementation(async () => jsonResponse(200, now));
    await renderWithProviders(ui);
    expect((await screen.findByLabelText('أكتر سنين')).props.value).toBe('١٠');
    now = { ...now, calculator: { minDownPct: 0, minYears: 1, maxYears: 7 } };
    await act(async () => {
      await client.refetchQueries();
    });
    await waitFor(() => expect(screen.getByLabelText('أكتر سنين').props.value).toBe('٧'));
  });
});
