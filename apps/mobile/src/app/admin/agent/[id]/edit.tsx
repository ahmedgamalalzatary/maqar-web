import { useLocalSearchParams } from 'expo-router';
import { AgentFormScreen } from '@/features/admin/screens/agent-form-screen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AgentFormScreen id={Number(id)} />;
}
