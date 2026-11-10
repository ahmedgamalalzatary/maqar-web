import type { ChatThread } from '@maqar/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { useAuthPrompt } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { ChatFab } from '@/features/chat/components/chat-fab';
import { ChatsScreen } from '@/features/chat/screens/chats-screen';
import { BookBar } from '@/features/viewings/components/book-bar';
import { jsonResponse, makeAuth, makeCard, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';
import { msg, thread } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const LIST: ChatThread[] = [
  thread({ id: 1, unread: 2, last: msg('agent', { kind: 'plan', price: 1, downPct: 10, years: 8, monthly: 1 }) }),
  thread({ id: 2, property: makeCard({ id: 5, titleAr: 'شقة في زايد' }), last: msg('client', { kind: 'text', text: 'شكراً' }, { readAt: new Date().toISOString() }) }),
];

function serve(list: ChatThread[] = LIST) {
  return mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    if (path === '/chats' && (init.method ?? 'GET') === 'GET') return jsonResponse(200, list);
    if (path === '/chats' && init.method === 'POST') return jsonResponse(201, thread({ id: 9 }));
    return jsonResponse(200, { items: [], unread: 0 });
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  useAuthPrompt.setState({ open: false });
  await useSession.getState().setSession(makeAuth());
});

describe('Messages list', () => {
  it('shows each conversation with its last message and unread count, and opens it', async () => {
    serve();
    await renderWithProviders(<ChatsScreen side="client" />);
    const first = await screen.findByRole('button', { name: 'عمر حسن، فيلا في التجمع، 🧮 خطة السداد، ٢ جديدة' });
    expect(screen.getByRole('button', { name: 'عمر حسن، شقة في زايد، شكراً' })).toBeOnTheScreen();
    await fireEvent.press(first);
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/1');
  });

  it('for an agent, names the client and opens the agent’s conversation', async () => {
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    serve([thread({ id: 3, client: { name: 'نهى السيد', phone: null }, last: msg('client', { kind: 'text', text: 'المقدم كام؟' }), unread: 1 })]);
    await renderWithProviders(<ChatsScreen side="agent" />);
    await fireEvent.press(await screen.findByRole('button', { name: /^نهى السيد، فيلا في التجمع، المقدم كام؟/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/chat/3');
  });

  it('has an empty state that leads to Explore', async () => {
    serve([]);
    await renderWithProviders(<ChatsScreen side="client" />);
    expect(await screen.findByText('مفيش محادثات لسه')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'استكشف الوحدات' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/explore');
  });
});

describe('Chat button', () => {
  it('floats for clients with the unread count, and opens Messages', async () => {
    serve();
    await renderWithProviders(<ChatFab />);
    await fireEvent.press(await screen.findByRole('button', { name: 'المحادثات، ٢ جديدة' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/chat');
  });

  it('is not there for guests or agents', async () => {
    serve();
    await useSession.getState().clear();
    const { unmount } = await renderWithProviders(<ChatFab />);
    expect(screen.queryByRole('button', { name: /المحادثات/ })).toBeNull();
    await unmount();
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    await renderWithProviders(<ChatFab />);
    expect(screen.queryByRole('button', { name: /المحادثات/ })).toBeNull();
  });
});

describe('Chat from the property page', () => {
  it('opens the conversation about the home', async () => {
    const fetchMock = serve();
    await renderWithProviders(<BookBar card={makeCard({ id: 4 })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'كلّم مسؤول المبيعات' }));
    expect(await screen.findByRole('button', { name: 'كلّم مسؤول المبيعات' })).toBeOnTheScreen();
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/9');
    const post = fetchMock.mock.calls.find(([u, init]: [string, RequestInit]) => u.endsWith('/chats') && init.method === 'POST');
    expect(JSON.parse(post![1].body as string)).toEqual({ propertyId: 4 });
  });

  it('asks a guest to sign in first', async () => {
    serve();
    await useSession.getState().clear();
    await renderWithProviders(<BookBar card={makeCard({ id: 4 })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'كلّم مسؤول المبيعات' }));
    expect(useAuthPrompt.getState().open).toBe(true);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
