import { type AppSettings, DEFAULT_APP_SETTINGS } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastHost } from '@/components/toast';
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
const ui = (
  <>
    <AppSettingsScreen />
    <ToastHost />
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
    await fireEvent.press(screen.getByRole('button', { name: 'زوّد أقل مقدم' }));
    await fireEvent.press(screen.getByRole('button', { name: 'زوّد أقل مقدم' }));
    expect(screen.getByText('١٠٪')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('أقل سنين'), '9');
    await fireEvent.changeText(screen.getByLabelText('أكتر سنين'), '8');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    expect(screen.getByText('السنين من ١ لـ ٣٠، والأقل ميزيدش عن الأكتر.')).toBeOnTheScreen();
    expect(puts).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('أقل سنين'), '٢');
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ الحاسبة' }));
    await waitFor(() => expect(puts).toEqual([{ calculator: { minDownPct: 10, minYears: 2, maxYears: 8 } }]));
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
});
