import { useLocalSearchParams } from 'expo-router';
import { AdminChatScreen } from '@/features/admin/screens/chats-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdminChatScreen id={Number(id)} />;
}
