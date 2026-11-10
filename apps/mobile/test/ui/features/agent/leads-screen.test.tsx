import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { LeadsScreen } from '@/features/agent/screens/leads-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';
import { lead } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const LEADS = [
  lead({ id: 1, name: 'كريم محمود', stage: 'viewing', hot: true, isNew: true }),
  lead({ id: 2, name: 'أحمد سمير', stage: 'new', fromApp: false, phone: '+20 106 *** 5521' }),
  lead({ id: 3, name: 'طارق عبد الله', stage: 'negotiation', fromApp: false }),
];

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'agent' }));
  mockFetch().mockImplementation(async (url: string) => (url.endsWith('/agent/leads') ? jsonResponse(200, LEADS) : jsonResponse(200, { items: [], unread: 0 })));
});

const names = () => screen.getAllByRole('button', { name: /، / }).map((b) => (b.props.accessibilityLabel as string).split('، ')[0]);

describe('My leads', () => {
  it('lists every lead with its stage, hot and new marks, and counts per stage', async () => {
    await renderWithProviders(<LeadsScreen />);
    expect(await screen.findByText('٣ عميل مخصصين ليك')).toBeOnTheScreen();
    expect(names()).toEqual(['كريم محمود', 'أحمد سمير', 'طارق عبد الله']);
    expect(screen.getByRole('button', { name: 'كريم محمود، مهم، جديد من التطبيق، فيلا في التجمع، معاينة' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'الكل، ٣', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'تفاوض، ١' })).toBeOnTheScreen();
  });

  it('filters by stage and by name, Arabic letter variants included', async () => {
    await renderWithProviders(<LeadsScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'جديد، ١' }));
    expect(names()).toEqual(['أحمد سمير']);
    await fireEvent.press(screen.getByRole('radio', { name: 'الكل، ٣' }));
    await fireEvent.changeText(screen.getByLabelText('ابحث باسم العميل'), 'احمد');
    expect(names()).toEqual(['أحمد سمير']);
    await fireEvent.changeText(screen.getByLabelText('ابحث باسم العميل'), 'منى');
    expect(screen.getByText('مفيش عملاء هنا')).toBeOnTheScreen();
  });

  it('opens on the stage it was given, and opens a lead', async () => {
    await renderWithProviders(<LeadsScreen stage="negotiation" />);
    expect(await screen.findByRole('radio', { name: 'تفاوض، ١', checked: true })).toBeOnTheScreen();
    expect(names()).toEqual(['طارق عبد الله']);
    await fireEvent.press(screen.getByRole('button', { name: /^طارق عبد الله/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/lead/3');
  });
});
