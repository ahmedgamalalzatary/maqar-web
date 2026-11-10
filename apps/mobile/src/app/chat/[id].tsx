import { useLocalSearchParams } from 'expo-router';
import { ConversationScreen } from '@/features/chat/screens/conversation-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen id={Number(id)} side="client" />;
}
