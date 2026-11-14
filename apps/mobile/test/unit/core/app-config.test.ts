import { type AppSettings, DEFAULT_APP_SETTINGS } from '@maqar/shared';
import { useAppConfig } from '@/core/app-config/store';
import { jsonResponse, mockFetch } from '../../utils/api';

const saved: AppSettings = {
  splash: { kind: 'image', media: '/uploads/listings/a.jpg', poster: null, textAr: 'أهلا', textEn: 'Hello' },
  calculator: { minDownPct: 10, minYears: 2, maxYears: 8 },
  home: { sections: [...DEFAULT_APP_SETTINGS.home.sections].reverse() },
  contact: { ...DEFAULT_APP_SETTINGS.contact, phone: '01012345678' },
};

beforeEach(() => useAppConfig.setState({ config: DEFAULT_APP_SETTINGS }));

// Phase 29: what an admin sets for the app is fetched when the app opens and kept for the next start.
describe('the app’s settings from the server', () => {
  it('start as the defaults', () => {
    expect(useAppConfig.getState().config).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('are replaced by what the server says', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(200, saved));
    await useAppConfig.getState().refresh();
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/v1\/settings$/);
    expect(useAppConfig.getState().config).toEqual(saved);
  });

  it('stay as they were when the server cannot be reached, and fill in a part an older server leaves out', async () => {
    useAppConfig.setState({ config: saved });
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await useAppConfig.getState().refresh();
    expect(useAppConfig.getState().config).toEqual(saved);

    mockFetch().mockResolvedValue(jsonResponse(200, { calculator: saved.calculator }));
    await useAppConfig.getState().refresh();
    expect(useAppConfig.getState().config).toEqual({ ...DEFAULT_APP_SETTINGS, calculator: saved.calculator });
  });
});
