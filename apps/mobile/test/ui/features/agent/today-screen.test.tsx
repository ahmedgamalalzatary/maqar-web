import type { AgentToday } from '@maqar/shared';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { TodayScreen } from '@/features/agent/screens/today-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';
import { todayOf } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

function serve(day: AgentToday = todayOf()) {
  mockFetch().mockImplementation(async (url: string) => {
    if (url.endsWith('/agent/today')) return jsonResponse(200, day);
    return jsonResponse(200, { items: [], unread: 0 });
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'agent', name: 'Omar Hassan' }));
});

describe('Agent Today', () => {
  it('greets the agent and shows the stats and the monthly target against the team', async () => {
    serve();
    await renderWithProviders(<TodayScreen />);
    expect(await screen.findByRole('header', { name: 'يومك يا عمر' })).toBeOnTheScreen();
    expect(screen.getByText('تطبيق المبيعات')).toBeOnTheScreen();
    expect(screen.getByText('عملاء جداد')).toBeOnTheScreen();
    expect(screen.getByText('٦ / ٨ صفقات')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'هدف الشهر' })).toHaveProp('accessibilityValue', { min: 0, max: 8, now: 6 });
    expect(screen.getByText('أعلى من متوسط الفريق بـ ٢٠٪')).toBeOnTheScreen();
  });

  it('marks a booking from the app, and opens the lead', async () => {
    serve();
    await renderWithProviders(<TodayScreen />);
    const booking = await screen.findByRole('button', { name: /^٤:٠٠ م النهارده، كريم محمود، جديد من التطبيق/ });
    expect(within(booking).getByText('جديد من التطبيق')).toBeOnTheScreen();
    await fireEvent.press(booking);
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/lead/1');
    expect(screen.getByRole('button', { name: /دينا رأفت/ })).toBeOnTheScreen();
  });

  it('the pipeline opens the leads on that stage, and first calls open the lead', async () => {
    serve();
    await renderWithProviders(<TodayScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'تفاوض، ٠' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/agent/leads', params: { stage: 'negotiation' } });
    await fireEvent.press(screen.getByRole('button', { name: 'كل العملاء' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/leads');
    expect(screen.getByRole('header', { name: 'محتاجين تتواصل معاهم' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^نهى السيد، مهم/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/lead/3');
  });

  it('says when the day is free, and has no target bar without a target', async () => {
    serve(todayOf({ today: [], upcoming: [], firstCall: [], target: { won: 0, target: 0, teamAvg: 0 } }));
    await renderWithProviders(<TodayScreen />);
    expect(await screen.findByText('مفيش معاينات تانية النهارده.')).toBeOnTheScreen();
    expect(screen.getByText('مفيش هدف متحدد للشهر ده.')).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('الجاية')).toBeNull();
    expect(screen.queryByText('محتاجين تتواصل معاهم')).toBeNull();
  });
});
