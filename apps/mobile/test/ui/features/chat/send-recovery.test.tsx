import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useChatUser, useMessages, useSend } from '@/features/chat/hooks/use-chat';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

const Compose = ({ threadId }: { threadId: number }) => {
  const list = useMessages(threadId).data;
  const send = useSend(threadId);
  useChatUser();
  return (
    <>
      <Text>messages:{list?.pages.flatMap((p) => p.items).length ?? 'none'}</Text>
      <Pressable accessibilityRole="button" onPress={() => send.mutate({ kind: 'text', text: 'hello' })}>
        <Text>send</Text>
      </Pressable>
    </>
  );
};

describe('a failed chat send', () => {
  it('refetches the messages after the failure, so a lost response cannot hide a committed message', async () => {
    await useSession.getState().setSession(makeAuth());
    let posts = 0;
    let reads = 0;
    mockFetch().mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/messages') && init?.method === 'POST') {
        posts += 1;
        return jsonResponse(500, { statusCode: 500, message: 'down' });
      }
      if (u.includes('/messages')) {
        reads += 1;
        return jsonResponse(200, { items: [], hasMore: false });
      }
      return jsonResponse(200, {});
    });
    await renderWithProviders(<Compose threadId={1} />);
    expect(await screen.findByText('messages:0')).toBeTruthy();
    expect(reads).toBe(1);
    fireEvent.press(screen.getByText('send'));
    await waitFor(() => expect(posts).toBe(1));
    // The send failed; the refetch would show a message the server did commit but whose answer
    // was lost.
    await waitFor(() => expect(reads).toBe(2));
  });
});
